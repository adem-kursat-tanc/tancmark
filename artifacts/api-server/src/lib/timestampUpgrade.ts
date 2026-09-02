import { db, timestampProofsTable, type TimestampProofRow } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { upgradeReceipt, isBtcAnchored, type CalendarReceipt } from "@workspace/aegis-core";
import { recordEventFireAndForget } from "./auditStore";
import { mirrorVaultOtsProof } from "./vaultOtsMirror";

export type UpgradeTransition =
  | "newly_anchored"
  | "still_pending"
  | "still_anchored"
  | "error";

export interface UpgradeRowResult {
  rowId: number;
  transition: UpgradeTransition;
  anchored: boolean;
  proofs: CalendarReceipt[];
  error?: string;
}

export interface UpgradeRowOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  source: "manual" | "sweeper";
  ip?: string;
  route?: string;
}

/**
 * Shared upgrade helper. Manual `/aegis/timestamp/.../upgrade` admin endpoint
 * and the background `timestampSweeper` both call this so behaviour stays
 * identical (including audit emission and idempotency guard).
 *
 * Idempotency contract for `Timestamp_Anchored` (race-safe):
 *   Audit emission is gated by an atomic conditional UPDATE — the transition
 *   `btc_anchored: false → true` is performed via
 *   `UPDATE ... WHERE id = ? AND btc_anchored = false RETURNING id`. Only the
 *   caller whose UPDATE actually flipped the row (RETURNING returns one row)
 *   emits `Timestamp_Anchored`. Concurrent callers (manual×manual,
 *   manual×sweeper, sweeper×sweeper) racing the same row therefore produce
 *   exactly one audit event regardless of which lost the race. Sweeper-vs-
 *   sweeper races are additionally serialised by the advisory lock; this
 *   guard hardens manual-vs-anything races.
 *
 *   For non-transition writes (still_pending, still_anchored) we issue a
 *   plain UPDATE that refreshes `proofs` + `last_checked_at` only — never
 *   touching `btc_anchored` — so an already-anchored row cannot be flipped
 *   back to false by a stale read.
 */
export async function upgradeOneRow(
  row: TimestampProofRow,
  opts: UpgradeRowOptions,
): Promise<UpgradeRowResult> {
  const fetchImpl = opts.fetchImpl;
  const timeoutMs = opts.timeoutMs;
  const wasAnchored = row.btcAnchored;
  try {
    const upgraded: CalendarReceipt[] = await Promise.all(
      (row.proofs ?? []).map((p) =>
        upgradeReceipt(row.payloadSha256, p, {
          ...(fetchImpl ? { fetchImpl } : {}),
          ...(typeof timeoutMs === "number" ? { timeoutMs } : {}),
        }),
      ),
    );
    const anchored = isBtcAnchored(upgraded);

    let transition: UpgradeTransition;
    if (!wasAnchored && anchored) {
      // Atomic transition guard. Race-safe: only the caller that actually
      // flips `btc_anchored: false → true` gets a RETURNING row and is
      // permitted to emit the `Timestamp_Anchored` audit. A concurrent
      // caller (lost the race) gets an empty RETURNING and is demoted to
      // `still_anchored` (no audit, no double-write of btc_anchored).
      const flipped = await db
        .update(timestampProofsTable)
        .set({
          proofs: upgraded as typeof timestampProofsTable.$inferInsert.proofs,
          btcAnchored: true,
          lastCheckedAt: new Date(),
        })
        .where(
          and(
            eq(timestampProofsTable.id, row.id),
            eq(timestampProofsTable.btcAnchored, false),
          ),
        )
        .returning({ id: timestampProofsTable.id });

      if (flipped.length === 0) {
        // Lost the race — another caller already anchored this row. Refresh
        // proofs + last_checked_at without touching btc_anchored, and skip
        // the audit (the winning caller emitted it).
        await db
          .update(timestampProofsTable)
          .set({
            proofs: upgraded as typeof timestampProofsTable.$inferInsert.proofs,
            lastCheckedAt: new Date(),
          })
          .where(eq(timestampProofsTable.id, row.id));
        return {
          rowId: row.id,
          transition: "still_anchored",
          anchored: true,
          proofs: upgraded,
        };
      }

      transition = "newly_anchored";
      if (row.kind === "vault") {
        // Step 3 Bölüm 3 — pending → btc transition: vault_anchors.ots_proof
        // mirror'ını güncelle. Atomic UPDATE...RETURNING guard yukarıda zaten
        // yalnızca kazanan caller'ı buraya kadar getirdiği için audit/mirror
        // tek seferdir (manual×manual, manual×sweeper, sweeper×sweeper race
        // korunur). Mirror key = payload_sha256 (tenant-eşsiz).
        const btcBlock =
          upgraded.find((u) => u.status === "btc" && typeof (u as { btcBlock?: number }).btcBlock === "number")
            ? ((upgraded.find((u) => u.status === "btc") as { btcBlock?: number }).btcBlock ?? null)
            : null;
        void mirrorVaultOtsProof({
          cloakId: row.referenceId,
          payload: {
            status: "btc",
            payloadSha256: row.payloadSha256,
            proofs: upgraded,
            submittedAt: row.submittedAt.toISOString(),
            anchoredAt: new Date().toISOString(),
            btcBlock,
          },
        });
      }
      recordEventFireAndForget({
        ip: opts.ip ?? "system",
        route: opts.route ?? "/aegis/timestamp/upgrade",
        kind: "Timestamp_Anchored",
        details: {
          proofId: row.id,
          referenceKind: row.kind,
          referenceId: row.referenceId,
          payloadSha256: row.payloadSha256,
          btcBlock: row.btcBlock ?? null,
          calendars: upgraded
            .filter((u) => u.status === "btc")
            .map((u) => ({ calendar: u.calendar, status: u.status })),
          submittedAt: row.submittedAt.toISOString(),
          anchoredAt: new Date().toISOString(),
          source: opts.source,
        },
      });
    } else if (wasAnchored && anchored) {
      // Already anchored — refresh proofs + last_checked_at only. We never
      // re-write `btc_anchored` here so a stale read can't flip the flag back.
      await db
        .update(timestampProofsTable)
        .set({
          proofs: upgraded as typeof timestampProofsTable.$inferInsert.proofs,
          lastCheckedAt: new Date(),
        })
        .where(eq(timestampProofsTable.id, row.id));
      transition = "still_anchored";
    } else {
      // Still pending (calendars haven't anchored yet). Refresh proofs +
      // last_checked_at; btc_anchored stays false.
      await db
        .update(timestampProofsTable)
        .set({
          proofs: upgraded as typeof timestampProofsTable.$inferInsert.proofs,
          lastCheckedAt: new Date(),
        })
        .where(eq(timestampProofsTable.id, row.id));
      transition = "still_pending";
    }

    return { rowId: row.id, transition, anchored, proofs: upgraded };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Even on failure we touch `last_checked_at` so the sweeper does not
    // immediately retry a permanently broken row on every tick.
    try {
      await db
        .update(timestampProofsTable)
        .set({ lastCheckedAt: new Date() })
        .where(eq(timestampProofsTable.id, row.id));
    } catch {
      /* swallow secondary failure; primary error already captured */
    }
    return {
      rowId: row.id,
      transition: "error",
      anchored: wasAnchored,
      proofs: row.proofs ?? [],
      error: message,
    };
  }
}

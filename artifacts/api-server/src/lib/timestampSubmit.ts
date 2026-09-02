import { db, timestampProofsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { digestPayload, submitDigest, isBtcAnchored, type CalendarReceipt } from "@workspace/aegis-core";
import { logger } from "./logger";
import { recordEventFireAndForget } from "./auditStore";
import { mirrorVaultOtsProof } from "./vaultOtsMirror";

/**
 * Reduce a set of calendar receipts to a single outcome label so
 * downstream audit / response semantics don't overstate success when
 * every calendar errored.
 */
function classifyReceipts(receipts: CalendarReceipt[]): "anchored" | "pending" | "partial" | "error" {
  if (receipts.length === 0) return "error";
  const anchored = receipts.some((r) => r.status === "btc");
  const pending = receipts.some((r) => r.status === "pending");
  const errored = receipts.some((r) => r.status === "error");
  if (anchored) return "anchored";
  if (pending && errored) return "partial";
  if (pending) return "pending";
  return "error";
}

/**
 * Fire-and-forget OTS submission for freshly produced AEGIS payloads
 * or canonical record hashes. Idempotent on `(kind, referenceId)` thanks to the
 * `ts_proofs_ref_uniq` index — re-running a cloak with the same id
 * just no-ops.
 *
 * NEVER throws. Calendar errors are logged and swallowed; the cloak
 * pipeline must not fail because OpenTimestamps is unreachable.
 */
export type TimestampReferenceKind =
  | "cloak"
  | "protect"
  | "vault"
  | "evidence_package";

export function submitTimestampFireAndForget(args: {
  kind: TimestampReferenceKind;
  referenceId: string;
  payload: string;
}): void {
  void (async () => {
    try {
      const digest = digestPayload(args.payload);
      const existing = await db
        .select({ id: timestampProofsTable.id })
        .from(timestampProofsTable)
        .where(
          and(
            eq(timestampProofsTable.kind, args.kind),
            eq(timestampProofsTable.referenceId, args.referenceId),
          ),
        )
        .limit(1);
      if (existing.length > 0) return;

      const receipts: CalendarReceipt[] = await submitDigest(digest);
      const outcome = classifyReceipts(receipts);
      // Race-safe gate: only the caller whose insert is actually
      // persisted (RETURNING returns one row) is allowed to fire the
      // post-insert side effects (vault mirror + Timestamp_Submit audit).
      // Concurrent callers losing the (kind, referenceId) uniqueness race
      // get an empty RETURNING and short-circuit out — preventing
      // duplicate Vault_Ots_Submitted audit and double mirror writes.
      const inserted = await db
        .insert(timestampProofsTable)
        .values({
          kind: args.kind,
          referenceId: args.referenceId,
          payloadSha256: digest,
          proofs: receipts,
          btcAnchored: isBtcAnchored(receipts),
          lastCheckedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [timestampProofsTable.kind, timestampProofsTable.referenceId],
        })
        .returning({ id: timestampProofsTable.id });
      if (inserted.length === 0) {
        logger.info(
          { kind: args.kind, referenceId: args.referenceId },
          "[timestamp] insert lost race, skipping side effects",
        );
        return;
      }
      logger.info(
        {
          kind: args.kind,
          referenceId: args.referenceId,
          digest,
          outcome,
          receipts: receipts.map((r) => ({ calendar: r.calendar, status: r.status })),
        },
        "[timestamp] submitted",
      );
      if (args.kind === "vault") {
        // Step 3 Bölüm 3 — vault_anchors.ots_proof'a mirror.
        // Composite mirror key = (cloak_id, payload_digest_sha256).
        // Sadece bu submission'ın kanonik payload'ını imzalamış olan
        // vault_anchors satırı update edilir; race overwrite veya
        // cross-tenant cloakId çakışması durumunda 0 satır eşleşir ve
        // skip log atılır (non-fatal: timestamp_proofs canonical kanıt
        // olarak persiste, backfill ileride mirror'layabilir).
        await mirrorVaultOtsProof({
          cloakId: args.referenceId,
          payload: {
            status: isBtcAnchored(receipts) ? "btc" : "pending",
            payloadSha256: digest,
            proofs: receipts,
            submittedAt: new Date().toISOString(),
          },
        });
      }
      recordEventFireAndForget({
        ip: "system",
        route: "/aegis/timestamp/submit",
        kind: "Timestamp_Submit",
        details: {
          referenceKind: args.kind,
          referenceId: args.referenceId,
          digest,
          outcome,
          calendars: receipts.map((r) => ({
            calendar: r.calendar,
            status: r.status,
            ...(r.error ? { error: r.error } : {}),
          })),
        },
      });
    } catch (err) {
      logger.warn(
        { err, kind: args.kind, referenceId: args.referenceId },
        "[timestamp] submit failed",
      );
      recordEventFireAndForget({
        ip: "system",
        route: "/aegis/timestamp/submit",
        kind: "Timestamp_Submit",
        details: {
          referenceKind: args.kind,
          referenceId: args.referenceId,
          outcome: "error",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  })();
}

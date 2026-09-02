import { db, vaultAnchorsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { CalendarReceipt } from "@workspace/aegis-core";
import { logger } from "./logger";
import { recordEventFireAndForget } from "./auditStore";

export interface VaultOtsProofPayload {
  status: "pending" | "btc";
  payloadSha256: string;
  proofs: CalendarReceipt[];
  submittedAt: string;
  anchoredAt?: string;
  btcBlock?: number | null;
}

/**
 * Mirror an OTS proof bundle into the matching `vault_anchors` row.
 *
 * **Composite mirror key** = `(cloak_id, payload_digest_sha256)`.
 *
 * - `cloakId` alone is unsafe: it is a deterministic 24-hex HMAC of
 *   `(secret, clientId, docId, keyVersion)`. The master secret is shared
 *   across tenants per key version, so two tenants using the same
 *   sub-customer `clientId` + `docId` produce the **same** cloakId.
 * - `payloadDigestSha256` is sha256 of the canonical payload, which
 *   incorporates per-anchor `cascadeRoot`, `protectionHash`, `issuedAt`
 *   etc. — practically impossible to collide across tenants.
 * - The composite WHERE binds the OTS submission to the specific
 *   anchor whose canonical payload was actually digested + submitted.
 *   In the rare pathological case where parallel cloak-text calls for
 *   the same (clientId, docId) overwrite `vault_anchors` between
 *   submission and mirror (last-writer-wins via the partial unique
 *   index), the WHERE matches 0 rows and we skip — non-fatal because
 *   the canonical OTS proof persists in `timestamp_proofs` and a
 *   future backfill job can re-mirror.
 *
 * Caller is responsible for de-duplicating `Vault_Ots_*` audit emission
 * (we only fire audit when the UPDATE actually matched a row, and the
 * upstream race-gate in `submitTimestampFireAndForget` ensures only one
 * caller reaches mirror per `(kind, referenceId)`).
 */
export async function mirrorVaultOtsProof(args: {
  cloakId: string;
  payload: VaultOtsProofPayload;
}): Promise<void> {
  try {
    const updated = await db
      .update(vaultAnchorsTable)
      .set({ otsProof: args.payload as unknown as Record<string, unknown> })
      .where(
        and(
          eq(vaultAnchorsTable.cloakId, args.cloakId),
          eq(vaultAnchorsTable.payloadDigestSha256, args.payload.payloadSha256),
        ),
      )
      .returning({
        id: vaultAnchorsTable.id,
        tenantId: vaultAnchorsTable.tenantId,
        cloakId: vaultAnchorsTable.cloakId,
      });
    if (updated.length === 0) {
      logger.warn(
        { cloakId: args.cloakId, payloadSha256: args.payload.payloadSha256 },
        "[vault-ots-mirror] no vault_anchors row matched (cloakId, payloadDigestSha256) — likely concurrent overwrite or cross-tenant cloakId reuse",
      );
      return;
    }
    // Emit one audit per matched row (in the rare hypothetical multi-row
    // case we want full transparency rather than silently aggregating).
    for (const row of updated) {
      recordEventFireAndForget({
        ip: "system",
        route: "/aegis/vault/ots-mirror",
        ...(row.tenantId != null ? { clientId: row.tenantId } : {}),
        kind:
          args.payload.status === "btc"
            ? "Vault_Ots_Anchored"
            : "Vault_Ots_Submitted",
        details: {
          cloakId: row.cloakId,
          vaultAnchorId: row.id,
          status: args.payload.status,
          payloadSha256: args.payload.payloadSha256,
          ...(args.payload.btcBlock != null
            ? { btcBlock: args.payload.btcBlock }
            : {}),
          calendars: args.payload.proofs.map((p) => ({
            calendar: p.calendar,
            status: p.status,
          })),
        },
      });
    }
  } catch (err) {
    logger.warn(
      { err, payloadSha256: args.payload.payloadSha256 },
      "[vault-ots-mirror] failed to update vault_anchors.ots_proof",
    );
  }
}

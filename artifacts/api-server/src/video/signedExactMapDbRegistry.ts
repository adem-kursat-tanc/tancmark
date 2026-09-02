import { db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { aegis } from "../lib/aegis";
import { videoExactSealTimingMapsTable } from "../../../../lib/db/src/schema/videoExactSealTimingMaps";
import type {
  PrivateSignedExactMapRegistry,
  PrivateSignedExactMapRegistryRow,
  SignedExactMapKeyResolver,
  SignedExactSealTimingMapV2Envelope,
} from "./signedExactSealTimingMapV2";

function revokedKeyIds(): ReadonlySet<string> {
  return new Set(
    (process.env["REVOKED_AEGIS_SECRET_VERSIONS"] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export const signedExactMapDbRegistry: PrivateSignedExactMapRegistry = {
  async lookup(input) {
    const rows = await db
      .select()
      .from(videoExactSealTimingMapsTable)
      .where(and(
        eq(videoExactSealTimingMapsTable.tenantId, input.tenantId),
        eq(videoExactSealTimingMapsTable.accountId, input.accountId),
        eq(videoExactSealTimingMapsTable.registryRecordId, input.registryRecordId),
      ));
    return rows.map((row): PrivateSignedExactMapRegistryRow => ({
      tenantId: row.tenantId,
      accountId: row.accountId,
      registryRecordId: row.registryRecordId,
      registryRevision: row.registryRevision,
      keyId: row.keyId,
      expectedEncoderReceiptSha256: row.expectedEncoderReceiptSha256,
      status: row.status,
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      supersededByRecordId: row.supersededByRecordId,
      envelope: row.envelope as unknown as SignedExactSealTimingMapV2Envelope,
    }));
  },
};

export const signedExactMapProductKeyResolver: SignedExactMapKeyResolver = {
  async resolve(input) {
    const secret = aegis.getSecretForVersion(input.keyId);
    if (!secret) return undefined;
    return {
      keyId: input.keyId,
      masterSecret: Buffer.from(secret, "utf8"),
      tenantSalt: `tenant:${input.tenantId}`,
      revoked: revokedKeyIds().has(input.keyId),
    };
  },
};

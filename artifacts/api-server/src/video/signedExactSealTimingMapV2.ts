import {
  canonicalizeVaultPayload,
  deriveVaultKeypair,
  signVaultAnchor,
  verifyVaultAnchorRaw,
} from "@workspace/aegis-core";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  buildPrivateExactSealTimingMap,
  validatePrivateExactSealTimingMap,
  type ExactFrameAddress,
  type ExactSealTimingMap,
} from "./exactSealTimingMap";

export const SIGNED_EXACT_SEAL_TIMING_MAP_V2_SCHEMA =
  "tancmark-private-signed-exact-seal-timing-map-v2" as const;
export const SIGNED_EXACT_SEAL_TIMING_MAP_V2_SIGNATURE_VERSION =
  "tancmark-vault-ml-dsa-65-v1" as const;
export const SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION =
  "aegis-video-channel-a-l1-l3-ecc-current-frozen" as const;
export const SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION =
  "v0.5A+s2B" as const;

const MAP_COMMITMENT_PREFIX = "exact-map-v2-sha256:";
const MAP_PIPELINE_PREFIX = "SIGNED_EXACT_SEAL_TIMING_MAP_V2:";

export interface SignedExactSealTimingMapV2 {
  schemaVersion: typeof SIGNED_EXACT_SEAL_TIMING_MAP_V2_SCHEMA;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  watermarkAlgorithmVersion: string;
  videoWatermarkVersion: string;
  encoderReceiptSha256: string;
  videoIdentityDigestSha256: string;
  frameCount: number;
  videoTimeBase: string;
  framePtsDigestSha256: string;
  channelA: ExactFrameAddress[];
  channelB: ExactFrameAddress[];
  createdAt: string;
  keyId: string;
  signatureVersion: typeof SIGNED_EXACT_SEAL_TIMING_MAP_V2_SIGNATURE_VERSION;
}

export interface SignedExactSealTimingMapV2Authorization {
  algorithm: "ml-dsa-65";
  keyDerivation: "hkdf-v1";
  keyId: string;
  signatureVersion: typeof SIGNED_EXACT_SEAL_TIMING_MAP_V2_SIGNATURE_VERSION;
  publicKeyBase64: string;
  signatureBase64: string;
  payloadCanonical: string;
  payloadDigestSha256: string;
  signedAt: string;
}

export interface SignedExactSealTimingMapV2Envelope {
  map: SignedExactSealTimingMapV2;
  mapCanonical: string;
  mapDigestSha256: string;
  authorization: SignedExactSealTimingMapV2Authorization;
}

export type PrivateSignedExactMapRegistryStatus =
  | "ACTIVE"
  | "REVOKED"
  | "SUPERSEDED";

export interface PrivateSignedExactMapRegistryRow {
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  keyId: string;
  expectedEncoderReceiptSha256: string;
  status: PrivateSignedExactMapRegistryStatus;
  revokedAt: string | null;
  supersededByRecordId: string | null;
  envelope: SignedExactSealTimingMapV2Envelope;
}

export interface PrivateSignedExactMapRegistry {
  lookup(input: {
    tenantId: string;
    accountId: string;
    registryRecordId: string;
  }): Promise<readonly PrivateSignedExactMapRegistryRow[]>;
}

export interface ResolvedMapSigningKey {
  keyId: string;
  masterSecret: Buffer | Uint8Array;
  tenantSalt: string;
  revoked: boolean;
}

export interface SignedExactMapKeyResolver {
  resolve(input: {
    tenantId: string;
    accountId: string;
    keyId: string;
  }): Promise<ResolvedMapSigningKey | undefined>;
}

export type SignedExactMapV2RejectReason =
  | "REGISTRY_NOT_FOUND"
  | "REGISTRY_AMBIGUOUS"
  | "REGISTRY_RECORD_MISMATCH"
  | "TENANT_MISMATCH"
  | "ACCOUNT_MISMATCH"
  | "REGISTRY_REVISION_MISMATCH"
  | "REVOKED_MAP"
  | "SUPERSEDED_MAP"
  | "SCHEMA_MISMATCH"
  | "MAP_SHAPE_INVALID"
  | "MAP_CANONICAL_MISMATCH"
  | "MAP_DIGEST_MISMATCH"
  | "ENCODER_RECEIPT_MISMATCH"
  | "WATERMARK_ALGORITHM_VERSION_MISMATCH"
  | "VIDEO_WATERMARK_VERSION_MISMATCH"
  | "KEY_ID_MISMATCH"
  | "KEY_NOT_AVAILABLE"
  | "KEY_REVOKED"
  | "PUBLIC_KEY_INVALID"
  | "PUBLIC_KEY_MISMATCH"
  | "SIGNATURE_MISSING"
  | "SIGNATURE_INVALID"
  | "AUTHORIZATION_CONTEXT_MISMATCH"
  | "AUTHORIZATION_DIGEST_MISMATCH"
  | "VIDEO_IDENTITY_MISMATCH"
  | `EXACT_MAP_${string}`;

export interface SignedExactMapV2Resolution {
  status: "VALIDATED" | "RECOVERY_REQUIRED" | "NOT_FOUND" | "MANUAL_REVIEW";
  reason: "VALID" | SignedExactMapV2RejectReason;
  registryVerified: boolean;
  signatureVerified: boolean;
  exactMapVerified: boolean;
  presentedIdentityVerified: boolean;
  uniqueRecord: boolean;
  /** Authenticated only after registry, identity and signature verification.
   * Callers may use it to verify private receipt bytes before recovery. */
  encoderReceiptSha256?: string;
  /** Exact physical AEGIS key lineage authenticated by row + map + signature.
   * Physical readers must use this version instead of the global active key. */
  authenticatedKeyId?: string;
  map?: ExactSealTimingMap;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function orderedAddress(address: ExactFrameAddress): Record<string, unknown> {
  return {
    frameIdx: address.frameIdx,
    pts: address.pts,
    timeBase: address.timeBase,
  };
}

export function canonicalizeSignedExactSealTimingMapV2(
  map: SignedExactSealTimingMapV2,
): string {
  return JSON.stringify({
    accountId: map.accountId,
    channelA: map.channelA.map(orderedAddress),
    channelB: map.channelB.map(orderedAddress),
    createdAt: map.createdAt,
    encoderReceiptSha256: map.encoderReceiptSha256,
    frameCount: map.frameCount,
    framePtsDigestSha256: map.framePtsDigestSha256,
    keyId: map.keyId,
    registryRecordId: map.registryRecordId,
    registryRevision: map.registryRevision,
    schemaVersion: map.schemaVersion,
    signatureVersion: map.signatureVersion,
    tenantId: map.tenantId,
    videoIdentityDigestSha256: map.videoIdentityDigestSha256,
    videoTimeBase: map.videoTimeBase,
    videoWatermarkVersion: map.videoWatermarkVersion,
    watermarkAlgorithmVersion: map.watermarkAlgorithmVersion,
  });
}

function mapShapeValid(map: SignedExactSealTimingMapV2): boolean {
  const strings = [
    map.tenantId,
    map.accountId,
    map.registryRecordId,
    map.watermarkAlgorithmVersion,
    map.videoWatermarkVersion,
    map.videoTimeBase,
    map.createdAt,
    map.keyId,
  ];
  if (strings.some((value) => typeof value !== "string" || value.length === 0)) {
    return false;
  }
  if (!Number.isInteger(map.registryRevision) || map.registryRevision < 1 ||
      !Number.isInteger(map.frameCount) || map.frameCount < 1) {
    return false;
  }
  if (!isSha256(map.encoderReceiptSha256) ||
      !isSha256(map.videoIdentityDigestSha256) ||
      !isSha256(map.framePtsDigestSha256)) {
    return false;
  }
  if (!Number.isFinite(Date.parse(map.createdAt))) return false;
  if (map.signatureVersion !== SIGNED_EXACT_SEAL_TIMING_MAP_V2_SIGNATURE_VERSION) {
    return false;
  }
  return Array.isArray(map.channelA) && Array.isArray(map.channelB) &&
    map.channelA.length > 0 && map.channelB.length > 0;
}

function reject(
  reason: SignedExactMapV2RejectReason,
  manualReview = false,
): SignedExactMapV2Resolution {
  return {
    status: manualReview ? "MANUAL_REVIEW" : "NOT_FOUND",
    reason,
    registryVerified: false,
    signatureVerified: false,
    exactMapVerified: false,
    presentedIdentityVerified: false,
    uniqueRecord: !manualReview,
  };
}

export async function createSignedExactSealTimingMapV2(input: {
  videoPath: string;
  videoIdentityHex: string;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
  watermarkAlgorithmVersion: string;
  videoWatermarkVersion: string;
  encoderReceiptSha256: string;
  channelAFrameIdxs: readonly number[];
  channelBFrameIdxs: readonly number[];
  createdAt: string;
  keyId: string;
  masterSecret: Buffer | Uint8Array;
  tenantSalt: string;
}): Promise<SignedExactSealTimingMapV2Envelope> {
  if (!isSha256(input.encoderReceiptSha256.toLowerCase())) {
    throw new Error("ENCODER_RECEIPT_SHA256_INVALID");
  }
  const v1Map = await buildPrivateExactSealTimingMap({
    videoPath: input.videoPath,
    registryRecordIdHex: input.videoIdentityHex,
    channelAFrameIdxs: input.channelAFrameIdxs,
    channelBFrameIdxs: input.channelBFrameIdxs,
  });
  const map: SignedExactSealTimingMapV2 = {
    schemaVersion: SIGNED_EXACT_SEAL_TIMING_MAP_V2_SCHEMA,
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId: input.registryRecordId,
    registryRevision: input.registryRevision,
    watermarkAlgorithmVersion: input.watermarkAlgorithmVersion,
    videoWatermarkVersion: input.videoWatermarkVersion,
    encoderReceiptSha256: input.encoderReceiptSha256.toLowerCase(),
    videoIdentityDigestSha256: v1Map.registryRecordIdHashSha256,
    frameCount: v1Map.frameCount,
    videoTimeBase: v1Map.videoTimeBase,
    framePtsDigestSha256: v1Map.framePtsDigestSha256,
    channelA: v1Map.channelA,
    channelB: v1Map.channelB,
    createdAt: input.createdAt,
    keyId: input.keyId,
    signatureVersion: SIGNED_EXACT_SEAL_TIMING_MAP_V2_SIGNATURE_VERSION,
  };
  if (!mapShapeValid(map)) throw new Error("SIGNED_EXACT_MAP_V2_SHAPE_INVALID");
  const mapCanonical = canonicalizeSignedExactSealTimingMapV2(map);
  const mapDigestSha256 = sha256Utf8(mapCanonical);
  const vaultAnchor = signVaultAnchor({
    masterSecret: input.masterSecret,
    tenantSalt: input.tenantSalt,
    clientId: input.accountId,
    docId: input.registryRecordId,
    cloakId: map.videoIdentityDigestSha256,
    payload: {
      cloakId: map.videoIdentityDigestSha256,
      clientId: input.accountId,
      docId: input.registryRecordId,
      keyVersion: input.keyId,
      pipelineVersion: `${MAP_PIPELINE_PREFIX}${map.signatureVersion}`,
      protectionHash: `${MAP_COMMITMENT_PREFIX}${mapDigestSha256}`,
      cascadeRoot: map.encoderReceiptSha256,
      issuedAt: map.createdAt,
    },
  });
  return {
    map,
    mapCanonical,
    mapDigestSha256,
    authorization: {
      algorithm: vaultAnchor.algorithm,
      keyDerivation: vaultAnchor.keyDerivation,
      keyId: input.keyId,
      signatureVersion: map.signatureVersion,
      publicKeyBase64: Buffer.from(vaultAnchor.publicKey).toString("base64"),
      signatureBase64: Buffer.from(vaultAnchor.signature).toString("base64"),
      payloadCanonical: vaultAnchor.payloadCanonical,
      payloadDigestSha256: vaultAnchor.payloadDigestSha256,
      signedAt: vaultAnchor.signedAt,
    },
  };
}

export async function resolveSignedExactSealTimingMapV2(input: {
  videoPath: string;
  presentedVideoIdentityHex: string;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  expectedWatermarkAlgorithmVersion: string;
  expectedVideoWatermarkVersion: string;
  registry: PrivateSignedExactMapRegistry;
  keyResolver: SignedExactMapKeyResolver;
}): Promise<SignedExactMapV2Resolution> {
  const rows = await input.registry.lookup({
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId: input.registryRecordId,
  });
  if (rows.length === 0) return reject("REGISTRY_NOT_FOUND");
  if (rows.length !== 1) return reject("REGISTRY_AMBIGUOUS", true);
  const row = rows[0]!;
  const envelope = row.envelope;
  const map = envelope.map;
  if (row.tenantId !== input.tenantId || map.tenantId !== input.tenantId) {
    return reject("TENANT_MISMATCH");
  }
  if (row.accountId !== input.accountId || map.accountId !== input.accountId) {
    return reject("ACCOUNT_MISMATCH");
  }
  if (row.registryRecordId !== input.registryRecordId ||
      map.registryRecordId !== input.registryRecordId) {
    return reject("REGISTRY_RECORD_MISMATCH");
  }
  if (row.registryRevision !== map.registryRevision) {
    return reject("REGISTRY_REVISION_MISMATCH");
  }
  if (row.status === "REVOKED" || row.revokedAt !== null) {
    return reject("REVOKED_MAP");
  }
  if (row.status === "SUPERSEDED" || row.supersededByRecordId !== null) {
    return reject("SUPERSEDED_MAP");
  }
  if (map.schemaVersion !== SIGNED_EXACT_SEAL_TIMING_MAP_V2_SCHEMA) {
    return reject("SCHEMA_MISMATCH");
  }
  if (!mapShapeValid(map)) return reject("MAP_SHAPE_INVALID");
  if (map.watermarkAlgorithmVersion !== input.expectedWatermarkAlgorithmVersion) {
    return reject("WATERMARK_ALGORITHM_VERSION_MISMATCH");
  }
  if (map.videoWatermarkVersion !== input.expectedVideoWatermarkVersion) {
    return reject("VIDEO_WATERMARK_VERSION_MISMATCH");
  }
  if (map.encoderReceiptSha256 !== row.expectedEncoderReceiptSha256) {
    return reject("ENCODER_RECEIPT_MISMATCH");
  }
  const canonical = canonicalizeSignedExactSealTimingMapV2(map);
  if (canonical !== envelope.mapCanonical) {
    return reject("MAP_CANONICAL_MISMATCH");
  }
  const mapDigestSha256 = sha256Utf8(canonical);
  if (mapDigestSha256 !== envelope.mapDigestSha256) {
    return reject("MAP_DIGEST_MISMATCH");
  }
  const auth = envelope.authorization;
  if (!auth.signatureBase64) return reject("SIGNATURE_MISSING");
  if (row.keyId !== map.keyId || row.keyId !== auth.keyId ||
      map.keyId !== auth.keyId) {
    return reject("KEY_ID_MISMATCH");
  }
  const key = await input.keyResolver.resolve({
    tenantId: input.tenantId,
    accountId: input.accountId,
    keyId: map.keyId,
  });
  if (!key || key.keyId !== map.keyId) return reject("KEY_NOT_AVAILABLE");
  if (key.revoked) return reject("KEY_REVOKED");
  const expectedKeypair = deriveVaultKeypair({
    masterSecret: key.masterSecret,
    tenantSalt: key.tenantSalt,
    clientId: map.accountId,
    docId: map.registryRecordId,
    cloakId: map.videoIdentityDigestSha256,
  });
  let storedPublicKey: Buffer;
  let signature: Buffer;
  try {
    storedPublicKey = Buffer.from(auth.publicKeyBase64, "base64");
    signature = Buffer.from(auth.signatureBase64, "base64");
  } catch {
    return reject("PUBLIC_KEY_INVALID");
  }
  const expectedPublicKey = Buffer.from(expectedKeypair.publicKey);
  if (storedPublicKey.length !== expectedPublicKey.length ||
      !timingSafeEqual(storedPublicKey, expectedPublicKey)) {
    return reject("PUBLIC_KEY_MISMATCH");
  }
  const expectedAuthorizationPayload = {
    cloakId: map.videoIdentityDigestSha256,
    clientId: map.accountId,
    docId: map.registryRecordId,
    keyVersion: map.keyId,
    pipelineVersion: `${MAP_PIPELINE_PREFIX}${map.signatureVersion}`,
    protectionHash: `${MAP_COMMITMENT_PREFIX}${mapDigestSha256}`,
    cascadeRoot: map.encoderReceiptSha256,
    issuedAt: map.createdAt,
  };
  if (canonicalizeVaultPayload(expectedAuthorizationPayload) !== auth.payloadCanonical) {
    return reject("AUTHORIZATION_CONTEXT_MISMATCH");
  }
  if (sha256Utf8(auth.payloadCanonical) !== auth.payloadDigestSha256) {
    return reject("AUTHORIZATION_DIGEST_MISMATCH");
  }
  if (!verifyVaultAnchorRaw({
    publicKey: storedPublicKey,
    payloadCanonical: auth.payloadCanonical,
    signature,
  })) {
    return reject("SIGNATURE_INVALID");
  }
  if (sha256Utf8(input.presentedVideoIdentityHex) !==
      map.videoIdentityDigestSha256) {
    return reject("VIDEO_IDENTITY_MISMATCH");
  }
  const exactMap: ExactSealTimingMap = {
    schemaVersion: "tancmark-private-exact-seal-timing-map-v1",
    frameCount: map.frameCount,
    videoTimeBase: map.videoTimeBase,
    framePtsDigestSha256: map.framePtsDigestSha256,
    registryRecordIdHashSha256: map.videoIdentityDigestSha256,
    channelA: map.channelA,
    channelB: map.channelB,
  };
  const exactValidation = await validatePrivateExactSealTimingMap({
    videoPath: input.videoPath,
    registryRecordIdHex: input.presentedVideoIdentityHex,
    map: exactMap,
  });
  if (!exactValidation.valid) {
    // The signed registry row, tenant/account/record binding, signature and
    // presented full identity have already been authenticated above. A
    // delivery transform can invalidate only the exact timing address map.
    // That map is an addressing accelerator, not ownership authority: retain
    // the authenticated digital chain and require a physical VFR-safe scan.
    return {
      status: "RECOVERY_REQUIRED",
      reason: `EXACT_MAP_${exactValidation.reason}`,
      registryVerified: true,
      signatureVerified: true,
      exactMapVerified: false,
      presentedIdentityVerified: true,
      uniqueRecord: true,
      encoderReceiptSha256: map.encoderReceiptSha256,
      authenticatedKeyId: map.keyId,
      // The authenticated source map remains a locator input only. It is not
      // valid for direct addressing on the transformed timeline and is never
      // ownership authority; the recovery route must derive attacked decoded
      // ordinal + PTS addresses and then re-read the physical full ID.
      map: exactMap,
    };
  }
  return {
    status: "VALIDATED",
    reason: "VALID",
    registryVerified: true,
    signatureVerified: true,
    exactMapVerified: true,
    presentedIdentityVerified: true,
    uniqueRecord: true,
    encoderReceiptSha256: map.encoderReceiptSha256,
    authenticatedKeyId: map.keyId,
    map: exactMap,
  };
}

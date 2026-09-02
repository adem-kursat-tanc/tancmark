import { randomUUID } from "node:crypto";
import type { LiveLocalSecretProvider } from "./liveLocalSecretProvider";
import { LiveProductError, LiveProductStore } from "./liveProductStore";

export const LIVE_SESSION_SEAL_BINDING_SCHEMA = "LIVE_SESSION_SEAL_BINDING_V1" as const;
export const LIVE_WATERMARK_ALGORITHM_VERSION = "aegis-video-channel-a-l1-l3-ecc-current-frozen" as const;
export const LIVE_VIDEO_WATERMARK_VERSION = "v0.5A+s2B" as const;
export const LIVE_VIDEO_CORE_COMMIT = "e071fed7dc896ca3bd95158a438f9a0c2cb2309f" as const;

export type LiveSessionSealBindingState = "ACTIVE" | "REVOKED" | "STALE";

export interface LiveSessionSealBindingV1 {
  schemaVersion: typeof LIVE_SESSION_SEAL_BINDING_SCHEMA;
  bindingId: string;
  sessionId: string;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryVersion: number;
  signatureReference: string;
  /** Live control-plane HMAC provider key. This is not a physical watermark key. */
  signingKeyId: string;
  /** Non-secret AEGIS key version used by the physical video stamp and decoder. */
  physicalAegisKeyVersion: string;
  watermarkAlgorithmVersion: typeof LIVE_WATERMARK_ALGORITHM_VERSION;
  videoWatermarkVersion: typeof LIVE_VIDEO_WATERMARK_VERSION;
  videoCoreCommit: typeof LIVE_VIDEO_CORE_COMMIT;
  exactIdentityDigestSha256: string;
  createdAt: string;
  revokedAt: string | null;
  state: LiveSessionSealBindingState;
  immutableDigest: string;
}

export interface ResolvedLiveSessionSealAuthority {
  exactIdHex: string;
  masterSecret: Buffer;
  tenantSalt: string;
}

function exactIdContext(input: Pick<LiveSessionSealBindingV1, "bindingId" | "sessionId" | "tenantId" | "accountId" | "registryRecordId">): string {
  return ["tancmark-live-exact-id-v1", input.bindingId, input.sessionId, input.tenantId, input.accountId, input.registryRecordId].join("\0");
}

function signatureContext(binding: Omit<LiveSessionSealBindingV1, "signatureReference" | "immutableDigest">): string {
  return `tancmark-live-binding-signature-v1\0${LiveProductStore.stableDigest(binding)}`;
}

function withoutDigests(binding: LiveSessionSealBindingV1): Omit<LiveSessionSealBindingV1, "immutableDigest"> {
  const { immutableDigest: _immutableDigest, ...unsigned } = binding;
  return unsigned;
}

export function createLiveSessionSealBinding(input: {
  bindingId?: string;
  sessionId: string;
  tenantId: string;
  accountId: string;
  provider: LiveLocalSecretProvider;
  physicalAegisKeyVersion: string;
  now?: Date;
}): LiveSessionSealBindingV1 {
  if (!/^v[1-9]\d*$/.test(input.physicalAegisKeyVersion)) {
    throw new LiveProductError("live_physical_aegis_key_version_invalid", 500);
  }
  const bindingId = input.bindingId ?? randomUUID();
  const registryRecordId = randomUUID();
  const createdAt = (input.now ?? new Date()).toISOString();
  const base = {
    schemaVersion: LIVE_SESSION_SEAL_BINDING_SCHEMA,
    bindingId,
    sessionId: input.sessionId,
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId,
    registryVersion: 1,
    signingKeyId: input.provider.activeKid,
    physicalAegisKeyVersion: input.physicalAegisKeyVersion,
    watermarkAlgorithmVersion: LIVE_WATERMARK_ALGORITHM_VERSION,
    videoWatermarkVersion: LIVE_VIDEO_WATERMARK_VERSION,
    videoCoreCommit: LIVE_VIDEO_CORE_COMMIT,
    createdAt,
    revokedAt: null,
    state: "ACTIVE" as const,
  };
  const exactIdHex = input.provider.signExactKid(input.provider.activeKid, exactIdContext(base)).toString("hex");
  const exactIdentityDigestSha256 = LiveProductStore.sha256(`live-exact-id\0${exactIdHex}`);
  const signatureBytes = input.provider.signExactKid(input.provider.activeKid, signatureContext({ ...base, exactIdentityDigestSha256 }));
  const signatureReference = `hmac-sha256:${input.provider.activeKid}:${LiveProductStore.sha256(signatureBytes)}`;
  const unsigned = { ...base, exactIdentityDigestSha256, signatureReference };
  return { ...unsigned, immutableDigest: LiveProductStore.stableDigest(unsigned) };
}

export function resolveLiveSessionSealAuthority(
  binding: LiveSessionSealBindingV1,
  provider: LiveLocalSecretProvider,
): ResolvedLiveSessionSealAuthority {
  if (
    binding.schemaVersion !== LIVE_SESSION_SEAL_BINDING_SCHEMA ||
    binding.state !== "ACTIVE" ||
    binding.revokedAt !== null ||
    binding.immutableDigest !== LiveProductStore.stableDigest(withoutDigests(binding)) ||
    !provider.kids.includes(binding.signingKeyId)
  ) {
    throw new LiveProductError("live_session_seal_binding_invalid", 409);
  }
  const { signatureReference: _signatureReference, immutableDigest: _immutableDigest, ...signatureBase } = binding;
  const signature = provider.signExactKid(binding.signingKeyId, signatureContext(signatureBase));
  const expectedReference = `hmac-sha256:${binding.signingKeyId}:${LiveProductStore.sha256(signature)}`;
  if (binding.signatureReference !== expectedReference) throw new LiveProductError("live_session_seal_binding_signature_invalid", 409);
  const exactIdHex = provider.signExactKid(binding.signingKeyId, exactIdContext(binding)).toString("hex");
  if (LiveProductStore.sha256(`live-exact-id\0${exactIdHex}`) !== binding.exactIdentityDigestSha256) {
    throw new LiveProductError("live_session_seal_binding_identity_invalid", 409);
  }
  const masterSecret = Buffer.concat([
    provider.signExactKid(binding.signingKeyId, `tancmark-live-map-key-v1\0${binding.bindingId}\0part-0`),
    provider.signExactKid(binding.signingKeyId, `tancmark-live-map-key-v1\0${binding.bindingId}\0part-1`),
  ]);
  return { exactIdHex, masterSecret, tenantSalt: `tenant:${binding.tenantId}` };
}

export function publicLiveSessionSealBinding(binding: LiveSessionSealBindingV1): Record<string, unknown> {
  return {
    schemaVersion: binding.schemaVersion,
    bindingId: binding.bindingId,
    sessionId: binding.sessionId,
    registryRecordId: binding.registryRecordId,
    registryVersion: binding.registryVersion,
    signatureReference: binding.signatureReference,
    physicalAegisKeyVersion: binding.physicalAegisKeyVersion,
    watermarkAlgorithmVersion: binding.watermarkAlgorithmVersion,
    videoWatermarkVersion: binding.videoWatermarkVersion,
    videoCoreCommit: binding.videoCoreCommit,
    createdAt: binding.createdAt,
    revokedAt: binding.revokedAt,
    state: binding.state,
    immutableDigest: binding.immutableDigest,
    exactIdDisclosed: false,
  };
}

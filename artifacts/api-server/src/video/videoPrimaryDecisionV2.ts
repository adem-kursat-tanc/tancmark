import type { AudioExactIntegrityStatus } from "./videoPrimaryAudioExactIntegrity";

export const VIDEO_PRIMARY_DECISION_SCHEMA =
  "tancmark-video-primary-scoped-decision-v2" as const;

export const VIDEO_PRIMARY_USER_MESSAGES_TR = [
  "Video görüntü katmanı doğrulandı. Ses kaynağı gizli mühürle doğrulanmadı.",
  "Bu sonuç, ses dâhil bütün videonun tek bir kaynaktan geldiğini kanıtlamaz.",
] as const;

export interface VideoPrimaryLocatorRecord {
  locator32: number;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  registryRevision: number;
}

export interface VideoPrimaryLocatorLookup {
  status:
    | "FOUND"
    | "NOT_FOUND"
    | "LOOKUP_FAILED"
    | "NOT_USED_TARGETED_FULL_ID";
  locator32: number;
  records: readonly VideoPrimaryLocatorRecord[];
}

export class VideoPrimaryLocatorBucketTable {
  readonly #buckets = new Map<number, VideoPrimaryLocatorRecord[]>();

  constructor(records: readonly VideoPrimaryLocatorRecord[]) {
    for (const record of records) {
      if (!Number.isInteger(record.locator32) || record.locator32 < 0 ||
          record.locator32 > 0xffff_ffff) {
        throw new Error(`LOCATOR32_INVALID:${record.locator32}`);
      }
      if (!record.tenantId || !record.accountId || !record.registryRecordId ||
          !Number.isInteger(record.registryRevision) || record.registryRevision < 1) {
        throw new Error("LOCATOR_RECORD_INVALID");
      }
      const bucket = this.#buckets.get(record.locator32) ?? [];
      bucket.push({ ...record });
      this.#buckets.set(record.locator32, bucket);
    }
  }

  lookup(locator32: number): VideoPrimaryLocatorLookup {
    if (!Number.isInteger(locator32) || locator32 < 0 ||
        locator32 > 0xffff_ffff) {
      return { status: "LOOKUP_FAILED", locator32, records: [] };
    }
    const records = this.#buckets.get(locator32) ?? [];
    return {
      status: records.length === 0 ? "NOT_FOUND" : "FOUND",
      locator32,
      records: records.map((record) => ({ ...record })),
    };
  }
}

export interface VideoPrimaryStrongMapEvidence {
  status: "VALIDATED" | "RECOVERY_REQUIRED" | "NOT_FOUND" | "MANUAL_REVIEW";
  registryLookupVerified: boolean;
  uniqueRegistryRecord: boolean;
  signatureVerified: boolean;
  exactMapVerified: boolean;
  tenantBound: boolean;
  accountBound: boolean;
  registryRecordBound: boolean;
  registryRevisionBound: boolean;
  registryRecordActive: boolean;
  physicalKeyVersionBound: boolean;
  presentedVideoIdentityMatched: boolean;
}

export interface VideoPrimaryPhysicalEvidence {
  channelAMatched: boolean;
  channelBMatched: boolean;
  bothChannelsMatched: boolean;
  finalConfirmedBy: string;
  locatorCandidateObserved: boolean;
}

export type VideoPrimaryDecisionCode =
  | "VIDEO_LAYER_VAULT"
  | "CANDIDATE_SUPPORT_ONLY"
  | "NOT_FOUND"
  | "MANUAL_REVIEW"
  | "REJECTED_INPUT";

export interface VideoPrimaryScopedDecisionV2 {
  schemaVersion: typeof VIDEO_PRIMARY_DECISION_SCHEMA;
  profile: "VIDEO_PRIMARY_PROFILE";
  videoDecision: VideoPrimaryDecisionCode;
  videoLayerOwnership: boolean;
  videoLayerVault: boolean;
  videoLayerFinal: boolean;
  ownershipScope: "VIDEO_IMAGE_LAYER_ONLY" | "NONE";
  wholeVideoOwnership: false;
  wholeVideoVault: false;
  audioOwnership: false;
  multiChannelVault: false;
  audioProvenance: "AUDIO_PROVENANCE_NOT_AVAILABLE";
  audioExactIntegrity: AudioExactIntegrityStatus;
  manualReview: boolean;
  audioIntegrityAlert: boolean;
  candidateSupport: boolean;
  reason: string;
  userMessagesTr: readonly string[];
  evidence: {
    locatorMode: "BLIND_POOL_REQUIRED" | "TARGETED_FULL_ID_NOT_USED";
    locatorLookupStatus: VideoPrimaryLocatorLookup["status"];
    locatorBucketSize: number;
    locatorBucketUnique: boolean;
    locatorRecordMatchesClaim: boolean;
    registryLookupVerified: boolean;
    uniqueRegistryRecord: boolean;
    signatureVerified: boolean;
    exactMapVerified: boolean;
    exactMapUsedAsOwnershipAuthority: false;
    mapMode: "EXACT_FAST_PATH" | "VFR_SAFE_PHYSICAL_RECOVERY" | "NONE";
    registryRecordActive: boolean;
    physicalKeyVersionBound: boolean;
    identityContextBound: boolean;
    presentedVideoIdentityMatched: boolean;
    channelAMatched: boolean;
    channelBMatched: boolean;
    bothChannelsMatched: boolean;
    finalConfirmedBy: string;
  };
}

function baseDecision(input: {
  decision: VideoPrimaryDecisionCode;
  audioExactIntegrity: AudioExactIntegrityStatus;
  locator: VideoPrimaryLocatorLookup;
  map: VideoPrimaryStrongMapEvidence;
  physical: VideoPrimaryPhysicalEvidence;
  locatorRecordMatchesClaim: boolean;
  locatorMode: "BLIND_POOL_REQUIRED" | "TARGETED_FULL_ID_NOT_USED";
  mapMode: "EXACT_FAST_PATH" | "VFR_SAFE_PHYSICAL_RECOVERY" | "NONE";
  reason: string;
}): VideoPrimaryScopedDecisionV2 {
  const confirmed = input.decision === "VIDEO_LAYER_VAULT";
  return {
    schemaVersion: VIDEO_PRIMARY_DECISION_SCHEMA,
    profile: "VIDEO_PRIMARY_PROFILE",
    videoDecision: input.decision,
    videoLayerOwnership: confirmed,
    videoLayerVault: confirmed,
    videoLayerFinal: confirmed,
    ownershipScope: confirmed ? "VIDEO_IMAGE_LAYER_ONLY" : "NONE",
    wholeVideoOwnership: false,
    wholeVideoVault: false,
    audioOwnership: false,
    multiChannelVault: false,
    audioProvenance: "AUDIO_PROVENANCE_NOT_AVAILABLE",
    audioExactIntegrity: input.audioExactIntegrity,
    manualReview: input.decision === "MANUAL_REVIEW" ||
      input.audioExactIntegrity === "AUDIO_EXACT_INTEGRITY_CHANGED",
    audioIntegrityAlert:
      input.audioExactIntegrity === "AUDIO_EXACT_INTEGRITY_CHANGED",
    candidateSupport: input.decision === "CANDIDATE_SUPPORT_ONLY",
    reason: input.reason,
    userMessagesTr: confirmed ? [...VIDEO_PRIMARY_USER_MESSAGES_TR] : [],
    evidence: {
      locatorMode: input.locatorMode,
      locatorLookupStatus: input.locator.status,
      locatorBucketSize: input.locator.records.length,
      locatorBucketUnique: input.locator.status === "FOUND" &&
        input.locator.records.length === 1,
      locatorRecordMatchesClaim: input.locatorRecordMatchesClaim,
      registryLookupVerified: input.map.registryLookupVerified,
      uniqueRegistryRecord: input.map.uniqueRegistryRecord,
      signatureVerified: input.map.signatureVerified,
      exactMapVerified: input.map.exactMapVerified,
      exactMapUsedAsOwnershipAuthority: false,
      mapMode: input.mapMode,
      registryRecordActive: input.map.registryRecordActive,
      physicalKeyVersionBound: input.map.physicalKeyVersionBound,
      identityContextBound: input.map.tenantBound && input.map.accountBound &&
        input.map.registryRecordBound && input.map.registryRevisionBound,
      presentedVideoIdentityMatched: input.map.presentedVideoIdentityMatched,
      channelAMatched: input.physical.channelAMatched,
      channelBMatched: input.physical.channelBMatched,
      bothChannelsMatched: input.physical.bothChannelsMatched,
      finalConfirmedBy: input.physical.finalConfirmedBy,
    },
  };
}

export function decideVideoPrimaryV2(input: {
  identityInputStatus: "VALID" | "MISSING" | "MALFORMED";
  claimedTenantId: string;
  claimedAccountId: string;
  claimedRegistryRecordId: string;
  claimedRegistryRevision: number;
  locator: VideoPrimaryLocatorLookup;
  mapEvidence: VideoPrimaryStrongMapEvidence;
  physicalEvidence: VideoPrimaryPhysicalEvidence;
  audioExactIntegrity: AudioExactIntegrityStatus;
  locatorMode?: "BLIND_POOL_REQUIRED" | "TARGETED_FULL_ID_NOT_USED";
  mapMode: "EXACT_FAST_PATH" | "VFR_SAFE_PHYSICAL_RECOVERY" | "NONE";
}): VideoPrimaryScopedDecisionV2 {
  const targetedFullId = input.locatorMode === "TARGETED_FULL_ID_NOT_USED";
  const onlyLocator = input.physicalEvidence.locatorCandidateObserved;
  const matchesClaim = targetedFullId ||
    (input.locator.records.length === 1 && (() => {
    const record = input.locator.records[0]!;
    return record.tenantId === input.claimedTenantId &&
      record.accountId === input.claimedAccountId &&
      record.registryRecordId === input.claimedRegistryRecordId &&
      record.registryRevision === input.claimedRegistryRevision;
    })());
  const make = (decision: VideoPrimaryDecisionCode, reason: string) =>
    baseDecision({
      decision,
      audioExactIntegrity: input.audioExactIntegrity,
      locator: input.locator,
      map: input.mapEvidence,
      physical: input.physicalEvidence,
      locatorRecordMatchesClaim: matchesClaim,
      locatorMode: targetedFullId
        ? "TARGETED_FULL_ID_NOT_USED"
        : "BLIND_POOL_REQUIRED",
      mapMode: input.mapMode,
      reason,
    });

  if (input.identityInputStatus !== "VALID") {
    return make("REJECTED_INPUT", input.identityInputStatus === "MISSING"
      ? "VIDEO_ID_MISSING"
      : "VIDEO_ID_MALFORMED");
  }
  if (!targetedFullId && input.locator.status === "LOOKUP_FAILED") {
    return make("MANUAL_REVIEW", "LOCATOR_LOOKUP_FAILED");
  }
  if (!targetedFullId && (input.locator.status === "NOT_FOUND" ||
      input.locator.records.length === 0)) {
    return make("NOT_FOUND", "LOCATOR_BUCKET_NOT_FOUND");
  }
  if (!targetedFullId && input.locator.records.length !== 1) {
    return make("MANUAL_REVIEW", "LOCATOR_BUCKET_AMBIGUOUS");
  }
  if (!matchesClaim) return make("NOT_FOUND", "LOCATOR_RECORD_CLAIM_MISMATCH");
  if (input.mapEvidence.status === "MANUAL_REVIEW" ||
      !input.mapEvidence.uniqueRegistryRecord) {
    return make("MANUAL_REVIEW", "SIGNED_MAP_OR_REGISTRY_AMBIGUOUS");
  }
  if ((input.mapEvidence.status !== "VALIDATED" &&
      input.mapEvidence.status !== "RECOVERY_REQUIRED") ||
      !input.mapEvidence.registryLookupVerified ||
      !input.mapEvidence.signatureVerified ||
      !input.mapEvidence.registryRecordActive ||
      !input.mapEvidence.tenantBound ||
      !input.mapEvidence.accountBound ||
      !input.mapEvidence.registryRecordBound ||
      !input.mapEvidence.registryRevisionBound ||
      !input.mapEvidence.physicalKeyVersionBound ||
      !input.mapEvidence.presentedVideoIdentityMatched) {
    return make("NOT_FOUND", "STRONG_SIGNED_MAP_CHAIN_NOT_VERIFIED");
  }
  // Historical binding rule: exact Channel A is decisive for the image/video
  // layer. Channel B is corroboration only. The signed exact timing map can
  // select a fast address path, but its match is not ownership authority.
  if (!input.physicalEvidence.channelAMatched) {
    return make(onlyLocator || input.physicalEvidence.channelBMatched
      ? "CANDIDATE_SUPPORT_ONLY"
      : "NOT_FOUND", input.physicalEvidence.channelBMatched
        ? "CHANNEL_B_WITNESS_ONLY"
        : "AUTHORIZED_CHANNEL_A_NOT_VERIFIED");
  }
  return make("VIDEO_LAYER_VAULT", "AUTHORIZED_CHANNEL_A_AND_SIGNED_REGISTRY_VERIFIED");
}

export function findForbiddenGenericDecisionKeys(value: unknown): string[] {
  const forbidden = new Set(["ownership", "vault", "final"]);
  const found: string[] = [];
  const walk = (current: unknown, path: string): void => {
    if (current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(current as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (forbidden.has(key)) found.push(nextPath);
      walk(entry, nextPath);
    }
  };
  walk(value, "");
  return found;
}

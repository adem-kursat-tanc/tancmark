import path from "node:path";
import { decodeVideo, type DecodeResult } from "./decodeVideo";
import {
  runAdvancedVideoRecovery,
  type AdvancedVideoRecoveryResult,
} from "./advancedVideoRecovery";
import {
  probeExactVideoTimeline,
  type ExactFrameAddress,
  type ExactSealTimingMap,
} from "./exactSealTimingMap";
import {
  resolveSignedExactSealTimingMapV2,
  type PrivateSignedExactMapRegistry,
  type SignedExactMapKeyResolver,
  type SignedExactMapV2RejectReason,
} from "./signedExactSealTimingMapV2";

export interface SignedExactMapRouteDecodeSummary {
  verdict: DecodeResult["verdict"];
  channelAVerdict: DecodeResult["channelAVerdict"];
  strongFrames: number;
  vaultFrames: number;
  weakFrames: number;
  framesAttempted: number;
  channelAIdMatched: boolean;
  channelBIdMatched: boolean;
  bothChannelsMatched: boolean;
  finalConfirmedBy: DecodeResult["finalConfirmedBy"];
  wallMs: number;
}

export interface SignedExactMapVideoOwnershipRouteResult {
  verdict: "VIDEO_LAYER_VAULT" | "CANDIDATE_SUPPORT_ONLY" | "NOT_FOUND" |
    "MANUAL_REVIEW";
  reason: "AUTHORIZED_VIDEO_CHANNEL_A_EXACT_VERIFIED" |
    "CHANNEL_B_WITNESS_ONLY" | "PHYSICAL_VIDEO_ID_NOT_VERIFIED" |
    "PHYSICAL_KEY_VERSION_NOT_BOUND" |
    SignedExactMapV2RejectReason;
  ownership: boolean;
  vault: boolean;
  ownershipScope: "VIDEO_IMAGE_LAYER_ONLY" | "NONE";
  mapMode: "EXACT_FAST_PATH" | "VFR_SAFE_PHYSICAL_RECOVERY" | "NONE";
  digitalEvidenceChain: {
    registryLookupVerified: boolean;
    uniqueRegistryRecord: boolean;
    signatureVerified: boolean;
    tenantBound: boolean;
    accountBound: boolean;
    registryRecordBound: boolean;
    registryRevisionBound: boolean;
    registryRecordActive: boolean;
    physicalKeyVersionBound: boolean;
    presentedFullIdentityMatched: boolean;
    exactMapVerified: boolean;
    exactMapUsedAsOwnershipAuthority: false;
    physicalVideoIdVerified: boolean;
  };
  /** Final physical result. Equals canonicalDecode unless bounded fallback
   * recovers decisive Channel A. */
  decode?: SignedExactMapRouteDecodeSummary;
  /** The unchanged normal reader result, always executed before fallback. */
  canonicalDecode?: SignedExactMapRouteDecodeSummary;
  advancedRecovery?: Omit<AdvancedVideoRecoveryResult, "selectedDecode">;
  recoveryAddressing?: {
    policy: "SIGNED_SOURCE_LOCATOR_TO_DECODED_ORDINAL_AND_EXACT_PTS";
    channelAAddressCount: number;
    channelBAddressCount: number;
    ownershipAuthority: false;
  };
  advancedRecoveryAddressing?: {
    policy: "SIGNED_LOCATOR_PLUS_FROZEN_NEIGHBOR_WINDOW";
    neighborRadiusFrames: 1;
    channelAAddressCount: number;
    channelBAddressCount: number;
    ownershipAuthority: false;
  };
}

function rationalSeconds(pts: string, timeBase: string): number {
  const [numeratorRaw, denominatorRaw] = timeBase.split("/");
  const numerator = Number.parseInt(numeratorRaw ?? "", 10);
  const denominator = Number.parseInt(denominatorRaw ?? "", 10);
  const value = Number.parseInt(pts, 10);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) ||
      denominator === 0 || !Number.isSafeInteger(value)) {
    throw new Error("RECOVERY_LOCATOR_INVALID_RATIONAL");
  }
  return value * numerator / denominator;
}

function nearestDecodedOrdinal(input: {
  pts: readonly string[];
  timeBase: string;
  targetSeconds: number;
}): number {
  let low = 0;
  let high = input.pts.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const seconds = rationalSeconds(input.pts[middle]!, input.timeBase);
    if (seconds < input.targetSeconds) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  const before = low - 1;
  const beforeDelta = Math.abs(
    rationalSeconds(input.pts[before]!, input.timeBase) - input.targetSeconds,
  );
  const afterDelta = Math.abs(
    rationalSeconds(input.pts[low]!, input.timeBase) - input.targetSeconds,
  );
  return beforeDelta <= afterDelta ? before : low;
}

function exactAddress(input: {
  frameIdx: number;
  pts: readonly string[];
  timeBase: string;
}): ExactFrameAddress {
  return {
    frameIdx: input.frameIdx,
    pts: input.pts[input.frameIdx]!,
    timeBase: input.timeBase,
  };
}

async function buildPhysicalRecoveryLocatorMap(input: {
  videoPath: string;
  authenticatedSourceMap: ExactSealTimingMap;
}): Promise<ExactSealTimingMap> {
  const attacked = await probeExactVideoTimeline(input.videoPath);
  const source = input.authenticatedSourceMap;
  const allSourceAddresses = [...source.channelA, ...source.channelB];
  const sourceLastSeconds = Math.max(
    ...allSourceAddresses.map((address) =>
      rationalSeconds(address.pts, address.timeBase)),
  );
  const attackedLastSeconds = rationalSeconds(
    attacked.pts[attacked.frameCount - 1]!,
    attacked.timeBase,
  );
  if (!(sourceLastSeconds > 0) || !(attackedLastSeconds >= 0)) {
    throw new Error("RECOVERY_LOCATOR_TIMELINE_RANGE_INVALID");
  }

  const candidatesFor = (addresses: readonly ExactFrameAddress[]): number[] => {
    const candidates = new Set<number>();
    for (const address of addresses) {
      // Decoded ordinal proportion survives CFR/VFR retiming and deterministic
      // frame-count changes without frameIdx/fps conversion.
      const ordinal = source.frameCount <= 1 || attacked.frameCount <= 1
        ? 0
        : Math.round(
            address.frameIdx * (attacked.frameCount - 1) /
              (source.frameCount - 1),
          );
      candidates.add(Math.max(0, Math.min(attacked.frameCount - 1, ordinal)));

      const sourceSeconds = rationalSeconds(address.pts, address.timeBase);
      // Absolute decoded PTS is the precise path for ordinary re-encodes and
      // stream-copy container changes.
      candidates.add(nearestDecodedOrdinal({
        pts: attacked.pts,
        timeBase: attacked.timeBase,
        targetSeconds: sourceSeconds,
      }));
      // Normalized decoded PTS retains addressing under uniform retiming. The
      // map only locates candidates; the physical full-ID decoder still gates.
      candidates.add(nearestDecodedOrdinal({
        pts: attacked.pts,
        timeBase: attacked.timeBase,
        targetSeconds: sourceSeconds / sourceLastSeconds * attackedLastSeconds,
      }));
    }
    return Array.from(candidates).sort((a, b) => a - b);
  };

  const channelAIndices = candidatesFor(source.channelA);
  const channelASet = new Set(channelAIndices);
  const channelBIndices = candidatesFor(source.channelB)
    .filter((frameIdx) => !channelASet.has(frameIdx));
  return {
    schemaVersion: "tancmark-private-exact-seal-timing-map-v1",
    frameCount: attacked.frameCount,
    videoTimeBase: attacked.timeBase,
    framePtsDigestSha256: attacked.digestSha256,
    registryRecordIdHashSha256: source.registryRecordIdHashSha256,
    channelA: channelAIndices.map((frameIdx) => exactAddress({
      frameIdx,
      pts: attacked.pts,
      timeBase: attacked.timeBase,
    })),
    channelB: channelBIndices.map((frameIdx) => exactAddress({
      frameIdx,
      pts: attacked.pts,
      timeBase: attacked.timeBase,
    })),
  };
}

async function buildFrozenNeighborRecoveryMap(input: {
  videoPath: string;
  baseMap: ExactSealTimingMap;
}): Promise<ExactSealTimingMap> {
  const attacked = await probeExactVideoTimeline(input.videoPath);
  const expand = (addresses: readonly ExactFrameAddress[]): number[] => {
    const indices = new Set<number>();
    for (const address of addresses) {
      for (let delta = -1; delta <= 1; delta++) {
        const frameIdx = address.frameIdx + delta;
        if (frameIdx >= 0 && frameIdx < attacked.frameCount) {
          indices.add(frameIdx);
        }
      }
    }
    return Array.from(indices).sort((a, b) => a - b);
  };
  const channelAIndices = expand(input.baseMap.channelA);
  const channelASet = new Set(channelAIndices);
  const channelBIndices = expand(input.baseMap.channelB)
    .filter((frameIdx) => !channelASet.has(frameIdx));
  return {
    schemaVersion: "tancmark-private-exact-seal-timing-map-v1",
    frameCount: attacked.frameCount,
    videoTimeBase: attacked.timeBase,
    framePtsDigestSha256: attacked.digestSha256,
    registryRecordIdHashSha256: input.baseMap.registryRecordIdHashSha256,
    channelA: channelAIndices.map((frameIdx) => exactAddress({
      frameIdx,
      pts: attacked.pts,
      timeBase: attacked.timeBase,
    })),
    channelB: channelBIndices.map((frameIdx) => exactAddress({
      frameIdx,
      pts: attacked.pts,
      timeBase: attacked.timeBase,
    })),
  };
}

export async function runSignedExactMapVideoOwnershipRoute(input: {
  videoPath: string;
  presentedVideoIdentityHex: string;
  tenantId: string;
  accountId: string;
  registryRecordId: string;
  expectedWatermarkAlgorithmVersion: string;
  expectedVideoWatermarkVersion: string;
  registry: PrivateSignedExactMapRegistry;
  keyResolver: SignedExactMapKeyResolver;
  /** Raw private receipt bytes. They are used only when their exact SHA-256
   * equals the hash already authenticated by registry + digital signature. */
  authenticatedEncoderReceiptBytes?: Buffer;
  workDir: string;
}): Promise<SignedExactMapVideoOwnershipRouteResult> {
  const resolution = await resolveSignedExactSealTimingMapV2({
    videoPath: input.videoPath,
    presentedVideoIdentityHex: input.presentedVideoIdentityHex,
    tenantId: input.tenantId,
    accountId: input.accountId,
    registryRecordId: input.registryRecordId,
    expectedWatermarkAlgorithmVersion: input.expectedWatermarkAlgorithmVersion,
    expectedVideoWatermarkVersion: input.expectedVideoWatermarkVersion,
    registry: input.registry,
    keyResolver: input.keyResolver,
  });
  const exactFastPath = resolution.status === "VALIDATED" && resolution.map;
  const recoveryPath = resolution.status === "RECOVERY_REQUIRED";
  if (!exactFastPath && !recoveryPath) {
    return {
      verdict: resolution.status === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "NOT_FOUND",
      reason: resolution.reason as SignedExactMapV2RejectReason,
      ownership: false,
      vault: false,
      ownershipScope: "NONE",
      mapMode: "NONE",
      digitalEvidenceChain: {
        registryLookupVerified: resolution.registryVerified,
        uniqueRegistryRecord: resolution.uniqueRecord,
        signatureVerified: resolution.signatureVerified,
        tenantBound: false,
        accountBound: false,
        registryRecordBound: false,
        registryRevisionBound: false,
        registryRecordActive: false,
        physicalKeyVersionBound: false,
        presentedFullIdentityMatched: resolution.presentedIdentityVerified,
        exactMapVerified: resolution.exactMapVerified,
        exactMapUsedAsOwnershipAuthority: false,
        physicalVideoIdVerified: false,
      },
    };
  }
  const authenticatedAegisKeyVersion = resolution.authenticatedKeyId;
  if (!authenticatedAegisKeyVersion) {
    return {
      verdict: "NOT_FOUND",
      reason: "PHYSICAL_KEY_VERSION_NOT_BOUND",
      ownership: false,
      vault: false,
      ownershipScope: "NONE",
      mapMode: "NONE",
      digitalEvidenceChain: {
        registryLookupVerified: resolution.registryVerified,
        uniqueRegistryRecord: resolution.uniqueRecord,
        signatureVerified: resolution.signatureVerified,
        tenantBound: resolution.registryVerified,
        accountBound: resolution.registryVerified,
        registryRecordBound: resolution.registryVerified,
        registryRevisionBound: resolution.registryVerified,
        registryRecordActive: resolution.registryVerified,
        physicalKeyVersionBound: false,
        presentedFullIdentityMatched: resolution.presentedIdentityVerified,
        exactMapVerified: resolution.exactMapVerified,
        exactMapUsedAsOwnershipAuthority: false,
        physicalVideoIdVerified: false,
      },
    };
  }
  const recoveryLocatorMap = recoveryPath && resolution.map
    ? await buildPhysicalRecoveryLocatorMap({
        videoPath: input.videoPath,
        authenticatedSourceMap: resolution.map,
      })
    : undefined;
  const canonicalDecode = await decodeVideo({
    videoPath: input.videoPath,
    idInput: input.presentedVideoIdentityHex,
    authenticatedAegisKeyVersion,
    workDir: path.join(input.workDir, "physical-video-read"),
    ...(exactFastPath
      ? {
          exactSealTimingMapProvider: async () => resolution.map!,
          requireExactSealTimingMap: true,
        }
      : recoveryLocatorMap
        ? {
            exactSealTimingMapProvider: async () => recoveryLocatorMap,
            requireExactSealTimingMap: true,
          }
        : {}),
  });
  const advancedBaseMap = exactFastPath ? resolution.map : recoveryLocatorMap;
  const advancedMap = !canonicalDecode.channelAIdMatched && advancedBaseMap
    ? await buildFrozenNeighborRecoveryMap({
        videoPath: input.videoPath,
        baseMap: advancedBaseMap,
      })
    : undefined;
  const advancedRecovery = advancedMap
    ? await runAdvancedVideoRecovery({
        videoPath: input.videoPath,
        presentedVideoIdentityHex: input.presentedVideoIdentityHex,
        exactTimingMap: advancedMap,
        authenticatedAegisKeyVersion,
        authenticatedEncoderReceiptBytes:
          input.authenticatedEncoderReceiptBytes,
        expectedEncoderReceiptSha256: resolution.encoderReceiptSha256,
        workDir: path.join(input.workDir, "advanced-physical-recovery"),
      })
    : undefined;
  const decode = advancedRecovery?.selectedDecode ?? canonicalDecode;
  // Binding VIDEO_PRIMARY rule: Channel A is the decisive physical video
  // carrier. Channel B is witness/corroboration only and can never open a
  // Vault alone. The signed exact timing map only selects the fast addressing
  // path; it is deliberately excluded from ownership authority.
  const physicalVideoIdVerified = decode.channelAIdMatched === true;
  const ownership = physicalVideoIdVerified &&
    resolution.registryVerified &&
    resolution.signatureVerified &&
    resolution.presentedIdentityVerified &&
    resolution.uniqueRecord &&
    authenticatedAegisKeyVersion.length > 0;
  const candidateSupport = !ownership &&
    (decode.channelBIdMatched === true || canonicalDecode.channelBIdMatched === true);
  const summarizeDecode = (
    value: DecodeResult,
  ): SignedExactMapRouteDecodeSummary => ({
    verdict: value.verdict,
    channelAVerdict: value.channelAVerdict,
    strongFrames: value.strongFrames,
    vaultFrames: value.vaultFrames,
    weakFrames: value.weakFrames,
    framesAttempted: value.totalFramesAttempted,
    channelAIdMatched: value.channelAIdMatched,
    channelBIdMatched: value.channelBIdMatched,
    bothChannelsMatched: value.bothChannelsMatched,
    finalConfirmedBy: value.finalConfirmedBy,
    wallMs: value.wallMs,
  });
  const advancedRecoveryTelemetry = advancedRecovery
    ? (({ selectedDecode: _selectedDecode, ...telemetry }) => telemetry)(
        advancedRecovery,
      )
    : undefined;
  return {
    verdict: ownership
      ? "VIDEO_LAYER_VAULT"
      : candidateSupport
        ? "CANDIDATE_SUPPORT_ONLY"
        : "NOT_FOUND",
    reason: ownership
      ? "AUTHORIZED_VIDEO_CHANNEL_A_EXACT_VERIFIED"
      : candidateSupport
        ? "CHANNEL_B_WITNESS_ONLY"
        : "PHYSICAL_VIDEO_ID_NOT_VERIFIED",
    ownership,
    vault: ownership,
    ownershipScope: ownership ? "VIDEO_IMAGE_LAYER_ONLY" : "NONE",
    mapMode: exactFastPath
      ? "EXACT_FAST_PATH"
      : "VFR_SAFE_PHYSICAL_RECOVERY",
    digitalEvidenceChain: {
      registryLookupVerified: resolution.registryVerified,
      uniqueRegistryRecord: resolution.uniqueRecord,
      signatureVerified: resolution.signatureVerified,
      // A successful resolver status is reached only after these exact
      // registry bindings and the active-record check have all passed.
      tenantBound: resolution.registryVerified,
      accountBound: resolution.registryVerified,
      registryRecordBound: resolution.registryVerified,
      registryRevisionBound: resolution.registryVerified,
      registryRecordActive: resolution.registryVerified,
      physicalKeyVersionBound: true,
      presentedFullIdentityMatched: resolution.presentedIdentityVerified,
      exactMapVerified: resolution.exactMapVerified,
      exactMapUsedAsOwnershipAuthority: false,
      physicalVideoIdVerified,
    },
    decode: summarizeDecode(decode),
    canonicalDecode: summarizeDecode(canonicalDecode),
    ...(advancedRecoveryTelemetry
      ? { advancedRecovery: advancedRecoveryTelemetry }
      : {}),
    ...(recoveryLocatorMap
      ? {
          recoveryAddressing: {
            policy: "SIGNED_SOURCE_LOCATOR_TO_DECODED_ORDINAL_AND_EXACT_PTS" as const,
            channelAAddressCount: recoveryLocatorMap.channelA.length,
            channelBAddressCount: recoveryLocatorMap.channelB.length,
            ownershipAuthority: false as const,
          },
        }
      : {}),
    ...(advancedMap
      ? {
          advancedRecoveryAddressing: {
            policy: "SIGNED_LOCATOR_PLUS_FROZEN_NEIGHBOR_WINDOW" as const,
            neighborRadiusFrames: 1 as const,
            channelAAddressCount: advancedMap.channelA.length,
            channelBAddressCount: advancedMap.channelB.length,
            ownershipAuthority: false as const,
          },
        }
      : {}),
  };
}

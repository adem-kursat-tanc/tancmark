import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runSignedExactMapVideoOwnershipRoute } from "./signedExactMapVideoOwnershipRoute";
import {
  SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION,
  SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION,
  createSignedExactSealTimingMapV2,
  type PrivateSignedExactMapRegistry,
  type PrivateSignedExactMapRegistryRow,
  type SignedExactMapKeyResolver,
} from "./signedExactSealTimingMapV2";

const EXPECTED_HASHES = {
  baseline: "be09f7c44dc00923ced19ae95b7b0fbf9fdd56e4307c3e21560c1f06e5cc2334",
  receipt: "4a58b7116636fb57602d026722085640ab278c2bb33c6c64f4d7dd9c85963eac",
  unsealed: "d08db646b9793382840536985a475469eeacf314f86986f9883aed2a046463eb",
  rotation: "5c1501b2658bb1c6d130ef3705db7ab26d56f67cdf642d006de9c8e1b6983c0f",
  crop: "10982f23b3e80073dd542593dc6a5876dacd01f2eee81c53afb262ebe3d8e64a",
  screen: "6db07b8a163d04e2574715b8c96db6e90fadd7598b59386639f37a4f8dfdae35",
  resize: "01247c0a94af1ea8cd3da49afea301235421853002ea48c4622df89cf87394b3",
} as const;

const EXPECTED_VARIANTS = {
  rotation: "HISTORICAL_ROTATION_270",
  crop: "HISTORICAL_SCALE_1_25_CENTER",
  screen: "HISTORICAL_SOURCE_RASTER_ROTATION_0",
  resize: "HISTORICAL_SOURCE_RASTER_ROTATION_0",
} as const;

interface EncodeReceipt {
  encode?: {
    idHex?: string;
    width?: number;
    height?: number;
    stampedFrameIdxs?: number[];
    channelB?: { frameIdxs?: number[] };
  };
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`ARG_REQUIRED:${name}`);
  return path.resolve(value);
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath: string): string {
  return sha256Buffer(fs.readFileSync(filePath));
}

function registryFor(
  rows: readonly PrivateSignedExactMapRegistryRow[],
): PrivateSignedExactMapRegistry {
  return { async lookup() { return rows; } };
}

function routeSnapshot(
  result: Awaited<ReturnType<typeof runSignedExactMapVideoOwnershipRoute>>,
) {
  return {
    verdict: result.verdict,
    reason: result.reason,
    ownership: result.ownership,
    vault: result.vault,
    ownershipScope: result.ownershipScope,
    mapMode: result.mapMode,
    digitalEvidenceChain: result.digitalEvidenceChain,
    canonicalDecode: result.canonicalDecode,
    decode: result.decode,
    advancedRecovery: result.advancedRecovery,
    advancedRecoveryAddressing: result.advancedRecoveryAddressing,
  };
}

async function main(): Promise<void> {
  const paths = {
    baseline: requiredArg("--baseline"),
    receipt: requiredArg("--receipt"),
    unsealed: requiredArg("--unsealed"),
    rotation: requiredArg("--rotation"),
    crop: requiredArg("--crop"),
    screen: requiredArg("--screen"),
    resize: requiredArg("--resize"),
    workRoot: requiredArg("--work-root"),
    result: requiredArg("--result"),
  };
  if (fs.existsSync(paths.result)) throw new Error("RESULT_ALREADY_EXISTS");
  fs.mkdirSync(paths.workRoot, { recursive: true });
  const inputHashes = {
    baseline: sha256File(paths.baseline),
    receipt: sha256File(paths.receipt),
    unsealed: sha256File(paths.unsealed),
    rotation: sha256File(paths.rotation),
    crop: sha256File(paths.crop),
    screen: sha256File(paths.screen),
    resize: sha256File(paths.resize),
  };
  const hashMismatches = Object.entries(EXPECTED_HASHES)
    .filter(([name, expected]) =>
      inputHashes[name as keyof typeof inputHashes] !== expected)
    .map(([name]) => name);
  if (hashMismatches.length > 0) {
    throw new Error(`FROZEN_INPUT_HASH_MISMATCH:${hashMismatches.join(",")}`);
  }
  const receiptBytes = fs.readFileSync(paths.receipt);
  const receipt = JSON.parse(receiptBytes.toString("utf8")) as EncodeReceipt;
  const identity = receipt.encode?.idHex?.toLowerCase() ?? "";
  const channelA = receipt.encode?.stampedFrameIdxs ?? [];
  const channelB = receipt.encode?.channelB?.frameIdxs ?? [];
  if (!/^[0-9a-f]{64}$/.test(identity) || channelA.length !== 8 ||
      channelB.length !== 24 || !Number.isInteger(receipt.encode?.width) ||
      !Number.isInteger(receipt.encode?.height)) {
    throw new Error("AUTHENTICATED_RECEIPT_REQUIRED_FIELDS_INVALID");
  }

  const tenantId = "advanced-recovery-private-tenant";
  const accountId = "advanced-recovery-private-account";
  const registryRecordId = "advanced-recovery-private-record";
  const keyId = "v1";
  const tenantSalt = `tenant:${tenantId}`;
  const masterSecret = createHash("sha512")
    .update("tancmark-advanced-recovery-isolated-gate-key")
    .digest()
    .subarray(0, 48);
  const envelope = await createSignedExactSealTimingMapV2({
    videoPath: paths.baseline,
    videoIdentityHex: identity,
    tenantId,
    accountId,
    registryRecordId,
    registryRevision: 1,
    watermarkAlgorithmVersion:
      SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION,
    videoWatermarkVersion:
      SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION,
    encoderReceiptSha256: inputHashes.receipt,
    channelAFrameIdxs: channelA,
    channelBFrameIdxs: channelB,
    createdAt: "2026-08-27T00:00:00.000Z",
    keyId,
    masterSecret,
    tenantSalt,
  });
  const row: PrivateSignedExactMapRegistryRow = {
    tenantId,
    accountId,
    registryRecordId,
    registryRevision: 1,
    keyId,
    expectedEncoderReceiptSha256: inputHashes.receipt,
    status: "ACTIVE",
    revokedAt: null,
    supersededByRecordId: null,
    envelope,
  };
  const keyResolver: SignedExactMapKeyResolver = {
    async resolve(query) {
      if (query.tenantId !== tenantId || query.accountId !== accountId ||
          query.keyId !== keyId) return undefined;
      return { keyId, masterSecret, tenantSalt, revoked: false };
    },
  };
  const route = (input: {
    videoPath: string;
    identity: string;
    suffix: string;
    rows?: PrivateSignedExactMapRegistryRow[];
    routeTenantId?: string;
    receiptBytes?: Buffer;
  }) => runSignedExactMapVideoOwnershipRoute({
    videoPath: input.videoPath,
    presentedVideoIdentityHex: input.identity,
    tenantId: input.routeTenantId ?? tenantId,
    accountId,
    registryRecordId,
    expectedWatermarkAlgorithmVersion:
      SIGNED_EXACT_SEAL_TIMING_MAP_V2_WATERMARK_ALGORITHM_VERSION,
    expectedVideoWatermarkVersion:
      SIGNED_EXACT_SEAL_TIMING_MAP_V2_VIDEO_WATERMARK_VERSION,
    registry: registryFor(input.rows ?? [row]),
    keyResolver,
    authenticatedEncoderReceiptBytes:
      input.receiptBytes ?? receiptBytes,
    workDir: path.join(paths.workRoot, input.suffix),
  });

  const wrongIdentity = createHash("sha256")
    .update("tancmark-advanced-recovery-wrong-identity")
    .digest("hex");
  const attacks = [
    { name: "rotation", videoPath: paths.rotation },
    { name: "crop", videoPath: paths.crop },
    { name: "screen", videoPath: paths.screen },
    { name: "resize", videoPath: paths.resize },
  ] as const;
  const cellResults = [];
  for (const attack of attacks) {
    const started = Date.now();
    const correct = await route({
      videoPath: attack.videoPath,
      identity,
      suffix: `${attack.name}/correct`,
    });
    const wrong = await route({
      videoPath: attack.videoPath,
      identity: wrongIdentity,
      suffix: `${attack.name}/wrong-id`,
    });
    const noId = await route({
      videoPath: attack.videoPath,
      identity: "",
      suffix: `${attack.name}/no-id`,
    });
    const expectedVariant = EXPECTED_VARIANTS[attack.name];
    const passed = correct.verdict === "VIDEO_LAYER_VAULT" &&
      correct.ownership && correct.vault &&
      correct.decode?.channelAIdMatched === true &&
      correct.digitalEvidenceChain.registryLookupVerified &&
      correct.digitalEvidenceChain.uniqueRegistryRecord &&
      correct.digitalEvidenceChain.signatureVerified &&
      correct.digitalEvidenceChain.presentedFullIdentityMatched &&
      correct.advancedRecovery?.status === "RECOVERED_DECISIVE_CHANNEL_A" &&
      correct.advancedRecovery.selectedVariant === expectedVariant &&
      !wrong.ownership && !wrong.vault &&
      !noId.ownership && !noId.vault;
    cellResults.push({
      name: attack.name,
      inputSha256: inputHashes[attack.name],
      expectedSelectedVariant: expectedVariant,
      correct: routeSnapshot(correct),
      wrongIdentity: routeSnapshot(wrong),
      noIdentity: routeSnapshot(noId),
      elapsedMs: Date.now() - started,
      passed,
    });
  }

  const unsealed = await route({
    videoPath: paths.unsealed,
    identity,
    suffix: "shared-negatives/unsealed",
  });
  const wrongTenant = await route({
    videoPath: paths.rotation,
    identity,
    suffix: "shared-negatives/wrong-tenant",
    routeTenantId: "advanced-recovery-wrong-tenant",
  });
  const ambiguousRegistry = await route({
    videoPath: paths.rotation,
    identity,
    suffix: "shared-negatives/ambiguous-registry",
    rows: [row, { ...row }],
  });
  const tamperedReceipt = Buffer.from(receiptBytes);
  tamperedReceipt[tamperedReceipt.length - 1] =
    tamperedReceipt[tamperedReceipt.length - 1]! ^ 0x01;
  const wrongReceipt = await route({
    videoPath: paths.rotation,
    identity,
    suffix: "shared-negatives/wrong-receipt",
    receiptBytes: tamperedReceipt,
  });
  const negatives = {
    unsealed: routeSnapshot(unsealed),
    wrongTenant: routeSnapshot(wrongTenant),
    ambiguousRegistry: routeSnapshot(ambiguousRegistry),
    wrongReceipt: routeSnapshot(wrongReceipt),
  };
  const negativePassed = !unsealed.ownership && !unsealed.vault &&
    !wrongTenant.ownership && !wrongTenant.vault &&
    !ambiguousRegistry.ownership && !ambiguousRegistry.vault &&
    ambiguousRegistry.verdict === "MANUAL_REVIEW" &&
    !wrongReceipt.ownership && !wrongReceipt.vault &&
    wrongReceipt.advancedRecovery?.status === "AUTHENTICATED_RECEIPT_REJECTED";
  const wrongOwnership = cellResults.filter((cell) =>
    cell.wrongIdentity.ownership || cell.noIdentity.ownership).length +
    Object.values(negatives).filter((item) => item.ownership).length;
  const result = {
    schemaVersion: "tancmark-video-advanced-recovery-integration-gate-v1",
    generatedAtUtc: new Date().toISOString(),
    scope: "ISOLATED_EXISTING_MEDIA_READ_ONLY_NO_REENCODE",
    attacksRegenerated: false,
    sourceMediaChanged: false,
    thresholdsChanged: false,
    payloadChanged: false,
    channelADecisionChanged: false,
    ownershipDecisionChanged: false,
    inputHashes,
    cellResults,
    negatives,
    aggregate: {
      advancedCellsPassed: cellResults.filter((cell) => cell.passed).length,
      advancedCellsTotal: cellResults.length,
      wrongOwnership,
      negativePassed,
    },
    gatePassed: cellResults.every((cell) => cell.passed) &&
      negativePassed && wrongOwnership === 0,
  };
  fs.writeFileSync(paths.result, `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
  process.stdout.write(`${JSON.stringify({
    gatePassed: result.gatePassed,
    aggregate: result.aggregate,
    selectedVariants: cellResults.map((cell) => ({
      name: cell.name,
      variant: cell.correct.advancedRecovery?.selectedVariant ?? null,
    })),
  })}\n`);
  if (!result.gatePassed) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

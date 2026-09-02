import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { assertCanonicalReaderInvocationAllowed } from "./canonicalReaderLiveScope";
import {
  approvedMediaRuntimeChildEnvironment,
  resolveMediaRuntimePath,
} from "./mediaRuntimePathResolver";
import { decodeVideo, type DecodeResult } from "./decodeVideo";
import type { ExactSealTimingMap } from "./exactSealTimingMap";

export type AdvancedRecoveryVariantName =
  | "HISTORICAL_SOURCE_RASTER_ROTATION_0"
  | "HISTORICAL_SCALE_1_25_CENTER"
  | "HISTORICAL_SCALE_1_25_CENTER_D1"
  | "HISTORICAL_ROTATION_90"
  | "HISTORICAL_ROTATION_180"
  | "HISTORICAL_ROTATION_270";

export interface AuthenticatedSourceRasterReceipt {
  width: number;
  height: number;
  orientationDegrees: 0 | 90 | 180 | 270 | null;
  orientationAuthority:
    | "EXPLICIT_AUTHENTICATED_RECEIPT_FIELD"
    | "AUTHENTICATED_RASTER_DIMENSIONS_ONLY";
}

export interface VideoDisplayOrientationObservation {
  probeStatus: "VERIFIED";
  rotateTagDegrees: 0 | 90 | 180 | 270 | null;
  displayMatrixDegrees: 0 | 90 | 180 | 270 | null;
  effectiveMetadataRotationDegrees: 0 | 90 | 180 | 270 | null;
  ffmpegAutoRotationPreserved: true;
  extraMetadataRotationApplied: false;
  doubleRotationPrevented: true;
}

export interface AdvancedRecoveryDecodeSummary {
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
  maximumObservedByteMatches: number;
}

export interface AdvancedRecoveryVariantResult {
  name: AdvancedRecoveryVariantName;
  rotationDegrees: 0 | 90 | 180 | 270;
  scale: 1 | 1.25;
  d1CropGridEnabled: boolean;
  decode: AdvancedRecoveryDecodeSummary;
}

export interface AdvancedVideoRecoveryResult {
  status:
    | "RECOVERED_DECISIVE_CHANNEL_A"
    | "NOT_RECOVERED"
    | "AUTHENTICATED_RECEIPT_NOT_AVAILABLE"
    | "AUTHENTICATED_RECEIPT_REJECTED"
    | "ORIENTATION_PROBE_FAILED";
  attempted: boolean;
  normalCanonicalReaderRanFirst: true;
  ownershipAuthority: false;
  registrySelectionAuthority: false;
  identityGenerationAuthority: false;
  receiptHashVerified: boolean;
  receipt?: AuthenticatedSourceRasterReceipt;
  displayOrientation?: VideoDisplayOrientationObservation;
  variants: AdvancedRecoveryVariantResult[];
  selectedVariant: AdvancedRecoveryVariantName | null;
  partialMatchPercent: number;
  partialMatchRole: "ADVISORY_ONLY_NEVER_OWNERSHIP";
  selectedDecode?: DecodeResult;
  reason?: string;
}

interface FrozenVariant {
  name: AdvancedRecoveryVariantName;
  rotationDegrees: 0 | 90 | 180 | 270;
  scale: 1 | 1.25;
  d1CropGridEnabled: boolean;
}

const FROZEN_VARIANTS: readonly FrozenVariant[] = [
  {
    name: "HISTORICAL_SOURCE_RASTER_ROTATION_0",
    rotationDegrees: 0,
    scale: 1,
    d1CropGridEnabled: false,
  },
  {
    name: "HISTORICAL_SCALE_1_25_CENTER",
    rotationDegrees: 0,
    scale: 1.25,
    d1CropGridEnabled: false,
  },
  {
    name: "HISTORICAL_SCALE_1_25_CENTER_D1",
    rotationDegrees: 0,
    scale: 1.25,
    d1CropGridEnabled: true,
  },
  {
    name: "HISTORICAL_ROTATION_90",
    rotationDegrees: 90,
    scale: 1,
    d1CropGridEnabled: false,
  },
  {
    name: "HISTORICAL_ROTATION_180",
    rotationDegrees: 180,
    scale: 1,
    d1CropGridEnabled: false,
  },
  {
    name: "HISTORICAL_ROTATION_270",
    rotationDegrees: 270,
    scale: 1,
    d1CropGridEnabled: false,
  },
] as const;

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function cardinalDegrees(value: unknown): 0 | 90 | 180 | 270 | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = ((Math.round(parsed) % 360) + 360) % 360;
  return normalized === 0 || normalized === 90 ||
      normalized === 180 || normalized === 270
    ? normalized
    : null;
}

export function validateAuthenticatedSourceRasterReceipt(input: {
  receiptBytes: Buffer;
  expectedSha256: string;
}): AuthenticatedSourceRasterReceipt {
  if (!/^[0-9a-f]{64}$/.test(input.expectedSha256)) {
    throw new Error("AUTHENTICATED_RECEIPT_EXPECTED_SHA256_INVALID");
  }
  const actual = sha256(input.receiptBytes);
  if (actual !== input.expectedSha256) {
    throw new Error("AUTHENTICATED_RECEIPT_SHA256_MISMATCH");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.receiptBytes.toString("utf8"));
  } catch {
    throw new Error("AUTHENTICATED_RECEIPT_JSON_INVALID");
  }
  const root = asObject(parsed);
  const encode = asObject(root?.["encode"]);
  const width = encode?.["width"];
  const height = encode?.["height"];
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      (width as number) < 32 || (height as number) < 32 ||
      (width as number) > 8192 || (height as number) > 8192) {
    throw new Error("AUTHENTICATED_RECEIPT_SOURCE_RASTER_INVALID");
  }
  const explicitOrientation = cardinalDegrees(
    encode?.["orientationDegrees"] ??
      encode?.["rotationInputDegrees"] ??
      encode?.["rotationDegrees"],
  );
  return {
    width: width as number,
    height: height as number,
    orientationDegrees: explicitOrientation,
    orientationAuthority: explicitOrientation === null
      ? "AUTHENTICATED_RASTER_DIMENSIONS_ONLY"
      : "EXPLICIT_AUTHENTICATED_RECEIPT_FIELD",
  };
}

function runFfprobe(args: string[]): Promise<string> {
  assertCanonicalReaderInvocationAllowed();
  return new Promise((resolve, reject) => {
    const child = spawn(resolveMediaRuntimePath("ffprobe"), args, {
      windowsHide: true,
      env: approvedMediaRuntimeChildEnvironment(),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ADVANCED_RECOVERY_FFPROBE_TIMEOUT"));
    }, 120_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`ADVANCED_RECOVERY_FFPROBE_EXIT_${code}:${stderr.slice(-1000)}`));
    });
  });
}

export async function probeVideoDisplayOrientation(
  videoPath: string,
): Promise<VideoDisplayOrientationObservation> {
  const stdout = await runFfprobe([
    "-v", "error",
    "-select_streams", "v:0",
    "-show_streams",
    "-of", "json",
    videoPath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{
      tags?: Record<string, string>;
      side_data_list?: Array<{ side_data_type?: string; rotation?: number }>;
    }>;
  };
  const stream = parsed.streams?.[0];
  if (!stream) throw new Error("ADVANCED_RECOVERY_VIDEO_STREAM_NOT_FOUND");
  const rotateTagDegrees = cardinalDegrees(stream.tags?.["rotate"]);
  const displayMatrixDegrees = cardinalDegrees(
    (stream.side_data_list ?? [])
      .find((item) => item.side_data_type === "Display Matrix")
      ?.rotation,
  );
  return {
    probeStatus: "VERIFIED",
    rotateTagDegrees,
    displayMatrixDegrees,
    effectiveMetadataRotationDegrees:
      displayMatrixDegrees ?? rotateTagDegrees,
    // The existing FFmpeg extraction path keeps its historical auto-rotation.
    // Therefore metadata rotation is observed but never applied a second time.
    ffmpegAutoRotationPreserved: true,
    extraMetadataRotationApplied: false,
    doubleRotationPrevented: true,
  };
}

function evenFloor(value: number): number {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function normalizerFor(
  receipt: AuthenticatedSourceRasterReceipt,
  variant: FrozenVariant,
): (pngInput: Buffer) => Promise<Buffer> {
  if (variant.scale === 1.25) {
    const retainedWidth = evenFloor(receipt.width / 1.25);
    const retainedHeight = evenFloor(receipt.height / 1.25);
    const left = evenFloor((receipt.width - retainedWidth) / 2);
    const top = evenFloor((receipt.height - retainedHeight) / 2);
    return async (pngInput) => sharp(pngInput)
      .resize(retainedWidth, retainedHeight, { fit: "fill" })
      .extend({
        left,
        top,
        right: receipt.width - retainedWidth - left,
        bottom: receipt.height - retainedHeight - top,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .png({ compressionLevel: 1 })
      .toBuffer();
  }
  return async (pngInput) => {
    const image = sharp(pngInput);
    const oriented = variant.rotationDegrees === 0
      ? image
      : image.rotate(variant.rotationDegrees, {
          background: { r: 0, g: 0, b: 0, alpha: 1 },
        });
    return oriented
      .resize(receipt.width, receipt.height, { fit: "fill" })
      .png({ compressionLevel: 1 })
      .toBuffer();
  };
}

function decodeSummary(result: DecodeResult): AdvancedRecoveryDecodeSummary {
  const maximumObservedByteMatches = result.frames.reduce(
    (best, frame) => Math.max(best, frame.byteMatches),
    0,
  );
  return {
    verdict: result.verdict,
    channelAVerdict: result.channelAVerdict,
    strongFrames: result.strongFrames,
    vaultFrames: result.vaultFrames,
    weakFrames: result.weakFrames,
    framesAttempted: result.totalFramesAttempted,
    channelAIdMatched: result.channelAIdMatched,
    channelBIdMatched: result.channelBIdMatched,
    bothChannelsMatched: result.bothChannelsMatched,
    finalConfirmedBy: result.finalConfirmedBy,
    wallMs: result.wallMs,
    maximumObservedByteMatches,
  };
}

function notAttempted(
  status: AdvancedVideoRecoveryResult["status"],
  reason: string,
): AdvancedVideoRecoveryResult {
  return {
    status,
    attempted: false,
    normalCanonicalReaderRanFirst: true,
    ownershipAuthority: false,
    registrySelectionAuthority: false,
    identityGenerationAuthority: false,
    receiptHashVerified: false,
    variants: [],
    selectedVariant: null,
    partialMatchPercent: 0,
    partialMatchRole: "ADVISORY_ONLY_NEVER_OWNERSHIP",
    reason,
  };
}

export async function runAdvancedVideoRecovery(input: {
  videoPath: string;
  presentedVideoIdentityHex: string;
  exactTimingMap: ExactSealTimingMap;
  authenticatedAegisKeyVersion: string;
  authenticatedEncoderReceiptBytes?: Buffer;
  expectedEncoderReceiptSha256?: string;
  workDir: string;
}): Promise<AdvancedVideoRecoveryResult> {
  if (!input.authenticatedEncoderReceiptBytes ||
      !input.expectedEncoderReceiptSha256) {
    return notAttempted(
      "AUTHENTICATED_RECEIPT_NOT_AVAILABLE",
      "SIGNED_RECEIPT_BYTES_OR_AUTHENTICATED_HASH_NOT_AVAILABLE",
    );
  }
  let receipt: AuthenticatedSourceRasterReceipt;
  try {
    receipt = validateAuthenticatedSourceRasterReceipt({
      receiptBytes: input.authenticatedEncoderReceiptBytes,
      expectedSha256: input.expectedEncoderReceiptSha256,
    });
  } catch (error) {
    return notAttempted(
      "AUTHENTICATED_RECEIPT_REJECTED",
      error instanceof Error ? error.message : String(error),
    );
  }
  let displayOrientation: VideoDisplayOrientationObservation;
  try {
    displayOrientation = await probeVideoDisplayOrientation(input.videoPath);
  } catch (error) {
    return {
      ...notAttempted(
        "ORIENTATION_PROBE_FAILED",
        error instanceof Error ? error.message : String(error),
      ),
      receiptHashVerified: true,
      receipt,
    };
  }

  const variants: AdvancedRecoveryVariantResult[] = [];
  let selectedDecode: DecodeResult | undefined;
  let selectedVariant: AdvancedRecoveryVariantName | null = null;
  let maximumObservedByteMatches = 0;
  for (const variant of FROZEN_VARIANTS) {
    const decode = await decodeVideo({
      videoPath: input.videoPath,
      idInput: input.presentedVideoIdentityHex,
      workDir: path.join(input.workDir, variant.name.toLowerCase()),
      exactSealTimingMapProvider: async () => input.exactTimingMap,
      requireExactSealTimingMap: true,
      authenticatedAegisKeyVersion: input.authenticatedAegisKeyVersion,
      channelAFrameNormalizer: normalizerFor(receipt, variant),
      channelAD1CropGridEnabled: variant.d1CropGridEnabled,
    });
    const summary = decodeSummary(decode);
    maximumObservedByteMatches = Math.max(
      maximumObservedByteMatches,
      summary.maximumObservedByteMatches,
    );
    variants.push({
      name: variant.name,
      rotationDegrees: variant.rotationDegrees,
      scale: variant.scale,
      d1CropGridEnabled: variant.d1CropGridEnabled,
      decode: summary,
    });
    if (decode.channelAIdMatched) {
      selectedDecode = decode;
      selectedVariant = variant.name;
      break;
    }
  }
  return {
    status: selectedDecode
      ? "RECOVERED_DECISIVE_CHANNEL_A"
      : "NOT_RECOVERED",
    attempted: true,
    normalCanonicalReaderRanFirst: true,
    ownershipAuthority: false,
    registrySelectionAuthority: false,
    identityGenerationAuthority: false,
    receiptHashVerified: true,
    receipt,
    displayOrientation,
    variants,
    selectedVariant,
    partialMatchPercent: maximumObservedByteMatches * 25,
    partialMatchRole: "ADVISORY_ONLY_NEVER_OWNERSHIP",
    ...(selectedDecode ? { selectedDecode } : {}),
  };
}

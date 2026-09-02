import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const LARGE_FILE_ANALYSIS_VERSION = "large-file-analysis-copy-v0.1";
const DEFAULT_MAX_DIRECT_UPLOAD_BYTES = 64 * 1024 * 1024;
const DEFAULT_ANALYSIS_SAMPLE_BYTES = 32 * 1024 * 1024;

export interface LargeFileAnalysisInput {
  sourcePath: string;
  fileId: string;
  copyId: string;
  sessionId: string;
  userId?: string;
  screenSessionId?: string;
  allowedRoot?: string;
  workRoot?: string;
  forceAnalysisCopy?: boolean;
  analysisSampleBytes?: number;
}

export interface LargeFileAnalysisCopyFlow {
  status: "large_file_analysis_copy_ready";
  version: typeof LARGE_FILE_ANALYSIS_VERSION;
  generatedAt: string;
  strategyUsed: true;
  maxDirectUploadBytes: number;
  identity: {
    fileId: string;
    copyId: string;
    sessionId: string;
    userId: string | null;
    screenSessionId: string | null;
  };
  original: {
    path: string;
    fileName: string;
    sizeBytes: number;
    sha256Before: string;
    sha256After: string;
    hashUnchanged: boolean;
    modifiedByAegis: false;
  };
  workingCopy: {
    path: string;
    sizeBytes: number;
    sha256: string;
    created: true;
  };
  analysisCopy: {
    created: boolean;
    path: string;
    sizeBytes: number;
    sha256: string;
    mode:
      | "working_copy_reused"
      | "byte_sample_from_working_copy"
      | "full_copy_under_limit";
    reason: string;
    byteLimit: number | null;
    mediaDecodeReady: boolean;
  };
  secureRoom: {
    recordOnly: true;
    finalDecision: "RECORD_ONLY_NOT_VAULT";
    canOpenVault: false;
    vaultCapable: false;
    confirmed: false;
    idMatched: false;
  };
  safety: {
    originalFileDeleted: false;
    originalFileModified: false;
    fileContentSentOutside: false;
    localCopyOnly: true;
    largeFileStrategyUsed: true;
    idRuleChanged: false;
    thresholdChanged: false;
    finalDecisionChanged: false;
    secureRoomDoesNotDecide: true;
    evidencePackageDoesNotDecide: true;
    c2paDraftDoesNotDecide: true;
  };
  note: string;
}

function normalizeForCompare(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isWithinRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = normalizeForCompare(candidate);
  const resolvedRoot = normalizeForCompare(root);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`)
  );
}

export interface SafeRealPathWithinRootResult {
  allowedRootRealPath: string;
  targetRealPath: string;
}

export async function resolveSafeRealPathWithinRoot(input: {
  targetPath: string;
  allowedRoot: string;
}): Promise<SafeRealPathWithinRootResult> {
  let allowedRootRealPath: string;
  try {
    allowedRootRealPath = await realpath(path.resolve(input.allowedRoot));
  } catch {
    throw new Error("allowed_root_not_available");
  }

  let targetRealPath: string;
  try {
    // codeql[js/path-injection] Admin-only path is canonicalized here and rejected below unless its real path stays inside the configured server root.
    targetRealPath = await realpath(path.resolve(input.targetPath));
  } catch {
    throw new Error("sourcePath_not_available");
  }

  if (!isWithinRoot(targetRealPath, allowedRootRealPath)) {
    throw new Error("sourcePath_outside_allowed_root");
  }

  return {
    allowedRootRealPath,
    targetRealPath,
  };
}

function configuredAllowedRoot(): string {
  const allowedRoot = process.env["AEGIS_LARGE_FILE_ALLOWED_ROOT"];
  if (!allowedRoot) {
    throw new Error("large_file_allowed_root_not_configured");
  }
  return allowedRoot;
}

function defaultWorkRoot(): string {
  return process.env["AEGIS_LARGE_FILE_WORKDIR"] ?? path.join(os.tmpdir(), "aegis-large-file-analysis");
}

function safeAnalysisBytes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_ANALYSIS_SAMPLE_BYTES;
  }
  return Math.max(1 * 1024 * 1024, Math.min(Math.floor(value), DEFAULT_MAX_DIRECT_UPLOAD_BYTES));
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function copyPrefix(sourcePath: string, targetPath: string, bytes: number): Promise<void> {
  await pipeline(
    createReadStream(sourcePath, { start: 0, end: Math.max(0, bytes - 1) }),
    createWriteStream(targetPath),
  );
}

export async function prepareLargeFileAnalysisCopy(
  input: LargeFileAnalysisInput,
): Promise<LargeFileAnalysisCopyFlow> {
  const allowedRoot = input.allowedRoot ?? configuredAllowedRoot();
  const { targetRealPath: sourcePath } = await resolveSafeRealPathWithinRoot({
    targetPath: input.sourcePath,
    allowedRoot,
  });

  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) {
    throw new Error("sourcePath_must_be_file");
  }

  const originalSha256Before = await sha256File(sourcePath);
  const workRoot = path.resolve(input.workRoot ?? defaultWorkRoot());
  const runDir = path.join(workRoot, `large-file-${Date.now()}-${randomUUID().slice(0, 8)}`);
  await mkdir(runDir, { recursive: true });

  const sourceExt = path.extname(sourcePath);
  const sourceBase = path.basename(sourcePath, sourceExt).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const workingCopyPath = path.join(runDir, `${sourceBase || "source"}-working${sourceExt || ".bin"}`);
  await copyFile(sourcePath, workingCopyPath);

  const workingCopyStat = await stat(workingCopyPath);
  const workingCopySha256 = await sha256File(workingCopyPath);
  const needsAnalysisCopy =
    input.forceAnalysisCopy === true ||
    workingCopyStat.size > DEFAULT_MAX_DIRECT_UPLOAD_BYTES;
  const analysisSampleBytes = safeAnalysisBytes(input.analysisSampleBytes);

  let analysisCopyPath = workingCopyPath;
  let analysisCopyMode: LargeFileAnalysisCopyFlow["analysisCopy"]["mode"] =
    workingCopyStat.size <= DEFAULT_MAX_DIRECT_UPLOAD_BYTES
      ? "full_copy_under_limit"
      : "working_copy_reused";
  let analysisCopyReason =
    workingCopyStat.size <= DEFAULT_MAX_DIRECT_UPLOAD_BYTES
      ? "Working copy is already within direct analysis limit."
      : "Working copy retained because no byte sample was requested.";
  let analysisCopySha256 = workingCopySha256;
  let analysisCopySize = workingCopyStat.size;
  let analysisByteLimit: number | null = null;
  let mediaDecodeReady = true;

  if (needsAnalysisCopy) {
    const sampleBytes = Math.min(analysisSampleBytes, workingCopyStat.size);
    analysisCopyPath = path.join(runDir, `${sourceBase || "source"}-analysis-sample.bin`);
    await copyPrefix(workingCopyPath, analysisCopyPath, sampleBytes);
    const analysisStat = await stat(analysisCopyPath);
    analysisCopySha256 = await sha256File(analysisCopyPath);
    analysisCopySize = analysisStat.size;
    analysisCopyMode = "byte_sample_from_working_copy";
    analysisCopyReason =
      "64 MB-safe local analysis sample created from the working copy. This is for hash/summary/segment-level analysis; it does not replace full media decode.";
    analysisByteLimit = sampleBytes;
    mediaDecodeReady = false;
  }

  const originalSha256After = await sha256File(sourcePath);

  return {
    status: "large_file_analysis_copy_ready",
    version: LARGE_FILE_ANALYSIS_VERSION,
    generatedAt: new Date().toISOString(),
    strategyUsed: true,
    maxDirectUploadBytes: DEFAULT_MAX_DIRECT_UPLOAD_BYTES,
    identity: {
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      screenSessionId: input.screenSessionId ?? null,
    },
    original: {
      path: sourcePath,
      fileName: path.basename(sourcePath),
      sizeBytes: sourceStat.size,
      sha256Before: originalSha256Before,
      sha256After: originalSha256After,
      hashUnchanged: originalSha256Before === originalSha256After,
      modifiedByAegis: false,
    },
    workingCopy: {
      path: workingCopyPath,
      sizeBytes: workingCopyStat.size,
      sha256: workingCopySha256,
      created: true,
    },
    analysisCopy: {
      created: needsAnalysisCopy,
      path: analysisCopyPath,
      sizeBytes: analysisCopySize,
      sha256: analysisCopySha256,
      mode: analysisCopyMode,
      reason: analysisCopyReason,
      byteLimit: analysisByteLimit,
      mediaDecodeReady,
    },
    secureRoom: {
      recordOnly: true,
      finalDecision: "RECORD_ONLY_NOT_VAULT",
      canOpenVault: false,
      vaultCapable: false,
      confirmed: false,
      idMatched: false,
    },
    safety: {
      originalFileDeleted: false,
      originalFileModified: false,
      fileContentSentOutside: false,
      localCopyOnly: true,
      largeFileStrategyUsed: true,
      idRuleChanged: false,
      thresholdChanged: false,
      finalDecisionChanged: false,
      secureRoomDoesNotDecide: true,
      evidencePackageDoesNotDecide: true,
      c2paDraftDoesNotDecide: true,
    },
    note:
      "Large file strategy creates local working/analysis copies only. It never modifies the original and never changes VAULT, ID, threshold, or final decision logic.",
  };
}

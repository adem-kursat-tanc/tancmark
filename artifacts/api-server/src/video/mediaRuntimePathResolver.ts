import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type MediaRuntimeTool = "ffmpeg" | "ffprobe";

export const CODESPACES_LINUX_DEMO_PROFILE =
  "CODESPACES_LINUX_DEMO_PROFILE_V1" as const;

type MediaRuntimeProfile =
  | "WINDOWS_CANONICAL_PRODUCT_PROFILE"
  | typeof CODESPACES_LINUX_DEMO_PROFILE;

const MEDIA_RUNTIME_CONTRACT = Object.freeze({
  ffmpeg: {
    productionEnv: "TANCMARK_FFMPEG_PATH",
    testEnv: "TANCMARK_LIVE_TEST_FFMPEG",
    sha256: "6b22601b72c358b3b41bdb8480964b178b5a2bfd1849fb24991f460d2f85a946",
  },
  ffprobe: {
    productionEnv: "TANCMARK_FFPROBE_PATH",
    testEnv: "TANCMARK_LIVE_TEST_FFPROBE",
    sha256: "e540d5392a3981ddfa4cfcccba0becf07fb612a53bf0771e4bc61f4840182a68",
  },
} as const);

/**
 * Separate, bounded Linux demo runtime. These hashes identify the binaries
 * produced by the documented FFmpeg 8.1.2 source build; they do not replace
 * or relax the frozen Windows product hashes above.
 */
const LINUX_DEMO_MEDIA_RUNTIME_CONTRACT = Object.freeze({
  ffmpeg: {
    productionEnv: "TANCMARK_FFMPEG_PATH",
    testEnv: "TANCMARK_LIVE_TEST_FFMPEG",
    sha256: "69274076177abb5a998133711361addcd347d446327655ef0be1dbc751e62c11",
  },
  ffprobe: {
    productionEnv: "TANCMARK_FFPROBE_PATH",
    testEnv: "TANCMARK_LIVE_TEST_FFPROBE",
    sha256: "86b4f307d12b18d528435b189f7fef942fb045e745d01717a5bdb26a735070b5",
  },
} as const);

const verified = new Map<string, string>();

function comparable(value: string): string {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function fail(tool: MediaRuntimeTool, reason: string): never {
  throw new Error(`TANCMARK_${tool.toUpperCase()}_RUNTIME_${reason}`);
}

function configuredProfile(): MediaRuntimeProfile {
  const requested = process.env["TANCMARK_MEDIA_RUNTIME_PROFILE"]?.trim();
  if (!requested) return "WINDOWS_CANONICAL_PRODUCT_PROFILE";
  if (
    requested === CODESPACES_LINUX_DEMO_PROFILE &&
    process.platform === "linux" &&
    process.env["TANCMARK_DEMO_ONLY"] === "1"
  ) {
    return CODESPACES_LINUX_DEMO_PROFILE;
  }
  throw new Error("TANCMARK_MEDIA_RUNTIME_PROFILE_REJECTED");
}

function contractFor(tool: MediaRuntimeTool) {
  return configuredProfile() === CODESPACES_LINUX_DEMO_PROFILE
    ? LINUX_DEMO_MEDIA_RUNTIME_CONTRACT[tool]
    : MEDIA_RUNTIME_CONTRACT[tool];
}

function linuxDemoChildEnvironment(profile: MediaRuntimeProfile): NodeJS.ProcessEnv | undefined {
  if (profile !== CODESPACES_LINUX_DEMO_PROFILE) return undefined;
  const raw = process.env["TANCMARK_DEMO_LD_LIBRARY_PATH"]?.trim();
  const entries = raw?.split(path.delimiter).filter(Boolean) ?? [];
  if (entries.length === 0) throw new Error("TANCMARK_DEMO_LD_LIBRARY_PATH_REQUIRED");
  for (const entry of entries) {
    if (!path.isAbsolute(entry)) throw new Error("TANCMARK_DEMO_LD_LIBRARY_PATH_REJECTED");
    const resolved = path.resolve(entry);
    const stat = fs.lstatSync(resolved);
    const real = fs.realpathSync.native(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink() || comparable(real) !== comparable(resolved)) {
      throw new Error("TANCMARK_DEMO_LD_LIBRARY_PATH_REJECTED");
    }
  }
  return {
    PATH: "/usr/bin:/bin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    LD_LIBRARY_PATH: entries.map((entry) => path.resolve(entry)).join(path.delimiter),
  };
}

function configuredPath(tool: MediaRuntimeTool): string {
  const contract = contractFor(tool);
  const productionValue = process.env[contract.productionEnv]?.trim();
  if (productionValue) return productionValue;
  if (process.env["NODE_ENV"] === "test") {
    const testValue = process.env[contract.testEnv]?.trim();
    if (testValue) return testValue;
  }
  return fail(tool, "ABSOLUTE_PATH_REQUIRED");
}

function verifyRuntime(tool: MediaRuntimeTool, candidate: string): string {
  const profile = configuredProfile();
  const contract = contractFor(tool);
  if (!path.isAbsolute(candidate)) return fail(tool, "ABSOLUTE_PATH_REQUIRED");
  const resolved = path.resolve(candidate);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    return fail(tool, "FILE_REQUIRED");
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return fail(tool, "NORMAL_FILE_REQUIRED");
  let real: string;
  try {
    real = fs.realpathSync.native(resolved);
  } catch {
    return fail(tool, "REALPATH_FAILED");
  }
  if (comparable(real) !== comparable(resolved)) return fail(tool, "REPARSE_PATH_REJECTED");
  const expectedName = process.platform === "win32" ? `${tool}.exe` : tool;
  if (path.basename(resolved).toLowerCase() !== expectedName) return fail(tool, "BASENAME_INVALID");

  const cacheKey = `${tool}\0${comparable(resolved)}\0${stat.size}\0${stat.mtimeMs}`;
  const cached = verified.get(cacheKey);
  if (cached) return cached;
  const actualSha256 = createHash("sha256").update(fs.readFileSync(resolved)).digest("hex");
  if (actualSha256 !== contract.sha256) return fail(tool, "SHA256_MISMATCH");
  const version = spawnSync(resolved, ["-hide_banner", "-version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
    env: linuxDemoChildEnvironment(profile),
  });
  const output = `${version.stdout ?? ""}\n${version.stderr ?? ""}`;
  if (version.status !== 0 || !new RegExp(`^${tool} version 8\\.1\\.2(?:-|\\b)`, "m").test(output)) {
    return fail(tool, "VERSION_MISMATCH");
  }
  for (const required of ["--disable-gpl", "--disable-nonfree", "--disable-network"]) {
    if (!output.includes(required)) return fail(tool, "PROVENANCE_MISMATCH");
  }
  for (const forbidden of ["--enable-libx264", "--enable-libx265"]) {
    if (output.includes(forbidden)) return fail(tool, "PROVENANCE_MISMATCH");
  }
  if (
    profile === CODESPACES_LINUX_DEMO_PROFILE &&
    !output.includes("tancmark-codespaces-linux-demo-v1")
  ) {
    return fail(tool, "PROVENANCE_MISMATCH");
  }
  verified.set(cacheKey, resolved);
  return resolved;
}

export function resolveMediaRuntimePath(tool: MediaRuntimeTool): string {
  return verifyRuntime(tool, configuredPath(tool));
}

export function assertApprovedMediaRuntimePath(tool: MediaRuntimeTool, candidate: string): string {
  const approved = resolveMediaRuntimePath(tool);
  if (comparable(candidate) !== comparable(approved)) return fail(tool, "UNAPPROVED_PATH");
  return approved;
}

export function approvedMediaRuntimeChildEnvironment(): NodeJS.ProcessEnv | undefined {
  return linuxDemoChildEnvironment(configuredProfile());
}

export const MEDIA_RUNTIME_APPROVED_SHA256 = Object.freeze({
  ffmpeg: MEDIA_RUNTIME_CONTRACT.ffmpeg.sha256,
  ffprobe: MEDIA_RUNTIME_CONTRACT.ffprobe.sha256,
});

export const CODESPACES_LINUX_DEMO_MEDIA_RUNTIME_APPROVED_SHA256 =
  Object.freeze({
    ffmpeg: LINUX_DEMO_MEDIA_RUNTIME_CONTRACT.ffmpeg.sha256,
    ffprobe: LINUX_DEMO_MEDIA_RUNTIME_CONTRACT.ffprobe.sha256,
  });

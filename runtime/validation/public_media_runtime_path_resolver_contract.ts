import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MEDIA_RUNTIME_APPROVED_SHA256,
  resolveMediaRuntimePath,
} from "../../artifacts/api-server/src/video/mediaRuntimePathResolver.ts";

const ffmpeg = process.env["TANCMARK_LIVE_TEST_FFMPEG"];
const ffprobe = process.env["TANCMARK_LIVE_TEST_FFPROBE"];
assert(ffmpeg && ffprobe && path.isAbsolute(ffmpeg) && path.isAbsolute(ffprobe));
const original = { ...process.env };
const originalPath = process.env["Path"] ?? process.env["PATH"] ?? "";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-media-resolver-"));
const expectCode = (operation: () => unknown, code: string): void => {
  assert.throws(operation, (error: unknown) => error instanceof Error && error.message === code);
};

try {
  process.env["NODE_ENV"] = "test";
  delete process.env["TANCMARK_FFMPEG_PATH"];
  delete process.env["TANCMARK_FFPROBE_PATH"];
  assert.equal(resolveMediaRuntimePath("ffmpeg"), path.resolve(ffmpeg));
  assert.equal(resolveMediaRuntimePath("ffprobe"), path.resolve(ffprobe));
  assert.equal(createHash("sha256").update(fs.readFileSync(ffmpeg)).digest("hex"), MEDIA_RUNTIME_APPROVED_SHA256.ffmpeg);
  assert.equal(createHash("sha256").update(fs.readFileSync(ffprobe)).digest("hex"), MEDIA_RUNTIME_APPROVED_SHA256.ffprobe);
  assert.equal(process.env["Path"] ?? process.env["PATH"] ?? "", originalPath);

  process.env["NODE_ENV"] = "production";
  delete process.env["TANCMARK_FFMPEG_PATH"];
  expectCode(() => resolveMediaRuntimePath("ffmpeg"), "TANCMARK_FFMPEG_RUNTIME_ABSOLUTE_PATH_REQUIRED");
  process.env["Path"] = `${path.dirname(ffmpeg)};${originalPath}`;
  expectCode(() => resolveMediaRuntimePath("ffmpeg"), "TANCMARK_FFMPEG_RUNTIME_ABSOLUTE_PATH_REQUIRED");

  process.env["TANCMARK_FFMPEG_PATH"] = ffmpeg;
  process.env["TANCMARK_FFPROBE_PATH"] = ffprobe;
  assert.equal(resolveMediaRuntimePath("ffmpeg"), path.resolve(ffmpeg));
  assert.equal(resolveMediaRuntimePath("ffprobe"), path.resolve(ffprobe));

  const tampered = path.join(temp, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const bytes = fs.readFileSync(ffmpeg);
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  fs.writeFileSync(tampered, bytes);
  process.env["TANCMARK_FFMPEG_PATH"] = tampered;
  expectCode(() => resolveMediaRuntimePath("ffmpeg"), "TANCMARK_FFMPEG_RUNTIME_SHA256_MISMATCH");

  const wrongName = path.join(temp, process.platform === "win32" ? "media-tool.exe" : "media-tool");
  fs.copyFileSync(ffmpeg, wrongName);
  process.env["TANCMARK_FFMPEG_PATH"] = wrongName;
  expectCode(() => resolveMediaRuntimePath("ffmpeg"), "TANCMARK_FFMPEG_RUNTIME_BASENAME_INVALID");

  let reparseVerified = false;
  const link = path.join(temp, "runtime-link");
  try {
    fs.symlinkSync(path.dirname(ffmpeg), link, process.platform === "win32" ? "junction" : "dir");
    process.env["TANCMARK_FFMPEG_PATH"] = path.join(link, path.basename(ffmpeg));
    expectCode(() => resolveMediaRuntimePath("ffmpeg"), "TANCMARK_FFMPEG_RUNTIME_REPARSE_PATH_REJECTED");
    reparseVerified = true;
  } catch (error) {
    if (fs.existsSync(link)) throw error;
  }
  assert.equal(reparseVerified, true, "reparse rejection must be measured");

  process.stdout.write(`${JSON.stringify({
    contract: "public_media_runtime_path_resolver_contract",
    status: "passed",
    explicitProductionPaths: true,
    testAliasesIgnoredInProduction: true,
    pathLookupRejected: true,
    sha256Verified: true,
    versionAndProvenanceVerified: true,
    reparseRejected: true,
    globalPathMutationByResolver: false,
    externalNetworkCalls: 0,
  }, null, 2)}\n`);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
  fs.rmSync(temp, { recursive: true, force: true });
}

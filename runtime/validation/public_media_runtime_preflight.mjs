import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fileFromEnv = (name) => {
  const value = process.env[name];
  assert(value && path.isAbsolute(value), `${name}_ABSOLUTE_PATH_REQUIRED`);
  const resolved = path.resolve(value);
  assert(fs.statSync(resolved).isFile(), `${name}_FILE_REQUIRED`);
  const relative = path.relative(root, resolved);
  assert(relative.startsWith("..") || path.isAbsolute(relative), `${name}_MUST_BE_EXTERNAL_TO_REPOSITORY`);
  return resolved;
};
const run = (command, args, timeout = 30_000) => {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout });
  assert.equal(result.status, 0, (result.stderr || result.error?.message || "external runtime command failed").slice(0, 500));
  return `${result.stdout || ""}${result.stderr || ""}`;
};
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

const python = fileFromEnv("TANCMARK_LIVE_WATERMARK_PYTHON");
const ffmpeg = fileFromEnv("TANCMARK_LIVE_TEST_FFMPEG");
const ffprobe = fileFromEnv("TANCMARK_LIVE_TEST_FFPROBE");
assert.equal(sha256(ffmpeg), "6B22601B72C358B3B41BDB8480964B178B5A2BFD1849FB24991F460D2F85A946");
assert.equal(sha256(ffprobe), "E540D5392A3981DDFA4CFCCCBA0BECF07FB612A53BF0771E4BC61F4840182A68");
const worker = path.join(root, "runtime", "live", "live_streaming_adapter_worker.py");
const adapterC = path.join(root, "runtime", "product-runtime", "unified_pts_watermark_adapter_c.py");
assert.equal(sha256(worker), "A499AE194BA1E7312283DB9947C254BB471CAF283CB3FEF2588BD41EDD4FF784");
assert.equal(sha256(adapterC), "AA7F0E1CD4D3A489C836602A4A41A1DCCA6E4A2D9A0E5221EFE25E17AA46588F");

const py = JSON.parse(run(python, ["-c", "import sys,av,numpy,json;print(json.dumps({'python':sys.version_info[:3],'av':av.__version__,'numpy':numpy.__version__,'libraries':{k:list(v) for k,v in av.library_versions.items()}}))"]));
assert.deepEqual(py.python, [3, 14, 7]);
assert.equal(py.av, "18.0.0");
assert.equal(py.numpy, "2.5.2");
assert.deepEqual(py.libraries.libavcodec, [62, 28, 102]);
assert.deepEqual(py.libraries.libavformat, [62, 12, 102]);
assert.deepEqual(py.libraries.libavutil, [60, 26, 102]);

const version = run(ffmpeg, ["-hide_banner", "-version"]);
assert(/^ffmpeg version 8\.1\.2(?:-|\b)/m.test(version));
for (const flag of ["--disable-gpl", "--disable-nonfree", "--disable-network", "--disable-autodetect", "--enable-shared", "--enable-mediafoundation", "--enable-zlib"]) assert(version.includes(flag), `ffmpeg_required_flag_missing:${flag}`);
for (const flag of ["--enable-libx264", "--enable-libx265"]) assert(!version.includes(flag), `ffmpeg_forbidden_flag_present:${flag}`);
const encoders = run(ffmpeg, ["-hide_banner", "-encoders"]);
assert(/\bh264_mf\b/.test(encoders));
assert(/\bAAC\b.*\baac\b/i.test(encoders));
assert(!/\blibx26[45]\b/.test(encoders));
assert(/^ffprobe version 8\.1\.2(?:-|\b)/m.test(run(ffprobe, ["-hide_banner", "-version"])));

process.stdout.write(`${JSON.stringify({
  contract: "public_media_runtime_preflight",
  status: "passed",
  explicitExternalPathsOnly: true,
  exactFrozenBinaryHashesVerified: true,
  userPathLookupUsed: false,
  runtimeBundledInRepository: false,
  versions: { python: "3.14.7", pyav: py.av, numpy: py.numpy, ffmpeg: "8.1.2" },
  ffmpegPolicy: { gplDisabled: true, nonfreeDisabled: true, networkDisabled: true, libx264Absent: true, libx265Absent: true, h264MediaFoundation: true, nativeAac: true },
  binarySha256: { python: sha256(python), ffmpeg: sha256(ffmpeg), ffprobe: sha256(ffprobe) },
  productSourceSha256: { worker: sha256(worker), adapterC: sha256(adapterC) },
  externalNetworkCalls: 0,
}, null, 2)}\n`);

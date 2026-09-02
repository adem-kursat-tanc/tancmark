import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractFramesByExactAddresses, probeExactVideoTimeline } from "../../artifacts/api-server/src/video/exactSealTimingMap.ts";

async function main(): Promise<void> {
  const manifestPath = process.env["TANCMARK_LIVE_REAL_MEDIA_MANIFEST"];
  if (!manifestPath || !path.isAbsolute(manifestPath)) throw new Error("live_private_manifest_required");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { cases?: Record<string, { path?: string }> };
  const videoPath = manifest.cases?.["REAL_7M44_VFR_01"]?.path;
  if (!videoPath || !path.isAbsolute(videoPath) || !fs.lstatSync(videoPath).isFile()) throw new Error("live_7m44_private_source_required");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tancmark-exact-464-"));
  try {
    const timeline = await probeExactVideoTimeline(videoPath);
    const configuredCount = Number(process.env["TANCMARK_LIVE_EXACT_EXTRACTION_COUNT"] ?? 464);
    if (!Number.isSafeInteger(configuredCount) || configuredCount < 2 || configuredCount > 464) throw new Error("live_exact_extraction_count_invalid");
    const count = configuredCount;
    const indices = Array.from({ length: count }, (_unused, index) => Math.floor(index * (timeline.frameCount - 1) / (count - 1)));
    assert.equal(new Set(indices).size, count);
    const addresses = indices.map((frameIdx) => ({ frameIdx, pts: timeline.pts[frameIdx]!, timeBase: timeline.timeBase }));
    const started = performance.now();
    const extracted = await extractFramesByExactAddresses({ videoPath, addresses, outDir: path.join(root, "frames") });
    const wallMs = performance.now() - started;
    assert.equal(extracted.length, count);
    assert(extracted.every((frame, index) => frame.frameIdx === indices[index] && fs.statSync(frame.pngPath).size > 0));
    process.stdout.write(`${JSON.stringify({ schemaVersion: "tancmark-live-exact-464-extraction-result-v1", addressCount: count, extractedCount: extracted.length, ordinalOrderExact: true, sourcePathDisclosed: false, sourceHashDisclosed: false, wallMs: Number(wallMs.toFixed(3)), gatePassed: true }, null, 2)}\n`);
  } finally {
    const resolved = path.resolve(root);
    const relative = path.relative(path.resolve(os.tmpdir()), resolved);
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && path.basename(resolved).startsWith("tancmark-exact-464-"));
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

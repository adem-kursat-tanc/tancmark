import assert from "node:assert/strict";
import fs from "node:fs";
import { DemoEngine } from "./demoEngine";

const scope = process.env["TANCMARK_DEMO_TEST_SCOPE"] ?? "full";
const repeats = Number.parseInt(process.env["TANCMARK_DEMO_TEST_REPEATS"] ?? "1", 10);
assert(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3);
const runs: Array<Record<string, unknown>> = [];

for (let run = 1; run <= repeats; run += 1) {
  const engine = new DemoEngine();
  try {
    const text = await engine.runText();
    const image = await engine.runImage();
    const registry = engine.runRegistryVerification();
    assert.equal(text.status, "DEMO_EXACT_VERIFIED");
    assert.equal(text.wrongIdOwnership, false);
    assert.equal(text.noIdOwnership, false);
    assert.equal(image.status, "DEMO_EXACT_VERIFIED", JSON.stringify(image));
    assert.equal(image.wrongIdOwnership, false);
    assert.equal(image.noIdOwnership, false);
    assert.equal(registry.status, "DEMO_EXACT_VERIFIED");
    assert.equal(registry.wrongTenantOwnership, false);
    assert.equal(registry.changedRegistryRecordAccepted, false);
    assert.equal(registry.wrongSignatureAccepted, false);
    const result: Record<string, unknown> = { run, text, image, registry };
    if (scope === "full") {
      const audio44100 = await engine.runAudio(44_100);
      const audio48000 = await engine.runAudio(48_000);
      const video = await engine.runVideo();
      for (const audio of [audio44100, audio48000]) {
        assert.equal(audio.status, "DEMO_EXACT_VERIFIED");
        assert.equal(audio.audioWrongIdOwnership, false);
        assert.equal(audio.audioNoIdOwnership, false);
        assert.equal(audio.audioSampleCountPreserved, true);
      }
      assert.equal(video.status, "DEMO_EXACT_VERIFIED");
      assert.equal(video.videoWrongIdOwnership, false);
      assert.equal(video.videoNoIdOwnership, false);
      assert.equal(video.videoFrameDrop, 0);
      assert.equal(video.videoDuplicateFrame, 0);
      assert.equal(video.videoCumulativeDrift, 0);
      result.audio44100 = audio44100;
      result.audio48000 = audio48000;
      result.video = video;
    }
    runs.push(withoutEmbeddedMedia(result));
  } finally {
    engine.reset();
    assert.equal(engine.registry.rowCount, 0);
    const residues = fs.readdirSync(engine.paths.tempRoot).filter((name) => name.startsWith("tancmark-demo-"));
    assert.deepEqual(residues, []);
  }
}

process.stdout.write(`${JSON.stringify({
  schemaVersion: "tancmark-codespaces-demo-functional-v1",
  status: "PASSED",
  scope,
  repeats,
  runs,
  wrongOwnership: 0,
  productionOwnership: 0,
  productionVault: 0,
  remainingDemoTemporaryDirectories: 0,
}, null, 2)}\n`);

function withoutEmbeddedMedia(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    key === "sealedText" || key === "sealedPreviewDataUrl" || key === "previewDataUrl"
      ? undefined
      : item,
  )) as Record<string, unknown>;
}

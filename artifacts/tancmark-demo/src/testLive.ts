import assert from "node:assert/strict";
import fs from "node:fs";
import { DemoEngine } from "./demoEngine";
import { loadLiveDemoRuntime, runLiveDemoPipeline } from "./liveDemoPipeline";

const engine = new DemoEngine();
try {
  const record = engine.registry.createRecord("live");
  const result = await runLiveDemoPipeline({
    runtime: loadLiveDemoRuntime(engine.paths),
    registry: engine.registry,
    record,
  });
  assert.equal(result.status, "DEMO_EXACT_VERIFIED");
  assert.equal(result.liveDemoRealPipeline, true);
  assert.equal(result.liveInStreamWatermarkActive, true);
  assert.equal(result.liveFinalExactVerified, true);
  assert.equal(result.liveWrongOwnership, false);
  assert.equal(result["liveWrongTenantOwnership"], false);
  assert.equal(result["liveUnwatermarkedInjectionOwnership"], false);
  assert.equal(result["liveDroppedFrames"], 0);
  assert.equal(result["liveBacklogAfterStop"], 0);
  assert.equal(result["remainingLiveWorkers"], 0);
  assert.equal(result["remainingLivePorts"], 0);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "tancmark-codespaces-live-demo-functional-v1",
    status: "PASSED_WITH_BROWSER_VISIBILITY_PENDING_SEPARATE_GATE",
    result,
  }, null, 2)}\n`);
} finally {
  engine.reset();
  assert.equal(engine.registry.rowCount, 0);
  assert.deepEqual(
    fs.readdirSync(engine.paths.tempRoot).filter((name) => name.startsWith("tancmark-demo-")),
    [],
  );
}

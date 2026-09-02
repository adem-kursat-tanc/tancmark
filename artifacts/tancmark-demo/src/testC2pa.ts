import assert from "node:assert/strict";
import fs from "node:fs";
import { runC2paDemo } from "./c2paDemo";
import { DemoEngine } from "./demoEngine";

const engine = new DemoEngine();
try {
  const record = engine.registry.createRecord("c2pa");
  const result = await runC2paDemo({ runtime: engine.paths, registry: engine.registry, record });
  assert.equal(result["status"], "DEMO_EXACT_VERIFIED");
  assert.equal(result["signEmbed"], true);
  assert.equal(result["rereadSignatureValid"], true);
  assert.equal(result["rereadAssetIntegrityValid"], true);
  assert.equal(result["tamperDetected"], true);
  assert.equal(result["c2paCanOpenVault"], false);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "tancmark-codespaces-c2pa-demo-functional-v1",
    status: "PASSED",
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

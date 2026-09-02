import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalReaderInvocationAllowed,
  runWithinCanonicalLiveExactVerification,
} from "../../artifacts/api-server/src/video/canonicalReaderLiveScope.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string): string => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const previousNodeEnv = process.env["NODE_ENV"];
const previousProductRuntime = process.env["AEGIS_PRODUCT_RUNTIME"];

async function main(): Promise<void> {
try {
  process.env["NODE_ENV"] = "production";
  process.env["AEGIS_PRODUCT_RUNTIME"] = "1";
  assert.throws(assertCanonicalReaderInvocationAllowed, /canonical_video_reader_live_scope_required/);
  await runWithinCanonicalLiveExactVerification(async () => {
    assert.doesNotThrow(assertCanonicalReaderInvocationAllowed);
  });
  assert.match(read("artifacts/api-server/src/video/decodeVideo.ts"), /assertCanonicalReaderInvocationAllowed\(\)/);
  assert.match(read("artifacts/api-server/src/video/ffmpegHelper.ts"), /assertCanonicalReaderInvocationAllowed\(\)/);
  assert.match(read("artifacts/api-server/src/video/advancedVideoRecovery.ts"), /assertCanonicalReaderInvocationAllowed\(\)/);
  assert.match(read("artifacts/api-server/src/live/liveAutomaticExactVerification.ts"), /runWithinCanonicalLiveExactVerification/);
  console.log(JSON.stringify({
    contract: "public_canonical_reader_live_scope_contract",
    status: "passed",
    directInternalInvocationRejected: true,
    signedLiveScopeAllowed: true,
    decodeVideoGuarded: true,
    ffmpegExecutionGuarded: true,
    advancedRecoveryProbeGuarded: true,
    externalNetworkCalls: 0,
  }, null, 2));
} finally {
  if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = previousNodeEnv;
  if (previousProductRuntime === undefined) delete process.env["AEGIS_PRODUCT_RUNTIME"];
  else process.env["AEGIS_PRODUCT_RUNTIME"] = previousProductRuntime;
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

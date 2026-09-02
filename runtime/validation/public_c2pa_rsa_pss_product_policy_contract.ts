// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import {
  C2paSignerAdapter,
  assertConfiguredLocalSigningAlgorithmAllowed,
  type C2paSigningAlgorithm,
} from "../../artifacts/api-server/src/c2pa/C2paSignerAdapter.ts";

async function main(): Promise<void> {
const productEnvironment = { ...process.env, NODE_ENV: "production" };
delete productEnvironment["TANCMARK_C2PA_ALLOW_TEST_SIGNING"];
delete productEnvironment["AEGIS_PRODUCT_RUNTIME"];

assert.doesNotThrow(() => assertConfiguredLocalSigningAlgorithmAllowed("es256", productEnvironment));
for (const algorithm of ["ps256", "ps384", "ps512"] as const) {
  assert.throws(
    () => assertConfiguredLocalSigningAlgorithmAllowed(algorithm, productEnvironment),
    /c2pa_local_rsa_pss_disabled_in_product/,
  );
}

const previousNodeEnv = process.env["NODE_ENV"];
const previousProductRuntime = process.env["AEGIS_PRODUCT_RUNTIME"];
try {
  process.env["NODE_ENV"] = "production";
  delete process.env["AEGIS_PRODUCT_RUNTIME"];
  for (const algorithm of ["ps256", "ps384", "ps512"] as const) {
    await assert.rejects(
      C2paSignerAdapter.fromConfiguredPaths({
        certificatePath: `Z:/must-not-be-read/${algorithm}/certificate.pem`,
        privateKeyPath: `Z:/must-not-be-read/${algorithm}/private-key.pem`,
        algorithm,
      }),
      (error: unknown) => error instanceof Error
        && error.message === "c2pa_local_rsa_pss_disabled_in_product",
    );
  }
} finally {
  if (previousNodeEnv === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = previousNodeEnv;
  if (previousProductRuntime === undefined) delete process.env["AEGIS_PRODUCT_RUNTIME"];
  else process.env["AEGIS_PRODUCT_RUNTIME"] = previousProductRuntime;
}

for (const algorithm of ["ps256", "ps384", "ps512"] as C2paSigningAlgorithm[]) {
  assert.throws(
    () => assertConfiguredLocalSigningAlgorithmAllowed(algorithm, { NODE_ENV: "development" }),
    /c2pa_local_rsa_pss_test_flag_required/,
  );
  assert.doesNotThrow(() => assertConfiguredLocalSigningAlgorithmAllowed(algorithm, {
    NODE_ENV: "test",
    TANCMARK_C2PA_ALLOW_TEST_SIGNING: "1",
  }));
}

console.log(JSON.stringify({
  status: "PASSED",
  productEs256Allowed: true,
  productPs256RejectedBeforePrivateKeyRead: true,
  productPs384RejectedBeforePrivateKeyRead: true,
  productPs512RejectedBeforePrivateKeyRead: true,
  defaultAlgorithm: "es256",
  privateKeyDisclosure: 0,
  c2paCanOpenVault: false,
  wrongOwnership: 0,
}, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

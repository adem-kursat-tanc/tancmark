// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { documentationRequirements, evaluateCurrentReleaseDocumentation, evaluateDetailedPublicDocumentation, loadCurrentReleaseDocumentation, verifyPublicSourceClassNegativeScenarios } from "./public_documentation_freshness_gate.mjs";

const internal = documentationRequirements(["artifacts/api-server/src/internal/math.ts"]);
assert.deepEqual(internal.required, []);
const generated = documentationRequirements(["lib/api-client-react/src/generated/api.ts"]);
assert.deepEqual(generated.required, []);
const c2pa = documentationRequirements([
  "artifacts/api-server/src/routes/c2pa.ts", "artifacts/api-server/src/c2pa/C2paSecurityPolicy.ts",
  "docs/USER_GUIDE.md", "docs/FEATURE_STATUS.md", "docs/C2PA_GUIDE.md",
  "docs/SECURITY_DEPLOYMENT_GUIDE.md", "CHANGELOG.md",
]);
assert(c2pa.required.includes("docs/C2PA_GUIDE.md"));
assert(c2pa.required.includes("CHANGELOG.md"));
const dependency = documentationRequirements(["artifacts/api-server/package.json"]);
assert(dependency.required.includes("docs/OPERATOR_GUIDE.md"));
assert(dependency.required.includes("CHANGELOG.md"));
const current = loadCurrentReleaseDocumentation();
assert.deepEqual(evaluateCurrentReleaseDocumentation(current), []);
const staleCount = structuredClone(current);
staleCount.license.dependencyPackageCount = 1145;
assert(evaluateCurrentReleaseDocumentation(staleCount).includes("LICENSE_INVENTORY_MISMATCH:dependencyPackageCount"));
const staleDocs = structuredClone(current);
staleDocs.docs.operatorGuide = staleDocs.docs.operatorGuide.replace("Current clean-install inventory covers", "Historical inventory covered");
assert(evaluateCurrentReleaseDocumentation(staleDocs).includes("CURRENT_V13_INVENTORY_SENTENCE_MISSING:operatorGuide"));
assert.deepEqual(evaluateDetailedPublicDocumentation(), []);

const sourceClassNegativeScenarios = verifyPublicSourceClassNegativeScenarios();
assert.equal(sourceClassNegativeScenarios.validationChangeMisclassifiedAsProduct, false);
assert.equal(sourceClassNegativeScenarios.validationToolingDigestChanged, true);
assert.equal(sourceClassNegativeScenarios.sourceManifestChangedForValidation, true);
assert.equal(sourceClassNegativeScenarios.realProductChangeDetected, true);
assert.equal(sourceClassNegativeScenarios.documentationChangeMisclassifiedAsProduct, false);
assert.equal(sourceClassNegativeScenarios.documentationDigestChanged, true);
assert.equal(sourceClassNegativeScenarios.runtimeImportedValidationFileCount, 0);

process.stdout.write(`${JSON.stringify({
  contract: "PUBLIC_DOCUMENTATION_FRESHNESS_GATE_CONTRACT",
  status: "PASSED",
  ...sourceClassNegativeScenarios,
}, null, 2)}\n`);

// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { evaluateReleaseStateDocuments, loadReleaseStateDocuments } from "./public_release_state_consistency_gate.mjs";

const actual = loadReleaseStateDocuments();
const actualResult = evaluateReleaseStateDocuments(actual);
assert.deepEqual(actualResult.failures, [], JSON.stringify(actualResult));

const cases = [];
function rejects(name, mutate, expectedFragment) {
  const candidate = structuredClone(actual);
  mutate(candidate);
  const result = evaluateReleaseStateDocuments(candidate);
  assert(result.failures.some((failure) => failure.includes(expectedFragment)), `${name}: ${JSON.stringify(result)}`);
  cases.push(name);
}

rejects("live_gap_reopens_fail_closed", (candidate) => { candidate.liveRepeatability.releaseDecision.repeatabilityGapClosed = false; }, "LIVE_REPEATABILITY_GAP_NOT_CLOSED");
rejects("stale_feature_status_fail_closed", (candidate) => { candidate.featureStatus += "\nIMPLEMENTED_AND_TESTED_WITH_RELEASE_GATE_GAP\n"; }, "FEATURE_STATUS_STALE_LIVE_GAP");
rejects("final_release_status_fail_closed", (candidate) => { candidate.finalRelease.currentReleaseStatus = "NOT_READY"; }, "FINAL_RELEASE_STATUS_MISMATCH");
rejects("current_license_count_fail_closed", (candidate) => { candidate.currentLicense.dependencyPackageCount = 1145; }, "LICENSE_CURRENT_INVENTORY_MISMATCH_DEPENDENCYPACKAGECOUNT");
rejects("current_toolchain_version_fail_closed", (candidate) => { candidate.currentToolchain.packageManager.after = "pnpm@10.23.0"; }, "TOOLCHAIN_PACKAGE_MANAGER_VERSION_MISMATCH");
rejects("historical_report_authority_fail_closed", (candidate) => { candidate.historicalFinalRelease.currentReleaseAuthority = true; }, "PRE_V6_FINAL_REPORT_NOT_HISTORICAL");
rejects("product_tree_carry_forward_fail_closed", (candidate) => { candidate.currentToolchain.productTrees.allMatchBaseline = false; }, "TOOLCHAIN_PRODUCT_TREE_MISMATCH");
rejects("real_local_gap_fail_closed", (candidate) => { candidate.debt.realLocalReleaseGaps = ["synthetic-gap"]; }, "DEBT_REAL_LOCAL_RELEASE_GAPS_NOT_EMPTY");
rejects("default_codeql_instruction_fail_closed", (candidate) => { candidate.security += "\nEnable GitHub CodeQL default setup\n"; }, "SECURITY_STALE_CODEQL_DEFAULT_SETUP_INSTRUCTION");
rejects("public_security_detail_fail_closed", (candidate) => { candidate.publicSecurityReconciliation.unresolvedReachableSecurityDetail = 1; }, "PUBLIC_SECURITY_DETAIL_UNRESOLVED");
rejects("private_security_detail_fail_closed", (candidate) => { candidate.privateSecurityReconciliation = { unresolvedReachableSecurityDetail: 1, releaseBlocker: true, reviewedRecord: { classification: "REACHABLE_UNRESOLVED_RELEASE_SECURITY_ISSUE", productRuntimeReachable: true } }; }, "PRIVATE_SECURITY_DETAIL_UNRESOLVED");

process.stdout.write(`${JSON.stringify({
  contract: "PUBLIC_RELEASE_STATE_CONSISTENCY_CONTRACT",
  status: "PASSED",
  actualReleaseStateContradiction: actualResult.releaseStateContradiction,
  failClosedCases: cases.length,
  cases,
}, null, 2)}\n`);

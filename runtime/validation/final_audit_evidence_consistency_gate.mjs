// SPDX-License-Identifier: AGPL-3.0-only

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = path.resolve(process.env.TANCMARK_FINAL_AUDIT_EVIDENCE_ROOT || path.join(root, "reports/final-audit-v4"));
const readRootJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const readEvidenceJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceRoot, name), "utf8"));
const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const blockers = readEvidenceJson("FOUR_BLOCKER_FINAL_RESULTS.json");
const functional = readEvidenceJson("FINAL_PRE_RELEASE_FUNCTIONAL_RESULTS_V4.json");
const advisory = readEvidenceJson("FINAL_PRE_RELEASE_DEPENDENCY_ADVISORY_REPORT_V4.json");
const clean = readEvidenceJson("FINAL_PRE_RELEASE_CLEAN_INSTALL_V4.json");
const privacy = readEvidenceJson("FINAL_PRE_RELEASE_PRIVACY_SCAN_V4.json");
const v4Supply = readEvidenceJson("FINAL_PRE_RELEASE_SUPPLY_CHAIN_V4.json");
const archive = readEvidenceJson("PUBLIC_ARCHIVE_V4.json");
const main = readEvidenceJson("MAIN_PRODUCT_INTEGRATION_V4.json");
const decision = readEvidenceJson("FINAL_PRE_RELEASE_GO_NO_GO_V4.json");
const asvs = readEvidenceJson("FINAL_PRE_RELEASE_ASVS_5_MAPPING_V4.json");
const ssdf = readEvidenceJson("FINAL_PRE_RELEASE_SSDF_EVIDENCE_V4.json");
const auditNarrative = fs.readFileSync(path.join(evidenceRoot, "FINAL_PRE_RELEASE_AUDIT_V4_TR.md"), "utf8");
const v3History = readEvidenceJson("history/v3/HISTORICAL_METADATA.json");

const currentFinal = readRootJson("reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json");
const formerV12Final = readRootJson("reports/PUBLIC_FINAL_RELEASE_RESULT_20260831.json");
const preservedV12Final = readRootJson("reports/history/PUBLIC_FINAL_RELEASE_RESULT_FULL_SECURE_DEMO_V12_20260831.json");
const hostedDemoStatus = readRootJson("reports/GITHUB_CODESPACES_HOSTED_DEMO_STATUS_20260902.json");
const securityClosure = readRootJson("reports/PUBLIC_V7_SECURITY_BOUNDARY_CLOSURE_20260901.json");
const demoPlatformClosure = readRootJson("reports/PUBLIC_V12_DEMO_PLATFORM_ADAPTER_CLOSURE_20260902.json");
const securityRemediation = readRootJson("reports/PUBLIC_V13_SECURITY_REMEDIATION_CLOSURE_20260902.json");
const securityRemediationWindows = readRootJson("DEMO_WINDOWS_SECURITY_REMEDIATION_V13_RESULTS.json");
const securityRemediationLinuxDemo = readRootJson("DEMO_LINUX_SECURITY_REMEDIATION_V13_RESULTS.json");
const historicalFinal = readRootJson("reports/PUBLIC_FINAL_RELEASE_RESULT_20260829.json");
const currentLicense = readRootJson("reports/PUBLIC_LICENSE_SCAN.json");
const toolchain = readRootJson("reports/TOOLCHAIN_SUPPLY_CHAIN_CLOSURE_20260831.json");
const toolchainHistory = readRootJson("reports/TOOLCHAIN_HISTORICAL_RECORD_METADATA_20260831.json");
const historicalPublic = readRootJson("reports/HISTORICAL_REPORT_METADATA_20260830.json");
const actionPin = readRootJson("reports/PUBLIC_ACTION_PIN_RECONCILIATION_20260829.json");

// V4 remains the immutable product-behaviour authority.
assert.equal(decision.decision, "GO_FOR_OWNER_PUSH_REVIEW");
assert.equal(decision.status, "TANCMARK_FINAL_PRE_RELEASE_AUDIT_PASSED");
assert.equal(functional.isolatedPublicCandidate.commit, "57bc782beedd45c49f1cebd840148774240b263e");
assert.equal(archive.commit, functional.isolatedPublicCandidate.commit);
assert.equal(main.integrationCommit, "8d6c71ccb85227b5b6c5c765d3e3ae4da688ca5a");
assert.equal(blockers.blockers.multer.selectedVersion, "2.2.0");
assert.equal(blockers.blockers.sharp.officialStableSelectedVersion, "0.35.4");
assert.equal(blockers.blockers.mediaRuntimePath.hiddenPathDependency, false);
assert.equal(clean.explicitMediaRuntimeWithoutFfmpegInPath, "PASSED");
assert.equal(functional.isolatedPublicCandidate.liveCleanCloneRepeats.passed, 3);
for (const field of ["remainingTemp", "remainingWorkers", "remainingPorts", "reachableCritical", "reachableHigh", "unresolvedLicense", "unknownNativeProvenance", "wrongOwnership"]) assert.equal(decision[field], 0, `${field}_must_be_zero`);
assert.equal(advisory.reachabilityDecision.reachableCritical, 0);
assert.equal(advisory.reachabilityDecision.reachableHigh, 0);
assert.equal(privacy.publicArchive.secretMatches, 0);
assert.equal(privacy.publicArchive.personalPathMatches, 0);
assert.equal(asvs.releaseDecision, "TANCMARK_FINAL_PRE_RELEASE_AUDIT_PASSED");
assert.equal(ssdf.releaseDecision, "TANCMARK_FINAL_PRE_RELEASE_AUDIT_PASSED");
assert.match(auditNarrative, /GEÇTİ.*GitHub gönderim incelemesine hazır/i);

// The V4 dependency figures are preserved measurements, never current V6 authority.
assert.equal(v4Supply.dependencyPackageCount, 1145);
assert.equal(v4Supply.declaredLicenseFound, 1144);
assert.equal(v4Supply.documentedSourceLicenseEvidence, 1);
assert.equal(v4Supply.unresolvedLicense, 0);
assert.equal(historicalFinal.historical, true);
assert.equal(historicalFinal.currentReleaseAuthority, false);
assert.equal(historicalFinal.scope, "PRE_TOOLCHAIN_V6");
assert.equal(historicalFinal.supersededBy, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260831.json");
assert.equal(toolchainHistory.historicalDependencyInventoryClassification, "HISTORICAL_PRE_TOOLCHAIN_V6_MEASUREMENT");
assert.equal(toolchainHistory.currentReleaseAuthority, false);

// V6 is the only current toolchain/license authority.
assert.equal(currentFinal.historical, false);
assert.equal(currentFinal.currentReleaseAuthority, true);
assert.equal(currentFinal.productEvidenceAuthority, "V4_BEHAVIOUR_EVIDENCE_CARRIED_FORWARD_BY_V8_SECURITY_CLOSURE_V12_PLATFORM_REGRESSION_AND_V13_SECURITY_REMEDIATION_REGRESSION");
assert.equal(currentFinal.toolchainEvidenceAuthority, "V6_BASE_CARRIED_FORWARD_BY_V13_SECURITY_REMEDIATION_CURRENT");
assert.equal(currentFinal.currentReleaseStatus, "TANCMARK_GITHUB_PUBLIC_RELEASE_READY_WITH_EXPERIMENTAL_LOCAL_DEMO_20260903");
assert.equal(currentFinal.releaseScope.productReleaseReady, true);
assert.equal(currentFinal.releaseScope.hostedCodespacesDemoAvailable, false);
assert.equal(currentFinal.releaseScope.hostedDemoReleaseGateRequired, false);
assert.equal(currentFinal.releaseScope.localDemoClassification, "EXPERIMENTAL_LOCAL_DEMO");
assert.equal(currentFinal.releaseScope.localDockerDemoEvidencePreserved, true);
for (const field of ["codespacesBadgePublished", "codespacesQuickstartPublished", "paidPrebuildEnabled", "productEngineChangedByHostedDemoWithdrawal", "publicApiBehaviorChanged", "dependencyGraphChanged", "lockfileChanged"]) {
  assert.equal(currentFinal.releaseScope[field], false, `release_scope_expected_false:${field}`);
}
assert.equal(formerV12Final.historical, true);
assert.equal(formerV12Final.currentReleaseAuthority, false);
assert.equal(formerV12Final.supersededBy, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json");
assert.equal(formerV12Final.currentReleaseStatus, "TANCMARK_GITHUB_PUBLIC_RELEASE_WITH_FULL_SECURE_DEMO_V12");
assert.equal(preservedV12Final.currentReleaseStatus, "TANCMARK_GITHUB_PUBLIC_RELEASE_WITH_FULL_SECURE_DEMO_V12");
assert.equal(sha256(path.join(root, "reports/history/PUBLIC_FINAL_RELEASE_RESULT_FULL_SECURE_DEMO_V12_20260831.json")), "9d97985e9a20dd457d1a9397170ddd15007c9b15a60d6c6b48e976c2c37082a6");
assert.equal(currentFinal.historicalDemoEvidence.byteExactCopySha256, "9d97985e9a20dd457d1a9397170ddd15007c9b15a60d6c6b48e976c2c37082a6");
assert.equal(hostedDemoStatus.status, "GITHUB_CODESPACES_HOSTED_DEMO_CURRENTLY_UNAVAILABLE");
assert.equal(hostedDemoStatus.releaseGateRequired, false);
assert.equal(hostedDemoStatus.localDemoClassification, "EXPERIMENTAL_LOCAL_DEMO");
assert.equal(hostedDemoStatus.paidPrebuildEnabled, false);
assert.equal(currentFinal.validatedProductCode.reconciliationChangedProductCode, true);
assert.equal(currentFinal.validatedProductCode.authorizedSecurityBoundarySourceChanged, true);
assert.equal(currentFinal.validatedProductCode.designatedSecurityBoundaryFileCount, 15);
assert.equal(currentFinal.validatedProductCode.productEngineSourceChanged, true);
assert.equal(currentFinal.validatedProductCode.watermarkAlgorithmOrThresholdChanged, false);
assert.equal(currentFinal.requiredOutcomes.wrongOwnership, 0);
assert.equal(currentFinal.requiredOutcomes.currentDependencyCountContradiction, 0);
assert.equal(currentFinal.requiredOutcomes.currentLicenseCountContradiction, 0);
assert.equal(currentFinal.requiredOutcomes.historicalReportPresentedAsCurrent, 0);
assert.equal(currentFinal.c2pa.coreContract, "18/18 PASSED");
assert.equal(currentFinal.c2pa.archiveNegativeTests, "33/33 PASSED");
assert.equal(currentFinal.c2pa.c2paCanOpenVault, false);

const expectedInventory = {
  dependencyPackageCount: 1115,
  javascriptDependencyPackageCount: 604,
  nativeRustDependencyPackageCount: 511,
  declaredLicensePackageCount: 1115,
  documentedSourceLicenseResolutionCount: 0,
  unresolvedLicenseCount: 0,
};
for (const [field, expected] of Object.entries(expectedInventory)) {
  assert.equal(currentFinal.currentInventory[field], expected, `current_final_inventory_mismatch:${field}`);
  assert.equal(currentLicense[field], expected, `current_license_inventory_mismatch:${field}`);
}
assert.equal(currentFinal.currentInventory.packageManager, "pnpm@10.34.5");
assert.equal(currentFinal.currentInventory.unzipper, "0.12.5");
assert.equal(toolchain.currentReleaseAuthority, true);
assert.equal(toolchain.packageManager.after, "pnpm@10.34.5");
assert.equal(toolchain.packageManager.selectedVersionCriticalHighCount, 0);
assert.equal(toolchain.unzipper.after, "0.12.5");
assert.equal(toolchain.unzipper.selectedVersionAffectingGitHubDatabaseCount, 0);
assert.equal(toolchain.archiveReader.maliciousArchiveNegativeCases, 33);
assert.equal(toolchain.safety.c2paCanOpenVault, false);
assert.equal(toolchain.safety.productEngineSourceChanged, false);
assert.equal(toolchain.safety.wrongOwnership, 0);
assert.equal(currentLicense.legalApprovalClaimed, false);

assert.equal(currentFinal.productEvidenceChain.aggregateExactMatchAtV6Closure, true);
assert.equal(currentFinal.productEvidenceChain.v4ProductSourceAggregateSha256, actionPin.product.productSourceAggregateSha256Before);
assert.equal(currentFinal.productEvidenceChain.v6ProductSourceAggregateSha256, actionPin.product.productSourceAggregateSha256After);
assert.equal(actionPin.product.productSourceChanged, false);
assert.equal(toolchain.productTrees.allMatchBaseline, true);
for (const [field, objectId] of Object.entries(currentFinal.productEvidenceChain.v6ExactGitTreeObjects)) {
  assert.equal(toolchain.productTrees[field], objectId, `toolchain_product_tree_mismatch:${field}`);
}
for (const record of currentFinal.v4ProductEvidenceHashes) {
  assert.equal(sha256(path.join(root, record.path)), record.sha256, `v4_product_evidence_sha_mismatch:${record.path}`);
}

assert.equal(securityClosure.findings["V7-SEC-001"].status, "FIXED_AND_REGRESSION_TESTED");
assert.equal(securityClosure.findings["V7-SEC-002"].status, "PRODUCT_RSA_PSS_DISABLED_AND_VERIFIED");
assert.equal(securityClosure.frozenAudit.criteriaChanged, false);
assert.equal(securityClosure.frozenAudit.fixturesThresholdsAttacksOrDecisionRulesChanged, false);
assert.equal(securityClosure.releaseDecision.releaseBlockersRemaining, 0);
assert.equal(securityClosure.releaseDecision.knownReleaseBlockersRemaining, 0);
assert.equal(securityClosure.releaseDecision.status, "TANCMARK_GITHUB_PUBLIC_RELEASE_WITH_FULL_SECURE_DEMO_V12");
for (const field of ["anonymousCanonicalSealAccepted", "callerSelectedIdentityAccepted", "nullTenantCanonicalWrites", "crossTenantAnchorOverwrite", "crossTenantLeak", "forgedAuditActor", "registrySignatureBypass", "wrongOwnership", "privateKeyDisclosure", "deniedRequestsReachedCanonicalWrites"]) {
  assert.equal(securityClosure.requiredOutcomes[field], 0, `security_closure_nonzero:${field}`);
}
assert.equal(securityClosure.requiredOutcomes.c2paCanOpenVault, false);
for (const record of securityClosure.protectedComponentGitObjects) {
  assert.equal(record.v7, record.v8, `protected_component_changed:${record.path}`);
}

assert.equal(demoPlatformClosure.status, "PASSED");
assert.equal(demoPlatformClosure.scope, "CODESPACES_LINUX_DEMO_PROFILE_V1");
for (const [field, expected] of Object.entries({
  watermarkAlgorithmChanged: false,
  decisionThresholdChanged: false,
  idRuleChanged: false,
  ownershipRuleChanged: false,
  registryOrSignatureAuthorityChanged: false,
  dnaOrChiefBrainDecisionChanged: false,
  windowsCanonicalRuntimeSelectedByDefault: true,
  linuxProfileRequiresLinuxAndDemoOnly: true,
  wrongOwnership: 0,
  productionVaultOpenedByDemo: 0,
})) {
  assert.equal(demoPlatformClosure.invariants[field], expected, `v12_demo_invariant_mismatch:${field}`);
}
assert.equal(demoPlatformClosure.windowsRegressionEvidence.status, "PASSED");
assert.equal(demoPlatformClosure.windowsRegressionEvidence.gatesPassed, "13/13");
const v8ProtectedByPath = new Map(securityClosure.protectedComponentGitObjects.map((record) => [record.path, record.v8]));
for (const record of demoPlatformClosure.changedProtectedComponents) {
  assert.equal(record.beforeGitTree, v8ProtectedByPath.get(record.path), `v12_demo_before_tree_mismatch:${record.path}`);
  assert.notEqual(record.afterGitTree, record.beforeGitTree, `v12_demo_changed_tree_not_changed:${record.path}`);
}
for (const record of demoPlatformClosure.unchangedProtectedComponents) {
  assert.equal(record.gitObject, v8ProtectedByPath.get(record.path), `v12_demo_unchanged_tree_mismatch:${record.path}`);
}
assert.equal(securityRemediation.status, "CODEQL_AND_DEPENDENCY_GATES_PASSED");
assert.equal(securityRemediation.historicalProductEvidencePreserved, true);
assert.equal(securityRemediation.measurements.dependencyAuditCritical, 0);
assert.equal(securityRemediation.measurements.dependencyAuditHigh, 0);
assert.equal(securityRemediation.measurements.codeqlUnsuppressedResults, 0);
assert.equal(securityRemediation.measurements.codeqlPotentialResults, securityRemediation.measurements.codeqlInSourceSuppressedWithRationale);
assert.equal(securityRemediationWindows.status, "PASSED");
assert.equal(securityRemediationWindows.gates.length, 13);
assert.equal(securityRemediationWindows.gates.every((gate) => gate.status === "PASSED" && gate.exitCode === 0), true);
assert.equal(securityRemediationWindows.failedGates.length, 0);
assert.equal(securityRemediationWindows.repositoryHeadChanged, false);
assert.equal(securityRemediationWindows.trackedAndUntrackedStatusChangedByTests, false);
assert.equal(sha256(path.join(root, securityRemediation.windowsCanonicalRegressionV13.path)), securityRemediation.windowsCanonicalRegressionV13.sha256);
assert.equal(securityRemediation.windowsCanonicalRegressionV13.gatesPassed, "13/13");
assert.equal(securityRemediation.windowsCanonicalRegressionV13.status, "PASSED");
assert.equal(securityRemediationLinuxDemo.status, "PASSED");
assert.equal(securityRemediationLinuxDemo.repeats.requested, 3);
assert.equal(securityRemediationLinuxDemo.repeats.completed, 3);
for (const field of ["functionalPassed", "sourceSecurityPassed", "c2paPassed", "livePassed"]) {
  assert.equal(securityRemediationLinuxDemo.repeats[field], 3, `v13_linux_demo_repeat_mismatch:${field}`);
}
for (const field of ["wrongOwnership", "productionOwnership", "productionVault"]) {
  assert.equal(securityRemediationLinuxDemo.invariants[field], 0, `v13_linux_demo_security_outcome_nonzero:${field}`);
}
assert.equal(securityRemediationLinuxDemo.liveMeasurements.droppedFramesTotal, 0);
assert.equal(securityRemediationLinuxDemo.liveMeasurements.remainingWorkersAfterEachRun, 0);
assert.equal(securityRemediationLinuxDemo.liveMeasurements.remainingPortsAfterEachRun, 0);
assert.equal(securityRemediationLinuxDemo.liveMeasurements.remainingTemporaryDirectoriesAfterEachRun, 0);
assert.equal(securityRemediationLinuxDemo.browserVisibility.status, "NOT_MEASURED_BY_THIS_TERMINAL_RETEST");
assert.equal(sha256(path.join(root, securityRemediation.codespacesLinuxDemoRegressionV13.path)), securityRemediation.codespacesLinuxDemoRegressionV13.sha256);
assert.equal(securityRemediation.codespacesLinuxDemoRegressionV13.status, "PASSED");
const v13HashContinuityByPath = new Map(securityRemediation.historicalHashContinuity.map((record) => [record.path, record]));
const v13ChangedFileByPath = new Map(securityRemediation.currentChangedFiles.map((record) => [record.path, record]));
for (const record of demoPlatformClosure.changedFiles) {
  const actualSha256 = sha256(path.join(root, record.path));
  if (actualSha256 === record.afterSha256) continue;
  const continuity = v13HashContinuityByPath.get(record.path);
  assert.ok(continuity, `v12_demo_file_changed_without_v13_continuity:${record.path}`);
  assert.equal(continuity.v12Sha256, record.afterSha256, `v13_continuity_base_mismatch:${record.path}`);
  assert.equal(actualSha256, continuity.v13Sha256, `v13_remediated_file_sha_mismatch:${record.path}`);
  assert.equal(continuity.changeClassification, "CODEQL_FALSE_POSITIVE_RATIONALE_COMMENT_ONLY", `v13_continuity_classification_mismatch:${record.path}`);
}
for (const record of securityRemediation.realSourceFixes) {
  assert.equal(sha256(path.join(root, record.path)), record.afterSha256, `v13_real_fix_sha_mismatch:${record.path}`);
}
for (const record of securityRemediation.currentChangedFiles) {
  assert.equal(sha256(path.join(root, record.path)), record.sha256, `v13_changed_file_sha_mismatch:${record.path}`);
}

// In a checkout, bind current claims to the actual Git tree. A git-archive has no
// object database, so archive verification is delegated to exact SHA256SUMS/manifest gates.
let gitTreeChecked = false;
try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore", windowsHide: true });
  for (const record of demoPlatformClosure.unchangedProtectedComponents) {
    const hasV13Change = securityRemediation.currentChangedFiles.some((changed) => changed.path === record.path || changed.path.startsWith(`${record.path}/`));
    if (hasV13Change) continue;
    const actual = execFileSync("git", ["rev-parse", `HEAD:${record.path}`], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
    assert.equal(actual, record.gitObject, `current_git_unchanged_component_mismatch:${record.path}`);
  }
  const changedPaths = new Set(demoPlatformClosure.changedFiles.map((record) => record.path));
  for (const record of demoPlatformClosure.changedProtectedComponents) {
    const hasV13Change = securityRemediation.currentChangedFiles.some((changed) => changed.path === record.path || changed.path.startsWith(`${record.path}/`));
    if (hasV13Change) continue;
    const actual = execFileSync("git", ["rev-parse", `HEAD:${record.path}`], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
    if (actual === record.beforeGitTree) {
      const worktreeChanges = execFileSync("git", ["diff", "HEAD", "--name-only", "--", record.path], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      }).split(/\r?\n/u).filter(Boolean);
      assert(worktreeChanges.length > 0, `v12_demo_staged_component_missing:${record.path}`);
      for (const changedPath of worktreeChanges) {
        assert(changedPaths.has(changedPath), `v12_demo_unrecorded_component_change:${changedPath}`);
      }
    } else {
      assert.equal(actual, record.afterGitTree, `current_git_v12_component_mismatch:${record.path}`);
    }
  }
  for (const record of demoPlatformClosure.changedFiles) {
    const actualBlob = execFileSync("git", ["hash-object", "--", record.path], { cwd: root, encoding: "utf8", windowsHide: true }).trim();
    if (v13ChangedFileByPath.has(record.path)) {
      assert.notEqual(actualBlob, record.afterGitBlob, `current_git_v13_file_blob_not_changed:${record.path}`);
    } else {
      assert.equal(actualBlob, record.afterGitBlob, `current_git_v12_file_blob_mismatch:${record.path}`);
    }
  }
  gitTreeChecked = true;
} catch (error) {
  if (fs.existsSync(path.join(root, ".git"))) throw error;
}

for (const record of v3History.preservedFiles) {
  assert.equal(sha256(path.join(evidenceRoot, "history/v3", record.path)), record.preservedSha256, `historical_sha_mismatch:${record.path}`);
}
for (const record of historicalPublic.reports) {
  assert.equal(record.historical, true, `historical_public_flag_missing:${record.path}`);
  assert.equal(sha256(path.join(root, record.path)), record.preservedSha256, `historical_public_sha_mismatch:${record.path}`);
}

const currentAuthorityText = [currentFinal, currentLicense, toolchain, securityClosure].map((value) => JSON.stringify(value)).join("\n");
assert.equal(/1145_TOTAL|1144_DECLARED|"dependencyPackageCount":1145/.test(currentAuthorityText.replaceAll(" ", "")), false, "historical_v4_inventory_leaked_into_current_authority");

process.stdout.write(`${JSON.stringify({
  gate: "FINAL_AUDIT_EVIDENCE_CONSISTENCY_GATE_EXPERIMENTAL_LOCAL_DEMO_CURRENT",
  status: "PASSED",
  productEvidenceAuthority: currentFinal.productEvidenceAuthority,
  toolchainEvidenceAuthority: currentFinal.toolchainEvidenceAuthority,
  dependencyInventory: "1115_TOTAL_604_JAVASCRIPT_511_NATIVE_RUST",
  declaredLicensePackageCount: 1115,
  unresolvedLicense: 0,
  historicalV4DependencyInventoryClassification: "HISTORICAL_PRE_TOOLCHAIN_V6_MEASUREMENT",
  productTreeCheckedAgainstGit: gitTreeChecked,
  productSourceChanged: true,
  productEngineSourceChangedByDemoPlatformAdapter: true,
  productEngineSourceChangedByV13SecurityRemediation: true,
  watermarkAlgorithmChangedByDemo: false,
  decisionThresholdChangedByDemo: false,
  designatedSecurityBoundaryFileCount: 15,
  v7Sec001: securityClosure.findings["V7-SEC-001"].status,
  v7Sec002: securityClosure.findings["V7-SEC-002"].status,
  wrongOwnership: 0,
  v13WindowsCanonicalRegression: "13/13 PASSED",
  v13CodespacesLinuxDemoRegression: "3/3 PASSED",
  v13BrowserVisibilityRemeasurement: securityRemediationLinuxDemo.browserVisibility.status,
  v13CodeqlUnsuppressed: securityRemediation.measurements.codeqlUnsuppressedResults,
  v13DependencyAuditHighCritical: securityRemediation.measurements.dependencyAuditHigh + securityRemediation.measurements.dependencyAuditCritical,
  contradictions: 0,
}, null, 2)}\n`);

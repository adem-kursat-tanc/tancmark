// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const READY = "TANCMARK_GITHUB_PUBLIC_RELEASE_READY_WITH_EXPERIMENTAL_LOCAL_DEMO_20260903";
const STALE_HOSTED_DEMO_STATUS = "TANCMARK_GITHUB_PUBLIC_RELEASE_WITH_FULL_SECURE_DEMO_V12";
const LIVE_CLOSED = "TANCMARK_LIVE_REPEATABILITY_GAP_CLOSED";
const FORBIDDEN_CURRENT_PHRASES = [
  "owner-push-ready status is withheld",
  "final exact-verification gate was not repeatable",
  "one disclosed local release gap blocks",
  "TANCMARK_ONE_PROVEN_LOCAL_RELEASE_GAP_REMAINS",
];

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function sha256(root, relativePath) {
  return createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

export function loadReleaseStateDocuments(root = DEFAULT_ROOT, privateLedgerPath = process.env.TANCMARK_PRIVATE_SECURITY_RECONCILIATION) {
  const documents = {
    readme: readText(root, "README.md"),
    featureStatus: readText(root, "docs/FEATURE_STATUS.md"),
    changelog: readText(root, "CHANGELOG.md"),
    finalRelease: readJson(root, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json"),
    formerV12FinalRelease: readJson(root, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260831.json"),
    preservedV12FinalRelease: readJson(root, "reports/history/PUBLIC_FINAL_RELEASE_RESULT_FULL_SECURE_DEMO_V12_20260831.json"),
    preservedV12FinalReleaseSha256: sha256(root, "reports/history/PUBLIC_FINAL_RELEASE_RESULT_FULL_SECURE_DEMO_V12_20260831.json"),
    hostedDemoStatus: readJson(root, "reports/GITHUB_CODESPACES_HOSTED_DEMO_STATUS_20260902.json"),
    securityBoundaryClosure: readJson(root, "reports/PUBLIC_V7_SECURITY_BOUNDARY_CLOSURE_20260901.json"),
    securityRemediation: readJson(root, "reports/PUBLIC_V13_SECURITY_REMEDIATION_CLOSURE_20260902.json"),
    historicalFinalRelease: readJson(root, "reports/PUBLIC_FINAL_RELEASE_RESULT_20260829.json"),
    currentLicense: readJson(root, "reports/PUBLIC_LICENSE_SCAN.json"),
    currentToolchain: readJson(root, "reports/TOOLCHAIN_SUPPLY_CHAIN_CLOSURE_20260831.json"),
    toolchainHistory: readJson(root, "reports/TOOLCHAIN_HISTORICAL_RECORD_METADATA_20260831.json"),
    liveRepeatability: readJson(root, "reports/PUBLIC_CLEAN_CLONE_LIVE_REPEATABILITY_RESULT_20260828.json"),
    debt: readJson(root, "reports/TANCMARK_FINAL_RELEASE_DEBT_RECONCILIATION.json"),
    publicExclusions: readText(root, "docs/PUBLIC_EXCLUSIONS_SUMMARY.md"),
    publicSecurityReconciliation: readJson(root, "reports/PUBLIC_SECURITY_EXCLUSION_RECONCILIATION_20260829.json"),
    security: readText(root, "SECURITY.md"),
    githubChecklist: readText(root, "docs/GITHUB_POST_CREATE_SECURITY_CHECKLIST.md"),
    privateSecurityReconciliation: null,
  };
  if (privateLedgerPath) {
    if (!path.isAbsolute(privateLedgerPath)) throw new Error("private_security_reconciliation_path_must_be_absolute");
    documents.privateSecurityReconciliation = JSON.parse(fs.readFileSync(privateLedgerPath, "utf8"));
  }
  return documents;
}

export function evaluateReleaseStateDocuments(documents) {
  const failures = [];
  const fail = (code) => failures.push(code);
  const live = documents.liveRepeatability;
  if (live?.releaseDecision?.repeatabilityGapClosed !== true) fail("LIVE_REPEATABILITY_GAP_NOT_CLOSED");
  if (live?.releaseDecision?.ownerPushReady !== true) fail("LIVE_OWNER_PUSH_READY_FALSE");
  if (live?.releaseDecision?.ownerAcceptedThreeOfThreeFrozenRuns !== true) fail("LIVE_OWNER_ACCEPTED_3_OF_3_FALSE");
  if (live?.qualifyingConsecutivePasses !== 3) fail("LIVE_QUALIFYING_RUN_COUNT_NOT_3");
  if (live?.finalStatus !== LIVE_CLOSED) fail("LIVE_FINAL_STATUS_MISMATCH");

  if (!documents.featureStatus.includes("| Local protected Live | IMPLEMENTED_AND_TESTED |")) fail("FEATURE_STATUS_LIVE_NOT_IMPLEMENTED_AND_TESTED");
  if (documents.featureStatus.includes("IMPLEMENTED_AND_TESTED_WITH_RELEASE_GATE_GAP")) fail("FEATURE_STATUS_STALE_LIVE_GAP");
  if (!documents.featureStatus.includes("repeatability gate 3/3")) fail("FEATURE_STATUS_MISSING_3_OF_3");
  if (!documents.featureStatus.includes("non-blocking historical evidence limit")) fail("FEATURE_STATUS_MISSING_HISTORICAL_LIMIT");
  if (!documents.featureStatus.includes("| Experimental local demo | EXPERIMENTAL_LOCAL_DEMO |")) fail("FEATURE_STATUS_EXPERIMENTAL_LOCAL_DEMO_MISSING");

  const changelogLower = documents.changelog.toLowerCase();
  if (!changelogLower.includes("first two historical")) fail("CHANGELOG_MISSING_HISTORICAL_FAILURES");
  if (!changelogLower.includes("lifecycle") || !documents.changelog.includes("3/3")) fail("CHANGELOG_MISSING_LIFECYCLE_3_OF_3_CLOSURE");
  if (!changelogLower.includes("non-blocking historical evidence limit")) fail("CHANGELOG_MISSING_NON_BLOCKING_LIMIT");

  if (documents.finalRelease?.currentReleaseStatus !== READY) fail("FINAL_RELEASE_STATUS_MISMATCH");
  if (JSON.stringify(documents.finalRelease).includes(STALE_HOSTED_DEMO_STATUS)) fail("FAIL_STALE_HOSTED_DEMO_STATUS");
  if (documents.finalRelease?.currentReleaseAuthority !== true || documents.finalRelease?.historical !== false) fail("FINAL_RELEASE_CURRENT_AUTHORITY_MISMATCH");
  const releaseScope = documents.finalRelease?.releaseScope ?? {};
  if (releaseScope.productReleaseReady !== true) fail("PRODUCT_RELEASE_READY_FALSE");
  if (releaseScope.hostedCodespacesDemoAvailable !== false) fail("HOSTED_CODESPACES_DEMO_AVAILABILITY_MISMATCH");
  if (releaseScope.hostedDemoReleaseGateRequired !== false) fail("HOSTED_DEMO_RELEASE_GATE_REQUIRED");
  if (releaseScope.localDemoClassification !== "EXPERIMENTAL_LOCAL_DEMO") fail("LOCAL_DEMO_CLASSIFICATION_MISMATCH");
  if (releaseScope.localDockerDemoEvidencePreserved !== true) fail("LOCAL_DOCKER_DEMO_EVIDENCE_NOT_PRESERVED");
  for (const field of ["codespacesBadgePublished", "codespacesQuickstartPublished", "paidPrebuildEnabled", "productEngineChangedByHostedDemoWithdrawal", "publicApiBehaviorChanged", "dependencyGraphChanged", "lockfileChanged"]) {
    if (releaseScope[field] !== false) fail(`RELEASE_SCOPE_EXPECTED_FALSE_${field.toUpperCase()}`);
  }
  if (documents.hostedDemoStatus?.status !== "GITHUB_CODESPACES_HOSTED_DEMO_CURRENTLY_UNAVAILABLE") fail("HOSTED_DEMO_STATUS_MISMATCH");
  if (documents.hostedDemoStatus?.releaseGateRequired !== false) fail("HOSTED_DEMO_STATUS_GATE_REQUIRED");
  if (documents.hostedDemoStatus?.localDemoClassification !== "EXPERIMENTAL_LOCAL_DEMO") fail("HOSTED_DEMO_LOCAL_CLASSIFICATION_MISMATCH");
  if (documents.hostedDemoStatus?.paidPrebuildEnabled !== false || documents.hostedDemoStatus?.codespacesBadgePublished !== false || documents.hostedDemoStatus?.codespacesQuickstartPublished !== false) fail("HOSTED_DEMO_PUBLICATION_BOUNDARY_MISMATCH");
  if (!documents.readme.includes("GitHub Codespaces hosted demo currently unavailable")) fail("README_HOSTED_DEMO_UNAVAILABLE_MISSING");
  if (/codespaces\.new/iu.test(documents.readme)) fail("README_CODESPACES_NEW_LINK_PRESENT");
  if (/github\.com\/codespaces\/badge\.svg|open in github codespaces/iu.test(documents.readme)) fail("README_CODESPACES_BADGE_PRESENT");
  if (documents.finalRelease?.productEvidenceAuthority !== "V4_BEHAVIOUR_EVIDENCE_CARRIED_FORWARD_BY_V8_SECURITY_CLOSURE_V12_PLATFORM_REGRESSION_AND_V13_SECURITY_REMEDIATION_REGRESSION") fail("PRODUCT_EVIDENCE_AUTHORITY_MISMATCH");
  if (documents.finalRelease?.toolchainEvidenceAuthority !== "V6_BASE_CARRIED_FORWARD_BY_V13_SECURITY_REMEDIATION_CURRENT") fail("TOOLCHAIN_EVIDENCE_AUTHORITY_MISMATCH");
  if (documents.finalRelease?.validatedProductCode?.reconciliationChangedProductCode !== true) fail("PRODUCT_CODE_CHANGE_BOUNDARY_MISMATCH");
  if (documents.finalRelease?.validatedProductCode?.authorizedSecurityBoundarySourceChanged !== true) fail("AUTHORIZED_SECURITY_BOUNDARY_CHANGE_MISSING");
  if (documents.finalRelease?.validatedProductCode?.designatedSecurityBoundaryFileCount !== 15) fail("DESIGNATED_SECURITY_FILE_COUNT_MISMATCH");
  if (documents.finalRelease?.validatedProductCode?.productEngineSourceChanged !== true || documents.finalRelease?.validatedProductCode?.watermarkAlgorithmOrThresholdChanged !== false) fail("PRODUCT_ENGINE_CHANGE_BOUNDARY_MISMATCH");
  if (documents.finalRelease?.fullSecureDemoV12?.functionalRuns !== "3/3 PASSED" || documents.finalRelease?.fullSecureDemoV12?.browserRuns !== "3/3 PASSED" || documents.finalRelease?.fullSecureDemoV12?.c2paRuns !== "3/3 PASSED") fail("V12_DEMO_REPEATABILITY_MISMATCH");
  if (documents.finalRelease?.fullSecureDemoV12?.httpSecurityChecks !== "45/45 PASSED" || documents.finalRelease?.fullSecureDemoV12?.windowsCanonicalTargetedRegression !== "13/13 PASSED") fail("V12_DEMO_GATE_SUMMARY_MISMATCH");
  if (documents.finalRelease?.fullSecureDemoV12?.wrongOwnership !== 0 || documents.finalRelease?.fullSecureDemoV12?.productionVaultOpenedByDemo !== 0) fail("V12_DEMO_SECURITY_OUTCOME_NONZERO");
  if (documents.securityRemediation?.status !== "CODEQL_AND_DEPENDENCY_GATES_PASSED") fail("V13_SECURITY_REMEDIATION_STATUS_MISMATCH");
  if (documents.securityRemediation?.measurements?.codeqlUnsuppressedResults !== 0) fail("V13_CODEQL_UNSUPPRESSED_NONZERO");
  if (documents.securityRemediation?.measurements?.dependencyAuditHigh !== 0 || documents.securityRemediation?.measurements?.dependencyAuditCritical !== 0) fail("V13_DEPENDENCY_HIGH_CRITICAL_NONZERO");
  if (documents.securityRemediation?.windowsCanonicalRegressionV13?.gatesPassed !== "13/13" || documents.securityRemediation?.codespacesLinuxDemoRegressionV13?.functionalRuns !== "3/3 PASSED") fail("V13_REGRESSION_EVIDENCE_MISMATCH");
  if (documents.finalRelease?.packageIntegrity?.sourceManifestExact !== true || documents.finalRelease?.packageIntegrity?.sha256sumExact !== true || documents.finalRelease?.packageIntegrity?.failed !== 0) fail("FINAL_PACKAGE_INTEGRITY_NOT_EXACT");
  const requiredOutcomes = documents.finalRelease?.requiredOutcomes ?? {};
  for (const field of ["wrongOwnership", "crossTenantLeak", "secretDisclosure", "privateMediaDisclosure", "privateFingerprintDisclosure", "learningDataDisclosure", "releaseStateContradiction", "unresolvedReachableSecurityDetail"]) {
    if (requiredOutcomes[field] !== 0) fail(`FINAL_REQUIRED_OUTCOME_NONZERO_${field.toUpperCase()}`);
  }
  const closure = documents.securityBoundaryClosure;
  if (closure?.findings?.["V7-SEC-001"]?.status !== "FIXED_AND_REGRESSION_TESTED") fail("V7_SEC_001_NOT_CLOSED");
  if (closure?.findings?.["V7-SEC-002"]?.status !== "PRODUCT_RSA_PSS_DISABLED_AND_VERIFIED") fail("V7_SEC_002_NOT_CLOSED");
  if (closure?.frozenAudit?.criteriaChanged !== false || closure?.frozenAudit?.fixturesThresholdsAttacksOrDecisionRulesChanged !== false) fail("FROZEN_V7_PLAN_CHANGED");
  for (const field of ["anonymousCanonicalSealAccepted", "callerSelectedIdentityAccepted", "nullTenantCanonicalWrites", "crossTenantAnchorOverwrite", "crossTenantLeak", "forgedAuditActor", "registrySignatureBypass", "wrongOwnership", "privateKeyDisclosure", "deniedRequestsReachedCanonicalWrites"]) {
    if (closure?.requiredOutcomes?.[field] !== 0) fail(`SECURITY_CLOSURE_OUTCOME_NONZERO_${field.toUpperCase()}`);
  }
  if (closure?.requiredOutcomes?.c2paCanOpenVault !== false) fail("SECURITY_CLOSURE_C2PA_VAULT_TRUE");
  if (closure?.releaseDecision?.releaseBlockersRemaining !== 0) fail("SECURITY_CLOSURE_RELEASE_DECISION_MISMATCH");

  const expectedInventory = {
    dependencyPackageCount: 1115,
    javascriptDependencyPackageCount: 604,
    nativeRustDependencyPackageCount: 511,
    declaredLicensePackageCount: 1115,
    documentedSourceLicenseResolutionCount: 0,
    unresolvedLicenseCount: 0,
  };
  for (const [field, expected] of Object.entries(expectedInventory)) {
    if (documents.finalRelease?.currentInventory?.[field] !== expected) fail(`FINAL_CURRENT_INVENTORY_MISMATCH_${field.toUpperCase()}`);
    if (documents.currentLicense?.[field] !== expected) fail(`LICENSE_CURRENT_INVENTORY_MISMATCH_${field.toUpperCase()}`);
  }
  if (documents.finalRelease?.currentInventory?.packageManager !== "pnpm@10.34.5") fail("FINAL_PACKAGE_MANAGER_VERSION_MISMATCH");
  if (documents.finalRelease?.currentInventory?.unzipper !== "0.12.5") fail("FINAL_UNZIPPER_VERSION_MISMATCH");
  if (documents.currentToolchain?.currentReleaseAuthority !== true) fail("TOOLCHAIN_CURRENT_AUTHORITY_MISMATCH");
  if (documents.currentToolchain?.packageManager?.after !== "pnpm@10.34.5") fail("TOOLCHAIN_PACKAGE_MANAGER_VERSION_MISMATCH");
  if (documents.currentToolchain?.unzipper?.after !== "0.12.5") fail("TOOLCHAIN_UNZIPPER_VERSION_MISMATCH");
  if (documents.currentToolchain?.packageManager?.selectedVersionCriticalHighCount !== 0) fail("TOOLCHAIN_SELECTED_CRITICAL_HIGH_NONZERO");
  if (documents.currentToolchain?.unzipper?.selectedVersionAffectingGitHubDatabaseCount !== 0) fail("UNZIPPER_SELECTED_ADVISORY_NONZERO");
  if (documents.currentToolchain?.productTrees?.allMatchBaseline !== true) fail("TOOLCHAIN_PRODUCT_TREE_MISMATCH");
  if (documents.currentLicense?.legalApprovalClaimed !== false) fail("LICENSE_LEGAL_APPROVAL_CLAIMED");
  if (documents.historicalFinalRelease?.historical !== true || documents.historicalFinalRelease?.currentReleaseAuthority !== false) fail("PRE_V6_FINAL_REPORT_NOT_HISTORICAL");
  if (documents.historicalFinalRelease?.scope !== "PRE_TOOLCHAIN_V6") fail("PRE_V6_FINAL_REPORT_SCOPE_MISMATCH");
  if (documents.historicalFinalRelease?.supersededBy !== "reports/PUBLIC_FINAL_RELEASE_RESULT_20260831.json") fail("PRE_V6_FINAL_REPORT_SUPERSESSION_MISMATCH");
  if (documents.formerV12FinalRelease?.historical !== true || documents.formerV12FinalRelease?.currentReleaseAuthority !== false) fail("V12_FINAL_REPORT_NOT_HISTORICAL");
  if (documents.formerV12FinalRelease?.supersededBy !== "reports/PUBLIC_FINAL_RELEASE_RESULT_20260903.json") fail("V12_FINAL_REPORT_SUPERSESSION_MISMATCH");
  if (documents.formerV12FinalRelease?.currentReleaseStatus !== STALE_HOSTED_DEMO_STATUS) fail("V12_HISTORICAL_STATUS_MISMATCH");
  if (documents.preservedV12FinalRelease?.currentReleaseStatus !== STALE_HOSTED_DEMO_STATUS) fail("V12_PRESERVED_STATUS_MISMATCH");
  if (documents.preservedV12FinalReleaseSha256 !== "9d97985e9a20dd457d1a9397170ddd15007c9b15a60d6c6b48e976c2c37082a6") fail("V12_PRESERVED_SHA256_MISMATCH");
  if (documents.finalRelease?.historicalDemoEvidence?.byteExactCopySha256 !== documents.preservedV12FinalReleaseSha256) fail("V12_RECORDED_SHA256_MISMATCH");
  if (documents.toolchainHistory?.historicalDependencyInventoryClassification !== "HISTORICAL_PRE_TOOLCHAIN_V6_MEASUREMENT") fail("V4_DEPENDENCY_INVENTORY_CLASSIFICATION_MISMATCH");

  if (!Array.isArray(documents.debt?.realLocalReleaseGaps) || documents.debt.realLocalReleaseGaps.length !== 0) fail("DEBT_REAL_LOCAL_RELEASE_GAPS_NOT_EMPTY");
  if (documents.debt?.currentReleaseStatus !== READY) fail("DEBT_RELEASE_STATUS_MISMATCH");
  if (documents.debt?.hostedCodespacesDemo !== "CURRENTLY_UNAVAILABLE_NON_BLOCKING") fail("DEBT_HOSTED_CODESPACES_STATUS_MISMATCH");
  if (documents.debt?.experimentalLocalDemo !== "AVAILABLE_WITH_OPERATOR_CONTROL") fail("DEBT_EXPERIMENTAL_LOCAL_DEMO_STATUS_MISMATCH");
  if (documents.debt?.paidPrebuild !== "NOT_ENABLED_BY_OWNER_DECISION") fail("DEBT_PAID_PREBUILD_STATUS_MISMATCH");
  if (!documents.debt?.items?.some((item) => item.area?.includes("V7-SEC-003") && item.classification === "LOW_NON_BLOCKING_TECHNICAL_DEBT")) fail("DEBT_V7_SEC_003_MISSING");
  if (!documents.debt?.items?.some((item) => item.area?.includes("V7-SEC-004") && item.classification === "LOW_NON_BLOCKING_TECHNICAL_DEBT")) fail("DEBT_V7_SEC_004_MISSING");
  if (documents.debt?.finalLiveRepeatabilityEvidence !== "reports/PUBLIC_CLEAN_CLONE_LIVE_REPEATABILITY_RESULT_20260828.json") fail("DEBT_LIVE_EVIDENCE_MISMATCH");
  if (documents.debt?.finalC2paEvidence !== "reports/C2PA_NEGATIVE_TEST_RESULTS.json") fail("DEBT_C2PA_EVIDENCE_MISMATCH");

  const securityLower = documents.security.toLowerCase();
  const checklistLower = documents.githubChecklist.toLowerCase();
  for (const [name, text] of [["SECURITY", securityLower], ["CHECKLIST", checklistLower]]) {
    if (!text.includes("included codeql advanced setup workflow")) fail(`${name}_MISSING_INCLUDED_CODEQL_ADVANCED_SETUP`);
    if (!text.includes("default setup") || !text.includes("exactly once")) fail(`${name}_MISSING_CODEQL_SINGLE_SETUP_RULE`);
  }
  if (/enable github codeql default setup/i.test(documents.security)) fail("SECURITY_STALE_CODEQL_DEFAULT_SETUP_INSTRUCTION");
  if (!documents.githubChecklist.startsWith("# GitHub Post-Creation Security Checklist\n")) fail("GITHUB_CHECKLIST_TITLE_MISMATCH");

  if (documents.publicSecurityReconciliation?.unresolvedReachableSecurityDetail !== 0) fail("PUBLIC_SECURITY_DETAIL_UNRESOLVED");
  if (documents.publicSecurityReconciliation?.classificationCounts?.REACHABLE_UNRESOLVED_RELEASE_SECURITY_ISSUE !== 0) fail("PUBLIC_REACHABLE_SECURITY_ISSUE_NONZERO");
  if (documents.publicSecurityReconciliation?.classificationCounts?.HISTORICAL_SUPERSEDED !== 1) fail("PUBLIC_HISTORICAL_SUPERSEDED_COUNT_MISMATCH");
  if (!documents.publicExclusions.includes("| Reachable unresolved | 0 |")) fail("PUBLIC_EXCLUSIONS_UNRESOLVED_COUNT_NOT_ZERO");
  if (!documents.publicExclusions.includes("| Historical superseded | 1 |")) fail("PUBLIC_EXCLUSIONS_HISTORICAL_COUNT_MISMATCH");

  if (documents.privateSecurityReconciliation) {
    const privateRecord = documents.privateSecurityReconciliation;
    if (privateRecord.unresolvedReachableSecurityDetail !== 0 || privateRecord.releaseBlocker !== false) fail("PRIVATE_SECURITY_DETAIL_UNRESOLVED");
    if (privateRecord.reviewedRecord?.classification !== "HISTORICAL_SUPERSEDED") fail("PRIVATE_SECURITY_DETAIL_CLASSIFICATION_MISMATCH");
    if (privateRecord.reviewedRecord?.productRuntimeReachable !== false) fail("PRIVATE_SECURITY_DETAIL_RUNTIME_REACHABLE");
  }

  const currentTexts = [
    documents.readme,
    documents.featureStatus,
    documents.changelog,
    JSON.stringify(documents.finalRelease),
    JSON.stringify(documents.securityBoundaryClosure),
    JSON.stringify(documents.currentLicense),
    JSON.stringify(documents.currentToolchain),
    JSON.stringify(documents.liveRepeatability),
    JSON.stringify(documents.debt),
    documents.publicExclusions,
    documents.security,
    documents.githubChecklist,
  ].join("\n").toLowerCase();
  for (const phrase of FORBIDDEN_CURRENT_PHRASES) {
    if (currentTexts.includes(phrase.toLowerCase())) fail(`FORBIDDEN_CURRENT_RELEASE_PHRASE:${phrase}`);
  }

  return {
    gate: "PUBLIC_RELEASE_STATE_CONSISTENCY_GATE",
    status: failures.length === 0 ? "PASSED" : "FAILED",
    failures,
    releaseStateContradiction: failures.length,
    unresolvedReachableSecurityDetail: documents.publicSecurityReconciliation?.unresolvedReachableSecurityDetail ?? null,
    privateOwnerEvidenceChecked: documents.privateSecurityReconciliation !== null,
    currentReleaseStatus: documents.finalRelease?.currentReleaseStatus ?? null,
    currentDependencyPackageCount: documents.currentLicense?.dependencyPackageCount ?? null,
    historicalDependencyInventoryClassification: documents.toolchainHistory?.historicalDependencyInventoryClassification ?? null,
  };
}

export function runReleaseStateConsistencyGate(options = {}) {
  const documents = loadReleaseStateDocuments(options.root ?? DEFAULT_ROOT, options.privateLedgerPath ?? process.env.TANCMARK_PRIVATE_SECURITY_RECONCILIATION);
  const result = evaluateReleaseStateDocuments(documents);
  if (result.failures.length > 0) {
    const error = new Error(`public_release_state_consistency_failed:${result.failures.join(",")}`);
    error.result = result;
    throw error;
  }
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.stdout.write(`${JSON.stringify(runReleaseStateConsistencyGate(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify(error?.result ?? { gate: "PUBLIC_RELEASE_STATE_CONSISTENCY_GATE", status: "FAILED", error: String(error) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

export type LiveExactIdentityAuthorityStatus =
  | "TARGETED_EXPECTED_ID_SUPPORT_ONLY"
  | "EXACT_REGISTRY_CHAIN_VERIFIED_SUPPORT_ONLY"
  | "NOT_FOUND"
  | "MANUAL_REVIEW";

export interface LiveExactIdentityAuthorityInput {
  expectedIdWasSupplied: boolean;
  expectedIdMatched: boolean;
  candidateCount: number;
  registryRecordPresent: boolean;
  registryRecordActive: boolean;
  registryRecordRevoked: boolean;
  registryTenantMatched: boolean;
  signatureVerified: boolean;
  uniqueActiveRecord: boolean;
}

export interface LiveExactIdentityAuthorityResult {
  status: LiveExactIdentityAuthorityStatus;
  verificationMode: "targeted_expected_id_only";
  exactRegistryChainComplete: boolean;
  missingEvidence: string[];
  candidateCount: number;
  expectedIdDisclosedInResponse: false;
  rawDecoderResultSerialized: false;
  supportOnly: true;
  ownership: false;
  vault: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

/**
 * Shapes a protected future integration result without calling or serializing
 * the video reader, registry, signature or ownership engine. This adapter is a
 * fail-safe connection point only.
 */
export function shapeLiveExactIdentityAuthorityResult(
  input: LiveExactIdentityAuthorityInput,
): LiveExactIdentityAuthorityResult {
  if (!Number.isSafeInteger(input.candidateCount) || input.candidateCount < 0) {
    throw new Error("live_identity_candidate_count_invalid");
  }
  const missingEvidence: string[] = [];
  if (!input.expectedIdWasSupplied) missingEvidence.push("expected_id_not_supplied");
  if (!input.expectedIdMatched) missingEvidence.push("expected_id_not_matched");
  if (!input.registryRecordPresent) missingEvidence.push("registry_record_missing");
  if (!input.registryRecordActive) missingEvidence.push("registry_record_not_active");
  if (input.registryRecordRevoked) missingEvidence.push("registry_record_revoked");
  if (!input.registryTenantMatched) missingEvidence.push("registry_tenant_not_matched");
  if (!input.signatureVerified) missingEvidence.push("signature_not_verified");
  if (!input.uniqueActiveRecord) missingEvidence.push("unique_active_record_not_verified");

  const exactRegistryChainComplete =
    input.expectedIdWasSupplied &&
    input.expectedIdMatched &&
    input.candidateCount === 1 &&
    input.registryRecordPresent &&
    input.registryRecordActive &&
    !input.registryRecordRevoked &&
    input.registryTenantMatched &&
    input.signatureVerified &&
    input.uniqueActiveRecord;

  let status: LiveExactIdentityAuthorityStatus;
  if (input.candidateCount > 1 || (input.candidateCount === 1 && !input.uniqueActiveRecord)) {
    status = "MANUAL_REVIEW";
  } else if (!input.expectedIdWasSupplied || !input.expectedIdMatched || input.candidateCount === 0) {
    status = "NOT_FOUND";
  } else if (exactRegistryChainComplete) {
    status = "EXACT_REGISTRY_CHAIN_VERIFIED_SUPPORT_ONLY";
  } else {
    status = "TARGETED_EXPECTED_ID_SUPPORT_ONLY";
  }

  return {
    status,
    verificationMode: "targeted_expected_id_only",
    exactRegistryChainComplete,
    missingEvidence,
    candidateCount: input.candidateCount,
    expectedIdDisclosedInResponse: false,
    rawDecoderResultSerialized: false,
    supportOnly: true,
    ownership: false,
    vault: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

type ProtectedExactLastCall =
  | { state: "NEVER_CALLED" }
  | { state: "IN_PROGRESS"; at: string }
  | { state: "SUCCEEDED"; at: string; verdict: string }
  | { state: "FAILED"; at: string; errorCode: string };

let protectedExactLastCall: ProtectedExactLastCall = { state: "NEVER_CALLED" };
export function noteLiveProtectedExactCallStarted(): void { protectedExactLastCall = { state: "IN_PROGRESS", at: new Date().toISOString() }; }
export function noteLiveProtectedExactCallFinished(result: { verdict?: unknown } | null, error?: unknown): void {
  const at = new Date().toISOString();
  if (error) { protectedExactLastCall = { state: "FAILED", at, errorCode: error instanceof Error && /^[a-z0-9_-]{1,120}$/i.test(error.message) ? error.message : "protected_runtime_error" }; return; }
  protectedExactLastCall = { state: "SUCCEEDED", at, verdict: typeof result?.verdict === "string" ? result.verdict.slice(0, 120) : "UNKNOWN" };
}

export function getLiveExactIdentityProtectedIntegrationStatus() {
  return {
    capabilityAvailability: { routeMounted: true, adapterReady: true, stoppedRecordingRequired: true, targetedExpectedIdRequired: true },
    dependencyReadiness: { evaluatedPerRequest: true, usesExistingProtectedVideoRuntime: true, mayRequireFfmpegFfprobePyav: true, liveTransportPlayerRuntimeFfmpegDependency: false },
    lastCall: protectedExactLastCall,
    blindDiscoveryClaimed: false,
    supportOnly: true,
    ownership: false,
    vault: false,
    confirmed: false,
    final: false,
  };
}

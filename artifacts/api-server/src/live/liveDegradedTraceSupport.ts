export const LIVE_DEGRADED_TRACE_SUPPORT_DECISION_ROLE =
  "live_degraded_trace_support_only_no_vault_no_confirmed" as const;

export type LiveDecodeVerdict = "VAULT" | "WEAK_SIGNAL" | "NOT_FOUND" | "ERROR";

export type LiveDegradedTraceScenario =
  | "compression"
  | "quality_drop"
  | "screen_recording_like"
  | "phone_or_platform_like"
  | "broken_piece"
  | "unknown";

export type LiveDegradedTraceProvenance =
  | "derived_from_verified_live_hls_capture"
  | "derived_from_verified_live_recording"
  | "unverified_live_capture"
  | "unsealed_source"
  | "unknown";

export interface LiveTraceReadSummary {
  verdict: LiveDecodeVerdict;
  expectedIdMatched: boolean;
  vaultFrames: number;
  strongFrames: number;
  weakFrames?: number;
  anchorOnlyFrames?: number;
  finalConfirmedBy?: "channel_a" | "channel_b" | "both" | "none";
}

export interface BuildLiveDegradedTraceSupportInput {
  scenario: LiveDegradedTraceScenario;
  provenance: LiveDegradedTraceProvenance;
  baseline: LiveTraceReadSummary;
  degraded: LiveTraceReadSummary;
  wrongIdRejected: boolean;
  unsealedNoVault: boolean;
  brokenPieceRejected: boolean;
  originalTouched: boolean;
  externalPlatformUsed: boolean;
  realFileInfoRedacted: boolean;
}

export interface LiveDegradedTraceSupportResult {
  scenario: LiveDegradedTraceScenario;
  provenance: LiveDegradedTraceProvenance;
  traceStatus:
    | "exact_id_read"
    | "support_trace_from_verified_live_chain"
    | "no_safe_support_trace";
  supportReason: string;
  standaloneOwnershipProof: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  requiresBaselineExactRead: true;
  wrongIdRejected: boolean;
  unsealedNoVault: boolean;
  brokenPieceRejected: boolean;
  safetyPassed: boolean;
  decisionRole: typeof LIVE_DEGRADED_TRACE_SUPPORT_DECISION_ROLE;
}

function hasBaselineExactRead(summary: LiveTraceReadSummary): boolean {
  return summary.verdict === "VAULT" && summary.expectedIdMatched === true;
}

function hasSafeProvenance(provenance: LiveDegradedTraceProvenance): boolean {
  return (
    provenance === "derived_from_verified_live_hls_capture" ||
    provenance === "derived_from_verified_live_recording"
  );
}

function safeNegativeGates(input: BuildLiveDegradedTraceSupportInput): boolean {
  return (
    input.wrongIdRejected === true &&
    input.unsealedNoVault === true &&
    input.brokenPieceRejected === true &&
    input.originalTouched === false &&
    input.externalPlatformUsed === false &&
    input.realFileInfoRedacted === true
  );
}

export function buildLiveDegradedTraceSupport(
  input: BuildLiveDegradedTraceSupportInput,
): LiveDegradedTraceSupportResult {
  const baselineExact = hasBaselineExactRead(input.baseline);
  const safeProvenance = hasSafeProvenance(input.provenance);
  const gatesPassed = safeNegativeGates(input);
  const degradedExact =
    input.degraded.verdict === "VAULT" && input.degraded.expectedIdMatched === true;

  let traceStatus: LiveDegradedTraceSupportResult["traceStatus"] =
    "no_safe_support_trace";
  let supportReason =
    "No safe live support trace: exact baseline, safe provenance, and negative gates are required.";

  if (degradedExact && gatesPassed) {
    traceStatus = "exact_id_read";
    supportReason =
      "The degraded live copy still produced an exact ID read. This remains support-only until product gates confirm it.";
  } else if (baselineExact && safeProvenance && gatesPassed) {
    traceStatus = "support_trace_from_verified_live_chain";
    supportReason =
      "The degraded live copy is tied to a prior exact-ID local HLS/live recording chain. This is support evidence only and cannot open VAULT.";
  }

  return {
    scenario: input.scenario,
    provenance: input.provenance,
    traceStatus,
    supportReason,
    standaloneOwnershipProof: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    requiresBaselineExactRead: true,
    wrongIdRejected: input.wrongIdRejected,
    unsealedNoVault: input.unsealedNoVault,
    brokenPieceRejected: input.brokenPieceRejected,
    safetyPassed: gatesPassed,
    decisionRole: LIVE_DEGRADED_TRACE_SUPPORT_DECISION_ROLE,
  };
}

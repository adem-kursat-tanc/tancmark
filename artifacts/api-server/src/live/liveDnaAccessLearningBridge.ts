import type { LiveAccessAuditEvent } from "./liveAccessAuditTrail";
import type { LiveViewerSessionModel } from "./liveViewerSessionModel";

export const LIVE_DNA_ACCESS_LEARNING_DECISION_ROLE =
  "live_dna_access_learning_support_only_no_ban_no_firewall_no_vault_no_confirmed" as const;

export interface LiveDnaAccessLearningBridgeInput {
  liveSessionId: string;
  viewerSessions?: LiveViewerSessionModel[];
  auditEvents?: LiveAccessAuditEvent[];
}

export interface LiveDnaAccessLearningBridge {
  liveSessionId: string;
  learningSignals: string[];
  recommendations: string[];
  learnedFromViewerSessions: number;
  learnedFromAccessEvents: number;
  approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT";
  humanApprovalRequired: true;
  autoBanEnabled: false;
  autoFirewallEnabled: false;
  autoDrmEnabled: false;
  autoPricingEnabled: false;
  autoProductionAccessChangeEnabled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_DNA_ACCESS_LEARNING_DECISION_ROLE;
}

export function buildLiveDnaAccessLearningBridge(
  input: LiveDnaAccessLearningBridgeInput,
): LiveDnaAccessLearningBridge {
  const signals = new Set<string>();
  const recommendations = new Set<string>();

  const viewerSessions = input.viewerSessions ?? [];
  const auditEvents = input.auditEvents ?? [];

  const deniedCount = auditEvents.filter((event) => event.eventType === "viewer.access.denied").length;
  const expiredCount = auditEvents.filter((event) => event.eventType === "viewer.token.expired").length;
  const domainMismatchCount = auditEvents.filter((event) => event.eventType === "viewer.domain.blocked").length;
  const referrerMismatchCount = auditEvents.filter((event) => event.eventType === "viewer.referrer.blocked").length;

  if (deniedCount > 0) signals.add("frequent_denied_access");
  if (expiredCount > 0) signals.add("token_expired_density");
  if (domainMismatchCount > 0) signals.add("domain_mismatch");
  if (referrerMismatchCount > 0) signals.add("referrer_mismatch");
  if (viewerSessions.some((session) => session.ipRiskPreview === "high")) signals.add("high_ip_risk");
  if (viewerSessions.some((session) => session.deviceRiskPreview === "high")) signals.add("suspicious_viewer_session");
  if (auditEvents.length > 5) signals.add("repeated_access_attempts");
  if (auditEvents.some((event) => event.eventType === "viewer.drm.required.future")) signals.add("future_drm_needed");
  if (viewerSessions.some((session) => session.accessMode === "secure_classroom_future")) {
    signals.add("secure_classroom_demand");
  }

  if (signals.has("frequent_denied_access")) {
    recommendations.add("Review access policy UX and entitlement mapping in isolated mock lab.");
  }
  if (signals.has("domain_mismatch") || signals.has("referrer_mismatch")) {
    recommendations.add("Prepare a domain/referrer enforcement test plan before any production policy.");
  }
  if (signals.has("future_drm_needed")) {
    recommendations.add("Keep DRM as future provider work; do not connect real DRM without explicit approval.");
  }
  if (recommendations.size === 0) {
    recommendations.add("Keep collecting mock access signals until real access lab is approved.");
  }

  return {
    liveSessionId: input.liveSessionId,
    learningSignals: Array.from(signals),
    recommendations: Array.from(recommendations),
    learnedFromViewerSessions: viewerSessions.length,
    learnedFromAccessEvents: auditEvents.length,
    approvalPhraseRequired: "APPROVE_LIVE_SAFE_IMPROVEMENT",
    humanApprovalRequired: true,
    autoBanEnabled: false,
    autoFirewallEnabled: false,
    autoDrmEnabled: false,
    autoPricingEnabled: false,
    autoProductionAccessChangeEnabled: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_DNA_ACCESS_LEARNING_DECISION_ROLE,
  };
}

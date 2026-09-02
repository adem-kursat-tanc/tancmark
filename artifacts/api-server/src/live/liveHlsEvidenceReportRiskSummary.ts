export const LIVE_HLS_EVIDENCE_REPORT_RISK_ROLE =
  "live_hls_evidence_report_risk_summary_support_only_no_vault_no_confirmed" as const;

export type LiveHlsEvidenceRiskLevel = "low" | "medium" | "high";

export interface LiveHlsEvidenceReportRiskItem {
  riskKey: string;
  riskLevel: LiveHlsEvidenceRiskLevel;
  explanation: string;
  mitigation: string;
  deferredWorkLinkOrLabel: string;
  supportOnly: true;
}

export interface LiveHlsEvidenceReportRiskSummary {
  risks: LiveHlsEvidenceReportRiskItem[];
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_RISK_ROLE;
}

export function getLiveHlsEvidenceReportRiskSummary(): LiveHlsEvidenceReportRiskSummary {
  return {
    risks: [
      {
        riskKey: "synthetic_only_limitation",
        riskLevel: "medium",
        explanation: "The evidence report is built from synthetic/local lab content only.",
        mitigation: "Run a separate approved real customer-content HLS evidence report phase before product claims.",
        deferredWorkLinkOrLabel: "real customer-content HLS evidence report",
        supportOnly: true,
      },
      {
        riskKey: "local_only_limitation",
        riskLevel: "medium",
        explanation: "The evidence was produced on localhost and does not prove production network behavior.",
        mitigation: "Run a feature-gated staging/live infrastructure evidence report later.",
        deferredWorkLinkOrLabel: "product HLS evidence pipeline",
        supportOnly: true,
      },
      {
        riskKey: "real_customer_content_untested",
        riskLevel: "high",
        explanation: "Real customer content was not used in this phase.",
        mitigation: "Require explicit human approval and privacy review before any real customer-content test.",
        deferredWorkLinkOrLabel: "real customer-content HLS evidence report",
        supportOnly: true,
      },
      {
        riskKey: "external_target_untested",
        riskLevel: "medium",
        explanation: "External custom RTMP target behavior was not tested.",
        mitigation: "Keep external target evidence deferred until an approved external custom RTMP lab.",
        deferredWorkLinkOrLabel: "real external target evidence report",
        supportOnly: true,
      },
      {
        riskKey: "social_transcode_untested",
        riskLevel: "high",
        explanation: "YouTube/Facebook/Twitch/TikTok social transcode survival was not tested.",
        mitigation: "Do not claim social-platform survival until a separate provider-specific evidence report exists.",
        deferredWorkLinkOrLabel: "YouTube evidence report",
        supportOnly: true,
      },
      {
        riskKey: "rtmp_direct_capture_unreliable",
        riskLevel: "medium",
        explanation: "RTMP direct capture showed inconsistent ID reads across capture windows.",
        mitigation: "Keep RTMP direct capture diagnostic-only and prefer HLS capture for local evidence.",
        deferredWorkLinkOrLabel: "RTMP direct diagnostic-only guard",
        supportOnly: true,
      },
      {
        riskKey: "legal_final_proof_not_claimed",
        riskLevel: "high",
        explanation: "This mock report is not a legal final proof package.",
        mitigation: "Create a separate legal-grade evidence package review before legal/customer export.",
        deferredWorkLinkOrLabel: "legal-grade evidence package review",
        supportOnly: true,
      },
      {
        riskKey: "post_live_reseal_product_workflow_deferred",
        riskLevel: "medium",
        explanation: "Post-live re-seal is positioned as safest local strategy but not connected as a product workflow.",
        mitigation: "Design a separate product post-live re-seal report and ownership-safe workflow.",
        deferredWorkLinkOrLabel: "product post-live re-seal report",
        supportOnly: true,
      },
    ],
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_RISK_ROLE,
  };
}

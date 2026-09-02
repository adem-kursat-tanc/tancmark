export const LIVE_HLS_EVIDENCE_REPORT_DECISION_TEXT_ROLE =
  "live_hls_evidence_report_decision_text_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidenceReportDecisionText {
  summaryText: string;
  decisionStatements: string[];
  limitations: string[];
  finalDecisionRequirement: "real_tancmark_id_read_plus_registered_system_match";
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_REPORT_DECISION_TEXT_ROLE;
}

export function getLiveHlsEvidenceReportDecisionText(): LiveHlsEvidenceReportDecisionText {
  return {
    summaryText:
      "This report is a local synthetic live lab evidence summary. It is not VAULT/confirmed/final and is not a final legal ownership decision.",
    decisionStatements: [
      "This report summarizes local synthetic live lab results.",
      "HLS capture is the preferred live evidence/read path in the current local lab evidence.",
      "RTMP direct capture is diagnostic-only.",
      "Post-live re-seal appeared to be the safest local re-seal strategy in the lab.",
      "This report does not produce VAULT/confirmed/final.",
      "It does not guarantee the same result for real customer content.",
      "A final product decision requires a real TancMark ID read plus a registered system match.",
    ],
    limitations: [
      "Not real customer content.",
      "Not external target evidence.",
      "Not social transcode evidence.",
      "Not legal final proof.",
      "Not a replacement for VAULT/confirmed/final decision gates.",
    ],
    finalDecisionRequirement: "real_tancmark_id_read_plus_registered_system_match",
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_REPORT_DECISION_TEXT_ROLE,
  };
}

import { getLiveHlsEvidencePdfTemplatePolicy } from "./liveHlsEvidencePdfTemplatePolicy";

export const LIVE_HLS_EVIDENCE_PDF_TEMPLATE_SECTIONS_ROLE =
  "live_hls_evidence_pdf_template_sections_support_only_no_vault_no_confirmed" as const;

export type LiveHlsEvidencePdfSectionId =
  | "cover"
  | "executive_summary"
  | "source_boundary"
  | "test_chain_summary"
  | "decision_boundary"
  | "safety_checks"
  | "limitations"
  | "next_steps";

export interface LiveHlsEvidencePdfTemplateSection {
  sectionId: LiveHlsEvidencePdfSectionId;
  title: string;
  requiredItems: string[];
  supportOnly: true;
}

export interface LiveHlsEvidencePdfTemplateSections {
  reportType: "live_hls_local_evidence_pdf_template";
  sectionCount: 8;
  sections: LiveHlsEvidencePdfTemplateSection[];
  supportOnly: true;
  canOpenVault: false;
  canConfirm: false;
  canFinalize: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_TEMPLATE_SECTIONS_ROLE;
}

export function getLiveHlsEvidencePdfTemplateSections(): LiveHlsEvidencePdfTemplateSections {
  const policy = getLiveHlsEvidencePdfTemplatePolicy();

  return {
    reportType: policy.reportType,
    sectionCount: 8,
    sections: [
      {
        sectionId: "cover",
        title: "Cover",
        requiredItems: [
          "TancMark Live HLS Evidence Report",
          "Local Synthetic Lab Result",
          "supportOnly warning",
        ],
        supportOnly: true,
      },
      {
        sectionId: "executive_summary",
        title: "Executive Summary",
        requiredItems: [
          "HLS capture preferred",
          "RTMP direct diagnostic-only",
          "post-live re-seal safest local strategy",
        ],
        supportOnly: true,
      },
      {
        sectionId: "source_boundary",
        title: "Source Boundary",
        requiredItems: [
          "synthetic/local only",
          "no customer content",
          "no social platform",
          "no secret",
          "no external target",
        ],
        supportOnly: true,
      },
      {
        sectionId: "test_chain_summary",
        title: "Test Chain Summary",
        requiredItems: [
          "local RTMP smoke",
          "repeatability",
          "HLS playback/probe",
          "VOD capture",
          "post-live re-seal",
          "E2E chain",
          "pre-sealed HLS survival",
          "RTMP instability",
        ],
        supportOnly: true,
      },
      {
        sectionId: "decision_boundary",
        title: "Decision Boundary",
        requiredItems: [
          "no VAULT",
          "no confirmed",
          "no final",
          "no legal final proof",
          "final requires real TancMark ID read + system record match",
        ],
        supportOnly: true,
      },
      {
        sectionId: "safety_checks",
        title: "Safety Checks",
        requiredItems: [
          "wrong ID rejected",
          "no ID no VAULT",
          "candidate/advisory does not open final",
        ],
        supportOnly: true,
      },
      {
        sectionId: "limitations",
        title: "Limitations",
        requiredItems: [
          "local-only",
          "synthetic-only",
          "social transcode untested",
          "real customer content untested",
          "legal review deferred",
        ],
        supportOnly: true,
      },
      {
        sectionId: "next_steps",
        title: "Next Steps",
        requiredItems: [
          "real PDF export product flow",
          "legal-grade review",
          "real customer-content live evidence report",
          "external target evidence report",
        ],
        supportOnly: true,
      },
    ],
    supportOnly: true,
    canOpenVault: false,
    canConfirm: false,
    canFinalize: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_TEMPLATE_SECTIONS_ROLE,
  };
}

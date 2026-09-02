import { getLiveHlsEvidencePdfExportReadiness } from "./liveHlsEvidencePdfExportReadiness";

export const LIVE_HLS_EVIDENCE_PDF_RENDER_PLAN_ROLE =
  "live_hls_evidence_pdf_render_plan_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidencePdfRenderPlan {
  renderPlanStatus: "template_ready_pdf_generation_deferred";
  existingPdfKitGeneratorFound: true;
  dedicatedTemplateReady: true;
  claimSafetyGuardReady: true;
  safeToGeneratePdfNow: false;
  reason: "real PDF generation deferred until dedicated generator integration phase";
  nextRequiredPhase: "Live HLS Evidence Dedicated PDF Artifact Generation";
  plannedInputs: {
    jsonArtifactPath: string;
    htmlArtifactPath: string;
    textArtifactPath: string;
  };
  requiredPreGenerationGates: string[];
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_RENDER_PLAN_ROLE;
}

export function getLiveHlsEvidencePdfRenderPlan(): LiveHlsEvidencePdfRenderPlan {
  const readiness = getLiveHlsEvidencePdfExportReadiness();

  return {
    renderPlanStatus: "template_ready_pdf_generation_deferred",
    existingPdfKitGeneratorFound: true,
    dedicatedTemplateReady: true,
    claimSafetyGuardReady: true,
    safeToGeneratePdfNow: false,
    reason: "real PDF generation deferred until dedicated generator integration phase",
    nextRequiredPhase: "Live HLS Evidence Dedicated PDF Artifact Generation",
    plannedInputs: {
      jsonArtifactPath: readiness.jsonArtifactPath,
      htmlArtifactPath: readiness.htmlArtifactPath,
      textArtifactPath: readiness.textArtifactPath,
    },
    requiredPreGenerationGates: [
      "dedicated Live HLS PDF generator integration",
      "claim safety guard on final rendered text",
      "PDF metadata/title/footer review",
      "visual render QA",
      "legal-grade language review",
      "no real customer content unless separately approved",
    ],
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_RENDER_PLAN_ROLE,
  };
}

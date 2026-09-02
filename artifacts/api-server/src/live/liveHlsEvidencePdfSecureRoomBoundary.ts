import { getLiveHlsEvidencePdfClaimSafetyGuard } from "./liveHlsEvidencePdfClaimSafetyGuard";
import { getLiveHlsEvidencePdfRenderPlan } from "./liveHlsEvidencePdfRenderPlan";
import { getLiveHlsEvidencePdfTemplatePolicy } from "./liveHlsEvidencePdfTemplatePolicy";
import { getLiveHlsEvidencePdfTemplateSections } from "./liveHlsEvidencePdfTemplateSections";

export const LIVE_HLS_EVIDENCE_PDF_SECURE_ROOM_BOUNDARY_ROLE =
  "live_hls_pdf_template_support_only_no_vault_no_confirmed" as const;

export interface LiveHlsEvidencePdfSecureRoomBoundary {
  secureRoomPdfBoundaryId: "secure_room_live_hls_pdf_template_boundary_v1";
  templatePolicySummary: ReturnType<typeof getLiveHlsEvidencePdfTemplatePolicy>;
  sectionSummary: Pick<ReturnType<typeof getLiveHlsEvidencePdfTemplateSections>, "sectionCount" | "sections">;
  claimSafetySummary: Pick<
    ReturnType<typeof getLiveHlsEvidencePdfClaimSafetyGuard>,
    "forbiddenClaimsFound" | "requiredWarningsPresent" | "safeForPdfRenderNow" | "blockingReasons"
  >;
  renderPlanSummary: Pick<
    ReturnType<typeof getLiveHlsEvidencePdfRenderPlan>,
    "renderPlanStatus" | "safeToGeneratePdfNow" | "reason" | "nextRequiredPhase"
  >;
  supportOnly: true;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_SECURE_ROOM_BOUNDARY_ROLE;
}

export function getLiveHlsEvidencePdfSecureRoomBoundary(): LiveHlsEvidencePdfSecureRoomBoundary {
  const policy = getLiveHlsEvidencePdfTemplatePolicy();
  const sections = getLiveHlsEvidencePdfTemplateSections();
  const claimSafety = getLiveHlsEvidencePdfClaimSafetyGuard();
  const renderPlan = getLiveHlsEvidencePdfRenderPlan();

  return {
    secureRoomPdfBoundaryId: "secure_room_live_hls_pdf_template_boundary_v1",
    templatePolicySummary: policy,
    sectionSummary: {
      sectionCount: sections.sectionCount,
      sections: sections.sections,
    },
    claimSafetySummary: {
      forbiddenClaimsFound: claimSafety.forbiddenClaimsFound,
      requiredWarningsPresent: claimSafety.requiredWarningsPresent,
      safeForPdfRenderNow: claimSafety.safeForPdfRenderNow,
      blockingReasons: claimSafety.blockingReasons,
    },
    renderPlanSummary: {
      renderPlanStatus: renderPlan.renderPlanStatus,
      safeToGeneratePdfNow: renderPlan.safeToGeneratePdfNow,
      reason: renderPlan.reason,
      nextRequiredPhase: renderPlan.nextRequiredPhase,
    },
    supportOnly: true,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_SECURE_ROOM_BOUNDARY_ROLE,
  };
}

export const LIVE_HLS_EVIDENCE_PDF_CLAIM_SAFETY_ROLE =
  "live_hls_evidence_pdf_claim_safety_support_only_no_vault_no_confirmed" as const;

export const LIVE_HLS_EVIDENCE_PDF_FORBIDDEN_CLAIMS = [
  "kesin sahiplik kaniti",
  "kesin sahiplik kanıtı",
  "hukuken kesin ispat",
  "final proof",
  "confirmed ownership",
  "VAULT bulundu",
  "final karar",
  "musteri iceriginde garantili calisir",
  "müşteri içeriğinde garantili çalışır",
  "platformlarda kesin calisir",
  "platformlarda kesin çalışır",
  "mahkemede kesin kabul edilir",
] as const;

export const LIVE_HLS_EVIDENCE_PDF_REQUIRED_WARNINGS = [
  "local synthetic lab evidence",
  "supportOnly",
  "read-only lab result",
  "not final legal proof",
  "does not open VAULT/confirmed/final",
  "real customer content not tested",
  "final decision requires embedded TancMark ID read and system record match",
] as const;

const DEFAULT_TEMPLATE_LANGUAGE =
  "TancMark Live HLS Evidence Report. Local Synthetic Lab Result. " +
  "This is local synthetic lab evidence and a read-only lab result. " +
  "supportOnly. It is not final legal proof. " +
  "It does not open VAULT/confirmed/final. " +
  "real customer content not tested. " +
  "final decision requires embedded TancMark ID read and system record match.";

export interface LiveHlsEvidencePdfClaimSafetyGuardResult {
  forbiddenClaims: readonly string[];
  requiredWarnings: readonly string[];
  forbiddenClaimsFound: string[];
  requiredWarningsPresent: true | false;
  missingRequiredWarnings: string[];
  safeForPdfRenderNow: true | false;
  blockingReasons: string[];
  supportOnly: true;
  canOpenVault: false;
  canConfirm: false;
  canFinalize: false;
  vaultEligible: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_HLS_EVIDENCE_PDF_CLAIM_SAFETY_ROLE;
}

function normalizeForClaimScan(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function evaluateLiveHlsEvidencePdfClaimSafety(
  pdfText: string = DEFAULT_TEMPLATE_LANGUAGE,
): LiveHlsEvidencePdfClaimSafetyGuardResult {
  const normalized = normalizeForClaimScan(pdfText);
  const forbiddenClaimsFound = LIVE_HLS_EVIDENCE_PDF_FORBIDDEN_CLAIMS.filter((claim) =>
    normalized.includes(normalizeForClaimScan(claim)),
  );
  const missingRequiredWarnings = LIVE_HLS_EVIDENCE_PDF_REQUIRED_WARNINGS.filter(
    (warning) => !normalized.includes(normalizeForClaimScan(warning)),
  );
  const requiredWarningsPresent = missingRequiredWarnings.length === 0;
  const blockingReasons = [
    ...forbiddenClaimsFound.map((claim) => `forbidden_claim:${claim}`),
    ...missingRequiredWarnings.map((warning) => `missing_required_warning:${warning}`),
  ];

  return {
    forbiddenClaims: LIVE_HLS_EVIDENCE_PDF_FORBIDDEN_CLAIMS,
    requiredWarnings: LIVE_HLS_EVIDENCE_PDF_REQUIRED_WARNINGS,
    forbiddenClaimsFound,
    requiredWarningsPresent,
    missingRequiredWarnings,
    safeForPdfRenderNow: forbiddenClaimsFound.length === 0 && requiredWarningsPresent,
    blockingReasons,
    supportOnly: true,
    canOpenVault: false,
    canConfirm: false,
    canFinalize: false,
    vaultEligible: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_HLS_EVIDENCE_PDF_CLAIM_SAFETY_ROLE,
  };
}

export function getLiveHlsEvidencePdfClaimSafetyGuard(): LiveHlsEvidencePdfClaimSafetyGuardResult {
  return evaluateLiveHlsEvidencePdfClaimSafety();
}

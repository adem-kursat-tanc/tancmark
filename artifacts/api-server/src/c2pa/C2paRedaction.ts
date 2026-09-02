// SPDX-License-Identifier: AGPL-3.0-only

import type { C2paInspectionResult, C2paPublicStatus } from "./C2paResultTypes";

const USER_MESSAGES: Record<C2paPublicStatus, string> = {
  NO_C2PA: "C2PA bilgisi bulunamadı",
  VALID_BUT_UNTRUSTED: "Manifest geçerli; sertifika kamu güven listesinde doğrulanmadı",
  VALID_AND_TRUSTED: "Manifest ve sertifika doğrulandı",
  VALID_AND_TRUSTED_TEST_CONTEXT: "Manifest test güven bağlamında doğrulandı; bu resmî kamu güveni değildir",
  INVALID_SIGNATURE: "İmza geçersiz",
  ASSET_TAMPERED: "Dosya manifestten sonra değiştirilmiş",
  MALFORMED_MANIFEST: "C2PA manifesti bozuk veya okunamadı",
  UNSUPPORTED_FORMAT: "Bu format desteklenmiyor",
  REMOTE_MANIFEST_BLOCKED: "Uzak manifest güvenlik nedeniyle açılmadı",
  TRUST_STATUS_NOT_MEASURED: "Manifest bulundu; sertifika güven durumu ölçülmedi",
};

export function c2paPublicStatus(result: C2paInspectionResult): C2paPublicStatus {
  if (result.status === "NO_C2PA") return "NO_C2PA";
  if (result.status === "C2PA_REMOTE_MANIFEST_BLOCKED") return "REMOTE_MANIFEST_BLOCKED";
  if (result.status === "C2PA_UNSUPPORTED_FORMAT") return "UNSUPPORTED_FORMAT";
  if (result.status === "C2PA_ASSET_TAMPERED") return "ASSET_TAMPERED";
  if (result.status === "C2PA_INVALID_SIGNATURE") return "INVALID_SIGNATURE";
  if (result.status === "C2PA_MALFORMED" || result.status === "C2PA_PROCESSING_ERROR") return "MALFORMED_MANIFEST";
  if (result.trustStatus === "OFFICIAL_C2PA_TRUSTED") return "VALID_AND_TRUSTED";
  if (result.trustStatus === "CUSTOM_TRUST_ANCHOR_NOT_OFFICIAL_C2PA_TRUST") return "VALID_AND_TRUSTED_TEST_CONTEXT";
  if (result.signatureCryptographicallyValid && result.assetIntegrityValid) return "VALID_BUT_UNTRUSTED";
  return "TRUST_STATUS_NOT_MEASURED";
}

export function redactC2paInspection(result: C2paInspectionResult) {
  const status = c2paPublicStatus(result);
  return Object.freeze({
    status,
    message: USER_MESSAGES[status],
    manifestPresent: result.c2paPresent,
    manifestEmbedded: result.manifestEmbedded,
    cryptographicallyValid: result.signatureCryptographicallyValid,
    assetIntegrityValid: result.assetIntegrityValid,
    trustStatus: result.trustStatus,
    claimGenerator: [...result.claimGeneratorNames],
    claimVersion: result.claimVersion,
    assertions: [...result.assertionLabels],
    ingredients: { count: result.ingredientCount },
    actions: [...result.actionNames],
    signingInformation: {
      signatureVerified: result.signatureCryptographicallyValid,
      trustVerified: status === "VALID_AND_TRUSTED" || status === "VALID_AND_TRUSTED_TEST_CONTEXT",
    },
    assetBinding: result.assetIntegrityValid ? "VALID" : result.c2paPresent ? "INVALID_OR_NOT_VERIFIED" : "NOT_PRESENT",
    manifestStore: result.c2paPresent ? "PRESENT_REDACTED" : "NOT_PRESENT",
    tancmarkAssertion: result.tancmarkAssertion,
    provenanceAvailable: result.provenanceAvailable,
    safety: {
      supportOnly: true,
      c2paCanOpenVault: false,
      ownership: false,
      confirmed: false,
      final: false,
      rawExpectedIdDisclosed: false,
      privateRegistryDisclosed: false,
      privateMapDisclosed: false,
      filePathDisclosed: false,
      certificateContentsDisclosed: false,
      privateKeyDisclosed: false,
    },
  });
}

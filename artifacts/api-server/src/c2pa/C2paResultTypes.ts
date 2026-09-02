// SPDX-License-Identifier: AGPL-3.0-only

export const C2PA_SDK_PACKAGE = "@contentauth/c2pa-node" as const;
export const C2PA_SDK_VERSION = "0.9.1" as const;
export const C2PA_SPECIFICATION_VERSION = "2.4" as const;

export type C2paResultStatus =
  | "NO_C2PA"
  | "C2PA_PRESENT_WELL_FORMED"
  | "C2PA_PRESENT_VALID"
  | "C2PA_VALID_TEST_CERTIFICATE"
  | "C2PA_VALID_UNTRUSTED_CERTIFICATE"
  | "C2PA_VALID_TRUSTED_CERTIFICATE"
  | "C2PA_INVALID_SIGNATURE"
  | "C2PA_ASSET_TAMPERED"
  | "C2PA_MALFORMED"
  | "C2PA_REMOTE_MANIFEST_BLOCKED"
  | "C2PA_UNSUPPORTED_FORMAT"
  | "C2PA_PROCESSING_ERROR";

export type C2paTrustMode =
  | "OFFLINE_TEST"
  | "CUSTOM_TRUST_ANCHOR"
  | "OFFICIAL_C2PA_TRUST_LIST";

export type C2paTrustStatus =
  | "NO_SIGNING_CREDENTIAL"
  | "VALID_TEST_CERTIFICATE_NOT_OFFICIALLY_TRUSTED"
  | "VALID_BUT_NOT_OFFICIALLY_TRUSTED"
  | "CUSTOM_TRUST_ANCHOR_NOT_OFFICIAL_C2PA_TRUST"
  | "OFFICIAL_C2PA_TRUSTED"
  | "INVALID_OR_UNVERIFIED";

export type TancMarkC2paAssertion = Readonly<{
  schemaVersion: "1";
  publicRegistryReference: string;
  recordVersion: string;
  algorithmVersion: string;
  createdAt: string;
  publicVerificationUrl?: string;
  supportOnly: true;
}>;

export type C2paSafetyBoundary = Readonly<{
  supportOnly: true;
  productionOwnership: false;
  productionVault: false;
  confirmed: false;
  final: false;
  legalOwner: false;
}>;

export type C2paInspectionResult = Readonly<{
  ok: boolean;
  status: C2paResultStatus;
  trustMode: C2paTrustMode;
  trustStatus: C2paTrustStatus;
  c2paPresent: boolean;
  c2paValid: boolean;
  signatureCryptographicallyValid: boolean;
  assetIntegrityValid: boolean;
  manifestEmbedded: boolean;
  remoteManifestUrlPresent: boolean;
  validationState: "Invalid" | "Valid" | "Trusted" | "Unknown";
  claimVersion: number | null;
  validationCodes: readonly string[];
  claimGeneratorNames: readonly string[];
  actionNames: readonly string[];
  assertionLabels: readonly string[];
  ingredientCount: number;
  tancmarkAssertion: TancMarkC2paAssertion | null;
  tancmarkAssertionCount: number;
  provenanceAvailable: boolean;
  supportEvidence: readonly string[];
  safety: C2paSafetyBoundary;
}>;

export type C2paEmbedResult = Readonly<{
  ok: boolean;
  outputWritten: boolean;
  manifestBytes: number;
  intent: "CREATE" | "EDIT" | "UPDATE";
  outputValidation: C2paInspectionResult;
  safety: C2paSafetyBoundary;
}>;

export type C2paPublicStatus =
  | "NO_C2PA"
  | "VALID_BUT_UNTRUSTED"
  | "VALID_AND_TRUSTED"
  | "VALID_AND_TRUSTED_TEST_CONTEXT"
  | "INVALID_SIGNATURE"
  | "ASSET_TAMPERED"
  | "MALFORMED_MANIFEST"
  | "UNSUPPORTED_FORMAT"
  | "REMOTE_MANIFEST_BLOCKED"
  | "TRUST_STATUS_NOT_MEASURED";

export function c2paSafetyBoundary(): C2paSafetyBoundary {
  return Object.freeze({
    supportOnly: true,
    productionOwnership: false,
    productionVault: false,
    confirmed: false,
    final: false,
    legalOwner: false,
  });
}

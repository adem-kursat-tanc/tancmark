// SPDX-License-Identifier: AGPL-3.0-only

import type { C2paTrustMode, C2paTrustStatus } from "./C2paResultTypes";

export type C2paSdkSettings = Readonly<{
  verify: Readonly<{
    verify_after_reading: true;
    verify_after_sign: false;
    verify_trust: true;
    verify_timestamp_trust: false;
    ocsp_fetch: false;
    remote_manifest_fetch: false;
  }>;
  trust?: Readonly<{ user_anchors: string }>;
}>;

export class C2paTrustAdapter {
  static settings(mode: C2paTrustMode, customAnchorPem?: string): C2paSdkSettings {
    const verify = Object.freeze({
      verify_after_reading: true as const,
      // The adapter performs a mandatory independent Reader validation of the
      // completed output. Keeping SDK in-sign verification disabled permits a
      // private, self-signed OFFLINE_TEST credential without claiming trust.
      verify_after_sign: false as const,
      verify_trust: true as const,
      verify_timestamp_trust: false as const,
      ocsp_fetch: false as const,
      remote_manifest_fetch: false as const,
    });
    if (mode === "OFFICIAL_C2PA_TRUST_LIST") throw new Error("official_c2pa_trust_list_not_configured_in_r8");
    if (mode === "CUSTOM_TRUST_ANCHOR" || (mode === "OFFLINE_TEST" && customAnchorPem !== undefined)) {
      if (typeof customAnchorPem !== "string" || customAnchorPem.length < 64 || customAnchorPem.length > 1024 * 1024
        || !customAnchorPem.includes("BEGIN CERTIFICATE")) throw new Error("custom_trust_anchor_invalid");
      return Object.freeze({ verify, trust: Object.freeze({ user_anchors: customAnchorPem }) });
    }
    return Object.freeze({ verify });
  }

  static classify(mode: C2paTrustMode, validationState: string, codes: readonly string[]): C2paTrustStatus {
    const invalid = validationState === "Invalid" || codes.some((code) => /invalid|mismatch|malformed/i.test(code));
    if (invalid) return "INVALID_OR_UNVERIFIED";
    if (mode === "OFFICIAL_C2PA_TRUST_LIST" && validationState === "Trusted") return "OFFICIAL_C2PA_TRUSTED";
    if (mode === "CUSTOM_TRUST_ANCHOR" && validationState === "Trusted") return "CUSTOM_TRUST_ANCHOR_NOT_OFFICIAL_C2PA_TRUST";
    if (mode === "OFFLINE_TEST" && (validationState === "Valid" || validationState === "Trusted"
      || codes.some((code) => code === "signingCredential.untrusted"))) {
      return "VALID_TEST_CERTIFICATE_NOT_OFFICIALLY_TRUSTED";
    }
    if (validationState === "Valid" || validationState === "Trusted") return "VALID_BUT_NOT_OFFICIALLY_TRUSTED";
    return "NO_SIGNING_CREDENTIAL";
  }
}

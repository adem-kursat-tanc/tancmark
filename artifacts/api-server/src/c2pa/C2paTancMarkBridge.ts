// SPDX-License-Identifier: AGPL-3.0-only

import type { C2paInspectionResult } from "./C2paResultTypes";

export type TancMarkC2paBridgeDecision = Readonly<{
  provenanceAvailable: boolean;
  c2paPresent: boolean;
  c2paValid: boolean;
  c2paTrustStatus: C2paInspectionResult["trustStatus"];
  c2paTamperStatus: "NO_C2PA" | "NOT_TAMPERED_BY_C2PA_VALIDATION" | "TAMPERED_OR_INVALID";
  supportEvidence: readonly string[];
  tancmarkExactResearchSignal: boolean;
  productionOwnership: false;
  productionVault: false;
  confirmed: false;
  final: false;
  legalOwner: false;
}>;

export class C2paTancMarkBridge {
  static decide(input: {
    c2pa: C2paInspectionResult;
    tancmarkExactResearchSignal: boolean;
  }): TancMarkC2paBridgeDecision {
    const tampered = input.c2pa.status === "C2PA_ASSET_TAMPERED"
      || input.c2pa.status === "C2PA_INVALID_SIGNATURE"
      || input.c2pa.status === "C2PA_MALFORMED";
    return Object.freeze({
      provenanceAvailable: input.c2pa.provenanceAvailable,
      c2paPresent: input.c2pa.c2paPresent,
      c2paValid: input.c2pa.c2paValid,
      c2paTrustStatus: input.c2pa.trustStatus,
      c2paTamperStatus: !input.c2pa.c2paPresent ? "NO_C2PA"
        : tampered ? "TAMPERED_OR_INVALID" : "NOT_TAMPERED_BY_C2PA_VALIDATION",
      supportEvidence: Object.freeze([...input.c2pa.supportEvidence]),
      tancmarkExactResearchSignal: input.tancmarkExactResearchSignal,
      productionOwnership: false,
      productionVault: false,
      confirmed: false,
      final: false,
      legalOwner: false,
    });
  }
}

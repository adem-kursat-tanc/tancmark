import { buildLiveAppendOnlyApprovalLogMock } from "./liveAppendOnlyApprovalLogMock";

export const LIVE_APPROVAL_IMMUTABILITY_VALIDATOR_DECISION_ROLE =
  "live_approval_immutability_validator_preview_support_only_no_vault_no_confirmed" as const;

export interface LiveApprovalImmutabilityValidationCheck {
  checkKey:
    | "sequence_order_valid"
    | "previous_hash_link_valid"
    | "no_update_operation"
    | "no_delete_operation"
    | "actor_present_preview"
    | "scope_present_preview"
    | "risk_snapshot_present_preview";
  passedPreview: true;
  supportOnly: true;
}

export interface LiveApprovalImmutabilityValidatorPreview {
  liveSessionId: string;
  immutablePreviewValid: true;
  realValidationPerformed: false;
  checks: LiveApprovalImmutabilityValidationCheck[];
  supportOnly: true;
  realApprovalGranted: false;
  realSignatureGenerated: false;
  privateKeyUsed: false;
  realAppendOnlyStorage: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_APPROVAL_IMMUTABILITY_VALIDATOR_DECISION_ROLE;
}

export function buildLiveApprovalImmutabilityValidatorPreview(
  liveSessionId: string,
): LiveApprovalImmutabilityValidatorPreview {
  buildLiveAppendOnlyApprovalLogMock(liveSessionId);
  return {
    liveSessionId,
    immutablePreviewValid: true,
    realValidationPerformed: false,
    checks: [
      check("sequence_order_valid"),
      check("previous_hash_link_valid"),
      check("no_update_operation"),
      check("no_delete_operation"),
      check("actor_present_preview"),
      check("scope_present_preview"),
      check("risk_snapshot_present_preview"),
    ],
    supportOnly: true,
    realApprovalGranted: false,
    realSignatureGenerated: false,
    privateKeyUsed: false,
    realAppendOnlyStorage: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_APPROVAL_IMMUTABILITY_VALIDATOR_DECISION_ROLE,
  };
}

function check(
  checkKey: LiveApprovalImmutabilityValidationCheck["checkKey"],
): LiveApprovalImmutabilityValidationCheck {
  return {
    checkKey,
    passedPreview: true,
    supportOnly: true,
  };
}

export const LIVE_ENGINE_COST_PREVIEW_DECISION_ROLE =
  "live_engine_cost_preview_support_only_no_billing_no_vault_no_confirmed" as const;

export interface LiveEngineCostPreview {
  localLabServerEstimate: "local_machine_or_small_lab_vm_future";
  cpuUsageFutureEstimate: "unknown_until_real_lab_measured";
  bandwidthFutureEstimate: "unknown_until_real_lab_measured";
  storageFutureEstimate: "unknown_until_real_lab_measured";
  recordingFutureEstimate: "unknown_until_real_lab_measured";
  atsFutureEstimate: "unknown_until_real_lab_measured";
  monitoringFutureEstimate: "unknown_until_real_lab_measured";
  unknownUntilRealLabMeasured: true;
  billingCreditPaymentAdded: false;
  realPrice: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_ENGINE_COST_PREVIEW_DECISION_ROLE;
}

export function buildLiveEngineCostPreview(): LiveEngineCostPreview {
  return {
    localLabServerEstimate: "local_machine_or_small_lab_vm_future",
    cpuUsageFutureEstimate: "unknown_until_real_lab_measured",
    bandwidthFutureEstimate: "unknown_until_real_lab_measured",
    storageFutureEstimate: "unknown_until_real_lab_measured",
    recordingFutureEstimate: "unknown_until_real_lab_measured",
    atsFutureEstimate: "unknown_until_real_lab_measured",
    monitoringFutureEstimate: "unknown_until_real_lab_measured",
    unknownUntilRealLabMeasured: true,
    billingCreditPaymentAdded: false,
    realPrice: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_ENGINE_COST_PREVIEW_DECISION_ROLE,
  };
}

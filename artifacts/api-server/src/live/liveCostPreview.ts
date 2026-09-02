export interface LiveCostPreview {
  selfHostedServerEstimate: "unknown_until_lab_measured";
  bandwidthEstimate: "unknown_until_lab_measured";
  storageEstimate: "unknown_until_lab_measured";
  recordingEstimate: "unknown_until_lab_measured";
  cpuEncodingEstimate: "unknown_until_lab_measured";
  gpuEncodingFutureEstimate: "unknown_until_lab_measured";
  failoverServerEstimate: "unknown_until_lab_measured";
  externalCdnFutureEstimate: "unknown_until_lab_measured";
  externalDrmFutureEstimate: "unknown_until_lab_measured";
  monitoringEstimate: "unknown_until_lab_measured";
  unknownUntilLabMeasured: true;
  realPricingEnabled: false;
  creditPaymentBillingAdded: false;
  note: string;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export function buildLiveCostPreview(): LiveCostPreview {
  return {
    selfHostedServerEstimate: "unknown_until_lab_measured",
    bandwidthEstimate: "unknown_until_lab_measured",
    storageEstimate: "unknown_until_lab_measured",
    recordingEstimate: "unknown_until_lab_measured",
    cpuEncodingEstimate: "unknown_until_lab_measured",
    gpuEncodingFutureEstimate: "unknown_until_lab_measured",
    failoverServerEstimate: "unknown_until_lab_measured",
    externalCdnFutureEstimate: "unknown_until_lab_measured",
    externalDrmFutureEstimate: "unknown_until_lab_measured",
    monitoringEstimate: "unknown_until_lab_measured",
    unknownUntilLabMeasured: true,
    realPricingEnabled: false,
    creditPaymentBillingAdded: false,
    note: "Real pricing will be decided after live lab cost measurement. Do not sell from this estimate.",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

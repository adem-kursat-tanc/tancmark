export type LiveExternalDebtStatus = "NOT_CONFIGURED" | "DEFERRED";

export interface LiveExternalIntegrationDebtItem {
  capability: string;
  status: LiveExternalDebtStatus;
  localCoreRequired: false;
  successClaimed: false;
  reason: string;
}

export function getLiveExternalIntegrationDebt(): {
  overallStatus: "EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP";
  items: LiveExternalIntegrationDebtItem[];
  externalNetworkCallsPerformed: 0;
  externalProcessesStarted: 0;
  secretsReturned: false;
} {
  const item = (
    capability: string,
    status: LiveExternalDebtStatus,
    reason: string,
  ): LiveExternalIntegrationDebtItem => ({ capability, status, localCoreRequired: false, successClaimed: false, reason });
  return {
    overallStatus: "EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP",
    items: [
      item("custom_external_rtmp", "NOT_CONFIGURED", "Requires an owner-approved external target."),
      item("youtube_and_social", "DEFERRED", "Requires provider terms, OAuth and a private broadcast approval."),
      item("oauth_and_provider_credentials", "NOT_CONFIGURED", "No provider credential is accepted or stored by the local core."),
      item("trusted_tls_certificate", "NOT_CONFIGURED", "A trusted certificate and production hostname are operational inputs."),
      item("distributed_deployment_and_cdn", "DEFERRED", "The implemented store is deliberately single-node."),
      item("external_webhook_delivery", "NOT_CONFIGURED", "No external destination is connected."),
      item("drm_and_billing", "DEFERRED", "Commercial and payment decisions require separate owner approval."),
      item("legal_grade_evidence", "DEFERRED", "Current evidence is support-only and requires counsel review."),
    ],
    externalNetworkCallsPerformed: 0,
    externalProcessesStarted: 0,
    secretsReturned: false,
  };
}

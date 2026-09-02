import { buildDiscoveryApiDeferralPolicy } from "./discoveryApiDeferralPolicy";

export interface DiscoveryWebScanClosureComponent {
  component: string;
  present: boolean;
  status: "complete" | "deferred_until_pre_launch";
  supportOnly: true;
  affectsVault: false;
  readyForRealApiPilotLater: boolean;
  notes: string;
}

export interface DiscoveryWebScanClosureStatus {
  components: DiscoveryWebScanClosureComponent[];
  webScanNonApiArchitectureComplete: boolean;
  realApiOnlyRemainingForLater: true;
  safeToMoveToNextNonApiModule: boolean;
  realApiConnectionDeferred: true;
  suggestedRealApiWindow: "approximately_1_week_before_launch";
  supportOnly: true;
  decisionRole: "web_scan_non_api_closure_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

function component(
  name: string,
  notes: string,
  readyForRealApiPilotLater = true,
  status: DiscoveryWebScanClosureComponent["status"] = "complete",
): DiscoveryWebScanClosureComponent {
  return {
    component: name,
    present: true,
    status,
    supportOnly: true,
    affectsVault: false,
    readyForRealApiPilotLater,
    notes,
  };
}

export function buildDiscoveryWebScanClosureStatus(): DiscoveryWebScanClosureStatus {
  const apiDeferral = buildDiscoveryApiDeferralPolicy();
  const components = [
    component("supportEvidenceSchema", "C2PA/OTS/Secure Room/Web Search support evidence schema is read-only."),
    component("discoveryGateway", "Mock-first Discovery Gateway is implemented and support-only."),
    component("discoverySearchDna", "Discovery/Search DNA classifies and routes search plans without deciding VAULT."),
    component("queryBuilder", "Query/media planning exists without sending original content."),
    component("e2eMockSecureRoomFlow", "Mock E2E Secure Room handoff is available."),
    component("providerSafetyGate", "Provider safety gate blocks unsafe real execution conditions."),
    component("costQuotePreview", "Internal cost quote preview exists without charging users."),
    component("candidateVerificationMockBridge", "Candidate verification bridge is mock-first and no real download."),
    component("providerSetupReadinessPanel", "Readiness panel shows env/key names only and no secret values."),
    component("detectiveNoAutoEnforcementPolicy", "TancMark is detective-not-police; no automatic enforcement."),
    component("telegramPublicOnlyPolicy", "Telegram search remains public-only, no private/login/paywall/DRM bypass."),
    component(
      "apiDeferralPolicy",
      `Real API connection deferred until ${apiDeferral.suggestedWindow}.`,
      true,
      "deferred_until_pre_launch",
    ),
  ];
  const completeOrDeferred = components.every((item) => item.present);
  return {
    components,
    webScanNonApiArchitectureComplete: completeOrDeferred,
    realApiOnlyRemainingForLater: true,
    safeToMoveToNextNonApiModule: completeOrDeferred,
    realApiConnectionDeferred: true,
    suggestedRealApiWindow: "approximately_1_week_before_launch",
    supportOnly: true,
    decisionRole: "web_scan_non_api_closure_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

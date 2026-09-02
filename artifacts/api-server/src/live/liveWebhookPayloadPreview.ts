import type { LiveEventType } from "./liveEventTypes";

export const LIVE_WEBHOOK_PREVIEW_DECISION_ROLE =
  "live_webhook_payload_preview_support_only_no_real_webhook_no_vault_no_confirmed" as const;

export interface LiveWebhookPayloadPreview {
  eventType: LiveEventType;
  payloadPreview: {
    eventType: LiveEventType;
    liveSessionId: string;
    occurredAt: string;
    signaturePreview: "<redacted_mock_signature>";
    data: Record<string, string | boolean | number>;
  };
  secretSignatureReal: false;
  payloadRedacted: true;
  userSecretIncluded: false;
  realWebhookSent: false;
  realNetworkCall: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_WEBHOOK_PREVIEW_DECISION_ROLE;
}

const previewTypes: LiveEventType[] = [
  "stream.started",
  "stream.ended",
  "stream.error",
  "target.failed",
  "recording.ready",
  "vod.asset.ready",
];

function nowIso(): string {
  return new Date().toISOString();
}

export function getLiveWebhookPayloadPreviewTypes(): LiveEventType[] {
  return previewTypes;
}

export function buildLiveWebhookPayloadPreview(
  eventType: LiveEventType = "stream.started",
  liveSessionId = "live_mock_preview",
): LiveWebhookPayloadPreview {
  const selected = previewTypes.includes(eventType) ? eventType : "stream.started";
  return {
    eventType: selected,
    payloadPreview: {
      eventType: selected,
      liveSessionId,
      occurredAt: nowIso(),
      signaturePreview: "<redacted_mock_signature>",
      data: {
        supportOnly: true,
        mockOnly: true,
        realWebhookSent: false,
      },
    },
    secretSignatureReal: false,
    payloadRedacted: true,
    userSecretIncluded: false,
    realWebhookSent: false,
    realNetworkCall: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_WEBHOOK_PREVIEW_DECISION_ROLE,
  };
}

export function buildLiveWebhookPayloadPreviewCatalog(liveSessionId = "live_mock_preview"): LiveWebhookPayloadPreview[] {
  return previewTypes.map((eventType) => buildLiveWebhookPayloadPreview(eventType, liveSessionId));
}

export const LIVE_EMBED_CODE_PREVIEW_DECISION_ROLE =
  "live_embed_code_preview_mock_support_only_no_vault_no_confirmed" as const;

export interface LiveEmbedCodePreviewInput {
  liveSessionId: string;
  signedUrlMockAttached?: boolean;
}

export interface LiveEmbedCodePreview {
  liveSessionId: string;
  iframePreview: string;
  scriptPreviewFuture: string;
  embedUrlPreview: string;
  signedUrlMockAttached: boolean;
  tokenValueExposed: false;
  realEmbedEnabled: false;
  realSignedUrlGenerated: false;
  realPlayerLoaded: false;
  realStreamLoaded: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_EMBED_CODE_PREVIEW_DECISION_ROLE;
}

export function buildLiveEmbedCodePreview(input: LiveEmbedCodePreviewInput): LiveEmbedCodePreview {
  const safeSessionId = input.liveSessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "live_mock_session";
  const embedUrl = `https://embed.tancmark.example/live/${safeSessionId}?token=<redacted_mock_token>`;
  return {
    liveSessionId: safeSessionId,
    iframePreview: `<iframe src="${embedUrl}" width="640" height="360" allowfullscreen title="TancMark Live Mock"></iframe>`,
    scriptPreviewFuture: `<script src="https://embed.tancmark.example/player.js" data-live-session="${safeSessionId}" data-token="<redacted_mock_token>"></script>`,
    embedUrlPreview: embedUrl,
    signedUrlMockAttached: input.signedUrlMockAttached ?? true,
    tokenValueExposed: false,
    realEmbedEnabled: false,
    realSignedUrlGenerated: false,
    realPlayerLoaded: false,
    realStreamLoaded: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_EMBED_CODE_PREVIEW_DECISION_ROLE,
  };
}

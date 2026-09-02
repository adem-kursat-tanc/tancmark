export const LIVE_SIGNED_URL_MOCK_DECISION_ROLE =
  "live_signed_url_mock_support_only_no_real_signature_no_vault_no_confirmed" as const;

export interface LiveSignedUrlMockInput {
  liveSessionId: string;
  viewerSessionId?: string;
  domainRestrictionPreview?: string[];
  referrerRestrictionPreview?: string[];
  expiresInSecondsPreview?: number;
}

export interface LiveSignedUrlMock {
  liveSessionId: string;
  viewerSessionId: string;
  signedUrlPreview: "mock://redacted-live-playback-url";
  redactedSignedUrl: "https://playback.tancmark.example/live/<session>/index.m3u8?token=<redacted_mock_token>";
  expiresInSecondsPreview: number;
  domainRestrictionPreview: string[];
  referrerRestrictionPreview: string[];
  tokenValueExposed: false;
  signedUrlValueExposed: false;
  realSignedUrlGenerated: false;
  realTokenGenerated: false;
  realPlaybackUrlGenerated: false;
  realNetworkCall: false;
  mockOnly: true;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SIGNED_URL_MOCK_DECISION_ROLE;
}

export function buildLiveSignedUrlMock(input: LiveSignedUrlMockInput): LiveSignedUrlMock {
  return {
    liveSessionId: input.liveSessionId,
    viewerSessionId: input.viewerSessionId?.trim() || "mock-viewer-session",
    signedUrlPreview: "mock://redacted-live-playback-url",
    redactedSignedUrl: "https://playback.tancmark.example/live/<session>/index.m3u8?token=<redacted_mock_token>",
    expiresInSecondsPreview: input.expiresInSecondsPreview ?? 900,
    domainRestrictionPreview: input.domainRestrictionPreview ?? ["example.edu", "tancmark.local"],
    referrerRestrictionPreview: input.referrerRestrictionPreview ?? ["https://example.edu/course/*"],
    tokenValueExposed: false,
    signedUrlValueExposed: false,
    realSignedUrlGenerated: false,
    realTokenGenerated: false,
    realPlaybackUrlGenerated: false,
    realNetworkCall: false,
    mockOnly: true,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SIGNED_URL_MOCK_DECISION_ROLE,
  };
}

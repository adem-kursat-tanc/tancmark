export type WebSearchEvidenceProvider = "disabled" | "mock";

export type WebSearchEvidenceQueryType =
  | "metadata_fingerprint"
  | "hash_fingerprint"
  | "derived_terms"
  | "not_run";

export interface WebSearchEvidenceInput {
  enabled?: boolean;
  provider?: WebSearchEvidenceProvider;
  queryType?: WebSearchEvidenceQueryType;
  candidateUrls?: string[];
  confidence?: number;
  summary?: string;
}

export interface WebSearchEvidenceReport {
  enabled: boolean;
  provider: WebSearchEvidenceProvider;
  queryType: WebSearchEvidenceQueryType;
  searched: boolean;
  matchesFound: boolean;
  candidateUrls: string[];
  confidence: number;
  supportOnly: true;
  decisionRole: "web_search_support_only_no_vault_no_confirmed";
  sentOriginalContent: false;
  externalApiCalled: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  summary: string;
}

const WEB_SEARCH_GATE_ENV = "AEGIS_WEB_SEARCH_EVIDENCE_PREVIEW";

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function safeUrlList(urls: string[] | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .slice(0, 20);
}

function webSearchGateEnabled(): boolean {
  return process.env[WEB_SEARCH_GATE_ENV] === "on";
}

export function buildWebSearchEvidenceReport(
  input: WebSearchEvidenceInput = {},
): WebSearchEvidenceReport {
  const enabled = input.enabled === true && webSearchGateEnabled();
  const candidateUrls = enabled ? safeUrlList(input.candidateUrls) : [];
  const provider: WebSearchEvidenceProvider =
    enabled && input.provider !== "disabled" ? "mock" : "disabled";
  const queryType: WebSearchEvidenceQueryType = enabled
    ? (input.queryType ?? "metadata_fingerprint")
    : "not_run";
  const matchesFound = candidateUrls.length > 0;
  return {
    enabled,
    provider,
    queryType,
    searched: enabled,
    matchesFound,
    candidateUrls,
    confidence: enabled && matchesFound ? clampConfidence(input.confidence) : 0,
    supportOnly: true,
    decisionRole: "web_search_support_only_no_vault_no_confirmed",
    sentOriginalContent: false,
    externalApiCalled: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
    summary:
      input.summary ??
      (enabled
        ? "Web Search evidence preview used mock/derived support data only. No original content was sent and no external API was called."
        : "Web Search evidence preview is disabled. No search was performed."),
  };
}

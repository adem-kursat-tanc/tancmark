export const LIVE_SECRET_REDACTION_VALIDATOR_DECISION_ROLE =
  "live_secret_redaction_validator_support_only_no_vault_no_confirmed" as const;

export interface LiveSecretRedactionResult {
  fieldName: string;
  valuePresent: boolean;
  detectedSecretLikeValue: boolean;
  detectedReasons: string[];
  redactedValue: string;
  shouldRejectRealSecret: true;
  storageAllowed: false;
  logAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_SECRET_REDACTION_VALIDATOR_DECISION_ROLE;
}

const secretLikePatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "api_key_like_prefix", pattern: /\b(api[_-]?key|apikey|x-api-key)\b\s*[:=]\s*[\w.-]{8,}/i },
  { reason: "sk_prefix", pattern: /\bsk[_-][A-Za-z0-9_-]{8,}/i },
  { reason: "token_prefix", pattern: /\b(token|access_token|refresh_token)[_-]?[A-Za-z0-9_-]{8,}/i },
  { reason: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{8,}/i },
  { reason: "stream_key_like", pattern: /\b(stream[_-]?key|streamkey)\b\s*[:=]\s*[A-Za-z0-9._-]{8,}/i },
  { reason: "url_query_secret", pattern: /[?&](key|token|secret|signature|stream_key|api_key)=([^&#\s]{4,})/i },
  { reason: "rtmp_url_with_key", pattern: /^rtmps?:\/\/[^\s]+\/[^\s?&]+[?&](key|token|secret|stream_key)=/i },
  { reason: "long_random_string", pattern: /\b(?=[A-Za-z0-9_-]{28,}\b)(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[A-Za-z0-9_-]+\b/ },
];

export function validateLiveSecretRedaction(value: unknown, fieldName = "unknown"): LiveSecretRedactionResult {
  const stringValue = typeof value === "string" ? value.trim() : "";
  const detectedReasons = stringValue
    ? secretLikePatterns.filter((entry) => entry.pattern.test(stringValue)).map((entry) => entry.reason)
    : [];
  const detectedSecretLikeValue = detectedReasons.length > 0;

  return {
    fieldName,
    valuePresent: stringValue.length > 0,
    detectedSecretLikeValue,
    detectedReasons,
    redactedValue: redactValue(stringValue, detectedSecretLikeValue),
    shouldRejectRealSecret: true,
    storageAllowed: false,
    logAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_SECRET_REDACTION_VALIDATOR_DECISION_ROLE,
  };
}

export function redactValue(value: string, detectedSecretLikeValue = true): string {
  if (!value) return "";
  if (!detectedSecretLikeValue) return "[REDACTED_PREVIEW]";
  return "[REDACTED_SECRET_LIKE_VALUE]";
}

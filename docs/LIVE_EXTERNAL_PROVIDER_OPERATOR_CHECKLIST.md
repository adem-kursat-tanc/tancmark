# Live external provider operator checklist

The local TancMark Live core does not require YouTube, Twitch, Facebook, TikTok, Instagram, custom RTMP, CDN or webhook access. Those integrations are user-configured adapters.

Before enabling an adapter:

1. Keep `PROTECTED_TANCMARK` as the authoritative source. An adapter failure must never cause an unwatermarked fallback.
2. Use `config/live-external-providers.schema.json`. Do not add fields for raw tokens, stream keys, API keys or passwords.
3. Store credentials in an operator-owned secret manager and pass only an opaque `credentialReference`.
4. Require `rtmps://` for media push and `https://` for HTTPS providers.
5. Verify provider terms, account ownership, OAuth scopes, rate limits and broadcast approval.
6. Redact endpoints and credential references from logs, API responses and evidence ZIPs.
7. Test with non-customer media in an isolated account. Confirm wrong tenant and revoked credentials fail closed.
8. Define stop, revoke/rotate, retry-limit and incident procedures before a real broadcast.
9. Keep provider transport evidence separate from TancMark identity. A provider receipt cannot open ownership or VAULT.
10. Record external tests as `SKIPPED_EXTERNAL_CONFIGURATION_REQUIRED` until the operator supplies configuration and performs them.

Canonical status: `EXTERNAL_PROVIDER_INTEGRATIONS_USER_CONFIGURED_NOT_PRODUCT_GAP`.

/**
 * Forensic Beacon — opt-in transparent-pixel attribution.
 *
 * The beacon is a 1×1 transparent GIF served at a stable URL
 * (`/aegis/beacon/{beaconId}.gif`). When a markdown / HTML renderer
 * loads the cloaked content elsewhere on the public web, the GIF
 * fires and we record a `beacon_pings` row so the operator can see
 * which domains are republishing the content.
 *
 * KVKK / GDPR posture (this module enforces the storage-side guard):
 *   - never accept raw IP / UA in storage; only HMAC-truncated digests
 *   - the salt is dated (UTC week), so cross-week correlation is hard
 *   - Referer is reduced to host-only (no path / query)
 *
 * Embedding format:
 *   markdown image at the END of the cloaked text:
 *     `![](https://<host>/aegis/beacon/{beaconId}.gif)`
 *   The image is invisible (1×1 transparent) so it does not affect
 *   the rendered output of the cloaked content.
 *
 * Limitation: pure-text reposts (Notepad, plain SMS) won't fire the
 * beacon. For those, the canary + structuralEntanglement layers do
 * the attribution.
 */

import { createHmac, randomBytes } from "node:crypto";

/** 1×1 transparent GIF (43 bytes). Constant — no need to regenerate. */
export const TRANSPARENT_GIF_1X1: Buffer = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/** URL-safe 22-char beacon id (16 random bytes, base64url, no padding). */
export function generateBeaconId(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Append the beacon image at the end of the cloaked text. We keep it
 * on its own line so it doesn't interfere with paragraph spacing.
 */
export function embedBeaconMarkdown(cloakedText: string, beaconUrl: string): string {
  const sep = cloakedText.endsWith("\n") ? "" : "\n";
  return `${cloakedText}${sep}\n![](${beaconUrl})`;
}

/**
 * Hash a sensitive value (IP or UA) for storage. Salted with both
 * `secret` and the current UTC week so:
 *   - we can't reverse-look up an IP from the hash
 *   - week-over-week correlation requires brute-forcing the prior salt
 */
export function hashForStorage(value: string, secret: string, now: Date = new Date()): string {
  const week = isoWeekSalt(now);
  return createHmac("sha256", secret)
    .update(`${week}\u241F${value}`)
    .digest("hex")
    .slice(0, 16);
}

function isoWeekSalt(d: Date): string {
  // ISO-8601 week. Good enough granularity for rate-limiting / dedupe
  // while preventing long-term cross-correlation.
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Reduce a Referer header to its host. We deliberately drop the path,
 * query, and fragment because (a) they often contain user data and
 * (b) host-only is enough to populate the Distribution Map.
 */
export function refererToHost(referer: string | undefined | null): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return u.hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

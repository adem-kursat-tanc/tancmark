/**
 * Legal Timestamping via OpenTimestamps calendar servers.
 *
 * Pure-Node implementation that talks the OTS calendar HTTP protocol
 * directly (no `javascript-opentimestamps` dependency, which has
 * fragile Node-version compat). We submit a SHA-256 digest, store the
 * raw receipt bytes, and later re-fetch via `/timestamp/{hex}` once
 * the receipt has been upgraded with a Bitcoin attestation.
 *
 * What this proves:
 *   - The calendar server signed and timestamped the digest at a
 *     specific moment, then merged it into a Merkle root which was
 *     periodically committed to the Bitcoin block chain.
 *   - Any third party with the digest + receipt bytes + the public
 *     `ots verify` tooling can independently confirm that the digest
 *     existed before block N (priority of authorship).
 *
 * What this does NOT do:
 *   - Parse OTS receipt internals. We treat receipt bytes as opaque.
 *   - Wait for the BTC anchor (3-6 hours typical).
 */

import { createHash } from "node:crypto";

export const DEFAULT_OTS_CALENDARS: ReadonlyArray<string> = [
  "https://a.pool.opentimestamps.org",
  "https://b.pool.opentimestamps.org",
  "https://alice.btc.calendar.opentimestamps.org",
];

export interface SubmitOptions {
  /** Override the calendar list (mostly for tests). */
  calendars?: ReadonlyArray<string>;
  /** Per-calendar timeout in ms (default 5000). */
  timeoutMs?: number;
  /** Inject a custom fetch (used by tests with no network). */
  fetchImpl?: typeof fetch;
}

export interface CalendarReceipt {
  calendar: string;
  status: "pending" | "btc" | "error";
  proofB64?: string;
  error?: string;
  fetchedAt: string;
}

/** SHA-256 hex digest of an arbitrary string payload (UTF-8). */
export function digestPayload(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Submit a digest to one or more OTS calendar servers. Returns one
 * receipt per calendar. Network errors surface as `status: "error"`
 * (we never throw — this is fire-and-forget from cloak/protect paths).
 *
 * The OTS calendar protocol:
 *   POST /digest          body: 32 raw bytes (the SHA-256 digest)
 *   ↳ 200 + binary OTS proof bytes (initial pending receipt)
 *
 * We store the raw bytes base64-encoded; verifying them is left to
 * the standard `ots` toolchain (we also expose a verify endpoint
 * that re-fetches the upgraded version).
 */
export async function submitDigest(
  digestHex: string,
  opts: SubmitOptions = {},
): Promise<CalendarReceipt[]> {
  if (!/^[0-9a-f]{64}$/i.test(digestHex)) {
    throw new Error("submitDigest: digestHex must be 64 hex chars (SHA-256)");
  }
  const calendars = opts.calendars ?? DEFAULT_OTS_CALENDARS;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const f = opts.fetchImpl ?? fetch;
  const digestBytes = Buffer.from(digestHex, "hex");

  const results = await Promise.all(
    calendars.map(async (cal): Promise<CalendarReceipt> => {
      const fetchedAt = new Date().toISOString();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await f(`${cal.replace(/\/$/, "")}/digest`, {
          method: "POST",
          body: digestBytes,
          headers: { "Content-Type": "application/octet-stream" },
          signal: ctl.signal,
        });
        if (!r.ok) {
          return {
            calendar: cal,
            status: "error",
            error: `HTTP ${r.status}`,
            fetchedAt,
          };
        }
        const buf = Buffer.from(await r.arrayBuffer());
        return {
          calendar: cal,
          status: "pending",
          proofB64: buf.toString("base64"),
          fetchedAt,
        };
      } catch (e) {
        return {
          calendar: cal,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
          fetchedAt,
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return results;
}

/**
 * Try to upgrade a pending receipt by fetching `/timestamp/{hex}`. If
 * the calendar has merged the digest into a Bitcoin-anchored Merkle
 * root, the response body will be a different (longer) proof. We
 * heuristically classify status by length difference.
 */
export async function upgradeReceipt(
  digestHex: string,
  receipt: CalendarReceipt,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<CalendarReceipt> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const f = opts.fetchImpl ?? fetch;
  const fetchedAt = new Date().toISOString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await f(
      `${receipt.calendar.replace(/\/$/, "")}/timestamp/${digestHex.toLowerCase()}`,
      { signal: ctl.signal },
    );
    if (r.status === 404) {
      return { ...receipt, status: "pending", fetchedAt };
    }
    if (!r.ok) {
      return { ...receipt, status: "error", error: `HTTP ${r.status}`, fetchedAt };
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const upgradedB64 = buf.toString("base64");
    // A BTC-anchored proof is always longer than the initial pending
    // receipt (it carries additional Merkle path bytes).
    const initialLen = receipt.proofB64
      ? Buffer.from(receipt.proofB64, "base64").length
      : 0;
    const isUpgraded = buf.length > initialLen + 16;
    return {
      calendar: receipt.calendar,
      status: isUpgraded ? "btc" : "pending",
      proofB64: upgradedB64,
      fetchedAt,
    };
  } catch (e) {
    return {
      ...receipt,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      fetchedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Quick boolean: has any calendar receipt reached BTC anchor status? */
export function isBtcAnchored(receipts: ReadonlyArray<CalendarReceipt>): boolean {
  return receipts.some((r) => r.status === "btc");
}

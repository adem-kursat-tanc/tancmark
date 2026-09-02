/**
 * In-memory sliding-window per-key request counter. Used by the bot
 * detector to tell "this caller is hammering us" from "first request".
 *
 * Intentionally NOT persisted: rate state is ephemeral and per-process,
 * which is fine for the demo and for forensic-grade hints (we mainly want
 * "is this a flood?"). The map self-prunes old entries on each touch.
 */

const WINDOW_MS = 60_000;
const MAX_KEYS = 5_000;
const buckets = new Map<string, number[]>();

function prune(arr: number[], cutoff: number): number[] {
  // arr is monotonic-non-decreasing (timestamps); find first index >= cutoff.
  let i = 0;
  while (i < arr.length && arr[i]! < cutoff) i++;
  return i === 0 ? arr : arr.slice(i);
}

/**
 * Record one request for `key` and return the count (including this one)
 * within the trailing `WINDOW_MS`.
 */
export function tickAndCount(key: string): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const existing = buckets.get(key);
  const pruned = existing ? prune(existing, cutoff) : [];
  pruned.push(now);
  buckets.set(key, pruned);

  // Bound memory in pathological cases.
  if (buckets.size > MAX_KEYS) {
    const firstKey = buckets.keys().next().value;
    if (firstKey !== undefined) buckets.delete(firstKey);
  }
  return pruned.length;
}

/** Test/diag helper. */
export function _resetRateTrackerForTests(): void {
  buckets.clear();
}

/**
 * Canary Radar — proactive public-web scanner for honeytoken leaks.
 *
 * Canary Radar is opt-in. The API route keeps live third-party searches off
 * unless `AEGIS_CANARY_RADAR_ENABLED=true` is set. When enabled, adapters send
 * only canary/honeytoken trace text as search queries; file contents are never
 * sent to Google, GitHub, or another external service. Operators must disclose
 * that opt-in query behavior where KVKK/customer notice applies.
 *
 * Given the set of honeytoken `fakeValue`s we've embedded into customer
 * documents, this module:
 *  1. Picks the *searchable* values (emails / phones / org tokens; we
 *     skip dates, percentages, and numeric jitter because their value
 *     space is too small and collides on the open web).
 *  2. Asks each configured source adapter (Google CSE, GitHub code,
 *     manual paste, …) for matching pages.
 *  3. Verifies each candidate page actually contains the value as a
 *     substring (not just a fuzzy snippet match).
 *  4. Returns hits with a confidence tier — `high` only if the value
 *     is unique to a single client (false-accusation guard), else
 *     `medium`.
 *
 * No persistence here — the route layer owns the DB.
 */

export type RadarSourceName = "google_cse" | "github_code" | "manual";

export interface RadarHoneytoken {
  id: number;
  clientId: string;
  /**
   * Hash of the carrier doc the honeytoken was embedded into. Joins to
   * `cloaked_documents.protection_hash` so a hit can be backfilled with
   * the originating `docId` / `cloakId`.
   */
  protectionHash?: string | null;
  kind: string;
  fakeValue: string;
}

export interface RadarSearchResult {
  url: string;
  title?: string;
  snippet?: string;
  /** Optional full body for verification. If absent, snippet is used. */
  body?: string;
  /**
   * Adapter has already enforced an exact-substring match server-side
   * (e.g. GitHub code search with `"value"` quoted query). When true,
   * `verifyResults` lets the row through without snippet inspection.
   */
  preVerified?: boolean;
}

export interface RadarAdapter {
  name: RadarSourceName;
  isConfigured(): boolean;
  search(query: string, limit: number): Promise<RadarSearchResult[]>;
}

export interface RadarVerifiedHit {
  source: RadarSourceName;
  url: string;
  title: string | null;
  snippet: string | null;
  matchedValue: string;
  matchedKind: string;
  clientId: string;
  cloakId: string | null;
  docId: string | null;
  confidence: "high" | "medium";
}

/**
 * Honeytoken `kind`s whose fakeValues are distinctive enough to search
 * for on the open web without drowning in false positives.
 */
const SEARCHABLE_KINDS = new Set(["email", "phone", "org"]);

/**
 * Pick searchable values + tag duplicates. A value present for ≥2
 * clients can never produce a `high`-confidence hit (mirror of the
 * analyze-text false-accusation guard).
 */
export function buildSearchPlan(
  honeytokens: ReadonlyArray<RadarHoneytoken>,
): {
  queries: Array<{ value: string; kind: string; isUnique: boolean; tokens: RadarHoneytoken[] }>;
} {
  const byValue = new Map<string, RadarHoneytoken[]>();
  for (const ht of honeytokens) {
    if (!SEARCHABLE_KINDS.has(ht.kind)) continue;
    if (typeof ht.fakeValue !== "string" || ht.fakeValue.length < 5) continue;
    const arr = byValue.get(ht.fakeValue) ?? [];
    arr.push(ht);
    byValue.set(ht.fakeValue, arr);
  }
  const queries: Array<{
    value: string;
    kind: string;
    isUnique: boolean;
    tokens: RadarHoneytoken[];
  }> = [];
  for (const [value, tokens] of byValue) {
    const distinctClients = new Set(tokens.map((t) => t.clientId));
    queries.push({
      value,
      kind: tokens[0]!.kind,
      isUnique: distinctClients.size === 1,
      tokens,
    });
  }
  return { queries };
}

/** Lower-cased substring check (the open web normalises emails/phones). */
export function valueAppearsIn(value: string, content: string): boolean {
  if (!content) return false;
  return content.toLowerCase().includes(value.toLowerCase());
}

/**
 * Verify a list of search results against a single honeytoken value.
 * Drops results whose URL/snippet/body never actually contains the
 * value (search engines fuzz-match too aggressively).
 */
export function verifyResults(
  results: ReadonlyArray<RadarSearchResult>,
  value: string,
): RadarSearchResult[] {
  return results.filter(
    (r) =>
      r.preVerified === true ||
      valueAppearsIn(value, `${r.title ?? ""}\n${r.snippet ?? ""}\n${r.body ?? ""}`),
  );
}

/* -------------------------------------------------------------------------- */
/* Adapters — every adapter MUST gracefully report `isConfigured = false`     */
/* if its env keys are missing, so the API server can still run.              */
/* -------------------------------------------------------------------------- */

/**
 * Google Programmable Search Engine adapter.
 * Requires `GOOGLE_CSE_KEY` and `GOOGLE_CSE_CX` env vars.
 */
export function googleCseAdapter(env: NodeJS.ProcessEnv): RadarAdapter {
  const key = env["GOOGLE_CSE_KEY"];
  const cx = env["GOOGLE_CSE_CX"];
  return {
    name: "google_cse",
    isConfigured: () => Boolean(key && cx),
    async search(query, limit) {
      if (!key || !cx) return [];
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", key);
      url.searchParams.set("cx", cx);
      url.searchParams.set("q", `"${query}"`);
      url.searchParams.set("num", String(Math.min(limit, 10)));
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const j = (await r.json()) as {
        items?: Array<{ link?: string; title?: string; snippet?: string }>;
      };
      return (j.items ?? [])
        .filter((it): it is { link: string; title?: string; snippet?: string } =>
          typeof it.link === "string",
        )
        .map((it) => ({
          url: it.link,
          ...(typeof it.title === "string" ? { title: it.title } : {}),
          ...(typeof it.snippet === "string" ? { snippet: it.snippet } : {}),
        }));
    },
  };
}

/**
 * GitHub code-search adapter (matches gists + public repos).
 * Requires `GITHUB_TOKEN` env var (any classic PAT with `public_repo`).
 */
export function githubCodeAdapter(env: NodeJS.ProcessEnv): RadarAdapter {
  const token = env["GITHUB_TOKEN"];
  return {
    name: "github_code",
    isConfigured: () => Boolean(token),
    async search(query, limit) {
      if (!token) return [];
      const url = new URL("https://api.github.com/search/code");
      url.searchParams.set("q", `"${query}"`);
      url.searchParams.set("per_page", String(Math.min(limit, 10)));
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return [];
      const j = (await r.json()) as {
        items?: Array<{ html_url?: string; name?: string; path?: string }>;
      };
      return (j.items ?? [])
        .filter((it): it is { html_url: string; name?: string; path?: string } =>
          typeof it.html_url === "string",
        )
        .map((it) => ({
          url: it.html_url,
          ...(typeof it.name === "string" || typeof it.path === "string"
            ? { title: `${it.name ?? ""} ${it.path ?? ""}`.trim() }
            : {}),
          // GitHub `?q="value"` is an exact-substring match server-side;
          // results have no snippet so we trust the API rather than drop
          // every hit at the snippet-verify step.
          preVerified: true,
        }));
    },
  };
}

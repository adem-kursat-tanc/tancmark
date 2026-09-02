/**
 * Bot / AI-scraper detector. Pure function (no I/O) — the caller is
 * responsible for sourcing request headers and any rate-tracking state.
 *
 * The detector returns a 0..1 confidence `score`, a coarse `verdict`
 * (`human` | `suspected` | `bot`), and the list of `signals` that fired
 * so a UI can show *why* a request was flagged.
 */

export interface BehaviorSignals {
  /**
   * Number of mouse-move / pointer events recorded by the client SDK
   * during the dwell window (default 0). Real humans typically emit ≥1
   * within a few seconds; headless scrapers emit 0.
   */
  mouseEvents?: number;
  /**
   * Time (ms) the visitor spent on the page before the request was issued.
   * Bots typically fire requests immediately; humans dwell.
   */
  dwellMs?: number;
  /**
   * Median delay between consecutive requests from this source (ms).
   * Bots show very regular intervals; humans vary widely.
   */
  requestIntervalMs?: number;
  /**
   * Stddev of request intervals (ms). Very low stddev → robotic cadence.
   */
  requestIntervalStddevMs?: number;
}

export interface BotDetectInput {
  /** Raw User-Agent header value. */
  userAgent?: string | undefined;
  /** Lower-case keyed header map. Values may be string or string[]. */
  headers?: Record<string, string | string[] | undefined>;
  /** Recent request count from the same source (e.g. last 60s). */
  recentRequests?: number;
  /** Optional behavioral telemetry from the client SDK. */
  behavior?: BehaviorSignals;
  /** Hard override — useful for demos and tests. */
  forceVerdict?: "bot" | "human";
}

export type BotVerdict = "human" | "suspected" | "bot";

export interface BotDetectResult {
  isBot: boolean;
  score: number;
  verdict: BotVerdict;
  signals: string[];
}

/**
 * Patterns matched against the User-Agent. A single match contributes the
 * full UA-pattern weight (we stop after the first hit to avoid stacking).
 */
const BOT_UA_PATTERNS: ReadonlyArray<RegExp> = [
  /gptbot/i,
  /chatgpt/i,
  /openai/i,
  /anthropic/i,
  /claude(?:bot|-|\b)/i,
  /perplexity/i,
  /\bcohere\b/i,
  /\bbingbot\b/i,
  /\bgooglebot\b/i,
  /\bduckduckbot\b/i,
  /\b(bot|crawler|spider|scraper)\b/i,
  /headless/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /\bcurl\//i,
  /\bwget\//i,
  /python-requests/i,
  /python-urllib/i,
  /\baxios\//i,
  /node-fetch/i,
  /\bgo-http-client/i,
  /java\/\d/i,
  /okhttp/i,
  /httpclient/i,
];

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  if (!headers) return undefined;
  const v = headers[key.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Run the multi-signal bot heuristic. The score is clamped to [0,1].
 *
 * Verdict thresholds:
 *  - score ≥ 0.6 → `bot`
 *  - score ≥ 0.3 → `suspected`
 *  - else        → `human`
 */
export function detectBot(input: BotDetectInput = {}): BotDetectResult {
  if (input.forceVerdict === "bot") {
    return { isBot: true, score: 1, verdict: "bot", signals: ["forced:bot"] };
  }
  if (input.forceVerdict === "human") {
    return { isBot: false, score: 0, verdict: "human", signals: ["forced:human"] };
  }

  const ua = (input.userAgent ?? "").trim();
  const signals: string[] = [];
  let score = 0;

  if (ua.length === 0) {
    score += 0.4;
    signals.push("ua-empty");
  } else if (ua.length < 12) {
    score += 0.2;
    signals.push("ua-suspiciously-short");
  }

  for (const re of BOT_UA_PATTERNS) {
    if (re.test(ua)) {
      score += 0.6;
      signals.push(`ua-pattern:${re.source}`);
      break;
    }
  }

  if (!headerValue(input.headers, "accept-language")) {
    score += 0.15;
    signals.push("no-accept-language");
  }
  const accept = headerValue(input.headers, "accept") ?? "";
  if (accept.length === 0 || accept === "*/*") {
    score += 0.1;
    signals.push("accept-vague");
  }
  if (!headerValue(input.headers, "sec-ch-ua") && /chrom(?:e|ium)\/\d/i.test(ua)) {
    score += 0.15;
    signals.push("missing-sec-ch-ua-on-chrome-ua");
  }
  if (
    !headerValue(input.headers, "referer") &&
    !headerValue(input.headers, "sec-fetch-site") &&
    !headerValue(input.headers, "origin")
  ) {
    score += 0.05;
    signals.push("no-referer-no-secfetch-no-origin");
  }

  const rate = input.recentRequests ?? 0;
  if (rate > 60) {
    score += 0.3;
    signals.push(`rate-very-high:${rate}`);
  } else if (rate > 20) {
    score += 0.15;
    signals.push(`rate-elevated:${rate}`);
  }

  // Behavioral signals — strong negative weight when the client SDK
  // confirms human-like interaction; positive weight on robotic cadence.
  const behavior = input.behavior;
  if (behavior) {
    if ((behavior.mouseEvents ?? 0) >= 3 && (behavior.dwellMs ?? 0) >= 800) {
      score -= 0.3;
      signals.push(
        `behavior-human:mouse=${behavior.mouseEvents},dwell=${behavior.dwellMs}ms`,
      );
    } else if ((behavior.mouseEvents ?? 0) === 0 && (behavior.dwellMs ?? 0) < 200) {
      score += 0.2;
      signals.push("behavior-no-mouse-no-dwell");
    }
    const interval = behavior.requestIntervalMs;
    const stddev = behavior.requestIntervalStddevMs;
    if (
      typeof interval === "number" &&
      typeof stddev === "number" &&
      interval > 0 &&
      stddev / interval < 0.05 &&
      interval < 3000
    ) {
      score += 0.25;
      signals.push(`behavior-robotic-cadence:interval=${interval}ms,cv=${(stddev / interval).toFixed(3)}`);
    }
  }

  if (score < 0) score = 0;
  if (score > 1) score = 1;

  let verdict: BotVerdict;
  if (score >= 0.6) verdict = "bot";
  else if (score >= 0.3) verdict = "suspected";
  else verdict = "human";

  return { isBot: verdict === "bot", score, verdict, signals };
}

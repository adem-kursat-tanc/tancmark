import { lookupSynonym, shuffleByClient, TR_WORD_RE } from "./linguisticShuffler.js";
import { type BreachSignalBus, SENSITIVITY_BOOST } from "./breachSignal.js";

/**
 * One observation of a "trap word" in a piece of text. A trap word is any
 * word that belongs to one of the tracked Turkish synonym groups.
 *
 * `chosenIdx` is the index inside the group's options array of the form that
 * actually appears in the text — i.e. the writer's choice. Combined with
 * `(groupId, occurrence)` this forms a positional fingerprint that we can
 * compare across candidates.
 */
export interface TrapToken {
  groupId: number;
  occurrence: number;
  chosenIdx: number;
  word: string;
  index: number;
}

/**
 * Walk a text and collect every word that lands in a synonym group, recording
 * which option of the group was used and the per-group occurrence counter
 * (so the n-th time group G appears can be aligned across candidates).
 */
export function extractTrapTokens(text: string): TrapToken[] {
  const tokens: TrapToken[] = [];
  const occByGroup = new Map<number, number>();
  // Re-create the regex so we don't share lastIndex with other callers.
  const re = new RegExp(TR_WORD_RE.source, TR_WORD_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    const hit = lookupSynonym(word);
    if (!hit) continue;
    const occ = occByGroup.get(hit.groupId) ?? 0;
    occByGroup.set(hit.groupId, occ + 1);
    const lower = word.toLocaleLowerCase("tr");
    const chosenIdx = hit.options.findIndex(
      (opt) => opt.toLocaleLowerCase("tr") === lower,
    );
    if (chosenIdx < 0) continue;
    tokens.push({
      groupId: hit.groupId,
      occurrence: occ,
      chosenIdx,
      word,
      index: m.index,
    });
  }
  return tokens;
}

export interface CandidateMatch {
  clientId: string;
  matchedTokens: number;
  totalTokens: number;
  confidenceScore: number;
}

export interface ForensicResult {
  /** Best-matching client, or null if no trap words were found. */
  suspectedClientId: string | null;
  confidenceScore: number;
  matchedTokens: number;
  totalTokens: number;
  /** All candidates ranked by confidence, descending. */
  candidates: CandidateMatch[];
}

export interface AnalyzeOptions {
  /** Required to drive the deterministic shuffler when reproducing each candidate. */
  secret: string;
  /** Minimum number of trap-word matches needed to nominate a `suspectedClientId`. */
  minMatches?: number;
  /**
   * Per-call BreachSignalBus (AEGIS v4.0). Yalnızca synonym kanalında
   * `linguistic_dna_paraphrased` sinyali yayınlamak için kullanılır;
   * karar mantığı değişmez. Verilmezse hiçbir sinyal yayınlanmaz.
   */
  signals?: BreachSignalBus;
  /** Yayınlanan sinyallerde context.docId olarak surface edilir. */
  docId?: string;
}

/**
 * Forensic attribution. For each candidate clientId we re-run
 * `shuffleByClient` against the suspect text, extract its trap-token sequence,
 * and align position-by-position (keyed on `groupId|occurrence`) against the
 * suspect's own sequence. The best fraction wins.
 *
 * Re-using `shuffleByClient` keeps this in lock-step with the producer side:
 * if the synonym map or HMAC scheme ever changes, the analyzer auto-updates.
 */
export function analyzeText(
  suspectText: string,
  candidateClientIds: ReadonlyArray<string>,
  opts: AnalyzeOptions,
): ForensicResult {
  const suspectTokens = extractTrapTokens(suspectText);
  const totalTokens = suspectTokens.length;
  const minMatches = opts.minMatches ?? 1;

  const seen = new Set<string>();
  const scored: CandidateMatch[] = [];

  for (const candidateRaw of candidateClientIds) {
    const candidate = String(candidateRaw);
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    if (totalTokens === 0) {
      scored.push({
        clientId: candidate,
        matchedTokens: 0,
        totalTokens: 0,
        confidenceScore: 0,
      });
      continue;
    }

    const expected = shuffleByClient(suspectText, candidate, { secret: opts.secret });
    const expectedTokens = extractTrapTokens(expected.text);
    const expectedMap = new Map<string, number>();
    for (const t of expectedTokens) {
      expectedMap.set(`${t.groupId}|${t.occurrence}`, t.chosenIdx);
    }

    let matched = 0;
    for (const t of suspectTokens) {
      const expectedIdx = expectedMap.get(`${t.groupId}|${t.occurrence}`);
      if (expectedIdx !== undefined && expectedIdx === t.chosenIdx) matched++;
    }

    scored.push({
      clientId: candidate,
      matchedTokens: matched,
      totalTokens,
      confidenceScore: matched / totalTokens,
    });
  }

  scored.sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return b.matchedTokens - a.matchedTokens;
  });

  const best = scored[0];
  const suspectedClientId =
    best && best.matchedTokens >= minMatches ? best.clientId : null;

  // BreachSignal: synonym kanalı düşük ama bazı match var → paraphrase ipucu.
  if (
    opts.signals &&
    best &&
    best.totalTokens > 0 &&
    best.matchedTokens > 0 &&
    best.confidenceScore < SENSITIVITY_BOOST.linguisticDnaNormal
  ) {
    const ctx: { clientId: string; docId?: string; synScore: number } = {
      clientId: best.clientId,
      synScore: best.confidenceScore,
    };
    if (opts.docId) ctx.docId = opts.docId;
    opts.signals.emitSignal({
      type: "linguistic_dna_paraphrased",
      severity: "medium",
      source: "analyzeText",
      context: ctx,
    });
  }

  return {
    suspectedClientId,
    confidenceScore: best?.confidenceScore ?? 0,
    matchedTokens: best?.matchedTokens ?? 0,
    totalTokens,
    candidates: scored,
  };
}

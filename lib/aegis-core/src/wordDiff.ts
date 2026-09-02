// Word-level diff using a classic LCS table. Used by both the dashboard
// "Visual Diff" component and the PDF "Fark Analizi" evidence block.
//
// Operates on whitespace-split tokens (preserving casing/punctuation in the
// token text itself). Returns an ordered op stream + summary counts.

export type DiffOp = "equal" | "add" | "remove";

export interface DiffEntry {
  /**
   * "equal" — token present in both sides at this aligned position.
   * "add"   — token present only in the suspect (b) side.
   * "remove"— token present only in the protected (a) side.
   */
  op: DiffOp;
  text: string;
}

export interface DiffResult {
  entries: DiffEntry[];
  added: number;
  removed: number;
  unchanged: number;
  /**
   * Jaccard-like similarity = unchanged / (unchanged + added + removed).
   * Range [0, 1]. Returns 1 when both sides are empty.
   */
  similarity: number;
}

const TOKEN_RE = /\S+/g;

function tokenize(text: string): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const out = text.match(TOKEN_RE);
  return out ? Array.from(out) : [];
}

/**
 * Diff two texts at the word level. `a` is treated as the *protected/original*
 * and `b` as the *suspect/leaked* version. Words present only in `b` are
 * "add"; words present only in `a` are "remove".
 *
 * Implementation: LCS DP over Uint16 cells (cap at 800 tokens per side to
 * keep memory bounded — beyond that we fall back to a streaming positional
 * compare which is less precise but constant memory).
 */
export function diffWords(a: string, b: string): DiffResult {
  const aToks = tokenize(a);
  const bToks = tokenize(b);

  const MAX_DP = 800;
  if (aToks.length > MAX_DP || bToks.length > MAX_DP) {
    return positionalDiff(aToks, bToks);
  }

  const m = aToks.length;
  const n = bToks.length;
  // dp[i][j] = LCS length of aToks[0..i] vs bToks[0..j].
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aToks[i - 1] === bToks[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const entries: DiffEntry[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aToks[i - 1] === bToks[j - 1]) {
      entries.push({ op: "equal", text: aToks[i - 1]! });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      entries.push({ op: "remove", text: aToks[i - 1]! });
      i--;
    } else {
      entries.push({ op: "add", text: bToks[j - 1]! });
      j--;
    }
  }
  while (i > 0) {
    entries.push({ op: "remove", text: aToks[i - 1]! });
    i--;
  }
  while (j > 0) {
    entries.push({ op: "add", text: bToks[j - 1]! });
    j--;
  }
  entries.reverse();

  return summarize(entries);
}

function positionalDiff(aToks: string[], bToks: string[]): DiffResult {
  const max = Math.max(aToks.length, bToks.length);
  const entries: DiffEntry[] = [];
  for (let k = 0; k < max; k++) {
    const ax = aToks[k];
    const bx = bToks[k];
    if (ax !== undefined && bx !== undefined) {
      if (ax === bx) entries.push({ op: "equal", text: ax });
      else {
        entries.push({ op: "remove", text: ax });
        entries.push({ op: "add", text: bx });
      }
    } else if (ax !== undefined) {
      entries.push({ op: "remove", text: ax });
    } else if (bx !== undefined) {
      entries.push({ op: "add", text: bx });
    }
  }
  return summarize(entries);
}

function summarize(entries: DiffEntry[]): DiffResult {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const e of entries) {
    if (e.op === "add") added++;
    else if (e.op === "remove") removed++;
    else unchanged++;
  }
  const denom = added + removed + unchanged;
  const similarity = denom === 0 ? 1 : unchanged / denom;
  return { entries, added, removed, unchanged, similarity };
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
  similarity: number;
  /** Optional sample of recent diff entries for display (capped). */
  sample?: DiffEntry[];
}

/** Project a full DiffResult down to a payload-friendly summary. */
export function summarizeDiff(result: DiffResult, sampleLimit = 60): DiffSummary {
  return {
    added: result.added,
    removed: result.removed,
    unchanged: result.unchanged,
    similarity: result.similarity,
    sample: result.entries.slice(0, sampleLimit),
  };
}

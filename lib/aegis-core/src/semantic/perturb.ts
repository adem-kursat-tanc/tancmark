/**
 * Whitelist-safe perturbation operatörleri (Faz 4 kalibrasyon onaylı):
 *   - punctuation: cümle sonu nokta toggle (cos μ ≈ 0.010, %100 uygulanabilir).
 *   - casing: bağlaç (ve/ile/veya/fakat/ancak) ilk harf büyütme
 *     (cos μ ≈ 0.005, ~%28 uygulanabilir).
 *
 * Her operatör fidelity-preserving: insan gözüyle anlam değişmez.
 * IMPRACTICAL operatörler (zero_width, whitespace) kalibrasyon raporunda
 * elendiği için BURAYA dahil DEĞİL.
 *
 * Variant üretimi: 4 olası kombinasyon (identity, +punct, +casing, +pc)
 * → uygulanabilir olanları döndürür.
 */

import type { SemanticOpName } from "./types.js";

const SENT_END = /[.!?]$/;

function endsWithSentencePunct(t: string): boolean {
  return SENT_END.test(t.trim());
}

const PUNCTUATION = {
  name: "punctuation" as SemanticOpName,
  applicable: (_t: string) => true,
  apply(t: string): string {
    // Split-safe toggle: cümle sonu sınırlayıcısı (`.`,`!`,`?`) korunur,
    // sadece "tek" → "duplike" arasında geçiş yapılır. Böylece
    // `(?<=[.!?])\s+` splitter'ı suspect tarafta da aynı cümle sayısına böler.
    const trimmed = t.replace(/\s+$/u, "");
    // ".." / "!!" / "??" zaten varsa tekle.
    if (/[.!?]{2,}$/.test(trimmed)) {
      return trimmed.slice(0, -1);
    }
    if (endsWithSentencePunct(trimmed)) {
      // Aynı sınırlayıcıyı duplike et: "X." -> "X..", "Y!" -> "Y!!".
      return trimmed + trimmed.slice(-1);
    }
    return trimmed + ".";
  },
};

const CASING_RE = /(\s)(ve|ile|veya|ya da|fakat|ancak)(\s)/iu;
const CASING = {
  name: "casing" as SemanticOpName,
  applicable: (t: string) => CASING_RE.test(t),
  apply(t: string): string {
    return t.replace(
      CASING_RE,
      (_m, a: string, w: string, b: string) =>
        a + (w[0] ?? "").toLocaleUpperCase("tr-TR") + w.slice(1) + b,
    );
  },
};

export const SEMANTIC_OPERATORS = [PUNCTUATION, CASING] as const;

export interface SemanticVariant {
  ops: SemanticOpName[];
  text: string;
}

/**
 * Bir cümle için tüm uygulanabilir variants (max 4):
 *   - {ops: [],            text: original}
 *   - {ops: [punctuation], text: ...}
 *   - {ops: [casing],      text: ...}        (eğer applicable)
 *   - {ops: [punct,casing],text: ...}        (her ikisi de applicable)
 */
export function generateSemanticVariants(text: string): SemanticVariant[] {
  const out: SemanticVariant[] = [{ ops: [], text }];
  const seen = new Set([text]);
  const apps = SEMANTIC_OPERATORS.filter((op) => op.applicable(text));
  // Tekli
  for (const op of apps) {
    const v = op.apply(text);
    if (!seen.has(v)) {
      out.push({ ops: [op.name], text: v });
      seen.add(v);
    }
  }
  // İkili (sadece punctuation + casing kombinasyonu mümkün)
  if (apps.length === 2) {
    const v = apps[1]!.apply(apps[0]!.apply(text));
    if (!seen.has(v)) {
      out.push({ ops: [apps[0]!.name, apps[1]!.name], text: v });
      seen.add(v);
    }
  }
  return out;
}

/** Verify aşamasında kullanılır: cümleyi kanonik (ops uygulanmamış) hale döndür. */
export function stripSemanticArtifacts(t: string): string {
  // Sonu noktalı normalize et (verify alignment için).
  const trimmed = t.replace(/\s+$/u, "");
  if (endsWithSentencePunct(trimmed)) return trimmed;
  return trimmed; // Boş bırak — verify artifact-tolerant.
}

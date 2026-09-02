// AEGIS Faz 4 Kalibrasyon — Whitelist-safe perturbation operatörleri.
// Tüm operatörler "anlam-koruyan" varsayılır: sadece tipografik / görünmez
// karakter düzeyinde değişiklikler. Türkçe semantik bozulmaması esastır.
//
// Her operatör: { name, applicable(text)->bool, apply(text)->string }
// Hill-climb için her operatör deterministik ve idempotent (toggle) olabilir.

const ZWJ = "\u200D";
const NBSP = "\u00A0";
const EMDASH = " — ";

function endsWithSentencePunct(t) {
  const last = t.trim().slice(-1);
  return last === "." || last === "!" || last === "?";
}

// 1) PUNCTUATION — cümle sonu nokta toggle. Anlam değişmez.
const punctuation = {
  name: "punctuation",
  applicable: (_t) => true,
  apply: (t) => {
    const trimmed = t.replace(/\s+$/u, "");
    if (endsWithSentencePunct(trimmed)) {
      return trimmed.slice(0, -1);
    }
    return trimmed + ".";
  },
};

// 2) WHITESPACE — cümle ortasındaki ilk tek boşluğu NBSP ile değiştir.
//    Görsel olarak boşluk gibi görünür; tokenizer için fark yaratabilir.
const whitespace = {
  name: "whitespace",
  applicable: (t) => t.includes(" "),
  apply: (t) => {
    // Ortada (ilk değil) bir boşluğu NBSP yap.
    const idxs = [];
    for (let i = 0; i < t.length; i++) if (t[i] === " ") idxs.push(i);
    if (idxs.length < 2) return t;
    const target = idxs[Math.floor(idxs.length / 2)];
    return t.slice(0, target) + NBSP + t.slice(target + 1);
  },
};

// 3) CASING — bağlaç "ve" → "Ve" (cümle ortasında). Türkçede bir bağlacı
//    büyük harfle yazmak imla dışı ama anlam korur. Modelin embedding'inde
//    küçük bir kayma yaratması beklenir. Yoksa "ile"/"ya da" denenir.
const casing = {
  name: "casing",
  applicable: (t) => /\s(ve|ile|veya|ya da|fakat|ancak)\s/iu.test(t),
  apply: (t) => {
    return t.replace(
      /(\s)(ve|ile|veya|ya da|fakat|ancak)(\s)/iu,
      (_m, a, w, b) => a + w[0].toUpperCase() + w.slice(1) + b,
    );
  },
};

// 4) ZERO-WIDTH — kelime arasına ZWJ (U+200D) ekle. Görünmez; semantik
//    olarak nötr. Tokenizer karakter sayısını değiştirebilir.
const zeroWidth = {
  name: "zeroWidth",
  applicable: (t) => t.length > 5,
  apply: (t) => {
    // Cümlenin ortasındaki bir boşluk öncesine ZWJ ekle.
    const mid = Math.floor(t.length / 2);
    let i = mid;
    while (i < t.length && t[i] !== " ") i++;
    if (i >= t.length) i = mid;
    return t.slice(0, i) + ZWJ + t.slice(i);
  },
};

// 5) EM-DASH — cümlede ilk virgül varsa " — " ile değiştir. Anlam
//    bozulmaz; stilistik bir nüans.
const emdash = {
  name: "emdash",
  applicable: (t) => t.includes(", "),
  apply: (t) => t.replace(", ", EMDASH),
};

export const PERTURBATIONS = [punctuation, whitespace, casing, zeroWidth, emdash];

// Cümleye uygulanabilir tekli + ikili kombinasyonları üret.
// Toplam: ≤5 tekli + C(5,2)=10 ikili + C(5,3)=10 üçlü = ≤25 varyant.
export function generateVariants(text, maxDepth = 3) {
  const applicable = PERTURBATIONS.filter((op) => op.applicable(text));
  const variants = [];
  const seen = new Set([text]);
  // depth 1
  for (const op of applicable) {
    const v = op.apply(text);
    if (!seen.has(v)) { variants.push({ ops: [op.name], text: v }); seen.add(v); }
  }
  if (maxDepth >= 2) {
    for (let i = 0; i < applicable.length; i++) {
      for (let j = i + 1; j < applicable.length; j++) {
        const a = applicable[i], b = applicable[j];
        const v = b.apply(a.apply(text));
        if (!seen.has(v)) { variants.push({ ops: [a.name, b.name], text: v }); seen.add(v); }
      }
    }
  }
  if (maxDepth >= 3) {
    for (let i = 0; i < applicable.length; i++) {
      for (let j = i + 1; j < applicable.length; j++) {
        for (let k = j + 1; k < applicable.length; k++) {
          const a = applicable[i], b = applicable[j], c = applicable[k];
          const v = c.apply(b.apply(a.apply(text)));
          if (!seen.has(v)) { variants.push({ ops: [a.name, b.name, c.name], text: v }); seen.add(v); }
        }
      }
    }
  }
  return { applicableCount: applicable.length, variants };
}

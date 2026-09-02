import { createHmac, hkdfSync } from "node:crypto";

/**
 * Cascade Hash — AEGIS v4.0 "Sentient Fortress" Faz 2.
 *
 * Metni cümle bazlı parçalayıp her cümleyi bir öncekine kriptografik olarak
 * bağlar:
 *
 *   Hash_N = HMAC-SHA256(tenantSecret, clientId | docId | N | Hash_{N-1} | sentence_norm)
 *
 * Tüm node hash'leri **HMAC-SHA256** üzerinden hesaplanır (digest hex'in
 * ilk 16 byte'ı = 32 hex karakter saklanır). Tenant izolasyonu için
 * `tenantSecret = HKDF-SHA256(masterKey, salt=clientId, info="aegis-cascade-v1")`
 * şeklinde türetilir (Patch v4.0.1). Aynı master key ile farklı clientId'ler
 * cryptographically independent zincirler üretir → bir tenant'ın sızdırdığı
 * chain başka tenant'ın forge etmesine zemin hazırlamaz.
 *
 * Geri-uyumluluk: persisted chain `keyDerivation` meta'sıyla saklanır
 * (`global` = eski, master secret doğrudan HMAC anahtarı; `hkdf-v1` = yeni,
 * tenant-türetilmiş). Verifier meta'ya göre doğru anahtarı seçer; legacy
 * satırlar bozulmaz.
 *
 * Tek bir cümlenin silinmesi/değişmesi tüm zinciri bozar — `verifyCascadeChain`
 * bozulma noktasını, silinen indeksleri, modifiye edilen cümleleri ve yer
 * değiştirmeyi (reorder) raporlar.
 *
 * KRİTİK: Bu modül **yardımcı kanıttır**. Tek başına `suspectedClientId`
 * üretmez, `absoluteBreach=true` yapmaz, multi-suspect korumasını ezmez.
 * Verdict ladder + False-Accusation Guard değişmez.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HKDF tenant secret derivation (Patch v4.0.1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Şu an aktif key derivation şeması. Yeni `buildCascadeChain` çağrıları
 * her zaman `hkdf-v1` üretir; verifier eski `global` zincirleri de okur.
 */
export const ACTIVE_CASCADE_KEY_DERIVATION = "hkdf-v1" as const;
export type CascadeKeyDerivation = "global" | "hkdf-v1";

const HKDF_INFO = "aegis-cascade-v1";
const HKDF_KEYLEN = 32; // 32 byte = 256-bit HMAC anahtarı

/**
 * HKDF-SHA256 ile master key'den tenant'a özel HMAC anahtarı türet.
 *
 * - `ikm` = master secret (UTF-8 byte'ları)
 * - `salt` = clientId (UTF-8 byte'ları) — tenant'ı ayıran kritik alan
 * - `info` = "aegis-cascade-v1" (versionlama; ileride değişirse yeni info)
 * - `length` = 32 byte (HMAC-SHA256 için doğal anahtar boyutu)
 *
 * Dönen değer hex string (HMAC anahtarı olarak doğrudan `createHmac`'a
 * geçirilebilir; createHmac otomatik olarak hex string'i UTF-8 byte
 * olarak kullanır, fakat biz Buffer kullanmayı tercih ediyoruz — daha
 * güvenli, ham byte'larla HMAC).
 */
export function deriveTenantSecret(masterKey: string, clientId: string): Buffer {
  if (!masterKey || masterKey.length < 8) {
    throw new Error("deriveTenantSecret: masterKey must be ≥8 chars");
  }
  if (!clientId || clientId.length === 0) {
    throw new Error("deriveTenantSecret: clientId required (used as salt)");
  }
  const ab = hkdfSync(
    "sha256",
    Buffer.from(masterKey, "utf8"),
    Buffer.from(clientId, "utf8"),
    HKDF_INFO,
    HKDF_KEYLEN,
  );
  return Buffer.from(ab);
}

/**
 * Verify-time anahtar seçimi: stored chain'in `keyDerivation` meta'sına
 * göre ya master key'i doğrudan döndür (`global` legacy), ya da HKDF
 * türetilmiş tenant secret'ı döndür (`hkdf-v1`).
 */
function selectVerifyKey(
  masterKey: string,
  clientId: string,
  keyDerivation: CascadeKeyDerivation,
): Buffer | string {
  if (keyDerivation === "global") return masterKey;
  return deriveTenantSecret(masterKey, clientId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Türkçe abbreviation-aware sentence splitter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Türkçe yaygın kısaltmalar (nokta sonrası cümle bitişi sayılmamalı).
 * Lowercase formda saklanır; karşılaştırma normalize edilmiş tokenle yapılır.
 */
const TR_ABBREVIATIONS: ReadonlySet<string> = new Set([
  "dr", "doç", "prof", "av", "sn", "bay", "bn", "bayan",
  "a.ş", "ltd", "şti", "tic", "san",
  "vb", "vs", "bkz", "örn", "no", "nr",
  "tbmm", "kktc", "abd",
  "m", "cm", "mm", "km", "kg", "gr", "lt", "ml",
  "tl", "usd", "eur",
  "yy", "yüzyıl",
  "bkz", "tar", "haz",
]);

/**
 * Bir nokta/ünlem/soru işaretini gerçek cümle sınırı say. Önündeki tokenin
 * kısaltma olup olmadığına bakar. Türkçe için yeterli, perfect değil ama
 * "Dr.", "A.Ş.", "vb.", "1.5" gibi yaygın kalıpları kapsar.
 */
function isSentenceBoundary(text: string, dotIndex: number): boolean {
  const ch = text[dotIndex];
  if (ch !== "." && ch !== "!" && ch !== "?") return false;

  // ! ve ? her zaman sınır.
  if (ch !== ".") {
    return /\s/.test(text[dotIndex + 1] ?? " ");
  }

  // Sonrasında whitespace + büyük harf veya rakam (yeni cümle başı) yoksa sınır değil.
  let i = dotIndex + 1;
  while (i < text.length && /[ \t]/.test(text[i]!)) i++;
  // String sonu: sınır kabul (cümlenin son noktası).
  if (i >= text.length) return true;
  // Yeni satır → sınır.
  if (text[i] === "\n" || text[i] === "\r") return true;
  // Bir sonraki gerçek karakter büyük harf veya rakam değilse sınır değil
  // (örn. "1.5 milyon" içindeki nokta).
  const next = text[i]!;
  if (!/[A-ZÇĞİÖŞÜ0-9"'(]/.test(next)) return false;

  // Önceki tokenin kısaltma olup olmadığını kontrol et.
  // Token = nokta öncesi son alphanumeric+punct cluster'ı (a.ş gibi içsel
  // noktaları da yakalamak için ayırıcı = whitespace).
  let j = dotIndex - 1;
  while (j >= 0 && !/\s/.test(text[j]!)) j--;
  // Carrier layer (zero-width / homoglyph) abbreviation tokenlarını
  // kirletebilir — "Dr." → "D\u200Br." gibi. Token tanıma için ZW
  // karakterlerini ve homoglyph mapping'in TR muadillerini sıyır.
  // (Output cümlede bunlar korunur, sadece boundary kararı için temizlenir.)
  const tokenRaw = text.slice(j + 1, dotIndex + 1);
  const tokenClean = tokenRaw.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "");
  const tokenWithDot = tokenClean.toLowerCase();
  // "a.ş." → strip trailing dot → "a.ş"
  const stripped = tokenWithDot.replace(/\.+$/, "");
  if (TR_ABBREVIATIONS.has(stripped)) return false;
  // Tek harfli baş harfler (ör. "M. Kemal") kısaltma kabul.
  if (/^[a-zçğıöşü]$/.test(stripped)) return false;

  return true;
}

/**
 * Metni cümlelere böl. Whitespace'i agresif tutmaz (orijinal aralarla
 * birleştirilebilir olsa da burada her cümle kendi `text`'ini içerir,
 * trim edilir — normalize ayrı yapılır).
 */
export function splitSentences(text: string): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "." || ch === "!" || ch === "?") {
      if (isSentenceBoundary(text, i)) {
        const piece = text.slice(start, i + 1).trim();
        if (piece.length > 0) out.push(piece);
        start = i + 1;
      }
    }
  }
  // Tail (son nokta/sınır olmayabilir).
  const tail = text.slice(start).trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

/**
 * Cümle normalize: küçük harf (TR-aware), tüm whitespace'i tek boşluğa
 * indirge, trim. Noktalama KORUNUR — silme/değiştirme tespiti için anlamlı.
 */
export function normalizeSentence(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// HMAC chain
// ─────────────────────────────────────────────────────────────────────────────

export interface CascadeNode {
  /** 0-based index in the chain. */
  index: number;
  /** Hex hash for this node. */
  hash: string;
  /** Normalized sentence text (lowercase, single-space, trimmed). */
  normalized: string;
}

export interface BuildCascadeOptions {
  /** Master secret (AEGIS_SECRET[_Vn]). Tenant secret HKDF ile türetilir. */
  secret: string;
  clientId: string;
  docId: string;
  text: string;
}

/**
 * Persist edilen zincir wrapper'ı. `nodes` saf zincir, `keyDerivation` meta.
 * Yeni `buildCascadeChain` çağrıları her zaman `hkdf-v1` üretir; verifier
 * eski `global` zincirleri (veya plain array legacy şeklini) de okuyabilir.
 */
export interface CascadeChain {
  keyDerivation: CascadeKeyDerivation;
  nodes: CascadeNode[];
}

const HASH_HEX_LEN = 32; // 16 bytes hex (HMAC-SHA256 digest'in ilk 16 byte'ı)

/**
 * Tek node HMAC-SHA256 hesabı. `key` Buffer (HKDF byte'ları) veya
 * legacy string (raw master secret). createHmac ikisini de kabul eder.
 */
function nodeHash(opts: {
  key: Buffer | string;
  clientId: string;
  docId: string;
  index: number;
  prevHash: string;
  normalized: string;
}): string {
  return createHmac("sha256", opts.key)
    .update(`${opts.clientId}\u241F${opts.docId}\u241F${opts.index}\u241F${opts.prevHash}\u241F${opts.normalized}`)
    .digest("hex")
    .slice(0, HASH_HEX_LEN);
}

const GENESIS_HASH = "0".repeat(HASH_HEX_LEN);

/**
 * Cümle bazlı HMAC-SHA256 zinciri üret. **Her zaman `hkdf-v1`** key
 * derivation kullanır → tenant izolasyonu garanti.
 */
export function buildCascadeChain(opts: BuildCascadeOptions): CascadeChain {
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("buildCascadeChain: secret must be ≥8 chars");
  }
  const tenantKey = deriveTenantSecret(opts.secret, opts.clientId);
  const sentences = splitSentences(opts.text);
  const nodes: CascadeNode[] = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < sentences.length; i++) {
    const normalized = normalizeSentence(sentences[i]!);
    if (normalized.length === 0) continue;
    const h = nodeHash({
      key: tenantKey,
      clientId: opts.clientId,
      docId: opts.docId,
      index: nodes.length,
      prevHash: prev,
      normalized,
    });
    nodes.push({ index: nodes.length, hash: h, normalized });
    prev = h;
  }
  return { keyDerivation: ACTIVE_CASCADE_KEY_DERIVATION, nodes };
}

/**
 * Persisted chain'i normalize et: legacy plain-array (Faz 2 ilk drop)
 * veya `{keyDerivation, nodes}` wrapper'ı kabul edip `CascadeChain`
 * döndürür. Geriye uyumluluk için kritik.
 *
 * Patch v3.5: artık her node için **runtime şema doğrulaması** yapar:
 *  - `index`: non-negative tamsayı,
 *  - `hash`: boş olmayan hex/string,
 *  - `normalized`: string.
 *
 * Bozuk/eksik alanlı en az bir node varsa `null` döner — sessiz kabul
 * yerine güvenli reddetme. Çağıran (analyze-text route) `null` durumunda
 * cascade verify'ı sessizce atlar; ana akış kırılmaz.
 */
export function normalizeStoredCascadeChain(
  raw: unknown,
): CascadeChain | null {
  if (raw === null || raw === undefined) return null;

  let candidateNodes: unknown[] | null = null;
  let keyDerivation: CascadeKeyDerivation = "global";

  if (Array.isArray(raw)) {
    // Legacy plain array → global key derivation kabul et.
    candidateNodes = raw;
  } else if (typeof raw === "object") {
    const obj = raw as { keyDerivation?: unknown; nodes?: unknown };
    if (!Array.isArray(obj.nodes)) return null;
    candidateNodes = obj.nodes;
    const kd = obj.keyDerivation;
    keyDerivation = kd === "global" || kd === "hkdf-v1" ? kd : "global";
  } else {
    return null;
  }

  const validated: CascadeNode[] = [];
  for (const n of candidateNodes) {
    if (n === null || typeof n !== "object") return null;
    const node = n as { index?: unknown; hash?: unknown; normalized?: unknown };
    if (
      typeof node.index !== "number" ||
      !Number.isInteger(node.index) ||
      node.index < 0
    )
      return null;
    if (typeof node.hash !== "string" || node.hash.length === 0) return null;
    if (typeof node.normalized !== "string") return null;
    validated.push({
      index: node.index,
      hash: node.hash,
      normalized: node.normalized,
    });
  }
  return { keyDerivation, nodes: validated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify — Levenshtein ≤ 20% tolerance
// ─────────────────────────────────────────────────────────────────────────────

/** Standart Levenshtein, küçük string'ler için yeterli. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,        // insertion
        prev[j]! + 1,            // deletion
        prev[j - 1]! + cost,     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** Normalized cümle benzerliği: distance / max(len). 0 = identical, 1 = farklı. */
export function relativeDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return levenshtein(a, b) / maxLen;
}

export const MODIFICATION_TOLERANCE = 0.2;

export interface CascadeVerifyResult {
  /** 0..1 — identical sentences / total stored. */
  integrityScore: number;
  /** First stored index whose hash mismatched; null if all hashes intact. */
  brokenAtIndex: number | null;
  /** Stored indices with no candidate match (deleted). */
  deletedIndices: number[];
  /** Stored indices whose match was a paraphrase (Levenshtein ≤ 20%). */
  modifiedIndices: number[];
  /** Cümle yer değiştirme tespit edildi mi (matched orig indices monotonic değil). */
  reorderedDetected: boolean;
  /** Stored chain'de olmayan ek/yeni cümle sayısı. */
  insertedCount: number;
  /** Total stored sentences. */
  totalStored: number;
  /** Total candidate sentences. */
  totalCandidate: number;
}

export interface VerifyCascadeOptions {
  /** Master secret. Tenant key HKDF ile türetilir (chain meta `hkdf-v1` ise). */
  secret: string;
  clientId: string;
  docId: string;
  /**
   * Cloak zamanında kaydedilen zincir (`{keyDerivation, nodes}`). Caller
   * legacy plain-array satırlar için `normalizeStoredCascadeChain()`
   * kullanmalıdır.
   */
  storedChain: CascadeChain;
  /** Şüpheli/sızmış metin. */
  candidateText: string;
}

/**
 * Stored chain'i candidate text'e karşı doğrula.
 *
 * Algoritma:
 *  1) Candidate metni cümlelere böl + normalize et.
 *  2) Stored zincirini geçerek her stored cümlesi için candidate'ta en iyi
 *     eşleşmeyi bul (Levenshtein ≤ 20% kabul, identical = 0).
 *  3) brokenAtIndex: hash'i candidate'taki position-N cümleyle yeniden
 *     hesapladığımızda eşleşmeyen ilk stored index.
 *  4) reorderedDetected: matched candidate index'leri stored sırasında
 *     monotonic artmıyorsa.
 *  5) integrityScore = identicalMatchCount / totalStored.
 *
 * **Known Limitation — Greedy Alignment:**
 *  Stored cümleler sırayla işlenir; her stored cümle için ilk identical match
 *  (yoksa Levenshtein ≤ 20% en iyi) candidate'tan tüketilir. Bu yaklaşım
 *  reorder + paraphrase **kombinasyonunda** yanlış eşleştirme yapabilir:
 *  örneğin S1 paraphrase edilmiş + S2 silinmiş + S2'nin paraphrase'ı sonradan
 *  eklenmiş ise, greedy algoritma S1'i S2'nin paraphrase'ına eşleyebilir ve
 *  S1'i "deleted", S2'yi "modified" yerine tersini raporlayabilir. Bu durum
 *  `integrityScore`'u doğru azaltır (zayıflama yine algılanır) fakat
 *  `deletedIndices`/`modifiedIndices` listeleri yanıltıcı olabilir.
 *  `reorderedDetected` flag'i bu yan etkinin sinyalidir.
 *  **Karar etkisi sıfırdır**: cascade her halükarda *yardımcı kanıttır* ve
 *  attribution legacy ladder'dan gelir. Optimal alignment (Hungarian /
 *  Needleman-Wunsch) gelecek versiyonlarda değerlendirilir.
 */
export function verifyCascadeChain(opts: VerifyCascadeOptions): CascadeVerifyResult {
  // Stored chain meta'sına göre HMAC anahtarını seç:
  //  - "hkdf-v1" → HKDF-SHA256(masterSecret, salt=clientId, info)
  //  - "global"  → master secret'ı doğrudan (legacy Faz 2 ilk drop)
  const verifyKey = selectVerifyKey(
    opts.secret,
    opts.clientId,
    opts.storedChain.keyDerivation,
  );
  const stored = opts.storedChain.nodes;
  const candidateSentences = splitSentences(opts.candidateText)
    .map(normalizeSentence)
    .filter((s) => s.length > 0);

  if (stored.length === 0) {
    return {
      integrityScore: 1,
      brokenAtIndex: null,
      deletedIndices: [],
      modifiedIndices: [],
      reorderedDetected: false,
      insertedCount: candidateSentences.length,
      totalStored: 0,
      totalCandidate: candidateSentences.length,
    };
  }

  // candidateUsed[i] true → bu candidate cümle bir stored'a atandı.
  const candidateUsed = new Array<boolean>(candidateSentences.length).fill(false);
  // matched[storedIdx] = candidateIdx | null
  const matched: Array<number | null> = stored.map(() => null);
  // distance[storedIdx] = relative distance (0 = identical)
  const distance: number[] = stored.map(() => 1);

  // Greedy assignment: stored sırayla ilerlerken her birine en iyi unused
  // candidate cümleyi ata. Tie-break: identical > paraphrase.
  for (let s = 0; s < stored.length; s++) {
    const target = stored[s]!.normalized;
    // Önce identical match dene.
    let pickedIdx = -1;
    for (let c = 0; c < candidateSentences.length; c++) {
      if (candidateUsed[c]) continue;
      if (candidateSentences[c] === target) {
        pickedIdx = c;
        break;
      }
    }
    if (pickedIdx >= 0) {
      candidateUsed[pickedIdx] = true;
      matched[s] = pickedIdx;
      distance[s] = 0;
      continue;
    }
    // Paraphrase: Levenshtein ≤ tolerance.
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let c = 0; c < candidateSentences.length; c++) {
      if (candidateUsed[c]) continue;
      const d = relativeDistance(target, candidateSentences[c]!);
      if (d <= MODIFICATION_TOLERANCE && d < bestDist) {
        bestDist = d;
        bestIdx = c;
      }
    }
    if (bestIdx >= 0) {
      candidateUsed[bestIdx] = true;
      matched[s] = bestIdx;
      distance[s] = bestDist;
    }
  }

  const deletedIndices: number[] = [];
  const modifiedIndices: number[] = [];
  let identicalCount = 0;
  for (let s = 0; s < stored.length; s++) {
    if (matched[s] === null) {
      deletedIndices.push(s);
    } else if (distance[s]! > 0) {
      modifiedIndices.push(s);
    } else {
      identicalCount++;
    }
  }

  // brokenAtIndex: ilk stored position'da candidate[N] cümlesiyle hash'i
  // yeniden hesaplayıp stored hash ile karşılaştır. Hash zinciri olduğu için
  // ilk fark sonrası tümü bozulur — bu yüzden sadece ilk break point anlamlı.
  let brokenAtIndex: number | null = null;
  let prev = GENESIS_HASH;
  for (let i = 0; i < stored.length; i++) {
    const cand = candidateSentences[i];
    if (cand === undefined) {
      brokenAtIndex = i;
      break;
    }
    const h = nodeHash({
      key: verifyKey,
      clientId: opts.clientId,
      docId: opts.docId,
      index: i,
      prevHash: prev,
      normalized: cand,
    });
    if (h !== stored[i]!.hash) {
      brokenAtIndex = i;
      break;
    }
    prev = h;
  }

  // Reorder: matched candidate indices stored sırasında monotonic artmalı.
  let reorderedDetected = false;
  let lastSeen = -1;
  for (let s = 0; s < stored.length; s++) {
    const ci = matched[s];
    if (ci === null) continue;
    if (ci < lastSeen) {
      reorderedDetected = true;
      break;
    }
    lastSeen = ci;
  }

  const insertedCount = candidateUsed.filter((u) => !u).length;
  const integrityScore = identicalCount / stored.length;

  return {
    integrityScore,
    brokenAtIndex,
    deletedIndices,
    modifiedIndices,
    reorderedDetected,
    insertedCount,
    totalStored: stored.length,
    totalCandidate: candidateSentences.length,
  };
}

/**
 * Cascade break severity haritası — Breach Signal emit'inde kullanılır.
 * Düşük integrity = high (ciddi yapısal bozulma); yüksek integrity = low.
 */
export function severityFromIntegrity(score: number): "low" | "medium" | "high" {
  if (score < 0.5) return "high";
  if (score < 0.8) return "medium";
  return "low";
}

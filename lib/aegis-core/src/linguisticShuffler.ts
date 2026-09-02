import { createHmac } from "node:crypto";

/**
 * Turkish synonym groups. Each inner array is a set of words that are
 * (approximately) interchangeable in everyday written Turkish.
 *
 * Words are stored in lowercase. Matching against input text is done
 * case-insensitively (locale "tr"), and the original casing of the matched
 * word is preserved on the chosen substitute.
 */
const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ["imkan", "olanak"],
  ["yanıt", "cevap"],
  ["şehir", "kent"],
  ["haber", "bülten"],
  ["süre", "müddet"],
  ["sorun", "problem", "mesele"],
  ["neden", "sebep"],
  ["amaç", "hedef", "gaye"],
  ["yöntem", "metot", "usul"],
  ["kelime", "sözcük"],
  ["cümle", "tümce"],
  ["sonuç", "netice"],
  ["başlangıç", "giriş"],
  ["zorluk", "güçlük"],
  ["bilgi", "malumat"],
  ["fikir", "düşünce", "görüş"],
  ["görev", "vazife"],
  ["değişiklik", "değişim"],
  ["öneri", "teklif", "tavsiye"],
  ["açıklama", "izah"],
  ["soru", "sual"],
  ["örnek", "misal"],
  ["yer", "mekan"],
  ["zaman", "vakit"],
  ["olay", "vaka", "hadise"],
  ["kural", "kaide"],
  ["büyük", "kocaman", "iri"],
  ["küçük", "ufak"],
  ["hızlı", "süratli", "çabuk"],
  ["yavaş", "ağır"],
  ["güzel", "hoş"],
  ["önemli", "mühim"],
  ["gerekli", "lüzumlu"],
  ["doğru", "isabetli"],
  ["yanlış", "hatalı"],
  ["kolay", "basit"],
  ["zor", "güç", "çetin"],
  ["yeni", "taze"],
  ["eski", "kadim"],
  ["belki", "muhtemelen"],
  ["ancak", "fakat", "lakin"],
  ["çünkü", "zira"],
  ["şimdi", "halihazırda"],
  ["sonra", "akabinde"],
  ["önce", "evvel"],
  ["genellikle", "ekseriyetle"],
  ["yapmak", "etmek"],
  ["söylemek", "demek"],
  ["göstermek", "sergilemek"],
  ["bulmak", "keşfetmek"],
  ["başlamak", "girişmek"],
  ["bitirmek", "tamamlamak", "sonlandırmak"],
  ["istemek", "dilemek"],
  ["kullanmak", "yararlanmak", "faydalanmak"],
  ["anlamak", "kavramak"],
  ["düşünmek", "tasarlamak"],
];

interface GroupEntry {
  groupId: number;
  options: ReadonlyArray<string>;
}

const LOOKUP: Map<string, GroupEntry> = (() => {
  const map = new Map<string, GroupEntry>();
  SYNONYM_GROUPS.forEach((group, groupId) => {
    for (const word of group) {
      const key = word.toLocaleLowerCase("tr");
      if (!map.has(key)) {
        map.set(key, { groupId, options: group });
      }
    }
  });
  return map;
})();

export interface ShuffleOptions {
  /** Optional secret to namespace the per-client hash (defaults to empty). */
  secret?: string;
}

export interface ShuffleReplacement {
  /** Character offset in the original text. */
  index: number;
  original: string;
  replacement: string;
  groupId: number;
}

export interface ShuffleResult {
  text: string;
  replacements: ShuffleReplacement[];
  /** Short hex digest summarizing the chosen variant for this client. */
  variantHash: string;
}

/**
 * Match Turkish word tokens (letters only). Punctuation and whitespace
 * are left untouched.
 */
const WORD_RE = /[A-Za-zÇĞİıÖŞÜçğıöşü]+/g;

function applyCase(template: string, replacement: string): string {
  if (template.length === 0) return replacement;
  const allUpper = template === template.toLocaleUpperCase("tr");
  if (allUpper && template.length > 1) return replacement.toLocaleUpperCase("tr");
  const firstChar = template[0]!;
  const isFirstUpper = firstChar === firstChar.toLocaleUpperCase("tr") &&
    firstChar !== firstChar.toLocaleLowerCase("tr");
  if (isFirstUpper) {
    return (
      replacement.charAt(0).toLocaleUpperCase("tr") +
      replacement.slice(1).toLocaleLowerCase("tr")
    );
  }
  return replacement.toLocaleLowerCase("tr");
}

function pickIndex(
  secret: string,
  clientId: string,
  groupId: number,
  occurrence: number,
  optionCount: number,
): number {
  const h = createHmac("sha256", secret)
    .update(`${clientId}|${groupId}|${occurrence}`)
    .digest();
  // Use first 4 bytes as unsigned int.
  const n = h.readUInt32BE(0);
  return n % optionCount;
}

/**
 * Produce a per-client deterministic synonym permutation of `text`.
 *
 * Same `clientId` + same `text` → same output (idempotent). Different
 * `clientId` → different word choices, while meaning is preserved.
 */
export function shuffleByClient(
  text: string,
  clientId: string,
  opts: ShuffleOptions = {},
): ShuffleResult {
  const secret = opts.secret ?? "";
  const replacements: ShuffleReplacement[] = [];
  const occurrenceByGroup = new Map<number, number>();

  const out = text.replace(WORD_RE, (match, offset: number) => {
    const key = match.toLocaleLowerCase("tr");
    const entry = LOOKUP.get(key);
    if (!entry) return match;

    const occ = occurrenceByGroup.get(entry.groupId) ?? 0;
    occurrenceByGroup.set(entry.groupId, occ + 1);

    const idx = pickIndex(secret, clientId, entry.groupId, occ, entry.options.length);
    const chosen = entry.options[idx]!;
    if (chosen.toLocaleLowerCase("tr") === key) {
      return match;
    }
    const replacement = applyCase(match, chosen);
    replacements.push({
      index: offset,
      original: match,
      replacement,
      groupId: entry.groupId,
    });
    return replacement;
  });

  const variantHash = createHmac("sha256", secret)
    .update(`variant|${clientId}|${replacements.map((r) => `${r.groupId}:${r.replacement}`).join(",")}`)
    .digest("hex")
    .slice(0, 16);

  return { text: out, replacements, variantHash };
}

export function listSynonymGroups(): ReadonlyArray<ReadonlyArray<string>> {
  return SYNONYM_GROUPS;
}

export interface SynonymGroupHit {
  groupId: number;
  options: ReadonlyArray<string>;
}

/**
 * Look up which synonym group (if any) a single word belongs to. Case- and
 * locale-insensitive (Turkish). Returns `undefined` for words that are not part
 * of any tracked group.
 */
export function lookupSynonym(word: string): SynonymGroupHit | undefined {
  const entry = LOOKUP.get(word.toLocaleLowerCase("tr"));
  if (!entry) return undefined;
  return { groupId: entry.groupId, options: entry.options };
}

/** Regex used internally to scan Turkish word tokens. Exported for re-use. */
export const TR_WORD_RE: RegExp = /[A-Za-zÇĞİıÖŞÜçğıöşü]+/g;

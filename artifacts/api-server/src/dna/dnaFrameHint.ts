/**
 * AEGIS DNA — İlk Gerçek Video Bağlama (Frame Hint)
 * ─────────────────────────────────────────────────────────────────────
 * Bayrak: `AEGIS_DNA_FRAME_HINT` (env). Default OFF.
 *
 *   - Bayrak KAPALI → bu modül HİÇ çağrılmamış gibi: encode/decode davranışı
 *     v0.5A ile birebir aynı (route da hint okumaz).
 *   - Bayrak AÇIK → encode önce DNA tablosundan aynı `idHex` için kayıtlı
 *     `stampedFrameIdxs`'i okur; varsa override olarak encode'a verir.
 *     decode aynı listeyi `preferredFrameIdxs` olarak alır ve A1-A4 LADDER
 *     ÖNCESİNDE tek bir "DNA-HINT" aşamasında dener.
 *
 * Güvenlik:
 *   - Hint boş / hatalı / range dışı → null sonuç → eski yol çalışır.
 *   - DB hatası → null → eski yol çalışır.
 *   - Karar zinciri DOKUNULMAZ: VAULT için yine byte ID eşleşmesi şart.
 *   - Yeni VAULT kapısı YOK; eşikler (STRONG_R1_THR, FRAME_VAULT_BYTE,
 *     VAULT_MIN_VAULT_FRAMES, A5_MIN_MATCHES_PER_ANCHOR) byte-identical.
 *   - lib/aegis-core'a, encode/decode karar bloğuna dokunulmaz.
 */
import { eq } from "drizzle-orm";
import { db, aegisDnaRecordsTable } from "@workspace/db";

/**
 * Mantık tersine çevrildi (21 May 2026):
 *   - Default: DNA frame hint AÇIK (ortak DNA sistemi varsayılan).
 *   - `AEGIS_LEGACY_MODE=1` → eski güvenli yol (false).
 *   - `AEGIS_DNA_FRAME_HINT=0` → hint kapalı (geriye dönük override).
 * Hint hit dışı durumlarda (miss/empty/range/db_error) zaten eski yol
 * çalışır; bu fonksiyon yalnız "hint mekanizması devrede mi?" kararıdır.
 */
export function dnaFrameHintEnabled(): boolean {
  const legacy = process.env["AEGIS_LEGACY_MODE"];
  if (legacy === "1" || legacy === "true" || legacy === "TRUE") return false;
  const override = process.env["AEGIS_DNA_FRAME_HINT"];
  if (override === "0" || override === "false" || override === "FALSE")
    return false;
  return true;
}

/** DNA blob'undan stamped frame index'lerini defansif olarak çıkar.
 *  Birincil kaynak: `dna.maps.encodeMap.mainTripleShield.stampedFrameIdxs`.
 *  Yedek kaynak: `dna.layers[].units[].unitKey` (numeric). Hata → []. */
export function extractStampedFrameIdxs(dnaBlob: unknown): number[] {
  if (!dnaBlob || typeof dnaBlob !== "object") return [];
  const dna = dnaBlob as Record<string, unknown>;

  // Birincil: maps.encodeMap.mainTripleShield.stampedFrameIdxs
  const maps = dna["maps"];
  if (maps && typeof maps === "object") {
    const encodeMap = (maps as Record<string, unknown>)["encodeMap"];
    if (encodeMap && typeof encodeMap === "object") {
      const main = (encodeMap as Record<string, unknown>)["mainTripleShield"];
      if (main && typeof main === "object") {
        const arr = (main as Record<string, unknown>)["stampedFrameIdxs"];
        if (Array.isArray(arr)) {
          const out: number[] = [];
          for (const v of arr) {
            if (typeof v === "number" && Number.isInteger(v) && v >= 0) {
              out.push(v);
            }
          }
          if (out.length > 0) return out;
        }
      }
    }
  }

  // Yedek: layers[].units[].unitKey
  const layers = dna["layers"];
  if (Array.isArray(layers)) {
    const out: number[] = [];
    for (const layer of layers) {
      if (!layer || typeof layer !== "object") continue;
      const layerId = (layer as Record<string, unknown>)["layerId"];
      // T6 iskelet veya pasif katmanları yok say.
      if (layerId !== "main-tripleShield") continue;
      const units = (layer as Record<string, unknown>)["units"];
      if (!Array.isArray(units)) continue;
      for (const u of units) {
        if (!u || typeof u !== "object") continue;
        const k = (u as Record<string, unknown>)["unitKey"];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) out.push(k);
      }
    }
    return out;
  }
  return [];
}

export function extractChannelBFrameIdxs(dnaBlob: unknown): number[] {
  if (!dnaBlob || typeof dnaBlob !== "object") return [];
  const dna = dnaBlob as Record<string, unknown>;
  const maps = dna["maps"];
  if (maps && typeof maps === "object") {
    const encodeMap = (maps as Record<string, unknown>)["encodeMap"];
    if (encodeMap && typeof encodeMap === "object") {
      const channelB = (encodeMap as Record<string, unknown>)["channelB"];
      if (channelB && typeof channelB === "object") {
        const arr = (channelB as Record<string, unknown>)["frameIdxs"];
        if (Array.isArray(arr)) {
          return arr.filter(
            (v): v is number =>
              typeof v === "number" && Number.isInteger(v) && v >= 0,
          );
        }
      }
    }
  }
  return [];
}

export type DnaFrameHintReason =
  | "flag_off"
  | "miss"
  | "empty"
  | "out_of_range"
  | "db_error"
  | "hit";

export interface DnaFrameHintResult {
  /** Geçerli hint listesi (sorted, deduped). reason !== "hit" ise []. */
  hintIdxs: number[];
  reason: DnaFrameHintReason;
}

/** Verilen idHex için DNA kaydından frame hint'i oku.
 *  - Bayrak kapalı → `flag_off` (route bu durumda hint geçmemeli).
 *  - Kayıt yok → `miss`.
 *  - Kayıt var ama boş → `empty`.
 *  - Range dışı index varsa (totalFrames değiştiyse) → `out_of_range`.
 *  - DB hatası → `db_error`.
 *  Tüm "hit dışı" durumlarda eski v0.5A yolu çalışmalıdır. */
export async function readDnaFrameHint(args: {
  idHex: string;
  totalFrames: number;
}): Promise<DnaFrameHintResult> {
  if (!dnaFrameHintEnabled()) {
    return { hintIdxs: [], reason: "flag_off" };
  }
  if (!args.idHex || args.totalFrames <= 0) {
    return { hintIdxs: [], reason: "miss" };
  }
  try {
    // Doğal anahtar `dna_id = "<primaryMediaType>:<idHex>"` unique index
    // (`aegis_dna_records_dna_id_uniq`). Video hint için sabitlenir; başka
    // medya türünden stale satır seçilmez ve sıralama gerekmez.
    const rows = await db
      .select({ dna: aegisDnaRecordsTable.dna })
      .from(aegisDnaRecordsTable)
      .where(eq(aegisDnaRecordsTable.dnaId, `video:${args.idHex}`))
      .limit(1);
    if (rows.length === 0) {
      return { hintIdxs: [], reason: "miss" };
    }
    const idxs = extractStampedFrameIdxs(rows[0]!.dna);
    if (idxs.length === 0) {
      return { hintIdxs: [], reason: "empty" };
    }
    const allInRange = idxs.every(
      (i) => i >= 0 && i < args.totalFrames,
    );
    if (!allInRange) {
      return { hintIdxs: [], reason: "out_of_range" };
    }
    const sorted = Array.from(new Set(idxs)).sort((a, b) => a - b);
    return { hintIdxs: sorted, reason: "hit" };
  } catch {
    return { hintIdxs: [], reason: "db_error" };
  }
}

export async function readDnaChannelBHint(args: {
  idHex: string;
  totalFrames: number;
}): Promise<DnaFrameHintResult> {
  if (!dnaFrameHintEnabled()) {
    return { hintIdxs: [], reason: "flag_off" };
  }
  if (!args.idHex || args.totalFrames <= 0) {
    return { hintIdxs: [], reason: "miss" };
  }
  try {
    const rows = await db
      .select({ dna: aegisDnaRecordsTable.dna })
      .from(aegisDnaRecordsTable)
      .where(eq(aegisDnaRecordsTable.dnaId, `video:${args.idHex}`))
      .limit(1);
    if (rows.length === 0) return { hintIdxs: [], reason: "miss" };
    const idxs = extractChannelBFrameIdxs(rows[0]!.dna);
    if (idxs.length === 0) return { hintIdxs: [], reason: "empty" };
    if (!idxs.every((i) => i >= 0 && i < args.totalFrames)) {
      return { hintIdxs: [], reason: "out_of_range" };
    }
    return {
      hintIdxs: Array.from(new Set(idxs)).sort((a, b) => a - b),
      reason: "hit",
    };
  } catch {
    return { hintIdxs: [], reason: "db_error" };
  }
}

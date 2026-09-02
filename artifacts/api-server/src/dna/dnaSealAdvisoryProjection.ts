/**
 * AEGIS DNA — Seal Advisory Projection (Faz 1 İSKELET)
 * ─────────────────────────────────────────────────────────────────────
 * Caller'a (route response'u veya forensic operatör) sunulan projection.
 * Tek görevi: advisory objesini SABİT sözleşme alanlarıyla birlikte
 * "okumaya hazır" tipte sarmak. Karar üretmez, içerik dönüştürmez.
 *
 * KIRMIZI ÇİZGİ:
 *  - authority değeri DEĞİŞTİRİLEMEZ ("advisory_only_no_seal_gate").
 *  - Final VAULT sözleşmesi DEĞİŞMEZ: confirmed = ID decoded AND ID matched.
 *  - Bu projection ASLA confirmed flag üretmez.
 */

import {
  DNA_SEAL_ADVISORY_AUTHORITY,
  type DnaSealAdvisory,
  type DnaSealAdvisoryAuthority,
} from "./dnaSealAdvisory.js";

/** Caller'a açılan dış-yüz projection (response field). */
export interface DnaSealAdvisoryProjection {
  /** Sabit yetki etiketi (DEĞİŞMEZ). */
  readonly authority: DnaSealAdvisoryAuthority;
  /** Caller'a hatırlatma: advisory ne yapar, ne yapmaz. */
  readonly disclaimer:
    "Advisory does not change seal placement or unlock VAULT. Modules retain final decision. Final VAULT requires module ID match.";
  /** Final VAULT sözleşmesinin makine-okuru kanıtı. */
  readonly finalGate: "module_id_match_required";
  /** Asıl advisory payload (iskelet). */
  advisory: DnaSealAdvisory;
}

/** Saf projector — advisory'i sabit sözleşmeyle sarar. */
export function projectDnaSealAdvisory(
  advisory: DnaSealAdvisory,
): DnaSealAdvisoryProjection {
  return {
    authority: DNA_SEAL_ADVISORY_AUTHORITY,
    disclaimer:
      "Advisory does not change seal placement or unlock VAULT. Modules retain final decision. Final VAULT requires module ID match.",
    finalGate: "module_id_match_required",
    advisory,
  };
}

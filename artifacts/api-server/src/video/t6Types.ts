/**
 * T6 Low-Band telemetry types (v0.6 skeleton).
 *
 * T6, A1-A5 NOT_FOUND verirse devreye giren EK katmandır.
 * T6 mevcut v0.5A karar mantığını DEĞİŞTİRMEZ; ayrı telemetry üretir.
 * Default OFF. Flag: V06_T6_LOWBAND=1.
 */

export type T6Verdict = "T6_NONE" | "T6_CANDIDATE" | "T6_VAULT";

export interface T6Telemetry {
  enabled: boolean;
  attempted: boolean;
  /** Hangi anchor'lar T6 taşıyıcı olarak kullanıldı. C10 her zaman dışarıda. */
  carriers: string[];
  /** T6 measure aşamasında okunan frame sayısı. */
  frameCount: number;
  /** Her slot için kaç frame slot eşlendi (toplam 11 slot). */
  framesPerSlot: number[];
  /** Reconstructed 32-bit payload hex (sign-vote). */
  candidatePayloadHex: string;
  /** Expected payload4 hex. */
  expectedPayloadHex: string;
  /** Reconstructed payload, expected ile kaç bit match (0..32). */
  matchingBits: number;
  /** True yalnız 32/32 bit-exact match. */
  parityOk: boolean;
  /** True yalnız bit-exact AND expected hash invariant gates geçerse. */
  hashOk: boolean;
  verdict: T6Verdict;
  /** T6 wall ms (encode+decode skip ise 0). */
  wallMs: number;
  /** Insan-okur kısa not. */
  note: string;
}

export function emptyT6Telemetry(): T6Telemetry {
  return {
    enabled: false,
    attempted: false,
    carriers: [],
    frameCount: 0,
    framesPerSlot: [],
    candidatePayloadHex: "",
    expectedPayloadHex: "",
    matchingBits: 0,
    parityOk: false,
    hashOk: false,
    verdict: "T6_NONE",
    wallMs: 0,
    note: "T6 disabled (V06_T6_LOWBAND != 1)",
  };
}

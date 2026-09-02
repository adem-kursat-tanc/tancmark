/**
 * AEGIS Ortak DNA Karar Masası — modül-arası görünürlük + video→görsel destek.
 * ─────────────────────────────────────────────────────────────────────
 * Bu modülün İKİ işi var:
 *
 *   1) `buildModuleStatus(...)` — Video / Görsel / Metin için TEK SATIRDA
 *      hangi modülün ne yaptığını gösteren ortak status tipi:
 *         ran · sealed · searched · idRead · idMatched · candidate · decisive
 *      Mevcut karar zincirini DEĞİŞTİRMEZ; sadece var olan telemetriden
 *      `OrchestratorDecision` ve modül-özgü girdileri okuyup projeksiyon
 *      üretir.
 *
 *   2) `runVideoImageSupport(...)` — Video aramada DNA'nın işaret ettiği
 *      AZ SAYIDA kareye görsel-side bir destek istatistiği koşar (sharp
 *      ile per-frame channel std-dev). Kesin sonuç ÜRETMEZ; yalnız aday
 *      destek (EvidenceItem.found=false, candidateScore≤0.5). ID eşleşme
 *      yoksa hiçbir frame VAULT verdirmez.
 *
 * KIRMIZI ÇİZGİ:
 *   - `AEGIS_COMMON_DNA` bayrağı KAPALI iken bu modülün hiçbir parçası
 *     çalışmamalı; route'lar `commonDnaBoardEnabled()` ile koruma kurmalı.
 *   - lib/aegis-core'a dokunmaz; sharp yalnızca route katmanında.
 *   - Yeni VAULT kapısı YOK. `decisive` yalnız (idRead && idMatched).
 *   - Hata yutar (DB / sharp / ffmpeg): null → eski yol çalışır.
 *   - Karar eşikleri (STRONG_R1_THR, FRAME_VAULT_BYTE, VAULT_MIN_VAULT_FRAMES,
 *     A5_MIN_MATCHES_PER_ANCHOR) byte-identical.
 */
import path from "node:path";
import fs from "node:fs";
import type { SharpConstructor } from "sharp";
import type { AegisModuleKind } from "../orchestrator/detectActiveModules.js";
import type { EvidenceItem } from "../orchestrator/evidenceChain.js";

/**
 * AEGIS Ortak DNA + Ortak Karar — ARTIK VARSAYILAN ÇALIŞMA YOLU.
 *
 * Mantık tersine çevrildi (21 May 2026):
 *   - Anahtar yok / KAPALI → ortak DNA sistemi ÇALIŞIR (default true).
 *   - `AEGIS_LEGACY_MODE=1` → acil geri dönüş; ortak DNA devre dışı,
 *     eski güvenli yol çalışır (false döner).
 *   - İsteğe bağlı override `AEGIS_COMMON_DNA=0` da legacy davranışı verir
 *     (geriye dönük uyumluluk için korundu).
 *
 * Karar zinciri DOKUNULMADI: ID match olmadan kesin sonuç YOK; yeni VAULT
 * kapısı YOK; eşikler byte-identical.
 */
export function commonDnaBoardEnabled(): boolean {
  const legacy = process.env["AEGIS_LEGACY_MODE"];
  if (legacy === "1" || legacy === "true" || legacy === "TRUE") return false;
  const override = process.env["AEGIS_COMMON_DNA"];
  if (override === "0" || override === "false" || override === "FALSE")
    return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────
// Module status — tek tip, ortak okunabilir
// ─────────────────────────────────────────────────────────────────────

export type ModuleStatusPhase = "seal" | "search" | "support";

export interface ModuleBoardEntry {
  /** Hangi modül? (video/image/text). */
  module: AegisModuleKind;
  /** Hangi aşamada? seal (mühür basıldı), search (arama yapıldı), support (destek-only). */
  phase: ModuleStatusPhase;
  /** Modül kodu çalıştı mı? */
  ran: boolean;
  /** Mühür basıldı mı? (yalnız seal aşaması). */
  sealed: boolean;
  /** Arama yapıldı mı? (yalnız search aşaması). */
  searched: boolean;
  /** Mühürden ID okundu mu? */
  idRead: boolean;
  /** Okunan ID beklenen ile eşleşti mi? */
  idMatched: boolean;
  /** Yalnız aday iz mi? (ID eşleşmedi ama candidateScore > 0). */
  candidate: boolean;
  /** KESİN SONUÇ verildi mi? (idRead && idMatched). Yeni kapı YOK. */
  decisive: boolean;
  /** DNA bağlantısı için doğal anahtar (varsa). */
  dnaId?: string;
  /** Modülün insan-okuru notu. */
  note?: string;
  /** ─── Evrensel kural enrichment (21 May 2026) — additive, KARAR DEĞİŞTİRMEZ ─── */
  /** Bu modülde kaç bağımsız mühür/iz basıldı? (yalnız seal aşaması). */
  sealCount?: number;
  /** sealCount ≥ 2 ise true; modül "iki bağımsız mühür" hedefine ulaştı mı. */
  sealIndependent?: boolean;
  /** Mühür alanları çakıştı mı? (varsayılan false; bilinmiyorsa undefined). */
  sealOverlaps?: boolean;
  /** Bu aşamada DNA haritası kullanıldı mı? */
  dnaUsed?: boolean;
  /** DNA yokken yedek yola geçildi mi? (search/support için anlamlı). */
  dnaFallback?: boolean;
}

export interface BuildModuleStatusInput {
  module: AegisModuleKind;
  phase: ModuleStatusPhase;
  /** Modülün KENDİ karar kapısı (decodeVideo.aggregatedVault, vault, verdict=STRONG). */
  ran: boolean;
  sealed?: boolean;
  searched?: boolean;
  decodedIdHex: string | null;
  expectedIdHex: string | null;
  /** 0..1 — support/candidate skoru. */
  candidateScore?: number;
  dnaId?: string;
  note?: string;
  /** Evrensel kural enrichment — opsiyonel; verilmezse undefined kalır. */
  sealCount?: number;
  sealIndependent?: boolean;
  sealOverlaps?: boolean;
  dnaUsed?: boolean;
  dnaFallback?: boolean;
}

const idsMatch = (a: string | null, b: string | null): boolean =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length > 0 &&
  a.toLowerCase() === b.toLowerCase();

export function buildModuleStatus(
  input: BuildModuleStatusInput,
): ModuleBoardEntry {
  const idRead = typeof input.decodedIdHex === "string" && input.decodedIdHex.length > 0;
  const idMatched = idsMatch(input.decodedIdHex, input.expectedIdHex);
  const decisive = idRead && idMatched;
  const candidate = !decisive && (input.candidateScore ?? 0) > 0;
  const sealIndependent =
    input.sealIndependent !== undefined
      ? input.sealIndependent
      : typeof input.sealCount === "number"
        ? input.sealCount >= 2
        : undefined;
  return {
    module: input.module,
    phase: input.phase,
    ran: input.ran === true,
    sealed: input.sealed === true,
    searched: input.searched === true,
    idRead,
    idMatched,
    candidate,
    decisive,
    dnaId: input.dnaId,
    note: input.note,
    sealCount: input.sealCount,
    sealIndependent,
    sealOverlaps: input.sealOverlaps,
    dnaUsed: input.dnaUsed,
    dnaFallback: input.dnaFallback,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Video → Görsel ilk gerçek ortak çalışma: visual support pass.
// ─────────────────────────────────────────────────────────────────────

export interface VideoImageSupportInput {
  videoPath: string;
  /** DNA'nın işaret ettiği frame index'leri (sınırlı sayıda — en fazla `maxFrames`). */
  hintIdxs: ReadonlyArray<number>;
  fps: number;
  workDir: string;
  /** Aşırı koşumdan kaçınmak için tavan. Default 8. */
  maxFrames?: number;
}

export interface VideoImageSupportPerFrame {
  idx: number;
  tsSec: number;
  /** sharp stats — channel-0 mean / stddev. */
  mean: number | null;
  stddev: number | null;
  /** stddev > minStdThr → "visually meaningful frame". */
  supportSignal: boolean;
}

export interface VideoImageSupportResult {
  framesChecked: number;
  /** 0..1, tüm frame'ler arasında destek sinyali oranı. */
  supportScore: number;
  perFrame: ReadonlyArray<VideoImageSupportPerFrame>;
  mode: "visual_support_only_no_decisive";
  /** Bağlandığı authority — sabit. */
  authority: "candidate_only_never_decisive";
  notes: ReadonlyArray<string>;
}

const MIN_STDDEV_FOR_SUPPORT = 15; // sharp 0-255 channel std

/**
 * DNA-hinted az sayıda kareye görsel-side destek istatistiği koş.
 * Hata olursa null döner → eski yol çalışır.
 */
export async function runVideoImageSupport(
  input: VideoImageSupportInput,
): Promise<VideoImageSupportResult | null> {
  if (!commonDnaBoardEnabled()) return null;
  if (!input.hintIdxs || input.hintIdxs.length === 0) return null;
  if (!Number.isFinite(input.fps) || input.fps <= 0) return null;

  const cap = Math.max(1, Math.min(input.maxFrames ?? 8, input.hintIdxs.length));
  const selected = Array.from(new Set(input.hintIdxs))
    .slice(0, cap);
  const timestamps = selected.map((i) => i / input.fps);

  const notes: string[] = [];
  let extracted: Array<{ tsSec: number; pngPath: string }> = [];
  try {
    const { extractFrames } = await import("../video/ffmpegHelper.js");
    const supportDir = path.join(input.workDir, "_support_dna_hint");
    fs.mkdirSync(supportDir, { recursive: true });
    extracted = await extractFrames(input.videoPath, timestamps, supportDir);
  } catch (e) {
    notes.push(
      `extract_failed:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`,
    );
    return {
      framesChecked: 0,
      supportScore: 0,
      perFrame: [],
      mode: "visual_support_only_no_decisive",
      authority: "candidate_only_never_decisive",
      notes,
    };
  }

  let sharpMod: SharpConstructor | null = null;
  try {
    sharpMod = (await import("sharp")).default;
  } catch (e) {
    notes.push(
      `sharp_unavailable:${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`,
    );
    return {
      framesChecked: 0,
      supportScore: 0,
      perFrame: [],
      mode: "visual_support_only_no_decisive",
      authority: "candidate_only_never_decisive",
      notes,
    };
  }

  const perFrame: VideoImageSupportPerFrame[] = [];
  let supportCount = 0;
  for (let i = 0; i < extracted.length; i++) {
    const item = extracted[i]!;
    const idx = selected[i]!;
    let mean: number | null = null;
    let stddev: number | null = null;
    try {
      const stats = await sharpMod(item.pngPath).stats();
      const ch0 = stats.channels?.[0];
      if (ch0) {
        mean = typeof ch0.mean === "number" ? ch0.mean : null;
        stddev = typeof ch0.stdev === "number" ? ch0.stdev : null;
      }
    } catch (e) {
      notes.push(
        `frame_${idx}_sharp_failed:${e instanceof Error ? e.message.slice(0, 60) : "unknown"}`,
      );
    }
    const supportSignal =
      typeof stddev === "number" && stddev > MIN_STDDEV_FOR_SUPPORT;
    if (supportSignal) supportCount++;
    perFrame.push({
      idx,
      tsSec: item.tsSec,
      mean,
      stddev,
      supportSignal,
    });
  }

  const supportScore =
    perFrame.length > 0 ? supportCount / perFrame.length : 0;

  return {
    framesChecked: perFrame.length,
    supportScore,
    perFrame,
    mode: "visual_support_only_no_decisive",
    authority: "candidate_only_never_decisive",
    notes,
  };
}

/**
 * Visual support sonucunu evidence chain'e taşı.
 * - `found = false` HER ZAMAN (yeni VAULT kapısı YOK).
 * - `idMatch = false` HER ZAMAN (ID karşılaştırma video tarafı görevidir).
 * - `candidateScore` clamp01(supportScore * 0.5) — tavan 0.5: tek başına
 *   crossModuleConsistency'yi şişirmesin.
 */
export function videoImageSupportToEvidence(
  support: VideoImageSupportResult,
): EvidenceItem {
  const clamped = Math.max(0, Math.min(0.5, support.supportScore * 0.5));
  return {
    layerId: "image.visual-support-from-video",
    mediaType: "image",
    found: false,
    idMatch: false,
    candidateScore: clamped,
    vaultProof: undefined,
    warnings:
      support.notes.length > 0
        ? Object.freeze([...support.notes])
        : undefined,
    telemetry: {
      framesChecked: support.framesChecked,
      supportScore: support.supportScore,
      mode: support.mode,
      authority: support.authority,
    },
  };
}

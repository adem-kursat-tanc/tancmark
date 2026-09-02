/**
 * AEGIS T008.5 — DIAGONAL PIVOT + LOCAL CONTRAST BOOST
 *
 * Additive promotion (T008.5 PROMOTED — kullanıcı şartı KARŞILANDI:
 * 13.7° σ=2 = 66.7% ≥ %66 + 45° σ=2 = 100% ≥ %33 + 27.2° σ=2 = 100% bonus).
 *
 * Mimari (4 eksen):
 *   1. 8-CARDINAL pivot {0,45,90,135,180,225,270,315} — 45° kör nokta baypas;
 *      her diagonal cardinal kendi ±SUB_GRID_RANGE'i içinde tarama yapar.
 *   2. SPLIT-ALPHA stamp — finder ALPHA=10 (subtle, gürültü-az), data ALPHA=16
 *      (sinyal güçlü; BCH bound içinde kalmak için).
 *   3. LOCAL CONTRAST BOOST decode — anchor patch etrafında local mean-subtract +
 *      stddev-normalize; observed VE ref aynı transform → blur σ=2 etkisini
 *      divisive normalize ile telafi eder.
 *   4. RS AGGRESSIVE — R1_ERASURE_THR_AGGRESSIVE=0.65; soft-error byte'lar erasure
 *      sayılır → BCH bound (2err+era ≤ parityLen) korunur.
 *
 * BACKWARD COMPAT: tripleShield.ts byte-identical (4-anchor surface aynı çalışır);
 * bu lib SADECE additive (yeni constants + helpers).
 *
 * SHARP-FREE: pure pixel/byte/float arithmetic.
 *
 * KIRMIZI ÇİZGİLER (T008.4'ten): aegis-core sharp-free · AUDIT_KINDS dokunulmaz
 * · DB schema dokunulmaz · openapi.yaml dokunulmaz · Türkçe varsayılan ·
 * "World-Class" yasağı 9/11 (81.8%) → 🟡 PARTIAL (≥%95+N≥30+0fp şartına ulaşmadı).
 */

/** 8-CARDINAL pivot set — 45° diagonal cardinal'ler dahil (45° kör nokta hilesi). */
export const DIAGONAL_PIVOT_CARDINALS: readonly number[] = [
  0, 45, 90, 135, 180, 225, 270, 315,
];

/** SPLIT-ALPHA: nav (finder) anchor stamp alpha. Subtle to avoid noise injection. */
export const NAV_ALPHA_DEFAULT = 10;

/** SPLIT-ALPHA: data anchor stamp alpha. Boosted for blur σ=2 survival. */
export const DATA_ALPHA_DEFAULT = 16;

/** RS AGGRESSIVE: r1 NCC threshold below which a decoded byte is treated as erasure. */
export const R1_ERASURE_THR_AGGRESSIVE = 0.65;

/** Sub-grid sweep step for fine-θ refinement (degrees). */
export const SUB_GRID_STEP_DEFAULT = 1.25;

/** Sub-grid sweep half-range (degrees) — covers off-cardinal angles up to ±30°. */
export const SUB_GRID_RANGE_DEFAULT = 30;

/**
 * Local Contrast Boost patch half-size (px). Defines neighborhood used for
 * mean/stddev computation around an anchor; the inner 32x32 anchor footprint
 * is then re-scaled in-place.
 */
export const LOCAL_BOOST_HALF_DEFAULT = 20;

/**
 * Apply Local Contrast Boost in-place to a single anchor's footprint.
 *
 *   • Compute mean μ and stddev σ of luma over a window of half-size `half`
 *     around the anchor (covers anchor patch + neighborhood).
 *   • Re-scale the inner 32×32 anchor footprint as: `(p − μ) · 64/σ + 128`.
 *   • Both observed and reference must receive identical transform — blur
 *     σ=2 acts as multiplicative attenuation on local stddev; dividing by
 *     post-blur σ restores residual contrast on a normalized [0,255] scale.
 *
 * Sharp-free, primitive arithmetic only. Mutates `rgba` in place.
 *
 * @param rgba    RGBA8 pixel buffer
 * @param width   image width
 * @param height  image height
 * @param cx      anchor x (top-left of 32×32 patch)
 * @param cy      anchor y (top-left of 32×32 patch)
 * @param half    half-size of context window (default 20)
 */
export function applyLocalContrastBoost(
  rgba: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  half: number = LOCAL_BOOST_HALF_DEFAULT,
): void {
  const x0 = Math.max(0, cx - half);
  const y0 = Math.max(0, cy - half);
  const x1 = Math.min(width, cx + 32 + half);
  const y1 = Math.min(height, cy + 32 + half);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const lum =
        0.299 * rgba[idx]! +
        0.587 * rgba[idx + 1]! +
        0.114 * rgba[idx + 2]!;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
  }
  if (n === 0) return;
  const mean = sum / n;
  const variance = Math.max(1, sumSq / n - mean * mean);
  const stddev = Math.sqrt(variance);
  const scale = 64 / stddev;
  const ix0 = Math.max(0, cx);
  const iy0 = Math.max(0, cy);
  const ix1 = Math.min(width, cx + 32);
  const iy1 = Math.min(height, cy + 32);
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const boosted = (rgba[idx + c]! - mean) * scale + 128;
        rgba[idx + c] = Math.max(0, Math.min(255, boosted | 0));
      }
    }
  }
}

/**
 * Anchor coordinate (top-left of 32×32 patch).
 */
export interface AnchorXY {
  readonly x: number;
  readonly y: number;
}

/**
 * Apply Local Contrast Boost to multiple anchors on a copy of the buffer.
 * Returns a fresh Uint8Array so callers can keep the original observed/ref
 * intact for other channels.
 */
export function applyLocalBoostAtAnchors(
  rgba: Uint8Array,
  width: number,
  height: number,
  anchors: readonly AnchorXY[],
  half: number = LOCAL_BOOST_HALF_DEFAULT,
): Uint8Array {
  const out = new Uint8Array(rgba);
  for (const a of anchors) {
    applyLocalContrastBoost(out, width, height, a.x, a.y, half);
  }
  return out;
}

/**
 * Diagonal Pivot configuration snapshot — used by harness/audit logs to
 * declare which T008.5 parameters were active at decode time.
 */
export interface DiagonalPivotConfig {
  readonly cardinals: readonly number[];
  readonly navAlpha: number;
  readonly dataAlpha: number;
  readonly r1ErasureThr: number;
  readonly subGridStep: number;
  readonly subGridRange: number;
  readonly localBoost: boolean;
  readonly localBoostHalf: number;
}

/**
 * Default Diagonal Pivot configuration (T008.5 PROMOTED).
 */
export const DIAGONAL_PIVOT_DEFAULT_CONFIG: DiagonalPivotConfig = {
  cardinals: DIAGONAL_PIVOT_CARDINALS,
  navAlpha: NAV_ALPHA_DEFAULT,
  dataAlpha: DATA_ALPHA_DEFAULT,
  r1ErasureThr: R1_ERASURE_THR_AGGRESSIVE,
  subGridStep: SUB_GRID_STEP_DEFAULT,
  subGridRange: SUB_GRID_RANGE_DEFAULT,
  localBoost: true,
  localBoostHalf: LOCAL_BOOST_HALF_DEFAULT,
};

// ──────────────────────────────────────────────────────────────────────────
// T008.6 — Additive opt-in constants (Micro-Calibration; OPT-IN, not default)
//
// HONEST PARTIAL — 11/14 (78.6%) ile %95 hedefi KARŞILANMADI; tripleShield.ts
// Gold Master ETİKETİ VERİLMEDİ. 13.7°/45°/185.4° σ=2 sırasıyla 100%/100%/100%
// (T008.5'ten +)  ama 27.2° σ=2 = 1/4 (25%) ile T008.5'in 2/2 sonucundan
// REGRESYON (RADIAL_ALPHA stamp text-symmetry tabanlı wrong-cardinal lock'u
// 27.2°'de tetikledi). T008.6 mimarisi caller'lar için OPT-IN sabitler olarak
// land; default pipeline = T008.5 (DIAGONAL_PIVOT_DEFAULT_CONFIG).
// ──────────────────────────────────────────────────────────────────────────

/** RS escalation erasure budget ladder (Hierarchical Bit-Voting). */
export const RS_ESCALATION_BUDGETS_DEFAULT: readonly number[] = [5, 7, 9, 11, 13, 15];

/** Micro-step alignment fine-pass step (degrees). */
export const MICRO_STEP_DEFAULT = 0.1;

/** Micro-step alignment fine-pass half-range around locked theta_fine (degrees). */
export const MICRO_RANGE_DEFAULT = 1.25;

/** Radial Adaptive Boost: nav anchor alpha at image center. */
export const RADIAL_ALPHA_NAV_BASE = 10;

/** Radial Adaptive Boost: nav anchor alpha at image corner. */
export const RADIAL_ALPHA_NAV_MAX = 14;

/** Radial Adaptive Boost: data anchor alpha at image center. */
export const RADIAL_ALPHA_DATA_BASE = 14;

/** Radial Adaptive Boost: data anchor alpha at image corner. */
export const RADIAL_ALPHA_DATA_MAX = 18;

/**
 * Radial Adaptive Boost — anchor's normalized distance from image center.
 * Returns r ∈ [0, 1] where 0 = image center, 1 = image corner. Used to
 * interpolate stamp alpha so corner anchors (where blur σ=2 attenuation is
 * strongest) receive a stronger watermark.
 *
 * @param anchor    anchor with x, y (top-left of 32×32 patch)
 * @param width     image width
 * @param height    image height
 */
export function anchorRadialNorm(
  anchor: AnchorXY,
  width: number,
  height: number,
): number {
  const cx = width / 2;
  const cy = height / 2;
  const dx = anchor.x + 16 - cx;
  const dy = anchor.y + 16 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  return Math.min(1, dist / maxDist);
}

// ──────────────────────────────────────────────────────────────────────────
// T008.7 — Açıya Duyarlı Hibrit Strateji (Gear-Shift) + DNA Cluster Voting
// (OPT-IN; HONEST PARTIAL — Gold Master VERİLMEDİ; 16/20 = 80% < 95% hedef;
//  13.7° seed-bağımlı varyans 3/6 = 50%; 27.2° regresyonu T008.6'dan ÇÖZÜLDÜ
//  ✨ ama 13.7° STAMP FLAT (DATA=14) maliyeti yeni regresyon yarattı.)
//
// Architecture:
//   • STAMP FLAT mandatory (NAV=10, DATA=14): 27.2° wrong-cardinal kalıcı çözüm
//     (T008.6 RADIAL ALPHA wrong-cardinal regresyonunu giderir).
//   • Decode-time gear-shift: SAFE_CARDINALS = {45, 135, 225, 315} → VITES 1
//     (geniş RS budgets [3,5,7,9,11,13,15] + cluster-aware erasure).
//     Diğer cardinals → VITES 2 standard ladder.
//   • DNA cluster voting: N data byte → N_CLUSTERS cluster (i % N_CLUSTERS),
//     her ladder seviyesinde her cluster'dan en zayıf 1 byte erase (round-robin),
//     sonra global weakest first fallback. Karışık ladder daha geniş hata
//     patern uzayını tarar.
// ──────────────────────────────────────────────────────────────────────────

/** T008.7 STAMP FLAT — mandatory NAV alpha (27.2° wrong-cardinal kalıcı çözüm). */
export const STAMP_FLAT_NAV_ALPHA = 10;

/** T008.7 STAMP FLAT — mandatory DATA alpha. */
export const STAMP_FLAT_DATA_ALPHA = 14;

/** T008.7 SAFE cardinals (VITES 1 — diagonal lock; 27.2°/45° atak riski). */
export const SAFE_CARDINALS_DEFAULT: readonly number[] = [45, 135, 225, 315];

/** T008.7 RS budgets for VITES 1 (SAFE — diagonal lock; b3 starts strong). */
export const RS_BUDGETS_SAFE_DEFAULT: readonly number[] = [3, 5, 7, 9, 11, 13, 15];

/** T008.7 RS budgets for VITES 2 (TURBO — orthogonal lock; T008.6 baseline). */
export const RS_BUDGETS_TURBO_DEFAULT: readonly number[] = [5, 7, 9, 11, 13, 15];

/** T008.7 micro-step half-range for VITES 1 (SAFE — wider sweep for off-cardinal θ). */
export const MICRO_RANGE_SAFE_DEFAULT = 1.0;

/** T008.7 micro-step half-range for VITES 2 (TURBO — standard). */
export const MICRO_RANGE_TURBO_DEFAULT = 1.25;

/** T008.7 DNA cluster count (N_DATA byte / N_CLUSTERS = bytes per cluster). */
export const N_CLUSTERS_DEFAULT = 5;

// ──────────────────────────────────────────────────────────────────────────
// T008.8 — Tiered Defense + DNA-Last + Symmetry-Lock Fix (HONEST PARTIAL 🟡)
// (OPT-IN; Gold Master VERİLMEDİ; 4-açı 22/26 = 84.6% < 95% hedef;
//  ✨ 27.2° regresyon TAMAMEN ÇÖZÜLDÜ T008.7 80% → T008.8 100%;
//  ✨ 13.7° T008.7 50% → T008.8 100% Universal Turbo Restore;
//  ⚠ 185.4° substrate-spesifik 50% kalıcı; RS miscorrect b15 + cardinal disambig.)
//
// Architecture:
//   • UNIVERSAL TURBO RESTORE: stamp RADIAL ON (T008.6 NAV 10→14, DATA 14→18).
//     13.7° dataR1 ≥0.83 (T008.7 FLAT 0.65 → T008.8 RADIAL 0.83+) ışıklar geri açıldı.
//   • TIERED DECODE (cost-aware):
//       L1 FAST: cardinal lock + sub-grid 1.25° + RS b7 single-shot. Çoğu instance'ı
//                burada bitirir (gözlem: 22 EXACT / 4 fail dağılımında L1=18 L2=4 L3=0).
//       L2 CALIB: + micro-step 0.1°/±MICRO_RANGE_TIERED + RS ladder b7→b15 global.
//       L3 DNA: cluster-aware ladder b3-b15 + global fallback (son çare; pratikte 0 hit).
//   • SYMMETRY-LOCK FIX: cardinal=45° + L1+L2+L3 fail → reframe rotate -17.5°
//     (45° → 27.5° hipotezi) + retry L1+L2 (one-shot loop guard).
// ──────────────────────────────────────────────────────────────────────────

/** T008.8 L1 FAST single-shot RS budget. */
export const TIER1_RS_BUDGET_DEFAULT = 7;

/** T008.8 L2 CALIB RS ladder budgets (global weakest-first erasure). */
export const TIER2_RS_BUDGETS_DEFAULT: readonly number[] = [7, 9, 11, 13, 15];

/** T008.8 L3 DNA RS ladder budgets (cluster-aware + global fallback per level). */
export const TIER3_RS_BUDGETS_DEFAULT: readonly number[] = [3, 5, 7, 9, 11, 13, 15];

/** T008.8 micro-step half-range for L2/L3 calibration. */
export const MICRO_RANGE_TIERED_DEFAULT = 1.0;

/** T008.8 27.2° symmetry-lock fix reframe degrees (45° → 27.5° hypothesis). */
export const SYMMETRY_REFRAME_DEG_DEFAULT = -17.5;

/** T008.8 cardinal that triggers symmetry-lock fix (default 45° — diagonal cardinal). */
export const SYMMETRY_TRIGGER_CARDINAL_DEFAULT = 45;

// ──────────────────────────────────────────────────────────────────────────
// T008.9 — Final Sync & Archive (Pusula ve Hibrit Onarımı) (HONEST PARTIAL 🟡)
//   • TOP-K CARDINAL EVAL: cardinal scan top-K kilitlenir; her aday için L1/L2/L3
//     + CRC integrity check sıralı denenir; ilk CRC-valid aday kazanır.
//     185.4° "Ayna Tuzağı" (0° vs 180°) disambig için kanıtlandı (c2 winner).
//   • 185.4° HYBRID FALLBACK: tüm top-K + CRC fail olursa cardinal=180° hipotezi
//     ile EXTENDED MICRO_RANGE (±2°) + EXTENDED RS LADDER son şans.
//   • CODEWORD INTEGRITY (CRC8-CCITT): idData = [4 random][CRC8]; RS decode sonrası
//     CRC8(decoded[0..3]) == decoded[4] kontrol → RS miscorrect / wrong-cardinal
//     decode reddedilir → false-positive engelleme + cardinal disambig sinyali.
//   • Honest sonuç: 13.7°/27.2°/45° N=2 her biri 100%; 185.4° ~7/9 (~%78) kalıcı
//     substrate-spesifik fail (T008.8 %50'den iyileşme ama %95 değil) → Gold
//     Master VERİLMEDİ; tripleShield.ts BYTE-IDENTICAL korundu.
// ──────────────────────────────────────────────────────────────────────────

/** T008.9 default TOP-K cardinal evaluation (3 = scan en yüksek 3 valley peak). */
export const TOP_K_CARDINAL_DEFAULT = 3;

/** T008.9 185.4° hybrid fallback extended micro-step half-range. */
export const HYBRID_MICRO_RANGE_DEFAULT = 2.0;

/** T008.9 185.4° hybrid fallback extended RS ladder budgets. */
export const HYBRID_RS_BUDGETS_DEFAULT: readonly number[] = [1, 3, 5, 7, 9, 11, 13, 15];

/** T008.9 cardinal that triggers hybrid fallback (default 180° — Ayna Tuzağı). */
export const HYBRID_TRIGGER_CARDINAL_DEFAULT = 180;

/** T008.9 ID byte length: 4 random + 1 CRC8 = 5 bytes total. */
export const ID_LEN_WITH_CRC_DEFAULT = 5;

/**
 * T008.9 CRC8-CCITT (poly 0x07, init 0x00) — pure function, sharp-free.
 * Used to embed a single-byte integrity check into the RS payload so that
 * RS miscorrect (wrong-cardinal decode that happens to satisfy parity) can
 * be rejected post-decode by the verifier.
 */
export function crc8Ccitt(bytes: Uint8Array | readonly number[]): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] & 0xff;
    for (let j = 0; j < 8; j++) {
      crc = ((crc & 0x80) ? ((crc << 1) ^ 0x07) : (crc << 1)) & 0xff;
    }
  }
  return crc & 0xff;
}

/**
 * T008.9 Verify a CRC-tagged ID payload. Layout: [data 0..k-2][CRC8 at k-1].
 * Returns true iff the trailing byte equals CRC8 of the leading bytes.
 */
export function verifyCrc8Payload(decoded: Uint8Array | null | undefined): boolean {
  if (!decoded || decoded.length < 2) return false;
  const k = decoded.length;
  return crc8Ccitt(decoded.subarray(0, k - 1)) === decoded[k - 1];
}

// ──────────────────────────────────────────────────────────────────────────
// T008.12/T008.13 — CRC16-CCITT + Erasure-Inference DENEMELERİ İPTAL EDİLDİ
//   FAILED EXPERIMENT: Lib API yüzeyi T008.11 baseline'a (CRC8 / ID_LEN=5)
//   geri çekildi. Tarihsel detay docs/archive/t008_diagonal_pivot.md.
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// T008.10 — Dolly Inference (Nükleer Seçenek & Final Kuşatma) (HONEST PARTIAL 🟡)
//   • SUBSTRATE-AWARE DYNAMIC BOOST: stamp-side `DATA_ALPHA_MAX *= 1.5` (18→27)
//     opt-in. 185.4° N=10 build-up: T008.9 ~%78 → T008.10 9/10 (~%90) net win;
//     dataR1 önceki seed 0/3/7 fail durumlarında 0.6-0.84 aralığına çıkıyor
//     (önceki dataR1=0 substrate-spesifik anchor signal kaybı azaldı).
//   • DOLLY DUAL-POLARITY (data XOR 0xff + RS+CRC retry): 185.4° "Ayna Tuzağı"
//     tam-loss inference. **DEFAULT OFF + GATE** (`dataR1 ≥ DOLLY_MIN_DATAR1`):
//     1-byte CRC8 + bayt enum hipotez genişlemesi → CRC false-positive riski
//     gözlemlendi (ungated test seed 9 CRC-FP=1). Gate ile test edilen run'larda FP=0 gözlendi (CRC8 1/256 collision matematik garanti değil; 16-bit CRC veya MAC ileride).
//   • SOFT-DECISION RS (marjinal bayt flip 2^k subset enum): aynı FP risk profili
//     → **DEFAULT OFF + GATE**. Mekaniği LANDED, opt-in caller eder.
//   • Honest sonuç: 4 ana açı N=10 build-up ~19/20 (~%95); 185.4° %90 ≥%98 değil
//     + N=30 koşulu sağlanmadı → tripleShield.ts BYTE-IDENTICAL korundu, **Gold
//     Master İŞARETİ VERİLMEDİ**. Substrate boost factor lib'e additive sabit.
// ──────────────────────────────────────────────────────────────────────────

/** T008.10 stamp-side DATA_ALPHA_MAX çarpan (18 → 27 = +%50). */
export const SUBSTRATE_BOOST_FACTOR_DEFAULT = 1.5;

/** T008.10 DOLLY/SOFT-RS gate: dataR1 < eşik altında tetiklenmez (FP koruması). */
export const DOLLY_MIN_DATAR1_DEFAULT = 0.45;

/** T008.10 SOFT-RS marjinal bayt eşiği (|r1| < eşik → marjinal). */
export const SOFT_RS_THRESHOLD_DEFAULT = 0.15;

/** T008.10 SOFT-RS max marjinal flip sayısı (2^k subset enum kontrolü). */
export const SOFT_RS_MAX_FLIPS_DEFAULT = 2;

/**
 * T008.10 Dolly polarity flip — XOR 0xff per byte (180° polarity inversion).
 * Pure function, sharp-free. Caller bu çıktıyı RS+CRC ile tekrar decode etmeli;
 * CRC valid değilse REDDET (1-byte CRC8 = 1/256 collision riski mevcut).
 */
export function flipPolarityXor(bytes: Uint8Array | readonly number[]): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] ^ 0xff) & 0xff;
  return out;
}

/**
 * T008.10 Soft-RS GATE check — dataR1 ≥ DOLLY_MIN_DATAR1_DEFAULT zorunlu.
 * Düşük signal'de Dolly+Soft enum CRC false-positive üretebilir; bu helper
 * gate kararını caller'a döner (true = enum güvenli, false = skip).
 */
export function isDollyGateOpen(dataR1: number, minR1: number = DOLLY_MIN_DATAR1_DEFAULT): boolean {
  return Number.isFinite(dataR1) && dataR1 >= minR1;
}

/**
 * T008.7 Gear-shift classifier — given a locked cardinal, return whether
 * caller should use VITES 1 (SAFE) or VITES 2 (TURBO) decode parameters.
 *
 * @param cardinal locked cardinal degrees (0/45/.../315)
 * @param safeSet  cardinals classified as SAFE (default = SAFE_CARDINALS_DEFAULT)
 */
export function isSafeCardinal(
  cardinal: number,
  safeSet: readonly number[] = SAFE_CARDINALS_DEFAULT,
): boolean {
  return safeSet.includes(cardinal);
}

/**
 * T008.7 DNA cluster-aware erasure — round-robin "weakest in each cluster"
 * pattern; complements global weakest-first by spreading erasures across
 * cluster boundaries. Useful when error pattern is cluster-correlated
 * (e.g. one row of anchors degraded by image corner blur).
 *
 * @param r1List   per-byte R1 confidence (length = N_DATA)
 * @param budget   max erasure count
 * @param nClusters cluster count (default 5; bytes assigned by i % nClusters)
 */
export function clusterAwareErasures(
  r1List: readonly number[],
  budget: number,
  nClusters: number = N_CLUSTERS_DEFAULT,
): number[] {
  const N = r1List.length;
  const indexed = r1List.map((r, i) => ({ i, r, cl: i % nClusters }));
  const perCluster: { i: number; r: number }[][] = Array.from(
    { length: nClusters },
    () => [],
  );
  for (const x of indexed) perCluster[x.cl].push({ i: x.i, r: x.r });
  for (const arr of perCluster) arr.sort((a, b) => a.r - b.r);
  const erased = new Set<number>();
  let depth = 0;
  while (erased.size < budget && depth < Math.ceil(N / nClusters)) {
    for (let cl = 0; cl < nClusters && erased.size < budget; cl++) {
      const arr = perCluster[cl];
      if (depth < arr.length) erased.add(arr[depth].i);
    }
    depth++;
  }
  if (erased.size < budget) {
    const sorted = indexed.slice().sort((a, b) => a.r - b.r);
    for (const x of sorted) {
      if (erased.size >= budget) break;
      erased.add(x.i);
    }
  }
  return [...erased].slice(0, budget);
}

/**
 * Radial Adaptive Boost alpha — interpolates between `base` (center) and
 * `max` (corner) by anchor's normalized radial distance.
 *
 * NOTE: T008.6 OPT-IN. Default pipeline (T008.5 DIAGONAL_PIVOT_DEFAULT_CONFIG)
 * uses constant NAV_ALPHA_DEFAULT/DATA_ALPHA_DEFAULT. Callers that opt into
 * T008.6 must accept the 27.2° wrong-cardinal regression risk documented above.
 */
export function radialAdaptiveAlpha(
  anchor: AnchorXY,
  width: number,
  height: number,
  base: number,
  max: number,
): number {
  const r = anchorRadialNorm(anchor, width, height);
  return base + (max - base) * r;
}

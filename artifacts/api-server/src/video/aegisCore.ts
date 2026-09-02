import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  resolveActiveAegisSecretBuffer,
  resolveAegisSecretVersionBuffer,
} from "../lib/aegisSecretResolver";
import {
  stampTripleShield,
  decodeTripleShieldInformed,
  expectedTripleShieldAnchors,
  deriveR1FinderSigns,
  type TripleShieldAnchor,
} from "@workspace/aegis-core/layers/visual/tripleShield";

// Visual core uses alpha=4 on PNG-lossless surfaces. Video MVP carries no
// L2/L3 redundancy + survives lossy H264 attacks → stamp must be stronger
// to keep R2/R3 data bits above quantization noise. Live debug @ alpha=12
// confirmed R1=1.00 anchors decoding 0/4 bytes under crf=28; alpha=32
// pushes R2/R3 amplitude above the libx264 quantization floor and remains
// visually imperceptible (Δ ≤ 2 luma steps on 32×32 patch).
// v0.2: 32 → 48 (lossy-attack survivability). alpha=32 ile recompress/crop
// altında strongFrames marjinal (0-4 random varyans, NOT_FOUND ihlali görüldü);
// 48 ile R1 NCC ve byte SNR aynı anda yükselir. Görsel etki Δ ≤ 3 luma step
// (imperceptible). FP'yi etkilemez (alpha sadece stamp gücü, eşik değil).
const STAMP_ALPHA = 48.0;

/**
 * Resolve video anchors from the same active key lineage as the primary
 * AEGIS engine. This prevents a rotation from silently diverging video.
 */
export function resolveSecret(keyVersion?: string): Buffer {
  return keyVersion
    ? resolveAegisSecretVersionBuffer(keyVersion)
    : resolveActiveAegisSecretBuffer();
}

/** 32-byte ID buffer from hex or arbitrary string (HKDF-like sha256). */
export function normalizeId(input: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(input)) return Buffer.from(input, "hex");
  return createHash("sha256").update(input, "utf8").digest();
}

/** 4-byte payload for L1 ring (4 anchors × 8 bits = 32 bits). MVP carries
 *  CRC32 of the 32-byte ID — bit-exact veto, FP probability = 2^-32. */
export function payload4(idBuffer: Buffer): Buffer {
  // node:zlib crc32 returns unsigned 32-bit int; BE serialize.
  // Fallback: sha256 prefix 4 bytes (still bit-exact veto).
  const h = createHash("sha256").update(idBuffer).digest();
  const p = h.subarray(0, 4);
  // FP defense (architect review v0.4-C): assert payload != 0x00000000. On
  // flat/black frames L3 DCT mid-band coefs trend to 0 → QIM decoded byte
  // also 0. If payload4 happens to be all-zero (1/2³² random + 1 contrived
  // ID), L3 would byte-match trivially on any black frame. Vanishingly rare
  // but cheap to guard.
  if (p.readUInt32BE(0) === 0) {
    // Cascade-rotate: re-hash with a salt suffix until non-zero.
    let salt = 0;
    while (true) {
      salt++;
      const h2 = createHash("sha256")
        .update(idBuffer)
        .update(Buffer.from([salt]))
        .digest();
      const p2 = h2.subarray(0, 4);
      if (p2.readUInt32BE(0) !== 0) return p2;
    }
  }
  return p;
}

export interface FrameStampResult {
  width: number;
  height: number;
  pngBuffer: Buffer;
  anchors: TripleShieldAnchor[];
}

// v0.4 L2 spatial redundancy: inner anchor ring at center ± 32 px.
// L1 outer ring sits at corners (center ± 76, asymmetric -76/+44). Center
// crops (≥75%) erase L1 anchors but keep inner region intact → L2 ring
// survives. Same lib primitives (stampTripleShield / decodeTripleShieldInformed),
// different (x,y) and different anchorId namespace ("L2-Cxx") → independent
// sign derivation, no L1 sign collision. Same 4-byte payload basılır;
// decode-side per-frame max(L1, L2) byte voting yapılır.
const L2_RADIUS = 32;
export function expectedL2Anchors(
  width: number,
  height: number,
): TripleShieldAnchor[] {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  return [
    { id: "L2-C00", x: cx - L2_RADIUS, y: cy - L2_RADIUS },
    { id: "L2-C01", x: cx + L2_RADIUS, y: cy - L2_RADIUS },
    { id: "L2-C10", x: cx - L2_RADIUS, y: cy + L2_RADIUS },
    { id: "L2-C11", x: cx + L2_RADIUS, y: cy + L2_RADIUS },
  ];
}

/** v0.5 Layer A — Substrate score for a candidate stamp frame.
 *
 *  Returns:
 *    - `substrate`: MIN of 32×32 std-dev (luma) at the 4 L1 anchor centers.
 *      Acts as the bottleneck — the weakest anchor dictates byte recovery.
 *      Sweet spot ~10..30 (texture present, not over-textured). Score = clamp
 *      to [0,30] (saturated patches → 0; ideal mid-texture → ≈25).
 *    - `meanY`: frame-wide mean luma. Used for brightness validity (avoid
 *      pure-black/white frames where libx264 quantizes aggressively).
 *    - `payloadHash`: cheap 32-bit hash of the raw image (used for motion
 *      delta between candidates — Δ between consecutive candidates is a
 *      proxy for inter-frame change, lower = lower motion = libx264 gentler).
 *
 *  Lib-free, sharp + scalar math only. Deterministic. */
export async function scoreFrameForStamping(
  pngBuffer: Buffer,
): Promise<{
  width: number;
  height: number;
  substrate: number;
  meanY: number;
  payloadHash: number;
  anchorStds: number[];
}> {
  const img = sharp(pngBuffer).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("scoreFrameForStamping: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const anchors = expectedTripleShieldAnchors(W, H);

  // Per-anchor 32×32 luma std-dev.
  const PATCH = 32;
  const HALF = PATCH >> 1;
  const stds: number[] = [];
  for (const a of anchors) {
    const x0 = Math.max(0, a.x - HALF);
    const y0 = Math.max(0, a.y - HALF);
    const x1 = Math.min(W, a.x + HALF);
    const y1 = Math.min(H, a.y + HALF);
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const ix = (py * W + px) * 4;
        const r = rgba[ix] ?? 0;
        const g = rgba[ix + 1] ?? 0;
        const b = rgba[ix + 2] ?? 0;
        const y = Y_R * r + Y_G * g + Y_B * b;
        sum += y;
        sq += y * y;
        n++;
      }
    }
    const mean = n > 0 ? sum / n : 0;
    const variance = n > 0 ? sq / n - mean * mean : 0;
    stds.push(Math.sqrt(Math.max(0, variance)));
  }
  const substrate = Math.min(...stds);

  // Frame-wide mean Y (every 8th pixel — cheap, deterministic).
  let frameSum = 0;
  let frameN = 0;
  for (let py = 0; py < H; py += 8) {
    for (let px = 0; px < W; px += 8) {
      const ix = (py * W + px) * 4;
      const r = rgba[ix] ?? 0;
      const g = rgba[ix + 1] ?? 0;
      const b = rgba[ix + 2] ?? 0;
      frameSum += Y_R * r + Y_G * g + Y_B * b;
      frameN++;
    }
  }
  const meanY = frameN > 0 ? frameSum / frameN : 0;

  // Cheap 32-bit hash for motion-delta proxy (FNV-1a over every 64th pixel).
  let h = 0x811c9dc5;
  for (let py = 0; py < H; py += 16) {
    for (let px = 0; px < W; px += 16) {
      const ix = (py * W + px) * 4;
      const r = rgba[ix] ?? 0;
      const g = rgba[ix + 1] ?? 0;
      const b = rgba[ix + 2] ?? 0;
      h = Math.imul(h ^ r, 0x01000193);
      h = Math.imul(h ^ g, 0x01000193);
      h = Math.imul(h ^ b, 0x01000193);
    }
  }
  return {
    width: W,
    height: H,
    substrate,
    meanY,
    payloadHash: h >>> 0,
    anchorStds: stds,
  };
}

/** Stamp 4 anchor L1 ring onto a PNG buffer. Returns new PNG. Same
 *  geometry as visual core (expectedTripleShieldAnchors @ center ± 76).
 *  Same sign derivation (deriveR1FinderSigns) and same stamp primitive. */
export async function stampPngL1(
  pngInput: Buffer,
  idBuffer: Buffer,
): Promise<FrameStampResult> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("stampPngL1: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const anchors = expectedTripleShieldAnchors(W, H);
  const secret = resolveSecret();
  const cloakIdHex = idBuffer.toString("hex");
  const data4 = payload4(idBuffer);

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i]!;
    const signs = deriveR1FinderSigns(secret, a.id, cloakIdHex);
    const byte = data4[i % data4.length]!;
    stampTripleShield(rgba, W, H, a.x, a.y, signs, byte, STAMP_ALPHA);
  }

  const outBuf = await sharp(Buffer.from(rgba), {
    raw: { width: W, height: H, channels: 4 },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { width: W, height: H, pngBuffer: outBuf, anchors };
}

export interface FrameDecodeResult {
  width: number;
  height: number;
  /** R1 NCC per anchor [-1..1] (sign-only correlation strength). */
  r1Per: number[];
  /** Decoded data byte per anchor. */
  dataPer: number[];
  /** Reassembled 4-byte payload. */
  decoded4: Buffer;
  /** Expected 4-byte payload. */
  expected4: Buffer;
  /** Exact match — false positive probability = 2^-32. */
  payloadMatch: boolean;
  /** Mean R1 NCC across anchors (signal strength). */
  meanR1: number;
  /** Per-anchor sub-pixel offset chosen by NCC-max scan (telemetry). */
  subPixelOffset: { dx: number; dy: number }[];
}

// v0.2 sub-pixel scan: lossy attack altında crop/scale-back ya da minor
// geometric drift sebebiyle anchor merkezi ±birkaç px kayabilir. Per-anchor
// bağımsız scan yaparız; seçim **R1 NCC max** (byte-blind). NCC sign-only
// derived sign pattern ile yapıldığı için byte değerini bilmiyor — oracle
// bias yok, FP gevşemiyor. Maliyet: (2R+1)² × 4 anchor lib call/frame.
const SUBPIXEL_SCAN_RADIUS_BASE = 2; // ±2 px → 5×5 = 25 offset per anchor

// v0.5 Layer B (feature-flag) — wider candidate grid for hard geometric attacks
// (crop, screen, phone). Default OFF. When V05_LAYER_B=1, scan radius scales
// by K (V05_LAYER_B_K, default 2 — i.e. ±4 px → 9×9 = 81 offsets, ~3.2× cost).
// Selection remains R1 NCC max (byte-blind, oracle-free) → FP discipline intact.
function resolveScanRadius(): number {
  // Primary gate: env var. Fallback gate: file flag at .local/v05_layer_b.flag
  // (allows runtime toggle without API restart when artifact-managed workflow
  // does not accept env overrides). File content "K=N" sets K (1..3).
  let enabled = process.env.V05_LAYER_B === "1";
  let k = Number(process.env.V05_LAYER_B_K ?? 2);
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    // pnpm --filter sets cwd to the artifact package dir; walk up to find the
    // workspace root (marker: pnpm-workspace.yaml) and read the flag there.
    let dir = process.cwd();
    let flagPath = "";
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, ".local", "v05_layer_b.flag");
      const marker = path.join(dir, "pnpm-workspace.yaml");
      if (fs.existsSync(candidate)) { flagPath = candidate; break; }
      if (fs.existsSync(marker)) break; // workspace root reached, give up
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (flagPath && fs.existsSync(flagPath)) {
      enabled = true;
      const txt = fs.readFileSync(flagPath, "utf8").trim();
      const m = txt.match(/K\s*=\s*(\d+)/);
      if (m && m[1]) k = Number(m[1]);
    }
  } catch {
    /* ignore — fall through to env-only behaviour */
  }
  if (!enabled) return SUBPIXEL_SCAN_RADIUS_BASE;
  k = Math.max(1, Math.min(3, k));
  return SUBPIXEL_SCAN_RADIUS_BASE * k;
}

// v0.5 D1 (Aşama 1 pilotu, 20 May 2026) — crop hedefli coarse anchor offset
// mini-grid. Layer B'den TAMAMEN bağımsız ayrı bir flag (V05_D1_CROP_GRID veya
// .local/v05_d1_crop_grid.flag). Default OFF → byte-identical. ON iken her
// anchor için mevcut ±2 px sub-pixel taramaya EK olarak ±20 px step=5 coarse
// grid (9×9 = 81 ek offset) denenir. Seçim yine R1 NCC max (oracle-free):
// kriptografik sign-NCC byte'a bakmaz → FP disiplini intact, eşik gevşemiyor.
// Hedef: crop saldırısı altında anchor merkezi kayıp olduğunda kurtarma. Kör
// brute-force değil — sabit sınırlı grid, hardstop CPU = sabit 81×4 ops/frame.
const D1_OUTER_STEP = 5;
const D1_OUTER_MAX = 20;

function resolveD1CropGridEnabled(): boolean {
  if (process.env.V05_D1_CROP_GRID === "1") return true;
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, ".local", "v05_d1_crop_grid.flag");
      const marker = path.join(dir, "pnpm-workspace.yaml");
      if (fs.existsSync(candidate)) return true;
      if (fs.existsSync(marker)) return false;
      const parent = path.dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Blind decode using observed DC mean as ref patch (no original frame
 *  needed). Per-anchor sub-pixel NCC-max scan rescues anchor centers that
 *  drifted under lossy/geometric attacks. Selection is NCC-only (cryptographic
 *  sign pattern correlation) — does NOT inspect byte value → no oracle bias.
 *  Visual core path (alpha=48, baseline (0,0) offset) remains optimal for
 *  unattacked frames → preserved VAULT senaryolar. */
export async function decodePngL1(
  pngInput: Buffer,
  expectedIdBuffer: Buffer,
): Promise<FrameDecodeResult> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("decodePngL1: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const anchors = expectedTripleShieldAnchors(W, H);
  const secret = resolveSecret();
  const cloakIdHex = expectedIdBuffer.toString("hex");
  const expected4 = payload4(expectedIdBuffer);

  const r1Per: number[] = [];
  const dataPer: number[] = [];
  const subPixelOffset: { dx: number; dy: number }[] = [];
  for (const a of anchors) {
    const signs = deriveR1FinderSigns(secret, a.id, cloakIdHex);
    let bestR1 = -Infinity;
    let bestByte = 0;
    let bestDx = 0;
    let bestDy = 0;
    // ±R px scan; tie-break: prefer (0,0) (visual-core baseline) by scanning
    // outward from center, keeping strict > comparison.
    const _R = resolveScanRadius();
    for (let dy = -_R; dy <= _R; dy++) {
      for (let dx = -_R; dx <= _R; dx++) {
        const cx = a.x + dx;
        const cy = a.y + dy;
        // Boundary skip — 32×32 patch must fit.
        if (cx < 16 || cy < 16 || cx >= W - 16 || cy >= H - 16) continue;
        const refPatch = blindRefPatch(rgba, W, H, cx, cy);
        const d = decodeTripleShieldInformed(rgba, W, H, cx, cy, refPatch, signs);
        if (
          d.r1Ncc > bestR1 ||
          // Tie-break: prefer center offset (visual-core baseline behavior).
          (d.r1Ncc === bestR1 && Math.abs(dx) + Math.abs(dy) < Math.abs(bestDx) + Math.abs(bestDy))
        ) {
          bestR1 = d.r1Ncc;
          bestByte = d.dataBits8;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
    r1Per.push(bestR1);
    dataPer.push(bestByte);
    subPixelOffset.push({ dx: bestDx, dy: bestDy });
  }

  const decoded4 = Buffer.from(dataPer);
  const payloadMatch =
    decoded4.length === expected4.length &&
    decoded4.every((b, i) => b === expected4[i]);
  const meanR1 = r1Per.reduce((s, v) => s + v, 0) / Math.max(1, r1Per.length);

  return {
    width: W,
    height: H,
    r1Per,
    dataPer,
    decoded4,
    expected4,
    payloadMatch,
    meanR1,
    subPixelOffset,
  };
}

/** v0.4 L2: stamp L1 (outer, center ± 76) + L2 (inner, center ± 32) rings
 *  with the same 4-byte payload but independent anchorId namespaces. Single
 *  RGBA pass for efficiency. Lib primitives unchanged. */
export async function stampPngL1L2(
  pngInput: Buffer,
  idBuffer: Buffer,
): Promise<FrameStampResult> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("stampPngL1L2: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const l1Anchors = expectedTripleShieldAnchors(W, H);
  const l2Anchors = expectedL2Anchors(W, H);
  const secret = resolveSecret();
  const cloakIdHex = idBuffer.toString("hex");
  const data4 = payload4(idBuffer);

  for (const set of [l1Anchors, l2Anchors]) {
    for (let i = 0; i < set.length; i++) {
      const a = set[i]!;
      // Boundary guard: skip anchor if its 32×32 patch would clip outside frame.
      if (a.x < 16 || a.y < 16 || a.x >= W - 16 || a.y >= H - 16) continue;
      const signs = deriveR1FinderSigns(secret, a.id, cloakIdHex);
      const byte = data4[i % data4.length]!;
      stampTripleShield(rgba, W, H, a.x, a.y, signs, byte, STAMP_ALPHA);
    }
  }

  const outBuf = await sharp(Buffer.from(rgba), {
    raw: { width: W, height: H, channels: 4 },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { width: W, height: H, pngBuffer: outBuf, anchors: l1Anchors };
}

export interface FrameDecodeResultL1L2 {
  width: number;
  height: number;
  l1: FrameDecodeResult;
  l2: FrameDecodeResult;
  /** Per-byte position: 1 if L1 OR L2 decoded byte equals expected, else 0.
   *  Sum gives `combinedByteMatches` (0..4) for vault frame gating. */
  combinedByteMatchMask: number[];
  combinedByteMatches: number;
  /** L1.payloadMatch OR L2.payloadMatch — bit-exact 4-byte match in either ring. */
  payloadMatch: boolean;
  /** Mean R1 across 8 anchors (4 L1 + 4 L2). */
  meanR1: number;
}

/** v0.4 L2: decode both L1 (outer) and L2 (inner) rings; per-byte voting is
 *  `L1[i] == expected[i] OR L2[i] == expected[i]` (max-aggregator, independent
 *  signs). Tier eşikleri decodeVideo.ts'de aynı kalır (byte≥3 AND strong≥2);
 *  L2 yalnız L1 anchor'ları crop ile sıfırlandığında ikinci şans verir. */
export async function decodePngL1L2(
  pngInput: Buffer,
  expectedIdBuffer: Buffer,
): Promise<FrameDecodeResultL1L2> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("decodePngL1L2: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const l1Anchors = expectedTripleShieldAnchors(W, H);
  const l2Anchors = expectedL2Anchors(W, H);
  const secret = resolveSecret();
  const cloakIdHex = expectedIdBuffer.toString("hex");
  const expected4 = payload4(expectedIdBuffer);

  const l1 = decodeAnchorSet(rgba, W, H, l1Anchors, secret, cloakIdHex, expected4);
  const l2 = decodeAnchorSet(rgba, W, H, l2Anchors, secret, cloakIdHex, expected4);

  const mask: number[] = [];
  let matches = 0;
  for (let i = 0; i < expected4.length; i++) {
    const hit =
      (l1.dataPer[i] ?? -1) === expected4[i]! ||
      (l2.dataPer[i] ?? -1) === expected4[i]!;
    mask.push(hit ? 1 : 0);
    if (hit) matches++;
  }
  const allR1 = [...l1.r1Per, ...l2.r1Per];
  const meanR1 = allR1.reduce((s, v) => s + v, 0) / Math.max(1, allR1.length);

  return {
    width: W,
    height: H,
    l1: { width: W, height: H, ...l1 },
    l2: { width: W, height: H, ...l2 },
    combinedByteMatchMask: mask,
    combinedByteMatches: matches,
    payloadMatch: l1.payloadMatch || l2.payloadMatch,
    meanR1,
  };
}

/** Shared decode core — runs sub-pixel ±2 px NCC-max scan on each anchor and
 *  returns r1Per, dataPer, payload match against expected4. Used by both L1
 *  and L2 rings; L1's public `decodePngL1` is preserved for equivalence. */
function decodeAnchorSet(
  rgba: Uint8Array,
  W: number,
  H: number,
  anchors: TripleShieldAnchor[],
  secret: Buffer,
  cloakIdHex: string,
  expected4: Buffer,
  d1CropGridEnabled?: boolean,
): Omit<FrameDecodeResult, "width" | "height"> {
  const r1Per: number[] = [];
  const dataPer: number[] = [];
  const subPixelOffset: { dx: number; dy: number }[] = [];
  const d1Enabled = d1CropGridEnabled ?? resolveD1CropGridEnabled();
  for (const a of anchors) {
    const signs = deriveR1FinderSigns(secret, a.id, cloakIdHex);
    let bestR1 = -Infinity;
    let bestByte = 0;
    let bestDx = 0;
    let bestDy = 0;
    const _R = resolveScanRadius();
    for (let dy = -_R; dy <= _R; dy++) {
      for (let dx = -_R; dx <= _R; dx++) {
        const cx = a.x + dx;
        const cy = a.y + dy;
        if (cx < 16 || cy < 16 || cx >= W - 16 || cy >= H - 16) continue;
        const refPatch = blindRefPatch(rgba, W, H, cx, cy);
        const d = decodeTripleShieldInformed(rgba, W, H, cx, cy, refPatch, signs);
        if (
          d.r1Ncc > bestR1 ||
          (d.r1Ncc === bestR1 &&
            Math.abs(dx) + Math.abs(dy) < Math.abs(bestDx) + Math.abs(bestDy))
        ) {
          bestR1 = d.r1Ncc;
          bestByte = d.dataBits8;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }
    // v0.5 D1 (Aşama 1 pilotu): coarse outer-grid scan, default OFF.
    // Existing inner scan (±_R px) untouched; D1 only EXPANDS candidate set.
    // Selection still NCC-max (oracle-free, FP discipline intact).
    if (d1Enabled) {
      for (let dy = -D1_OUTER_MAX; dy <= D1_OUTER_MAX; dy += D1_OUTER_STEP) {
        for (let dx = -D1_OUTER_MAX; dx <= D1_OUTER_MAX; dx += D1_OUTER_STEP) {
          // Skip the inner region already covered by the fine scan.
          if (Math.abs(dx) <= _R && Math.abs(dy) <= _R) continue;
          const cx = a.x + dx;
          const cy = a.y + dy;
          if (cx < 16 || cy < 16 || cx >= W - 16 || cy >= H - 16) continue;
          const refPatch = blindRefPatch(rgba, W, H, cx, cy);
          const d = decodeTripleShieldInformed(rgba, W, H, cx, cy, refPatch, signs);
          if (
            d.r1Ncc > bestR1 ||
            (d.r1Ncc === bestR1 &&
              Math.abs(dx) + Math.abs(dy) < Math.abs(bestDx) + Math.abs(bestDy))
          ) {
            bestR1 = d.r1Ncc;
            bestByte = d.dataBits8;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }
    }
    r1Per.push(bestR1);
    dataPer.push(bestByte);
    subPixelOffset.push({ dx: bestDx, dy: bestDy });
  }
  const decoded4 = Buffer.from(dataPer);
  const payloadMatch =
    decoded4.length === expected4.length &&
    decoded4.every((b, i) => b === expected4[i]);
  const meanR1 = r1Per.reduce((s, v) => s + v, 0) / Math.max(1, r1Per.length);
  return { r1Per, dataPer, decoded4, expected4, payloadMatch, meanR1, subPixelOffset };
}

// ============================================================================
// L3 DCT mid-band ring (Yol C, 18 May 2026, user-approved A)
// ============================================================================
// Different physics than L1/L2 (spatial NCC stamping). L3 embeds the same
// 4-byte payload into the **frequency domain** of small 8×8 blocks at
// disjoint anchor positions (center ± 100 px). Each anchor carries 1 byte
// = 8 bits via scalar QIM on 8 mid-band DCT coefficients.
//
// FP discipline:
//   - L3 contributes ONLY to byteMatches (per-byte parity vote with L1).
//   - L3 does NOT contribute to `strongAnchors` count.
//   - Vault gating in decodeVideo.ts (`byte ≥ 3 AND strong ≥ 2`) therefore
//     still REQUIRES ≥2 L1 anchors with R1 NCC ≥ 0.30 → existing FP shield
//     mathematically preserved (L3 cannot single-handedly produce a vault).
//
// Geometry disjoint from L1 (±76 corners, 32×32 patches → cx±60..cx±92)
// and L2 (±32 inner). L3 patch is 8×8 at center ± 100 → spans cx±96..cx±104,
// 4 px clearance from L1. 75% center crop keeps cx∈[12.5%,87.5%] → L3 anchors
// stay inside crop window for 1280×720 source.
// L3 anchor 8×8 block TOP-LEFT positions. Architect review v0.4-C:
// macroblock-align to libx264 16×16 grid → QIM stays inside one quantizer cell,
// no bleed across two macroblocks. For 1280×720: TL coords below are all
// multiples of 16 ✓. Crop 75% keeps x∈[160,1120], y∈[90,630] → all 4 inside.
const L3_TL_1280x720: ReadonlyArray<readonly [number, number]> = [
  [528, 256],
  [736, 256],
  [528, 448],
  [736, 448],
];
const L3_DCT_Q = 12;
// Mid-band 8×8 DCT positions (zigzag indices ~3..10, skip DC + high-freq).
// One position per payload bit (8 bits × 1 coef = 1 byte per anchor).
const L3_MIDBAND: ReadonlyArray<readonly [number, number]> = [
  [0, 3],
  [1, 2],
  [2, 1],
  [3, 0],
  [1, 3],
  [2, 2],
  [3, 1],
  [2, 3],
];

/** L3 anchors as 8×8 block TOP-LEFT positions (NOT centers, unlike L1/L2).
 *  For 1280×720 the canonical MB-aligned grid is returned. For other sizes
 *  we fall back to center-relative offsets (no MB-alignment guarantee). */
export function expectedL3Anchors(
  width: number,
  height: number,
): TripleShieldAnchor[] {
  if (width === 1280 && height === 720) {
    return L3_TL_1280x720.map(([tlx, tly], i) => ({
      id: `L3-T${i.toString().padStart(2, "0")}`,
      x: tlx,
      y: tly,
    }));
  }
  // Generic fallback — center ± 100 (pre-architect-review behaviour).
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  return [
    { id: "L3-C00", x: cx - 100 - 4, y: cy - 100 - 4 },
    { id: "L3-C01", x: cx + 100 - 4, y: cy - 100 - 4 },
    { id: "L3-C10", x: cx - 100 - 4, y: cy + 100 - 4 },
    { id: "L3-C11", x: cx + 100 - 4, y: cy + 100 - 4 },
  ];
}

// Precomputed 8×8 DCT cosine basis: COS[u][x] = cos((2x+1)uπ/16).
const L3_COS: number[][] = (() => {
  const t: number[][] = [];
  for (let u = 0; u < 8; u++) {
    const row: number[] = new Array(8);
    for (let x = 0; x < 8; x++) {
      row[x] = Math.cos(((2 * x + 1) * u * Math.PI) / 16);
    }
    t.push(row);
  }
  return t;
})();
const L3_C0 = 1 / Math.sqrt(2);

function dct8(block: Float64Array): Float64Array {
  const F = new Float64Array(64);
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let x = 0; x < 8; x++) {
        const cux = L3_COS[u]![x]!;
        for (let y = 0; y < 8; y++) {
          s += block[x * 8 + y]! * cux * L3_COS[v]![y]!;
        }
      }
      const cu = u === 0 ? L3_C0 : 1;
      const cv = v === 0 ? L3_C0 : 1;
      F[u * 8 + v] = 0.25 * cu * cv * s;
    }
  }
  return F;
}

function idct8(F: Float64Array): Float64Array {
  const f = new Float64Array(64);
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let s = 0;
      for (let u = 0; u < 8; u++) {
        const cu = u === 0 ? L3_C0 : 1;
        const cux = L3_COS[u]![x]!;
        for (let v = 0; v < 8; v++) {
          const cv = v === 0 ? L3_C0 : 1;
          s += cu * cv * F[u * 8 + v]! * cux * L3_COS[v]![y]!;
        }
      }
      f[x * 8 + y] = 0.25 * s;
    }
  }
  return f;
}

/** Scalar QIM encode: snap `c` to lattice point with matching parity, closest
 *  to original. Decoder uses `round(c*2/Q) & 1`. */
function qimEnc(c: number, bit: number, Q: number): number {
  const norm = (c * 2) / Q;
  const k = Math.round(norm);
  if ((k & 1) === (bit & 1)) return (k * Q) / 2;
  const lo = k - 1;
  const hi = k + 1;
  const pick = Math.abs(norm - lo) < Math.abs(norm - hi) ? lo : hi;
  return (pick * Q) / 2;
}

function qimDec(c: number, Q: number): number {
  return Math.round((c * 2) / Q) & 1;
}

// BT.601 luma coefficients. Used for Y-channel DCT (architect v0.4-C tweak):
// libx264 internally transforms RGB → YUV420; embedding in G alone loses
// ~40% energy after the YUV redistribution. Computing Y here matches what
// the codec ultimately quantizes → higher byte-recovery margin.
const Y_R = 0.299;
const Y_G = 0.587;
const Y_B = 0.114;

/** Extract 8×8 Y-channel block at top-left (tlx,tly). */
function readY8x8(
  rgba: Uint8Array,
  W: number,
  tlx: number,
  tly: number,
): Float64Array {
  const out = new Float64Array(64);
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const ix = ((tly + py) * W + (tlx + px)) * 4;
      const r = rgba[ix] ?? 0;
      const g = rgba[ix + 1] ?? 0;
      const b = rgba[ix + 2] ?? 0;
      out[px * 8 + py] = Y_R * r + Y_G * g + Y_B * b;
    }
  }
  return out;
}

/** Apply per-pixel ΔY = yNew - yOld delta to R,G,B equally. Adding the same
 *  Δ to R,G,B preserves U = B-Y, V = R-Y (chroma unchanged) and shifts Y
 *  by Δ·(0.299+0.587+0.114) = Δ exactly. Clamped to [0,255]. */
function writeYDelta8x8(
  rgba: Uint8Array,
  W: number,
  tlx: number,
  tly: number,
  yNew: Float64Array,
  yOld: Float64Array,
) {
  for (let py = 0; py < 8; py++) {
    for (let px = 0; px < 8; px++) {
      const i8 = px * 8 + py;
      const d = yNew[i8]! - yOld[i8]!;
      const ix = ((tly + py) * W + (tlx + px)) * 4;
      for (let c = 0; c < 3; c++) {
        const v = Math.round((rgba[ix + c] ?? 0) + d);
        rgba[ix + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }
}

function stampL3Anchor(
  rgba: Uint8Array,
  W: number,
  tlx: number,
  tly: number,
  byte: number,
) {
  const yOld = readY8x8(rgba, W, tlx, tly);
  const F = dct8(yOld);
  for (let b = 0; b < 8; b++) {
    const [u, v] = L3_MIDBAND[b]!;
    const bit = (byte >> b) & 1;
    F[u * 8 + v] = qimEnc(F[u * 8 + v]!, bit, L3_DCT_Q);
  }
  const yNew = idct8(F);
  writeYDelta8x8(rgba, W, tlx, tly, yNew, yOld);
}

function decodeL3Anchor(
  rgba: Uint8Array,
  W: number,
  tlx: number,
  tly: number,
): { byte: number; confidence: number } {
  const block = readY8x8(rgba, W, tlx, tly);
  const F = dct8(block);
  let byte = 0;
  let confSum = 0;
  for (let b = 0; b < 8; b++) {
    const [u, v] = L3_MIDBAND[b]!;
    const c = F[u * 8 + v]!;
    const bit = qimDec(c, L3_DCT_Q);
    byte |= bit << b;
    const norm = (c * 2) / L3_DCT_Q;
    const dist = Math.abs(norm - Math.round(norm));
    confSum += 1 - 2 * dist;
  }
  return { byte, confidence: confSum / 8 };
}

/** v0.4-C L3: stamp L1 (spatial NCC ring) + L3 (DCT mid-band ring) with the
 *  same 4-byte payload. Geometry disjoint (cf. notes above). */
export async function stampPngL1L3(
  pngInput: Buffer,
  idBuffer: Buffer,
): Promise<FrameStampResult> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("stampPngL1L3: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const l1Anchors = expectedTripleShieldAnchors(W, H);
  const l3Anchors = expectedL3Anchors(W, H);
  const secret = resolveSecret();
  const cloakIdHex = idBuffer.toString("hex");
  const data4 = payload4(idBuffer);

  // L1 first (spatial NCC). Same as stampPngL1.
  for (let i = 0; i < l1Anchors.length; i++) {
    const a = l1Anchors[i]!;
    const signs = deriveR1FinderSigns(secret, a.id, cloakIdHex);
    const byte = data4[i % data4.length]!;
    stampTripleShield(rgba, W, H, a.x, a.y, signs, byte, STAMP_ALPHA);
  }
  // L3 after (DCT mid-band). Disjoint pixel regions, no L1 interference.
  for (let i = 0; i < l3Anchors.length; i++) {
    const a = l3Anchors[i]!;
    // L3 anchors are TOP-LEFT positions; 8×8 block spans [x..x+8) × [y..y+8).
    if (a.x < 0 || a.y < 0 || a.x + 8 > W || a.y + 8 > H) continue;
    const byte = data4[i % data4.length]!;
    stampL3Anchor(rgba, W, a.x, a.y, byte);
  }

  const outBuf = await sharp(Buffer.from(rgba), {
    raw: { width: W, height: H, channels: 4 },
  })
    .png({ compressionLevel: 6 })
    .toBuffer();

  return { width: W, height: H, pngBuffer: outBuf, anchors: l1Anchors };
}

export interface FrameDecodeResultL1L3 {
  width: number;
  height: number;
  l1: FrameDecodeResult;
  /** Per-anchor L3 byte + DCT lattice confidence (0..1). */
  l3: {
    dataPer: number[];
    confidencePer: number[];
    decoded4: Buffer;
    expected4: Buffer;
    payloadMatch: boolean;
  };
  /** Per-byte: 1 if L1 OR L3 decoded equals expected. */
  combinedByteMatchMask: number[];
  combinedByteMatches: number;
  /** L3 is a 32-bit locator only. It can nominate a candidate, never confirm it. */
  locatorMatch: boolean;
  /** The independent keyed L1 channel must also match before verification. */
  strongEvidenceMatch: boolean;
  /** True only when both locator and strong evidence match. */
  verifiedMatch: boolean;
  decision: "verified_match" | "candidate_support" | "not_found";
  authority: {
    identityConfirmed: boolean;
    ownershipConfirmed: false;
    canOpenVault: false;
    final: false;
  };
  /** Backward-compatible field, now fail-closed and equal to verifiedMatch. */
  payloadMatch: boolean;
  /** L1 mean R1 (L3 has no R1; reported separately as l3 confidence). */
  meanR1: number;
}

export interface L1L3EvidenceDecision {
  locatorMatch: boolean;
  strongEvidenceMatch: boolean;
  verifiedMatch: boolean;
  decision: "verified_match" | "candidate_support" | "not_found";
  authority: {
    identityConfirmed: boolean;
    ownershipConfirmed: false;
    canOpenVault: false;
    final: false;
  };
}

/**
 * Fail-closed authority boundary for the physical video channels.
 *
 * L3 carries only 32 bits and is therefore a locator. L3 alone must never
 * confirm identity, ownership, VAULT access, or a final decision. The keyed
 * L1 channel is required as independent strong evidence, so verification is
 * an explicit AND operation.
 */
export function decideL1L3Evidence(
  l1PayloadMatch: boolean,
  l3PayloadMatch: boolean,
): L1L3EvidenceDecision {
  const verifiedMatch = l1PayloadMatch && l3PayloadMatch;
  return {
    locatorMatch: l3PayloadMatch,
    strongEvidenceMatch: l1PayloadMatch,
    verifiedMatch,
    decision: verifiedMatch
      ? "verified_match"
      : l3PayloadMatch
        ? "candidate_support"
        : "not_found",
    authority: {
      identityConfirmed: verifiedMatch,
      ownershipConfirmed: false,
      canOpenVault: false,
      final: false,
    },
  };
}

/** Decode L1 ring (spatial NCC) and L3 ring (DCT mid-band) independently,
 *  combine via per-byte OR voting. FP: L3 does not feed `strongAnchors`. */
export async function decodePngL1L3(
  pngInput: Buffer,
  expectedIdBuffer: Buffer,
  options?: {
    d1CropGridEnabled?: boolean;
    authenticatedAegisKeyVersion?: string;
  },
): Promise<FrameDecodeResultL1L3> {
  const img = sharp(pngInput).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("decodePngL1L3: missing dimensions");
  const raw = await img.raw().toBuffer();
  const rgba = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

  const l1Anchors = expectedTripleShieldAnchors(W, H);
  const l3Anchors = expectedL3Anchors(W, H);
  const secret = resolveSecret(options?.authenticatedAegisKeyVersion);
  const cloakIdHex = expectedIdBuffer.toString("hex");
  const expected4 = payload4(expectedIdBuffer);

  const l1 = decodeAnchorSet(
    rgba,
    W,
    H,
    l1Anchors,
    secret,
    cloakIdHex,
    expected4,
    options?.d1CropGridEnabled,
  );

  // L3 decode: byte-only (no NCC). No sub-pixel scan in MVP — DCT cells are
  // small (8×8), the 2 px QIM lattice tolerates minor drift implicitly.
  const l3DataPer: number[] = [];
  const l3ConfPer: number[] = [];
  for (const a of l3Anchors) {
    // TOP-LEFT convention — block spans [x..x+8) × [y..y+8).
    if (a.x < 0 || a.y < 0 || a.x + 8 > W || a.y + 8 > H) {
      l3DataPer.push(0);
      l3ConfPer.push(0);
      continue;
    }
    const { byte, confidence } = decodeL3Anchor(rgba, W, a.x, a.y);
    l3DataPer.push(byte);
    l3ConfPer.push(confidence);
  }
  const l3Decoded4 = Buffer.from(l3DataPer);
  const l3Match =
    l3Decoded4.length === expected4.length &&
    l3Decoded4.every((b, i) => b === expected4[i]);

  const mask: number[] = [];
  let matches = 0;
  for (let i = 0; i < expected4.length; i++) {
    const hit =
      (l1.dataPer[i] ?? -1) === expected4[i]! ||
      (l3DataPer[i] ?? -1) === expected4[i]!;
    mask.push(hit ? 1 : 0);
    if (hit) matches++;
  }

  const evidenceDecision = decideL1L3Evidence(l1.payloadMatch, l3Match);

  return {
    width: W,
    height: H,
    l1: { width: W, height: H, ...l1 },
    l3: {
      dataPer: l3DataPer,
      confidencePer: l3ConfPer,
      decoded4: l3Decoded4,
      expected4,
      payloadMatch: l3Match,
    },
    combinedByteMatchMask: mask,
    combinedByteMatches: matches,
    ...evidenceDecision,
    payloadMatch: evidenceDecision.verifiedMatch,
    meanR1: l1.meanR1,
  };
}

/** Build a Float64Array(1024) ref patch filled with the local 32×32 luma
 *  mean centered at (x,y). Used as DC-only blind reference. */
function blindRefPatch(
  rgba: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): Float64Array {
  const out = new Float64Array(1024);
  let sum = 0;
  let n = 0;
  const x0 = x - 16;
  const y0 = y - 16;
  for (let py = 0; py < 32; py++) {
    const dy = y0 + py;
    if (dy < 0 || dy >= height) continue;
    for (let px = 0; px < 32; px++) {
      const dx = x0 + px;
      if (dx < 0 || dx >= width) continue;
      const i = (dy * width + dx) * 4;
      const luma =
        0.299 * (rgba[i] ?? 0) +
        0.587 * (rgba[i + 1] ?? 0) +
        0.114 * (rgba[i + 2] ?? 0);
      sum += luma;
      n++;
    }
  }
  const mean = n > 0 ? sum / n : 128;
  out.fill(mean);
  return out;
}

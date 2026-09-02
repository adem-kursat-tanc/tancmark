import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  createSecureMemoryUpload,
  MULTIPART_UPLOAD_PROFILES,
} from "../middlewares/multipartUploadSecurity";

const TARGET_W = 800;
const TARGET_H = 600;
const SUBSTRATE_CELL = 32;

const router: IRouter = Router();

function requireAdminTokenInProduction(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "production") {
    requireAdminToken(req, res, next);
    return;
  }
  next();
}

const upload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.visualLab);

function resolveHarnessPath(): string {
  const candidates = [
    process.env.AEGIS_VISUAL_LAB_HARNESS,
    path.resolve(process.cwd(), ".smoke/wild_photo_test_v24.mjs"),
    path.resolve(process.cwd(), "artifacts/api-server/.smoke/wild_photo_test_v24.mjs"),
    path.resolve(process.cwd(), "../../artifacts/api-server/.smoke/wild_photo_test_v24.mjs"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0] ?? "";
}
const HARNESS_PATH = resolveHarnessPath();
const JOB_TTL_MS = 60 * 60 * 1000;
const SCENARIO_TIMEOUT_MS = parseInt(
  process.env.VISUAL_LAB_SCENARIO_TIMEOUT_MS ?? "180000",
  10,
);

interface ScenarioDef {
  name: string;
  label: string;
  angle: number;
  jpegQ: number;
  blurSigma?: number;
}

const SCENARIO_LIST: ScenarioDef[] = [
  { name: "baseline_q100", label: "Düz (saldırısız)", angle: 0, jpegQ: 100 },
  { name: "rot13.7_q75", label: "13.7° döndür + JPEG-75", angle: 13.7, jpegQ: 75 },
  { name: "rot5.05_q92", label: "5° döndür + JPEG-92", angle: 5.05, jpegQ: 92 },
  { name: "rot47_q75", label: "47° döndür + JPEG-75", angle: 47, jpegQ: 75 },
  { name: "rot90_q92", label: "90° döndür + JPEG-92", angle: 90, jpegQ: 92 },
  { name: "rot185.4_q75", label: "185° (ters) + JPEG-75", angle: 185.4, jpegQ: 75 },
  { name: "jpeg_q60", label: "Yalnız JPEG-60 (ağır sıkıştırma)", angle: 0, jpegQ: 60 },
  { name: "blur_sigma2", label: "Hafif bulanıklaştır + JPEG-75", angle: 0, jpegQ: 75, blurSigma: 2.0 },
];
const SCENARIOS = new Map(SCENARIO_LIST.map((s) => [s.name, s] as const));

interface ScenarioResult {
  name: string;
  label: string;
  status: "queued" | "running" | "done" | "error";
  vault: boolean | null;
  conf: number | null;
  dataR1: number | null;
  strong: string | null;
  stage: string | null;
  wallSec: number | null;
  error?: string;
  stdoutTail?: string;
}

interface SubstrateInfo {
  origW: number;
  origH: number;
  isScreenshot: boolean;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  centerAnchorStds: number[];
  smartScore: number;
  centerScore: number;
  smartCropApplied: boolean;
  deScreenApplied: boolean;
  reasons: string[];
}

interface Job {
  id: string;
  createdAt: number;
  photoPath: string;
  processedPath?: string;
  substrate?: SubstrateInfo;
  photoOriginalName: string;
  scenarios: ScenarioResult[];
  status: "queued" | "running" | "done" | "error";
  current: number;
  totalSec: number;
  error?: string;
}

const jobs = new Map<string, Job>();

const janitor = setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > JOB_TTL_MS) {
      try {
        fs.unlinkSync(j.photoPath);
      } catch {
        /* ignore */
      }
      if (j.processedPath && j.processedPath !== j.photoPath) {
        try {
          fs.unlinkSync(j.processedPath);
        } catch {
          /* ignore */
        }
      }
      jobs.delete(id);
    }
  }
}, 5 * 60_000);
janitor.unref();

function classifyStd(std: number): number {
  if (std < 5) return 0;
  if (std < 8) return 0.5;
  if (std <= 25) return 1.0;
  if (std <= 35) return 0.7;
  return 0.3;
}

function regionStd(
  data: Buffer,
  W: number,
  H: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): number {
  let sum = 0;
  let n = 0;
  let sumSq = 0;
  const xEnd = Math.min(W, x0 + w);
  const yEnd = Math.min(H, y0 + h);
  const xStart = Math.max(0, x0);
  const yStart = Math.max(0, y0);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = (y * W + x) * 3;
      const lum =
        (data[i] ?? 0) * 0.299 +
        (data[i + 1] ?? 0) * 0.587 +
        (data[i + 2] ?? 0) * 0.114;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return Math.sqrt(variance);
}

/**
 * Akıllı ön-işlem:
 *  1) Orijinalden substrate haritası çıkar (32x32 hücreler).
 *  2) En kemik 800x600 penceresini bul (V23 26 vault'u etkilemesin diye
 *     ancak merkez crop'tan ≥%10 daha kemik ise override; aksi halde merkez).
 *  3) Merkezdeki 4 anchor noktasında std analizi → ekran-fotoğrafı tespiti
 *     (≥2/4 nokta std<5 veya std>35 ise screenshot=true).
 *  4) Screenshot ise hafif median(3) ile LCD subpiksel moire bastır.
 *  5) İşlenmiş 800x600 JPEG q95 dosyaya yaz, harness PHOTO_PATH'i bunu kullanır.
 */
async function smartPreprocess(
  srcPath: string,
  dstPath: string,
): Promise<SubstrateInfo> {
  const reasons: string[] = [];
  // 1) Orijinal RGB raw
  const { data, info } = await sharp(srcPath)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  // 2) Hücre grid skorları
  const cellCols = Math.floor(W / SUBSTRATE_CELL);
  const cellRows = Math.floor(H / SUBSTRATE_CELL);
  const cellScores: number[][] = [];
  for (let cy = 0; cy < cellRows; cy++) {
    const row: number[] = [];
    for (let cx = 0; cx < cellCols; cx++) {
      const std = regionStd(
        data,
        W,
        H,
        cx * SUBSTRATE_CELL,
        cy * SUBSTRATE_CELL,
        SUBSTRATE_CELL,
        SUBSTRATE_CELL,
      );
      row.push(classifyStd(std));
    }
    cellScores.push(row);
  }

  // 3) 2D prefix sum (hızlı window topla)
  const prefix: number[][] = [];
  for (let y = 0; y <= cellRows; y++) {
    prefix.push(new Array(cellCols + 1).fill(0));
  }
  for (let y = 1; y <= cellRows; y++) {
    for (let x = 1; x <= cellCols; x++) {
      prefix[y]![x] =
        (cellScores[y - 1]?.[x - 1] ?? 0) +
        (prefix[y - 1]?.[x] ?? 0) +
        (prefix[y]?.[x - 1] ?? 0) -
        (prefix[y - 1]?.[x - 1] ?? 0);
    }
  }
  const winCellsW = Math.floor(TARGET_W / SUBSTRATE_CELL);
  const winCellsH = Math.floor(TARGET_H / SUBSTRATE_CELL);

  // 4) En kemik 800x600 pencere — iki aday hesapla:
  //    (a) bestTotal: pencere içindeki TOPLAM substrate skoru en yüksek (mevcut V24.1 mantığı).
  //    (b) bestAnchor: pencerenin merkezinde ± 76 px'lik 4 lib-anchor noktasının
  //        MIN substrate skoru en yüksek (min-max — en zayıf anchor'ı kemiğe çeker).
  //    Screenshot modunda (b) seçilir; normal modda (a) — V23 regression sıfır risk.
  let bestScore = -1;
  let bestCx = 0;
  let bestCy = 0;
  let bestAnchorMin = -1;
  let bestAnchorAvg = -1;
  let bestAnchorDist = Number.POSITIVE_INFINITY;
  let bestAnchorCx = 0;
  let bestAnchorCy = 0;
  let bestAnchorScores: number[] = [0, 0, 0, 0];
  const canSearch = cellCols >= winCellsW && cellRows >= winCellsH;
  // Lib anchor offset'leri (ASİMETRİK — tripleShield.ts ANCHOR_OFFSETS ile birebir):
  // C00 (-76,-76)  C01 (+44,-76)  C10 (-76,+44)  C11 (+44,+44).
  // İşlenmiş 800x600 referansında; orijinaldeki konum cropX,cropY + ofset (norm × win).
  const ANCHOR_DX_NORM = [-76 / TARGET_W, 44 / TARGET_W, -76 / TARGET_W, 44 / TARGET_W];
  const ANCHOR_DY_NORM = [-76 / TARGET_H, -76 / TARGET_H, 44 / TARGET_H, 44 / TARGET_H];
  if (canSearch) {
    for (let cy = 0; cy + winCellsH <= cellRows; cy++) {
      for (let cx = 0; cx + winCellsW <= cellCols; cx++) {
        const s =
          (prefix[cy + winCellsH]?.[cx + winCellsW] ?? 0) -
          (prefix[cy]?.[cx + winCellsW] ?? 0) -
          (prefix[cy + winCellsH]?.[cx] ?? 0) +
          (prefix[cy]?.[cx] ?? 0);
        if (s > bestScore) {
          bestScore = s;
          bestCx = cx;
          bestCy = cy;
        }
        // Anchor-aware skoru: bu pencerenin merkezinde ± 76 px'lik 4 anchor.
        const wPxX = winCellsW * SUBSTRATE_CELL;
        const wPxY = winCellsH * SUBSTRATE_CELL;
        const winCenterX = cx * SUBSTRATE_CELL + wPxX / 2;
        const winCenterY = cy * SUBSTRATE_CELL + wPxY / 2;
        const aWin = Math.max(8, Math.round(16));
        const aScores: number[] = [];
        for (let k = 0; k < 4; k++) {
          const ax = winCenterX + (ANCHOR_DX_NORM[k] ?? 0) * wPxX;
          const ay = winCenterY + (ANCHOR_DY_NORM[k] ?? 0) * wPxY;
          const std = regionStd(
            data,
            W,
            H,
            Math.round(ax - aWin),
            Math.round(ay - aWin),
            aWin * 2,
            aWin * 2,
          );
          aScores.push(classifyStd(std));
        }
        const aMin = Math.min(...aScores);
        const aAvg = (aScores.reduce((a, b) => a + b, 0)) / 4;
        // Min-max + tie-breaker: aMin → aAvg → MERKEZE YAKINLIK.
        // classifyStd 8-25 arası saturate (=1.00) → çok sayıda pencere tie olur;
        // bu durumda crop'un orijinal merkeze yakın olanı tercih (en az ortalanmış
        // saldırıya — döndürme/perspektif — dayanıklı). totalScore tie-breaker
        // doku zengin bölge seçip anchor encode SNR'ı düşürdü (kanıt: MR baseline
        // regresyonu) → merkez-tercih daha güvenli.
        const winCxCells = (cellCols - winCellsW) / 2;
        const winCyCells = (cellRows - winCellsH) / 2;
        const distToCenter =
          Math.abs(cx - winCxCells) + Math.abs(cy - winCyCells);
        const isBetter =
          aMin > bestAnchorMin ||
          (aMin === bestAnchorMin &&
            (aAvg > bestAnchorAvg ||
              (aAvg === bestAnchorAvg && distToCenter < bestAnchorDist)));
        if (isBetter) {
          bestAnchorMin = aMin;
          bestAnchorAvg = aAvg;
          bestAnchorDist = distToCenter;
          bestAnchorCx = cx;
          bestAnchorCy = cy;
          bestAnchorScores = aScores;
        }
      }
    }
  }

  // 5) Merkez pencere (referans / fallback)
  const centerCx = Math.max(
    0,
    Math.floor(((canSearch ? cellCols : winCellsW) - winCellsW) / 2),
  );
  const centerCy = Math.max(
    0,
    Math.floor(((canSearch ? cellRows : winCellsH) - winCellsH) / 2),
  );
  const centerScore = canSearch
    ? (prefix[centerCy + winCellsH]?.[centerCx + winCellsW] ?? 0) -
      (prefix[centerCy]?.[centerCx + winCellsW] ?? 0) -
      (prefix[centerCy + winCellsH]?.[centerCx] ?? 0) +
      (prefix[centerCy]?.[centerCx] ?? 0)
    : 0;

  // 6) Screenshot tespiti (ÖNCE — crop seçimini dallandıracak).
  //    Orijinal görselin MERKEZİNDE lib'in beklediği 4 anchor ile aynı oranda
  //    ± 76 ofsetli noktalar; std ≤ classifyStd 0.5 olanları "dirty" say.
  const cxOrig = W / 2;
  const cyOrig = H / 2;
  const refScale = Math.min(W / TARGET_W, H / TARGET_H);
  const axRef = 76 * refScale;
  const ayRef = 76 * refScale;
  const win = Math.max(8, Math.round(16 * refScale));
  const anchorPts = [
    { dx: -axRef, dy: -ayRef },
    { dx: axRef, dy: -ayRef },
    { dx: -axRef, dy: ayRef },
    { dx: axRef, dy: ayRef },
  ];
  const anchorStds: number[] = anchorPts.map((p) =>
    regionStd(
      data,
      W,
      H,
      Math.round(cxOrig + p.dx - win),
      Math.round(cyOrig + p.dy - win),
      win * 2,
      win * 2,
    ),
  );
  const anchorClassScores = anchorStds.map(classifyStd);
  const dirty = anchorClassScores.filter((s) => s <= 0.5).length;
  const isScreenshot = dirty >= 2;
  if (isScreenshot) {
    reasons.push(
      `ekran-fotoğrafı/dirty-substrate tespit edildi (${dirty}/4 anchor noktası ölü/zayıf/aşırı-doku, std=[${anchorStds.map((s) => s.toFixed(1)).join(", ")}], skor=[${anchorClassScores.map((s) => s.toFixed(2)).join(", ")}])`,
    );
  } else {
    reasons.push(
      `anchor profili temiz (${dirty}/4 dirty, std=[${anchorStds.map((s) => s.toFixed(1)).join(", ")}])`,
    );
  }

  // 7) Crop seçimi — moda göre dallandır:
  //    - Screenshot: ANCHOR-AWARE pencere (min-max anchor stratejisi).
  //      Hardcoded merkez ± 76'da 4 anchor varsayımıyla en güçlü min skoru bul.
  //    - Normal: TOTAL-substrate pencere (V24.1 mantığı, %10 kazanım eşiği).
  //      V23 26 vault regression riski tamamen ortadan kalkar.
  const MIN_GAIN = 1.1;
  const MIN_ANCHOR_MIN = 0.40; // anchor-aware modunda min anchor skoru en az 0.40 olmalı
  let cropX: number;
  let cropY: number;
  let smartCropApplied = false;
  let anchorAwareCropApplied = false;
  if (canSearch && isScreenshot && bestAnchorMin >= MIN_ANCHOR_MIN) {
    // Anchor-aware seçim (yeni V24.2 yolu)
    cropX = bestAnchorCx * SUBSTRATE_CELL;
    cropY = bestAnchorCy * SUBSTRATE_CELL;
    smartCropApplied = true;
    anchorAwareCropApplied = true;
    reasons.push(
      `ANCHOR-AWARE crop seçildi (min anchor skoru=${bestAnchorMin.toFixed(2)}, avg=${bestAnchorAvg.toFixed(2)}, skor4=[${bestAnchorScores.map((s) => s.toFixed(2)).join(", ")}]) — lib'in 4 anchor noktası en kemik bölgelere düşürüldü`,
    );
  } else if (canSearch && isScreenshot) {
    // Screenshot ama anchor-aware bile yeterli skor bulamadı — total kemiklik fallback
    cropX = bestCx * SUBSTRATE_CELL;
    cropY = bestCy * SUBSTRATE_CELL;
    smartCropApplied = true;
    reasons.push(
      `anchor-aware adayı yetersiz (min=${bestAnchorMin.toFixed(2)} < ${MIN_ANCHOR_MIN}); total-substrate crop fallback (skor=${bestScore.toFixed(1)})`,
    );
  } else if (canSearch && bestScore > centerScore * MIN_GAIN) {
    // V24.1 mevcut yol — normal foto, total-substrate >%10 kazanım
    cropX = bestCx * SUBSTRATE_CELL;
    cropY = bestCy * SUBSTRATE_CELL;
    smartCropApplied = true;
    reasons.push(
      `akıllı-crop uygulandı (skor ${bestScore.toFixed(1)} vs merkez ${centerScore.toFixed(1)}, +${(((bestScore / Math.max(centerScore, 0.001)) - 1) * 100).toFixed(0)}%)`,
    );
  } else if (canSearch) {
    cropX = centerCx * SUBSTRATE_CELL;
    cropY = centerCy * SUBSTRATE_CELL;
    reasons.push(
      `merkez crop korundu (akıllı=${bestScore.toFixed(1)} vs merkez=${centerScore.toFixed(1)}, %10 kazanım eşiğinin altında — regresyon koruma)`,
    );
  } else {
    cropX = 0;
    cropY = 0;
    reasons.push(`küçük foto (${W}x${H}), crop yapılmadı`);
  }
  const cropW = Math.min(W - cropX, winCellsW * SUBSTRATE_CELL);
  const cropH = Math.min(H - cropY, winCellsH * SUBSTRATE_CELL);
  void anchorAwareCropApplied;

  // 8) Pipeline: extract + (gerekirse) resize + (screenshot ise) median + JPEG
  let pipe = sharp(srcPath).rotate().removeAlpha();
  if (cropW >= 32 && cropH >= 32) {
    pipe = pipe.extract({
      left: cropX,
      top: cropY,
      width: cropW,
      height: cropH,
    });
  }
  pipe = pipe.resize(TARGET_W, TARGET_H, { fit: "cover" });
  let deScreenApplied = false;
  if (isScreenshot) {
    pipe = pipe.median(3);
    deScreenApplied = true;
    reasons.push("LCD moire bastırma uygulandı (median 3×3)");
  }
  await pipe
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toFile(dstPath);

  return {
    origW: W,
    origH: H,
    isScreenshot,
    cropX,
    cropY,
    cropW,
    cropH,
    centerAnchorStds: anchorStds,
    smartScore: bestScore,
    centerScore,
    smartCropApplied,
    deScreenApplied,
    reasons,
  };
}

function parseHarnessOutput(stdout: string): {
  vault: boolean | null;
  conf: number | null;
  dataR1: number | null;
  strong: string | null;
  stage: string | null;
} {
  let vault: boolean | null = null;
  let conf: number | null = null;
  let dataR1: number | null = null;
  let strong: string | null = null;
  let stage: string | null = null;

  const mv = stdout.match(/VAULT-CONFIRMED=(\d+)\/(\d+)/);
  if (mv?.[1]) vault = parseInt(mv[1], 10) > 0;

  const confMatches = [...stdout.matchAll(/conf=(\d+(?:\.\d+)?)%/g)];
  if (confMatches.length > 0) {
    const last = confMatches[confMatches.length - 1];
    if (last?.[1]) conf = parseFloat(last[1]) / 100;
  }

  const r1Matches = [...stdout.matchAll(/dataR1=(\d+(?:\.\d+)?)/g)];
  if (r1Matches.length > 0) {
    let best = 0;
    for (const m of r1Matches) {
      const v = parseFloat(m[1] ?? "0");
      if (v > best) best = v;
    }
    dataR1 = best;
  }

  const strongMatches = [...stdout.matchAll(/strong=(\d+\/\d+)/g)];
  if (strongMatches.length > 0) {
    const last = strongMatches[strongMatches.length - 1];
    if (last?.[1]) strong = last[1];
  }

  const tierMatches = [...stdout.matchAll(/\btier=([A-Z0-9.]+)\b/g)];
  if (tierMatches.length > 0) {
    const last = tierMatches[tierMatches.length - 1];
    if (last?.[1]) stage = last[1];
  }

  return { vault, conf, dataR1, strong, stage };
}

function buildEnv(
  photoPath: string,
  scn: ScenarioDef,
  isScreenshot: boolean,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PHOTO_PATH: photoPath,
    ANGLES: String(scn.angle),
    N_PER_ANGLE: "1",
    JPEG_Q: String(scn.jpegQ),
    BLUR_SIGMA: String(scn.blurSigma ?? 0),
    T008_GOLD: "true",
    V8_ROI_ENABLED: "true",
    V7_SUBPIXEL_WIDE: "true",
    SEED_OFFSET: "0",
    STYLE_OFFSET: "0",
    SNIPER_COARSE_STEP: "0.25",
    MICRO_STEP: "0.025",
    V14_EDGE_OBB_ENABLED: "true",
    V16_OMNI_ENABLED: "false",
    V17_OMNI_ENABLED: "true",
    V17_OMNI_MAX_CARDINALS: "16",
    V17_OMNI_THETA_OFFSETS: "0,0.5,-0.5,1.0",
    V17_OMNI_MAX_MS: "60000",
    V18_DNAPULSE_ENABLED: "true",
    V18_DNAPULSE_MAX_MS: "40000",
    V18_DNAPULSE_COARSE: "32",
    V18_DNAPULSE_COARSE_STEP: "4",
    V18_DNAPULSE_FINE: "8",
    V18_DNAPULSE_MIN_R1: "0.20",
    V21_DIRECT_DECODE_THR: "0.65",
    V24_SUBSTRATE_AWARE: "1",
    V24_WIN: "32",
    V24_SCORE_THR: "0.30",
    V24_SHIFT_PX: "15",
    V24_GAIN_MIN: "0.20",
    V24_MAX_REMAPPED: "6",
  };
  // Ekran-fotoğrafı modu: V24 substrate-aware'i tam yetkiyle aç +
  // sniper arama derinliğini genişlet. FP riski olan parametreler (CRC/BCH/DIRECT_DECODE_THR)
  // DOKUNULMAZ — sadece arama uzayı/zamanı ve gevşek korelasyon eşikleri.
  // Diğer fotoğraflarda bu blok TETİKLENMEZ → V23/V24.1 26 vault regression riski yok.
  if (isScreenshot) {
    env.V24_SCORE_THR = "0.20";
    env.V24_SHIFT_PX = "80";
    env.V24_GAIN_MIN = "0.10";
    env.V24_MAX_REMAPPED = "24";
    env.V24_SCREENSHOT_MODE = "1";
    // Sniper bütçesi artırıldı: dirty substrate'te bulması fiziksel olarak uzun sürer.
    env.V17_OMNI_MAX_MS = "120000";
    env.V18_DNAPULSE_MAX_MS = "90000";
    env.V18_DNAPULSE_COARSE = "48";
    env.V18_DNAPULSE_FINE = "12";
    // Korelasyon kabul eşiği — sıkılaştırma yönünde 0.12 → 0.18 (Öneri 2, 18 May 2026).
    // Bu peak filtresi yalnız ANCHOR sinyali içindir, payload CRC8/BCH/`V21_DIRECT_DECODE_THR`
    // bütünlük zinciri etkilenmez. MR vakası peak ≥ 0.65 üretiyor → 0.18 çok altında, vault
    // bozulmaz. Umutsuz probe'lar (peak 0.12-0.18 arası) artık erken atlanır, zor görselde
    // V18 bütçesi daha hızlı tükenir, scenario daha erken sonuçlanır. FP yönünde güvenli
    // (eşik gevşetme DEĞİL sıkılaştırma).
    env.V18_DNAPULSE_MIN_R1 = "0.18";
  }
  return env;
}

function spawnHarness(
  photoPath: string,
  scn: ScenarioDef,
  isScreenshot: boolean,
): Promise<{
  stdout: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  wallSec: number;
}> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const env = buildEnv(photoPath, scn, isScreenshot);
    // Screenshot modunda sniper bütçesi 210s'ye çıktı (V17 120 + V18 90).
    // Yakalama penceresinin altında kalmamak için scenario timeout 240s.
    const effectiveTimeoutMs = isScreenshot ? 240_000 : SCENARIO_TIMEOUT_MS;
    const child = spawn("node", [HARNESS_PATH], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 200_000) stdout = stdout.slice(-100_000);
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    const killTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, effectiveTimeoutMs);
    child.on("exit", (code, signal) => {
      clearTimeout(killTimer);
      const merged = stderr ? stdout + "\n[stderr]\n" + stderr : stdout;
      resolve({
        stdout: merged,
        code,
        signal,
        wallSec: (Date.now() - t0) / 1000,
      });
    });
    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdout + "\n[spawn-error] " + err.message,
        code: -1,
        signal: null,
        wallSec: (Date.now() - t0) / 1000,
      });
    });
  });
}

async function runJob(job: Job): Promise<void> {
  job.status = "running";
  const jobStart = Date.now();
  // Ön-işlem: akıllı crop + ekran-foto tespiti + de-screen.
  // Tek seferlik, tüm senaryolar aynı işlenmiş foto'yu kullanır.
  try {
    const processedPath = job.photoPath.replace(/(\.[^.]+)?$/, ".processed.jpg");
    const sub = await smartPreprocess(job.photoPath, processedPath);
    job.processedPath = processedPath;
    job.substrate = sub;
  } catch (e) {
    // Preprocess kırıldıysa orijinal foto ile devam — hiç olmazsa bozulma yapma.
    job.processedPath = job.photoPath;
    job.substrate = undefined;
    job.error = "preprocess_failed: " + (e instanceof Error ? e.message : String(e));
  }
  const isScreenshot = job.substrate?.isScreenshot ?? false;
  const useThisPhoto = job.processedPath ?? job.photoPath;
  for (let i = 0; i < job.scenarios.length; i++) {
    job.current = i;
    const sr = job.scenarios[i]!;
    sr.status = "running";
    try {
      const scn = SCENARIOS.get(sr.name)!;
      const out = await spawnHarness(useThisPhoto, scn, isScreenshot);
      const parsed = parseHarnessOutput(out.stdout);
      sr.vault = parsed.vault;
      sr.conf = parsed.conf;
      sr.dataR1 = parsed.dataR1;
      sr.strong = parsed.strong;
      sr.stage = parsed.stage;
      sr.wallSec = out.wallSec;
      sr.stdoutTail = out.stdout.slice(-1500);
      sr.status = "done";
      if (out.signal === "SIGKILL" && parsed.vault === null) {
        const effectiveSec =
          (isScreenshot ? 240_000 : SCENARIO_TIMEOUT_MS) / 1000;
        sr.error = `süre aşımı ${effectiveSec}s`;
      } else if (out.code !== 0 && out.signal === null && parsed.vault === null) {
        sr.error = `harness exit ${out.code}`;
      }
    } catch (e) {
      sr.status = "error";
      sr.error = e instanceof Error ? e.message : String(e);
    }
  }
  job.totalSec = (Date.now() - jobStart) / 1000;
  job.status = "done";
}

router.get("/scenarios", requireAdminTokenInProduction, (_req, res) => {
  res.json(
    SCENARIO_LIST.map((s) => ({
      name: s.name,
      label: s.label,
      angle: s.angle,
      jpegQ: s.jpegQ,
      blurSigma: s.blurSigma ?? null,
    })),
  );
});

router.post(
  "/jobs",
  requireAdminToken,
  upload.single("image"),
  (req, res) => {
    if (!req.file?.buffer || req.file.buffer.byteLength === 0) {
      res.status(400).json({ error: "image (multipart field) required" });
      return;
    }
    if (!fs.existsSync(HARNESS_PATH)) {
      res.status(500).json({ error: "harness_not_found", path: HARNESS_PATH });
      return;
    }
    const raw = req.body?.scenarios;
    const scenarioNames: string[] = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === "string"
        ? raw.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const selected = scenarioNames.filter((n) => SCENARIOS.has(n));
    if (selected.length === 0) {
      res.status(400).json({
        error: "scenarios required (comma list or array of valid names)",
        validScenarios: SCENARIO_LIST.map((s) => s.name),
      });
      return;
    }
    const id = randomUUID();
    const tmpDir = path.join(os.tmpdir(), "aegis-visual-lab");
    fs.mkdirSync(tmpDir, { recursive: true });
    const ext = (req.file.originalname.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".jpg").toLowerCase();
    const photoPath = path.join(tmpDir, id + ext);
    fs.writeFileSync(photoPath, req.file.buffer);
    const job: Job = {
      id,
      createdAt: Date.now(),
      photoPath,
      photoOriginalName: req.file.originalname,
      status: "queued",
      current: -1,
      totalSec: 0,
      scenarios: selected.map((n) => {
        const s = SCENARIOS.get(n)!;
        return {
          name: s.name,
          label: s.label,
          status: "queued" as const,
          vault: null,
          conf: null,
          dataR1: null,
          strong: null,
          stage: null,
          wallSec: null,
        };
      }),
    };
    jobs.set(id, job);
    setImmediate(() => {
      runJob(job).catch((e) => {
        job.status = "error";
        job.error = e instanceof Error ? e.message : String(e);
      });
    });
    res.status(202).json({
      jobId: id,
      total: job.scenarios.length,
      scenarios: job.scenarios.map((s) => ({ name: s.name, label: s.label })),
      timeoutPerScenarioSec: SCENARIO_TIMEOUT_MS / 1000,
      screenshotTimeoutPerScenarioSec: 240,
      timeoutNote:
        "Genel senaryo bütçesi timeoutPerScenarioSec. Ekran fotoğrafı tespit edilirse (substrate.isScreenshot=true) bütçe otomatik screenshotTimeoutPerScenarioSec'e yükselir.",
    });
  },
);

router.get("/jobs/:id", requireAdminToken, (req, res) => {
  const j = jobs.get(String(req.params.id ?? ""));
  if (!j) {
    res.status(404).json({ error: "job_not_found" });
    return;
  }
  res.json({
    id: j.id,
    status: j.status,
    current: j.current,
    total: j.scenarios.length,
    totalSec: j.totalSec,
    ...(j.error ? { error: j.error } : {}),
    ...(j.substrate
      ? {
          substrate: {
            origW: j.substrate.origW,
            origH: j.substrate.origH,
            isScreenshot: j.substrate.isScreenshot,
            smartCropApplied: j.substrate.smartCropApplied,
            deScreenApplied: j.substrate.deScreenApplied,
            cropX: j.substrate.cropX,
            cropY: j.substrate.cropY,
            cropW: j.substrate.cropW,
            cropH: j.substrate.cropH,
            centerAnchorStds: j.substrate.centerAnchorStds.map((s) =>
              Math.round(s * 100) / 100,
            ),
            reasons: j.substrate.reasons,
          },
        }
      : {}),
    scenarios: j.scenarios.map((s) => ({
      name: s.name,
      label: s.label,
      status: s.status,
      vault: s.vault,
      conf: s.conf,
      dataR1: s.dataR1,
      strong: s.strong,
      stage: s.stage,
      wallSec: s.wallSec,
      ...(s.error ? { error: s.error } : {}),
    })),
  });
});

router.get("/jobs/:id/stdout/:scenarioName", requireAdminToken, (req, res) => {
  const j = jobs.get(String(req.params.id ?? ""));
  if (!j) {
    res.status(404).json({ error: "job_not_found" });
    return;
  }
  const scnName = String(req.params.scenarioName ?? "");
  const sr = j.scenarios.find((s) => s.name === scnName);
  if (!sr) {
    res.status(404).json({ error: "scenario_not_found" });
    return;
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(sr.stdoutTail ?? "(no stdout)");
});

export default router;

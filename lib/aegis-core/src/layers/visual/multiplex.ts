// AEGIS V6 — Spatial Multiplex Region Helpers ("Safe Integration").
//
// Wild Test V5 (12 May 2026) harness'ında prove edilen 3-region spatial
// multiplexing mantığının lib'e taşınmış canonical TypeScript sürümü:
// aynı codeword'ün CENTER + TOP-LEFT + BOTTOM-RIGHT bölgelerine yerleştirilmesi
// ve byte-wise majority voting decode. Wild crop50 V4 0% → V5 88.9%, crop kümesi
// V4 40.7% → V5 96.3% sonuçları bu mantığa dayanır.
//
// KIRMIZI ÇİZGİ: Bu modül V6 sprint'inde lib'e ilk kez giren YENİ dosyadır;
// `tripleShield.ts` md5=`0132693d…` ve diğer mevcut visual layer modülleri
// BYTE-IDENTICAL korunur. Sharp-free, pure-TS, native bağımlılık YOK.
//
// V6 production'da decode çağrısı `tripleShield.ts` veya üstündeki route
// katmanında, mevcut tek-region pipeline'a regresyon vermeden ek bir pass
// olarak entegre edilebilir.

/**
 * Multiplex bölgesi: bir codeword'ün stamp/decode edileceği piksel rect.
 */
export interface MultiplexRegion {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  tag: string;
}

/**
 * Anchor noktası (multiplex region'a remap edilirken kullanılan minimal şekil).
 */
export interface MultiplexAnchorXY {
  id: string;
  x: number;
  y: number;
}

/**
 * V6 default 3-region şeması: MS1 = CENTER (mevcut adaptive vault, çağıran
 * tarafça yönetilir, geriye dönük uyum için döndürülmez), MS2 = TOP-LEFT
 * (logo bölgesi), MS3 = BOTTOM-RIGHT (metin altı).
 *
 * Bölge oranları wild test V5'te (9 foto × 9 saldırı = 81 inst) doğrulanmış
 * sabitlerdir; %50 kırpma altında en az 1 bölgenin sağ kalma olasılığını
 * maksimize eder.
 */
export function multiplexRegions(
  W: number,
  H: number,
): { MS2: MultiplexRegion; MS3: MultiplexRegion } {
  return {
    MS2: {
      xMin: Math.floor(W * 0.2),
      xMax: Math.floor(W * 0.4),
      yMin: Math.floor(H * 0.1),
      yMax: Math.floor(H * 0.3),
      tag: "ms2",
    },
    MS3: {
      xMin: Math.floor(W * 0.6),
      xMax: Math.floor(W * 0.8),
      yMin: Math.floor(H * 0.7),
      yMax: Math.floor(H * 0.9),
      tag: "ms3",
    },
  };
}

/**
 * CENTER (MS1) anchor setini hedef multiplex bölgesine doğrusal remap eder
 * (anchor topolojisi/sırası korunur, sadece rect'e affine scale + translate).
 * Bölge çok küçükse yerinde clamp eder.
 */
export function remapAnchorsToRegion<T extends MultiplexAnchorXY>(
  anchors: T[],
  region: MultiplexRegion,
): MultiplexAnchorXY[] {
  if (anchors.length === 0) return [];
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const a of anchors) {
    if (a.x < xMin) xMin = a.x;
    if (a.x > xMax) xMax = a.x;
    if (a.y < yMin) yMin = a.y;
    if (a.y > yMax) yMax = a.y;
  }
  const sx = (region.xMax - region.xMin) / Math.max(1, xMax - xMin);
  const sy = (region.yMax - region.yMin) / Math.max(1, yMax - yMin);
  return anchors.map((a, i) => ({
    id: (a.id || `a${i}`) + `_v6${region.tag || ""}`,
    x: Math.round(region.xMin + (a.x - xMin) * sx),
    y: Math.round(region.yMin + (a.y - yMin) * sy),
  }));
}

/**
 * Byte-wise majority voting: 3 (veya N) bayt vektörü ve karşılıklı dataR1
 * skorları üzerinden mode (en sık tekrar eden) baytı seçer. Tie-break: en
 * yüksek dataR1 olan adayın baytı kazanır. Wild test V5'te crop40/50
 * kurtarmasının çekirdek mantığıdır.
 *
 * Tüm vektörler aynı uzunlukta (codeword bayt sayısı, default 32) olmalıdır.
 * `r1Scores[i]` opsiyonel — yoksa 0 varsayılır (tie-break tutarsız olur).
 */
export interface MultiplexCandidate {
  bytes: Uint8Array;
  r1Scores?: number[];
}

export function majorityVoteBytes(
  candidates: MultiplexCandidate[],
): { voted: Uint8Array; votedR1: number[] } {
  if (candidates.length === 0) {
    return { voted: new Uint8Array(0), votedR1: [] };
  }
  const N = candidates[0].bytes.length;
  for (const c of candidates) {
    if (c.bytes.length !== N) {
      throw new Error(
        `multiplex.majorityVoteBytes: candidate length mismatch (${c.bytes.length} vs ${N})`,
      );
    }
  }
  const voted = new Uint8Array(N);
  const votedR1: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const counts = new Map<number, number>();
    for (const c of candidates) {
      const b = c.bytes[i];
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    let winB = candidates[0].bytes[i];
    let winCnt = -1;
    let winR1 = -1;
    for (const c of candidates) {
      const b = c.bytes[i];
      const cnt = counts.get(b) || 0;
      const r1 = c.r1Scores?.[i] ?? 0;
      if (cnt > winCnt || (cnt === winCnt && r1 > winR1)) {
        winB = b;
        winCnt = cnt;
        winR1 = r1;
      }
    }
    voted[i] = winB;
    votedR1[i] = winR1;
  }
  return { voted, votedR1 };
}

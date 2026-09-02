import fs from "node:fs";
import path from "node:path";
import { videoInfo, sampleTimestamps, extractFrames } from "./ffmpegHelper";
import { decodePngL1L3, normalizeId, payload4 } from "./aegisCore";
import { decodeT6, getT6FrameMap, t6IsEnabled } from "./t6LowBand";
import type { T6Telemetry } from "./t6Types";
import { emptyT6Telemetry } from "./t6Types";
import {
  decodeChannelBFromFramePaths,
  emptyChannelBTelemetry,
  getChannelBFrameMap,
  type ChannelBDecodeTelemetry,
} from "./channelB";
import {
  extractFramesByExactAddresses,
  validatePrivateExactSealTimingMap,
  type ExactFrameAddress,
  type ExactSealTimingMap,
} from "./exactSealTimingMap";
import {
  buildA5StrongL1ByteMatchMask,
  decideFrameEvidence,
  FRAME_VAULT_MIN_STRONG_ANCHORS,
  STRONG_R1_THR,
} from "./frameEvidenceDecision";
import { assertCanonicalReaderInvocationAllowed } from "./canonicalReaderLiveScope";
export { buildA5StrongL1ByteMatchMask, decideFrameEvidence } from "./frameEvidenceDecision";

// === v0.3 hardening (18 May 2026, FP cal sonrası) ===
// Önceki tier yapısı: tier-A (byte≥2 AND strong≥2) ile tier-B (byte≥1 AND
// strong≥3) ikisi de VAULT frame sayılıyordu. N=100 null run (1 false
// VAULT, 99 WEAK) sonrası gerçek FP ≥ %1 empirik ölçüldü. Tier yapısı
// üç katmana çevrildi (sıkılaştırma — hiçbir eşik gevşetilmedi):
//
//   VAULT FRAME = keyed L1 payloadExact AND same-anchor keyed R1 strong on
//                 at least 2 anchors OR
//                 (same-anchor keyed L1 strongByteMatches ≥ 3 AND
//                  strongAnchors ≥ 2)
//   WEAK FRAME  = NOT vault AND (byteMatches ≥ 2 AND strongAnchors ≥ 2)
//                 (eski tier-A — artık "yarı-byte-corroborated" gözlem,
//                 vault eşiği değil, sadece WEAK sinyal göstergesi)
//   diğer       = ne vault ne weak (eski "strongFrames≥1" gevşek WEAK
//                 koşulu kaldırıldı — null klipte 99/100 tetikleniyordu)
//
// VAULT VERDICT: vaultFrames ≥ 2 (aynı — mevcut 4 başarı korunur)
// WEAK VERDICT:  weakFrames ≥ 2 (yeni — tek-frame yakaması yetmiyor)
//
// FP analizi (architect review düzeltmesi):
//   Muhafazakar üst sınır (byte criterion only, strong gating ihmal):
//     per-frame P(byte≥3 of 4 random) ≈ C(4,3)·(1/256)³ + (1/256)⁴ ≈ 2.4×10⁻⁷
//   Strong gating ile naive optimist (~9×10⁻⁹) iddiası kaldırıldı — sub-pixel
//   scan (±2 px, 25 offset) strong-hit olasılığını null veride şişirir +
//   byte/strong bağımsızlık varsayımı kırılır. Empirik kanıt güçlüdür:
//     N=100 v0.3 null run → 0/100 false VAULT, Wilson 95% upper ≤ %3.
//   N≥1000 daha sıkı CI için sonraki sprint planlı.
// "Anchor-only" frame'ler (strong≥3 ama byte≤1) artık verdict'e girmiyor
// ama `anchorOnlyFrames` telemetri sayacında raporlanıyor (architect req).
const FRAME_ANCHOR_ONLY_MIN_STRONG = 3; // telemetri eşiği (verdict değil)
const VAULT_MIN_VAULT_FRAMES = 2; // aynı — mevcut başarıyı korur
const WEAK_MIN_WEAK_FRAMES = 2; // YENİ — eski strongFrames≥1 yerine
// Early-exit on VAULT frames (not strong-only): a strong-but-unverified
// frame should NOT skip later stages where byte corroboration may emerge.
const LADDER_EARLY_EXIT_VAULT = 2;
// A5 temporal expected-match aggregation. Only keyed L1 bytes whose own R1
// anchor meets the unchanged strong threshold are counted. L3 is a 32-bit
// locator and is never an A5 evidence input. Verdict requires 4/4 anchors to
// each have at least A5_MIN_MATCHES_PER_ANCHOR strong keyed L1 matches.
const A5_MIN_MATCHES_PER_ANCHOR = 3;
const A5_MIN_FRAMES_TOTAL = 3; // hiç frame okunmadıysa A5 anlamsız

export function aggregateA5StrongL1Evidence(
  frames: readonly Pick<FrameDecodeRecord, "a5StrongL1ByteMatchMask">[],
): { matchesPerAnchor: number[]; aggregatedVault: boolean } {
  const matches = [0, 0, 0, 0];
  for (const frame of frames) {
    for (let index = 0; index < matches.length; index++) {
      if (frame.a5StrongL1ByteMatchMask[index] === true) matches[index]!++;
    }
  }
  return {
    matchesPerAnchor: matches,
    aggregatedVault: matches.every(
      (count) => count >= A5_MIN_MATCHES_PER_ANCHOR,
    ),
  };
}

export type Verdict = "VAULT" | "WEAK_SIGNAL" | "NOT_FOUND";

export interface FrameDecodeRecord {
  stage: string;
  frameIdx: number;
  tsSec: number;
  meanR1: number;
  r1Per: number[];
  decoded4Hex: string;
  expected4Hex: string;
  payloadMatch: boolean;
  /** Keyed L1-only byte evidence eligible for A5; L3 never populates this. */
  a5StrongL1ByteMatchMask: boolean[];
  byteMatches: number;
  strongAnchors: number;
  frameVault: boolean;
  frameWeak: boolean;
  errorMsg?: string;
}

export interface StageRecord {
  name: string;
  description: string;
  sampledCount: number;
  newFramesProcessed: number;
  skipped: boolean;
  skipReason?: string;
  strongFramesAfter: number;
  vaultFramesAfter: number;
  wallMs: number;
}

export interface DecodeResult {
  verdict: Verdict;
  /** Per-frame ladder result (A1-A4). */
  strongFrames: number;
  vaultFrames: number;
  /** v0.3: byte≥2 AND strong≥2 (vault değil ama yarı-byte-corroborated). */
  weakFrames: number;
  /** v0.3 architect req: strong≥3 ama byte≤1 (sinyal var, byte bozulmuş) —
   *  verdict'e girmez, sadece telemetri. Geometric distortion / lossy
   *  compression altında "anchor sağlam, byte channel öldü" durumunu sayar. */
  anchorOnlyFrames: number;
  /** A5 temporal expected-match aggregation (null if A5 was skipped). */
  aggregatedVault: boolean;
  /** Verdict before Sprint 2 Channel B is allowed to confirm the same ID. */
  channelAVerdict: Verdict;
  channelAIdMatched: boolean;
  channelB: ChannelBDecodeTelemetry;
  channelBIdMatched: boolean;
  bothChannelsMatched: boolean;
  singleChannelMatched: boolean;
  finalConfirmedBy: "channel_a" | "channel_b" | "both" | "none";
  /** Per-anchor: number of frames whose decoded byte equaled expected4[i]. */
  matchesPerAnchor: number[] | null;
  totalFramesAttempted: number;
  stages: StageRecord[];
  frames: FrameDecodeRecord[];
  wallMs: number;
  idHex: string;
  expectedPayload4Hex: string;
  videoDurationSec: number;
  videoFps: number;
  logLines: string[];
  /** v0.6 T6 Low-Band telemetry (default OFF; flag V06_T6_LOWBAND=1).
   *  T6 ANCAK A1-A5 NOT_FOUND verdiyse + flag açıkken denenir.
   *  T6 mevcut `verdict` alanını değiştirmez — ayrı telemetri olarak raporlanır. */
  t6?: T6Telemetry;
}

export interface DecodeOptions {
  videoPath: string;
  idInput: string;
  workDir?: string;
  /** AEGIS DNA frame hint provider (opsiyonel). Bayrak kapalıyken route bu
   *  alanı geçmez ⇒ decoder hiç çağırmaz ⇒ LADDER A1-A4 + A5 byte-identical.
   *  Bayrak açık ve hint hit ise A1 ÖNCESİ tek bir "DNA-HINT" aşaması
   *  hint frame'lerini dener; A1-A4 mevcut LADDER aynen devam eder.
   *  KARAR ZİNCİRİ DEĞİŞMEZ: VAULT için yine byte ID eşleşmesi şart. */
  dnaHintProvider?: (info: {
    totalFrames: number;
    idHex: string;
  }) => Promise<readonly number[] | undefined>;
  /** Sprint 2 Channel B frame hint provider. This reads the exact Channel B
   *  frame list written to DNA during encode. If absent, Channel A still runs
   *  normally and Channel B falls back to a derived, frame-disjoint map. */
  channelBHintProvider?: (info: {
    totalFrames: number;
    idHex: string;
  }) => Promise<readonly number[] | undefined>;
  /** Private registry timing map. In strict mode the reader never converts a
   * frame index through r_frame_rate and never applies an idx-1 correction. */
  exactSealTimingMapProvider?: (info: {
    totalFrames: number;
    idHex: string;
  }) => Promise<ExactSealTimingMap | undefined>;
  /** Fail closed when the exact private map is absent, belongs to another
   * record/timeline, or contains an invalid PTS/time_base address. */
  requireExactSealTimingMap?: boolean;
  /** Decision-neutral pixel normalization for a bounded recovery attempt.
   * The canonical reader omits this option. The callback cannot select an ID,
   * registry row or decision; the unchanged Channel A decoder still decides. */
  channelAFrameNormalizer?: (
    pngInput: Buffer,
    context: { stage: string; frameIdx: number; tsSec: number },
  ) => Buffer | Promise<Buffer>;
  /** Explicit D1 scope for a single recovery attempt. Undefined preserves the
   * historical default/flag behavior; advanced fallback passes false except
   * for its final bounded crop variant. */
  channelAD1CropGridEnabled?: boolean;
  /** Exact key lineage authenticated by the signed registry record. Readers
   * must not substitute the globally active sealing key. */
  authenticatedAegisKeyVersion?: string;
}

/** Ladder configuration: kolaydan zora, frame seçim genişliği artar.
 *  Aynı frame iki kez denenmez — yalnız "yeni" timestamp'ler işlenir.
 *  `explicitTimestamps` undefined ⇒ `sampleTimestamps(durationSec, count)`. */
interface LadderStage {
  name: string;
  description: string;
  count: number;
  /** DNA-HINT aşaması için sabit timestamp listesi. Diğer aşamalarda undefined. */
  explicitTimestamps?: number[];
  /** Private exact-map stage: ordinal + PTS/time_base; no FPS approximation. */
  exactAddresses?: ExactFrameAddress[];
}
const LADDER: LadderStage[] = [
  { name: "A1", description: "Kolay: başlangıç + orta + son (3 kare)", count: 3 },
  { name: "A2", description: "Orta: 8 kare örneklem (¼ aralıklarla)", count: 8 },
  { name: "A3", description: "Zor: 20 kare örneklem (yoğun)", count: 20 },
  { name: "A4", description: "En zor: 56 kare örneklem (geniş tarama)", count: 56 },
];

function exactMapFailClosedResult(input: {
  startedAtMs: number;
  idBuffer: Buffer;
  expected4: Buffer;
  info: Awaited<ReturnType<typeof videoInfo>>;
  reason: string;
}): DecodeResult {
  const channelB = {
    ...emptyChannelBTelemetry(input.expected4.toString("hex")),
    note: `Channel B skipped: exact private timing map rejected (${input.reason}).`,
  };
  return {
    verdict: "NOT_FOUND",
    strongFrames: 0,
    vaultFrames: 0,
    weakFrames: 0,
    anchorOnlyFrames: 0,
    aggregatedVault: false,
    channelAVerdict: "NOT_FOUND",
    channelAIdMatched: false,
    channelB,
    channelBIdMatched: false,
    bothChannelsMatched: false,
    singleChannelMatched: false,
    finalConfirmedBy: "none",
    matchesPerAnchor: null,
    totalFramesAttempted: 0,
    stages: [{
      name: "EXACT-SEAL-MAP",
      description: "Private exact ordinal + PTS/time_base registry map",
      sampledCount: 0,
      newFramesProcessed: 0,
      skipped: true,
      skipReason: `fail-closed:${input.reason}`,
      strongFramesAfter: 0,
      vaultFramesAfter: 0,
      wallMs: Date.now() - input.startedAtMs,
    }],
    frames: [],
    wallMs: Date.now() - input.startedAtMs,
    idHex: input.idBuffer.toString("hex"),
    expectedPayload4Hex: input.expected4.toString("hex"),
    videoDurationSec: input.info.durationSec,
    videoFps: input.info.fps,
    logLines: [
      `[EXACT-SEAL-MAP] rejected (${input.reason}); strict reader returned NOT_FOUND without legacy FPS scan`,
      "[VERDICT] NOT_FOUND — fail-closed exact timing map policy",
    ],
    t6: emptyT6Telemetry(),
  };
}

export async function decodeVideo(opts: DecodeOptions): Promise<DecodeResult> {
  assertCanonicalReaderInvocationAllowed();
  const t0 = Date.now();
  const log: string[] = [];
  const idBuffer = normalizeId(opts.idInput);
  const expected4 = payload4(idBuffer);
  const info = await videoInfo(opts.videoPath);
  log.push(
    `[VIDEO] dur=${info.durationSec.toFixed(2)}s fps=${info.fps.toFixed(2)} ` +
      `frames=${info.frameCount} ${info.width}x${info.height}`,
  );
  log.push(`[ID] expected payload4=${expected4.toString("hex")}`);

  const exactMapRaw = opts.exactSealTimingMapProvider
    ? await opts.exactSealTimingMapProvider({
        totalFrames: info.frameCount,
        idHex: idBuffer.toString("hex"),
      })
    : undefined;
  let exactMap: ExactSealTimingMap | undefined;
  if (exactMapRaw) {
    const validation = await validatePrivateExactSealTimingMap({
      videoPath: opts.videoPath,
      registryRecordIdHex: idBuffer.toString("hex"),
      map: exactMapRaw,
    });
    if (validation.valid) {
      exactMap = exactMapRaw;
      log.push(
        `[EXACT-SEAL-MAP] VALID A=${exactMap.channelA.length} B=${exactMap.channelB.length} ` +
          "(ordinal + PTS/time_base; no FPS conversion)",
      );
    } else if (opts.requireExactSealTimingMap) {
      return exactMapFailClosedResult({
        startedAtMs: t0,
        idBuffer,
        expected4,
        info,
        reason: validation.reason,
      });
    } else {
      log.push(`[EXACT-SEAL-MAP] ignored invalid optional map (${validation.reason})`);
    }
  } else if (opts.requireExactSealTimingMap) {
    return exactMapFailClosedResult({
      startedAtMs: t0,
      idBuffer,
      expected4,
      info,
      reason: "MAP_NOT_AVAILABLE",
    });
  }

  const workDir = opts.workDir ?? path.join(
    path.dirname(opts.videoPath),
    `_dec_${Date.now()}`,
  );
  // codeql[js/path-injection] Reported HTTP flow is from a literal text-only pre-seal call and cannot reach this video branch; product Live supplies a server-managed workDir.
  fs.mkdirSync(workDir, { recursive: true });

  const seenTimestamps = new Set<string>();
  const seenFrameIdxs = new Set<number>();
  const frames: FrameDecodeRecord[] = [];
  const stages: StageRecord[] = [];
  let strongFrames = 0;
  let vaultFrames = 0;
  let weakFrames = 0;
  let anchorOnlyFrames = 0;

  // ── AEGIS DNA frame hint (preferred ladder stage A0) ─────────────────
  // Bayrak (route'ta `AEGIS_DNA_FRAME_HINT`) açıkken `dnaHintProvider`
  // çağrılır. Hit dönerse A1 öncesinde tek bir "DNA-HINT" aşaması
  // hint frame'lerini dener; bulamazsa A1-A4 mevcut LADDER aynen devam
  // eder. seenTimestamps dedupe ile A1-A4 hint frame'lerini tekrar denemez.
  // KARAR ZİNCİRİ + EŞİKLER DEĞİŞMEZ.
  const dnaHintRaw = opts.dnaHintProvider
    ? await opts.dnaHintProvider({
        totalFrames: info.frameCount,
        idHex: idBuffer.toString("hex"),
      })
    : undefined;
  const dnaHintValid =
    dnaHintRaw !== undefined &&
    dnaHintRaw.length > 0 &&
    dnaHintRaw.every(
      (i) => Number.isInteger(i) && i >= 0 && i < info.frameCount,
    );
  const channelBHintRaw = opts.channelBHintProvider
    ? await opts.channelBHintProvider({
        totalFrames: info.frameCount,
        idHex: idBuffer.toString("hex"),
      })
    : undefined;
  const channelBHintValid =
    channelBHintRaw !== undefined &&
    channelBHintRaw.length > 0 &&
    channelBHintRaw.every(
      (i) => Number.isInteger(i) && i >= 0 && i < info.frameCount,
    );
  const exactMapStage: LadderStage | undefined = exactMap
    ? {
        name: "EXACT-SEAL-MAP",
        description: `Private exact map (${exactMap.channelA.length} Channel A frames)`,
        count: exactMap.channelA.length,
        exactAddresses: exactMap.channelA,
      }
    : undefined;
  const ladderStages: LadderStage[] = exactMapStage
    ? opts.requireExactSealTimingMap
      ? [exactMapStage]
      : [exactMapStage, ...LADDER]
    : dnaHintValid
      ? [
        {
          name: "DNA-HINT",
          description: `DNA önerisi (${dnaHintRaw.length} kare; A1 öncesi)`,
          count: dnaHintRaw.length,
          explicitTimestamps: Array.from(new Set(dnaHintRaw))
            .sort((a, b) => a - b)
            .map((i) => i / info.fps + 0.5 / info.fps),
        },
        ...LADDER,
      ]
      : LADDER;
  if (dnaHintValid) {
    log.push(
      `[DNA/HINT] ${dnaHintRaw.length} kare öneri (idHex match) — DNA-HINT aşaması A1 öncesinde denenecek`,
    );
  }

  try {
    for (const ladder of ladderStages) {
      const stageT0 = Date.now();
      // Early exit BEFORE running this stage if already ≥ threshold.
      if (vaultFrames >= LADDER_EARLY_EXIT_VAULT) {
        const rec: StageRecord = {
          name: ladder.name,
          description: ladder.description,
          sampledCount: ladder.count,
          newFramesProcessed: 0,
          skipped: true,
          skipReason: `already ${vaultFrames} vault frames (≥${LADDER_EARLY_EXIT_VAULT} threshold)`,
          strongFramesAfter: strongFrames,
          vaultFramesAfter: vaultFrames,
          wallMs: Date.now() - stageT0,
        };
        stages.push(rec);
        log.push(
          `[STAGE ${ladder.name}] SKIP — ${rec.skipReason}`,
        );
        continue;
      }

      const timestamps = ladder.exactAddresses
        ? []
        : ladder.explicitTimestamps ??
          sampleTimestamps(info.durationSec, ladder.count);
      // Dedupe: hem timestamp-string hem frameIdx bazlı. DNA-HINT
      // mid-frame offset kullanırken A1-A4 sampleTimestamps ile farklı
      // floating-point timestamp üretip aynı frame'e yuvarlanabilir;
      // frameIdx dedupe bu olası çakışmayı kesin engeller.
      const newTimestamps = timestamps.filter((t) => {
        if (seenTimestamps.has(t.toFixed(3))) return false;
        const fIdx = Math.min(
          info.frameCount - 1,
          Math.max(0, Math.round(t * info.fps)),
        );
        return !seenFrameIdxs.has(fIdx);
      });
      for (const t of newTimestamps) {
        seenTimestamps.add(t.toFixed(3));
        const fIdx = Math.min(
          info.frameCount - 1,
          Math.max(0, Math.round(t * info.fps)),
        );
        seenFrameIdxs.add(fIdx);
      }
      const newExactAddresses = (ladder.exactAddresses ?? []).filter((address) => {
        if (seenFrameIdxs.has(address.frameIdx)) return false;
        seenFrameIdxs.add(address.frameIdx);
        seenTimestamps.add(`${address.pts}@${address.timeBase}`);
        return true;
      });
      const newFrameCount = ladder.exactAddresses
        ? newExactAddresses.length
        : newTimestamps.length;

      log.push(
        `[STAGE ${ladder.name}] ${ladder.description} — ` +
          `${newFrameCount} yeni kare (toplam istek ${ladder.count})`,
      );

      if (newFrameCount === 0) {
        stages.push({
          name: ladder.name,
          description: ladder.description,
          sampledCount: ladder.count,
          newFramesProcessed: 0,
          skipped: true,
          skipReason: "tüm kareler önceki aşamada zaten denendi",
          strongFramesAfter: strongFrames,
          vaultFramesAfter: vaultFrames,
          wallMs: Date.now() - stageT0,
        });
        log.push(
          `[STAGE ${ladder.name}] tüm kareler önceki aşamada denendi, atlanıyor`,
        );
        continue;
      }

      const extracted = ladder.exactAddresses
        ? await extractFramesByExactAddresses({
            videoPath: opts.videoPath,
            addresses: newExactAddresses,
            outDir: workDir,
          })
        : await extractFrames(opts.videoPath, newTimestamps, workDir);
      for (const fr of extracted) {
        const frameIdx = "frameIdx" in fr && typeof fr.frameIdx === "number"
          ? fr.frameIdx
          : Math.round(fr.tsSec * info.fps);
        try {
          const extractedPng = fs.readFileSync(fr.pngPath);
          const buf = opts.channelAFrameNormalizer
            ? await opts.channelAFrameNormalizer(extractedPng, {
                stage: ladder.name,
                frameIdx,
                tsSec: fr.tsSec,
              })
            : extractedPng;
          const dec = await decodePngL1L3(buf, idBuffer, {
            d1CropGridEnabled: opts.channelAD1CropGridEnabled,
            authenticatedAegisKeyVersion:
              opts.authenticatedAegisKeyVersion,
          });
          // Combined L1+L3 matches remain telemetry/candidate support only.
          // A VAULT byte must be a keyed L1 match at the same anchor where
          // the unchanged R1 threshold is strong; L3 never feeds VAULT.
          const byteMatches = dec.combinedByteMatches;
          let strong = 0;
          const combinedR1Per: number[] = dec.l1.r1Per.slice();
          for (let i = 0; i < dec.l1.r1Per.length; i++) {
            if (dec.l1.r1Per[i]! >= STRONG_R1_THR) strong++;
          }
          const a5StrongL1ByteMatchMask = buildA5StrongL1ByteMatchMask({
            l1Decoded4: dec.l1.decoded4,
            expected4: dec.l1.expected4,
            l1R1Per: dec.l1.r1Per,
          });
          const frameDecision = decideFrameEvidence({
            l1PayloadMatch: dec.l1.payloadMatch,
            strongL1ByteMatchMask: a5StrongL1ByteMatchMask,
            combinedByteMatches: byteMatches,
            strongAnchors: strong,
          });
          const { frameVault, frameWeak } = frameDecision;
          // For logging, prefer the ring with bit-exact match; else show L1
          // decoded bytes (parity with v0.3 logs).
          const decoded4Hex = dec.l1.payloadMatch
            ? dec.l1.decoded4.toString("hex")
            : dec.l3.payloadMatch
              ? dec.l3.decoded4.toString("hex")
              : dec.l1.decoded4.toString("hex");
          const rec: FrameDecodeRecord = {
            stage: ladder.name,
            frameIdx,
            tsSec: fr.tsSec,
            meanR1: dec.meanR1,
            r1Per: combinedR1Per,
            decoded4Hex,
            expected4Hex: dec.l1.expected4.toString("hex"),
            payloadMatch: dec.payloadMatch,
            a5StrongL1ByteMatchMask,
            byteMatches,
            strongAnchors: strong,
            frameVault,
            frameWeak,
          };
          frames.push(rec);
          if (frameVault) vaultFrames++;
          else if (frameWeak) weakFrames++;
          if (strong >= FRAME_VAULT_MIN_STRONG_ANCHORS) strongFrames++;
          // v0.3 architect req: anchor signal sağlam ama byte channel ölü.
          // Verdict'e girmez, sadece telemetri (geometric/lossy bozulma).
          if (!frameVault && !frameWeak &&
              strong >= FRAME_ANCHOR_ONLY_MIN_STRONG && byteMatches <= 1) {
            anchorOnlyFrames++;
          }
          log.push(
            `  [${ladder.name}] t=${fr.tsSec.toFixed(2)}s meanR1=${dec.meanR1.toFixed(3)} ` +
              `strong=${strong}/4 strongL1ByteMatch=${frameDecision.strongL1ByteMatches}/4 ` +
              `combinedByteMatch=${byteMatches}/4 l1PayloadExact=${dec.l1.payloadMatch ? "✓" : "✗"} ` +
              `decoded=${decoded4Hex} ` +
              `${frameVault ? "✅ VAULT" : frameWeak ? "🟡 WEAK" : "—"}`,
          );
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          frames.push({
            stage: ladder.name,
            frameIdx,
            tsSec: fr.tsSec,
            meanR1: 0,
            r1Per: [],
            decoded4Hex: "",
            expected4Hex: expected4.toString("hex"),
            payloadMatch: false,
            a5StrongL1ByteMatchMask: [false, false, false, false],
            byteMatches: 0,
            strongAnchors: 0,
            frameVault: false,
            frameWeak: false,
            errorMsg: errMsg,
          });
          log.push(`  [${ladder.name}] t=${fr.tsSec.toFixed(2)}s ERROR ${errMsg}`);
        } finally {
          try {
            fs.unlinkSync(fr.pngPath);
          } catch {
            /* ignore */
          }
        }
      }

      stages.push({
        name: ladder.name,
        description: ladder.description,
        sampledCount: ladder.count,
        newFramesProcessed: newFrameCount,
        skipped: false,
        strongFramesAfter: strongFrames,
        vaultFramesAfter: vaultFrames,
        wallMs: Date.now() - stageT0,
      });
      log.push(
        `[STAGE ${ladder.name}] bitti — strongFrames=${strongFrames} vaultFrames=${vaultFrames} ` +
          `weakFrames=${weakFrames} wall=${((Date.now() - stageT0) / 1000).toFixed(1)}s`,
      );
    }
  } finally {
    try {
      // codeql[js/path-injection] Same unreachable text-only flow as the guarded creation above; cleanup targets only this invocation's workDir.
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  // ===== A5 — Temporal expected-match aggregation (yalnız A1-A4 vault<2 ise) =====
  let aggregatedVault = false;
  let matchesPerAnchor: number[] | null = null;
  const a5T0 = Date.now();
  if (vaultFrames >= VAULT_MIN_VAULT_FRAMES) {
    stages.push({
      name: "A5",
      description: "Temporal expected-match aggregation (per-anchor match count)",
      sampledCount: 0,
      newFramesProcessed: 0,
      skipped: true,
      skipReason: `vault zaten ${vaultFrames} (≥${VAULT_MIN_VAULT_FRAMES}) — A5 gerekmez`,
      strongFramesAfter: strongFrames,
      vaultFramesAfter: vaultFrames,
      wallMs: Date.now() - a5T0,
    });
    log.push(`[STAGE A5] SKIP — ${vaultFrames} vault zaten yeterli`);
  } else if (frames.length < A5_MIN_FRAMES_TOTAL) {
    stages.push({
      name: "A5",
      description: "Temporal expected-match aggregation (per-anchor match count)",
      sampledCount: 0,
      newFramesProcessed: 0,
      skipped: true,
      skipReason: `yalnız ${frames.length} frame okundu (≥${A5_MIN_FRAMES_TOTAL} gerekli)`,
      strongFramesAfter: strongFrames,
      vaultFramesAfter: vaultFrames,
      wallMs: Date.now() - a5T0,
    });
    log.push(`[STAGE A5] SKIP — yalnız ${frames.length} frame`);
  } else {
    const aggregation = aggregateA5StrongL1Evidence(frames);
    const matches = aggregation.matchesPerAnchor;
    matchesPerAnchor = matches;
    aggregatedVault = aggregation.aggregatedVault;
    stages.push({
      name: "A5",
      description: "Temporal keyed-L1 strong expected-match aggregation",
      sampledCount: frames.length,
      newFramesProcessed: 0,
      skipped: false,
      strongFramesAfter: strongFrames,
      vaultFramesAfter: vaultFrames,
      wallMs: Date.now() - a5T0,
    });
    log.push(
      `[STAGE A5] matches/anchor=[${matches.join(",")}] (eşik≥${A5_MIN_MATCHES_PER_ANCHOR} her birinde) ` +
        `frames=${frames.length} ` +
        `${aggregatedVault ? "✅ AGGREGATED VAULT" : "— yetersiz match"}`,
    );
  }

  let verdict: Verdict = "NOT_FOUND";
  if (vaultFrames >= VAULT_MIN_VAULT_FRAMES || aggregatedVault) verdict = "VAULT";
  // v0.3 WEAK: ≥2 frame'de byte≥2 AND strong≥2 (yarı-byte yakaması).
  // Eski "strongFrames ≥ 1" koşulu null klipte 99/100 tetikleniyordu →
  // kullanıcıya gösterilen sinyal değeri sıfırdı. Yeni koşul: tek-frame
  // yakaması yetmiyor, iki bağımsız yarı-corroborated frame gerekir.
  else if (weakFrames >= WEAK_MIN_WEAK_FRAMES) verdict = "WEAK_SIGNAL";

  const channelAVerdict = verdict;
  const channelAIdMatched = channelAVerdict === "VAULT";

  // Sprint 2 Channel B: second independent, frame-disjoint carrier.
  // Prefer the exact Channel B frame list persisted in DNA. If that exact hint
  // is absent but Channel A DNA exists, derive the same disjoint map. Either
  // way, Channel A/A5 already ran above and remains authoritative unless B
  // reads the same expected ID.
  let channelB: ChannelBDecodeTelemetry = emptyChannelBTelemetry(
    expected4.toString("hex"),
  );
  if (exactMap || channelBHintValid || dnaHintValid) {
    const channelBWorkDir = path.join(
      path.dirname(opts.videoPath),
      `_dec_channel_b_${Date.now()}`,
    );
    // codeql[js/path-injection] Same unreachable text-only flow; the real product caller supplies an internal, server-managed video path.
    fs.mkdirSync(channelBWorkDir, { recursive: true });
    try {
      const channelBMap = exactMap
        ? exactMap.channelB.map((address) => address.frameIdx)
        : channelBHintValid
          ? Array.from(new Set(channelBHintRaw)).sort((a, b) => a - b)
          : getChannelBFrameMap(
              info.frameCount,
              Array.from(new Set(dnaHintRaw ?? [])).sort((a, b) => a - b),
            );
      if (channelBMap.length > 0) {
        // Strict exact-map path intentionally has no idx-1 correction and no
        // frameIdx/r_frame_rate conversion. Legacy behavior remains byte-for-
        // byte below when no exact private registry map was supplied.
        const extractedB = exactMap
          ? await extractFramesByExactAddresses({
              videoPath: opts.videoPath,
              addresses: exactMap.channelB,
              outDir: channelBWorkDir,
            })
          : await extractFrames(
              opts.videoPath,
              channelBMap
                .map((idx) => Math.max(0, idx - 1))
                .map((idx) => idx / info.fps + 0.5 / info.fps),
              channelBWorkDir,
            );
        channelB = await decodeChannelBFromFramePaths({
          framePaths: extractedB.map((f, i) => ({
            frameIdx:
              "frameIdx" in f && typeof f.frameIdx === "number"
                ? f.frameIdx
                : channelBMap[i] ?? 0,
            pngPath: f.pngPath,
          })),
          expectedPayload4: expected4,
        });
      } else {
        channelB = {
          ...channelB,
          attempted: true,
          note: "Channel B skipped: no frame-disjoint slots available.",
        };
      }
    } catch (e) {
      channelB = {
        ...channelB,
        attempted: true,
        note:
          "Channel B error: " +
          (e instanceof Error ? e.message : String(e)),
      };
    } finally {
      // codeql[js/path-injection] Same unreachable text-only flow; cleanup is confined to the Channel B directory created above.
      try { fs.rmSync(channelBWorkDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  } else {
    channelB = {
      ...channelB,
      note:
        "Channel B skipped: DNA channel map not available; A1-A5 search still ran.",
    };
  }

  const channelBIdMatched = channelB.idMatched === true;
  if (verdict !== "VAULT" && channelBIdMatched) verdict = "VAULT";
  const bothChannelsMatched = channelAIdMatched && channelBIdMatched;
  const singleChannelMatched =
    (channelAIdMatched || channelBIdMatched) && !bothChannelsMatched;
  const finalConfirmedBy =
    bothChannelsMatched
      ? "both"
      : channelAIdMatched
        ? "channel_a"
        : channelBIdMatched
          ? "channel_b"
          : "none";

  log.push(
    `[VERDICT] ${verdict} — vaultFrames=${vaultFrames} weakFrames=${weakFrames} ` +
      `strongFrames=${strongFrames} attempted=${frames.length} ` +
      `wall=${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );

  // ===== v0.6 T6 Low-Band fallback (default OFF) =====
  // Yalnız (a) A1-A5 NOT_FOUND verdiyse VE (b) V06_T6_LOWBAND=1 flag açıksa
  // çalışır. T6 ayrı bir telemetri alanı üretir — mevcut `verdict` alanı
  // DEĞİŞMEZ. T6_VAULT yalnız 32/32 bit-exact + hash match olursa raporlanır.
  let t6Telemetry: T6Telemetry = emptyT6Telemetry();
  if (t6IsEnabled() && verdict === "NOT_FOUND") {
    const t6WorkDir = path.join(
      path.dirname(opts.videoPath),
      `_dec_t6_${Date.now()}`,
    );
    // codeql[js/path-injection] Same unreachable text-only flow; the optional T6 directory is derived from the internal video path only.
    fs.mkdirSync(t6WorkDir, { recursive: true });
    try {
      // v0.6.3 AEGIS DNA simetri: T6 frame haritası encode-side ile AYNI
      // fonksiyondan üretilir (getT6FrameMap). 11 slot × 1 frame = 11 örneklem
      // (önceki sürümlerde 56 sample full-range; v0.6.3'te haritayla simetri).
      // Çakışan slot'larda T6 PNG yok → ~0 DC shift → gürültü oy; haritalı
      // slot'larda T6 PNG var → bit-exact oy.
      const t6Map = getT6FrameMap(info.frameCount);
      const t6Timestamps = t6Map.map((m) => m.idx / info.fps);
      const t6Extracted = await extractFrames(opts.videoPath, t6Timestamps, t6WorkDir);
      // v0.6.3 AEGIS DNA: slot bilgisini explicit ilet — decodeT6 tsSec'den
      // yaklaşık hesap yapmak yerine encode-side ile bire bir aynı slot
      // numarasını kullanır (matematiksel simetri garantisi).
      const framePaths = t6Extracted.map((f, i) => ({
        tsSec: f.tsSec,
        pngPath: f.pngPath,
        slot: t6Map[i]?.slot ?? 0,
      }));
      t6Telemetry = await decodeT6({
        framePaths,
        videoDurationSec: info.durationSec,
        expectedPayload4: expected4,
      });
      log.push(
        `[T6] enabled=${t6Telemetry.enabled} attempted=${t6Telemetry.attempted} ` +
          `frames=${t6Telemetry.frameCount} matching=${t6Telemetry.matchingBits}/32 ` +
          `parityOk=${t6Telemetry.parityOk ? "✓" : "✗"} hashOk=${t6Telemetry.hashOk ? "✓" : "✗"} ` +
          `verdict=${t6Telemetry.verdict} candidate=${t6Telemetry.candidatePayloadHex || "—"} ` +
          `expected=${t6Telemetry.expectedPayloadHex}`,
      );
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      log.push(`[T6] ERROR ${errMsg}`);
    } finally {
      // codeql[js/path-injection] Same unreachable text-only flow; cleanup is confined to the T6 directory created above.
      try { fs.rmSync(t6WorkDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  } else if (t6IsEnabled() && verdict !== "NOT_FOUND") {
    t6Telemetry = {
      ...emptyT6Telemetry(),
      enabled: true,
      attempted: false,
      expectedPayloadHex: expected4.toString("hex"),
      note: `T6 atlandı (verdict=${verdict}; T6 yalnız A1-A5 NOT_FOUND fallback)`,
    };
    log.push(`[T6] SKIP — verdict=${verdict} (T6 yalnız NOT_FOUND fallback)`);
  }

  return {
    verdict,
    aggregatedVault,
    channelAVerdict,
    channelAIdMatched,
    channelB,
    channelBIdMatched,
    bothChannelsMatched,
    singleChannelMatched,
    finalConfirmedBy,
    matchesPerAnchor,
    strongFrames,
    vaultFrames,
    weakFrames,
    anchorOnlyFrames,
    totalFramesAttempted: frames.length,
    stages,
    frames,
    wallMs: Date.now() - t0,
    idHex: idBuffer.toString("hex"),
    expectedPayload4Hex: expected4.toString("hex"),
    videoDurationSec: info.durationSec,
    videoFps: info.fps,
    logLines: log,
    t6: t6Telemetry,
  };
}

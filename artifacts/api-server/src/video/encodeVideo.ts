import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  videoInfo,
  sampleTimestamps,
  extractFrames,
  replaceFramesInVideo,
} from "./ffmpegHelper";
import {
  stampPngL1L3,
  normalizeId,
  scoreFrameForStamping,
} from "./aegisCore";
import { applyT6EncodeToPng, getT6FrameMap, t6IsEnabled } from "./t6LowBand";
import { payload4 as computePayload4 } from "./aegisCore";
import {
  buildChannelBEncodeStats,
  getChannelBFrameMap,
  stampChannelBPng,
  type ChannelBEncodeStats,
} from "./channelB";
import {
  buildVideoDnaPreAnalysis,
  type DnaPreAnalysisReport,
} from "../dna/preAnalysis";
import {
  buildDnaPilotTracePlan,
  stampDnaPilotTracePng,
  type DnaPilotTracePlan,
} from "./dnaPlacementPilot";
import {
  buildVideoVisualModuleSealPlan,
  stampVideoVisualModuleTraces,
  type VideoVisualModuleSealPlan,
} from "./visualModuleSeal";
import {
  buildAudioV01SealPlan,
  muxAudioV01IntoVideo,
  type AudioV01SealPlan,
} from "./audioModule";

/** v0.5 Layer A — pool oversampling factor. Pool = stampCount × this, capped
 *  at total frames. 3× is enough to give substrate scoring real choice without
 *  blowing extraction cost for short videos. */
const POOL_MULTIPLIER = 3;
/** Brightness validity band (mean Y). Outside → harsh libx264 quantization. */
const BRIGHTNESS_LO = 32;
const BRIGHTNESS_HI = 224;
/** Substrate-score cap. Beyond ~30 std → texture noise dominates, libx264
 *  drops bits aggressively, no extra margin. */
const SUBSTRATE_CAP = 30;

async function sha256FileStreaming(filePath: string): Promise<{
  hex: string;
  sizeBytes: number;
}> {
  const hash = createHash("sha256");
  let sizeBytes = 0;
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk);
      sizeBytes += chunk.length;
    });
    stream.once("end", resolve);
    stream.once("error", reject);
  });
  return { hex: hash.digest("hex"), sizeBytes };
}

export interface EncodeResult {
  outputPath: string;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  totalFrames: number;
  stampedFrameIdxs: number[];
  stampedTimestamps: number[];
  idHex: string;
  payload4Hex: string;
  /** Sprint 2: second independent, frame-disjoint video ID channel. */
  channelB: ChannelBEncodeStats;
  /** Sprint 4B/A2: shadow-only DNA pre-analysis. It does not change stamps. */
  dnaPreAnalysis: DnaPreAnalysisReport;
  /** Sprint 4D: default-off active DNA pilot trace. Candidate-only. */
  dnaPilotTrace: DnaPilotTracePlan;
  /** Phase 2: when video is active, image module also stamps its own traces. */
  visualModuleSeal: VideoVisualModuleSealPlan;
  /** Audio v0.1: when an audio stream exists, audio stamps its own traces. */
  audioModuleSeal: AudioV01SealPlan;
  /** v0.6.4 — AEGIS Seal Map / DNA kaydı. Decode bu turda kullanmıyor;
   *  yalnız kayıt-yönlü. Geriye dönük uyum: tüketici opsiyonel okur. */
  sealMap: import("./sealMap").VideoSealMap;
}

export interface EncodeOptions {
  videoPath: string;
  idInput: string;
  outputPath: string;
  /** How many frames to stamp (start/middle/end + interior samples). */
  stampCount?: number;
  workDir?: string;
  /** AEGIS DNA frame hint provider (opsiyonel). Bayrak kapalıyken route bu
   *  alanı geçmez ⇒ encoder hiç çağırmaz ⇒ v0.5A path byte-identical.
   *  Bayrak açık ve hint hit ise dönüş `number[]` olur ve substrate-aware
   *  pool/scoring tamamen atlanır; PNG'ler verilen index'lerden alınır.
   *  Provider undefined/empty döndürürse eski v0.5A yolu çalışır. */
  dnaHintProvider?: (info: {
    totalFrames: number;
    idHex: string;
  }) => Promise<readonly number[] | undefined>;
  /** Sprint 4C: default-off DNA candidate placement pilot. Report-only. */
  dnaPlacementPilot?: boolean;
  /** Sprint 4D: default-off DNA active pilot trace. Candidate-only. */
  dnaActivePlacementPilot?: boolean;
}

export async function encodeVideo(opts: EncodeOptions): Promise<EncodeResult> {
  const { videoPath, idInput, outputPath } = opts;
  const stampCount = opts.stampCount ?? 8;
  const idBuffer = normalizeId(idInput);
  const info = await videoInfo(videoPath);
  if (!info.width || !info.height || !info.frameCount) {
    throw new Error(
      `encodeVideo: bad video info ${JSON.stringify(info)}`,
    );
  }
  const workDir = opts.workDir ?? path.join(
    path.dirname(outputPath),
    `_enc_${Date.now()}`,
  );
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // ── AEGIS DNA frame hint (override) ────────────────────────────────
    // Bayrak (route'ta `AEGIS_DNA_FRAME_HINT`) açıkken `dnaHintProvider`
    // çağrılır. Hit dönerse v0.5A pool/scoring tamamen atlanır; verilen
    // frame index'leri için PNG'ler doğrudan extract edilir. Hint yoksa
    // (provider undefined, dönüş undefined/empty, ya da range dışı) eski
    // v0.5A yolu BİREBİR aynı çalışır.
    let chosen: Array<{ frameIdx: number; pngPath: string }>;
    let uniq: number[];

    const idHexEarly = idBuffer.toString("hex");
    const dnaHintRaw = opts.dnaHintProvider
      ? await opts.dnaHintProvider({
          totalFrames: info.frameCount,
          idHex: idHexEarly,
        })
      : undefined;
    const useDnaOverride =
      dnaHintRaw !== undefined &&
      dnaHintRaw.length > 0 &&
      dnaHintRaw.every(
        (i) => Number.isInteger(i) && i >= 0 && i < info.frameCount,
      );

    if (useDnaOverride) {
      const overrideUniq = Array.from(new Set(dnaHintRaw)).sort(
        (a, b) => a - b,
      );
      const overrideExtracted = await extractFrames(
        videoPath,
        overrideUniq.map((i) => i / info.fps + 0.5 / info.fps),
        workDir,
      );
      chosen = overrideUniq.map((idx, i) => ({
        frameIdx: idx,
        pngPath: overrideExtracted[i]!.pngPath,
      }));
      uniq = overrideUniq;
      console.log(
        `[DNA/HINT] override=${overrideUniq.length} frames ` +
          `(substrate scoring skipped; v0.5A pool path bypassed)`,
      );
    } else {
    // v0.5 Layer A — pool sampling + substrate-aware frame selection.
    // 1. Generate a 3×-oversampled candidate pool (capped by frame count).
    // 2. Score each candidate (anchor-region std-dev + brightness validity +
    //    motion delta vs prev candidate).
    // 3. Pick the top `stampCount` by score with deterministic tie-break
    //    (index ascending). No randomness — same input → same selection.
    const poolSize = Math.min(stampCount * POOL_MULTIPLIER, info.frameCount);
    const poolTimestamps = sampleTimestamps(info.durationSec, poolSize);
    const poolFrameIdxs = poolTimestamps.map((t) =>
      Math.min(info.frameCount - 1, Math.max(0, Math.round(t * info.fps))),
    );
    // Dedupe & sort (preserves determinism, drops close timestamps mapping
    // to the same frame).
    const poolUniq = Array.from(new Set(poolFrameIdxs)).sort((a, b) => a - b);

    // Extract pool as clean PNGs.
    const poolExtracted = await extractFrames(
      videoPath,
      poolUniq.map((i) => i / info.fps + 0.5 / info.fps),
      workDir,
    );

    // Score each candidate.
    interface CandidateScore {
      frameIdx: number;
      pngPath: string;
      substrate: number;   // min anchor 32×32 std-dev
      meanY: number;       // brightness validity
      payloadHash: number; // motion-delta proxy
      anchorStds: number[];
      score: number;       // combined
    }
    const scored: CandidateScore[] = [];
    let prevHash: number | null = null;
    for (let i = 0; i < poolUniq.length; i++) {
      const frameIdx = poolUniq[i]!;
      const pngPath = poolExtracted[i]!.pngPath;
      const s = await scoreFrameForStamping(fs.readFileSync(pngPath));
      // Substrate: cap to SUBSTRATE_CAP; lower = worse.
      const subScore = Math.min(SUBSTRATE_CAP, s.substrate);
      // Brightness validity: 1.0 inside band, linearly drops outside.
      const brightOK =
        s.meanY >= BRIGHTNESS_LO && s.meanY <= BRIGHTNESS_HI
          ? 1.0
          : Math.max(
              0,
              1 -
                (s.meanY < BRIGHTNESS_LO
                  ? BRIGHTNESS_LO - s.meanY
                  : s.meanY - BRIGHTNESS_HI) /
                  32,
            );
      // Motion penalty: |hash - prev| / 2^32 ∈ [0,1]. Lower delta = lower
      // motion = libx264 quantizes more gently across temporal frame.
      // First frame has no previous → treat as 0 motion (no penalty).
      let motionDelta = 0;
      if (prevHash !== null) {
        // Symmetric hash distance: bit-mismatch normalized.
        let xor = (s.payloadHash ^ prevHash) >>> 0;
        let bits = 0;
        while (xor) {
          bits += xor & 1;
          xor >>>= 1;
        }
        motionDelta = bits / 32; // 0..1
      }
      prevHash = s.payloadHash;
      const motionScore = 1 - motionDelta;
      // Combined: substrate is primary (weight 100), brightness 10, motion 1.
      const score = subScore * 100 + brightOK * 10 + motionScore * 1;
      scored.push({
        frameIdx,
        pngPath,
        substrate: s.substrate,
        meanY: s.meanY,
        payloadHash: s.payloadHash,
        anchorStds: s.anchorStds,
        score,
      });
    }

    // Pick top stampCount by score (desc), tie-break by frameIdx asc.
    const ranked = [...scored].sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.frameIdx - b.frameIdx,
    );
    const scoredChosen = ranked.slice(0, stampCount).sort(
      (a, b) => a.frameIdx - b.frameIdx,
    );
    uniq = scoredChosen.map((c) => c.frameIdx);

    // Telemetry (deterministic, useful for debugging).
    console.log(
      `[v05/A] pool=${poolUniq.length} chosen=${uniq.length} ` +
        `substrate=[min=${Math.min(...scoredChosen.map((c) => c.substrate)).toFixed(1)}, ` +
        `max=${Math.max(...scoredChosen.map((c) => c.substrate)).toFixed(1)}, ` +
        `mean=${(scoredChosen.reduce((s, c) => s + c.substrate, 0) / scoredChosen.length).toFixed(1)}] ` +
        `meanY=[${Math.min(...scoredChosen.map((c) => c.meanY)).toFixed(0)}..` +
        `${Math.max(...scoredChosen.map((c) => c.meanY)).toFixed(0)}]`,
    );

    chosen = scoredChosen.map((c) => ({
      frameIdx: c.frameIdx,
      pngPath: c.pngPath,
    }));
    } // ── /else (v0.5A pool path) ──

    // Stamp each chosen frame. v0.6.1: T6 wrap KALDIRILDI bu döngüden;
    // T6 ON yolunda tüm frame'lere post-process pass'inde uygulanır.
    const stampedFiles: Array<{ frameIdx: number; pngPath: string }> = [];
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i]!;
      const stamped = await stampPngL1L3(fs.readFileSync(c.pngPath), idBuffer);
      const dst = path.join(
        workDir,
        `stamped_${c.frameIdx.toString().padStart(6, "0")}.png`,
      );
      fs.writeFileSync(dst, stamped.pngBuffer);
      stampedFiles.push({ frameIdx: c.frameIdx, pngPath: dst });
    }

    // v0.6.3: T6 ON yolu — AEGIS DNA tam simetri, TEK FFV1 pass.
    //   (a) yer disjoint: T6_SAFE_CARRIERS ana mührün 32×32 patch'lerinden uzak;
    //   (b) frame disjoint: T6 kendi deterministik frame haritası
    //       (getT6FrameMap → 11 eşit dağılımlı idx); stamped frame ile çakışan
    //       T6 slot ATLANIR (yer öncelik ana mühürün).
    //   (c) tek replaceFramesInVideo çağrısı → ana mühür frame'leri ek FFV1
    //       roundtrip görmez → byte sinyali tam korunur (v0.6.2 recompress
    //       regresyonunun kök nedeni: ikinci FFV1 pass).
    // Default OFF → byte-identical v0.5A.
    // Sprint 2 Channel B: gercek ikinci video tasiyicisi.
    // Kanal A karelerine dokunmaz; farkli karelerde ayri bir Y-QIM grid ile
    // ayni payload4 bilgisini tasir. Tek replace pass kullanilir.
    const channelBFrameIdxs = getChannelBFrameMap(info.frameCount, uniq);
    const channelBTimestamps = channelBFrameIdxs.map(
      (idx) => idx / info.fps + 0.5 / info.fps,
    );
    const channelBOriginals = channelBTimestamps.length > 0
      ? await extractFrames(videoPath, channelBTimestamps, workDir)
      : [];
    const channelBFiles: Array<{ frameIdx: number; pngPath: string }> = [];
    const channelBPayload = computePayload4(idBuffer);
    for (let i = 0; i < channelBFrameIdxs.length; i++) {
      const frameIdx = channelBFrameIdxs[i]!;
      const orig = channelBOriginals[i];
      if (!orig) continue;
      const stamped = await stampChannelBPng(
        fs.readFileSync(orig.pngPath),
        channelBPayload,
      );
      const dst = path.join(
        workDir,
        `channel_b_${frameIdx.toString().padStart(6, "0")}.png`,
      );
      fs.writeFileSync(dst, stamped);
      channelBFiles.push({ frameIdx, pngPath: dst });
    }
    const channelB = buildChannelBEncodeStats(
      channelBFiles.map((f) => f.frameIdx),
    );
    const audioModuleSeal = await buildAudioV01SealPlan(videoPath);
    const dnaPreAnalysis = buildVideoDnaPreAnalysis({
      width: info.width,
      height: info.height,
      fps: info.fps,
      totalFrames: info.frameCount,
      durationSec: info.durationSec,
      channelAFrameIdxs: uniq,
      channelBFrameIdxs: channelB.frameIdxs,
      placementPilotEnabled:
        opts.dnaPlacementPilot === true ||
        opts.dnaActivePlacementPilot === true ||
        process.env.AEGIS_DNA_PLACEMENT_PILOT === "1" ||
        process.env.AEGIS_DNA_ACTIVE_PLACEMENT_PILOT === "1",
      activePlacementPilotEnabled:
        opts.dnaActivePlacementPilot === true ||
        process.env.AEGIS_DNA_ACTIVE_PLACEMENT_PILOT === "1",
    });
    const dnaPilotTrace = buildDnaPilotTracePlan(dnaPreAnalysis);
    const dnaPilotFiles: Array<{ frameIdx: number; pngPath: string }> = [];
    if (dnaPilotTrace.activeTraceApplied) {
      const pilotOriginals = await extractFrames(
        videoPath,
        dnaPilotTrace.frameIdxs.map((idx) => idx / info.fps + 0.5 / info.fps),
        workDir,
      );
      const pilotPayload = computePayload4(idBuffer);
      for (let i = 0; i < dnaPilotTrace.frameIdxs.length; i++) {
        const frameIdx = dnaPilotTrace.frameIdxs[i]!;
        const orig = pilotOriginals[i];
        if (!orig) continue;
        const stamped = await stampDnaPilotTracePng(
          fs.readFileSync(orig.pngPath),
          pilotPayload,
          dnaPilotTrace.selectedRegionId,
        );
        const dst = path.join(
          workDir,
          `dna_pilot_${frameIdx.toString().padStart(6, "0")}.png`,
        );
        fs.writeFileSync(dst, stamped);
        dnaPilotFiles.push({ frameIdx, pngPath: dst });
      }
      dnaPreAnalysis.placementPilot.activePilotTrace = {
        applied: dnaPilotFiles.length > 0,
        selectedRegionId: dnaPilotTrace.selectedRegionId,
        selectedRegionLabel: dnaPilotTrace.selectedRegionLabel,
        frameIdxs: dnaPilotFiles.map((f) => f.frameIdx),
        carrier: dnaPilotTrace.carrier,
        decisionRole: "candidate_only",
        canOpenVault: false,
      };
    }

    const visualUsedFrames = new Set<number>([
      ...uniq,
      ...channelB.frameIdxs,
      ...dnaPilotFiles.map((f) => f.frameIdx),
    ]);
    let visualModuleSeal = buildVideoVisualModuleSealPlan({
      totalFrames: info.frameCount,
      usedFrameIdxs: visualUsedFrames,
    });
    const visualModuleFiles = await stampVideoVisualModuleTraces({
      videoPath,
      fps: info.fps,
      workDir,
      payload4: computePayload4(idBuffer),
      plan: visualModuleSeal,
    });
    if (visualModuleSeal.active) {
      const framesByTrace = new Map<string, number[]>();
      for (const file of visualModuleFiles) {
        const frames = framesByTrace.get(file.visualTraceId) ?? [];
        frames.push(file.frameIdx);
        framesByTrace.set(file.visualTraceId, frames);
      }
      const traces = visualModuleSeal.traces
        .map((trace) => {
          const frames = framesByTrace.get(trace.visualTraceId) ?? [];
          return {
            ...trace,
            activeTraceApplied: frames.length > 0,
            frameIdxs: frames,
            frameCount: frames.length,
          };
        })
        .filter((trace) => trace.frameCount > 0);
      visualModuleSeal = {
        ...visualModuleSeal,
        traces,
        frameIdxs: visualModuleFiles.map((file) => file.frameIdx),
        frameCount: visualModuleFiles.length,
        traceCount: traces.length,
        active: visualModuleFiles.length > 0,
        note:
          visualModuleFiles.length > 0
            ? "Visual module stamped frame-disjoint ID traces; official VISUAL_VAULT still requires exact ID match."
            : "Visual module plan existed, but no visual trace frame was stamped.",
      };
    }
    const imageModule = dnaPreAnalysis.modules.find(
      (module) => module.module === "image",
    );
    if (imageModule) {
      imageModule.status = "active";
      imageModule.active = true;
      imageModule.actualSeal = visualModuleSeal.active
        ? "visual_module_frame_seal_phase2"
        : "visual_module_not_stamped_phase2";
      imageModule.suggestedTasks = visualModuleSeal.active
        ? ["visual_core_trace", "visual_ring_trace"]
        : ["visual_module_safe_frame_pool_insufficient"];
      imageModule.collisionRisk = visualModuleSeal.sealOverlaps;
      imageModule.reason = visualModuleSeal.active
        ? "Video frames are image material, so the visual module stamped its own frame-disjoint ID traces without touching video Channel A/B."
        : "Video frames are image material, but the visual module could not safely stamp enough frame-disjoint traces.";
    }
    const audioModule = dnaPreAnalysis.modules.find(
      (module) => module.module === "audio",
    );
    if (audioModule) {
      audioModule.status = audioModuleSeal.hasAudio ? "active" : "inactive";
      audioModule.active = audioModuleSeal.hasAudio;
      audioModule.actualSeal = audioModuleSeal.active
        ? "audio_v01_dual_fsk"
        : audioModuleSeal.hasAudio
          ? "audio_v01_not_stamped"
          : "not_run_without_audio";
      audioModule.suggestedTasks = audioModuleSeal.active
        ? ["audio_low_fsk_trace", "audio_mid_fsk_trace"]
        : audioModuleSeal.hasAudio
          ? ["audio_duration_or_layout_insufficient"]
          : ["no_audio_stream"];
      audioModule.collisionRisk = audioModuleSeal.sealOverlaps;
      audioModule.reason = audioModuleSeal.note;
    }

    const t6On = t6IsEnabled();
    const combinedFiles: Array<{ frameIdx: number; pngPath: string }> = [
      ...stampedFiles,
      ...channelBFiles,
      ...dnaPilotFiles,
      ...visualModuleFiles,
    ];
    let t6Stats = { mapSize: 0, t6Frames: 0, skippedClash: 0 };
    if (t6On) {
      const t6Payload = computePayload4(idBuffer);
      const stampedFrameSet: ReadonlySet<number> = new Set([
        ...uniq,
        ...channelB.frameIdxs,
        ...visualModuleFiles.map((f) => f.frameIdx),
      ]);
      const t6Map = getT6FrameMap(info.frameCount);
      // T6 frame'lerinin orijinallerini extract et (timestamps = idx/fps).
      const t6Slots = t6Map.filter((m) => !stampedFrameSet.has(m.idx));
      const skippedClash = t6Map.length - t6Slots.length;
      const t6Timestamps = t6Slots.map((m) => m.idx / info.fps);
      const t6Originals = t6Timestamps.length > 0
        ? await extractFrames(videoPath, t6Timestamps, workDir)
        : [];
      const t6Files: Array<{ frameIdx: number; pngPath: string }> = [];
      for (let i = 0; i < t6Slots.length; i++) {
        const slotInfo = t6Slots[i]!;
        const orig = t6Originals[i];
        if (!orig) continue;
        const origBuf = fs.readFileSync(orig.pngPath);
        const t6Buf = await applyT6EncodeToPng(origBuf, {
          stampedFrameIdxs: [],
          frameIdx: slotInfo.idx,
          totalFrames: info.frameCount,
          payload4: t6Payload,
        });
        const dst = path.join(
          workDir,
          `t6_${slotInfo.idx.toString().padStart(6, "0")}.png`,
        );
        fs.writeFileSync(dst, t6Buf);
        t6Files.push({ frameIdx: slotInfo.idx, pngPath: dst });
      }
      combinedFiles.push(...t6Files);
      t6Stats = {
        mapSize: t6Map.length,
        t6Frames: t6Files.length,
        skippedClash,
      };
      console.log(
        `[v06.3/T6] enabled — AEGIS DNA simetri (yer: T6_SAFE_CARRIERS ` +
          `≥12px ana patch'ten; frame haritası: ${t6Stats.t6Frames}/${t6Stats.mapSize} ` +
          `slot, ${t6Stats.skippedClash} çakışma ana mühürle atlandı; ` +
          `TEK replaceFramesInVideo pass)`,
      );
    }
    const unifiedOutputMode =
      process.env.TANCMARK_UNIFIED_OUTPUT_MODE?.trim() ||
      "FULL_MULTICHANNEL_OUTPUT";
    const adapterCActive =
      process.env.TANCMARK_VIDEO_WRITEBACK_ADAPTER?.trim() ===
      "unified_pts_watermark_adapter_c";
    const timelineControl = unifiedOutputMode === "VIDEO_TIMELINE_CONTROL";
    if (
      unifiedOutputMode !== "VIDEO_TIMELINE_CONTROL" &&
      unifiedOutputMode !== "FULL_MULTICHANNEL_OUTPUT"
    ) {
      throw new Error(`UNSUPPORTED_UNIFIED_OUTPUT_MODE:${unifiedOutputMode}`);
    }
    if (timelineControl && !adapterCActive) {
      throw new Error("VIDEO_TIMELINE_CONTROL_REQUIRES_ADAPTER_C");
    }
    const videoOnlyOutPath =
      audioModuleSeal.hasAudio && !timelineControl
        ? path.join(
            workDir,
            adapterCActive
              ? "video_only_for_audio_mux.mov"
              : "video_only_for_audio_mux.mkv",
          )
        : outputPath;
    await replaceFramesInVideo(
      videoPath,
      combinedFiles,
      videoOnlyOutPath,
      info.fps,
    );
    if (timelineControl) {
      console.log(
        "[TANCMARK_UNIFIED_OUTPUT_MODE] VIDEO_TIMELINE_CONTROL:" +
          "video watermark applied; source audio/non-video packets preserved by Adapter C;" +
          "not a full multichannel product result",
      );
    } else {
      await muxAudioV01IntoVideo({
        sourceMediaPath: videoPath,
        videoOnlyPath: videoOnlyOutPath,
        outputPath,
        workDir,
        payload4: computePayload4(idBuffer),
        plan: audioModuleSeal,
      });
    }

    const { payload4 } = await import("./aegisCore");
    const p4 = payload4(idBuffer);

    const { buildVideoSealMap } = await import("./sealMap");
    // Adli hafıza: kaynak dosyanın tamamını RAM'e almadan artımlı SHA-256.
    // Bu yol medya boyutuyla büyüyen yalnızca disk I/O yapar; bellek sabittir.
    let inputDigest: { hex: string; sizeBytes: number } | undefined;
    try {
      inputDigest = await sha256FileStreaming(videoPath);
    } catch {
      inputDigest = undefined;
    }
    const sealMap = buildVideoSealMap({
      width: info.width,
      height: info.height,
      fps: info.fps,
      totalFrames: info.frameCount,
      durationSec: info.durationSec,
      stampedFrameIdxs: uniq,
      idHex: idBuffer.toString("hex"),
      payload4Hex: p4.toString("hex"),
      pipelineVersion: t6On ? "v0.6.3+s2B" : "v0.5A+s2B",
      t6Enabled: t6On,
      channelBFrameIdxs: channelB.frameIdxs,
      dnaPreAnalysis,
      visualModuleSeal,
      audioModuleSeal,
      inputDigest,
    });

    return {
      outputPath,
      width: info.width,
      height: info.height,
      durationSec: info.durationSec,
      fps: info.fps,
      totalFrames: info.frameCount,
      stampedFrameIdxs: uniq,
      stampedTimestamps: uniq.map((i) => i / info.fps),
      idHex: idBuffer.toString("hex"),
      payload4Hex: p4.toString("hex"),
      channelB,
      dnaPreAnalysis,
      dnaPilotTrace: {
        ...dnaPilotTrace,
        activeTraceApplied: dnaPilotFiles.length > 0,
        frameIdxs: dnaPilotFiles.map((f) => f.frameIdx),
        frameCount: dnaPilotFiles.length,
      },
      visualModuleSeal,
      audioModuleSeal,
      sealMap,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

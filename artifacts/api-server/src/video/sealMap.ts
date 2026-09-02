/**
 * AEGIS DNA — Video Bağlama
 * ─────────────────────────────────────────────────────────────────────
 * Çekirdek AEGIS DNA tipleri `@workspace/aegis-core/dna` içinde. Bu modül
 * VIDEO için ortak DNA struct'ını üreten builder'ı tutar. Ana mühür
 * (tripleShield) frame'lerini DNA katmanı olarak yazar; T6 enabled ise
 * iskelet katman ekler (active=false, T6 internal export'u sonraki sprintte).
 *
 * Tasarım notları:
 *   - Geriye dönük uyum için `VideoSealMap = AegisDNA` alias'ı korunur.
 *   - Builder içerden `createEmptyDNA` + `addLayer` çağırır → ortak struct.
 *   - Decode'a hiçbir şey çağrılmıyor.
 *   - T6 kodunun internal sabitlerine dokunmuyor.
 *   - lib/aegis-core'a dokunmuyor (yalnız okuma: expectedTripleShieldAnchors).
 *   - Mühür mantığını / eşikleri değiştirmiyor.
 */

import {
  type AegisDNA,
  type DNALayer,
  type DNAReservedZone,
  type DNARegion,
  type DNASealedUnit,
  createEmptyDNA,
  addLayer,
  dnaSha256Hex,
  geometricChecksumFromRegions,
} from "@workspace/aegis-core";
import {
  expectedTripleShieldAnchors,
  type TripleShieldAnchor,
} from "@workspace/aegis-core/layers/visual/tripleShield";
import type { DnaPreAnalysisReport } from "../dna/preAnalysis";
import {
  VIDEO_VISUAL_MODULE_LAYER_ID,
  type VideoVisualModuleSealPlan,
} from "./visualModuleSeal";
import {
  AUDIO_V01_LAYER_ID,
  type AudioV01SealPlan,
} from "./audioModule";

/** Geriye uyum: VideoSealMap = AegisDNA (medya-agnostik ortak struct). */
export type VideoSealMap = AegisDNA;

/** Ana mühür (tripleShield) için tek patch'in piksel boyutu. */
const TRIPLE_SHIELD_PATCH_SIZE = 32;

/** Builder girdi struct'ı — encodeVideo'nun bildiği her şey. */
export interface BuildVideoSealMapInput {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec?: number;
  /** Ana mühürün bastığı frame index'leri (encodeVideo `stampedFrameIdxs`). */
  stampedFrameIdxs: ReadonlyArray<number>;
  idHex: string;
  payload4Hex: string;
  /** Pipeline sürümü — T6 ON ise "v0.6.3", aksi halde "v0.5A". */
  pipelineVersion: string;
  /** T6 katmanı iskeleti yazılsın mı? T6 enabled ise true. */
  t6Enabled: boolean;
  /** Sprint 2 Channel B frame-disjoint carrier frames. */
  channelBFrameIdxs?: ReadonlyArray<number>;
  /** Sprint 4B/A2 shadow-only pre-analysis. Advisory, never decisive. */
  dnaPreAnalysis?: DnaPreAnalysisReport;
  /** Phase 2: image module trace stamped on video frames, separate from A/B. */
  visualModuleSeal?: VideoVisualModuleSealPlan;
  /** Audio v0.1: audio module traces when the source has an audio stream. */
  audioModuleSeal?: AudioV01SealPlan;
  /** Orijinal video dosyasının byte'ları (varsa). SHA256 hesaplaması için.
   *  Yoksa contentDigest hex `""` ve sizeBytes=0 yazılır (kayıt yine geçerli,
   *  matematiksel ikiz alanı gelecek sprintte doldurulabilir). */
  inputBytes?: Buffer;
  /** Büyük medya için kaynak dosyanın akışlı hesaplanmış SHA-256 ve boyutu.
   * `inputBytes` ile aynı ham byte dizisini temsil eder, tamamını RAM'e almaz. */
  inputDigest?: { hex: string; sizeBytes: number };
}

/** Verilen bilgilerle tam AegisDNA (video varyantı) üret. Decode'a hiçbir
 *  şey çağırmaz, T6'nın internal sabitlerine dokunmaz. Salt-okuma. */
export function buildVideoSealMap(
  input: BuildVideoSealMapInput,
): AegisDNA {
  const {
    width,
    height,
    fps,
    totalFrames,
    durationSec,
    stampedFrameIdxs,
    idHex,
    payload4Hex,
    pipelineVersion,
    t6Enabled,
    channelBFrameIdxs = [],
    dnaPreAnalysis,
    visualModuleSeal,
    audioModuleSeal,
    inputBytes,
    inputDigest,
  } = input;

  // ── İçerik matematiksel özeti (adli hafıza) ────────────────────────
  // Orijinal video byte'ları varsa SHA256 hesapla; yoksa boş hex (kayıt
  // yine geçerli, gelecek sprintte sample-based digest eklenebilir).
  const contentDigest = inputDigest
    ? {
        algo: "sha256" as const,
        hex: inputDigest.hex,
        sizeBytes: inputDigest.sizeBytes,
        source: "bytes" as const,
      }
    : inputBytes
    ? {
        algo: "sha256" as const,
        hex: dnaSha256Hex(inputBytes),
        sizeBytes: inputBytes.length,
        source: "bytes" as const,
      }
    : {
        algo: "sha256" as const,
        hex: "",
        sizeBytes: 0,
        source: "bytes" as const,
      };

  // ── Ana mühür (tripleShield) katmanı ────────────────────────────────
  const anchors: TripleShieldAnchor[] = expectedTripleShieldAnchors(
    width,
    height,
  );

  const mainUnits: DNASealedUnit[] = stampedFrameIdxs.map((frameIdx) => {
    const regions: DNARegion[] = anchors.map((a: TripleShieldAnchor) => ({
      regionId: a.id, // "C00" | "C01" | "C10" | "C11"
      shape: "patch" as const,
      cx: a.x,
      cy: a.y,
      width: TRIPLE_SHIELD_PATCH_SIZE,
      height: TRIPLE_SHIELD_PATCH_SIZE,
      frameIdx,
      tsSec: frameIdx / fps,
      carries: "anchorRing",
    }));
    return {
      unitKey: frameIdx,
      unitMeta: { tsSec: frameIdx / fps, kind: "videoFrame" },
      regions,
    };
  });

  // Ana mühürün her stamped frame'inde 4 anchor patch'i "yasaklı alan".
  const mainReserved: DNAReservedZone[] = [];
  for (const unit of mainUnits) {
    for (const r of unit.regions) {
      mainReserved.push({
        unitScope: unit.unitKey,
        region: {
          regionId: r.regionId,
          shape: r.shape,
          cx: r.cx,
          cy: r.cy,
          width: r.width,
          height: r.height,
          frameIdx: r.frameIdx,
        },
        ownerLayer: "main-tripleShield",
        reason: "sealStamp",
      });
    }
  }

  const mainLayer: DNALayer = {
    layerId: "main-tripleShield",
    mediaType: "video",
    version: "v0.5A",
    active: true,
    units: mainUnits,
    reservedZones: mainReserved,
    freeZoneHint:
      "frame merkezi ± 76 px dışındaki bölgeler ana mühürce kullanılmıyor; " +
      "T6 / Layer B / zehir gibi katmanlar buralara basabilir.",
    meta: {
      anchorRing: "expectedTripleShieldAnchors (C00/C01/C10/C11)",
      patchSize: TRIPLE_SHIELD_PATCH_SIZE,
      stampedFrameCount: stampedFrameIdxs.length,
    },
  };

  // ── DNA iskeletini oluştur ──────────────────────────────────────────
  const activeMediaTypes: Array<"video" | "image" | "audio"> = ["video"];
  if (visualModuleSeal?.active) activeMediaTypes.push("image");
  if (audioModuleSeal?.hasAudio) activeMediaTypes.push("audio");

  const dna = createEmptyDNA({
    dnaId: `video:${idHex}`,
    primaryMediaType: "video",
    activeMediaTypes,
    purposes: [
      "seal",
      "search",
      "compare",
      "recover",
      "evidence",
      "moduleRouter",
      "forensicMemory",
    ],
    geometry: {
      width,
      height,
      fps,
      totalFrames,
      durationSec,
    },
    contentDigest,
    structuralFingerprint: {
      // Anchor harita parmak izi: aynı (width,height) iki kayıt aynı
      // checksum üretir; karşılaştırma için deterministik.
      geometricChecksum: geometricChecksumFromRegions(
        anchors.map((a) => ({
          regionId: a.id,
          shape: "patch" as const,
          cx: a.x,
          cy: a.y,
          width: TRIPLE_SHIELD_PATCH_SIZE,
          height: TRIPLE_SHIELD_PATCH_SIZE,
        })),
      ),
      structuralStats: {
        width,
        height,
        fps,
        totalFrames,
        stampedFrameCount: stampedFrameIdxs.length,
      },
      notes:
        "perceptualHash / audioFingerprint slot'ları gelecek sprintte (sample-based pHash + chromaprint).",
    },
    pipelineVersion,
    evidence: {
      idHex,
      payload4Hex,
      evidencePackId: null, // delil paketi UUID ileride
      legalTimestampHex: null,
    },
    freeZoneHints: [
      "Video frame merkezi ± 76 px dışı (ana mühür kullanmıyor).",
      "T6 ON path'inde 3 SAFE_CARRIER × 11 SLOT için DC ±2 alanı (sub-block top-left ofsetlerinde).",
      "Ses kanali (varsa): Audio v0.1 kendi dual-FSK izlerini yazar; ses yoksa not_run_without_audio.",
    ],
  });

  // ── Encode/Decode haritaları ────────────────────────────────────────
  dna.maps = {
    encodeMap: {
      mainTripleShield: {
        stampedFrameIdxs: [...stampedFrameIdxs],
        anchorIds: anchors.map((a) => a.id),
        patchSize: TRIPLE_SHIELD_PATCH_SIZE,
      },
      channelB: {
        frameIdxs: [...channelBFrameIdxs],
        carrier: "qim-y-mean-grid",
        payload4Hex,
      },
      visualModule: visualModuleSeal
        ? {
            layerId: visualModuleSeal.layerId,
            active: visualModuleSeal.active,
            frameIdxs: [...visualModuleSeal.frameIdxs],
            traces: visualModuleSeal.traces.map((trace) => ({
              visualTraceId: trace.visualTraceId,
              selectedRegionId: trace.selectedRegionId,
              frameIdxs: [...trace.frameIdxs],
              carrier: trace.carrier,
              payload4Hex,
            })),
          }
        : undefined,
      audioModule: audioModuleSeal
        ? {
            layerId: audioModuleSeal.layerId,
            active: audioModuleSeal.active,
            hasAudio: audioModuleSeal.hasAudio,
            audioInfo: audioModuleSeal.audioInfo,
            traces: audioModuleSeal.traces.map((trace) => ({
              traceId: trace.traceId,
              carrier: trace.carrier,
              startSec: trace.startSec,
              durationSec: trace.durationSec,
              bitDurationSec: trace.bitDurationSec,
              freqZeroHz: trace.freqZeroHz,
              freqOneHz: trace.freqOneHz,
              payload4Hex,
            })),
          }
        : undefined,
    },
    decodeMap: {
      mainTripleShield: {
        searchHint:
          "decodeVideo A1-A5 ladder; karar bloğu byte-identical, harita kayıt-yönlü hint.",
        anchorRingCenter: {
          cx: Math.floor(width / 2),
          cy: Math.floor(height / 2),
          offsets: anchors.map((a) => ({ id: a.id, dx: a.x - Math.floor(width / 2), dy: a.y - Math.floor(height / 2) })),
        },
      },
      channelB: {
        searchHint:
          "Sprint 2 Channel B: frame-disjoint QIM Y-mean grid; same payload4, ID match required.",
      },
      visualModule: visualModuleSeal
        ? {
            searchHint:
              "Phase 2 image module trace: frame-disjoint visual ID carrier. VISUAL_VAULT requires exact ID match; it does not change classic VAULT.",
            layerId: visualModuleSeal.layerId,
            traceIds: visualModuleSeal.traces.map((trace) => trace.visualTraceId),
          }
        : undefined,
      audioModule: audioModuleSeal
        ? {
            searchHint:
              "Audio v0.1 dual FSK traces. AUDIO_VAULT requires one full trace to recover exact 32/32 ID.",
            layerId: audioModuleSeal.layerId,
            traceIds: audioModuleSeal.traces.map((trace) => trace.traceId),
            noFragmentCombining: true,
          }
        : undefined,
    },
    notes:
      "Bu haritalar bu sprintte kayıt-yönlüdür; decode tarafı sonraki sprintte tüketecek (KIRMIZI ÇİZGİ: karar bloğu dokunulmaz).",
  };

  if (dnaPreAnalysis) {
    dna.meta = {
      ...(dna.meta ?? {}),
      preSealAnalysis: dnaPreAnalysis,
      videoVisualModuleSeal: visualModuleSeal,
      audioV01Seal: audioModuleSeal,
    };
  }

  // ── Ana katman ──────────────────────────────────────────────────────
  addLayer(dna, mainLayer);

  if (channelBFrameIdxs.length > 0) {
    addLayer(dna, {
      layerId: "video-channel-b-qim-y",
      mediaType: "video",
      version: "sprint2",
      active: true,
      units: channelBFrameIdxs.map((frameIdx) => ({
        unitKey: frameIdx,
        unitMeta: { tsSec: frameIdx / fps, kind: "videoFrame" },
        regions: [
          {
            regionId: "channelB-qim-y-grid",
            shape: "patch" as const,
            cx: Math.floor(width / 2),
            cy: Math.floor(height * 0.62),
            width: Math.max(8, Math.floor(width * 0.28)),
            height: Math.max(8, Math.floor(height * 0.18)),
            frameIdx,
            tsSec: frameIdx / fps,
            carries: "payload4",
          },
        ],
      })),
      reservedZones: [],
      freeZoneHint:
        "Channel B uses frames disjoint from main-tripleShield; no same-frame overlap with Channel A.",
      meta: {
        carrier: "qim-y-mean-grid",
        frameCount: channelBFrameIdxs.length,
        payload4Hex,
        channelAOverlap: 0,
      },
    });
  }

  // ── T6 iskelet katmanı (T6 ON ise) ──────────────────────────────────
  if (visualModuleSeal?.active && visualModuleSeal.traces.length > 0) {
    addLayer(dna, {
      layerId: VIDEO_VISUAL_MODULE_LAYER_ID,
      mediaType: "image",
      version: "phase2",
      active: true,
      units: visualModuleSeal.traces.flatMap((trace) =>
        trace.frameIdxs.map((frameIdx) => ({
          unitKey: `${trace.visualTraceId}:${frameIdx}`,
          unitMeta: {
            tsSec: frameIdx / fps,
            kind: "videoFrame",
            visualTraceId: trace.visualTraceId,
          },
          regions: [
            {
              regionId: trace.selectedRegionId ?? trace.visualTraceId,
              shape: "patch" as const,
              cx: Math.floor(width / 2),
              cy: Math.floor(height / 2),
              width: Math.max(16, Math.floor(width * 0.3)),
              height: Math.max(16, Math.floor(height * 0.24)),
              frameIdx,
              tsSec: frameIdx / fps,
              carries: "payload4-visual-module-trace",
            },
          ],
        })),
      ),
      reservedZones: [],
      freeZoneHint:
        "Visual module uses frames disjoint from video Channel A/B and DNA pilot frames; VISUAL_VAULT requires exact ID match.",
      meta: {
        module: "image",
        traceCount: visualModuleSeal.traceCount,
        frameCount: visualModuleSeal.frameCount,
        traceIds: visualModuleSeal.traces.map((trace) => trace.visualTraceId),
        canOpenVisualVault: true,
        canOpenClassicVault: false,
        decisionRole: visualModuleSeal.decisionRole,
        sealOverlaps: visualModuleSeal.sealOverlaps,
      },
    });
  }

  if (audioModuleSeal?.hasAudio) {
    addLayer(dna, {
      layerId: AUDIO_V01_LAYER_ID,
      mediaType: "audio",
      version: "audio-v0.1",
      active: audioModuleSeal.active,
      units: audioModuleSeal.traces.map((trace) => ({
        unitKey: trace.traceId,
        unitMeta: {
          tsSec: trace.startSec,
          kind: "audioSegment",
          traceId: trace.traceId,
        },
        regions: [
          {
            regionId: trace.traceId,
            shape: "patch" as const,
            cx: trace.startSec,
            cy: 0,
            width: trace.durationSec,
            height: 1,
            tsSec: trace.startSec,
            carries: "payload4-audio-v01-fsk",
          },
        ],
      })),
      reservedZones: [],
      freeZoneHint:
        "Audio v0.1 traces are time-disjoint from each other and do not overlap video/image seal areas.",
      meta: {
        module: "audio",
        hasAudio: audioModuleSeal.hasAudio,
        audioInfo: audioModuleSeal.audioInfo,
        traceCount: audioModuleSeal.traceCount,
        independentSealCount: audioModuleSeal.independentSealCount,
        sealIndependent: audioModuleSeal.sealIndependent,
        canOpenAudioVault: true,
        noFragmentCombining: true,
        decisionRole: "AUDIO_VAULT requires exact ID match",
        note: audioModuleSeal.note,
      },
    });
  }

  const activePilotTrace = dnaPreAnalysis?.placementPilot?.activePilotTrace;
  if (activePilotTrace?.applied && activePilotTrace.frameIdxs.length > 0) {
    addLayer(dna, {
      layerId: "dna-active-placement-pilot",
      mediaType: "video",
      version: "sprint4d",
      active: true,
      units: activePilotTrace.frameIdxs.map((frameIdx) => ({
        unitKey: frameIdx,
        unitMeta: { tsSec: frameIdx / fps, kind: "videoFrame" },
        regions: [
          {
            regionId: activePilotTrace.selectedRegionId ?? "dna-pilot-region",
            shape: "patch" as const,
            cx: Math.floor(width / 2),
            cy: Math.floor(height / 2),
            width: Math.max(16, Math.floor(width * 0.24)),
            height: Math.max(16, Math.floor(height * 0.22)),
            frameIdx,
            tsSec: frameIdx / fps,
            carries: "payload4-dna-active-trace",
          },
        ],
      })),
      reservedZones: [],
      freeZoneHint:
        "DNA active placement trace. It is separate from classic Channel A/B; finalDecision may classify DNA_VAULT only after 32/32 ID match.",
      meta: {
        carrier: activePilotTrace.carrier,
        decisive: false,
        canOpenVault: false,
        canOpenDnaVault: true,
        decisionRole: activePilotTrace.decisionRole,
        selectedRegionLabel: activePilotTrace.selectedRegionLabel,
        frameCount: activePilotTrace.frameIdxs.length,
      },
    });
  }

  if (t6Enabled) {
    addLayer(dna, {
      layerId: "t6-lowband",
      mediaType: "video",
      version: "v0.6.3",
      active: false, // iskelet — T6 kodu sealMap'e henüz katkı vermiyor
      units: [],
      reservedZones: [],
      freeZoneHint:
        "T6 ON path'inde 3 SAFE_CARRIER (C00 sol-üst sub-block, C01 sağ-üst, " +
        "C11 sağ-alt) × 11 SLOT (getT6FrameMap) ile DC ±2 stamp basar. " +
        "Region/reservedZones gelecek sprint T6 internal export'u ile dolar.",
      meta: {
        skeleton: true,
        nextSprint:
          "T6_SAFE_CARRIERS / SHIFT_PER_PIXEL / SLOT_COUNT export edilecek, buildT6DNALayer eklenecek.",
      },
    });
  }

  return dna;
}

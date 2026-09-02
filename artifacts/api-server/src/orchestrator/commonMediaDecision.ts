import type { ActiveModuleEntry } from "./detectActiveModules.js";
import type { ModuleBoardEntry, VideoImageSupportResult } from "../dna/commonDnaBoard.js";
import {
  buildHeavyOcrCandidateSupport,
  type HeavyOcrCandidateSupport,
} from "../lib/heavyOcrEscalation.js";

type Phase1ModuleKind =
  | "video"
  | "image"
  | "text"
  | "audio"
  | "secure_room"
  | "poison";

type Phase1ModuleStatus =
  | "active"
  | "support_active"
  | "inactive_no_signal"
  | "record_only"
  | "candidate_support";

export interface CommonMediaModulePhase1 {
  module: Phase1ModuleKind;
  status: Phase1ModuleStatus;
  role: "primary" | "support" | "record" | "reserved";
  reason: string;
  seal: {
    attempted: boolean;
    actual: string;
    independentSealCount: number;
    sealIndependent: boolean;
    sealOverlaps: boolean;
    areas: string[];
  };
  search: {
    attempted: boolean;
    idRead: boolean;
    idMatched: boolean;
    candidateOnly: boolean;
    result: string;
    note: string;
  };
  riskToDna: string[];
}

export interface CommonMediaDecisionPhase1 {
  version: "common-media-phase1-v1" | "common-media-phase2-v1";
  mode: "common_decision_phase1" | "common_decision_phase2";
  authority:
    | "dna_advisory_and_module_visibility_no_new_vault_gate"
    | "dna_advisory_module_visibility_and_visual_id_gate";
  phase: "seal" | "search";
  scenario: string;
  activeModulesFromDetector: ActiveModuleEntry[];
  modules: CommonMediaModulePhase1[];
  dnaCommonPlan: {
    attacksConsidered: string[];
    durableRegions: string[];
    riskyRegions: string[];
    noTouchRegions: string[];
    suggestedPlacement: string[];
    reservedZones: string[];
    collisionHandling: string[];
    finalRule: "official_result_requires_decoded_id_match";
  };
  collisionReport: {
    hasCollision: boolean;
    channelAChannelBOverlap: number;
    moduleOverlapCount: number;
    note: string;
  };
  officialDecision: {
    finalDecision: string;
    mainVerdict: string;
    idMatched: boolean;
    channelAIdMatched: boolean;
    channelBIdMatched: boolean;
    dnaIdMatched: boolean;
    visualIdMatched: boolean;
    audioIdMatched: boolean;
    falseVault: boolean;
    idlessOfficialVault: boolean;
  };
  heavyOcrLastResort: HeavyOcrCandidateSupport;
  safeguards: string[];
}

export interface BuildCommonMediaDecisionPhase1Input {
  phase: "seal" | "search";
  scenario?: string | undefined;
  activeModules?: ActiveModuleEntry[] | undefined;
  dnaPreAnalysis?: unknown;
  decisionBoard?: ModuleBoardEntry[] | undefined;
  videoImageSupport?: VideoImageSupportResult | null | undefined;
  finalDecision?: unknown;
  visualModuleTrace?: unknown;
  visualModuleSeal?: unknown;
  audioModuleTrace?: unknown;
  audioModuleSeal?: unknown;
  mainVerdict?: string | undefined;
  channelAIdMatched?: boolean | undefined;
  channelBIdMatched?: boolean | undefined;
  stampedFrameCount?: number | undefined;
  channelBFrameCount?: number | undefined;
  dnaPilotFrameCount?: number | undefined;
  strongFrames?: number | undefined;
  vaultFrames?: number | undefined;
  hasAudioTrack?: boolean | undefined;
  textDetected?: boolean | undefined;
  heavyOcrProblemTargets?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function regionIds(value: unknown): string[] {
  return getArray(value)
    .map((item) => getString(asRecord(item)["regionId"]))
    .filter((item): item is string => item !== null);
}

function officialVault(decision: string): boolean {
  return (
    decision === "VAULT" ||
    decision === "VISUAL_VAULT" ||
    decision === "AUDIO_VAULT" ||
    decision === "DNA_VAULT" ||
    decision === "MULTI_CHANNEL_VAULT"
  );
}

function boardEntry(
  board: ModuleBoardEntry[] | undefined,
  module: "video" | "image" | "text",
): ModuleBoardEntry | undefined {
  return board?.find((entry) => entry.module === module);
}

export function buildCommonMediaDecisionPhase1(
  input: BuildCommonMediaDecisionPhase1Input,
): CommonMediaDecisionPhase1 {
  const dna = asRecord(input.dnaPreAnalysis);
  const regionMap = asRecord(dna["regionMap"]);
  const placement = asRecord(dna["actualPlacement"]);
  const placementPilot = asRecord(dna["placementPilot"]);
  const finalDecision = asRecord(input.finalDecision);
  const visualTrace = asRecord(input.visualModuleTrace);
  const visualSeal = asRecord(input.visualModuleSeal);
  const audioTrace = asRecord(input.audioModuleTrace);
  const audioSeal = asRecord(input.audioModuleSeal);
  const finalDecisionLabel =
    getString(finalDecision["decision"]) ?? input.mainVerdict ?? "NOT_FOUND";
  const mainVerdict =
    getString(finalDecision["mainVerdict"]) ?? input.mainVerdict ?? "NOT_FOUND";
  const idMatched =
    finalDecision["idMatched"] === true || finalDecisionLabel !== "NOT_FOUND";
  const channelAIdMatched =
    input.channelAIdMatched === true || finalDecision["channelAIdMatched"] === true;
  const channelBIdMatched =
    input.channelBIdMatched === true || finalDecision["channelBIdMatched"] === true;
  const dnaIdMatched = finalDecision["dnaIdMatched"] === true;
  const visualIdMatched =
    finalDecision["visualIdMatched"] === true ||
    visualTrace["idMatched"] === true;
  const audioIdMatched =
    finalDecision["audioIdMatched"] === true ||
    audioTrace["idMatched"] === true;
  const idlessOfficialVault = officialVault(finalDecisionLabel) && !idMatched;
  const channelOverlap = getNumber(placement["channelOverlapCount"], 0);
  const videoBoard = boardEntry(input.decisionBoard, "video");
  const imageBoard = boardEntry(input.decisionBoard, "image");
  const textBoard = boardEntry(input.decisionBoard, "text");
  const channelBFrameCount = input.channelBFrameCount ?? 0;
  const dnaPilotFrameCount = input.dnaPilotFrameCount ?? 0;
  const videoIndependentCount =
    channelBFrameCount > 0 ? 2 : (input.stampedFrameCount ?? 0) >= 2 ? 1 : 0;
  const visualTraceAttempted = visualTrace["attempted"] === true;
  const visualTraceCount = Math.max(
    getNumber(visualTrace["traceCount"], 0),
    getNumber(visualSeal["traceCount"], 0),
  );
  const visualMatchingBitsMax = getNumber(visualTrace["matchingBitsMax"], 0);
  const hasAudioTrack = input.hasAudioTrack === true;
  const audioTraceAttempted = audioTrace["attempted"] === true;
  const audioTraceCount = Math.max(
    getNumber(audioTrace["traceCount"], 0),
    getNumber(audioSeal["traceCount"], 0),
  );
  const audioMatchingBitsMax = getNumber(audioTrace["matchingBitsMax"], 0);
  const audioHasSealInfo =
    audioTraceAttempted ||
    audioTraceCount > 0 ||
    audioSeal["hasAudio"] === true ||
    hasAudioTrack;
  const imageSupportActive =
    input.videoImageSupport !== undefined && input.videoImageSupport !== null;
  const textDetected = input.textDetected === true;
  const textIdRead = textBoard?.idRead === true;
  const textIdMatched = textBoard?.idMatched === true;
  const textCandidateSupport =
    !textIdMatched && (textBoard?.candidate === true || textDetected);
  const heavyOcrLastResort = buildHeavyOcrCandidateSupport({
    source: textDetected ? "video_subtitle" : "text_scan",
    textLength: textDetected ? 1 : 0,
    textSignal: textDetected,
    candidateSupport: textCandidateSupport,
    idRead: textIdRead,
    idMatched: textIdMatched,
    finalDecision: finalDecisionLabel,
    problemTargets: input.heavyOcrProblemTargets,
  });
  const candidateRegionIds = regionIds(placementPilot["candidateRegions"]);
  const durable = regionIds(regionMap["durableRegions"]);
  const risky = regionIds(regionMap["riskyRegions"]);
  const noTouch = regionIds(regionMap["noTouchRegions"]);

  const modules: CommonMediaModulePhase1[] = [
    {
      module: "video",
      status: "active",
      role: "primary",
      reason: "Video dosyasi oldugu icin ana video modulu calisti.",
      seal: {
        attempted: input.phase === "seal",
        actual: "existing_channel_a_plus_channel_b",
        independentSealCount: videoIndependentCount,
        sealIndependent: videoIndependentCount >= 2,
        sealOverlaps: channelOverlap > 0,
        areas: [
          "video.channelA.existing_tripleShield",
          ...(channelBFrameCount > 0 ? ["video.channelB.qim_y_grid"] : []),
          ...(dnaPilotFrameCount > 0 ? ["video.dna_active_pilot_trace"] : []),
        ],
      },
      search: {
        attempted: input.phase === "search",
        idRead: videoBoard?.idRead === true || channelAIdMatched || channelBIdMatched,
        idMatched:
          videoBoard?.idMatched === true || channelAIdMatched || channelBIdMatched,
        candidateOnly: (input.strongFrames ?? 0) > 0 && !idMatched,
        result: mainVerdict,
        note: `strongFrames=${input.strongFrames ?? 0}, vaultFrames=${input.vaultFrames ?? 0}`,
      },
      riskToDna: [
        "compression",
        "format_conversion",
        "crop",
        "screen_record",
        "phone_camera",
      ],
    },
    {
      module: "image",
      status: visualTraceCount > 0 || visualTraceAttempted || visualIdMatched
        ? "active"
        : imageSupportActive
          ? "support_active"
          : "inactive_no_signal",
      role: "support",
      reason: visualTraceCount > 0 || visualTraceAttempted || visualIdMatched
        ? "Video kareleri gorsel icerik oldugu icin gorsel modul kendi ayri ID izini basti/aradI. VISUAL_VAULT yalniz ID eslesirse resmi olur."
        : imageSupportActive
        ? "Video kareleri uzerinde gorsel destek calisti; aday destek uretir, kesin karar uretmez."
        : "Bu kayitta gorsel destek kosulmadi veya sinyal bulunmadi.",
      seal: {
        attempted: visualTraceCount > 0,
        actual: visualTraceCount > 0
          ? "visual_module_frame_seal_phase2"
          : "phase1_support_only_no_pixel_stamp",
        independentSealCount: visualTraceCount,
        sealIndependent: visualTraceCount >= 2,
        sealOverlaps: false,
        areas: visualTraceCount > 0
          ? ["image.visual-core-trace", "image.visual-ring-trace"].slice(
              0,
              visualTraceCount,
            )
          : imageSupportActive
            ? ["image.visual_support_from_video_frames"]
            : [],
      },
      search: {
        attempted: visualTraceAttempted || imageSupportActive,
        idRead: visualIdMatched,
        idMatched: visualIdMatched,
        candidateOnly:
          !visualIdMatched &&
          (imageBoard?.candidate === true ||
            imageSupportActive ||
            visualMatchingBitsMax >= 24),
        result: visualIdMatched
          ? "VISUAL_ID_MATCH"
          : imageSupportActive || visualMatchingBitsMax >= 24
            ? "CANDIDATE_SUPPORT_ONLY"
            : "NOT_RUN",
        note: visualTraceAttempted
          ? `visualBits=${visualMatchingBitsMax}/32, traceCount=${visualTraceCount}; VISUAL_VAULT requires exact ID match.`
          : imageSupportActive
          ? `framesChecked=${input.videoImageSupport?.framesChecked ?? 0}, supportScore=${input.videoImageSupport?.supportScore ?? 0}`
          : "No visual support pass.",
      },
      riskToDna: ["image_resave_screenshot", "screen_record", "phone_camera"],
    },
    {
      module: "text",
      status: textDetected ? "support_active" : "inactive_no_signal",
      role: "support",
      reason: textDetected
        ? "Video/gorsel icinde text/subtitle/OCR sinyali bildirildi; bu ilk kopru yalniz TEXT_CANDIDATE_SUPPORT uretir."
        : "Bu kayitta OCR/metin sinyali yok; metin modulu sahte aktif gosterilmez.",
      seal: {
        attempted: false,
        actual: "not_run_without_text_detection",
        independentSealCount: 0,
        sealIndependent: false,
        sealOverlaps: false,
        areas: [],
      },
      search: {
        attempted: input.phase === "search" && (textDetected || textBoard !== undefined),
        idRead: textIdRead,
        idMatched: textIdMatched,
        candidateOnly: textCandidateSupport,
        result: textIdMatched
          ? "TEXT_CONFIRMED"
          : textCandidateSupport
            ? "TEXT_CANDIDATE_SUPPORT"
            : "NOT_RUN",
        note:
          heavyOcrLastResort.triggered
            ? `OCR/text/subtitle sinyali yalniz candidate/support'tur. Heavy OCR son katman ${heavyOcrLastResort.selectedTargets.length} secili hedefle sinirlandi; TEXT_CONFIRMED icin metin modulunun kendi ID'sini okuyup eslestirmesi gerekir.`
            : "OCR/text/subtitle sinyali yalniz candidate/support'tur. TEXT_CONFIRMED icin metin modulunun kendi ID'sini okuyup eslestirmesi gerekir.",
      },
      riskToDna: ["text_edit_copy_format"],
    },
    {
      module: "audio",
      status: audioHasSealInfo ? "active" : "inactive_no_signal",
      role: audioHasSealInfo ? "support" : "reserved",
      reason: audioHasSealInfo
        ? "Ses izi algilandi; audio v0.1 kendi iki bagimsiz ses izini basar/arar. AUDIO_VAULT yalniz tam ID eslesirse resmi olur."
        : "Ses izi yok; ses modulu sessizce devre disi.",
      seal: {
        attempted: input.phase === "seal" && audioTraceCount > 0,
        actual: audioTraceCount > 0
          ? "audio_v01_dual_fsk"
          : audioHasSealInfo
            ? "audio_v01_no_safe_dual_trace"
            : "not_run_without_audio",
        independentSealCount: audioTraceCount,
        sealIndependent: audioTraceCount >= 2,
        sealOverlaps: false,
        areas: audioTraceCount > 0
          ? ["audio.v01.low-fsk", "audio.v01.mid-fsk"].slice(0, audioTraceCount)
          : [],
      },
      search: {
        attempted: audioTraceAttempted,
        idRead: audioIdMatched,
        idMatched: audioIdMatched,
        candidateOnly: !audioIdMatched && audioMatchingBitsMax >= 24,
        result: audioIdMatched
          ? "AUDIO_ID_MATCH"
          : audioTraceAttempted && audioMatchingBitsMax >= 24
            ? "AUDIO_CANDIDATE"
            : audioHasSealInfo
              ? "AUDIO_NOT_FOUND"
              : "NOT_RUN",
        note: audioTraceAttempted
          ? `audioBits=${audioMatchingBitsMax}/32, traceCount=${audioTraceCount}; AUDIO_VAULT requires exact ID match.`
          : audioHasSealInfo
            ? "Audio v0.1 seal exists or audio stream exists, but this phase did not decode it."
            : "No audio stream.",
      },
      riskToDna: ["audio_compress_noise_cut"],
    },
    {
      module: "secure_room",
      status: "record_only",
      role: "record",
      reason:
        "Secure Room module_summary, evidence package ve timestamp kayit odasi olarak baglidir; karar vermez ve VAULT uretmez.",
      seal: {
        attempted: false,
        actual: "record_only_not_a_seal",
        independentSealCount: 0,
        sealIndependent: false,
        sealOverlaps: false,
        areas: [],
      },
      search: {
        attempted: false,
        idRead: false,
        idMatched: false,
        candidateOnly: false,
        result: "SECURE_ROOM_RECORD_ONLY_NOT_VAULT",
        note: "Secure Room mevcut modullerden gelen olaylari kaydeder; confirmed/VAULT uretmez.",
      },
      riskToDna: [],
    },
    {
      module: "poison",
      status: "candidate_support",
      role: "record",
      reason:
        "Zehir guvenli kapsamda record-only/candidate-support koruma kaydi olarak baglidir; confirmed veya VAULT uretmez.",
      seal: {
        attempted: false,
        actual: "zehir_record_only_not_a_seal",
        independentSealCount: 0,
        sealIndependent: false,
        sealOverlaps: false,
        areas: [],
      },
      search: {
        attempted: false,
        idRead: false,
        idMatched: false,
        candidateOnly: true,
        result: "ZEHIR_CANDIDATE_SUPPORT_RECORD_ONLY",
        note: "Zehir yalniz aday destek / sadece kayit dilinde gorunur; ID yoksa VAULT yok kuralini degistirmez.",
      },
      riskToDna: [],
    },
  ];

  return {
    version: "common-media-phase2-v1",
    mode: "common_decision_phase2",
    authority: "dna_advisory_module_visibility_and_visual_id_gate",
    phase: input.phase,
    scenario: input.scenario ?? "unknown",
    activeModulesFromDetector: input.activeModules ?? [],
    modules,
    dnaCommonPlan: {
      attacksConsidered: getArray(dna["attacksConsidered"]).map(String),
      durableRegions: durable,
      riskyRegions: risky,
      noTouchRegions: noTouch,
      suggestedPlacement: [
        ...durable.map((id) => `prefer:${id}`),
        ...candidateRegionIds.map((id) => `candidate:${id}`),
      ],
      reservedZones: [
        "video.channelA.existing_tripleShield",
        ...(channelBFrameCount > 0 ? ["video.channelB.qim_y_grid"] : []),
        ...(visualTraceCount > 0 ? ["image.visual_module_frame_seal_phase2"] : []),
        ...(noTouch.length > 0 ? noTouch.map((id) => `avoid:${id}`) : []),
      ],
      collisionHandling: [
        channelOverlap > 0
          ? "channel_a_b_overlap_detected_report_only"
          : "channel_a_b_overlap_zero",
        visualTraceCount > 0
          ? "image_visual_traces_are_frame_disjoint_from_video_channels"
          : "image_support_is_read_only_so_no_pixel_collision",
        "text_not_run_without_detection_so_no_collision",
      ],
      finalRule: "official_result_requires_decoded_id_match",
    },
    collisionReport: {
      hasCollision: channelOverlap > 0,
      channelAChannelBOverlap: channelOverlap,
      moduleOverlapCount: channelOverlap > 0 ? 1 : 0,
      note:
        channelOverlap > 0
          ? "DNA A/B cakismasi raporladi; karar mantigi degismedi."
          : "Kanal A/B cakismasi yok. Gorsel destek Faz 1'de okuma/adayi destek oldugu icin piksel cakismasi uretmez.",
    },
    officialDecision: {
      finalDecision: finalDecisionLabel,
      mainVerdict,
      idMatched,
      channelAIdMatched,
      channelBIdMatched,
      dnaIdMatched,
      visualIdMatched,
      audioIdMatched,
      falseVault: false,
      idlessOfficialVault,
    },
    heavyOcrLastResort,
    safeguards: [
      "channel_a_unchanged",
      "channel_b_unchanged",
      "no_channel_c",
      "no_threshold_change",
      "official_result_requires_id_match",
      visualTraceCount > 0
        ? "visual_vault_requires_exact_id_match"
        : "image_support_candidate_only",
      "text_not_faked_without_detection",
      textDetected
        ? "text_signal_candidate_support_only"
        : "text_not_run_without_text_signal",
      heavyOcrLastResort.triggered
        ? "heavy_ocr_last_resort_candidate_only"
        : "heavy_ocr_not_run_without_unresolved_text_target",
      audioHasSealInfo
        ? "audio_v01_requires_exact_id_match"
        : "audio_not_run_without_audio",
    ],
  };
}

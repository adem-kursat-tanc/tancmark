export type DnaShadowModuleKind =
  | "video"
  | "image"
  | "text"
  | "audio"
  | "secure_room"
  | "poison";

export type DnaShadowModuleStatus =
  | "active"
  | "inactive"
  | "record_only"
  | "candidate_support";

export type DnaPredictionStrength =
  | "pass_likely"
  | "support_likely"
  | "high_risk"
  | "unknown";

export interface DnaShadowRegion {
  regionId: string;
  label: string;
  risk: "low" | "medium" | "high" | "unknown";
  reason: string;
  rect?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    unit: "relative";
  };
}

export interface DnaShadowModulePlan {
  module: DnaShadowModuleKind;
  status: DnaShadowModuleStatus;
  active: boolean;
  suggestedSealAreas: DnaShadowRegion[];
  riskyAreas: DnaShadowRegion[];
  collisionRisk: boolean;
  suggestedTasks: string[];
  actualSeal: string;
  testResult: null;
  learningNote: null;
  reason: string;
}

export interface DnaShadowChannelPlan {
  channel: "A" | "B" | "C";
  status: "active_existing" | "future_reserved";
  task: string;
  expectedStrengths: string[];
  knownWeaknesses: string[];
  suggestedAction: string;
  changesPlacement: false;
}

export interface DnaPlacementPilotReport {
  enabled: boolean;
  defaultOff: true;
  flagName: "dnaPlacementPilot";
  activeFlagName?: "dnaActivePlacementPilot";
  mode:
    | "disabled_shadow_only"
    | "candidate_plan_only_no_stamp_change"
    | "active_trace_candidate_only";
  authority:
    | "none"
    | "small_candidate_authority_never_decisive"
    | "active_pilot_trace_never_decisive";
  stampPlacementChanged: false;
  canAffectVerdict: false;
  createsNewChannel: false;
  changesChannelA: false;
  changesChannelB: false;
  candidateRegions: DnaShadowRegion[];
  candidateFrameSample: number[];
  differsFromCurrentPlacement: boolean;
  reason: string;
  safetyGuards: string[];
  activePilotTrace?: {
    applied: boolean;
    selectedRegionId: string | null;
    selectedRegionLabel: string | null;
    frameIdxs: number[];
    carrier: "dna-pilot-center-differential";
    decisionRole: "candidate_only";
    canOpenVault: false;
  };
}

export interface DnaPreAnalysisReport {
  version: "s4b-a2-shadow-v1";
  mode:
    | "shadow_only_no_stamp_change"
    | "controlled_candidate_authority_no_stamp_change";
  authority:
    | "advisory_only_never_decisive"
    | "candidate_placement_plan_only_never_decisive";
  stampPlacementChanged: false;
  createdAt: string;
  attacksConsidered: string[];
  geometry: {
    width: number;
    height: number;
    fps: number;
    totalFrames: number;
    durationSec?: number;
  };
  actualPlacement: {
    channelAFrameCount: number;
    channelBFrameCount: number;
    channelOverlapCount: number;
    channelAFrameSample: number[];
    channelBFrameSample: number[];
  };
  riskScores: Record<string, number>;
  regionMap: {
    durableRegions: DnaShadowRegion[];
    riskyRegions: DnaShadowRegion[];
    noTouchRegions: DnaShadowRegion[];
    unknownRegions: DnaShadowRegion[];
  };
  placementPilot: DnaPlacementPilotReport;
  channelPlan: DnaShadowChannelPlan[];
  modules: DnaShadowModulePlan[];
  predictions: Record<
    string,
    {
      strength: DnaPredictionStrength;
      expectedChannels: string[];
      reason: string;
    }
  >;
  learningHooks: {
    compareWithScenarios: string[];
    watchFor: string[];
  };
  notes: string[];
}

export interface DnaPreAnalysisComparison {
  scenario: string;
  prediction: DnaPredictionStrength;
  actualVerdict: string;
  channelAIdMatched: boolean;
  channelBIdMatched: boolean;
  strongFrames: number;
  vaultFrames: number;
  matchesPrediction: boolean;
  lesson: string;
  weakChannel: "A" | "B" | "A+B" | "none" | "unknown";
  rescuedBy: "A" | "B" | "A+B" | "none";
  suggestedNextStep: string;
  placementPilot?: {
    enabled: boolean;
    candidateRegions: string[];
    candidateFrameCount: number;
    differsFromCurrentPlacement: boolean;
    appliedToSeal: false;
    measuredEffect:
      | "not_applied_no_direct_effect"
      | "not_enabled";
    learningNote: string;
  };
}

const ATTACKS_CONSIDERED = [
  "compression",
  "format_conversion",
  "crop",
  "resize",
  "rotation",
  "screen_record",
  "phone_camera",
  "perspective",
  "color_brightness",
  "blur",
  "frame_drop",
  "text_edit_copy_format",
  "image_resave_screenshot",
  "audio_compress_noise_cut",
];

function overlapCount(a: ReadonlyArray<number>, b: ReadonlyArray<number>) {
  const bSet = new Set(b);
  return a.filter((idx) => bSet.has(idx)).length;
}

function sampleFrames(frames: ReadonlyArray<number>) {
  return frames.slice(0, 12);
}

export function buildVideoDnaPreAnalysis(input: {
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec?: number;
  channelAFrameIdxs: ReadonlyArray<number>;
    channelBFrameIdxs: ReadonlyArray<number>;
  placementPilotEnabled?: boolean;
  activePlacementPilotEnabled?: boolean;
}): DnaPreAnalysisReport {
  const channelOverlap = overlapCount(
    input.channelAFrameIdxs,
    input.channelBFrameIdxs,
  );
  const edgeBand: DnaShadowRegion = {
    regionId: "video.edge-band-10pct",
    label: "outer edge band",
    risk: "high",
    reason:
      "Crop, resize and phone-camera perspective can remove or move edge-near evidence first.",
    rect: { x0: 0, y0: 0, x1: 1, y1: 1, unit: "relative" },
  };
  const centerCore: DnaShadowRegion = {
    regionId: "video.center-core-70pct",
    label: "center core",
    risk: "medium",
    reason:
      "Mild crop usually preserves the center, but too much concentration in one spatial logic can still fail under geometry shifts.",
    rect: { x0: 0.15, y0: 0.15, x1: 0.85, y1: 0.85, unit: "relative" },
  };
  const channelBGrid: DnaShadowRegion = {
    regionId: "video.channel-b-grid-band",
    label: "current Channel B grid band",
    risk: "medium",
    reason:
      "Channel B is useful for compression and format changes, but crop and perspective can shift the grid enough to lose ID bits.",
    rect: { x0: 0.36, y0: 0.53, x1: 0.64, y1: 0.71, unit: "relative" },
  };
  const unknownTextFace: DnaShadowRegion = {
    regionId: "video.privacy-and-text-unknown",
    label: "text/face/private areas not inspected",
    risk: "unknown",
    reason:
      "This sprint does not run OCR or face detection and does not inspect user video content visually.",
  };
  const candidateGeometryCore: DnaShadowRegion = {
    regionId: "video.pilot-geometry-safe-core",
    label: "pilot geometry-safe inner core",
    risk: "low",
    reason:
      "Candidate-only area inside the crop-surviving center. In active pilot mode it may carry a non-decisive pilot trace.",
    rect: { x0: 0.22, y0: 0.22, x1: 0.78, y1: 0.78, unit: "relative" },
  };
  const candidateCenterRing: DnaShadowRegion = {
    regionId: "video.pilot-center-ring-multi-zone",
    label: "pilot center ring multi-zone",
    risk: "medium",
    reason:
      "Candidate-only multi-zone idea to avoid relying on one spatial grid under crop/perspective.",
    rect: { x0: 0.18, y0: 0.18, x1: 0.82, y1: 0.82, unit: "relative" },
  };
  const activePlacementPilotEnabled = input.activePlacementPilotEnabled === true;
  const placementPilotEnabled =
    input.placementPilotEnabled === true || activePlacementPilotEnabled;
  const usedFrames = new Set([
    ...input.channelAFrameIdxs,
    ...input.channelBFrameIdxs,
  ]);
  const candidateFrameSample = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8]
    .map((p) =>
      Math.min(
        Math.max(0, Math.round(input.totalFrames * p)),
        Math.max(0, input.totalFrames - 1),
      ),
    )
    .filter((idx, pos, arr) => arr.indexOf(idx) === pos)
    .filter((idx) => !usedFrames.has(idx));
  const placementPilot: DnaPlacementPilotReport = {
    enabled: placementPilotEnabled,
    defaultOff: true,
    flagName: "dnaPlacementPilot",
    activeFlagName: "dnaActivePlacementPilot",
    mode: placementPilotEnabled
      ? activePlacementPilotEnabled
        ? "active_trace_candidate_only"
        : "candidate_plan_only_no_stamp_change"
      : "disabled_shadow_only",
    authority: placementPilotEnabled
      ? activePlacementPilotEnabled
        ? "active_pilot_trace_never_decisive"
        : "small_candidate_authority_never_decisive"
      : "none",
    stampPlacementChanged: false,
    canAffectVerdict: false,
    createsNewChannel: false,
    changesChannelA: false,
    changesChannelB: false,
    candidateRegions: placementPilotEnabled
      ? [candidateGeometryCore, candidateCenterRing]
      : [],
    candidateFrameSample: placementPilotEnabled ? candidateFrameSample : [],
    differsFromCurrentPlacement:
      placementPilotEnabled &&
      (candidateFrameSample.length > 0 || channelOverlap === 0),
    reason: placementPilotEnabled
      ? activePlacementPilotEnabled
        ? "DNA selects an active pilot trace region; Channel A/B and classic VAULT remain unchanged."
        : "DNA suggests geometry-safer candidate regions, but the real Channel A/B placement remains unchanged."
      : "Pilot authority is default OFF; DNA remains shadow-only.",
    safetyGuards: [
      "default_off",
      activePlacementPilotEnabled
        ? "requires_dnaActivePlacementPilot_flag"
        : "requires_dnaPlacementPilot_flag",
      "no_channel_c",
      "no_threshold_change",
      activePlacementPilotEnabled ? "separate_dna_vault_gate_only" : "no_vault_gate",
      "no_stamp_placement_change",
      "id_match_still_required",
    ],
    activePilotTrace: {
      applied: false,
      selectedRegionId: null,
      selectedRegionLabel: null,
      frameIdxs: [],
      carrier: "dna-pilot-center-differential",
      decisionRole: "candidate_only",
      canOpenVault: false,
    },
  };

  return {
    version: "s4b-a2-shadow-v1",
    mode: placementPilotEnabled
      ? "controlled_candidate_authority_no_stamp_change"
      : "shadow_only_no_stamp_change",
    authority: placementPilotEnabled
      ? "candidate_placement_plan_only_never_decisive"
      : "advisory_only_never_decisive",
    stampPlacementChanged: false,
    createdAt: new Date().toISOString(),
    attacksConsidered: ATTACKS_CONSIDERED,
    geometry: {
      width: input.width,
      height: input.height,
      fps: input.fps,
      totalFrames: input.totalFrames,
      durationSec: input.durationSec,
    },
    actualPlacement: {
      channelAFrameCount: input.channelAFrameIdxs.length,
      channelBFrameCount: input.channelBFrameIdxs.length,
      channelOverlapCount: channelOverlap,
      channelAFrameSample: sampleFrames(input.channelAFrameIdxs),
      channelBFrameSample: sampleFrames(input.channelBFrameIdxs),
    },
    riskScores: {
      compression: 0.35,
      format_conversion: 0.35,
      crop: 0.85,
      resize: 0.65,
      rotation: 0.75,
      screen_record: 0.78,
      phone_camera: 0.86,
      perspective: 0.84,
      color_brightness: 0.5,
      blur: 0.58,
      frame_drop: 0.48,
      overall: 0.72,
    },
    regionMap: {
      durableRegions: [centerCore],
      riskyRegions: [edgeBand, channelBGrid],
      noTouchRegions: [unknownTextFace],
      unknownRegions: [
        {
          regionId: "video.texture-motion-map-not-measured",
          label: "texture and motion map",
          risk: "unknown",
          reason:
            "Shadow mode records the need for texture/motion analysis but does not alter placement in this sprint.",
        },
      ],
    },
    placementPilot,
    channelPlan: [
      {
        channel: "A",
        status: "active_existing",
        task: "fast main ID carrier and anchor signal",
        expectedStrengths: ["baseline", "clean decode"],
        knownWeaknesses: ["crop", "rotation", "perspective", "phone_camera"],
        suggestedAction: "keep unchanged in this sprint",
        changesPlacement: false,
      },
      {
        channel: "B",
        status: "active_existing",
        task: "second independent ID carrier for compression and format conversion",
        expectedStrengths: ["recompress", "format_conversion"],
        knownWeaknesses: ["crop", "perspective", "phone_camera"],
        suggestedAction: "keep unchanged in this sprint",
        changesPlacement: false,
      },
      {
        channel: "C",
        status: "future_reserved",
        task: "future geometry-class carrier if approved",
        expectedStrengths: ["crop", "rotation", "perspective", "screen_record"],
        knownWeaknesses: ["not_enabled_current_scope"],
        suggestedAction: "do not implement in Sprint 4B/A2",
        changesPlacement: false,
      },
    ],
    modules: [
      {
        module: "video",
        status: "active",
        active: true,
        suggestedSealAreas: [centerCore],
        riskyAreas: [edgeBand, channelBGrid],
        collisionRisk: channelOverlap > 0,
        suggestedTasks: ["channel_a_main", "channel_b_compression_format"],
        actualSeal: "unchanged_existing_channel_a_b",
        testResult: null,
        learningNote: null,
        reason: "Current file is handled by the video module.",
      },
      {
        module: "image",
        status: "active",
        active: true,
        suggestedSealAreas: [centerCore],
        riskyAreas: [edgeBand],
        collisionRisk: false,
        suggestedTasks: ["video_frame_visual_support_candidate_only"],
        actualSeal: "support_only_no_pixel_stamp_phase1",
        testResult: null,
        learningNote: null,
        reason:
          "Video frames are image material, so visual support participates in the common plan. In Phase 1 it is candidate-only and does not add a pixel stamp, to avoid breaking Channel A/B.",
      },
      {
        module: "text",
        status: "inactive",
        active: false,
        suggestedSealAreas: [],
        riskyAreas: [],
        collisionRisk: false,
        suggestedTasks: [],
        actualSeal: "not_run",
        testResult: null,
        learningNote: null,
        reason: "Text module is not active for this video-only pilot.",
      },
      {
        module: "audio",
        status: "inactive",
        active: false,
        suggestedSealAreas: [],
        riskyAreas: [],
        collisionRisk: false,
        suggestedTasks: ["audio_v01_resolved_after_media_probe"],
        actualSeal: "audio_v01_runtime_probe_pending",
        testResult: null,
        learningNote: null,
        reason:
          "Audio v0.1 is resolved by encodeVideo after probing the media stream; it becomes active only when audio exists.",
      },
      {
        module: "secure_room",
        status: "record_only",
        active: false,
        suggestedSealAreas: [],
        riskyAreas: [],
        collisionRisk: false,
        suggestedTasks: [
          "secure_room_module_summary_record_only",
          "secure_room_evidence_package_record_only",
        ],
        actualSeal: "record_only_not_a_seal",
        testResult: null,
        learningNote: null,
        reason:
          "Secure Room is implemented as a record-only event, module_summary, evidence and timestamp room. It never confirms and never opens VAULT.",
      },
      {
        module: "poison",
        status: "candidate_support",
        active: false,
        suggestedSealAreas: [],
        riskyAreas: [],
        collisionRisk: false,
        suggestedTasks: [
          "zehir_candidate_support_record_only",
          "zehir_manual_protection_records",
        ],
        actualSeal: "zehir_record_only_not_a_seal",
        testResult: null,
        learningNote: null,
        reason:
          "Zehir is implemented as record-only candidate/support protection reporting. It never confirms, never opens VAULT and never changes the media ID rule.",
      },
    ],
    predictions: {
      baseline: {
        strength: "pass_likely",
        expectedChannels: ["A", "B"],
        reason: "No attack is expected to preserve both current channels.",
      },
      recompress: {
        strength: "support_likely",
        expectedChannels: ["B"],
        reason: "Sprint 2 showed Channel B is the safer path under recompression.",
      },
      mp4_mov_mp4: {
        strength: "support_likely",
        expectedChannels: ["B"],
        reason: "Sprint 2 showed Channel B helps format conversion.",
      },
      crop20: {
        strength: "high_risk",
        expectedChannels: [],
        reason:
          "Geometry shift can leave anchor/strong signal visible while breaking ID byte alignment.",
      },
    },
    learningHooks: {
      compareWithScenarios: ["baseline", "recompress", "mp4_mov_mp4", "crop20"],
      watchFor: [
        "signal_present_id_missing",
        "channel_a_weak",
        "channel_b_rescue",
        "both_channels_broken_by_geometry",
        "false_vault_must_remain_zero",
      ],
    },
    notes: [
      "Shadow analysis is advisory only.",
      "It never changes seal placement in Sprint 4B/A2.",
      "It never creates a VAULT decision.",
      "Final VAULT still requires decoded ID match.",
    ],
  };
}

export function compareDnaPreAnalysisWithVideoResult(
  report: DnaPreAnalysisReport | unknown,
  input: {
    scenario: string;
    verdict?: string;
    channelAIdMatched?: boolean;
    channelBIdMatched?: boolean;
    strongFrames?: number;
    vaultFrames?: number;
  },
): DnaPreAnalysisComparison | undefined {
  if (!report || typeof report !== "object") return undefined;
  const predictions = (report as DnaPreAnalysisReport).predictions;
  if (!predictions || typeof predictions !== "object") return undefined;

  const scenario = input.scenario || "unknown";
  const predictionEntry =
    predictions[scenario] ??
    (scenario.includes("crop") ? predictions.crop20 : undefined) ??
    (scenario.includes("recompress") ? predictions.recompress : undefined) ??
    (scenario.includes("format") ? predictions.mp4_mov_mp4 : undefined);
  const prediction = predictionEntry?.strength ?? "unknown";
  const placementPilot = (report as DnaPreAnalysisReport).placementPilot;
  const verdict = input.verdict ?? "UNKNOWN";
  const channelA = input.channelAIdMatched === true;
  const channelB = input.channelBIdMatched === true;
  const strongFrames = Number(input.strongFrames ?? 0);
  const vaultFrames = Number(input.vaultFrames ?? 0);
  const isVault = verdict === "VAULT";
  const geometryRisk = scenario.includes("crop") || scenario.includes("phone") || scenario.includes("screen");
  const signalPresentIdMissing = strongFrames >= 10 && !isVault && vaultFrames === 0;

  const matchesPrediction =
    (prediction === "pass_likely" && isVault) ||
    (prediction === "support_likely" && isVault && channelB) ||
    (prediction === "high_risk" && !isVault && (geometryRisk || signalPresentIdMissing));

  const weakChannel: DnaPreAnalysisComparison["weakChannel"] = channelA && channelB
    ? "none"
    : channelA
      ? "B"
      : channelB
        ? "A"
        : geometryRisk || signalPresentIdMissing
          ? "A+B"
          : "unknown";
  const rescuedBy: DnaPreAnalysisComparison["rescuedBy"] = channelA && channelB
    ? "A+B"
    : channelA
      ? "A"
      : channelB
        ? "B"
        : "none";

  const lesson = signalPresentIdMissing
    ? "Signal was visible, but ID byte alignment did not survive."
    : isVault && channelB && !channelA
      ? "Channel B rescued the result while Channel A was weak."
      : isVault && channelA && channelB
        ? "Both channels confirmed the same ID."
        : isVault
          ? "A single channel confirmed the ID."
          : "No channel produced a matched ID.";

  const suggestedNextStep = geometryRisk
    ? "Keep A/B unchanged; next approved step should study a geometry-class strategy in shadow/pilot mode."
    : prediction === "support_likely"
      ? "Keep Channel B protection and continue small controlled checks only."
      : "Keep current path and compare the next mini test with the shadow prediction.";

  return {
    scenario,
    prediction,
    actualVerdict: verdict,
    channelAIdMatched: channelA,
    channelBIdMatched: channelB,
    strongFrames,
    vaultFrames,
    matchesPrediction,
    lesson,
    weakChannel,
    rescuedBy,
    suggestedNextStep,
    placementPilot: placementPilot
      ? {
          enabled: placementPilot.enabled,
          candidateRegions: placementPilot.candidateRegions.map(
            (r) => r.regionId,
          ),
          candidateFrameCount: placementPilot.candidateFrameSample.length,
          differsFromCurrentPlacement:
            placementPilot.differsFromCurrentPlacement,
          appliedToSeal: false,
          measuredEffect: placementPilot.enabled
            ? "not_applied_no_direct_effect"
            : "not_enabled",
          learningNote: placementPilot.enabled
            ? "Candidate placement was recorded for learning only; it did not change Channel A/B or the verdict."
            : "Placement pilot was disabled, so only shadow prediction was compared.",
        }
      : undefined,
  };
}

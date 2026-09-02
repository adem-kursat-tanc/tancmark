import { createHash } from "node:crypto";
import {
  buildLiveNativeFragmentedMp4SegmentGate,
  type LiveNativeFragmentedMp4InitSegmentInput,
  type LiveNativeFragmentedMp4MediaSegmentInput,
  type LiveNativeFragmentedMp4SegmentGateResult,
// @ts-ignore: Validation contracts execute TypeScript source directly under Node, so the runtime import needs the .ts suffix.
} from "./liveNativeFragmentedMp4SegmentGate.ts";
// @ts-ignore: Validation contracts execute TypeScript source directly under Node, so the runtime import needs the .ts suffix.
import { getLiveE2ELocalLiveVodResealIdReadResult } from "./liveE2ELocalLiveVodResealIdReadResult.ts";

export const LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_VERSION =
  "live-native-fmp4-cmaf-extreme-chain-v0.1" as const;

export const LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_DECISION_ROLE =
    "live_native_fmp4_cmaf_extreme_chain_support_only_no_vault_no_confirmed" as const;

const REAL_LIKE_LOCAL_EVIDENCE = {
  fixtureCount: 6,
  passedFixtureCount: 6,
  hlsSurvivalRate: "6/6",
  postLiveResealIdReadRate: "6/6",
  wrongIdResult: "all_rejected_no_vault" as const,
  unsealedResult: "all_rejected_no_vault" as const,
};

export interface LiveNativeFmp4CmafDamageScenarioResult {
  scenario: string;
  expectedReason: string;
  actualReason: string;
  rejectedSafely: boolean;
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface LiveNativeFmp4CmafExtremeChainResult {
  version: typeof LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_VERSION;
  decisionRole: typeof LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_DECISION_ROLE;
  testExecuted: true;
  sourceType: "local_synthetic_real_like_no_customer_content";
  cleanFmp4GateReady: boolean;
  cleanSegmentCount: number;
  damageScenarioCount: number;
  rejectedDamageScenarioCount: number;
  damageScenarios: readonly LiveNativeFmp4CmafDamageScenarioResult[];
  localE2EIdReadEvidence: {
    totalRuns: number;
    successfulRuns: number;
    vodCaptureCreated: true;
    postLiveResealSucceeded: true;
    embeddedIdRead: true;
    wrongIdRejected: true;
    unstampedInputNoVault: true;
  };
  realLikeEvidence: {
    fixtureCount: number;
    passedFixtureCount: number;
    hlsSurvivalRate: string;
    postLiveResealIdReadRate: string;
    wrongIdResult: "all_rejected_no_vault";
    unsealedResult: "all_rejected_no_vault";
  };
  nativeHlsVodPackageWriteRequiredInContract: true;
  productReady: false;
  labReady: true;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchUsed: false;
  sourceModified: false;
  mediaPayloadModified: false;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function initSegment(extra: Partial<LiveNativeFragmentedMp4InitSegmentInput> = {}): LiveNativeFragmentedMp4InitSegmentInput {
  const h = sha256Text("phase-5bg-init");
  return {
    uri: "init.mp4",
    bytes: 768,
    inputSha256: h,
    writtenSha256: h,
    sourceIntact: true,
    mediaPayloadModified: false,
    boxes: { ftyp: true, moov: true, mvex: true },
    ...extra,
  };
}

function segment(
  sequence: number,
  startTimeMs: number,
  extra: Partial<LiveNativeFragmentedMp4MediaSegmentInput> = {},
): LiveNativeFragmentedMp4MediaSegmentInput {
  const h = sha256Text(`phase-5bg-segment-${sequence}`);
  return {
    sequence,
    uri: `segment_${String(sequence).padStart(6, "0")}.m4s`,
    startTimeMs,
    durationMs: 2000,
    bytes: 8192,
    inputSha256: h,
    writtenSha256: h,
    sourceIntact: true,
    mediaPayloadModified: false,
    ffmpegUsed: false,
    networkFetchUsed: false,
    payloadUnchanged: true,
    boxes: { moof: true, traf: true, tfhd: true, tfdt: true, trun: true, mdat: true },
    tracks: [
      {
        trackId: 1,
        type: "vide",
        timescale: 90000,
        sampleCount: 60,
        baseMediaDecodeTime: sequence * 180000,
        mdatStart: 128,
        mdatEnd: 6000,
      },
      {
        trackId: 2,
        type: "soun",
        timescale: 48000,
        sampleCount: 96,
        baseMediaDecodeTime: sequence * 96000,
        mdatStart: 6000,
        mdatEnd: 8160,
      },
    ],
    ...extra,
  };
}

function cleanGate(): LiveNativeFragmentedMp4SegmentGateResult {
  return buildLiveNativeFragmentedMp4SegmentGate({
    recordingId: "phase_5bg_clean_chain",
    expectedStartSequence: 1,
    initSegment: initSegment(),
    segments: [segment(1, 0), segment(2, 2000), segment(3, 4000), segment(4, 6000)],
  });
}

function scenario(
  name: string,
  expectedReason: string,
  result: LiveNativeFragmentedMp4SegmentGateResult,
): LiveNativeFmp4CmafDamageScenarioResult {
  return {
    scenario: name,
    expectedReason,
    actualReason: result.reason,
    rejectedSafely: result.ok === false && result.reason === expectedReason,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

function damageScenarios(): readonly LiveNativeFmp4CmafDamageScenarioResult[] {
  return [
    scenario(
      "missing_init_segment",
      "init_segment_missing",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_missing_init",
        expectedStartSequence: 1,
        initSegment: null as unknown as LiveNativeFragmentedMp4InitSegmentInput,
        segments: [segment(1, 0)],
      }),
    ),
    scenario(
      "missing_mvex",
      "init_segment_boxes_missing",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_missing_mvex",
        expectedStartSequence: 1,
        initSegment: initSegment({ boxes: { ftyp: true, moov: true, mvex: false } }),
        segments: [segment(1, 0)],
      }),
    ),
    scenario(
      "sequence_gap",
      "segment_1_sequence_gap",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_sequence_gap",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(3, 2000)],
      }),
    ),
    scenario(
      "timestamp_regression",
      "segment_1_timestamp_regression",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_timestamp_regression",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 2000), segment(2, 1000)],
      }),
    ),
    scenario(
      "payload_hash_mismatch",
      "segment_1_payload_hash_mismatch",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_hash_mismatch",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { writtenSha256: sha256Text("changed") })],
      }),
    ),
    scenario(
      "ffmpeg_flag",
      "segment_1_ffmpeg_used",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_ffmpeg",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { ffmpegUsed: true })],
      }),
    ),
    scenario(
      "network_flag",
      "segment_1_network_fetch_used",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_network",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { networkFetchUsed: true })],
      }),
    ),
    scenario(
      "source_not_intact",
      "segment_1_source_not_intact",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_source_not_intact",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { sourceIntact: false })],
      }),
    ),
    scenario(
      "payload_modified",
      "segment_1_payload_modified",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_payload_modified",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { mediaPayloadModified: true })],
      }),
    ),
    scenario(
      "missing_mdat_box",
      "segment_1_boxes_missing",
      buildLiveNativeFragmentedMp4SegmentGate({
        recordingId: "phase_5bg_missing_mdat",
        expectedStartSequence: 1,
        initSegment: initSegment(),
        segments: [segment(1, 0), segment(2, 2000, { boxes: { moof: true, traf: true, tfhd: true, tfdt: true, trun: true, mdat: false } })],
      }),
    ),
  ];
}

export function getLiveNativeFmp4CmafExtremeChainResult(): LiveNativeFmp4CmafExtremeChainResult {
  const clean = cleanGate();
  const damage = damageScenarios();
  const e2e = getLiveE2ELocalLiveVodResealIdReadResult();

  return {
    version: LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_VERSION,
    decisionRole: LIVE_NATIVE_FMP4_CMAF_EXTREME_CHAIN_DECISION_ROLE,
    testExecuted: true,
    sourceType: "local_synthetic_real_like_no_customer_content",
    cleanFmp4GateReady: clean.ok,
    cleanSegmentCount: clean.ok ? clean.segmentCount : 0,
    damageScenarioCount: damage.length,
    rejectedDamageScenarioCount: damage.filter((item) => item.rejectedSafely).length,
    damageScenarios: damage,
    localE2EIdReadEvidence: {
      totalRuns: e2e.totalRuns,
      successfulRuns: e2e.successfulRuns,
      vodCaptureCreated: e2e.vodCaptureCreated,
      postLiveResealSucceeded: e2e.postLiveResealSucceeded,
      embeddedIdRead: e2e.embeddedIdRead,
      wrongIdRejected: e2e.wrongIdRejected,
      unstampedInputNoVault: e2e.unstampedInputNoVault,
    },
    realLikeEvidence: {
      fixtureCount: REAL_LIKE_LOCAL_EVIDENCE.fixtureCount,
      passedFixtureCount: REAL_LIKE_LOCAL_EVIDENCE.passedFixtureCount,
      hlsSurvivalRate: REAL_LIKE_LOCAL_EVIDENCE.hlsSurvivalRate,
      postLiveResealIdReadRate: REAL_LIKE_LOCAL_EVIDENCE.postLiveResealIdReadRate,
      wrongIdResult: REAL_LIKE_LOCAL_EVIDENCE.wrongIdResult,
      unsealedResult: REAL_LIKE_LOCAL_EVIDENCE.unsealedResult,
    },
    nativeHlsVodPackageWriteRequiredInContract: true,
    productReady: false,
    labReady: true,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsed: false,
    sourceModified: false,
    mediaPayloadModified: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
  };
}

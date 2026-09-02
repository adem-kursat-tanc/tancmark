export const LIVE_NATIVE_VIDEO_FACTORY_POLICY_VERSION =
  "live-native-video-factory-policy-v0.1" as const;

export const LIVE_NATIVE_VIDEO_FACTORY_DECISION_ROLE =
  "live_native_video_factory_policy_support_only_no_vault_no_confirmed" as const;

export type LiveNativeVideoFactoryTaskStatus =
  | "native_product_default"
  | "native_build_target"
  | "legacy_ffmpeg_blocked";

export interface LiveNativeVideoFactoryTask {
  task:
    | "live_ingest"
    | "hls_segmenting"
    | "vod_recording"
    | "thumbnail_generation"
    | "clip_generation"
    | "audio_track_handling"
    | "timed_text_track_handling"
    | "large_video_offset_handling"
    | "large_video_writer_gate"
    | "track_interleave_planning"
    | "interleave_writer_gate"
    | "video_seal_embed"
    | "video_seal_read"
    | "mp4_mov_metadata_stamp"
    | "live_frame_evidence";
  productOwner: "tancmark_native_video_factory";
  status: LiveNativeVideoFactoryTaskStatus;
  oldFfmpegProductDefault: false;
  dirtyFfmpegFallbackAllowed: false;
  contentMeaningCanChange: false;
  needsFurtherImplementation: boolean;
  note: string;
}

export interface LiveNativeVideoFactoryPolicy {
  version: typeof LIVE_NATIVE_VIDEO_FACTORY_POLICY_VERSION;
  decisionRole: typeof LIVE_NATIVE_VIDEO_FACTORY_DECISION_ROLE;
  productDefaultVideoEngine: "tancmark_native_video_factory";
  oldFfmpegProductDefault: false;
  dirtyFfmpegAllowedInProduct: false;
  gplFfmpegAllowedInProduct: false;
  nonfreeFfmpegAllowedInProduct: false;
  cleanExternalFfmpegMayOnlyBeTemporaryHelper: true;
  ffmpegSourceCodeCopiedIntoTancMark: false;
  ffmpegCodeMixedWithTancMarkCode: false;
  githubCodeCopyAllowed: false;
  implementationMethod: "write_own_engine_from_formats_and_clean_specs";
  licenseRule: "own_code_or_free_commercial_open_source_only";
  noPaidClosedLicense: true;
  noContainersRequiredForProductDefault: true;
  liveProductTarget: true;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  visibleLogoFeatureSeparate: true;
  exactIdRequired: true;
  wrongIdCanOpenVault: false;
  missingIdCanOpenVault: false;
  candidateSupportCanDecide: false;
  dnaCanDecideAlone: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  vaultDecisionChanged: false;
  thresholdChanged: false;
  ownershipPreSealChanged: false;
  tasks: readonly LiveNativeVideoFactoryTask[];
  rules: readonly string[];
}

function task(
  taskName: LiveNativeVideoFactoryTask["task"],
  status: LiveNativeVideoFactoryTaskStatus,
  needsFurtherImplementation: boolean,
  note: string,
): LiveNativeVideoFactoryTask {
  return {
    task: taskName,
    productOwner: "tancmark_native_video_factory",
    status,
    oldFfmpegProductDefault: false,
    dirtyFfmpegFallbackAllowed: false,
    contentMeaningCanChange: false,
    needsFurtherImplementation,
    note,
  };
}

export function getLiveNativeVideoFactoryPolicy(): LiveNativeVideoFactoryPolicy {
  return {
    version: LIVE_NATIVE_VIDEO_FACTORY_POLICY_VERSION,
    decisionRole: LIVE_NATIVE_VIDEO_FACTORY_DECISION_ROLE,
    productDefaultVideoEngine: "tancmark_native_video_factory",
    oldFfmpegProductDefault: false,
    dirtyFfmpegAllowedInProduct: false,
    gplFfmpegAllowedInProduct: false,
    nonfreeFfmpegAllowedInProduct: false,
    cleanExternalFfmpegMayOnlyBeTemporaryHelper: true,
    ffmpegSourceCodeCopiedIntoTancMark: false,
    ffmpegCodeMixedWithTancMarkCode: false,
    githubCodeCopyAllowed: false,
    implementationMethod: "write_own_engine_from_formats_and_clean_specs",
    licenseRule: "own_code_or_free_commercial_open_source_only",
    noPaidClosedLicense: true,
    noContainersRequiredForProductDefault: true,
    liveProductTarget: true,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    visibleLogoFeatureSeparate: true,
    exactIdRequired: true,
    wrongIdCanOpenVault: false,
    missingIdCanOpenVault: false,
    candidateSupportCanDecide: false,
    dnaCanDecideAlone: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    vaultDecisionChanged: false,
    thresholdChanged: false,
    ownershipPreSealChanged: false,
    tasks: [
      task(
        "video_seal_embed",
        "native_product_default",
        false,
        "TancMark invisible/natural video-frame seal layer is the product direction.",
      ),
      task(
        "video_seal_read",
        "native_product_default",
        false,
        "TancMark native reader remains exact-ID gated and cannot open VAULT from support signals alone.",
      ),
      task(
        "mp4_mov_metadata_stamp",
        "native_build_target",
        false,
        "Own MP4/MOV container writer has native append-only 4GB+ MOV output/readback proof for controlled lab; full product live pipeline proof remains separate.",
      ),
      task(
        "live_frame_evidence",
        "native_product_default",
        false,
        "Frame evidence uses TancMark support-only signals and preserves final decision boundaries.",
      ),
      task(
        "live_ingest",
        "native_build_target",
        true,
        "Live ingest has a native controlled-lab stack completion result in Phase 5BI; full external/product launch still needs real corpus and playback verification without legacy FFmpeg local helpers.",
      ),
      task(
        "hls_segmenting",
        "native_build_target",
        true,
        "HLS packaging/segment writing has native payload and fragmented MP4 segment gates plus a reader-to-gate bridge; Claude fMP4/CMAF segment writer candidate passed audit as lab-ready, Phase 5BG native fMP4/CMAF extreme chain test passed, Phase 5BH playback/damage harness passed as lab/test evidence and Phase 5BI live stack completion passed 5/5 controlled lab tasks, while product playback and full product E2E remain pending.",
      ),
      task(
        "vod_recording",
        "native_build_target",
        true,
        "VOD recording has native passthrough/mux gates; full remux remains a native build target.",
      ),
      task(
        "thumbnail_generation",
        "native_build_target",
        true,
        "Embedded poster thumbnail gate is native and safe; real frame thumbnail decode remains a native build target.",
      ),
      task(
        "clip_generation",
        "native_build_target",
        true,
        "Full-asset reference clip gate is native and safe; guarded sample-table timed clip is available for simple progressive MP4/MOV, while complex layouts still require the gate.",
      ),
      task(
        "audio_track_handling",
        "native_build_target",
        true,
        "Audio inventory/passthrough gate is native and safe; decode/extract remains a native build target.",
      ),
      task(
        "timed_text_track_handling",
        "native_build_target",
        true,
        "Subtitle/caption/timecode/metadata evidence manifest gate is native and safe; embedding or rewriting timed-text tracks remains pending.",
      ),
      task(
        "large_video_offset_handling",
        "native_build_target",
        false,
        "4GB+ MP4/MOV offset safety gate is native and safe; real 4GB+ MOV input and native output/readback proofs passed for controlled lab.",
      ),
      task(
        "large_video_writer_gate",
        "native_build_target",
        false,
        "Native 4GB+ MP4/MOV writer acceptance gate is bound to the live stack; real 5GB MOV output/readback proof passed without FFmpeg, re-encode, source modification or media payload changes.",
      ),
      task(
        "track_interleave_planning",
        "native_build_target",
        true,
        "Audio/video track interleave planning gate is native and safe; binary interleaved output writing remains pending.",
      ),
      task(
        "interleave_writer_gate",
        "native_build_target",
        true,
        "Native audio/video interleave writer acceptance gate is ready; Claude interleave writer candidate passed the gate as lab-ready, but real-world/extreme live files and full live/VOD/ID E2E remain pending.",
      ),
    ],
    rules: [
      "Kirli lisansli eski FFmpeg urun ana yolu degildir.",
      "GPL veya nonfree FFmpeg urune giremez.",
      "Temiz lisansli external FFmpeg varsa bile yalniz gecici yardimci olabilir; TancMark'in ana video motoru sayilmaz.",
      "FFmpeg kaynak kodu TancMark icine kopyalanmaz.",
      "GitHub'dan lisansi belirsiz veya uyumsuz kod kopyalanmaz.",
      "Yeni motor TancMark'in kendi kodu veya ucretsiz ticari acik lisansli parcalarla yazilir.",
      "Canli yayin hedefi TancMark icinde calisan native video factory'dir.",
      "Konteyner urun varsayilani olmaz.",
      "Video goruntusu, ses, anlam ve kalite bozulamaz.",
      "Gorunur logo ozelligi ayridir ve kullanici isterse acilir.",
      "VAULT, exact ID, confirmed, final, threshold, ownership ve pre-seal mantigi degismez.",
    ],
  };
}

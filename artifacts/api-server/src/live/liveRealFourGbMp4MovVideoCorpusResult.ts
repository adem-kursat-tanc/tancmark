export const LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_VERSION =
  "live-real-four-gb-mp4-mov-video-corpus-v0.1" as const;

export const LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_DECISION_ROLE =
  "live_real_four_gb_mp4_mov_video_corpus_support_only_no_vault_no_confirmed" as const;

export interface LiveRealFourGbMp4MovVideoCorpusResult {
  version: typeof LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_VERSION;
  decisionRole: typeof LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_DECISION_ROLE;
  testExecuted: true;
  sourceType: "open_blender_foundation_real_4k_mov_video";
  localPath: "operator-data/TancMark_4GB_Test/sintel_4k.mov";
  sourceUrl: "https://download.blender.org/durian/movies/sintel_4k.mov";
  licensePage: "https://durian.blender.org/download/";
  licenseNote: "Creative Commons Attribution 3.0 source note kept beside downloaded file";
  fileName: "sintel_4k.mov";
  extension: ".mov";
  containerFamily: "quicktime_mov";
  sizeBytes: 5471004718;
  sizeGb: 5.095;
  crossesFourGbBoundary: true;
  fullSha256: "BBA4E6FE0E35964EA4CD26E92B170745BD624028FB0990CB1F3A9C185B8E508E";
  headerHex: "0000001466747970717420200000020071742020000000016D64617400000001";
  headerMatchesMov: true;
  chunkReadProofs: readonly [
    {
      offset: 0;
      bytesRead: 1048576;
      sha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7";
    },
    {
      offset: 2735502359;
      bytesRead: 1048576;
      sha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871";
    },
    {
      offset: 5469956142;
      bytesRead: 1048576;
      sha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1";
    },
  ];
  fullFileHashVerified: true;
  streamingReadProofPassed: true;
  realFourGbMp4MovVideoProofPassed: true;
  nativeFourGbMovWriterOutputProofPassed: true;
  nativeFourGbMovWriterOutputProofStillRequired: false;
  productReadyNow: false;
  controlledLabEvidence: true;
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchUsedByTest: false;
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

export function getLiveRealFourGbMp4MovVideoCorpusResult(): LiveRealFourGbMp4MovVideoCorpusResult {
  return {
    version: LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_VERSION,
    decisionRole: LIVE_REAL_FOUR_GB_MP4_MOV_VIDEO_CORPUS_DECISION_ROLE,
    testExecuted: true,
    sourceType: "open_blender_foundation_real_4k_mov_video",
    localPath: "operator-data/TancMark_4GB_Test/sintel_4k.mov",
    sourceUrl: "https://download.blender.org/durian/movies/sintel_4k.mov",
    licensePage: "https://durian.blender.org/download/",
    licenseNote: "Creative Commons Attribution 3.0 source note kept beside downloaded file",
    fileName: "sintel_4k.mov",
    extension: ".mov",
    containerFamily: "quicktime_mov",
    sizeBytes: 5471004718,
    sizeGb: 5.095,
    crossesFourGbBoundary: true,
    fullSha256: "BBA4E6FE0E35964EA4CD26E92B170745BD624028FB0990CB1F3A9C185B8E508E",
    headerHex: "0000001466747970717420200000020071742020000000016D64617400000001",
    headerMatchesMov: true,
    chunkReadProofs: [
      {
        offset: 0,
        bytesRead: 1048576,
        sha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7",
      },
      {
        offset: 2735502359,
        bytesRead: 1048576,
        sha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871",
      },
      {
        offset: 5469956142,
        bytesRead: 1048576,
        sha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1",
      },
    ],
    fullFileHashVerified: true,
    streamingReadProofPassed: true,
    realFourGbMp4MovVideoProofPassed: true,
    nativeFourGbMovWriterOutputProofPassed: true,
    nativeFourGbMovWriterOutputProofStillRequired: false,
    productReadyNow: false,
    controlledLabEvidence: true,
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsedByTest: false,
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

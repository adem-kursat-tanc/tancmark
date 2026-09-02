export const LIVE_REAL_FOUR_GB_VIDEO_CORPUS_VERSION =
  "live-real-four-gb-video-corpus-v0.1" as const;

export const LIVE_REAL_FOUR_GB_VIDEO_CORPUS_DECISION_ROLE =
  "live_real_four_gb_video_corpus_support_only_no_vault_no_confirmed" as const;

export interface LiveRealFourGbVideoCorpusResult {
  version: typeof LIVE_REAL_FOUR_GB_VIDEO_CORPUS_VERSION;
  decisionRole: typeof LIVE_REAL_FOUR_GB_VIDEO_CORPUS_DECISION_ROLE;
  testExecuted: true;
  sourceType: "open_blender_foundation_real_4k_video";
  localPath: "operator-data/TancMark_4GB_Test/Sintel.2010.4k.mkv";
  sourceUrl: "https://download.blender.org/durian/movies/Sintel.2010.4k.mkv";
  licensePage: "https://durian.blender.org/download/";
  licenseNote: "Creative Commons Attribution 3.0 source note kept beside downloaded file";
  fileName: "Sintel.2010.4k.mkv";
  extension: ".mkv";
  containerFamily: "matroska_mkv";
  sizeBytes: 4506488235;
  sizeGb: 4.197;
  crossesFourGbBoundary: true;
  fullSha256: "648178454637253705EA56BD8A02DB0BF17134703FE82EC3D6A9A880A343BC08";
  headerHex: "1A45DFA3934282886D6174726F736B61";
  headerMatchesMatroska: true;
  chunkReadProofs: readonly [
    {
      offset: 0;
      bytesRead: 1048576;
      sha256: "52B650A87D89C5FFCDA6D180D6BE9CC4DFE27BB0C07609B01EE4730340E31C77";
    },
    {
      offset: 2253244117;
      bytesRead: 1048576;
      sha256: "B5B431BDB7E87766CFA73943472E6D4A3D0D076F02AC294C6DFC63ABEF450CFA";
    },
    {
      offset: 4505439659;
      bytesRead: 1048576;
      sha256: "644733D5FC29EBF687A119DB3AFF0FD356814BF7F89A77A5AD5C1C7B54FD0C65";
    },
  ];
  fullFileHashVerified: true;
  streamingReadProofPassed: true;
  realFourGbVideoProofPassed: true;
  mp4MovLargeWriterProofPassed: false;
  mp4MovLargeWriterProofStillRequired: true;
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

export function getLiveRealFourGbVideoCorpusResult(): LiveRealFourGbVideoCorpusResult {
  return {
    version: LIVE_REAL_FOUR_GB_VIDEO_CORPUS_VERSION,
    decisionRole: LIVE_REAL_FOUR_GB_VIDEO_CORPUS_DECISION_ROLE,
    testExecuted: true,
    sourceType: "open_blender_foundation_real_4k_video",
    localPath: "operator-data/TancMark_4GB_Test/Sintel.2010.4k.mkv",
    sourceUrl: "https://download.blender.org/durian/movies/Sintel.2010.4k.mkv",
    licensePage: "https://durian.blender.org/download/",
    licenseNote: "Creative Commons Attribution 3.0 source note kept beside downloaded file",
    fileName: "Sintel.2010.4k.mkv",
    extension: ".mkv",
    containerFamily: "matroska_mkv",
    sizeBytes: 4506488235,
    sizeGb: 4.197,
    crossesFourGbBoundary: true,
    fullSha256: "648178454637253705EA56BD8A02DB0BF17134703FE82EC3D6A9A880A343BC08",
    headerHex: "1A45DFA3934282886D6174726F736B61",
    headerMatchesMatroska: true,
    chunkReadProofs: [
      {
        offset: 0,
        bytesRead: 1048576,
        sha256: "52B650A87D89C5FFCDA6D180D6BE9CC4DFE27BB0C07609B01EE4730340E31C77",
      },
      {
        offset: 2253244117,
        bytesRead: 1048576,
        sha256: "B5B431BDB7E87766CFA73943472E6D4A3D0D076F02AC294C6DFC63ABEF450CFA",
      },
      {
        offset: 4505439659,
        bytesRead: 1048576,
        sha256: "644733D5FC29EBF687A119DB3AFF0FD356814BF7F89A77A5AD5C1C7B54FD0C65",
      },
    ],
    fullFileHashVerified: true,
    streamingReadProofPassed: true,
    realFourGbVideoProofPassed: true,
    mp4MovLargeWriterProofPassed: false,
    mp4MovLargeWriterProofStillRequired: true,
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

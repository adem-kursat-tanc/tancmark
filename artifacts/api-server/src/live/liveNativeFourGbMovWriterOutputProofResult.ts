export const LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_VERSION =
  "live-native-four-gb-mov-writer-output-proof-v0.1" as const;

export const LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_DECISION_ROLE =
  "live_native_four_gb_mov_writer_output_proof_support_only_no_vault_no_confirmed" as const;

export interface LiveNativeFourGbMovWriterOutputProofResult {
  version: typeof LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_VERSION;
  decisionRole: typeof LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_DECISION_ROLE;
  testExecuted: true;
  writer: "tancmark_native_mov_append_only_writer";
  sealMode: "append_only_mov_uuid_box";
  sourcePath: "operator-data/TancMark_4GB_Test/sintel_4k.mov";
  outputPath: "operator-data/TancMark_4GB_Test/sintel_4k.tancmark-native-output.mov";
  sourceUrl: "https://download.blender.org/durian/movies/sintel_4k.mov";
  licensePage: "https://durian.blender.org/download/";
  sourceSizeBytes: 5471004718;
  outputSizeBytes: 5471005377;
  appendedBytes: 659;
  sizeGb: 5.095;
  outputFullSha256: "E5D7B4E63E22C0164CFC2B6385CEEBBDF2967C3B74BD14DE36C49ED6D1A3979F";
  sourceFullSha256: "BBA4E6FE0E35964EA4CD26E92B170745BD624028FB0990CB1F3A9C185B8E508E";
  crossesFourGbBoundary: true;
  nativeFourGbMovWriterOutputProofPassed: true;
  playbackReadbackProofPassed: true;
  proofBoxFound: true;
  proofBoxOffset: 5471004718;
  proofBoxSize: 659;
  topLevelBoxes: readonly [
    { readonly type: "ftyp"; readonly offset: 0; readonly size: 20 },
    { readonly type: "mdat"; readonly offset: 20; readonly size: 5470210569 },
    { readonly type: "moov"; readonly offset: 5470210589; readonly size: 794129 },
    { readonly type: "uuid"; readonly offset: 5471004718; readonly size: 659 },
  ];
  chunkReadProofs: readonly [
    {
      readonly offset: 0;
      readonly bytesRead: 1048576;
      readonly sourceSha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7";
      readonly outputSha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7";
    },
    {
      readonly offset: 2735502359;
      readonly bytesRead: 1048576;
      readonly sourceSha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871";
      readonly outputSha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871";
    },
    {
      readonly offset: 5469956142;
      readonly bytesRead: 1048576;
      readonly sourceSha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1";
      readonly outputSha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1";
    },
  ];
  sourceModified: false;
  mediaPayloadModified: false;
  outputCopyOnly: true;
  prefixBytesPreserved: true;
  usesStreamingRead: true;
  usesStreamingWrite: true;
  buffersWholeFile: false;
  maxChunkBytes: 8388608;
  oldFfmpegUsed: false;
  dirtyFfmpegUsed: false;
  gplFfmpegUsed: false;
  nonfreeFfmpegUsed: false;
  paidDependencyUsed: false;
  networkFetchUsedByTest: false;
  encodesVideo: false;
  transcodesVideo: false;
  reencodesAudio: false;
  videoMeaningChanged: false;
  audioMeaningChanged: false;
  visualQualityLossAllowed: false;
  productReadyNow: false;
  controlledLabEvidence: true;
  realCustomerContentUsed: false;
  externalTargetPush: false;
  publicSocialTargetsEnabled: false;
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

export function getLiveNativeFourGbMovWriterOutputProofResult(): LiveNativeFourGbMovWriterOutputProofResult {
  return {
    version: LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_VERSION,
    decisionRole: LIVE_NATIVE_FOUR_GB_MOV_WRITER_OUTPUT_PROOF_DECISION_ROLE,
    testExecuted: true,
    writer: "tancmark_native_mov_append_only_writer",
    sealMode: "append_only_mov_uuid_box",
    sourcePath: "operator-data/TancMark_4GB_Test/sintel_4k.mov",
    outputPath: "operator-data/TancMark_4GB_Test/sintel_4k.tancmark-native-output.mov",
    sourceUrl: "https://download.blender.org/durian/movies/sintel_4k.mov",
    licensePage: "https://durian.blender.org/download/",
    sourceSizeBytes: 5471004718,
    outputSizeBytes: 5471005377,
    appendedBytes: 659,
    sizeGb: 5.095,
    outputFullSha256: "E5D7B4E63E22C0164CFC2B6385CEEBBDF2967C3B74BD14DE36C49ED6D1A3979F",
    sourceFullSha256: "BBA4E6FE0E35964EA4CD26E92B170745BD624028FB0990CB1F3A9C185B8E508E",
    crossesFourGbBoundary: true,
    nativeFourGbMovWriterOutputProofPassed: true,
    playbackReadbackProofPassed: true,
    proofBoxFound: true,
    proofBoxOffset: 5471004718,
    proofBoxSize: 659,
    topLevelBoxes: [
      { type: "ftyp", offset: 0, size: 20 },
      { type: "mdat", offset: 20, size: 5470210569 },
      { type: "moov", offset: 5470210589, size: 794129 },
      { type: "uuid", offset: 5471004718, size: 659 },
    ],
    chunkReadProofs: [
      {
        offset: 0,
        bytesRead: 1048576,
        sourceSha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7",
        outputSha256: "181CA41AFADB1208F97D98B7965F788F79CBF67EC3FA21841774D00897238BF7",
      },
      {
        offset: 2735502359,
        bytesRead: 1048576,
        sourceSha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871",
        outputSha256: "462F396999C501B0C6290FA72387D909C3CC398BAC5931FD3C18373210FD1871",
      },
      {
        offset: 5469956142,
        bytesRead: 1048576,
        sourceSha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1",
        outputSha256: "7697A70A73679132F6AC7C905B309D45FC968684B9323F8127DA1D01F937D5D1",
      },
    ],
    sourceModified: false,
    mediaPayloadModified: false,
    outputCopyOnly: true,
    prefixBytesPreserved: true,
    usesStreamingRead: true,
    usesStreamingWrite: true,
    buffersWholeFile: false,
    maxChunkBytes: 8388608,
    oldFfmpegUsed: false,
    dirtyFfmpegUsed: false,
    gplFfmpegUsed: false,
    nonfreeFfmpegUsed: false,
    paidDependencyUsed: false,
    networkFetchUsedByTest: false,
    encodesVideo: false,
    transcodesVideo: false,
    reencodesAudio: false,
    videoMeaningChanged: false,
    audioMeaningChanged: false,
    visualQualityLossAllowed: false,
    productReadyNow: false,
    controlledLabEvidence: true,
    realCustomerContentUsed: false,
    externalTargetPush: false,
    publicSocialTargetsEnabled: false,
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

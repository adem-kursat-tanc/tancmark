export const LIVE_FFMPEG_POLICY_DECISION_ROLE =
  "live_ffmpeg_external_cli_policy_support_only_no_vault_no_confirmed" as const;

export interface LiveFfmpegExternalCliPolicy {
  processingEngine: "ffmpeg_cli_external";
  embeddedInTancMarkCode: false;
  allowedExecutionMode: "external_cli_subprocess_future";
  currentPhaseExecution: "dry_run_preview_only";
  realFfmpegExecutionEnabled: false;
  realMediaProcessingEnabled: false;
  preferredBuild: "lgpl";
  enableNonfreeAllowed: false;
  gplBuildRequiresHumanApproval: false;
  gplBuildAllowedInProduct: false;
  licenseNoticeRequiredForGpl: false;
  productRequiresCleanLgplBuild: true;
  currentKnownLocalBuild: "gpl_enabled_blocked_for_product";
  currentKnownLocalBinaryProductApproved: false;
  productMayProceedWithoutFfmpeg: true;
  productEncodingWithCurrentBinaryAllowed: false;
  versionBuildMetadataWillBeRecorded: true;
  thirdPartyNoticesDeferred: true;
  codecPatentRiskTrackedInLedger: true;
  ffmpegIsTancMarkWatermark: false;
  ffmpegCanOpenVault: false;
  ffmpegCanConfirm: false;
  ffmpegCanFinalize: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: typeof LIVE_FFMPEG_POLICY_DECISION_ROLE;
  rules: readonly string[];
}

export function getLiveFfmpegExternalCliPolicy(): LiveFfmpegExternalCliPolicy {
  return {
    processingEngine: "ffmpeg_cli_external",
    embeddedInTancMarkCode: false,
    allowedExecutionMode: "external_cli_subprocess_future",
    currentPhaseExecution: "dry_run_preview_only",
    realFfmpegExecutionEnabled: false,
    realMediaProcessingEnabled: false,
    preferredBuild: "lgpl",
    enableNonfreeAllowed: false,
    gplBuildRequiresHumanApproval: false,
    gplBuildAllowedInProduct: false,
    licenseNoticeRequiredForGpl: false,
    productRequiresCleanLgplBuild: true,
    currentKnownLocalBuild: "gpl_enabled_blocked_for_product",
    currentKnownLocalBinaryProductApproved: false,
    productMayProceedWithoutFfmpeg: true,
    productEncodingWithCurrentBinaryAllowed: false,
    versionBuildMetadataWillBeRecorded: true,
    thirdPartyNoticesDeferred: true,
    codecPatentRiskTrackedInLedger: true,
    ffmpegIsTancMarkWatermark: false,
    ffmpegCanOpenVault: false,
    ffmpegCanConfirm: false,
    ffmpegCanFinalize: false,
    supportOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: LIVE_FFMPEG_POLICY_DECISION_ROLE,
    rules: [
      "FFmpeg TancMark koduna gomulmez.",
      "FFmpeg sadece external CLI / subprocess olarak kullanilacak.",
      "Bu fazda gercek FFmpeg calistirilmayacak.",
      "Sadece dry-run command preview uretilecek.",
      "Varsayilan tercih LGPL build.",
      "Mevcut yerel FFmpeg build'i --enable-gpl tasidigi icin product-blocked ve lab-only kalir.",
      "GPL build urun icin kabul edilmez.",
      "Urun icin temiz LGPL build gerekir veya FFmpeg urun paketinden cikarilir.",
      "--enable-nonfree yasak.",
      "FFmpeg version/build metadata ileride kaydedilecek.",
      "THIRD_PARTY_NOTICES.md ileride guncellenecek.",
      "Codec/patent riski deferred ledger'da takip edilecek.",
      "FFmpeg TancMark muhru degildir.",
      "FFmpeg VAULT/confirmed/final karar vermez.",
      "FFmpeg sadece medya isleme aracidir.",
    ],
  };
}

import type {
  DiscoveryJobRecord,
  DiscoveryResult,
  DiscoverySecureRoomHandoff,
} from "./types";

export interface TakedownNoticeDraft {
  title: string;
  suspectedUrl: string | null;
  platform: string | null;
  evidenceSummary: string;
  ownerNamePlaceholder: string;
  workTitlePlaceholder: string;
  originalProofSummary: string;
  tancmarkVerificationSummary: string;
  requestedActionText: string;
  userSignaturePlaceholder: string;
  legalReviewRecommended: true;
  autoSendEnabled: false;
  copyOnly: true;
  emailSendEnabled: false;
  webhookEnabled: false;
  platformComplaintApiEnabled: false;
  automaticFormSubmitEnabled: false;
  botDeliveryEnabled: false;
  sentByTancMark: false;
  decisionRole: "takedown_notice_draft_copy_only_no_auto_send";
  canOpenVault: false;
  confirmed: false;
  final: false;
  noticeText: string;
}

function platformFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function firstCandidateUrl(
  results: readonly DiscoveryResult[],
  handoff?: DiscoverySecureRoomHandoff | null,
): string | null {
  const fromResults = results.find((result) => typeof result.url === "string" && result.url.length > 0)?.url;
  if (fromResults) return fromResults;
  return handoff?.candidateUrls[0] ?? handoff?.candidateTelegramMessages[0]?.url ?? null;
}

export function buildTakedownNoticeDraft(input: {
  job: DiscoveryJobRecord;
  results?: readonly DiscoveryResult[];
  handoff?: DiscoverySecureRoomHandoff | null;
  suspectedUrl?: string | null;
  platform?: string | null;
}): TakedownNoticeDraft {
  const results = input.results ?? [];
  const suspectedUrl = input.suspectedUrl ?? firstCandidateUrl(results, input.handoff);
  const platform = input.platform ?? platformFromUrl(suspectedUrl);
  const candidateCount = input.handoff?.candidateUrlCount ?? results.length;
  const telegramCount = input.handoff?.candidateTelegramCount ?? 0;
  const title = "TancMark copyright/takedown notice draft";
  const evidenceSummary =
    `TancMark Discovery found ${candidateCount} candidate URL(s) and ${telegramCount} public Telegram candidate(s). ` +
    "These are support-only discovery candidates and require final TancMark ID/watermark verification.";
  const originalProofSummary =
    "Original proof should be the owner's TancMark record, expected ID, ownership context, and any Secure Room evidence package.";
  const tancmarkVerificationSummary =
    "Final infringement confidence must rely on real TancMark invisible ID / DNA / watermark verification, not on Discovery alone.";
  const requestedActionText =
    "Please review this suspected copy under your platform procedure and consider removal or restriction if the rights claim is verified.";
  const noticeText = [
    "Bu bir hazir taslaktir.",
    "TancMark bu metni otomatik gondermez.",
    "Kullanici/platform prosedurune gore kendisi gonderir.",
    "Hukuki inceleme gerekebilir.",
    "",
    `Suspected URL: ${suspectedUrl ?? "[suspected URL]"}`,
    `Platform: ${platform ?? "[platform]"}`,
    evidenceSummary,
    originalProofSummary,
    tancmarkVerificationSummary,
    requestedActionText,
  ].join("\n");

  return {
    title,
    suspectedUrl,
    platform,
    evidenceSummary,
    ownerNamePlaceholder: "[owner name]",
    workTitlePlaceholder: input.job.title ?? "[work title]",
    originalProofSummary,
    tancmarkVerificationSummary,
    requestedActionText,
    userSignaturePlaceholder: "[user signature]",
    legalReviewRecommended: true,
    autoSendEnabled: false,
    copyOnly: true,
    emailSendEnabled: false,
    webhookEnabled: false,
    platformComplaintApiEnabled: false,
    automaticFormSubmitEnabled: false,
    botDeliveryEnabled: false,
    sentByTancMark: false,
    decisionRole: "takedown_notice_draft_copy_only_no_auto_send",
    canOpenVault: false,
    confirmed: false,
    final: false,
    noticeText,
  };
}

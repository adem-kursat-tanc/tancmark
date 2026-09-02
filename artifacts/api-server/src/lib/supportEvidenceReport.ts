import type { C2paReadOnlyStatusReport } from "./c2paStatus";
import type { SecureRoomEvidencePackage } from "./secureRoomEvidencePackage";
import {
  buildWebSearchEvidenceReport,
  type WebSearchEvidenceInput,
  type WebSearchEvidenceReport,
} from "./webSearchEvidence";

export type SupportEvidenceType =
  | "c2pa"
  | "open_timestamps"
  | "secure_room_evidence"
  | "web_search"
  | "dna_support"
  | "decision_boundary";

export type SupportDecisionRole =
  | "c2pa_read_only_support_only_no_vault_no_confirmed"
  | "open_timestamps_digest_support_only_no_vault_no_confirmed"
  | "secure_room_evidence_record_only_no_vault_no_confirmed"
  | "web_search_support_only_no_vault_no_confirmed"
  | "dna_support_only_no_vault_no_confirmed"
  | "decision_boundary_real_id_required_no_support_only_vault";

export interface SupportEvidenceBlock {
  present: boolean;
  status: string;
  source: string;
  summary: string;
  evidenceType: SupportEvidenceType;
  decisionRole: SupportDecisionRole;
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
}

export interface C2paSupportEvidenceBlock extends SupportEvidenceBlock {
  evidenceType: "c2pa";
  decisionRole: "c2pa_read_only_support_only_no_vault_no_confirmed";
  manifestRead: false;
  manifestWritten: false;
  signatureVerified: false;
  certificateUsed: false;
}

export interface OpenTimestampsSupportEvidenceBlock extends SupportEvidenceBlock {
  evidenceType: "open_timestamps";
  decisionRole: "open_timestamps_digest_support_only_no_vault_no_confirmed";
  digestOnly: true;
  payloadSha256: string | null;
  proofAvailable: boolean;
  btcAnchored: boolean;
  fileContentSent: false;
  sentOriginalContent: false;
}

export interface SecureRoomSupportEvidenceBlock extends SupportEvidenceBlock {
  evidenceType: "secure_room_evidence";
  decisionRole: "secure_room_evidence_record_only_no_vault_no_confirmed";
  fileContentIncluded: false;
  fileContentSent: false;
  digestOnly: true;
  confirmedSignals: string[];
  candidateSupportSignals: string[];
}

export interface WebSearchSupportEvidenceBlock extends SupportEvidenceBlock {
  evidenceType: "web_search";
  decisionRole: "web_search_support_only_no_vault_no_confirmed";
  enabled: boolean;
  provider: WebSearchEvidenceReport["provider"];
  queryType: WebSearchEvidenceReport["queryType"];
  searched: boolean;
  matchesFound: boolean;
  candidateUrls: string[];
  confidence: number;
  sentOriginalContent: false;
  externalApiCalled: false;
}

export interface DnaSupportEvidenceBlock extends SupportEvidenceBlock {
  evidenceType: "dna_support";
  decisionRole: "dna_support_only_no_vault_no_confirmed";
  advisoryOnly: true;
  canCompleteMissingId: false;
  canInventId: false;
  storesOriginalContent: false;
}

export interface DecisionBoundarySupportBlock extends SupportEvidenceBlock {
  evidenceType: "decision_boundary";
  decisionRole: "decision_boundary_real_id_required_no_support_only_vault";
  realTancMarkIdRequired: true;
  exactIdMatched: boolean;
  wrongIdCanOpenVault: false;
  idlessCanOpenVault: false;
  supportSignalsCanOpenVault: false;
  candidateSupportCanConfirm: false;
}

export interface OpenTimestampsSupportInput {
  status?: "not_available" | "pending" | "anchored" | "partial" | "error";
  source?: string;
  payloadSha256?: string | null;
  proofAvailable?: boolean;
  btcAnchored?: boolean;
  summary?: string;
}

export interface DnaSupportInput {
  present?: boolean;
  status?: string;
  source?: string;
  summary?: string;
}

export interface DecisionBoundaryInput {
  exactIdMatched?: boolean;
  status?: string;
  summary?: string;
}

export interface SupportEvidenceReportInput {
  c2pa?: C2paReadOnlyStatusReport | null;
  openTimestamps?: OpenTimestampsSupportInput | null;
  secureRoomEvidence?: SecureRoomEvidencePackage | null;
  webSearch?: WebSearchEvidenceInput | null;
  dnaSupport?: DnaSupportInput | null;
  decisionBoundary?: DecisionBoundaryInput | null;
}

export interface SupportEvidenceReport {
  schemaVersion: "support-evidence-read-only-v0.1";
  generatedAt: string;
  decisionRole: "read_only_support_evidence_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
  supportOnly: true;
  c2pa: C2paSupportEvidenceBlock;
  openTimestamps: OpenTimestampsSupportEvidenceBlock;
  secureRoomEvidence: SecureRoomSupportEvidenceBlock;
  webSearch: WebSearchSupportEvidenceBlock;
  dnaSupport: DnaSupportEvidenceBlock;
  decisionBoundary: DecisionBoundarySupportBlock;
}

function baseBlock(
  input: Pick<
    SupportEvidenceBlock,
    "present" | "status" | "source" | "summary" | "evidenceType" | "decisionRole"
  >,
): SupportEvidenceBlock {
  return {
    ...input,
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
  };
}

export function buildC2paSupportEvidenceBlock(
  c2pa: C2paReadOnlyStatusReport | null | undefined,
): C2paSupportEvidenceBlock {
  const present = c2pa?.status === "found" || c2pa?.status === "invalid_or_unverified";
  return {
    ...baseBlock({
      present,
      status: c2pa?.status ?? "not_checked",
      source: c2pa?.source ?? "c2pa_read_only_status_not_provided",
      summary:
        c2pa?.userLabel ??
        "C2PA / Content Credentials read-only status was not provided.",
      evidenceType: "c2pa",
      decisionRole: "c2pa_read_only_support_only_no_vault_no_confirmed",
    }),
    evidenceType: "c2pa",
    decisionRole: "c2pa_read_only_support_only_no_vault_no_confirmed",
    manifestRead: false,
    manifestWritten: false,
    signatureVerified: false,
    certificateUsed: false,
  };
}

export function buildOpenTimestampsSupportEvidenceBlock(
  input: OpenTimestampsSupportInput | null | undefined,
): OpenTimestampsSupportEvidenceBlock {
  const status = input?.status ?? "not_available";
  const proofAvailable =
    input?.proofAvailable ??
    (status === "pending" || status === "anchored" || status === "partial");
  const btcAnchored = input?.btcAnchored ?? status === "anchored";
  return {
    ...baseBlock({
      present: proofAvailable,
      status,
      source: input?.source ?? "open_timestamps_digest_status",
      summary:
        input?.summary ??
        "OpenTimestamps support is digest-only and cannot decide identity or open VAULT.",
      evidenceType: "open_timestamps",
      decisionRole: "open_timestamps_digest_support_only_no_vault_no_confirmed",
    }),
    evidenceType: "open_timestamps",
    decisionRole: "open_timestamps_digest_support_only_no_vault_no_confirmed",
    digestOnly: true,
    payloadSha256: input?.payloadSha256 ?? null,
    proofAvailable,
    btcAnchored,
    fileContentSent: false,
    sentOriginalContent: false,
  };
}

export function buildSecureRoomSupportEvidenceBlock(
  input: SecureRoomEvidencePackage | null | undefined,
): SecureRoomSupportEvidenceBlock {
  return {
    ...baseBlock({
      present: Boolean(input),
      status: input?.status ?? "not_available",
      source: input?.packageVersion ?? "secure_room_evidence_not_provided",
      summary:
        input?.note ??
        "Secure Room evidence package was not provided. When present, it remains record-only.",
      evidenceType: "secure_room_evidence",
      decisionRole: "secure_room_evidence_record_only_no_vault_no_confirmed",
    }),
    evidenceType: "secure_room_evidence",
    decisionRole: "secure_room_evidence_record_only_no_vault_no_confirmed",
    fileContentIncluded: false,
    fileContentSent: false,
    digestOnly: true,
    confirmedSignals: input?.confirmedSignals ?? [],
    candidateSupportSignals: input?.candidateSupportSignals ?? [],
  };
}

export function buildWebSearchSupportEvidenceBlock(
  input: WebSearchEvidenceInput | null | undefined,
): WebSearchSupportEvidenceBlock {
  const report = buildWebSearchEvidenceReport(input ?? {});
  return {
    ...baseBlock({
      present: report.matchesFound,
      status: report.enabled
        ? report.matchesFound
          ? "candidate_found"
          : "no_match"
        : "disabled",
      source: "web_search_evidence_preview_v0.1",
      summary: report.summary,
      evidenceType: "web_search",
      decisionRole: "web_search_support_only_no_vault_no_confirmed",
    }),
    evidenceType: "web_search",
    decisionRole: "web_search_support_only_no_vault_no_confirmed",
    enabled: report.enabled,
    provider: report.provider,
    queryType: report.queryType,
    searched: report.searched,
    matchesFound: report.matchesFound,
    candidateUrls: report.candidateUrls,
    confidence: report.confidence,
    sentOriginalContent: false,
    externalApiCalled: false,
  };
}

export function buildDnaSupportEvidenceBlock(
  input: DnaSupportInput | null | undefined,
): DnaSupportEvidenceBlock {
  return {
    ...baseBlock({
      present: input?.present === true,
      status: input?.status ?? (input?.present ? "present" : "not_available"),
      source: input?.source ?? "dna_support_summary",
      summary:
        input?.summary ??
        "DNA support may provide maps, hints, recovery plans, or learning records, but it cannot decide.",
      evidenceType: "dna_support",
      decisionRole: "dna_support_only_no_vault_no_confirmed",
    }),
    evidenceType: "dna_support",
    decisionRole: "dna_support_only_no_vault_no_confirmed",
    advisoryOnly: true,
    canCompleteMissingId: false,
    canInventId: false,
    storesOriginalContent: false,
  };
}

export function buildDecisionBoundarySupportBlock(
  input: DecisionBoundaryInput | null | undefined,
): DecisionBoundarySupportBlock {
  const exactIdMatched = input?.exactIdMatched === true;
  return {
    ...baseBlock({
      present: true,
      status: input?.status ?? (exactIdMatched ? "exact_id_matched_elsewhere" : "support_only_no_exact_id"),
      source: "tancmark_decision_boundary",
      summary:
        input?.summary ??
        "Support evidence is never enough by itself. VAULT requires a real TancMark ID read and system registry match in the owning decision path.",
      evidenceType: "decision_boundary",
      decisionRole: "decision_boundary_real_id_required_no_support_only_vault",
    }),
    evidenceType: "decision_boundary",
    decisionRole: "decision_boundary_real_id_required_no_support_only_vault",
    realTancMarkIdRequired: true,
    exactIdMatched,
    wrongIdCanOpenVault: false,
    idlessCanOpenVault: false,
    supportSignalsCanOpenVault: false,
    candidateSupportCanConfirm: false,
  };
}

export function buildSupportEvidenceReport(
  input: SupportEvidenceReportInput = {},
): SupportEvidenceReport {
  return {
    schemaVersion: "support-evidence-read-only-v0.1",
    generatedAt: new Date().toISOString(),
    decisionRole: "read_only_support_evidence_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
    supportOnly: true,
    c2pa: buildC2paSupportEvidenceBlock(input.c2pa),
    openTimestamps: buildOpenTimestampsSupportEvidenceBlock(input.openTimestamps),
    secureRoomEvidence: buildSecureRoomSupportEvidenceBlock(input.secureRoomEvidence),
    webSearch: buildWebSearchSupportEvidenceBlock(input.webSearch),
    dnaSupport: buildDnaSupportEvidenceBlock(input.dnaSupport),
    decisionBoundary: buildDecisionBoundarySupportBlock(input.decisionBoundary),
  };
}

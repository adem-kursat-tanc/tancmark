import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";
import {
  loadLocalSeedKnowledgeLibrary,
  type LocalSeedKnowledgeLoadReport,
  type LocalSeedKnowledgeLoadedRecord,
} from "./localSeedKnowledgeLoader";
import {
  LOCAL_SEED_DNA_NAMES,
  type LocalSeedDnaName,
} from "./localSeedKnowledgeSchema";

export const CHIEF_BRAIN_SEED_SUMMARY_HELPER_VERSION =
  "chief-brain-seed-summary-helper-v0.1" as const;

export interface ChiefBrainSeedDnaSummary {
  dnaName: LocalSeedDnaName;
  seedRecordCount: number;
  topics: string[];
  strongKnowledgeAreas: string[];
  deepeningAreas: string[];
  missingBlockingTopic: false;
  externalApiRequired: false;
  runtimeDependency: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  licenseSourceCommercialUseComplete: boolean;
  copiedTextFree: boolean;
  cleanRoomOnly: boolean;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  decisionLevel: "read_only_support_summary";
  chiefBrainCanLearn: string;
}

export interface ChiefBrainSeedSummaryReport {
  status: "chief_brain_seed_summary_read_only_v0.1";
  helperVersion: typeof CHIEF_BRAIN_SEED_SUMMARY_HELPER_VERSION;
  generatedAt: string;
  totalDnaCount: number;
  totalSeedRecordCount: number;
  minimumSeedRecordCount: 133;
  allDnaCovered: boolean;
  missingDnaNames: LocalSeedDnaName[];
  strongestKnowledgeAreas: string[];
  weakestOrDeepeningAreas: string[];
  dnaSummaries: ChiefBrainSeedDnaSummary[];
  readOnly: true;
  externalRuntimeAccess: false;
  runtimeInternetDependency: false;
  externalApiRequired: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  productBehaviorChanged: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
  note: string;
}

const DEEPENING_AREAS: Record<LocalSeedDnaName, string[]> = {
  "Format DNA": ["more per-format dirty-world examples"],
  "Image DNA": ["print-scan and camera-angle families"],
  "Video DNA": ["real platform result families"],
  "Audio DNA": ["codec and messenger-app damage families"],
  "Text/Document DNA": ["print-scan and copy-paste", "OCR and meaning-safety examples"],
  "Discovery/Search DNA": ["real API pilot results", "provider cost and quality results"],
  "TancLive DNA": ["real platform results", "external live platform outcome summaries"],
  "Secure Room/Zehir DNA": ["viewer and session anomaly families"],
  "Evidence/Delil DNA": ["evidence package quality scoring"],
  "License/Product Gate DNA": ["final product bundle scan evidence"],
  "Security DNA": ["durable audit and rate-limit results"],
  "User/Subscription DNA": ["plan-specific usage patterns"],
  "Pricing/Cost DNA": ["real cost measurements", "unit-cost measurements"],
  "SaaS/Operations DNA": ["real deploy, rollback and incident summaries"],
  "Product/Marketing/Legal DNA": ["reviewed launch copy and legal checklist status"],
  "Codex/Development DNA": ["repeated failure patterns and tool-specific recovery notes"],
};

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function recordsFor(
  report: LocalSeedKnowledgeLoadReport,
  dnaName: LocalSeedDnaName,
): LocalSeedKnowledgeLoadedRecord[] {
  return report.records.filter((record) => record.dnaName === dnaName && record.productAllowed);
}

function summaryFor(
  report: LocalSeedKnowledgeLoadReport,
  dnaName: LocalSeedDnaName,
): ChiefBrainSeedDnaSummary {
  const records = recordsFor(report, dnaName);
  const topics = unique(records.map((record) => record.topic));
  const strongKnowledgeAreas = unique(records.map((record) => record.shortRule)).slice(0, 6);
  const licenseSourceCommercialUseComplete = records.every(
    (record) =>
      record.sourceReference.length > 0 &&
      record.sourceLicense !== "unknown" &&
      record.commercialUseAllowed === true,
  );
  const copiedTextFree = records.every((record) => record.copiedText === false);
  const cleanRoomOnly = records.every((record) => record.cleanRoomSummary === true);

  return {
    dnaName,
    seedRecordCount: records.length,
    topics,
    strongKnowledgeAreas,
    deepeningAreas: DEEPENING_AREAS[dnaName],
    missingBlockingTopic: false,
    externalApiRequired: false,
    runtimeDependency: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    licenseSourceCommercialUseComplete,
    copiedTextFree,
    cleanRoomOnly,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    decisionLevel: "read_only_support_summary",
    chiefBrainCanLearn:
      `Chief Brain can use ${dnaName} seed topics to improve support-only recommendations without applying actions.`,
  };
}

export function buildChiefBrainSeedSummaryReport(options: {
  seedReport?: LocalSeedKnowledgeLoadReport;
  generatedAt?: string;
} = {}): ChiefBrainSeedSummaryReport {
  const seedReport =
    options.seedReport ??
    loadLocalSeedKnowledgeLibrary({
      generatedAt: options.generatedAt,
    });
  const dnaSummaries = LOCAL_SEED_DNA_NAMES.map((dnaName) => summaryFor(seedReport, dnaName));
  const allDnaCovered = dnaSummaries.every((summary) => summary.seedRecordCount > 0);
  const missingDnaNames = dnaSummaries
    .filter((summary) => summary.seedRecordCount === 0)
    .map((summary) => summary.dnaName);
  const strongestKnowledgeAreas = dnaSummaries
    .filter((summary) => summary.seedRecordCount >= 8)
    .slice(0, 8)
    .map((summary) => `${summary.dnaName}: ${summary.topics.slice(0, 3).join(", ")}`);
  const weakestOrDeepeningAreas = unique(
    dnaSummaries.flatMap((summary) =>
      summary.deepeningAreas.map((area) => `${summary.dnaName}: ${area}`),
    ),
  );

  return {
    status: "chief_brain_seed_summary_read_only_v0.1",
    helperVersion: CHIEF_BRAIN_SEED_SUMMARY_HELPER_VERSION,
    generatedAt: options.generatedAt ?? seedReport.generatedAt,
    totalDnaCount: dnaSummaries.length,
    totalSeedRecordCount: seedReport.recordCount,
    minimumSeedRecordCount: 133,
    allDnaCovered,
    missingDnaNames,
    strongestKnowledgeAreas,
    weakestOrDeepeningAreas,
    dnaSummaries,
    readOnly: true,
    externalRuntimeAccess: false,
    runtimeInternetDependency: false,
    externalApiRequired: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    productBehaviorChanged: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    requiresHumanApprovalForHighRisk: true,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
    note:
      "Chief Brain seed summary helper is read-only. It summarizes local seed knowledge for support recommendations and does not execute actions, call external APIs, change product behavior, open VAULT or create final decisions.",
  };
}

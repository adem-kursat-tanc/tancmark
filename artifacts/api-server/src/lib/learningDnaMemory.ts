import { createHash } from "node:crypto";
import type { CanonicalDnaId } from "./canonicalDnaRegistry";

export const LEARNING_DNA_MEMORY_VERSION = "learning-dna-memory-v0.1" as const;
export const LEARNING_ADVISORY_FINAL_DECISION = "LEARNING_ADVISORY_ONLY" as const;
export const LEARNING_AUTO_APPLY_ENV = "AEGIS_LEARNING_AUTO_APPLY" as const;

export type LearningMode =
  | "advisory_only"
  | "human_approved"
  | "auto_apply_ready"
  | "auto_apply_enabled";

export type LearningRecommendationType =
  | "report_language"
  | "test_priority"
  | "module_strength"
  | "next_test"
  | "heavy_ocr_target"
  | "safety_review";

export type LearningRiskLevel = "low" | "medium" | "high";
export type LearningApprovalStatus = "pending" | "approved" | "rejected";

export const LEARNING_MODULES = [
  "video",
  "image",
  "audio",
  "text",
  "light_ocr",
  "heavy_ocr",
  "secure_room",
  "zehir",
  "evidence_package",
  "c2pa_draft",
] as const;

export type LearningModule = (typeof LEARNING_MODULES)[number];

export interface LearningModuleObservation {
  module: LearningModule;
  active: boolean;
  sealed: boolean;
  idRead: boolean;
  candidateSupport: boolean;
  confirmed: boolean;
  rescued: boolean;
  failed: boolean;
  note: string | null;
}

export interface LearningTestRecord {
  recordId: string;
  scenario: string;
  fileKind: string;
  expectedOutcome: string | null;
  finalDecision: string;
  idMatched: boolean;
  falseVault: boolean;
  idlessVault: boolean;
  heavyOcrTriggered: boolean;
  modules: LearningModuleObservation[];
  note: string | null;
}

export interface LearningModuleSummary {
  module: LearningModule;
  activeCount: number;
  sealedCount: number;
  idReadCount: number;
  candidateSupportCount: number;
  confirmedCount: number;
  rescuedCount: number;
  failedCount: number;
}

export interface LearningRecommendation {
  recommendationId: string;
  recommendationType: LearningRecommendationType;
  topic: string;
  severity: "info" | "watch" | "review";
  riskLevel: LearningRiskLevel;
  sourceRecordIds: string[];
  affectedModules: LearningModule[];
  recommendation: string;
  proposedChange: string;
  reason: string;
  approvalStatus: LearningApprovalStatus;
  pendingHumanApproval: boolean;
  approved: boolean;
  rejected: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  applied: boolean;
  autoApplied: false;
  autoApplyEligible: boolean;
}

export interface LearningAutomationState {
  learningMode: LearningMode;
  autoApplyEnvName: typeof LEARNING_AUTO_APPLY_ENV;
  autoApplyEnvValue: string;
  autoApplyRequested: boolean;
  autoApplyEnabled: false;
  autoApplyReady: boolean;
  requiresHumanApproval: true;
  recommendationsAutoApplied: false;
  allowedHumanApprovedTypes: LearningRecommendationType[];
  forbiddenOperationalChanges: string[];
  note: string;
}

export interface LearningDnaMemory {
  status: "learning_memory_advisory_only_v0.1";
  memoryVersion: typeof LEARNING_DNA_MEMORY_VERSION;
  generatedAt: string;
  recordCount: number;
  records: LearningTestRecord[];
  moduleSummary: LearningModuleSummary[];
  lessons: string[];
  bestWorkingModule: LearningModule | null;
  weakModule: LearningModule | null;
  recommendations: LearningRecommendation[];
  automation: LearningAutomationState;
  safety: {
    learningDoesNotDecide: true;
    dnaDoesNotDecide: true;
    recommendationsAutoApplied: false;
    finalDecision: typeof LEARNING_ADVISORY_FINAL_DECISION;
    canOpenVault: false;
    vaultCapable: false;
    confirmed: false;
    idMatched: false;
    thresholdsChanged: false;
    idRuleChanged: false;
    moduleIdsCombined: false;
    candidateSupportIsNotConfirmed: true;
    secureRoomDoesNotDecide: true;
    zehirDoesNotDecide: true;
    evidencePackageDoesNotDecide: true;
    c2paDraftDoesNotDecide: true;
  };
  note: string;
}

export interface LearningApprovalInput {
  recommendationId: string;
  recommendationType: LearningRecommendationType;
  riskLevel: LearningRiskLevel;
  sourceRecordId: string | null;
  affectedModule: LearningModule | null;
  action: "approve" | "reject";
  userId: string;
  reason: string | null;
}

export interface LearningApprovalDecision {
  status: "learning_recommendation_human_gate_v0.1";
  decidedAt: string;
  recommendationId: string;
  recommendationType: LearningRecommendationType;
  riskLevel: LearningRiskLevel;
  sourceRecordId: string | null;
  affectedModule: LearningModule | null;
  approvalStatus: "approved" | "rejected";
  approved: boolean;
  rejected: boolean;
  approvedBy: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  applied: boolean;
  appliedScope: "record_only_advisory" | null;
  autoApplyEnabled: false;
  autoApplied: false;
  requiresHumanApproval: true;
  forbiddenOperationalChanges: string[];
  safety: LearningDnaMemory["safety"];
  note: string;
}

function cleanString(value: unknown, maxLength = 160): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function slug(value: string, maxLength = 48): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return cleaned || "recommendation";
}

function uniqueModules(records: LearningTestRecord[]): LearningModule[] {
  const seen = new Set<LearningModule>();
  for (const record of records) {
    for (const module of record.modules) {
      seen.add(module.module);
    }
  }
  return Array.from(seen);
}

function bool(value: unknown): boolean {
  return value === true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function moduleKind(value: unknown): LearningModule | null {
  return typeof value === "string" && LEARNING_MODULES.includes(value as LearningModule)
    ? (value as LearningModule)
    : null;
}

function normalizeModuleObservation(value: unknown): LearningModuleObservation | null {
  const raw = asRecord(value);
  const module = moduleKind(raw["module"]);
  if (!module) return null;
  return {
    module,
    active: bool(raw["active"]),
    sealed: bool(raw["sealed"]),
    idRead: bool(raw["idRead"]),
    candidateSupport: bool(raw["candidateSupport"]),
    confirmed: bool(raw["confirmed"]),
    rescued: bool(raw["rescued"]),
    failed: bool(raw["failed"]),
    note: cleanString(raw["note"], 240),
  };
}

export function normalizeLearningTestRecord(
  value: unknown,
  index: number,
): LearningTestRecord | null {
  const raw = asRecord(value);
  const scenario = cleanString(raw["scenario"], 120);
  const fileKind = cleanString(raw["fileKind"], 80);
  const finalDecision = cleanString(raw["finalDecision"], 120);
  if (!scenario || !fileKind || !finalDecision) return null;

  const rawModules = Array.isArray(raw["modules"]) ? raw["modules"] : [];
  const modules = rawModules
    .map((item) => normalizeModuleObservation(item))
    .filter((item): item is LearningModuleObservation => item !== null);

  return {
    recordId:
      cleanString(raw["recordId"], 120) ??
      `learning-record-${String(index + 1).padStart(2, "0")}`,
    scenario,
    fileKind,
    expectedOutcome: cleanString(raw["expectedOutcome"], 120),
    finalDecision,
    idMatched: bool(raw["idMatched"]),
    falseVault: bool(raw["falseVault"]),
    idlessVault: bool(raw["idlessVault"]),
    heavyOcrTriggered: bool(raw["heavyOcrTriggered"]),
    modules,
    note: cleanString(raw["note"], 500),
  };
}

function summarizeModules(records: LearningTestRecord[]): LearningModuleSummary[] {
  const byModule = new Map<LearningModule, LearningModuleSummary>();
  for (const module of LEARNING_MODULES) {
    byModule.set(module, {
      module,
      activeCount: 0,
      sealedCount: 0,
      idReadCount: 0,
      candidateSupportCount: 0,
      confirmedCount: 0,
      rescuedCount: 0,
      failedCount: 0,
    });
  }

  for (const record of records) {
    for (const observation of record.modules) {
      const summary = byModule.get(observation.module);
      if (!summary) continue;
      if (observation.active) summary.activeCount += 1;
      if (observation.sealed) summary.sealedCount += 1;
      if (observation.idRead) summary.idReadCount += 1;
      if (observation.candidateSupport) summary.candidateSupportCount += 1;
      if (observation.confirmed) summary.confirmedCount += 1;
      if (observation.rescued) summary.rescuedCount += 1;
      if (observation.failed) summary.failedCount += 1;
    }
  }

  return Array.from(byModule.values()).filter(
    (item) =>
      item.activeCount > 0 ||
      item.sealedCount > 0 ||
      item.idReadCount > 0 ||
      item.candidateSupportCount > 0 ||
      item.confirmedCount > 0 ||
      item.rescuedCount > 0 ||
      item.failedCount > 0,
  );
}

function chooseBestModule(summary: LearningModuleSummary[]): LearningModule | null {
  const ranked = summary
    .slice()
    .sort(
      (a, b) =>
        b.rescuedCount + b.confirmedCount - (a.rescuedCount + a.confirmedCount) ||
        b.candidateSupportCount - a.candidateSupportCount ||
        b.activeCount - a.activeCount,
    );
  const best = ranked[0];
  return best && best.rescuedCount + best.confirmedCount + best.candidateSupportCount > 0
    ? best.module
    : null;
}

function chooseWeakModule(summary: LearningModuleSummary[]): LearningModule | null {
  const ranked = summary
    .slice()
    .sort(
      (a, b) =>
        b.failedCount + b.candidateSupportCount - (a.failedCount + a.candidateSupportCount) ||
        a.confirmedCount - b.confirmedCount,
    );
  const weak = ranked[0];
  return weak && weak.failedCount + weak.candidateSupportCount > weak.confirmedCount
    ? weak.module
    : null;
}

function uniquePush(items: string[], value: string): void {
  if (!items.includes(value)) items.push(value);
}

function buildLessons(records: LearningTestRecord[]): string[] {
  const lessons: string[] = [];
  for (const record of records) {
    if (record.falseVault || record.idlessVault) {
      uniquePush(
        lessons,
        "Kritik guvenlik ihlali isareti var; bu kayit tavsiye uretir ama karar mantigini otomatik degistirmez.",
      );
    }
    if (!record.idMatched && record.finalDecision === "TEXT_CANDIDATE_SUPPORT") {
      uniquePush(
        lessons,
        "Metin/OCR sinyali ID eslesmesi olmadan aday destek seviyesinde kaldi.",
      );
    }
    if (record.heavyOcrTriggered) {
      uniquePush(
        lessons,
        "Agir OCR yalniz zor hedefte son care olarak kullanildi ve kesin karar uretmedi.",
      );
    }
    for (const module of record.modules) {
      if (module.rescued) {
        uniquePush(
          lessons,
          `${module.module} modulu ${record.scenario} senaryosunda sonucu kurtaran katman olarak kaydedildi.`,
        );
      }
      if (module.failed) {
        uniquePush(
          lessons,
          `${module.module} modulu ${record.scenario} senaryosunda zayif sinyal verdi; sonraki denemede izlenmeli.`,
        );
      }
    }
  }
  return lessons.length > 0
    ? lessons
    : ["Ogrenme hafizasi kayitlari karar degistirmeden tavsiye uretmeye hazir."];
}

function buildRecommendations(
  records: LearningTestRecord[],
  summary: LearningModuleSummary[],
): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];
  const best = chooseBestModule(summary);
  const weak = chooseWeakModule(summary);
  const heavyUsed = records.some((record) => record.heavyOcrTriggered);
  const safetyFlag = records.some((record) => record.falseVault || record.idlessVault);
  const sourceRecordIds = records.map((record) => record.recordId);

  function rec(
    input: Omit<
      LearningRecommendation,
      | "recommendationId"
      | "approvalStatus"
      | "pendingHumanApproval"
      | "approved"
      | "rejected"
      | "approvedBy"
      | "approvedAt"
      | "applied"
      | "autoApplied"
    >,
  ): LearningRecommendation {
    const index = recommendations.length + 1;
    return {
      ...input,
      recommendationId: `lrn-${String(index).padStart(2, "0")}-${slug(input.topic)}`,
      approvalStatus: "pending",
      pendingHumanApproval: true,
      approved: false,
      rejected: false,
      approvedBy: null,
      approvedAt: null,
      applied: false,
      autoApplied: false,
    };
  }

  if (best) {
    recommendations.push(rec({
      recommendationType: "module_strength",
      topic: "modul_secimi",
      severity: "info",
      riskLevel: "low",
      sourceRecordIds,
      affectedModules: [best],
      recommendation: `${best} katmani benzer senaryolarda once izlenecek aday destek/kurtarma sinyali olarak raporlansin.`,
      proposedChange:
        "Rapor/test onceligi icin modul gucu notu olustur; karar, esik veya ID kurali degistirme.",
      reason: "Gecmis kayitlarda bu katman confirmed veya rescued sinyali verdi.",
      autoApplyEligible: true,
    }));
  }

  if (weak) {
    recommendations.push(rec({
      recommendationType: "test_priority",
      topic: "zayif_katman",
      severity: "watch",
      riskLevel: "low",
      sourceRecordIds,
      affectedModules: [weak],
      recommendation: `${weak} katmani icin sonraki kucuk testte aday sinyal ve ID okuma ayrimi ozellikle izlenmeli.`,
      proposedChange:
        "Bir sonraki kucuk test planinda bu katmani izleme onceligi ver; calisma mantigini degistirme.",
      reason: "Gecmis kayitlarda bu katman confirmed yerine zayif/candidate sinyal verdi.",
      autoApplyEligible: true,
    }));
  }

  if (heavyUsed) {
    recommendations.push(rec({
      recommendationType: "heavy_ocr_target",
      topic: "agir_ocr",
      severity: "info",
      riskLevel: "low",
      sourceRecordIds,
      affectedModules: ["heavy_ocr"],
      recommendation:
        "Agir OCR son care olarak kalmali; yalniz secilmis zor hedeflerde candidate/support uretmeli.",
      proposedChange:
        "Agir OCR hedef secimi icin advisory not yaz; confirmed/VAULT veya tum dosya tarama acma.",
      reason: "Kayitlarda agir OCR tetiklendi, fakat confirmed/VAULT yetkisi yok.",
      autoApplyEligible: true,
    }));
  }

  if (safetyFlag) {
    recommendations.push(rec({
      recommendationType: "safety_review",
      topic: "guvenlik",
      severity: "review",
      riskLevel: "high",
      sourceRecordIds,
      affectedModules: uniqueModules(records),
      recommendation:
        "False VAULT veya ID olmadan VAULT isareti gorulen kayitlar insan incelemesine alinmali.",
      proposedChange:
        "Insan incelemesi ac; otomatik uygulama, esik degisikligi veya karar degisikligi yapma.",
      reason: "Ogrenme hafizasi guvenlik ihlalini otomatik duzeltmez veya esik degistirmez.",
      autoApplyEligible: false,
    }));
  }

  if (recommendations.length === 0) {
    recommendations.push(rec({
      recommendationType: "next_test",
      topic: "genel",
      severity: "info",
      riskLevel: "low",
      sourceRecordIds,
      affectedModules: uniqueModules(records),
      recommendation:
        "Mevcut sonuc korunmali; daha fazla karar degisikligi icin insan onayi gerekir.",
      proposedChange:
        "Sonraki kucuk test onerisini rapora ekle; sistem davranisini otomatik degistirme.",
      reason: "Kayitlar kritik borc uretmedi ve ogrenme hafizasi advisory-only calisir.",
      autoApplyEligible: true,
    }));
  }

  return recommendations;
}

export function resolveLearningAutomationState(): LearningAutomationState {
  const raw = process.env[LEARNING_AUTO_APPLY_ENV] ?? "false";
  const requested = raw.toLowerCase() === "true";
  return {
    learningMode: requested ? "auto_apply_ready" : "human_approved",
    autoApplyEnvName: LEARNING_AUTO_APPLY_ENV,
    autoApplyEnvValue: raw,
    autoApplyRequested: requested,
    autoApplyEnabled: false,
    autoApplyReady: true,
    requiresHumanApproval: true,
    recommendationsAutoApplied: false,
    allowedHumanApprovedTypes: [
      "report_language",
      "test_priority",
      "module_strength",
      "next_test",
      "heavy_ocr_target",
    ],
    forbiddenOperationalChanges: [
      "VAULT threshold changes",
      "ID verification rule changes",
      "ID length changes",
      "final decision logic changes",
      "module ID fragment merging",
      "automatic accusation",
      "automatic hard Zehir trigger",
      "Secure Room decision language changes",
    ],
    note: requested
      ? "Auto-apply was requested by env, but this build keeps autoApplyEnabled=false. Only future low-risk advisory changes may use the gate."
      : "Human approval gate is active. Auto apply is prepared but disabled by default.",
  };
}

function safetyBlock(): LearningDnaMemory["safety"] {
  return {
    learningDoesNotDecide: true,
    dnaDoesNotDecide: true,
    recommendationsAutoApplied: false,
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    canOpenVault: false,
    vaultCapable: false,
    confirmed: false,
    idMatched: false,
    thresholdsChanged: false,
    idRuleChanged: false,
    moduleIdsCombined: false,
    candidateSupportIsNotConfirmed: true,
    secureRoomDoesNotDecide: true,
    zehirDoesNotDecide: true,
    evidencePackageDoesNotDecide: true,
    c2paDraftDoesNotDecide: true,
  };
}

export function buildLearningDnaMemory(records: LearningTestRecord[]): LearningDnaMemory {
  const moduleSummary = summarizeModules(records);
  return {
    status: "learning_memory_advisory_only_v0.1",
    memoryVersion: LEARNING_DNA_MEMORY_VERSION,
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
    moduleSummary,
    lessons: buildLessons(records),
    bestWorkingModule: chooseBestModule(moduleSummary),
    weakModule: chooseWeakModule(moduleSummary),
    recommendations: buildRecommendations(records, moduleSummary),
    automation: resolveLearningAutomationState(),
    safety: safetyBlock(),
    note:
      "Learning memory stores lessons and recommendations only. Human approval is required before any advisory action. It does not change thresholds, ID rules, VAULT gates, or module decisions.",
  };
}

export function normalizeLearningApprovalInput(value: unknown): LearningApprovalInput | null {
  const raw = asRecord(value);
  const recommendationId = cleanString(raw["recommendationId"], 120);
  const recommendationTypeRaw = cleanString(raw["recommendationType"], 80);
  const recommendationType =
    recommendationTypeRaw &&
    [
      "report_language",
      "test_priority",
      "module_strength",
      "next_test",
      "heavy_ocr_target",
      "safety_review",
    ].includes(recommendationTypeRaw)
      ? (recommendationTypeRaw as LearningRecommendationType)
      : null;
  const riskLevelRaw = cleanString(raw["riskLevel"], 40);
  const riskLevel =
    riskLevelRaw && ["low", "medium", "high"].includes(riskLevelRaw)
      ? (riskLevelRaw as LearningRiskLevel)
      : null;
  const actionRaw = cleanString(raw["action"], 40);
  const action =
    actionRaw && ["approve", "reject"].includes(actionRaw)
      ? (actionRaw as "approve" | "reject")
      : null;
  const userId = cleanString(raw["userId"], 120);
  if (!recommendationId || !recommendationType || !riskLevel || !action || !userId) {
    return null;
  }

  return {
    recommendationId,
    recommendationType,
    riskLevel,
    sourceRecordId: cleanString(raw["sourceRecordId"], 120),
    affectedModule: moduleKind(raw["affectedModule"]),
    action,
    userId,
    reason: cleanString(raw["reason"], 500),
  };
}

export function buildLearningApprovalDecision(
  input: LearningApprovalInput,
): LearningApprovalDecision {
  const automation = resolveLearningAutomationState();
  const allowed =
    input.riskLevel === "low" &&
    automation.allowedHumanApprovedTypes.includes(input.recommendationType);
  const approved = input.action === "approve";
  const applied = approved && allowed;
  const now = new Date().toISOString();

  return {
    status: "learning_recommendation_human_gate_v0.1",
    decidedAt: now,
    recommendationId: input.recommendationId,
    recommendationType: input.recommendationType,
    riskLevel: input.riskLevel,
    sourceRecordId: input.sourceRecordId,
    affectedModule: input.affectedModule,
    approvalStatus: approved ? "approved" : "rejected",
    approved,
    rejected: !approved,
    approvedBy: input.userId,
    approvedAt: approved ? now : null,
    rejectedAt: approved ? null : now,
    applied,
    appliedScope: applied ? "record_only_advisory" : null,
    autoApplyEnabled: false,
    autoApplied: false,
    requiresHumanApproval: true,
    forbiddenOperationalChanges: automation.forbiddenOperationalChanges,
    safety: safetyBlock(),
    note: applied
      ? "Approved low-risk learning recommendation was recorded as advisory-only. No threshold, ID, VAULT, final-decision, Secure Room, Zehir, Evidence Package, or C2PA behavior changed."
      : "Learning recommendation was not applied to system behavior. Human gate recorded the decision only.",
  };
}

// Canonical append-only record contract. The legacy advisory builders above
// remain byte-compatible; every new adapter delegates to this single writer.
export const CANONICAL_LEARNING_RECORD_VERSION = "tancmark-learning-record-v1" as const;
export const TANCMARK_DNA_SINGLE_WRITER_CONTRACT = "TANCMARK_DNA_SINGLE_WRITER_CONTRACT" as const;
export const MAX_CANONICAL_LEARNING_RECORD_BYTES = 64 * 1024;

export type CanonicalEvidenceClass = "realWorld" | "synthetic" | "replay" | "dryRun";
export type CanonicalObservationClass = "positive" | "negative" | "ambiguous";
export type CanonicalRiskClass =
  | "SAFE_AUTOMATIC_LEARNING"
  | "LOW_RISK_OWNER_APPROVAL"
  | "MEDIUM_RISK_OWNER_APPROVAL"
  | "HIGH_RISK_MANUAL_ENGINEERING_REVIEW"
  | "FORBIDDEN";

export interface CanonicalLearningRecordInput {
  eventId: string;
  tenantScope: string;
  moduleId: string;
  dnaId: CanonicalDnaId;
  sourceType: string;
  sourceEvidenceId: string;
  sourceCreatedAt: string;
  observedAt: string;
  sourceCodeCommit: string;
  sourceCodeTree: string;
  sourceFileHashes: Record<string, string>;
  runtimeIdentity: string;
  algorithmVersion: string;
  testContractVersion: string;
  mediaClass: string;
  evidenceClass: CanonicalEvidenceClass;
  observationClass: CanonicalObservationClass;
  exactIdMatched: boolean;
  partialMatchedUnits: number;
  partialTotalUnits: number;
  partialMatchPercent: number;
  registryVerified: boolean;
  signatureVerified: boolean;
  wrongIdResult: string;
  noIdResult: string;
  wrongTenantResult: string;
  unsealedResult: string;
  decisionBefore: string;
  decisionAfter: string;
  decisionChanged: boolean;
  learnedSignals: string[];
  limitations: string[];
  riskLevel: CanonicalRiskClass;
  redactionState: "REDACTED_NO_PRIVATE_CONTENT";
  createdBy: string;
  privateEvidenceReference?: string | null;
  supersedesRecordId?: string | null;
  correctionReason?: string | null;
}

export interface CanonicalLearningRecord extends CanonicalLearningRecordInput {
  recordVersion: typeof CANONICAL_LEARNING_RECORD_VERSION;
  recordId: string;
  createdAt: string;
  immutableDigest: string;
  appendOnly: true;
  canOpenVault: false;
  canConfirmFinal: false;
  canInventId: false;
  autoApplied: false;
}

export interface CanonicalLearningAppendResult {
  created: boolean;
  record: CanonicalLearningRecord;
  duplicateOfRecordId: string | null;
}

const SAFE_REFERENCE = /^[a-z0-9][a-z0-9._:-]{2,180}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const GIT_OR_SHA256 = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const WINDOWS_OR_USER_PATH = /(?:[a-z]:\\|\\users\\|\/users\/|\/home\/)/i;
const SECRET_LIKE = /(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+)/i;
const PERSONAL_DATA_LIKE = /(?:\b\d{11}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const UNTRUSTED_INSTRUCTION = /(?:ignore (?:all |the )?previous|forget (?:all |the )?previous|system prompt|owner approval|APPROVE_CHIEF_BRAIN_SAFE_ACTION)/i;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function validateSafeText(value: string, label: string, maxLength = 800): void {
  if (!value.trim() || value.length > maxLength) throw new Error(`${label}: INVALID_LENGTH`);
  if (WINDOWS_OR_USER_PATH.test(value)) throw new Error(`${label}: PRIVATE_PATH_REJECTED`);
  if (SECRET_LIKE.test(value)) throw new Error(`${label}: SECRET_LIKE_DATA_REJECTED`);
  if (PERSONAL_DATA_LIKE.test(value)) throw new Error(`${label}: PERSONAL_DATA_REJECTED`);
  if (UNTRUSTED_INSTRUCTION.test(value)) throw new Error(`${label}: UNTRUSTED_SOURCE_DATA`);
  if (value.includes("../") || value.includes("..\\")) throw new Error(`${label}: PATH_TRAVERSAL_REJECTED`);
  if (/<script\b|javascript:/i.test(value)) throw new Error(`${label}: ACTIVE_CONTENT_REJECTED`);
}

export function validateCanonicalLearningRecordInput(input: CanonicalLearningRecordInput): void {
  for (const [label, value] of Object.entries({
    eventId: input.eventId,
    tenantScope: input.tenantScope,
    moduleId: input.moduleId,
    sourceType: input.sourceType,
    sourceEvidenceId: input.sourceEvidenceId,
    sourceCodeCommit: input.sourceCodeCommit,
    sourceCodeTree: input.sourceCodeTree,
    runtimeIdentity: input.runtimeIdentity,
    algorithmVersion: input.algorithmVersion,
    testContractVersion: input.testContractVersion,
    mediaClass: input.mediaClass,
    wrongIdResult: input.wrongIdResult,
    noIdResult: input.noIdResult,
    wrongTenantResult: input.wrongTenantResult,
    unsealedResult: input.unsealedResult,
    decisionBefore: input.decisionBefore,
    decisionAfter: input.decisionAfter,
    createdBy: input.createdBy,
  })) validateSafeText(value, label, 300);

  if (!SAFE_REFERENCE.test(input.eventId)) throw new Error("eventId: INVALID_REFERENCE");
  if (!SAFE_REFERENCE.test(input.tenantScope)) throw new Error("tenantScope: INVALID_REFERENCE");
  if (!SAFE_REFERENCE.test(input.sourceEvidenceId)) {
    throw new Error("sourceEvidenceId: PRIVATE_REFERENCE_REQUIRED");
  }
  if (input.privateEvidenceReference && !SAFE_REFERENCE.test(input.privateEvidenceReference)) {
    throw new Error("privateEvidenceReference: INVALID_REFERENCE");
  }
  if (!ISO_DATE.test(input.sourceCreatedAt) || !ISO_DATE.test(input.observedAt)) {
    throw new Error("source/observed date: INVALID_ISO_DATE");
  }
  if (!GIT_OR_SHA256.test(input.sourceCodeCommit) || !GIT_OR_SHA256.test(input.sourceCodeTree)) {
    throw new Error("source code identity must be a full Git or SHA-256 digest");
  }
  for (const [fileId, fileHash] of Object.entries(input.sourceFileHashes)) {
    if (!SAFE_REFERENCE.test(fileId) || !SHA256.test(fileHash)) {
      throw new Error("sourceFileHashes must use redacted file IDs and SHA-256 values");
    }
  }
  if (!Number.isInteger(input.partialMatchedUnits) || !Number.isInteger(input.partialTotalUnits)) {
    throw new Error("partial units must be integers");
  }
  if (input.partialMatchedUnits < 0 || input.partialTotalUnits < 0 || input.partialMatchedUnits > input.partialTotalUnits) {
    throw new Error("partial units are inconsistent");
  }
  const expectedPercent = input.partialTotalUnits === 0
    ? 0
    : Number(((input.partialMatchedUnits / input.partialTotalUnits) * 100).toFixed(6));
  if (Math.abs(expectedPercent - input.partialMatchPercent) > 0.000001) {
    throw new Error("partialMatchPercent is not matchedUnits/totalUnits");
  }
  if (input.decisionChanged !== (input.decisionBefore !== input.decisionAfter)) {
    throw new Error("decisionChanged is inconsistent");
  }
  if ((input.supersedesRecordId && !input.correctionReason) || (!input.supersedesRecordId && input.correctionReason)) {
    throw new Error("correction requires both supersedesRecordId and correctionReason");
  }
  for (const [index, signal] of input.learnedSignals.entries()) {
    validateSafeText(signal, `learnedSignals[${index}]`);
  }
  for (const [index, limitation] of input.limitations.entries()) {
    validateSafeText(limitation, `limitations[${index}]`);
  }
  const serialized = canonicalJson(input);
  if (Buffer.byteLength(serialized, "utf8") > MAX_CANONICAL_LEARNING_RECORD_BYTES) {
    throw new Error("LEARNING_RECORD_TOO_LARGE");
  }
}

export class CanonicalLearningDnaMemory {
  readonly writerContract = TANCMARK_DNA_SINGLE_WRITER_CONTRACT;
  readonly safeAutomaticLearning = true;
  readonly automaticProposalGeneration = true;
  readonly autoApply = false;
  readonly autoDeploy = false;
  readonly autoPush = false;
  readonly autoVaultDecision = false;

  #records: CanonicalLearningRecord[] = [];
  #dedupeByTenantEvent = new Map<string, CanonicalLearningRecord>();

  append(input: CanonicalLearningRecordInput): CanonicalLearningAppendResult {
    validateCanonicalLearningRecordInput(input);
    const dedupeKey = `${input.tenantScope}:${input.eventId}`;
    const duplicate = this.#dedupeByTenantEvent.get(dedupeKey);
    if (duplicate) {
      return { created: false, record: duplicate, duplicateOfRecordId: duplicate.recordId };
    }
    if (input.supersedesRecordId) {
      const superseded = this.#records.find((record) => record.recordId === input.supersedesRecordId);
      if (!superseded || superseded.tenantScope !== input.tenantScope) {
        throw new Error("SUPERSEDED_RECORD_NOT_FOUND_IN_TENANT");
      }
    }
    const createdAt = new Date().toISOString();
    const base = {
      ...input,
      recordVersion: CANONICAL_LEARNING_RECORD_VERSION,
      createdAt,
      appendOnly: true as const,
      canOpenVault: false as const,
      canConfirmFinal: false as const,
      canInventId: false as const,
      autoApplied: false as const,
    };
    const immutableDigest = digest(base);
    const record = deepFreeze<CanonicalLearningRecord>({
      ...base,
      recordId: `dna-lrn-${immutableDigest.slice(0, 24)}`,
      immutableDigest,
    });
    this.#records.push(record);
    this.#dedupeByTenantEvent.set(dedupeKey, record);
    return { created: true, record, duplicateOfRecordId: null };
  }

  listForTenant(tenantScope: string): readonly CanonicalLearningRecord[] {
    return this.#records.filter((record) => record.tenantScope === tenantScope);
  }

  getForTenant(tenantScope: string, recordId: string): CanonicalLearningRecord | null {
    return this.#records.find(
      (record) => record.tenantScope === tenantScope && record.recordId === recordId,
    ) ?? null;
  }

  anonymousHealthSummary(): { recordCount: number; tenantCount: number; digest: string } {
    const tenantCount = new Set(this.#records.map((record) => record.tenantScope)).size;
    return {
      recordCount: this.#records.length,
      tenantCount,
      digest: digest(this.#records.map((record) => record.immutableDigest)),
    };
  }
}

import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";

export const LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION =
  "local-seed-knowledge-schema-v0.1" as const;

export const LOCAL_SEED_DNA_NAMES = [
  "Format DNA",
  "Image DNA",
  "Video DNA",
  "Audio DNA",
  "Text/Document DNA",
  "Discovery/Search DNA",
  "TancLive DNA",
  "Secure Room/Zehir DNA",
  "Evidence/Delil DNA",
  "License/Product Gate DNA",
  "Security DNA",
  "User/Subscription DNA",
  "Pricing/Cost DNA",
  "SaaS/Operations DNA",
  "Product/Marketing/Legal DNA",
  "Codex/Development DNA",
] as const;

export type LocalSeedDnaName = (typeof LOCAL_SEED_DNA_NAMES)[number];

export const LOCAL_SEED_SOURCE_TYPES = [
  "tancmark_internal_policy",
  "tancmark_project_report",
  "tancmark_validation_contract",
  "clean_room_public_summary",
  "clean_room_standard_summary",
] as const;

export type LocalSeedSourceType = (typeof LOCAL_SEED_SOURCE_TYPES)[number];

export const LOCAL_SEED_ALLOWED_LICENSES = [
  "TancMark-Internal-Clean-Room",
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Zlib",
  "CC0-1.0",
] as const;

export const LOCAL_SEED_BLOCKED_LICENSES = [
  "GPL",
  "GPL-2.0",
  "GPL-3.0",
  "AGPL",
  "AGPL-3.0",
  "LGPL-runtime-unsafe",
  "non-commercial",
  "unknown",
  "restricted",
  "source-available-restricted",
  "no-license",
] as const;

export type LocalSeedDecisionLevel = "support" | "advisory" | "seed_knowledge";

export interface LocalSeedKnowledgeRecord {
  knowledgeId: string;
  dnaName: LocalSeedDnaName;
  topic: string;
  shortRule: string;
  explanation: string;
  sourceType: LocalSeedSourceType;
  sourceReference: string;
  sourceLicense: string;
  commercialUseAllowed: boolean;
  sourceDateOrVersion: string;
  cleanRoomSummary: true;
  copiedText: false;
  runtimeDependency: false;
  externalApiRequired: false;
  canOpenVault: false;
  canConfirmFinal: false;
  decisionLevel: LocalSeedDecisionLevel;
}

export interface LocalSeedKnowledgeManifestEntry {
  dnaName: LocalSeedDnaName;
  libraryFile: string;
  allowedSourceTypes: LocalSeedSourceType[];
  blockedLicenses: string[];
  productAllowed: boolean;
  readOnly: true;
  storesSensitiveContent: false;
  externalRuntimeAccess: false;
}

export interface LocalSeedKnowledgeManifest {
  schemaVersion: typeof LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION;
  libraryPurpose: "seed_knowledge_starting_point_only";
  staticMemoryOnly: false;
  closedLoopLearningContinues: true;
  readOnly: true;
  externalRuntimeAccess: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canOpenVault: false;
  canConfirmFinal: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  entries: LocalSeedKnowledgeManifestEntry[];
}

export interface LocalSeedKnowledgeLibrary {
  schemaVersion: typeof LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION;
  libraryPurpose: "seed_knowledge_starting_point_only";
  staticMemoryOnly: false;
  closedLoopLearningContinues: true;
  readOnly: true;
  externalRuntimeAccess: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canOpenVault: false;
  canConfirmFinal: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  records: LocalSeedKnowledgeRecord[];
}

export interface LocalSeedKnowledgeValidationResult {
  ok: boolean;
  productAllowed: boolean;
  blockedReasons: string[];
  safety: LearningDnaDecisionSafety;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function validateLocalSeedKnowledgeRecord(
  record: Partial<LocalSeedKnowledgeRecord>,
): LocalSeedKnowledgeValidationResult {
  const blockedReasons: string[] = [];

  if (!isString(record.knowledgeId)) blockedReasons.push("missing_knowledge_id");
  if (!includesValue(LOCAL_SEED_DNA_NAMES, record.dnaName)) blockedReasons.push("unknown_dna_name");
  if (!isString(record.topic)) blockedReasons.push("missing_topic");
  if (!isString(record.shortRule)) blockedReasons.push("missing_short_rule");
  if (!isString(record.explanation)) blockedReasons.push("missing_explanation");
  if (!includesValue(LOCAL_SEED_SOURCE_TYPES, record.sourceType)) {
    blockedReasons.push("unsupported_source_type");
  }
  if (!isString(record.sourceReference)) blockedReasons.push("missing_source_reference");
  if (!isString(record.sourceLicense)) blockedReasons.push("missing_source_license");
  if (record.commercialUseAllowed !== true) blockedReasons.push("commercial_use_not_allowed");
  if (!isString(record.sourceDateOrVersion)) blockedReasons.push("missing_source_date_or_version");
  if (record.cleanRoomSummary !== true) blockedReasons.push("clean_room_summary_not_true");
  if (record.copiedText !== false) blockedReasons.push("copied_text_not_false");
  if (record.runtimeDependency !== false) blockedReasons.push("runtime_dependency_not_false");
  if (record.externalApiRequired !== false) blockedReasons.push("external_api_required_not_false");
  if (record.canOpenVault !== false) blockedReasons.push("can_open_vault_not_false");
  if (record.canConfirmFinal !== false) blockedReasons.push("can_confirm_final_not_false");
  if (
    record.decisionLevel !== "support" &&
    record.decisionLevel !== "advisory" &&
    record.decisionLevel !== "seed_knowledge"
  ) {
    blockedReasons.push("invalid_decision_level");
  }
  if (record.sourceLicense === "unknown") blockedReasons.push("unknown_license_blocked");
  if (
    record.sourceLicense &&
    (LOCAL_SEED_BLOCKED_LICENSES as readonly string[]).includes(record.sourceLicense)
  ) {
    blockedReasons.push("blocked_license");
  }
  if (
    record.sourceLicense &&
    !(LOCAL_SEED_ALLOWED_LICENSES as readonly string[]).includes(record.sourceLicense)
  ) {
    blockedReasons.push("license_not_allowlisted");
  }

  return {
    ok: blockedReasons.length === 0,
    productAllowed: blockedReasons.length === 0,
    blockedReasons,
    safety: learningDnaDecisionSafety(),
  };
}

export function validateLocalSeedKnowledgeLibrary(
  library: Partial<LocalSeedKnowledgeLibrary>,
): LocalSeedKnowledgeValidationResult {
  const blockedReasons: string[] = [];
  if (library.schemaVersion !== LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION) {
    blockedReasons.push("schema_version_mismatch");
  }
  if (library.libraryPurpose !== "seed_knowledge_starting_point_only") {
    blockedReasons.push("library_purpose_not_seed_only");
  }
  if (library.staticMemoryOnly !== false) blockedReasons.push("static_memory_only_not_false");
  if (library.closedLoopLearningContinues !== true) {
    blockedReasons.push("closed_loop_learning_not_true");
  }
  if (library.readOnly !== true) blockedReasons.push("read_only_not_true");
  if (library.externalRuntimeAccess !== false) blockedReasons.push("external_runtime_access_not_false");
  if (library.storesSensitiveContent !== false) blockedReasons.push("stores_sensitive_content_not_false");
  if (library.storesSecrets !== false) blockedReasons.push("stores_secrets_not_false");
  if (library.canOpenVault !== false) blockedReasons.push("can_open_vault_not_false");
  if (library.canConfirmFinal !== false) blockedReasons.push("can_confirm_final_not_false");
  if (library.requiresHumanApprovalForHighRisk !== true) {
    blockedReasons.push("human_approval_not_true");
  }
  if (library.approvalPhrase !== CHIEF_BRAIN_APPROVAL_PHRASE) {
    blockedReasons.push("approval_phrase_mismatch");
  }
  if (!Array.isArray(library.records)) blockedReasons.push("records_not_array");

  const recordResults = (library.records ?? []).map((record) =>
    validateLocalSeedKnowledgeRecord(record),
  );
  for (const result of recordResults) blockedReasons.push(...result.blockedReasons);

  return {
    ok: blockedReasons.length === 0,
    productAllowed: blockedReasons.length === 0,
    blockedReasons,
    safety: learningDnaDecisionSafety(),
  };
}

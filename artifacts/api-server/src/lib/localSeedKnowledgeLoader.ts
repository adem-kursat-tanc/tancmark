import fs from "node:fs";
import path from "node:path";
import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";
import {
  LOCAL_SEED_DNA_NAMES,
  LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION,
  validateLocalSeedKnowledgeLibrary,
  validateLocalSeedKnowledgeRecord,
  type LocalSeedDnaName,
  type LocalSeedKnowledgeLibrary,
  type LocalSeedKnowledgeManifest,
  type LocalSeedKnowledgeManifestEntry,
  type LocalSeedKnowledgeRecord,
} from "./localSeedKnowledgeSchema";

export const LOCAL_SEED_KNOWLEDGE_LOADER_VERSION =
  "local-seed-knowledge-loader-v0.1" as const;

export interface LocalSeedKnowledgeLoadedRecord extends LocalSeedKnowledgeRecord {
  productAllowed: boolean;
  blockedReasons: string[];
}

export interface LocalSeedKnowledgeLoadReport {
  loaderVersion: typeof LOCAL_SEED_KNOWLEDGE_LOADER_VERSION;
  schemaVersion: typeof LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION;
  sourcePath: string;
  manifestPath: string | null;
  generatedAt: string;
  recordCount: number;
  productAllowedCount: number;
  blockedCount: number;
  dnaNamesCovered: LocalSeedDnaName[];
  missingDnaNames: LocalSeedDnaName[];
  records: LocalSeedKnowledgeLoadedRecord[];
  manifestEntries: LocalSeedKnowledgeManifestEntry[];
  readOnly: true;
  staticMemoryOnly: false;
  closedLoopLearningContinues: true;
  externalRuntimeAccess: false;
  externalApiRequired: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canOpenVault: false;
  canConfirmFinal: false;
  productBehaviorChanged: false;
  requiresHumanApprovalForHighRisk: true;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
  note: string;
}

function defaultSeedPath(): string {
  return path.resolve(
    process.cwd(),
    "runtime",
    "validation",
    "local_seed_knowledge",
    "local_seed_knowledge_seed.json",
  );
}

function defaultManifestPath(): string {
  return path.resolve(
    process.cwd(),
    "runtime",
    "validation",
    "local_seed_knowledge",
    "local_seed_knowledge_manifest.json",
  );
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeManifest(manifestPath: string | null): LocalSeedKnowledgeManifestEntry[] {
  if (!manifestPath) return [];
  const manifest = readJsonFile<LocalSeedKnowledgeManifest>(manifestPath);
  if (!Array.isArray(manifest.entries)) return [];
  return manifest.entries;
}

export function loadLocalSeedKnowledgeLibrary(options: {
  seedPath?: string;
  manifestPath?: string | null;
  generatedAt?: string;
} = {}): LocalSeedKnowledgeLoadReport {
  const seedPath = path.resolve(options.seedPath ?? defaultSeedPath());
  const manifestPath =
    options.manifestPath === null ? null : path.resolve(options.manifestPath ?? defaultManifestPath());
  const library = readJsonFile<LocalSeedKnowledgeLibrary>(seedPath);
  const libraryValidation = validateLocalSeedKnowledgeLibrary(library);
  const manifestEntries = normalizeManifest(manifestPath);

  const records = (library.records ?? []).map((record) => {
    const validation = validateLocalSeedKnowledgeRecord(record);
    return {
      ...record,
      productAllowed: validation.productAllowed,
      blockedReasons: validation.blockedReasons,
    };
  });

  const dnaNamesCovered = LOCAL_SEED_DNA_NAMES.filter((dnaName) =>
    records.some((record) => record.dnaName === dnaName && record.productAllowed),
  );
  const missingDnaNames = LOCAL_SEED_DNA_NAMES.filter(
    (dnaName) => !dnaNamesCovered.includes(dnaName),
  );
  const blockedReasons = libraryValidation.blockedReasons;
  const blockedCount = records.filter((record) => !record.productAllowed).length;

  return {
    loaderVersion: LOCAL_SEED_KNOWLEDGE_LOADER_VERSION,
    schemaVersion: LOCAL_SEED_KNOWLEDGE_SCHEMA_VERSION,
    sourcePath: seedPath,
    manifestPath,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    recordCount: records.length,
    productAllowedCount: records.length - blockedCount,
    blockedCount: blockedCount + (blockedReasons.length > 0 ? 1 : 0),
    dnaNamesCovered,
    missingDnaNames,
    records,
    manifestEntries,
    readOnly: true,
    staticMemoryOnly: false,
    closedLoopLearningContinues: true,
    externalRuntimeAccess: false,
    externalApiRequired: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    canOpenVault: false,
    canConfirmFinal: false,
    productBehaviorChanged: false,
    requiresHumanApprovalForHighRisk: true,
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
    note:
      "Local seed knowledge is a read-only starting point for closed-loop DNA learning. It does not execute actions, change product behavior, call external APIs, open VAULT or create final decisions.",
  };
}

export function loadLocalSeedKnowledgeForDna(
  dnaName: LocalSeedDnaName,
  options: {
    seedPath?: string;
    manifestPath?: string | null;
    generatedAt?: string;
  } = {},
): LocalSeedKnowledgeLoadReport {
  const report = loadLocalSeedKnowledgeLibrary(options);
  const records = report.records.filter((record) => record.dnaName === dnaName);

  return {
    ...report,
    recordCount: records.length,
    productAllowedCount: records.filter((record) => record.productAllowed).length,
    blockedCount: records.filter((record) => !record.productAllowed).length,
    dnaNamesCovered: records.some((record) => record.productAllowed) ? [dnaName] : [],
    missingDnaNames: records.some((record) => record.productAllowed) ? [] : [dnaName],
    records,
  };
}

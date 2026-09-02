import { createHash } from "node:crypto";
import {
  TANCMARK_16_DNA_CANONICAL_REGISTRY_V1,
  type CanonicalDnaId,
} from "./canonicalDnaRegistry";

export const RESEARCH_LIBRARY_VERSION = "tancmark-research-library-v1" as const;
export const EXTERNAL_RESEARCH_PROVIDER_STATUS = "EXTERNAL_RESEARCH_PROVIDER_DEFERRED" as const;

export type ResearchReviewState =
  | "ACCEPTED_REVIEWED"
  | "PENDING_HUMAN_REVIEW"
  | "QUARANTINED_UNTRUSTED"
  | "REVOKED";

export interface ResearchLibraryImport {
  researchRecordId: string;
  title: string;
  topic: string;
  targetDnaIds: CanonicalDnaId[];
  publisher: string;
  sourceType: string;
  sourceReference: string;
  retrievedAt: string;
  publishedAt: string;
  sourceVersion: string;
  license: string;
  commercialUseState: "ALLOWED" | "RESTRICTED" | "UNKNOWN";
  trustTier: "OWNER_APPROVED_PRIMARY" | "PRIMARY" | "SECONDARY" | "UNTRUSTED";
  factSummary: string;
  limitations: string[];
  conflictingSources: string[];
  sourceDigest: string;
  importedBy: string;
  reviewedBy: string | null;
  requestedReviewState: Exclude<ResearchReviewState, "QUARANTINED_UNTRUSTED">;
  expiresAt: string | null;
  refreshAfter: string | null;
  revoked?: boolean;
}

export interface ResearchLibraryRecord extends Omit<ResearchLibraryImport, "requestedReviewState"> {
  libraryVersion: typeof RESEARCH_LIBRARY_VERSION;
  reviewState: ResearchReviewState;
  quarantineReasons: string[];
  promptInjectionScan: "CLEAN" | "DETECTED_UNTRUSTED_INSTRUCTION";
  secretScan: "CLEAN" | "SECRET_LIKE_DATA_DETECTED";
  personalDataScan: "CLEAN" | "PERSONAL_DATA_DETECTED";
  stale: boolean;
  conflictDetected: boolean;
  canFeedDnaLearning: boolean;
  canExecuteSourceInstructions: false;
  externalProviderCalled: false;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PROMPT_INJECTION = /(?:ignore (?:all |the )?previous|forget (?:all |the )?previous|system prompt|developer message|owner approval|APPROVE_CHIEF_BRAIN_SAFE_ACTION|run this command|execute this instruction)/i;
const SECRET_LIKE = /(?:-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+)/i;
const PERSONAL_DATA_LIKE = /(?:\b\d{11}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
const ACTIVE_CONTENT = /(?:<script\b|javascript:|onerror\s*=|onload\s*=)/i;
const PRIVATE_PATH = /(?:[a-z]:\\|\\users\\|\/users\/|\/home\/|\b(?:symlink|junction|reparse-point)\b)/i;

function scanTexts(input: ResearchLibraryImport): string {
  return [
    input.title,
    input.topic,
    input.publisher,
    input.sourceType,
    input.sourceReference,
    input.sourceVersion,
    input.license,
    input.factSummary,
    ...input.limitations,
    ...input.conflictingSources,
  ].join("\n");
}

export function buildSourceDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function importResearchLibraryRecord(
  input: ResearchLibraryImport,
  now = new Date(),
): ResearchLibraryRecord {
  const reasons: string[] = [];
  const combined = scanTexts(input);
  const promptInjectionScan = PROMPT_INJECTION.test(combined)
    ? "DETECTED_UNTRUSTED_INSTRUCTION" as const
    : "CLEAN" as const;
  const secretScan = SECRET_LIKE.test(combined)
    ? "SECRET_LIKE_DATA_DETECTED" as const
    : "CLEAN" as const;
  const personalDataScan = PERSONAL_DATA_LIKE.test(combined)
    ? "PERSONAL_DATA_DETECTED" as const
    : "CLEAN" as const;

  if (!input.researchRecordId.trim() || !input.title.trim() || !input.topic.trim()) reasons.push("MISSING_ID_TITLE_OR_TOPIC");
  if (!input.publisher.trim() || !input.sourceType.trim() || !input.sourceReference.trim()) reasons.push("MISSING_PROVENANCE");
  if (!ISO_DATE.test(input.retrievedAt) || !ISO_DATE.test(input.publishedAt)) reasons.push("INVALID_SOURCE_DATE");
  if (!input.sourceVersion.trim()) reasons.push("MISSING_SOURCE_VERSION");
  if (!input.license.trim() || input.commercialUseState === "UNKNOWN") reasons.push("UNKNOWN_LICENSE_OR_COMMERCIAL_USE");
  if (!SHA256.test(input.sourceDigest)) reasons.push("INVALID_SOURCE_DIGEST");
  if (input.targetDnaIds.length === 0) reasons.push("MISSING_TARGET_DNA");
  const registered = new Set(TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.map((entry) => entry.canonicalId));
  if (input.targetDnaIds.some((id) => !registered.has(id))) reasons.push("UNAUTHORIZED_DNA_ROUTE");
  if (new Set(input.targetDnaIds).size !== input.targetDnaIds.length) reasons.push("DUPLICATE_DNA_ROUTE");
  if (input.trustTier === "UNTRUSTED") reasons.push("UNTRUSTED_SOURCE_TIER");
  if (promptInjectionScan !== "CLEAN") reasons.push("PROMPT_INJECTION_DETECTED");
  if (secretScan !== "CLEAN") reasons.push("SECRET_LIKE_DATA_DETECTED");
  if (personalDataScan !== "CLEAN") reasons.push("PERSONAL_DATA_DETECTED");
  if (ACTIVE_CONTENT.test(combined)) reasons.push("ACTIVE_CONTENT_DETECTED");
  if (PRIVATE_PATH.test(combined)) reasons.push("PRIVATE_PATH_OR_REPARSE_POINT_DETECTED");
  if (combined.includes("../") || combined.includes("..\\")) reasons.push("PATH_TRAVERSAL_DETECTED");
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > 128 * 1024) reasons.push("RESEARCH_RECORD_TOO_LARGE");

  const published = Date.parse(input.publishedAt);
  if (Number.isFinite(published) && published > now.getTime() + 24 * 60 * 60 * 1000) reasons.push("FUTURE_SOURCE_DATE");
  const expiry = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  const refresh = input.refreshAfter ? Date.parse(input.refreshAfter) : Number.NaN;
  const stale = (Number.isFinite(expiry) && expiry <= now.getTime()) ||
    (Number.isFinite(refresh) && refresh <= now.getTime());
  if (stale) reasons.push("STALE_SOURCE");
  if (input.revoked) reasons.push("REVOKED_SOURCE");
  if (input.conflictingSources.length > 0) reasons.push("CONFLICTING_SOURCES_REQUIRE_REVIEW");

  let reviewState: ResearchReviewState = input.requestedReviewState;
  if (input.revoked) reviewState = "REVOKED";
  else if (reasons.length > 0) reviewState = "QUARANTINED_UNTRUSTED";
  else if (!input.reviewedBy) reviewState = "PENDING_HUMAN_REVIEW";

  return {
    ...input,
    libraryVersion: RESEARCH_LIBRARY_VERSION,
    reviewState,
    quarantineReasons: reasons,
    promptInjectionScan,
    secretScan,
    personalDataScan,
    stale,
    conflictDetected: input.conflictingSources.length > 0,
    canFeedDnaLearning: reviewState === "ACCEPTED_REVIEWED" && !stale,
    canExecuteSourceInstructions: false,
    externalProviderCalled: false,
  };
}

export class ResearchLibrary {
  #records = new Map<string, ResearchLibraryRecord>();
  #digests = new Set<string>();

  import(input: ResearchLibraryImport, now = new Date()): ResearchLibraryRecord {
    const existing = this.#records.get(input.researchRecordId);
    if (existing) return existing;
    const record = importResearchLibraryRecord(input, now);
    if (this.#digests.has(record.sourceDigest)) {
      return { ...record, reviewState: "QUARANTINED_UNTRUSTED", canFeedDnaLearning: false, quarantineReasons: [...record.quarantineReasons, "REPLAYED_SOURCE_DIGEST"] };
    }
    this.#records.set(record.researchRecordId, record);
    this.#digests.add(record.sourceDigest);
    return record;
  }

  acceptedForDna(dnaId: CanonicalDnaId): ResearchLibraryRecord[] {
    return Array.from(this.#records.values()).filter(
      (record) => record.canFeedDnaLearning && record.targetDnaIds.includes(dnaId),
    );
  }

  quarantined(): ResearchLibraryRecord[] {
    return Array.from(this.#records.values()).filter(
      (record) => record.reviewState === "QUARANTINED_UNTRUSTED" || record.reviewState === "REVOKED",
    );
  }
}

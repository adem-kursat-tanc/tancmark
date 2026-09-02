import {
  buildLearningDnaRegistry,
  type LearningDnaRegistry,
} from "./learningDnaRegistry";
import type {
  LearningDnaEventInput,
  LearningDnaEventResult,
  LearningDnaEventType,
  LearningDnaInputType,
  LearningDnaModule,
  LearningDnaReadinessState,
  LearningDnaRiskLevel,
} from "./learningDnaEventSchema";

export const LEARNING_DNA_UNIVERSAL_SIGNAL_ADAPTERS_VERSION =
  "learning-dna-universal-signal-adapters-v0.1" as const;

export type LearningDnaUniversalDomainKey =
  | "content_formats"
  | "format_internal_layers"
  | "watermark_seal_read_recovery"
  | "user_system"
  | "auth_security"
  | "subscription_finance"
  | "tanclive"
  | "discovery_web_search"
  | "secure_room_poison"
  | "evidence"
  | "license_product_gates"
  | "security"
  | "saas_operations"
  | "product_marketing_launch";

export interface LearningDnaUniversalCoverageEntry {
  domainKey: LearningDnaUniversalDomainKey;
  label: string;
  coveredSignals: string[];
  sourceHints: string[];
  registryModule: LearningDnaModule;
  defaultEventType: LearningDnaEventType;
  defaultInputType: LearningDnaInputType;
  coverageState: "code_adapter" | "documented_adapter" | "debt_tracked";
  codeConnection: "existing_signal_adapter" | "universal_summary_adapter" | "deferred_source_only";
  supportOnly: true;
  safeSummaryOnly: true;
  storesSensitiveContent: false;
  storesSecrets: false;
  storesPaymentCardData: false;
  storesRawCustomerDocument: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
}

export interface UniversalDnaSafeSignalInput {
  signalId: string;
  domainKey: LearningDnaUniversalDomainKey;
  eventType?: LearningDnaEventType;
  module?: LearningDnaModule;
  inputType?: LearningDnaInputType;
  timestamp?: string | null;
  result?: LearningDnaEventResult;
  confidence?: number;
  supportScore?: number;
  riskLevel?: LearningDnaRiskLevel;
  readinessState?: LearningDnaReadinessState;
  method?: string | null;
  safeSummary?: string | null;
  nextSuggestedAction?: string | null;
  relatedDebtId?: string | null;
  relatedCheckpoint?: string | null;
}

const FORBIDDEN_DNA_PAYLOAD_FIELDS = [
  "password",
  "passcode",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "card",
  "cvv",
  "iban",
  "rawText",
  "rawContent",
  "fileContent",
  "documentContent",
  "customerDocument",
  "paymentCard",
] as const;

function entry(
  domainKey: LearningDnaUniversalDomainKey,
  label: string,
  coveredSignals: string[],
  sourceHints: string[],
  registryModule: LearningDnaModule,
  defaultEventType: LearningDnaEventType,
  defaultInputType: LearningDnaInputType,
  coverageState: LearningDnaUniversalCoverageEntry["coverageState"] = "documented_adapter",
  codeConnection: LearningDnaUniversalCoverageEntry["codeConnection"] = "universal_summary_adapter",
): LearningDnaUniversalCoverageEntry {
  return {
    domainKey,
    label,
    coveredSignals,
    sourceHints,
    registryModule,
    defaultEventType,
    defaultInputType,
    coverageState,
    codeConnection,
    supportOnly: true,
    safeSummaryOnly: true,
    storesSensitiveContent: false,
    storesSecrets: false,
    storesPaymentCardData: false,
    storesRawCustomerDocument: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
  };
}

export const LEARNING_DNA_UNIVERSAL_COVERAGE_MAP: readonly LearningDnaUniversalCoverageEntry[] = [
  entry(
    "content_formats",
    "Content and format signals",
    [
      "text",
      "TXT",
      "PDF",
      "DOCX",
      "HTML",
      "EPUB",
      "PPTX",
      "XLSX",
      "SVG/XML",
      "images",
      "video",
      "audio",
      "RAW/HEIC/CDR/INDD special paths",
      "metadata",
      "recovery results",
      "test results",
    ],
    [
      "artifacts/api-server/src/dna/*LearningAdapter.ts",
      "docs/TANCMARK_UNIVERSAL_FORMAT_SEAL_ROADMAP.md",
      "runtime/validation/*format*",
    ],
    "format_layers",
    "format_test_result",
    "format_layer",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "format_internal_layers",
    "Invisible seal and inner-layer signals",
    [
      "metadata",
      "invisible seal layers",
      "layer signal strength",
      "placement advisory",
      "natural marker support",
      "product-ready/support-only/lab-only state",
    ],
    [
      "artifacts/api-server/src/dna/dnaLayerSignalBridge.ts",
      "artifacts/api-server/src/dna/dnaThreeTaskLearningBridge.ts",
    ],
    "watermark",
    "recommendation_signal",
    "format_layer",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "watermark_seal_read_recovery",
    "Seal/read/recovery safety signals",
    [
      "seal attempt",
      "read attempt",
      "recovery attempt",
      "wrong ID",
      "no ID",
      "candidate/support",
      "method strength",
      "method weakness",
    ],
    ["artifacts/api-server/src/dna", "lib/aegis-core/src"],
    "watermark",
    "read_attempt",
    "unknown",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "user_system",
    "User and account signals",
    [
      "membership created",
      "login attempt",
      "failed login",
      "session started",
      "session ended",
      "role/permission",
      "abuse signal",
      "account limit",
    ],
    ["artifacts/api-server/src/middlewares", "artifacts/api-server/src/routes", "lib/api-client-react/src"],
    "user_account",
    "user_signal",
    "user",
  ),
  entry(
    "auth_security",
    "Auth and admin security signals",
    [
      "API key use",
      "admin action",
      "unauthorized access",
      "rate limit",
      "audit log",
      "suspicious traffic",
      "security debt",
    ],
    ["artifacts/api-server/src/middlewares", "artifacts/api-server/src/routes/audit.ts", "docs/*SECURITY*"],
    "auth",
    "auth_signal",
    "auth",
  ),
  entry(
    "subscription_finance",
    "Subscription, payment and finance signals",
    [
      "package type",
      "usage limit",
      "credit usage",
      "cost signal",
      "profit/loss signal",
      "subscription state",
      "payment succeeded",
      "payment failed",
      "invoice state",
      "expensive operation warning",
      "pricing learning",
      "cost/margin learning",
    ],
    [
      "artifacts/api-server/src/discovery/discoveryPricingLearning.ts",
      "artifacts/api-server/src/discovery/discoveryCostCalibration.ts",
      "docs/TANCMARK_DEFERRED_WORK_LEDGER.md",
    ],
    "finance",
    "finance_cost_signal",
    "finance",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "tanclive",
    "TancLive and live operation signals",
    [
      "stream started",
      "stream ended",
      "disconnect",
      "delay",
      "platform",
      "MediaMTX state",
      "FFmpeg lab-only state",
      "HLS/VOD",
      "post-live ID read",
      "post-live evidence",
      "multi-stream",
      "bandwidth/cost",
      "CPU/RAM",
      "real platform test debt",
    ],
    ["artifacts/api-server/src/live", "runtime/validation/live_*", "docs/TANCMARK_SYSTEM_MEMORY.md"],
    "live_tanclive",
    "live_signal",
    "live_stream",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "discovery_web_search",
    "Discovery and Web Search signals",
    [
      "search executed",
      "source type",
      "result exists",
      "candidate result",
      "support evidence",
      "real API pilot debt",
      "API cost signal",
    ],
    ["artifacts/api-server/src/discovery", "artifacts/api-server/src/workers/discoveryWorker.ts"],
    "discovery_search",
    "discovery_signal",
    "search_result",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "secure_room_poison",
    "Secure Room and poison evidence signals",
    [
      "file viewed",
      "copy viewed",
      "session started",
      "session ended",
      "screen recording candidate",
      "suspicious behavior",
      "evidence support",
      "not final decision",
    ],
    ["artifacts/api-server/src/lib/*secureRoom*", "docs/TANCMARK_FULL_MASTER_PLAN_AND_CHIEF_BRAIN_AUDIT.md"],
    "secure_room",
    "secure_room_signal",
    "secure_room",
  ),
  entry(
    "evidence",
    "Evidence and proof package signals",
    [
      "PDF evidence report",
      "hash",
      "timestamp",
      "C2PA",
      "OpenTimestamps",
      "blockchain support",
      "evidence package",
      "support level",
      "missing evidence debt",
    ],
    ["artifacts/api-server/src/lib/*Evidence*", "runtime/validation/*evidence*", "docs/*EVIDENCE*"],
    "evidence",
    "evidence_signal",
    "evidence",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "license_product_gates",
    "License, model, font and product package gate signals",
    [
      "blocked tool detected",
      "clean product package state",
      "NOTICE/SBOM state",
      "FFmpeg lab-only state",
      "MediaMTX MIT notice",
      "sharp/libvips gate",
      "Tesseract language state",
      "model/font/asset manifest state",
    ],
    ["runtime/validation/*license*", "docs/*LICENSE*", "docs/*SBOM*"],
    "license_product_gate",
    "license_gate_signal",
    "license",
    "code_adapter",
    "existing_signal_adapter",
  ),
  entry(
    "security",
    "Security and abuse signals",
    [
      "rate limit",
      "audit log",
      "unauthorized access",
      "file access",
      "API key use",
      "admin operation",
      "suspicious traffic",
      "security debt",
    ],
    ["artifacts/api-server/src/middlewares", "runtime/validation/*security*", "docs/*SECURITY*"],
    "security",
    "security_signal",
    "security",
  ),
  entry(
    "saas_operations",
    "SaaS and product operation signals",
    [
      "dashboard",
      "admin panel",
      "API key",
      "storage/vault",
      "file upload",
      "job queue",
      "error log",
      "system performance",
      "deploy",
      "monitoring",
      "rollback need",
    ],
    ["artifacts/dashboard-ui", "artifacts/api-server/src/routes", "docs/PROJECT_REPORT.md"],
    "saas_operation",
    "storage_signal",
    "saas_operation",
  ),
  entry(
    "product_marketing_launch",
    "Product, marketing, legal and launch signals",
    [
      "Creator App state",
      "TancLive product state",
      "landing page",
      "demo video",
      "pricing package",
      "beta customer",
      "legal text",
      "sales document",
      "launch debt",
    ],
    ["docs/TANCMARK_FULL_MASTER_PLAN_AND_CHIEF_BRAIN_AUDIT.md", "docs/TANCMARK_DEFERRED_WORK_LEDGER.md"],
    "launch",
    "launch_signal",
    "launch",
    "debt_tracked",
    "deferred_source_only",
  ),
] as const;

function findCoverage(domainKey: LearningDnaUniversalDomainKey): LearningDnaUniversalCoverageEntry {
  const coverage = LEARNING_DNA_UNIVERSAL_COVERAGE_MAP.find((item) => item.domainKey === domainKey);
  if (!coverage) throw new Error(`unknown universal DNA domain: ${domainKey}`);
  return coverage;
}

function clampScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function cleanOptionalText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanTimestamp(value: string | null | undefined): string | undefined {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  return undefined;
}

function containsForbiddenField(input: Record<string, unknown>): string | null {
  const loweredKeys = Object.keys(input).map((key) => key.toLowerCase());
  for (const forbidden of FORBIDDEN_DNA_PAYLOAD_FIELDS) {
    const needle = forbidden.toLowerCase();
    if (loweredKeys.some((key) => key.includes(needle))) return forbidden;
  }
  return null;
}

export function assertUniversalDnaSignalIsSafe(input: Record<string, unknown>): void {
  const forbiddenField = containsForbiddenField(input);
  if (forbiddenField) {
    throw new Error(`unsafe universal DNA signal rejected: forbidden field ${forbiddenField}`);
  }
}

export function universalSignalToDnaEvent(input: UniversalDnaSafeSignalInput): LearningDnaEventInput {
  assertUniversalDnaSignalIsSafe(input as unknown as Record<string, unknown>);
  const coverage = findCoverage(input.domainKey);
  const riskLevel = input.riskLevel ?? "low";
  return {
    eventId: `universal-${input.domainKey}-${input.signalId}`,
    module: input.module ?? coverage.registryModule,
    eventType: input.eventType ?? coverage.defaultEventType,
    timestamp: cleanTimestamp(input.timestamp),
    inputType: input.inputType ?? coverage.defaultInputType,
    result: input.result ?? "pending",
    confidence: clampScore(input.confidence, riskLevel === "high" ? 0.35 : 0.5),
    supportScore: clampScore(input.supportScore, riskLevel === "high" ? 0.4 : 0.55),
    decisionLevel: riskLevel === "high" ? "recommendation" : "support",
    method: cleanOptionalText(input.method, 160) ?? coverage.domainKey,
    supportLevel: riskLevel === "high" ? "recommendation-only" : "support-only",
    riskLevel,
    readinessState: input.readinessState ?? "support-only",
    nextSuggestedAction:
      cleanOptionalText(input.nextSuggestedAction) ??
      "Keep this universal DNA signal as a safe summary only; do not change product behavior.",
    relatedDebtId: cleanOptionalText(input.relatedDebtId, 160),
    relatedCheckpoint: cleanOptionalText(input.relatedCheckpoint, 160),
    note:
      cleanOptionalText(input.safeSummary) ??
      `${coverage.label}; safe summary only; no customer content, secret, token, payment card or raw document stored.`,
  };
}

export function universalSignalsToDnaEvents(
  signals: readonly UniversalDnaSafeSignalInput[],
): LearningDnaEventInput[] {
  return signals.map(universalSignalToDnaEvent);
}

export function buildUniversalLearningDnaCoverageEvents(): LearningDnaEventInput[] {
  return LEARNING_DNA_UNIVERSAL_COVERAGE_MAP.map((coverage) =>
    universalSignalToDnaEvent({
      signalId: "coverage-map",
      domainKey: coverage.domainKey,
      eventType: coverage.defaultEventType,
      module: coverage.registryModule,
      inputType: coverage.defaultInputType,
      result: coverage.coverageState === "debt_tracked" ? "pending" : "success",
      riskLevel: coverage.coverageState === "debt_tracked" ? "medium" : "low",
      method: coverage.codeConnection,
      safeSummary: `${coverage.label}: ${coverage.coveredSignals.join(", ")}`,
      nextSuggestedAction:
        coverage.coverageState === "debt_tracked"
          ? "Keep as launch debt until human-approved product work begins."
          : "Use as support-only coverage signal in Chief Brain dry-run reports.",
      relatedCheckpoint: LEARNING_DNA_UNIVERSAL_SIGNAL_ADAPTERS_VERSION,
    }),
  );
}

export function buildUniversalLearningDnaRegistry(
  signals: readonly UniversalDnaSafeSignalInput[] = [],
): LearningDnaRegistry {
  return buildLearningDnaRegistry([
    ...buildUniversalLearningDnaCoverageEvents(),
    ...universalSignalsToDnaEvents(signals),
  ]);
}

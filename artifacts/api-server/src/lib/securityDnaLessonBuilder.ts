import {
  createSecurityDnaLesson,
  validateSecurityDnaLesson,
  type SecurityDnaLesson,
  type SecurityDnaLessonSignalType,
} from "./securityDnaLessonSchema";
import type { LearningDnaRiskLevel } from "./learningDnaEventSchema";

export const SECURITY_DNA_LESSON_BUILDER_VERSION =
  "security-dna-lesson-builder-v0.1" as const;
export const SUPPORTED_SECURITY_DNA_LESSON_SIGNALS = [
  "failed_login",
  "suspicious_login_pattern",
  "api_key_risk",
  "rate_limit_signal",
  "audit_log_gap",
  "admin_action_risk",
  "file_access_risk",
  "abuse_candidate",
  "security_contract_result",
  "sensitive_data_gate",
  "security_debt",
] as const;

export interface SecurityDnaRawSignal {
  signalType: SecurityDnaLessonSignalType;
  summary: string;
  count?: number;
  riskLevel?: LearningDnaRiskLevel;
  workedControl?: string;
  failedControl?: string;
  missingProtection?: string;
  relatedDebtId?: string;
}

export interface SecurityDnaLessonBuilderInput {
  lessonDate?: string;
  relatedModule?: string;
  signals?: readonly SecurityDnaRawSignal[];
  securityDebtNotes?: readonly string[];
  contractResults?: readonly { name: string; passed: boolean; detail?: string }[];
}

export interface SecurityDnaLessonBuildReport {
  builderVersion: typeof SECURITY_DNA_LESSON_BUILDER_VERSION;
  generatedAt: string;
  lesson: SecurityDnaLesson;
  signalCount: number;
  highRiskSignalCount: number;
  contractResultCount: number;
  failedContractCount: number;
  readOnly: true;
  filesWritten: 0;
  usersBlocked: 0;
  ipBansApplied: 0;
  adminRolesChanged: 0;
  subscriptionsChanged: 0;
  paymentStateChanged: 0;
  productBehaviorChanged: false;
  externalRuntimeAccess: false;
  runtimeInternetDependency: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  validationOk: boolean;
  blockedReasons: string[];
  note: string;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).slice(0, 12);
}

function riskRank(risk: LearningDnaRiskLevel): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

function highestRisk(signals: readonly SecurityDnaRawSignal[]): LearningDnaRiskLevel {
  const risks = signals.map((signal) => signal.riskLevel ?? "medium");
  return risks.sort((left, right) => riskRank(right) - riskRank(left))[0] ?? "medium";
}

function mostImportantSignalType(signals: readonly SecurityDnaRawSignal[]): SecurityDnaLessonSignalType {
  const high = signals.find((signal) => signal.riskLevel === "high");
  return high?.signalType ?? signals[0]?.signalType ?? "security_debt";
}

function defaultSignals(): SecurityDnaRawSignal[] {
  return [
    {
      signalType: "audit_log_gap",
      summary: "Audit log identity and durable storage gaps can weaken incident evidence.",
      riskLevel: "high",
      workedControl: "Security contract gates keep audit issues visible.",
      failedControl: "In-memory or spoofable audit fields are not enough for launch confidence.",
      missingProtection: "Verified actor identity and persistent audit storage.",
      relatedDebtId: "SECURITY-AUDIT-DURABLE-STORE",
    },
    {
      signalType: "rate_limit_signal",
      summary: "Rate-limit signals must be shared across production instances before launch.",
      riskLevel: "medium",
      workedControl: "Local rate-limit checks catch abuse shape early.",
      failedControl: "Single-process limits can be bypassed in autoscale.",
      missingProtection: "Shared production rate-limit store.",
      relatedDebtId: "SECURITY-RATE-LIMIT-SHARED",
    },
  ];
}

function contractLessons(
  contractResults: readonly { name: string; passed: boolean; detail?: string }[],
): string[] {
  if (contractResults.length === 0) {
    return ["Security lesson contract should be run before checkpoint."];
  }
  return contractResults.map((result) =>
    result.passed
      ? `${result.name} passed and should remain part of the security close-out gate.`
      : `${result.name} failed or was blocked: ${result.detail ?? "no detail"}`,
  );
}

export function buildSecurityDnaLesson(
  input: SecurityDnaLessonBuilderInput = {},
): SecurityDnaLessonBuildReport {
  const signals = input.signals?.length ? [...input.signals] : defaultSignals();
  const contractResults = [...(input.contractResults ?? [])];
  const failedContracts = contractResults.filter((result) => !result.passed);
  const highRiskSignals = signals.filter((signal) => signal.riskLevel === "high");
  const observedRisk = unique(signals.map((signal) => signal.summary)).join(" ");
  const whatWorked = unique([
    ...signals.map((signal) => signal.workedControl ?? ""),
    ...contractLessons(contractResults).filter((text) => text.includes("passed")),
    "Security DNA keeps signals advisory-only and does not punish users automatically.",
  ]);
  const whatFailed = unique([
    ...signals.map((signal) => signal.failedControl ?? ""),
    ...failedContracts.map((result) => `${result.name}: ${result.detail ?? "failed"}`),
  ]);
  const missingProtection = unique([
    ...signals.map((signal) => signal.missingProtection ?? ""),
    ...(input.securityDebtNotes ?? []),
  ]);

  const lesson = createSecurityDnaLesson({
    lessonId: `security-dna-lesson-${input.lessonDate ?? new Date().toISOString().slice(0, 10)}`,
    lessonDate: input.lessonDate,
    relatedModule: input.relatedModule ?? "Security DNA",
    securitySignalType: mostImportantSignalType(signals),
    observedRisk,
    whatWorked,
    whatFailed: whatFailed.length > 0 ? whatFailed : [
      "No failing control was supplied; keep monitoring audit, rate-limit, API key and admin risk.",
    ],
    repeatedRisk: [
      "Failed login, suspicious login, API key misuse and rate-limit bypass are security signals, not automatic punishment triggers.",
      "Admin and file-access events need audit evidence before any response is approved.",
      "Security recommendations must never store secrets, tokens, passwords, card data or customer content.",
    ],
    missingProtection: missingProtection.length > 0 ? missingProtection : [
      "Persistent audit, shared rate-limit and verified actor identity should stay on the security backlog.",
    ],
    suggestedSecurityAction: [
      "Create a support-only security recommendation.",
      "Require human approval before any ban, account action, role change or payment/subscription action.",
      "Run the security lesson contract before checkpoint.",
    ],
    riskLevel: highestRisk(signals),
    requiresHumanApproval: highRiskSignals.length > 0 || failedContracts.length > 0,
  });
  const validation = validateSecurityDnaLesson(lesson);

  return {
    builderVersion: SECURITY_DNA_LESSON_BUILDER_VERSION,
    generatedAt: new Date().toISOString(),
    lesson,
    signalCount: signals.length,
    highRiskSignalCount: highRiskSignals.length,
    contractResultCount: contractResults.length,
    failedContractCount: failedContracts.length,
    readOnly: true,
    filesWritten: 0,
    usersBlocked: 0,
    ipBansApplied: 0,
    adminRolesChanged: 0,
    subscriptionsChanged: 0,
    paymentStateChanged: 0,
    productBehaviorChanged: false,
    externalRuntimeAccess: false,
    runtimeInternetDependency: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    validationOk: validation.ok,
    blockedReasons: validation.blockedReasons,
    note:
      "Security DNA lesson builder summarizes local security signals only. It does not block users, ban IPs, change admin roles, change subscriptions, change payment state, call external APIs, write files, change product behavior, open VAULT or create final decisions.",
  };
}

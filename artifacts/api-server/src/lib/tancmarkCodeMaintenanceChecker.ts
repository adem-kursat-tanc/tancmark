import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
  type LearningDnaRiskLevel,
} from "./learningDnaEventSchema";

export const TANCMARK_CODE_MAINTENANCE_CHECKER_VERSION =
  "tancmark-code-maintenance-checker-v0.1" as const;
export const TANCMARK_CODE_MAINTENANCE_APPROVAL_PHRASE =
  "APPROVE_CHIEF_BRAIN_SAFE_ACTION" as const;

export type TancmarkMaintenanceFindingType =
  | "repeated_code"
  | "unused_file"
  | "stale_test"
  | "missing_contract"
  | "missing_report"
  | "risky_file_change"
  | "typecheck_or_test_break"
  | "document_mismatch"
  | "license_gate_warning"
  | "security_warning"
  | "slow_area";

export interface TancmarkMaintenanceInputSignal {
  type: TancmarkMaintenanceFindingType;
  fileOrModule: string;
  summary: string;
  riskLevel?: LearningDnaRiskLevel;
  productChanging?: boolean;
  requiresHumanApproval?: boolean;
}

export interface TancmarkMaintenanceFinding {
  type: TancmarkMaintenanceFindingType;
  fileOrModule: string;
  summary: string;
  riskLevel: LearningDnaRiskLevel;
  automaticReportOnly: true;
  suggestedAction: string;
  requiresHumanApproval: boolean;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  canAutoModifyCode: false;
  canModifyProduct: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
}

export interface TancmarkMaintenanceCheckReport {
  checkerVersion: typeof TANCMARK_CODE_MAINTENANCE_CHECKER_VERSION;
  generatedAt: string;
  checkedAreas: string[];
  findings: TancmarkMaintenanceFinding[];
  automaticFindingCount: number;
  humanApprovalFindingCount: number;
  riskyFindingCount: number;
  canAutoModifyCode: false;
  canModifyProduct: false;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeThreshold: false;
  canChangeOwnership: false;
  storesSensitiveContent: false;
  storesSecrets: false;
  runtimeExternalApiDependency: false;
  runtimeInternetDependency: false;
  productBehaviorChanged: false;
  approvalPhrase: typeof CHIEF_BRAIN_APPROVAL_PHRASE;
  safety: LearningDnaDecisionSafety;
}

function riskLevel(value: LearningDnaRiskLevel | undefined): LearningDnaRiskLevel {
  return value ?? "medium";
}

function actionFor(type: TancmarkMaintenanceFindingType): string {
  switch (type) {
    case "repeated_code":
      return "Tekrar eden kodu raporla; birleştirme icin insan onayli ayri is ac.";
    case "unused_file":
      return "Kullanilmayan dosyayi raporla; silme veya tasima icin insan onayi iste.";
    case "stale_test":
      return "Eski testi raporla; guncelleme icin ayri onayli bakim oner.";
    case "missing_contract":
      return "Eksik contract icin onayli gorev taslagi hazirla.";
    case "missing_report":
      return "Eksik raporu listele ve rapor borcu olarak isaretle.";
    case "risky_file_change":
      return "Riskli dosya degisimini onay bekliyor durumuna al.";
    case "typecheck_or_test_break":
      return "Kirik typecheck/test sonucunu sade Turkce raporla.";
    case "document_mismatch":
      return "Dokuman uyusmazligini raporla ve duzeltme icin onay iste.";
    case "license_gate_warning":
      return "Lisans kapisi uyarisini borc listesine ekle; product gate degistirme.";
    case "security_warning":
      return "Guvenlik uyarisi raporla; kural degisikligi icin onay iste.";
    case "slow_area":
      return "Yavas alani isaretle; performans degisikligi icin onay iste.";
  }
}

function needsApproval(signal: TancmarkMaintenanceInputSignal): boolean {
  return (
    signal.requiresHumanApproval === true ||
    signal.productChanging === true ||
    signal.riskLevel === "high" ||
    signal.type === "risky_file_change" ||
    signal.type === "security_warning" ||
    signal.type === "license_gate_warning"
  );
}

export function buildTancmarkMaintenanceFinding(
  signal: TancmarkMaintenanceInputSignal,
): TancmarkMaintenanceFinding {
  const risk = riskLevel(signal.riskLevel);

  return {
    type: signal.type,
    fileOrModule: signal.fileOrModule,
    summary: signal.summary,
    riskLevel: risk,
    automaticReportOnly: true,
    suggestedAction: actionFor(signal.type),
    requiresHumanApproval: needsApproval({ ...signal, riskLevel: risk }),
    approvalPhrase: TANCMARK_CODE_MAINTENANCE_APPROVAL_PHRASE,
    canAutoModifyCode: false,
    canModifyProduct: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
  };
}

export function runTancmarkCodeMaintenanceCheck(input: {
  signals?: readonly TancmarkMaintenanceInputSignal[];
  generatedAt?: string;
} = {}): TancmarkMaintenanceCheckReport {
  const signals = input.signals ?? [];
  const findings = signals.map((signal) => buildTancmarkMaintenanceFinding(signal));

  return {
    checkerVersion: TANCMARK_CODE_MAINTENANCE_CHECKER_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    checkedAreas: [
      "tekrar eden kod",
      "kullanilmayan dosya",
      "eski test",
      "eksik contract",
      "eksik rapor",
      "riskli dosya degisimi",
      "typecheck/test kirigi",
      "dokuman uyusmazligi",
    ],
    findings,
    automaticFindingCount: findings.filter((finding) => !finding.requiresHumanApproval).length,
    humanApprovalFindingCount: findings.filter((finding) => finding.requiresHumanApproval).length,
    riskyFindingCount: findings.filter((finding) => finding.riskLevel === "high").length,
    canAutoModifyCode: false,
    canModifyProduct: false,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeThreshold: false,
    canChangeOwnership: false,
    storesSensitiveContent: false,
    storesSecrets: false,
    runtimeExternalApiDependency: false,
    runtimeInternetDependency: false,
    productBehaviorChanged: false,
    approvalPhrase: TANCMARK_CODE_MAINTENANCE_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}

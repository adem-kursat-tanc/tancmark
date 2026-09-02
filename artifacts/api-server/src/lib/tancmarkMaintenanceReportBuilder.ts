import {
  CHIEF_BRAIN_APPROVAL_PHRASE,
  learningDnaDecisionSafety,
  type LearningDnaDecisionSafety,
} from "./learningDnaEventSchema";
import {
  runTancmarkCodeMaintenanceCheck,
  type TancmarkMaintenanceCheckReport,
  type TancmarkMaintenanceInputSignal,
} from "./tancmarkCodeMaintenanceChecker";

export const TANCMARK_MAINTENANCE_REPORT_BUILDER_VERSION =
  "tancmark-maintenance-report-builder-v0.1" as const;

export interface TancmarkPlainTurkishMaintenanceReport {
  builderVersion: typeof TANCMARK_MAINTENANCE_REPORT_BUILDER_VERSION;
  generatedAt: string;
  sourceCheck: TancmarkMaintenanceCheckReport;
  reportLanguage: "plain_turkish";
  neKontrolEdildi: string[];
  neSaglam: string[];
  neBozuk: string[];
  neRiskli: string[];
  neOtomatikDuzeltilebilir: string[];
  neInsanOnayiIster: string[];
  siradakiBakimOnerisi: string;
  technicalTermExplanation: string;
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

export function buildTancmarkMaintenanceReport(input: {
  checkReport?: TancmarkMaintenanceCheckReport;
  signals?: readonly TancmarkMaintenanceInputSignal[];
  generatedAt?: string;
} = {}): TancmarkPlainTurkishMaintenanceReport {
  const sourceCheck =
    input.checkReport ??
    runTancmarkCodeMaintenanceCheck({
      signals: input.signals,
      generatedAt: input.generatedAt,
    });
  const automatic = sourceCheck.findings.filter((finding) => !finding.requiresHumanApproval);
  const approval = sourceCheck.findings.filter((finding) => finding.requiresHumanApproval);
  const broken = sourceCheck.findings.filter(
    (finding) => finding.type === "typecheck_or_test_break" || finding.type === "stale_test",
  );
  const risky = sourceCheck.findings.filter((finding) => finding.riskLevel === "high");

  return {
    builderVersion: TANCMARK_MAINTENANCE_REPORT_BUILDER_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceCheck,
    reportLanguage: "plain_turkish",
    neKontrolEdildi: sourceCheck.checkedAreas,
    neSaglam:
      sourceCheck.findings.length === 0
        ? ["Bu kontrolde acik bulgu yok."]
        : ["Kontrol raporu uretildi; otomatik kod degisikligi yapilmadi."],
    neBozuk: broken.map((finding) => `${finding.fileOrModule}: ${finding.summary}`),
    neRiskli: risky.map((finding) => `${finding.fileOrModule}: ${finding.summary}`),
    neOtomatikDuzeltilebilir: automatic.map((finding) => `${finding.fileOrModule}: ${finding.suggestedAction}`),
    neInsanOnayiIster: approval.map(
      (finding) => `${finding.fileOrModule}: ${finding.suggestedAction}`,
    ),
    siradakiBakimOnerisi:
      approval.length > 0
        ? "Onay isteyen bakimlari ayri gorev yap ve APPROVE_CHIEF_BRAIN_SAFE_ACTION olmadan uygulama."
        : "Haftalik kod/test/borc/lisans/guvenlik kontrolunu surdur.",
    technicalTermExplanation:
      "Contract: kural kontrol dosyasi. Typecheck: kod tip uyumu kontrolu. Git diff: dosya farki kontrolu.",
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
    approvalPhrase: CHIEF_BRAIN_APPROVAL_PHRASE,
    safety: learningDnaDecisionSafety(),
  };
}

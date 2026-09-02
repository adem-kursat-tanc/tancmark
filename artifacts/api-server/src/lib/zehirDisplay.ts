import { type AuditLog } from "./auditStore";
import { cleanString } from "./secureRoomSummary";

const ZEHIR_DISPLAY_VERSION = "zehir-dashboard-report-display-v0.1";

export const ZEHIR_DISPLAY_SAFETY_NOTICE =
  "Bu bölüm yalnız aday destek kayıtları içerir. Kesin sonuç sadece ID okunup sistem ID'siyle eşleşirse oluşur.";

const ZEHIR_EVENT_LABELS: Record<string, string> = {
  manual_light_protection: "Manuel koruma tetiklendi",
  manual_medium_protection: "Manuel koruma tetiklendi",
  manual_hard_protection: "Manuel koruma tetiklendi",
  auto_light_protection_candidate: "Otomatik koruma adayı",
  protection_rollback_requested: "Geri alma kaydı",
  session_trace_candidate: "Ekran/oturum aday izi",
  file_viewed: "Dosya görüntülendi",
  copy_viewed: "Kopya görüntülendi",
  view_started: "Görüntüleme başladı",
  view_ended: "Görüntüleme bitti",
  viewer_layer_candidate: "Görüntüleme katmanı adayı",
  screen_session_candidate: "Ekran/oturum adayı",
  compression_survivor_candidate: "Sıkıştırmadan sağ çıkabilecek aday sinyal",
};

export interface ZehirDisplayRow {
  auditId: number;
  timestamp: string;
  eventType: string;
  label: string;
  category: "candidate_support";
  displayStatus: "Aday destek sinyali";
  nonFinalStatus: "Kesin sonuç değildir";
  fileId: string | null;
  copyId: string | null;
  sessionId: string | null;
  userId: string | null;
  screenSessionId: string | null;
  signalType: string | null;
  sourceModules: string[];
  triggerMode: "manual" | "automatic_candidate" | null;
  protectionLevel: "light" | "medium" | "hard" | null;
  protectionLabel:
    | "Hafif koruma seviyesi"
    | "Orta koruma seviyesi"
    | "Sert koruma seviyesi"
    | null;
  reason: string | null;
  countdownSeconds: 30 | null;
  cancelAvailable: true | null;
  reversible: true | null;
  rollbackWindowHours: 24 | null;
  rollbackAvailable: true | null;
  rollbackStatus: "available" | "rollback_requested" | null;
  automaticProtectionCandidate: true | null;
  protectionNotice: "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir." | null;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  confirmed: false;
  idMatched: false;
  canOpenVault: false;
  vaultCapable: false;
}

export interface ZehirDisplayReport {
  status: "ZEHIR_DISPLAY_READ_ONLY";
  version: typeof ZEHIR_DISPLAY_VERSION;
  generatedAt: string;
  title: "Zehir / Ekran-Oturum Aday Kayıtları";
  safetyNotice: typeof ZEHIR_DISPLAY_SAFETY_NOTICE;
  rows: ZehirDisplayRow[];
  counts: {
    totalRows: number;
    candidateSupport: number;
    confirmed: 0;
    vaultCapable: 0;
    canOpenVault: 0;
  };
  separation: {
    zehirUnderCandidateSupport: true;
    confirmedResultsSeparate: true;
    secureRoomRecordOnly: true;
    evidencePackageDoesNotDecide: true;
    c2paDraftDoesNotDecide: true;
  };
  safety: {
    readOnlyDisplay: true;
    zehirDoesNotConfirm: true;
    zehirDoesNotOpenVault: true;
    idRequiredForVault: true;
    candidateSupportIsNotConfirmed: true;
    noScreenTraceEmbedded: true;
    noWatermarkCreated: true;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function zehirDetailsFromRow(row: AuditLog): Record<string, unknown> | null {
  const details = asRecord(row.details);
  if (details["version"] === "zehir-v0.2-candidate-session") return details;
  if (details["version"] === "zehir-v0.3-session-trace-candidate") return details;
  if (details["version"] === "zehir-v0.4-manual-light-protection") return details;
  if (details["version"] === "zehir-v0.4-protection-record") return details;
  return null;
}

function labelForEvent(eventType: string): string {
  return ZEHIR_EVENT_LABELS[eventType] ?? "Aday destek sinyali";
}

function protectionLevel(value: unknown): "light" | "medium" | "hard" | null {
  return value === "light" || value === "medium" || value === "hard"
    ? value
    : null;
}

function protectionLabel(
  level: "light" | "medium" | "hard" | null,
): ZehirDisplayRow["protectionLabel"] {
  if (level === "medium") return "Orta koruma seviyesi";
  if (level === "hard") return "Sert koruma seviyesi";
  if (level === "light") return "Hafif koruma seviyesi";
  return null;
}

function rowFromAudit(row: AuditLog): ZehirDisplayRow | null {
  const details = zehirDetailsFromRow(row);
  if (!details) return null;
  const eventType = cleanString(details["eventType"], 80);
  if (!eventType) return null;
  const level = protectionLevel(details["protectionLevel"]);

  return {
    auditId: row.id,
    timestamp: row.ts.toISOString(),
    eventType,
    label: labelForEvent(eventType),
    category: "candidate_support",
    displayStatus: "Aday destek sinyali",
    nonFinalStatus: "Kesin sonuç değildir",
    fileId: cleanString(details["fileId"], 256),
    copyId: cleanString(details["copyId"], 256),
    sessionId: cleanString(details["sessionId"], 256),
    userId: cleanString(details["roomUserId"], 256),
    screenSessionId: cleanString(details["screenSessionId"], 256),
    signalType: cleanString(details["signalType"], 80),
    sourceModules: stringArray(details["sourceModules"]),
    triggerMode:
      details["triggerMode"] === "manual" ||
      details["triggerMode"] === "automatic_candidate"
        ? details["triggerMode"]
        : null,
    protectionLevel: level,
    protectionLabel: protectionLabel(level),
    reason: cleanString(details["reason"], 500),
    countdownSeconds: details["countdownSeconds"] === 30 ? 30 : null,
    cancelAvailable: details["cancelAvailable"] === true ? true : null,
    reversible: details["reversible"] === true ? true : null,
    rollbackWindowHours: details["rollbackWindowHours"] === 24 ? 24 : null,
    rollbackAvailable: details["rollbackAvailable"] === true ? true : null,
    rollbackStatus:
      details["rollbackStatus"] === "rollback_requested"
        ? "rollback_requested"
        : details["rollbackStatus"] === "available"
          ? "available"
          : null,
    automaticProtectionCandidate:
      details["automaticProtectionCandidate"] === true ? true : null,
    protectionNotice:
      details["protectionNotice"] ===
      "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir."
        ? "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir."
        : null,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    confirmed: false,
    idMatched: false,
    canOpenVault: false,
    vaultCapable: false,
  };
}

export function buildZehirDisplayReport(
  rows: AuditLog[],
  limit: number,
): ZehirDisplayReport {
  const displayRows = rows
    .map(rowFromAudit)
    .filter((row): row is ZehirDisplayRow => row !== null)
    .slice(0, limit);

  return {
    status: "ZEHIR_DISPLAY_READ_ONLY",
    version: ZEHIR_DISPLAY_VERSION,
    generatedAt: new Date().toISOString(),
    title: "Zehir / Ekran-Oturum Aday Kayıtları",
    safetyNotice: ZEHIR_DISPLAY_SAFETY_NOTICE,
    rows: displayRows,
    counts: {
      totalRows: displayRows.length,
      candidateSupport: displayRows.length,
      confirmed: 0,
      vaultCapable: 0,
      canOpenVault: 0,
    },
    separation: {
      zehirUnderCandidateSupport: true,
      confirmedResultsSeparate: true,
      secureRoomRecordOnly: true,
      evidencePackageDoesNotDecide: true,
      c2paDraftDoesNotDecide: true,
    },
    safety: {
      readOnlyDisplay: true,
      zehirDoesNotConfirm: true,
      zehirDoesNotOpenVault: true,
      idRequiredForVault: true,
      candidateSupportIsNotConfirmed: true,
      noScreenTraceEmbedded: true,
      noWatermarkCreated: true,
    },
  };
}

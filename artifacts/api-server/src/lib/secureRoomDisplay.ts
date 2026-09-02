import { type AuditLog } from "./auditStore";
import {
  cleanModuleArray,
  cleanString,
  type MediaModuleKind,
} from "./secureRoomSummary";
import {
  screenToCameraFromDetails,
  type ScreenToCameraDisplay,
} from "./screenToCameraDisplay";
import {
  C2PA_STATUS_SUPPORT_NOTE,
  type C2paReadOnlyStatus,
  type C2paReadOnlyStatusReport,
} from "./c2paStatus";

const SECURE_ROOM_DISPLAY_VERSION = "secure-room-display-v0.1";

export const SECURE_ROOM_DISPLAY_SAFETY_NOTICE =
  "Bu bölüm yalnız kayıt ve aday destek özetleri içerir. Kesin sonuç yalnız ID okunup sistem ID'siyle eşleşirse oluşur.";

const SECURE_ROOM_EVENT_LABELS: Record<string, string> = {
  session_started: "Oturum başladı",
  copy_created: "Kopya oluşturuldu",
  file_opened: "Dosya açıldı",
  view_started: "Görüntüleme başladı",
  view_ended: "Görüntüleme bitti",
  module_summary: "Modül özeti",
  evidence_package_created: "Delil paketi özeti",
  large_file_analysis_copy: "Buyuk dosya analiz kopyasi",
  manual_medium_protection: "Manuel orta koruma kaydı",
  manual_hard_protection: "Manuel sert koruma kaydı",
  auto_light_protection_candidate: "Otomatik koruma adayı",
  protection_rollback_requested: "Geri alma kaydı",
  manual_light_protection: "Manuel hafif koruma kaydı",
  session_trace_candidate: "Ekran/oturum aday izi",
  viewer_layer_candidate: "Görüntüleme katmanı adayı",
  screen_session_candidate: "Ekran/oturum adayı",
  screen_to_camera_candidate: "Ekran Çekimi Aday İzi",
  presentation_signature_candidate: "Ekran Çekimi Aday İzi",
  screen_light_candidate: "Ekran Çekimi Aday İzi",
};

export interface SecureRoomDisplayRow {
  auditId: number;
  timestamp: string;
  route: string;
  eventType: string;
  label: string;
  fileId: string | null;
  copyId: string | null;
  sessionId: string | null;
  userId: string | null;
  screenSessionId: string | null;
  activeModules: MediaModuleKind[];
  modulesSealed: MediaModuleKind[];
  modulesIdRead: MediaModuleKind[];
  modulesCandidateSupport: MediaModuleKind[];
  sourceModuleIdMatchModules: MediaModuleKind[];
  candidateSupport: boolean;
  zehirCandidate: boolean;
  zehirSignalType: string | null;
  zehirProtectionLabel: string | null;
  evidenceSourceEventCount: number | null;
  evidenceZehirCandidateSessionCount: number | null;
  screenToCamera: ScreenToCameraDisplay;
  largeFileStrategy: boolean;
  originalHashSha256: string | null;
  analysisCopyHashSha256: string | null;
  contentCredentials: C2paReadOnlyStatusReport | null;
  sourceResult: string | null;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  secureRoomDecision: "Sadece kayıt";
  nonFinalStatus: "Kesin sonuç değildir";
  secureRoomIdentityApproved: false;
  secureRoomIdMatched: false;
  canOpenVault: false;
  vaultCapable: false;
}

export interface SecureRoomDisplayReport {
  status: "SECURE_ROOM_DISPLAY_READ_ONLY";
  version: typeof SECURE_ROOM_DISPLAY_VERSION;
  generatedAt: string;
  title: "Secure Room / Kayıt Odası";
  safetyNotice: typeof SECURE_ROOM_DISPLAY_SAFETY_NOTICE;
  rows: SecureRoomDisplayRow[];
  counts: {
    totalRows: number;
    candidateSupportRows: number;
    zehirRows: number;
    evidencePackageRows: number;
    screenToCameraRows: number;
    sourceModuleIdMatchRecords: number;
    secureRoomIdentityApproved: 0;
    canOpenVault: 0;
  };
  c2paDraftConnection: {
    status: "C2PA_DRAFT_ENDPOINT_READY";
    draftOnly: true;
    readOnlyStatus: {
      status: C2paReadOnlyStatus;
      userLabel: string;
      supportNote: typeof C2PA_STATUS_SUPPORT_NOTE;
      checkedRows: number;
      foundRows: number;
      unreadableRows: number;
      invalidOrUnverifiedRows: number;
    };
    decides: false;
    opensVault: false;
  };
  safety: {
    readOnlyDisplay: true;
    secureRoomDoesNotDecide: true;
    secureRoomDoesNotOpenVault: true;
    idRequiredForVault: true;
    candidateSupportIsNotFinal: true;
    moduleIdsAreNotCombined: true;
    evidencePackageDoesNotDecide: true;
    c2paDraftDoesNotDecide: true;
    zehirCandidateSupportOnly: true;
    screenToCameraCandidateOnly: true;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bool(value: unknown): boolean {
  return value === true;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function screenSessionFromDetails(details: Record<string, unknown>): string | null {
  const direct = cleanString(details["screenSessionId"], 256);
  if (direct) return direct;
  const zehirCandidate = asRecord(details["zehirCandidate"]);
  const zehirDirect = cleanString(zehirCandidate["screenSessionId"], 256);
  if (zehirDirect) return zehirDirect;
  const candidateSession = asRecord(details["candidateSession"]);
  return cleanString(candidateSession["screenSessionId"], 256);
}

function zehirProtectionLabel(details: Record<string, unknown>): string | null {
  const direct = cleanString(details["protectionLabel"], 120);
  if (direct) return direct;
  const zehirCandidate = asRecord(details["zehirCandidate"]);
  const candidateSession = asRecord(zehirCandidate["candidateSession"]);
  return cleanString(candidateSession["protectionLabel"], 120);
}

function hasZehirCandidate(details: Record<string, unknown>): boolean {
  if (asRecord(details["zehirCandidate"])["present"] === true) return true;
  if (cleanString(details["screenSessionId"], 256) && cleanString(details["signalType"], 80)) {
    return true;
  }
  return false;
}

function labelForEvent(eventType: string): string {
  return SECURE_ROOM_EVENT_LABELS[eventType] ?? "Secure Room kaydı";
}

function isC2paStatus(value: unknown): value is C2paReadOnlyStatus {
  return (
    value === "not_found" ||
    value === "found" ||
    value === "unreadable" ||
    value === "invalid_or_unverified"
  );
}

function c2paStatusFromDetails(
  details: Record<string, unknown>,
): C2paReadOnlyStatusReport | null {
  const evidencePackage = asRecord(details["evidencePackage"]);
  const rec = asRecord(details["contentCredentials"] ?? evidencePackage["contentCredentials"]);
  if (!isC2paStatus(rec["status"])) return null;
  const safety = asRecord(rec["safety"]);
  if (
    safety["c2paDoesNotDecide"] !== true ||
    safety["c2paDoesNotBlockSeal"] !== true ||
    safety["c2paDoesNotOpenVault"] !== true ||
    safety["c2paDoesNotConfirm"] !== true
  ) {
    return null;
  }
  return rec as unknown as C2paReadOnlyStatusReport;
}

function c2paUserLabel(status: C2paReadOnlyStatus): string {
  if (status === "found") return "Content Credentials bilgisi bulundu.";
  if (status === "unreadable") return "Content Credentials bilgisi okunamadı.";
  if (status === "invalid_or_unverified") {
    return "Content Credentials bilgisi doğrulanamadı.";
  }
  return "Content Credentials bilgisi bulunmadı.";
}

function rowFromAudit(row: AuditLog): SecureRoomDisplayRow | null {
  const details = asRecord(row.details);
  const eventType = cleanString(details["eventType"], 80);
  if (!eventType) return null;
  const modulesCandidateSupport = cleanModuleArray(details["modulesCandidateSupport"]);
  const sourceModuleIdMatchModules = cleanModuleArray(details["modulesConfirmed"]);
  const zehirCandidate = hasZehirCandidate(details);
  const screenToCamera = screenToCameraFromDetails(details);
  const supportDetails = asRecord(details["supportDetails"]);
  const contentCredentials = c2paStatusFromDetails(details);
  const largeFileStrategy =
    asRecord(supportDetails["largeFileStrategy"])["status"] ===
      "large_file_analysis_copy_ready" ||
    numberOrNull(details["largeFileStrategyCount"]) !== null;
  const candidateSupport =
    bool(details["candidateSupport"]) ||
    modulesCandidateSupport.length > 0 ||
    zehirCandidate ||
    screenToCamera.present;

  return {
    auditId: row.id,
    timestamp: row.ts.toISOString(),
    route: row.route,
    eventType,
    label: labelForEvent(eventType),
    fileId: cleanString(details["fileId"], 256),
    copyId: cleanString(details["copyId"], 256),
    sessionId: cleanString(details["sessionId"], 256),
    userId: cleanString(details["roomUserId"], 256),
    screenSessionId: screenSessionFromDetails(details),
    activeModules: cleanModuleArray(details["activeModules"]),
    modulesSealed: cleanModuleArray(details["modulesSealed"]),
    modulesIdRead: cleanModuleArray(details["modulesIdRead"]),
    modulesCandidateSupport,
    sourceModuleIdMatchModules,
    candidateSupport,
    zehirCandidate,
    zehirSignalType: cleanString(details["signalType"], 80),
    zehirProtectionLabel: zehirProtectionLabel(details),
    evidenceSourceEventCount: numberOrNull(details["sourceEventCount"]),
    evidenceZehirCandidateSessionCount: numberOrNull(
      details["zehirCandidateSessionCount"],
    ),
    screenToCamera,
    largeFileStrategy,
    originalHashSha256: cleanString(
      supportDetails["originalHashSha256"] ?? details["contentHashSha256"],
      80,
    ),
    analysisCopyHashSha256: cleanString(
      supportDetails["analysisCopyHashSha256"] ?? details["copyHashSha256"],
      80,
    ),
    contentCredentials,
    sourceResult: cleanString(details["sourceResult"], 120),
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    secureRoomDecision: "Sadece kayıt",
    nonFinalStatus: "Kesin sonuç değildir",
    secureRoomIdentityApproved: false,
    secureRoomIdMatched: false,
    canOpenVault: false,
    vaultCapable: false,
  };
}

export function buildSecureRoomDisplayReport(
  rows: AuditLog[],
  limit: number,
): SecureRoomDisplayReport {
  const displayRows = rows
    .map(rowFromAudit)
    .filter((row): row is SecureRoomDisplayRow => row !== null)
    .slice(0, limit);
  const c2paRows = displayRows
    .map((row) => row.contentCredentials)
    .filter((item): item is C2paReadOnlyStatusReport => item !== null);
  const latestC2paStatus = c2paRows[0]?.status ?? "not_found";

  return {
    status: "SECURE_ROOM_DISPLAY_READ_ONLY",
    version: SECURE_ROOM_DISPLAY_VERSION,
    generatedAt: new Date().toISOString(),
    title: "Secure Room / Kayıt Odası",
    safetyNotice: SECURE_ROOM_DISPLAY_SAFETY_NOTICE,
    rows: displayRows,
    counts: {
      totalRows: displayRows.length,
      candidateSupportRows: displayRows.filter((row) => row.candidateSupport).length,
      zehirRows: displayRows.filter((row) => row.zehirCandidate).length,
      evidencePackageRows: displayRows.filter(
        (row) => row.eventType === "evidence_package_created",
      ).length,
      screenToCameraRows: displayRows.filter((row) => row.screenToCamera.present)
        .length,
      sourceModuleIdMatchRecords: displayRows.filter(
        (row) => row.sourceModuleIdMatchModules.length > 0,
      ).length,
      secureRoomIdentityApproved: 0,
      canOpenVault: 0,
    },
    c2paDraftConnection: {
      status: "C2PA_DRAFT_ENDPOINT_READY",
      draftOnly: true,
      readOnlyStatus: {
        status: latestC2paStatus,
        userLabel: c2paUserLabel(latestC2paStatus),
        supportNote: C2PA_STATUS_SUPPORT_NOTE,
        checkedRows: c2paRows.filter((item) => item.checked).length,
        foundRows: c2paRows.filter((item) => item.status === "found").length,
        unreadableRows: c2paRows.filter((item) => item.status === "unreadable").length,
        invalidOrUnverifiedRows: c2paRows.filter(
          (item) => item.status === "invalid_or_unverified",
        ).length,
      },
      decides: false,
      opensVault: false,
    },
    safety: {
      readOnlyDisplay: true,
      secureRoomDoesNotDecide: true,
      secureRoomDoesNotOpenVault: true,
      idRequiredForVault: true,
      candidateSupportIsNotFinal: true,
      moduleIdsAreNotCombined: true,
      evidencePackageDoesNotDecide: true,
      c2paDraftDoesNotDecide: true,
      zehirCandidateSupportOnly: true,
      screenToCameraCandidateOnly: true,
    },
  };
}

import { recordEvent, type AuditLog } from "./auditStore";
import {
  cleanModuleArray,
  cleanString,
  recordSecureRoomModuleSummary,
  type MediaModuleKind,
  type SecureRoomZehirCandidate,
  type SecureRoomZehirCandidateSession,
  type SecureRoomSummaryPayload,
  type ZehirProtectionLabel,
  type ZehirProtectionLevel,
  type ZehirTriggerMode,
} from "./secureRoomSummary";

export const ZEHIR_EVENT_TYPES = [
  "file_viewed",
  "copy_viewed",
  "view_started",
  "view_ended",
  "screen_session_started",
  "screen_session_heartbeat",
  "screen_session_ended",
  "screen_trace_candidate",
  "screen_trace_not_found",
  "viewer_layer_candidate",
  "screen_session_candidate",
  "session_trace_candidate",
  "manual_light_protection",
  "manual_medium_protection",
  "manual_hard_protection",
  "auto_light_protection_candidate",
  "protection_rollback_requested",
  "compression_survivor_candidate",
  "zehir_candidate_support",
] as const;

export const ZEHIR_SIGNAL_TYPES = [
  "screen_session_lifecycle",
  "screen_trace_candidate",
  "screen_trace_not_found",
  "screen_record_candidate",
  "phone_camera_candidate",
  "screenshot_candidate",
  "social_recompression_candidate",
  "screen_session_candidate",
  "viewer_layer_candidate",
  "copy_session_candidate",
  "session_trace_candidate",
  "manual_light_protection",
  "manual_medium_protection",
  "manual_hard_protection",
  "auto_light_protection_candidate",
  "protection_rollback_requested",
  "compression_survivor_candidate",
  "file_viewed",
  "copy_viewed",
  "view_started",
  "view_ended",
  "unknown_screen_signal",
] as const;

export type ZehirEventType = (typeof ZEHIR_EVENT_TYPES)[number];
export type ZehirSignalType = (typeof ZEHIR_SIGNAL_TYPES)[number];

export interface ZehirRecordInput {
  ip: string;
  route: string;
  eventType: ZehirEventType;
  fileId: string;
  copyId: string;
  sessionId: string;
  screenSessionId: string;
  userId?: string;
  sourceModules?: ReadonlyArray<MediaModuleKind>;
  signalType?: string;
  reason?: string;
  note?: string;
}

export interface ZehirRecordOnlyResponse {
  status: "record_only_v0.2" | "record_only_v0.3" | "record_only_v0.4";
  eventType: ZehirEventType;
  fileId: string;
  copyId: string;
  sessionId: string;
  screenSessionId: string;
  sourceModules: MediaModuleKind[];
  signalType: string | null;
  signalTypeKnown: boolean;
  knownSignalTypes: ZehirSignalType[];
  candidateSession: SecureRoomZehirCandidateSession;
  traceDecision: "ZEHIR_SESSION_TRACE_CANDIDATE" | null;
  traceLabel: "Ekran/oturum aday izi" | null;
  manualProtectionDecision:
    | "ZEHIR_MANUAL_LIGHT_PROTECTION_CANDIDATE"
    | "ZEHIR_MANUAL_MEDIUM_PROTECTION_CANDIDATE"
    | "ZEHIR_MANUAL_HARD_PROTECTION_CANDIDATE"
    | null;
  automaticProtectionCandidateDecision: "ZEHIR_AUTO_LIGHT_PROTECTION_CANDIDATE" | null;
  rollbackDecision: "ZEHIR_PROTECTION_ROLLBACK_RECORDED" | null;
  triggerMode: ZehirTriggerMode | null;
  protectionLevel: ZehirProtectionLevel | null;
  protectionLabel: ZehirProtectionLabel | null;
  reason: string | null;
  countdownSeconds: 30 | null;
  cancelAvailable: true | null;
  reversible: true | null;
  rollbackWindowHours: 24 | null;
  rollbackAvailable: true | null;
  rollbackStatus: "available" | "rollback_requested" | null;
  automaticProtectionCandidate: true | null;
  automaticMediumProtectionEnabled: false | null;
  automaticHardProtectionEnabled: false | null;
  protectionNotice: "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir." | null;
  activeProtectionViewOnly: true | null;
  affectsOnlyAegisProtectedContent: true | null;
  externalNetworkTraffic: false | null;
  originalFileModified: false;
  permanentDamage: false;
  screenSessionIdRequired: true;
  officialDecision: "ZEHIR_EVENT_RECORDED";
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  candidateSupport: boolean;
  candidateSupportOnly: true;
  screenTraceEmbedded: false;
  recordOnly: true;
  confirmed: false;
  idRead: false;
  idMatched: false;
  vaultCapable: false;
  canOpenVault: false;
  note: string;
}

export interface ZehirRecordOnlyPayload {
  details: Record<string, unknown>;
  response: ZehirRecordOnlyResponse;
}

export function parseZehirEventType(value: unknown): ZehirEventType | null {
  const raw = cleanString(value, 80);
  if (!raw) return null;
  return (ZEHIR_EVENT_TYPES as readonly string[]).includes(raw)
    ? (raw as ZehirEventType)
    : null;
}

function defaultSignalType(eventType: ZehirEventType): ZehirSignalType {
  if (eventType === "file_viewed") return "file_viewed";
  if (eventType === "copy_viewed") return "copy_viewed";
  if (eventType === "view_started") return "view_started";
  if (eventType === "view_ended") return "view_ended";
  if (eventType === "screen_trace_candidate") return "screen_trace_candidate";
  if (eventType === "screen_trace_not_found") return "screen_trace_not_found";
  if (eventType === "viewer_layer_candidate") return "viewer_layer_candidate";
  if (eventType === "screen_session_candidate") return "screen_session_candidate";
  if (eventType === "session_trace_candidate") return "session_trace_candidate";
  if (eventType === "manual_light_protection") return "manual_light_protection";
  if (eventType === "manual_medium_protection") return "manual_medium_protection";
  if (eventType === "manual_hard_protection") return "manual_hard_protection";
  if (eventType === "auto_light_protection_candidate") {
    return "auto_light_protection_candidate";
  }
  if (eventType === "protection_rollback_requested") {
    return "protection_rollback_requested";
  }
  if (eventType === "compression_survivor_candidate") return "compression_survivor_candidate";
  if (eventType === "zehir_candidate_support") return "unknown_screen_signal";
  return "screen_session_lifecycle";
}

function eventCarriesCandidateSupport(eventType: ZehirEventType): boolean {
  return (
    eventType === "file_viewed" ||
    eventType === "copy_viewed" ||
    eventType === "view_started" ||
    eventType === "view_ended" ||
    eventType === "screen_trace_candidate" ||
    eventType === "viewer_layer_candidate" ||
    eventType === "screen_session_candidate" ||
    eventType === "session_trace_candidate" ||
    eventType === "manual_light_protection" ||
    eventType === "manual_medium_protection" ||
    eventType === "manual_hard_protection" ||
    eventType === "auto_light_protection_candidate" ||
    eventType === "protection_rollback_requested" ||
    eventType === "compression_survivor_candidate" ||
    eventType === "zehir_candidate_support"
  );
}

function manualProtectionLevel(eventType: ZehirEventType): ZehirProtectionLevel | null {
  if (eventType === "manual_light_protection") return "light";
  if (eventType === "manual_medium_protection") return "medium";
  if (eventType === "manual_hard_protection") return "hard";
  return null;
}

function protectionLabelForLevel(level: ZehirProtectionLevel): ZehirProtectionLabel {
  if (level === "medium") return "Orta koruma seviyesi";
  if (level === "hard") return "Sert koruma seviyesi";
  return "Hafif koruma seviyesi";
}

function manualDecisionForLevel(
  level: ZehirProtectionLevel | null,
): ZehirRecordOnlyResponse["manualProtectionDecision"] {
  if (level === "medium") return "ZEHIR_MANUAL_MEDIUM_PROTECTION_CANDIDATE";
  if (level === "hard") return "ZEHIR_MANUAL_HARD_PROTECTION_CANDIDATE";
  if (level === "light") return "ZEHIR_MANUAL_LIGHT_PROTECTION_CANDIDATE";
  return null;
}

export function buildZehirRecordOnlyPayload(
  input: ZehirRecordInput,
): ZehirRecordOnlyPayload {
  const sourceModules = cleanModuleArray(input.sourceModules);
  const signalType = cleanString(input.signalType, 80) ?? defaultSignalType(input.eventType);
  const signalTypeKnown = (ZEHIR_SIGNAL_TYPES as readonly string[]).includes(signalType);
  const note = cleanString(input.note, 500);
  const eventTime = new Date().toISOString();
  const candidateSupport = eventCarriesCandidateSupport(input.eventType);
  const isSessionTraceCandidate = input.eventType === "session_trace_candidate";
  const manualLevel = manualProtectionLevel(input.eventType);
  const isManualProtection = manualLevel !== null;
  const isAutoLightCandidate = input.eventType === "auto_light_protection_candidate";
  const isRollbackRecord = input.eventType === "protection_rollback_requested";
  const isProtectionRecord = isManualProtection || isAutoLightCandidate || isRollbackRecord;
  const protectionLevel: ZehirProtectionLevel | null = isProtectionRecord
    ? manualLevel ?? "light"
    : null;
  const triggerMode: ZehirTriggerMode | null = isManualProtection
    ? "manual"
    : isAutoLightCandidate
      ? "automatic_candidate"
      : null;
  const protectionLabel = protectionLevel ? protectionLabelForLevel(protectionLevel) : null;
  const reason = cleanString(input.reason, 500) ?? null;
  const sessionTraceFields = isSessionTraceCandidate
    ? {
        traceDecision: "ZEHIR_SESSION_TRACE_CANDIDATE" as const,
        traceLabel: "Ekran/oturum aday izi" as const,
        traceScope: "screen_session_record_only" as const,
      }
    : {};
  const protectionFields = isProtectionRecord
    ? {
        manualProtectionDecision: manualDecisionForLevel(manualLevel),
        automaticProtectionCandidateDecision: isAutoLightCandidate
          ? ("ZEHIR_AUTO_LIGHT_PROTECTION_CANDIDATE" as const)
          : null,
        rollbackDecision: isRollbackRecord
          ? ("ZEHIR_PROTECTION_ROLLBACK_RECORDED" as const)
          : null,
        triggerMode,
        protectionLevel,
        protectionLabel,
        reason: reason ?? "not_reported",
        countdownSeconds: 30 as const,
        cancelAvailable: true as const,
        reversible: true as const,
        rollbackWindowHours: 24 as const,
        rollbackAvailable: true as const,
        rollbackStatus: isRollbackRecord
          ? ("rollback_requested" as const)
          : ("available" as const),
        automaticProtectionCandidate: isAutoLightCandidate ? (true as const) : null,
        automaticMediumProtectionEnabled: false as const,
        automaticHardProtectionEnabled: false as const,
        protectionNotice:
          "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir." as const,
        activeProtectionViewOnly: true as const,
        originalFileModified: false as const,
        permanentDamage: false as const,
        affectsOnlyAegisProtectedContent: true as const,
        externalNetworkTraffic: false as const,
      }
    : {};
  const candidateSession: SecureRoomZehirCandidateSession = {
    version: isProtectionRecord
      ? "zehir-v0.4-protection-record"
      : isSessionTraceCandidate
        ? "zehir-v0.3-session-trace-candidate"
        : "zehir-v0.2-candidate-session",
    screenSessionId: input.screenSessionId,
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    signalType,
    signalTypeKnown,
    ...sessionTraceFields,
    ...protectionFields,
    sourceModules,
    candidateSupport,
    candidateSupportOnly: true,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    recordOnly: true,
    confirmed: false,
    idRead: false,
    idMatched: false,
    vaultCapable: false,
    canOpenVault: false,
  };

  const details = {
    version: isProtectionRecord
      ? "zehir-v0.4-protection-record"
      : isSessionTraceCandidate
        ? "zehir-v0.3-session-trace-candidate"
        : "zehir-v0.2-candidate-session",
    eventType: input.eventType,
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    screenSessionId: input.screenSessionId,
    roomUserId: input.userId ?? null,
    eventTime,
    sourceModules,
    signalType,
    signalTypeKnown,
    ...sessionTraceFields,
    ...protectionFields,
    knownSignalTypes: ZEHIR_SIGNAL_TYPES,
    candidateSession,
    screenSessionIdRequired: true,
    candidateSupport,
    candidateSupportOnly: true,
    confirmed: false,
    idRead: false,
    idMatched: false,
    officialDecision: "ZEHIR_EVENT_RECORDED",
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    vaultCapable: false,
    canOpenVault: false,
    secureRoomRecordOnly: true,
    recordOnly: true,
    poisonEnabled: false,
    zehirRecordOnlyEnabled: true,
    screenSessionRecordOnlyEnabled: true,
    zehirCandidateSessionV02Enabled: true,
    zehirSessionTraceCandidateV03Enabled: isSessionTraceCandidate,
    zehirProtectionRecordV04Enabled: isProtectionRecord,
    zehirManualProtectionV04Enabled: isManualProtection,
    zehirAutomaticLightCandidateV04Enabled: isAutoLightCandidate,
    zehirRollbackRecordV04Enabled: isRollbackRecord,
    screenTraceEmbedded: false,
    note,
    safety: {
      recordOnly: true,
      officialResultRequiresIdMatch: true,
      candidateSupportIsNotConfirmed: true,
      screenSessionIdRequired: true,
      moduleIdsAreNotCombined: true,
      zehirDoesNotConfirm: true,
      zehirDoesNotOpenVault: true,
      secureRoomDoesNotPromoteZehir: true,
      noVaultGateCreated: true,
      activeProtectionDoesNotModifyOriginalFile: true,
      activeProtectionIsViewOnly: true,
      manualTriggerIsNotVault: true,
      automaticTriggerCandidateOnly: true,
      rollbackIsRecordOnly: true,
      rollbackWindowHours: 24,
      automaticMediumProtectionDisabled: true,
      automaticHardProtectionDisabled: true,
      noExternalNetworkTraffic: true,
    },
  };

  return {
    details,
    response: {
      status: isProtectionRecord
        ? "record_only_v0.4"
        : isSessionTraceCandidate
          ? "record_only_v0.3"
          : "record_only_v0.2",
      eventType: input.eventType,
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      screenSessionId: input.screenSessionId,
      sourceModules,
      signalType,
      signalTypeKnown,
      knownSignalTypes: [...ZEHIR_SIGNAL_TYPES],
      candidateSession,
      traceDecision: isSessionTraceCandidate ? "ZEHIR_SESSION_TRACE_CANDIDATE" : null,
      traceLabel: isSessionTraceCandidate ? "Ekran/oturum aday izi" : null,
      manualProtectionDecision: manualDecisionForLevel(manualLevel),
      automaticProtectionCandidateDecision: isAutoLightCandidate
        ? "ZEHIR_AUTO_LIGHT_PROTECTION_CANDIDATE"
        : null,
      rollbackDecision: isRollbackRecord ? "ZEHIR_PROTECTION_ROLLBACK_RECORDED" : null,
      triggerMode,
      protectionLevel,
      protectionLabel,
      reason: isProtectionRecord ? reason ?? "not_reported" : null,
      countdownSeconds: isProtectionRecord ? 30 : null,
      cancelAvailable: isProtectionRecord ? true : null,
      reversible: isProtectionRecord ? true : null,
      rollbackWindowHours: isProtectionRecord ? 24 : null,
      rollbackAvailable: isProtectionRecord ? true : null,
      rollbackStatus: isProtectionRecord
        ? isRollbackRecord
          ? "rollback_requested"
          : "available"
        : null,
      automaticProtectionCandidate: isAutoLightCandidate ? true : null,
      automaticMediumProtectionEnabled: isProtectionRecord ? false : null,
      automaticHardProtectionEnabled: isProtectionRecord ? false : null,
      protectionNotice: isProtectionRecord
        ? "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir."
        : null,
      activeProtectionViewOnly: isProtectionRecord ? true : null,
      affectsOnlyAegisProtectedContent: isProtectionRecord ? true : null,
      externalNetworkTraffic: isProtectionRecord ? false : null,
      originalFileModified: false,
      permanentDamage: false,
      screenSessionIdRequired: true,
      officialDecision: "ZEHIR_EVENT_RECORDED",
      finalDecision: "RECORD_ONLY_NOT_VAULT",
      candidateSupport,
      candidateSupportOnly: true,
      screenTraceEmbedded: false,
      recordOnly: true,
      confirmed: false,
      idRead: false,
      idMatched: false,
      vaultCapable: false,
      canOpenVault: false,
      note:
        isProtectionRecord
          ? "Zehir v0.4 records protection as view/report-only candidate support. It does not modify the original file, confirm identity, or open VAULT."
          : isSessionTraceCandidate
          ? "Zehir v0.3 records a screen/session trace candidate only. It never embeds a trace, confirms identity, or opens VAULT."
          : "Zehir v0.2 records screen-session candidate/support only. It never confirms identity and never opens VAULT.",
    },
  };
}

export async function recordZehirEvent(input: ZehirRecordInput): Promise<{
  row: AuditLog;
  secureRoomRow: AuditLog;
  zehir: ZehirRecordOnlyResponse;
  secureRoom: SecureRoomSummaryPayload["response"];
}> {
  const payload = buildZehirRecordOnlyPayload(input);
  const zehirCandidate: SecureRoomZehirCandidate = {
    present: true,
    eventType: payload.response.eventType,
    screenSessionId: payload.response.screenSessionId,
    signalType: payload.response.signalType,
    sourceModules: payload.response.sourceModules,
    candidateSession: payload.response.candidateSession,
    candidateSupport: payload.response.candidateSupport,
    candidateSupportOnly: true,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    confirmed: false,
    idRead: false,
    idMatched: false,
    vaultCapable: false,
    canOpenVault: false,
  };
  const row = await recordEvent({
    ip: input.ip,
    route: input.route,
    kind: "Secure_Room_Event",
    ...(input.userId ? { userId: input.userId } : {}),
    details: payload.details,
  });

  const summary = await recordSecureRoomModuleSummary({
    ip: input.ip,
    route: input.route,
    eventType: "module_summary",
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    ...(input.userId ? { userId: input.userId } : {}),
    activeModules: ["zehir"],
    modulesCandidateSupport: payload.response.candidateSupport ? ["zehir"] : [],
    modulesConfirmed: [],
    modulesIdRead: [],
    modulesSealed: [],
    zehirCandidate,
    sourceResult: payload.response.candidateSupport
      ? payload.response.manualProtectionDecision ??
        payload.response.automaticProtectionCandidateDecision ??
        payload.response.rollbackDecision ??
        payload.response.traceDecision ??
        "ZEHIR_CANDIDATE_SUPPORT"
      : "ZEHIR_NOT_FOUND",
    note:
      payload.response.manualProtectionDecision ||
      payload.response.automaticProtectionCandidateDecision ||
      payload.response.rollbackDecision
        ? "Zehir v0.4 protection record mirror. Record-only; not a VAULT gate."
        : payload.response.traceDecision === "ZEHIR_SESSION_TRACE_CANDIDATE"
        ? "Zehir v0.3 session trace candidate mirror. Record-only; not a VAULT gate."
        : "Zehir v0.2 Secure Room module_summary mirror. Record-only; not a VAULT gate.",
  });

  return {
    row,
    secureRoomRow: summary.row,
    zehir: payload.response,
    secureRoom: summary.secureRoom,
  };
}

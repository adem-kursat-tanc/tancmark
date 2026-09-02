import {
  recordEvent,
  recordEventFireAndForget,
  type AuditLog,
} from "./auditStore";

export const SECURE_ROOM_EVENT_TYPES = [
  "session_started",
  "copy_created",
  "file_opened",
  "view_started",
  "view_ended",
  "module_summary",
  "large_file_analysis_copy",
] as const;

export type SecureRoomEventType = (typeof SECURE_ROOM_EVENT_TYPES)[number];

export type MediaModuleKind = "video" | "image" | "audio" | "text" | "zehir";
export type ZehirProtectionLevel = "light" | "medium" | "hard";
export type ZehirTriggerMode = "manual" | "automatic_candidate";
export type ZehirProtectionLabel =
  | "Hafif koruma seviyesi"
  | "Orta koruma seviyesi"
  | "Sert koruma seviyesi";

export const MEDIA_MODULES: MediaModuleKind[] = [
  "video",
  "image",
  "audio",
  "text",
  "zehir",
];

export interface SecureRoomModuleReport {
  module: MediaModuleKind;
  active: boolean;
  sealed: boolean;
  idRead: boolean;
  candidateSupport: boolean;
  confirmed: boolean;
  officialDecision: string;
  note: string;
}

export interface SecureRoomZehirCandidateSession {
  version:
    | "zehir-v0.2-candidate-session"
    | "zehir-v0.3-session-trace-candidate"
    | "zehir-v0.4-manual-light-protection"
    | "zehir-v0.4-protection-record";
  screenSessionId: string;
  fileId: string | null;
  copyId: string | null;
  sessionId: string | null;
  userId: string | null;
  signalType: string | null;
  signalTypeKnown: boolean;
  traceDecision?: "ZEHIR_SESSION_TRACE_CANDIDATE" | null;
  traceLabel?: "Ekran/oturum aday izi" | null;
  traceScope?: "screen_session_record_only" | null;
  triggerMode?: ZehirTriggerMode | null;
  protectionLevel?: ZehirProtectionLevel | null;
  protectionLabel?: ZehirProtectionLabel | null;
  reason?: string | null;
  countdownSeconds?: 30 | null;
  cancelAvailable?: true | null;
  reversible?: true | null;
  rollbackWindowHours?: 24 | null;
  rollbackAvailable?: true | null;
  rollbackStatus?: "available" | "rollback_requested" | null;
  automaticProtectionCandidate?: true | null;
  automaticMediumProtectionEnabled?: false | null;
  automaticHardProtectionEnabled?: false | null;
  protectionNotice?: "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir." | null;
  activeProtectionViewOnly?: true | null;
  originalFileModified?: false | null;
  permanentDamage?: false | null;
  affectsOnlyAegisProtectedContent?: true | null;
  externalNetworkTraffic?: false | null;
  sourceModules: MediaModuleKind[];
  candidateSupport: boolean;
  candidateSupportOnly: true;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  recordOnly: true;
  confirmed: false;
  idRead: false;
  idMatched: false;
  vaultCapable: false;
  canOpenVault: false;
}

export interface SecureRoomZehirCandidate {
  present: boolean;
  eventType: string;
  screenSessionId: string;
  signalType: string | null;
  sourceModules: MediaModuleKind[];
  candidateSession: SecureRoomZehirCandidateSession;
  candidateSupport: boolean;
  candidateSupportOnly: true;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  confirmed: false;
  idRead: false;
  idMatched: false;
  vaultCapable: false;
  canOpenVault: false;
}

export interface SecureRoomSummaryInput {
  ip: string;
  route: string;
  eventType?: SecureRoomEventType;
  fileId: string;
  copyId: string;
  sessionId: string;
  userId?: string;
  activeModules?: ReadonlyArray<MediaModuleKind>;
  modulesSealed?: ReadonlyArray<MediaModuleKind>;
  modulesIdRead?: ReadonlyArray<MediaModuleKind>;
  modulesCandidateSupport?: ReadonlyArray<MediaModuleKind>;
  modulesConfirmed?: ReadonlyArray<MediaModuleKind>;
  zehirCandidate?: SecureRoomZehirCandidate;
  supportDetails?: Record<string, unknown>;
  sourceResult?: string;
  note?: string;
}

export interface SecureRoomSummaryPayload {
  details: Record<string, unknown>;
  response: {
    status: "record_only_v0.1";
    eventType: SecureRoomEventType;
    fileId: string;
    copyId: string;
    sessionId: string;
    activeModules: MediaModuleKind[];
    modulesSealed: MediaModuleKind[];
    modulesIdRead: MediaModuleKind[];
    modulesCandidateSupport: MediaModuleKind[];
    modulesConfirmed: MediaModuleKind[];
    moduleReport: SecureRoomModuleReport[];
    zehirCandidate: SecureRoomZehirCandidate | null;
    sourceResult: string | null;
    officialDecision: "SECURE_ROOM_EVENT_RECORDED";
    finalDecision: "RECORD_ONLY_NOT_VAULT";
    confirmed: false;
    candidateSupport: boolean;
    moduleConfirmedAny: boolean;
    vaultCapable: false;
    canOpenVault: false;
    note: string;
  };
}

export function cleanString(value: unknown, max = 256): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function cleanStringArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 80))
    .filter((item): item is string => item !== null)
    .slice(0, maxItems);
}

export function cleanModuleArray(value: unknown): MediaModuleKind[] {
  const seen = new Set<MediaModuleKind>();
  for (const item of cleanStringArray(value, 16)) {
    if (MEDIA_MODULES.includes(item as MediaModuleKind)) {
      seen.add(item as MediaModuleKind);
    }
  }
  return Array.from(seen);
}

function cleanProtectionLevel(value: unknown): ZehirProtectionLevel | null {
  return value === "light" || value === "medium" || value === "hard"
    ? value
    : null;
}

function cleanTriggerMode(value: unknown): ZehirTriggerMode | null {
  return value === "manual" || value === "automatic_candidate" ? value : null;
}

function protectionLabelForLevel(
  level: ZehirProtectionLevel,
): ZehirProtectionLabel {
  if (level === "medium") return "Orta koruma seviyesi";
  if (level === "hard") return "Sert koruma seviyesi";
  return "Hafif koruma seviyesi";
}

export function parseSecureRoomEventType(value: unknown): SecureRoomEventType | null {
  const raw = cleanString(value, 64);
  if (!raw) return null;
  return (SECURE_ROOM_EVENT_TYPES as readonly string[]).includes(raw)
    ? (raw as SecureRoomEventType)
    : null;
}

export function buildModuleReport(input: {
  activeModules: ReadonlyArray<MediaModuleKind>;
  modulesSealed: ReadonlyArray<MediaModuleKind>;
  modulesIdRead: ReadonlyArray<MediaModuleKind>;
  modulesCandidateSupport: ReadonlyArray<MediaModuleKind>;
  modulesConfirmed: ReadonlyArray<MediaModuleKind>;
}): SecureRoomModuleReport[] {
  const active = new Set(input.activeModules);
  const sealed = new Set(input.modulesSealed);
  const idRead = new Set(input.modulesIdRead);
  const candidate = new Set(input.modulesCandidateSupport);
  const confirmed = new Set(input.modulesConfirmed);

  return MEDIA_MODULES.map((module) => {
    const moduleConfirmed = confirmed.has(module);
    const moduleCandidate = candidate.has(module) || (idRead.has(module) && !moduleConfirmed);
    return {
      module,
      active: active.has(module),
      sealed: sealed.has(module),
      idRead: idRead.has(module),
      candidateSupport: moduleCandidate,
      confirmed: moduleConfirmed,
      officialDecision: moduleConfirmed
        ? `${module.toUpperCase()}_CONFIRMED`
        : moduleCandidate
          ? `${module.toUpperCase()}_CANDIDATE_SUPPORT`
          : "NOT_REPORTED",
      note: moduleConfirmed
        ? "Module reports its own ID match. Secure Room only records it; it does not combine IDs or open VAULT."
        : moduleCandidate
          ? module === "zehir"
            ? "Zehir reports screen-session candidate/support only. Secure Room records it as zehirCandidate and never treats it as confirmed."
            : "Module reports candidate/support evidence only. Secure Room does not treat it as confirmed."
          : "No module evidence reported for this Secure Room event.",
    };
  });
}

function normalizeZehirCandidate(
  value: SecureRoomZehirCandidate | undefined,
): SecureRoomZehirCandidate | null {
  if (!value?.present) return null;
  const candidateSession = normalizeZehirCandidateSession(value.candidateSession, {
    screenSessionId: value.screenSessionId,
    signalType: value.signalType,
    sourceModules: value.sourceModules,
    candidateSupport: value.candidateSupport === true,
  });
  return {
    present: true,
    eventType: cleanString(value.eventType, 80) ?? "zehir_candidate_support",
    screenSessionId: cleanString(value.screenSessionId, 256) ?? "unknown",
    signalType: cleanString(value.signalType, 80),
    sourceModules: cleanModuleArray(value.sourceModules),
    candidateSession,
    candidateSupport: value.candidateSupport === true,
    candidateSupportOnly: true,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    confirmed: false,
    idRead: false,
    idMatched: false,
    vaultCapable: false,
    canOpenVault: false,
  };
}

function normalizeZehirCandidateSession(
  value: SecureRoomZehirCandidateSession | undefined,
  fallback: {
    screenSessionId: string;
    signalType: string | null;
    sourceModules: ReadonlyArray<MediaModuleKind>;
    candidateSupport: boolean;
    triggerMode?: string | null;
    protectionLevel?: string | null;
    reason?: string | null;
    countdownSeconds?: number | null;
    cancelAvailable?: boolean | null;
    reversible?: boolean | null;
    rollbackStatus?: string | null;
  },
): SecureRoomZehirCandidateSession {
  const version =
    value?.version === "zehir-v0.4-protection-record" ||
    value?.version === "zehir-v0.4-manual-light-protection"
      ? "zehir-v0.4-protection-record"
      : value?.version === "zehir-v0.3-session-trace-candidate"
      ? "zehir-v0.3-session-trace-candidate"
      : "zehir-v0.2-candidate-session";
  const isProtectionRecord = version === "zehir-v0.4-protection-record";
  const protectionLevel =
    cleanProtectionLevel(value?.protectionLevel) ??
    cleanProtectionLevel(fallback.protectionLevel) ??
    "light";
  const triggerMode =
    cleanTriggerMode(value?.triggerMode) ??
    cleanTriggerMode(fallback.triggerMode) ??
    "manual";
  return {
    version,
    screenSessionId:
      cleanString(value?.screenSessionId, 256) ??
      cleanString(fallback.screenSessionId, 256) ??
      "unknown",
    fileId: cleanString(value?.fileId, 256),
    copyId: cleanString(value?.copyId, 256),
    sessionId: cleanString(value?.sessionId, 256),
    userId: cleanString(value?.userId, 256),
    signalType: cleanString(value?.signalType, 80) ?? cleanString(fallback.signalType, 80),
    signalTypeKnown: value?.signalTypeKnown === true,
    ...(version === "zehir-v0.3-session-trace-candidate"
      ? {
          traceDecision: "ZEHIR_SESSION_TRACE_CANDIDATE",
          traceLabel: "Ekran/oturum aday izi",
          traceScope: "screen_session_record_only",
        }
      : {}),
    ...(isProtectionRecord
      ? {
          triggerMode,
          protectionLevel,
          protectionLabel: protectionLabelForLevel(protectionLevel),
          reason:
            cleanString(value?.reason, 500) ??
            cleanString(fallback.reason, 500) ??
            "not_reported",
          countdownSeconds: 30 as const,
          cancelAvailable: true as const,
          reversible: true as const,
          rollbackWindowHours: 24 as const,
          rollbackAvailable: true as const,
          rollbackStatus:
            value?.rollbackStatus === "rollback_requested"
              ? ("rollback_requested" as const)
              : ("available" as const),
          automaticProtectionCandidate:
            triggerMode === "automatic_candidate" ? (true as const) : null,
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
      : {}),
    sourceModules: cleanModuleArray(value?.sourceModules ?? fallback.sourceModules),
    candidateSupport: value?.candidateSupport === true || fallback.candidateSupport,
    candidateSupportOnly: true,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    recordOnly: true,
    confirmed: false,
    idRead: false,
    idMatched: false,
    vaultCapable: false,
    canOpenVault: false,
  };
}

export function buildSecureRoomSummaryPayload(
  input: SecureRoomSummaryInput,
): SecureRoomSummaryPayload {
  const eventType = input.eventType ?? "module_summary";
  const activeModules = cleanModuleArray(input.activeModules);
  const modulesSealed = cleanModuleArray(input.modulesSealed);
  const modulesIdRead = cleanModuleArray(input.modulesIdRead);
  const modulesCandidateSupport = cleanModuleArray(input.modulesCandidateSupport);
  const modulesConfirmed = cleanModuleArray(input.modulesConfirmed);
  const zehirCandidate = normalizeZehirCandidate(input.zehirCandidate);
  const moduleReport = buildModuleReport({
    activeModules,
    modulesSealed,
    modulesIdRead,
    modulesCandidateSupport,
    modulesConfirmed,
  });
  const hasCandidateSupport =
    moduleReport.some((m) => m.candidateSupport) ||
    zehirCandidate?.candidateSupport === true;
  const hasModuleConfirmed = moduleReport.some((m) => m.confirmed);
  const sourceResult = cleanString(input.sourceResult, 80);
  const note = cleanString(input.note, 500);
  const eventTime = new Date().toISOString();

  const details = {
    version: "secure-room-v0.1-record-only",
    eventType,
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    roomUserId: input.userId ?? null,
    eventTime,
    activeModules,
    modulesSealed,
    modulesIdRead,
    modulesCandidateSupport,
    modulesConfirmed,
    moduleReport,
    zehirCandidate,
    supportDetails: input.supportDetails ?? null,
    sourceResult,
    candidateSupport: hasCandidateSupport,
    moduleConfirmedAny: hasModuleConfirmed,
    moduleIdReadAny: modulesIdRead.length > 0,
    confirmed: false,
    secureRoomOwnIdRead: false,
    secureRoomOwnIdMatched: false,
    officialDecision: "SECURE_ROOM_EVENT_RECORDED",
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    vaultCapable: false,
    canOpenVault: false,
    poisonEnabled: false,
    screenSessionEnabled: zehirCandidate !== null,
    note,
    safety: {
      recordOnly: true,
      officialResultRequiresIdMatch: true,
      candidateSupportIsNotConfirmed: true,
      moduleIdsAreNotCombined: true,
      secureRoomDoesNotPromoteModuleConfirmation: true,
      zehirCandidateIsRecordOnly: zehirCandidate !== null,
      noVaultGateCreated: true,
    },
  };

  return {
    details,
    response: {
      status: "record_only_v0.1",
      eventType,
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      activeModules,
      modulesSealed,
      modulesIdRead,
      modulesCandidateSupport,
      modulesConfirmed,
      moduleReport,
      zehirCandidate,
      sourceResult,
      officialDecision: "SECURE_ROOM_EVENT_RECORDED",
      finalDecision: "RECORD_ONLY_NOT_VAULT",
      confirmed: false,
      candidateSupport: hasCandidateSupport,
      moduleConfirmedAny: hasModuleConfirmed,
      vaultCapable: false,
      canOpenVault: false,
      note:
        "Secure Room v0.1 records session/copy/view/module events only. It never combines module IDs and never opens VAULT.",
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function moduleKind(value: unknown): MediaModuleKind | null {
  return typeof value === "string" && MEDIA_MODULES.includes(value as MediaModuleKind)
    ? (value as MediaModuleKind)
    : null;
}

function pushUnique(target: MediaModuleKind[], value: MediaModuleKind): void {
  if (!target.includes(value)) target.push(value);
}

export function summarizeCommonMediaDecision(decision: unknown): Pick<
  SecureRoomSummaryInput,
  | "activeModules"
  | "modulesSealed"
  | "modulesIdRead"
  | "modulesCandidateSupport"
  | "modulesConfirmed"
  | "sourceResult"
> {
  const rec = asRecord(decision);
  const activeModules: MediaModuleKind[] = [];
  const modulesSealed: MediaModuleKind[] = [];
  const modulesIdRead: MediaModuleKind[] = [];
  const modulesCandidateSupport: MediaModuleKind[] = [];
  const modulesConfirmed: MediaModuleKind[] = [];

  for (const entry of Array.isArray(rec["activeModulesFromDetector"])
    ? rec["activeModulesFromDetector"]
    : []) {
    const kind = moduleKind(asRecord(entry)["kind"]);
    if (kind) pushUnique(activeModules, kind);
  }

  for (const item of Array.isArray(rec["modules"]) ? rec["modules"] : []) {
    const mod = asRecord(item);
    const kind = moduleKind(mod["module"]);
    if (!kind) continue;
    const status = mod["status"];
    if (status === "active" || status === "support_active") {
      pushUnique(activeModules, kind);
    }
    const seal = asRecord(mod["seal"]);
    if (
      seal["attempted"] === true &&
      (typeof seal["independentSealCount"] !== "number" ||
        seal["independentSealCount"] > 0)
    ) {
      pushUnique(modulesSealed, kind);
    }
    const search = asRecord(mod["search"]);
    if (search["idRead"] === true) pushUnique(modulesIdRead, kind);
    if (search["candidateOnly"] === true) {
      pushUnique(modulesCandidateSupport, kind);
    }
    if (search["idMatched"] === true) pushUnique(modulesConfirmed, kind);
  }

  const official = asRecord(rec["officialDecision"]);
  const sourceResult = cleanString(official["finalDecision"], 80);

  return {
    activeModules,
    modulesSealed,
    modulesIdRead,
    modulesCandidateSupport,
    modulesConfirmed,
    ...(sourceResult ? { sourceResult } : {}),
  };
}

export function summarizeTextCommonDecision(decision: unknown): Pick<
  SecureRoomSummaryInput,
  | "activeModules"
  | "modulesSealed"
  | "modulesIdRead"
  | "modulesCandidateSupport"
  | "modulesConfirmed"
  | "sourceResult"
> {
  const rec = asRecord(decision);
  const officialDecision = cleanString(rec["officialDecision"], 80);
  const confirmed = rec["confirmed"] === true;
  const candidateSupport = rec["candidateSupport"] === true;
  const idRead = rec["idRead"] === true;
  return {
    activeModules: ["text"],
    modulesSealed: rec["phase"] === "seal" ? ["text"] : [],
    modulesIdRead: idRead ? ["text"] : [],
    modulesCandidateSupport: candidateSupport ? ["text"] : [],
    modulesConfirmed: confirmed ? ["text"] : [],
    ...(officialDecision ? { sourceResult: officialDecision } : {}),
  };
}

export async function recordSecureRoomModuleSummary(
  input: SecureRoomSummaryInput,
): Promise<{ row: AuditLog; secureRoom: SecureRoomSummaryPayload["response"] }> {
  const payload = buildSecureRoomSummaryPayload(input);
  const row = await recordEvent({
    ip: input.ip,
    route: input.route,
    kind: "Secure_Room_Event",
    ...(input.userId ? { userId: input.userId } : {}),
    details: payload.details,
  });
  return { row, secureRoom: payload.response };
}

export function recordSecureRoomModuleSummaryFireAndForget(
  input: SecureRoomSummaryInput,
): void {
  const payload = buildSecureRoomSummaryPayload(input);
  recordEventFireAndForget({
    ip: input.ip,
    route: input.route,
    kind: "Secure_Room_Event",
    ...(input.userId ? { userId: input.userId } : {}),
    details: payload.details,
  });
}

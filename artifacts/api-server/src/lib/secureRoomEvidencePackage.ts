import {
  digestPayload,
} from "@workspace/aegis-core";
import {
  listEvents,
  recordEvent,
  type AuditLog,
} from "./auditStore";
import {
  MEDIA_MODULES,
  cleanString,
  type MediaModuleKind,
  type SecureRoomZehirCandidate,
  type SecureRoomZehirCandidateSession,
  type ZehirProtectionLabel,
  type ZehirProtectionLevel,
  type ZehirTriggerMode,
} from "./secureRoomSummary";
import { submitTimestampFireAndForget } from "./timestampSubmit";
import type { LargeFileAnalysisCopyFlow } from "./largeFileAnalysis";
import {
  screenToCameraFromDetails,
  type ScreenToCameraDisplay,
} from "./screenToCameraDisplay";
import {
  detectC2paReadOnlyStatus,
  type C2paReadOnlyStatusReport,
} from "./c2paStatus";

const EVIDENCE_PACKAGE_VERSION = "secure-room-evidence-package-v0.1";
const OTS_KIND = "evidence_package" as const;

export interface SecureRoomEvidencePackageInput {
  ip: string;
  route: string;
  fileId: string;
  copyId: string;
  sessionId: string;
  userId?: string;
  screenSessionId?: string;
  checkpointId?: string;
  contentHashSha256?: string;
  copyHashSha256?: string;
  c2paSourcePath?: string;
  c2paFileName?: string;
  c2paMimeType?: string;
  submitOpenTimestamps?: boolean;
  note?: string;
}

interface SourceEventSummary {
  auditId: number;
  ts: Date;
  route: string;
  eventType: string | null;
  sourceResult: string | null;
  finalDecision: string | null;
  candidateSupport: boolean;
  confirmed: boolean;
  canOpenVault: boolean;
  vaultCapable: boolean;
  modulesCandidateSupport: MediaModuleKind[];
  modulesConfirmed: MediaModuleKind[];
  supportDetails: Record<string, unknown> | null;
  largeFileStrategy: LargeFileAnalysisCopyFlow | null;
  screenToCamera: ScreenToCameraDisplay;
}

interface ModuleEvidenceSummary {
  module: MediaModuleKind;
  active: boolean;
  sealed: boolean;
  idRead: boolean;
  candidateSupport: boolean;
  confirmed: boolean;
}

export interface SecureRoomEvidencePackage {
  status: "record_only_v0.2";
  packageVersion: typeof EVIDENCE_PACKAGE_VERSION;
  generatedAt: string;
  identity: {
    fileId: string;
    copyId: string;
    sessionId: string;
    userId: string | null;
    screenSessionId: string | null;
  };
  hashes: {
    evidencePackageSha256: string;
    contentHashSha256: string | null;
    copyHashSha256: string | null;
    fileContentIncluded: false;
  };
  openTimestamps: {
    status: "OTS_SUBMISSION_QUEUED" | "OTS_HASH_READY_OFFLINE";
    kind: typeof OTS_KIND;
    referenceId: string;
    payloadSha256: string;
    digestOnly: true;
    fileContentSent: false;
    proofLookupPath: string;
    verifyPath: "/api/aegis/timestamp/verify";
    canOpenVault: false;
    vaultCapable: false;
    confirmed: false;
    idMatched: false;
    note: string;
  };
  traceability: {
    sourceAuditIds: number[];
    sourceEventCount: number;
    checkpointId: string | null;
  };
  sourceEvents: SourceEventSummary[];
  moduleSummary: ModuleEvidenceSummary[];
  confirmedSignals: MediaModuleKind[];
  candidateSupportSignals: MediaModuleKind[];
  zehirCandidates: SecureRoomZehirCandidate[];
  zehirCandidateSessions: SecureRoomZehirCandidateSession[];
  screenToCameraCandidates: ScreenToCameraDisplay[];
  largeFileStrategies: LargeFileAnalysisCopyFlow[];
  sourceDecisions: string[];
  contentCredentials: C2paReadOnlyStatusReport | null;
  safety: {
    recordOnly: true;
    finalDecision: "RECORD_ONLY_NOT_VAULT";
    canOpenVault: false;
    vaultCapable: false;
    confirmed: false;
    idMatched: false;
    candidateSupportIsNotConfirmed: true;
    moduleIdsAreNotCombined: true;
    secureRoomDoesNotDecide: true;
    zehirDoesNotDecide: true;
    evidencePackageDoesNotDecide: true;
    screenToCameraDoesNotDecide: true;
  };
  note: string;
}

type UnsignedEvidencePackage = Omit<
  SecureRoomEvidencePackage,
  "hashes" | "openTimestamps"
> & {
  hashes: Omit<SecureRoomEvidencePackage["hashes"], "evidencePackageSha256">;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function moduleArray(value: unknown): MediaModuleKind[] {
  const seen = new Set<MediaModuleKind>();
  for (const item of stringArray(value)) {
    if (MEDIA_MODULES.includes(item as MediaModuleKind)) {
      seen.add(item as MediaModuleKind);
    }
  }
  return Array.from(seen);
}

function bool(value: unknown): boolean {
  return value === true;
}

function protectionLevel(value: unknown): ZehirProtectionLevel | null {
  return value === "light" || value === "medium" || value === "hard"
    ? value
    : null;
}

function triggerMode(value: unknown): ZehirTriggerMode | null {
  return value === "manual" || value === "automatic_candidate" ? value : null;
}

function protectionLabelForLevel(
  level: ZehirProtectionLevel,
): ZehirProtectionLabel {
  if (level === "medium") return "Orta koruma seviyesi";
  if (level === "hard") return "Sert koruma seviyesi";
  return "Hafif koruma seviyesi";
}

function nullableRecord(value: unknown): Record<string, unknown> | null {
  const rec = asRecord(value);
  return Object.keys(rec).length > 0 ? rec : null;
}

function normalizeLargeFileStrategy(value: unknown): LargeFileAnalysisCopyFlow | null {
  const rec = asRecord(value);
  if (rec["status"] !== "large_file_analysis_copy_ready") return null;
  const secureRoom = asRecord(rec["secureRoom"]);
  const safety = asRecord(rec["safety"]);
  if (
    secureRoom["finalDecision"] !== "RECORD_ONLY_NOT_VAULT" ||
    secureRoom["canOpenVault"] !== false ||
    secureRoom["vaultCapable"] !== false ||
    secureRoom["confirmed"] !== false ||
    secureRoom["idMatched"] !== false ||
    safety["originalFileModified"] !== false ||
    safety["fileContentSentOutside"] !== false
  ) {
    return null;
  }
  return rec as unknown as LargeFileAnalysisCopyFlow;
}

function cleanSha256(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const raw = input[key];
      if (typeof raw !== "undefined") out[key] = canonicalize(raw);
    }
    return out;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sourceEvent(row: AuditLog): SourceEventSummary {
  const details = asRecord(row.details);
  const supportDetails = nullableRecord(details["supportDetails"]);
  const screenToCamera = screenToCameraFromDetails(details);
  return {
    auditId: row.id,
    ts: row.ts,
    route: row.route,
    eventType: cleanString(details["eventType"], 80),
    sourceResult: cleanString(details["sourceResult"], 80),
    finalDecision: cleanString(details["finalDecision"], 80),
    candidateSupport: bool(details["candidateSupport"]),
    confirmed: bool(details["confirmed"]),
    canOpenVault: bool(details["canOpenVault"]),
    vaultCapable: bool(details["vaultCapable"]),
    modulesCandidateSupport: moduleArray(details["modulesCandidateSupport"]),
    modulesConfirmed: moduleArray(details["modulesConfirmed"]),
    supportDetails,
    largeFileStrategy: normalizeLargeFileStrategy(
      supportDetails?.["largeFileStrategy"] ?? details["largeFileStrategy"],
    ),
    screenToCamera,
  };
}

function hasMatchingScreenSession(
  details: Record<string, unknown>,
  screenSessionId: string | undefined,
): boolean {
  if (!screenSessionId) return true;
  if (details["screenSessionId"] === screenSessionId) return true;
  const zehirCandidate = asRecord(details["zehirCandidate"]);
  return zehirCandidate["screenSessionId"] === screenSessionId;
}

function normalizeZehirCandidate(value: unknown): SecureRoomZehirCandidate | null {
  const rec = asRecord(value);
  if (rec["present"] !== true) return null;
  const candidateSession =
    normalizeZehirCandidateSession(rec["candidateSession"], rec) ??
    fallbackZehirCandidateSession(rec);
  return {
    present: true,
    eventType: cleanString(rec["eventType"], 80) ?? "zehir_candidate_support",
    screenSessionId: cleanString(rec["screenSessionId"], 256) ?? "unknown",
    signalType: cleanString(rec["signalType"], 80),
    sourceModules: moduleArray(rec["sourceModules"]),
    candidateSession,
    candidateSupport: bool(rec["candidateSupport"]),
    candidateSupportOnly: true,
    finalDecision: "RECORD_ONLY_NOT_VAULT",
    confirmed: false,
    idRead: false,
    idMatched: false,
    vaultCapable: false,
    canOpenVault: false,
  };
}

function fallbackZehirCandidateSession(
  rec: Record<string, unknown>,
): SecureRoomZehirCandidateSession {
  const version =
    rec["version"] === "zehir-v0.4-protection-record" ||
    rec["version"] === "zehir-v0.4-manual-light-protection"
      ? "zehir-v0.4-protection-record"
      : rec["version"] === "zehir-v0.3-session-trace-candidate"
      ? "zehir-v0.3-session-trace-candidate"
      : "zehir-v0.2-candidate-session";
  const isProtectionRecord = version === "zehir-v0.4-protection-record";
  const level = protectionLevel(rec["protectionLevel"]) ?? "light";
  const mode = triggerMode(rec["triggerMode"]) ?? "manual";
  return {
    version,
    screenSessionId: cleanString(rec["screenSessionId"], 256) ?? "unknown",
    fileId: cleanString(rec["fileId"], 256),
    copyId: cleanString(rec["copyId"], 256),
    sessionId: cleanString(rec["sessionId"], 256),
    userId: cleanString(rec["roomUserId"], 256),
    signalType: cleanString(rec["signalType"], 80),
    signalTypeKnown: bool(rec["signalTypeKnown"]),
    ...(version === "zehir-v0.3-session-trace-candidate"
      ? {
          traceDecision: "ZEHIR_SESSION_TRACE_CANDIDATE",
          traceLabel: "Ekran/oturum aday izi",
          traceScope: "screen_session_record_only",
        }
      : {}),
    ...(isProtectionRecord
      ? {
          triggerMode: mode,
          protectionLevel: level,
          protectionLabel: protectionLabelForLevel(level),
          reason: cleanString(rec["reason"], 500) ?? "not_reported",
          countdownSeconds: 30 as const,
          cancelAvailable: true as const,
          reversible: true as const,
          rollbackWindowHours: 24 as const,
          rollbackAvailable: true as const,
          rollbackStatus:
            rec["rollbackStatus"] === "rollback_requested"
              ? ("rollback_requested" as const)
              : ("available" as const),
          automaticProtectionCandidate:
            mode === "automatic_candidate" ? (true as const) : null,
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
    sourceModules: moduleArray(rec["sourceModules"]),
    candidateSupport: bool(rec["candidateSupport"]),
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

function normalizeZehirCandidateSession(
  value: unknown,
  fallback: Record<string, unknown>,
): SecureRoomZehirCandidateSession | null {
  const rec = asRecord(value);
  const screenSessionId =
    cleanString(rec["screenSessionId"], 256) ??
    cleanString(fallback["screenSessionId"], 256);
  if (!screenSessionId) return null;
  const version =
    rec["version"] === "zehir-v0.4-protection-record" ||
    fallback["version"] === "zehir-v0.4-protection-record" ||
    rec["version"] === "zehir-v0.4-manual-light-protection" ||
    fallback["version"] === "zehir-v0.4-manual-light-protection"
      ? "zehir-v0.4-protection-record"
      : rec["version"] === "zehir-v0.3-session-trace-candidate" ||
          fallback["version"] === "zehir-v0.3-session-trace-candidate"
      ? "zehir-v0.3-session-trace-candidate"
      : "zehir-v0.2-candidate-session";
  const isProtectionRecord = version === "zehir-v0.4-protection-record";
  const level =
    protectionLevel(rec["protectionLevel"]) ??
    protectionLevel(fallback["protectionLevel"]) ??
    "light";
  const mode =
    triggerMode(rec["triggerMode"]) ??
    triggerMode(fallback["triggerMode"]) ??
    "manual";
  return {
    version,
    screenSessionId,
    fileId: cleanString(rec["fileId"], 256) ?? cleanString(fallback["fileId"], 256),
    copyId: cleanString(rec["copyId"], 256) ?? cleanString(fallback["copyId"], 256),
    sessionId: cleanString(rec["sessionId"], 256) ?? cleanString(fallback["sessionId"], 256),
    userId: cleanString(rec["userId"], 256) ?? cleanString(fallback["roomUserId"], 256),
    signalType: cleanString(rec["signalType"], 80) ?? cleanString(fallback["signalType"], 80),
    signalTypeKnown: bool(rec["signalTypeKnown"]) || bool(fallback["signalTypeKnown"]),
    ...(version === "zehir-v0.3-session-trace-candidate"
      ? {
          traceDecision: "ZEHIR_SESSION_TRACE_CANDIDATE",
          traceLabel: "Ekran/oturum aday izi",
          traceScope: "screen_session_record_only",
        }
      : {}),
    ...(isProtectionRecord
      ? {
          triggerMode: mode,
          protectionLevel: level,
          protectionLabel: protectionLabelForLevel(level),
          reason:
            cleanString(rec["reason"], 500) ??
            cleanString(fallback["reason"], 500) ??
            "not_reported",
          countdownSeconds: 30 as const,
          cancelAvailable: true as const,
          reversible: true as const,
          rollbackWindowHours: 24 as const,
          rollbackAvailable: true as const,
          rollbackStatus:
            rec["rollbackStatus"] === "rollback_requested" ||
            fallback["rollbackStatus"] === "rollback_requested"
              ? ("rollback_requested" as const)
              : ("available" as const),
          automaticProtectionCandidate:
            mode === "automatic_candidate" ? (true as const) : null,
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
    sourceModules: moduleArray(rec["sourceModules"]).length > 0
      ? moduleArray(rec["sourceModules"])
      : moduleArray(fallback["sourceModules"]),
    candidateSupport: bool(rec["candidateSupport"]) || bool(fallback["candidateSupport"]),
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

function uniqueZehirCandidateSessions(
  sessions: SecureRoomZehirCandidateSession[],
): SecureRoomZehirCandidateSession[] {
  const seen = new Map<string, SecureRoomZehirCandidateSession>();
  for (const session of sessions) {
    const key = [
      session.screenSessionId,
      session.fileId ?? "",
      session.copyId ?? "",
      session.sessionId ?? "",
      session.signalType ?? "",
    ].join("|");
    if (!seen.has(key)) seen.set(key, session);
  }
  return Array.from(seen.values());
}

function uniqueLargeFileStrategies(
  strategies: LargeFileAnalysisCopyFlow[],
): LargeFileAnalysisCopyFlow[] {
  const seen = new Map<string, LargeFileAnalysisCopyFlow>();
  for (const strategy of strategies) {
    const key = [
      strategy.identity.fileId,
      strategy.identity.copyId,
      strategy.identity.sessionId,
      strategy.original.sha256Before,
      strategy.analysisCopy.sha256,
    ].join("|");
    if (!seen.has(key)) seen.set(key, strategy);
  }
  return Array.from(seen.values());
}

function uniqueScreenToCameraCandidates(
  candidates: ScreenToCameraDisplay[],
): ScreenToCameraDisplay[] {
  const seen = new Map<string, ScreenToCameraDisplay>();
  for (const candidate of candidates) {
    const key = [
      candidate.status,
      candidate.userStatus,
      candidate.confidenceBand ?? "none",
    ].join("|");
    if (!seen.has(key)) seen.set(key, candidate);
  }
  return Array.from(seen.values());
}

function buildModuleSummary(events: SourceEventSummary[]): ModuleEvidenceSummary[] {
  return MEDIA_MODULES.map((module) => ({
    module,
    active: events.some(
      (event) =>
        event.modulesCandidateSupport.includes(module) ||
        event.modulesConfirmed.includes(module),
    ),
    sealed: false,
    idRead: false,
    candidateSupport: events.some((event) =>
      event.modulesCandidateSupport.includes(module),
    ),
    confirmed: events.some((event) => event.modulesConfirmed.includes(module)),
  }));
}

export async function buildSecureRoomEvidencePackage(
  input: SecureRoomEvidencePackageInput,
): Promise<SecureRoomEvidencePackage> {
  const contentCredentials = input.c2paSourcePath
    ? await detectC2paReadOnlyStatus({
        sourcePath: input.c2paSourcePath,
        fileName: input.c2paFileName,
        mimeType: input.c2paMimeType,
      })
    : null;
  const rows = await listEvents({ kind: "Secure_Room_Event", limit: 500 });
  const matchedRows = rows.filter((row) => {
    const details = asRecord(row.details);
    return (
      details["fileId"] === input.fileId &&
      details["copyId"] === input.copyId &&
      details["sessionId"] === input.sessionId &&
      hasMatchingScreenSession(details, input.screenSessionId)
    );
  });
  const events = matchedRows.map(sourceEvent);
  const moduleSummary = buildModuleSummary(events);
  const confirmedSignals = moduleSummary
    .filter((item) => item.confirmed)
    .map((item) => item.module);
  const candidateSupportSignals = moduleSummary
    .filter((item) => item.candidateSupport)
    .map((item) => item.module);
  const zehirCandidates = matchedRows
    .map((row) => normalizeZehirCandidate(asRecord(row.details)["zehirCandidate"]))
    .filter((item): item is SecureRoomZehirCandidate => item !== null);
  const zehirCandidateSessions = uniqueZehirCandidateSessions([
    ...zehirCandidates.map((candidate) => candidate.candidateSession),
    ...matchedRows
      .map((row) => {
        const details = asRecord(row.details);
        return normalizeZehirCandidateSession(details["candidateSession"], details);
      })
      .filter((item): item is SecureRoomZehirCandidateSession => item !== null),
  ]);
  const largeFileStrategies = uniqueLargeFileStrategies(
    events
      .map((event) => event.largeFileStrategy)
      .filter((item): item is LargeFileAnalysisCopyFlow => item !== null),
  );
  const screenToCameraCandidates = uniqueScreenToCameraCandidates(
    events
      .map((event) => event.screenToCamera)
      .filter((item) => item.present),
  );
  const sourceDecisions = Array.from(
    new Set(
      events
        .map((event) => event.sourceResult ?? event.finalDecision)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const unsignedPackage: UnsignedEvidencePackage = {
    status: "record_only_v0.2",
    packageVersion: EVIDENCE_PACKAGE_VERSION,
    generatedAt: new Date().toISOString(),
    identity: {
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      screenSessionId: input.screenSessionId ?? null,
    },
    hashes: {
      contentHashSha256: cleanSha256(input.contentHashSha256),
      copyHashSha256: cleanSha256(input.copyHashSha256),
      fileContentIncluded: false as const,
    },
    traceability: {
      sourceAuditIds: events.map((event) => event.auditId),
      sourceEventCount: events.length,
      checkpointId: input.checkpointId ?? null,
    },
    sourceEvents: events,
    moduleSummary,
    confirmedSignals,
    candidateSupportSignals,
    zehirCandidates,
    zehirCandidateSessions,
    screenToCameraCandidates,
    largeFileStrategies,
    sourceDecisions,
    contentCredentials,
    safety: {
      recordOnly: true,
      finalDecision: "RECORD_ONLY_NOT_VAULT",
      canOpenVault: false,
      vaultCapable: false,
      confirmed: false,
      idMatched: false,
      candidateSupportIsNotConfirmed: true,
      moduleIdsAreNotCombined: true,
      secureRoomDoesNotDecide: true,
      zehirDoesNotDecide: true,
      evidencePackageDoesNotDecide: true,
      screenToCameraDoesNotDecide: true,
    },
    note:
      input.note ??
      "Evidence package v0.1 summarizes existing Secure Room records only. It does not decide, confirm, combine IDs, or open VAULT.",
  };
  const evidencePackageSha256 = digestPayload(canonicalJson(unsignedPackage));
  const referenceId = `evidence:${evidencePackageSha256.slice(0, 32)}`;
  const submitOpenTimestamps = input.submitOpenTimestamps !== false;
  const proofLookupPath = `/api/aegis/timestamp/${OTS_KIND}/${referenceId}`;
  const evidencePackage: SecureRoomEvidencePackage = {
    ...unsignedPackage,
    hashes: {
      ...unsignedPackage.hashes,
      evidencePackageSha256,
    },
    openTimestamps: {
      status: submitOpenTimestamps ? "OTS_SUBMISSION_QUEUED" : "OTS_HASH_READY_OFFLINE",
      kind: OTS_KIND,
      referenceId,
      payloadSha256: evidencePackageSha256,
      digestOnly: true,
      fileContentSent: false,
      proofLookupPath,
      verifyPath: "/api/aegis/timestamp/verify",
      canOpenVault: false,
      vaultCapable: false,
      confirmed: false,
      idMatched: false,
      note: submitOpenTimestamps
        ? "Only the canonical evidence package hash is queued for OpenTimestamps. File contents are not sent."
        : "Offline hash-only OpenTimestamps preparation. Submit this digest later; file contents are not sent.",
    },
  };

  if (submitOpenTimestamps) {
    submitTimestampFireAndForget({
      kind: OTS_KIND,
      referenceId,
      payload: canonicalJson(unsignedPackage),
    });
  }

  return evidencePackage;
}

export async function recordSecureRoomEvidencePackage(
  input: SecureRoomEvidencePackageInput,
): Promise<{ row: AuditLog; evidencePackage: SecureRoomEvidencePackage }> {
  const evidencePackage = await buildSecureRoomEvidencePackage(input);
  const row = await recordEvent({
    ip: input.ip,
    route: input.route,
    kind: "Secure_Room_Event",
    ...(input.userId ? { userId: input.userId } : {}),
    details: {
      version: EVIDENCE_PACKAGE_VERSION,
      eventType: "evidence_package_created",
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      roomUserId: input.userId ?? null,
      screenSessionId: input.screenSessionId ?? null,
      sourceAuditIds: evidencePackage.traceability.sourceAuditIds,
      sourceEventCount: evidencePackage.traceability.sourceEventCount,
      checkpointId: input.checkpointId ?? null,
      evidencePackageSha256: evidencePackage.hashes.evidencePackageSha256,
      contentHashSha256: evidencePackage.hashes.contentHashSha256,
      copyHashSha256: evidencePackage.hashes.copyHashSha256,
      openTimestamps: evidencePackage.openTimestamps,
      finalDecision: "RECORD_ONLY_NOT_VAULT",
      canOpenVault: false,
      vaultCapable: false,
      confirmed: false,
      idMatched: false,
      candidateSupportSignals: evidencePackage.candidateSupportSignals,
      confirmedSignals: evidencePackage.confirmedSignals,
      zehirCandidateCount: evidencePackage.zehirCandidates.length,
      zehirCandidateSessionCount: evidencePackage.zehirCandidateSessions.length,
      zehirCandidateSessions: evidencePackage.zehirCandidateSessions,
      screenToCameraCandidateCount: evidencePackage.screenToCameraCandidates.length,
      screenToCameraCandidates: evidencePackage.screenToCameraCandidates,
      largeFileStrategyCount: evidencePackage.largeFileStrategies.length,
      largeFileStrategies: evidencePackage.largeFileStrategies,
      contentCredentials: evidencePackage.contentCredentials,
      evidencePackage,
      safety: evidencePackage.safety,
    },
  });
  return { row, evidencePackage };
}

import {
  buildSecureRoomEvidencePackage,
  type SecureRoomEvidencePackage,
  type SecureRoomEvidencePackageInput,
} from "./secureRoomEvidencePackage";
import { cleanString } from "./secureRoomSummary";

const C2PA_DRAFT_VERSION = "c2pa-read-only-hook-v0.1";

export interface C2paDraftInput extends SecureRoomEvidencePackageInput {
  evidencePackageId?: string;
  openTimestamps?: Record<string, unknown>;
}

export interface C2paDraftPayload {
  status: "C2PA_DRAFT_ONLY";
  hookVersion: typeof C2PA_DRAFT_VERSION;
  generatedAt: string;
  identity: {
    fileId: string;
    copyId: string;
    sessionId: string;
    userId: string | null;
    screenSessionId: string | null;
    evidencePackageId: string | null;
  };
  c2paDraft: {
    label: "AEGIS_C2PA_DRAFT_ONLY";
    intendedUse: "future_customer_c2pa_manifest_input";
    manifestWritten: false;
    fileMetadataWritten: false;
    externalServiceCalled: false;
    certificateUsed: false;
    signatureCreated: false;
  };
  contentCredentials: SecureRoomEvidencePackage["contentCredentials"];
  aegisSummary: {
    evidencePackageVersion: SecureRoomEvidencePackage["packageVersion"];
    sourceAuditIds: number[];
    sourceEventCount: number;
    checkpointId: string | null;
    moduleSummary: SecureRoomEvidencePackage["moduleSummary"];
    confirmedSignals: SecureRoomEvidencePackage["confirmedSignals"];
    candidateSupportSignals: SecureRoomEvidencePackage["candidateSupportSignals"];
    zehirCandidates: SecureRoomEvidencePackage["zehirCandidates"];
    zehirCandidateSessions: SecureRoomEvidencePackage["zehirCandidateSessions"];
    largeFileStrategies: SecureRoomEvidencePackage["largeFileStrategies"];
    advisorySupportEvents: Array<{
      auditId: number;
      eventType: string | null;
      sourceResult: string | null;
      supportDetails: Record<string, unknown> | null;
    }>;
    sourceDecisions: string[];
    openTimestamps: Record<string, unknown> | null;
  };
  safety: {
    draftOnly: true;
    finalDecision: "C2PA_DRAFT_ONLY";
    c2paDoesNotDecide: true;
    c2paDoesNotOpenVault: true;
    c2paDoesNotConfirm: true;
    c2paMetadataIsNotAnAccusation: true;
    canOpenVault: false;
    vaultCapable: false;
    confirmed: false;
    idMatched: false;
    candidateSupportIsNotConfirmed: true;
    moduleIdsAreNotCombined: true;
    secureRoomRecordOnly: true;
    zehirCandidateSupportOnly: true;
    evidencePackageDoesNotDecide: true;
    noManifestWritten: true;
    noFileMetadataWritten: true;
    noExternalService: true;
    noCertificateUsed: true;
    noSignatureCreated: true;
  };
  note: string;
}

function safeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => safeJsonValue(item, depth + 1))
      .filter((item) => typeof item !== "undefined");
  }
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = cleanString(key, 80);
    if (!cleanKey) continue;
    const cleanValue = safeJsonValue(raw, depth + 1);
    if (typeof cleanValue !== "undefined") out[cleanKey] = cleanValue;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  const cleaned = safeJsonValue(value);
  return cleaned && typeof cleaned === "object" && !Array.isArray(cleaned)
    ? (cleaned as Record<string, unknown>)
    : null;
}

export async function buildC2paDraftPayload(
  input: C2paDraftInput,
): Promise<C2paDraftPayload> {
  const evidencePackage = await buildSecureRoomEvidencePackage({
    ...input,
    submitOpenTimestamps: false,
  });
  const openTimestamps =
    safeRecord(input.openTimestamps) ?? safeRecord(evidencePackage.openTimestamps);

  return {
    status: "C2PA_DRAFT_ONLY",
    hookVersion: C2PA_DRAFT_VERSION,
    generatedAt: new Date().toISOString(),
    identity: {
      fileId: input.fileId,
      copyId: input.copyId,
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      screenSessionId: input.screenSessionId ?? null,
      evidencePackageId:
        input.evidencePackageId ?? evidencePackage.openTimestamps.referenceId,
    },
    c2paDraft: {
      label: "AEGIS_C2PA_DRAFT_ONLY",
      intendedUse: "future_customer_c2pa_manifest_input",
      manifestWritten: false,
      fileMetadataWritten: false,
      externalServiceCalled: false,
      certificateUsed: false,
      signatureCreated: false,
    },
    contentCredentials: evidencePackage.contentCredentials,
    aegisSummary: {
      evidencePackageVersion: evidencePackage.packageVersion,
      sourceAuditIds: evidencePackage.traceability.sourceAuditIds,
      sourceEventCount: evidencePackage.traceability.sourceEventCount,
      checkpointId: evidencePackage.traceability.checkpointId,
      moduleSummary: evidencePackage.moduleSummary,
      confirmedSignals: evidencePackage.confirmedSignals,
      candidateSupportSignals: evidencePackage.candidateSupportSignals,
      zehirCandidates: evidencePackage.zehirCandidates,
      zehirCandidateSessions: evidencePackage.zehirCandidateSessions,
      largeFileStrategies: evidencePackage.largeFileStrategies,
      advisorySupportEvents: evidencePackage.sourceEvents
        .filter((event) => event.candidateSupport)
        .map((event) => ({
          auditId: event.auditId,
          eventType: event.eventType,
          sourceResult: event.sourceResult,
          supportDetails: event.supportDetails,
        })),
      sourceDecisions: evidencePackage.sourceDecisions,
      openTimestamps,
    },
    safety: {
      draftOnly: true,
      finalDecision: "C2PA_DRAFT_ONLY",
      c2paDoesNotDecide: true,
      c2paDoesNotOpenVault: true,
      c2paDoesNotConfirm: true,
      c2paMetadataIsNotAnAccusation: true,
      canOpenVault: false,
      vaultCapable: false,
      confirmed: false,
      idMatched: false,
      candidateSupportIsNotConfirmed: true,
      moduleIdsAreNotCombined: true,
      secureRoomRecordOnly: evidencePackage.safety.recordOnly,
      zehirCandidateSupportOnly: true,
      evidencePackageDoesNotDecide: evidencePackage.safety.evidencePackageDoesNotDecide,
      noManifestWritten: true,
      noFileMetadataWritten: true,
      noExternalService: true,
      noCertificateUsed: true,
      noSignatureCreated: true,
    },
    note:
      input.note ??
      "C2PA v0.1 read-only hook draft. This payload is not signed, not official, not embedded into a file, and cannot open VAULT.",
  };
}

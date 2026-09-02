import type {
  LiveProductManifestRecord,
  LiveProductRecordingRecord,
  LiveProductSegmentRecord,
  LiveProductSession,
} from "./liveProductStore";

export interface LiveProductEvidenceV1 {
  schemaVersion: "tancmark-live-local-evidence-v1";
  evidenceId: string;
  sessionId: string;
  tenantBindingSha256: string;
  sessionRevision: number;
  statusAtFinalization: "STOPPING";
  segmentCount: number;
  totalBytes: number;
  firstSegmentSha256: string | null;
  lastSegmentSha256: string | null;
  byteHashChainHeadSha256: string;
  manifest: {
    manifestId: string;
    sha256: string;
    relativeUrl: string;
  };
  init: { sha256: string; byteLength: number };
  recording: { recordingId: string; sha256: string; byteLength: number; relativeUrl: string };
  protectionMode: "PROTECTED_TANCMARK" | "TRANSPORT_ONLY";
  expectedIdProvided: boolean;
  identityAuthorityMode: "SERVER_OWNED_SIGNED_EXACT" | "TRANSPORT_SUPPORT_ONLY" | "TARGETED_EXPECTED_ID_SUPPORT_ONLY";
  registryBindingState: LiveProductSession["registryBindingState"];
  signedMapState: LiveProductSession["signedMapState"];
  finalVerificationState: LiveProductSession["finalVerificationState"];
  generatedAt: string;
  transportStorageEvidenceOnly: boolean;
  supportOnly: boolean;
  ownership: boolean;
  vault: boolean;
  canOpenVault: boolean;
  confirmed: boolean;
  final: boolean;
}

export function buildLiveProductEvidence(input: {
  session: LiveProductSession;
  segments: readonly LiveProductSegmentRecord[];
  manifest: LiveProductManifestRecord;
  recording: LiveProductRecordingRecord;
  tenantBindingSha256: string;
}): LiveProductEvidenceV1 {
  if (input.session.status !== "STOPPING") throw new Error("live_evidence_requires_stopping_session");
  const first = input.segments[0] ?? null;
  const last = input.segments[input.segments.length - 1] ?? null;
  const exactFinal = input.session.protectionMode === "PROTECTED_TANCMARK" &&
    input.session.finalVerificationState === "EXACT_VERIFIED" &&
    input.session.registryBindingState === "ACTIVE" &&
    input.session.signedMapState === "FINALIZED";
  return {
    schemaVersion: "tancmark-live-local-evidence-v1",
    evidenceId: `evidence-${input.recording.sha256.slice(0, 32)}`,
    sessionId: input.session.sessionId,
    tenantBindingSha256: input.tenantBindingSha256,
    sessionRevision: input.session.revision,
    statusAtFinalization: "STOPPING",
    segmentCount: input.segments.length,
    totalBytes: input.segments.reduce((sum, segment) => sum + segment.byteLength, 0),
    firstSegmentSha256: first?.sha256 ?? null,
    lastSegmentSha256: last?.sha256 ?? null,
    byteHashChainHeadSha256: input.session.chainHeadSha256,
    manifest: {
      manifestId: input.manifest.manifestId,
      sha256: input.manifest.sha256,
      relativeUrl: input.manifest.relativeUrl,
    },
    init: { sha256: input.session.initSha256 as string, byteLength: input.session.initByteLength },
    recording: { recordingId: input.recording.recordingId, sha256: input.recording.sha256, byteLength: input.recording.byteLength, relativeUrl: input.recording.relativeUrl },
    protectionMode: input.session.protectionMode,
    expectedIdProvided: input.session.expectedIdProvided,
    identityAuthorityMode: input.session.identityAuthorityMode,
    registryBindingState: input.session.registryBindingState,
    signedMapState: input.session.signedMapState,
    finalVerificationState: input.session.finalVerificationState,
    generatedAt: new Date().toISOString(),
    transportStorageEvidenceOnly: input.session.protectionMode === "TRANSPORT_ONLY",
    supportOnly: !exactFinal,
    ownership: exactFinal,
    vault: exactFinal,
    canOpenVault: exactFinal,
    confirmed: exactFinal,
    final: exactFinal,
  };
}

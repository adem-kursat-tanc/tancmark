import path from "node:path";
import { normalizeId, payload4 } from "./aegisCore";
import {
  decodeAudioV01FromDna,
  type AudioV01DecodeTelemetry,
} from "./audioModule";
import {
  buildAudioSupportAdvisory,
  type AudioSupportLevel,
} from "./audioSupportAdvisory";

export type AudioPreSealOwnershipAction =
  | "allow"
  | "block"
  | "manual_review";

export type AudioPreSealOwnershipReason =
  | "no_exact_audio_id_found"
  | "no_audio_registry_records_to_scan"
  | "audio_owned_by_current_client"
  | "audio_owned_by_different_client"
  | "audio_exact_id_registry_missing"
  | "multiple_registered_audio_owners";

export interface AudioPreSealRegistryRecord {
  dnaId: string;
  idHex: string;
  payload4Hex?: string | null;
  clientId: string | null;
  createdAt?: string | Date | null;
  dna: unknown;
}

export interface AudioPreSealReadout {
  source: "registry_scan" | "observed_read";
  dnaId?: string | null;
  idHex?: string | null;
  registryClientId?: string | null;
  registeredAt?: string | null;
  idMatched: boolean;
  matchingBitsMax: number;
  verdict?: string;
  note?: string;
}

export interface AudioPreSealOwnershipCheckInput {
  audioPath: string;
  workDir?: string;
  currentClientId: string;
  registryRecords?: AudioPreSealRegistryRecord[];
  observedReadouts?: AudioPreSealReadout[];
  scanLimit?: number;
  decodeRecord?: (input: {
    audioPath: string;
    workDir: string;
    record: AudioPreSealRegistryRecord;
    expectedPayload4Hex: string;
  }) => Promise<AudioV01DecodeTelemetry>;
}

export interface AudioPreSealOwnershipResult {
  action: AudioPreSealOwnershipAction;
  block: boolean;
  reason: AudioPreSealOwnershipReason;
  exactIdFound: boolean;
  decodedId: string | null;
  registeredClientId: string | null;
  registeredAt: string | null;
  exactMatchBits: number;
  matchingBits: number;
  matchPercent: number;
  audioSupportLevel: AudioSupportLevel;
  candidateSupportOnly: boolean;
  partialReadouts: AudioPreSealReadout[];
  exactReadouts: AudioPreSealReadout[];
  ignoredSignalsForBlocking: string[];
  confirmed: false;
  canOpenVault: false;
  vaultEligible: false;
  final: false;
  c2paCanBlock: false;
  decisionRole: "audio_pre_seal_exact_id_registry_only_no_vault_no_confirmed";
}

export interface AudioPreSealOwnershipStopResponse {
  error: "audio_preseal_ownership_blocked" | "audio_preseal_ownership_manual_review";
  message: string;
  preSealOwnership: {
    action: AudioPreSealOwnershipAction;
    block: boolean;
    reason: AudioPreSealOwnershipReason;
    exactIdFound: boolean;
    decodedId: string | null;
    registeredClientId: string | null;
    registeredAt: string | null;
    exactMatchBits: number;
    matchingBits: number;
    matchPercent: number;
    audioSupportLevel: AudioSupportLevel;
    candidateSupportOnly: boolean;
    partialReadoutCount: number;
    exactReadoutCount: number;
    blockingSignals: string[];
    ignoredSignalsForBlocking: string[];
    confirmed: false;
    canOpenVault: false;
    vaultEligible: false;
    final: false;
    c2paCanBlock: false;
    decisionRole: "audio_pre_seal_exact_id_registry_only_no_vault_no_confirmed";
  };
}

export interface AudioPreSealEncodeGateResult {
  allowEncode: boolean;
  statusCode: 200 | 409;
  responseBody: AudioPreSealOwnershipStopResponse | null;
}

const DEFAULT_AUDIO_PRESEAL_SCAN_LIMIT = 20;

const IGNORED_SIGNALS_FOR_BLOCKING = [
  "partial_31_or_lower",
  "candidate_support",
  "dna_advisory",
  "c2pa",
  "ecc",
  "ocr",
  "metadata",
  "unsealed_audio",
] as const;

function normalizeScanLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_PRESEAL_SCAN_LIMIT;
  return Math.min(
    DEFAULT_AUDIO_PRESEAL_SCAN_LIMIT,
    Math.max(1, Math.floor(value ?? DEFAULT_AUDIO_PRESEAL_SCAN_LIMIT)),
  );
}

function registeredAtToString(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function advisoryForReadouts(readouts: AudioPreSealReadout[]) {
  const matchingBits = readouts.reduce(
    (best, readout) => Math.max(best, readout.matchingBitsMax),
    0,
  );
  return buildAudioSupportAdvisory(matchingBits);
}

function baseResult(input: {
  action: AudioPreSealOwnershipAction;
  reason: AudioPreSealOwnershipReason;
  exactIdFound: boolean;
  decodedId?: string | null;
  registeredClientId?: string | null;
  registeredAt?: string | null;
  readouts: AudioPreSealReadout[];
}): AudioPreSealOwnershipResult {
  const advisory = advisoryForReadouts(input.readouts);
  const exactReadouts = input.readouts.filter(
    (readout) =>
      readout.idMatched &&
      buildAudioSupportAdvisory(readout.matchingBitsMax).matchingBits ===
        advisory.exactMatchBits,
  );
  const partialReadouts = input.readouts.filter(
    (readout) =>
      buildAudioSupportAdvisory(readout.matchingBitsMax).matchingBits > 0 &&
      buildAudioSupportAdvisory(readout.matchingBitsMax).matchingBits <
        advisory.exactMatchBits,
  );

  return {
    action: input.action,
    block: input.action === "block",
    reason: input.reason,
    exactIdFound: input.exactIdFound,
    decodedId: input.decodedId ?? null,
    registeredClientId: input.registeredClientId ?? null,
    registeredAt: input.registeredAt ?? null,
    exactMatchBits: advisory.exactMatchBits,
    matchingBits: advisory.matchingBits,
    matchPercent: advisory.matchPercent,
    audioSupportLevel: advisory.audioSupportLevel,
    candidateSupportOnly: advisory.candidateSupportOnly,
    partialReadouts,
    exactReadouts,
    ignoredSignalsForBlocking: [...IGNORED_SIGNALS_FOR_BLOCKING],
    confirmed: false,
    canOpenVault: false,
    vaultEligible: false,
    final: false,
    c2paCanBlock: false,
    decisionRole: "audio_pre_seal_exact_id_registry_only_no_vault_no_confirmed",
  };
}

export function decideAudioPreSealOwnership(input: {
  currentClientId: string;
  readouts: AudioPreSealReadout[];
}): AudioPreSealOwnershipResult {
  const exactReadouts = input.readouts.filter((readout) => {
    const advisory = buildAudioSupportAdvisory(readout.matchingBitsMax);
    return (
      readout.idMatched &&
      advisory.matchingBits === advisory.exactMatchBits &&
      advisory.audioSupportLevel === "exact_vault_candidate"
    );
  });

  if (exactReadouts.length === 0) {
    return baseResult({
      action: "allow",
      reason: input.readouts.length === 0
        ? "no_audio_registry_records_to_scan"
        : "no_exact_audio_id_found",
      exactIdFound: false,
      readouts: input.readouts,
    });
  }

  const registeredExactReadouts = exactReadouts.filter(
    (readout) => readout.registryClientId !== null && readout.registryClientId !== undefined,
  );
  if (registeredExactReadouts.length === 0) {
    return baseResult({
      action: "manual_review",
      reason: "audio_exact_id_registry_missing",
      exactIdFound: true,
      decodedId: exactReadouts[0]?.idHex ?? null,
      registeredAt: exactReadouts[0]?.registeredAt ?? null,
      readouts: input.readouts,
    });
  }

  const ownerIds = Array.from(
    new Set(
      registeredExactReadouts
        .map((readout) => readout.registryClientId)
        .filter((clientId): clientId is string => typeof clientId === "string"),
    ),
  );
  if (ownerIds.length > 1) {
    return baseResult({
      action: "manual_review",
      reason: "multiple_registered_audio_owners",
      exactIdFound: true,
      decodedId: registeredExactReadouts[0]?.idHex ?? null,
      registeredAt: registeredExactReadouts[0]?.registeredAt ?? null,
      readouts: input.readouts,
    });
  }

  const ownerId = ownerIds[0]!;
  const exact = registeredExactReadouts[0]!;
  if (ownerId === input.currentClientId) {
    return baseResult({
      action: "allow",
      reason: "audio_owned_by_current_client",
      exactIdFound: true,
      decodedId: exact.idHex ?? null,
      registeredClientId: ownerId,
      registeredAt: exact.registeredAt ?? null,
      readouts: input.readouts,
    });
  }

  return baseResult({
    action: "block",
    reason: "audio_owned_by_different_client",
    exactIdFound: true,
    decodedId: exact.idHex ?? null,
    registeredClientId: ownerId,
    registeredAt: exact.registeredAt ?? null,
    readouts: input.readouts,
  });
}

async function defaultDecodeRecord(input: {
  audioPath: string;
  workDir: string;
  record: AudioPreSealRegistryRecord;
  expectedPayload4Hex: string;
}): Promise<AudioV01DecodeTelemetry> {
  return decodeAudioV01FromDna({
    mediaPath: input.audioPath,
    workDir: input.workDir,
    dna: input.record.dna,
    expectedPayload4Hex: input.expectedPayload4Hex,
  });
}

function expectedPayloadForRecord(record: AudioPreSealRegistryRecord): string {
  if (record.payload4Hex) return record.payload4Hex;
  return payload4(normalizeId(record.idHex)).toString("hex");
}

async function scanRegistryRecords(
  input: AudioPreSealOwnershipCheckInput,
): Promise<AudioPreSealReadout[]> {
  const records = (input.registryRecords ?? [])
    .filter((record) => record.dnaId.startsWith("audio:"))
    .slice(0, normalizeScanLimit(input.scanLimit));
  const decodeRecord = input.decodeRecord ?? defaultDecodeRecord;
  const workDir = input.workDir ?? path.dirname(input.audioPath);
  const readouts: AudioPreSealReadout[] = [];

  for (const record of records) {
    let expectedPayload4Hex: string;
    try {
      expectedPayload4Hex = expectedPayloadForRecord(record);
    } catch {
      continue;
    }

    try {
      const trace = await decodeRecord({
        audioPath: input.audioPath,
        workDir,
        record,
        expectedPayload4Hex,
      });
      readouts.push({
        source: "registry_scan",
        dnaId: record.dnaId,
        idHex: record.idHex,
        registryClientId: record.clientId,
        registeredAt: registeredAtToString(record.createdAt),
        idMatched: trace.idMatched,
        matchingBitsMax: trace.matchingBitsMax,
        verdict: trace.verdict,
        note: trace.note,
      });
    } catch {
      readouts.push({
        source: "registry_scan",
        dnaId: record.dnaId,
        idHex: record.idHex,
        registryClientId: record.clientId,
        registeredAt: registeredAtToString(record.createdAt),
        idMatched: false,
        matchingBitsMax: 0,
        verdict: "AUDIO_NONE",
        note: "audio_preseal_decode_failed_no_block",
      });
    }
  }

  return readouts;
}

export async function audioPreSealOwnershipCheck(
  input: AudioPreSealOwnershipCheckInput,
): Promise<AudioPreSealOwnershipResult> {
  const readouts =
    input.observedReadouts ?? (await scanRegistryRecords(input));
  return decideAudioPreSealOwnership({
    currentClientId: input.currentClientId,
    readouts,
  });
}

function buildAudioPreSealOwnershipMessage(
  result: AudioPreSealOwnershipResult,
): string {
  if (result.action === "block") {
    return (
      "Bu ses icerigi baska bir TancMark audio kaydina ait gorunuyor. " +
      "Kesin 32/32 audio ID farkli client kaydiyla eslestigi icin " +
      "tekrar muhurlenemez."
    );
  }

  return (
    "Bu ses iceriginde kesin audio ID gorundu ancak sahiplik kaydi " +
    "guvenli blok icin yeterli degil. Kesin blok uretilmedi; manuel " +
    "inceleme gerekir."
  );
}

export function buildAudioPreSealOwnershipStopResponse(
  result: AudioPreSealOwnershipResult,
): AudioPreSealOwnershipStopResponse {
  const isBlock = result.action === "block";
  return {
    error: isBlock
      ? "audio_preseal_ownership_blocked"
      : "audio_preseal_ownership_manual_review",
    message: buildAudioPreSealOwnershipMessage(result),
    preSealOwnership: {
      action: result.action,
      block: result.block,
      reason: result.reason,
      exactIdFound: result.exactIdFound,
      decodedId: result.decodedId,
      registeredClientId: result.registeredClientId,
      registeredAt: result.registeredAt,
      exactMatchBits: result.exactMatchBits,
      matchingBits: result.matchingBits,
      matchPercent: result.matchPercent,
      audioSupportLevel: result.audioSupportLevel,
      candidateSupportOnly: result.candidateSupportOnly,
      partialReadoutCount: result.partialReadouts.length,
      exactReadoutCount: result.exactReadouts.length,
      blockingSignals: isBlock
        ? ["exact_audio_id_32_32_registry_client_mismatch"]
        : [],
      ignoredSignalsForBlocking: result.ignoredSignalsForBlocking,
      confirmed: false,
      canOpenVault: false,
      vaultEligible: false,
      final: false,
      c2paCanBlock: false,
      decisionRole: result.decisionRole,
    },
  };
}

export function buildAudioPreSealEncodeGate(
  result: AudioPreSealOwnershipResult,
): AudioPreSealEncodeGateResult {
  if (result.action === "allow") {
    return {
      allowEncode: true,
      statusCode: 200,
      responseBody: null,
    };
  }

  return {
    allowEncode: false,
    statusCode: 409,
    responseBody: buildAudioPreSealOwnershipStopResponse(result),
  };
}

import crypto from "node:crypto";
import fs from "node:fs";

export const LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION =
  "live-native-camera-capture-id-chain-v0.1" as const;

export const LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_DECISION_ROLE =
  "native_camera_capture_id_chain_exact_id_support_only_no_vault_no_confirmed" as const;

const EBML_HEADER_HEX = "1A45DFA3";
const VOID_ID = 0xec;
const ENVELOPE_MAGIC = "TANCMARK_NATIVE_CAMERA_ID_CHAIN_V1\n";

export interface NativeCameraCaptureAnchor {
  offset: number;
  length: number;
  sha256: string;
}

export interface NativeCameraCaptureEnvelope {
  version: typeof LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION;
  kind: "native_camera_capture_id_envelope";
  sourceType: "local_computer_camera_capture";
  idHex: string;
  payload4Hex: string;
  sourceSizeBytes: number;
  sourceSha256: string;
  sourceHeaderHex: string;
  anchorDigest: string;
  anchors: readonly NativeCameraCaptureAnchor[];
  mediaPayloadModified: false;
  ffmpegUsed: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  signatureSha256: string;
}

export interface NativeCameraSealResult {
  ok: true;
  status: "SEALED";
  reason: "native_camera_capture_id_envelope_written";
  version: typeof LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION;
  decisionRole: typeof LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_DECISION_ROLE;
  sourceIntact: true;
  mediaPayloadModified: false;
  ffmpegUsed: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  outputPath: string;
  sourceSha256: string;
  sealedSha256: string;
  idHex: string;
  payload4Hex: string;
  envelopeBytes: number;
}

export interface NativeCameraReadResult {
  ok: boolean;
  status: "EXACT_ID" | "NOT_FOUND" | "REJECTED";
  reason:
    | "native_camera_capture_exact_id_match"
    | "native_camera_capture_envelope_not_found"
    | "native_camera_capture_exact_id_mismatch"
    | "native_camera_capture_source_hash_mismatch"
    | "native_camera_capture_anchor_digest_mismatch"
    | "native_camera_capture_signature_mismatch"
    | "native_camera_capture_malformed_envelope";
  version: typeof LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION;
  decisionRole: typeof LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_DECISION_ROLE;
  sourceIntact: boolean;
  mediaPayloadModified: false;
  ffmpegUsed: false;
  canOpenVault: false;
  confirmed: false;
  final: false;
  exactIdRead: boolean;
  expectedIdHex: string;
  embeddedIdHex: string | null;
  sourceSha256: string | null;
  payload4Hex: string | null;
  envelopeBytes: number;
}

function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
}

function idHexFor(idInput: string): string {
  const normalized = idInput.trim();
  if (normalized.length === 0) {
    throw new Error("native_camera_capture_empty_id");
  }
  return sha256(normalized);
}

function headerHex(buffer: Buffer): string {
  return buffer.subarray(0, 4).toString("hex").toUpperCase();
}

function assertWebmLike(buffer: Buffer): void {
  if (buffer.length < 16 || headerHex(buffer) !== EBML_HEADER_HEX) {
    throw new Error("native_camera_capture_not_webm_ebml");
  }
}

function buildAnchors(buffer: Buffer): readonly NativeCameraCaptureAnchor[] {
  const size = buffer.length;
  const probeOffsets = [
    0,
    Math.floor(size * 0.07),
    Math.floor(size * 0.19),
    Math.floor(size * 0.31),
    Math.floor(size * 0.47),
    Math.floor(size * 0.61),
    Math.floor(size * 0.79),
    Math.max(0, size - 4096),
  ];
  const uniqueOffsets = Array.from(new Set(probeOffsets))
    .filter((offset) => offset >= 0 && offset < size)
    .sort((a, b) => a - b);
  return uniqueOffsets.map((offset) => {
    const length = Math.max(1, Math.min(4096, size - offset));
    return {
      offset,
      length,
      sha256: sha256(buffer.subarray(offset, offset + length)),
    };
  });
}

function anchorDigest(anchors: readonly NativeCameraCaptureAnchor[]): string {
  return sha256(JSON.stringify(anchors));
}

function signatureFor(envelope: Omit<NativeCameraCaptureEnvelope, "signatureSha256">): string {
  return sha256(
    [
      envelope.version,
      envelope.kind,
      envelope.idHex,
      envelope.payload4Hex,
      String(envelope.sourceSizeBytes),
      envelope.sourceSha256,
      envelope.sourceHeaderHex,
      envelope.anchorDigest,
    ].join("|"),
  );
}

function encodeEbmlVintSize(size: number): Buffer {
  if (!Number.isInteger(size) || size < 0) {
    throw new Error("native_camera_capture_invalid_envelope_size");
  }
  if (size <= 0x7f) return Buffer.from([0x80 | size]);
  if (size <= 0x3fff) return Buffer.from([0x40 | (size >> 8), size & 0xff]);
  if (size <= 0x1fffff) {
    return Buffer.from([0x20 | (size >> 16), (size >> 8) & 0xff, size & 0xff]);
  }
  if (size <= 0x0fffffff) {
    return Buffer.from([
      0x10 | (size >> 24),
      (size >> 16) & 0xff,
      (size >> 8) & 0xff,
      size & 0xff,
    ]);
  }
  throw new Error("native_camera_capture_envelope_too_large");
}

function decodeEbmlVintSize(buffer: Buffer, offset: number): { size: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const first = buffer[offset]!;
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length++;
  }
  if (length > 8 || offset + length > buffer.length) return null;
  let size = first & (mask - 1);
  for (let i = 1; i < length; i++) {
    size = size * 256 + buffer[offset + i]!;
  }
  return { size, length };
}

function buildEnvelopePayload(envelope: NativeCameraCaptureEnvelope): Buffer {
  const json = Buffer.from(JSON.stringify(envelope), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(json.length, 0);
  return Buffer.concat([Buffer.from(ENVELOPE_MAGIC, "utf8"), length, json]);
}

function findEnvelope(buffer: Buffer): {
  envelopeStart: number;
  payloadStart: number;
  payloadLength: number;
  envelopeBytes: number;
} | null {
  const magic = Buffer.from(ENVELOPE_MAGIC, "utf8");
  const magicAt = buffer.lastIndexOf(magic);
  if (magicAt < 0) return null;
  for (let sizeOffset = Math.max(0, magicAt - 8); sizeOffset < magicAt; sizeOffset++) {
    const envelopeStart = sizeOffset - 1;
    if (envelopeStart < 0 || buffer[envelopeStart] !== VOID_ID) continue;
    const sizeInfo = decodeEbmlVintSize(buffer, sizeOffset);
    if (!sizeInfo) continue;
    const payloadStart = sizeOffset + sizeInfo.length;
    const payloadEnd = payloadStart + sizeInfo.size;
    if (payloadStart !== magicAt || payloadEnd > buffer.length) continue;
    return {
      envelopeStart,
      payloadStart,
      payloadLength: sizeInfo.size,
      envelopeBytes: 1 + sizeInfo.length + sizeInfo.size,
    };
  }
  return null;
}

function parseEnvelope(buffer: Buffer, payloadStart: number, payloadLength: number): NativeCameraCaptureEnvelope {
  const magic = Buffer.from(ENVELOPE_MAGIC, "utf8");
  const lengthOffset = payloadStart + magic.length;
  if (payloadLength < magic.length + 4 || lengthOffset + 4 > buffer.length) {
    throw new Error("native_camera_capture_malformed_envelope");
  }
  const jsonLength = buffer.readUInt32BE(lengthOffset);
  const jsonStart = lengthOffset + 4;
  const jsonEnd = jsonStart + jsonLength;
  if (jsonEnd > payloadStart + payloadLength || jsonEnd > buffer.length) {
    throw new Error("native_camera_capture_malformed_envelope");
  }
  return JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString("utf8")) as NativeCameraCaptureEnvelope;
}

function safetyFields() {
  return {
    version: LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION,
    decisionRole: LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_DECISION_ROLE,
    mediaPayloadModified: false as const,
    ffmpegUsed: false as const,
    canOpenVault: false as const,
    confirmed: false as const,
    final: false as const,
  };
}

export function sealNativeCameraCaptureToNewFile(options: {
  sourcePath: string;
  outputPath: string;
  idInput: string;
}): NativeCameraSealResult {
  const source = fs.readFileSync(options.sourcePath);
  assertWebmLike(source);

  const anchors = buildAnchors(source);
  const idHex = idHexFor(options.idInput);
  const envelopeWithoutSignature: Omit<NativeCameraCaptureEnvelope, "signatureSha256"> = {
    version: LIVE_NATIVE_CAMERA_CAPTURE_ID_CHAIN_VERSION,
    kind: "native_camera_capture_id_envelope",
    sourceType: "local_computer_camera_capture",
    idHex,
    payload4Hex: idHex.slice(0, 8).toUpperCase(),
    sourceSizeBytes: source.length,
    sourceSha256: sha256(source),
    sourceHeaderHex: headerHex(source),
    anchorDigest: anchorDigest(anchors),
    anchors,
    mediaPayloadModified: false,
    ffmpegUsed: false,
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
  const envelope: NativeCameraCaptureEnvelope = {
    ...envelopeWithoutSignature,
    signatureSha256: signatureFor(envelopeWithoutSignature),
  };
  const payload = buildEnvelopePayload(envelope);
  const voidEnvelope = Buffer.concat([
    Buffer.from([VOID_ID]),
    encodeEbmlVintSize(payload.length),
    payload,
  ]);
  const sealed = Buffer.concat([source, voidEnvelope]);
  fs.writeFileSync(options.outputPath, sealed);

  return {
    ok: true,
    status: "SEALED",
    reason: "native_camera_capture_id_envelope_written",
    ...safetyFields(),
    sourceIntact: true,
    outputPath: options.outputPath,
    sourceSha256: envelope.sourceSha256,
    sealedSha256: sha256(sealed),
    idHex,
    payload4Hex: envelope.payload4Hex,
    envelopeBytes: voidEnvelope.length,
  };
}

export function readNativeCameraCaptureId(options: {
  videoPath: string;
  expectedIdInput: string;
}): NativeCameraReadResult {
  const expectedIdHex = idHexFor(options.expectedIdInput);
  const buffer = fs.readFileSync(options.videoPath);
  const located = findEnvelope(buffer);
  if (!located) {
    return {
      ok: false,
      status: "NOT_FOUND",
      reason: "native_camera_capture_envelope_not_found",
      ...safetyFields(),
      sourceIntact: true,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: null,
      sourceSha256: null,
      payload4Hex: null,
      envelopeBytes: 0,
    };
  }

  let envelope: NativeCameraCaptureEnvelope;
  try {
    envelope = parseEnvelope(buffer, located.payloadStart, located.payloadLength);
  } catch {
    return {
      ok: false,
      status: "REJECTED",
      reason: "native_camera_capture_malformed_envelope",
      ...safetyFields(),
      sourceIntact: false,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: null,
      sourceSha256: null,
      payload4Hex: null,
      envelopeBytes: located.envelopeBytes,
    };
  }

  const source = buffer.subarray(0, located.envelopeStart);
  const currentSourceSha256 = sha256(source);
  const currentAnchors = buildAnchors(source);
  const currentAnchorDigest = anchorDigest(currentAnchors);
  const { signatureSha256: _signatureSha256, ...signatureInput } = envelope;

  if (currentSourceSha256 !== envelope.sourceSha256 || source.length !== envelope.sourceSizeBytes) {
    return {
      ok: false,
      status: "REJECTED",
      reason: "native_camera_capture_source_hash_mismatch",
      ...safetyFields(),
      sourceIntact: false,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: envelope.idHex,
      sourceSha256: currentSourceSha256,
      payload4Hex: envelope.payload4Hex,
      envelopeBytes: located.envelopeBytes,
    };
  }

  if (currentAnchorDigest !== envelope.anchorDigest) {
    return {
      ok: false,
      status: "REJECTED",
      reason: "native_camera_capture_anchor_digest_mismatch",
      ...safetyFields(),
      sourceIntact: false,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: envelope.idHex,
      sourceSha256: currentSourceSha256,
      payload4Hex: envelope.payload4Hex,
      envelopeBytes: located.envelopeBytes,
    };
  }

  if (signatureFor(signatureInput) !== envelope.signatureSha256) {
    return {
      ok: false,
      status: "REJECTED",
      reason: "native_camera_capture_signature_mismatch",
      ...safetyFields(),
      sourceIntact: false,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: envelope.idHex,
      sourceSha256: currentSourceSha256,
      payload4Hex: envelope.payload4Hex,
      envelopeBytes: located.envelopeBytes,
    };
  }

  if (envelope.idHex !== expectedIdHex) {
    return {
      ok: false,
      status: "NOT_FOUND",
      reason: "native_camera_capture_exact_id_mismatch",
      ...safetyFields(),
      sourceIntact: true,
      exactIdRead: false,
      expectedIdHex,
      embeddedIdHex: envelope.idHex,
      sourceSha256: currentSourceSha256,
      payload4Hex: envelope.payload4Hex,
      envelopeBytes: located.envelopeBytes,
    };
  }

  return {
    ok: true,
    status: "EXACT_ID",
    reason: "native_camera_capture_exact_id_match",
    ...safetyFields(),
    sourceIntact: true,
    exactIdRead: true,
    expectedIdHex,
    embeddedIdHex: envelope.idHex,
    sourceSha256: currentSourceSha256,
    payload4Hex: envelope.payload4Hex,
    envelopeBytes: located.envelopeBytes,
  };
}

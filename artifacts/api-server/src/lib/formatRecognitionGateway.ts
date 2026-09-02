import {
  LEARNING_ADVISORY_FINAL_DECISION,
  buildLearningDnaMemory,
  type LearningDnaMemory,
  type LearningModule,
  type LearningTestRecord,
} from "./learningDnaMemory.js";

export const FORMAT_RECOGNITION_GATEWAY_VERSION =
  "format-recognition-gateway-v0.1" as const;
export const FORMAT_COPY_CONVERSION_APPROVAL_PHRASE =
  "APPROVE_FORMAT_COPY_CONVERSION" as const;
export const FORMAT_RECOGNITION_DECISION_ROLE =
  "format_recognition_and_conversion_plan_only_no_vault_no_confirmed" as const;

export type TancMarkFormatKind =
  | "image"
  | "video"
  | "audio"
  | "text_document"
  | "unknown";

export type TancMarkFormatSupportStatus =
  | "native_extreme_lab"
  | "native_needs_extreme_revalidation"
  | "unsupported_convertible_copy"
  | "unsupported_research_required"
  | "unknown";

export interface FormatSupportProfile {
  format: string;
  kind: TancMarkFormatKind;
  supportStatus: TancMarkFormatSupportStatus;
  nativeSealSupported: boolean;
  nativeReadSupported: boolean;
  extremeLabValidated: boolean;
  productReady: false;
  sealLayers: string[];
  readLayers: string[];
  conversionTargetFormat: string | null;
  conversionReason: string | null;
  roadmapGroup: "closed_extreme_lab" | "revalidation_debt" | "gemini_new_format_debt" | "unknown";
  userLanguage: string;
}

export interface FormatRecognitionInput {
  fileName?: string | null;
  mimeType?: string | null;
  bytes?: Uint8Array | Buffer | null;
  containerEntries?: readonly string[] | null;
}

export interface FormatSignatureResult {
  extension: string | null;
  signatureFormat: string | null;
  containerFormat: string | null;
  recognizedFormat: string | null;
  kind: TancMarkFormatKind;
  extensionMatchesSignature: boolean;
  mismatchDetected: boolean;
  mismatchReason: string | null;
  signatureEvidence: string[];
  containerEvidence: string[];
}

export interface DnaFormatGuidance {
  connectedToLearningDna: true;
  supportedNative: boolean;
  supportStatus: TancMarkFormatSupportStatus;
  extremeTestHistory: "extreme_lab_passed" | "needs_extreme_revalidation" | "not_available";
  recommendedSealLayers: string[];
  recommendedReadLayers: string[];
  previousSuccessKnown: boolean;
  previousFailureKnown: boolean;
  advisoryOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
  decisionRole: "dna_format_guidance_only_no_vault_no_confirmed";
}

export interface FormatCopyConversionPlan {
  conversionLayer: "format_copy_conversion_plan";
  supportedNative: boolean;
  conversionRequired: boolean;
  requiresHumanApproval: boolean;
  approvalPhraseRequired: typeof FORMAT_COPY_CONVERSION_APPROVAL_PHRASE;
  humanApprovalReceived: boolean;
  conversionAllowed: boolean;
  conversionBlockedReason: string | null;
  originalFileWillBeModified: false;
  originalHashEvidenceRequired: boolean;
  originalTimestampEvidenceRecommended: boolean;
  originalContentSentToExternalService: false;
  convertedCopyWillBeCreated: boolean;
  convertedCopyTargetFormat: string | null;
  convertedCopyProtectionLabel: string | null;
  nativeSealClaimAllowed: boolean;
  convertedCopySealClaimAllowed: boolean;
  userWarning: string | null;
}

export interface FormatRecognitionGatewayResult {
  version: typeof FORMAT_RECOGNITION_GATEWAY_VERSION;
  decisionRole: typeof FORMAT_RECOGNITION_DECISION_ROLE;
  recognitionLayer: "extension_signature_container";
  dnaLayer: "format_guidance_advisory_only";
  conversionLayer: "human_approved_copy_conversion_only";
  recognition: FormatSignatureResult;
  supportProfile: FormatSupportProfile;
  dnaGuidance: DnaFormatGuidance;
  conversionPlan: FormatCopyConversionPlan;
  learningRecord: LearningTestRecord;
  learningMemory: LearningDnaMemory;
  safety: {
    canOpenVault: false;
    confirmed: false;
    final: false;
    thresholdChanged: false;
    ownershipChanged: false;
    dnaDecides: false;
    originalFileModified: false;
    productFlowConnected: false;
    nativeSealClaimForConvertedCopy: false;
  };
}

const EXTREME_LAB_FORMATS = new Set([
  "pdf",
  "docx",
  "html",
  "webp",
  "mov",
  "m4a",
  "tiff",
  "bmp",
  "avi",
  "webm",
  "flac",
  "jpeg",
  "png",
  "mp4",
  "mkv",
  "wav",
  "mp3",
  "aac",
  "txt",
  "ts",
  "ogg",
  "epub",
  "pptx",
  "xlsx",
  "svg",
  "ai",
  "eps",
  "flv",
  "mxf",
  "wma",
  "aiff",
]);

const REVALIDATION_DEBT_FORMATS = new Set(["psd"]);

const GEMINI_FORMATS = new Set([
  "psd",
  "heic",
  "heif",
  "svg",
  "ai",
  "eps",
  "indd",
  "cdr",
  "ts",
  "flv",
  "mxf",
  "prores",
  "ogg",
  "opus",
  "wma",
  "aiff",
  "raw",
  "cr2",
  "nef",
  "epub",
  "pptx",
  "xlsx",
]);

const FORMAT_KIND: Record<string, TancMarkFormatKind> = {
  jpeg: "image",
  jpg: "image",
  png: "image",
  webp: "image",
  tiff: "image",
  tif: "image",
  bmp: "image",
  psd: "image",
  heic: "image",
  heif: "image",
  svg: "image",
  ai: "image",
  eps: "image",
  indd: "text_document",
  cdr: "image",
  raw: "image",
  cr2: "image",
  nef: "image",
  mp4: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  webm: "video",
  ts: "video",
  flv: "video",
  mxf: "video",
  prores: "video",
  wav: "audio",
  mp3: "audio",
  aac: "audio",
  m4a: "audio",
  flac: "audio",
  ogg: "audio",
  opus: "audio",
  wma: "audio",
  aiff: "audio",
  txt: "text_document",
  pdf: "text_document",
  docx: "text_document",
  html: "text_document",
  htm: "text_document",
  epub: "text_document",
  pptx: "text_document",
  xlsx: "text_document",
};

function normalizeFormat(format: string | null | undefined): string | null {
  if (!format) return null;
  const value = format.toLowerCase().replace(/^\./, "").trim();
  if (value === "jpg") return "jpeg";
  if (value === "tif") return "tiff";
  if (value === "htm") return "html";
  if (value === "opus") return "ogg";
  return value || null;
}

function extensionFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const clean = fileName.split(/[\\/]/).pop() ?? fileName;
  const index = clean.lastIndexOf(".");
  if (index < 0 || index === clean.length - 1) return null;
  return normalizeFormat(clean.slice(index + 1));
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (bytes.length < start + length) return "";
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function detectContainer(entries: readonly string[] | null | undefined): {
  format: string | null;
  evidence: string[];
} {
  const normalized = (entries ?? []).map((entry) => entry.toLowerCase());
  const evidence: string[] = [];
  if (normalized.some((entry) => entry === "word/document.xml" || entry.startsWith("word/"))) {
    evidence.push("zip_contains_word_document_xml");
    return { format: "docx", evidence };
  }
  if (normalized.some((entry) => entry === "ppt/presentation.xml" || entry.startsWith("ppt/"))) {
    evidence.push("zip_contains_ppt_presentation_xml");
    return { format: "pptx", evidence };
  }
  if (normalized.some((entry) => entry === "xl/workbook.xml" || entry.startsWith("xl/"))) {
    evidence.push("zip_contains_xl_workbook_xml");
    return { format: "xlsx", evidence };
  }
  if (normalized.includes("mimetype") && normalized.some((entry) => entry.startsWith("oebps/"))) {
    evidence.push("zip_contains_epub_oebps");
    return { format: "epub", evidence };
  }
  return { format: null, evidence };
}

function detectSignature(bytes: Uint8Array | Buffer | null | undefined): {
  format: string | null;
  evidence: string[];
} {
  if (!bytes || bytes.length === 0) {
    return { format: null, evidence: ["no_bytes_provided"] };
  }
  const evidence: string[] = [];
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { format: "jpeg", evidence: ["jpeg_soi"] };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { format: "png", evidence: ["png_signature"] };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { format: "webp", evidence: ["riff_webp"] };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return { format: "wav", evidence: ["riff_wave"] };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4).trim() === "AVI") {
    return { format: "avi", evidence: ["riff_avi"] };
  }
  if (ascii(bytes, 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(bytes, 8, 4))) {
    return { format: "aiff", evidence: ["form_aiff"] };
  }
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) &&
    bytes.length > 10 &&
    ascii(bytes, 8, 2) === "CR"
  ) {
    return { format: "cr2", evidence: ["canon_cr2_tiff_magic"] };
  }
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { format: "tiff", evidence: ["tiff_endian_magic"] };
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 3).toUpperCase() === "CDR") {
    return { format: "cdr", evidence: ["riff_cdr_magic"] };
  }
  if (ascii(bytes, 0, 2) === "BM") return { format: "bmp", evidence: ["bmp_magic"] };
  if (ascii(bytes, 0, 4) === "%PDF") return { format: "pdf", evidence: ["pdf_header"] };
  if (ascii(bytes, 0, 4) === "8BPS") return { format: "psd", evidence: ["psd_magic"] };
  if (ascii(bytes, 0, 4) === "OggS") return { format: "ogg", evidence: ["ogg_magic"] };
  if (ascii(bytes, 0, 4) === "fLaC") return { format: "flac", evidence: ["flac_magic"] };
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return { format: "mp3", evidence: ["mp3_id3_or_frame_sync"] };
  }
  if (bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)) {
    return { format: "aac", evidence: ["aac_adts"] };
  }
  if (startsWith(bytes, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11])) {
    return { format: "wma", evidence: ["asf_wma_guid"] };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { format: "mkv", evidence: ["ebml_matroska_or_webm"] };
  }
  if (bytes[0] === 0x47 && (bytes[188] === 0x47 || bytes[192] === 0x47)) {
    return { format: "ts", evidence: ["mpeg_ts_sync_byte"] };
  }
  if (ascii(bytes, 0, 3) === "FLV") return { format: "flv", evidence: ["flv_magic"] };
  if (startsWith(bytes, [0x06, 0x0e, 0x2b, 0x34])) return { format: "mxf", evidence: ["mxf_ul"] };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    evidence.push(`isobmff_ftyp_${brand || "unknown"}`);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return { format: "heic", evidence };
    if (["qt  "].includes(brand)) return { format: "mov", evidence };
    if (["m4a ", "m4b ", "m4p "].includes(brand)) return { format: "m4a", evidence };
    if (["mp42", "mp41", "isom", "iso2", "avc1"].includes(brand)) return { format: "mp4", evidence };
    return { format: "mp4", evidence };
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, 256)).trim().toLowerCase();
  if (head.startsWith("<svg") || head.includes("<svg")) return { format: "svg", evidence: ["svg_text_marker"] };
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<html")) {
    return { format: "html", evidence: ["html_text_marker"] };
  }
  return { format: null, evidence: ["signature_unknown"] };
}

function kindFor(format: string | null): TancMarkFormatKind {
  if (!format) return "unknown";
  return FORMAT_KIND[format] ?? "unknown";
}

function supportProfileFor(format: string | null): FormatSupportProfile {
  const normalized = normalizeFormat(format);
  if (!normalized) {
    return {
      format: "unknown",
      kind: "unknown",
      supportStatus: "unknown",
      nativeSealSupported: false,
      nativeReadSupported: false,
      extremeLabValidated: false,
      productReady: false,
      sealLayers: [],
      readLayers: [],
      conversionTargetFormat: null,
      conversionReason: null,
      roadmapGroup: "unknown",
      userLanguage: "Format net taninamadi; orijinal dosya degismeden kalir ve insan onayi olmadan donusum yapilmaz.",
    };
  }

  const kind = kindFor(normalized);
  if (EXTREME_LAB_FORMATS.has(normalized)) {
    return {
      format: normalized,
      kind,
      supportStatus: "native_extreme_lab",
      nativeSealSupported: true,
      nativeReadSupported: true,
      extremeLabValidated: true,
      productReady: false,
      sealLayers: [`${normalized}_native_lab_seal_layer`],
      readLayers: [`${normalized}_native_lab_read_layer`],
      conversionTargetFormat: null,
      conversionReason: null,
      roadmapGroup: "closed_extreme_lab",
      userLanguage: "Bu format lab seviyesinde native gorunmez muhur + ID okuma kanitina sahiptir; yine de product gate ayri gerekir.",
    };
  }

  if (REVALIDATION_DEBT_FORMATS.has(normalized)) {
    return {
      format: normalized,
      kind,
      supportStatus: "native_needs_extreme_revalidation",
      nativeSealSupported: true,
      nativeReadSupported: true,
      extremeLabValidated: false,
      productReady: false,
      sealLayers: [`${normalized}_existing_native_or_partial_seal_layer`],
      readLayers: [`${normalized}_existing_native_or_partial_read_layer`],
      conversionTargetFormat: null,
      conversionReason: "Native/partial support exists, but new real-world extreme closure is still required.",
      roadmapGroup: "revalidation_debt",
      userLanguage: "Bu format icin mevcut destek vardir; yeni extreme gercek dunya kapanisi tamamlanmadan urun hazir denmez.",
    };
  }

  const conversionTargetFormat = conversionTargetFor(normalized, kind);
  const isGemini = GEMINI_FORMATS.has(normalized);
  return {
    format: normalized,
    kind,
    supportStatus: conversionTargetFormat ? "unsupported_convertible_copy" : "unsupported_research_required",
    nativeSealSupported: false,
    nativeReadSupported: false,
    extremeLabValidated: false,
    productReady: false,
    sealLayers: [],
    readLayers: [],
    conversionTargetFormat,
    conversionReason: conversionTargetFormat
      ? `Native ${normalized.toUpperCase()} muhur iddiasi yok; kopya ${conversionTargetFormat.toUpperCase()} formatina cevrilip korunabilir.`
      : "Guvenli hedef format belirlemek icin ayri arastirma gerekir.",
    roadmapGroup: isGemini ? "gemini_new_format_debt" : "unknown",
    userLanguage: conversionTargetFormat
      ? "Bu format dogrudan desteklenmiyor. Orijinal dosyaniz degismeden kalacak. Kopyasi desteklenen formata cevrilip korunabilir."
      : "Bu format dogrudan desteklenmiyor ve guvenli donusum hedefi henuz net degil.",
  };
}

function conversionTargetFor(format: string, kind: TancMarkFormatKind): string | null {
  if (["psd", "heic", "heif", "svg", "ai", "eps", "cdr", "raw", "cr2", "nef"].includes(format) || kind === "image") return "png";
  if (["ts", "flv", "mxf", "prores"].includes(format) || kind === "video") return "mov";
  if (["ogg", "opus", "wma", "aiff"].includes(format) || kind === "audio") return "flac";
  if (["epub", "indd"].includes(format)) return "html";
  if (["pptx", "xlsx"].includes(format)) return "pdf";
  return null;
}

export function recognizeTancMarkFormat(input: FormatRecognitionInput): FormatSignatureResult {
  const extension = extensionFromFileName(input.fileName);
  const signature = detectSignature(input.bytes ?? null);
  const container = detectContainer(input.containerEntries);
  const signatureFormat = normalizeFormat(signature.format);
  const containerFormat = normalizeFormat(container.format);
  const recognizedFormat = containerFormat ?? signatureFormat ?? extension;
  const kind = kindFor(recognizedFormat);

  const extensionMatchesSignature =
    !extension ||
    !recognizedFormat ||
    extension === recognizedFormat ||
    (extension === "m4a" && recognizedFormat === "mp4") ||
    (extension === "mov" && recognizedFormat === "mp4") ||
    (extension === "webm" && recognizedFormat === "mkv");

  return {
    extension,
    signatureFormat,
    containerFormat,
    recognizedFormat,
    kind,
    extensionMatchesSignature,
    mismatchDetected: !extensionMatchesSignature,
    mismatchReason: extensionMatchesSignature
      ? null
      : `extension_${extension ?? "none"}_does_not_match_detected_${recognizedFormat ?? "unknown"}`,
    signatureEvidence: signature.evidence,
    containerEvidence: container.evidence,
  };
}

export function buildDnaFormatGuidance(profile: FormatSupportProfile): DnaFormatGuidance {
  return {
    connectedToLearningDna: true,
    supportedNative: profile.nativeSealSupported && profile.nativeReadSupported,
    supportStatus: profile.supportStatus,
    extremeTestHistory: profile.extremeLabValidated
      ? "extreme_lab_passed"
      : profile.supportStatus === "native_needs_extreme_revalidation"
        ? "needs_extreme_revalidation"
        : "not_available",
    recommendedSealLayers: profile.sealLayers,
    recommendedReadLayers: profile.readLayers,
    previousSuccessKnown: profile.extremeLabValidated,
    previousFailureKnown: profile.supportStatus !== "native_extreme_lab",
    advisoryOnly: true,
    canOpenVault: false,
    confirmed: false,
    final: false,
    decisionRole: "dna_format_guidance_only_no_vault_no_confirmed",
  };
}

export function buildFormatCopyConversionPlan(
  profile: FormatSupportProfile,
  approvalText?: string | null,
): FormatCopyConversionPlan {
  const conversionRequired = !profile.nativeSealSupported || profile.supportStatus === "unsupported_convertible_copy";
  const needsConversion = conversionRequired && Boolean(profile.conversionTargetFormat);
  const humanApprovalReceived = approvalText === FORMAT_COPY_CONVERSION_APPROVAL_PHRASE;
  const conversionAllowed = Boolean(needsConversion && humanApprovalReceived);
  return {
    conversionLayer: "format_copy_conversion_plan",
    supportedNative: profile.nativeSealSupported && profile.nativeReadSupported,
    conversionRequired: needsConversion,
    requiresHumanApproval: needsConversion,
    approvalPhraseRequired: FORMAT_COPY_CONVERSION_APPROVAL_PHRASE,
    humanApprovalReceived,
    conversionAllowed,
    conversionBlockedReason: needsConversion
      ? conversionAllowed
        ? null
        : "human_approval_required_before_copy_conversion"
      : null,
    originalFileWillBeModified: false,
    originalHashEvidenceRequired: true,
    originalTimestampEvidenceRecommended: true,
    originalContentSentToExternalService: false,
    convertedCopyWillBeCreated: conversionAllowed,
    convertedCopyTargetFormat: conversionAllowed ? profile.conversionTargetFormat : null,
    convertedCopyProtectionLabel: conversionAllowed
      ? `converted_copy_protected_as_${profile.conversionTargetFormat}`
      : null,
    nativeSealClaimAllowed: profile.nativeSealSupported && !needsConversion,
    convertedCopySealClaimAllowed: conversionAllowed,
    userWarning: needsConversion
      ? "Bu format dogrudan desteklenmiyor. Orijinal dosyaniz degismeden kalacak. Kopyasi desteklenen formata cevrilip korunacak. Onayliyor musunuz?"
      : null,
  };
}

function moduleForKind(kind: TancMarkFormatKind): LearningModule {
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  if (kind === "text_document") return "text";
  return "evidence_package";
}

function buildLearningRecord(
  recognition: FormatSignatureResult,
  profile: FormatSupportProfile,
  conversionPlan: FormatCopyConversionPlan,
): LearningTestRecord {
  const module = moduleForKind(profile.kind);
  return {
    recordId: `format-gateway-${profile.format}`,
    scenario: "format_recognition_dna_conversion_gate",
    fileKind: profile.format,
    expectedOutcome: profile.supportStatus,
    finalDecision: LEARNING_ADVISORY_FINAL_DECISION,
    idMatched: false,
    falseVault: false,
    idlessVault: false,
    heavyOcrTriggered: false,
    modules: [
      {
        module,
        active: true,
        sealed: false,
        idRead: false,
        candidateSupport: true,
        confirmed: false,
        rescued: conversionPlan.conversionAllowed,
        failed:
          recognition.mismatchDetected ||
          profile.supportStatus === "unsupported_research_required" ||
          (conversionPlan.conversionRequired && !conversionPlan.conversionAllowed),
        note: recognition.mismatchDetected
          ? recognition.mismatchReason
          : profile.userLanguage,
      },
    ],
    note:
      "Format gateway records support/conversion guidance only; it does not open VAULT or change encode/analyze behavior.",
  };
}

export function buildFormatRecognitionGateway(
  input: FormatRecognitionInput,
  approvalText?: string | null,
): FormatRecognitionGatewayResult {
  const recognition = recognizeTancMarkFormat(input);
  const supportProfile = supportProfileFor(recognition.recognizedFormat);
  const dnaGuidance = buildDnaFormatGuidance(supportProfile);
  const conversionPlan = buildFormatCopyConversionPlan(supportProfile, approvalText);
  const learningRecord = buildLearningRecord(recognition, supportProfile, conversionPlan);
  const learningMemory = buildLearningDnaMemory([learningRecord]);

  return {
    version: FORMAT_RECOGNITION_GATEWAY_VERSION,
    decisionRole: FORMAT_RECOGNITION_DECISION_ROLE,
    recognitionLayer: "extension_signature_container",
    dnaLayer: "format_guidance_advisory_only",
    conversionLayer: "human_approved_copy_conversion_only",
    recognition,
    supportProfile,
    dnaGuidance,
    conversionPlan,
    learningRecord,
    learningMemory,
    safety: {
      canOpenVault: false,
      confirmed: false,
      final: false,
      thresholdChanged: false,
      ownershipChanged: false,
      dnaDecides: false,
      originalFileModified: false,
      productFlowConnected: false,
      nativeSealClaimForConvertedCopy: false,
    },
  };
}

export function validateFormatRecognitionGateway(
  result: FormatRecognitionGatewayResult,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (result.decisionRole !== FORMAT_RECOGNITION_DECISION_ROLE) {
    violations.push("decisionRole_changed");
  }
  if (result.safety.canOpenVault !== false || result.conversionPlan.originalFileWillBeModified !== false) {
    violations.push("unsafe_decision_or_original_mutation");
  }
  if (result.dnaGuidance.canOpenVault !== false || result.dnaGuidance.confirmed !== false) {
    violations.push("dna_decision_gate_violation");
  }
  if (result.learningMemory.safety.canOpenVault !== false || result.learningMemory.automation.autoApplyEnabled !== false) {
    violations.push("learning_memory_safety_violation");
  }
  if (result.conversionPlan.conversionRequired && !result.conversionPlan.humanApprovalReceived && result.conversionPlan.conversionAllowed) {
    violations.push("conversion_allowed_without_approval");
  }
  if (result.conversionPlan.convertedCopyWillBeCreated && !result.conversionPlan.convertedCopyProtectionLabel) {
    violations.push("converted_copy_not_labelled");
  }
  if (result.conversionPlan.nativeSealClaimAllowed && result.conversionPlan.convertedCopyWillBeCreated) {
    violations.push("native_claim_allowed_for_converted_copy");
  }
  return { ok: violations.length === 0, violations };
}

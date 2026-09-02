export const TXT_AI_SEAL_FEATURE_FLAG = "TANCMARK_AI_SEAL_TXT_ENABLED" as const;

export const TXT_AI_SEAL_DECISION_ROLE =
  "txt_ai_support_trace_only_no_vault_no_final" as const;

export const TXT_AI_SEAL_VERSION = "tancmark-ai-seal-txt-mvp-v1" as const;

export type TxtAiSealDisplayText =
  | "TXT icinde veriyi hic degistirmeden gomulu muhur mumkun gorunmuyor."
  | "AI destek izi bulunamadi";

export interface TxtAiSealGate {
  module: "txt_ai_seal";
  enabled: boolean;
  featureFlag: typeof TXT_AI_SEAL_FEATURE_FLAG;
  defaultEnabled: false;
  productReady: false;
  decisionRole: typeof TXT_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  canChangeCore: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface AttemptSealTxtAiDocumentInput {
  text: Buffer;
  tancmarkId: string;
}

export interface AttemptSealTxtAiDocumentResult {
  sealedText: null;
  candidateText: Buffer;
  embeddedSealApplied: false;
  embeddedSealPossibleWithoutMutation: false;
  exactBytesPreserved: true;
  contentMutated: false;
  deliverable: false;
  failureReason: "TXT_EMBEDDED_SEAL_REQUIRES_TEXT_MUTATION";
  userSafeMessage: "TXT icinde veriyi hic degistirmeden gomulu muhur mumkun gorunmuyor.";
  safeAlternatives: readonly [
    "hash",
    "official_timestamp",
    "blockchain_record",
    "sidecar_evidence_package",
    "redacted_evidence_report",
  ];
  decisionRole: typeof TXT_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
  sourceTextMutated: false;
}

export interface ReadTxtAiSealInput {
  text: Buffer;
  expectedTancmarkId: string;
}

export interface ReadTxtAiSealResult {
  found: false;
  weakSignal: false;
  score: 0;
  displayText: TxtAiSealDisplayText;
  decisionRole: typeof TXT_AI_SEAL_DECISION_ROLE;
  canOpenVault: false;
  canConfirmFinal: false;
  externalApiUsed: false;
  modelDownloaded: false;
}

export interface TxtAiSealTokenEstimateInput {
  operation: "embed" | "search" | "external_evidence";
  sizeBytes: number;
}

export interface TxtAiSealTokenEstimate {
  operation: TxtAiSealTokenEstimateInput["operation"];
  estimatedTokens: number;
  userMessage: string;
  approveButton: "Onayla ve islemi baslat";
  cancelButton: "Iptal et";
  requiresExplicitApproval: true;
}

const MAX_SUPPORTED_TXT_BYTES = 8 * 1024 * 1024;

export function getTxtAiSealGate(env: NodeJS.ProcessEnv = process.env): TxtAiSealGate {
  return {
    module: "txt_ai_seal",
    enabled: env[TXT_AI_SEAL_FEATURE_FLAG] === "1" || env[TXT_AI_SEAL_FEATURE_FLAG] === "true",
    featureFlag: TXT_AI_SEAL_FEATURE_FLAG,
    defaultEnabled: false,
    productReady: false,
    decisionRole: TXT_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    canChangeCore: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

export function estimateTxtAiSealTokens(
  input: TxtAiSealTokenEstimateInput,
): TxtAiSealTokenEstimate {
  const sizeFactor = Math.max(1, Math.ceil(input.sizeBytes / 200_000));
  const base =
    input.operation === "embed" ? 120 : input.operation === "search" ? 90 : 60;
  const estimatedTokens = base + sizeFactor * 20;
  return {
    operation: input.operation,
    estimatedTokens,
    userMessage: `Bu islem yaklasik ${estimatedTokens} token yakacak.`,
    approveButton: "Onayla ve islemi baslat",
    cancelButton: "Iptal et",
    requiresExplicitApproval: true,
  };
}

export async function attemptSealTxtAiDocument(
  input: AttemptSealTxtAiDocumentInput,
): Promise<AttemptSealTxtAiDocumentResult> {
  assertTxtAiFeatureEnabled();
  assertSafeId(input.tancmarkId);
  assertSafeText(input.text);

  return {
    sealedText: null,
    candidateText: Buffer.from(input.text),
    embeddedSealApplied: false,
    embeddedSealPossibleWithoutMutation: false,
    exactBytesPreserved: true,
    contentMutated: false,
    deliverable: false,
    failureReason: "TXT_EMBEDDED_SEAL_REQUIRES_TEXT_MUTATION",
    userSafeMessage:
      "TXT icinde veriyi hic degistirmeden gomulu muhur mumkun gorunmuyor.",
    safeAlternatives: [
      "hash",
      "official_timestamp",
      "blockchain_record",
      "sidecar_evidence_package",
      "redacted_evidence_report",
    ],
    decisionRole: TXT_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
    sourceTextMutated: false,
  };
}

export async function readTxtAiSeal(
  input: ReadTxtAiSealInput,
): Promise<ReadTxtAiSealResult> {
  assertTxtAiFeatureEnabled();
  assertSafeId(input.expectedTancmarkId);
  assertSafeText(input.text);

  return {
    found: false,
    weakSignal: false,
    score: 0,
    displayText: "AI destek izi bulunamadi",
    decisionRole: TXT_AI_SEAL_DECISION_ROLE,
    canOpenVault: false,
    canConfirmFinal: false,
    externalApiUsed: false,
    modelDownloaded: false,
  };
}

function assertTxtAiFeatureEnabled() {
  if (!getTxtAiSealGate().enabled) {
    throw new Error("txt_ai_seal_feature_flag_disabled");
  }
}

function assertSafeId(value: string) {
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(value)) {
    throw new Error("invalid_txt_ai_seal_tancmark_id");
  }
}

function assertSafeText(text: Buffer) {
  if (text.length <= 0 || text.length > MAX_SUPPORTED_TXT_BYTES) {
    throw new Error("unsafe_txt_ai_seal_size");
  }
}

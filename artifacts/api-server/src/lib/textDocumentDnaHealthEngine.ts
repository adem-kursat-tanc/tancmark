import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const TEXT_DOCUMENT_DNA_HEALTH_ENGINE_VERSION = "text-document-dna-health-engine-v0.1" as const;

export interface TextDocumentDnaHealthSummary extends HierarchicalDnaHealthSummary {
  textDocumentEngineVersion: typeof TEXT_DOCUMENT_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestTextDocumentPaths: string[];
  weakInnerLayers: string[];
  retestRequiredTextDocumentWork: string[];
  notProductReadyTextDocumentTopics: string[];
  meaningPreservationBoundary: string;
  nextTextDocumentWork: string;
}

const TEXT_DOCUMENT_LEARNS_FROM_SIGNALS = [
  "TXT",
  "PDF text layer",
  "DOCX",
  "HTML",
  "EPUB",
  "PPTX/XLSX text layers",
  "invisible characters",
  "metadata",
  "copy/paste",
  "save-as",
  "cleaning/deletion attacks",
  "recovery results",
  "product-ready/support-only/lab-only state",
] as const;

const TEXT_DOCUMENT_ENGINE_CONFIG = {
  dnaName: "Text/Document DNA",
  modules: ["text_document", "format_layers", "watermark", "license_product_gate", "evidence"] as const,
  eventTypes: [
    "seal_attempt",
    "read_attempt",
    "recovery_attempt",
    "format_test_result",
    "evidence_signal",
    "license_gate_signal",
    "debt_signal",
  ] as const,
  debtKeywords: [
    "text",
    "document",
    "txt",
    "pdf",
    "docx",
    "html",
    "epub",
    "pptx",
    "xlsx",
    "copy",
    "paste",
    "metadata",
    "invisible",
    "meaning",
    "semantic",
    "ocr",
    "product-ready",
  ] as const,
  readinessNote:
    "Text/Document DNA summarizes safe text/document paths only; it cannot mutate text, numbers, words or meaning.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Protect meaning-preserving text/document paths",
      reason:
        "Text/document product defaults must avoid number, letter, word or meaning changes while still learning from copy/save/delete recovery results.",
      nextStep:
        "Prepare a support-only matrix for text layers, metadata, copy/paste, save-as and deletion/cleaning attacks.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildTextDocumentDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): TextDocumentDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(TEXT_DOCUMENT_ENGINE_CONFIG, input);

  return {
    ...base,
    textDocumentEngineVersion: TEXT_DOCUMENT_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: TEXT_DOCUMENT_LEARNS_FROM_SIGNALS,
    strongestTextDocumentPaths: [
      "product-safe text protection that preserves original text by default",
      "metadata/package sidecar paths where raw customer document content is not stored",
      "Office/HTML/EPUB support paths that keep text meaning unchanged",
    ],
    weakInnerLayers: [
      "copy/paste can remove metadata and invisible layer signals",
      "save-as/export can flatten or clean hidden layers",
      "manual cleaning/deletion attacks can remove support-only traces",
    ],
    retestRequiredTextDocumentWork: [
      "copy/paste across common editors",
      "PDF/DOCX/HTML/EPUB save-as/export matrix",
      "PPTX/XLSX text-layer matrix",
      "OCR support-only recovery with no raw text storage",
    ],
    notProductReadyTextDocumentTopics: [
      "any default text/rakam/kelime/anlam mutation path",
      "raw customer document or extracted text storage in DNA",
      "claims that rely on lab-only semantic rewrite or numeric jitter",
    ],
    meaningPreservationBoundary:
      "Text/Document DNA cannot change letters, numbers, words, meaning or document content; visible logo remains a separate explicit opt-in feature.",
    nextTextDocumentWork:
      "Create a read-only Text/Document DNA meaning-preservation matrix before any stronger document product claim.",
  };
}

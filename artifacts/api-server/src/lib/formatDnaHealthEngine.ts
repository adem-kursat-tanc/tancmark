import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const FORMAT_DNA_HEALTH_ENGINE_VERSION = "format-dna-health-engine-v0.1" as const;

export interface FormatDnaHealthSummary extends HierarchicalDnaHealthSummary {
  formatEngineVersion: typeof FORMAT_DNA_HEALTH_ENGINE_VERSION;
  strongFormats: string[];
  weakFormats: string[];
  riskCleanedFormats: string[];
  retestRequiredFormats: string[];
  notProductReadyFormats: string[];
  nextFormatWork: string;
}

const FORMAT_SCOPE = [
  "PDF",
  "DOCX",
  "PPTX",
  "XLSX",
  "EPUB",
  "HTML",
  "TXT",
  "SVG/XML",
  "RAW/HEIC/CDR/INDD special paths",
  "metadata layers",
  "invisible seal layers",
  "recovery results",
] as const;

const FORMAT_ENGINE_CONFIG = {
  dnaName: "Format DNA",
  modules: ["format_layers", "text_document", "visual", "video", "audio", "watermark", "license_product_gate"] as const,
  eventTypes: ["format_test_result", "read_attempt", "recovery_attempt", "license_gate_signal", "debt_signal"] as const,
  debtKeywords: [
    "format",
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "epub",
    "html",
    "txt",
    "svg",
    "xml",
    "raw",
    "heic",
    "cdr",
    "indd",
    "metadata",
    "corpus",
    "real-world",
    "product-ready",
  ] as const,
  readinessNote:
    "Format DNA summarizes support/product/lab readiness only; exact ID and product gates remain separate.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Build read-only format productization matrix",
      reason: "Many formats have lab/support evidence but still need product gate and real-world corpus closure.",
      nextStep:
        "Prepare a no-execution matrix for format readiness, weak paths, blocked tools and next corpus tests.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildFormatDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): FormatDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(FORMAT_ENGINE_CONFIG, input);

  return {
    ...base,
    formatEngineVersion: FORMAT_DNA_HEALTH_ENGINE_VERSION,
    strongFormats: ["PDF safe path support evidence", "DOCX lab evidence", "HTML/TXT support evidence"],
    weakFormats: ["true physical print/scan PDF", "RAW/HEIC/CDR/INDD native product claim", "large real-world corpus gaps"],
    riskCleanedFormats: [
      "Ghostscript/MuPDF/Poppler/Calibre/Inkscape paths are blocked from product runtime",
      "FFmpeg lab-only paths are not a format product decision",
      "unknown native/model/font/asset items remain gated",
    ],
    retestRequiredFormats: [
      "PDF true printer/scanner",
      "video/social platform roundtrip",
      "Office/OOXML broader device/editor matrix",
      "RAW/HEIC/CDR/INDD strategy proof",
    ],
    notProductReadyFormats: [
      "RAW/HEIC/CDR/INDD native support",
      "true physical print-scan PDF acceptance",
      "format claims that depend on blocked tools",
    ],
    nextFormatWork:
      FORMAT_SCOPE.length > 0
        ? "Create read-only Format DNA productization matrix before any new format promotion."
        : "Keep collecting support-only format events.",
  };
}

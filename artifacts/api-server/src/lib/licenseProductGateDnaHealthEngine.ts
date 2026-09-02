import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const LICENSE_PRODUCT_GATE_DNA_HEALTH_ENGINE_VERSION =
  "license-product-gate-dna-health-engine-v0.1" as const;

export interface LicenseProductGateDnaHealthSummary extends HierarchicalDnaHealthSummary {
  licenseProductGateEngineVersion: typeof LICENSE_PRODUCT_GATE_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  productPackageCleanState: string;
  openLicenseDebts: string[];
  toolsToKeepOutOfProduct: string[];
  noticeSbomGaps: string[];
  unapprovedModelFontAssetItems: string[];
  productNotReadyLicenseTopics: string[];
  autoChangesProductBehavior: false;
  nextLicenseWork: string;
}

const LICENSE_PRODUCT_GATE_LEARNS_FROM_SIGNALS = [
  "license gates",
  "blocked product tools",
  "clean product package state",
  "NOTICE/SBOM",
  "MediaMTX MIT notice",
  "FFmpeg lab-only state",
  "sharp/libvips gate",
  "Tesseract language file state",
  "model/font/asset manifest",
  "denylist signal",
  "not product-ready license topic",
] as const;

const LICENSE_PRODUCT_GATE_ENGINE_CONFIG = {
  dnaName: "License/Product Gate DNA",
  modules: ["license_product_gate", "security", "saas_operation", "product", "legal"] as const,
  eventTypes: [
    "license_gate_signal",
    "security_signal",
    "product_signal",
    "legal_signal",
    "launch_signal",
    "debt_signal",
    "recommendation_signal",
  ] as const,
  debtKeywords: [
    "license",
    "licence",
    "product gate",
    "notice",
    "sbom",
    "ffmpeg",
    "mediamtx",
    "sharp",
    "libvips",
    "tesseract",
    "model",
    "font",
    "asset",
    "ghostscript",
    "mupdf",
    "poppler",
    "calibre",
    "inkscape",
    "gpl",
    "agpl",
  ] as const,
  readinessNote:
    "License/Product Gate DNA summarizes package safety only; it cannot approve legal final or mutate product package.",
  defaultActions: [
    {
      riskLevel: "high" as const,
      title: "Keep product package gate human-reviewed",
      reason:
        "License, model, font, asset and NOTICE/SBOM decisions can affect launch risk and must not be auto-applied.",
      nextStep:
        "Require APPROVE_CHIEF_BRAIN_SAFE_ACTION before any high-risk license/product package change.",
      requiresHumanApproval: true,
    },
  ],
};

export function buildLicenseProductGateDnaHealth(
  input: HierarchicalDnaBaseEngineInput = {},
): LicenseProductGateDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(LICENSE_PRODUCT_GATE_ENGINE_CONFIG, input);

  return {
    ...base,
    licenseProductGateEngineVersion: LICENSE_PRODUCT_GATE_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: LICENSE_PRODUCT_GATE_LEARNS_FROM_SIGNALS,
    productPackageCleanState:
      "Clean package gates are in place, but final launch NOTICE/SBOM and model/asset manifest closure remain open.",
    openLicenseDebts: [
      "final NOTICE/SBOM package closure",
      "semantic model local bundle/hash approval before product enablement",
      "final asset/font/model manifest proof",
      "sharp/libvips native notice/source-link closure before launch",
    ],
    toolsToKeepOutOfProduct: [
      "Ghostscript",
      "MuPDF/PyMuPDF",
      "Poppler runtime",
      "Calibre runtime",
      "Inkscape runtime",
      "dcraw/darktable product runtime",
      "GPL/nonfree FFmpeg build",
      "unknown Replit Vite plugins",
    ],
    noticeSbomGaps: [
      "final NOTICE/SBOM packaging pass",
      "MediaMTX MIT notice and embedded notice tracking",
      "model/font/asset manifest export proof",
    ],
    unapprovedModelFontAssetItems: [
      "semantic embedding model until exact local model files are bundled and hashed",
      "unknown/non-commercial model weights",
      "unmanifested fonts or report assets",
    ],
    productNotReadyLicenseTopics: [
      "legal final approval is not a DNA decision",
      "blocked tools cannot re-enter product through support-only signals",
      "lab-only media helpers cannot become product runtime without gate proof",
    ],
    autoChangesProductBehavior: false,
    nextLicenseWork:
      "Create a read-only License/Product Gate readiness matrix, then close final NOTICE/SBOM and model/asset manifests under human review.",
  };
}

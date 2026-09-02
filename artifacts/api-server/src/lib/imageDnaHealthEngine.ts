import {
  buildHierarchicalDnaHealthSummary,
  type HierarchicalDnaBaseEngineInput,
  type HierarchicalDnaHealthSummary,
} from "./hierarchicalDnaBaseEngine";

export const IMAGE_DNA_HEALTH_ENGINE_VERSION = "image-dna-health-engine-v0.1" as const;

export interface ImageDnaHealthSummary extends HierarchicalDnaHealthSummary {
  imageEngineVersion: typeof IMAGE_DNA_HEALTH_ENGINE_VERSION;
  learnsFromSignals: readonly string[];
  strongestImageFormats: string[];
  hardestImageAttacks: string[];
  workingRecoveryPaths: string[];
  retestRequiredImageWork: string[];
  notProductReadyImageTopics: string[];
  nextImageWork: string;
}

const IMAGE_LEARNS_FROM_SIGNALS = [
  "JPEG",
  "PNG",
  "WEBP",
  "TIFF",
  "BMP",
  "image seal/read",
  "visual watermarking",
  "compression",
  "resave",
  "crop",
  "resize",
  "screenshot",
  "phone capture",
  "recovery results",
  "product-ready/support-only/lab-only state",
  "license/product gate effects",
] as const;

const IMAGE_ENGINE_CONFIG = {
  dnaName: "Image DNA",
  modules: ["visual", "format_layers", "watermark", "license_product_gate", "evidence"] as const,
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
    "image",
    "visual",
    "jpeg",
    "jpg",
    "png",
    "webp",
    "tiff",
    "bmp",
    "compression",
    "crop",
    "resize",
    "screenshot",
    "phone",
    "capture",
    "recovery",
    "natural micro",
    "dct",
    "product-ready",
  ] as const,
  readinessNote:
    "Image DNA summarizes visual seal/read and recovery evidence only; it cannot promote image paths or decide final proof.",
  defaultActions: [
    {
      riskLevel: "medium" as const,
      title: "Build image recovery and attack matrix",
      reason:
        "Image paths have useful lab evidence, but phone capture, screenshot, crop/resize and compression need durable product summaries.",
      nextStep:
        "Prepare a support-only image matrix covering strong formats, hard attacks, recovery paths and product-gate gaps.",
      requiresHumanApproval: false,
    },
  ],
};

export function buildImageDnaHealth(input: HierarchicalDnaBaseEngineInput = {}): ImageDnaHealthSummary {
  const base = buildHierarchicalDnaHealthSummary(IMAGE_ENGINE_CONFIG, input);

  return {
    ...base,
    imageEngineVersion: IMAGE_DNA_HEALTH_ENGINE_VERSION,
    learnsFromSignals: IMAGE_LEARNS_FROM_SIGNALS,
    strongestImageFormats: [
      "PNG/JPEG support paths with product-safe invisible micro-defect summaries",
      "WEBP/TIFF/BMP support evidence where metadata/sidecar or safe raster layers survive",
      "natural micro-defect legacy-strength invisible profile in tested raster/video-frame cases",
    ],
    hardestImageAttacks: [
      "heavy JPEG recompression after social/messaging transfer",
      "crop plus resize plus screenshot chain",
      "phone photo of screen or printed page under blur/lighting skew",
    ],
    workingRecoveryPaths: [
      "multi-scale natural micro-defect detector support signals",
      "metadata/sidecar/package hash support when the image container permits it",
      "wrong-ID and unsealed negative checks remain separate from advisory recovery",
    ],
    retestRequiredImageWork: [
      "real phone capture matrix",
      "real print-scan image/PDF matrix",
      "social/messaging recompression matrix",
      "crop/resize/blur combined attack matrix",
    ],
    notProductReadyImageTopics: [
      "unsupported image claims without real corpus",
      "any path that requires blocked product tools",
      "any path that mutates visible meaning or source customer image content by default",
    ],
    nextImageWork:
      "Create a read-only Image DNA durability matrix before any stronger image product claim.",
  };
}

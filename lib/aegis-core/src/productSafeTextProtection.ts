import { createHmac } from "node:crypto";
import type { ProtectLayerSummary, ProtectResult } from "./multiLayerProtect.js";

export const PRODUCT_SAFE_TEXT_PROTECTION_VERSION =
  "tancmark-product-safe-text-protection-v1" as const;
export const PRODUCT_SAFE_TEXT_SEAL_PROFILE =
  "natural_micro_defect_legacy_strength_invisible" as const;
export const LEGACY_TEXT_MUTATION_STATUS =
  "archived_lab_only_not_product_default" as const;

export interface ProductSafeProtectOptions {
  secret: string;
  docId?: string;
  keyVersion?: string;
}

export interface ProductSafeProtectResult extends ProtectResult {
  productSafe: true;
  productSealProfile: typeof PRODUCT_SAFE_TEXT_SEAL_PROFILE;
  legacyMutationStatus: typeof LEGACY_TEXT_MUTATION_STATUS;
}

export function emptyArchivedLayerSummary(): ProtectLayerSummary {
  return {
    synonym: {
      replacementCount: 0,
      variantHash: "archived-product-safe-no-synonym-rewrite",
      replacements: [],
    },
    homoglyph: {
      carrierCount: 0,
      flippedCount: 0,
      density: 0,
      positions: [],
    },
    zeroWidth: {
      bitCount: 0,
      bits: [],
    },
  };
}

export function deriveProductSafeProtectionHash(
  text: string,
  clientId: string,
  opts: ProductSafeProtectOptions,
): string {
  return createHmac("sha256", opts.secret)
    .update(
      [
        PRODUCT_SAFE_TEXT_PROTECTION_VERSION,
        PRODUCT_SAFE_TEXT_SEAL_PROFILE,
        LEGACY_TEXT_MUTATION_STATUS,
        `client:${clientId}`,
        `doc:${opts.docId ?? "protect-text"}`,
        `key:${opts.keyVersion ?? "unknown"}`,
        `text:${text}`,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 16);
}

export function productSafeProtectByClient(
  text: string,
  clientId: string,
  opts: ProductSafeProtectOptions,
): ProductSafeProtectResult {
  if (typeof text !== "string") {
    throw new Error("productSafeProtectByClient: text must be a string");
  }
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("productSafeProtectByClient: secret must be at least 8 characters");
  }
  if (!clientId) {
    throw new Error("productSafeProtectByClient: clientId is required");
  }

  return {
    protectedText: text,
    layers: emptyArchivedLayerSummary(),
    protectionHash: deriveProductSafeProtectionHash(text, clientId, opts),
    productSafe: true,
    productSealProfile: PRODUCT_SAFE_TEXT_SEAL_PROFILE,
    legacyMutationStatus: LEGACY_TEXT_MUTATION_STATUS,
  };
}

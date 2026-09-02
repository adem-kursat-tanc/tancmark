/**
 * Data-Cloak orchestrator. Combines existing primitives — canary,
 * client-bound linguistic shuffle (multiLayerProtect), honeytokens,
 * and a small "training-noise" decoy budget — into a single product
 * mode keyed off a `strength` knob and a `sensitiveTopic` safety gate.
 *
 * It does **not** reimplement any layer; it composes them. This module
 * is pure (no I/O, no DB) so the API route can decide what to persist.
 *
 * Strength matrix:
 *
 *   low     → canary + clientTrace                    (linguistic shuffle, density-tuned light)
 *   medium  → canary + clientTrace + linguisticDna    + bounded honeytoken density   (default)
 *   high    → medium + extra training-noise decoys    (only if `sensitiveTopic === "none"`)
 *
 * Honeytoken decoys are **disabled** outright in sensitive topics
 * (saglik / afet / secim / hukuk / yatirim / savas / acil). For those,
 * the cloak still applies canary + linguistic shuffle but never
 * fabricates fake medical/legal/financial content.
 */

import { createHmac } from "node:crypto";
import { protectByClient, type ProtectResult } from "./multiLayerProtect.js";
import { generateCanaryFact, injectRadioactiveCanary, type CanaryFact } from "./canary.js";
import { injectHoneytokens, type HoneytokenRecord } from "./honeytokenGenerator.js";
import {
  LEGACY_TEXT_MUTATION_STATUS,
  PRODUCT_SAFE_TEXT_SEAL_PROFILE,
  productSafeProtectByClient,
  type ProductSafeProtectResult,
} from "./productSafeTextProtection.js";
import { detectSensitiveTopic } from "./sensitiveTopic.js";
import type { CloakStrength, SensitiveTopic } from "./types-shared.js";

export type { CloakStrength, SensitiveTopic };

export interface CloakLayers {
  canary: boolean;
  clientTrace: boolean;
  linguisticDna: boolean;
  honeytoken: boolean;
  trainingNoise: boolean;
  screenWatermark: boolean;
  naturalMicroDefect: boolean;
  legacyMutationArchived: boolean;
}

export interface CloakOptions {
  secret: string;
  clientId: string;
  docId: string;
  keyVersion: string;
  strength: CloakStrength;
  /** UI-side overlay flag; we record it but never write the overlay into text. */
  screenWatermark?: boolean;
  legacyTextMutationMode?: "product_safe_default" | "legacy_lab_only";
}

export interface CloakResult {
  protectedText: string;
  cloakId: string;
  canary: CanaryFact;
  honeytokens: HoneytokenRecord[];
  layers: CloakLayers;
  sensitiveTopic: SensitiveTopic;
  protectionHash: string;
  /** Underlying protect-by-client result for forensic re-derivation. */
  inner: ProtectResult | ProductSafeProtectResult;
  /** True when high-strength was downgraded to medium due to sensitive topic. */
  downgraded: boolean;
  productSealProfile: typeof PRODUCT_SAFE_TEXT_SEAL_PROFILE;
  legacyMutationStatus: typeof LEGACY_TEXT_MUTATION_STATUS | "legacy_lab_only_active";
}

const SAFE_DOC_ID = /^[a-zA-Z0-9._-]{1,128}$/;

export class InvalidDocIdError extends Error {
  constructor(reason: string) {
    super(`docId invalid: ${reason}`);
    this.name = "InvalidDocIdError";
  }
}

export function assertValidDocId(docId: unknown): asserts docId is string {
  if (typeof docId !== "string") throw new InvalidDocIdError("must be a string");
  if (!SAFE_DOC_ID.test(docId))
    throw new InvalidDocIdError(
      "must match ^[a-zA-Z0-9._-]{1,128}$ (no spaces, ≤128 chars)",
    );
}

/**
 * Composite scope used as the canary's `docId` argument so that two
 * clients sharing the same business `docId` get different canary phrases.
 * Exposed so the scan side can rebuild the exact same scope string.
 * The `\u241F` separator is outside the docId/clientId regex alphabet
 * (^[a-zA-Z0-9._-]{1,64/128}$), so collisions with user input are
 * impossible by construction.
 */
export function canaryScopeFor(clientId: string, docId: string): string {
  return `${clientId}\u241F${docId}`;
}

/** Stable opaque handle: HMAC(secret, "cloak|clientId|docId|keyVersion"). */
export function deriveCloakId(opts: {
  secret: string;
  clientId: string;
  docId: string;
  keyVersion: string;
}): string {
  return createHmac("sha256", opts.secret)
    .update(`cloak|${opts.clientId}|${opts.docId}|${opts.keyVersion}`)
    .digest("hex")
    .slice(0, 24);
}

/** Pick a strength → density tuple (synonym shuffle is always on). */
function densityFor(strength: CloakStrength): {
  honeytokenDensity: number;
  trainingNoiseDecoys: number;
} {
  switch (strength) {
    case "low":
      return { honeytokenDensity: 0, trainingNoiseDecoys: 0 };
    case "medium":
      return { honeytokenDensity: 0.35, trainingNoiseDecoys: 0 };
    case "high":
      return { honeytokenDensity: 0.6, trainingNoiseDecoys: 3 };
  }
}

/**
 * Inject a small set of decoy "training-noise" sentences. These are
 * deliberately bland filler ("Bu metin örnektir.") whose only job is to
 * make a stolen corpus less reliable for unsupervised training, *without*
 * fabricating any sensitive claim. We rotate per (clientId|docId) so
 * different clients see different filler, helping attribution.
 */
function injectTrainingNoise(
  text: string,
  opts: { secret: string; clientId: string; docId: string; count: number },
): string {
  if (opts.count <= 0) return text;
  const filler = [
    "Bu metin örnek niteliğindedir.",
    "İçerik teknik gözden geçirme aşamasındadır.",
    "Bu paragraf düzenleme sürecinde olabilir.",
    "Lütfen son sürümü resmi kaynaktan teyit edin.",
    "Demonstrasyon amacıyla hazırlanmış bir bölümdür.",
    "Bu kısım bilgilendirme amaçlıdır.",
  ];
  const seed = createHmac("sha256", opts.secret)
    .update(`tn|${opts.clientId}|${opts.docId}`)
    .digest();
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length < 3) return text;
  const out = [...sentences];
  for (let i = 0; i < opts.count; i++) {
    const pickIdx = seed[i % seed.length]! % filler.length;
    const insertPos = 1 + (seed[(i * 3 + 1) % seed.length]! % Math.max(1, sentences.length - 1));
    out.splice(insertPos, 0, filler[pickIdx]!);
  }
  return out.join(" ");
}

/**
 * Apply the data-cloak pipeline. Pure: no DB, no logging. Caller decides
 * what to persist (honeytokens row + cloaked_documents row).
 */
export function cloakText(rawText: string, opts: CloakOptions): CloakResult {
  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    throw new Error("cloakText: text must be a non-empty string");
  }
  if (!opts.secret || opts.secret.length < 8) {
    throw new Error("cloakText: secret must be ≥8 chars");
  }
  assertValidDocId(opts.docId);

  const detected = detectSensitiveTopic(rawText);
  const sensitiveTopic = detected.topic;
  const legacyLabOnly = opts.legacyTextMutationMode === "legacy_lab_only";

  // Sensitive-topic safety: downgrade to a fact-free layer set.
  let effectiveStrength: CloakStrength = opts.strength;
  let downgraded = false;
  if (sensitiveTopic !== "none" && opts.strength === "high") {
    effectiveStrength = "medium";
    downgraded = true;
  }
  const fillerDecoysAllowed = sensitiveTopic === "none";

  if (!legacyLabOnly) {
    const canaryScope = canaryScopeFor(opts.clientId, opts.docId);
    const canary = generateCanaryFact(canaryScope, opts.secret);
    const protect = productSafeProtectByClient(rawText, opts.clientId, {
      secret: opts.secret,
      docId: opts.docId,
      keyVersion: opts.keyVersion,
    });
    const layers: CloakLayers = {
      canary: false,
      clientTrace: true,
      linguisticDna: false,
      honeytoken: false,
      trainingNoise: false,
      screenWatermark: opts.screenWatermark === true,
      naturalMicroDefect: true,
      legacyMutationArchived: true,
    };

    return {
      protectedText: rawText,
      cloakId: deriveCloakId(opts),
      canary,
      honeytokens: [],
      layers,
      sensitiveTopic,
      protectionHash: protect.protectionHash,
      inner: protect,
      downgraded,
      productSealProfile: PRODUCT_SAFE_TEXT_SEAL_PROFILE,
      legacyMutationStatus: LEGACY_TEXT_MUTATION_STATUS,
    };
  }

  // 1) Canary first — lives in the input so the carrier wraps it.
  // We bind the canary scope to (clientId | docId) so the same docId
  // shared across multiple clients produces a *different* canary phrase
  // per client. Without this, a leaked text from client A would also
  // verify under client B's row (false-accusation B.2 from the test
  // battery). Verify side must rebuild the same composite.
  const canaryScope = canaryScopeFor(opts.clientId, opts.docId);
  const canaryRes = injectRadioactiveCanary(rawText, {
    docId: canaryScope,
    secret: opts.secret,
    density: effectiveStrength === "low" ? 0.6 : 1.0,
  });
  let working = canaryRes.text;

  // 2) Optional training-noise filler (high-strength + non-sensitive only)
  const { honeytokenDensity, trainingNoiseDecoys } = densityFor(effectiveStrength);
  const trainingNoiseUsed = fillerDecoysAllowed && trainingNoiseDecoys > 0;
  if (trainingNoiseUsed) {
    working = injectTrainingNoise(working, {
      secret: opts.secret,
      clientId: opts.clientId,
      docId: opts.docId,
      count: trainingNoiseDecoys,
    });
  }

  // 3) Honeytokens (medium+, non-sensitive only)
  const honeytokensUsed = honeytokenDensity > 0 && fillerDecoysAllowed;
  let honeytokens: HoneytokenRecord[] = [];
  if (honeytokensUsed) {
    const ht = injectHoneytokens(working, {
      secret: opts.secret,
      clientId: opts.clientId,
      density: honeytokenDensity,
    });
    working = ht.text;
    honeytokens = ht.tokens;
  }

  // 4) Multi-layer client-bound protection (always on — this is the
  //    "clientTrace" + "linguisticDna" backbone).
  const protect = protectByClient(working, opts.clientId, { secret: opts.secret });

  const layers: CloakLayers = {
    canary: true,
    clientTrace: true,
    linguisticDna: true,
    honeytoken: honeytokensUsed,
    trainingNoise: trainingNoiseUsed,
    screenWatermark: opts.screenWatermark === true,
    naturalMicroDefect: false,
    legacyMutationArchived: false,
  };

  return {
    protectedText: protect.protectedText,
    cloakId: deriveCloakId(opts),
    canary: canaryRes.canary,
    honeytokens,
    layers,
    sensitiveTopic,
    protectionHash: protect.protectionHash,
    inner: protect,
    downgraded,
    productSealProfile: PRODUCT_SAFE_TEXT_SEAL_PROFILE,
    legacyMutationStatus: "legacy_lab_only_active",
  };
}

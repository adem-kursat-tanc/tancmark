import {
  FINGERPRINT_BITS,
  deriveBits,
  encodeFingerprint,
  identifyFingerprint,
  stripFingerprint,
  type EncodeOptions,
  type IdentifyResult,
} from "./fingerprint.js";
import { detectWatermark, type DetectResult } from "./detect.js";
import {
  addNumericNoise,
  addTextNoise,
  type NumericNoiseOptions,
  type TextNoiseOptions,
} from "./noise.js";
import {
  generateCanaryFact,
  injectRadioactiveCanary,
  extractCanaries,
  verifyCanary,
  type CanaryFact,
  type InjectCanaryOptions,
  type InjectCanaryResult,
  type ExtractedCanary,
} from "./canary.js";
import {
  generateScrambleMap,
  obfuscateText,
  deobfuscateText,
  describeMap,
  type ScrambleMap,
  type ScrambleOptions,
} from "./glyphPoisoner.js";
import {
  shuffleByClient,
  listSynonymGroups,
  lookupSynonym,
  type ShuffleOptions,
  type ShuffleReplacement,
  type ShuffleResult,
  type SynonymGroupHit,
} from "./linguisticShuffler.js";
import {
  analyzeText,
  extractTrapTokens,
  type AnalyzeOptions,
  type CandidateMatch,
  type ForensicResult,
  type TrapToken,
} from "./forensicDetector.js";
import {
  protectByClient,
  analyzeTextMultiChannel,
  HOMOGLYPH_DENSITY,
  ZW_BIT_LENGTH,
  type ProtectOptions,
  type ProtectResult,
  type ProtectLayerSummary,
  type MultiChannelOptions,
  type MultiChannelForensicResult,
  type CandidateMultiChannelMatch,
  type ChannelScore,
} from "./multiLayerProtect.js";
import {
  analyzeStylometry,
  TURKISH_STOP_WORD_LIST,
  type StylometricMetrics,
} from "./stylometricAnalyzer.js";
import {
  diffWords,
  summarizeDiff,
  type DiffEntry,
  type DiffOp,
  type DiffResult,
  type DiffSummary,
} from "./wordDiff.js";
import {
  computeSpatialVariance,
  type SpatialPoint,
  type SpatialVarianceOptions,
  type SpatialVarianceReport,
} from "./spatialVariance.js";
import {
  detectBot,
  type BehaviorSignals,
  type BotDetectInput,
  type BotDetectResult,
  type BotVerdict,
} from "./botDetector.js";
import {
  injectHoneytokens,
  scanForHoneytokens,
  computeAdaptiveDensity,
  type HoneytokenKind,
  type HoneytokenRecord,
  type HoneytokenInjectOptions,
  type HoneytokenInjectResult,
  type HoneytokenScanHit,
} from "./honeytokenGenerator.js";
import {
  applyNumericJitter,
  jitterNumber,
  jitterDelta,
  type JitterOptions,
  type JitterResult,
} from "./numericJitter.js";
import {
  normalizeClientId,
  isValidClientId,
  InvalidClientIdError,
  CLIENT_ID_PATTERN,
} from "./clientId.js";
import {
  cloakText,
  deriveCloakId,
  canaryScopeFor,
  assertValidDocId,
  InvalidDocIdError,
  type CloakOptions,
  type CloakResult,
  type CloakLayers,
  type CloakStrength,
  type SensitiveTopic,
} from "./dataCloak.js";
import {
  deriveProductSafeProtectionHash,
  productSafeProtectByClient,
  PRODUCT_SAFE_TEXT_PROTECTION_VERSION,
  PRODUCT_SAFE_TEXT_SEAL_PROFILE,
  LEGACY_TEXT_MUTATION_STATUS,
  type ProductSafeProtectOptions,
  type ProductSafeProtectResult,
} from "./productSafeTextProtection.js";
import {
  detectSensitiveTopic,
  isSensitiveTopic,
  type SensitiveTopicHit,
} from "./sensitiveTopic.js";
import {
  fuzzyCanaryMatch,
  type FuzzyMatchResult,
  type FuzzyTier,
} from "./paraphraseTolerance.js";
import { simulateOcr, type OcrSimulateOptions } from "./ocrSimulator.js";
import {
  buildSearchPlan,
  valueAppearsIn,
  verifyResults,
  googleCseAdapter,
  githubCodeAdapter,
  type RadarAdapter,
  type RadarHoneytoken,
  type RadarSearchResult,
  type RadarSourceName,
  type RadarVerifiedHit,
} from "./canaryRadar.js";
import {
  digestPayload,
  submitDigest,
  upgradeReceipt,
  isBtcAnchored,
  DEFAULT_OTS_CALENDARS,
  type CalendarReceipt,
  type SubmitOptions,
} from "./legalTimestamp.js";
import {
  extractFingerprints,
  suspectGramHashes,
  attributeFromMatches,
  normaliseTokens,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_WINDOW_SIZES,
  RECOVERY_THRESHOLD,
  HASH_HEX_LEN,
  type Fingerprint,
  type FingerprintInput,
  type RegisteredMatch,
  type AttributionVerdict,
} from "./structuralEntanglement.js";
import {
  BreachSignalBus,
  createBreachSignalBus,
  shouldApplySensitivityBoost,
  SENSITIVITY_BOOST,
  type BreachSignal,
  type BreachSignalContext,
  type BreachSignalInput,
  type BreachSignalType,
  type BreachSeverity,
} from "./breachSignal.js";
import {
  generateBeaconId,
  embedBeaconMarkdown,
  hashForStorage,
  refererToHost,
  TRANSPARENT_GIF_1X1,
} from "./forensicBeacon.js";
import {
  buildChannelProfile,
  indexProfiles,
  CHANNEL_TIERS,
  CHANNEL_NAMES,
  CHANNEL_TIER_MAP,
  VITAL_THRESHOLDS,
  type ChannelTier,
  type ChannelName,
  type ChannelProfile,
  type BuildProfileInput,
} from "./channelIntegrity.js";
import {
  aggregateTieredVerdict,
  TIERED_VERDICTS,
  VERDICT_THRESHOLDS,
  type TieredVerdict,
  type AggregatorCandidate,
  type AggregateInput,
  type AggregateResult,
} from "./verdictAggregator.js";
import {
  buildCascadeChain,
  verifyCascadeChain,
  normalizeStoredCascadeChain,
  deriveTenantSecret,
  ACTIVE_CASCADE_KEY_DERIVATION,
  splitSentences,
  normalizeSentence,
  levenshtein,
  relativeDistance,
  severityFromIntegrity,
  MODIFICATION_TOLERANCE,
  type CascadeNode,
  type CascadeChain,
  type CascadeKeyDerivation,
  type CascadeVerifyResult,
  type BuildCascadeOptions,
  type VerifyCascadeOptions,
} from "./cascadeHash.js";
import {
  embedSemanticPositional,
  verifySemanticPositional,
  loadSemanticModel,
  isSemanticModelLoaded,
  generateSemanticVariants,
  splitSentencesTr,
  COVERAGE_THRESHOLD as SEMANTIC_COVERAGE_THRESHOLD,
  N_BUCKETS as SEMANTIC_N_BUCKETS,
  SEMANTIC_MODEL_INFO,
  SEMANTIC_PLAN_VERSION,
  SEMANTIC_KEY_INFO,
  type SemanticPositionalPlan,
  type SemanticPositionalEntry,
  type SemanticEmbedOptions,
  type SemanticEmbedResult,
  type SemanticEmbedMetrics,
  type SemanticVerifyOptions,
  type SemanticVerifyResult,
  type SemanticPerSentenceResult,
  type SemanticOpName,
  type SemanticSkipReason,
} from "./semantic/index.js";

export interface AegisOptions {
  /**
   * Single-secret legacy form. If provided without `secrets`, it is
   * registered as version "v1" and becomes the active version. Mutually
   * exclusive with `secrets`.
   */
  secret?: string;
  /**
   * Versioned secrets map. Keys are arbitrary version labels (e.g.
   * "v1", "v2", "2026-01"). Used together with `activeVersion`.
   */
  secrets?: Record<string, string>;
  /**
   * Which entry of `secrets` is currently active for *new* protect/inject
   * operations. Old rows can still be matched (substring scan does not
   * depend on the secret). Required when `secrets` is provided.
   */
  activeVersion?: string;
  bits?: number;
}

export class Aegis {
  private readonly secrets: Map<string, string>;
  private readonly _activeVersion: string;
  private readonly secret: string;
  private readonly bits: number;

  constructor(opts: AegisOptions) {
    const map = new Map<string, string>();
    if (opts.secrets && Object.keys(opts.secrets).length > 0) {
      for (const [v, s] of Object.entries(opts.secrets)) {
        if (typeof s !== "string" || s.length < 8) {
          throw new Error(`Aegis: secrets["${v}"] must be a string of at least 8 chars`);
        }
        map.set(v, s);
      }
      const active = opts.activeVersion ?? Array.from(map.keys()).sort().pop()!;
      if (!map.has(active)) {
        throw new Error(`Aegis: activeVersion "${active}" not present in secrets map`);
      }
      this._activeVersion = active;
    } else {
      if (!opts.secret || opts.secret.length < 8) {
        throw new Error("Aegis: secret must be at least 8 characters");
      }
      map.set("v1", opts.secret);
      this._activeVersion = "v1";
    }
    this.secrets = map;
    this.secret = map.get(this._activeVersion)!;
    const bits = opts.bits ?? FINGERPRINT_BITS;
    if (!Number.isInteger(bits) || bits < 8 || bits > 256) {
      throw new Error("Aegis: bits must be an integer in [8, 256]");
    }
    this.bits = bits;
  }

  /** Currently active key version label (used when persisting new traps). */
  activeKeyVersion(): string {
    return this._activeVersion;
  }

  /** All known key versions, including the active one. */
  knownKeyVersions(): ReadonlyArray<string> {
    return Array.from(this.secrets.keys());
  }

  /**
   * Look up the HMAC secret for a given version. Returns `undefined` if
   * the version is not loaded — callers should treat this as a soft
   * failure (the trap row stays in DB but cannot be re-derived).
   */
  getSecretForVersion(version: string): string | undefined {
    return this.secrets.get(version);
  }

  fingerprint(text: string, userId: string, opts?: EncodeOptions): string {
    const bits = deriveBits(this.secret, userId, this.bits);
    return encodeFingerprint(text, bits, opts);
  }

  identify(text: string, candidates: ReadonlyArray<string>): IdentifyResult {
    return identifyFingerprint(text, candidates, this.secret, this.bits);
  }

  detect(text: string): DetectResult {
    return detectWatermark(text);
  }

  strip(text: string): string {
    return stripFingerprint(text);
  }

  addNumericNoise(value: number, opts?: NumericNoiseOptions): number {
    return addNumericNoise(value, { secret: this.secret, ...opts });
  }

  addTextNoise(text: string, opts?: TextNoiseOptions): string {
    return addTextNoise(text, { secret: this.secret, ...opts });
  }

  generateCanary(docId: string): CanaryFact {
    return generateCanaryFact(docId, this.secret);
  }

  injectCanary(text: string, docId: string, density?: number): InjectCanaryResult {
    return injectRadioactiveCanary(text, { docId, secret: this.secret, density });
  }

  extractCanaries(text: string): ExtractedCanary[] {
    return extractCanaries(text);
  }

  verifyCanary(text: string, docId: string) {
    return verifyCanary(text, docId, this.secret);
  }

  generateScrambleMap(text: string, opts?: Omit<ScrambleOptions, "secret">): ScrambleMap {
    return generateScrambleMap(text, { secret: this.secret, ...opts });
  }

  obfuscateText(text: string, map: ScrambleMap): string {
    return obfuscateText(text, map);
  }

  deobfuscateText(text: string, map: ScrambleMap): string {
    return deobfuscateText(text, map);
  }

  shuffleByClient(text: string, clientId: string, opts?: ShuffleOptions): ShuffleResult {
    return shuffleByClient(text, clientId, { secret: this.secret, ...opts });
  }

  analyzeText(
    suspectText: string,
    candidateClientIds: ReadonlyArray<string>,
    opts?: Omit<AnalyzeOptions, "secret">,
  ): ForensicResult {
    return analyzeText(suspectText, candidateClientIds, { secret: this.secret, ...opts });
  }

  /**
   * Multi-layer text protection: synonym + homoglyph + zero-width applied
   * in order. Idempotent (canonicalizes the input first).
   */
  protectByClient(
    text: string,
    clientId: string,
    opts?: Omit<ProtectOptions, "secret">,
  ): ProtectResult {
    return protectByClient(text, clientId, { secret: this.secret, ...opts });
  }

  /**
   * Product-safe text protection: no letter/number/word/meaning mutation.
   * Legacy text mutation remains available only as archived lab code.
   */
  productSafeProtectByClient(
    text: string,
    clientId: string,
    opts?: Omit<ProductSafeProtectOptions, "secret">,
  ): ProductSafeProtectResult {
    return productSafeProtectByClient(text, clientId, { secret: this.secret, ...opts });
  }

  /**
   * Multi-channel forensic attribution. Combines synonym (0.5), homoglyph
   * (0.3), and zero-width (0.2) channels into a weighted score.
   */
  analyzeTextMultiChannel(
    suspectText: string,
    candidateClientIds: ReadonlyArray<string>,
    opts?: Omit<MultiChannelOptions, "secret">,
  ): MultiChannelForensicResult {
    return analyzeTextMultiChannel(suspectText, candidateClientIds, {
      secret: this.secret,
      ...opts,
    });
  }

  /**
   * Stylometric DNA — surface-level style metrics (sentence length, lexical
   * diversity, stop-word distribution). Robust to paraphrasing; useful as a
   * corroborating channel even when watermark layers are stripped.
   */
  analyzeStylometry(text: string): StylometricMetrics {
    return analyzeStylometry(text);
  }

  /** Word-level diff between two texts (a = original/protected, b = suspect). */
  diffWords(a: string, b: string): DiffResult {
    return diffWords(a, b);
  }

  /** Compute synthetic spatial coordinates + carrier markers for a sealed text. */
  computeSpatialVariance(
    text: string,
    opts?: SpatialVarianceOptions,
  ): SpatialVarianceReport {
    return computeSpatialVariance(text, opts);
  }

  /**
   * Inject deterministic honeytokens into `text`. Idempotent for a given
   * `(secret, clientId, text, opts)`. Caller is responsible for persisting
   * the returned `tokens` so a later forensic scan can confirm a hit.
   */
  injectHoneytokens(
    text: string,
    clientId: string,
    opts?: Omit<HoneytokenInjectOptions, "secret" | "clientId">,
  ): HoneytokenInjectResult {
    return injectHoneytokens(text, { secret: this.secret, clientId, ...opts });
  }

  /**
   * Apply deterministic last-digit jitter to numbers in `text`. Each
   * client gets a unique perturbation pattern derived from
   * `HMAC(secret, clientId, original)`, so a later sighting of a
   * jittered value can be attributed to one client.
   */
  applyNumericJitter(
    text: string,
    clientId: string,
    opts?: Omit<JitterOptions, "secret" | "clientId">,
  ): JitterResult {
    return applyNumericJitter(text, { secret: this.secret, clientId, ...opts });
  }

  /**
   * Data-Cloak orchestrator. Wraps `cloakText` so callers don't need to
   * pass `secret` or `keyVersion` — both are pulled from the active
   * keyring slot. The returned `keyVersion` is what the caller must
   * persist on the `cloaked_documents` row.
   */
  cloak(
    text: string,
    opts: Omit<CloakOptions, "secret" | "keyVersion">,
  ): CloakResult & { keyVersion: string } {
    const keyVersion = this._activeVersion;
    const r = cloakText(text, { ...opts, secret: this.secret, keyVersion });
    return { ...r, keyVersion };
  }
}

export {
  FINGERPRINT_BITS,
  deriveBits,
  encodeFingerprint,
  identifyFingerprint,
  stripFingerprint,
  detectWatermark,
  addNumericNoise,
  addTextNoise,
  generateCanaryFact,
  injectRadioactiveCanary,
  extractCanaries,
  verifyCanary,
  generateScrambleMap,
  obfuscateText,
  deobfuscateText,
  describeMap,
  shuffleByClient,
  listSynonymGroups,
  lookupSynonym,
  analyzeText,
  extractTrapTokens,
  protectByClient,
  productSafeProtectByClient,
  deriveProductSafeProtectionHash,
  PRODUCT_SAFE_TEXT_PROTECTION_VERSION,
  PRODUCT_SAFE_TEXT_SEAL_PROFILE,
  LEGACY_TEXT_MUTATION_STATUS,
  analyzeTextMultiChannel,
  HOMOGLYPH_DENSITY,
  ZW_BIT_LENGTH,
  analyzeStylometry,
  TURKISH_STOP_WORD_LIST,
  diffWords,
  summarizeDiff,
  computeSpatialVariance,
  detectBot,
  injectHoneytokens,
  scanForHoneytokens,
  computeAdaptiveDensity,
  applyNumericJitter,
  jitterNumber,
  jitterDelta,
  normalizeClientId,
  isValidClientId,
  InvalidClientIdError,
  CLIENT_ID_PATTERN,
  cloakText,
  deriveCloakId,
  canaryScopeFor,
  assertValidDocId,
  InvalidDocIdError,
  detectSensitiveTopic,
  isSensitiveTopic,
  fuzzyCanaryMatch,
  simulateOcr,
  buildSearchPlan,
  valueAppearsIn,
  verifyResults,
  googleCseAdapter,
  githubCodeAdapter,
  digestPayload,
  submitDigest,
  upgradeReceipt,
  isBtcAnchored,
  DEFAULT_OTS_CALENDARS,
  extractFingerprints,
  suspectGramHashes,
  attributeFromMatches,
  normaliseTokens,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_WINDOW_SIZES,
  RECOVERY_THRESHOLD,
  HASH_HEX_LEN,
  generateBeaconId,
  embedBeaconMarkdown,
  hashForStorage,
  refererToHost,
  TRANSPARENT_GIF_1X1,
  BreachSignalBus,
  createBreachSignalBus,
  shouldApplySensitivityBoost,
  SENSITIVITY_BOOST,
  buildCascadeChain,
  verifyCascadeChain,
  normalizeStoredCascadeChain,
  deriveTenantSecret,
  ACTIVE_CASCADE_KEY_DERIVATION,
  splitSentences,
  normalizeSentence,
  levenshtein,
  relativeDistance,
  severityFromIntegrity,
  MODIFICATION_TOLERANCE,
  buildChannelProfile,
  indexProfiles,
  CHANNEL_TIERS,
  CHANNEL_NAMES,
  CHANNEL_TIER_MAP,
  VITAL_THRESHOLDS,
  aggregateTieredVerdict,
  TIERED_VERDICTS,
  VERDICT_THRESHOLDS,
  embedSemanticPositional,
  verifySemanticPositional,
  loadSemanticModel,
  isSemanticModelLoaded,
  generateSemanticVariants,
  splitSentencesTr,
  SEMANTIC_COVERAGE_THRESHOLD,
  SEMANTIC_N_BUCKETS,
  SEMANTIC_MODEL_INFO,
  SEMANTIC_PLAN_VERSION,
  SEMANTIC_KEY_INFO,
};
export type {
  SemanticPositionalPlan,
  SemanticPositionalEntry,
  SemanticEmbedOptions,
  SemanticEmbedResult,
  SemanticEmbedMetrics,
  SemanticVerifyOptions,
  SemanticVerifyResult,
  SemanticPerSentenceResult,
  SemanticOpName,
  SemanticSkipReason,
};
export type {
  CalendarReceipt,
  SubmitOptions,
  Fingerprint,
  FingerprintInput,
  RegisteredMatch,
  AttributionVerdict,
  RadarAdapter,
  RadarHoneytoken,
  RadarSearchResult,
  RadarSourceName,
  RadarVerifiedHit,
  EncodeOptions,
  IdentifyResult,
  DetectResult,
  NumericNoiseOptions,
  TextNoiseOptions,
  CanaryFact,
  InjectCanaryOptions,
  InjectCanaryResult,
  ExtractedCanary,
  ScrambleMap,
  ScrambleOptions,
  ShuffleOptions,
  ShuffleReplacement,
  ShuffleResult,
  SynonymGroupHit,
  AnalyzeOptions,
  CandidateMatch,
  ForensicResult,
  TrapToken,
  ProtectOptions,
  ProtectResult,
  ProtectLayerSummary,
  MultiChannelOptions,
  MultiChannelForensicResult,
  CandidateMultiChannelMatch,
  ChannelScore,
  StylometricMetrics,
  DiffEntry,
  DiffOp,
  DiffResult,
  DiffSummary,
  SpatialPoint,
  SpatialVarianceOptions,
  SpatialVarianceReport,
  BehaviorSignals,
  BotDetectInput,
  BotDetectResult,
  BotVerdict,
  HoneytokenKind,
  HoneytokenRecord,
  HoneytokenInjectOptions,
  HoneytokenInjectResult,
  HoneytokenScanHit,
  JitterOptions,
  JitterResult,
  CloakOptions,
  CloakResult,
  CloakLayers,
  CloakStrength,
  SensitiveTopic,
  SensitiveTopicHit,
  FuzzyMatchResult,
  FuzzyTier,
  OcrSimulateOptions,
  BreachSignal,
  BreachSignalContext,
  BreachSignalInput,
  BreachSignalType,
  BreachSeverity,
  CascadeNode,
  CascadeChain,
  CascadeKeyDerivation,
  CascadeVerifyResult,
  BuildCascadeOptions,
  VerifyCascadeOptions,
  ChannelTier,
  ChannelName,
  ChannelProfile,
  BuildProfileInput,
  TieredVerdict,
  AggregatorCandidate,
  AggregateInput,
  AggregateResult,
};

export {
  LAYER_TIERS,
  buildMidLayerManifest,
  type LayerTier,
  type LayerContext,
  type LayerApplyResult,
  type LayerVerifyResult,
  type Layer,
  type BuildMidManifestExtras,
  type MidLayerManifestData,
  TAG_BLOCK_START,
  TAG_BLOCK_END,
  TAG_SENTINEL,
  TAG_DATA_LENGTH,
  TAG_BLOCK_LENGTH,
  encodeEmissionToken,
  isTagCodepoint,
  stripTagCodepoints,
  scanForEmissionTokens,
  generateEmissionToken,
  distributeMarkers,
  MIN_MARKERS,
  TARGET_BYTES_PER_MARKER,
  type DecodeScanResult,
  type EmissionTokenInput,
  type EmissionTokenOutput,
  type DistributeMarkersInput,
  type DistributeMarkersOutput,
} from "./layers/index.js";

export {
  deriveVaultKeypair,
  signVaultAnchor,
  verifyVaultAnchor,
  verifyVaultAnchorRaw,
  canonicalizePayload as canonicalizeVaultPayload,
  VAULT_DSA_ALG,
  VAULT_DSA_SEED_BYTES,
  VAULT_KEY_DERIVATION,
  type VaultAnchor,
  type VaultAnchorPayload,
  type VaultKeypair,
  type DeriveVaultKeypairInput,
  type SignVaultAnchorInput,
  type VerifyVaultAnchorInput,
  type VaultKeyDerivation,
} from "./layers/vault/index.js";

export {
  buildL1Stamp,
  l1StampPositions,
  applyL1Stamps,
  detectL1,
  cloakIdToBits,
  planL2Spacing,
  measureLineGaps,
  detectL2,
  embedL3Lsb,
  extractL3Lsb,
  L3_INTERNALS,
  embedL3Dct,
  extractL3Dct,
  embedL3DctAdaptive,
  extractL3DctAdaptive,
  extractL3DctWithPrior,
  L3_DCT_DIGEST_BYTES,
  L3_DCT_PARITY_BYTES,
  L3_DCT_SYNC_LEN,
  L3_DCT_QSTEP,
  L3_DCT_QSTEP_BASE,
  L3_DCT_QSTEP_BOOST,
  L3_DCT_SALIENCY_THRESHOLD,
  type L3DctAdaptiveOptions,
  type L3DctWithPriorOptions,
  type L3DctWithPriorResult,
  type L1Stamp,
  type L1Position,
  type L1DetectResult,
  type L2EncodePlan,
  type L2DetectResult,
  type L3EmbedPlan,
  type L3DetectResult,
  type L3DctEmbedResult,
  type L3DctExtractResult,
  // Faz 5 Step 5.3 — sync markers
  MARKER_SIZE,
  MARKER_PIXELS,
  MARKER_CONTRAST_DELTA,
  MARKER_NCC_THRESHOLD,
  deriveMarkerMask,
  stampMarker,
  detectMarkerAt,
  expectedOuterAnchors,
  expectedInnerAnchors,
  stampAllMarkers,
  detectAllMarkers,
  type MarkerCorner,
  type MarkerTier,
  type MarkerAnchor,
  type MarkerHit,
  // Faz 5 Step 5.4 T1 — 8-marker scheme (4 corner + 4 edge midpoint)
  type EdgeMid,
  type MarkerKey,
  type OuterScheme,
  OUTER_SCHEME_V1,
  OUTER_SCHEME_V2,
  expectedOuterAnchorsV2,
  expectedOuterAnchorsForScheme,
  // Faz 5 Step 5.4 T2 — spatial coverage gate
  outerSpatialCoverage,
  type OuterSide,
  // Faz 5 Step 5.4 T3.5 — multi-scale LARGE marker primitives
  OUTER_SCHEME_V3,
  MARKER_SIZE_LARGE,
  MARKER_PIXELS_LARGE,
  MARKER_LARGE_BIT_REPLICATION,
  MARKER_LARGE_INSET,
  deriveMarkerMaskLarge,
  stampMarkerLarge,
  detectMarkerAtLarge,
  expectedOuterAnchorsLargeV3,
  // Faz 5 Step 5.4.1 — Concentric Identity Marker (CIM) scheme constant.
  OUTER_SCHEME_V4,
  // Faz 5 Step 5.4.1 — CIM hierarchical marker primitives (re-exported
  // from concentricMarker via the visual barrel).
  CIM_SIZE,
  CIM_PIXELS,
  CIM_ID_SIZE,
  CIM_ID_BITS,
  CIM_DELTA_R1,
  CIM_DELTA_R2,
  CIM_DELTA_R3,
  CIM_DELTA_ID,
  CIM_NCC_THRESHOLD_R1,
  CIM_NCC_THRESHOLD_R2,
  CIM_NCC_THRESHOLD_R3,
  CIM_ID_HAMMING_MAX,
  CIM_ROTATION_COUNT,
  cimPixelZone,
  deriveCimIdentity,
  buildCimTemplate,
  rotateTemplate90,
  stampCim,
  detectCimAt,
  expectedOuterAnchorsCimV4,
  cimDegradationLabel,
  buildCimDegradationProfile,
  type CimZone,
  type CimIdentity,
  type CimRingStatus,
  type CimDegradation,
  type CimDetectResult,
  type CimDetectOptions,
  type CimDegradationProfile,
  // Faz 5 Step 5.5 — DCT-Concentric Marker (Frequency Armor) scheme constant
  // + primitives (re-exported from dctConcentricMarker via the visual barrel).
  OUTER_SCHEME_V5,
  DCT_CIM_SIZE,
  DCT_CIM_PIXELS,
  DCT_CIM_COEFFS,
  DCT_R1_RADIUS_MIN,
  DCT_R1_RADIUS_MAX,
  DCT_R2_RADIUS_MIN,
  DCT_R2_RADIUS_MAX,
  DCT_R3_RADIUS_MIN,
  DCT_R3_RADIUS_MAX,
  DCT_ALPHA_R1,
  DCT_ALPHA_R2,
  DCT_ALPHA_R3,
  DCT_R1_NCC_THRESHOLD,
  DCT_R2_NCC_THRESHOLD,
  DCT_R3_NCC_THRESHOLD,
  DCT_R1_COUNT,
  DCT_R2_COUNT,
  DCT_R3_COUNT,
  DCT_R3_RS_DATA_BYTES,
  DCT_R3_RS_PARITY_BYTES,
  DCT_R3_RS_CODEWORD_BYTES,
  DCT_R3_RS_CODEWORD_BITS,
  fdct32,
  idct32,
  getRingCoefficients,
  deriveDctRingSigns,
  deriveDctIdPayload,
  deriveDctConcentricIdentity,
  stampDctConcentric,
  detectDctConcentric,
  expectedOuterAnchorsDctV5,
  dctRingDegradationLabel,
  type RingCoefficient,
  type DctConcentricIdentity,
  type DctRingStatus,
  type DctConcentricDetectResult,
  type DctDegradationLabel,
  type DctDetectOptions,
  type VaultRect,
  // Faz 5 Step 5.3 — vault region
  computeVaultRect,
  extractRgbaSubRect,
  writeRgbaSubRect,
  embedVaultV1,
  extractVaultV1,
  computeVaultPHash,
  // Faz 5 Step 5.8-A.2 — RS(8,4) distributed vault armor (8-stripe transport)
  embedVaultStriped,
  extractVaultStriped,
  planVaultStripeLayout,
  VAULT_STRIPE_SLICES,
  type VaultStripeLayout,
  type VaultStripeEmbedResult,
  type VaultStripeExtractResult,
  // Faz 5 Step 5.8-A.4 — Y-channel adaptive QIM stripe transport
  embedQimYStripes,
  extractQimYStripes,
  // Faz 5 Step 5.8-A.4 T003d — pre-deskew RAW frame fallback projected extract.
  extractQimYStripesProjected,
  VAULT_QIM_Y_STRIPE_SLICES,
  QIM_BLOCK_SIZE,
  QIM_Q_SMOOTH,
  QIM_Q_TEXTURED,
  QIM_TEXTURE_THRESHOLD,
  type QimYRect,
  type QimYStripeEmbedResult,
  type QimYStripeExtractResult,
  // Faz 5 Step 5.8-A.5 (T005) — DCT Mid-Band Stripe Transport
  embedDctStripes,
  extractDctStripes,
  extractDctStripesProjected,
  VAULT_DCT_STRIPE_SLICES,
  DCT_BLOCK_SIZE,
  DCT_QIM_Q,
  DCT_MID_POSITIONS,
  DCT_BITS_PER_BLOCK,
  type DctStripeRect,
  type DctStripeEmbedResult,
  type DctStripeExtractResult,
  pHashHamming,
  computeVaultRectMeanLumaExcludingPatches,
  maskInnerMarkerPatches,
  VAULT_REGION_PHASH_BITS,
  type VaultRectSpec,
  type VaultV1EmbedResult,
  type VaultV1ExtractResult,
  type InnerMarkerPatch,
  // Faz 5 Step 5.3 — affine fit / warp
  fitAffine,
  fitAffineNormalized,
  hartleyNormalize2D,
  computeCoverageRatio,
  simulateForwardWarp,
  recoverAttackedImage,
  applyAffine,
  composeAffine,
  invertAffine,
  rotationAffine,
  translationAffine,
  warpRgba,
  IDENTITY_AFFINE,
  type AffineMatrix,
  type AffineFitResult,
  type Point2,
  type WarpOptions,
  // Faz 5 Step 5.4 T3 — Hough-style rotation deskew
  estimateRotationAngle,
  type HoughDeskewOptions,
  type HoughDeskewResult,
  // Faz 5 Step 5.7-D — Catmull-Rom 4×4 bicubic warp (detect-only buffer)
  warpRgbaBicubic,
  VISUAL_ECC_RECOVERY_LAYER_ID,
  VISUAL_ECC_BITS,
  VISUAL_ECC_DATA_BYTES,
  VISUAL_ECC_PARITY_BYTES,
  VISUAL_ECC_CODE_BYTES,
  VISUAL_ECC_BLOCK_SIZE,
  VISUAL_ECC_PAIR_MARGIN,
  VISUAL_ECC_MIN_BYTE_CONFIDENCE,
  visualEccIdBytesFromCloakId,
  visualEccCodewordFromIdBytes,
  visualEccParityBytesFromCloakId,
  embedVisualEccRecoveryLayer,
  readVisualEccRecoveryLayer,
  verifyVisualEccRecoveryCandidate,
  verifyVisualEccRecoveryCandidateFrames,
  recoverVisualEccIdFromPartialMain,
  type VisualEccConfidenceBand,
  type VisualEccReadFrame,
  type VisualEccRecoveryEmbedResult,
  type VisualEccReadResult,
  type VisualEccCandidateResult,
  type VisualEccPartialRecoveryInput,
  type VisualEccPartialRecoveryResult,
} from "./layers/visual/index.js";

// ── AEGIS DNA çekirdek kayıt yapısı ───────────────────────────────────
// Tüm medya türleri için kalıcı matematiksel ikiz / adli hafıza.
// Bu re-export sayesinde tüketici `@workspace/aegis-core` barrel'dan
// veya `@workspace/aegis-core/dna` subpath'ından erişebilir.
export * from "./dna/index.js";

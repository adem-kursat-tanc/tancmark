// AEGIS v4.1 Faz 5 — Visual Matruşka (3-katmanlı görsel mühür) public API.
//
// Yapısal çizim: ana akış (route) sharp ile pixel buffer'ları üretir; bu
// modüller saf TypeScript ile bit/pattern operasyonları yapar. Sharp veya
// başka native bağımlılık `lib/aegis-core` içinde YOKTUR.

export {
  buildL1Stamp,
  l1StampPositions,
  applyL1Stamps,
  detectL1,
  type L1Stamp,
  type L1Position,
  type L1DetectResult,
} from "./l1Decoy";

export {
  cloakIdToBits,
  planL2Spacing,
  measureLineGaps,
  detectL2,
  type L2EncodePlan,
  type L2DetectResult,
} from "./l2Structural";

export {
  embedL3Lsb,
  extractL3Lsb,
  L3_INTERNALS,
  type L3EmbedPlan,
  type L3DetectResult,
} from "./l3Lsb";

export {
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
  type L3DctEmbedResult,
  type L3DctExtractResult,
  type L3DctAdaptiveOptions,
  type L3DctWithPriorOptions,
  type L3DctWithPriorResult,
} from "./l3Dct";

export {
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
  type VaultRect,
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
  // Faz 5 Step 5.5 — DCT-Concentric Marker (Frequency Armor) scheme constant.
  OUTER_SCHEME_V5,
} from "./syncMarkers";

// Faz 5 Step 5.4.1 — Concentric Identity Markers (CIM): hierarchical
// 3-ring + 8×8 ID-core 32×32 fiducials with 4-cardinal rotation
// invariance and per-ring degradation diagnostics.
export {
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
} from "./concentricMarker";

// Faz 5 Step 5.5 — DCT-Concentric Marker (Frequency Armor + Inner Fortress):
// 32×32 footprint hierarchical 3-ring DCT-II spread-spectrum + RS-protected
// R3 ID payload. Per-ring degradation diagnostics + sub-pixel refinement.
export {
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
} from "./dctConcentricMarker";

export {
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
} from "./affineFit";

// Faz 5 Step 5.4 T3 — Hough-style rotation deskew (Pass 3 fallback).
export {
  estimateRotationAngle,
  type HoughDeskewOptions,
  type HoughDeskewResult,
} from "./houghDeskew";

// T007.10 — Projection-profile sanity check (false-cardinal-lock guard).
// Decisive değil; cardinal pre-search'te tie-breaker olarak kullanılır.
// SUPERSEDED-IN-HARNESS: T007.11 Sobel orientation vote (aşağıda) gerçek
// dense-text üzerinde daha tutarlı; lib korunur (sentetik testlerle 9/9).
export {
  projectionProfileSanity,
  type ProjectionProfileResult,
} from "./projectionProfileSanity";

// T007.11 — Sobel Gradient-Orientation GPS (false-cardinal-lock guard v2).
// Piksel akış yönü histogramı; dense-text dokümanları için projection-profile
// yerine; cardinal pre-search composite score'a tie-breaker. Decisive değil.
export {
  sobelOrientationVote,
  type SobelOrientationVoteOptions,
  type SobelOrientationVoteResult,
} from "./sobelOrientationVote";

// Faz 5 Step 5.7-D — Catmull-Rom 4×4 bicubic warp (detect-only buffer).
// KIRMIZI ÇİZGİ: Detection-only; recoverAttackedImage chain stays bilinear.
export { warpRgbaBicubic } from "./warpBicubic";

// Step 5.8-A.3 SPIKE — Radial intensity profile + 1D NCC primitives.
// KIRMIZI ÇİZGİ: Sharp-free, FFT-free, pure-TS. Phase C ikinci primitif
// (wide-Hough birinci); image değil sadece scale prior üretir.
export {
  extractRadialEnergyProfile,
  crossCorrelate1D,
} from "./radialCorr";

export {
  encodeStripes,
  decodeStripes,
  STRIPE_K,
  STRIPE_N,
  STRIPE_PARITY,
  type DecodeStripesResult,
} from "./stripeDistributor";

export {
  planVaultStripeLayout,
  embedVaultStriped,
  extractVaultStriped,
  VAULT_STRIPE_SLICES,
  type VaultStripeLayout,
  type VaultStripeEmbedResult,
  type VaultStripeExtractResult,
} from "./vaultStripedLayout";

export {
  embedQimYStripes,
  extractQimYStripes,
  extractQimYStripesProjected,
  VAULT_QIM_Y_STRIPE_SLICES,
  QIM_BLOCK_SIZE,
  QIM_Q_SMOOTH,
  QIM_Q_TEXTURED,
  QIM_TEXTURE_THRESHOLD,
  type QimYRect,
  type QimYStripeEmbedResult,
  type QimYStripeExtractResult,
} from "./qimYStripeTransport";

// Faz 5 Step 5.8-A.5 (T005) — DCT Mid-Band Stripe Transport. Y-QIM legacy
// taşıyıcının yerini almak için inşa edildi; route katmanında feature flag
// (FEATURE_DCT_STRIPE) ile devreye girer. Y-QIM modülü dokunulmaz.
export {
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
} from "./dctStripeTransport";

export {
  computeVaultRect,
  extractRgbaSubRect,
  writeRgbaSubRect,
  embedVaultV1,
  extractVaultV1,
  computeVaultPHash,
  pHashHamming,
  computeVaultRectMeanLumaExcludingPatches,
  maskInnerMarkerPatches,
  VAULT_REGION_PHASH_BITS,
  type VaultRectSpec,
  type VaultV1EmbedResult,
  type VaultV1ExtractResult,
  type InnerMarkerPatch,
} from "./vaultRegion";

export {
  encodeIdLow4ToOffsets,
  decodeOffsetsToIdLow4,
  findCandidatesByHamming,
  ANCHOR_AXIS_LEVELS,
  ANCHOR_COUNT,
  ANCHOR_PAYLOAD_BYTES,
  ANCHOR_PAYLOAD_BITS,
  ANCHOR_EXACT_SNAP_MAX,
  ANCHOR_AMBIGUOUS_SNAP_MAX,
  ANCHOR_GEOMETRY_INTERNALS,
  type AnchorOffset,
  type AnchorMeasurement,
  type DecodeResult as AnchorDecodeResult,
  type CandidateMatch as AnchorCandidateMatch,
} from "./anchorGeometryCode";

// T008.5 PROMOTED — Diagonal Pivot + Local Contrast Boost (additive; tripleShield 4-anchor surface byte-identical).
// T008.6 OPT-IN ADDITIVE — Micro-Calibration constants (Gold Master VERİLMEDİ; honest 78.6% < 95% hedef; 27.2° regresyon).
// T008.7 OPT-IN ADDITIVE — Gear-Shift + DNA Cluster Voting (Gold Master VERİLMEDİ; honest 80% < 95% hedef; 27.2° ÇÖZÜLDÜ ama 13.7° yeni regresyon).
// T008.8 OPT-IN ADDITIVE — Tiered Defense + Universal Turbo Restore + Symmetry-Lock Fix (Gold Master VERİLMEDİ; honest 4-açı 84.6% < 95%; 27.2° + 13.7° HER İKİSİ %100 ✨ ama 185.4° substrate-spesifik 50% kalıcı).
export {
  DIAGONAL_PIVOT_CARDINALS,
  NAV_ALPHA_DEFAULT,
  DATA_ALPHA_DEFAULT,
  R1_ERASURE_THR_AGGRESSIVE,
  SUB_GRID_STEP_DEFAULT,
  SUB_GRID_RANGE_DEFAULT,
  LOCAL_BOOST_HALF_DEFAULT,
  DIAGONAL_PIVOT_DEFAULT_CONFIG,
  applyLocalContrastBoost,
  applyLocalBoostAtAnchors,
  RS_ESCALATION_BUDGETS_DEFAULT,
  MICRO_STEP_DEFAULT,
  MICRO_RANGE_DEFAULT,
  RADIAL_ALPHA_NAV_BASE,
  RADIAL_ALPHA_NAV_MAX,
  RADIAL_ALPHA_DATA_BASE,
  RADIAL_ALPHA_DATA_MAX,
  anchorRadialNorm,
  radialAdaptiveAlpha,
  STAMP_FLAT_NAV_ALPHA,
  STAMP_FLAT_DATA_ALPHA,
  SAFE_CARDINALS_DEFAULT,
  RS_BUDGETS_SAFE_DEFAULT,
  RS_BUDGETS_TURBO_DEFAULT,
  MICRO_RANGE_SAFE_DEFAULT,
  MICRO_RANGE_TURBO_DEFAULT,
  N_CLUSTERS_DEFAULT,
  isSafeCardinal,
  clusterAwareErasures,
  TIER1_RS_BUDGET_DEFAULT,
  TIER2_RS_BUDGETS_DEFAULT,
  TIER3_RS_BUDGETS_DEFAULT,
  MICRO_RANGE_TIERED_DEFAULT,
  SYMMETRY_REFRAME_DEG_DEFAULT,
  SYMMETRY_TRIGGER_CARDINAL_DEFAULT,
  TOP_K_CARDINAL_DEFAULT,
  HYBRID_MICRO_RANGE_DEFAULT,
  HYBRID_RS_BUDGETS_DEFAULT,
  HYBRID_TRIGGER_CARDINAL_DEFAULT,
  ID_LEN_WITH_CRC_DEFAULT,
  crc8Ccitt,
  verifyCrc8Payload,
  SUBSTRATE_BOOST_FACTOR_DEFAULT,
  DOLLY_MIN_DATAR1_DEFAULT,
  SOFT_RS_THRESHOLD_DEFAULT,
  SOFT_RS_MAX_FLIPS_DEFAULT,
  flipPolarityXor,
  isDollyGateOpen,
  type AnchorXY,
  type DiagonalPivotConfig,
} from "./diagonalPivot";

// AEGIS V6 — Spatial multiplex region helpers ("Safe Integration").
// Wild Test V5'te (12 May 2026) prove edilen 3-region multiplexing mantığının
// canonical TypeScript modülü. tripleShield.ts BYTE-IDENTICAL korunur.
export {
  multiplexRegions,
  remapAnchorsToRegion,
  majorityVoteBytes,
  type MultiplexRegion,
  type MultiplexAnchorXY,
  type MultiplexCandidate,
} from "./multiplex";

export {
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
} from "./visualEccRecovery";

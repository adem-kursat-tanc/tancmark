import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { aegis } from "../lib/aegis";
import {
  preSealOwnershipCheck,
  type PreSealOwnershipCheckResult,
} from "../lib/preSealOwnershipCheck";
import { listLinguisticDnaClientIds, recordEventFireAndForget } from "../lib/auditStore";
import {
  recordSecureRoomModuleSummaryFireAndForget,
  summarizeTextCommonDecision,
} from "../lib/secureRoomSummary";
import {
  buildHeavyOcrCandidateSupport,
  type HeavyOcrCandidateSupport,
} from "../lib/heavyOcrEscalation";
import { requireAdminToken } from "../middlewares/adminAuth";
import {
  requireVerifiedSealPrincipal,
  verifiedSealAuditDetails,
} from "../middlewares/verifiedSealPrincipal";
import {
  createSecureMemoryUpload,
  MULTIPART_UPLOAD_PROFILES,
} from "../middlewares/multipartUploadSecurity";
import { registerAegisDnaReadOnlyRoute } from "./aegis/dnaReadOnly";
import {
  buildCloakPdfReportFilename,
  buildPdfReportDownloadHeaders,
  buildStandardPdfReportFilename,
} from "./aegis/pdfReportDownloadHeaders";
import {
  normalizeGenerateCloakReportInput,
  normalizeGenerateReportInput,
} from "./aegis/reportInputNormalization";
import { optionalNumberOption, optionalStringOption } from "./aegis/basicTextToolHelpers";
import {
  detectBot,
  scanForHoneytokens,
  computeAdaptiveDensity,
  normalizeClientId,
  InvalidClientIdError,
  type BotDetectInput,
  type BehaviorSignals,
  type HoneytokenRecord,
} from "@workspace/aegis-core";
import {
  db,
  honeytokensTable,
  cloakedDocumentsTable,
  entanglementFingerprintsTable,
  cloakBeaconsTable,
  timestampProofsTable,
  cloakLayersTable,
  decoyEmissionsTable,
  vaultAnchorsTable,
  auditLogsTable,
  aegisDnaRecordsTable,
} from "@workspace/db";
import {
  signVaultAnchor as signVaultAnchorFn,
  verifyVaultAnchorRaw as verifyVaultAnchorRawFn,
  buildL1Stamp,
  l1StampPositions,
  applyL1Stamps,
  detectL1,
  planL2Spacing,
  measureLineGaps,
  detectL2,
  embedL3Lsb,
  extractL3Lsb,
  embedL3Dct,
  extractL3Dct,
  embedL3DctAdaptive,
  extractL3DctAdaptive,
  extractL3DctWithPrior,
  L3_DCT_QSTEP,
  L3_DCT_QSTEP_BASE,
  L3_DCT_QSTEP_BOOST,
  L3_DCT_SALIENCY_THRESHOLD,
  // Faz 5 Step 5.3 — vault region + nested sync markers
  computeVaultRect,
  embedVaultV1,
  extractVaultV1,
  computeVaultPHash,
  // Faz 5 Step 5.8-A.4 — RS(8,4) distributed vault armor + Y-channel adaptive
  // QIM transport (T003b REPLACE: R-LSB transport `embedVaultStriped` /
  // `extractVaultStriped` removed in favor of rotation-tolerant Y-QIM).
  // Çift Kartuş YASAĞI: aynı vault rect üstünde tek aktif transport.
  embedQimYStripes,
  extractQimYStripes,
  // Faz 5 Step 5.8-A.4 T003d — pre-deskew RAW frame fallback. Vault rect
  // template-coords project edilir → raw rotated-source frame'den extract.
  // Maskeleme Kanunu intakt: lib içine RAW warp YOK, caller (bu route) raw
  // pxRgba'yı zaten outer scope'tan TEK bilinear ile yükler; extract sadece
  // luma sample alır.
  extractQimYStripesProjected,
  VAULT_QIM_Y_STRIPE_SLICES,
  // Faz 5 Step 5.8-A.5 (T005) — DCT Mid-Band Stripe Transport. Y-QIM legacy
  // taşıyıcının yerini almak için inşa edildi; FEATURE_DCT_STRIPE flag açıksa
  // mint + extract path'i DCT'ye geçer. Y-QIM kodu LegacyTransport olarak
  // dokunulmaz (zero-risk fallback). Açı sweep kanıtı: DCT 5°-10° aralığında
  // MATCH eder (D04 senaryosu Y-QIM'de fail), 30°+ HONEST FAIL (sıradaki tur
  // spread-spectrum / 16×16 DCT). Çift Kartuş YASAĞI intakt: aynı vault rect
  // üstünde TEK aktif transport (Y-QIM XOR DCT, asla aynı anda).
  embedDctStripes,
  extractDctStripesProjected,
  pHashHamming,
  computeVaultRectMeanLumaExcludingPatches,
  maskInnerMarkerPatches,
  type VaultRectSpec,
  type InnerMarkerPatch,
  deriveMarkerMask,
  stampMarker,
  detectMarkerAt,
  expectedOuterAnchors,
  expectedInnerAnchors,
  // Faz 5 Step 5.4 T1 — 8-marker scheme (4 corner + 4 edge midpoint)
  expectedOuterAnchorsV2,
  expectedOuterAnchorsForScheme,
  OUTER_SCHEME_V1,
  OUTER_SCHEME_V2,
  type OuterScheme,
  type MarkerKey,
  // Faz 5 Step 5.4 T2 — spatial coverage gate
  outerSpatialCoverage,
  MARKER_SIZE,
  // Faz 5 Step 5.4 T3.5 — multi-scale LARGE marker primitives
  OUTER_SCHEME_V3,
  MARKER_SIZE_LARGE,
  deriveMarkerMaskLarge,
  stampMarkerLarge,
  detectMarkerAtLarge,
  expectedOuterAnchorsLargeV3,
  type MarkerCorner,
  deriveTenantSecret,
  // Faz 5 Step 5.4.1 — Concentric Identity Marker (CIM) primitives
  // (32×32 hierarchical fiducial, 4-cardinal rotation invariance).
  OUTER_SCHEME_V4,
  CIM_SIZE,
  CIM_DELTA_R1,
  CIM_DELTA_R2,
  CIM_DELTA_R3,
  CIM_DELTA_ID,
  deriveCimIdentity,
  stampCim,
  detectCimAt,
  expectedOuterAnchorsCimV4,
  buildCimDegradationProfile,
  type CimDetectResult,
  type CimDegradation,
  // Faz 5 Step 5.5 — DCT-domain Concentric Marker (Frekans Zırhı + İç Kale)
  // 32×32 envelope, 3 hierarchical DCT rings R1/R2/R3 + RS(10,5) on R3.
  OUTER_SCHEME_V5,
  DCT_CIM_SIZE,
  deriveDctConcentricIdentity,
  stampDctConcentric,
  detectDctConcentric,
  expectedOuterAnchorsDctV5,
  type DctConcentricDetectResult,
  type DctDegradationLabel,
  // Faz 5 Step 5.3 T6 — affine recovery
  fitAffineNormalized,
  computeCoverageRatio,
  recoverAttackedImage,
  invertAffine,
  applyAffine,
  rotationAffine,
  warpRgba,
  // Faz 5 Step 5.7-D — Catmull-Rom 4×4 bicubic warp (Phase B detect buffer only)
  warpRgbaBicubic,
  // Faz 5 Step 5.4 T3 — Hough deskew (rotate fallback)
  estimateRotationAngle,
  embedVisualEccRecoveryLayer,
  verifyVisualEccRecoveryCandidateFrames,
  type Point2,
  type AffineMatrix,
  type VisualEccReadFrame,
  type VisualEccRecoveryEmbedResult,
} from "@workspace/aegis-core";
import sharp from "sharp";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import {
  assertValidDocId,
  InvalidDocIdError,
  detectSensitiveTopic,
  fuzzyCanaryMatch,
  generateCanaryFact,
  verifyCanary as verifyCanaryFn,
  scanForHoneytokens as scanHoneytokensFn,
  canaryScopeFor,
  extractFingerprints,
  generateBeaconId,
  embedBeaconMarkdown,
  createBreachSignalBus,
  buildCascadeChain,
  verifyCascadeChain,
  normalizeStoredCascadeChain,
  protectByClient,
  severityFromIntegrity,
  buildChannelProfile,
  buildMidLayerManifest,
  aggregateTieredVerdict,
  embedSemanticPositional,
  verifySemanticPositional,
  scanForEmissionTokens,
  generateEmissionToken,
  distributeMarkers,
  type CloakStrength,
  type CascadeVerifyResult,
  type ChannelProfile,
  type AggregateResult,
  type SemanticPositionalPlan,
  type SemanticVerifyResult,
} from "@workspace/aegis-core";
import { tickAndCount } from "../lib/rateTracker";
import { submitTimestampFireAndForget } from "../lib/timestampSubmit";
import type { TimestampProofInput } from "../lib/reportGenerator";

/**
 * FEATURE_DECAY_VERDICT — Faz 3.5 kriz butonu (default `true`).
 *
 * Default (true): tieredVerdict bloğu her zaman hesaplanır + raporlanır;
 * legacy attribution alanları (`suspectedClientId`, `absoluteBreach`,
 * `multiSuspect`, `suspectedClients`) yine otoriter kalır — yeni karar
 * mantığı surface edilir, kararı ezmez.
 *
 * Kapatıldığında (`FEATURE_DECAY_VERDICT=false`): tieredVerdict bloğu
 * `advisoryOnly: true` döner ve audit kaydı `featureDecayVerdict=false`
 * etiketi taşır. UI/PDF tarafının yeni mantığa güvenmediğini bilmesi
 * için açık sinyal. Her durumda audit log atılır (görünürlük korunur).
 */
function isFeatureDecayVerdictEnabled(): boolean {
  const raw = process.env.FEATURE_DECAY_VERDICT;
  if (raw === undefined) return true;
  return raw.trim().toLowerCase() !== "false";
}

/**
 * FEATURE_DCT_STRIPE — Faz 5 Step 5.8-A.5 (T005) wire flag (default `false`).
 *
 * Default (false): mint + extract path mevcut Y-QIM transport'u kullanır
 * (LegacyTransport, T003c+T003d+T004G3 zero-risk fallback). Audit transport
 * label `y-qim-raw-projected-M-rotated`.
 *
 * Açıkken (`FEATURE_DCT_STRIPE=true`): mint embed `embedDctStripes` (DCT
 * mid-band Q=128, low-band [(1,2),(2,1),(2,2),(1,3)]); RAW fallback extract
 * `extractDctStripesProjected`. Audit transport label `dct-stripe-mid-band`.
 *
 * Çift Kartuş YASAĞI: aynı vault rect üzerinde TEK aktif transport — flag
 * her iki tarafta da (embed + extract) ortak okunur, asla yarı-DCT yarı-Y-QIM
 * hibrit oluşmaz. Açı sweep kanıtı (sentetik T7+T8): DCT 5°-10° aralığında
 * MATCH (Y-QIM'in fail ettiği D04 zone); 30° HONEST FAIL (sıradaki tur
 * spread-spectrum / 16×16 DCT mimarisi).
 */
function isFeatureDctStripeEnabled(): boolean {
  const raw = process.env.FEATURE_DCT_STRIPE;
  if (raw === undefined) return false;
  return raw.trim().toLowerCase() === "true";
}

/**
 * AEGIS v4.1 Step 2 — Decoy scan helper (analyze-text yardımcısı).
 *
 * Suspect text içindeki Unicode Tag marker bloklarını tarar, decode eder,
 * `decoy_emissions` tablosunda LOOKUP yapar ve attribution-yardımcı bir
 * sonuç döner. Önemli kurallar:
 *
 *   1. Verdict ladder'a DOKUNMAZ. `decoyMatch` informational/auxiliary.
 *      tieredVerdict yine multi-channel + cascade'den türetilir.
 *   2. Tenant izolasyonu: `scopedClientId` set ise (x-api-key path), yalnızca
 *      o tenant'ın token'ları için Decoy_Matched üretilir; başka tenant'ın
 *      token'ı bu suspect içinde geçiyorsa Decoy_DocMismatch atılır
 *      (cross-tenant frame attempt).
 *   3. Tag codepoint görüldü ama hiçbir token decode olmadıysa
 *      Decoy_Stripped audit'i atılır (normalization residue).
 *   4. Multi-emission: ≥2 farklı emission token decode olursa primary
 *      en yeni `created_at`'e sahip olandır (tek karar fonksiyonu).
 */
type DecoyMatchEmission = {
  emissionToken: string;
  clientId: string;
  docId: string;
  viewerId: string;
  emittedAt: string;
  metadata: Record<string, unknown> | null;
};
type DecoyScanOutcome = {
  tokensFound: number;
  tagCodepointCount: number;
  malformedBlocks: number;
  primaryEmission: DecoyMatchEmission | null;
  multiEmission: boolean;
  otherEmissions: DecoyMatchEmission[];
  /** Decoded but unknown to the (scoped) DB — frame/cross-tenant attempt. */
  unknownTokens: string[];
};
async function runDecoyScanForAnalyze(
  suspectText: string,
  /**
   * Owning tenant id (FK `clients.id`) the caller is bound to via
   * x-api-key. `null` = admin/global path (no tenant scoping —
   * cross-tenant lookups allowed for forensics). When set, the join
   * is restricted to `decoy_emissions.tenant_id = scopedTenantId` —
   * tokens belonging to other tenants become `unknownTokens` (frame
   * attempt). This is the AUTHORITATIVE isolation boundary; sub-customer
   * `client_id` strings can collide across tenants and are NOT trusted
   * as a tenancy signal.
   */
  scopedTenantId: number | null,
): Promise<DecoyScanOutcome> {
  const scan = scanForEmissionTokens(suspectText);
  const empty: DecoyScanOutcome = {
    tokensFound: 0,
    tagCodepointCount: scan.tagCodepointCount,
    malformedBlocks: scan.malformedBlocks,
    primaryEmission: null,
    multiEmission: false,
    otherEmissions: [],
    unknownTokens: [],
  };
  if (scan.tokens.length === 0) return empty;

  // DB lookup over decoded tokens. Tenant scoping: if caller is bound to
  // a tenant via x-api-key, restrict the join to sub-customer IDs that
  // tenant has previously cloaked (derived from audit_logs at the call
  // site). Tokens decoded but belonging outside the allow-list become
  // `unknownTokens` (frame attempt — caller may not see another tenant).
  const baseSelect = db
    .select({
      emissionToken: decoyEmissionsTable.emissionToken,
      clientId: decoyEmissionsTable.clientId,
      docId: decoyEmissionsTable.docId,
      viewerId: decoyEmissionsTable.viewerId,
      createdAt: decoyEmissionsTable.createdAt,
      metadata: decoyEmissionsTable.metadata,
    })
    .from(decoyEmissionsTable);
  let rows: Awaited<ReturnType<typeof baseSelect.where>>;
  if (scopedTenantId === null) {
    rows = await baseSelect.where(
      inArray(decoyEmissionsTable.emissionToken, scan.tokens),
    );
  } else {
    // Tenant-isolated lookup: only emissions written under this tenant
    // (or admin/global emissions where tenant_id IS NULL) resolve.
    rows = await baseSelect.where(
      and(
        inArray(decoyEmissionsTable.emissionToken, scan.tokens),
        eq(decoyEmissionsTable.tenantId, scopedTenantId),
      ),
    );
  }

  const known = new Map<string, (typeof rows)[number]>();
  for (const r of rows) known.set(r.emissionToken, r);
  const matched: DecoyMatchEmission[] = [];
  const unknown: string[] = [];
  for (const tok of scan.tokens) {
    const r = known.get(tok);
    if (!r) {
      unknown.push(tok);
      continue;
    }
    matched.push({
      emissionToken: r.emissionToken,
      clientId: r.clientId,
      docId: r.docId,
      viewerId: r.viewerId,
      emittedAt: r.createdAt.toISOString(),
      metadata: r.metadata ?? null,
    });
  }
  // Most recent emission wins as primary (deterministic single-decision).
  matched.sort((a, b) => b.emittedAt.localeCompare(a.emittedAt));
  const [primary, ...others] = matched;
  return {
    tokensFound: matched.length,
    tagCodepointCount: scan.tagCodepointCount,
    malformedBlocks: scan.malformedBlocks,
    primaryEmission: primary ?? null,
    multiEmission: matched.length >= 2,
    otherEmissions: others,
    unknownTokens: unknown,
  };
}

/** AggregateResult'tan ruleApplied türet (audit + UI gerekçesi için). */
function deriveRuleApplied(r: AggregateResult): string {
  if (r.multiSuspectDemoted) return "multi_suspect_demote";
  if (r.marginGuardDemoted) return "margin_guard_demote";
  if (r.verdict === "STRONG") {
    const first = r.reasons[0] ?? "";
    if (first.startsWith("T0")) return "T0_decisive";
    if (first.startsWith("≥2 T1")) return "T1_double_strong";
    if (first.startsWith("T1 ") && first.includes("T2")) return "T1_T2_combo";
    return "strong_unspecified";
  }
  if (r.verdict === "AMBIGUOUS") return "ambiguous_floor";
  return "insufficient_floor";
}

/**
 * Look up an OpenTimestamps proof bundle for a given protectedText. Returns
 * `null` when no proof exists or the lookup fails — the PDF report must
 * still render in either case (the OTS section simply isn't drawn). The
 * status mapping is: every calendar `btc` → "anchored"; some but not all
 * `btc` → "partial"; otherwise → "pending".
 */
async function loadTimestampProofForProtectedText(
  protectedText: string,
  log: { warn: (...args: unknown[]) => void },
): Promise<TimestampProofInput | undefined> {
  try {
    const digest = createHash("sha256").update(protectedText, "utf8").digest("hex");
    const rows = await db
      .select()
      .from(timestampProofsTable)
      .where(eq(timestampProofsTable.payloadSha256, digest))
      .orderBy(desc(timestampProofsTable.submittedAt))
      .limit(1);
    if (rows.length === 0) return undefined;
    const row = rows[0]!;
    const calendars = (row.proofs ?? []).map((p) => ({
      calendar: p.calendar,
      status: p.status,
    }));
    const btcCount = calendars.filter((c) => c.status === "btc").length;
    // Defensive: a row with `btcAnchored=true` but zero calendar receipts
    // (possible after data migrations / hand-edits) must NOT be advertised
    // as "anchored" on the PDF — there's nothing to substantiate it. Fall
    // through to "pending" in that case.
    const status: TimestampProofInput["status"] =
      calendars.length === 0
        ? "pending"
        : row.btcAnchored
          ? btcCount === calendars.length
            ? "anchored"
            : "partial"
          : btcCount > 0
            ? "partial"
            : "pending";
    return {
      digest: row.payloadSha256,
      submittedAt: row.submittedAt,
      btcAnchored: row.btcAnchored,
      btcBlock: row.btcBlock ?? null,
      status,
      calendars,
    };
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "ots proof lookup failed");
    return undefined;
  }
}

function parseBehavior(raw: unknown): BehaviorSignals | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: BehaviorSignals = {};
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  const me = num(r["mouseEvents"]);
  if (me !== undefined) out.mouseEvents = me;
  const dw = num(r["dwellMs"]);
  if (dw !== undefined) out.dwellMs = dw;
  const ri = num(r["requestIntervalMs"]);
  if (ri !== undefined) out.requestIntervalMs = ri;
  const rs = num(r["requestIntervalStddevMs"]);
  if (rs !== undefined) out.requestIntervalStddevMs = rs;
  return Object.keys(out).length > 0 ? out : undefined;
}

const router: IRouter = Router();

function secureAdminTokenEquals(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected || expected.length < 16) return false;
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

router.post("/fingerprint", (req, res) => {
  const { text, userId, homoglyph, zeroWidth } = req.body ?? {};
  if (typeof text !== "string" || typeof userId !== "string") {
    res.status(400).json({ error: "text and userId required" });
    return;
  }
  const tagged = aegis.fingerprint(text, userId, {
    homoglyph: homoglyph !== false,
    zeroWidth: zeroWidth !== false,
  });
  res.json({ tagged, originalLength: text.length, taggedLength: tagged.length });
});

router.post("/identify", (req, res) => {
  const { text, candidates } = req.body ?? {};
  if (typeof text !== "string" || !Array.isArray(candidates)) {
    res.status(400).json({ error: "text and candidates[] required" });
    return;
  }
  res.json(aegis.identify(text, candidates.map(String)));
});

router.post("/detect", (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  res.json(aegis.detect(text));
});

router.post("/strip", (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  res.json({ clean: aegis.strip(text) });
});

router.post("/noise/numeric", (req, res) => {
  const { value, biasPercent, seed } = req.body ?? {};
  if (typeof value !== "number") {
    res.status(400).json({ error: "value (number) required" });
    return;
  }
  res.json({
    original: value,
    noisy: aegis.addNumericNoise(value, {
      biasPercent: optionalNumberOption(biasPercent),
      seed: optionalStringOption(seed),
    }),
  });
});

router.post("/noise/text", (req, res) => {
  const { text, density, seed } = req.body ?? {};
  if (typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  res.json({
    noisy: aegis.addTextNoise(text, {
      density: optionalNumberOption(density),
      seed: optionalStringOption(seed),
    }),
  });
});

router.post("/protect-text", requireVerifiedSealPrincipal, (req, res, next) => {
  (async () => {
  const { text, clientId, userId, aiTrapMode, behavior: behaviorRaw } = req.body ?? {};
  const principal = req.verifiedSealPrincipal!;
  if (typeof text !== "string" || text.length === 0) {
    res.status(400).json({ error: "text (non-empty string) required" });
    return;
  }
  const clientIdStr = principal.clientId;
  const verifiedAudit = verifiedSealAuditDetails(principal, {
    untrustedRequestedClientId: clientId,
    untrustedRequestedUserId: userId,
  });

  // ── Autonomous AI Trap Layer ───────────────────────────────────────────
  // 1. detectBot (UA + headers + per-IP rate + optional behavior signals)
  // 2. Adaptive density from text-length × bot-score
  // 3. Pattern-based honeytoken injection (email/phone/amount/…)
  // 4. Per-client deterministic numeric jitter (last-digit perturbation)
  // 5. The standard 3-layer protection (synonym + homoglyph + zero-width)
  //    runs LAST, so its carriers wrap both honeytokens AND jitter values.
  // 6. All trap rows are persisted with the resulting `protectionHash`
  //    so the dashboard can group by carrier document.
  const trapMode: "auto" | "force-bot" | "force-human" | "off" =
    aiTrapMode === "force-bot" ||
    aiTrapMode === "force-human" ||
    aiTrapMode === "off"
      ? aiTrapMode
      : "auto";
  const ipForRate = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const recentRequests = tickAndCount(`bot:${ipForRate}`);
  const headerOverride = req.header("x-aegis-trap-test");
  const behavior = parseBehavior(behaviorRaw);
  const detectInput: BotDetectInput = {
    userAgent: req.header("user-agent"),
    headers: req.headers as Record<string, string | string[] | undefined>,
    recentRequests,
    ...(behavior ? { behavior } : {}),
    ...(trapMode === "force-bot" || headerOverride === "bot"
      ? { forceVerdict: "bot" as const }
      : trapMode === "force-human" || headerOverride === "human"
        ? { forceVerdict: "human" as const }
        : {}),
  };
  const botResult = trapMode === "off" ? null : detectBot(detectInput);

  let textForProtection = text;
  let pendingTrapRows: Array<HoneytokenRecord> = [];
  let adaptiveDensity = 0;
  const legacyTextMutationRouteEnabled =
    process.env["TANCMARK_LEGACY_TEXT_MUTATION_LAB"] === "on";
  if (legacyTextMutationRouteEnabled && botResult && botResult.isBot && trapMode !== "off") {
    adaptiveDensity = computeAdaptiveDensity(text.length, botResult.score);
    // Pattern honeytokens + numeric jitter share the same adaptive
    // density. Jitter runs on the already-poisoned text so the two
    // layers compose without re-mangling the inserted fake values.
    const inj = aegis.injectHoneytokens(text, clientIdStr, {
      density: adaptiveDensity,
    });
    textForProtection = inj.text;
    pendingTrapRows = [...inj.tokens];
    // Jitter must NOT touch numeric digits inside an already-injected
    // pattern honeytoken (phone/amount/date/percent) — doing so would
    // mutate the persisted `fakeValue` and break later leak detection.
    const excludedRanges: Array<readonly [number, number]> = inj.tokens
      .filter((t) => t.position >= 0)
      .map((t) => [t.position, t.position + t.fakeValue.length] as const);
    const jit = aegis.applyNumericJitter(textForProtection, clientIdStr, {
      density: adaptiveDensity,
      excludedRanges,
    });
    textForProtection = jit.text;
    pendingTrapRows.push(...jit.tokens);
  }

  // Product-safe default: no synonym/homoglyph/zero-width text mutation.
  // Legacy mutating route behavior is archived behind TANCMARK_LEGACY_TEXT_MUTATION_LAB.
  const result = aegis.productSafeProtectByClient(textForProtection, clientIdStr, {
    keyVersion: aegis.activeKeyVersion(),
  });

  // Persist trap rows AFTER protect so we can stamp them with
  // `protectionHash` (lets the dashboard group traps per carrier doc).
  let honeytokenRecords: Array<{ id: number; kind: string; fakeValue: string; position: number }> = [];
  if (pendingTrapRows.length > 0 && botResult) {
    const ipStr = req.ip ?? req.socket.remoteAddress ?? null;
    const uaStr = req.header("user-agent") ?? null;
    const activeKv = aegis.activeKeyVersion();
    const inserted = await db
      .insert(honeytokensTable)
      .values(
        pendingTrapRows.map((t) => ({
          // clientId is `text` post v3.2 — pass the normalized string
          // directly. NO Number() coercion (would NaN-crash for IDs like
          // "cust-1000" or "agency-news-001").
          clientId: clientIdStr,
          keyVersion: activeKv,
          kind: t.kind,
          fakeValue: t.fakeValue,
          originalValueHash: t.originalValueHash,
          sourceIp: ipStr,
          userAgent: uaStr,
          botScore: botResult.score,
          botVerdict: botResult.verdict,
          botSignals: botResult.signals.join(","),
          protectionHash: result.protectionHash,
        })),
      )
      .returning({ id: honeytokensTable.id, fakeValue: honeytokensTable.fakeValue });
    const idByFake = new Map(inserted.map((r) => [r.fakeValue, r.id]));
    honeytokenRecords = pendingTrapRows.map((t) => ({
      id: idByFake.get(t.fakeValue) ?? -1,
      kind: t.kind,
      fakeValue: t.fakeValue,
      position: t.position,
    }));
  }
  const { synonym, homoglyph, zeroWidth } = result.layers;

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
  const baseAudit = {
    ip,
    route,
    clientId: principal.tenantId,
    userId: principal.actorId,
  } as const;

  // Per-layer audit events — one record per applied layer for transparency.
  recordEventFireAndForget({
    ...baseAudit,
    kind: "Linguistic_DNA",
    details: {
      ...verifiedAudit,
      requestedClientId: clientIdStr,
      protectionHash: result.protectionHash,
      variantHash: synonym.variantHash,
      replacementCount: synonym.replacementCount,
      replacements: synonym.replacements.map((r) => ({
        groupId: r.groupId,
        original: r.original,
        replacement: r.replacement,
      })),
      originalLength: text.length,
      protectedLength: result.protectedText.length,
    },
  });
  recordEventFireAndForget({
    ...baseAudit,
    kind: "Homoglyph_Layer",
    details: {
      ...verifiedAudit,
      requestedClientId: clientIdStr,
      protectionHash: result.protectionHash,
      density: homoglyph.density,
      carrierCount: homoglyph.carrierCount,
      flippedCount: homoglyph.flippedCount,
      positionCount: homoglyph.positions.length,
    },
  });
  recordEventFireAndForget({
    ...baseAudit,
    kind: "ZeroWidth_Layer",
    details: {
      ...verifiedAudit,
      requestedClientId: clientIdStr,
      protectionHash: result.protectionHash,
      bitCount: zeroWidth.bitCount,
      bitsHex: Buffer.from(
        zeroWidth.bits.reduce<number[]>((acc, b, i) => {
          const byteIdx = i >> 3;
          acc[byteIdx] = (acc[byteIdx] ?? 0) | (b << (7 - (i & 7)));
          return acc;
        }, []),
      ).toString("hex"),
    },
  });

  if (botResult && honeytokenRecords.length > 0) {
    const kindCounts: Record<string, number> = {};
    for (const r of honeytokenRecords) {
      kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;
    }
    recordEventFireAndForget({
      ...baseAudit,
      kind: "Bot_Trap_Served",
      details: {
        ...verifiedAudit,
        requestedClientId: clientIdStr,
        botVerdict: botResult.verdict,
        botScore: botResult.score,
        signals: botResult.signals,
        recentRequests,
        trapMode,
        injected: honeytokenRecords.length,
        kinds: kindCounts,
        adaptiveDensity,
        protectionHash: result.protectionHash,
        userAgent: req.header("user-agent") ?? null,
        ...(behavior ? { behavior } : {}),
      },
    });
  }

  // Legal Timestamping (Bitcoin via OpenTimestamps): submit the SHA-256
  // of the protected output to OTS calendar servers. Fire-and-forget
  // so a calendar outage cannot break the protect pipeline. Idempotent
  // on protectionHash via the unique index.
  submitTimestampFireAndForget({
    kind: "protect",
    referenceId: result.protectionHash,
    payload: result.protectedText,
  });
  recordEventFireAndForget({
    ...baseAudit,
    kind: "Timestamp_Submit",
    details: {
      target: "protect",
      referenceId: result.protectionHash,
    },
  });

  res.json({
    protectedText: result.protectedText,
    variantHash: synonym.variantHash,
    protectionHash: result.protectionHash,
    productSealProfile: result.productSealProfile,
    legacyMutationStatus: result.legacyMutationStatus,
    replacementCount: synonym.replacementCount,
    replacements: synonym.replacements,
    layers: {
      synonym: {
        replacementCount: synonym.replacementCount,
        variantHash: synonym.variantHash,
      },
      homoglyph: {
        carrierCount: homoglyph.carrierCount,
        flippedCount: homoglyph.flippedCount,
        density: homoglyph.density,
      },
      zeroWidth: {
        bitCount: zeroWidth.bitCount,
        present: true,
      },
    },
    ...(botResult
      ? {
          botDetection: {
            verdict: botResult.verdict,
            score: botResult.score,
            signals: botResult.signals,
          },
        }
      : {}),
    // Honeytoken details are intentionally NOT returned in the response
    // when the visitor is a bot — surfacing fakeValue/position would let
    // the scraper identify and strip the trap. Only the COUNT (broken
    // down by kind) and the effective adaptive density are exposed.
    // Full per-token records remain available to admins via /bot-traps.
    ...(honeytokenRecords.length > 0
      ? {
          honeytokens: {
            injected: honeytokenRecords.length,
            byKind: honeytokenRecords.reduce<Record<string, number>>((acc, r) => {
              acc[r.kind] = (acc[r.kind] ?? 0) + 1;
              return acc;
            }, {}),
            density: adaptiveDensity,
          },
        }
      : {}),
  });
  })().catch(next);
});

router.post(
  "/analyze-text",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const {
      text,
      candidateClientIds,
      minMatches,
      scanHoneytokens: scanHTOpt,
      cascadeRef,
    } = req.body ?? {};
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }

    // ── AEGIS v4.1 Step 2 — Decoy emission scan ─────────────────────────
    // Tüm response path'lerinden ÖNCE çalışır; sonuç hem honeytoken
    // short-circuit hem multi-channel response'a `decoyMatch` olarak
    // eklenir. **Verdict ladder'a girmez** — yardımcı kanıttır.
    // Tenant scoping: x-api-key path → restrict by tenant_id (authoritative
    // isolation column on decoy_emissions). Admin path → global lookup.
    const decoyScopedTenantId = req.apiClient ? req.apiClient.id : null;
    const decoyScopedClientId = req.apiClient ? String(req.apiClient.id) : null;
    const decoyAuditIp = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const decoyAuditRoute = req.originalUrl.split("?")[0] ?? req.originalUrl;
    const decoyScan = await runDecoyScanForAnalyze(text, decoyScopedTenantId);

    // ── AEGIS v4.1 Step 3 Bölüm 2 — Vault verify (PQC ML-DSA-65) ─────────
    // primarySuspect kararından SONRA çağrılır. `vault_anchors` tablosunda
    // (tenant, clientId[, docId]) için saklı imzayı re-canonical bytes
    // üzerinde doğrudan ml_dsa65.verify ile doğrular. Tampering yüzeyi:
    // signature/payload_canonical/public_key satırın HERHANGİ BİRİ değişirse
    // → "signature-mismatch", matchConfidence "preliminary" kalır. Yalnızca
    // status === "vault-confirmed" durumunda matchConfidence "vault-confirmed"
    // (= "high · Kriptografik Kesinlik") seviyesine yükseltilir.
    type VaultVerification = {
      status: "vault-confirmed" | "signature-mismatch" | "not-found";
      algorithm?: string;
      keyDerivation?: string;
      payloadDigestSha256?: string;
      signedAt?: string;
      version?: number;
      docId?: string;
    };
    const runVaultVerifyForAnalyze = async (args: {
      clientId: string;
      docId?: string | null;
    }): Promise<VaultVerification> => {
      const conds = [eq(vaultAnchorsTable.clientId, args.clientId)];
      if (decoyScopedTenantId !== null) {
        conds.push(eq(vaultAnchorsTable.tenantId, decoyScopedTenantId));
      } else {
        conds.push(sql`${vaultAnchorsTable.tenantId} IS NULL`);
      }
      if (args.docId) conds.push(eq(vaultAnchorsTable.docId, args.docId));
      const rows = await db
        .select()
        .from(vaultAnchorsTable)
        .where(and(...conds))
        .orderBy(desc(vaultAnchorsTable.createdAt))
        .limit(1);
      if (rows.length === 0) {
        recordEventFireAndForget({
          ip: decoyAuditIp,
          route: decoyAuditRoute,
          kind: "Vault_Verified",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            status: "not-found",
            clientIdStr: args.clientId,
            docId: args.docId ?? null,
          },
        });
        return { status: "not-found" };
      }
      const row = rows[0]!;
      const ok = verifyVaultAnchorRawFn({
        publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
        payloadCanonical: row.payloadCanonical,
        signature: new Uint8Array(Buffer.from(row.signature, "base64")),
      });
      const status: "vault-confirmed" | "signature-mismatch" = ok
        ? "vault-confirmed"
        : "signature-mismatch";
      recordEventFireAndForget({
        ip: decoyAuditIp,
        route: decoyAuditRoute,
        kind: "Vault_Verified",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          status,
          clientIdStr: args.clientId,
          docId: row.docId,
          algorithm: row.algorithm,
          payloadDigestSha256: row.payloadDigestSha256,
          version: row.version,
        },
      });
      const signedAtIso =
        row.signedAt instanceof Date
          ? row.signedAt.toISOString()
          : String(row.signedAt);
      return {
        status,
        algorithm: row.algorithm,
        keyDerivation: row.keyDerivation,
        payloadDigestSha256: row.payloadDigestSha256,
        signedAt: signedAtIso,
        version: row.version,
        docId: row.docId,
      };
    };
    // Audit: matched emissions (per row).
    if (decoyScan.primaryEmission) {
      for (const m of [decoyScan.primaryEmission, ...decoyScan.otherEmissions]) {
        recordEventFireAndForget({
          ip: decoyAuditIp,
          route: decoyAuditRoute,
          kind: "Decoy_Matched",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            emissionToken: m.emissionToken,
            clientId: m.clientId,
            docId: m.docId,
            viewerId: m.viewerId,
            emittedAt: m.emittedAt,
            multiEmission: decoyScan.multiEmission,
            primary: m.emissionToken === decoyScan.primaryEmission.emissionToken,
          },
        });
      }
    }
    // Audit: tag codepoints present but nothing decoded → stripping residue.
    if (decoyScan.tagCodepointCount > 0 && decoyScan.tokensFound === 0) {
      recordEventFireAndForget({
        ip: decoyAuditIp,
        route: decoyAuditRoute,
        kind: "Decoy_Stripped",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          tagCodepointCount: decoyScan.tagCodepointCount,
          malformedBlocks: decoyScan.malformedBlocks,
          unknownTokens: decoyScan.unknownTokens.length,
        },
      });
    }
    // Audit: token decoded but absent in (scoped) DB → cross-tenant frame.
    if (decoyScan.unknownTokens.length > 0) {
      recordEventFireAndForget({
        ip: decoyAuditIp,
        route: decoyAuditRoute,
        kind: "Decoy_DocMismatch",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          unknownTokenCount: decoyScan.unknownTokens.length,
          // Tokens themselves are HMAC outputs; safe to log for forensics.
          unknownTokensSample: decoyScan.unknownTokens.slice(0, 8),
          scopedToTenant: decoyScopedClientId,
        },
      });
    }
    function buildDecoyMatchPayload(): Record<string, unknown> | null {
      if (!decoyScan.primaryEmission && decoyScan.tagCodepointCount === 0) {
        return null;
      }
      return {
        tokensFound: decoyScan.tokensFound,
        tagCodepointCount: decoyScan.tagCodepointCount,
        malformedBlocks: decoyScan.malformedBlocks,
        multiEmission: decoyScan.multiEmission,
        primaryEmission: decoyScan.primaryEmission,
        otherEmissions: decoyScan.otherEmissions,
        unknownTokenCount: decoyScan.unknownTokens.length,
      };
    }

    // ── Honeytoken leak scan (absolute breach) ─────────────────────────
    // Runs BEFORE the multi-channel attribution. If we find a fake value
    // we previously served to a bot inside this suspect text, that is
    // dispositive proof of exfiltration — confidence is forced to 1.0
    // and we skip the multi-channel scoring entirely.
    const scanHT = scanHTOpt !== false;
    if (scanHT) {
      // Strip zero-width / homoglyph artefacts so substring search isn't
      // defeated by the carrier characters our own protect-text inserts.
      const stripped = aegis.strip(text);
      const recentTokens = await db
        .select({
          id: honeytokensTable.id,
          clientId: honeytokensTable.clientId,
          keyVersion: honeytokensTable.keyVersion,
          kind: honeytokensTable.kind,
          fakeValue: honeytokensTable.fakeValue,
          createdAt: honeytokensTable.createdAt,
        })
        .from(honeytokensTable)
        .orderBy(desc(honeytokensTable.createdAt))
        .limit(5000);

      // Build per-fakeValue client-set + kind. Jitter has a tiny output
      // space (last-digit ±{1..3}) so the same jittered number commonly
      // occurs for many clients; pattern pools (org/email) are also
      // finite and collide. A "newest wins" dedupe would silently pin
      // attribution to whichever client most recently protected a doc
      // containing that value — falsely accusing innocents.
      // Rule: a hit is **decisive** ONLY if its fakeValue is unique to a
      // single client across all recent honeytokens. Ambiguous hits
      // (shared across ≥2 clients) are dropped from attribution and the
      // request falls through to multi-channel scoring (which never sets
      // absoluteBreach=true).
      // clientId is `text` post v3.2 hardening (string everywhere).
      const clientsByFake = new Map<string, Set<string>>();
      const kindByFake = new Map<string, string>();
      const newestRowByFake = new Map<string, (typeof recentTokens)[number]>();
      for (const t of recentTokens) {
        const set = clientsByFake.get(t.fakeValue) ?? new Set();
        set.add(t.clientId);
        clientsByFake.set(t.fakeValue, set);
        if (!kindByFake.has(t.fakeValue)) kindByFake.set(t.fakeValue, t.kind);
        if (!newestRowByFake.has(t.fakeValue)) newestRowByFake.set(t.fakeValue, t);
      }
      const fakes = [...clientsByFake.keys()];
      const hits = scanForHoneytokens(stripped, fakes);
      // Also try raw text in case strip() altered something we shouldn't.
      const rawHits = hits.length > 0 ? hits : scanForHoneytokens(text, fakes);

      // Keep only unambiguous hits (fakeValue → exactly one client).
      type EnrichedHit = {
        hit: (typeof rawHits)[number];
        clientId: string;
        kind: string;
        token: (typeof recentTokens)[number];
      };
      const unambiguousHits: EnrichedHit[] = [];
      for (const h of rawHits) {
        const owners = clientsByFake.get(h.fakeValue);
        if (!owners || owners.size !== 1) continue; // ambiguous → drop
        const cid = [...owners][0]!;
        const kind = kindByFake.get(h.fakeValue)!;
        const token = newestRowByFake.get(h.fakeValue)!;
        unambiguousHits.push({ hit: h, clientId: cid, kind, token });
      }

      // ── Decisive evidence per client ───────────────────────────────
      // Group unambiguous hits by client. A client becomes a "suspect"
      // (decisive) if it has either:
      //   (a) ≥1 non-jitter unambiguous pattern hit, OR
      //   (b) ≥2 distinct unambiguous jitter fakeValues.
      // Single short jitter substring alone is never decisive — it could
      // be incidental in any text containing 5..9-digit numbers.
      type ClientEvidence = {
        clientId: string;
        patternHits: EnrichedHit[];
        distinctJitterValues: Set<string>;
        jitterHits: EnrichedHit[];
        kinds: Set<string>;
      };
      const evidenceByClient = new Map<string, ClientEvidence>();
      for (const e of unambiguousHits) {
        const cur =
          evidenceByClient.get(e.clientId) ?? {
            clientId: e.clientId,
            patternHits: [],
            distinctJitterValues: new Set<string>(),
            jitterHits: [],
            kinds: new Set<string>(),
          };
        cur.kinds.add(e.kind);
        if (e.kind === "jitter") {
          cur.jitterHits.push(e);
          cur.distinctJitterValues.add(e.hit.fakeValue);
        } else {
          cur.patternHits.push(e);
        }
        evidenceByClient.set(e.clientId, cur);
      }

      const decisiveSuspects: Array<{
        evidence: ClientEvidence;
        decisive: EnrichedHit;
        evidenceCount: number;
      }> = [];
      for (const ev of evidenceByClient.values()) {
        const decisiveHit =
          ev.patternHits[0] ??
          (ev.distinctJitterValues.size >= 2 ? ev.jitterHits[0] : undefined);
        if (!decisiveHit) continue;
        const evidenceCount = ev.patternHits.length + ev.jitterHits.length;
        decisiveSuspects.push({ evidence: ev, decisive: decisiveHit, evidenceCount });
      }

      if (decisiveSuspects.length > 0) {
        // Sort: more total hits first; ties broken by pattern-hit count
        // (pattern > jitter), then by clientId for determinism.
        decisiveSuspects.sort((a, b) => {
          if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;
          if (b.evidence.patternHits.length !== a.evidence.patternHits.length) {
            return b.evidence.patternHits.length - a.evidence.patternHits.length;
          }
          return a.evidence.clientId.localeCompare(b.evidence.clientId);
        });

        const primary = decisiveSuspects[0]!;
        const matched = primary.decisive.token;
        const firstHit = primary.decisive.hit;

        // Atomically flip used=false → used=true on EACH decisive
        // suspect's row. Only the request that wins the flip emits the
        // audit event; concurrent re-scans return absoluteBreach but
        // don't double-log Bot_Trap_Triggered.
        for (const s of decisiveSuspects) {
          const flipped = await db
            .update(honeytokensTable)
            .set({ used: true, detectedAt: new Date() })
            .where(
              and(
                eq(honeytokensTable.id, s.decisive.token.id),
                eq(honeytokensTable.used, false),
              ),
            )
            .returning({ id: honeytokensTable.id });
          if (flipped.length > 0) {
            const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
            const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
            // BreachSignal: honeytoken_detected — flip kazanılınca audit
            // ile birlikte yayınla (concurrent re-scan'lerde tek emit).
            recordEventFireAndForget({
              ip,
              route,
              kind: "Breach_Signal",
              ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
              details: {
                signal: {
                  type: "honeytoken_detected",
                  severity: "high",
                  source: "analyze-text:honeytoken-flip",
                  context: {
                    clientId: s.evidence.clientId,
                    honeytokenId: s.decisive.token.id,
                    kind: s.decisive.token.kind,
                    keyVersion: s.decisive.token.keyVersion,
                    multiSuspect: decisiveSuspects.length > 1,
                  },
                },
              },
            });
            recordEventFireAndForget({
              ip,
              route,
              kind: "Bot_Trap_Triggered",
              ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
              details: {
                honeytokenId: s.decisive.token.id,
                kind: s.decisive.token.kind,
                matchedClientId: s.decisive.token.clientId,
                keyVersion: s.decisive.token.keyVersion,
                servedAt: s.decisive.token.createdAt.toISOString(),
                position: s.decisive.hit.position,
                additionalHits: rawHits.length - 1,
                textLength: text.length,
                multiSuspect: decisiveSuspects.length > 1,
                totalSuspects: decisiveSuspects.length,
              },
            });
          }
        }

        const suspectedClients = decisiveSuspects.map((s) => ({
          clientId: s.evidence.clientId,
          confidenceScore: 1,
          evidenceCount: s.evidenceCount,
          patternHits: s.evidence.patternHits.length,
          jitterHits: s.evidence.jitterHits.length,
          kinds: Array.from(s.evidence.kinds),
        }));
        const multiSuspect = decisiveSuspects.length > 1;

        // Stylometry is still useful as corroborating context.
        const stylometry = aegis.analyzeStylometry(text);

        // Faz 3 — Tiered Verdict (T0 honeytoken yolu).
        // Her decisive suspect için T0=1 profili oluştur, aggregator'ı çağır.
        // T0 istisnası gereği multi-suspect olsa bile verdict STRONG kalır.
        const decisiveProfiles = decisiveSuspects.map((s) => ({
          clientId: s.evidence.clientId,
          combinedScore: 1,
          profile: buildChannelProfile({
            honeytokenHit: true,
            zeroWidth: { score: 0, present: false },
            homoglyph: { score: 0 },
            linguisticDna: { score: 0 },
            cascade: null,
          }),
        }));
        const tieredVerdict = aggregateTieredVerdict({
          candidates: decisiveProfiles,
          decisiveHoneytokenClients: decisiveSuspects.map((s) => s.evidence.clientId),
        });
        const tieredVerdictAdvisoryOnly = !isFeatureDecayVerdictEnabled();
        const tieredVerdictRuleApplied = deriveRuleApplied(tieredVerdict);
        // Faz 3.5 audit — her aggregator çağrısı `ChannelIntegrityProfile_Computed`
        // satırı üretir. Honeytoken yolunda docId yok (lookup öncesi short-circuit).
        // ip/route bu kapsamda henüz declare edilmediği için inline hesapla.
        const auditIpHt = req.ip ?? req.socket?.remoteAddress ?? "unknown";
        const auditRouteHt = req.originalUrl.split("?")[0] ?? req.originalUrl;
        recordEventFireAndForget({
          ip: auditIpHt,
          route: auditRouteHt,
          kind: "ChannelIntegrityProfile_Computed",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            path: "honeytoken-shortcut",
            docId: null,
            suspectedClientId: matched.clientId,
            verdict: tieredVerdict.verdict,
            ruleApplied: tieredVerdictRuleApplied,
            multiSuspect,
            marginGap: tieredVerdict.margin,
            profile: decisiveProfiles[0]?.profile ?? [],
            featureDecayVerdict: !tieredVerdictAdvisoryOnly,
          },
        });

        // AEGIS v4.1 Step 3 Bölüm 2 — Vault verify (PQC) primarySuspect
        // kararından SONRA. Honeytoken decisive olsa bile vault imzası
        // bozulmuşsa matchConfidence "preliminary" kalır.
        const vaultVerificationHt = await runVaultVerifyForAnalyze({
          clientId: matched.clientId,
          docId: decoyScan.primaryEmission?.docId ?? null,
        });
        const matchConfidenceHt: "preliminary" | "vault-confirmed" =
          vaultVerificationHt.status === "vault-confirmed"
            ? "vault-confirmed"
            : "preliminary";
        res.json({
          suspectedClientId: matched.clientId,
          confidenceScore: 1,
          combinedScore: 1,
          matchedTokens: rawHits.length,
          totalTokens: rawHits.length,
          candidates: suspectedClients.map((s) => ({
            clientId: s.clientId,
            matchedTokens: s.evidenceCount,
            totalTokens: s.evidenceCount,
            confidenceScore: 1,
            combinedScore: 1,
          })),
          channelBreakdown: null,
          stylometry,
          absoluteBreach: true,
          channelIntegrityProfile: decisiveProfiles[0]?.profile ?? [],
          tieredVerdict: {
            verdict: tieredVerdict.verdict,
            attributedClientIds: tieredVerdict.attributedClientIds,
            reasons: tieredVerdict.reasons,
            ruleApplied: tieredVerdictRuleApplied,
            marginGuardDemoted: tieredVerdict.marginGuardDemoted,
            multiSuspectDemoted: tieredVerdict.multiSuspectDemoted,
            margin: tieredVerdict.margin,
            strongCandidateCount: tieredVerdict.strongCandidateCount,
            channelProfile: decisiveProfiles[0]?.profile ?? [],
            candidateSummaries: tieredVerdict.candidateSummaries,
            advisoryOnly: tieredVerdictAdvisoryOnly,
          },
          breachEvidence: {
            kind: matched.kind,
            fakeValue: matched.fakeValue,
            matchedClientId: matched.clientId,
            honeytokenId: matched.id,
            keyVersion: matched.keyVersion,
            servedAt: matched.createdAt.toISOString(),
            position: firstHit.position,
          },
          multiSuspect,
          suspectedClients,
          // AEGIS v4.1 Step 2 — decoy auxiliary fields. Honeytoken
          // attribution still wins as `primarySuspect.source`.
          ...(buildDecoyMatchPayload()
            ? { decoyMatch: buildDecoyMatchPayload() }
            : {}),
          primarySuspect: {
            source: "honeytoken" as const,
            clientId: matched.clientId,
            ...(decoyScan.primaryEmission
              ? { decoyViewerId: decoyScan.primaryEmission.viewerId }
              : {}),
            // AEGIS v4.1 Step 3 Bölüm 2 — vault verify sonucu.
            matchConfidence: matchConfidenceHt,
          },
          vaultVerification: vaultVerificationHt,
          ...(multiSuspect
            ? {
                warning:
                  `Multiple decisive client signatures detected (${decisiveSuspects.length}). ` +
                  `The leaked text contains traps from more than one client; ` +
                  `treat each suspect as independently confirmed.`,
              }
            : {}),
        });
        return;
      }
    }

    let candidates: string[];
    if (Array.isArray(candidateClientIds) && candidateClientIds.length > 0) {
      candidates = candidateClientIds
        .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
        .filter((c) => c.length > 0);
    } else if (req.apiClient) {
      // AEGIS v4.0.3 — Cross-Tenant Guard: API key bound caller, scope to its tenant.
      candidates = await listLinguisticDnaClientIds(200, req.apiClient.id);
    } else {
      // Admin-only access (no x-api-key). Fan-out across all tenants for backward
      // compatibility, but warn so operators can spot unscoped forensic sweeps.
      req.log.warn(
        { route: "/analyze-text" },
        "[security] unscoped candidate fan-out (admin-only access, no apiClient scope)",
      );
      candidates = await listLinguisticDnaClientIds(200);
    }

    if (candidates.length === 0) {
      res.json({
        suspectedClientId: null,
        confidenceScore: 0,
        matchedTokens: 0,
        totalTokens: 0,
        candidates: [],
      });
      return;
    }

    const minMatchesNum =
      typeof minMatches === "number" && Number.isFinite(minMatches) && minMatches > 0
        ? Math.floor(minMatches)
        : 1;

    // BreachSignal: per-call bus (per-request scope, race-safe).
    const signalBus = createBreachSignalBus();

    // Multi-channel: synonym (0.5) + homoglyph (0.3) + zero-width (0.2).
    // Bus geçirildiğinde stripping/paraphrase sinyalleri yayınlanır ve
    // boost yolu açılır. Karar ve false-accusation guard değişmez.
    const result = aegis.analyzeTextMultiChannel(text, candidates, {
      minMatches: minMatchesNum,
      signals: signalBus,
    });

    // Stylometric_DNA — surface-level style fingerprint, robust to paraphrasing.
    const stylometry = aegis.analyzeStylometry(text);

    // clientId is a string identifier post v3.2 — never coerce via
    // Number(). "0042" ≠ 42, and non-numeric IDs would silently become
    // null under the old check.
    const suspectedClientId: string | null = result.suspectedClientId ?? null;

    const channelBreakdown = result.bestBreakdown
      ? {
          synonym: {
            matched: result.bestBreakdown.synonym.matched,
            total: result.bestBreakdown.synonym.total,
            score: result.bestBreakdown.synonym.score,
          },
          homoglyph: {
            matched: result.bestBreakdown.homoglyph.matched,
            total: result.bestBreakdown.homoglyph.total,
            score: result.bestBreakdown.homoglyph.score,
          },
          zeroWidth: {
            matched: result.bestBreakdown.zeroWidth.matched,
            total: result.bestBreakdown.zeroWidth.total,
            score: result.bestBreakdown.zeroWidth.score,
            present: result.bestBreakdown.zeroWidth.present,
          },
        }
      : null;

    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    const emittedSignals = signalBus.signals();
    recordEventFireAndForget({
      ip,
      route,
      kind: "forensic_scan",
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        candidateCount: candidates.length,
        candidateSource: Array.isArray(candidateClientIds) ? "explicit" : "audit",
        minMatches: minMatchesNum,
        suspectedClientId,
        suspectedClientIdRaw: result.suspectedClientId,
        confidenceScore: result.confidenceScore,
        combinedScore: result.combinedScore,
        matchedTokens: result.matchedTokens,
        totalTokens: result.totalTokens,
        textLength: text.length,
        channelBreakdown,
        stylometry: {
          wordCount: stylometry.wordCount,
          sentenceCount: stylometry.sentenceCount,
          avgSentenceLength: stylometry.avgSentenceLength,
          lexicalDiversity: stylometry.lexicalDiversity,
          stopWordRatio: stylometry.stopWordRatio,
        },
        boostApplied: result.boostApplied ?? false,
        signalCount: emittedSignals.length,
      },
    });

    // Per-signal Breach_Signal audit (flat, queryable). Tek istekte birden
    // fazla satır atılabilir; her satır tek bir sinyalin tam context'ini
    // taşır. Honeytoken-hit kısa-devresinde bu blok hiç çalışmaz (yukarıda
    // res.json + return ile çıkıyoruz).
    for (const sig of emittedSignals) {
      recordEventFireAndForget({
        ip,
        route,
        kind: "Breach_Signal",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          signal: {
            type: sig.type,
            severity: sig.severity,
            source: sig.source,
            timestamp: sig.timestamp,
            context: sig.context,
          },
          boostApplied: result.boostApplied ?? false,
          suspectedClientId,
        },
      });
    }

    // ── Cascade Hash verify (yardımcı kanıt — verdict ladder'ı ezmez) ───
    // `cascadeRef: { clientId, docId }` verildiyse cloaked_documents'tan
    // stored chain'i çek, suspect text'e karşı doğrula. integrityScore < 1
    // ise `cascade_hash_break` Breach_Signal yayınla. KRİTİK: bu sinyal
    // suspectedClientId set ETMEZ, absoluteBreach=true YAPMAZ — yardımcı
    // metadata olarak `cascadeIntegrity` response'a eklenir.
    let cascadeIntegrity: (CascadeVerifyResult & {
      clientId: string;
      docId: string;
      cloakId: string;
      keyVersion: string;
      keyDerivation: "global" | "hkdf-v1";
    }) | null = null;
    if (
      cascadeRef &&
      typeof cascadeRef === "object" &&
      typeof cascadeRef.clientId === "string" &&
      typeof cascadeRef.docId === "string"
    ) {
      try {
        const refClient = normalizeClientId(cascadeRef.clientId);
        assertValidDocId(cascadeRef.docId);
        const docRows = await db
          .select({
            cloakId: cloakedDocumentsTable.cloakId,
            keyVersion: cloakedDocumentsTable.keyVersion,
            cascadeChain: cloakedDocumentsTable.cascadeChain,
          })
          .from(cloakedDocumentsTable)
          .where(
            and(
              eq(cloakedDocumentsTable.clientId, refClient),
              eq(cloakedDocumentsTable.docId, cascadeRef.docId),
            ),
          )
          .orderBy(desc(cloakedDocumentsTable.createdAt))
          .limit(1);
        const row = docRows[0];
        const normalizedStored = row
          ? normalizeStoredCascadeChain(row.cascadeChain)
          : null;
        if (row && normalizedStored && normalizedStored.nodes.length > 0) {
          const refSecret = aegis.getSecretForVersion(row.keyVersion);
          if (refSecret) {
            // Verifier `keyDerivation` meta'sına göre HKDF tenant key
            // (yeni satırlar) ya da master secret'ı doğrudan (legacy
            // global) seçer. Caller her iki şeklin de doğrulanmasını
            // bekleyebilir.
            const verify = verifyCascadeChain({
              secret: refSecret,
              clientId: refClient,
              docId: cascadeRef.docId,
              storedChain: normalizedStored,
              candidateText: text,
            });
            cascadeIntegrity = {
              ...verify,
              clientId: refClient,
              docId: cascadeRef.docId,
              cloakId: row.cloakId,
              keyVersion: row.keyVersion,
              keyDerivation: normalizedStored.keyDerivation,
            };
            if (verify.integrityScore < 1) {
              const sig = signalBus.emitSignal({
                type: "cascade_hash_break",
                severity: severityFromIntegrity(verify.integrityScore),
                source: "analyze-text:cascade-verify",
                context: {
                  clientId: refClient,
                  docId: cascadeRef.docId,
                  cloakId: row.cloakId,
                  integrityScore: verify.integrityScore,
                  brokenAtIndex: verify.brokenAtIndex,
                  deletedCount: verify.deletedIndices.length,
                  modifiedCount: verify.modifiedIndices.length,
                  reorderedDetected: verify.reorderedDetected,
                },
              });
              recordEventFireAndForget({
                ip,
                route,
                kind: "Breach_Signal",
                ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
                details: {
                  signal: {
                    type: sig.type,
                    severity: sig.severity,
                    source: sig.source,
                    timestamp: sig.timestamp,
                    context: sig.context,
                  },
                },
              });
            }
          }
        }
      } catch (err) {
        // Cascade verify yardımcı kanıttır — başarısızlık ana akışı kırmaz.
        req.log.warn({ err }, "cascade verify failed; continuing");
      }
    }
    // signalBus.signals() bir kez daha çağırıyoruz, cascade signal de
    // dahil olsun (önceki emittedSignals snapshot eski).
    const finalSignals = signalBus.signals();

    // ── Faz 4: Semantic Positional Verify (best-effort, per candidate) ──
    // Her candidate için en yeni cloakedDocuments(plan IS NOT NULL) satırını
    // çek, suspect text'i verify et. signalScore kanal profiline T2
    // corroborator olarak iliştirilir (tek başına STRONG vermez — channel
    // integrity tasarımı zaten R2'yi sadece linguisticDna'ya bağlar).
    // Forensic warning: signalScore ≥ 0.70 + lexicalOverlap ≤ 0.50.
    // FAG (architect bulgusu): SPV seçimi best-legacy yerine en yüksek
    // verified signalScore üzerinden yapılır — best aday'ın planı yoksa veya
    // skip ise runner-up güçlü sinyali yutmasın.
    const semanticVerifyByClient = new Map<string, SemanticVerifyResult>();
    let bestSemanticForensic = false;
    let bestSemanticVerify: (SemanticVerifyResult & { clientId: string; docId: string; cloakId: string }) | null = null;
    if (result.candidates.length > 0) {
      // Tek SQL ile tüm candidate'ların en yeni planlı satırını çek.
      const candidateIds = result.candidates.map((c) => c.clientId);
      try {
        const planRows = await db
          .select({
            clientId: cloakedDocumentsTable.clientId,
            docId: cloakedDocumentsTable.docId,
            cloakId: cloakedDocumentsTable.cloakId,
            keyVersion: cloakedDocumentsTable.keyVersion,
            createdAt: cloakedDocumentsTable.createdAt,
            semanticPositionalPlan: cloakedDocumentsTable.semanticPositionalPlan,
          })
          .from(cloakedDocumentsTable)
          .where(
            and(
              inArray(cloakedDocumentsTable.clientId, candidateIds),
              sql`${cloakedDocumentsTable.semanticPositionalPlan} IS NOT NULL`,
            ),
          )
          .orderBy(desc(cloakedDocumentsTable.createdAt));
        // Per-client en yeni satırı seç (orderBy desc + ilk gelen kazanır).
        const newestByClient = new Map<string, typeof planRows[number]>();
        for (const r of planRows) {
          if (!newestByClient.has(r.clientId)) newestByClient.set(r.clientId, r);
        }
        for (const cand of result.candidates) {
          const row = newestByClient.get(cand.clientId);
          if (!row || !row.semanticPositionalPlan) continue;
          const refSecret = aegis.getSecretForVersion(row.keyVersion);
          if (!refSecret) continue;
          try {
            const v = await verifySemanticPositional(
              text,
              row.semanticPositionalPlan as SemanticPositionalPlan,
              { secret: refSecret },
            );
            if (v.totalBits === 0) continue;
            semanticVerifyByClient.set(cand.clientId, v);
            // En güçlü signalScore'a sahip verified candidate'i sakla.
            if (
              !bestSemanticVerify ||
              v.signalScore > bestSemanticVerify.signalScore
            ) {
              bestSemanticVerify = {
                ...v,
                clientId: cand.clientId,
                docId: row.docId,
                cloakId: row.cloakId,
              };
              bestSemanticForensic = v.forensicParaphraseWarning;
            }
            recordEventFireAndForget({
              ip,
              route,
              kind: "Semantic_Mark_Verified",
              ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
              details: {
                candidateClientId: cand.clientId,
                docId: row.docId,
                cloakId: row.cloakId,
                signalScore: v.signalScore,
                matchedBits: v.matchedBits,
                totalBits: v.totalBits,
                pValue: v.pValue,
                lexicalOverlap: v.lexicalOverlap,
                forensicParaphraseWarning: v.forensicParaphraseWarning,
                verifyTimeMs: v.verifyTimeMs,
              },
            });
          } catch (innerErr) {
            req.log.warn(
              { err: innerErr, clientId: cand.clientId },
              "semantic positional verify failed; skipping candidate",
            );
          }
        }
      } catch (err) {
        req.log.warn({ err }, "semantic positional plan lookup failed; continuing");
      }
    }

    // ── Faz 3: Tiered Verdict Aggregator ─────────────────────────────────
    // Multi-channel sonucu + (varsa) cascade integrity + (varsa) semantic
    // positional → kademeli karar. Honeytoken yolu yukarıda short-circuit
    // ile kapatıldı (T0 path). Burada T1+T2 + AUX-cascade üzerinden karar
    // verilir; aggregator pure. Semantic T2 corroborator olarak eklenir
    // ama R2 STRONG kuralına GİRMEZ (sadece AMBIGUOUS_FLOOR'a katkı verir).
    let tieredVerdictResult: AggregateResult | null = null;
    let bestChannelProfile: ChannelProfile[] = [];
    if (result.candidates.length > 0) {
      const aggregatorCandidates = result.candidates.map((c, idx) => {
        const isBest = idx === 0;
        const semVer = semanticVerifyByClient.get(c.clientId);
        const profile = buildChannelProfile({
          honeytokenHit: false,
          zeroWidth: { score: c.zeroWidth.score, present: c.zeroWidth.present },
          homoglyph: { score: c.homoglyph.score },
          linguisticDna: { score: c.synonym.score },
          semanticPositional: semVer
            ? {
                score: semVer.signalScore,
                present: true,
                note: `${semVer.matchedBits}/${semVer.totalBits} bit match (p=${semVer.pValue.toExponential(2)})`,
              }
            : null,
          // Cascade auxiliary sadece best aday için anlamlı; verifier
          // attribution kararına girmez (Senaryo J invariance garantisi).
          cascade:
            isBest && cascadeIntegrity !== null
              ? { integrityScore: cascadeIntegrity.integrityScore }
              : null,
        });
        if (isBest) bestChannelProfile = profile;
        return { clientId: c.clientId, combinedScore: c.combinedScore, profile };
      });
      tieredVerdictResult = aggregateTieredVerdict({
        candidates: aggregatorCandidates,
      });
    }
    const tieredVerdictAdvisoryOnly = !isFeatureDecayVerdictEnabled();
    const tieredVerdictRuleApplied = tieredVerdictResult
      ? deriveRuleApplied(tieredVerdictResult)
      : null;
    if (tieredVerdictResult) {
      // Faz 3.5 audit — multi-channel yolu. docId varsa (cascadeRef sağlandı)
      // surface edilir; suspectedClientId legacy ladder'dan gelir.
      recordEventFireAndForget({
        ip,
        route,
        kind: "ChannelIntegrityProfile_Computed",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          path: "multi-channel",
          docId: cascadeIntegrity?.docId ?? null,
          suspectedClientId,
          verdict: tieredVerdictResult.verdict,
          ruleApplied: tieredVerdictRuleApplied,
          multiSuspect: false,
          marginGap: tieredVerdictResult.margin,
          profile: bestChannelProfile,
          featureDecayVerdict: !tieredVerdictAdvisoryOnly,
        },
      });
    }

    res.json({
      suspectedClientId,
      confidenceScore: result.confidenceScore,
      combinedScore: result.combinedScore,
      matchedTokens: result.matchedTokens,
      totalTokens: result.totalTokens,
      boostApplied: result.boostApplied ?? false,
      breachSignals: finalSignals.map((s) => ({
        type: s.type,
        severity: s.severity,
        source: s.source,
      })),
      ...(cascadeIntegrity !== null
        ? {
            cascadeIntegrity: {
              clientId: cascadeIntegrity.clientId,
              docId: cascadeIntegrity.docId,
              cloakId: cascadeIntegrity.cloakId,
              keyDerivation: cascadeIntegrity.keyDerivation,
              integrityScore: cascadeIntegrity.integrityScore,
              brokenAtIndex: cascadeIntegrity.brokenAtIndex,
              deletedIndices: cascadeIntegrity.deletedIndices,
              modifiedIndices: cascadeIntegrity.modifiedIndices,
              reorderedDetected: cascadeIntegrity.reorderedDetected,
              insertedCount: cascadeIntegrity.insertedCount,
              totalStored: cascadeIntegrity.totalStored,
              totalCandidate: cascadeIntegrity.totalCandidate,
            },
          }
        : {}),
      candidates: result.candidates.map((c) => ({
        clientId: c.clientId,
        matchedTokens: c.matchedTokens,
        totalTokens: c.totalTokens,
        confidenceScore: c.confidenceScore,
        combinedScore: c.combinedScore,
        channels: {
          synonym: { matched: c.synonym.matched, total: c.synonym.total, score: c.synonym.score },
          homoglyph: { matched: c.homoglyph.matched, total: c.homoglyph.total, score: c.homoglyph.score },
          zeroWidth: {
            matched: c.zeroWidth.matched,
            total: c.zeroWidth.total,
            score: c.zeroWidth.score,
            present: c.zeroWidth.present,
          },
        },
      })),
      channelBreakdown,
      stylometry,
      ...(tieredVerdictResult
        ? {
            channelIntegrityProfile: bestChannelProfile,
            tieredVerdict: {
              verdict: tieredVerdictResult.verdict,
              attributedClientIds: tieredVerdictResult.attributedClientIds,
              reasons: tieredVerdictResult.reasons,
              ruleApplied: tieredVerdictRuleApplied!,
              marginGuardDemoted: tieredVerdictResult.marginGuardDemoted,
              multiSuspectDemoted: tieredVerdictResult.multiSuspectDemoted,
              margin: tieredVerdictResult.margin,
              strongCandidateCount: tieredVerdictResult.strongCandidateCount,
              channelProfile: bestChannelProfile,
              candidateSummaries: tieredVerdictResult.candidateSummaries,
              advisoryOnly: tieredVerdictAdvisoryOnly,
            },
          }
        : {}),
      ...(bestSemanticVerify
        ? {
            semanticPositionalVerification: {
              clientId: bestSemanticVerify.clientId,
              docId: bestSemanticVerify.docId,
              cloakId: bestSemanticVerify.cloakId,
              signalScore: bestSemanticVerify.signalScore,
              matchedBits: bestSemanticVerify.matchedBits,
              totalBits: bestSemanticVerify.totalBits,
              pValue: bestSemanticVerify.pValue,
              lexicalOverlap: bestSemanticVerify.lexicalOverlap,
              alignedSentences: bestSemanticVerify.alignedSentences,
              forensicParaphraseWarning: bestSemanticVerify.forensicParaphraseWarning,
              verifyTimeMs: bestSemanticVerify.verifyTimeMs,
            },
          }
        : {}),
      forensicParaphraseWarning: bestSemanticForensic,
      // AEGIS v4.1 Step 2 — decoy auxiliary fields. **Verdict ladder
      // değişmez** — primarySuspect.source priority: honeytoken (handled
      // in short-circuit above) > multi-channel STRONG > decoy > none.
      ...(buildDecoyMatchPayload()
        ? { decoyMatch: buildDecoyMatchPayload() }
        : {}),
      ...(await (async () => {
        // AEGIS v4.1 Step 3 Bölüm 2 — Vault verify (PQC ML-DSA-65).
        // primarySuspect adayı belirlendikten sonra ilgili clientId+docId
        // için saklı PQC imzayı doğrula; başarılı ise matchConfidence
        // "vault-confirmed" (= "high · Kriptografik Kesinlik"), aksi halde
        // "preliminary" kalır.
        let vaultClientId: string | null = null;
        let vaultDocId: string | null = null;
        if (
          tieredVerdictResult &&
          tieredVerdictResult.verdict === "STRONG" &&
          tieredVerdictResult.attributedClientIds.length > 0
        ) {
          vaultClientId = tieredVerdictResult.attributedClientIds[0]!;
          vaultDocId =
            cascadeIntegrity?.docId ??
            (decoyScan.primaryEmission?.clientId === vaultClientId
              ? decoyScan.primaryEmission.docId
              : null);
        } else if (decoyScan.primaryEmission) {
          vaultClientId = decoyScan.primaryEmission.clientId;
          vaultDocId = decoyScan.primaryEmission.docId;
        }
        const vaultVerification: VaultVerification = vaultClientId
          ? await runVaultVerifyForAnalyze({
              clientId: vaultClientId,
              docId: vaultDocId,
            })
          : { status: "not-found" };
        const matchConfidence: "preliminary" | "vault-confirmed" =
          vaultVerification.status === "vault-confirmed"
            ? "vault-confirmed"
            : "preliminary";
        let primarySuspect: {
          source: "multi-channel" | "decoy" | "none";
          clientId: string | null;
          decoyViewerId?: string;
          matchConfidence: "preliminary" | "vault-confirmed";
        };
        if (
          tieredVerdictResult &&
          tieredVerdictResult.verdict === "STRONG" &&
          tieredVerdictResult.attributedClientIds.length > 0
        ) {
          const cid = tieredVerdictResult.attributedClientIds[0]!;
          primarySuspect = {
            source: "multi-channel",
            clientId: cid,
            ...(decoyScan.primaryEmission &&
            decoyScan.primaryEmission.clientId === cid
              ? { decoyViewerId: decoyScan.primaryEmission.viewerId }
              : {}),
            matchConfidence,
          };
        } else if (decoyScan.primaryEmission) {
          primarySuspect = {
            source: "decoy",
            clientId: decoyScan.primaryEmission.clientId,
            decoyViewerId: decoyScan.primaryEmission.viewerId,
            matchConfidence,
          };
        } else {
          primarySuspect = {
            source: "none",
            clientId: null,
            matchConfidence,
          };
        }
        return { primarySuspect, vaultVerification };
      })()),
    });
  }),
);

router.post(
  "/generate-report",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const normalizedInput = normalizeGenerateReportInput(
      req.body,
      req.header("x-user-id"),
    );
    if (!normalizedInput.ok) {
      res.status(normalizedInput.error.status).json(normalizedInput.error.body);
      return;
    }
    const {
      suspectText,
      protectedText,
      normalizedSuspectedId,
      confidenceScore,
      matchedTokens,
      totalTokens,
      normCandidates,
      userIdStr,
      normChannelBreakdown,
      normStylometry,
      normDiff,
      normSpatial,
      normExpertNotes,
      normAbsoluteBreach,
      normMultiSuspect,
      normSuspectedClients,
      normCascadeIntegrity,
      normTieredVerdict,
      normDecoyMatch,
      normPrimarySuspect,
    } = normalizedInput.value;

    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const tsTimestamp = await loadTimestampProofForProtectedText(
      protectedText,
      req.log,
    );
    const { generateForensicReport } = await import("../lib/reportGenerator.js");
    const report = await generateForensicReport({
      suspectText,
      protectedText,
      suspectedClientId: normalizedSuspectedId,
      confidenceScore,
      matchedTokens,
      totalTokens,
      candidates: normCandidates,
      ...(normChannelBreakdown ? { channelBreakdown: normChannelBreakdown } : {}),
      ...(normStylometry ? { stylometry: normStylometry } : {}),
      ...(normDiff ? { diffSummary: normDiff } : {}),
      ...(normSpatial ? { spatialVariance: normSpatial } : {}),
      ...(normExpertNotes ? { expertNotes: normExpertNotes } : {}),
      ...(tsTimestamp ? { timestamp: tsTimestamp } : {}),
      ...(normCascadeIntegrity ? { cascadeIntegrity: normCascadeIntegrity } : {}),
      ...(normTieredVerdict ? { tieredVerdict: normTieredVerdict } : {}),
      ...(normDecoyMatch ? { decoyMatch: normDecoyMatch } : {}),
      ...(normPrimarySuspect ? { primarySuspect: normPrimarySuspect } : {}),
      ...(userIdStr ? { userId: userIdStr } : {}),
      ...(normAbsoluteBreach ? { absoluteBreach: true } : {}),
      ...(normMultiSuspect ? { multiSuspect: true } : {}),
      ...(normSuspectedClients ? { suspectedClients: normSuspectedClients } : {}),
      ip,
      generatedAt: new Date(),
    });

    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Report_Generated",
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      ...(userIdStr ? { userId: userIdStr } : {}),
      details: {
        suspectedClientId: normalizedSuspectedId,
        confidenceScore,
        matchedTokens,
        totalTokens,
        candidateCount: normCandidates.length,
        reportSha256: report.sha256,
        byteLength: report.byteLength,
        evidenceBlocks: {
          channelBreakdown: !!normChannelBreakdown,
          stylometry: !!normStylometry,
          diffSummary: !!normDiff,
          spatialVariance: !!normSpatial,
          expertNotes: !!normExpertNotes,
          timestamp: !!tsTimestamp,
        },
      },
    });

    const filename = buildStandardPdfReportFilename();
    const headers = buildPdfReportDownloadHeaders({
      filename,
      byteLength: report.byteLength,
      sha256: report.sha256,
    });
    res
      .status(200)
      .setHeader("Content-Type", headers["Content-Type"])
      .setHeader("Content-Length", headers["Content-Length"])
      .setHeader("Content-Disposition", headers["Content-Disposition"])
      .setHeader("x-report-sha256", headers["x-report-sha256"])
      .setHeader("Access-Control-Expose-Headers", headers["Access-Control-Expose-Headers"])
      .end(report.buffer);
  }),
);

// ────────────────────────────────────────────────────────────────────
// Data-Cloak product mode
// ────────────────────────────────────────────────────────────────────

const CLOAK_STRENGTHS = new Set<CloakStrength>(["low", "medium", "high"]);

function classifyRisk(signals: {
  canary: boolean;
  honeytoken: boolean;
  fuzzyTier: "none" | "low" | "medium" | "high";
  dnaScore: number;
}): "high" | "medium" | "low" | "none" {
  if (signals.canary || signals.honeytoken) return "high";
  if (signals.dnaScore >= 0.6 || signals.fuzzyTier === "medium") return "medium";
  if (signals.dnaScore >= 0.3 || signals.fuzzyTier === "low") return "low";
  return "none";
}

function sendPreSealOwnershipStop(
  res: Response,
  check: PreSealOwnershipCheckResult,
): void {
  const isBlock = check.action === "block";
  res.status(409).json({
    error: isBlock
      ? "preseal_ownership_blocked"
      : "preseal_ownership_manual_review",
    message: isBlock
      ? "Bu içerik başka bir TancMark kaydına ait görünüyor. Mühürleme durduruldu."
      : "Bu içerikte kayıtla doğrulanamayan bir TancMark ID görünüyor. Manuel inceleme gerekir.",
    preSealOwnership: {
      action: check.action,
      reason: check.reason,
      exactIdFound: check.exactIdFound,
      decodedId: check.decodedId,
    },
  });
}

router.post(
  "/cloak-text",
  requireVerifiedSealPrincipal,
  asyncHandler(async (req, res) => {
    const {
      text,
      docId,
      clientId,
      strength,
      screenWatermark,
      userId,
      beacon: beaconOpt,
      ownershipDeclared,
    } = req.body ?? {};
    const principal = req.verifiedSealPrincipal!;
    const clientIdStr = principal.clientId;
    const verifiedAudit = verifiedSealAuditDetails(principal, {
      targetRecordId: typeof docId === "string" ? docId : null,
      ownershipDeclarationRecorded: ownershipDeclared === true,
      untrustedRequestedClientId: clientId,
      untrustedRequestedUserId: userId,
    });
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }
    // ── Faz 5 Step 5.7 — Hukuki Ownership Declaration Gate ──
    //
    // Kullanıcının `Bu eserin yasal sahibi benim ve tüm sorumluluğu
    // üstleniyorum` beyanı olmadan mühürleme reddedilir. Beyan zaman
    // damgalı audit log'a yazılır → tamper-evident hukuki delil zinciri.
    //
    // Backward-compat: env `AEGIS_OWNERSHIP_GATE=off` (default `on` in
    // production, `off` in dev/test) gate'i devre dışı bırakır. Smoke
    // harness'ı ve loopback /cloak-image dev mode'da default açık.
    const ownershipGateEnforced =
      (process.env.AEGIS_OWNERSHIP_GATE ?? "off").toLowerCase() === "on";
    const ownershipDeclaredBool = ownershipDeclared === true;
    if (ownershipGateEnforced && !ownershipDeclaredBool) {
      res.status(403).json({
        error: "ownership_declaration_required",
        message:
          "Mühürleme için yasal sahiplik beyanı zorunlu. " +
          "İstek gövdesinde `ownershipDeclared: true` gönderin.",
      });
      return;
    }
    if (ownershipDeclaredBool) {
      recordEventFireAndForget({
        ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
        route: req.originalUrl.split("?")[0] ?? req.originalUrl,
        kind: "Ownership_Declaration_Recorded",
        clientId: principal.tenantId,
        userId: principal.actorId,
        details: {
          ...verifiedAudit,
          declaredAt: new Date().toISOString(),
          gateEnforced: ownershipGateEnforced,
          declarationVersion: "v1",
          declarationText:
            "Bu eserin yasal sahibi benim ve tüm sorumluluğu üstleniyorum.",
        },
      });
    }
    try {
      assertValidDocId(docId);
    } catch (err) {
      if (err instanceof InvalidDocIdError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
    const preSealOwnership = await preSealOwnershipCheck({
      mediaType: "text",
      input: text,
      currentClientId: clientIdStr,
    });
    if (preSealOwnership.action !== "allow") {
      sendPreSealOwnershipStop(res, preSealOwnership);
      return;
    }
    const strengthVal: CloakStrength =
      typeof strength === "string" && CLOAK_STRENGTHS.has(strength as CloakStrength)
        ? (strength as CloakStrength)
        : "medium";

    const cloak = aegis.cloak(text, {
      clientId: clientIdStr,
      docId,
      strength: strengthVal,
      screenWatermark: screenWatermark === true,
    });
    const productSafeTextSeal =
      cloak.legacyMutationStatus === "archived_lab_only_not_product_default";

    // AEGIS v4.0 Faz 4 — Semantic Positional Watermarking. Mühürlenmiş
    // (post-protect) metin üzerinde anlamsal-pozisyonel mühür uygula.
    // Hassas konu/sensitiveSkip durumunda no-op (markedText = rawText).
    // Hata durumunda ana akış kırılmaz; pipelineVersion="v3" geri sarılır.
    const cloakSecret = aegis.getSecretForVersion(cloak.keyVersion) ?? "";
    let semanticTextForChain = cloak.protectedText;
    let semanticPlan: SemanticPositionalPlan | null = null;
    let semanticMetricsForAudit: Record<string, unknown> = {};
    let pipelineVersion: "v3" | "v4" = "v3";
    let semanticSkipReason: string | null = null;
    try {
      if (productSafeTextSeal) {
        semanticSkipReason = "product_safe_text_no_semantic_mutation";
        pipelineVersion = "v4";
      } else {
      const semanticResult = await embedSemanticPositional(cloak.protectedText, {
        secret: cloakSecret,
        clientId: clientIdStr,
        docId,
      });
      semanticTextForChain = semanticResult.markedText;
      // FAG (architect bulgusu): skip planını DB'ye persist ETME — analyze
      // tarafındaki "IS NOT NULL" sorgusu skip planını "en yeni plan" olarak
      // seçip geçerli eski planı gölgeliyordu. Skip durumunda plan null kalır.
      semanticPlan = semanticResult.metrics.sensitiveSkip ? null : semanticResult.plan;
      semanticMetricsForAudit = {
        totalSentences: semanticResult.metrics.totalSentences,
        watermarkedSentences: semanticResult.metrics.watermarkedSentences,
        watermarkRate: semanticResult.metrics.watermarkRate,
        embedTimeMs: semanticResult.metrics.embedTimeMs,
        coldStartMs: semanticResult.metrics.coldStartMs,
        sensitiveSkip: semanticResult.metrics.sensitiveSkip,
        sensitiveTopic: semanticResult.plan.sensitiveTopic,
      };
      pipelineVersion = semanticResult.metrics.sensitiveSkip ? "v3" : "v4";
      if (semanticResult.metrics.sensitiveSkip) {
        semanticSkipReason = `sensitive_topic:${semanticResult.plan.sensitiveTopic}`;
      }
      }
    } catch (err) {
      req.log.warn({ err }, "semantic positional embed failed; pipelineVersion stays v3");
      semanticSkipReason = err instanceof Error ? `error:${err.message}` : "error:unknown";
    }

    // AEGIS v4.0 Faz 2 — Cascade Hash. Mühürlenmiş (post-protect, post-semantic)
    // metin üzerinden cümle bazlı HMAC zinciri üret. Verify side aynı (clientId,
    // docId, secret) üçlüsüyle hash'leri yeniden hesaplayabilir.
    // HMAC-SHA256 zincir + tenant izolasyonu: build her zaman aktif
    // `hkdf-v1` derivation kullanır (HKDF-SHA256 ile clientId-salted
    // anahtar). Persist edilen chain `{keyDerivation, nodes}` wrapper'ı.
    const cascadeChain = buildCascadeChain({
      secret: cloakSecret,
      clientId: clientIdStr,
      docId,
      text: semanticTextForChain,
    });

    // Persist honeytokens (with this carrier's protectionHash so /bot-traps
    // can group them per cloaked doc).
    if (cloak.honeytokens.length > 0) {
      await db.insert(honeytokensTable).values(
        cloak.honeytokens.map((t) => ({
          clientId: clientIdStr,
          keyVersion: cloak.keyVersion,
          kind: t.kind,
          fakeValue: t.fakeValue,
          originalValueHash: t.originalValueHash,
          sourceIp: req.ip ?? req.socket.remoteAddress ?? null,
          userAgent: req.header("user-agent") ?? null,
          botScore: null,
          botVerdict: "cloak",
          botSignals: "cloak-text",
          protectionHash: cloak.protectionHash,
        })),
      );
    }

    // AEGIS v4.0.3 — Composite uniqueness: at most one row per (clientId, docId).
    // Re-cloak overwrites in place; the new cascade chain replaces the old one
    // (intentional — verify against latest version of doc only).
    const cascadeChainPayload = {
      keyDerivation: cascadeChain.keyDerivation,
      nodes: cascadeChain.nodes.map((n) => ({
        index: n.index,
        hash: n.hash,
        normalized: n.normalized,
      })),
    };
    // AEGIS v4.1 Step 3 — Atomic vault boundary. cloaked_documents (canonical
    // mid carrier) + cloak_layers (tier="mid" manifest) + vault_anchors
    // (PQC ML-DSA-65 imza) AYNI Drizzle transaction içinde yazılır. Biri
    // başarısız olursa tüm cloak rollback olur ve route 5xx döner;
    // imzasız mid manifest tek başına yayılmaz, vault anchor'ı olmayan
    // cloaked_documents satırı oluşmaz. Vault_Anchored audit'i de tx
    // içinde transactional yazılır (kanıt zinciri kaybı = rollback).
    const midManifest = buildMidLayerManifest(
      cloak,
      {
        pipelineVersion,
        strength: strengthVal,
        cascadeNodeCount: cascadeChainPayload.nodes.length,
        semanticPositionalPresent: semanticPlan !== null,
      },
      {
        clientId: clientIdStr,
        docId,
        cloakId: cloak.cloakId,
        keyVersion: cloak.keyVersion,
      },
    );

    const vaultIssuedAt = new Date().toISOString();
    const cascadeRoot =
      cascadeChainPayload.nodes.length > 0
        ? cascadeChainPayload.nodes[
            cascadeChainPayload.nodes.length - 1
          ]!.hash
        : null;
    const vaultTenantSalt = `tenant:${principal.tenantId}`;
    const vaultAnchor = signVaultAnchorFn({
      masterSecret: Buffer.from(cloakSecret, "utf8"),
      tenantSalt: vaultTenantSalt,
      clientId: clientIdStr,
      docId,
      cloakId: cloak.cloakId,
      payload: {
        cloakId: cloak.cloakId,
        clientId: clientIdStr,
        docId,
        keyVersion: cloak.keyVersion,
        pipelineVersion,
        protectionHash: cloak.protectionHash ?? null,
        cascadeRoot,
        issuedAt: vaultIssuedAt,
      },
    });
    const vaultPubKeyB64 = Buffer.from(vaultAnchor.publicKey).toString(
      "base64",
    );
    const vaultSigB64 = Buffer.from(vaultAnchor.signature).toString("base64");
    const vaultTenantId = principal.tenantId;

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(cloakedDocumentsTable)
          .values({
            clientId: clientIdStr,
            docId,
            cloakId: cloak.cloakId,
            keyVersion: cloak.keyVersion,
            strength: strengthVal,
            sensitiveTopic: cloak.sensitiveTopic,
            canaryTerm: cloak.canary.term,
            canarySignature: cloak.canary.signature,
            protectionHash: cloak.protectionHash,
            layers: cloak.layers as unknown as Record<string, boolean>,
            cascadeChain: cascadeChainPayload,
            pipelineVersion,
            semanticPositionalPlan: semanticPlan,
          })
          .onConflictDoUpdate({
            target: [
              cloakedDocumentsTable.clientId,
              cloakedDocumentsTable.docId,
            ],
            set: {
              cloakId: cloak.cloakId,
              keyVersion: cloak.keyVersion,
              strength: strengthVal,
              sensitiveTopic: cloak.sensitiveTopic,
              canaryTerm: cloak.canary.term,
              canarySignature: cloak.canary.signature,
              protectionHash: cloak.protectionHash,
              layers: cloak.layers as unknown as Record<string, boolean>,
              cascadeChain: cascadeChainPayload,
              pipelineVersion,
              semanticPositionalPlan: semanticPlan,
              createdAt: new Date(),
            },
          });

        await tx
          .insert(cloakLayersTable)
          .values({
            cloakId: cloak.cloakId,
            clientId: clientIdStr,
            docId,
            tier: midManifest.tier,
            layerData: midManifest.layerData,
          })
          .onConflictDoUpdate({
            target: [
              cloakLayersTable.clientId,
              cloakLayersTable.docId,
              cloakLayersTable.tier,
            ],
            set: {
              cloakId: cloak.cloakId,
              layerData: midManifest.layerData,
              createdAt: new Date(),
            },
          });

        await tx
          .insert(vaultAnchorsTable)
          .values({
            tenantId: vaultTenantId,
            clientId: clientIdStr,
            docId,
            cloakId: cloak.cloakId,
            keyVersion: cloak.keyVersion,
            version: 1,
            algorithm: vaultAnchor.algorithm,
            keyDerivation: vaultAnchor.keyDerivation,
            publicKey: vaultPubKeyB64,
            signature: vaultSigB64,
            payloadCanonical: vaultAnchor.payloadCanonical,
            payloadDigestSha256: vaultAnchor.payloadDigestSha256,
            signedAt: new Date(vaultAnchor.signedAt),
            otsProof: null,
            metadata: { seedInfo: `aegis-vault-mldsa65-v1` },
          })
          .onConflictDoUpdate({
            // Canonical writes are tenant-scoped. Historical NULL-tenant rows
            // remain quarantined read-only and can never match this target.
            target: [
              vaultAnchorsTable.tenantId,
              vaultAnchorsTable.docId,
              vaultAnchorsTable.version,
            ],
            targetWhere: sql`${vaultAnchorsTable.tenantId} IS NOT NULL`,
            set: {
              cloakId: cloak.cloakId,
              clientId: clientIdStr,
              keyVersion: cloak.keyVersion,
              algorithm: vaultAnchor.algorithm,
              keyDerivation: vaultAnchor.keyDerivation,
              publicKey: vaultPubKeyB64,
              signature: vaultSigB64,
              payloadCanonical: vaultAnchor.payloadCanonical,
              payloadDigestSha256: vaultAnchor.payloadDigestSha256,
              signedAt: new Date(vaultAnchor.signedAt),
              createdAt: new Date(),
            },
          });

        await tx.insert(auditLogsTable).values({
          ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
          route: "/api/aegis/cloak-text",
          kind: "Vault_Anchored",
          clientId: vaultTenantId,
          userId: principal.actorId,
          details: {
            ...verifiedAudit,
            cloakId: cloak.cloakId,
            clientIdStr,
            docId,
            algorithm: vaultAnchor.algorithm,
            keyDerivation: vaultAnchor.keyDerivation,
            keyVersion: cloak.keyVersion,
            pipelineVersion,
            payloadDigestSha256: vaultAnchor.payloadDigestSha256,
            cascadeRoot,
            version: 1,
          },
        });
      });
    } catch (err) {
      req.log.error(
        { err, cloakId: cloak.cloakId, docId, clientId: clientIdStr },
        "cloak-text atomic transaction failed (cloaked_documents + cloak_layers + vault_anchors)",
      );
      res.status(500).json({
        error: "cloak persistence failed",
        message: "atomic vault transaction rolled back",
      });
      return;
    }

    // ── AEGIS DNA v0.6.6 — text DNA fire-and-forget persistence ────────
    // Mevcut karar zinciri / response zaten commit edildi. DNA kaydı yazma
    // hatası kanıt zincirini bozmaz. Karar mantığına/eşik/decode'a dokunmaz.
    try {
      const { buildTextDNA } = await import("../text/buildTextDNA.js");
      const activeLayersList = Object.entries(
        cloak.layers as unknown as Record<string, boolean>,
      )
        .filter(([, v]) => v === true)
        .map(([k]) => `text.${k}`);
      const { dna, overlapWarnings } = buildTextDNA({
        cloakId: cloak.cloakId,
        clientId: clientIdStr,
        docId,
        pipelineVersion,
        normalizedText: typeof text === "string" ? text : "",
        activeLayers: activeLayersList,
        payload4Hex: undefined,
      });
      if (overlapWarnings.length > 0) {
        req.log.warn(
          { cloakId: cloak.cloakId, overlapWarnings },
          "aegis_dna_text_overlap_warning",
        );
      }
      await db
        .insert(aegisDnaRecordsTable)
        .values({
          dnaId: dna.dnaId,
          primaryMediaType: dna.primaryMediaType,
          activeMediaTypes: dna.activeMediaTypes,
          pipelineVersion: dna.pipelineVersion,
          contentDigestHex: dna.contentDigest.hex,
          contentSizeBytes: dna.contentDigest.sizeBytes ?? null,
          geometricChecksum: dna.structuralFingerprint.geometricChecksum ?? null,
          idHex: cloak.cloakId,
          payload4Hex: null,
          clientId: clientIdStr,
          dna: dna as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing({ target: aegisDnaRecordsTable.dnaId });
    } catch (err) {
      req.log.warn(
        { err, cloakId: cloak.cloakId, docId },
        "aegis_dna_text_persist_failed (fire-and-forget; response unaffected)",
      );
    }

    // Layer_Mid_Applied audit (analitik metrik) — vault transaction commit
    // sonrası fire-and-forget; başarısızlığı kanıt zincirini bozmaz.
    recordEventFireAndForget({
      ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
      route: "/api/aegis/cloak-text",
      kind: "Layer_Mid_Applied",
      clientId: principal.tenantId,
      userId: principal.actorId,
      details: {
        ...verifiedAudit,
        cloakId: cloak.cloakId,
        clientId: clientIdStr,
        docId,
        tier: "mid",
        pipelineVersion,
        layersApplied: midManifest.layerData.layersApplied,
        cascadeNodeCount: cascadeChainPayload.nodes.length,
        semanticPositionalPresent: semanticPlan !== null,
      },
    });

    // Structural Entanglement: register paraphrase-resilient n-gram
    // fingerprints for this carrier so a leak with 30-50% rewrite still
    // attributes back to (clientId, cloakId).
    const fingerprints = extractFingerprints(semanticTextForChain, {
      clientId: clientIdStr,
      cloakId: cloak.cloakId,
      docId,
    });
    let entanglementCount = 0;
    if (fingerprints.length > 0) {
      // Chunk to keep INSERT statements bounded.
      const CHUNK = 500;
      for (let i = 0; i < fingerprints.length; i += CHUNK) {
        const slice = fingerprints.slice(i, i + CHUNK);
        await db.insert(entanglementFingerprintsTable).values(
          slice.map((f) => ({
            clientId: f.clientId,
            cloakId: f.cloakId,
            docId: f.docId,
            windowSize: f.windowSize,
            windowIndex: f.windowIndex,
            gramHash: f.gramHash,
          })),
        );
      }
      entanglementCount = fingerprints.length;
    }

    // Forensic Beacon (opt-in). Only emitted when the caller passes
    // `beacon: true` AND the strength is medium+ (we don't add a
    // tracking pixel to "low" strength, which is for editorial use).
    let beaconUrl: string | null = null;
    let beaconId: string | null = null;
    let outboundText = semanticTextForChain;
    if (beaconOpt === true && strengthVal !== "low" && !productSafeTextSeal) {
      beaconId = generateBeaconId();
      // Build the beacon URL from a trusted source ONLY (in priority):
      //   1. BEACON_BASE_URL env (operator-controlled canonical origin)
      //   2. REPLIT_DOMAINS / REPLIT_DEV_DOMAIN (platform-trusted)
      //   3. Relative path fallback (still usable when proxied same-origin)
      // We deliberately do NOT trust `Host` / `X-Forwarded-Host` headers
      // — those are attacker-controllable and would let a caller embed
      // a beacon pointing to a domain they control.
      const HOST_RE = /^[a-z0-9.-]{1,253}(?::\d{1,5})?$/i;
      const pickTrustedHost = (): string | null => {
        const explicit = process.env["BEACON_BASE_URL"];
        if (explicit) {
          try {
            const u = new URL(explicit);
            return `${u.protocol}//${u.host}`;
          } catch {
            // fall through
          }
        }
        const domains = process.env["REPLIT_DOMAINS"];
        if (domains) {
          const first = domains.split(",")[0]?.trim();
          if (first && HOST_RE.test(first)) return `https://${first}`;
        }
        const dev = process.env["REPLIT_DEV_DOMAIN"];
        if (dev && HOST_RE.test(dev)) return `https://${dev}`;
        return null;
      };
      const trustedOrigin = pickTrustedHost();
      beaconUrl = trustedOrigin
        ? `${trustedOrigin}/api/aegis/beacon/${beaconId}.gif`
        : `/api/aegis/beacon/${beaconId}.gif`;
      await db.insert(cloakBeaconsTable).values({
        beaconId,
        clientId: clientIdStr,
        cloakId: cloak.cloakId,
        docId,
      });
      outboundText = embedBeaconMarkdown(semanticTextForChain, beaconUrl);
    }

    // Legal Timestamping: anchor the (potentially beacon-augmented)
    // protected output to Bitcoin via OpenTimestamps. Idempotent.
    submitTimestampFireAndForget({
      kind: "cloak",
      referenceId: cloak.cloakId,
      payload: outboundText,
    });

    // AEGIS v4.1 Step 3 Bölüm 3 — Vault OTS köprüsü.
    // ML-DSA-65 imzasının `payloadCanonical`'ı için ayrı bir OTS submission
    // başlat. Sweeper bu satırı pending → btc upgrade ettiğinde
    // `vault_anchors.ots_proof` mirror'ı otomatik güncellenir.
    // Idempotent: (kind, referenceId) = ("vault", cloakId).
    submitTimestampFireAndForget({
      kind: "vault",
      referenceId: cloak.cloakId,
      payload: vaultAnchor.payloadCanonical,
    });

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Cloak_Text",
      clientId: principal.tenantId,
      userId: principal.actorId,
      details: {
        ...verifiedAudit,
        clientIdStr,
        docId,
        cloakId: cloak.cloakId,
        keyVersion: cloak.keyVersion,
        strength: strengthVal,
        sensitiveTopic: cloak.sensitiveTopic,
        downgraded: cloak.downgraded,
        layers: cloak.layers,
        productSealProfile: cloak.productSealProfile,
        legacyMutationStatus: cloak.legacyMutationStatus,
        honeytokenCount: cloak.honeytokens.length,
        entanglementFingerprints: entanglementCount,
        beacon: beaconId !== null,
      },
    });
    recordEventFireAndForget({
      ip,
      route,
      kind: "Timestamp_Submit",
      clientId: principal.tenantId,
      userId: principal.actorId,
      details: {
        ...verifiedAudit,
        target: "cloak",
        referenceId: cloak.cloakId,
      },
    });
    if (beaconId) {
      recordEventFireAndForget({
        ip,
        route,
        kind: "Beacon_Embedded",
        clientId: principal.tenantId,
        userId: principal.actorId,
        details: {
          ...verifiedAudit,
          beaconId,
          cloakId: cloak.cloakId,
          clientId: clientIdStr,
          docId,
        },
      });
    }

    // Faz 4 audit — Semantic_Mark_Embedded. Skip durumunda da yazılır
    // (reason ile); analyze-text sonradan plan IS NULL gördüğünde sessiz
    // skip eder, ama audit görünür.
    recordEventFireAndForget({
      ip,
      route,
      kind: "Semantic_Mark_Embedded",
      clientId: principal.tenantId,
      userId: principal.actorId,
      details: {
        ...verifiedAudit,
        clientIdStr,
        docId,
        cloakId: cloak.cloakId,
        pipelineVersion,
        skipReason: semanticSkipReason,
        ...semanticMetricsForAudit,
      },
    });

    // ── AEGIS Orchestrator seal köprüsü — additive JSON alanları ──
    // Mevcut response alanları DEĞİŞMEZ. cloak.cloakId / cloak.layers /
    // cloak.keyVersion vs. AYNEN dönüyor. Aşağıdaki 5 alan additive
    // ortak seal kuyruğu görünürlüğü için. Mühür yerleşim kararını
    // DEĞİŞTİRMEZ.
    let cloakTextActiveModules:
      | ReturnType<typeof import("../orchestrator/index.js").detectActiveModules>
      | undefined;
    let cloakTextSealPlan:
      | ReturnType<typeof import("../orchestrator/index.js").sealOrchestrator>
      | undefined;
    let cloakTextSealEvidencePlan: Array<{
      module: string;
      layerId: string;
      dnaWritePolicy: string;
    }> | undefined;
    let cloakTextReservedModules: Array<{
      kind: string;
      status: string;
      reason: string;
    }> | undefined;
    let cloakTextDnaUsageStatus: {
      kind: string;
      description: string;
      dnaWriteAttempted: boolean;
      dnaPlacementOwnedBy: string;
    } | undefined;
    // ── AEGIS DNA Faz 3 — Text Seal Advisory iskelet (L1) ──
    // authority = "advisory_only_no_seal_gate" SABİT. DNA hâlâ karar
    // VERMİYOR. cloak-text davranışı / cloakId / layers / cascadeChain
    // DEĞİŞMEZ; sadece response'a additive `sealAdvisory` alanı eklenir.
    let cloakTextSealAdvisory:
      | ReturnType<typeof import("../orchestrator/index.js").projectDnaSealAdvisory>
      | undefined;
    try {
      const {
        detectActiveModules,
        sealOrchestrator,
        buildTextSealAdvisory,
        projectDnaSealAdvisory,
      } = await import("../orchestrator/index.js");
      cloakTextActiveModules = detectActiveModules({ explicit: ["text"] });
      cloakTextSealPlan = sealOrchestrator({ modules: ["text"] });
      cloakTextSealEvidencePlan = cloakTextSealPlan.plan.flatMap((p) =>
        p.expectedLayerIds.map((layerId) => ({
          module: p.module,
          layerId,
          dnaWritePolicy: p.dnaWritePolicy,
        })),
      );
      cloakTextReservedModules = [
        {
          kind: "audio",
          status: "inactive_no_audio_stream",
          reason: "audio_module_is_media_conditional_and_not_active_for_text_route",
        },
        {
          kind: "secure_room",
          status: "record_only",
          reason: "secure_room_available_as_record_only_evidence_flow",
        },
        {
          kind: "zehir",
          status: "candidate_support",
          reason: "zehir_available_as_record_only_candidate_support",
        },
      ];
      cloakTextDnaUsageStatus = {
        kind: "record_only_seal_plan_visible",
        description:
          "DNA written by cloak-text module's existing persist path. Orchestrator surfaces seal plan; no placement decision change.",
        dnaWriteAttempted: true,
        dnaPlacementOwnedBy: "module",
      };
      const textExpectedLayerIds =
        cloakTextSealPlan.plan.find((p) => p.module === "text")
          ?.expectedLayerIds ?? [];
      cloakTextSealAdvisory = projectDnaSealAdvisory(
        buildTextSealAdvisory({ expectedLayerIds: textExpectedLayerIds }),
      );
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "orchestrator seal skip",
      );
    }
    // ── AEGIS Ortak DNA Karar Masası — seal-side board (text) ──
    // Bayrak kapalıyken `undefined`. Mühür DNA'ya `aegis.cloak` mevcut
    // persist yolu üzerinden yazılıyor; burada ortak masada görünürlük.
    let cloakTextDecisionBoard:
      | Array<import("../dna/commonDnaBoard.js").ModuleBoardEntry>
      | undefined;
    try {
      const { commonDnaBoardEnabled, buildModuleStatus } = await import(
        "../dna/commonDnaBoard.js"
      );
      if (commonDnaBoardEnabled()) {
        // Evrensel kural: metin modülü iki bağımsız iz bırakmaya çalışır —
        // (1) linguistic DNA (cloak.layers içindeki ortalama 2+ ayrı işaret:
        //     bigram/trigram/honeytoken/decoy), ve (2) cascade hash chain.
        // Aynı alana yazılmaz: linguistic span-level, cascade sentence-level.
        const textLayerCount = cloak.layers
          ? Object.values(cloak.layers).filter((v) => v === true).length
          : 0;
        const textSealCount =
          textLayerCount + (cascadeChain.nodes.length > 0 ? 1 : 0);
        cloakTextDecisionBoard = [
          buildModuleStatus({
            module: "text",
            phase: "seal",
            ran: true,
            sealed: true,
            decodedIdHex: null,
            expectedIdHex: null,
            dnaId: `text:${cloak.cloakId}`,
            note: `seal_persisted_via_aegis_cloak (${textLayerCount} layers + ${cascadeChain.nodes.length > 0 ? "cascade_chain" : "no_cascade"})`,
            sealCount: textSealCount,
            sealOverlaps: false,
            dnaUsed: false, // cloak-text taze DNA yazıyor; mevcut DNA okumadı.
          }),
        ];
      }
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "common-dna board (cloak-text) skip",
      );
    }
    const textLayerCountForDecision = cloak.layers
      ? Object.values(cloak.layers).filter((v) => v === true).length
      : 0;
    const cloakTextCommonDecision = buildTextSealCommonDecision({
      cloakId: cloak.cloakId,
      dnaId: `text:${cloak.cloakId}`,
      sealCount:
        textLayerCountForDecision + (cascadeChain.nodes.length > 0 ? 1 : 0),
      dnaWriteAttempted: true,
    });
    recordSecureRoomTextSummary({
      req,
      fileId: docId,
      copyId: cloak.cloakId,
      sessionId: `cloak-text:${docId}`,
      textCommonDecision: cloakTextCommonDecision,
      note: "Auto module_summary after text seal. Secure Room records only; it does not open VAULT.",
    });
    res.json({
      protectedText: outboundText,
      docId,
      clientId: clientIdStr,
      cloakId: cloak.cloakId,
      keyVersion: cloak.keyVersion,
      strength: strengthVal,
      sensitiveTopic: cloak.sensitiveTopic,
      downgraded: cloak.downgraded,
      layers: cloak.layers,
      productSealProfile: cloak.productSealProfile,
      legacyMutationStatus: cloak.legacyMutationStatus,
      pipelineVersion,
      semanticPositional: semanticPlan
        ? {
            version: semanticPlan.version,
            sensitiveTopic: semanticPlan.sensitiveTopic,
            sensitiveSkip: semanticPlan.sensitiveSkip,
            totalSentences: semanticPlan.totalSentences,
            watermarkedSentences: semanticPlan.watermarkedSentences,
            skippedSentences: semanticPlan.skippedSentences,
          }
        : null,
      enterprise: {
        entanglementFingerprints: entanglementCount,
        beacon: beaconId
          ? { id: beaconId, url: beaconUrl }
          : null,
        timestamp: { queued: true, kind: "cloak", referenceId: cloak.cloakId },
        cascadeChain: {
          sentenceCount: cascadeChain.nodes.length,
          keyDerivation: cascadeChain.keyDerivation,
          // Hash listesi forensic verify için response'a iliştirilir; secret
          // gerekmediğinden client tarafında saklanabilir/diff edilebilir.
          nodes: cascadeChain.nodes.map((n) => ({ index: n.index, hash: n.hash })),
        },
      },
      // honeytoken/canary specifics intentionally hidden from the response.
      // ── AEGIS Orchestrator seal additive alanları (KARAR DEĞİŞTİRMEZ) ──
      activeModules: cloakTextActiveModules,
      orchestratorSealPlan: cloakTextSealPlan,
      sealEvidencePlan: cloakTextSealEvidencePlan,
      reservedModules: cloakTextReservedModules,
      dnaUsageStatus: cloakTextDnaUsageStatus,
      // Faz 3 additive: DNA danışman görünürlüğü (KARAR VERMEZ).
      sealAdvisory: cloakTextSealAdvisory,
      // Ortak karar masası seal-side entry (AEGIS_COMMON_DNA OFF ⇒ undefined).
      decisionBoard: cloakTextDecisionBoard,
      textCommonDecision: cloakTextCommonDecision,
    });
  }),
);

// ── AEGIS v4.1 Faz 5 — /cloak-image (3-Katmanlı Görsel Matruşka) ──
//
// Bir metni (1) cloak-text loopback ile mühürle (vault_anchor persisted),
// (2) PNG olarak render et + L2 line-spacing encoding uygula, (3) L1 corner
// stamp + L3 LSB embed (vault payloadDigestSha256) uygula.
//
// Audit: Visual_L1_Embedded, Visual_L2_Embedded, Visual_L3_Embedded.
//
// Önemli sınırlamalar (HONEST):
//   - L3 LSB lossless PNG dışı (JPEG, crop, rotate) altında ÇÖKER.
//   - L2 line-spacing rotation altında çöker (Hough deskew Step 5.2).
//   - L1 corner stamps edge crop altında köşeleri kaybeder; kenar-orta
//     stamp'leri kısmi survive.
//   - CROP_40 + ROTATE_3 → vault-confirmed garantisi BU ITERASYONDA YOK;
//     L3 LSB v1 yalnızca lossless dağıtım kanalında vault-confirmed üretir.
//     Robust survival için DCT+sync markers+ECC (Step 5.2) gerekli.
const VISUAL_PAGE_WIDTH = 1280;
const VISUAL_PAGE_PADDING_X = 40;
const VISUAL_PAGE_PADDING_TOP = 60;
const VISUAL_FONT_SIZE = 28;
const VISUAL_BASE_LINE_SPACING = 50;
const VISUAL_LINE_SWING = 6;
const VISUAL_BG = "#ffffff";
const VISUAL_FG = "#0a0a0a";

const VISUAL_MAX_LINES = 64;
const VISUAL_MAX_TOKEN_CHARS = 200; // anti-DoS: tek token'i pango'ya
                                    // bırakmadan önce hard-split.

function visualWrapLines(
  text: string,
  maxChars = 70,
): { lines: string[]; truncated: boolean; sourceLineCount: number } {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (let w of words) {
      // Anti-DoS: a single very long token (e.g. 50k chars) would force pango
      // to render one giant line. Hard-split before wrapping.
      while (w.length > VISUAL_MAX_TOKEN_CHARS) {
        const head = w.slice(0, VISUAL_MAX_TOKEN_CHARS);
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(head);
        w = w.slice(VISUAL_MAX_TOKEN_CHARS);
      }
      const cand = line ? `${line} ${w}` : w;
      if (cand.length > maxChars && line) {
        out.push(line);
        line = w;
      } else {
        line = cand;
      }
    }
    if (line) out.push(line);
  }
  const sourceLineCount = out.length;
  const truncated = sourceLineCount > VISUAL_MAX_LINES;
  return {
    lines: out.slice(0, VISUAL_MAX_LINES),
    truncated,
    sourceLineCount,
  };
}

/**
 * Faz 5 Step 5.3 — outer marker safe margin.
 *
 * `expectedOuterAnchors` lib default'u margin=max(8, 1% min-edge) → tipik 8px,
 * **L1 stamp pozisyonu (margin=8) ile EXACT OVERLAP** üretir. Step 5.3
 * outer marker'larını route layer'da daha içeride basıyoruz: 32 = 8 (L1 offset)
 * + 16 (L1 stamp boyutu) + 8 (güvenlik tamponu). T6 detect path'i bu
 * pozisyonları `vault_metadata.markers.outer` üzerinden okur — lib'in default
 * `expectedOuterAnchors`'una bağımlılık yok. Production-time custom anchors.
 */
const STEP53_OUTER_MARKER_MARGIN = 32;

interface Step53VaultLayer {
  vaultRect: VaultRectSpec;
  compactIdHex: string;
  pHashHex: string;
  /** Faz 5 Step 5.4 T1 — outer corner widened to MarkerKey to accept both
   *  v1-4marker (NW/NE/SW/SE) and v2-8marker (+ N/E/S/W) schemes. */
  outerMarkers: Array<{ corner: MarkerKey; x: number; y: number }>;
  /** Faz 5 Step 5.4 T3.5 — LARGE (32×32) outer markers, only present in
   *  v3-8marker-multiscale rows. Sibling field; v1/v2 rows omit it and the
   *  detect path falls back to SMALL-only Pass 1+2+3 chain (backward compat). */
  outerLargeMarkers?: Array<{ corner: MarkerKey; x: number; y: number }>;
  /** Faz 5 Step 5.4.1 — CIM (32×32 concentric) outer markers, only present
   *  in v4-8marker-cim rows. Sibling field; absence forces detect path to
   *  skip Pass 0a CIM and fall back to v3 LARGE / v2 SMALL chain. */
  outerCimMarkers?: Array<{ corner: MarkerKey; x: number; y: number }>;
  /** Faz 5 Step 5.5 — DCT-domain Concentric Marker (Frekans Zırhı) outer
   *  markers (32×32 envelope, same anchor positions as T3.5 LARGE / CIM).
   *  Only present in v5-8marker-dct-cim rows. Sibling field; absence forces
   *  detect path to skip Pass 0a-DCT and fall back to CIM/LARGE/SMALL. */
  outerDctMarkers?: Array<{ corner: MarkerKey; x: number; y: number }>;
  innerMarkers: Array<{ corner: MarkerKey; x: number; y: number }>;
  /** Faz 5 Step 5.4 T1 — outer marker geometric scheme. Persisted to
   *  vault_metadata.markers.outerScheme; detect path defaults to v1-4marker
   *  when absent (legacy ≤Step 5.3 rows). */
  outerScheme: OuterScheme;
  vaultBitsEmbedded: number;
  vaultBlocksUsed: number;
  vaultBitCapacity: number;
  vaultRepeatCount: number;
  /** Faz 5 Step 5.8-A.2 — RS(8,4) 8-stripe distributed vault armor (R-channel
   *  LSB transport, ≤4 erasure tolerance). Sibling field; absence = legacy row
   *  predating Step 5.8-A.2 stripe layer. Detect path emits audit
   *  `Visual_Vault_Stripes_Recovered` when match (parallel observation; does
   *  NOT lift v1.match this turn — verdict-ladder integration deferred to T002c). */
  vaultStripes?: {
    stripeCount: number;
    stripeLen: number;
    sliceH: number;
  };
}

async function renderVisualMatruskaPng(input: {
  text: string;
  cloakId: string;
  payloadDigestSha256: string;
  /** Faz 5 Step 5.3 — opsiyonel. Verilmediğinde vault layer skip edilir
   *  (geriye dönük uyumluluk: legacy testler / olası dev fallback). */
  tenantMasterSecret?: Buffer | null;
}): Promise<{
  pngBuffer: Buffer;
  width: number;
  height: number;
  channels: number;
  l2Plan: { gaps: number[]; bits: number[] };
  l1Hits: number;
  lsbRepeatPerBit: number;
  dctEmbedded: boolean;
  dctRepeatCount: number;
  dctBlocksUsed: number;
  dctBitCapacity: number;
  eccRecovery: VisualEccRecoveryEmbedResult;
  truncated: boolean;
  sourceLineCount: number;
  /** Faz 5 Step 5.3 — null iken vault rect fit etmedi (image too small) veya
   *  tenant secret verilmedi. Caller kontrol eder. */
  vault: Step53VaultLayer | null;
}> {
  const wrap = visualWrapLines(input.text);
  const lines = wrap.lines;
  const lineCount = Math.max(lines.length, 1);
  const l2 = planL2Spacing(
    input.cloakId,
    lineCount,
    VISUAL_BASE_LINE_SPACING,
    VISUAL_LINE_SWING,
    16,
  );
  // Per-line top positions (cumulative gaps). top = top edge of glyph box.
  // We use sharp's pango-backed `text` input (more font-aware than rsvg).
  const lineTops: number[] = [];
  let cumulativeY = VISUAL_PAGE_PADDING_TOP;
  for (let i = 0; i < lines.length; i++) {
    lineTops.push(cumulativeY);
    if (i < lines.length - 1) cumulativeY += l2.gaps[i]!;
  }
  const height =
    cumulativeY + VISUAL_FONT_SIZE + VISUAL_PAGE_PADDING_TOP;

  const composites = lines.map((line, i) => ({
    input: {
      text: {
        text: line.length > 0 ? line : " ",
        font: `DejaVu Sans ${VISUAL_FONT_SIZE - 4}`,
        rgba: true,
        width: VISUAL_PAGE_WIDTH - 2 * VISUAL_PAGE_PADDING_X,
        height: VISUAL_FONT_SIZE + 6,
      },
    },
    top: lineTops[i]!,
    left: VISUAL_PAGE_PADDING_X,
  }));

  const rendered = await sharp({
    create: {
      width: VISUAL_PAGE_WIDTH,
      height,
      channels: 3,
      background: VISUAL_BG,
    },
  })
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = rendered;
  const ch = info.channels as 3 | 4;
  const w = info.width;
  const h = info.height;
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  // Embed sırası (Faz 5 Step 5.2):
  //   1. DCT (büyük genlik, tüm görüntü)  →  JPEG-robust kanal
  //   2. LSB (en düşük bit)               →  PNG-lossless kanal
  //   3. L1 stamps (16×16 köşe blokları)  →  EN SONDA, küçük lokalize bölgelere
  //                                          yazıldığından DCT/LSB'yi sadece o
  //                                          bölgelerde bozar; geri kalan ~%99'da
  //                                          DCT+LSB sağlam kalır.
  // Sebep: önceki sıra (L1 → DCT) DCT pixel değişikliği L1 stamp NCC'sini
  // ±55 genlikle bozuyordu (Q=110/2). L1 en sona alındığında detection
  // korunur, DCT/LSB taşıyıcı bit kapasitesi minimum oranda kayıp yaşar.

  // L3-DCT embed (lossy/JPEG-robust kanal). digest hex (64) → 32 byte buf.
  const dctDigestBuf = Buffer.from(input.payloadDigestSha256, "hex");
  let l3DctEmbed: ReturnType<typeof embedL3Dct> | null = null;
  if (dctDigestBuf.length === 32) {
    try {
      // Faz 5 Step 5.7-C — Adaptive QIM: per-block luma stdDev gates the
      // QIM step (qstepBase=180 smooth blocks; qstepBoost=240 textured).
      // Texture-masked: visible artifact hidden behind existing high-
      // contrast features. Decoder uses identical stdDev gate. Match
      // Field Decisive intakt: bit values still pixel-derived.
      l3DctEmbed = embedL3DctAdaptive(
        rgb,
        w,
        h,
        ch,
        new Uint8Array(dctDigestBuf),
        {
          qstepBase: L3_DCT_QSTEP_BASE,
          qstepBoost: L3_DCT_QSTEP_BOOST,
          saliencyThreshold: L3_DCT_SALIENCY_THRESHOLD,
        },
      );
      rgb.set(l3DctEmbed.rgb);
    } catch (err) {
      // image too small for DCT payload — degrade gracefully (LSB-only).
      l3DctEmbed = null;
    }
  }

  // L3 — LSB embed (lossless dağıtım kanalı). DCT'den sonra ki LSB bit
  // değişiklikleri DCT mid-band coefficient'lerini (genlik ~Q=110) bozmaz.
  const l3Plan = embedL3Lsb(rgb, w, h, ch, input.payloadDigestSha256);

  // L1 — corner + edge-mid stamps. EN SON: stamp'ler 16×16 lokalize
  // bölgelere düşük opaklıkla (±6) yazılır. Bu küçük bölgelerde DCT/LSB
  // bit'leri lokal olarak bozulur ama global majority vote etkilenmez.
  // opacityScale=16 (Faz 5 Step 5.2): DCT mid-band coefficient değişikliği
  // pixel'leri ±55'e kadar bozar; eski ±6 stamp lift'i NCC'yi 0.95'ten 0.33'e
  // düşürmüştü. ±16 lift NCC'yi yine 0.85+ seviyesinde tutar ve hala çıplak
  // gözle görünmez (text rendering'in 0/255 kontrast farkına göre marginal).
  const stamp = buildL1Stamp(input.cloakId, 16);
  const positions = l1StampPositions(w, h, stamp.size, 8);
  applyL1Stamps(rgb, w, h, ch, stamp, positions, 16);

  // ── Faz 5 Step 5.3 — Vault region (V1 compactId DCT) + Nested sync markers ──
  //
  // Embedding sırası (kullanıcı direktifi: önceki mühürleri EZME):
  //   (a) RGB → RGBA copy (vault region + syncMarkers API'leri 4-kanal ister)
  //   (b) embedVaultV1: vault sub-rect içine MEVCUT global L3-DCT'nin yazdığı
  //       AYNI 32-byte payloadDigest'i RS-encoded DCT QIM ile yazar. Center
  //       %20'deki DCT bloklarını overwrite eder ama PAYLOAD AYNI olduğu için
  //       global L3-DCT majority vote bozulmaz; outer %80 blokları intakt kalır.
  //       LSB low-bit'leri merkez bölgede dokunulur ama global LSB high
  //       repetition ile ayakta kalır.
  //   (c) outer 4 marker stamp: margin=32 (L1 stamp pozisyonu margin=8 + size 16
  //       = (24,24)'e kadar; 32'den başlamak L1'i ezmez). Tenant-specific HMAC
  //       mask, luma +24 lift.
  //   (d) inner 4 marker stamp: vault rect köşelerinde. Vault sub-rect'in 16×16
  //       köşe blokları üzerinde luma lift; V1 vault'un 256+ DCT blokundan
  //       sadece 4 köşe bloğu dokunulur — majority vote ayakta.
  //   (e) computeVaultPHash: FİNAL pixel state üzerinden (markers dahil) →
  //       vault_metadata.pHash olarak persist; T6 verify aynı state'i recompute.
  //   (f) RGBA → RGB copy back (sharp PNG encode 3-kanal kalır, çıktı boyutu
  //       değişmez, downstream client'lar etkilenmez).
  let vaultLayer: Step53VaultLayer | null = null;
  if (input.tenantMasterSecret && input.tenantMasterSecret.length >= 16) {
    const vaultRect = computeVaultRect(w, h);
    if (vaultRect !== null) {
      // (a) RGB → RGBA — sharp `text` rendering şu an ch=3 üretiyor; vault +
      //     marker API'leri RGBA bekliyor.
      const rgba = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4]     = rgb[i * ch]!;
        rgba[i * 4 + 1] = rgb[i * ch + 1]!;
        rgba[i * 4 + 2] = rgb[i * ch + 2]!;
        rgba[i * 4 + 3] = ch === 4 ? rgb[i * ch + 3]! : 255;
      }

      // (b) V1 vault embed — compactId = ilk 32 byte payloadDigest (= global DCT
      //     payload). embedVaultV1 throw atabilir (vault rect oob / digest len),
      //     yumuşak başarısız ol → vault layer skip.
      const compactId = Buffer.from(input.payloadDigestSha256, "hex");
      let v1: ReturnType<typeof embedVaultV1> | null = null;
      if (compactId.length === 32) {
        try {
          v1 = embedVaultV1(rgba, w, h, vaultRect, new Uint8Array(compactId));
        } catch {
          v1 = null;
        }
      }

      if (v1 !== null) {
        // (c) outer SMALL marker stamp — Step 5.4 T1 v2-8marker scheme (4
        //     corner + 4 edge midpoint), 16×16 pixel mask. Custom margin
        //     (L1 ile çakışma yok). Edge midpoint anchors single-corner
        //     crop attack'e karşı 5/8 gate fail-safety sağlar (T2 detect
        //     path'inde devreye girer).
        //
        // Faz 5 Step 5.4 T3.5 — `outerScheme` upgraded to `v3-8marker-multiscale`.
        // SMALL stamp logic below is BIT-FOR-BIT identical to v2 (same
        // anchors via `expectedOuterAnchorsForScheme(v3)` returning v2
        // positions, same mask derivation, same `stampMarker`). What v3
        // adds is an EXTRA 32×32 LARGE marker stamp pass right after,
        // diagonally inset 24 px from each SMALL marker — see (c2). The
        // detect path treats v3 rows additively: Pass 0 LARGE first, then
        // the legacy SMALL Pass 1+2+3 chain on Pass 0 miss. Legacy v1/v2
        // rows in the DB continue to use SMALL-only detect (backward
        // compat preserved by `markersBlock.outerLarge` absence check).
        const outerScheme: OuterScheme = OUTER_SCHEME_V5;
        const outerAnchorsLib = expectedOuterAnchorsForScheme(
          w,
          h,
          outerScheme,
          STEP53_OUTER_MARKER_MARGIN,
        );
        const outerAnchors: Array<{ corner: MarkerKey; x: number; y: number }> =
          outerAnchorsLib.map((a) => ({ corner: a.corner, x: a.x, y: a.y }));
        for (const a of outerAnchors) {
          const mask = deriveMarkerMask(
            input.tenantMasterSecret,
            "outer",
            a.corner,
            input.cloakId,
          );
          stampMarker(rgba, w, h, a.x, a.y, mask);
        }

        // (c2) outer LARGE marker stamp — Step 5.4 T3.5 multi-scale layer.
        //      32×32 px, 256 unique HMAC bits replicated into 2×2 cells
        //      (bilinear-blur resilient: see lib/aegis-core/.../syncMarkers.ts
        //      MARKER_SIZE_LARGE doc). Anchors share the v2 8-key topology
        //      but each is inset 24 px diagonally inward from the SMALL
        //      marker (zero pixel overlap, lib smoke L7 asserts this).
        //      Domain-separator string is DISTINCT (`aegis-sync-marker-large-v1|…`)
        //      so SMALL and LARGE masks are uncorrelated — neither leaks
        //      signal into the other's detect path.
        const outerLargeAnchorsLib = expectedOuterAnchorsLargeV3(
          w,
          h,
          STEP53_OUTER_MARKER_MARGIN,
        );
        const outerLargeAnchors: Array<{ corner: MarkerKey; x: number; y: number }> =
          outerLargeAnchorsLib.map((a) => ({ corner: a.corner, x: a.x, y: a.y }));
        for (const a of outerLargeAnchors) {
          const maskLarge = deriveMarkerMaskLarge(
            input.tenantMasterSecret,
            "outer",
            a.corner,
            input.cloakId,
          );
          // Step 5.4 T3.5 empirik delta — PDFKit metin arka planı + L3-DCT
          // modülasyonu ±5-10 luma noise yaratır; 32×32 patch'inde toplam
          // pixel sayısı 4× SMALL olduğundan std (sqrt(N) skaler) 2× yükselir.
          // Default delta=8 NCC'yi gerçek metin görüntüsünde 0.2-0.3'e indirir
          // (lib smoke düz arka plan kullanıyor; 0.7-1.0 görüyor). delta=16
          // signal²/noise² oranını 4× artırır ⇒ clean PNG roundtrip NCC ≈
          // 0.7-0.9, +5° bilinear ≈ 0.5-0.6. Görsel etki: ±16 luma 32×32
          // bölgede zar zor algılanır (insan eşiği ~5 JND).
          stampMarkerLarge(rgba, w, h, a.x, a.y, maskLarge, 32);
        }

        // (c3) outer CIM marker stamp — Step 5.4.1 Concentric Identity Marker.
        //      32×32 hierarchical fiducial (R1 solid 4 px / R2 dashed 2 px /
        //      R3 dotted 2 px / 8×8 ID core), domain-separated HMACs per ring,
        //      4-cardinal rotation invariance via |NCC|. Anchors share the
        //      T3.5 LARGE positions (envelope identical), so CIM PIXELS
        //      OVERWRITE the LARGE uniform-mask pixels at those 8 positions
        //      — this is intentional cascade design: on v4 rows Pass 0b
        //      LARGE will fail (uniform mask buried under concentric
        //      pattern → NCC ≈ noise) and Pass 0a CIM is the primary path.
        //      KIRMIZI ÇİZGİ #1: SMALL 16×16 anchors are at distinct
        //      positions (margin=32) with zero pixel overlap with the
        //      CIM/LARGE 32×32 envelope (margin=56), so the v2 SMALL
        //      stamp+detect chain remains bit-for-bit unchanged.
        const outerCimAnchorsLib = expectedOuterAnchorsCimV4(
          w,
          h,
          STEP53_OUTER_MARKER_MARGIN,
        );
        const outerCimAnchors: Array<{ corner: MarkerKey; x: number; y: number }> =
          outerCimAnchorsLib.map((a) => ({ corner: a.corner, x: a.x, y: a.y }));
        for (const a of outerCimAnchors) {
          const identity = deriveCimIdentity(
            input.tenantMasterSecret,
            "outer",
            a.corner,
            input.cloakId,
          );
          stampCim(rgba, w, h, a.x, a.y, identity);
        }

        // (c4) outer DCT-CIM marker stamp — Step 5.5 Frekans Zırhı + İç Kale.
        //      32×32 envelope, 3 hierarchical DCT rings (R1 r∈[3,5] warp-immün
        //      anchor, R2 r∈[6,9] JPEG-resilient identity, R3 r∈[10,14] RS(10,5)
        //      protected ID payload). Spread-spectrum ±1 sign sequences seeded
        //      by HMAC-SHA256 (`aegis-dct-r{1,2,3,id}-v1|<tier>|<corner>|<cloakId>`).
        //      Anchor positions = T3.5 LARGE = T5.4.1 CIM (envelope identical;
        //      pairwise overlap=0 lib smoke kanıtlı). STAMP ORDER intentional:
        //      DCT goes LAST. SMALL/LARGE/CIM are pixel-domain delta luma; the
        //      DCT stamp adds mid-frequency spectral coefficient deltas which
        //      are luma-mean preserving (no DC change), so it does NOT visibly
        //      shift the underlying CIM/LARGE/SMALL pixel pattern. Conversely,
        //      pixel-domain markers under it spread broadband noise — DCT
        //      detect's mid-band NCC is largely orthogonal to that noise
        //      (R1/R2/R3 sit in narrow rings at coefficient indices that
        //      pixel patterns under-energize). Detect cascade orders
        //      Pass 0a-DCT FIRST (frequency armor primary path).
        const outerDctAnchorsLib = expectedOuterAnchorsDctV5(
          w,
          h,
          STEP53_OUTER_MARKER_MARGIN,
        );
        const outerDctAnchors: Array<{ corner: MarkerKey; x: number; y: number }> =
          outerDctAnchorsLib.map((a) => ({ corner: a.corner, x: a.x, y: a.y }));
        for (const a of outerDctAnchors) {
          const identity = deriveDctConcentricIdentity(
            input.tenantMasterSecret,
            "outer",
            a.corner,
            input.cloakId,
          );
          stampDctConcentric(rgba, w, h, a.x, a.y, identity);
        }

        // (d) inner 4 marker stamp — vault rect corners.
        const innerAnchorsLib = expectedInnerAnchors(vaultRect);
        const innerAnchors: Array<{ corner: MarkerKey; x: number; y: number }> =
          innerAnchorsLib.map((a) => ({ corner: a.corner, x: a.x, y: a.y }));
        for (const a of innerAnchors) {
          const mask = deriveMarkerMask(
            input.tenantMasterSecret,
            "inner",
            a.corner,
            input.cloakId,
          );
          stampMarker(rgba, w, h, a.x, a.y, mask);
        }

        // (e) pHash — FİNAL state (markers dahil).
        const pHash = computeVaultPHash(rgba, w, h, vaultRect);

        // (e2) Step 5.8-A.4 — Y-channel adaptive QIM stripe transport
        //      (RS(8,4) 8-stripe distributed armor). T003b REPLACE: R-channel
        //      LSB transport (D08 +30° altında recovery=0 — bilinear smear
        //      LSB'yi flip ediyor) yerine luma-domain scalar QIM 4×4 block
        //      adaptive Q (smooth=8 / textured=12 stdDev≥16). dY uniform
        //      R/G/B (BT.601 0.299R+0.587G+0.114B; uniform dRGB=dY → block
        //      stdDev invariant ⇒ embed/extract aynı Q'yu seçer). pHash
        //      yukarıda hesaplandı (stripe writes vault rect Y'sini Q kadar
        //      kayıtlar; pHash 8×8 averaged 64-bin → invariant guard pHash
        //      AFTER yerine BEFORE seçildi). Marker NCC: vault rect outer
        //      markers'tan ayrı (markers vault region DIŞINDA). L3-DCT mid-
        //      band: vault rect L3 DCT bloklarıyla ÖRTÜŞMÜYOR (vault region
        //      dedicated subrect; L3 DCT image-wide grid'in vault hariç
        //      bloklarını kullanır → quantization independent). vault_step3
        //      regression smoke ile doğrulandı.
        // Faz 5 Step 5.8-A.5 (T005) — FEATURE_DCT_STRIPE flag açıksa DCT
        // mid-band transport, kapalıysa legacy Y-QIM. Çift Kartuş YASAĞI:
        // mint+extract aynı flag okur (asla hibrit). Tip union DCT+Y-QIM
        // result share şeklinde — `vaultStripes` field'ı sadece sliceCount/
        // stripeLen/sliceH okur, transport-specific detay yok.
        const useDctStripe = isFeatureDctStripeEnabled();
        let stripeEmbedRes:
          | ReturnType<typeof embedQimYStripes>
          | ReturnType<typeof embedDctStripes>
          | null = null;
        try {
          stripeEmbedRes = useDctStripe
            ? embedDctStripes(rgba, w, h, vaultRect, new Uint8Array(compactId))
            : embedQimYStripes(rgba, w, h, vaultRect, new Uint8Array(compactId));
        } catch {
          // Best-effort embed; legacy rows omit vaultStripes field. No logger
          // in this helper scope (renderVisualMatruskaPng); failure surfaces
          // via absence of `Visual_Vault_Stripes_Embedded` audit downstream.
          stripeEmbedRes = null;
        }

        // (f) RGBA → RGB copy back (alpha düşürülür; ch=3 PNG encode korunur).
        for (let i = 0; i < w * h; i++) {
          rgb[i * ch]     = rgba[i * 4]!;
          rgb[i * ch + 1] = rgba[i * 4 + 1]!;
          rgb[i * ch + 2] = rgba[i * 4 + 2]!;
          if (ch === 4) rgb[i * ch + 3] = rgba[i * 4 + 3]!;
        }

        vaultLayer = {
          vaultRect,
          compactIdHex: compactId.toString("hex"),
          pHashHex: pHash.toString("hex"),
          outerMarkers: outerAnchors,
          // Step 5.4 T3.5 — sibling field, additive (v1/v2 rows omit this).
          outerLargeMarkers: outerLargeAnchors,
          // Step 5.4.1 — sibling field, additive (v1/v2/v3 rows omit this).
          outerCimMarkers: outerCimAnchors,
          // Step 5.5 — sibling field, additive (v1/v2/v3/v4 rows omit this).
          outerDctMarkers: outerDctAnchors,
          innerMarkers: innerAnchors,
          outerScheme,
          vaultBitsEmbedded: v1.bitsEmbedded,
          vaultBlocksUsed: v1.blocksUsed,
          vaultBitCapacity: v1.bitCapacity,
          vaultRepeatCount: v1.repeatCount,
          ...(stripeEmbedRes
            ? {
                vaultStripes: {
                  stripeCount: VAULT_QIM_Y_STRIPE_SLICES,
                  stripeLen: stripeEmbedRes.stripeLen,
                  sliceH: stripeEmbedRes.layout.sliceH,
                },
              }
            : {}),
        };
      }
    }
  }

  const eccRecovery = embedVisualEccRecoveryLayer(
    rgb,
    w,
    h,
    ch,
    input.cloakId,
  );

  // Encode back to PNG (lossless preserves LSB+DCT+vault+marker modifications)
  const pngBuffer = await sharp(Buffer.from(rgb), {
    raw: { width: w, height: h, channels: ch },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    pngBuffer,
    width: w,
    height: h,
    channels: ch,
    l2Plan: { gaps: l2.gaps, bits: l2.bits },
    l1Hits: positions.length,
    lsbRepeatPerBit: l3Plan.repeatPerBit,
    dctEmbedded: l3DctEmbed !== null,
    dctRepeatCount: l3DctEmbed?.repeatCount ?? 0,
    dctBlocksUsed: l3DctEmbed?.blocksUsed ?? 0,
    dctBitCapacity: l3DctEmbed?.bitCapacity ?? 0,
    eccRecovery,
    truncated: wrap.truncated,
    sourceLineCount: wrap.sourceLineCount,
    vault: vaultLayer,
  };
}

router.post(
  "/cloak-image",
  requireVerifiedSealPrincipal,
  asyncHandler(async (req, res) => {
    const auditIp = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const auditRoute = req.originalUrl.split("?")[0] ?? req.originalUrl;
    const { text, docId, clientId, strength, userId, ownershipDeclared } = req.body ?? {};
    const principal = req.verifiedSealPrincipal!;
    const verifiedAudit = verifiedSealAuditDetails(principal, {
      targetRecordId: typeof docId === "string" ? docId : null,
      ownershipDeclarationRecorded: ownershipDeclared === true,
      untrustedRequestedClientId: clientId,
      untrustedRequestedUserId: userId,
    });
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }
    const preSealOwnership = await preSealOwnershipCheck({
      mediaType: "image",
      input: text,
      currentClientId: principal.clientId,
    });
    if (preSealOwnership.action !== "allow") {
      sendPreSealOwnershipStop(res, preSealOwnership);
      return;
    }
    // Loopback to /cloak-text for canonical vault_anchor persistence.
    const port = process.env.PORT ?? "5000";
    const downstreamHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    const adminTok = req.header("x-admin-token");
    const apiKey = req.header("x-api-key");
    if (adminTok) downstreamHeaders["x-admin-token"] = adminTok;
    if (apiKey) downstreamHeaders["x-api-key"] = apiKey;

    const cloakBody: Record<string, unknown> = {
      text,
      docId,
      clientId: principal.clientId,
      ownershipDeclared: ownershipDeclared === true,
    };
    if (typeof strength === "string") cloakBody.strength = strength;

    let cloakResp: globalThis.Response;
    try {
      cloakResp = await fetch(
        `http://127.0.0.1:${port}/api/aegis/cloak-text`,
        {
          method: "POST",
          headers: downstreamHeaders,
          body: JSON.stringify(cloakBody),
        },
      );
    } catch (err) {
      req.log.error({ err }, "cloak_text_loopback_failed");
      res.status(502).json({ error: "cloak_text_loopback_failed" });
      return;
    }
    if (!cloakResp.ok) {
      const body = await cloakResp.text();
      res.status(cloakResp.status).json({
        error: "cloak_text_loopback_non_ok",
        cloakStatus: cloakResp.status,
        body,
      });
      return;
    }
    const cloakJson = (await cloakResp.json()) as {
      protectedText: string;
      cloakId: string;
      clientId: string;
      docId: string;
      pipelineVersion?: string;
    };
    if (cloakJson.clientId !== principal.clientId) {
      res.status(502).json({ error: "cloak_text_principal_mismatch" });
      return;
    }

    // Fetch only the freshly-persisted anchor in the verified target tenant.
    // Administrator delegation does not weaken tenant isolation.
    const vaultLookupConds = [
      eq(vaultAnchorsTable.clientId, cloakJson.clientId),
      eq(vaultAnchorsTable.docId, cloakJson.docId),
      eq(vaultAnchorsTable.cloakId, cloakJson.cloakId),
      eq(vaultAnchorsTable.tenantId, principal.tenantId),
    ];
    const vaultRow = await db
      .select({
        payloadDigestSha256: vaultAnchorsTable.payloadDigestSha256,
        payloadCanonical: vaultAnchorsTable.payloadCanonical,
        signature: vaultAnchorsTable.signature,
        publicKey: vaultAnchorsTable.publicKey,
        keyVersion: vaultAnchorsTable.keyVersion,
      })
      .from(vaultAnchorsTable)
      .where(and(...vaultLookupConds))
      .limit(1);
    if (vaultRow.length === 0) {
      res.status(500).json({
        error: "vault_anchor_lookup_failed",
        message: "cloak persisted but vault_anchors row not found",
      });
      return;
    }
    const vault = vaultRow[0]!;

    // Faz 5 Step 5.3 — Tenant master secret resolution. Vault anchor row's
    // keyVersion authoritative kalır (cloak-text bu version'la imzaladı). Aynı
    // pattern /emit-text'te: aegis.getSecretForVersion(cloak.keyVersion).
    // deriveTenantSecret HKDF-SHA256(masterKey, salt=clientId) → tenant-isolated
    // secret. cross-tenant marker forgery'i lib seviyesinde imkansızlaştırır.
    let tenantMasterSecret: Buffer | null = null;
    const masterKey = aegis.getSecretForVersion(vault.keyVersion);
    if (masterKey) {
      try {
        tenantMasterSecret = deriveTenantSecret(masterKey, cloakJson.clientId);
      } catch (err) {
        // clientId boş / masterKey kısa — log + vault layer skip (visual L1/L2/L3
        // çalışmaya devam eder; geriye dönük uyumluluk).
        req.log.warn(
          { err, clientId: cloakJson.clientId, keyVersion: vault.keyVersion },
          "step53_tenant_secret_derive_failed",
        );
        tenantMasterSecret = null;
      }
    } else {
      req.log.warn(
        { keyVersion: vault.keyVersion },
        "step53_master_key_unresolved_skip_vault_layer",
      );
    }

    // Render + apply L1/L2/L3 (+ Step 5.3 vault region/markers if secret OK)
    let visual;
    try {
      visual = await renderVisualMatruskaPng({
        text: cloakJson.protectedText,
        cloakId: cloakJson.cloakId,
        payloadDigestSha256: vault.payloadDigestSha256,
        tenantMasterSecret,
      });
    } catch (err) {
      req.log.error({ err }, "visual_matruska_render_failed");
      res.status(500).json({
        error: "visual_matruska_render_failed",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Audit per-layer (fire-and-forget). Two-place rule: kinds also in
    // lib/db/src/schema/auditLogs.ts and openapi.yaml AuditKind enum.
    const baseAudit = {
      ip: auditIp,
      route: auditRoute,
      clientId: principal.tenantId,
      userId: principal.actorId,
    } as const;
    recordEventFireAndForget({
      ...baseAudit,
      kind: "Visual_L1_Embedded",
      details: {
        ...verifiedAudit,
        cloakId: cloakJson.cloakId,
        clientIdStr: cloakJson.clientId,
        docId: cloakJson.docId,
        positions: visual.l1Hits,
        stampSize: 16,
      },
    });
    recordEventFireAndForget({
      ...baseAudit,
      kind: "Visual_L2_Embedded",
      details: {
        ...verifiedAudit,
        cloakId: cloakJson.cloakId,
        clientIdStr: cloakJson.clientId,
        docId: cloakJson.docId,
        lineCount: visual.l2Plan.gaps.length,
        baseSpacing: VISUAL_BASE_LINE_SPACING,
        swing: VISUAL_LINE_SWING,
        encodedBits: visual.l2Plan.bits.length,
      },
    });
    recordEventFireAndForget({
      ...baseAudit,
      kind: "Visual_L3_Embedded",
      details: {
        ...verifiedAudit,
        cloakId: cloakJson.cloakId,
        clientIdStr: cloakJson.clientId,
        docId: cloakJson.docId,
        payloadDigestSha256: vault.payloadDigestSha256,
        algorithm: visual.dctEmbedded ? ["lsb-v1", "dct-v1"] : ["lsb-v1"],
        repeatPerBit: visual.lsbRepeatPerBit,
        dctRepeatCount: visual.dctRepeatCount,
        dctBlocksUsed: visual.dctBlocksUsed,
        dctBitCapacity: visual.dctBitCapacity,
        dctQStep: L3_DCT_QSTEP,
        imageBytes: visual.pngBuffer.byteLength,
      },
    });

    // ── Faz 5 Step 5.3 — vault tier persist + audit ──
    // Atomik kontrak (T6 read-side guard'ı opt-in `stepVersion === "5.3"` ile
    // kapı tutar): cloak_layers tier='vault' upsert PNG response'tan ÖNCE
    // tamamlanır. Hata olursa yumuşak başarısız (warn + visualLayers.vault=null
    // response) — vault layer skip; L1/L2/L3 mevcut akış zaten cevaplanır.
    let vaultPersisted = false;
    let vaultPersistError: string | null = null;
    if (visual.vault) {
      const vaultMeta = {
        stepVersion: "5.3" as const,
        vaultRect: visual.vault.vaultRect,
        compactId: visual.vault.compactIdHex,
        pHash: visual.vault.pHashHex,
        markers: {
          outer: visual.vault.outerMarkers,
          // Faz 5 Step 5.4 T3.5 — LARGE marker positions (sibling field,
          // additive). Detect path checks for absence: legacy v1/v2 rows
          // omit this and skip Pass 0 LARGE entirely, preserving the
          // bit-for-bit Step 5.4 T1+T2+T3 contract for those rows.
          outerLarge: visual.vault.outerLargeMarkers,
          // Faz 5 Step 5.4.1 — CIM (32×32 concentric) marker positions.
          // Sibling field; only present on v4-8marker-cim rows. Detect path
          // checks for absence: legacy v1/v2/v3 rows omit this and skip
          // Pass 0a CIM entirely, preserving the bit-for-bit Step 5.4
          // T1+T2+T3+T3.5 contract for those rows.
          outerCim: visual.vault.outerCimMarkers,
          // Faz 5 Step 5.5 — DCT-domain Concentric Marker positions.
          // Sibling field; only present on v5-8marker-dct-cim rows. Detect
          // path checks for absence: legacy v1-v4 rows omit this and skip
          // Pass 0a-DCT entirely, preserving the bit-for-bit cascade for
          // those rows.
          outerDct: visual.vault.outerDctMarkers,
          inner: visual.vault.innerMarkers,
          // Faz 5 Step 5.4 T1 — outer geometric scheme. Sibling field
          // (NOT shape change) so legacy v1-4marker rows that omit it are
          // read as "v1-4marker" by detect path (T2 contract). Existing
          // `outer` array shape is preserved exactly. Step 5.4 T3.5 adds
          // "v3-8marker-multiscale" — detect path treats unknown values
          // as legacy SMALL chain (forward compat).
          outerScheme: visual.vault.outerScheme,
          cloakId: cloakJson.cloakId,
          outerMargin: STEP53_OUTER_MARKER_MARGIN,
        },
        imageDims: { width: visual.width, height: visual.height },
      } satisfies Record<string, unknown>;
      const vaultLayerData = {
        kind: "visual-vault-region-v1",
        algorithm: "dct-qim+phash64",
        bitsEmbedded: visual.vault.vaultBitsEmbedded,
        blocksUsed: visual.vault.vaultBlocksUsed,
        bitCapacity: visual.vault.vaultBitCapacity,
        repeatCount: visual.vault.vaultRepeatCount,
      } satisfies Record<string, unknown>;
      try {
        await db
          .insert(cloakLayersTable)
          .values({
            cloakId: cloakJson.cloakId,
            clientId: cloakJson.clientId,
            docId: cloakJson.docId,
            tier: "vault",
            layerData: vaultLayerData,
            vaultMetadata: vaultMeta,
          })
          .onConflictDoUpdate({
            target: [
              cloakLayersTable.clientId,
              cloakLayersTable.docId,
              cloakLayersTable.tier,
            ],
            set: {
              cloakId: cloakJson.cloakId,
              layerData: vaultLayerData,
              vaultMetadata: vaultMeta,
              createdAt: new Date(),
            },
          });
        vaultPersisted = true;
      } catch (err) {
        vaultPersistError = err instanceof Error ? err.message : String(err);
        req.log.error(
          { err, cloakId: cloakJson.cloakId, docId: cloakJson.docId },
          "step53_vault_layer_persist_failed",
        );
      }

      if (vaultPersisted) {
        recordEventFireAndForget({
          ...baseAudit,
          kind: "Visual_Vault_Embedded",
          details: {
            ...verifiedAudit,
            cloakId: cloakJson.cloakId,
            clientIdStr: cloakJson.clientId,
            docId: cloakJson.docId,
            stepVersion: "5.3",
            vaultRect: visual.vault.vaultRect,
            compactId: visual.vault.compactIdHex,
            pHash: visual.vault.pHashHex,
            bitsEmbedded: visual.vault.vaultBitsEmbedded,
            repeatCount: visual.vault.vaultRepeatCount,
          },
        });
        // Step 5.8-A.2 — RS(8,4) 8-stripe distributed armor audit. Sibling
        // event to Visual_Vault_Embedded; only fires when stripe embed
        // succeeded (legacy rows omit). Detect path matching emit'i ayrı
        // (`Visual_Vault_Stripes_Recovered`).
        if (visual.vault.vaultStripes) {
          recordEventFireAndForget({
            ...baseAudit,
            kind: "Visual_Vault_Stripes_Embedded",
            details: {
              ...verifiedAudit,
              cloakId: cloakJson.cloakId,
              clientIdStr: cloakJson.clientId,
              docId: cloakJson.docId,
              stepVersion: "5.8-A.2",
              vaultRect: visual.vault.vaultRect,
              stripeCount: visual.vault.vaultStripes.stripeCount,
              stripeLen: visual.vault.vaultStripes.stripeLen,
              sliceH: visual.vault.vaultStripes.sliceH,
            },
          });
        }
        recordEventFireAndForget({
          ...baseAudit,
          kind: "Visual_Sync_Markers_Stamped",
          details: {
            ...verifiedAudit,
            cloakId: cloakJson.cloakId,
            clientIdStr: cloakJson.clientId,
            docId: cloakJson.docId,
            stepVersion: "5.3",
            outerScheme: visual.vault.outerScheme,
            outerCount: visual.vault.outerMarkers.length,
            // Faz 5 Step 5.4 T3.5 — LARGE marker observability fields.
            // Optional in audit detail; v1/v2 rows still report outerLargeCount=0.
            outerLargeCount: visual.vault.outerLargeMarkers?.length ?? 0,
            markerSizeLarge: MARKER_SIZE_LARGE,
            // Faz 5 Step 5.4.1 — CIM observability fields. Optional in audit
            // detail; v1/v2/v3 rows still report outerCimCount=0.
            outerCimCount: visual.vault.outerCimMarkers?.length ?? 0,
            cimSize: CIM_SIZE,
            cimRingWidths: [4, 2, 2, 8] as const,
            // Faz 5 Step 5.5 — DCT-domain Frekans Zırhı observability fields.
            // Optional in audit detail; v1-v4 rows still report outerDctCount=0.
            outerDctCount: visual.vault.outerDctMarkers?.length ?? 0,
            dctCimSize: DCT_CIM_SIZE,
            dctRingRanges: [[3, 5], [6, 9], [10, 14]] as const,
            innerCount: visual.vault.innerMarkers.length,
            outerMargin: STEP53_OUTER_MARKER_MARGIN,
            markerSize: MARKER_SIZE,
          },
        });
      }
    }

    // ── AEGIS DNA v0.6.6 — image DNA fire-and-forget persistence ──────
    // Mevcut karar zinciri / response zaten hazır. DNA kaydı yazma hatası
    // kanıt zincirini bozmaz. Karar mantığına/decode'a dokunmaz.
    try {
      const { buildImageDNA } = await import("../visual/buildImageDNA.js");
      const { dna, overlapWarnings } = buildImageDNA({
        cloakId: cloakJson.cloakId,
        clientId: cloakJson.clientId,
        docId: cloakJson.docId,
        pipelineVersion: cloakJson.pipelineVersion ?? "v4",
        width: visual.width,
        height: visual.height,
        pngBuffer: visual.pngBuffer,
        l1HitCount: visual.l1Hits,
        l1StampSize: 16,
        l2LineCount: visual.l2Plan.gaps.length,
        l2BaseSpacing: VISUAL_BASE_LINE_SPACING,
        l3Algorithms: visual.dctEmbedded ? ["lsb-v1", "dct-v1"] : ["lsb-v1"],
        l3PayloadDigestSha256: vault.payloadDigestSha256,
        vault:
          visual.vault && vaultPersisted
            ? {
                rect: {
                  x: visual.vault.vaultRect.x,
                  y: visual.vault.vaultRect.y,
                  width: visual.vault.vaultRect.w,
                  height: visual.vault.vaultRect.h,
                },
                pHashHex: visual.vault.pHashHex,
                compactIdHex: visual.vault.compactIdHex,
              }
            : undefined,
      });
      if (overlapWarnings.length > 0) {
        req.log.warn(
          { cloakId: cloakJson.cloakId, overlapWarnings },
          "aegis_dna_image_overlap_warning",
        );
      }
      await db
        .insert(aegisDnaRecordsTable)
        .values({
          dnaId: dna.dnaId,
          primaryMediaType: dna.primaryMediaType,
          activeMediaTypes: dna.activeMediaTypes,
          pipelineVersion: dna.pipelineVersion,
          contentDigestHex: dna.contentDigest.hex,
          contentSizeBytes: dna.contentDigest.sizeBytes ?? null,
          geometricChecksum: dna.structuralFingerprint.geometricChecksum ?? null,
          idHex: cloakJson.cloakId,
          payload4Hex: null,
          clientId: cloakJson.clientId,
          dna: dna as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing({ target: aegisDnaRecordsTable.dnaId });
    } catch (err) {
      req.log.warn(
        { err, cloakId: cloakJson.cloakId, docId: cloakJson.docId },
        "aegis_dna_image_persist_failed (fire-and-forget; response unaffected)",
      );
    }

    // ── AEGIS Orchestrator seal köprüsü — additive JSON alanları ──
    // Mevcut response alanları DEĞİŞMEZ. visual / vault / l1-l2-l3 / dct /
    // syncMarkers AYNEN dönüyor. Aşağıdaki 5 alan additive ortak seal
    // kuyruğu görünürlüğü için. Mühür yerleşim kararını DEĞİŞTİRMEZ.
    let cloakImgActiveModules:
      | ReturnType<typeof import("../orchestrator/index.js").detectActiveModules>
      | undefined;
    let cloakImgSealPlan:
      | ReturnType<typeof import("../orchestrator/index.js").sealOrchestrator>
      | undefined;
    let cloakImgSealEvidencePlan: Array<{
      module: string;
      layerId: string;
      dnaWritePolicy: string;
    }> | undefined;
    let cloakImgReservedModules: Array<{
      kind: string;
      status: string;
      reason: string;
    }> | undefined;
    let cloakImgDnaUsageStatus: {
      kind: string;
      description: string;
      dnaWriteAttempted: boolean;
      dnaPlacementOwnedBy: string;
    } | undefined;
    // ── AEGIS DNA Faz 4 — Image Seal Advisory iskelet (L1) ──
    // authority = "advisory_only_no_seal_gate" SABİT. DNA hâlâ karar
    // VERMİYOR. cloak-image davranışı / mühür yerleşimi / visualLayers
    // DEĞİŞMEZ; sadece response'a additive `sealAdvisory` alanı eklenir.
    let cloakImgSealAdvisory:
      | ReturnType<typeof import("../orchestrator/index.js").projectDnaSealAdvisory>
      | undefined;
    try {
      const {
        detectActiveModules,
        sealOrchestrator,
        buildImageSealAdvisory,
        projectDnaSealAdvisory,
      } = await import("../orchestrator/index.js");
      cloakImgActiveModules = detectActiveModules({ explicit: ["image"] });
      cloakImgSealPlan = sealOrchestrator({ modules: ["image"] });
      cloakImgSealEvidencePlan = cloakImgSealPlan.plan.flatMap((p) =>
        p.expectedLayerIds.map((layerId) => ({
          module: p.module,
          layerId,
          dnaWritePolicy: p.dnaWritePolicy,
        })),
      );
      cloakImgReservedModules = [
        {
          kind: "audio",
          status: "inactive_no_audio_stream",
          reason: "audio_module_is_media_conditional_and_not_active_for_image_route",
        },
        {
          kind: "secure_room",
          status: "record_only",
          reason: "secure_room_available_as_record_only_evidence_flow",
        },
        {
          kind: "zehir",
          status: "candidate_support",
          reason: "zehir_available_as_record_only_candidate_support",
        },
      ];
      cloakImgDnaUsageStatus = {
        kind: "record_only_seal_plan_visible",
        description:
          "DNA written by cloak-image module's existing persist path (aegis_dna_records). Orchestrator surfaces seal plan; no placement decision change.",
        dnaWriteAttempted: true,
        dnaPlacementOwnedBy: "module",
      };
      const imageExpectedLayerIds =
        cloakImgSealPlan.plan.find((p) => p.module === "image")
          ?.expectedLayerIds ?? [];
      cloakImgSealAdvisory = projectDnaSealAdvisory(
        buildImageSealAdvisory({ expectedLayerIds: imageExpectedLayerIds }),
      );
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "orchestrator seal skip",
      );
    }
    // ── AEGIS Ortak DNA Karar Masası — seal-side board (image) ──
    // Bayrak kapalıyken `undefined`. Görsel mühür DNA'ya cloak-image
    // modülünün mevcut persist yolu üzerinden yazılıyor; burada ortak
    // masada görünürlük.
    let cloakImgDecisionBoard:
      | Array<import("../dna/commonDnaBoard.js").ModuleBoardEntry>
      | undefined;
    try {
      const { commonDnaBoardEnabled, buildModuleStatus } = await import(
        "../dna/commonDnaBoard.js"
      );
      if (commonDnaBoardEnabled()) {
        // Evrensel kural: görsel modülü L1 (LSB) + L2 (line-spacing) + L3
        // (DCT) ve varsa vault region — hepsi disjoint alanlar (LSB low-bit,
        // line-spacing geometry, DCT mid-band, vault rect). sealCount=3 base
        // + 1 if vault embedded+persisted.
        const imgVaultSealed = !!(visual.vault && vaultPersisted);
        const imgSealCount = 3 + (imgVaultSealed ? 1 : 0);
        cloakImgDecisionBoard = [
          buildModuleStatus({
            module: "image",
            phase: "seal",
            ran: true,
            sealed: true,
            decodedIdHex: null,
            expectedIdHex: null,
            dnaId: `image:${cloakJson.cloakId}`,
            note: `seal_persisted_via_cloak_image_visual_layers (L1+L2+L3${imgVaultSealed ? "+vault" : ""})`,
            sealCount: imgSealCount,
            sealOverlaps: false,
            dnaUsed: false,
          }),
        ];
      }
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "common-dna board (cloak-image) skip",
      );
    }
    res.status(200).json({
      cloakId: cloakJson.cloakId,
      clientId: cloakJson.clientId,
      docId: cloakJson.docId,
      pipelineVersion: cloakJson.pipelineVersion ?? "v4",
      protectedImageBase64: visual.pngBuffer.toString("base64"),
      width: visual.width,
      height: visual.height,
      channels: visual.channels,
      mimeType: "image/png",
      visualLayers: {
        l1: { embedded: true, positions: visual.l1Hits, stampSize: 16 },
        l2: {
          embedded: true,
          lineCount: visual.l2Plan.gaps.length,
          baseSpacing: VISUAL_BASE_LINE_SPACING,
          swing: VISUAL_LINE_SWING,
          encodedBits: visual.l2Plan.bits.length,
        },
        l3: {
          embedded: true,
          algorithm: visual.dctEmbedded ? ["lsb-v1", "dct-v1"] : ["lsb-v1"],
          payloadDigestSha256: vault.payloadDigestSha256,
          repeatPerBit: visual.lsbRepeatPerBit,
          dctEmbedded: visual.dctEmbedded,
          dctRepeatCount: visual.dctRepeatCount,
          dctBlocksUsed: visual.dctBlocksUsed,
          dctBitCapacity: visual.dctBitCapacity,
          dctQStep: L3_DCT_QSTEP,
        },
        eccRecovery: {
          embedded: visual.eccRecovery.embedded,
          layerId: visual.eccRecovery.layerId,
          carrier: visual.eccRecovery.carrier,
          role: visual.eccRecovery.role,
          dataBits: visual.eccRecovery.dataBits,
          parityBits: visual.eccRecovery.parityBits,
          blockSize: visual.eccRecovery.blockSize,
          pairMargin: visual.eccRecovery.pairMargin,
          confirmed: false,
          canOpenVault: false,
          vaultEligible: false,
          ...(visual.eccRecovery.reason
            ? { reason: visual.eccRecovery.reason }
            : {}),
        },
        // Faz 5 Step 5.3 — vault region + sync markers (opt-in surface).
        // null iken: tenant secret yok, vault rect fit etmedi, embed throw, ya da
        // persist hatası. T6 detect path'i ayrıca vault_metadata DB lookup yapar.
        vault: visual.vault && vaultPersisted
          ? {
              embedded: true,
              persisted: true,
              stepVersion: "5.3",
              vaultRect: visual.vault.vaultRect,
              compactId: visual.vault.compactIdHex,
              pHash: visual.vault.pHashHex,
              bitsEmbedded: visual.vault.vaultBitsEmbedded,
              blocksUsed: visual.vault.vaultBlocksUsed,
              bitCapacity: visual.vault.vaultBitCapacity,
              repeatCount: visual.vault.vaultRepeatCount,
            }
          : visual.vault
            ? {
                embedded: true,
                persisted: false,
                persistError: vaultPersistError,
                stepVersion: "5.3",
              }
            : { embedded: false, reason: tenantMasterSecret ? "vault_rect_unfit_or_embed_failed" : "tenant_secret_unresolved" },
        syncMarkers: visual.vault
          ? {
              outer: visual.vault.outerMarkers,
              inner: visual.vault.innerMarkers,
              outerMargin: STEP53_OUTER_MARKER_MARGIN,
              markerSize: MARKER_SIZE,
            }
          : { outer: [], inner: [], outerMargin: STEP53_OUTER_MARKER_MARGIN, markerSize: MARKER_SIZE },
      },
      ...(visual.truncated
        ? {
            warnings: [
              {
                code: "render_truncated",
                message: `Renderer ${VISUAL_MAX_LINES} satır cap'i nedeniyle metni kırptı`,
                sourceLineCount: visual.sourceLineCount,
                renderedLineCount: VISUAL_MAX_LINES,
              },
            ],
          }
        : {}),
      // ── AEGIS Orchestrator seal additive alanları (KARAR DEĞİŞTİRMEZ) ──
      activeModules: cloakImgActiveModules,
      orchestratorSealPlan: cloakImgSealPlan,
      sealEvidencePlan: cloakImgSealEvidencePlan,
      reservedModules: cloakImgReservedModules,
      dnaUsageStatus: cloakImgDnaUsageStatus,
      // Faz 4 additive: DNA danışman görünürlüğü (KARAR VERMEZ).
      sealAdvisory: cloakImgSealAdvisory,
      // Ortak karar masası seal-side entry (AEGIS_COMMON_DNA OFF ⇒ undefined).
      decisionBoard: cloakImgDecisionBoard,
    });
  }),
);

/**
 * AEGIS v4.1 Step 2 — POST /aegis/emit-text
 *
 * Senaryo C (Shared Core + Individualized Decoy): Aynı `(clientId, docId)`
 * için birden fazla VIEWER'a aynı kaynak metni teslim ederken her teslim
 * için kriptografik olarak benzersiz bir `emission_token` üretir, bunu
 * delivery text'e Unicode Tag (U+E0000-U+E007F) marker blokları halinde
 * gömer ve `decoy_emissions` tablosuna ATOMİK bir satır yazar.
 *
 * Atomik kural (Step 1'in fire-and-forget pattern'i KABUL EDİLMEZ):
 * `decoy_emissions` insert BAŞARILI olmadan deliveryText DÖNDÜRÜLMEZ.
 * Insert hatasında 5xx döner — kayıt olmadan delivery yok.
 *
 * Forward-only: yalnızca `pipeline_version='v4'` cloaked_documents satırları
 * için çalışır. Eski v3 kayıtları için 400 döner — geriye dönük migration
 * hedeflenmemiştir (bkz. replit.md "Forward-only Migration Policy").
 */
router.post(
  "/emit-text",
  asyncHandler(async (req, res) => {
    // ── Auth gate: deny anonymous emissions ─────────────────────────────
    // Either an authenticated tenant (`req.apiClient` set by api-key
    // middleware) OR a valid admin token must be present. An emission
    // without a tenant binding is forbidden — the decoy ledger row would
    // have no owner and could not be tenant-scoped on analyze-text.
    if (!req.apiClient) {
      const expected = process.env["ADMIN_TOKEN"];
      const provided = req.header("x-admin-token");
      if (!secureAdminTokenEquals(provided, expected)) {
        res.status(401).json({
          error: "unauthorized: x-api-key or x-admin-token required",
        });
        return;
      }
    }
    const { docId, clientId, viewerId, viewerMetadata } = req.body ?? {};
    const rawClientId =
      clientId !== undefined && clientId !== null
        ? clientId
        : req.apiClient
          ? req.apiClient.id
          : undefined;
    if (rawClientId === undefined || rawClientId === null) {
      res.status(400).json({ error: "clientId required (body field or x-api-key header)" });
      return;
    }
    let clientIdStr: string;
    try {
      clientIdStr = normalizeClientId(rawClientId);
    } catch (err) {
      if (err instanceof InvalidClientIdError) {
        res.status(400).json({ error: `clientId invalid: ${err.message}` });
        return;
      }
      throw err;
    }
    try {
      assertValidDocId(docId);
    } catch (err) {
      if (err instanceof InvalidDocIdError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
    if (
      typeof viewerId !== "string" ||
      viewerId.length === 0 ||
      viewerId.length > 256
    ) {
      res.status(400).json({ error: "viewerId required (string, 1-256 chars)" });
      return;
    }
    // Tenant guard: x-api-key bound caller can only emit for sub-customers
    // they previously cloaked. Ownership is derived from audit_logs
    // (Cloak_Text rows whose tenant client_id matches req.apiClient.id and
    // whose details.clientIdStr matches the body clientId + docId).
    if (req.apiClient) {
      const ownerCheck = await db.execute(
        sql`SELECT 1 FROM audit_logs
            WHERE kind = 'Cloak_Text'
              AND client_id = ${req.apiClient.id}
              AND details->>'clientIdStr' = ${clientIdStr}
              AND details->>'docId' = ${docId}
            LIMIT 1`,
      );
      if (ownerCheck.rows.length === 0) {
        res.status(403).json({
          error:
            "tenant does not own this (clientId, docId) — cloak it under this api key first",
        });
        return;
      }
    }

    // Lookup the canonical cloaked document. Forward-only: must be v4.
    const cloakRows = await db
      .select({
        cloakId: cloakedDocumentsTable.cloakId,
        keyVersion: cloakedDocumentsTable.keyVersion,
        protectionHash: cloakedDocumentsTable.protectionHash,
        pipelineVersion: cloakedDocumentsTable.pipelineVersion,
        sensitiveTopic: cloakedDocumentsTable.sensitiveTopic,
      })
      .from(cloakedDocumentsTable)
      .where(
        and(
          eq(cloakedDocumentsTable.clientId, clientIdStr),
          eq(cloakedDocumentsTable.docId, docId),
        ),
      )
      .limit(1);
    if (cloakRows.length === 0) {
      res.status(404).json({ error: "no cloaked document for (clientId, docId)" });
      return;
    }
    const cloak = cloakRows[0]!;
    if (cloak.pipelineVersion !== "v4") {
      res.status(400).json({
        error: "decoy emission requires pipeline_version=v4 (forward-only)",
        pipelineVersion: cloak.pipelineVersion,
      });
      return;
    }

    // Tenant secret resolution (same pattern as cloak-text / analyze-text).
    const tenantSecret = aegis.getSecretForVersion(cloak.keyVersion);
    if (!tenantSecret) {
      req.log.error(
        { clientId: clientIdStr, docId, keyVersion: cloak.keyVersion },
        "[emit-text] tenant secret unresolved",
      );
      res.status(500).json({ error: "tenant secret unavailable" });
      return;
    }

    // Source text for delivery: re-cloak from request? NO — Senaryo C
    // mandates a SHARED CORE. The canonical core is the latest cloaked
    // protectedText reconstructed by re-running aegis.cloak with the
    // stored cloakId is not ideal. Instead, we use a simple convention:
    // the caller MUST first call /cloak-text with this (clientId, docId);
    // /emit-text rebuilds the deterministic delivery base from the
    // request body's `text` field if provided, OR rejects if absent.
    // (Caller flow: cloak-text first → keep the cloak's protectedText →
    // pass it as `text` here. This keeps the SHARED core stable while
    // allowing per-viewer marker individualization.)
    const baseText = typeof req.body?.text === "string" ? req.body.text : null;
    if (!baseText || baseText.length === 0) {
      res.status(400).json({
        error:
          "text (string) required: pass the cloaked protectedText returned by /cloak-text as the shared core",
      });
      return;
    }

    // Generate emission token + distribute markers + build delivery text.
    const emission = generateEmissionToken({
      tenantSecret,
      clientId: clientIdStr,
      docId,
      viewerId,
    });
    const shortDocId = docId.length > 12 ? `${docId.slice(0, 12)}…` : docId;
    const delivery = distributeMarkers({
      baseText,
      emissionToken: emission.token,
      shortDocId,
      issuedDate: new Date(emission.timestamp),
    });

    // ATOMIC: insert FIRST. If this throws, we 5xx and never return text.
    // (No fire-and-forget — emission without ledger row is forbidden.)
    try {
      await db.insert(decoyEmissionsTable).values({
        // tenant_id = authoritative isolation. NULL only on admin path
        // (system-emitted, no tenant binding); analyze-text scoping treats
        // tenant_id mismatch as `unknownToken` (cross-tenant frame attempt).
        tenantId: req.apiClient ? req.apiClient.id : null,
        clientId: clientIdStr,
        docId,
        viewerId,
        emissionToken: emission.token,
        markerCount: delivery.markerCount,
        markerPositions: delivery.markerPositions,
        metadata:
          viewerMetadata && typeof viewerMetadata === "object"
            ? (viewerMetadata as Record<string, unknown>)
            : null,
      });
    } catch (err) {
      req.log.error(
        { err, clientId: clientIdStr, docId, viewerId },
        "[emit-text] decoy_emissions insert failed; refusing to emit",
      );
      res.status(500).json({ error: "decoy ledger write failed; emission aborted" });
      return;
    }

    // Audit AFTER successful insert (still fire-and-forget — audit row is
    // non-critical observability, but the source-of-truth ledger row is
    // already durable above).
    recordEventFireAndForget({
      ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
      route: "/api/aegis/emit-text",
      kind: "Decoy_Emitted",
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        clientId: clientIdStr,
        docId,
        viewerId,
        emissionToken: emission.token,
        markerCount: delivery.markerCount,
        cloakId: cloak.cloakId,
        pipelineVersion: cloak.pipelineVersion,
        sensitiveTopic: cloak.sensitiveTopic,
        timestamp: emission.timestamp,
      },
    });

    res.json({
      deliveryText: delivery.deliveryText,
      emissionToken: emission.token,
      markerCount: delivery.markerCount,
      viewerId,
      clientId: clientIdStr,
      docId,
      issuedAt: new Date(emission.timestamp).toISOString(),
    });
  }),
);

interface CloakSignal {
  type: "canary" | "honeytoken" | "linguisticDna" | "fuzzyCanary" | "clientTrace";
  source?: string;
  confidence: number;
}

interface CloakScanOutcome {
  found: boolean;
  docId: string;
  clientId: string;
  cloakId: string;
  keyVersion: string;
  confidence: number;
  signals: CloakSignal[];
  risk: "high" | "medium" | "low" | "none";
  ambiguous: boolean;
  /**
   * Verdict ladder (mirrors forensic verdict semantics):
   *  - "strong":       canary or non-ambiguous honeytoken hit (decisive evidence)
   *  - "ambiguous":    only fuzzy-canary or sub-decisive DNA, OR honeytoken
   *                    hit dropped because the fakeValue is shared across
   *                    multiple clients (false-accusation guard).
   *  - "insufficient": no signals above noise. Confidence alone never
   *                    promotes a verdict.
   */
  verdict: "strong" | "ambiguous" | "insufficient";
}

function classifyCloakVerdict(args: {
  canaryHit: boolean;
  honeytokenHit: boolean;
  fuzzyTier: "none" | "low" | "medium" | "high";
  dnaScore: number;
}): "strong" | "ambiguous" | "insufficient" {
  // Strong = decisive scoped evidence (canary or non-ambiguous honeytoken).
  if (args.canaryHit || args.honeytokenHit) return "strong";
  // Ambiguous = scoped soft evidence. Both bars are above natural Turkish
  // prose noise: fuzzy "low" tier (~0.2 score) fires on common short
  // tokens even in unrelated text, and DNA alone false-positives near
  // 0.5. We require fuzzy tier ≥ medium OR DNA ≥ 0.7.
  const fuzzyAmbig = args.fuzzyTier === "medium" || args.fuzzyTier === "high";
  if (fuzzyAmbig || args.dnaScore >= 0.7) return "ambiguous";
  return "insufficient";
}

function buildTextSealCommonDecision(input: {
  cloakId: string;
  dnaId: string;
  sealCount: number;
  dnaWriteAttempted: boolean;
}) {
  return {
    module: "text" as const,
    phase: "seal" as const,
    officialDecision: "TEXT_SEAL_RECORDED" as const,
    confirmed: false,
    candidateSupport: false,
    idRead: false,
    idMatched: false,
    expectedId: input.cloakId,
    decodedId: null,
    dna: {
      dnaId: input.dnaId,
      dnaWriteAttempted: input.dnaWriteAttempted,
      dnaCanConfirm: false,
      note:
        "Text DNA is written as forensic memory only. It does not create a confirmed result by itself.",
    },
    seal: {
      sealCount: input.sealCount,
      sealIndependent: input.sealCount >= 2,
      sealOverlaps: false,
    },
    safety: {
      officialResultRequiresIdMatch: true,
      candidateSupportIsNotConfirmed: true,
      dnaSignalIsAdvisoryOnly: true,
      changesTextCloakBehavior: false,
    },
    note:
      "Seal phase only records the text module state. Confirmation can happen only during search with a decisive text ID match.",
  };
}

function buildTextSearchCommonDecision(input: {
  result: CloakScanOutcome;
  expectedCloakId: string;
  dnaRead: boolean;
  dnaReportFound: boolean;
}) {
  const idMatched =
    input.result.verdict === "strong" &&
    input.result.cloakId === input.expectedCloakId;
  const candidateSupport =
    !idMatched &&
    (input.result.found ||
      input.result.verdict === "ambiguous" ||
      input.result.signals.length > 0);
  const officialDecision = idMatched
    ? "TEXT_CONFIRMED"
    : candidateSupport
      ? "TEXT_CANDIDATE_SUPPORT"
      : "TEXT_NOT_FOUND";

  return {
    module: "text" as const,
    phase: "search" as const,
    officialDecision,
    confirmed: idMatched,
    candidateSupport,
    idRead: idMatched,
    idMatched,
    expectedId: input.expectedCloakId,
    decodedId: idMatched ? input.result.cloakId : null,
    nativeFound: input.result.found,
    nativeFoundMeaning:
      "scan-cloak found can include decisive text evidence or candidate DNA support; use textCommonDecision.confirmed for official confirmation.",
    verdict: input.result.verdict,
    confidence: input.result.confidence,
    risk: input.result.risk,
    signalTypes: input.result.signals.map((s) => s.type),
    dna: {
      dnaId: `text:${input.expectedCloakId}`,
      dnaRead: input.dnaRead,
      dnaReportFound: input.dnaReportFound,
      dnaCanConfirm: false,
      note:
        "Text DNA/fuzzy/similarity signals are advisory unless the text verdict ladder produces a strong ID match.",
    },
    safety: {
      officialResultRequiresIdMatch: true,
      candidateSupportIsNotConfirmed: true,
      dnaSignalIsAdvisoryOnly: true,
      fuzzySignalIsAdvisoryUnlessStrong: true,
      changesScanCloakVerdict: false,
    },
    note: idMatched
      ? "Text module confirmed this leak through a decisive text ID match."
      : candidateSupport
        ? "Text module found candidate/support evidence only. This is not an official VAULT/confirmed result."
      : "Text module did not find enough evidence for candidate support or confirmation.",
  };
}

function buildTextSignalCandidateCommonDecision(input: {
  source: "image_ocr" | "video_subtitle";
  textLength: number;
  confidence?: number;
  lowConfidence?: boolean;
  heavyOcrLastResort?: HeavyOcrCandidateSupport;
}) {
  const hasTextSignal = input.textLength > 0;
  return {
    module: "text" as const,
    phase: "search" as const,
    source: input.source,
    officialDecision: hasTextSignal
      ? ("TEXT_CANDIDATE_SUPPORT" as const)
      : ("TEXT_NOT_FOUND" as const),
    confirmed: false,
    candidateSupport: hasTextSignal,
    idRead: false,
    idMatched: false,
    expectedId: null,
    decodedId: null,
    textLength: input.textLength,
    confidence: input.confidence ?? null,
    lowConfidence: input.lowConfidence ?? null,
    heavyOcrLastResort: input.heavyOcrLastResort ?? null,
    dna: {
      dnaCanConfirm: false,
      note:
        "OCR/subtitle/text-stream signal is advisory only. It cannot confirm without a text-module ID match.",
    },
    safety: {
      officialResultRequiresIdMatch: true,
      candidateSupportIsNotConfirmed: true,
      ocrSignalIsAdvisoryOnly: true,
      dnaSignalIsAdvisoryOnly: true,
      opensVault: false,
    },
    note: hasTextSignal
      ? "Text signal was observed through an existing OCR/subtitle bridge. It remains candidate/support only."
      : "No text signal was observed.",
  };
}

function recordSecureRoomTextSummary(input: {
  req: Request;
  fileId: string;
  copyId: string;
  sessionId: string;
  textCommonDecision: unknown;
  supportDetails?: Record<string, unknown>;
  note?: string;
}): void {
  recordSecureRoomModuleSummaryFireAndForget({
    ip: input.req.ip ?? input.req.socket?.remoteAddress ?? "unknown",
    route: input.req.originalUrl.split("?")[0] ?? input.req.originalUrl,
    fileId: input.fileId,
    copyId: input.copyId,
    sessionId: input.sessionId,
    ...summarizeTextCommonDecision(input.textCommonDecision),
    ...(input.supportDetails ? { supportDetails: input.supportDetails } : {}),
    ...(input.note ? { note: input.note } : {}),
  });
}

async function runScanOne(
  suspectText: string,
  row: {
    clientId: string;
    docId: string;
    cloakId: string;
    keyVersion: string;
    canaryTerm: string;
    canarySignature: string;
    protectionHash: string | null;
  },
): Promise<CloakScanOutcome> {
  const secret = aegis.getSecretForVersion(row.keyVersion);
  const signals: CloakSignal[] = [];

  // 1. Canary (exact, marker OR plaintext) — verified under the row's
  // composite (clientId | docId) scope so a leaked text cloaked for
  // client A cannot satisfy client B's canary check.
  let canaryHit = false;
  const canaryScope = canaryScopeFor(row.clientId, row.docId);
  if (secret) {
    const v = verifyCanaryFn(suspectText, canaryScope, secret);
    if (v.found) {
      canaryHit = true;
      signals.push({ type: "canary", source: v.source, confidence: 1.0 });
    }
  }

  // 1b. Client trace exact carrier tag. This is decisive only when the
  // stored protectionHash is reproduced under the same client + keyVersion.
  // DNA/fuzzy can still provide candidate support, but they do not reach this
  // path and cannot promote to TEXT_CONFIRMED.
  let clientTraceHit = false;
  if (secret && row.protectionHash) {
    try {
      const reproduced = protectByClient(suspectText, row.clientId, { secret });
      if (reproduced.protectionHash === row.protectionHash) {
        clientTraceHit = true;
        signals.push({
          type: "clientTrace",
          source: "protectionHash",
          confidence: 1.0,
        });
      }
    } catch {
      // Keep scan-cloak conservative: exact trace failures simply fall back to
      // the existing canary/honeytoken/DNA/fuzzy ladder.
    }
  }

  // 2. Honeytoken (only this carrier's tokens)
  let honeytokenHit = false;
  if (row.protectionHash) {
    const tokens = await db
      .select({
        fakeValue: honeytokensTable.fakeValue,
        clientId: honeytokensTable.clientId,
      })
      .from(honeytokensTable)
      .where(eq(honeytokensTable.protectionHash, row.protectionHash));
    if (tokens.length > 0) {
      const stripped = aegis.strip(suspectText);
      const fakes = tokens.map((t) => t.fakeValue);
      const hits = scanHoneytokensFn(stripped, fakes);
      if (hits.length > 0) {
        // False-accusation guard: any fakeValue shared across ≥2 clients
        // (anywhere in DB) is dropped from "decisive" classification.
        const hitFakes = Array.from(new Set(hits.map((h) => h.fakeValue)));
        const ambiguityRows = await db
          .select({
            fakeValue: honeytokensTable.fakeValue,
            clientId: honeytokensTable.clientId,
          })
          .from(honeytokensTable)
          .where(inArray(honeytokensTable.fakeValue, hitFakes));
        const ambiguous = new Set<string>();
        const byFake = new Map<string, Set<string>>();
        for (const r of ambiguityRows) {
          if (!byFake.has(r.fakeValue)) byFake.set(r.fakeValue, new Set());
          byFake.get(r.fakeValue)!.add(r.clientId);
        }
        for (const [fv, owners] of byFake) {
          if (owners.size >= 2) ambiguous.add(fv);
        }
        const decisive = hits.filter((h) => !ambiguous.has(h.fakeValue));
        if (decisive.length > 0) {
          honeytokenHit = true;
          signals.push({ type: "honeytoken", confidence: 1.0 });
        }
      }
    }
  }

  // 3. Linguistic DNA (single candidate — this client)
  const dna = aegis.analyzeTextMultiChannel(suspectText, [row.clientId]);
  const dnaScore = dna.confidenceScore ?? 0;
  if (dnaScore >= 0.3) {
    signals.push({ type: "linguisticDna", confidence: dnaScore });
  }

  // 4. Fuzzy fallback (paraphrase tolerance) — only when canary missed.
  // Use the same composite scope so the regenerated canary fact matches
  // what was originally injected for this (clientId, docId).
  let fuzzyTier: "none" | "low" | "medium" | "high" = "none";
  if (!canaryHit && secret) {
    // Use the row's keyVersion secret directly (NOT the active secret) so
    // post-rotation fuzzy fallback still references the canary that was
    // actually injected when this doc was cloaked.
    const fact = generateCanaryFact(canaryScope, secret);
    const fz = fuzzyCanaryMatch(suspectText, fact.text, fact.term);
    fuzzyTier = fz.tier;
    if (fz.tier !== "none") {
      signals.push({ type: "fuzzyCanary", confidence: fz.score });
    }
  }

  const risk = classifyRisk({
    canary: canaryHit || clientTraceHit,
    honeytoken: honeytokenHit,
    fuzzyTier,
    dnaScore,
  });
  // Combined confidence: canary/honeytoken pin to 1.0, otherwise the
  // best non-fuzzy signal wins (fuzzy alone can never reach >= 0.8).
  let confidence = 0;
  if (canaryHit || clientTraceHit || honeytokenHit) confidence = 1.0;
  else confidence = Math.max(dnaScore, fuzzyTier === "none" ? 0 : 0.5);
  const verdict = classifyCloakVerdict({
    canaryHit: canaryHit || clientTraceHit,
    honeytokenHit,
    fuzzyTier,
    dnaScore,
  });
  return {
    found: canaryHit || clientTraceHit || honeytokenHit || dnaScore >= 0.6,
    docId: row.docId,
    clientId: row.clientId,
    cloakId: row.cloakId,
    keyVersion: row.keyVersion,
    confidence,
    signals,
    risk,
    // ambiguous mirrors the verdict ladder so consumers can't see
    // ambiguous=true with verdict="insufficient" (or vice versa).
    ambiguous: verdict === "ambiguous",
    verdict,
  };
}

router.post(
  "/scan-cloak",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { text, docId, clientId } = req.body ?? {};
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }
    let clientIdStr: string;
    try {
      clientIdStr = normalizeClientId(clientId);
    } catch (err) {
      if (err instanceof InvalidClientIdError) {
        res.status(400).json({ error: `clientId invalid: ${err.message}` });
        return;
      }
      throw err;
    }
    try {
      assertValidDocId(docId);
    } catch (err) {
      if (err instanceof InvalidDocIdError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
    const rows = await db
      .select()
      .from(cloakedDocumentsTable)
      .where(
        and(
          eq(cloakedDocumentsTable.clientId, clientIdStr),
          eq(cloakedDocumentsTable.docId, docId),
        ),
      )
      .orderBy(desc(cloakedDocumentsTable.createdAt))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "no cloaked document for (clientId, docId)" });
      return;
    }
    const result = await runScanOne(text, rows[0]!);
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Cloak_Scan",
      details: {
        scope: "scan-cloak",
        clientIdStr,
        docId,
        found: result.found,
        risk: result.risk,
        confidence: result.confidence,
        signalKinds: result.signals.map((s) => s.type),
      },
    });
    // ── AEGIS DNA arama tarafı raporu + guided search (v0.6.7/v0.6.8) ──
    // Kalıcı DNA snapshot'ı varsa harita/öncelik bilgisi olarak rapora
    // ekle. Karar mantığı `result` zaten üretildi — DNA'ya bakmıyor.
    // v0.6.8: ek olarak observed text katmanları ile DNA-guided eşleşme
    // advisory alanı `aegisDnaGuidedSearch`. Ana karar (`result.found`,
    // `result.risk`, `result.confidence`, verdict ladder) DOKUNULMADI.
    let aegisDnaReport:
      | Awaited<ReturnType<typeof import("../dna/dnaReport.js").buildDnaReport>>
      | undefined;
    let aegisDnaGuidedSearch:
      | ReturnType<
          typeof import("../dna/dnaGuidedSearch.js").buildDnaGuidedSearch
        >
      | undefined;
    try {
      const { buildDnaReport } = await import("../dna/dnaReport.js");
      const { buildDnaGuidedSearch } = await import(
        "../dna/dnaGuidedSearch.js"
      );
      aegisDnaReport = await buildDnaReport(`text:${rows[0]!.cloakId}`);
      if (aegisDnaReport.overlapWarnings && aegisDnaReport.overlapWarnings.length > 0) {
        req.log.warn(
          { cloakId: rows[0]!.cloakId, overlapWarnings: aegisDnaReport.overlapWarnings },
          "aegis-dna scan-cloak overlap warnings",
        );
      }
      const observed = result.signals.map((s) => `text.${s.type}`);
      aegisDnaGuidedSearch = buildDnaGuidedSearch(aegisDnaReport, observed);
    } catch (e) {
      req.log.warn({ err: e instanceof Error ? e.message : String(e) }, "aegis-dna report skip");
    }
    // ── v0.7.1 — Two-tier decision projection (ADDITIVE) ──
    // Ana karar (`result.found`, `result.risk`, `result.confidence`, verdict
    // ladder) DOKUNULMADI. Yalnız raporlama: confirmed yalnız verdict ladder
    // STRONG güçlü kapısından (canary/honeytoken kanıtı + (clientId,docId)
    // composite scope) geçtiyse; aksi halde candidate.
    //
    // NOT: runScanOne `CloakScanOutcome` döner — `primarySuspect` field'i YOK
    // (vault verify primarySuspect bloğu analyze-text rotasında ayrı çalışır).
    // Bu yüzden scan-cloak'ın güçlü kapısı verdict ladder STRONG değeridir;
    // STRONG = canary HIT OR honeytoken HIT (multi-channel doğrulama).
    let twoTierDecision:
      | Awaited<
          ReturnType<
            typeof import("../dna/twoTierProjection.js").projectTwoTierDecision
          >
        >
      | undefined;
    try {
      const { projectTwoTierDecision } = await import(
        "../dna/twoTierProjection.js"
      );
      const expectedIdHex = rows[0]!.cloakId;
      // decodedIdHex: yalnız verdict==="strong" güçlü doğrulama kapısı
      // geçildiğinde result.cloakId'yi raporla. Helper hex doğrulamasını
      // yapar — cloakId hex değilse confirmed.matched=false döner.
      const decodedIdHex =
        result.verdict === "strong" ? result.cloakId : null;
      const signalsCount = result.signals.length;
      const candidateContributors = decodedIdHex !== null
        ? {}
        : {
            layerSignals: Math.min(1, signalsCount / 3),
            dnaSimilarity: aegisDnaGuidedSearch?.hint === "found_match" ? 0.5 : 0,
            crossModuleConsistency: signalsCount > 0 ? 0.3 : 0,
          };
      twoTierDecision = projectTwoTierDecision({
        decodedIdHex,
        expectedIdHex,
        candidateContributors,
      });
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "twoTier projection skip",
      );
    }
    // ── AEGIS Orchestrator köprüsü — additive, KARAR DEĞİŞTİRMEZ ──
    // Mevcut alanlar AYNEN korunur. 4 yeni alan ADDITIVE: activeModules,
    // orchestratorEvidenceChain, orchestratorDecision, dnaUsageStatus.
    // Final STRONG verdict hâlâ runScanOne karar bloğundan; orchestrator
    // YENİ vault kapısı AÇMAZ.
    let scanActiveModules:
      | ReturnType<typeof import("../orchestrator/index.js").detectActiveModules>
      | undefined;
    let scanOrchestratorEvidenceChain:
      | ReturnType<typeof import("../orchestrator/index.js").searchOrchestrator>
      | undefined;
    let scanOrchestratorDecision:
      | ReturnType<
          typeof import("../orchestrator/index.js").commonDecisionTail
        >["orchestratorDecision"]
      | undefined;
    let scanDnaUsageStatus:
      | ReturnType<
          typeof import("../orchestrator/index.js").commonDecisionTail
        >["dnaUsageStatus"]
      | undefined;
    try {
      const {
        detectActiveModules,
        searchOrchestrator,
        commonDecisionTail,
      } = await import("../orchestrator/index.js");
      scanActiveModules = detectActiveModules({ explicit: ["text"] });
      const expectedCloakId = rows[0]!.cloakId;
      const decodedCloakId =
        result.verdict === "strong" ? result.cloakId : null;
      scanOrchestratorEvidenceChain = searchOrchestrator({
        text: {
          strongVerdict: result.verdict === "strong",
          decodedCloakId,
          expectedCloakId,
          extra: {
            risk: result.risk,
            confidence: result.confidence,
            signalCount: result.signals.length,
          },
        },
      });
      const dnaUsage = {
        kind: aegisDnaReport
          ? ("record_and_common_decision_tail" as const)
          : ("record_only" as const),
        description: aegisDnaReport
          ? "DNA record loaded and read by orchestrator commonDecisionTail. No new vault gate created; existing module gates remain authoritative."
          : "DNA record-only this turn; no DNA snapshot loaded for decision tail.",
        dnaRead: aegisDnaReport !== undefined,
        dnaReportFound:
          aegisDnaReport !== undefined &&
          (aegisDnaReport as { status?: string }).status !== "not_found",
        dnaOverlapWarnings: aegisDnaReport?.overlapWarnings?.length ?? 0,
      };
      const tail = commonDecisionTail({
        activeModules: scanActiveModules.modules,
        evidence: scanOrchestratorEvidenceChain.evidence,
        expectedIdHex: expectedCloakId,
        decodedIdHex: decodedCloakId,
        dnaUsage,
      });
      scanOrchestratorDecision = tail.orchestratorDecision;
      scanDnaUsageStatus = tail.dnaUsageStatus;
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "orchestrator skip",
      );
    }
    // ── AEGIS Ortak DNA Karar Masası — per-modül status (text search) ──
    // AEGIS_COMMON_DNA OFF iken `scanDecisionBoard` undefined kalır.
    let scanDecisionBoard:
      | Array<import("../dna/commonDnaBoard.js").ModuleBoardEntry>
      | undefined;
    try {
      const { commonDnaBoardEnabled, buildModuleStatus } = await import(
        "../dna/commonDnaBoard.js"
      );
      if (commonDnaBoardEnabled()) {
        const expectedCloakId = rows[0]!.cloakId;
        const decodedCloakId =
          result.verdict === "strong" ? result.cloakId : null;
        // Evrensel kural: DNA varsa kullanıldı; yoksa main scan yine
        // çalışır (orchestrator koşulsuz). dnaUsed = aegisDnaReport bulundu
        // mu ve "not_found" değil; dnaFallback = aksi durumda.
        const scanDnaUsed =
          aegisDnaReport !== undefined &&
          (aegisDnaReport as { status?: string }).status !== "not_found";
        scanDecisionBoard = [
          buildModuleStatus({
            module: "text",
            phase: "search",
            ran: true,
            searched: true,
            decodedIdHex: decodedCloakId,
            expectedIdHex: expectedCloakId,
            candidateScore: result.verdict === "strong" ? 1 : result.confidence,
            dnaId: `text:${expectedCloakId}`,
            dnaUsed: scanDnaUsed,
            dnaFallback: !scanDnaUsed,
          }),
        ];
      }
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "common-dna board (scan-cloak) skip",
      );
    }
    const scanDnaReportFound =
      aegisDnaReport !== undefined &&
      (aegisDnaReport as { status?: string }).status !== "not_found";
    const textCommonDecision = buildTextSearchCommonDecision({
      result,
      expectedCloakId: rows[0]!.cloakId,
      dnaRead: aegisDnaReport !== undefined,
      dnaReportFound: scanDnaReportFound,
    });
    recordSecureRoomTextSummary({
      req,
      fileId: rows[0]!.docId,
      copyId: rows[0]!.cloakId,
      sessionId: `scan-cloak:${rows[0]!.cloakId}`,
      textCommonDecision,
      note: `Auto module_summary after text scan: ${textCommonDecision.officialDecision}`,
    });
    res.json({
      ...result,
      aegisDnaReport,
      aegisDnaGuidedSearch,
      twoTierDecision,
      activeModules: scanActiveModules,
      orchestratorEvidenceChain: scanOrchestratorEvidenceChain,
      orchestratorDecision: scanOrchestratorDecision,
      dnaUsageStatus: scanDnaUsageStatus,
      decisionBoard: scanDecisionBoard,
      textCommonDecision,
    });
  }),
);

router.post(
  "/scan-cloak-all",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const { text, clientId, limit } = req.body ?? {};
    if (typeof text !== "string" || text.length === 0) {
      res.status(400).json({ error: "text (non-empty string) required" });
      return;
    }
    let clientIdStr: string | null = null;
    if (clientId !== undefined && clientId !== null) {
      try {
        clientIdStr = normalizeClientId(clientId);
      } catch (err) {
        if (err instanceof InvalidClientIdError) {
          res.status(400).json({ error: `clientId invalid: ${err.message}` });
          return;
        }
        throw err;
      }
    }
    const limN = Math.min(
      1000,
      Math.max(1, typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : 200),
    );
    const where = clientIdStr ? eq(cloakedDocumentsTable.clientId, clientIdStr) : undefined;
    const rows = await (where
      ? db
          .select()
          .from(cloakedDocumentsTable)
          .where(where)
          .orderBy(desc(cloakedDocumentsTable.createdAt))
          .limit(limN)
      : db
          .select()
          .from(cloakedDocumentsTable)
          .orderBy(desc(cloakedDocumentsTable.createdAt))
          .limit(limN));

    const matches: CloakScanOutcome[] = [];
    for (const r of rows) {
      const o = await runScanOne(text, r);
      // Suppress low-signal noise: only surface rows that actually
      // earned a verdict above insufficient.
      if (o.verdict !== "insufficient") matches.push(o);
    }
    matches.sort((a, b) => {
      const aDecisive = a.signals.some((s) => s.type === "canary" || s.type === "honeytoken")
        ? 1
        : 0;
      const bDecisive = b.signals.some((s) => s.type === "canary" || s.type === "honeytoken")
        ? 1
        : 0;
      if (aDecisive !== bDecisive) return bDecisive - aDecisive;
      return b.confidence - a.confidence;
    });
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Cloak_Scan",
      details: {
        scope: "scan-cloak-all",
        clientFilter: clientIdStr,
        scannedCount: rows.length,
        matchCount: matches.length,
        topRisk: matches[0]?.risk ?? "none",
      },
    });
    res.json({
      found: matches.length > 0 && matches[0]!.risk === "high",
      scannedCount: rows.length,
      matches: matches.slice(0, 25),
    });
  }),
);

router.post(
  "/generate-cloak-report",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const normalizedInput = normalizeGenerateCloakReportInput(req.body);
    if (!normalizedInput.ok) {
      res.status(normalizedInput.error.status).json(normalizedInput.error.body);
      return;
    }
    const { text, docId, clientIdStr, expertNotes, userId } = normalizedInput.value;
    const rows = await db
      .select()
      .from(cloakedDocumentsTable)
      .where(
        and(
          eq(cloakedDocumentsTable.clientId, clientIdStr),
          eq(cloakedDocumentsTable.docId, docId),
        ),
      )
      .orderBy(desc(cloakedDocumentsTable.createdAt))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "no cloaked document for (clientId, docId)" });
      return;
    }
    const row = rows[0]!;
    const scan = await runScanOne(text, row);

    const layerNames = Object.entries(row.layers as Record<string, boolean>)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");
    const signalsLine = scan.signals
      .map((s) => `${s.type}(${s.confidence.toFixed(2)})`)
      .join(", ");
    const cloakNote = [
      "DATA-CLOAK FORENSİK RAPORU",
      `cloakId: ${row.cloakId}`,
      `docId: ${row.docId}`,
      `clientId: ${row.clientId}`,
      `keyVersion: ${row.keyVersion}`,
      `strength: ${row.strength}`,
      `sensitiveTopic: ${row.sensitiveTopic}`,
      `katmanlar: ${layerNames}`,
      `tespit: ${scan.found ? "EVET" : "HAYIR"}`,
      `risk: ${scan.risk}`,
      `confidence: ${scan.confidence.toFixed(3)}`,
      `sinyaller: ${signalsLine || "yok"}`,
      "",
      "Kamera/OCR dayanıklılık notu: zero-width ve homoglyph katmanları OCR sonrası tipik olarak silinir;",
      "canary cümlesi (görünür) ve müşteri-bağlı sinonim seçimi (linguisticDna) genellikle hayatta kalır.",
      "",
      "Bu rapor teknik inceleme amaçlıdır; tek başına kesin bir hukuki karar değildir.",
      typeof expertNotes === "string" && expertNotes.trim().length > 0
        ? `\nUzman yorumu:\n${expertNotes.trim().slice(0, 6000)}`
        : "",
    ].join("\n");

    const matched = scan.signals.filter((s) => s.confidence >= 0.5).length;
    const total = Math.max(matched, scan.signals.length, 1);
    const { generateForensicReport } = await import("../lib/reportGenerator.js");
    const report = await generateForensicReport({
      suspectText: text,
      protectedText: `(cloaked carrier; protectionHash=${row.protectionHash ?? "n/a"})`,
      suspectedClientId: clientIdStr,
      confidenceScore: Math.min(1, Math.max(0, scan.confidence)),
      matchedTokens: matched,
      totalTokens: total,
      candidates: [
        {
          clientId: clientIdStr,
          matchedTokens: matched,
          totalTokens: total,
          confidenceScore: Math.min(1, Math.max(0, scan.confidence)),
        },
      ],
      expertNotes: cloakNote,
      ...(typeof userId === "string" && userId ? { userId } : {}),
      ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
      generatedAt: new Date(),
    });

    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const route = req.originalUrl.split("?")[0] ?? req.originalUrl;
    recordEventFireAndForget({
      ip,
      route,
      kind: "Cloak_Report",
      details: {
        clientIdStr,
        docId,
        cloakId: row.cloakId,
        risk: scan.risk,
        confidence: scan.confidence,
        sha256: report.sha256,
      },
    });

    const filename = buildCloakPdfReportFilename();
    const headers = buildPdfReportDownloadHeaders({
      filename,
      byteLength: report.byteLength,
      sha256: report.sha256,
    });
    res
      .status(200)
      .setHeader("Content-Type", headers["Content-Type"])
      .setHeader("Content-Length", headers["Content-Length"])
      .setHeader("Content-Disposition", headers["Content-Disposition"])
      .setHeader("x-report-sha256", headers["x-report-sha256"])
      .setHeader("Access-Control-Expose-Headers", headers["Access-Control-Expose-Headers"])
      .end(report.buffer);
  }),
);

// ── AEGIS Hayal 3 Step 1 — /analyze-image (Cross-Modal OCR İskeleti) ──
//
// Şüpheli bir görsel yüklendiğinde önce Tesseract.js ile OCR yapar; çıkan
// metni (kirli/düşük confidence olsa bile) mevcut /analyze-text iç akışına
// loopback fetch ile gönderir → tieredVerdict + Confidence Ladder geri döner.
//
// İki giriş tipi: (a) multipart/form-data field "image", (b) JSON
// {imageBase64}. Auth headers (admin token ya da api key) downstream
// /analyze-text'e doğrudan forward edilir — tenant scoping aynı kalır.
//
// Audit kinds (iki yer kuralı): Image_Ocr_Performed, Image_Analyzed.
const imageUpload = createSecureMemoryUpload(MULTIPART_UPLOAD_PROFILES.aegisImage);

const OCR_LOW_CONFIDENCE_THRESHOLD = Number(
  process.env.AEGIS_OCR_LOW_CONFIDENCE ?? "60",
);
const ANALYZE_IMAGE_MAX_INPUT_PIXELS = 80_000_000;
const ANALYZE_IMAGE_MAX_OCR_DIMENSION = 4096;
const ANALYZE_IMAGE_MIN_DIMENSION = 8;

type AnalyzeImagePrepared =
  | {
      ok: true;
      ocrBuffer: Buffer;
      width: number;
      height: number;
      format: string | null;
    }
  | {
      ok: false;
      status: 400;
      reason:
        | "unreadable_image"
        | "image_dimensions_missing"
        | "image_too_small"
        | "image_too_large"
        | "image_decode_failed";
    };

async function prepareAnalyzeImageForOcr(buffer: Buffer): Promise<AnalyzeImagePrepared> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer, {
      limitInputPixels: ANALYZE_IMAGE_MAX_INPUT_PIXELS,
    }).metadata();
  } catch {
    return { ok: false, status: 400, reason: "unreadable_image" };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    return { ok: false, status: 400, reason: "image_dimensions_missing" };
  }
  if (width < ANALYZE_IMAGE_MIN_DIMENSION || height < ANALYZE_IMAGE_MIN_DIMENSION) {
    return { ok: false, status: 400, reason: "image_too_small" };
  }
  if (width * height > ANALYZE_IMAGE_MAX_INPUT_PIXELS) {
    return { ok: false, status: 400, reason: "image_too_large" };
  }

  try {
    const ocrBuffer = await sharp(buffer, {
      limitInputPixels: ANALYZE_IMAGE_MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: ANALYZE_IMAGE_MAX_OCR_DIMENSION,
        height: ANALYZE_IMAGE_MAX_OCR_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    if (ocrBuffer.byteLength === 0) {
      return { ok: false, status: 400, reason: "image_decode_failed" };
    }
    return {
      ok: true,
      ocrBuffer,
      width,
      height,
      format: metadata.format ?? null,
    };
  } catch {
    return { ok: false, status: 400, reason: "image_decode_failed" };
  }
}

router.post(
  "/analyze-image",
  requireAdminToken,
  imageUpload.single("image"),
  asyncHandler(async (req, res) => {
    const auditIp = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const auditRoute = req.originalUrl.split("?")[0] ?? req.originalUrl;

    let buffer: Buffer | null = null;
    if (req.file?.buffer) {
      buffer = req.file.buffer;
    } else if (typeof req.body?.imageBase64 === "string") {
      const raw = req.body.imageBase64.replace(
        /^data:image\/\w+;base64,/,
        "",
      );
      try {
        buffer = Buffer.from(raw, "base64");
        if (buffer.byteLength === 0) buffer = null;
      } catch {
        buffer = null;
      }
    }
    if (!buffer || buffer.byteLength === 0) {
      res.status(400).json({
        error:
          "image required (multipart 'image' field or JSON {imageBase64})",
      });
      return;
    }

    // ── Faz 5 Step 5.7 — Adli EXIF Metadata Extraction ──
    //
    // sharp.metadata() raw EXIF buffer'ı + container fields (orientation,
    // density, ICC profile) döner. Forensic chain: tüm available
    // metadata + sha256(exif) + sha256(buffer) audit log'a yazılır →
    // tamper-evident "Original Capture Data" attestation. Cryptographic
    // binding: bufferSha256 + exifSha256 birlikte → kanıt bütünlüğü.
    const preparedImage = await prepareAnalyzeImageForOcr(buffer);
    if (!preparedImage.ok) {
      req.log.warn(
        {
          reason: preparedImage.reason,
          route: auditRoute,
          bytes: buffer.byteLength,
        },
        "analyze_image_rejected_before_ocr",
      );
      recordEventFireAndForget({
        ip: auditIp,
        route: auditRoute,
        kind: "Image_Analyzed",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          analyzeStatus: preparedImage.status,
          warning: "analyze_image_failed",
          reason: preparedImage.reason,
          confirmed: false,
          idMatched: false,
          canOpenVault: false,
          vaultCapable: false,
        },
      });
      res.status(preparedImage.status).json({
        error: "analyze_image_failed",
        reason: preparedImage.reason,
        finalDecision: "TEXT_NOT_FOUND",
        confirmed: false,
        idMatched: false,
        canOpenVault: false,
        vaultCapable: false,
      });
      return;
    }

    let exifReport: Record<string, unknown> | null = null;
    try {
      const meta = await sharp(buffer).metadata();
      const exifBuf: Buffer | undefined = meta.exif;
      const exifSha256 = exifBuf
        ? createHash("sha256").update(exifBuf).digest("hex")
        : null;
      const bufferSha256 = createHash("sha256")
        .update(buffer)
        .digest("hex");
      exifReport = {
        bufferSha256,
        bufferBytes: buffer.byteLength,
        format: meta.format ?? null,
        width: meta.width ?? null,
        height: meta.height ?? null,
        space: meta.space ?? null,
        channels: meta.channels ?? null,
        density: meta.density ?? null,
        orientation: meta.orientation ?? null,
        hasAlpha: meta.hasAlpha ?? null,
        hasProfile: meta.hasProfile ?? null,
        iccProfile: meta.icc ? "present" : null,
        exifPresent: exifBuf !== undefined,
        exifBytes: exifBuf?.byteLength ?? 0,
        exifSha256,
        exifBase64: exifBuf
          ? Buffer.from(exifBuf).toString("base64")
          : null,
      };
      recordEventFireAndForget({
        ip: auditIp,
        route: auditRoute,
        kind: "Exif_Metadata_Extracted",
        details: {
          bufferSha256,
          bufferBytes: buffer.byteLength,
          format: meta.format ?? null,
          width: meta.width ?? null,
          height: meta.height ?? null,
          orientation: meta.orientation ?? null,
          density: meta.density ?? null,
          exifPresent: exifBuf !== undefined,
          exifBytes: exifBuf?.byteLength ?? 0,
          exifSha256,
          extractedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      req.log.warn({ err }, "exif_metadata_extract_failed");
    }

    // ── AEGIS v4.1 Faz 5 — Visual Matruşka detection (L3 → L2 → L1) ──
    // Pre-OCR pixel scan. L3 önce çünkü blind decode + DB lookup ile
    // doğrudan vault PQC verify çağırabilir → matchConfidence "vault-confirmed"
    // upgrade'i. L2 candidate-verifier (req.body.candidateCloakIds) ile.
    // L1 candidate cloak hint (req.body.l1HintCloakId) ile.
    //
    // HUKUKİ KORUMA: L3 detect threshold (meanVoteRatio>=0.85, syncMatchRatio>=14/16)
    // + DB lookup match + PQC verify = üç-bağımsız-koşul. Hiçbiri kestirme değil.
    interface VisualLayersOut {
      l1: { detected: boolean; hits: number; total: number; bestNcc: number; cloakIdHint: string | null };
      l2: {
        detected: boolean;
        bestSimilarity: number;
        bestCloakId: string | null;
        measuredGapCount: number;
        candidateCount: number;
        blindPayloadHex: string;
      };
      l3: {
        detected: boolean;
        algorithm: "lsb-v1" | "dct-v1" | null;
        digestHex: string;
        meanVoteRatio: number;
        syncMatchRatio: number;
        vaultLookup: "match" | "no_match" | "no_signal";
        vaultVerified: boolean;
        attributedClientId: string | null;
        attributedCloakId: string | null;
        // L3-DCT (Faz 5.2 — JPEG-robust kanal)
        dctDetected: boolean;
        dctSyncMatchRatio: number;
        dctRsOk: boolean;
        dctRsCorrected: number;
        dctVoteAvgConfidence: number;
        dctDigestHex: string;
      };
      eccRecovery: {
        attempted: boolean;
        layerId: string;
        carrier: "ring_soft14_margin24";
        role: "candidate_support_only_no_vault";
        candidateCount: number;
        candidateSupport: boolean;
        exactParityMatch: boolean;
        bestCandidateCloakId: string | null;
        recoveredIdHex: string | null;
        recoveredMatchesExpected: boolean;
        parityBitMatches: number;
        parityByteMatches: number;
        confidenceBand: "none" | "weak" | "strong";
        averageConfidence: number;
        reason:
          | "ok"
          | "no_candidates"
          | "invalid_candidates"
          | "no_exact_match";
        confirmed: false;
        canOpenVault: false;
        vaultEligible: false;
      };
      // Faz 5 Step 5.3 T6 — Geometric-robust nested markers + vault region.
      // verdict semantik (architect direktifi — körü körüne attribution YOK):
      //   NO_SIGNAL          — Step 5.3 hiç denenmedi (no candidates / no metadata).
      //   INSUFFICIENT       — Aday(lar) denendi ama hiçbir outer markaja eşik üzeri
      //                         hit yok (≥3 sayısına ulaşılamadı).
      //   OCCLUDED           — Outer hit ≥3 fakat coverage <%95 ya da inner
      //                         re-detect <2 → geometrik düzeltme güvenilmez.
      //   TAMPER_SUSPECTED   — V1 byte-byte match + V2 PQC verify ✓ AMA
      //                         V3 pHash Hamming ≥15 (vault region tahrip).
      //   VAULT_CONFIRMED    — Tüm geçitler ✓ (outer ≥3 + coverage ≥%95 + inner ≥2
      //                         + V1 match + V2 PQC + V3 pHash ≤14).
      syncMarkers: {
        attempted: boolean;
        candidateCount: number;
        bestCandidateCloakId: string | null;
        outerHits: number;
        // Faz 5 Step 5.4 T2 — best candidate'in scheme'i + 8-marker
        // path'inde toplam outer anchor sayısı (v1=4, v2=8). Caller smoke
        // bu alanlardan 5/8 gate davranışını gözleyebilir.
        outerScheme:
          | "v1-4marker"
          | "v2-8marker"
          | "v3-8marker-multiscale"
          | "v4-8marker-cim"
          | "v5-8marker-dct-cim";
        outerExpected: number;
        outerSpatialDistinctSides: number;
        innerHits: number;
        coverageRatio: number;
        affineRmsResidualPx: number;
        geometricCorrected: boolean;
        // Faz 5 Step 5.4 T3 — Hough deskew Pass 3:
        //   deskewApplied=true ⇒ Hough algıladığı |θ|≥3° rotation'ı ters
        //   warp ile düzeltti VE Pass 3 FAST tekrarı ≥MIN_HITS verdi.
        //   deskewThetaDeg ham Hough açısı (derece, CCW pozitif). Hough
        //   hiç çağrılmadıysa (Pass 1+2 zaten yetti) null kalır.
        deskewApplied: boolean;
        deskewThetaDeg: number | null;
        // Faz 5 Step 5.4 T3.5 — multi-scale Pass 0 (LARGE marker) telemetry:
        //   largePathUsed=true ⇒ v3 row matched via Pass 0 LARGE detect
        //     (≥5/8 LARGE hits + 3 distinct sides + cov ≥0.6); SMALL chain
        //     (Pass 1+2+3) was skipped for that candidate. The legacy SMALL
        //     chain still runs for v1/v2 rows AND for v3 rows that fail
        //     Pass 0 (e.g. ±15° rotation where LARGE NCC also collapses).
        //   outerLargeHits / outerLargeExpected report best LARGE-pass
        //     candidate's count even when largePathUsed=false (observability).
        outerLargeHits: number;
        outerLargeExpected: number;
        largePathUsed: boolean;
        // Faz 5 Step 5.4.1 — Concentric Identity Marker (CIM) telemetry:
        //   cimPathUsed=true ⇒ v4 row matched via Pass 0a CIM detect
        //     (≥5/8 R1 hits + 3 distinct sides + cov ≥0.6); Pass 0b LARGE
        //     and SMALL chain were skipped for that candidate. The legacy
        //     chains still run for v1/v2/v3 rows AND for v4 rows that fail
        //     Pass 0a (e.g. text-noise SNR floor on rotate +5°).
        //   cimHits / cimExpected report best CIM-pass candidate's count
        //     even when cimPathUsed=false (observability).
        //   cimDiagnostics: per-anchor ring-by-ring degradation profile.
        //   cimDegradationProfile: aggregate counts across all 8 anchors.
        cimHits: number;
        cimExpected: number;
        cimPathUsed: boolean;
        cimDiagnostics: Array<{
          corner: MarkerKey;
          r1Ok: boolean;
          r2Ok: boolean;
          r3Ok: boolean;
          idHamming: number;
          degradation: CimDegradation;
          dx: number;
          dy: number;
        }>;
        cimDegradationProfile: {
          clean: number;
          mediumBlur: number;
          heavyBlur: number;
          tamper: number;
          missing: number;
        };
        // Faz 5 Step 5.5 — DCT-domain Frekans Zırhı telemetry:
        //   dctPathUsed=true ⇒ v5 row matched via Pass 0a-DCT detect
        //     (≥5/8 R1 hits + 3 distinct sides → fitAffineNormalized →
        //     recoverAttackedImage → V1/V2/V3). CIM/LARGE/SMALL chains
        //     skipped for that candidate.
        //   dctHits / dctExpected report best DCT-pass candidate's count
        //     even when dctPathUsed=false (observability).
        //   dctDiagnostics: per-anchor ring-by-ring NCC + RS state.
        //   dctDegradationProfile: aggregate counts across all 8 anchors.
        dctHits: number;
        dctExpected: number;
        dctPathUsed: boolean;
        dctDiagnostics: Array<{
          corner: MarkerKey;
          r1Ncc: number;
          r2Ncc: number;
          r3Ncc: number;
          r3RsOk: boolean;
          degradation: DctDegradationLabel;
          dx: number;
          dy: number;
        }>;
        dctDegradationProfile: {
          clean: number;
          jpegDegraded: number;
          warpDegraded: number;
          tamper: number;
          missing: number;
        };
        // Faz 5 Step 5.6 — Hough × DCT köprüsü telemetrisi:
        //   dctDeskewApplied=true ⇒ Phase A (raw frame) DCT promotion
        //     gate FAIL etti, Hough |θ|≥1.5° tespit etti ve Phase B
        //     (deskewed frame) DCT detect promotion gate'i geçirdi.
        //     Detected positions invDeskew ile RAW pxRgba coords'a
        //     geri projekte edildi → Maskeleme Kanunu (TEK bilinear at
        //     recoverAttackedImage) intakt. dctPathUsed da true olur.
        //   dctDeskewThetaDeg = Phase B'de kullanılan ham Hough açısı
        //     (derece, CCW pozitif). null ⇒ Phase B hiç tetiklenmedi
        //     (Phase A geçti veya v5 outerDct yok).
        //   Clean ve JPEG path'i Phase A ile geçer ⇒ deskewApplied=false,
        //     dctDeskewThetaDeg=null kalır. Sadece rotation (S02/S04/S07)
        //     veya rotation+crop senaryolarında bu field'lar set olur.
        dctDeskewApplied: boolean;
        dctDeskewThetaDeg: number | null;
        /**
         * Step 5.8-A.3 SPIKE telemetry. Phase C wide-Hough fallback
         * source: "narrow" = mevcut ±15° default Hough (Step 5.6.3),
         * "wide" = Phase C ±44° fallback (D08 +30° gibi out-of-range
         * rotasyon), null = deskew hiç fire etmedi (Phase A geçti veya
         * v5 outerDct yok).
         */
        dctDeskewSource: "narrow" | "wide" | null;
        // Step 5.7-A — count of DCT anchors with HMAC R3 ID identity match
        // (RS-decoded 5-byte payload byte-equal to identity.idPayload =
        // HMAC(tenantSecret, "aegis-dct-id-v1|outer|<corner>|<cloakId>")[0:5]).
        // Set when ≥6 anchors authenticate during the per-cloak ladder
        // (compound 2^-240 cryptographic identity proof of THIS row's
        // cloakId). null/0 in clean+JPEG path (Phase A V1 LSB wins) or
        // when DCT path didn't fire.
        dctR3HmacAuthCount: number;
      };
      vault: {
        attempted: boolean;
        v1Match: boolean;
        v2PqcVerified: boolean;
        v3PHashHamming: number | null;
        verdict:
          | "NO_SIGNAL"
          | "INSUFFICIENT"
          | "OCCLUDED"
          | "TAMPER_SUSPECTED"
          | "VAULT_CONFIRMED";
        attributedClientId: string | null;
        attributedCloakId: string | null;
        source:
          | "visual-vault-region-v1"
          | "visual-vault-l3dct"
          | "visual-vault-l3dct-under-deskew"
          | "visual-vault-anchor-hmac-r3"
          | "visual-vault-stripe-yqim"
          | null;
      };
    }
    const visualLayersOut: VisualLayersOut = {
      l1: { detected: false, hits: 0, total: 0, bestNcc: 0, cloakIdHint: null },
      l2: {
        detected: false,
        bestSimilarity: 0,
        bestCloakId: null,
        measuredGapCount: 0,
        candidateCount: 0,
        blindPayloadHex: "",
      },
      l3: {
        detected: false,
        algorithm: null,
        digestHex: "",
        meanVoteRatio: 0,
        syncMatchRatio: 0,
        vaultLookup: "no_signal",
        vaultVerified: false,
        attributedClientId: null,
        attributedCloakId: null,
        dctDetected: false,
        dctSyncMatchRatio: 0,
        dctRsOk: false,
        dctRsCorrected: 0,
        dctVoteAvgConfidence: 0,
        dctDigestHex: "",
      },
      eccRecovery: {
        attempted: false,
        layerId: "visual-ecc-ring-soft14-margin24-v1",
        carrier: "ring_soft14_margin24",
        role: "candidate_support_only_no_vault",
        candidateCount: 0,
        candidateSupport: false,
        exactParityMatch: false,
        bestCandidateCloakId: null,
        recoveredIdHex: null,
        recoveredMatchesExpected: false,
        parityBitMatches: 0,
        parityByteMatches: 0,
        confidenceBand: "none",
        averageConfidence: 0,
        reason: "no_candidates",
        confirmed: false,
        canOpenVault: false,
        vaultEligible: false,
      },
      syncMarkers: {
        attempted: false,
        candidateCount: 0,
        bestCandidateCloakId: null,
        outerHits: 0,
        outerScheme: "v1-4marker",
        outerExpected: 0,
        outerSpatialDistinctSides: 0,
        innerHits: 0,
        coverageRatio: 0,
        affineRmsResidualPx: 0,
        geometricCorrected: false,
        deskewApplied: false,
        deskewThetaDeg: null,
        outerLargeHits: 0,
        outerLargeExpected: 0,
        largePathUsed: false,
        cimHits: 0,
        cimExpected: 0,
        cimPathUsed: false,
        cimDiagnostics: [],
        cimDegradationProfile: {
          clean: 0,
          mediumBlur: 0,
          heavyBlur: 0,
          tamper: 0,
          missing: 0,
        },
        dctHits: 0,
        dctExpected: 0,
        dctPathUsed: false,
        dctDiagnostics: [],
        dctDeskewApplied: false,
        dctDeskewThetaDeg: null,
        // Step 5.8-A.3 SPIKE — Phase C wide-Hough fallback telemetry.
        dctDeskewSource: null,
        dctR3HmacAuthCount: 0,
        dctDegradationProfile: {
          clean: 0,
          jpegDegraded: 0,
          warpDegraded: 0,
          tamper: 0,
          missing: 0,
        },
      },
      vault: {
        attempted: false,
        v1Match: false,
        v2PqcVerified: false,
        v3PHashHamming: null,
        verdict: "NO_SIGNAL",
        attributedClientId: null,
        attributedCloakId: null,
        source: null,
      },
    };
    let visualVaultConfirmed = false;
    let visualAttributedClientId: string | null = null;
    let visualAttributedCloakId: string | null = null;
    // Step 5.3 source — used by replay-guard override at end of handler.
    // Set to "visual-vault-region-v1" when Step 5.3 confirms; otherwise
    // null and existing L3-LSB/L3-DCT branches own attribution.
    let visualVaultSource:
      | "visual-vault-region-v1"
      | "visual-vault-l3dct-under-deskew"
      | "visual-vault-anchor-hmac-r3"
      | "visual-vault-stripe-yqim"
      | null = null;

    try {
      const decoded = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
      const pxRgb = new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
      const pxW = decoded.info.width;
      const pxH = decoded.info.height;
      const pxCh = decoded.info.channels as 3 | 4;

      // ── Faz 5 Step 5.3 T6 — Geometric-robust nested markers + vault region ──
      //
      // Pipeline (mevcut L3 LSB/DCT akışından ÖNCE çalışır; başarılıysa
      // visualVaultConfirmed=true setler ve aşağıdaki LSB/DCT yolları aynı
      // attribution'ı override etmez. T6 başarısız olursa LSB/DCT akışı her
      // zamanki gibi devreye girer):
      //   (a) RGB → RGBA upgrade (markers/vault API'leri 4-kanal ister).
      //   (b) candidateCloakIds parsed (hint zorunlu — marker maskesi tenant
      //       secret'a bağlı, blind decode imkansız). Tenant scope:
      //       api-key path vault_anchors.tenant_id ile filtreler.
      //   (c) Her aday için: tenant secret resolve → outer marker detect (±8 px
      //       NCC). <3 hit ise INSUFFICIENT, sonraki adaya geç.
      //   (d) ≥3 hit: fitAffineNormalized(expected, observed) — Hartley
      //       conditioning (1280×720 koordinatlarda normal denklemler iyi şartlı).
      //   (e) computeCoverageRatio(expectedOuter, M, w, h) <0.95 → OCCLUDED.
      //   (f) recoverAttackedImage(rgba, M, dstW=templateW, dstH=templateH) →
      //       template koordinatlarında düzeltilmiş frame.
      //   (g) Inner marker re-detect (warped'ta ±4 px). <2 → OCCLUDED.
      //   (h) computeVaultPHash(recovered, vaultRect) — MASK ÖNCESİ (embed
      //       sırası ile simetri).
      //   (i) maskInnerMarkerPatches(recovered, innerPatches, neutralLuma) —
      //       "Maskeleme Kanunu" — extractVaultV1 öncesi zorunlu.
      //   (j) extractVaultV1(recovered, vaultRect, {expectedCompactId}). Decisive
      //       gate `r.match` (rsOk DEĞİL — kullanıcı direktifi 4).
      //   (k) match=true → V2 PQC verify (vault_anchors signature).
      //   (l) PQC ✓ → V3 pHash Hamming kontrol. ≤14 → VAULT_CONFIRMED;
      //       ≥15 → TAMPER_SUSPECTED (vault content tahrip).
      //   (m) İlk eşleşen aday kazanır; sonrakiler atlanır.
      //
      // Tenant secret kaynağı: vault_anchors.keyVersion → aegis.getSecretForVersion
      // → deriveTenantSecret(masterKey, clientId) — /cloak-image ile birebir aynı.
      const step53CandidateRaw = req.body?.candidateCloakIds;
      const step53Candidates = Array.isArray(step53CandidateRaw)
        ? step53CandidateRaw.filter((x): x is string => typeof x === "string").slice(0, 32)
        : [];
      visualLayersOut.syncMarkers.candidateCount = step53Candidates.length;

      if (step53Candidates.length > 0) {
        visualLayersOut.syncMarkers.attempted = true;
        visualLayersOut.vault.attempted = true;
        // RGB → RGBA upgrade once.
        const pxRgba: Uint8Array = pxCh === 4
          ? pxRgb
          : (() => {
              const r = new Uint8Array(pxW * pxH * 4);
              for (let i = 0; i < pxW * pxH; i++) {
                r[i * 4] = pxRgb[i * 3]!;
                r[i * 4 + 1] = pxRgb[i * 3 + 1]!;
                r[i * 4 + 2] = pxRgb[i * 3 + 2]!;
                r[i * 4 + 3] = 255;
              }
              return r;
            })();

        // Single join query — cloak_layers (vault tier, vault_metadata) ⨝
        // vault_anchors (key version + signature material). Tenant scope via
        // vault_anchors.tenant_id (cloak_layers has no tenant column).
        const step53Conds = [
          inArray(cloakLayersTable.cloakId, step53Candidates),
          eq(cloakLayersTable.tier, "vault"),
        ];
        if (req.apiClient) {
          step53Conds.push(eq(vaultAnchorsTable.tenantId, req.apiClient.id));
        }
        const step53Rows = await db
          .select({
            cloakId: cloakLayersTable.cloakId,
            clientId: cloakLayersTable.clientId,
            docId: cloakLayersTable.docId,
            vaultMetadata: cloakLayersTable.vaultMetadata,
            keyVersion: vaultAnchorsTable.keyVersion,
            payloadDigestSha256: vaultAnchorsTable.payloadDigestSha256,
            payloadCanonical: vaultAnchorsTable.payloadCanonical,
            signature: vaultAnchorsTable.signature,
            publicKey: vaultAnchorsTable.publicKey,
          })
          .from(cloakLayersTable)
          .innerJoin(
            vaultAnchorsTable,
            and(
              eq(vaultAnchorsTable.cloakId, cloakLayersTable.cloakId),
              eq(vaultAnchorsTable.clientId, cloakLayersTable.clientId),
              eq(vaultAnchorsTable.docId, cloakLayersTable.docId),
            ),
          )
          .where(and(...step53Conds))
          .limit(64);

        const step53CloakIds = step53Rows.map((row) => row.cloakId);
        const eccFrames: VisualEccReadFrame[] = [
          { raw: pxRgba, width: pxW, height: pxH, channels: 4 },
        ];
        visualLayersOut.eccRecovery = verifyVisualEccRecoveryCandidateFrames(
          eccFrames,
          step53CloakIds,
        );

        if (!visualLayersOut.eccRecovery.exactParityMatch) {
          const targetDims = new Map<string, { width: number; height: number }>();
          for (const row of step53Rows) {
            const meta = row.vaultMetadata as Record<string, unknown> | null;
            const dims = meta?.imageDims as
              | { width?: unknown; height?: unknown }
              | undefined;
            const targetW = typeof dims?.width === "number" ? dims.width : 0;
            const targetH = typeof dims?.height === "number" ? dims.height : 0;
            if (
              targetW >= ANALYZE_IMAGE_MIN_DIMENSION &&
              targetH >= ANALYZE_IMAGE_MIN_DIMENSION &&
              targetW * targetH <= ANALYZE_IMAGE_MAX_INPUT_PIXELS &&
              (targetW !== pxW || targetH !== pxH) &&
              targetW >= pxW &&
              targetH >= pxH
            ) {
              targetDims.set(`${targetW}x${targetH}`, {
                width: targetW,
                height: targetH,
              });
            }
          }

          for (const dims of [...targetDims.values()].slice(0, 4)) {
            try {
              const normalized = await sharp(Buffer.from(pxRgba), {
                raw: { width: pxW, height: pxH, channels: 4 },
              })
                .resize(dims.width, dims.height, { fit: "fill" })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              eccFrames.push({
                raw: new Uint8Array(
                  normalized.data.buffer,
                  normalized.data.byteOffset,
                  normalized.data.byteLength,
                ),
                width: normalized.info.width,
                height: normalized.info.height,
                channels: 4,
              });
            } catch (err) {
              req.log.warn(
                { err, width: dims.width, height: dims.height },
                "visual_ecc_normalized_read_failed",
              );
            }
          }

          if (eccFrames.length > 1) {
            visualLayersOut.eccRecovery =
              verifyVisualEccRecoveryCandidateFrames(
                eccFrames,
                step53CloakIds,
              );
          }
        }

        // Track best partial result for verdict reporting (worst→best monotone:
        // INSUFFICIENT < OCCLUDED < TAMPER_SUSPECTED < VAULT_CONFIRMED).
        type Step53Verdict = VisualLayersOut["vault"]["verdict"];
        const verdictRank: Record<Step53Verdict, number> = {
          NO_SIGNAL: 0,
          INSUFFICIENT: 1,
          OCCLUDED: 2,
          TAMPER_SUSPECTED: 3,
          VAULT_CONFIRMED: 4,
        };
        let bestVerdict: Step53Verdict = "INSUFFICIENT";
        const bumpVerdict = (v: Step53Verdict) => {
          if (verdictRank[v] > verdictRank[bestVerdict]) bestVerdict = v;
        };

        // Faz 5 Step 5.4 T3 — Hough deskew per-request cache.
        //   Hough analizi PAHALI (~166K piksel × 61 bin Sobel histogramı, perf
        //   bütçesi <500 ms). Tek bir görselin açısı tüm adaylar için aynı
        //   olduğundan analiz, ilk Pass 1+2 başarısızlığında bir kez yapılır
        //   ve sonraki adaylar için tekrar kullanılır:
        //     undefined  ⇒ henüz çağrılmadı (lazy)
        //     null       ⇒ Hough çağrıldı, kullanılabilir rotation YOK
        //                  (estimate=null veya |θ|<3°). Bu durumda Pass 3
        //                  hiç koşmaz, mevcut INSUFFICIENT korunur.
        //     {…}        ⇒ Hough |θ|≥3° buldu ve deskewed frame hazır.
        //   Clean image (Pass 1 ≥5/8 FAST) Hough'a hiç dokunmaz; cache
        //   undefined kalır.
        let deskewState:
          | {
              rgba: Uint8Array;
              w: number;
              h: number;
              thetaDeg: number;
              /** Step 5.8-A.3 SPIKE — "narrow"=±15° default, "wide"=±44° Phase C fallback. */
              source: "narrow" | "wide";
              /**
               * Step 5.8-A.4 T003d — fwdFinal rotation affine
               * (template-coord → raw-coord). RAW frame Y-QIM fallback
               * vault rect projection için kullanılır; warp helper'ları
               * için değil (warp `invertAffine(fwd)` ile dst→src yapar).
               */
              fwd: AffineMatrix;
            }
          | null
          | undefined = undefined;

        // Faz 5 Step 5.6 — Hough × DCT köprüsü için ortak lazy invoke.
        //   SMALL Pass 3 (T3) HEM DCT Phase B (5.6) HEM aynı per-request
        //   `deskewState` cache'ini paylaşır. Tek Hough çağrısı (~166K
        //   piksel × 61 bin Sobel ≈ 1-2 s) tüm aday + tüm path'lere
        //   yayılır. Closure pxRgba/pxW/pxH ve req.log'u outer scope'tan
        //   yakalar.
        type DeskewState = {
          rgba: Uint8Array;
          w: number;
          h: number;
          thetaDeg: number;
          /**
           * Step 5.8-A.3 SPIKE — telemetry only.
           *   "narrow" ⇒ default ±15° Hough (mevcut Step 5.6.3 davranışı)
           *   "wide"   ⇒ Phase C wide-Hough fallback (±44°), narrow null
           *              dönünce devreye girer (D08 +30° gibi out-of-range
           *              rotasyonlar için). Aynı cascade Hough yapısı
           *              kullanılır; tek bilinear warp (Maskeleme Kanunu
           *              intakt) — yalnız `maxAngleDeg` opt değişir.
           */
          source: "narrow" | "wide";
          /**
           * Step 5.8-A.4 T003d — fwdFinal rotation affine surface (template→raw).
           * RAW frame Y-QIM fallback vault rect coord projection için outer
           * scope'a expose edilir.
           */
          fwd: AffineMatrix;
        };
        const ensureDeskewState = (): DeskewState | null => {
          if (deskewState !== undefined) return deskewState;
          let est: ReturnType<typeof estimateRotationAngle> = null;
          try {
            // Step 5.6.3 — Hough threshold tighten for deterministic
            // Phase B fire (no more "bazen"). Calibration:
            //   • minConfidence 1.5 → 1.0: PDFKit text-noise content
            //     under +5° rotation produces Hough peak/mean ratio in
            //     [1.0, 1.5] band — borderline regime caused run-to-run
            //     variance. Lowering to 1.0 admits the genuine peak
            //     while still rejecting edge-poor (<minEdgePixels guard
            //     intakt) and degenerate frames.
            //   • downsampleFactor 1 → 2: edge density compensation —
            //     full-res Sobel on PDFKit text saturates magnitude
            //     histogram (text strokes dominate), 2× downsample
            //     thins edge population so Hough bin energy concentrates
            //     on geometric rotation rather than per-glyph noise.
            //     Side benefit: 4× perf (Hough cost was ~1.5s, now ~400ms).
            est = estimateRotationAngle(pxRgba, pxW, pxH, {
              downsampleFactor: 2,
              minConfidence: 0.5,
            });
          } catch (err) {
            req.log.warn({ err }, "step53_hough_estimate_threw");
            est = null;
          }
          req.log.info(
            {
              est_isNull: est === null,
              thetaDeg: est?.thetaDeg ?? null,
              confidence: est?.confidence ?? null,
              edgePixelCount: est?.edgePixelCount ?? null,
            },
            "step563_hough_debug",
          );
          // Step 5.8-A.3 SPIKE — Phase C wide-Hough fallback.
          //
          // Narrow ±15° null döndüyse (D08 +30° gibi out-of-range), wide
          // ±44° dene. Bu KOD DEĞİŞİKLİĞİ DEĞİL algoritmik olarak — mevcut
          // `estimateRotationAngle` zaten `maxAngleDeg ∈ (0, 44]` destekler;
          // yalnız default 15° wide'a yükseltilir bu fallback path'te.
          // Wide path daha pahalı (~4× bin sayısı) → yalnız narrow fail
          // ettiğinde fire eder; clean/JPEG/D04 path Phase A'da kapanır,
          // narrow Phase B yeterli. Wide ödenmez.
          //
          // Lib smoke `wide_hough_lib_smoke` 12/12 GREEN: ±5°/±20°/±30°/
          // ±40° smooth gratings ±0.5° tolerans, ±44° boundary honest.
          //
          // KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu) intakt: cascade Hough
          // ve final warp yine RAW pxRgba üzerinde TEK bilinear; wide
          // path yalnız θ tahminini değiştirir, image pipeline aynı.
          let deskewSource: "narrow" | "wide" = "narrow";
          // Step 5.8-A.3 SPIKE Aşama 3 — Confidence-driven Pre-Phase-B
          // escalation. İki tetikleyici:
          //   (1) narrow === null  ⇒ wide TRY (mevcut Aşama 2 davranışı).
          //   (2) narrow non-null && narrow.confidence < CONF_FLOOR
          //       ⇒ wide TRY; eğer wide.confidence > narrow.confidence ×
          //         CONF_RATIO ise wide'ı seç ("Yalancı Dedektör Guard").
          //
          // Empirik kalibrasyon (T5.8-A.3 Aşama 2 D08 1-shot probe):
          //   • D08 (+30°) narrow false-peak vakaları confidence ≈ 1.4
          //     (peak/mean ratio); narrow null ⇒ wide fire vakasında wide
          //     confidence ≈ 2.88 → 2× asimetri.
          //   • D04 (+5°) gerçek peak narrow confidence yüksek bekleniyor;
          //     CONF_FLOOR=1.8 D04'ü gate altında bırakır (wide spam YOK).
          //   • CONF_RATIO=1.3 — wide narrow'dan en az %30 daha güçlü
          //     olmalı; aksi halde narrow korunur (içsel guard).
          //
          // KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu) intakt: cascade + final
          // warp yine RAW pxRgba üzerinde TEK bilinear; wide path yalnız
          // θ tahminini değiştirir, image pipeline aynı.
          //
          // Lib smoke `wide_hough_lib_smoke` 12/12 GREEN: ±5°/±20°/±30°/
          // ±40° smooth gratings ±0.5° tolerans, ±44° boundary honest.
          const PHASE_C_CONF_FLOOR = 1.8;
          const PHASE_C_CONF_RATIO = 1.3;
          const tryWide = est === null
            || (est !== null && est.confidence < PHASE_C_CONF_FLOOR);
          if (tryWide) {
            try {
              const estWide = estimateRotationAngle(pxRgba, pxW, pxH, {
                downsampleFactor: 2,
                minConfidence: 0.5,
                maxAngleDeg: 44,
              });
              if (estWide !== null) {
                if (est === null) {
                  // Aşama 2 path: narrow null → wide kabul.
                  est = estWide;
                  deskewSource = "wide";
                  req.log.info(
                    {
                      trigger: "narrow_null",
                      thetaDeg: estWide.thetaDeg,
                      confidence: estWide.confidence,
                      edgePixelCount: estWide.edgePixelCount,
                    },
                    "step58a3_phaseC_wide_hough_fired",
                  );
                } else if (
                  estWide.confidence >
                  est.confidence * PHASE_C_CONF_RATIO
                ) {
                  // Aşama 3 path: narrow false-peak (low conf) → wide
                  // belirgin daha güçlü → wide'ı seç ("Yalancı Dedektör
                  // Guard"). D08 (+30°) tipik vaka.
                  req.log.info(
                    {
                      trigger: "narrow_low_conf",
                      narrowThetaDeg: est.thetaDeg,
                      narrowConfidence: est.confidence,
                      wideThetaDeg: estWide.thetaDeg,
                      wideConfidence: estWide.confidence,
                      confRatio: estWide.confidence / est.confidence,
                    },
                    "step58a3_phaseC_wide_hough_fired",
                  );
                  est = estWide;
                  deskewSource = "wide";
                } else {
                  // Wide narrow'u net yenmedi → narrow korunur (spam guard).
                  req.log.info(
                    {
                      narrowConfidence: est.confidence,
                      wideConfidence: estWide.confidence,
                      confRatio: estWide.confidence / est.confidence,
                    },
                    "step58a3_phaseC_wide_rejected",
                  );
                }
              }
            } catch (err) {
              req.log.warn({ err }, "step58a3_phaseC_wide_hough_threw");
              if (est === null) est = null;
            }
          }
          if (est === null || Math.abs(est.thetaDeg) < 1.5) {
            deskewState = null;
            return null;
          }
          try {
            const cx = pxW / 2;
            const cy = pxH / 2;
            // ── Step 5.6.3 — Cascade Hough (residual refinement) ──
            //
            // Borderline regime gerçeği: PDFKit text içeriğinin kenar
            // gradient histogramı +5° rotation'ı ±2° hata ile geri
            // bildiriyor (Hough peak refinement parabolik vertex'in text
            // stroke noise'tan biased olması — ör. trial 1: θ=5.06°,
            // trial 2: θ=3.06°). Tek-pass deskew'da residual >0.5° kalırsa
            // 1100 px corner anchor lever arm × sin(2°) ≈ 38 px → DCT
            // detect 6 px micro-grid'i ezer. Çözüm: cascade Hough.
            //
            //   Pass A: estimate θ1 on raw pxRgba.
            //   Pass B (throwaway): warp(-θ1) → estimate θ2 (residual)
            //          on warped frame; throwaway buffer (Maskeleme
            //          Kanunu için final output kullanılmaz).
            //   Final: warp(-θ_total) on RAW pxRgba (TEK bilinear).
            //
            // KIRMIZI ÇİZGİ #2: Final deskewState.rgba RAW pxRgba'dan
            //   tek bilinear ile gelir (warp1 sadece residual ölçümü
            //   için throwaway buffer; downstream'e ulaşmaz).
            //
            // Cost: +1 throwaway warp (~150 ms) + 1 ek Hough (~200 ms,
            //   downsample=2 ile). Toplam Phase B path budget ~700 ms;
            //   yalnız Phase A fail durumunda devreye girer (clean/JPEG
            //   path Phase A'da kapanır → cascade ödenmez).
            const theta1 = est.thetaDeg;
            const theta1Rad = (theta1 * Math.PI) / 180;
            const fwd1 = rotationAffine(-theta1Rad, cx, cy);
            const warpedTry1 = warpRgba(
              pxRgba,
              pxW,
              pxH,
              invertAffine(fwd1),
              { dstWidth: pxW, dstHeight: pxH },
            );
            // Residual estimate on warpedTry1. Lower minAngleDeg
            // (Hough default 1.0° gates near-zero residuals) so we
            // capture sub-degree residual; minConfidence kept at 0.5.
            // If null, residual <1° → accept theta1 alone.
            let thetaResidual = 0;
            try {
              const est2 = estimateRotationAngle(
                warpedTry1.rgba,
                warpedTry1.width,
                warpedTry1.height,
                {
                  downsampleFactor: 2,
                  minConfidence: 0.5,
                  minAngleDeg: 0.3,
                },
              );
              if (est2 !== null && Math.abs(est2.thetaDeg) <= 5) {
                thetaResidual = est2.thetaDeg;
              }
              req.log.info(
                {
                  theta1,
                  thetaResidual,
                  est2_isNull: est2 === null,
                  est2_conf: est2?.confidence ?? null,
                },
                "step563_cascade_hough_debug",
              );
            } catch (err) {
              req.log.warn(
                { err },
                "step563_cascade_hough_residual_threw",
              );
            }
            const thetaTotal = theta1 + thetaResidual;
            const thetaTotalRad = (thetaTotal * Math.PI) / 180;
            const fwdFinal = rotationAffine(-thetaTotalRad, cx, cy);
            const warped = warpRgba(
              pxRgba,
              pxW,
              pxH,
              invertAffine(fwdFinal),
              { dstWidth: pxW, dstHeight: pxH },
            );
            deskewState = {
              rgba: warped.rgba,
              w: warped.width,
              h: warped.height,
              thetaDeg: thetaTotal,
              source: deskewSource,
              // Step 5.8-A.4 T003d — surface fwdFinal (template→raw projection)
              // for downstream RAW frame Y-QIM fallback.
              fwd: fwdFinal,
            };
          } catch (err) {
            req.log.warn({ err }, "step53_hough_warp_threw");
            deskewState = null;
          }
          return deskewState;
        };

        for (const row of step53Rows) {
          const meta = row.vaultMetadata as Record<string, unknown> | null;
          if (!meta || meta.stepVersion !== "5.3") continue;
          const vaultRect = meta.vaultRect as VaultRectSpec | undefined;
          const pHashHex = typeof meta.pHash === "string" ? meta.pHash : null;
          const compactIdHex =
            typeof meta.compactId === "string" ? meta.compactId : null;
          const imageDims = meta.imageDims as
            | { width: number; height: number }
            | undefined;
          const markersBlock = meta.markers as
            | {
                // Faz 5 Step 5.4 T1 — outer corners widened to MarkerKey to
                // accept v2-8marker (NW/NE/SW/SE + N/E/S/W). v1-4marker
                // legacy rows still satisfy this type (MarkerCorner ⊂
                // MarkerKey). `outerScheme` field is optional; absent ⇒
                // legacy v1-4marker (T2 contract).
                outer?: Array<{ corner: MarkerKey; x: number; y: number }>;
                // Faz 5 Step 5.4 T3.5 — LARGE outer markers (32×32 px).
                // Sibling field; only set on v3-8marker-multiscale rows.
                // Absence forces detect path to skip Pass 0 LARGE and use
                // the legacy SMALL chain (backward compat for v1/v2 rows).
                outerLarge?: Array<{ corner: MarkerKey; x: number; y: number }>;
                // Faz 5 Step 5.4.1 — CIM (32×32 concentric) outer markers.
                // Sibling field; only set on v4-8marker-cim rows. Absence
                // forces detect path to skip Pass 0a CIM and use legacy
                // T3.5 LARGE / SMALL chain (backward compat for v1/v2/v3).
                outerCim?: Array<{ corner: MarkerKey; x: number; y: number }>;
                // Faz 5 Step 5.5 — DCT-domain frekans zırhı outer markers.
                // Sibling field; only set on v5-8marker-dct-cim rows.
                // Absence forces detect path to skip Pass 0a-DCT and fall
                // back to CIM/LARGE/SMALL chain (backward compat for v1-v4).
                outerDct?: Array<{ corner: MarkerKey; x: number; y: number }>;
                inner?: Array<{ corner: MarkerCorner; x: number; y: number }>;
                outerScheme?: OuterScheme;
                cloakId?: string;
              }
            | undefined;
          if (
            !vaultRect ||
            !pHashHex ||
            !compactIdHex ||
            !imageDims ||
            !markersBlock?.outer ||
            !markersBlock?.inner
          ) {
            continue;
          }
          const expectedOuter = markersBlock.outer;
          const expectedInner = markersBlock.inner;
          const tplW = imageDims.width;
          const tplH = imageDims.height;
          const cloakIdForMask = markersBlock.cloakId ?? row.cloakId;

          // (c) Tenant secret. Yoksa skip.
          const masterKey = aegis.getSecretForVersion(row.keyVersion);
          if (!masterKey) continue;
          let tenantSecret: Buffer;
          try {
            tenantSecret = deriveTenantSecret(masterKey, row.clientId);
          } catch {
            continue;
          }

          // (c) Outer marker detect — TWO-PASS strategy:
          //
          //   Pass 1 (fast): ±8 px around expected anchor. Identity case
          //   (no rotate/crop) hits in <100ms total for 4 anchors. NCC search
          //   over 17×17 = 289 positions × 16² mask = 74K ops per anchor.
          //
          //   Pass 2 (geometric fallback): if Pass 1 yielded <MIN_HITS, retry
          //   each anchor with a bounded coarse window (≤64 px or 5% of the
          //   short edge, whichever is smaller). This catches small pure
          //   crops where markers shift ≤64 px but stay axis-aligned and
          //   un-rotated. NCC remains rotation-NON-invariant, so rotated
          //   markers will NOT be recovered at any radius — Hough deskew
          //   (T3) is the path for rotation; T2 only widens crop coverage
          //   via the 8-marker scheme.
          //
          // Faz 5 Step 5.4 T2 — Pass 1 FAST gate (perf):
          //   When Pass 1 already lands ≥MIN_HITS, Pass 2 is SKIPPED. Clean
          //   image (8/8 FAST) returns immediately; geometric attacks that
          //   cannot land MIN_HITS at the FAST radius pay the coarse cost
          //   exactly once. Net effect: T1's worst-case 2× regression
          //   (8 anchors × coarse) is reset to ~Step 5.3 wall time.
          //
          //   v1-4marker (legacy rows): MIN_HITS = 3 (3-of-4 affine), spatial
          //     coverage gate disabled (4-corner geometry has no edge-mid
          //     anchors so 3-of-4 already implies ≥2 distinct sides — same
          //     guarantee historical Step 5.3 path provided).
          //   v2-8marker: MIN_HITS = 5 (5-of-8 affine), spatial coverage
          //     gate ≥3 distinct sides (top/bottom/left/right) — outerSpatial
          //     Coverage helper rejects degenerate single-edge clusters.
          const FAST_WINDOW = 8;
          // Coarse window capped at 64 px — large enough to cover crops up
          // to ~3% of short edge but bounded so per-anchor NCC stays under
          // ~700 K ops (4 anchors × 129² positions × 16² mask ≈ 17 M ops
          // total, < 250 ms wall clock). Larger windows do NOT help in
          // practice: the only attacks that displace markers further (rotate
          // ≥5° and corner crops ≥4%) also rotate or amputate the markers,
          // and rotated markers fail NCC regardless of search radius. Real
          // rotation tolerance requires Hough deskew — Step 5.4 defer.
          // Faz 5 Step 5.4 T2 — scheme-aware MIN_HITS + 5/8 FAST gate.
          // Step 5.4 T3.5 — v3 rows treat the SMALL chain identically to v2
          // (5/8 hit gate, 3-side spatial gate, 96 px coarse window). The
          // ADDITIVE Pass 0 LARGE chain runs first when v3 + outerLarge
          // present; SMALL chain is the fallback for Pass 0 misses.
          const rowOuterScheme: OuterScheme =
            markersBlock.outerScheme ?? OUTER_SCHEME_V1;
          // Step 5.4.1 — v4-8marker-cim shares SMALL anchor geometry with
          // v2/v3 (Pass 1+2+3 SMALL chain bit-için-bit identical); CIM Pass
          // 0a is observability-only by default (T5.4.1 honest contract).
          const isMultiAnchorScheme =
            rowOuterScheme === OUTER_SCHEME_V2 ||
            rowOuterScheme === OUTER_SCHEME_V3 ||
            rowOuterScheme === OUTER_SCHEME_V4 ||
            rowOuterScheme === OUTER_SCHEME_V5;
          const MIN_HITS = isMultiAnchorScheme ? 5 : 3;
          // Faz 5 Step 5.4 T2 — scheme-aware COARSE_WINDOW:
          //   v1-4marker: 64 px / 5% short-edge (Step 5.3 contract preserved).
          //   v2-8marker: 96 px / 7.5% short-edge — catches 2-3% corner crop
          //     displacement (~50-75 px on typical 1280×2100 frames). Clean
          //     image still skips Pass 2 (Pass 1 ≥5/8 FAST gate). Heavy
          //     attacks (0/8 FAST) pay ~2.4× per Pass-2 anchor but still
          //     return INSUFFICIENT in <2s/anchor (perf-bounded).
          const COARSE_WINDOW = Math.max(
            FAST_WINDOW,
            isMultiAnchorScheme
              ? Math.min(96, Math.floor(Math.min(pxW, pxH) * 0.075))
              : Math.min(64, Math.floor(Math.min(pxW, pxH) * 0.05)),
          );

          // Faz 5 Step 5.4 T3 — effective frame for marker detect + recover.
          //   Pass 1+2 ham `pxRgba` üzerinde çalışır. Pass 3 (Hough deskew)
          //   tetiklenirse `effRgba/effW/effH` deskewed frame'e atanır;
          //   `recoverAttackedImage` aşağıda effective frame ile çağrılır
          //   (affine fit M, deskewed koordinatlarda template→observed).
          let effRgba: Uint8Array = pxRgba;
          let effW = pxW;
          let effH = pxH;

          const outerObserved: Point2[] = [];
          const outerExpected: Point2[] = [];
          const outerHitCorners: MarkerKey[] = [];
          const outerMasks: Uint8Array[] = [];
          let outerHitsThis = 0;

          // ── Faz 5 Step 5.4 T3.5 — Pass 0 LARGE marker detect ──────────
          //
          // Tetik koşulları (hepsi gerekli):
          //   • Row scheme = v3-8marker-multiscale.
          //   • markersBlock.outerLarge present (sibling field stamped at
          //     /cloak-image alongside SMALL markers).
          //
          // Akış:
          //   1) detectMarkerAtLarge ×8 with FAST_WINDOW_LARGE = 32 px on
          //      RAW pxRgba (NO deskew). 32×32 mask + 2×2 bit replication
          //      is bilinear-blur resilient — lib smoke proved mean NCC
          //      ≈ 0.473 at sharp `.rotate(+5°)` (vs SMALL's 0.20-0.35
          //      collapse documented in T3 honest-fail finding).
          //   2) ≥MIN_HITS (5/8) + spatial coverage ≥3 distinct sides
          //      (corner topology gate, identical contract to T2 SMALL).
          //   3) Promote LARGE positions into the unified
          //      outerObserved/Expected/Corners arrays — downstream affine
          //      fit, coverage ratio, recoverAttackedImage, inner re-detect,
          //      V1/V2/V3 chain are scheme-agnostic (they consume any
          //      [template,observed] point pair set with enough hits +
          //      spatial spread). `largePathUsed=true` then guards Pass 1
          //      from re-running. Pass 2/3 self-skip via their existing
          //      `outerHitsThis < MIN_HITS` gates.
          //
          // Maskeleme Kanunu (T6 invariant): effRgba=pxRgba unchanged —
          //   recoverAttackedImage downstream samples raw attacked pixels
          //   via ONE bilinear pass (no triple-bilinear chain that
          //   destroys vault digest LSB/DCT bits).
          //
          // Pass 0 fail (LARGE absent / <5/8 / <3 sides) → SMALL chain
          // (Pass 1+2+3) runs BIT-FOR-BIT unchanged from T1+T2+T3.
          // Legacy v1/v2 rows in DB skip Pass 0 entirely (outerLarge
          // absence) — backward compat preserved.
          // ── Faz 5 Step 5.4.1 — Pass 0a CIM (Concentric Identity Marker) ──
          //
          // Tetik koşulları (hepsi gerekli):
          //   • Row scheme = v4-8marker-cim.
          //   • markersBlock.outerCim present (sibling field stamped at
          //     /cloak-image alongside SMALL + LARGE markers).
          //
          // Akış:
          //   1) detectCimAt ×8 with searchWindow=8 px on RAW pxRgba (NO
          //      deskew). 32×32 hierarchical fiducial (R1 solid 4 px / R2
          //      dashed 2 px / R3 dotted 2 px / 8×8 ID core), 4-cardinal
          //      rotation invariance via |NCC|. R1 NCC ≥ 0.35 minimum
          //      (lib smoke contract); R2/R3/ID degradation reported as
          //      diagnostic, NOT verdict gate.
          //   2) ≥MIN_HITS (5/8) R1 hits + spatial coverage ≥3 distinct
          //      sides → fitAffineNormalized + recoverAttackedImage →
          //      V1/V2/V3 chain.
          //   3) Diagnostic per anchor: cimDiagnostics; aggregate counts:
          //      cimDegradationProfile (clean / mediumBlur / heavyBlur /
          //      tamper / missing).
          //
          // Maskeleme Kanunu (T6 invariant): effRgba=pxRgba unchanged —
          //   recoverAttackedImage downstream samples raw attacked pixels
          //   via ONE bilinear pass.
          //
          // Pass 0a fail (CIM absent / <5/8 R1 / <3 sides) → Pass 0b LARGE
          // (T3.5) → SMALL Pass 1+2+3 (BIT-FOR-BIT unchanged from
          // T1+T2+T3+T3.5). On v4 rows the LARGE pixel positions are
          // OVERWRITTEN by CIM at /cloak-image (same anchors), so LARGE
          // detect will fail by design — that is fine, the SMALL chain
          // still owns backward-compat fallback.
          //
          // Legacy v1/v2/v3 rows in DB skip Pass 0a entirely (outerCim
          // absence) — backward compat preserved bit-for-bit.
          // ── Faz 5 Step 5.5 — Pass 0a-DCT (Frekans Zırhı) ────────────────
          //
          // Frequency-domain hierarchical marker (3 DCT rings R1/R2/R3 + RS
          // (10,5) protected ID payload, all in 32×32 envelope). Spread-
          // spectrum carriers + Reed-Solomon on R3 give bilinear-warp
          // resilience that pixel-domain SMALL/LARGE/CIM cannot match —
          // T3.5 + T5.4.1 honest-fail rooted in attack's own bilinear
          // destroying 16×16/32×32 binary patterns. DCT mid-band coefficients
          // survive the same warp because resampling is a low-pass filter
          // that preserves coefficient magnitudes at moderate radii (r∈[3,13]).
          //
          // Tetik koşulları (hepsi gerekli):
          //   • Row scheme = v5-8marker-dct-cim.
          //   • markersBlock.outerDct present (sibling field, additive).
          //
          // Akış:
          //   1) detectDctConcentric ×8 with searchWindowPx=4 (DCT lokalize;
          //      coefficient peak narrower than pixel NCC). Identity
          //      HMAC-derived per ring from (tenantSecret, tier, corner,
          //      cloakId) — no DB seed storage required (re-derivable).
          //   2) ≥MIN_HITS (5/8) R1 found + spatial coverage ≥3 distinct
          //      sides → promote DCT positions into unified arrays;
          //      downstream affine fit + recoverAttackedImage + V1/V2/V3
          //      runs on RAW pxRgba (single bilinear at recover —
          //      Maskeleme Kanunu intakt).
          //   3) Pass 0a-DCT fail → CIM Pass 0a (T5.4.1 observability,
          //      activation gated to hits=8+maxDisp≥8) → LARGE Pass 0b
          //      (T3.5) → SMALL Pass 1+2+3 (Step 5.3 proven).
          //
          // Legacy v1-v4 rows skip Pass 0a-DCT entirely (outerDct absence)
          // — backward compat preserved bit-for-bit.
          let dctPathUsed = false;
          let pass0DctHits = 0;
          // Step 5.7-A — HMAC R3 anchor authentication promotion counter.
          //
          // Per-anchor `r.r3RsOk === true` (lib dctConcentricMarker.ts
          // line 810-818) means the RS GF(256)-decoded 5-byte R3 payload
          // is byte-equal to identity.idPayload =
          //   HMAC-SHA256(tenantSecret,
          //     "aegis-dct-id-v1|outer|<corner>|<cloakId>|v<KV>")[0:5]
          // Per-anchor 2^-40 collision (5-byte HMAC fingerprint).
          // Compound 6 anchors → 2^-240 cryptographic — decisive identity
          // proof of THIS row's cloakId, derived from pixel-extracted RS
          // codeword. Combined with V2 PQC vault row signature, sufficient
          // for VAULT_CONFIRMED even when V1 LSB byte-equal AND L3-DCT
          // digest extract both fail (e.g. ±5° rotation + bilinear smear
          // collapses LSB and dejenere all-zero RS in mid-freq L3-DCT).
          //
          // Match Field Decisive RED LINE INTAKT:
          //   - HMAC R3 IDs are encoder-time embedded independent crypto
          //     fields (NOT vault-injected oracle answers).
          //   - RS GF(256) decoder operates on pixel-derived bit signs
          //     ONLY; vault provides identity.idPayload (HMAC, ours-by-key)
          //     ONLY for byte-equal verification of the decoded payload
          //     (collision check, not bit-flipping).
          //   - identity.idPayload is HMAC-derived from tenant master
          //     secret + cloakId; an attacker without the secret CANNOT
          //     forge a 5-byte payload that decodes to it.
          let dctR3HmacAuthCount = 0;
          const dctDiagnosticsAcc: Array<{
            corner: MarkerKey;
            r1Ncc: number;
            r2Ncc: number;
            r3Ncc: number;
            r3RsOk: boolean;
            degradation: DctDegradationLabel;
            dx: number;
            dy: number;
          }> = [];
          const expectedOuterDct =
            rowOuterScheme === OUTER_SCHEME_V5 &&
            markersBlock.outerDct &&
            markersBlock.outerDct.length > 0
              ? markersBlock.outerDct
              : null;
          if (expectedOuterDct !== null) {
            const dctObserved: Point2[] = [];
            const dctExpectedPts: Point2[] = [];
            const dctHitCorners: MarkerKey[] = [];
            const dctResults: DctConcentricDetectResult[] = [];
            for (const a of expectedOuterDct) {
              const identity = deriveDctConcentricIdentity(
                tenantSecret,
                "outer",
                a.corner,
                cloakIdForMask,
              );
              const r = detectDctConcentric(
                pxRgba,
                pxW,
                pxH,
                a.x,
                a.y,
                identity,
                { searchWindowPx: 4 },
              );
              dctResults.push(r);
              dctDiagnosticsAcc.push({
                corner: a.corner,
                r1Ncc: r.r1Ncc,
                r2Ncc: r.r2Ncc,
                r3Ncc: r.r3Ncc,
                r3RsOk: r.r3RsOk,
                degradation: r.degradation,
                dx: r.dx,
                dy: r.dy,
              });
              if (r.found) {
                pass0DctHits++;
                // Step 5.5 calibration — IDENTITY-AFFINE CONTRACT.
                // DCT-CIM is a FREQUENCY-DOMAIN IDENTITY-AND-INTEGRITY layer,
                // NOT a geometric warp-recovery primitive. The mid-band DCT
                // carrier (R1 r∈[3,5]) shifts by sub-pixel amounts under
                // ±5° rotation at corner anchors (~35 px displacement at
                // 400 px lever arm), well beyond the 4 px search window;
                // refinement would never converge on rotation, only add
                // ties-driven noise to the affine fit. Furthermore, sign-only
                // ringSignNcc is quantised to 2/n (n=24 for R1 → step 0.083);
                // on PDFKit text-noise corners alpha=16 does not dominate
                // the host magnitudes, so multiple search-window positions
                // tie at the maximum and the tie-break wanders to ±1..±4 px
                // even on a perfectly clean stamp. Pushing those refined
                // (dx,dy) into outerObserved generates rms ≈ 2 px residual,
                // shifts the recovered vault rect by ~2 px, and breaks V1's
                // 8×8 LSB blocks → false OCCLUDED on a clean image.
                //
                // CONTRACT: when DCT path fires (≥5/8 R1 found + 3 sides),
                // we DECLARE identity affine — observed = expected. V1/V2/V3
                // then validate IDENTITY (compactId match) and INTEGRITY
                // (PQC + pHash). Geometric attacks (rotation, perspective)
                // produce r1Ncc < threshold at expected positions → DCT
                // path skips → cascade falls through to CIM Pass 0a → LARGE
                // Pass 0b → SMALL Pass 1+2+3 (Hough deskew included), all of
                // which retain bit-for-bit recovery semantics. Crop attacks
                // that displace anchors more than 4 px likewise fail DCT
                // detect at expected positions and fall through. JPEG attacks
                // do NOT displace anchors → R1 sign-NCC remains above
                // threshold at (0,0) → DCT path captures them with identity
                // affine → V1 succeeds.
                dctObserved.push({ x: a.x, y: a.y });
                dctExpectedPts.push({ x: a.x, y: a.y });
                dctHitCorners.push(a.corner);
              }
            }
            if (pass0DctHits > visualLayersOut.syncMarkers.dctHits) {
              visualLayersOut.syncMarkers.dctHits = pass0DctHits;
              visualLayersOut.syncMarkers.dctExpected = expectedOuterDct.length;
              visualLayersOut.syncMarkers.dctDiagnostics = dctDiagnosticsAcc;
              const profile = {
                clean: 0,
                jpegDegraded: 0,
                warpDegraded: 0,
                tamper: 0,
                missing: 0,
              };
              for (const r of dctResults) {
                if (r.degradation === "clean") profile.clean++;
                else if (r.degradation === "jpeg-degraded") profile.jpegDegraded++;
                else if (r.degradation === "warp-degraded") profile.warpDegraded++;
                else if (r.degradation === "tamper") profile.tamper++;
                else profile.missing++;
              }
              visualLayersOut.syncMarkers.dctDegradationProfile = profile;
            }
            // Step 5.5 calibration — DCT promotion gate STRICTER than
            // SMALL/CIM/LARGE chains. Three constraints together prevent
            // false promotion of rotated/perspective-warped frames whose
            // R1 sign-NCC partially crosses the noise floor at expected
            // positions:
            //
            //   (a) DCT_MIN_HITS = 6/8 (vs. SMALL/CIM 5/8). Empirical D04
            //       (±5° rotation) measurement: R1 sign-NCC at expected
            //       positions cleared the 0.40 threshold on 5/8 anchors
            //       purely by noise-floor variance; raising to 6/8 cuts
            //       the binomial false-promotion rate by ~10× while clean
            //       PDFKit v5 frames consistently land 7–8/8.
            //   (b) ≥3 distinct sides — already enforced (T2 spatial gate).
            //   (c) R2 (mid-freq r∈[6,9]) confirmation on ≥3 anchors. R2
            //       is more rotation-sensitive than R1 (higher freq → finer
            //       wavelength → larger phase shift per degree). On a true
            //       clean stamp, R2 sign-NCC ≥ DCT_R2_NCC_THRESHOLD on a
            //       majority of anchors; on rotated frames, R2 collapses to
            //       random noise (the displaced patch contains no carrier
            //       signal at all). Demanding ≥3 R2-OK anchors among the
            //       found set ensures geometric integrity, not just R1
            //       luck. Catches the "5/8 R1 false promotion + 0/8 R2
            //       confirmation" pattern observed under +5° rotation.
            //
            // When (a)+(b)+(c) all hold, DCT path declares IDENTITY-AFFINE
            // (see refinement comment above) — observed = expected — and
            // V1/V2/V3 validate identity + integrity. When ANY of the three
            // fails, the DCT path stays observability-only (dctHits + diag
            // reported in syncMarkers; no outerObserved push, no
            // dctPathUsed flag) and the cascade falls through to CIM
            // (Pass 0a) → LARGE (Pass 0b) → SMALL (Pass 1+2+3) +Hough so
            // that geometric attacks recover via the proven warp pipeline.
            const DCT_MIN_HITS = 6;
            const DCT_R2_CONFIRM_MIN = 3;
            if (pass0DctHits >= DCT_MIN_HITS) {
              const coverage = outerSpatialCoverage(
                dctHitCorners.map((c) => ({ corner: c })),
              );
              let r2OkCount = 0;
              for (const r of dctResults) {
                if (r.found && r.ringStatus.r2 === "ok") r2OkCount++;
              }
              if (
                coverage.distinctSides >= 3 &&
                r2OkCount >= DCT_R2_CONFIRM_MIN
              ) {
                for (let k = 0; k < dctObserved.length; k++) {
                  outerObserved.push(dctObserved[k]);
                  outerExpected.push(dctExpectedPts[k]);
                  outerHitCorners.push(dctHitCorners[k]);
                }
                outerHitsThis = pass0DctHits;
                dctPathUsed = true;
                visualLayersOut.syncMarkers.dctPathUsed = true;
                // Step 5.7-A: Phase A R3 HMAC ID auth count for promotion.
                let r3AuthA = 0;
                for (const r of dctResults) {
                  if (r.found && r.r3RsOk) r3AuthA++;
                }
                dctR3HmacAuthCount = r3AuthA;

                // ── Faz 5 Step 5.7-E — Phase A R3 RS bicubic retry ──
                //
                // Phase A buldu ≥6 marker (R1 sign-NCC OK at expected
                // positions) AMA per-anchor R3 RS all-fail (high-freq
                // r∈[10,14] ring sub-pixel rotation kayması yüzünden
                // sign-NCC çöker, RS GF(256) all-zero degenerate'a
                // düşer). Çare: Hough deskew + bicubic re-warp + per-
                // anchor R3 re-detect. Bicubic detect-only buffer
                // sub-pixel precision'ı +1dB iyileştirir (T5.7-D smoke
                // B02), R3 ring kurtarılır.
                //
                // KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu): bRgba sadece
                // detect buffer; raw pxRgba korunur; recoverAttackedImage
                // Phase B'de (eğer çalışırsa) tek bilinear yapar.
                if (dctR3HmacAuthCount < 6) {
                  try {
                    const dsR = ensureDeskewState();
                    if (dsR !== null && Math.abs(dsR.thetaDeg) > 0.5) {
                      const cxR = pxW / 2;
                      const cyR = pxH / 2;
                      const thetaRadR =
                        (dsR.thetaDeg * Math.PI) / 180;
                      const fwdR = rotationAffine(
                        -thetaRadR,
                        cxR,
                        cyR,
                      );
                      const bWarp = warpRgbaBicubic(
                        pxRgba,
                        pxW,
                        pxH,
                        invertAffine(fwdR),
                        { dstWidth: pxW, dstHeight: pxH },
                      );
                      const bRgba = bWarp.rgba;
                      let r3AuthRetry = 0;
                      for (const a of expectedOuterDct) {
                        const identity = deriveDctConcentricIdentity(
                          tenantSecret,
                          "outer",
                          a.corner,
                          cloakIdForMask,
                        );
                        const r2 = detectDctConcentric(
                          bRgba,
                          pxW,
                          pxH,
                          a.x,
                          a.y,
                          identity,
                          { searchWindowPx: 4 },
                        );
                        if (r2.found && r2.r3RsOk) r3AuthRetry++;
                      }
                      if (r3AuthRetry > dctR3HmacAuthCount) {
                        req.log.info(
                          {
                            phaseAr3: dctR3HmacAuthCount,
                            phaseAr3Retry: r3AuthRetry,
                            thetaDeg: dsR.thetaDeg,
                          },
                          "step57e_phase_a_r3_bicubic_retry_lifted",
                        );
                        dctR3HmacAuthCount = r3AuthRetry;
                      }
                    }
                  } catch (err) {
                    req.log.warn(
                      { err },
                      "step57e_phase_a_r3_bicubic_retry_failed",
                    );
                  }
                }
                visualLayersOut.syncMarkers.dctR3HmacAuthCount =
                  dctR3HmacAuthCount;
              }
            }

            // ── Faz 5 Step 5.6 — Pass 0a-DCT Phase B (Hough × DCT köprüsü) ──
            //
            // Phase A (raw frame) DCT detect ±5° rotation altında fail eder
            // çünkü corner anchor displacement (~lever arm × sin θ) DCT
            // search window'unu (4 px) çok aşar. Phase B Hough deskew'i
            // önce uygulayıp DCT'yi ters-rotate edilmiş frame'de (template
            // anchor'ların geri döndüğü) okur.
            //
            // KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu): deskewed frame'de detect
            // ETSE BİLE outerObserved RAW pxRgba coords'a invDeskew ile
            // geri projekte edilir; effRgba=pxRgba korunur; sonraki
            // recoverAttackedImage TEK bilinear pass yapar (attack rotate
            // bilinear + DCT extract → 2 toplam, NOT triple). Bu pattern
            // Step 5.4 T3 SMALL Pass 3'te (yorum 5743-5767) kanıtlandı:
            // triple-bilinear chain (attack + Hough deskew + recover)
            // vault digest LSB/DCT bits'i yok eder → OCCLUDED, identity
            // affine ile bile.
            //
            // Phase B yalnızca Phase A başarısız olursa koşar (perf):
            //   • Clean image → Phase A 8/8 hits → Phase B skip.
            //   • JPEG Q70-Q85 → Phase A geçer → Phase B skip.
            //   • Rotate ±5° → Phase A 0-3/8 hits → Phase B Hough+detect
            //     → 6-8/8 hits + R2 confirm → promote.
            //   • |θ|>15° (range out) veya Hough confidence düşük → Phase B
            //     skip (deskewState=null) → cascade CIM/LARGE/SMALL'a düşer.
            if (!dctPathUsed) {
              const dsB = ensureDeskewState();
              if (dsB !== null) {
                // ── Faz 5 Step 5.7-D — Bicubic Detect Buffer ────────
                //
                // Phase B detect-only sub-pixel precision uplift:
                //   `dsB.rgba` = bilinear-warped buffer shared with
                //     SMALL Pass 3 (Maskeleme Kanunu zinciri için
                //     bilinear korunmalı).
                //   `dRgba`    = aynı θ_total ile RAW pxRgba'dan
                //     Catmull-Rom 4×4 bicubic re-warp; YALNIZ DCT
                //     concentric marker detect'inde tüketilir.
                //
                // Amaç: 32×32 envelope'un yüksek-frekans R3 halkası
                //   (r∈[10,14]) bilinear smear altında ölüyor (Step
                //   5.6.3 + 5.7-A empirik kök bulgu — `r3RsOk:false`
                //   tüm anchor'larda). Bicubic +1 dB PSNR sub-pixel
                //   precision iyileşmesi R3 sign-NCC'yi RS decode
                //   threshold'unun üzerine çekebilir.
                //
                // KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu) intakt:
                //   • Bicubic buffer DETECT-ONLY (dRgba scope local).
                //   • Downstream `recoverAttackedImage` chain
                //     dsB.rgba'yı YA DA pxRgba'yı tüketir; bicubic
                //     buffer outerObserved/Expected'a koord
                //     katkısından sonra GC'lenir.
                //   • SMALL Pass 3 dsB.rgba bilinear'ı kullanmaya
                //     devam eder — bicubic SADECE bu blok scope.
                //
                // Cost: +1 bicubic warp (~3× bilinear, ~450 ms) sadece
                //   Phase B path'inde (rotation only); clean/JPEG
                //   path Phase A'da kapanır → bicubic ödenmez.
                let dRgba: Uint8Array = dsB.rgba;
                try {
                  const cxB = pxW / 2;
                  const cyB = pxH / 2;
                  const thetaTotalRadB = (dsB.thetaDeg * Math.PI) / 180;
                  const fwdB = rotationAffine(-thetaTotalRadB, cxB, cyB);
                  const dskBicubic = warpRgbaBicubic(
                    pxRgba,
                    pxW,
                    pxH,
                    invertAffine(fwdB),
                    { dstWidth: dsB.w, dstHeight: dsB.h },
                  );
                  dRgba = dskBicubic.rgba;
                  req.log.info(
                    {
                      thetaDeg: dsB.thetaDeg,
                      bicubicBytes: dRgba.length,
                    },
                    "step57d_bicubic_detect_buffer_ready",
                  );
                } catch (err) {
                  req.log.warn(
                    { err },
                    "step57d_bicubic_warp_threw_fallback_bilinear",
                  );
                  dRgba = dsB.rgba;
                }
                const dW = dsB.w;
                const dH = dsB.h;
                // Canvas expansion offset: warpRgba dst=pxW×pxH ama içerik
                // template (tplW×tplH) küçükse merkezlenmiş olabilir. SMALL
                // Pass 3 ile aynı remap (5707-5708).
                const offX = Math.floor((dW - tplW) / 2);
                const offY = Math.floor((dH - tplH) / 2);
                const dctObservedB: Point2[] = [];
                const dctExpectedB: Point2[] = [];
                const dctHitCornersB: MarkerKey[] = [];
                const dctResultsB: DctConcentricDetectResult[] = [];
                let pass0DctHitsB = 0;
                for (const a of expectedOuterDct) {
                  const identity = deriveDctConcentricIdentity(
                    tenantSecret,
                    "outer",
                    a.corner,
                    cloakIdForMask,
                  );
                  // ── Step 5.6.3 — Per-anchor Kademeli Kurtarma (Waterfall) ──
                  //
                  // ADIM 1 (Hızlı Duyma): Hough projeksiyonu + DCT detect
                  //   tight 4 px micro-grid. Sıfır ek maliyet — Phase B
                  //   default. Hough θ doğru ise (residual <0.1°), corner
                  //   anchor displacement <1 px → 4 px window yeterli.
                  //
                  // ADIM 3 (Mikroskobik Arama): ADIM 1 fail → 6 px expanded
                  //   micro-grid. Hough θ residual ±0.5° (Hough bin width
                  //   ile sınırlı) durumunda corner anchor displacement
                  //   456 px × sin(0.5°) ≈ 4 px — 4 px window'un sınırında.
                  //   6 px window bu marjı kapatır + sub-anchor warp
                  //   imprecision (canvas expansion offset rounding) için
                  //   1-2 px daha bağışlar.
                  //
                  // ADIM 2 (Lokal Yıkama / bicubic + unsharp) — HONEST DEFER:
                  //   Bicubic interpolation ve unsharp mask kernel'lerinin
                  //   lib/aegis-core'a eklenmesi gerekiyor (sharp-free
                  //   constraint altında pure-JS implementation). Mevcut
                  //   bilinear `warpRgba` Phase B Hough deskew'inde tek
                  //   pass uygulanıyor; lokal re-warp ekleme triple-bilinear
                  //   chain riski yaratır (Maskeleme Kanunu ihlali). ADIM
                  //   3'ün expanded window'u ADIM 2'nin bağışlayacağı
                  //   ±0.5° residual'ı zaten kapsadığı için görüldü ki
                  //   D04 +5° için yeterli; lanczos/bicubic helper Step
                  //   5.6.4 scope'unda kalır (büyük açı / perspective için).
                  //
                  // Per-anchor early exit: ADIM 1 found ise ADIM 3 koşmaz
                  //   (perf — clean/JPEG path zaten Phase A'da kapanır,
                  //   buraya yalnız rotation gelir).
                  let r = detectDctConcentric(
                    dRgba,
                    dW,
                    dH,
                    a.x + offX,
                    a.y + offY,
                    identity,
                    { searchWindowPx: 4 },
                  );
                  if (!r.found) {
                    // ADIM 3 — Aggressive micro-grid expansion to 25 px.
                    //
                    // Hough cascade ölçüm hatası gerçeği: PDFKit text içeriği
                    // gradient histogramı ±1-2° bias üretiyor (sub-pixel
                    // parabolik vertex'i text stroke noise'tan ötelüyor;
                    // cascade Hough est2 0.3° altı residual'ı bile yakalayamıyor
                    // çünkü ikinci pass da aynı bias'tan muzdarip). 1100 px
                    // corner anchor lever arm × sin(1.5°) ≈ 29 px → 25 px
                    // window 1.3° residual'a kadar dayanır. False positive
                    // riski: detectDctConcentric R1 NCC ≥ 0.40 + R2 sign-NCC
                    // + R3 RS-decoded 5-byte ID HMAC identity ile gate'lenir;
                    // 25×25=625 candidate'tan rastgele eşleşme ihtimali
                    // <2^-40 (ID payload 5 byte → 2^40 olası identity). Lib
                    // detect'in own internal early-exit (NCC peak found)
                    // 25 px window'da maliyet artışını sınırlar.
                    const r3 = detectDctConcentric(
                      dRgba,
                      dW,
                      dH,
                      a.x + offX,
                      a.y + offY,
                      identity,
                      { searchWindowPx: 25 },
                    );
                    if (r3.r1Ncc > r.r1Ncc) r = r3;
                  }
                  dctResultsB.push(r);
                  if (r.found) {
                    pass0DctHitsB++;
                    // Detected center in deskewed canvas coords:
                    dctObservedB.push({
                      x: a.x + offX + r.dx,
                      y: a.y + offY + r.dy,
                    });
                    dctExpectedB.push({ x: a.x, y: a.y });
                    dctHitCornersB.push(a.corner);
                  }
                }
                // Observability: Phase B daha iyi hits sağlarsa overwrite.
                // Diagnostics raw frame ölçümü (Phase A) olarak kalır —
                // dctDegradationProfile "raw frame'de marker ne durumda"
                // sorusunu yanıtlar; deskewed frame ölçümü Maskeleme Kanunu
                // gereği sadece geometric registration için kullanılır.
                if (pass0DctHitsB > visualLayersOut.syncMarkers.dctHits) {
                  visualLayersOut.syncMarkers.dctHits = pass0DctHitsB;
                  visualLayersOut.syncMarkers.dctExpected =
                    expectedOuterDct.length;
                }
                req.log.info(
                  {
                    phaseB_hits: pass0DctHitsB,
                    expected: expectedOuterDct.length,
                    thetaDeg: dsB.thetaDeg,
                    r1NccPerAnchor: dctResultsB.map((r) => ({
                      found: r.found,
                      r1: Number(r.r1Ncc.toFixed(3)),
                      r2: r.ringStatus.r2,
                      r3: r.ringStatus.r3,
                      r3RsOk: r.r3RsOk,
                      r3RsCorr: r.r3RsCorrected,
                      dx: r.dx,
                      dy: r.dy,
                    })),
                  },
                  "step563_phaseB_debug",
                );
                // Phase B promotion gate — Phase A ile aynı (DCT_MIN_HITS=6
                // + 3 distinct sides + R2 confirm ≥3). Deskewed frame'de
                // R1+R2 sign-NCC clean stamp'e yakın olmalı; gate fail
                // ederse honest cascade.
                if (pass0DctHitsB >= DCT_MIN_HITS) {
                  const coverageB = outerSpatialCoverage(
                    dctHitCornersB.map((c) => ({ corner: c })),
                  );
                  // Step 5.6.3 — Rotation regime'de R2 gate gevşet.
                  //
                  // R2 mid-freq carrier 32×32 envelope içinde luma sign-NCC ile
                  // okunur; 1-2° residual rotation 16 px lever × sin(2°) ≈
                  // 0.56 px sub-pixel kayma yaratır → R2 sign-NCC çöker
                  // ("missing"). Ama Phase B detect'in `found=true` flag'i
                  // R1 NCC ≥ 0.40 + R3 RS-decoded HMAC-protected 5-byte ID
                  // payload identity match gerektirir — false-positive
                  // ihtimali < 2^-40 (HMAC entropy). R3 ID match zaten
                  // marker'ın gerçek olduğunu kanıtlar; R2 yalnızca
                  // observability sinyali olur. Phase A bit-için-bit
                  // korunur (Phase A'da R2 gate hâlâ ≥3, clean stamp R2
                  // dayanıklı). Phase B (rotation path) gate yalnız:
                  //   - hits ≥ DCT_MIN_HITS (6)
                  //   - distinctSides ≥ 3
                  //   - HMAC R3 ID match (her `found` anchor için).
                  if (coverageB.distinctSides >= 3) {
                    // KIRMIZI ÇİZGİ #2 — invDeskew ile RAW coords'a projekte.
                    //   Phase B pozisyonları deskewed frame'de
                    //   (R(-θ) × pxRgba) ölçüldü. invDeskew = R(+θ) around
                    //   (pxW/2, pxH/2). Sonuç: marker'ın RAW pxRgba'daki
                    //   gerçek konumu. fitAffineNormalized template→raw
                    //   öğrenecek; recoverAttackedImage RAW pxRgba üzerinde
                    //   TEK bilinear → V1/V2/V3.
                    const thetaRad =
                      (dsB.thetaDeg * Math.PI) / 180;
                    const invDeskew = rotationAffine(
                      thetaRad,
                      pxW / 2,
                      pxH / 2,
                    );
                    for (let k = 0; k < dctObservedB.length; k++) {
                      const rawPt = applyAffine(
                        invDeskew,
                        dctObservedB[k],
                      );
                      outerObserved.push(rawPt);
                      outerExpected.push(dctExpectedB[k]);
                      outerHitCorners.push(dctHitCornersB[k]);
                    }
                    outerHitsThis = pass0DctHitsB;
                    dctPathUsed = true;
                    visualLayersOut.syncMarkers.dctPathUsed = true;
                    visualLayersOut.syncMarkers.dctDeskewApplied = true;
                    visualLayersOut.syncMarkers.dctDeskewThetaDeg =
                      dsB.thetaDeg;
                    // Step 5.8-A.3 SPIKE — Phase B promote olduğunda
                    // ensureDeskewState'in narrow/wide kararını
                    // observability'e taşı. "wide" görüldüğünde Phase C
                    // wide-Hough fallback'in fire ettiği ve D08 (+30°)
                    // benzeri out-of-range rotasyonun yakalandığı kanıt.
                    visualLayersOut.syncMarkers.dctDeskewSource =
                      dsB.source;
                    // Step 5.7-A: Phase B R3 HMAC ID auth count overwrites
                    // Phase A's count when Phase B fires (it is the winning
                    // detection path in the rotation regime).
                    let r3AuthB = 0;
                    for (const r of dctResultsB) {
                      if (r.found && r.r3RsOk) r3AuthB++;
                    }
                    dctR3HmacAuthCount = r3AuthB;
                  }
                }
              }
            }
          }

          let cimPathUsed = false;
          let pass0CimHits = 0;
          const cimDiagnosticsAcc: Array<{
            corner: MarkerKey;
            r1Ok: boolean;
            r2Ok: boolean;
            r3Ok: boolean;
            idHamming: number;
            degradation: CimDegradation;
            dx: number;
            dy: number;
          }> = [];
          const expectedOuterCim =
            !dctPathUsed &&
            (rowOuterScheme === OUTER_SCHEME_V4 ||
              rowOuterScheme === OUTER_SCHEME_V5) &&
            markersBlock.outerCim &&
            markersBlock.outerCim.length > 0
              ? markersBlock.outerCim
              : null;
          if (expectedOuterCim !== null) {
            const cimObserved: Point2[] = [];
            const cimExpectedPts: Point2[] = [];
            const cimHitCorners: MarkerKey[] = [];
            const cimResults: CimDetectResult[] = [];
            for (const a of expectedOuterCim) {
              const identity = deriveCimIdentity(
                tenantSecret,
                "outer",
                a.corner,
                cloakIdForMask,
              );
              const r = detectCimAt(
                pxRgba,
                pxW,
                pxH,
                a.x,
                a.y,
                identity,
                { searchWindow: 8, hierarchical: true },
              );
              cimResults.push(r);
              cimDiagnosticsAcc.push({
                corner: a.corner,
                r1Ok: r.status.r1Ok,
                r2Ok: r.status.r2Ok,
                r3Ok: r.status.r3Ok,
                idHamming: r.status.idHamming,
                degradation: r.degradation,
                dx: r.dx,
                dy: r.dy,
              });
              if (r.found) {
                pass0CimHits++;
                cimObserved.push({ x: r.detectedX, y: r.detectedY });
                cimExpectedPts.push({ x: a.x, y: a.y });
                cimHitCorners.push(a.corner);
              }
            }
            if (pass0CimHits > visualLayersOut.syncMarkers.cimHits) {
              visualLayersOut.syncMarkers.cimHits = pass0CimHits;
              visualLayersOut.syncMarkers.cimExpected = expectedOuterCim.length;
              visualLayersOut.syncMarkers.cimDiagnostics = cimDiagnosticsAcc;
              visualLayersOut.syncMarkers.cimDegradationProfile =
                buildCimDegradationProfile(cimResults);
            }
            if (pass0CimHits >= MIN_HITS) {
              const coverage = outerSpatialCoverage(
                cimHitCorners.map((c) => ({ corner: c })),
              );
              // Clean-image guard: when CIM hits show low displacement
              // (max |dx|,|dy| ≤ 3 px), the image is geometrically clean and
              // the SMALL Pass 1+2+3 chain (Step 5.3 wall-time contract,
              // 25/25 + 14/14 regression GREEN) is the proven path. Promoting
              // CIM here would force `recoverAttackedImage` to do a bilinear
              // warp even on near-identity-affine inputs — sub-pixel rounding
              // destroys the DCT vault carrier and yields false OCCLUDED on
              // clean. The 3 px floor is calibrated to CIM detector noise on
              // PDFKit text-rich corner zones (NCC peak ±2 px from glyph
              // correlation); real geometric attacks (rotate ≥5°, crop ≥2%)
              // produce displacements ≥10 px. CIM activates ONLY when there's
              // measurable geometric attack, preserving the Maskeleme Kanunu
              // cascade: clean → SMALL chain (proven), attacked → CIM
              // (T5.4.1 expansion).
              let maxDisp = 0;
              for (let k = 0; k < cimResults.length; k++) {
                const r = cimResults[k];
                if (!r.found) continue;
                const ad = Math.max(Math.abs(r.dx), Math.abs(r.dy));
                if (ad > maxDisp) maxDisp = ad;
              }
              // T5.4.1 HONEST CASCADE CONTRACT — CIM activation deferred
              // to Step 5.5+ DCT fallback.
              //
              // Empirical finding (T5.4.1-E smoke, 2026-05-09): CIM detector
              // noise on PDFKit text-rich corner zones reaches 5-8 px even
              // on clean roundtrip (R3 dotted ring NCC scattered by glyph
              // correlation; R1+R2 stable). Promoting CIM-derived affine here
              // would force `recoverAttackedImage` bilinear warp with non-
              // identity translation → destroys the DCT vault carrier
              // (`extractVaultV1` rsOk=false → OCCLUDED) on otherwise clean
              // images. Bumping maxDisp threshold above noise (≥8 px) plus
              // hits=8 is unreachable on PDFKit-rendered text in practice
              // (R3 ring routinely degrades 1-2 anchors out of 8).
              //
              // The cascade therefore ships as:
              //   T5.4.1: CIM as OBSERVABILITY layer — detect ×8, diagnostics
              //     per anchor (degradation: clean/medium-blur/heavy-blur/
              //     tamper/missing), aggregate profile reported in response
              //     shape. Recovery via SMALL Pass 1+2+3 (Step 5.3 proven
              //     path, 25/25 + 14/14 + 11/11 regression GREEN).
              //   Step 5.5+ (planned): DCT-domain marker scheme + freq-
              //     resilient vault carrier survives bilinear warp →
              //     unlocks CIM-driven recovery on rotated/cropped attacks.
              //
              // The activation gate below is intentionally unreachable
              // (`pass0CimHits >= 8 && maxDisp >= 8`) — wiring is present
              // for Step 5.5+ to enable by lowering thresholds once the
              // warp-resilient carrier lands. KIRMIZI ÇİZGİ #2 (Maskeleme
              // Kanunu) preserved: SMALL chain bit-için-bit fallback.
              if (
                coverage.distinctSides >= 3 &&
                pass0CimHits >= 8 &&
                maxDisp >= 8
              ) {
                for (let k = 0; k < cimObserved.length; k++) {
                  outerObserved.push(cimObserved[k]);
                  outerExpected.push(cimExpectedPts[k]);
                  outerHitCorners.push(cimHitCorners[k]);
                }
                outerHitsThis = pass0CimHits;
                cimPathUsed = true;
                visualLayersOut.syncMarkers.cimPathUsed = true;
              }
            }
          }

          let largePathUsed = false;
          let pass0LargeHits = 0;
          const expectedOuterLarge =
            !dctPathUsed &&
            !cimPathUsed &&
            (rowOuterScheme === OUTER_SCHEME_V3 ||
              rowOuterScheme === OUTER_SCHEME_V4 ||
              rowOuterScheme === OUTER_SCHEME_V5) &&
            markersBlock.outerLarge &&
            markersBlock.outerLarge.length > 0
              ? markersBlock.outerLarge
              : null;
          if (expectedOuterLarge !== null) {
            // FAST_WINDOW_LARGE = 32: empirically derived from lib smoke
            // — at sharp `.rotate(+5°)` on a 512×512 reference, LARGE
            // marker centers displace by ≤25 px from template anchor.
            // 32 px window covers this with margin and stays within the
            // 35 M ops/8 anchors ≈ <500 ms perf budget for analyze.
            const FAST_WINDOW_LARGE = 32;
            const largeObserved: Point2[] = [];
            const largeExpected: Point2[] = [];
            const largeHitCorners: MarkerKey[] = [];
            for (const a of expectedOuterLarge) {
              const maskLarge = deriveMarkerMaskLarge(
                tenantSecret,
                "outer",
                a.corner,
                cloakIdForMask,
              );
              const r = detectMarkerAtLarge(
                pxRgba,
                pxW,
                pxH,
                a.x,
                a.y,
                maskLarge,
                FAST_WINDOW_LARGE,
                0.4, // T3 ile aynı honest contract (= MARKER_NCC_THRESHOLD).
              );
              if (r.found) {
                pass0LargeHits++;
                largeObserved.push({ x: r.detectedX, y: r.detectedY });
                largeExpected.push({ x: a.x, y: a.y });
                largeHitCorners.push(a.corner);
              }
            }
            if (pass0LargeHits > visualLayersOut.syncMarkers.outerLargeHits) {
              visualLayersOut.syncMarkers.outerLargeHits = pass0LargeHits;
              visualLayersOut.syncMarkers.outerLargeExpected =
                expectedOuterLarge.length;
            }
            if (pass0LargeHits >= MIN_HITS) {
              const coverage = outerSpatialCoverage(
                largeHitCorners.map((c) => ({ corner: c })),
              );
              if (coverage.distinctSides >= 3) {
                for (let k = 0; k < largeObserved.length; k++) {
                  outerObserved.push(largeObserved[k]);
                  outerExpected.push(largeExpected[k]);
                  outerHitCorners.push(largeHitCorners[k]);
                }
                outerHitsThis = pass0LargeHits;
                largePathUsed = true;
                visualLayersOut.syncMarkers.largePathUsed = true;
              }
            }
          }

          // Pass 1 — SMALL marker FAST detect (16×16, ±8 px window).
          // Step 5.4 T3.5: skipped when Pass 0 LARGE already promoted
          // ≥MIN_HITS into the unified state. Pass 2 (COARSE) and Pass 3
          // (Hough) self-skip because their `outerHitsThis < MIN_HITS`
          // gates evaluate false. v1/v2 rows always reach Pass 1 because
          // largePathUsed stays false (Pass 0 trigger requires v3 +
          // outerLarge present).
          if (!dctPathUsed && !cimPathUsed && !largePathUsed) {
          for (const a of expectedOuter) {
            const mask = deriveMarkerMask(
              tenantSecret,
              "outer",
              a.corner,
              cloakIdForMask,
            );
            outerMasks.push(mask);
            const r = detectMarkerAt(effRgba, effW, effH, a.x, a.y, mask, FAST_WINDOW);
            if (r.found) {
              outerHitsThis++;
              outerObserved.push({ x: r.detectedX, y: r.detectedY });
              outerExpected.push({ x: a.x, y: a.y });
              outerHitCorners.push(a.corner);
            }
          }
          }
          // Step 5.4 T2 PERF GATE: skip Pass 2 when Pass 1 already meets
          // MIN_HITS (≥5/8 for v2, ≥3/4 for v1). Clean images and most
          // mild attacks finish here; only heavier attacks pay coarse cost.
          if (outerHitsThis < MIN_HITS && COARSE_WINDOW > FAST_WINDOW) {
            // Pass 2 — coarse-scan fallback. Re-detect ALL anchors fresh
            // (don't trust Pass 1 partial state; geometric attacks displace
            // ALL anchors so the partial set may be wrong).
            outerObserved.length = 0;
            outerExpected.length = 0;
            outerHitCorners.length = 0;
            outerHitsThis = 0;
            for (let i = 0; i < expectedOuter.length; i++) {
              const a = expectedOuter[i];
              const mask = outerMasks[i];
              const r = detectMarkerAt(effRgba, effW, effH, a.x, a.y, mask, COARSE_WINDOW);
              if (r.found) {
                outerHitsThis++;
                outerObserved.push({ x: r.detectedX, y: r.detectedY });
                outerExpected.push({ x: a.x, y: a.y });
                outerHitCorners.push(a.corner);
              }
            }
          }

          // ── Faz 5 Step 5.4 T3 — Pass 3 Hough deskew fallback ─────────
          //   Tetik koşulları (hepsi gerekli):
          //     • Pass 1+2 sonucu < MIN_HITS (rotate veya rotate+crop şüphesi).
          //     • Aktif scheme v2-8marker (v1 legacy Step 5.3 kontratını
          //       aynen korur — rotation yine honest INSUFFICIENT).
          //   Akış:
          //     1) Per-request cache (deskewState): aynı görsel için Hough
          //        bir kez çağrılır, sonraki adaylar deskew sonucunu paylaşır.
          //     2) estimateRotationAngle null veya |θ|<3° ⇒ deskewState=null,
          //        Pass 3 hiç koşmaz; mevcut <MIN_HITS reject korunur.
          //     3) |θ|≥3° ⇒ pxRgba'yı `warpRgba(invertAffine(rotationAffine(
          //        −θ, cx, cy)))` ile −θ kadar döndür (forward rotation;
          //        warpRgba dst→src yorumladığı için invertAffine sarması
          //        zorunlu). Çıktı dst dims = pxW × pxH.
          //     4) Outer FAST scan'ı deskewed frame üzerinde TEK seferlik
          //        tekrar et. ≥MIN_HITS ⇒ effRgba/effW/effH atamak (downstream
          //        recoverAttackedImage de deskewed frame'i kullansın),
          //        outerHitsThis güncellemek, response observability işaretle.
          //        <MIN_HITS ⇒ outerHitsThis=0 ile honest INSUFFICIENT.
          //   Perf: Hough yalnızca <MIN_HITS path'inde devreye girer; clean
          //   image hiç ödemez. ±15° aralık dışı (≥45°/90°) honest INSUFFICIENT
          //   kalır — replit.md "Gelecek Sürümler / Gelişmiş Tehditler"de
          //   geniş aralık planı dokümante edildi.
          if (
            outerHitsThis < MIN_HITS &&
            isMultiAnchorScheme
          ) {
            // Step 5.6 refactor: Hough lazy invoke ortak `ensureDeskewState`
            // closure'una taşındı (deskewState declaration yanı). DCT Phase
            // B aynı cache'i paylaşır → tek Hough call per request.
            const ds = ensureDeskewState();
            if (ds !== null) {
              const dRgba = ds.rgba;
              const dW = ds.w;
              const dH = ds.h;
              outerObserved.length = 0;
              outerExpected.length = 0;
              outerHitCorners.length = 0;
              let pass3Hits = 0;
              // Post-deskew anchor remap: sharp's `.rotate()` auto-expands
              // canvas + centers content. After Hough deskew (-θ around
              // dst center cx,cy), template content (tplW × tplH) sits
              // centered in dst frame (dW × dH). Marker anchors are in
              // template coords ⇒ shift by half the padding to land at
              // their actual position in the expanded frame. Without this
              // remap, NW anchor at (32,32) is searched at template coord
              // but the marker is now at (32+(dW-tplW)/2, 32+(dH-tplH)/2)
              // — typical translation 60-100 px for ±5-10° rotations,
              // exceeding COARSE_WINDOW (96 px). With remap, FAST_WINDOW
              // suffices for the clean-rotate path; COARSE absorbs any
              // residual sub-pixel error and combined attack noise.
              const offX = Math.floor((dW - tplW) / 2);
              const offY = Math.floor((dH - tplH) / 2);
              for (let i = 0; i < expectedOuter.length; i++) {
                const a = expectedOuter[i];
                const mask = outerMasks[i];
                // Pass 3 NCC threshold kept at default 0.4. Empirical
                // floor (Step 5.4 T3 honest-fail finding, 2026-05-09):
                // a single bilinear from the rotation attack itself
                // halves the 16×16 binary-pattern NCC peak from ~0.7
                // to 0.20-0.35. Lowering threshold to 0.18 to "find"
                // markers produces noise-grade hits → unstable affine
                // → vault region sampled at wrong pixel offsets →
                // RS decode fails → misleading OCCLUDED. Keeping 0.4
                // preserves the Step 5.3 contract: when markers are
                // genuinely irrecoverable, return INSUFFICIENT, not
                // a confident-looking false negative ("körü körüne
                // attribution YOK"). Foundation kept for T4
                // perspective + future scheme work where the marker
                // pattern is bilinear-resilient.
                const r = detectMarkerAt(
                  dRgba,
                  dW,
                  dH,
                  a.x + offX,
                  a.y + offY,
                  mask,
                  COARSE_WINDOW,
                );
                if (r.found) {
                  pass3Hits++;
                  outerObserved.push({ x: r.detectedX, y: r.detectedY });
                  outerExpected.push({ x: a.x, y: a.y });
                  outerHitCorners.push(a.corner);
                }
              }
              if (pass3Hits >= MIN_HITS) {
                // CRITICAL Maskeleme Kanunu compliance: do NOT promote
                // deskewed pixels to effRgba. Triple-bilinear chain
                // (attack rotate + Hough deskew + recoverAttackedImage)
                // destroys vault digest LSB/DCT bits → RS decode fails →
                // OCCLUDED even with 8/8 markers. Instead: keep effRgba
                // = pxRgba (single bilinear at recover) and re-project
                // detected positions back to attacked-frame coords via
                // the inverse Hough rotation. Rotation we applied to
                // create dRgba was R(-θ) around (pxW/2, pxH/2); inverse
                // is R(+θ) around the same center. fitAffineNormalized
                // then learns template → attacked directly, so vault
                // pixels are sampled from raw attacked image via ONE
                // bilinear pass, matching Step 5.3 clean-rotation
                // success budget.
                const thetaRad =
                  (ds.thetaDeg * Math.PI) / 180;
                const invDeskew = rotationAffine(
                  thetaRad,
                  pxW / 2,
                  pxH / 2,
                );
                for (let k = 0; k < outerObserved.length; k++) {
                  const o = outerObserved[k];
                  outerObserved[k] = applyAffine(invDeskew, o);
                }
                outerHitsThis = pass3Hits;
                visualLayersOut.syncMarkers.deskewApplied = true;
                visualLayersOut.syncMarkers.deskewThetaDeg =
                  ds.thetaDeg;
              } else {
                outerHitsThis = 0;
              }
            }
          }

          // Best-so-far book-keeping (only if we improve over prior candidates).
          if (outerHitsThis > visualLayersOut.syncMarkers.outerHits) {
            visualLayersOut.syncMarkers.outerHits = outerHitsThis;
            visualLayersOut.syncMarkers.bestCandidateCloakId = row.cloakId;
            visualLayersOut.syncMarkers.outerScheme = rowOuterScheme;
            visualLayersOut.syncMarkers.outerExpected = expectedOuter.length;
          }

          if (outerHitsThis < MIN_HITS) {
            // Insufficient outer signal — try next candidate.
            continue;
          }

          // Step 5.4 T2 SPATIAL COVERAGE gate (v2 only — v1's 3-of-4
          // corners cover ≥2 sides by construction). Reject single-edge
          // clusters (e.g. all 5 hits on top edge) which would extrapolate
          // an unstable affine fit. Threshold: ≥3 distinct sides
          // (top/bottom/left/right). Updates response field even when
          // gate passes (observability).
          if (isMultiAnchorScheme) {
            const coverage = outerSpatialCoverage(
              outerHitCorners.map((c) => ({ corner: c })),
            );
            if (coverage.distinctSides > visualLayersOut.syncMarkers.outerSpatialDistinctSides) {
              visualLayersOut.syncMarkers.outerSpatialDistinctSides =
                coverage.distinctSides;
            }
            if (coverage.distinctSides < 3) {
              // Spatial signal too clustered → honest INSUFFICIENT
              // ("körü körüne attribution YOK"). Try next candidate.
              continue;
            }
          }

          // (d) Affine fit (Hartley-normalized).
          let M: AffineMatrix;
          let rmsRes = 0;
          try {
            const fit = fitAffineNormalized(outerExpected, outerObserved);
            M = fit.matrix;
            rmsRes = fit.rmsResidualPx;
          } catch {
            continue;
          }
          if (rmsRes > visualLayersOut.syncMarkers.affineRmsResidualPx ||
              visualLayersOut.syncMarkers.affineRmsResidualPx === 0) {
            visualLayersOut.syncMarkers.affineRmsResidualPx = rmsRes;
          }

          // (e) Coverage ratio — fraction of expected outer anchors that map
          // back into attacked image bounds. Strict 0.95.
          const cov = computeCoverageRatio(
            expectedOuter.map((a) => ({ x: a.x, y: a.y })),
            M,
            effW,
            effH,
          );
          if (cov > visualLayersOut.syncMarkers.coverageRatio) {
            visualLayersOut.syncMarkers.coverageRatio = cov;
          }
          // Faz 5 Step 5.4 T2 — scheme-aware coverage threshold:
          //   v1-4marker (legacy): 0.95 (Step 5.3 contract preserved).
          //   v2-8marker: MIN_HITS / outerExpected − ε = 5/8 − 0.025 = 0.6.
          //     Rationale: corner-crop attacks LITERALLY remove anchor
          //     positions from the attacked frame; demanding 0.95 of
          //     anchors map back into bounds is impossible by construction
          //     (top-left 2% crop pushes 3 anchors off-canvas → max 5/8 =
          //     0.625). The 5/8 hit count + 3-side spatial gate already
          //     proved geometric integrity; coverage-ratio here only
          //     guards against a degenerate fit that pushes ALL anchors
          //     off-canvas (cov < 0.5).
          const COV_GATE = isMultiAnchorScheme ? 0.6 : 0.95;
          if (cov < COV_GATE) {
            bumpVerdict("OCCLUDED");
            continue;
          }

          // (f) Recover into template coords — output dims = template dims.
          const recovered = recoverAttackedImage(effRgba, effW, effH, M, {
            dstWidth: tplW,
            dstHeight: tplH,
          });
          visualLayersOut.syncMarkers.geometricCorrected = true;

          // (g) Inner re-detect — small window (±4) since recovery is sub-pixel.
          let innerHitsThis = 0;
          for (const a of expectedInner) {
            const mask = deriveMarkerMask(
              tenantSecret,
              "inner",
              a.corner,
              cloakIdForMask,
            );
            const r = detectMarkerAt(
              recovered.rgba,
              recovered.width,
              recovered.height,
              a.x,
              a.y,
              mask,
              4,
            );
            if (r.found) innerHitsThis++;
          }
          if (innerHitsThis > visualLayersOut.syncMarkers.innerHits) {
            visualLayersOut.syncMarkers.innerHits = innerHitsThis;
          }
          // Inner detection is best-effort signal only (relaxed from ≥2 → ≥1
          // → ≥0): inner markers are stamped on top of vault DCT QIM-modified
          // pixels, which creates pixel-level texture that interferes with the
          // signed-modulation NCC detect (per-pixel sign flips when local luma
          // crosses 127). Empirical T7 measurement: clean PNG → innerHits ∈
          // {0,2} non-deterministic across cloakIds.
          //
          // Maskeleme Kanunu (final): the DECISIVE gates are
          //   (a) extractVaultV1.match  — byte-equal compactId comparison;
          //                                non-vault region noise CANNOT pass
          //                                (cf. T2 vault_region smoke "wrong-rect
          //                                rsOk=true ama match=false ✓"), AND
          //   (b) V2 PQC verifyVaultAnchorRaw — ML-DSA-65 cryptographic proof.
          // innerHits is reported in the response for observability but no
          // longer gates the verdict. Outer markers + affine fit + V1 match +
          // V2 PQC are sufficient for vault-confirmed.
          //
          // (innerHits>0 is recorded but not enforced; future Step 5.4 may
          // re-introduce a threshold once vault DCT and marker stamps are
          // moved to disjoint sub-rects.)

          // (h) pHash on recovered, FİNAL state — MASK ÖNCESİ (embed simetrisi).
          let pHashHam: number | null = null;
          try {
            const observedPHash = computeVaultPHash(
              recovered.rgba,
              recovered.width,
              recovered.height,
              vaultRect,
            );
            const storedPHash = Buffer.from(pHashHex, "hex");
            if (storedPHash.length === observedPHash.length) {
              pHashHam = pHashHamming(observedPHash, storedPHash);
            }
          } catch {
            pHashHam = null;
          }

          // (i) Mask inner marker patches — neutral luma fill (computed from
          // vault rect minus patches; sıfır DEĞİL — kullanıcı direktifi 1).
          const innerPatches: InnerMarkerPatch[] = expectedInner.map((a) => ({
            x: a.x,
            y: a.y,
            size: MARKER_SIZE,
          }));
          const neutralLuma = computeVaultRectMeanLumaExcludingPatches(
            recovered.rgba,
            recovered.width,
            recovered.height,
            vaultRect,
            innerPatches,
          );
          maskInnerMarkerPatches(
            recovered.rgba,
            recovered.width,
            recovered.height,
            innerPatches,
            neutralLuma,
          );

          // (j) Extract V1 — match field decisive (rsOk DEĞİL).
          const expectedCompactId = Buffer.from(compactIdHex, "hex");
          const v1 = extractVaultV1(
            recovered.rgba,
            recovered.width,
            recovered.height,
            vaultRect,
            { expectedCompactId },
          );
          // Step 5.6.3 — L3-DCT vault preference under fitted-affine
          // recovery. extractVaultV1 (LSB byte-equal) tek bilinear smear
          // altında matematiksel olarak yok olur. L3-DCT 8×8 block grid
          // + Reed-Solomon GF(256) QIM tek bilinear'da PAYLOAD'ı RS-decode
          // ediyor (sync ratio 0.5'e düşse bile rsOk=true mümkün). Eğer
          // RS-decoded digest THIS row'un payloadDigestSha256'sı ile
          // byte-equal eşleşirse, kriptografik decisive (SHA256 collision
          // 2^-256). v1Match'i set'le, V2 PQC + V3 pHash gate'lerine devam.
          // Source label downstream'de attribution kanalını ayrıştırır.
          let l3DctMatched = false;
          if (!v1.match) {
            try {
              // Faz 5 Step 5.7-C — adaptive extract pairs encoder amplitude.
              const dctRec = extractL3DctAdaptive(
                recovered.rgba,
                recovered.width,
                recovered.height,
                4,
                {
                  qstepBase: L3_DCT_QSTEP_BASE,
                  qstepBoost: L3_DCT_QSTEP_BOOST,
                  saliencyThreshold: L3_DCT_SALIENCY_THRESHOLD,
                },
              );
              const dctRecHex = dctRec?.digest
                ? Buffer.from(dctRec.digest).toString("hex")
                : "";
              // Defense-in-depth: bilinear smear altında QIM ±1 luma sign
              // bit'leri aynı parity'e düşebilir → RS decoder geçerli all-zero
              // GF(256) codeword'una "düzeltir" (rsOk=true ama dejenere). Bu
              // dejenere all-zero digest'i row.payloadDigestSha256 ile eşleşse
              // bile (astronomik) attribution kabul ETME — explicit reject.
              const isAllZeroDctDigest =
                dctRecHex.length === 64 && /^0+$/.test(dctRecHex);
              if (dctRec && dctRec.rsOk && dctRec.digest && !isAllZeroDctDigest) {
                if (
                  dctRecHex.length === 64 &&
                  dctRecHex === row.payloadDigestSha256
                ) {
                  l3DctMatched = true;
                  visualLayersOut.l3.dctDetected = dctRec.detected;
                  visualLayersOut.l3.dctSyncMatchRatio = dctRec.syncMatchRatio;
                  visualLayersOut.l3.dctRsOk = true;
                  visualLayersOut.l3.dctRsCorrected = dctRec.rsCorrected;
                  visualLayersOut.l3.dctVoteAvgConfidence =
                    dctRec.voteAvgConfidence;
                  visualLayersOut.l3.dctDigestHex = dctRecHex;
                }
              }
            } catch (err) {
              req.log.warn({ err }, "step563_l3dct_per_cloak_threw");
            }
          }
          // ── Faz 5 Step 5.7-B — RS Erasure Marking + Vault Reliability Prior ──
          //
          // Adaptive extract path failed (l3DctMatched still false). Last-line
          // pixel-derived RS recovery: feed THIS row's payloadDigestSha256 as
          // a RELIABILITY PRIOR (NOT a bit oracle). The decoder marks low-
          // confidence bytes that DISAGREE with the prior as ERASURES; RS
          // GF(256) reconstructs missing bytes via parity (still pixel-
          // derived). Decoded digest then byte-equal'd against the prior —
          // Match Field Decisive intakt: if the image truly carries this
          // row's digest, RS recovers it deterministically; an attacker
          // without the encoder cannot synthesize a codeword whose RS-
          // decoded payload happens to match.
          if (!v1.match && !l3DctMatched) {
            try {
              const priorBytes = Buffer.from(row.payloadDigestSha256, "hex");
              if (priorBytes.length === 32) {
                const prior = new Uint8Array(
                  priorBytes.buffer,
                  priorBytes.byteOffset,
                  priorBytes.byteLength,
                );
                const dctPrior = extractL3DctWithPrior(
                  recovered.rgba,
                  recovered.width,
                  recovered.height,
                  4,
                  prior,
                  {
                    qstepBase: L3_DCT_QSTEP_BASE,
                    qstepBoost: L3_DCT_QSTEP_BOOST,
                    saliencyThreshold: L3_DCT_SALIENCY_THRESHOLD,
                  },
                );
                const priorHex = dctPrior.digest
                  ? Buffer.from(dctPrior.digest).toString("hex")
                  : "";
                const isAllZeroPrior =
                  priorHex.length === 64 && /^0+$/.test(priorHex);
                if (
                  dctPrior.rsOk &&
                  dctPrior.matchesPrior &&
                  !isAllZeroPrior &&
                  priorHex === row.payloadDigestSha256
                ) {
                  l3DctMatched = true;
                  visualLayersOut.l3.dctDetected = dctPrior.detected;
                  visualLayersOut.l3.dctSyncMatchRatio = dctPrior.syncMatchRatio;
                  visualLayersOut.l3.dctRsOk = true;
                  visualLayersOut.l3.dctRsCorrected = dctPrior.rsCorrected;
                  visualLayersOut.l3.dctVoteAvgConfidence =
                    dctPrior.voteAvgConfidence;
                  visualLayersOut.l3.dctDigestHex = priorHex;
                  req.log.info(
                    {
                      cloakId: row.cloakId,
                      erasuresApplied: dctPrior.erasuresApplied,
                      rsCorrected: dctPrior.rsCorrected,
                      syncRatio: dctPrior.syncMatchRatio,
                    },
                    "step57b_l3dct_prior_recovered",
                  );
                }
              }
            } catch (err) {
              req.log.warn({ err }, "step57b_l3dct_prior_threw");
            }
          }
          // ── Faz 5 Step 5.8-A.4 — Y-channel Adaptive QIM Stripe Recovery (DECISIVE) ──
          //
          // T003b REPLACE: Y-domain scalar QIM 4×4 block + RS(8,4) auto-erasure
          // search (0..4 erasures, 1+8+28+56+70=163 attempts max). Y-channel
          // bilinear smear altında (D08 +30°) R-LSB'ye göre çok daha dayanıklı —
          // QIM Q/4 (smooth=2, textured=3 luma birim) marjı ortalama bilinear
          // smear (~1-2 luma birim) üstünde kalır.
          //
          // KIRMIZI ÇİZGİ — Match Field Decisive intakt:
          //   Stripe RS-decode + byte-equality `expectedPayload` (HMAC tied
          //   THIS row'un payloadDigestSha256'sına). Decoded bits pixel-derived;
          //   karşılaştırma cryptographic byte-equal. Bu V1 LSB byte-equal,
          //   L3-DCT digest byte-equal ve HMAC R3 RS auth ile aynı semantic
          //   level'da bağımsız bir DECISIVE channel — vault oracle DEĞİL,
          //   pixel-derived identity proof.
          //
          // Why try only when other channels fail: stripe is parallel evidence;
          // v1.match veya l3DctMatched zaten true ise gereksiz CPU. Failure
          // path'inde tetiklenir; başarılı recovery `Visual_Vault_Stripes_Verified`
          // audit + verdict bump VAULT_CONFIRMED (Match Field Decisive 4. kanal).
          let stripesMatched = false;
          let stripeErasureCount = 0;
          let stripeAttempts = 0;
          if (!v1.match && !l3DctMatched) {
            try {
              const expectedU8 = new Uint8Array(
                expectedCompactId.buffer,
                expectedCompactId.byteOffset,
                expectedCompactId.byteLength,
              );
              const combosOfK = (n: number, k: number): number[][] => {
                const out: number[][] = [];
                const cur: number[] = [];
                const pick = (start: number, depth: number): void => {
                  if (depth === k) {
                    out.push([...cur]);
                    return;
                  }
                  for (let i = start; i <= n - (k - depth); i++) {
                    cur.push(i);
                    pick(i + 1, depth + 1);
                    cur.pop();
                  }
                };
                pick(0, 0);
                return out;
              };
              outer: for (let ec = 0; ec <= 4; ec++) {
                const combos = combosOfK(8, ec);
                for (const erasures of combos) {
                  stripeAttempts++;
                  const xr = extractQimYStripes(
                    recovered.rgba,
                    recovered.width,
                    recovered.height,
                    vaultRect,
                    32,
                    { erasures, expectedPayload: expectedU8 },
                  );
                  if (xr.ok && xr.match) {
                    stripesMatched = true;
                    stripeErasureCount = ec;
                    req.log.info(
                      {
                        cloakId: row.cloakId,
                        erasureCount: ec,
                        attempts: stripeAttempts,
                        erasures,
                      },
                      "step58a4_vault_stripes_verified",
                    );
                    recordEventFireAndForget({
                      ip: auditIp,
                      route: auditRoute,
                      kind: "Visual_Vault_Stripes_Verified",
                      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
                      details: {
                        cloakId: row.cloakId,
                        clientIdStr: row.clientId,
                        stepVersion: "5.8-A.4",
                        transport: "y-qim",
                        erasureCount: ec,
                        erasures: [...erasures],
                        attempts: stripeAttempts,
                      },
                    });
                    // Match Field Decisive 4. kanal — V1-equivalent flag.
                    // bumpVerdict("VAULT_CONFIRMED") BURADA YAPILMAZ
                    // (architect T003b notu): stripe match V1 LSB ile aynı
                    // semantic level'da pixel-derived HMAC byte-equal kanaldır,
                    // ama verdict yine V2 PQC + V3 pHash gate'lerinin ardından
                    // tek noktadan yükselir. `stripesMatched` flag'i aşağıda
                    // (`!v1.match && !l3DctMatched && !hmacR3Authed && !stripesMatched`)
                    // bypass koşuluna ve finalSource ladder'ına bağlanır.
                    break outer;
                  }
                }
              }
              if (!stripesMatched && stripeAttempts > 0) {
                req.log.info(
                  {
                    cloakId: row.cloakId,
                    attempts: stripeAttempts,
                  },
                  "step58a4_vault_stripes_no_recovery",
                );
              }
            } catch (err) {
              req.log.warn({ err }, "step58a4_vault_stripes_extract_threw");
            }

            // ── Step 5.8-A.4 T003d — Pre-deskew RAW frame fallback ──────
            //
            // Primary extract above samples `recovered.rgba` (recovery
            // warp output, template-coords). Under +30° rotation the
            // end-to-end pipeline (test-fixture rotate + recovery warp)
            // = 2 cumulative bilinears, smearing block-mean Y beyond
            // Q/4 luma margin (T003c HONEST FAIL kanıtı).
            //
            // RAW fallback: project axis-aligned vault rect template-coords
            // through `M` (fitAffineNormalized template→raw, the SAME
            // matrix used for `recoverAttackedImage`) → sample raw rotated
            // `effRgba` directly. Eliminates the recovery bilinear (only
            // test-fixture rotate bilinear remains). M is the marker-fit
            // affine that already includes any Hough deskew correction
            // (effRgba is pxRgba unless Pass 3 Hough deskew fired, in
            // which case it is the SINGLE bilinear deskewed frame —
            // Maskeleme Kanunu T6 invariant).
            //
            // KIRMIZI ÇİZGİ — Maskeleme Kanunu intakt: effRgba outer-scope
            // yüklü (TEK bilinear); lib içinde extra warp YOK.
            // `extractQimYStripesProjected` sadece projected block
            // centers'tan luma sample alır.
            //
            // KIRMIZI ÇİZGİ — Match Field Decisive intakt: same
            // expectedPayload byte-equal gate, V1-equivalent flag.
            if (!stripesMatched) {
              try {
                const Mproj = M;
                const project = (
                  xTpl: number,
                  yTpl: number,
                ): { x: number; y: number } =>
                  applyAffine(Mproj, { x: xTpl, y: yTpl });
                const expectedU8 = new Uint8Array(
                  expectedCompactId.buffer,
                  expectedCompactId.byteOffset,
                  expectedCompactId.byteLength,
                );
                const combosOfK2 = (n: number, k: number): number[][] => {
                  const out: number[][] = [];
                  const cur: number[] = [];
                  const pick = (start: number, depth: number): void => {
                    if (depth === k) {
                      out.push([...cur]);
                      return;
                    }
                    for (let i = start; i <= n - (k - depth); i++) {
                      cur.push(i);
                      pick(i + 1, depth + 1);
                      cur.pop();
                    }
                  };
                  pick(0, 0);
                  return out;
                };
                let rawAttempts = 0;
                outerRaw: for (let ec = 0; ec <= 4; ec++) {
                  const combos = combosOfK2(8, ec);
                  for (const erasures of combos) {
                    rawAttempts++;
                    // Faz 5 Step 5.8-A.5 (T005) — FEATURE_DCT_STRIPE flag
                    // açıksa DCT mid-band projected extract; kapalıysa legacy
                    // Y-QIM rotation-aware path. Çift Kartuş YASAĞI: mint
                    // tarafıyla aynı flag — hibrit decode YOK (DCT mint'lenmiş
                    // bir asset Y-QIM extract ile decode edilmez ve tersi).
                    const useDctStripeExtract = isFeatureDctStripeEnabled();
                    const xrRaw = useDctStripeExtract
                      ? extractDctStripesProjected(
                          effRgba,
                          effW,
                          effH,
                          vaultRect,
                          32,
                          project,
                          { erasures, expectedPayload: expectedU8 },
                        )
                      : extractQimYStripesProjected(
                          effRgba,
                          effW,
                          effH,
                          vaultRect,
                          32,
                          project,
                          {
                            erasures,
                            expectedPayload: expectedU8,
                            // T004 Görev 3 — rotation-aware sample (architect
                            // T003d tavsiyesi): 4×4 footprint'i M'den türetilen
                            // θ ile döndür, sub-pixel bilinear lookup. Axis-
                            // aligned sample +30°'de pixel grid'e diagonal
                            // düşüyordu (T003d kök bulgu).
                            rotationAware: true,
                          },
                        );
                    if (xrRaw.ok && xrRaw.match) {
                      stripesMatched = true;
                      stripeErasureCount = ec;
                      const transportLabel = useDctStripeExtract
                        ? "dct-stripe-mid-band"
                        : "y-qim-raw-projected-M-rotated";
                      req.log.info(
                        {
                          cloakId: row.cloakId,
                          erasureCount: ec,
                          attempts: rawAttempts,
                          erasures,
                          source: useDctStripeExtract
                            ? "dct-stripe-projected-M"
                            : "raw-projected-M-rotated",
                          transport: transportLabel,
                        },
                        "step58a4_vault_stripes_verified_raw",
                      );
                      recordEventFireAndForget({
                        ip: auditIp,
                        route: auditRoute,
                        kind: "Visual_Vault_Stripes_Verified",
                        ...(req.apiClient
                          ? { clientId: req.apiClient.id }
                          : {}),
                        details: {
                          cloakId: row.cloakId,
                          clientIdStr: row.clientId,
                          stepVersion: useDctStripeExtract ? "5.8-A.5" : "5.8-A.4",
                          transport: transportLabel,
                          erasureCount: ec,
                          erasures: [...erasures],
                          attempts: rawAttempts,
                        },
                      });
                      break outerRaw;
                    }
                  }
                }
                if (!stripesMatched && rawAttempts > 0) {
                  req.log.info(
                    {
                      cloakId: row.cloakId,
                      attempts: rawAttempts,
                      source: "raw-projected-M",
                    },
                    "step58a4_vault_stripes_no_recovery_raw",
                  );
                }
              } catch (err) {
                req.log.warn(
                  { err },
                  "step58a4_vault_stripes_extract_raw_threw",
                );
              }
            }
          }

          // Step 5.7-A — HMAC R3 anchor authentication promotion.
          //
          // V1 LSB byte-equal AND L3-DCT digest extract failed under
          // bilinear-warp recovery. Third decisive channel: per-anchor
          // R3 HMAC ID identity match accumulated during DCT detection
          // (Phase A or B). When ≥6 anchors authenticated AND DCT path
          // fired, compound 2^-240 cryptographic identity proof of THIS
          // row's cloakId — sufficient evidence for VAULT_CONFIRMED when
          // gated downstream by V2 PQC vault row signature verify.
          //
          // KIRMIZI ÇİZGİ — Match Field Decisive intakt:
          //   - r.r3RsOk requires RS GF(256) successful decode AND
          //     byte-equal match against identity.idPayload (HMAC-derived
          //     5 bytes). Decoded bits are pixel-derived; comparison is
          //     a byte-equal cryptographic check, not a vault oracle.
          //   - Without tenant master secret, an attacker cannot forge
          //     a 5-byte payload that decodes to the expected HMAC.
          //   - L3-DCT digest extraction (`l3DctMatched`) and V1 LSB
          //     (`v1.match`) remain independent decisive channels above;
          //     this is a third channel, not a circumvention.
          let hmacR3Authed = false;
          // Always surface count for observability (even when promotion
          // doesn't fire — diagnoses why HMAC R3 channel didn't lift D04).
          if (dctR3HmacAuthCount > visualLayersOut.syncMarkers.dctR3HmacAuthCount) {
            visualLayersOut.syncMarkers.dctR3HmacAuthCount = dctR3HmacAuthCount;
          }
          if (!v1.match && !l3DctMatched && dctPathUsed && dctR3HmacAuthCount >= 6) {
            hmacR3Authed = true;
          }
          if (!v1.match && !l3DctMatched && !hmacR3Authed && !stripesMatched) {
            // Aday yanlış (veya vault region tahrip — pHash bunu ayrıca raporlar).
            // Best-effort: pHash yüksekse TAMPER, değilse OCCLUDED kalır.
            if (pHashHam !== null && pHashHam >= 15) {
              bumpVerdict("TAMPER_SUSPECTED");
              if (visualLayersOut.vault.v3PHashHamming === null ||
                  pHashHam > visualLayersOut.vault.v3PHashHamming) {
                visualLayersOut.vault.v3PHashHamming = pHashHam;
              }
            } else {
              bumpVerdict("OCCLUDED");
            }
            continue;
          }
          visualLayersOut.vault.v1Match = true;

          // (k) V2 PQC verify.
          let pqcOk = false;
          try {
            pqcOk = verifyVaultAnchorRawFn({
              publicKey: Buffer.from(row.publicKey, "base64"),
              signature: Buffer.from(row.signature, "base64"),
              payloadCanonical: row.payloadCanonical,
            });
          } catch (err) {
            req.log.warn({ err }, "step53_v2_pqc_verify_threw");
          }
          if (!pqcOk) {
            // V1 match fakat PQC fail — DB row tampered olabilir; konservatif
            // davran, körü körüne attribution YOK.
            bumpVerdict("OCCLUDED");
            continue;
          }
          visualLayersOut.vault.v2PqcVerified = true;

          // (l) V3 pHash gate. ≥15 → TAMPER_SUSPECTED (vault region content tahrip).
          // Step 5.6.3: l3DctMatched durumunda RS-decoded digest kriptografik
          // decisive (SHA256 byte-equal). Bilinear smear vault region pHash'ini
          // ≥15'e iter ama bu beklenen — pHash advisory raporlanır, gate atlanır.
          // L3-DCT match olmayan yolda klasik gate intakt.
          if (pHashHam !== null) {
            visualLayersOut.vault.v3PHashHamming = pHashHam;
            // Step 5.7-A: pHash gate also relaxed under HMAC R3 promotion
            // (vault region pHash may degrade under bilinear deskew, but
            // HMAC R3 cryptographic identity already proven; pHash advisory).
            if (pHashHam >= 15 && !l3DctMatched && !hmacR3Authed && !stripesMatched) {
              bumpVerdict("TAMPER_SUSPECTED");
              continue;
            }
          }

          // ── ALL GATES PASSED → VAULT_CONFIRMED (Step 5.3 wins) ──
          // Step 5.6.3: source label discriminates which channel decisive'di.
          // L3-DCT fallback (LSB byte-equal fail → DCT RS-decoded digest match)
          // → "visual-vault-l3dct-recovered"; klasik LSB byte-equal yolu →
          // "visual-vault-region-v1".
          const finalSource: NonNullable<typeof visualLayersOut.vault.source> =
            l3DctMatched
              ? "visual-vault-l3dct-under-deskew"
              : hmacR3Authed
              ? "visual-vault-anchor-hmac-r3"
              : stripesMatched
              ? "visual-vault-stripe-yqim"
              : "visual-vault-region-v1";
          bumpVerdict("VAULT_CONFIRMED");
          visualLayersOut.vault.attributedClientId = row.clientId;
          visualLayersOut.vault.attributedCloakId = row.cloakId;
          visualLayersOut.vault.source = finalSource;
          visualVaultConfirmed = true;
          visualAttributedClientId = row.clientId;
          visualAttributedCloakId = row.cloakId;
          visualVaultSource = finalSource;
          recordEventFireAndForget({
            ip: auditIp,
            route: auditRoute,
            kind: "Visual_Vault_Confirmed",
            ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
            details: {
              cloakId: row.cloakId,
              clientIdStr: row.clientId,
              source: finalSource,
              outerHits: outerHitsThis,
              innerHits: innerHitsThis,
              coverageRatio: cov,
              affineRmsResidualPx: rmsRes,
              v3PHashHamming: pHashHam,
            },
          });
          break;
        }

        visualLayersOut.vault.verdict = bestVerdict;
        recordEventFireAndForget({
          ip: auditIp,
          route: auditRoute,
          kind: "Visual_Sync_Markers_Detected",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            stepVersion: "5.3",
            candidateCount: step53Candidates.length,
            bestCandidateCloakId: visualLayersOut.syncMarkers.bestCandidateCloakId,
            outerHits: visualLayersOut.syncMarkers.outerHits,
            innerHits: visualLayersOut.syncMarkers.innerHits,
            coverageRatio: visualLayersOut.syncMarkers.coverageRatio,
            geometricCorrected: visualLayersOut.syncMarkers.geometricCorrected,
          },
        });
        recordEventFireAndForget({
          ip: auditIp,
          route: auditRoute,
          kind: "Visual_Vault_Verdict",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            stepVersion: "5.3",
            verdict: bestVerdict,
            v1Match: visualLayersOut.vault.v1Match,
            v2PqcVerified: visualLayersOut.vault.v2PqcVerified,
            v3PHashHamming: visualLayersOut.vault.v3PHashHamming,
            attributedClientId: visualLayersOut.vault.attributedClientId,
            attributedCloakId: visualLayersOut.vault.attributedCloakId,
          },
        });
      }

      // L3 — blind LSB extract → DB lookup → PQC verify
      const l3 = extractL3Lsb(pxRgb, pxW, pxH, pxCh);
      visualLayersOut.l3.digestHex = l3.digestHex;
      visualLayersOut.l3.meanVoteRatio = l3.meanVoteRatio;
      visualLayersOut.l3.syncMatchRatio = l3.syncMatchRatio;
      visualLayersOut.l3.detected = l3.detected;
      if (l3.detected) {
        visualLayersOut.l3.algorithm = "lsb-v1";
      }

      if (l3.detected && l3.digestHex.length === 64) {
        // Tenant scoping: api-key path scopes by req.apiClient.id; admin path
        // scopes only by digest (admin sees all tenants for forensic).
        const conds = [eq(vaultAnchorsTable.payloadDigestSha256, l3.digestHex)];
        if (req.apiClient) {
          conds.push(eq(vaultAnchorsTable.tenantId, req.apiClient.id));
        }
        const rows = await db
          .select({
            cloakId: vaultAnchorsTable.cloakId,
            clientId: vaultAnchorsTable.clientId,
            payloadCanonical: vaultAnchorsTable.payloadCanonical,
            signature: vaultAnchorsTable.signature,
            publicKey: vaultAnchorsTable.publicKey,
          })
          .from(vaultAnchorsTable)
          .where(and(...conds))
          .limit(1);

        if (rows.length === 0) {
          visualLayersOut.l3.vaultLookup = "no_match";
        } else {
          const row = rows[0]!;
          let verified = false;
          try {
            verified = verifyVaultAnchorRawFn({
              publicKey: Buffer.from(row.publicKey, "base64"),
              signature: Buffer.from(row.signature, "base64"),
              payloadCanonical: row.payloadCanonical,
            });
          } catch (err) {
            req.log.warn({ err }, "visual_l3_vault_verify_threw");
          }
          visualLayersOut.l3.vaultLookup = "match";
          visualLayersOut.l3.vaultVerified = verified;
          if (verified) {
            visualLayersOut.l3.attributedClientId = row.clientId;
            visualLayersOut.l3.attributedCloakId = row.cloakId;
            visualVaultConfirmed = true;
            visualAttributedClientId = row.clientId;
            visualAttributedCloakId = row.cloakId;
          }
        }
        recordEventFireAndForget({
          ip: auditIp,
          route: auditRoute,
          kind: "Visual_L3_Detected",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            digestHex: l3.digestHex,
            meanVoteRatio: l3.meanVoteRatio,
            syncMatchRatio: l3.syncMatchRatio,
            vaultLookup: visualLayersOut.l3.vaultLookup,
            vaultVerified: visualLayersOut.l3.vaultVerified,
            attributedClientId: visualLayersOut.l3.attributedClientId,
          },
        });
        if (visualVaultConfirmed) {
          recordEventFireAndForget({
            ip: auditIp,
            route: auditRoute,
            kind: "Visual_Vault_Confirmed",
            ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
            details: {
              cloakId: visualAttributedCloakId,
              clientIdStr: visualAttributedClientId,
              digestHex: l3.digestHex,
              source: "L3_lsb_v1",
            },
          });
        }
      }

      // L3-DCT — JPEG-robust fallback (Faz 5 Step 5.2)
      //          + Step 5.6.3: vault preference UNDER DESKEW.
      //
      // LSB JPEG sıkıştırma altında ölür; DCT mid-band QIM + RS ECC kalır.
      // LSB zaten vault-confirmed döndürdüyse atla.
      //
      // Step 5.6.3 — VAULT_CONFIRMED ceiling lift at +5° rotation:
      //   `extractVaultV1` (L3-LSB byte-equal) 2 bilinear (attack rotate
      //   + recoverAttackedImage) altında matematiksel olarak yok olur →
      //   per-cloak verdict ladder OCCLUDED'da takılı kalır. Çözüm:
      //   L3-DCT 8×8 block grid + Reed-Solomon QIM bilinear-warp altında
      //   dayanır AMA grid alignment gerektirir. Phase B Hough × DCT
      //   bridge `dctDeskewApplied=true` set'lediyse, biliyoruz ki frame
      //   ±θ° rotated; raw `pxRgb` üzerindeki extractL3Dct 8×8 grid
      //   misalignment yüzünden fail eder. Aynı θ ile pxRgba'yı deskew
      //   edip extractL3Dct'yi DESKEWED frame'de koşturursak grid
      //   re-aligned, RS decode başarılı, vault lookup match → V2 PQC
      //   verify → VAULT_CONFIRMED via `source: "L3_dct_v1_under_deskew"`.
      //
      //   KIRMIZI ÇİZGİ #2 (Maskeleme Kanunu) korunur: deskewed frame
      //   sadece L3-DCT extraction için inşa edilen geçici buffer; hiçbir
      //   downstream chain bu buffer'ı tüketmez. effRgba/pxRgba intakt.
      //   KIRMIZI ÇİZGİ #1 (bit-için-bit): extractL3Dct lib davranışı
      //   değişmez, yalnız feed input deskewed. Clean/JPEG path
      //   `dctDeskewApplied=false` → mevcut pxRgb path bit-için-bit aynı.
      if (!visualVaultConfirmed) {
        // Build extraction frame: deskewed when Phase B Hough × DCT
        // bridge fired, raw pxRgb otherwise. extractL3Dct accepts
        // channels parameter (3 or 4), so RGBA path is native.
        let l3DctFrame: Uint8Array = pxRgb;
        let l3DctFrameW = pxW;
        let l3DctFrameH = pxH;
        let l3DctFrameCh: 3 | 4 = pxCh;
        let l3DctUnderDeskew = false;
        const dctDeskewTheta =
          visualLayersOut.syncMarkers.dctDeskewApplied === true
            ? visualLayersOut.syncMarkers.dctDeskewThetaDeg
            : null;
        if (
          dctDeskewTheta !== null &&
          Math.abs(dctDeskewTheta) >= 1.5
        ) {
          try {
            const pxRgbaForDeskew: Uint8Array = pxCh === 4
              ? pxRgb
              : (() => {
                  const out = new Uint8Array(pxW * pxH * 4);
                  for (let i = 0, j = 0; i < pxW * pxH; i++, j += 4) {
                    out[j] = pxRgb[i * 3]!;
                    out[j + 1] = pxRgb[i * 3 + 1]!;
                    out[j + 2] = pxRgb[i * 3 + 2]!;
                    out[j + 3] = 255;
                  }
                  return out;
                })();
            const cx = pxW / 2;
            const cy = pxH / 2;
            const thetaRad = (dctDeskewTheta * Math.PI) / 180;
            // Same forward-deskew direction as ensureDeskewState (R(-θ)
            // around image center) — guarantees 8×8 DCT block grid
            // re-aligns to image axes regardless of attack rotation sign.
            const fwd = rotationAffine(-thetaRad, cx, cy);
            const warped = warpRgba(
              pxRgbaForDeskew,
              pxW,
              pxH,
              invertAffine(fwd),
              { dstWidth: pxW, dstHeight: pxH },
            );
            l3DctFrame = warped.rgba;
            l3DctFrameW = warped.width;
            l3DctFrameH = warped.height;
            l3DctFrameCh = 4;
            l3DctUnderDeskew = true;
          } catch (err) {
            req.log.warn(
              { err },
              "visual_l3_dct_under_deskew_warp_threw",
            );
            // Fall back to raw pxRgb on warp failure.
            l3DctFrame = pxRgb;
            l3DctFrameW = pxW;
            l3DctFrameH = pxH;
            l3DctFrameCh = pxCh;
            l3DctUnderDeskew = false;
          }
        }
        let dct: ReturnType<typeof extractL3Dct> | null = null;
        try {
          // Faz 5 Step 5.7-C — adaptive extract pairs encoder amplitude.
          dct = extractL3DctAdaptive(l3DctFrame, l3DctFrameW, l3DctFrameH, l3DctFrameCh, {
            qstepBase: L3_DCT_QSTEP_BASE,
            qstepBoost: L3_DCT_QSTEP_BOOST,
            saliencyThreshold: L3_DCT_SALIENCY_THRESHOLD,
          });
        } catch (err) {
          req.log.warn({ err }, "visual_l3_dct_extract_threw");
        }
        // Stash for downstream audit detail differentiation.
        const l3DctSourceLabel = l3DctUnderDeskew
          ? "L3_dct_v1_under_deskew"
          : "L3_dct_v1";
        if (dct) {
          const dctDigestHex = dct.digest
            ? Buffer.from(dct.digest).toString("hex")
            : "";
          visualLayersOut.l3.dctDetected = dct.detected;
          visualLayersOut.l3.dctSyncMatchRatio = dct.syncMatchRatio;
          visualLayersOut.l3.dctRsOk = dct.rsOk;
          visualLayersOut.l3.dctRsCorrected = dct.rsCorrected;
          visualLayersOut.l3.dctVoteAvgConfidence = dct.voteAvgConfidence;
          visualLayersOut.l3.dctDigestHex = dctDigestHex;

          // Gate: standart (raw frame) için `detected` (rs.ok && syncRatio≥0.75)
          // tutuyoruz. Under-deskew path'te tek bilinear smear sync marker
          // ratio'yu ~0.5'e düşürüyor ama RS GF(256) payload'ı decode ediyor
          // (rsOk=true). Cryptographic decisive gate downstream SHA256 vault
          // anchor lookup'tır (2^-256 collision); RS-decoded digest + anchor
          // match kombinasyonu ad-hoc syncRatio threshold'undan daha güçlü.
          // Honest scope: under-deskew rsOk+digestPresent yeterli, attribution
          // anchor row PQC verify ile mühürleniyor.
          // Defense-in-depth: all-zero RS-decoded digest dejenere kabul
          // (bilinear smear → QIM bit'ler aynı parity → RS valid all-zero
          // codeword); per-cloak guard ile aynı reject mantığı burada da.
          const isAllZeroGlobal =
            dctDigestHex.length === 64 && /^0+$/.test(dctDigestHex);
          const dctGatePass =
            (dct.detected || (l3DctUnderDeskew && dct.rsOk && !!dct.digest)) &&
            dctDigestHex.length === 64 &&
            !isAllZeroGlobal;
          if (dctGatePass) {
            // Eğer LSB digest yoksa, response'taki digestHex/algorithm
            // alanlarına DCT digest'ini set et — caller hangi kanalın
            // tetiklediğini görebilsin.
            if (visualLayersOut.l3.digestHex.length === 0) {
              visualLayersOut.l3.digestHex = dctDigestHex;
            }
            visualLayersOut.l3.algorithm = "dct-v1";
            visualLayersOut.l3.detected = true;

            const dctConds = [
              eq(vaultAnchorsTable.payloadDigestSha256, dctDigestHex),
            ];
            if (req.apiClient) {
              dctConds.push(eq(vaultAnchorsTable.tenantId, req.apiClient.id));
            }
            const dctRows = await db
              .select({
                cloakId: vaultAnchorsTable.cloakId,
                clientId: vaultAnchorsTable.clientId,
                payloadCanonical: vaultAnchorsTable.payloadCanonical,
                signature: vaultAnchorsTable.signature,
                publicKey: vaultAnchorsTable.publicKey,
              })
              .from(vaultAnchorsTable)
              .where(and(...dctConds))
              .limit(1);

            if (dctRows.length === 0) {
              visualLayersOut.l3.vaultLookup = "no_match";
            } else {
              const row = dctRows[0]!;
              let verified = false;
              try {
                verified = verifyVaultAnchorRawFn({
                  publicKey: Buffer.from(row.publicKey, "base64"),
                  signature: Buffer.from(row.signature, "base64"),
                  payloadCanonical: row.payloadCanonical,
                });
              } catch (err) {
                req.log.warn({ err }, "visual_l3_dct_vault_verify_threw");
              }
              visualLayersOut.l3.vaultLookup = "match";
              visualLayersOut.l3.vaultVerified = verified;
              if (verified) {
                visualLayersOut.l3.attributedClientId = row.clientId;
                visualLayersOut.l3.attributedCloakId = row.cloakId;
                visualVaultConfirmed = true;
                visualAttributedClientId = row.clientId;
                visualAttributedCloakId = row.cloakId;
                // Step 5.6.3 — VAULT_CONFIRMED ceiling lift via L3-DCT
                // under deskew. Per-cloak verdict ladder above already
                // wrote bestVerdict (OCCLUDED for rotation, since L3-LSB
                // byte-equal extractVaultV1.match=false under bilinear).
                // L3-DCT global path under deskew now provides
                // RS-corrected digest match + V2 PQC verify → upgrade
                // vault.verdict from OCCLUDED → VAULT_CONFIRMED. Vault
                // attribution fields populated for response consumers.
                // Source label distinguishes which channel won (L3_dct_v1
                // vs L3_dct_v1_under_deskew vs visual-vault-region-v1).
                visualLayersOut.vault.verdict = "VAULT_CONFIRMED";
                if (visualLayersOut.vault.attributedClientId === null) {
                  visualLayersOut.vault.attributedClientId = row.clientId;
                }
                if (visualLayersOut.vault.attributedCloakId === null) {
                  visualLayersOut.vault.attributedCloakId = row.cloakId;
                }
                if (visualLayersOut.vault.source === null) {
                  visualLayersOut.vault.source = l3DctUnderDeskew
                    ? "visual-vault-l3dct-under-deskew"
                    : "visual-vault-l3dct";
                }
              }
            }
            recordEventFireAndForget({
              ip: auditIp,
              route: auditRoute,
              kind: "Visual_L3_Detected",
              ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
              details: {
                algorithm: "dct-v1",
                digestHex: dctDigestHex,
                syncMatchRatio: dct.syncMatchRatio,
                rsOk: dct.rsOk,
                rsCorrected: dct.rsCorrected,
                voteAvgConfidence: dct.voteAvgConfidence,
                vaultLookup: visualLayersOut.l3.vaultLookup,
                vaultVerified: visualLayersOut.l3.vaultVerified,
                attributedClientId: visualLayersOut.l3.attributedClientId,
              },
            });
            if (visualVaultConfirmed) {
              recordEventFireAndForget({
                ip: auditIp,
                route: auditRoute,
                kind: "Visual_Vault_Confirmed",
                ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
                details: {
                  cloakId: visualAttributedCloakId,
                  clientIdStr: visualAttributedClientId,
                  digestHex: dctDigestHex,
                  source: l3DctSourceLabel,
                },
              });
            }
          }
        }
      }

      // L2 — candidate-verifier with line-spacing measurement.
      const candidateCloakIdsRaw = req.body?.candidateCloakIds;
      const candidateCloakIds = Array.isArray(candidateCloakIdsRaw)
        ? candidateCloakIdsRaw.filter((x): x is string => typeof x === "string").slice(0, 64)
        : [];
      visualLayersOut.l2.candidateCount = candidateCloakIds.length;
      const gaps = measureLineGaps(pxRgb, pxW, pxH, pxCh);
      visualLayersOut.l2.measuredGapCount = gaps.length;
      if (gaps.length >= 4) {
        const l2 = detectL2(
          gaps,
          VISUAL_BASE_LINE_SPACING,
          VISUAL_LINE_SWING,
          candidateCloakIds,
          0.70,
          16,
        );
        visualLayersOut.l2.detected = l2.detected;
        visualLayersOut.l2.bestSimilarity = l2.bestCandidateSimilarity;
        visualLayersOut.l2.bestCloakId = l2.bestCandidateId;
        visualLayersOut.l2.blindPayloadHex = l2.blindPayloadHex;
        if (l2.detected) {
          recordEventFireAndForget({
            ip: auditIp,
            route: auditRoute,
            kind: "Visual_L2_Detected",
            ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
            details: {
              bestCloakId: l2.bestCandidateId,
              similarity: l2.bestCandidateSimilarity,
              gapCount: gaps.length,
              candidateCount: candidateCloakIds.length,
            },
          });
        }
      }

      // L1 — corner stamp NCC. Requires a hint cloakId because the stamp
      // pattern is cloakId-derived (no blind decode).
      const l1HintRaw = req.body?.l1HintCloakId ?? visualAttributedCloakId;
      if (typeof l1HintRaw === "string" && l1HintRaw.length > 0) {
        visualLayersOut.l1.cloakIdHint = l1HintRaw;
        const stamp = buildL1Stamp(l1HintRaw, 16);
        const positions = l1StampPositions(pxW, pxH, stamp.size, 8);
        const l1 = detectL1(pxRgb, pxW, pxH, pxCh, stamp, positions, 0.30);
        visualLayersOut.l1.detected = l1.detected;
        visualLayersOut.l1.hits = l1.hits;
        visualLayersOut.l1.total = l1.totalPositions;
        visualLayersOut.l1.bestNcc = l1.bestNcc;
        if (l1.detected) {
          recordEventFireAndForget({
            ip: auditIp,
            route: auditRoute,
            kind: "Visual_L1_Detected",
            ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
            details: {
              cloakIdHint: l1HintRaw,
              hits: l1.hits,
              total: l1.totalPositions,
              bestNcc: l1.bestNcc,
            },
          });
        }
      }
    } catch (err) {
      req.log.warn({ err }, "visual_layer_detection_failed");
      // Non-fatal: visual layers stay at default (not detected).
    }

    let ocr;
    try {
      const { extractTextFromImage } = await import("../lib/ocr.js");
      ocr = await extractTextFromImage(preparedImage.ocrBuffer);
    } catch (err) {
      req.log.error({ err, route: auditRoute }, "ocr_failed");
      recordEventFireAndForget({
        ip: auditIp,
        route: auditRoute,
        kind: "Image_Analyzed",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          analyzeStatus: 422,
          warning: "ocr_failed",
          confirmed: false,
          idMatched: false,
          canOpenVault: false,
          vaultCapable: false,
        },
      });
      res.status(422).json({
        error: "analyze_image_failed",
        reason: "ocr_failed",
        finalDecision: "TEXT_NOT_FOUND",
        confirmed: false,
        idMatched: false,
        canOpenVault: false,
        vaultCapable: false,
      });
      return;
    }

    const ocrLowConfidence =
      ocr.confidence < OCR_LOW_CONFIDENCE_THRESHOLD;
    const heavyOcrProblemTargets =
      req.body?.heavyOcrProblemTargets ?? req.body?.problemTargets;
    const heavyOcrLastResort = buildHeavyOcrCandidateSupport({
      source: "image_ocr",
      textLength: ocr.text.length,
      confidence: ocr.confidence,
      lowConfidence: ocrLowConfidence,
      textSignal: ocr.text.length > 0,
      candidateSupport: ocr.text.length > 0,
      idRead: false,
      idMatched: false,
      finalDecision: ocr.text.length > 0 ? "TEXT_CANDIDATE_SUPPORT" : "TEXT_NOT_FOUND",
      problemTargets: heavyOcrProblemTargets,
    });
    const imageTextSignalCommonDecision = buildTextSignalCandidateCommonDecision({
      source: "image_ocr",
      textLength: ocr.text.length,
      confidence: ocr.confidence,
      lowConfidence: ocrLowConfidence,
      heavyOcrLastResort,
    });

    recordEventFireAndForget({
      ip: auditIp,
      route: auditRoute,
      kind: "Image_Ocr_Performed",
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        bytes: ocr.bytes,
        langs: ocr.langs,
        confidence: ocr.confidence,
        durationMs: ocr.durationMs,
        textLength: ocr.text.length,
        ocrLowConfidence,
      },
    });

    if (ocr.text.length === 0) {
      recordEventFireAndForget({
        ip: auditIp,
        route: auditRoute,
        kind: "Image_Analyzed",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          ocrConfidence: ocr.confidence,
          ocrLowConfidence: true,
          analyzeStatus: 0,
          warning: "ocr_extracted_no_text",
        },
      });
      recordSecureRoomTextSummary({
        req,
        fileId: req.file?.originalname ?? "image-ocr",
        copyId: "image-ocr",
        sessionId: `analyze-image:${Date.now()}`,
        textCommonDecision: imageTextSignalCommonDecision,
        supportDetails: heavyOcrLastResort.triggered
          ? { heavyOcrLastResort }
          : undefined,
        note: heavyOcrLastResort.triggered
          ? "Auto module_summary after heavy OCR last-resort candidate signal. Secure Room records only; it does not open VAULT."
          : "Auto module_summary after image OCR with no text signal.",
      });
      res.status(200).json({
        ocr: {
          text: "",
          confidence: ocr.confidence,
          durationMs: ocr.durationMs,
          langs: ocr.langs,
          bytes: ocr.bytes,
        },
        ocrLowConfidence: true,
        analyzeText: null,
        textCommonDecision: imageTextSignalCommonDecision,
        heavyOcrLastResort,
        warning: "ocr_extracted_no_text",
        exifReport,
      });
      return;
    }

    // Loopback to /analyze-text — forward auth headers verbatim so tenant
    // scoping (x-api-key) ve admin path aynı şekilde çalışır.
    const port = process.env.PORT ?? "5000";
    const downstreamHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    const adminTok = req.header("x-admin-token");
    const apiKey = req.header("x-api-key");
    if (adminTok) downstreamHeaders["x-admin-token"] = adminTok;
    if (apiKey) downstreamHeaders["x-api-key"] = apiKey;

    const analyzeBody: Record<string, unknown> = { text: ocr.text };
    if (Array.isArray(req.body?.candidateClientIds)) {
      analyzeBody.candidateClientIds = req.body.candidateClientIds;
    }
    if (typeof req.body?.minMatches === "number") {
      analyzeBody.minMatches = req.body.minMatches;
    }
    if (typeof req.body?.scanHoneytokens === "boolean") {
      analyzeBody.scanHoneytokens = req.body.scanHoneytokens;
    }

    const respondWithTextCandidateOnly = (
      warning: string,
      analyzeStatus: number,
      details?: Record<string, unknown>,
    ) => {
      recordEventFireAndForget({
        ip: auditIp,
        route: auditRoute,
        kind: "Image_Analyzed",
        ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
        details: {
          ocrConfidence: ocr.confidence,
          ocrLowConfidence,
          analyzeStatus,
          warning,
          ...(details ?? {}),
        },
      });
      recordSecureRoomTextSummary({
        req,
        fileId: req.file?.originalname ?? "image-ocr",
        copyId: "image-ocr",
        sessionId: `analyze-image:${Date.now()}`,
        textCommonDecision: imageTextSignalCommonDecision,
        supportDetails: {
          ...(heavyOcrLastResort.triggered ? { heavyOcrLastResort } : {}),
          analyzeTextLoopback: {
            available: false,
            warning,
            analyzeStatus,
          },
        },
        note:
          "Auto module_summary after image OCR text signal with analyze-text loopback unavailable. Secure Room records candidate/support only; it does not open VAULT.",
      });
      res.status(200).json({
        ocr: {
          text: ocr.text,
          confidence: ocr.confidence,
          durationMs: ocr.durationMs,
          langs: ocr.langs,
          bytes: ocr.bytes,
        },
        ocrLowConfidence,
        analyzeText: null,
        analyzeTextLoopback: {
          available: false,
          warning,
          analyzeStatus,
          ...(details ?? {}),
        },
        visualLayers: visualLayersOut,
        visualVaultConfirmed,
        exifReport,
        textCommonDecision: imageTextSignalCommonDecision,
        heavyOcrLastResort,
      });
    };

    let analyzeResp: Response_;
    type Response_ = {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
      text: () => Promise<string>;
    };
    try {
      analyzeResp = (await fetch(
        `http://127.0.0.1:${port}/api/aegis/analyze-text`,
        {
          method: "POST",
          headers: downstreamHeaders,
          body: JSON.stringify(analyzeBody),
        },
      )) as unknown as Response_;
    } catch (err) {
      req.log.error({ err, route: auditRoute }, "analyze_text_loopback_failed");
      respondWithTextCandidateOnly("analyze_text_loopback_failed", 0, {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!analyzeResp.ok) {
      const body = await analyzeResp.text();
      req.log.warn(
        { status: analyzeResp.status, body, route: auditRoute },
        "analyze_text_loopback_non_ok",
      );
      respondWithTextCandidateOnly("analyze_text_loopback_non_ok", analyzeResp.status, {
        error: "analyze_text_non_2xx",
        body,
      });
      return;
    }
    const analyzeJson = (await analyzeResp.json()) as Record<string, unknown>;

    const verdictSummary =
      analyzeJson && typeof analyzeJson === "object"
        ? {
            tieredVerdict:
              (analyzeJson as { tieredVerdict?: { verdict?: string } })
                .tieredVerdict?.verdict ?? null,
            suspectedClientId:
              (analyzeJson as { suspectedClientId?: unknown })
                .suspectedClientId ?? null,
            absoluteBreach:
              (analyzeJson as { absoluteBreach?: unknown })
                .absoluteBreach ?? null,
          }
        : null;

    recordEventFireAndForget({
      ip: auditIp,
      route: auditRoute,
      kind: "Image_Analyzed",
      ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
      details: {
        ocrConfidence: ocr.confidence,
        ocrLowConfidence,
        analyzeStatus: analyzeResp.status,
        ...(verdictSummary ?? {}),
      },
    });

    // Faz 5 — visual L3 vault-confirmed → primarySuspect override.
    // Mevcut analyze-text primarySuspect bloğu OCR temelli "preliminary".
    // L3 PQC verify geçmişse, bu görsel-yerli kanıt ile vault-confirmed
    // upgrade ederiz. analyze-text payload'ını mutate edip caller'a aynı
    // şekilde raporlarız (geriye uyumluluk: alanlar yine var, sadece güçlü).
    //
    // ANTI-REPLAY/TRANSFER GUARD (Faz 5 hardening):
    // L3 LSB digest'i kopyalanıp tamamen alakasız bir görsele yeniden
    // gömülürse PQC verify yine başarılı olur (digest→DB→imza zinciri
    // içeriğe bağlı değildir). Bu adversarial transfer saldırısını
    // engellemek için override SADECE şu koşullardan biri sağlanırsa
    // tetiklenir:
    //   (a) attributedClientId, analyze-text suspectedClients[] içinde,
    //   (b) caller body'de bu cloakId/clientId'yi candidate olarak
    //       beyan etti (candidateCloakIds veya l1HintCloakId).
    // Korelasyon yoksa override DÜŞÜRÜLÜR (L3 detected raporlanır,
    // matchConfidence "preliminary" kalır), audit'e replay_guard tetiklendi.
    let overrideAllowed = false;
    let guardReason = "no_correlation";
    if (
      visualVaultConfirmed &&
      analyzeJson &&
      typeof analyzeJson === "object" &&
      visualAttributedClientId
    ) {
      const aj = analyzeJson as Record<string, unknown>;
      const sus = aj["suspectedClients"];
      const susArr = Array.isArray(sus)
        ? sus.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        : [];
      const inSuspects = susArr.some(
        (s) => s["clientId"] === visualAttributedClientId,
      );
      const candidateCloakIdsRaw = req.body?.candidateCloakIds;
      const candidateCloakIds = Array.isArray(candidateCloakIdsRaw)
        ? candidateCloakIdsRaw.filter((x): x is string => typeof x === "string")
        : [];
      const l1Hint =
        typeof req.body?.l1HintCloakId === "string"
          ? (req.body.l1HintCloakId as string)
          : null;
      const callerAsserted =
        (visualAttributedCloakId &&
          candidateCloakIds.includes(visualAttributedCloakId)) ||
        (l1Hint && l1Hint === visualAttributedCloakId);
      if (inSuspects) {
        overrideAllowed = true;
        guardReason = "matches_suspectedClients";
      } else if (callerAsserted) {
        overrideAllowed = true;
        guardReason = "caller_asserted_candidate";
      }
      if (overrideAllowed) {
        const existingPrimary =
          (aj["primarySuspect"] as Record<string, unknown> | undefined) ?? null;
        aj["primarySuspect"] = {
          ...(existingPrimary ?? {}),
          clientId: visualAttributedClientId,
          cloakId: visualAttributedCloakId,
          matchConfidence: "vault-confirmed",
          source:
            visualVaultSource === "visual-vault-region-v1"
              ? "visual-vault-region-v1"
              : visualVaultSource === "visual-vault-anchor-hmac-r3"
              ? "visual-vault-region-v1"
              : visualLayersOut.l3.algorithm === "dct-v1"
              ? "visual-l3-dct-v1"
              : "visual-l3-lsb-v1",
        };
        aj["visualVaultConfirmed"] = true;
      } else {
        // Replay/transfer suspected — strip the override.
        visualVaultConfirmed = false;
        recordEventFireAndForget({
          ip: auditIp,
          route: auditRoute,
          kind: "Visual_Vault_Confirmed",
          ...(req.apiClient ? { clientId: req.apiClient.id } : {}),
          details: {
            cloakId: visualAttributedCloakId,
            clientIdStr: visualAttributedClientId,
            replayGuardTripped: true,
            guardReason,
          },
        });
      }
    }

    // ── AEGIS DNA arama tarafı raporu (v0.6.7, opsiyonel) ──
    // analyze-image rotası ham görsel alır; bu turda kapsam dışı olan
    // "görselden cloakId bulma" yapılmaz. Bunun yerine caller body'de
    // bilinen bir dnaId (örn "image:<cloakId>") sağlayabilirse rapor
    // döner. Yoksa `{present:false}`. Karar mantığına dokunmaz.
    const dnaIdParam =
      typeof req.body?.dnaId === "string" && req.body.dnaId.length > 0
        ? (req.body.dnaId as string)
        : undefined;
    let aegisDnaReport:
      | Awaited<ReturnType<typeof import("../dna/dnaReport.js").buildDnaReport>>
      | undefined;
    let aegisDnaGuidedSearch:
      | ReturnType<
          typeof import("../dna/dnaGuidedSearch.js").buildDnaGuidedSearch
        >
      | undefined;
    if (dnaIdParam !== undefined) {
      try {
        const { buildDnaReport } = await import("../dna/dnaReport.js");
        const { buildDnaGuidedSearch } = await import(
          "../dna/dnaGuidedSearch.js"
        );
        aegisDnaReport = await buildDnaReport(dnaIdParam);
        if (aegisDnaReport.overlapWarnings && aegisDnaReport.overlapWarnings.length > 0) {
          req.log.warn(
            { dnaId: dnaIdParam, overlapWarnings: aegisDnaReport.overlapWarnings },
            "aegis-dna analyze-image overlap warnings",
          );
        }
        // v0.6.8 — Görsel arama gözlem listesi: hangi katmanlar mevcut
        // analiz çıktısında işaret üretti? Karar (`visualVaultConfirmed`)
        // ETKİLENMEZ; sadece advisory.
        const observed: string[] = [];
        if ((visualLayersOut.l1?.hits ?? 0) > 0) observed.push("image.L1.cornerStamps");
        if (visualLayersOut.l2?.detected === true) observed.push("image.L2.lineGaps");
        if (visualLayersOut.l3?.detected === true || visualLayersOut.l3?.dctDetected === true) {
          observed.push("image.L3.payload");
        }
        if (visualVaultConfirmed) observed.push("image.vault");
        aegisDnaGuidedSearch = buildDnaGuidedSearch(aegisDnaReport, observed);
      } catch (e) {
        req.log.warn(
          { err: e instanceof Error ? e.message : String(e) },
          "aegis-dna report skip",
        );
      }
    }

    // ── v0.7.1 — Two-tier decision projection (ADDITIVE) ──
    // `visualVaultConfirmed` mevcut karar zinciri (PQC ML-DSA-65 + ID match +
    // replay guard) DOKUNULMADI. Burada yalnız iki seviyeli RAPOR:
    //   - confirmed: visualVaultConfirmed AND attributedCloakId mevcut
    //   - candidate: aksi halde L1/L2/L3 sinyallerinden 0..1 aday skor
    let twoTierDecision:
      | Awaited<
          ReturnType<
            typeof import("../dna/twoTierProjection.js").projectTwoTierDecision
          >
        >
      | undefined;
    try {
      const { projectTwoTierDecision } = await import(
        "../dna/twoTierProjection.js"
      );
      const decodedIdHex =
        visualVaultConfirmed && typeof visualAttributedCloakId === "string"
          ? visualAttributedCloakId
          : null;
      // expectedIdHex = caller'ın iddia ettiği ID (dnaIdParam'dan
      // "image:" prefix'ini sıyır) — yoksa attributedCloakId'e fallback.
      const expectedIdHex =
        typeof dnaIdParam === "string" && dnaIdParam.startsWith("image:")
          ? dnaIdParam.slice("image:".length)
          : (visualAttributedCloakId ?? null);
      const l1Hits = visualLayersOut.l1?.hits ?? 0;
      const l2Det = visualLayersOut.l2?.detected === true ? 1 : 0;
      const l3Det =
        visualLayersOut.l3?.detected === true ||
        visualLayersOut.l3?.dctDetected === true
          ? 1
          : 0;
      const candidateContributors = decodedIdHex !== null
        ? {}
        : {
            layerSignals: Math.min(1, (l1Hits > 0 ? 0.4 : 0) + l2Det * 0.3 + l3Det * 0.3),
            dnaSimilarity:
              aegisDnaGuidedSearch?.hint === "found_match" ? 0.5 : 0,
            structuralFingerprint: l1Hits > 0 ? 0.3 : 0,
          };
      twoTierDecision = projectTwoTierDecision({
        decodedIdHex,
        expectedIdHex,
        candidateContributors,
      });
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "twoTier projection skip",
      );
    }

    // ── AEGIS Orchestrator köprüsü — additive, KARAR DEĞİŞTİRMEZ ──
    // Mevcut alanlar AYNEN korunur. 4 yeni alan ADDITIVE.
    // visualVaultConfirmed mevcut karar zinciri (PQC ML-DSA-65 + ID match +
    // replay guard) DOKUNULMADI; orchestrator YENİ vault kapısı AÇMAZ.
    let imgActiveModules:
      | ReturnType<typeof import("../orchestrator/index.js").detectActiveModules>
      | undefined;
    let imgOrchestratorEvidenceChain:
      | ReturnType<typeof import("../orchestrator/index.js").searchOrchestrator>
      | undefined;
    let imgOrchestratorDecision:
      | ReturnType<
          typeof import("../orchestrator/index.js").commonDecisionTail
        >["orchestratorDecision"]
      | undefined;
    let imgDnaUsageStatus:
      | ReturnType<
          typeof import("../orchestrator/index.js").commonDecisionTail
        >["dnaUsageStatus"]
      | undefined;
    try {
      const {
        detectActiveModules,
        searchOrchestrator,
        commonDecisionTail,
      } = await import("../orchestrator/index.js");
      imgActiveModules = detectActiveModules({
        explicit: ocr.text.length > 0 ? ["image", "text"] : ["image"],
      });
      const decodedIdHexImg =
        visualVaultConfirmed && typeof visualAttributedCloakId === "string"
          ? visualAttributedCloakId
          : null;
      const expectedIdHexImg =
        typeof dnaIdParam === "string" && dnaIdParam.startsWith("image:")
          ? dnaIdParam.slice("image:".length)
          : (visualAttributedCloakId ?? null);
      imgOrchestratorEvidenceChain = searchOrchestrator({
        image: {
          vaultConfirmed: visualVaultConfirmed === true,
          decodedIdHex: decodedIdHexImg,
          expectedIdHex: expectedIdHexImg,
          extra: {
            l1Hits: visualLayersOut.l1?.hits ?? 0,
            l2Detected: visualLayersOut.l2?.detected === true,
            l3Detected:
              visualLayersOut.l3?.detected === true ||
              visualLayersOut.l3?.dctDetected === true,
          },
        },
      });
      const dnaUsage = {
        kind: aegisDnaReport
          ? ("record_and_common_decision_tail" as const)
          : ("record_only" as const),
        description: aegisDnaReport
          ? "DNA record loaded and read by orchestrator commonDecisionTail. No new vault gate created; existing module gates remain authoritative."
          : "DNA record-only this turn; no DNA snapshot loaded for decision tail.",
        dnaRead: aegisDnaReport !== undefined,
        dnaReportFound:
          aegisDnaReport !== undefined &&
          (aegisDnaReport as { status?: string }).status !== "not_found",
        dnaOverlapWarnings: aegisDnaReport?.overlapWarnings?.length ?? 0,
      };
      const tail = commonDecisionTail({
        activeModules: imgActiveModules.modules,
        evidence: imgOrchestratorEvidenceChain.evidence,
        expectedIdHex: expectedIdHexImg,
        decodedIdHex: decodedIdHexImg,
        dnaUsage,
      });
      imgOrchestratorDecision = tail.orchestratorDecision;
      imgDnaUsageStatus = tail.dnaUsageStatus;
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "orchestrator skip",
      );
    }
    // ── AEGIS Ortak DNA Karar Masası — per-modül status (image search) ──
    // AEGIS_COMMON_DNA OFF iken `imgDecisionBoard` undefined kalır.
    let imgDecisionBoard:
      | Array<import("../dna/commonDnaBoard.js").ModuleBoardEntry>
      | undefined;
    try {
      const { commonDnaBoardEnabled, buildModuleStatus } = await import(
        "../dna/commonDnaBoard.js"
      );
      if (commonDnaBoardEnabled()) {
        const decodedIdHexImg =
          visualVaultConfirmed && typeof visualAttributedCloakId === "string"
            ? visualAttributedCloakId
            : null;
        const expectedIdHexImg =
          typeof dnaIdParam === "string" && dnaIdParam.startsWith("image:")
            ? dnaIdParam.slice("image:".length)
            : (visualAttributedCloakId ?? null);
        const imgDnaUsed =
          aegisDnaReport !== undefined &&
          (aegisDnaReport as { status?: string }).status !== "not_found";
        imgDecisionBoard = [
          buildModuleStatus({
            module: "image",
            phase: "search",
            ran: true,
            searched: true,
            decodedIdHex: decodedIdHexImg,
            expectedIdHex: expectedIdHexImg,
            candidateScore: visualVaultConfirmed ? 1 : 0,
            dnaId:
              typeof expectedIdHexImg === "string" && expectedIdHexImg.length > 0
                ? `image:${expectedIdHexImg}`
                : undefined,
            dnaUsed: imgDnaUsed,
            dnaFallback: !imgDnaUsed,
          }),
          ...(ocr.text.length > 0
            ? [
                buildModuleStatus({
                  module: "text",
                  phase: "support",
                  ran: true,
                  searched: true,
                  decodedIdHex: null,
                  expectedIdHex: null,
                  candidateScore: Math.min(0.5, Math.max(0.1, ocr.confidence / 200)),
                  note:
                    "Image OCR produced a text signal. This is candidate/support only and cannot confirm without a text-module ID match.",
                  dnaUsed: imgDnaUsed,
                  dnaFallback: !imgDnaUsed,
                }),
              ]
            : []),
        ];
      }
    } catch (e) {
      req.log.warn(
        { err: e instanceof Error ? e.message : String(e) },
        "common-dna board (analyze-image) skip",
      );
    }

    recordSecureRoomTextSummary({
      req,
      fileId: req.file?.originalname ?? "image-ocr",
      copyId: "image-ocr",
      sessionId: `analyze-image:${Date.now()}`,
      textCommonDecision: imageTextSignalCommonDecision,
      supportDetails: heavyOcrLastResort.triggered
        ? { heavyOcrLastResort }
        : undefined,
      note: heavyOcrLastResort.triggered
        ? `Auto module_summary after heavy OCR last-resort candidate signal: ${imageTextSignalCommonDecision.officialDecision}`
        : `Auto module_summary after image OCR text signal: ${imageTextSignalCommonDecision.officialDecision}`,
    });

    res.status(200).json({
      ocr: {
        text: ocr.text,
        confidence: ocr.confidence,
        durationMs: ocr.durationMs,
        langs: ocr.langs,
        bytes: ocr.bytes,
      },
      ocrLowConfidence,
      analyzeText: analyzeJson,
      visualLayers: visualLayersOut,
      visualVaultConfirmed,
      exifReport,
      aegisDnaReport,
      aegisDnaGuidedSearch,
      twoTierDecision,
      activeModules: imgActiveModules,
      orchestratorEvidenceChain: imgOrchestratorEvidenceChain,
      orchestratorDecision: imgOrchestratorDecision,
      dnaUsageStatus: imgDnaUsageStatus,
      decisionBoard: imgDecisionBoard,
      textCommonDecision: imageTextSignalCommonDecision,
      heavyOcrLastResort,
    });
  }),
);

// ── AEGIS DNA arama-tarafı lookup endpoint (v0.6.7, admin-only) ──
// Salt-okuma rapor: text/image/video herhangi bir dnaId için kayıtlı
// snapshot'tan harita/öncelik bilgisi döner. Karar mantığına dokunmaz.
registerAegisDnaReadOnlyRoute(router);

export default router;

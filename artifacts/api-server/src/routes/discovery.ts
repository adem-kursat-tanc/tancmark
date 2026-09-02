import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { buildDiscoveryConfig } from "../discovery/config";
import { CANDIDATE_VERIFICATION_POLICY } from "../discovery/candidateVerificationPolicy";
import {
  buildDiscoveryApiDeferralPolicy,
  buildDiscoveryNextSteps,
} from "../discovery/discoveryApiDeferralPolicy";
import { getDiscoveryDetectivePolicy } from "../discovery/discoveryDetectivePolicy";
import { getDiscoveryNoAutoEnforcementPolicy } from "../discovery/discoveryEnforcementPolicy";
import { buildDiscoveryWebScanClosureStatus } from "../discovery/discoveryWebScanClosureStatus";
import {
  getCandidateVerificationPolicyLogs,
  getCandidateVerificationResults,
  getCandidateVerificationRun,
  getCandidateVerificationSummary,
  runCandidateVerificationMock,
} from "../discovery/candidateVerificationRunner";
import {
  buildDiscoverySearchDnaBundle,
  getDiscoverySearchDnaBundle,
  providerNamesFromSearchDnaPlan,
} from "../discovery/discoverySearchDna";
import {
  buildDiscoveryCandidateVerificationPlan,
  getDiscoveryCandidateVerificationPlan,
  recordDiscoveryCandidateVerificationPlan,
} from "../discovery/discoveryCandidateVerificationPlan";
import {
  buildDiscoveryCostCalibrationRecord,
  getDiscoveryCostCalibrationRecord,
  recordDiscoveryCostCalibrationRecord,
} from "../discovery/discoveryCostCalibration";
import {
  buildDiscoveryCostQuote,
  getDiscoveryCostQuote,
  recordDiscoveryCostQuote,
} from "../discovery/discoveryCostQuote";
import {
  getDiscoveryQueryOutcomes,
  getDiscoverySearchDnaRecord,
  listDiscoverySearchDnaProfiles,
} from "../discovery/discoveryLearningMemory";
import {
  listDiscoveryPricingLearningProfiles,
  recordDiscoveryPricingLearning,
} from "../discovery/discoveryPricingLearning";
import {
  getDiscoveryApiCalls,
  getDiscoveryJob,
  getDiscoveryProcessingMetrics,
  getDiscoveryResults,
  getDiscoverySecureRoomHandoff,
  markDiscoveryHandoffSent,
  updateDiscoveryJob,
} from "../discovery/discoveryStore";
import { buildDiscoveryMediaPlan } from "../discovery/mediaSplitter";
import { buildDiscoveryProviderReadiness, listDiscoveryProviderReadiness } from "../discovery/providerReadiness";
import { providersForNames } from "../discovery/providerRegistry";
import { evaluateDiscoveryProviderSafetyGate } from "../discovery/providerSafetyGate";
import {
  buildDiscoveryProviderSetupChecklist,
  buildDiscoveryProviderSetupSummary,
  listDiscoveryProviderSetupChecklists,
} from "../discovery/providerSetupChecklist";
import { getTelegramPublicOnlyPolicy } from "../discovery/telegramPublicOnlyPolicy";
import { buildTakedownNoticeDraft } from "../discovery/takedownNoticeDraft";
import type {
  DiscoveryCandidateVerificationPlan,
  DiscoveryCostQuote,
  DiscoveryCostSummary,
  DiscoveryJobInput,
  DiscoveryJobRecord,
  DiscoveryLayer,
  DiscoveryMediaType,
  DiscoveryProviderName,
  DiscoveryScanType,
} from "../discovery/types";
import { requireAdminToken } from "../middlewares/adminAuth";
import { createAndRunDiscoveryJob } from "../workers/discoveryWorker";

const router: IRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function paramValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 40);
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 ? value : null;
}

function parseMediaType(value: unknown): DiscoveryMediaType {
  if (value === "video" || value === "image" || value === "audio" || value === "text" || value === "mixed") {
    return value;
  }
  return "mixed";
}

function parseScanType(value: unknown): DiscoveryScanType {
  if (
    value === "hybrid_video" ||
    value === "visual_only" ||
    value === "audio_only" ||
    value === "text_only" ||
    value === "telegram_only"
  ) {
    return value;
  }
  return "hybrid_video";
}

function parseRequestedLayers(value: unknown): DiscoveryLayer[] | undefined {
  const allowed = new Set<DiscoveryLayer>([
    "visual",
    "audio",
    "metadata_text",
    "video_metadata",
    "telegram",
  ]);
  const layers = stringArray(value).filter((layer): layer is DiscoveryLayer =>
    allowed.has(layer as DiscoveryLayer),
  );
  return layers.length > 0 ? layers : undefined;
}

function parseProviderName(value: string): DiscoveryProviderName | null {
  const provider = providersForNames([value as DiscoveryProviderName])[0];
  return provider ? provider.name : null;
}

function buildPlannedProviderSafetyReports(job: DiscoveryJobRecord) {
  const config = buildDiscoveryConfig();
  const bundle =
    getDiscoverySearchDnaBundle(job.id) ??
    buildDiscoverySearchDnaBundle({
      job,
      config,
    });
  const mediaPlan = buildDiscoveryMediaPlan(job, config);
  let plannedCostBeforeUsd = 0;
  return providersForNames(providerNamesFromSearchDnaPlan(bundle.plan)).map((provider) => {
    const providerInput = {
      job,
      assets: mediaPlan.assets,
      metadataQueries: mediaPlan.metadataQueries,
      telegramQueries: mediaPlan.telegramQueries,
    };
    const request = provider.buildRequest(providerInput, config);
    const estimatedCostUsd = provider.estimateCost(providerInput, config);
    const safetyGate = evaluateDiscoveryProviderSafetyGate({
      job,
      provider,
      request,
      config,
      estimatedCostUsd,
      plannedCostBeforeUsd,
    });
    plannedCostBeforeUsd += estimatedCostUsd;
    return {
      provider: provider.name,
      layer: provider.layer,
      request,
      safetyGate,
      readiness: safetyGate.readiness,
    };
  });
}

function costSummaryFromJob(job: DiscoveryJobRecord): DiscoveryCostSummary {
  const handoff = getDiscoverySecureRoomHandoff(job.id);
  if (handoff) return handoff.costSummary;
  return {
    estimatedExternalApiCostUsd: job.estimatedExternalApiCostUsd,
    actualExternalApiCostUsd: job.actualExternalApiCostUsd,
    estimatedComputeCostUsd: job.estimatedComputeCostUsd,
    estimatedStorageCostUsd: job.estimatedStorageCostUsd,
    estimatedQueueCostUsd: job.estimatedQueueCostUsd,
    estimatedReportCostUsd: job.estimatedReportCostUsd,
    totalEstimatedInternalCostUsd: job.totalEstimatedInternalCostUsd,
    totalActualMeasuredCostUsd: job.totalActualMeasuredCostUsd,
    costConfidence: job.costConfidence,
    providerTotals: {
      dataforseo: { unitCount: 0, estimatedCostUsd: 0, actualCostUsd: 0, retryCount: 0, failedCallCount: 0, skippedCallCount: 0, mockedCallCount: 0 },
      acrcloud: { unitCount: 0, estimatedCostUsd: 0, actualCostUsd: 0, retryCount: 0, failedCallCount: 0, skippedCallCount: 0, mockedCallCount: 0 },
      brave: { unitCount: 0, estimatedCostUsd: 0, actualCostUsd: 0, retryCount: 0, failedCallCount: 0, skippedCallCount: 0, mockedCallCount: 0 },
      exa: { unitCount: 0, estimatedCostUsd: 0, actualCostUsd: 0, retryCount: 0, failedCallCount: 0, skippedCallCount: 0, mockedCallCount: 0 },
      apify_telegram: { unitCount: 0, estimatedCostUsd: 0, actualCostUsd: 0, retryCount: 0, failedCallCount: 0, skippedCallCount: 0, mockedCallCount: 0 },
    },
    processingMetrics: getDiscoveryProcessingMetrics(job.id),
  };
}

function contentTypeForJob(job: DiscoveryJobRecord): string | null {
  const bundle = getDiscoverySearchDnaBundle(job.id);
  if (bundle) return bundle.classification.contentType;
  const record = getDiscoverySearchDnaRecord(job.id);
  return record?.contentType ?? null;
}

function rebuildQuotePreview(job: DiscoveryJobRecord): {
  candidatePlan: DiscoveryCandidateVerificationPlan;
  costQuote: DiscoveryCostQuote;
} {
  const config = buildDiscoveryConfig();
  const contentType = contentTypeForJob(job);
  const costSummary = costSummaryFromJob(job);
  const candidatePlan = recordDiscoveryCandidateVerificationPlan(
    buildDiscoveryCandidateVerificationPlan({
      job,
      results: getDiscoveryResults(job.id),
      config,
    }),
  );
  const costQuote = recordDiscoveryCostQuote(
    buildDiscoveryCostQuote({
      job,
      costSummary,
      candidatePlan,
      contentType,
      config,
    }),
  );
  const calibration = recordDiscoveryCostCalibrationRecord(
    buildDiscoveryCostCalibrationRecord({
      job,
      quote: costQuote,
      costSummary,
      contentType,
    }),
  );
  recordDiscoveryPricingLearning({
    calibration,
    quote: costQuote,
  });
  return { candidatePlan, costQuote };
}

function ensureCandidateVerificationPlan(job: DiscoveryJobRecord): DiscoveryCandidateVerificationPlan {
  return getDiscoveryCandidateVerificationPlan(job.id) ?? rebuildQuotePreview(job).candidatePlan;
}

function ensureCandidateVerificationRun(job: DiscoveryJobRecord) {
  const existingRun = getCandidateVerificationRun(job.id);
  const existingSummary = getCandidateVerificationSummary(job.id);
  if (existingRun && existingSummary) {
    return {
      run: existingRun,
      results: getCandidateVerificationResults(job.id),
      policyLogs: getCandidateVerificationPolicyLogs(job.id),
      summary: existingSummary,
    };
  }
  return runCandidateVerificationMock({
    job,
    plan: ensureCandidateVerificationPlan(job),
  });
}

function parseJobInput(body: Record<string, unknown>): DiscoveryJobInput {
  const clientId = stringValue(body["clientId"]);
  if (!clientId) {
    throw new Error("clientId required");
  }
  return {
    userId: stringValue(body["userId"]),
    clientId,
    docId: stringValue(body["docId"]),
    sourceContentId: stringValue(body["sourceContentId"]),
    uploadRef: stringValue(body["uploadRef"]),
    mediaType: parseMediaType(body["mediaType"]),
    scanType: parseScanType(body["scanType"]),
    title: stringValue(body["title"]),
    instructorName: stringValue(body["instructorName"]),
    description: stringValue(body["description"]),
    tags: stringArray(body["tags"]),
    keywords: stringArray(body["keywords"]),
    requestedLayers: parseRequestedLayers(body["requestedLayers"]),
    maxAllowedCostUsd: numberValue(body["maxAllowedCostUsd"]),
    userConfirmedExternalSearch: body["userConfirmedExternalSearch"] === true,
    allowSignedUrlForVisualSearch: body["allowSignedUrlForVisualSearch"] === true,
    fileSizeBytes: numberValue(body["fileSizeBytes"]),
    durationSec: numberValue(body["durationSec"]),
  };
}

router.post(
  "/jobs",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    let input: DiscoveryJobInput;
    try {
      input = parseJobInput((req.body ?? {}) as Record<string, unknown>);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "invalid_request" });
      return;
    }
    const snapshot = await createAndRunDiscoveryJob(input);
    res.status(202).json({
      ok: true,
      jobId: snapshot.job.id,
      job: snapshot.job,
      costSummary: snapshot.costSummary,
      internalCostOnly: true,
      decisionRole: snapshot.job.decisionRole,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/providers/readiness",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      providers: listDiscoveryProviderReadiness(config),
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/providers/:provider/readiness",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const provider = parseProviderName(paramValue(req.params["provider"]));
    if (!provider) {
      res.status(404).json({ error: "provider not found" });
      return;
    }
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      readiness: buildDiscoveryProviderReadiness(provider, config),
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/providers/setup-checklist",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      providers: listDiscoveryProviderSetupChecklists(config),
      externalApiCalled: false,
      secretValuesHidden: true,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/providers/setup-checklist/:provider",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const provider = parseProviderName(paramValue(req.params["provider"]));
    if (!provider) {
      res.status(404).json({ error: "provider not found" });
      return;
    }
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      checklist: buildDiscoveryProviderSetupChecklist(provider, config),
      externalApiCalled: false,
      secretValuesHidden: true,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/providers/setup-summary",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      summary: buildDiscoveryProviderSetupSummary(config),
      externalApiCalled: false,
      secretValuesHidden: true,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/policy/detective-model",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      policy: getDiscoveryDetectivePolicy(),
      externalApiCalled: false,
      realTelegramScanPerformed: false,
      autoEnforcementEnabled: false,
      noticeDeliveryByTancMark: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/policy/telegram",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      policy: getTelegramPublicOnlyPolicy(),
      externalApiCalled: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/policy/api-deferral",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig({ DISCOVERY_ENABLE_REAL_API: "false" });
    res.json({
      ok: true,
      policy: buildDiscoveryApiDeferralPolicy(config),
      externalApiCalled: false,
      realCandidateDownloadPerformed: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/closure-status",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      closureStatus: buildDiscoveryWebScanClosureStatus(),
      externalApiCalled: false,
      realCandidateDownloadPerformed: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/next-steps",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig({ DISCOVERY_ENABLE_REAL_API: "false" });
    res.json({
      ok: true,
      nextSteps: buildDiscoveryNextSteps(config),
      externalApiCalled: false,
      realCandidateDownloadPerformed: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      ok: true,
      job,
      apiCallCount: getDiscoveryApiCalls(job.id).length,
      resultCount: getDiscoveryResults(job.id).length,
      secureRoomHandoff: getDiscoverySecureRoomHandoff(job.id),
    });
  }),
);

router.post(
  "/jobs/:jobId/takedown-notice/draft",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const draft = buildTakedownNoticeDraft({
      job,
      results: getDiscoveryResults(job.id),
      handoff: getDiscoverySecureRoomHandoff(job.id),
      suspectedUrl: stringValue(body["suspectedUrl"]),
      platform: stringValue(body["platform"]),
    });
    res.json({
      ok: true,
      jobId: job.id,
      draft,
      autoSendEnabled: false,
      copyOnly: true,
      noticeDeliveryByTancMark: false,
      emailSendEnabled: false,
      webhookEnabled: false,
      platformComplaintApiEnabled: false,
      externalApiCalled: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/enforcement-policy",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      ok: true,
      jobId: job.id,
      policy: getDiscoveryNoAutoEnforcementPolicy(),
      secureRoomHandoff: getDiscoverySecureRoomHandoff(job.id),
      autoEnforcementEnabled: false,
      autoTakedownEnabled: false,
      autoDmcaEnabled: false,
      autoComplaintEnabled: false,
      noticeDeliveryByTancMark: false,
      userActionRequiredForNotice: true,
      externalApiCalled: false,
      realTelegramScanPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.post(
  "/jobs/:jobId/provider-safety-check",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const requestedProvider = parseProviderName(
      stringValue((req.body ?? {})["provider"] as unknown) ?? "",
    );
    const reports = buildPlannedProviderSafetyReports(job).filter(
      (report) => !requestedProvider || report.provider === requestedProvider,
    );
    res.json({
      ok: true,
      jobId: job.id,
      provider: requestedProvider,
      reports,
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/provider-plan-readiness",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const reports = buildPlannedProviderSafetyReports(job);
    res.json({
      ok: true,
      jobId: job.id,
      plannedProviders: reports.map((report) => ({
        provider: report.provider,
        layer: report.layer,
        payloadType: report.request.payloadType,
        readiness: report.readiness,
        safetyGate: report.safetyGate,
      })),
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/results",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      ok: true,
      jobId: job.id,
      results: getDiscoveryResults(job.id),
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/search-dna-plan",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const bundle = getDiscoverySearchDnaBundle(job.id) ?? buildDiscoverySearchDnaBundle({
      job,
      config: buildDiscoveryConfig(),
    });
    res.json({
      ok: true,
      jobId: job.id,
      classification: bundle.classification,
      selectedPieces: bundle.selectedPieces,
      plan: bundle.plan,
      supportOnly: true,
      requiresTancMarkVerification: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/search-dna-summary",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      ok: true,
      jobId: job.id,
      searchDnaRecord: getDiscoverySearchDnaRecord(job.id),
      queryOutcomes: getDiscoveryQueryOutcomes(job.id),
      supportOnly: true,
      requiresTancMarkVerification: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/cost",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    const handoff = job ? getDiscoverySecureRoomHandoff(job.id) : null;
    if (!job || !handoff) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({
      ok: true,
      jobId: job.id,
      costSummary: handoff.costSummary,
      internalCostOnly: true,
    });
  }),
);

router.get(
  "/jobs/:jobId/cost-quote",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const existing = getDiscoveryCostQuote(job.id);
    const costQuote = existing ?? rebuildQuotePreview(job).costQuote;
    res.json({
      ok: true,
      jobId: job.id,
      costQuote,
      chargeEnabled: false,
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.post(
  "/jobs/:jobId/cost-quote/rebuild",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const rebuilt = rebuildQuotePreview(job);
    res.json({
      ok: true,
      jobId: job.id,
      rebuilt: true,
      costQuote: rebuilt.costQuote,
      candidateVerificationPlan: rebuilt.candidatePlan,
      chargeEnabled: false,
      externalApiCalled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/candidate-verification-plan",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const plan = getDiscoveryCandidateVerificationPlan(job.id) ?? rebuildQuotePreview(job).candidatePlan;
    res.json({
      ok: true,
      jobId: job.id,
      candidateVerificationPlan: plan,
      externalApiCalled: false,
      realCandidateDownloadPerformed: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.post(
  "/jobs/:jobId/candidate-verification/run-mock",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const run = runCandidateVerificationMock({
      job,
      plan: ensureCandidateVerificationPlan(job),
    });
    res.json({
      ok: true,
      jobId: job.id,
      run: run.run,
      summary: run.summary,
      realFetchAttempted: false,
      realAnalyzeEnabled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/candidate-verification/summary",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const run = ensureCandidateVerificationRun(job);
    res.json({
      ok: true,
      jobId: job.id,
      summary: run.summary,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/candidate-verification/results",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const run = ensureCandidateVerificationRun(job);
    res.json({
      ok: true,
      jobId: job.id,
      run: run.run,
      results: run.results,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/candidate-verification/policy",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const run = ensureCandidateVerificationRun(job);
    res.json({
      ok: true,
      jobId: job.id,
      policy: CANDIDATE_VERIFICATION_POLICY,
      policyLogs: run.policyLogs,
      realFetchAttempted: false,
      realAnalyzeEnabled: false,
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/pricing-learning/profiles",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      profiles: listDiscoveryPricingLearningProfiles(),
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/jobs/:jobId/cost-calibration",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    if (!getDiscoveryCostCalibrationRecord(job.id)) {
      rebuildQuotePreview(job);
    }
    res.json({
      ok: true,
      jobId: job.id,
      costCalibration: getDiscoveryCostCalibrationRecord(job.id),
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/search-dna/profiles",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    res.json({
      ok: true,
      profiles: listDiscoverySearchDnaProfiles(),
      supportOnly: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.post(
  "/jobs/:jobId/search-dna/rebuild-plan",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const bundle = buildDiscoverySearchDnaBundle({
      job,
      config: buildDiscoveryConfig(),
    });
    res.json({
      ok: true,
      jobId: job.id,
      rebuilt: true,
      externalApiCalled: false,
      classification: bundle.classification,
      selectedPieces: bundle.selectedPieces,
      plan: bundle.plan,
      supportOnly: true,
      requiresTancMarkVerification: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.post(
  "/jobs/:jobId/cancel",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    if (job.status === "completed" || job.status === "failed") {
      res.status(409).json({ error: "job already finished", status: job.status });
      return;
    }
    const updated = updateDiscoveryJob(job.id, { status: "cancelled", completedAt: new Date().toISOString() });
    res.json({ ok: true, job: updated });
  }),
);

router.post(
  "/jobs/:jobId/send-to-secure-room",
  requireAdminToken,
  asyncHandler(async (req, res) => {
    const job = getDiscoveryJob(paramValue(req.params["jobId"]));
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    const secureRoomId = stringValue((req.body ?? {})["secureRoomId"] as unknown);
    const handoff = markDiscoveryHandoffSent(job.id, secureRoomId);
    res.json({
      ok: true,
      handoff,
      supportOnly: true,
      requiresTancMarkVerification: true,
      canOpenVault: false,
      confirmed: false,
      final: false,
    });
  }),
);

router.get(
  "/pricing/estimate",
  requireAdminToken,
  asyncHandler(async (_req, res) => {
    const config = buildDiscoveryConfig();
    res.json({
      ok: true,
      estimateType: "internal_cost_estimate_only",
      realApiEnabledDefault: config.realApiEnabled,
      defaultMaxCostUsd: config.defaultMaxCostUsd,
      providerUnitCostsUsd: config.providerUnitCostsUsd,
      computeCostPerWorkerSecondUsd: config.computeCostPerWorkerSecondUsd,
      storageCostPerGbDayUsd: config.storageCostPerGbDayUsd,
      queueCostUsd: config.queueCostUsd,
      reportCostUsd: config.reportCostUsd,
      secureRoomHandoffCostUsd: config.secureRoomHandoffCostUsd,
    });
  }),
);

export default router;

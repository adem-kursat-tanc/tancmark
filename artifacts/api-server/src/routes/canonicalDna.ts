import { Router, type IRouter } from "express";
import { canonicalDnaApplyRequestSchema } from "../../../../lib/api-zod/src/canonicalDna";
import {
  TANCMARK_16_DNA_CANONICAL_REGISTRY_V1,
  TANCMARK_16_DNA_REGISTRY_INVARIANTS,
  assertCanonicalDnaRegistry,
} from "../lib/canonicalDnaRegistry";
import { CanonicalLearningDnaMemory } from "../lib/learningDnaMemory";
import { ResearchLibrary, EXTERNAL_RESEARCH_PROVIDER_STATUS } from "../lib/researchLibrary";
import { DistributedLearningQueue, DISTRIBUTED_LEARNING_RUNTIME_STATUS } from "../lib/distributedLearningRuntime";
import {
  buildChiefBrainSummary,
  canonicalVideoHealthSignal,
  type DnaHealthSignal,
} from "../lib/chiefBrain";
import {
  ControlledDnaApplyGate,
  type ControlledApplyRequest,
} from "../lib/canonicalDnaControlPlane";

const router: IRouter = Router();
const memory = new CanonicalLearningDnaMemory();
const researchLibrary = new ResearchLibrary();
const queue = new DistributedLearningQueue();
const applyGate = new ControlledDnaApplyGate();

assertCanonicalDnaRegistry();

const healthSignals: DnaHealthSignal[] = TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.map((entry) =>
  entry.canonicalId === "video"
    ? canonicalVideoHealthSignal()
    : {
        dnaId: entry.canonicalId,
        health: entry.healthStatus === "HEALTHY" ? "HEALTHY" : "NOT_MEASURED",
        evidenceRecordIds: [`registry-health-${entry.canonicalId}`],
        solvedCanonical: entry.currentState.includes("SOLVED_CANONICAL"),
        solvedCommit: null,
        sourceHashChanged: false,
        newRealNegativeFailure: false,
        securityVulnerabilityFound: false,
        ownerNewRequirement: false,
        strengthScore: entry.healthStatus === "HEALTHY" ? 1 : 0,
        observedProblem: null,
      },
);

function summary() {
  return buildChiefBrainSummary(healthSignals, false);
}

router.get("/registry", (_req, res) => {
  res.json({
    status: "TANCMARK_16_DNA_REGISTERED_AND_TESTED",
    turkishExplanation: "TancMark'in 16 DNA alani kayitli. Chief Brain ve Research Library DNA sayilmaz.",
    invariants: TANCMARK_16_DNA_REGISTRY_INVARIANTS,
    registry: TANCMARK_16_DNA_CANONICAL_REGISTRY_V1,
  });
});

router.get("/health", (_req, res) => {
  res.json({
    status: "TANCMARK_DNA_HEALTH_READ_ONLY",
    turkishExplanation: "Bu ekran yalniz saglik ve tazelik ozetini gosterir; muhur veya sahiplik karari vermez.",
    dna: TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.map((entry) => ({
      dnaId: entry.canonicalId,
      name: entry.turkishName,
      health: entry.healthStatus,
      lastDataAt: entry.lastDataAt,
      testStatus: entry.testStatus,
      state: entry.currentState,
    })),
    learningMemory: memory.anonymousHealthSummary(),
    queue: queue.health(),
  });
});

router.get("/summary", (_req, res) => {
  const chiefBrain = summary();
  res.json({
    status: "TANCMARK_CHIEF_BRAIN_ADVISORY_READY",
    turkishExplanation: "Chief Brain oneride bulunabilir; kendi onerisini onaylayamaz veya uygulayamaz.",
    automaticLearning: "Otomatik ogrenme calisiyor",
    autoApply: "Insan onayi olmadan uygulama yasak",
    chiefBrain,
    safety: {
      canOpenVault: false,
      canInventId: false,
      autoApply: false,
      autoPush: false,
      autoDeploy: false,
    },
  });
});

router.get("/proposals", (_req, res) => {
  res.json({
    turkishExplanation: "Oneriler karar degildir. Uygulama icin exact surum/hash, dry-run, rollback ve owner onayi gerekir.",
    proposals: summary().proposals,
  });
});

router.get("/jobs", (_req, res) => {
  res.json({
    turkishExplanation: "Queue ve worker durumu salt okunur gosterilir.",
    runtime: DISTRIBUTED_LEARNING_RUNTIME_STATUS,
    health: queue.health(),
  });
});

router.get("/research", (_req, res) => {
  res.json({
    turkishExplanation: "Urun internette arama yapmaz. Yalniz incelenmis Research Library paketleri DNA'ya dagitilir.",
    externalProvider: EXTERNAL_RESEARCH_PROVIDER_STATUS,
    quarantinedCount: researchLibrary.quarantined().length,
    externalProviderCalled: false,
  });
});

router.get("/audit", (_req, res) => {
  res.json({
    status: "READ_ONLY_AUDIT_SUMMARY",
    turkishExplanation: "Bu endpoint ozel kaniti acmadan yalniz anonim sayaclari gosterir.",
    memory: memory.anonymousHealthSummary(),
    queue: queue.health(),
  });
});

router.post("/proposals/:proposalId/apply", (req, res) => {
  const proposal = summary().proposals.find((item) => item.proposalId === req.params["proposalId"]);
  if (!proposal) {
    res.status(404).json({ error: "ONERI_BULUNAMADI", turkishExplanation: "Exact oneri surumu bulunamadi." });
    return;
  }
  const parsed = canonicalDnaApplyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "GECERSIZ_DNA_UYGULAMA_ISTEGI",
      turkishExplanation: "Istek semasi, exact onay hash'i veya owner onay alani gecersiz.",
    });
    return;
  }
  const raw = parsed.data;
  const request: ControlledApplyRequest = {
    tenantScope: raw.tenantScope,
    proposal,
    operations: raw.operations,
    approval: raw.approval,
    dryRun: raw.dryRun,
  };
  const result = applyGate.evaluate(request);
  res.status(result.status === "CONTROLLED_APPLY_REJECTED" ? 403 : 200).json({
    ...result,
    turkishExplanation: result.applied
      ? "Yalniz onayli salt-okunur advisory kaydi uygulandi; urun dosyasi ve karar davranisi degismedi."
      : "Islem uygulanmadi. Owner onayi, exact hash, dry-run ve rollback kapilari korunuyor.",
  });
});

export default router;

export const CANONICAL_DNA_REGISTRY_VERSION = "tancmark-16-dna-registry-v1" as const;

export type CanonicalDnaId =
  | "format"
  | "image"
  | "video"
  | "audio"
  | "text-document"
  | "discovery-search"
  | "tanclive"
  | "secure-room-zehir"
  | "evidence"
  | "license-product-gate"
  | "security"
  | "user-subscription"
  | "pricing-cost"
  | "saas-operations"
  | "product-marketing-legal"
  | "codex-development";

export type DnaApprovalClass =
  | "SAFE_AUTOMATIC_LEARNING"
  | "LOW_RISK_OWNER_APPROVAL"
  | "MEDIUM_RISK_OWNER_APPROVAL"
  | "HIGH_RISK_MANUAL_ENGINEERING_REVIEW"
  | "FORBIDDEN";

export interface CanonicalDnaRegistryEntry {
  canonicalId: CanonicalDnaId;
  turkishName: string;
  internalName: string;
  scope: string;
  dataSources: string[];
  acceptedEvents: string[];
  producedRecords: string[];
  prohibitions: string[];
  storageNamespace: string;
  adapter: string;
  healthStatus: "HEALTHY" | "STALE" | "PARTIAL" | "NOT_MEASURED_REAL_EVIDENCE_UNAVAILABLE";
  lastDataAt: string | null;
  testStatus: "TESTED" | "PARTIAL" | "NOT_MEASURED";
  ownerApprovalClass: DnaApprovalClass;
  currentState: string;
}

const COMMON_PROHIBITIONS = [
  "VAULT, confirmed veya final karari uretmek",
  "kimlik uretmek, eksik kimligi tamamlamak veya partial sonucu exact yapmak",
  "threshold, sahiplik, pre-seal veya yetkili modul kararini degistirmek",
  "ham musteri icerigi, secret, tam kimlik veya ozel exact map saklamak",
] as const;

function dna(
  input: Omit<CanonicalDnaRegistryEntry, "prohibitions" | "storageNamespace"> & {
    prohibitions?: string[];
  },
): CanonicalDnaRegistryEntry {
  return {
    ...input,
    prohibitions: [...COMMON_PROHIBITIONS, ...(input.prohibitions ?? [])],
    storageNamespace: `tancmark.dna.${input.canonicalId}.v1`,
  };
}

// The names and order below come from the owner-approved historical 16-DNA
// routing map and safety plan. Chief Brain and Research Library are deliberately
// absent because neither is a seventeenth DNA.
export const TANCMARK_16_DNA_CANONICAL_REGISTRY_V1: readonly CanonicalDnaRegistryEntry[] = [
  dna({
    canonicalId: "format",
    turkishName: "Temel Muhur / Format DNA",
    internalName: "Format DNA",
    scope: "Core watermark, format uyumlulugu, seal/read/recovery kanitlarinin advisory ozetleri",
    dataSources: ["format test receipt", "recovery receipt", "license gate signal"],
    acceptedEvents: ["format_test_result", "recovery_result", "seal_read_health"],
    producedRecords: ["format health", "recovery limitation", "test proposal"],
    adapter: "formatLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "SOLVED_CANONICAL_SUPPORT_BOUNDARY",
  }),
  dna({
    canonicalId: "image",
    turkishName: "Gorsel DNA",
    internalName: "Image DNA",
    scope: "Gorsel muhurleme, okuma, kirpma, sikistirma ve ekran/telefon donusumu ogrenmesi",
    dataSources: ["visual learning receipt", "image attack receipt", "image recovery receipt"],
    acceptedEvents: ["image_positive", "image_negative", "image_partial", "image_recovery"],
    producedRecords: ["image module health", "weak/strong signal", "recovery proposal"],
    adapter: "visualLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "EXISTING_READER_DECISION_PRESERVED",
  }),
  dna({
    canonicalId: "video",
    turkishName: "Video DNA",
    internalName: "Video DNA",
    scope: "Video Primary seal/read/recovery sonuclarinin advisory hafizasi; video motoruna yazma yetkisi yoktur",
    dataSources: ["Video Primary redacted receipt", "attack matrix receipt", "runtime gate receipt"],
    acceptedEvents: ["video_positive", "video_negative", "video_partial", "video_regression"],
    producedRecords: ["video health", "DO_NOT_REOPEN", "regression proposal"],
    prohibitions: ["Adapter C, PTS/time_base, Channel A/B veya video karar sistemini degistirmek"],
    adapter: "videoLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "SOLVED_CANONICAL_AT_E071FED7",
  }),
  dna({
    canonicalId: "audio",
    turkishName: "Ses DNA",
    internalName: "Audio DNA",
    scope: "Ses muhurleme/okuma, bitrate, noise, kesme ve donusum testlerinin advisory hafizasi",
    dataSources: ["audio learning receipt", "audio attack receipt", "audio negative receipt"],
    acceptedEvents: ["audio_positive", "audio_negative", "audio_partial", "audio_recovery"],
    producedRecords: ["audio health", "partial measurement", "test proposal"],
    adapter: "audioLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "EXISTING_READER_DECISION_PRESERVED",
  }),
  dna({
    canonicalId: "text-document",
    turkishName: "Metin / Dokuman DNA",
    internalName: "Text/Document DNA",
    scope: "Metin, dokuman, OCR ve export/copy-paste dayaniklilik sonuclarinin advisory hafizasi",
    dataSources: ["text learning receipt", "document receipt", "OCR support receipt"],
    acceptedEvents: ["text_positive", "text_negative", "text_partial", "ocr_support"],
    producedRecords: ["text health", "OCR limitation", "test proposal"],
    adapter: "textLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "EXISTING_READER_DECISION_PRESERVED",
  }),
  dna({
    canonicalId: "discovery-search",
    turkishName: "Kesif / Arama DNA",
    internalName: "Discovery/Search DNA",
    scope: "Yerel aday dogrulama, arama planlama ve provider hazirlik/freshness ogrenmesi",
    dataSources: ["local candidate receipt", "provider readiness", "Research Library metadata"],
    acceptedEvents: ["local_candidate", "provider_deferred", "candidate_negative"],
    producedRecords: ["candidate support", "provider readiness", "search proposal"],
    prohibitions: ["otomatik sikayet, DMCA, yaptirim veya dis provider cagrisi yapmak"],
    adapter: "discoverySearchLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "LOCAL_DISCOVERY_LEARNING_READY_EXTERNAL_PROVIDER_API_DEFERRED",
  }),
  dna({
    canonicalId: "tanclive",
    turkishName: "TancLive DNA",
    internalName: "TancLive DNA",
    scope: "Live/HLS/RTMP smoke, readiness ve guvenli handoff sonuclarinin advisory hafizasi",
    dataSources: ["live smoke receipt", "HLS receipt", "live readiness status"],
    acceptedEvents: ["live_positive", "live_negative", "live_deferred"],
    producedRecords: ["live health", "readiness limitation", "runbook proposal"],
    adapter: "liveLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "LOCAL_LIVE_LEARNING_READY_EXTERNAL_RUNTIME_DEFERRED",
  }),
  dna({
    canonicalId: "secure-room-zehir",
    turkishName: "Guvenli Oda / Zehir DNA",
    internalName: "Secure Room/Zehir DNA",
    scope: "Savunma amacli evidence toplama, zehir sinyali ve fail-closed guvenlik ogrenmesi",
    dataSources: ["redacted Secure Room receipt", "defensive poison receipt", "handoff receipt"],
    acceptedEvents: ["evidence_collected", "defensive_signal", "fail_closed"],
    producedRecords: ["support record", "risk warning", "manual review proposal"],
    prohibitions: ["offensive, hack veya zararli eylem uretmek"],
    adapter: "secureRoomLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "DEFENSIVE_SUPPORT_ONLY",
  }),
  dna({
    canonicalId: "evidence",
    turkishName: "Delil DNA",
    internalName: "Evidence/Delil DNA",
    scope: "PDF/evidence, C2PA ve OpenTimestamps provenance destek kayitlari",
    dataSources: ["evidence package receipt", "C2PA receipt", "timestamp receipt"],
    acceptedEvents: ["evidence_positive", "evidence_negative", "provenance_support"],
    producedRecords: ["evidence health", "provenance support", "limitation"],
    adapter: "evidenceLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "PROVENANCE_SUPPORT_ONLY",
  }),
  dna({
    canonicalId: "license-product-gate",
    turkishName: "Lisans / Urun Kapisi DNA",
    internalName: "License/Product Gate DNA",
    scope: "Lisans, ticari kullanim ve urun kapisi kanitlarinin freshness takibi",
    dataSources: ["license scan", "SBOM receipt", "product gate receipt", "Research Library metadata"],
    acceptedEvents: ["license_pass", "license_block", "license_changed", "source_stale"],
    producedRecords: ["license health", "gate warning", "review proposal"],
    adapter: "legalLicenseLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "LOCAL_LICENSE_GATE_READY",
  }),
  dna({
    canonicalId: "security",
    turkishName: "Guvenlik / Siber Savunma DNA",
    internalName: "Security DNA",
    scope: "Poisoning, prompt-injection, tenant izolasyonu ve savunma guvenligi olaylari",
    dataSources: ["security receipt", "negative control", "CVE/library metadata"],
    acceptedEvents: ["security_pass", "security_failure", "poisoning_attempt", "tenant_violation"],
    producedRecords: ["security health", "quarantine record", "manual engineering proposal"],
    prohibitions: ["offensive arac, exploit veya zararli talimat uretmek"],
    adapter: "securityLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "DEFENSIVE_ONLY",
  }),
  dna({
    canonicalId: "user-subscription",
    turkishName: "Kullanici / Abonelik DNA",
    internalName: "User/Subscription DNA",
    scope: "Tenant/client/user scope, abonelik yetkisi ve fail-closed erisim ogrenmesi",
    dataSources: ["authorization receipt", "subscription gate receipt", "tenant isolation test"],
    acceptedEvents: ["authorization_pass", "authorization_denied", "wrong_tenant"],
    producedRecords: ["access health", "tenant warning", "review proposal"],
    adapter: "userSubscriptionLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "TENANT_SCOPED_FAIL_CLOSED",
  }),
  dna({
    canonicalId: "pricing-cost",
    turkishName: "Fiyat / Maliyet DNA",
    internalName: "Pricing/Cost DNA",
    scope: "Olculmus kaynak maliyeti, performans ve margin advisory kayitlari",
    dataSources: ["performance receipt", "cost signal", "dependency/runtime measurement"],
    acceptedEvents: ["cost_measurement", "performance_measurement", "budget_warning"],
    producedRecords: ["cost health", "performance trend", "optimization proposal"],
    adapter: "costMarginLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "ADVISORY_ONLY",
  }),
  dna({
    canonicalId: "saas-operations",
    turkishName: "SaaS / Operasyon DNA",
    internalName: "SaaS/Operations DNA",
    scope: "Altyapi, queue, worker, lease, heartbeat ve operasyon sagligi",
    dataSources: ["runtime health", "worker receipt", "queue measurement", "restart test"],
    acceptedEvents: ["runtime_health", "worker_result", "queue_result", "restart_recovery"],
    producedRecords: ["infrastructure health", "queue health", "operations proposal"],
    adapter: "infrastructureLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "DISTRIBUTED_CONTRACT_READY_PRODUCTION_DEPLOYMENT_DEFERRED",
  }),
  dna({
    canonicalId: "product-marketing-legal",
    turkishName: "Urun / Pazarlama / Hukuk DNA",
    internalName: "Product/Marketing/Legal DNA",
    scope: "Urun dili, pazarlama iddialari, KVKK/GDPR dagitimi ve hukuki risk advisory kayitlari",
    dataSources: ["product report", "claim review", "legal metadata", "Research Library metadata"],
    acceptedEvents: ["claim_review", "product_status", "legal_warning", "compliance_signal"],
    producedRecords: ["claim health", "legal limitation", "owner review proposal"],
    adapter: "productMarketingLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-17T10:00:03+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "NO_SEPARATE_COMPLIANCE_DNA",
  }),
  dna({
    canonicalId: "codex-development",
    turkishName: "Codex / Gelistirme DNA",
    internalName: "Codex/Development DNA",
    scope: "Kod, test, build, commit, rollback ve onceki cozumleri yeniden acmama hafizasi",
    dataSources: ["typecheck/build receipt", "Git checkpoint", "rollback manifest", "owner instruction"],
    acceptedEvents: ["build_result", "test_result", "canonical_checkpoint", "regression"],
    producedRecords: ["development health", "prior solved lock", "engineering proposal"],
    adapter: "codexDevelopmentLearningAdapter",
    healthStatus: "HEALTHY",
    lastDataAt: "2026-08-27T00:00:00+03:00",
    testStatus: "TESTED",
    ownerApprovalClass: "SAFE_AUTOMATIC_LEARNING",
    currentState: "LOCAL_COMMIT_AND_ROLLBACK_AWARE",
  }),
] as const;

export const TANCMARK_16_DNA_REGISTRY_INVARIANTS = {
  registeredDnaCount: TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.length,
  chiefBrainCountedAsDna: false,
  researchLibraryCountedAsDna: false,
  unauthorizedSeventeenthDna: false,
} as const;

export function assertCanonicalDnaRegistry(): void {
  if (TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.length !== 16) {
    throw new Error("registeredDnaCount must be exactly 16");
  }
  const ids = new Set(TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.map((entry) => entry.canonicalId));
  if (ids.size !== 16) throw new Error("canonical DNA IDs must be unique");
  if (ids.has("chief-brain" as CanonicalDnaId)) throw new Error("Chief Brain is not a DNA");
  if (ids.has("research-library" as CanonicalDnaId)) throw new Error("Research Library is not a DNA");
  if (ids.has("compliance" as CanonicalDnaId)) throw new Error("no seventeenth Compliance DNA");
}

export function canonicalDnaById(id: CanonicalDnaId): CanonicalDnaRegistryEntry {
  const entry = TANCMARK_16_DNA_CANONICAL_REGISTRY_V1.find((item) => item.canonicalId === id);
  if (!entry) throw new Error(`unknown canonical DNA: ${id}`);
  return entry;
}

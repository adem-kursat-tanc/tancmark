import type { DiscoveryConfig } from "./config";
import { getDiscoveryProviders } from "./providerRegistry";
import {
  DISCOVERY_RUNTIME_ENV_KEYS,
  validateDiscoveryProviderEnv,
  type DiscoveryEnvLike,
} from "./providerEnvValidation";
import { buildDiscoveryProviderReadiness, type DiscoveryProviderReadinessStatus } from "./providerReadiness";
import type { DiscoveryLayer, DiscoveryProviderName } from "./types";

export interface DiscoveryProviderSetupChecklist {
  provider: DiscoveryProviderName;
  purpose: string;
  mediaLayer: DiscoveryLayer;
  requiredEnvKeys: string[];
  optionalEnvKeys: string[];
  missingEnvKeys: string[];
  hasRequiredKeys: boolean;
  realApiGloballyEnabled: boolean;
  readinessStatus: DiscoveryProviderReadinessStatus;
  mockAvailable: true;
  setupSteps: string[];
  safetyNotes: string[];
  canRunRealApiNow: boolean;
  reason: string;
  secretValuesHidden: true;
  externalApiCalled: false;
  supportOnly: true;
  decisionRole: "provider_setup_checklist_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

export interface DiscoveryProviderSetupSummary {
  totalProviders: number;
  readyProviders: number;
  missingKeyProviders: number;
  mockOnlyProviders: number;
  globallyRealApiEnabled: boolean;
  canAnyRealApiRun: boolean;
  nextHumanActions: string[];
  secretValuesHidden: true;
  externalApiCalled: false;
  supportOnly: true;
  decisionRole: "provider_setup_checklist_no_vault_no_confirmed";
  canOpenVault: false;
  confirmed: false;
  final: false;
}

interface ProviderSetupCopy {
  purpose: string;
  setupSteps: string[];
  safetyNotes: string[];
}

const PROVIDER_SETUP_COPY: Record<DiscoveryProviderName, ProviderSetupCopy> = {
  dataforseo: {
    purpose: "Gorsel, web ve video metadata aramasi icin aday URL bulur.",
    setupSteps: [
      "DataForSEO hesabi ac.",
      "DATAFORSEO_LOGIN ve DATAFORSEO_PASSWORD secret olarak ortama ekle.",
      "Gercek API icin DISCOVERY_ENABLE_REAL_API=true yapmadan once cost cap ve kullanici onayini kontrol et.",
    ],
    safetyNotes: [
      "Kesin karar vermez; sadece support/candidate sonuc uretir.",
      "Icerik kopyasi gonderilmez; hash/metadata veya izinli kisa sureli signed URL kullanilir.",
    ],
  },
  acrcloud: {
    purpose: "Private audio fingerprint ve custom bucket uzerinden ses adaylarini arar.",
    setupSteps: [
      "ACRCloud private/custom bucket hesabi hazirla.",
      "ACRCLOUD_ACCESS_KEY, ACRCLOUD_ACCESS_SECRET ve ACRCLOUD_CUSTOM_BUCKET_ID secret olarak ortama ekle.",
      "Custom bucket yoksa provider hazir sayilmaz.",
    ],
    safetyNotes: [
      "Kesin karar vermez; sadece audio support/candidate sonuc uretir.",
      "Raw full audio varsayilan olarak gonderilmez; fingerprint/metadata cizgisi korunur.",
    ],
  },
  brave: {
    purpose: "Metin ve web aramasi icin metadata tabanli aday URL bulur.",
    setupSteps: [
      "Brave Search API hesabi olustur.",
      "BRAVE_SEARCH_API_KEY secret olarak ortama ekle.",
      "Sorgular metadata/query turevleriyle sinirli kalir.",
    ],
    safetyNotes: [
      "Kesin karar vermez; sadece web/text support/candidate sonuc uretir.",
      "Orijinal dosya icerigi API'ye gonderilmez.",
    ],
  },
  exa: {
    purpose: "Benzer icerik, URL ve metin kesfi icin semantik adaylar bulur.",
    setupSteps: [
      "Exa API hesabi olustur.",
      "EXA_API_KEY secret olarak ortama ekle.",
      "Query, metadata veya izinli URL turevleriyle calistir.",
    ],
    safetyNotes: [
      "Kesin karar vermez; sadece benzerlik support/candidate sonuc uretir.",
      "C2PA/DNA/ECC gibi destekler gibi VAULT acmaz.",
    ],
  },
  apify_telegram: {
    purpose: "Acik Telegram kanal ve mesajlarinda aday paylasim izleri arar.",
    setupSteps: [
      "Apify hesabi ve Telegram arama actor hazirligi yap.",
      "APIFY_TOKEN secret olarak ortama ekle.",
      "Sorgular sadece metadata/query turevleriyle olusturulur.",
    ],
    safetyNotes: [
      "Kesin karar vermez; sadece public Telegram support/candidate sonuc uretir.",
      "Sadece acik/public kanal ve mesaj planina izin verilir.",
      "Kapali grup, ozel kanal, login, paywall veya DRM bypass yoktur.",
      "Otomatik Telegram sikayeti veya platform complaint API kullanmaz.",
    ],
  },
};

function reasonFor(
  provider: DiscoveryProviderName,
  realApiGloballyEnabled: boolean,
  missingEnvKeys: readonly string[],
  canRunRealApiNow: boolean,
): string {
  if (canRunRealApiNow) return `${provider} hazir: gerekli secret kayitlari var ve global real API anahtari acik.`;
  if (!realApiGloballyEnabled) {
    return "Gercek API genel anahtari kapali: DISCOVERY_ENABLE_REAL_API=false. Mock mod guvenli sekilde calisiyor.";
  }
  if (missingEnvKeys.length > 0) {
    return `${provider} hazir degil: eksik env key: ${missingEnvKeys.join(", ")}. Secret degerleri gizlendi.`;
  }
  return `${provider} guvenlik kapisinda bekliyor. Mock mod guvenli sekilde calisiyor.`;
}

export function buildDiscoveryProviderSetupChecklist(
  provider: DiscoveryProviderName,
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderSetupChecklist {
  const providerRecord = getDiscoveryProviders().find((item) => item.name === provider);
  if (!providerRecord) throw new Error(`Unknown discovery provider: ${provider}`);
  const copy = PROVIDER_SETUP_COPY[provider];
  const envValidation = validateDiscoveryProviderEnv(provider, config, env);
  const readiness = buildDiscoveryProviderReadiness(provider, config, env);
  const canRunRealApiNow = readiness.canExecuteRealCall;
  const setupSteps = [
    ...copy.setupSteps,
    "API key degerlerini koda yazma; secret/env yonetimine koy.",
    "Gercek API acilmadan once kullanici external search onayi ve cost cap korunmali.",
  ];
  const safetyNotes = [
    ...copy.safetyNotes,
    "DISCOVERY_ENABLE_REAL_API=false iken gercek dis API cagrisi yapilmaz.",
    "Secret degerleri response ve log icinde gosterilmez; sadece var/yok bilgisi doner.",
    "VAULT/confirmed/final karari degismez; TancMark ID eslesmesi olmadan kesin karar yoktur.",
    "TancMark polis degil, dedektiftir; otomatik DMCA/ihtar/sikayet gondermez.",
  ];
  return {
    provider,
    purpose: copy.purpose,
    mediaLayer: providerRecord.layer,
    requiredEnvKeys: envValidation.requiredEnvKeys,
    optionalEnvKeys: DISCOVERY_RUNTIME_ENV_KEYS,
    missingEnvKeys: envValidation.missingEnvKeys,
    hasRequiredKeys: envValidation.hasAllRequiredKeys,
    realApiGloballyEnabled: config.realApiEnabled,
    readinessStatus: readiness.readinessStatus,
    mockAvailable: true,
    setupSteps,
    safetyNotes,
    canRunRealApiNow,
    reason: reasonFor(provider, config.realApiEnabled, envValidation.missingEnvKeys, canRunRealApiNow),
    secretValuesHidden: true,
    externalApiCalled: false,
    supportOnly: true,
    decisionRole: "provider_setup_checklist_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

export function listDiscoveryProviderSetupChecklists(
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderSetupChecklist[] {
  return getDiscoveryProviders().map((provider) =>
    buildDiscoveryProviderSetupChecklist(provider.name, config, env),
  );
}

export function buildDiscoveryProviderSetupSummary(
  config: DiscoveryConfig,
  env: DiscoveryEnvLike = process.env,
): DiscoveryProviderSetupSummary {
  const providers = listDiscoveryProviderSetupChecklists(config, env);
  const readyProviders = providers.filter((provider) => provider.canRunRealApiNow).length;
  const missingKeyProviders = providers.filter((provider) => !provider.hasRequiredKeys).length;
  const mockOnlyProviders = providers.filter((provider) => provider.readinessStatus === "mock_only").length;
  const nextHumanActions: string[] = [];
  if (!config.realApiEnabled) {
    nextHumanActions.push("Gercek API icin once DISCOVERY_ENABLE_REAL_API=true yapilmalidir.");
  }
  for (const provider of providers.filter((item) => item.missingEnvKeys.length > 0)) {
    nextHumanActions.push(`${provider.provider}: eksik env key -> ${provider.missingEnvKeys.join(", ")}`);
  }
  nextHumanActions.push("Secret degerlerini koda yazma; env/secret yonetimine ekle.");
  nextHumanActions.push("Canli provider acmadan once kullanici external search onayi ve cost cap kontrolu yap.");
  return {
    totalProviders: providers.length,
    readyProviders,
    missingKeyProviders,
    mockOnlyProviders,
    globallyRealApiEnabled: config.realApiEnabled,
    canAnyRealApiRun: providers.some((provider) => provider.canRunRealApiNow),
    nextHumanActions,
    secretValuesHidden: true,
    externalApiCalled: false,
    supportOnly: true,
    decisionRole: "provider_setup_checklist_no_vault_no_confirmed",
    canOpenVault: false,
    confirmed: false,
    final: false,
  };
}

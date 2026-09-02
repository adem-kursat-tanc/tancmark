import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminToken } from "@/hooks/use-admin-token";
import { getAdminToken } from "@/lib/admin-token-store";
import { AlertTriangle, CheckCircle2, KeyRound, LockKeyhole, PlugZap, ShieldCheck } from "lucide-react";

type ProviderName = "dataforseo" | "acrcloud" | "brave" | "exa" | "apify_telegram";
type ReadinessStatus = "ready" | "missing_keys" | "mock_only" | "disabled_by_safety_gate";

type ProviderSetupChecklist = {
  provider: ProviderName;
  purpose: string;
  mediaLayer: string;
  requiredEnvKeys: string[];
  optionalEnvKeys: string[];
  missingEnvKeys: string[];
  hasRequiredKeys: boolean;
  realApiGloballyEnabled: boolean;
  readinessStatus: ReadinessStatus;
  mockAvailable: true;
  setupSteps: string[];
  safetyNotes: string[];
  canRunRealApiNow: boolean;
  reason: string;
  secretValuesHidden: true;
  externalApiCalled: false;
  supportOnly: true;
  canOpenVault: false;
  confirmed: false;
  final: false;
};

type ProviderSetupSummary = {
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
  canOpenVault: false;
  confirmed: false;
  final: false;
};

type ProviderSetupResponse = {
  providers: ProviderSetupChecklist[];
  summary: ProviderSetupSummary;
};

const providerLabels: Record<ProviderName, string> = {
  dataforseo: "DataForSEO",
  acrcloud: "ACRCloud",
  brave: "Brave Search",
  exa: "Exa",
  apify_telegram: "Apify Telegram",
};

const statusLabels: Record<ReadinessStatus, string> = {
  ready: "Hazir",
  missing_keys: "API key eksik",
  mock_only: "Mock modda",
  disabled_by_safety_gate: "Guvenlik nedeniyle bloklu",
};

function statusClass(status: ReadinessStatus): string {
  if (status === "ready") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
  if (status === "missing_keys") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  if (status === "disabled_by_safety_gate") return "border-red-500/40 bg-red-500/10 text-red-700";
  return "border-sky-500/40 bg-sky-500/10 text-sky-700";
}

function yesNo(value: boolean): string {
  return value ? "Evet" : "Hayir";
}

function envList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Eksik env key yok";
}

export default function DiscoveryProviderSetupPage() {
  const { hasToken } = useAdminToken();
  const query = useQuery({
    queryKey: ["discovery-provider-setup"],
    enabled: hasToken,
    retry: false,
    queryFn: async (): Promise<ProviderSetupResponse> => {
      const token = getAdminToken();
      const headers: HeadersInit = token ? { "x-admin-token": token } : {};
      const [checklistRes, summaryRes] = await Promise.all([
        fetch("/api/tancmark/discovery/providers/setup-checklist", { headers }),
        fetch("/api/tancmark/discovery/providers/setup-summary", { headers }),
      ]);
      if (!checklistRes.ok || !summaryRes.ok) {
        const status = !checklistRes.ok ? checklistRes.status : summaryRes.status;
        const error = new Error(`Discovery provider hazirlik bilgisi okunamadi (${status})`);
        (error as Error & { status?: number }).status = status;
        throw error;
      }
      const checklistJson = (await checklistRes.json()) as { providers: ProviderSetupChecklist[] };
      const summaryJson = (await summaryRes.json()) as { summary: ProviderSetupSummary };
      return {
        providers: checklistJson.providers,
        summary: summaryJson.summary,
      };
    },
  });

  const providers = query.data?.providers ?? [];
  const summary = query.data?.summary;

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-7xl mx-auto space-y-6" data-testid="discovery-provider-setup-page">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <PlugZap className="w-8 h-8 text-primary" />
            Discovery API Hazirlik Paneli
          </h1>
          <p className="text-muted-foreground">
            Harici arama provider'larinin hazirlik durumunu gosterir; bu ekran gercek API cagrisi yapmaz.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground space-y-1">
            <p>
              TancMark polis degil, dedektiftir: supheli linkleri ve delil taslagini hazirlar,
              gonderme karari kullanicidadir.
            </p>
            <p>
              TancMark otomatik DMCA/ihtar/sikayet gondermez; Discovery sonuclari
              candidate/support seviyesindedir.
            </p>
            <p>
              Gercek API baglantilari lansmandan yaklasik 1 hafta once yapilacaktir. Su an sistem
              mock/safety modunda tutulur.
            </p>
            <p>
              API keyler guvenli env/secret ayarlarina girilmeli. Bu panel API key degeri gostermez,
              provider execute etmez ve VAULT/confirmed/final kararlarini etkilemez.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Gercek API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {query.isLoading ? "..." : summary?.globallyRealApiEnabled ? "Acik" : "Kapali"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Once tek provider pilot yapilmali.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Hazir Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-semibold">
                {query.isLoading ? "..." : `${summary?.readyProviders ?? 0}/${summary?.totalProviders ?? 0}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hazir olsa bile safety gate ayrica gereklidir.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Mock Mod</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-semibold">
                {query.isLoading ? "..." : summary?.mockOnlyProviders ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mock mod gercek dis API kullanmaz.</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Secret Gizliligi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-2xl font-semibold">
                <LockKeyhole className="w-5 h-5 text-emerald-600" />
                {query.isLoading ? "..." : summary?.secretValuesHidden ? "Gizli" : "Kontrol et"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sadece env key isimleri gosterilir.</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {providers.map((provider) => (
            <Card key={provider.provider} className="bg-card/50 border-border/50">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-tight">{providerLabels[provider.provider]}</CardTitle>
                  <Badge variant="outline" className={statusClass(provider.readinessStatus)}>
                    {statusLabels[provider.readinessStatus]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground min-h-10">{provider.purpose}</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Medya katmani</div>
                  <div className="font-medium">{provider.mediaLayer}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Eksik env key</div>
                  <div className="font-mono text-xs break-words">{envList(provider.missingEnvKeys)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Gercek API simdi calisir mi?</div>
                  <div className="font-medium">{yesNo(provider.canRunRealApiNow)}</div>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed">
                  {provider.reason}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Mock var
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <KeyRound className="w-3 h-3" />
                    Secret gizli
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Karar degil
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Sonraki insan aksiyonlari</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.nextHumanActions?.length ? (
              <ul className="grid gap-2 text-sm text-foreground">
                {summary.nextHumanActions.map((action) => (
                  <li key={action} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {query.isLoading ? "Hazirlik bilgileri okunuyor..." : "Bekleyen insan aksiyonu yok."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

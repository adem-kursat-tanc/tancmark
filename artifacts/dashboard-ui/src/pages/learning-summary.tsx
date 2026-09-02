import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Lightbulb, Radar, TrendingUp } from "lucide-react";

type LearningSummary = {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  classicVaultCount?: number;
  visualVaultCount?: number;
  dnaVaultCount?: number;
  multiChannelVaultCount?: number;
  vaultRate: number;
  idMatchRate: number;
  dnaRecordRate: number;
  avgStrongFrames: number;
  avgVaultFrames: number;
  latestPath: string;
  mostCommonWarning: string;
  recommendation: string;
  latestSuggestion?: {
    suggestion: string;
    severity: string;
    status: string;
  } | null;
  highestPrioritySuggestion?: {
    suggestion: string;
    severity: string;
    status: string;
  } | null;
  pendingSuggestionCount: number;
  approvedSuggestionCount: number;
  completedSuggestionCount: number;
  dnaShadowComparisonCount?: number;
  dnaShadowPredictionMatched?: number;
  dnaPlacementPilotCount?: number;
  dnaActivePilotTraceCount?: number;
  latestDnaPilotTrace?: {
    verdict?: string | null;
    matchingBits?: number | null;
    idMatched?: boolean | null;
    selectedRegionId?: string | null;
    bestGeometryVariant?: string | null;
    canOpenVault?: boolean | null;
  } | null;
  latestDnaShadowLearning?: {
    scenario?: string | null;
    prediction?: string | null;
    matched?: boolean;
    lesson?: string | null;
    weakChannel?: string | null;
    rescuedBy?: string | null;
    suggestedNextStep?: string | null;
    placementPilot?: {
      enabled?: boolean;
      candidateRegions?: string[];
      candidateFrameCount?: number;
      differsFromCurrentPlacement?: boolean;
      appliedToSeal?: boolean;
      measuredEffect?: string;
      learningNote?: string;
    } | null;
  } | null;
  executionMode?: {
    activeMode?: string;
    modes?: {
      product?: { purpose?: string; heavyTelemetry?: boolean };
      test?: { purpose?: string; heavyTelemetry?: boolean };
      learning?: { purpose?: string; heavyTelemetry?: boolean };
    };
    safety?: {
      dnaCanOpenVault?: boolean;
      dnaCanOpenDnaVault?: boolean;
      pilotTraceCanOpenVault?: boolean;
      idMatchRequiredForVault?: boolean;
    };
  };
  shortComment: string;
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function number(value: number): string {
  return value.toFixed(1);
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function LearningSummaryPage() {
  const query = useQuery({
    queryKey: ["learning-summary"],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<LearningSummary> => {
      const token = getAdminToken();
      const res = await fetch("/api/aegis/video-lab/learning-summary", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        throw new Error(`Ogrenme ozeti okunamadi (${res.status})`);
      }
      return res.json();
    },
  });

  const data = query.data;

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            Ogrenme Ozeti
          </h1>
          <p className="text-muted-foreground mt-2">
            Kayitli mini testlerden cikarilan basit TancMark yorumu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Toplam test" value={data?.totalTests ?? "-"} />
          <Stat label="Basarili test" value={data?.successfulTests ?? "-"} />
          <Stat label="Basarisiz test" value={data?.failedTests ?? "-"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Stat label="Klasik kesin eslesme" value={data?.classicVaultCount ?? "-"} />
          <Stat label="Gorsel kesin eslesme" value={data?.visualVaultCount ?? "-"} />
          <Stat label="DNA kesin eslesme" value={data?.dnaVaultCount ?? "-"} />
          <Stat
            label="Coklu kanal eslesme"
            value={data?.multiChannelVaultCount ?? "-"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Basari orani"
            value={data ? percent(data.vaultRate) : "-"}
          />
          <Stat
            label="ID eslesme orani"
            value={data ? percent(data.idMatchRate) : "-"}
          />
          <Stat
            label="DNA kayit orani"
            value={data ? percent(data.dnaRecordRate) : "-"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Stat
            label="Ortalama strongFrames"
            value={data ? number(data.avgStrongFrames) : "-"}
          />
          <Stat
            label="Ortalama kilit karesi"
            value={data ? number(data.avgVaultFrames) : "-"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Stat
            label="Bekleyen oneriler"
            value={data?.pendingSuggestionCount ?? "-"}
          />
          <Stat
            label="Onaylanan oneriler"
            value={data?.approvedSuggestionCount ?? "-"}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Stat
            label="Tamamlanan oneriler"
            value={data?.completedSuggestionCount ?? "-"}
          />
          <Stat
            label="En yuksek oncelik"
            value={data?.highestPrioritySuggestion?.severity ?? "-"}
          />
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Son Oneri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Badge variant="outline" className="text-sm">
                {data?.latestPath ?? "Bilinmiyor"}
              </Badge>
            </div>
            <div className="text-lg font-medium" data-testid="learning-recommendation">
              {data?.recommendation ?? "Oneri yok"}
            </div>
            <div className="text-sm text-muted-foreground">
              En sik uyari: {data?.mostCommonWarning ?? "-"}
            </div>
            <div className="text-sm text-muted-foreground">
              En yuksek oncelikli oneri:{" "}
              {data?.highestPrioritySuggestion?.suggestion ?? "-"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-primary" />
              DNA Golge Mod
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Karsilastirma: {data?.dnaShadowComparisonCount ?? 0}
              </Badge>
              <Badge variant="outline">
                Kucuk yetki: {data?.dnaPlacementPilotCount ?? 0}
              </Badge>
              <Badge variant="outline">
                Aktif iz: {data?.dnaActivePilotTraceCount ?? 0}
              </Badge>
              <Badge variant={data?.latestDnaShadowLearning?.matched ? "default" : "outline"}>
                Son tahmin: {data?.latestDnaShadowLearning?.matched ? "uyumlu" : "beklemede"}
              </Badge>
            </div>
            <div className="text-sm text-foreground">
              {data?.latestDnaShadowLearning?.lesson ??
                "DNA golge mod henuz karsilastirma kaydi uretmedi."}
            </div>
            <div className="text-sm text-muted-foreground">
              Zayif kanal: {data?.latestDnaShadowLearning?.weakChannel ?? "-"} ·
              Kurtaran: {data?.latestDnaShadowLearning?.rescuedBy ?? "-"}
            </div>
            <div className="text-sm text-muted-foreground">
              Sonraki kucuk adim:{" "}
              {data?.latestDnaShadowLearning?.suggestedNextStep ?? "-"}
            </div>
            <div className="text-sm text-muted-foreground">
              Pilot durum:{" "}
              {data?.latestDnaShadowLearning?.placementPilot?.enabled
                ? "acik, aday plan kaydedildi"
                : "kapali"}{" "}
              · Muhur degisti mi:{" "}
              {data?.latestDnaShadowLearning?.placementPilot?.appliedToSeal
                ? "evet"
                : "hayir"}
            </div>
            <div className="text-sm text-muted-foreground">
              Pilot iz: {data?.latestDnaPilotTrace?.verdict ?? "-"} · Bit:{" "}
              {data?.latestDnaPilotTrace?.matchingBits ?? "-"} / 32 · Kilit
              kapisi:{" "}
              {data?.latestDnaPilotTrace?.canOpenVault ? "acik" : "kapali"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-primary" />
              Calisma Modlari
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={data?.executionMode?.activeMode === "product" ? "default" : "outline"}>
                Product
              </Badge>
              <Badge variant={data?.executionMode?.activeMode === "test" ? "default" : "outline"}>
                Test
              </Badge>
              <Badge variant={data?.executionMode?.activeMode === "learning" ? "default" : "outline"}>
                Learning
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              ID sart:{" "}
              {data?.executionMode?.safety?.idMatchRequiredForVault
                ? "korunuyor"
                : "bilinmiyor"}{" "}
              · DNA kilit kapisi:{" "}
              {data?.executionMode?.safety?.dnaCanOpenVault ? "acik" : "kapali"}{" "}
              · DNA kesin eslesme yolu:{" "}
              {data?.executionMode?.safety?.dnaCanOpenDnaVault
                ? "acik"
                : "kapali"}{" "}
              · Pilot klasik kilit kapisi:{" "}
              {data?.executionMode?.safety?.pilotTraceCanOpenVault
                ? "acik"
                : "kapali"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Son 10 Test Yorumu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-foreground">
              {data?.shortComment ?? "Henuz yorum yok."}
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

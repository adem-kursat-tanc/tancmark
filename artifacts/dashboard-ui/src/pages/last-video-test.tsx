import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, FileVideo, ShieldCheck } from "lucide-react";

type LastVideoTest = {
  fileName?: string;
  testTime?: string;
  verdict?: "VAULT" | "NOT_FOUND" | "WEAK_SIGNAL" | string;
  mainVerdict?: string;
  finalDecision?: { decision?: string; confirmedBy?: string; note?: string };
  idMatched?: boolean;
  dnaRecordPresent?: boolean;
  dbRecordPresent?: boolean;
  stampedFrameCount?: number;
  strongFrames?: number;
  vaultFrames?: number;
  apiOk?: boolean;
  dbDnaRows?: number;
  durationMs?: number;
  note?: string | null;
  commonMediaDecision?: {
    modules?: Array<{
      module?: string;
      status?: string;
      role?: string;
      reason?: string;
      seal?: {
        actual?: string;
        independentSealCount?: number;
        sealIndependent?: boolean;
        sealOverlaps?: boolean;
      };
      search?: {
        result?: string;
        idMatched?: boolean;
        candidateOnly?: boolean;
      };
    }>;
    collisionReport?: { hasCollision?: boolean; note?: string };
    dnaCommonPlan?: {
      suggestedPlacement?: string[];
      riskyRegions?: string[];
      finalRule?: string;
    };
    officialDecision?: {
      finalDecision?: string;
      idlessOfficialVault?: boolean;
      falseVault?: boolean;
    };
  };
};

function yesNo(value: boolean | undefined): string {
  if (value === true) return "Evet";
  if (value === false) return "Hayir";
  return "Bilinmiyor";
}

function displayDecision(value: unknown): string {
  if (typeof value !== "string") return "-";
  if (["VAULT", "VISUAL_VAULT", "DNA_VAULT", "MULTI_CHANNEL_VAULT"].includes(value)) {
    return "Kesin eslesme bulundu";
  }
  if (value === "NOT_FOUND") return "Kesin sonuc yok";
  if (value === "WEAK_SIGNAL") return "Aday iz bulundu";
  return value.replace(/_/g, " ").toLowerCase();
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-semibold font-mono break-words">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export default function LastVideoTestPage() {
  const query = useQuery({
    queryKey: ["last-video-test"],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<LastVideoTest> => {
      const token = getAdminToken();
      const res = await fetch("/api/aegis/video-lab/latest-test", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        throw new Error(`Son video testi okunamadi (${res.status})`);
      }
      return res.json();
    },
  });

  const data = query.data;
  const verdict = data?.verdict ?? "Bilinmiyor";
  const isVault =
    verdict === "VAULT" ||
    verdict === "VISUAL_VAULT" ||
    verdict === "DNA_VAULT" ||
    verdict === "MULTI_CHANNEL_VAULT";
  const common = data?.commonMediaDecision;
  const modules = common?.modules ?? [];

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Son Video Testi
          </h1>
          <p className="text-muted-foreground mt-2">
            Yerel bilgisayarda yapilan en son kucuk video muhur testinin ozeti.
          </p>
        </div>

        {common && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Ortak Karar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Stat
                  label="Cakisma var mi?"
                  value={yesNo(common.collisionReport?.hasCollision)}
                />
                <Stat
                  label="ID olmadan resmi sonuc?"
                  value={yesNo(common.officialDecision?.idlessOfficialVault)}
                />
                <Stat
                  label="Yanlis kesin eslesme"
                  value={yesNo(common.officialDecision?.falseVault)}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2 pr-4">Modul</th>
                      <th className="text-left py-2 pr-4">Durum</th>
                      <th className="text-left py-2 pr-4">Muhur</th>
                      <th className="text-left py-2 pr-4">Arama</th>
                      <th className="text-left py-2">Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {modules.map((module, idx) => (
                      <tr key={`${module.module ?? "module"}-${idx}`}>
                        <td className="py-2 pr-4 font-mono">{module.module ?? "-"}</td>
                        <td className="py-2 pr-4">{module.status ?? "-"}</td>
                        <td className="py-2 pr-4 text-xs">
                          {module.seal?.actual ?? "-"} /{" "}
                          {yesNo(module.seal?.sealIndependent)}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {module.search?.result ?? "-"} / ID{" "}
                          {yesNo(module.search?.idMatched)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground min-w-[240px]">
                          {module.reason ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-muted-foreground">
                DNA onerisi:{" "}
                <span className="font-mono">
                  {(common.dnaCommonPlan?.suggestedPlacement ?? [])
                    .slice(0, 4)
                    .join(", ") || "-"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-primary" />
              Test Sonucu
            </CardTitle>
            <Badge
              variant={isVault ? "default" : "outline"}
              data-testid="last-video-verdict"
            >
              {displayDecision(verdict)}
            </Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat label="ID eslesti mi?" value={yesNo(data?.idMatched)} />
            <Stat
              label="Ana Kanal A/B sonucu"
              value={displayDecision(data?.mainVerdict ?? verdict)}
            />
            <Stat
              label="DNA kaydi olustu mu?"
              value={yesNo(data?.dnaRecordPresent)}
            />
            <Stat
              label="Veritabani kaydi var mi?"
              value={yesNo(data?.dbRecordPresent)}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat
            label="Kac kare muhurlendi?"
            value={data?.stampedFrameCount ?? "-"}
          />
          <Stat label="Guclu kare sayisi" value={data?.strongFrames ?? "-"} />
          <Stat label="Kilit karesi sayisi" value={data?.vaultFrames ?? "-"} />
          <Stat
            label="Sure"
            value={
              typeof data?.durationMs === "number" && data.durationMs > 0
                ? `${Math.round(data.durationMs / 1000)} sn`
                : "-"
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Dosya ve Zaman
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">
                  Test edilen dosya
                </div>
                <div className="font-mono mt-1 break-words">
                  {data?.fileName ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Test zamani</div>
                <div className="font-mono mt-1">
                  {data?.testTime
                    ? new Date(data.testTime).toLocaleString("tr-TR")
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Not</div>
                <div className="mt-1">{data?.note ?? "-"}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Sistem Durumu
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Stat label="API calisiyor mu?" value={yesNo(data?.apiOk)} />
              <Stat
                label="DNA satir sayisi"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    {data?.dbDnaRows ?? "-"}
                  </span>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}

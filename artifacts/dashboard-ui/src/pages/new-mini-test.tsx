import React, { useState } from "react";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FileVideo, PlayCircle } from "lucide-react";

type MiniTestResult = {
  fileName?: string;
  testTime?: string;
  verdict?: string;
  mainVerdict?: string;
  finalDecision?: { decision?: string; confirmedBy?: string; note?: string };
  idMatched?: boolean;
  dnaRecordPresent?: boolean;
  dbRecordPresent?: boolean;
  stampedFrameCount?: number;
  strongFrames?: number;
  vaultFrames?: number;
  durationMs?: number;
  note?: string | null;
  commonMediaDecision?: {
    modules?: Array<{
      module?: string;
      status?: string;
      seal?: { actual?: string; sealIndependent?: boolean; sealOverlaps?: boolean };
      search?: { result?: string; idMatched?: boolean; candidateOnly?: boolean };
      reason?: string;
    }>;
    collisionReport?: { hasCollision?: boolean; note?: string };
    officialDecision?: { idlessOfficialVault?: boolean; falseVault?: boolean };
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

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
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

export default function NewMiniTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MiniTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runMiniTest() {
    if (!file) {
      setError("Once bir video sec.");
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    const token = getAdminToken();
    const body = new FormData();
    body.append("video", file);
    body.append("stampCount", "24");

    try {
      const res = await fetch("/api/aegis/video-lab/mini-test", {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Mini test basarisiz (${res.status})`);
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const verdict = result?.verdict ?? "-";
  const isVault =
    verdict === "VAULT" ||
    verdict === "VISUAL_VAULT" ||
    verdict === "DNA_VAULT" ||
    verdict === "MULTI_CHANNEL_VAULT";

  return (
    <AdminGuard error={error ? { status: 500 } : undefined}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <FileVideo className="w-8 h-8 text-primary" />
            Yeni Mini Test
          </h1>
          <p className="text-muted-foreground mt-2">
            Tek video ile kucuk muhurle ve geri oku testi. Buyuk test degildir.
          </p>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Video Sec</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              data-testid="input-mini-test-video"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={runMiniTest}
                disabled={!file || running}
                data-testid="btn-run-mini-test"
              >
                <PlayCircle className="w-4 h-4" />
                {running ? "Calisiyor..." : "Mini Testi Baslat"}
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground font-mono">
                  {file.name}
                </span>
              )}
            </div>
            {error && (
              <div className="text-sm text-destructive" data-testid="mini-test-error">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-6" data-testid="mini-test-result">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Test Sonucu</CardTitle>
                <Badge variant={isVault ? "default" : "outline"}>
                  {displayDecision(verdict)}
                </Badge>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Stat label="ID eslesti mi?" value={yesNo(result.idMatched)} />
                <Stat
                  label="Ana Kanal A/B sonucu"
                  value={displayDecision(result.mainVerdict ?? verdict)}
                />
                <Stat
                  label="DNA kaydi olustu mu?"
                  value={yesNo(result.dnaRecordPresent)}
                />
                <Stat
                  label="Veritabani kaydi var mi?"
                  value={yesNo(result.dbRecordPresent)}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Stat
                label="Muhurlenen kare"
                value={result.stampedFrameCount ?? "-"}
              />
              <Stat label="Guclu kare sayisi" value={result.strongFrames ?? "-"} />
              <Stat label="Kilit karesi sayisi" value={result.vaultFrames ?? "-"} />
              <Stat
                label="Sure"
                value={
                  typeof result.durationMs === "number"
                    ? `${Math.round(result.durationMs / 1000)} sn`
                    : "-"
                }
              />
            </div>

            {result.commonMediaDecision && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle>Ortak Karar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Stat
                      label="Cakisma var mi?"
                      value={yesNo(result.commonMediaDecision.collisionReport?.hasCollision)}
                    />
                    <Stat
                      label="ID olmadan resmi sonuc?"
                      value={yesNo(result.commonMediaDecision.officialDecision?.idlessOfficialVault)}
                    />
                    <Stat
                      label="Yanlis kesin eslesme"
                      value={yesNo(result.commonMediaDecision.officialDecision?.falseVault)}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left py-2 pr-4">Modul</th>
                          <th className="text-left py-2 pr-4">Durum</th>
                          <th className="text-left py-2 pr-4">Muhur</th>
                          <th className="text-left py-2">Arama</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(result.commonMediaDecision.modules ?? []).map((module, idx) => (
                          <tr key={`${module.module ?? "module"}-${idx}`}>
                            <td className="py-2 pr-4 font-mono">{module.module ?? "-"}</td>
                            <td className="py-2 pr-4">{module.status ?? "-"}</td>
                            <td className="py-2 pr-4 text-xs">
                              {module.seal?.actual ?? "-"} / {yesNo(module.seal?.sealIndependent)}
                            </td>
                            <td className="py-2 text-xs">
                              {module.search?.result ?? "-"} / ID {yesNo(module.search?.idMatched)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dosya:</span>{" "}
                  <span className="font-mono">{result.fileName ?? "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zaman:</span>{" "}
                  <span className="font-mono">
                    {result.testTime
                      ? new Date(result.testTime).toLocaleString("tr-TR")
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Not:</span>{" "}
                  {result.note ?? "-"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}

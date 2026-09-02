import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ShieldCheck } from "lucide-react";

type TestHistoryRow = {
  id: number;
  testTime: string;
  fileName: string;
  verdict: string;
  idMatched: boolean;
  dnaRecordPresent: boolean;
  dbRecordPresent: boolean;
  stampedFrameCount: number;
  strongFrames: number;
  vaultFrames: number;
  pathLabel: string;
  durationMs?: number;
  note?: string | null;
};

type TestHistoryResponse = {
  tests: TestHistoryRow[];
};

function yesNo(value: boolean): string {
  return value ? "Evet" : "Hayir";
}

function isOfficialVault(verdict: string): boolean {
  return (
    verdict === "VAULT" ||
    verdict === "VISUAL_VAULT" ||
    verdict === "DNA_VAULT" ||
    verdict === "MULTI_CHANNEL_VAULT"
  );
}

function displayDecision(value: string): string {
  if (isOfficialVault(value)) return "Kesin eslesme bulundu";
  if (value === "NOT_FOUND") return "Kesin sonuc yok";
  if (value === "WEAK_SIGNAL") return "Aday iz bulundu";
  return value.replace(/_/g, " ").toLowerCase();
}

export default function TestHistoryPage() {
  const query = useQuery({
    queryKey: ["test-history"],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<TestHistoryResponse> => {
      const token = getAdminToken();
      const res = await fetch("/api/aegis/video-lab/test-history?limit=10", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        throw new Error(`Test gecmisi okunamadi (${res.status})`);
      }
      return res.json();
    },
  });

  const tests = query.data?.tests ?? [];

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Test Gecmisi
          </h1>
          <p className="text-muted-foreground mt-2">
            Son 10 kucuk TancMark video testinin kalici kayit ozeti.
          </p>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Son 10 Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading && (
              <div className="p-6 text-center text-muted-foreground">
                Yukleniyor...
              </div>
            )}
            {!query.isLoading && tests.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                Test kaydi bulunamadi.
              </div>
            )}
            {tests.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-3 pr-4">Zaman</th>
                      <th className="text-left py-3 pr-4">Dosya</th>
                      <th className="text-left py-3 pr-4">Sonuc</th>
                      <th className="text-left py-3 pr-4">ID</th>
                      <th className="text-left py-3 pr-4">DNA</th>
                      <th className="text-right py-3 pr-4">Kare</th>
                      <th className="text-right py-3 pr-4">Guclu kare</th>
                      <th className="text-right py-3 pr-4">Kilit karesi</th>
                      <th className="text-right py-3 pr-4">Sure</th>
                      <th className="text-left py-3">Yol</th>
                      <th className="text-left py-3">Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tests.map((test) => (
                      <tr key={test.id} data-testid="test-history-row">
                        <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap">
                          {new Date(test.testTime).toLocaleString("tr-TR")}
                        </td>
                        <td className="py-3 pr-4 min-w-[220px]">
                          {test.fileName}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={isOfficialVault(test.verdict) ? "default" : "outline"}
                          >
                            {displayDecision(test.verdict)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">{yesNo(test.idMatched)}</td>
                        <td className="py-3 pr-4">
                          {yesNo(test.dnaRecordPresent && test.dbRecordPresent)}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono">
                          {test.stampedFrameCount}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono">
                          {test.strongFrames}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono">
                          {test.vaultFrames}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono">
                          {typeof test.durationMs === "number" && test.durationMs > 0
                            ? `${Math.round(test.durationMs / 1000)} sn`
                            : "-"}
                        </td>
                        <td className="py-3 font-mono text-xs whitespace-nowrap">
                          {test.pathLabel}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground min-w-[180px]">
                          {test.note ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

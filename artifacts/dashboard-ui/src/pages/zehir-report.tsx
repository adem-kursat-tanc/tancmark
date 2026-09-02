import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { useAdminToken } from "@/hooks/use-admin-token";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, MonitorCheck } from "lucide-react";

type ZehirDisplayRow = {
  auditId: number;
  timestamp: string;
  eventType: string;
  label: string;
  displayStatus: "Aday destek sinyali";
  nonFinalStatus?: "Kesin sonuç değildir";
  fileId: string | null;
  copyId: string | null;
  sessionId: string | null;
  userId: string | null;
  screenSessionId: string | null;
  signalType: string | null;
  sourceModules: string[];
  triggerMode: "manual" | "automatic_candidate" | null;
  protectionLevel: "light" | "medium" | "hard" | null;
  protectionLabel:
    | "Hafif koruma seviyesi"
    | "Orta koruma seviyesi"
    | "Sert koruma seviyesi"
    | null;
  reason: string | null;
  countdownSeconds: 30 | null;
  cancelAvailable: true | null;
  reversible: true | null;
  rollbackWindowHours: 24 | null;
  rollbackAvailable: true | null;
  rollbackStatus: "available" | "rollback_requested" | null;
  automaticProtectionCandidate: true | null;
  protectionNotice: "Bu içerik yetkisiz erişim koruma modunda görüntüleniyor olabilir." | null;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  confirmed: false;
  idMatched: false;
  canOpenVault: false;
  vaultCapable: false;
};

type ZehirDisplayReport = {
  status: "ZEHIR_DISPLAY_READ_ONLY";
  title: "Zehir / Ekran-Oturum Aday Kayıtları";
  safetyNotice: string;
  rows: ZehirDisplayRow[];
  counts: {
    totalRows: number;
    candidateSupport: number;
    confirmed: 0;
    vaultCapable: 0;
    canOpenVault: 0;
  };
  safety: {
    readOnlyDisplay: true;
    zehirDoesNotConfirm: true;
    zehirDoesNotOpenVault: true;
    idRequiredForVault: true;
    candidateSupportIsNotConfirmed: true;
  };
};

type ZehirReportResponse = {
  ok: true;
  report: ZehirDisplayReport;
};

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

export default function ZehirReportPage() {
  const { hasToken } = useAdminToken();
  const query = useQuery({
    queryKey: ["zehir-report"],
    enabled: hasToken,
    retry: false,
    refetchInterval: (state) => (state.state.error ? false : 5000),
    queryFn: async (): Promise<ZehirReportResponse> => {
      const token = getAdminToken();
      const res = await fetch("/api/aegis/secure-room/zehir-report?limit=25", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        const error = new Error(`Zehir kayıtları okunamadı (${res.status})`);
        (error as Error & { status?: number }).status = res.status;
        throw error;
      }
      return res.json();
    },
  });

  const report = query.data?.report;
  const rows = report?.rows ?? [];

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <MonitorCheck className="w-8 h-8 text-primary" />
            Koruma Kayıtları
          </h1>
          <p className="text-muted-foreground mt-2">
            Koruma, ekran oturumu ve geri alma kayıtlarını sade şekilde gösterir;
            karar üretmez.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            {report?.safetyNotice ??
              "Bu bölüm yalnız aday destek kayıtları içerir. Kesin sonuç sadece ID okunup sistem ID'siyle eşleşirse oluşur."}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Toplam Kayıt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.totalRows ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Aday Destek</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.candidateSupport ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Kimlik Eşleşmesi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.confirmed ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Kilit Açma Yetkisi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.canOpenVault ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Koruma Olayları
              <Badge variant="outline">Aday destek</Badge>
              <Badge variant="outline">Sadece kayıt</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading && (
              <div className="p-6 text-center text-muted-foreground">Yükleniyor...</div>
            )}
            {!query.isLoading && rows.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                Koruma kaydı bulunamadı.
              </div>
            )}
            {rows.length > 0 && (
              <div className="overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaman</TableHead>
                      <TableHead>Olay</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Dosya/Kopya</TableHead>
                      <TableHead>Oturum</TableHead>
                      <TableHead>Güvenlik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.auditId} data-testid="zehir-report-row">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatTime(row.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.label}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            koruma kaydı
                          </div>
                          {row.reason && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Sebep: {row.reason}
                            </div>
                          )}
                          {row.protectionNotice && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {row.protectionNotice}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{row.displayStatus}</Badge>
                            {row.triggerMode === "manual" && (
                              <Badge variant="outline">Manuel koruma tetiklendi</Badge>
                            )}
                            {row.triggerMode === "automatic_candidate" && (
                              <Badge variant="outline">Otomatik koruma adayı</Badge>
                            )}
                            {row.protectionLabel && (
                              <Badge variant="outline">{row.protectionLabel}</Badge>
                            )}
                            {row.countdownSeconds && (
                              <Badge variant="outline">
                                {row.countdownSeconds} saniye geri sayım
                              </Badge>
                            )}
                            {row.cancelAvailable && (
                              <Badge variant="outline">İptal edilebilir</Badge>
                            )}
                            {row.reversible && (
                              <Badge variant="outline">Geri alınabilir</Badge>
                            )}
                            {row.rollbackWindowHours && (
                              <Badge variant="outline">
                                {row.rollbackWindowHours} saat geri alma
                              </Badge>
                            )}
                            {row.rollbackStatus === "rollback_requested" && (
                              <Badge variant="outline">Geri alma kaydı</Badge>
                            )}
                            {(row.protectionLevel || row.automaticProtectionCandidate) && (
                              <Badge variant="outline">
                                Sadece TancMark korumalı içerik etkilenir
                              </Badge>
                            )}
                            <Badge variant="outline">
                              {row.nonFinalStatus ?? "Kesin sonuç değildir"}
                            </Badge>
                            <Badge variant="outline">Sadece kayıt</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="text-muted-foreground">Dosya:</span>{" "}
                            <span className="font-mono">{dash(row.fileId)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Kopya:</span>{" "}
                            <span className="font-mono">{dash(row.copyId)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="text-muted-foreground">Oturum:</span>{" "}
                            <span className="font-mono">{dash(row.sessionId)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ekran oturumu:</span>{" "}
                            <span className="font-mono">{dash(row.screenSessionId)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>Kimlik kesinleşmedi</div>
                          <div>Kesin sonuç yok</div>
                          <div>Kilit açma yetkisi yok</div>
                          <div>Sadece kayıt / aday destek</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

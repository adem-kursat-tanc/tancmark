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
import { AlertTriangle, Camera, ShieldCheck } from "lucide-react";

type ModuleKind = "video" | "image" | "audio" | "text" | "zehir";
type C2paStatusValue =
  | "not_found"
  | "found"
  | "unreadable"
  | "invalid_or_unverified";

type C2paReadOnlyStatus = {
  status: C2paStatusValue;
  userLabel: string;
  supportNote: string;
  checked: boolean;
  source: "read_only_marker_scan_v0.1";
  canOpenVault?: false;
  confirmed?: false;
};

type ScreenToCameraDisplay = {
  title: "Ekran Çekimi Aday İzi";
  present: boolean;
  status: "not_found" | "candidate_found" | "strong_candidate_found";
  userStatus: "İz bulunmadı" | "Aday iz bulundu" | "Güçlü aday iz bulundu";
  supportLabel: "Aday destek yok" | "Aday destek sinyali";
  nonFinalStatus: "Kesin sonuç değildir";
  safetyNotice: string;
  source: "screen-to-camera";
  confidenceBand: "dusuk" | "orta" | "guclu" | null;
  displayOnly: true;
  candidateOnly: true;
  canOpenVault: false;
  confirmed: false;
  idMatched: false;
  vaultCapable: false;
};

type SecureRoomDisplayRow = {
  auditId: number;
  timestamp: string;
  route: string;
  eventType: string;
  label: string;
  fileId: string | null;
  copyId: string | null;
  sessionId: string | null;
  userId: string | null;
  screenSessionId: string | null;
  activeModules: ModuleKind[];
  modulesSealed: ModuleKind[];
  modulesIdRead: ModuleKind[];
  modulesCandidateSupport: ModuleKind[];
  sourceModuleIdMatchModules: ModuleKind[];
  candidateSupport: boolean;
  zehirCandidate: boolean;
  zehirSignalType: string | null;
  zehirProtectionLabel: string | null;
  evidenceSourceEventCount: number | null;
  evidenceZehirCandidateSessionCount: number | null;
  screenToCamera: ScreenToCameraDisplay;
  contentCredentials: C2paReadOnlyStatus | null;
  sourceResult: string | null;
  finalDecision: "RECORD_ONLY_NOT_VAULT";
  secureRoomDecision: "Sadece kayıt";
  nonFinalStatus: "Kesin sonuç değildir";
  secureRoomIdentityApproved: false;
  secureRoomIdMatched: false;
  canOpenVault: false;
  vaultCapable: false;
};

type SecureRoomDisplayReport = {
  status: "SECURE_ROOM_DISPLAY_READ_ONLY";
  title: "Secure Room / Kayıt Odası";
  safetyNotice: string;
  rows: SecureRoomDisplayRow[];
  counts: {
    totalRows: number;
    candidateSupportRows: number;
    zehirRows: number;
    evidencePackageRows: number;
    screenToCameraRows: number;
    sourceModuleIdMatchRecords: number;
    secureRoomIdentityApproved: 0;
    canOpenVault: 0;
  };
  c2paDraftConnection: {
    status: "C2PA_DRAFT_ENDPOINT_READY";
    draftOnly: true;
    readOnlyStatus: {
      status: C2paStatusValue;
      userLabel: string;
      supportNote: string;
      checkedRows: number;
      foundRows: number;
      unreadableRows: number;
      invalidOrUnverifiedRows: number;
    };
    decides: false;
    opensVault: false;
  };
};

type SecureRoomReportResponse = {
  ok: true;
  report: SecureRoomDisplayReport;
};

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR");
}

function moduleList(values: ModuleKind[]): string {
  if (values.length === 0) return "-";
  const labels: Record<ModuleKind, string> = {
    video: "video",
    image: "görsel",
    audio: "ses",
    text: "metin",
    zehir: "koruma kaydı",
  };
  return values.map((value) => labels[value] ?? value).join(", ");
}

function confidenceBandLabel(value: ScreenToCameraDisplay["confidenceBand"]): string {
  if (value === "guclu") return "güçlü";
  if (value === "orta") return "orta";
  if (value === "dusuk") return "düşük";
  return "yetersiz";
}

export default function SecureRoomReportPage() {
  const { hasToken } = useAdminToken();
  const query = useQuery({
    queryKey: ["secure-room-report"],
    enabled: hasToken,
    retry: false,
    refetchInterval: (state) => (state.state.error ? false : 5000),
    queryFn: async (): Promise<SecureRoomReportResponse> => {
      const token = getAdminToken();
      const res = await fetch("/api/aegis/secure-room/report?limit=25", {
        headers: token ? { "x-admin-token": token } : {},
      });
      if (!res.ok) {
        const error = new Error(`Delil raporu kayıtları okunamadı (${res.status})`);
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
            <ShieldCheck className="w-8 h-8 text-primary" />
            Delil Raporu / Kayıt Özeti
          </h1>
          <p className="text-muted-foreground mt-2">
            Dosya, kopya, oturum, bulunan izler, zaman damgası ve koruma kayıtlarını
            sade özet olarak gösterir; karar üretmez.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground">
            {report?.safetyNotice ??
              "Bu bölüm yalnız kayıt ve aday destek özetleri içerir. Kesin sonuç yalnız ID okunup sistem ID'siyle eşleşirse oluşur."}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
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
                {query.isLoading ? "..." : report?.counts.candidateSupportRows ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Zehir Kaydı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.zehirRows ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Delil Paketi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.evidencePackageRows ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Ekran Çekimi Aday İzi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold">
                {query.isLoading ? "..." : report?.counts.screenToCameraRows ?? 0}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Destek sinyali</div>
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
            <CardTitle className="flex flex-wrap items-center gap-2">
              Delil Raporu Kayıtları
              <Badge variant="outline">Sadece kayıt</Badge>
              <Badge variant="outline">Aday destek</Badge>
              <Badge variant="outline">Kesin sonuç değildir</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading && (
              <div className="p-6 text-center text-muted-foreground">Yükleniyor...</div>
            )}
            {!query.isLoading && rows.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                Delil raporu kaydı bulunamadı.
              </div>
            )}
            {rows.length > 0 && (
              <div className="overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaman</TableHead>
                      <TableHead>Kayıt</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Dosya/Kopya</TableHead>
                      <TableHead>Oturum/Kullanıcı</TableHead>
                      <TableHead>Modüller</TableHead>
                      <TableHead>Güvenlik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.auditId} data-testid="secure-room-report-row">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatTime(row.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.label}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {row.screenToCamera.present ? "destek sinyali" : "kayıt özeti"}
                          </div>
                          {row.contentCredentials && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {row.contentCredentials.userLabel}
                            </div>
                          )}
                          {row.screenToCamera.present && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Kaynak sonuç: aday destek
                            </div>
                          )}
                          {row.sourceResult && !row.screenToCamera.present && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Kaynak modül kaydı var
                            </div>
                          )}
                          {row.zehirProtectionLabel && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {row.zehirProtectionLabel}
                            </div>
                          )}
                          {row.evidenceSourceEventCount !== null && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Delil paketi kaynak kaydı: {row.evidenceSourceEventCount}
                            </div>
                          )}
                          {row.screenToCamera.present && (
                            <div className="mt-2 rounded-md border border-border/60 bg-background/60 p-2 text-xs">
                              <div className="font-medium">Ekran Çekimi Aday İzi</div>
                              <div className="text-muted-foreground">
                                {row.screenToCamera.userStatus}
                              </div>
                              <div className="text-muted-foreground">
                                {row.screenToCamera.nonFinalStatus}
                              </div>
                              <div className="text-muted-foreground">
                                Seviye: {confidenceBandLabel(row.screenToCamera.confidenceBand)}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{row.secureRoomDecision}</Badge>
                            {row.candidateSupport && (
                              <Badge variant="outline">Aday destek</Badge>
                            )}
                            {row.screenToCamera.present && (
                              <Badge variant="outline">Ekran Çekimi Aday İzi</Badge>
                            )}
                            {row.zehirCandidate && (
                              <Badge variant="outline">Zehir aday kaydı</Badge>
                            )}
                            {row.sourceModuleIdMatchModules.length > 0 && (
                              <Badge variant="outline">Kaynak modül ID kaydı</Badge>
                            )}
                            <Badge variant="outline">{row.nonFinalStatus}</Badge>
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
                            <span className="text-muted-foreground">Kullanıcı:</span>{" "}
                            <span className="font-mono">{dash(row.userId)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ekran oturumu:</span>{" "}
                            <span className="font-mono">{dash(row.screenSessionId)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>aktif: {moduleList(row.activeModules)}</div>
                          <div>mühür: {moduleList(row.modulesSealed)}</div>
                          <div>ID okuyan: {moduleList(row.modulesIdRead)}</div>
                          <div>aday destek: {moduleList(row.modulesCandidateSupport)}</div>
                          <div>kaynak ID kaydı: {moduleList(row.sourceModuleIdMatchModules)}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>Kesin sonuç yok</div>
                          <div>Kayıt odası kimlik onayı vermez</div>
                          <div>Kayıt odası karar vermez</div>
                          <div>Kilit açma yetkisi yok</div>
                          {row.screenToCamera.present && (
                            <div>Ekran çekimi kaydı karar vermez</div>
                          )}
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

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Dijital Taslak Bağlantısı</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>Durum: Taslak bilgi hazır</div>
            <div>Taslak: {report?.c2paDraftConnection.draftOnly ? "evet" : "-"}</div>
            <div>Karar üretmez.</div>
            <div>Kilit açmaz.</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Content Credentials Bilgisi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div>
              Durum:{" "}
              {report?.c2paDraftConnection.readOnlyStatus?.userLabel ??
                "Content Credentials bilgisi bulunmadı."}
            </div>
            <div>
              Okunan kayıt: {report?.c2paDraftConnection.readOnlyStatus?.checkedRows ?? 0}
            </div>
            <div>
              Bulunan: {report?.c2paDraftConnection.readOnlyStatus?.foundRows ?? 0}
            </div>
            <div>
              Okunamayan: {report?.c2paDraftConnection.readOnlyStatus?.unreadableRows ?? 0}
            </div>
            <div>
              Doğrulanamayan:{" "}
              {report?.c2paDraftConnection.readOnlyStatus?.invalidOrUnverifiedRows ?? 0}
            </div>
            <div>Karar üretmez.</div>
            <div>Kilit açmaz.</div>
            <div>
              {report?.c2paDraftConnection.readOnlyStatus?.supportNote ??
                "Bu bilgi içerik geçmişini destekler. Kesin TancMark sonucu yalnız gizli TancMark ID okunup sistem kaydıyla eşleşirse oluşur."}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

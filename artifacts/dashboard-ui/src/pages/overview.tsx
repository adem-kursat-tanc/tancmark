import React from "react";
import { useAuditStats, useListAudit, getListAuditQueryKey, getAuditStatsQueryKey } from "@workspace/api-client-react";
import { AdminGuard } from "@/components/admin-guard";
import { useAdminToken } from "@/hooks/use-admin-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ShieldCheck, Search, AlertTriangle, Zap, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Overview() {
  const { hasToken } = useAdminToken();
  const { data: stats, error: statsError, isLoading: statsLoading } = useAuditStats({
    query: { enabled: hasToken, retry: false, queryKey: getAuditStatsQueryKey() },
  });
  const { data: listData, error: listError, isLoading: listLoading } = useListAudit(
    { limit: 10 },
    {
      query: {
        enabled: hasToken,
        retry: false,
        queryKey: getListAuditQueryKey({ limit: 10 }),
        refetchInterval: (query) => (query.state.error ? false : 5000),
      },
    }
  );

  const canliSizintilar = stats?.byKind?.canary_hit || 0;
  const korunanMetinler = stats?.byKind?.Linguistic_DNA || 0;
  const aktifKanaryalar = stats?.byKind?.canary_scan || 0;

  const events = listData?.events || [];

  return (
    <AdminGuard error={statsError || listError}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Genel Bakış</h1>
          <p className="text-muted-foreground mt-2">Sistem durumu ve son güvenlik olayları.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Canlı Sızıntılar</CardTitle>
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-foreground" data-testid="stat-canli-sizintilar">
                {statsLoading ? "..." : canliSizintilar}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Korunan Metinler</CardTitle>
              <ShieldCheck className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-foreground" data-testid="stat-korunan-metinler">
                {statsLoading ? "..." : korunanMetinler}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktif Kanaryalar</CardTitle>
              <Search className="w-4 h-4 text-accent-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-foreground" data-testid="stat-aktif-kanaryalar">
                {statsLoading ? "..." : aktifKanaryalar}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Canlı Denetim Akışı
            </h2>
            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden relative min-h-[400px]">
              {listLoading && <div className="p-8 text-center text-muted-foreground">Yükleniyor...</div>}
              {!listLoading && events.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">Kayıt bulunamadı.</div>
              )}
              <div className="divide-y divide-border">
                {events.map((event) => (
                  <div key={event.id} className="p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors animate-in fade-in">
                    <div className="mt-1">
                      {event.kind === 'canary_hit' || event.kind === 'anomaly' ? (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      ) : event.kind === 'Linguistic_DNA' ? (
                        <ShieldCheck className="w-4 h-4 text-primary" />
                      ) : event.kind === 'rate_limit_exceeded' ? (
                        <Ban className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Activity className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase bg-background">
                          {event.kind}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(event.ts).toLocaleTimeString('tr-TR')}
                        </span>
                      </div>
                      <div className="text-sm text-foreground truncate">
                        <span className="font-mono text-muted-foreground mr-2">{event.ip}</span>
                        {event.route}
                      </div>
                      {(event.clientId || event.userId) && (
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                          {event.clientId && <span>Müşteri: <span className="font-mono text-foreground">{event.clientId}</span></span>}
                          {event.userId && <span>Kullanıcı: <span className="font-mono text-foreground">{event.userId}</span></span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-foreground" />
              Hızlı Eylemler (Yakında)
            </h2>
            <div className="space-y-3">
              <Card className="bg-card/30 border-dashed border-border opacity-60">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="font-medium text-sm">Uyarı Sistemi</div>
                  <p className="text-xs text-muted-foreground">Sızıntı tespit edildiğinde otomatik uyarı mekanizmasını yapılandırın.</p>
                  <Button disabled variant="outline" className="w-full mt-2" data-testid="btn-uyari-sistemi">Yakında</Button>
                </CardContent>
              </Card>
              <Card className="bg-card/30 border-dashed border-border opacity-60">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="font-medium text-sm">Aktif Müdahale</div>
                  <p className="text-xs text-muted-foreground">Tehdit algılandığında şüpheli erişimleri anında kesin.</p>
                  <Button disabled variant="outline" className="w-full mt-2" data-testid="btn-aktif-mudahale">Yakında</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

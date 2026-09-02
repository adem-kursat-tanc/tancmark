import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe2, Loader2, ShieldAlert, Users, Eye, Activity } from "lucide-react";
import { getAdminToken, hasAdminToken } from "@/lib/admin-token-store";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = `${BASE}api/aegis/distribution-map`;

type HostRow = {
  refererHost: string;
  pingCount: number;
  distinctBeacons: number;
  distinctClients: number;
  distinctIps: number;
  firstSeen: string;
  lastSeen: string;
  clients: string[];
};

type TimelineRow = { day: string; pings: number; hosts: number };

type DistributionResponse = {
  sinceDays: number;
  generatedAt: string;
  hosts: HostRow[];
  timeline: TimelineRow[];
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MaxBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DistributionMapInner() {
  const [sinceDays, setSinceDays] = useState(30);
  // Token gate prevents the 30s poll from firing 401s while the operator
  // hasn't logged in, and the AbortSignal lets React Query cancel the
  // in-flight fetch on unmount / refetch — both contribute to the v3.5
  // stabilization fix for DOM removeChild races.
  const hasToken = hasAdminToken();
  const { data, isFetching, refetch } = useQuery<DistributionResponse>({
    queryKey: ["distribution-map", sinceDays],
    enabled: hasToken,
    queryFn: async ({ signal }) => {
      const r = await fetch(`${API}?sinceDays=${sinceDays}&limit=100`, {
        signal,
        headers: {
          "x-admin-token": getAdminToken() ?? "",
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const hosts = data?.hosts ?? [];
  const timeline = data?.timeline ?? [];
  const totalPings = hosts.reduce((s, h) => s + h.pingCount, 0);
  const totalHosts = hosts.length;
  const totalClients = new Set(hosts.flatMap((h) => h.clients)).size;
  const maxPings = hosts.reduce((m, h) => Math.max(m, h.pingCount), 0);
  const maxTimeline = timeline.reduce((m, t) => Math.max(m, t.pings), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-primary" />
            Dağılım Haritası
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Forensic Beacon piksellerinin tetiklendiği üçüncü-taraf siteler.
            Yalnızca opt-in cloak'lardan veri toplanır; IP/UA HMAC'lı saklanır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90, 365].map((d) => (
            <Button
              key={d}
              variant={sinceDays === d ? "default" : "outline"}
              size="sm"
              onClick={() => setSinceDays(d)}
            >
              {d}g
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yenile"}
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Toplam ping
          </div>
          <div className="text-2xl font-semibold mt-1">{totalPings.toLocaleString("tr-TR")}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe2 className="w-3.5 h-3.5" /> Farklı domain
          </div>
          <div className="text-2xl font-semibold mt-1">{totalHosts.toLocaleString("tr-TR")}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Etkilenen müşteri
          </div>
          <div className="text-2xl font-semibold mt-1">{totalClients.toLocaleString("tr-TR")}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Pencere
          </div>
          <div className="text-2xl font-semibold mt-1">{sinceDays} gün</div>
        </Card>
      </div>

      {/* Timeline chart (CSS bars) */}
      <Card className="p-5">
        <div className="text-sm font-medium mb-3">Günlük ping yoğunluğu</div>
        {timeline.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            Bu pencere içinde ping kaydı yok.
          </div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {timeline.map((t) => {
              const h = maxTimeline > 0 ? (t.pings / maxTimeline) * 100 : 0;
              return (
                <div
                  key={t.day}
                  className="flex-1 flex flex-col items-center justify-end gap-1"
                  title={`${t.day}: ${t.pings} ping, ${t.hosts} host`}
                >
                  <div
                    className="w-full bg-primary/80 rounded-sm hover:bg-primary transition-colors"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                  <div className="text-[9px] text-muted-foreground rotate-45 origin-top-left translate-y-2 whitespace-nowrap">
                    {t.day.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Hosts table */}
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-medium">Domain'lere göre dağılım</div>
          <Badge variant="outline" className="text-xs">{hosts.length} kayıt</Badge>
        </div>
        {hosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Henüz beacon ping'i yok. Bir cloak oluştururken{" "}
            <code className="bg-muted px-1 py-0.5 rounded">{`"beacon": true`}</code>{" "}
            geçirin ve içerik üçüncü taraf bir sitede HTML olarak render edildiğinde
            ping'ler burada belirir.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {hosts.map((h) => (
              <div key={h.refererHost} className="p-4 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4 min-w-0">
                  <div className="font-mono text-sm truncate" title={h.refererHost}>
                    {h.refererHost}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    İlk: {fmtDate(h.firstSeen)} · Son: {fmtDate(h.lastSeen)}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Ping</span>
                    <span className="text-sm font-semibold">{h.pingCount}</span>
                  </div>
                  <div className="mt-1">
                    <MaxBar value={h.pingCount} max={maxPings} />
                  </div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  <div>{h.distinctIps} farklı IP</div>
                  <div>{h.distinctBeacons} beacon</div>
                </div>
                <div className="col-span-3 flex flex-wrap gap-1">
                  {h.clients.slice(0, 4).map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                  {h.clients.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{h.clients.length - 4}
                    </Badge>
                  )}
                  {h.distinctClients >= 2 && (
                    <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-400">
                      <ShieldAlert className="w-3 h-3" /> çoklu müşteri
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Beacon yalnızca markdown / HTML render eden ortamlarda fire eder. Düz
        metin (Notepad, SMS) kopyalarda Structural Entanglement ve canary
        katmanları atıfı sağlar.
      </p>
    </div>
  );
}

export default function DistributionMap() {
  return (
    <AdminGuard>
      <DistributionMapInner />
    </AdminGuard>
  );
}

import { useMemo, useState } from "react";
import { AdminGuard } from "@/components/admin-guard";
import {
  useListBotTraps,
  getListBotTrapsQueryKey,
} from "@workspace/api-client-react";
import { useAdminToken } from "@/hooks/use-admin-token";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Bot, Activity, AlertTriangle, Shield, Cpu, FileText } from "lucide-react";
import { format } from "date-fns";

const VERDICT_COLOR: Record<string, "destructive" | "secondary" | "outline"> = {
  bot: "destructive",
  suspected: "secondary",
  human: "outline",
};

function shortUA(ua: string | null | undefined): string {
  if (!ua) return "—";
  if (ua.length <= 64) return ua;
  return `${ua.slice(0, 61)}…`;
}

export default function BotTrapPage() {
  const [onlyUsed, setOnlyUsed] = useState(false);
  const params = useMemo(() => ({ limit: 100, onlyUsed }), [onlyUsed]);
  const { hasToken } = useAdminToken();
  const { data, error, isLoading } = useListBotTraps(params, {
    query: {
      enabled: hasToken,
      retry: false,
      refetchInterval: 8000,
      queryKey: getListBotTrapsQueryKey(params),
    },
  });

  const events = data?.events ?? [];
  const stats = data?.stats;

  const usedCount = stats?.used ?? 0;
  const totalCount = stats?.total ?? 0;
  const usedPct = totalCount > 0 ? Math.round((usedCount / totalCount) * 100) : 0;

  return (
    <AdminGuard error={error}>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            Bot-Trap Pulse
          </h1>
          <p className="text-muted-foreground mt-2">
            Bot olarak işaretlenen ziyaretçilere sunulan honeytoken'lar ve hangilerinin
            sonradan adli taramada yakalandığı.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> Toplam yem
            </div>
            <div className="text-2xl font-semibold mt-1" data-testid="stat-total">
              {totalCount}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-destructive" /> Yutulan yem
            </div>
            <div
              className="text-2xl font-semibold mt-1 text-destructive"
              data-testid="stat-used"
            >
              {usedCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{usedPct}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" /> Tür dağılımı
            </div>
            <div className="text-xs mt-2 space-y-0.5" data-testid="stat-by-kind">
              {stats?.byKind && Object.keys(stats.byKind).length > 0 ? (
                Object.entries(stats.byKind).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="tabular-nums">{v}</span>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Bot className="w-3 h-3" /> Verdict dağılımı
            </div>
            <div className="text-xs mt-2 space-y-0.5" data-testid="stat-by-verdict">
              {stats?.byVerdict && Object.keys(stats.byVerdict).length > 0 ? (
                Object.entries(stats.byVerdict).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="tabular-nums">{v}</span>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </Card>
        </div>

        {/* ── Otonom Durum ────────────────────────────────────────────── */}
        <Card className="p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Otonom Durum</h2>
              <Badge variant="outline" className="text-[10px]">
                adaptive
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Sistemin müşteri ve carrier doküman başına otomatik kurduğu yem yoğunluğu
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Per-client */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Müşteri başına
              </div>
              {stats?.byClient && stats.byClient.length > 0 ? (
                <div className="space-y-1.5" data-testid="otonom-by-client">
                  {stats.byClient.slice(0, 6).map((c) => {
                    const pct = c.served > 0 ? Math.round((c.used / c.served) * 100) : 0;
                    return (
                      <div
                        key={c.clientId}
                        className="flex items-center gap-2 text-xs"
                        data-testid={`otonom-client-${c.clientId}`}
                      >
                        <span className="font-mono w-12 text-muted-foreground">
                          #{c.clientId}
                        </span>
                        <div className="flex-1 h-2 bg-muted/40 rounded overflow-hidden relative">
                          <div
                            className="h-full bg-primary/60"
                            style={{ width: `${Math.min(100, c.served * 5)}%` }}
                          />
                          {c.used > 0 && (
                            <div
                              className="h-full bg-destructive absolute top-0 left-0"
                              style={{ width: `${Math.min(100, c.used * 5)}%` }}
                            />
                          )}
                        </div>
                        <span className="tabular-nums text-muted-foreground w-20 text-right">
                          {c.served} kuruldu
                        </span>
                        <span className="tabular-nums text-destructive w-20 text-right">
                          {c.used} yutuldu ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Henüz veri yok.</span>
              )}
            </div>

            {/* Per-document (protectionHash) */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Carrier doküman başına (son 20)
              </div>
              {stats?.byDocument && stats.byDocument.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-2" data-testid="otonom-by-document">
                  {stats.byDocument.map((d) => (
                    <div
                      key={d.protectionHash}
                      className="flex items-center gap-2 text-xs"
                      data-testid={`otonom-doc-${d.protectionHash.slice(0, 8)}`}
                    >
                      <span className="font-mono text-[10px] text-muted-foreground w-20 truncate">
                        {d.protectionHash.slice(0, 8)}…
                      </span>
                      <span className="font-mono text-muted-foreground w-10">
                        #{d.clientId}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted/40 rounded overflow-hidden relative">
                        <div
                          className="h-full bg-primary/60"
                          style={{ width: `${Math.min(100, d.served * 8)}%` }}
                        />
                        {d.used > 0 && (
                          <div
                            className="h-full bg-destructive absolute top-0 left-0"
                            style={{ width: `${Math.min(100, d.used * 8)}%` }}
                          />
                        )}
                      </div>
                      <span className="tabular-nums w-16 text-right text-muted-foreground">
                        {d.served} / {d.used}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Henüz veri yok.</span>
              )}
            </div>
          </div>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-3 shrink-0 bg-card p-3 rounded-md border border-border/50">
          <Switch
            id="only-used"
            checked={onlyUsed}
            onCheckedChange={setOnlyUsed}
            data-testid="toggle-only-used"
          />
          <Label htmlFor="only-used" className="cursor-pointer">
            Yalnızca yutulan yemleri göster
          </Label>
          <div className="ml-auto text-xs text-muted-foreground">
            {isLoading ? "Yükleniyor…" : `${events.length} kayıt`}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Zaman</TableHead>
                <TableHead className="w-20">Müşteri</TableHead>
                <TableHead className="w-20">Tür</TableHead>
                <TableHead>Sahte değer (yem)</TableHead>
                <TableHead className="w-32">Bot skor / verdict</TableHead>
                <TableHead className="w-32">Kaynak IP</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead className="w-20">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {isLoading ? "Yükleniyor…" : "Henüz hiç yem servis edilmedi."}
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => {
                  const verdict = e.botVerdict ?? "unknown";
                  const variant = VERDICT_COLOR[verdict] ?? "outline";
                  return (
                    <TableRow key={e.id} data-testid={`bot-trap-row-${e.id}`}>
                      <TableCell className="text-xs tabular-nums">
                        {format(new Date(e.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{e.clientId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {e.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs break-all">
                        {e.fakeValue}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant={variant} className="text-[10px] w-fit">
                            {verdict}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {e.botScore != null ? e.botScore.toFixed(2) : "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.sourceIp ?? "—"}</TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={e.userAgent ?? undefined}
                      >
                        {shortUA(e.userAgent)}
                      </TableCell>
                      <TableCell>
                        {e.used ? (
                          <Badge variant="destructive" className="text-[10px]">
                            yutuldu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            kuruldu
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminGuard>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Radar, Loader2, ShieldAlert, ExternalLink } from "lucide-react";
import { getAdminToken, hasAdminToken } from "@/lib/admin-token-store";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = `${BASE}api/aegis/radar`;

type Confidence = "high" | "medium";
type Status = "new" | "reviewed" | "confirmed" | "false_positive";

type Hit = {
  id: number;
  createdAt: string;
  clientId: string | null;
  candidateClientIds: string[] | null;
  docId: string | null;
  source: string;
  url: string;
  title: string | null;
  snippet: string | null;
  matchedValue: string;
  matchedKind: string;
  confidence: Confidence;
  status: Status;
};

type StatusResp = {
  adapters: Array<{ name: string; configured: boolean }>;
  counts: Array<{ status: string; count: number }>;
};

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken() ?? "";
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      "x-admin-token": token,
    },
  });
}

// Token presence is a cheap "is the operator logged in?" gate. Without it,
// every poll fires a 401 and React Query keeps the spinner spinning forever
// — disabling the queries lets the page render an empty/login state cleanly
// and prevents in-flight fetches from racing an unmount (see DOM removeChild
// crash investigation, v3.5 stabilization).
const CONF_BADGE: Record<Confidence, { v: "default" | "secondary"; label: string }> = {
  high: { v: "default", label: "YÜKSEK GÜVEN" },
  medium: { v: "secondary", label: "BELİRSİZ" },
};

const STATUS_BADGE: Record<Status, { v: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  new: { v: "default", label: "YENİ" },
  reviewed: { v: "secondary", label: "İNCELENDİ" },
  confirmed: { v: "destructive", label: "ONAYLI SIZINTI" },
  false_positive: { v: "outline", label: "YANLIŞ ALARM" },
};

function RadarPageInner() {
  const qc = useQueryClient();
  const [scanClientId, setScanClientId] = useState("");
  const [scanLimit, setScanLimit] = useState(5);
  const [manualUrl, setManualUrl] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  const status = useQuery<StatusResp>({
    queryKey: ["radar", "status"],
    enabled: hasAdminToken(),
    queryFn: async ({ signal }) => {
      const r = await adminFetch("/status", { signal });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json();
    },
  });

  const hits = useQuery<{ hits: Hit[] }>({
    queryKey: ["radar", "hits"],
    enabled: hasAdminToken(),
    queryFn: async ({ signal }) => {
      const r = await adminFetch("/hits?limit=100", { signal });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json();
    },
  });

  const scanMut = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/scan", {
        method: "POST",
        body: JSON.stringify({
          ...(scanClientId ? { clientId: scanClientId } : {}),
          limit: scanLimit,
        }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json() as Promise<{ queries: number; searched: number; hits: number; adapters: string[]; message?: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radar"] });
    },
  });

  const manualMut = useMutation({
    mutationFn: async () => {
      const r = await adminFetch("/manual", {
        method: "POST",
        body: JSON.stringify({
          url: manualUrl,
          content: manualContent,
          ...(manualTitle ? { title: manualTitle } : {}),
        }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json() as Promise<{ scanned: number; hits: number }>;
    },
    onSuccess: () => {
      setManualUrl("");
      setManualContent("");
      setManualTitle("");
      qc.invalidateQueries({ queryKey: ["radar"] });
    },
  });

  const reviewMut = useMutation({
    mutationFn: async ({ id, status: s }: { id: number; status: Status }) => {
      const r = await adminFetch(`/hits/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: s }),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["radar", "hits"] }),
  });

  const liveAdapters = status.data?.adapters.filter((a) => a.configured) ?? [];
  const noLive = !status.isLoading && liveAdapters.length === 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Radar className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">Sızıntı Radarı</h1>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Kaynak Durumu
        </div>
        <div className="flex flex-wrap gap-2">
          {(status.data?.adapters ?? []).map((a) => (
            <Badge key={a.name} variant={a.configured ? "default" : "outline"}>
              {a.name}: {a.configured ? "AKTİF" : "anahtar yok"}
            </Badge>
          ))}
        </div>
        {noLive && (
          <div className="text-sm text-amber-500 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Hiçbir canlı kaynak yapılandırılmamış. Google CSE için{" "}
              <code className="font-mono">GOOGLE_CSE_KEY</code> +{" "}
              <code className="font-mono">GOOGLE_CSE_CX</code>, GitHub için{" "}
              <code className="font-mono">GITHUB_TOKEN</code> ekleyin. Veya aşağıdaki
              "Manuel Tarama" ile bilinen bir URL'in içeriğini elle girin.
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Otomatik Tarama</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Müşteri (boş = hepsi)</Label>
              <Input
                value={scanClientId}
                onChange={(e) => setScanClientId(e.target.value)}
                placeholder="cust-acme"
                data-testid="radar-scan-client"
              />
            </div>
            <div>
              <Label className="text-xs">Değer başına sonuç</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={scanLimit}
                onChange={(e) => setScanLimit(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
                data-testid="radar-scan-limit"
              />
            </div>
          </div>
          <Button
            onClick={() => scanMut.mutate()}
            disabled={scanMut.isPending}
            data-testid="radar-scan-btn"
          >
            {scanMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Tara
          </Button>
          {scanMut.data && (
            <div className="text-xs text-muted-foreground" data-testid="radar-scan-result">
              {scanMut.data.queries} değer / {scanMut.data.searched} arama → {scanMut.data.hits}{" "}
              yeni eşleşme
              {scanMut.data.message ? ` · ${scanMut.data.message}` : ""}
            </div>
          )}
          {scanMut.error && (
            <div className="text-xs text-destructive">Hata: {(scanMut.error as Error).message}</div>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Manuel Tarama</div>
          <div className="text-xs text-muted-foreground">
            Bilinen şüpheli sayfayı yapıştır — sistem honeytoken havuzuyla eşleştirir.
          </div>
          <Input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://pastebin.com/..."
            data-testid="radar-manual-url"
          />
          <Input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="başlık (opsiyonel)"
            data-testid="radar-manual-title"
          />
          <Textarea
            rows={4}
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder="sayfa içeriği"
            data-testid="radar-manual-content"
          />
          <Button
            onClick={() => manualMut.mutate()}
            disabled={manualMut.isPending || !manualUrl || !manualContent}
            data-testid="radar-manual-btn"
          >
            {manualMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Eşleştir
          </Button>
          {manualMut.data && (
            <div className="text-xs text-muted-foreground" data-testid="radar-manual-result">
              {manualMut.data.scanned} aday / {manualMut.data.hits} eşleşme
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Tespit Edilen Sızıntılar</div>
          <Badge variant="outline">{hits.data?.hits.length ?? 0} kayıt</Badge>
        </div>
        {hits.isLoading && <div className="text-xs text-muted-foreground">yükleniyor…</div>}
        {hits.data && hits.data.hits.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Henüz hiç sızıntı tespit edilmedi. İyi haber.
          </div>
        )}
        <div className="space-y-2" data-testid="radar-hits-list">
          {(hits.data?.hits ?? []).map((h) => (
            <Card key={h.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={CONF_BADGE[h.confidence].v}>{CONF_BADGE[h.confidence].label}</Badge>
                    <Badge variant={STATUS_BADGE[h.status].v}>{STATUS_BADGE[h.status].label}</Badge>
                    <Badge variant="outline">{h.source}</Badge>
                    {h.clientId ? (
                      <span className="text-xs font-mono text-muted-foreground">
                        müşteri: {h.clientId}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">
                        adaylar: {(h.candidateClientIds ?? []).join(", ") || "—"}
                      </span>
                    )}
                  </div>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1 break-all"
                  >
                    {h.title ?? h.url}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  {h.snippet && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.snippet}</div>
                  )}
                  <div className="text-xs mt-1">
                    eşleşen değer:{" "}
                    <span className="font-mono">{h.matchedValue}</span>{" "}
                    <span className="text-muted-foreground">({h.matchedKind})</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: h.id, status: "confirmed" })}
                    disabled={reviewMut.isPending}
                  >
                    Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: h.id, status: "false_positive" })}
                    disabled={reviewMut.isPending}
                  >
                    Yanlış
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function RadarPage() {
  return (
    <AdminGuard>
      <RadarPageInner />
    </AdminGuard>
  );
}

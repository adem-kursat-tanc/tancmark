import { useState } from "react";
import { AdminGuard } from "@/components/admin-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, Loader2, FileDown } from "lucide-react";
import { VerdictBadge, verdictToneClass, type Verdict } from "@/components/verdict";
import { getAdminToken } from "@/lib/admin-token-store";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = `${BASE}api/aegis`;

type Strength = "low" | "medium" | "high";
type Risk = "high" | "medium" | "low" | "none";

type Layers = Record<string, boolean>;

type CloakResp = {
  protectedText: string;
  docId: string;
  clientId: string;
  cloakId: string;
  keyVersion: string;
  strength: Strength;
  sensitiveTopic: string | null;
  downgraded: boolean;
  layers: Layers;
};

type Signal = {
  type: "canary" | "honeytoken" | "linguisticDna" | "fuzzyCanary" | "clientTrace";
  source?: string;
  confidence: number;
};

type ScanOutcome = {
  found: boolean;
  docId: string;
  clientId: string;
  cloakId: string;
  keyVersion: string;
  confidence: number;
  signals: Signal[];
  risk: Risk;
  ambiguous: boolean;
  verdict: Verdict;
};

type ScanAllResp = {
  found: boolean;
  scannedCount: number;
  matches: ScanOutcome[];
};

async function adminFetch(path: string, body: unknown): Promise<Response> {
  const token = getAdminToken() ?? "";
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(body),
  });
}

const RISK_BADGE: Record<Risk, { v: "destructive" | "secondary" | "outline"; label: string }> = {
  high: { v: "destructive", label: "YÜKSEK" },
  medium: { v: "secondary", label: "ORTA" },
  low: { v: "outline", label: "DÜŞÜK" },
  none: { v: "outline", label: "YOK" },
};

function RiskBadge({ level }: { level: Risk }) {
  const e = RISK_BADGE[level];
  return <Badge variant={e.v}>{e.label}</Badge>;
}

function VerdictPanel({ outcome }: { outcome: ScanOutcome }) {
  // Verdict semantics — confidence alone is never decisive. Strong requires
  // a canary or non-ambiguous honeytoken hit; ambiguous covers fuzzy/DNA;
  // insufficient is the safe default. (Mirrors classifyCloakVerdict server-side.)
  const tone = verdictToneClass(outcome.verdict);
  const body =
    outcome.verdict === "strong" ? (
      <span>
        Müşteri <span className="font-mono text-primary">{outcome.clientId}</span> için{" "}
        <span className="font-mono">{outcome.docId}</span> dokümanında kesin iz bulundu.
      </span>
    ) : outcome.verdict === "ambiguous" ? (
      <span>Yumuşak sinyal var (paraphrase / DNA), kesin atfetme için yetersiz.</span>
    ) : (
      <span>Bu metin için ayırt edici bir iz yok.</span>
    );
  return (
    <Card className={`p-3 space-y-2 ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Sonuç</div>
        <VerdictBadge verdict={outcome.verdict} />
      </div>
      <div className="text-sm">{body}</div>
      <div className="text-xs text-muted-foreground">
        Yakınlık skoru: <span className="font-mono">{(outcome.confidence * 100).toFixed(1)}%</span>
        {" · "}risk: <span className="font-mono">{outcome.risk}</span>
      </div>
    </Card>
  );
}

function SignalsBlock({ outcome }: { outcome: ScanOutcome }) {
  const byType = (t: Signal["type"]) => outcome.signals.find((s) => s.type === t);
  const canary = byType("canary");
  const ht = byType("honeytoken");
  const fuzzy = byType("fuzzyCanary");
  const dna = byType("linguisticDna");
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Card className="p-3">
        <div className="text-muted-foreground">Canary</div>
        <div className="font-mono">
          {canary ? `HIT (${canary.source ?? "?"})` : "—"}
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-muted-foreground">Honeytoken</div>
        <div className="font-mono">{ht ? "HIT" : "—"}</div>
      </Card>
      <Card className="p-3">
        <div className="text-muted-foreground">Fuzzy canary</div>
        <div className="font-mono">{fuzzy ? fuzzy.confidence.toFixed(2) : "—"}</div>
      </Card>
      <Card className="p-3">
        <div className="text-muted-foreground">Linguistic DNA</div>
        <div className="font-mono">{dna ? dna.confidence.toFixed(3) : "—"}</div>
      </Card>
    </div>
  );
}

export default function DataCloakPage() {
  // Cloak form
  const [clientId, setClientId] = useState("cust-acme");
  const [docId, setDocId] = useState("doc-001");
  const [strength, setStrength] = useState<Strength>("medium");
  const [screenWatermark, setScreenWatermark] = useState(false);
  const [text, setText] = useState(
    "Türkiye Cumhuriyet Merkez Bankası, politika faizini değiştirmedi. Karar piyasaların beklentisiyle uyumlu oldu.",
  );
  const [cloakResp, setCloakResp] = useState<CloakResp | null>(null);
  const [cloakErr, setCloakErr] = useState<string | null>(null);
  const [cloakBusy, setCloakBusy] = useState(false);

  // Scan form
  const [scanText, setScanText] = useState("");
  const [scanClientId, setScanClientId] = useState("cust-acme");
  const [scanDocId, setScanDocId] = useState("doc-001");
  const [scanAll, setScanAll] = useState(false);
  const [scanOne, setScanOne] = useState<ScanOutcome | null>(null);
  const [scanMany, setScanMany] = useState<ScanAllResp | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  // Faz 5 Step 5.7 — Hukuki Ownership Declaration. Kilitli kalır;
  // onaylanmadan "Cloak Üret" butonu aktif olmaz. Beyan API gövdesinde
  // `ownershipDeclared:true` olarak gönderilir → server audit log.
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);

  const handleCloak = async () => {
    if (!ownershipDeclared) {
      setCloakErr(
        "Devam etmek için yasal sahiplik beyanını onaylayın.",
      );
      return;
    }
    setCloakBusy(true);
    setCloakErr(null);
    setCloakResp(null);
    try {
      const res = await adminFetch("/cloak-text", {
        text,
        clientId,
        docId,
        strength,
        screenWatermark,
        ownershipDeclared: true,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setCloakResp(j as CloakResp);
      setScanText(j.protectedText);
      setScanDocId(j.docId);
      setScanClientId(j.clientId);
    } catch (e) {
      setCloakErr(e instanceof Error ? e.message : "Hata");
    } finally {
      setCloakBusy(false);
    }
  };

  const handleScan = async () => {
    setScanBusy(true);
    setScanErr(null);
    setScanOne(null);
    setScanMany(null);
    try {
      if (scanAll) {
        const body = scanClientId.trim()
          ? { text: scanText, clientId: scanClientId, limit: 200 }
          : { text: scanText, limit: 200 };
        const res = await adminFetch("/scan-cloak-all", body);
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
        setScanMany(j as ScanAllResp);
      } else {
        const res = await adminFetch("/scan-cloak", {
          text: scanText,
          docId: scanDocId,
          clientId: scanClientId,
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
        setScanOne(j as ScanOutcome);
      }
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : "Hata");
    } finally {
      setScanBusy(false);
    }
  };

  const handlePdf = async () => {
    const target = scanOne ?? scanMany?.matches[0];
    if (!target) return;
    setPdfBusy(true);
    setPdfErr(null);
    try {
      const res = await adminFetch("/generate-cloak-report", {
        text: scanText,
        docId: target.docId,
        clientId: target.clientId,
      });
      if (!res.ok) {
        let m = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) m = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(m);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data-cloak-report-${target.docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "İndirme başarısız");
    } finally {
      setPdfBusy(false);
    }
  };

  const canPdf = (scanOne && scanOne.risk !== "none") || (scanMany && scanMany.matches.length > 0);

  return (
    <AdminGuard>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Data Cloak
          </h1>
          <p className="text-muted-foreground mt-2">
            Tek metni müşteri başına benzersiz, gözle aynı görünen bir versiyona dönüştür ve sızıntıyı geri izle.
            Hassas konularda otomatik olarak güvenli moda iner.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CLOAK */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Cloak Üret</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Client ID</Label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </div>
              <div>
                <Label>Doc ID</Label>
                <Input value={docId} onChange={(e) => setDocId(e.target.value)} />
              </div>
              <div>
                <Label>Güç</Label>
                <select
                  className="w-full h-9 px-2 rounded border border-input bg-background text-sm"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value as Strength)}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={screenWatermark}
                onChange={(e) => setScreenWatermark(e.target.checked)}
                data-testid="cloak-screen-watermark"
              />
              Ekran filigranı (görsel iz bırak)
            </label>
            {strength === "high" && (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-200"
                data-testid="cloak-high-warning"
              >
                <strong>Uyarı:</strong> Bu kopya, eğitim verisi olarak kullanılmak üzere
                tasarlanmamıştır. Yüksek güç modu yüksek scrape riski olan dış yayın için
                geliştirilmiştir; daha fazla decoy ve eğitim-gürültüsü içerir.
              </div>
            )}
            <div>
              <Label>Metin</Label>
              <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <label
              className="flex items-start gap-2 text-xs rounded-md border border-amber-500/40 bg-amber-500/5 p-3"
              data-testid="cloak-ownership-gate"
            >
              <input
                type="checkbox"
                checked={ownershipDeclared}
                onChange={(e) => setOwnershipDeclared(e.target.checked)}
                className="mt-0.5"
                data-testid="cloak-ownership-checkbox"
              />
              <span>
                <strong>Yasal Sahiplik Beyanı:</strong> Bu eserin yasal
                sahibi olduğumu ve mühürleme işleminden doğacak tüm
                sorumluluğu üstlendiğimi beyan ederim. Beyan zaman
                damgalı olarak denetim kayıtlarına işlenir.
              </span>
            </label>
            <Button
              onClick={handleCloak}
              disabled={cloakBusy || !text.trim() || !ownershipDeclared}
            >
              {cloakBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Cloak Üret
            </Button>
            {cloakErr && <p className="text-sm text-destructive">{cloakErr}</p>}
            {cloakResp && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">strength: {cloakResp.strength}</Badge>
                  <Badge variant="outline">key: {cloakResp.keyVersion}</Badge>
                  {cloakResp.sensitiveTopic && (
                    <Badge variant="secondary">
                      hassas: {cloakResp.sensitiveTopic}
                      {cloakResp.downgraded ? " (indirildi)" : ""}
                    </Badge>
                  )}
                  {Object.entries(cloakResp.layers)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <Badge key={k} variant="outline">
                        {k}
                      </Badge>
                    ))}
                </div>
                <Label>Cloak'lı çıktı</Label>
                <Textarea rows={6} value={cloakResp.protectedText} readOnly className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">
                  cloakId: <code>{cloakResp.cloakId}</code>
                </p>
              </div>
            )}
          </Card>

          {/* SCAN */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5" /> Sızıntı Tara
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Doc ID</Label>
                <Input
                  value={scanDocId}
                  onChange={(e) => setScanDocId(e.target.value)}
                  disabled={scanAll}
                />
              </div>
              <div>
                <Label>Aday Client ID</Label>
                <Input
                  value={scanClientId}
                  onChange={(e) => setScanClientId(e.target.value)}
                  placeholder={scanAll ? "(opsiyonel filtre)" : ""}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={scanAll}
                    onChange={(e) => setScanAll(e.target.checked)}
                  />
                  Tüm dokümanlara karşı tara
                </label>
              </div>
            </div>
            <div>
              <Label>Şüpheli Metin</Label>
              <Textarea rows={6} value={scanText} onChange={(e) => setScanText(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleScan} disabled={scanBusy || !scanText.trim()}>
                {scanBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Tara
              </Button>
              <Button variant="outline" onClick={handlePdf} disabled={pdfBusy || !canPdf}>
                {pdfBusy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                PDF Rapor
              </Button>
            </div>
            {scanErr && <p className="text-sm text-destructive">{scanErr}</p>}
            {pdfErr && <p className="text-sm text-destructive">{pdfErr}</p>}

            {scanOne && (
              <div className="space-y-3 text-sm">
                <VerdictPanel outcome={scanOne} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Risk:</span>
                  <RiskBadge level={scanOne.risk} />
                </div>
                <SignalsBlock outcome={scanOne} />
                <p className="text-xs text-muted-foreground">
                  client: <code>{scanOne.clientId}</code> · doc: <code>{scanOne.docId}</code> · key:{" "}
                  <code>{scanOne.keyVersion}</code>
                </p>
              </div>
            )}

            {scanMany && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Tarandı: {scanMany.scannedCount} · Eşleşen: {scanMany.matches.length}
                  </span>
                  {scanMany.found && <Badge variant="destructive">YÜKSEK risk var</Badge>}
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {scanMany.matches.map((m) => (
                    <div
                      key={m.cloakId}
                      className="border border-border rounded p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs truncate">
                            {m.clientId} / {m.docId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            güven {(m.confidence * 100).toFixed(0)}% · sinyal{" "}
                            {m.signals.map((s) => s.type).join(", ") || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <VerdictBadge verdict={m.verdict} />
                          <RiskBadge level={m.risk} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {scanMany.matches.length === 0 && (
                    <p className="text-muted-foreground text-xs">Hiç eşleşme yok.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}

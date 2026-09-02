import React, { useMemo, useState } from "react";
import { AdminGuard } from "@/components/admin-guard";
import {
  useAnalyzeText,
  useProtectText,
  useCreateForensicNote,
  type AnalyzeTextResponse,
  type StylometricMetrics,
  type DiffSummary as ApiDiffSummary,
  type SpatialVarianceReport,
} from "@workspace/api-client-react";

type AnalyzeResult = AnalyzeTextResponse;
type Candidate = AnalyzeResult["candidates"][number];
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Fingerprint,
  ShieldAlert,
  CheckCircle2,
  FileDown,
  GitCompare,
  Languages,
  Grid3x3,
  MessageSquare,
  FlaskConical,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAdminToken } from "@/lib/admin-token-store";

// ---------------------------------------------------------------
// Local helpers — these mirror lib/aegis-core but run client-side
// so the dashboard can compute Visual Diff + Spatial Variance
// without an extra round-trip. The same data is then forwarded to
// the PDF endpoint for evidence-block rendering.
// ---------------------------------------------------------------

type DiffOp = "equal" | "add" | "remove";
interface DiffEntry {
  op: DiffOp;
  text: string;
}
interface ClientDiffResult extends ApiDiffSummary {
  entries: DiffEntry[];
}

function clientDiffWords(a: string, b: string): ClientDiffResult {
  const aToks = (a.match(/\S+/g) ?? []) as string[];
  const bToks = (b.match(/\S+/g) ?? []) as string[];
  const m = aToks.length;
  const n = bToks.length;
  const MAX = 800;
  const entries: DiffEntry[] = [];
  if (m > MAX || n > MAX) {
    const max = Math.max(m, n);
    for (let k = 0; k < max; k++) {
      const ax = aToks[k];
      const bx = bToks[k];
      if (ax !== undefined && bx !== undefined) {
        if (ax === bx) entries.push({ op: "equal", text: ax });
        else {
          entries.push({ op: "remove", text: ax });
          entries.push({ op: "add", text: bx });
        }
      } else if (ax !== undefined) entries.push({ op: "remove", text: ax });
      else if (bx !== undefined) entries.push({ op: "add", text: bx });
    }
  } else {
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (aToks[i - 1] === bToks[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1;
        else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (aToks[i - 1] === bToks[j - 1]) {
        entries.push({ op: "equal", text: aToks[i - 1]! });
        i--;
        j--;
      } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
        entries.push({ op: "remove", text: aToks[i - 1]! });
        i--;
      } else {
        entries.push({ op: "add", text: bToks[j - 1]! });
        j--;
      }
    }
    while (i > 0) entries.push({ op: "remove", text: aToks[i - 1]! }), i--;
    while (j > 0) entries.push({ op: "add", text: bToks[j - 1]! }), j--;
    entries.reverse();
  }
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const e of entries) {
    if (e.op === "add") added++;
    else if (e.op === "remove") removed++;
    else unchanged++;
  }
  const denom = added + removed + unchanged;
  return { entries, added, removed, unchanged, similarity: denom === 0 ? 1 : unchanged / denom };
}

const ZW = new Set(["\u200B", "\u200C", "\u200D", "\u2060", "\u2063", "\u2064", "\uFEFF"]);
const HOMO = new Set(["а", "е", "о", "р", "с", "у", "х", "А", "В", "Е", "К", "М", "Н", "О", "Р", "С", "Т", "Х"]);

function parseNonNegativeInt(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function normalizeSuspectedClientIdForReport(
  value: string | number | null | undefined,
): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clientSpatialVariance(text: string, wrap = 64): SpatialVarianceReport {
  const chars = Array.from(text);
  const totalChars = chars.length;
  let carriers = 0;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < totalChars; i++) {
    const ch = chars[i]!;
    const cp = ch.codePointAt(0) ?? 0;
    if (ZW.has(ch) || HOMO.has(ch)) carriers++;
    const microX = ((cp * 2654435761) >>> 0) / 0xffffffff;
    const microY = ((cp * 40503) >>> 0) / 0xffffffff;
    sumX += microX;
    sumY += microY;
    sumX2 += microX * microX;
    sumY2 += microY * microY;
  }
  const microXVariance = totalChars > 0 ? sumX2 / totalChars - (sumX / totalChars) ** 2 : 0;
  const microYVariance = totalChars > 0 ? sumY2 / totalChars - (sumY / totalChars) ** 2 : 0;
  return { totalChars, wrap, carriers, microXVariance, microYVariance, points: [] };
}

/**
 * Stres Testi: deletes a roughly `ratio` fraction of *non-whitespace*
 * characters at random, preserving spaces so the surviving fragment is
 * still tokenisable. Deterministic per call but uses Math.random() — a
 * diagnostic helper, not a benchmark. Used by the Forensic Compare
 * "Stres Testi Modu" toggle to simulate ~20% deletion.
 */
function applyStressDeletion(text: string, ratio: number): string {
  if (ratio <= 0) return text;
  const r = Math.min(0.95, ratio);
  let out = "";
  for (const ch of text) {
    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }
    if (Math.random() < r) continue;
    out += ch;
  }
  return out;
}

export default function Forensic() {
  const [suspectText, setSuspectText] = useState("");
  const [matchResult, setMatchResult] = useState<AnalyzeResult | null>(null);
  const [protectedText, setProtectedText] = useState("");
  const [expertNotes, setExpertNotes] = useState("");
  const [noteSaveStatus, setNoteSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  // Hızlı teşhis aracı: when on, the suspect text fed to /analyze-text
  // gets ~20% of its non-whitespace characters dropped. The badge under
  // the button shows the actual mutated text so operators can see what
  // the system was given.
  const [stressMode, setStressMode] = useState(false);
  const [stressApplied, setStressApplied] = useState<{
    original: string;
    mutated: string;
    droppedPct: number;
  } | null>(null);

  const analyzeMutation = useAnalyzeText();
  const protectMutation = useProtectText();
  const noteMutation = useCreateForensicNote();

  const handleAnalyze = async () => {
    if (!suspectText.trim()) return;
    setNoteSaveStatus("idle");
    try {
      let textForAnalysis = suspectText;
      if (stressMode) {
        const mutated = applyStressDeletion(suspectText, 0.2);
        const dropped = suspectText.length - mutated.length;
        const droppedPct =
          suspectText.length > 0 ? (dropped / suspectText.length) * 100 : 0;
        setStressApplied({ original: suspectText, mutated, droppedPct });
        textForAnalysis = mutated;
      } else {
        setStressApplied(null);
      }

      const res = await analyzeMutation.mutateAsync({ data: { text: textForAnalysis } });
      setMatchResult(res);

      if (res.suspectedClientId !== null && res.suspectedClientId !== undefined) {
        // Always protect the *original* text so the diff/spatial blocks
        // describe the user-visible carrier, not the mutated fragment.
        const protectRes = await protectMutation.mutateAsync({
          data: { text: suspectText, clientId: res.suspectedClientId },
        });
        setProtectedText(protectRes.protectedText);
      } else {
        setProtectedText("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isPending = analyzeMutation.isPending || protectMutation.isPending;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // ---- Derived: Visual Diff + Spatial Variance ----
  const diffResult = useMemo<ClientDiffResult | null>(() => {
    if (!protectedText || !suspectText) return null;
    return clientDiffWords(protectedText, suspectText);
  }, [protectedText, suspectText]);

  const spatialReport = useMemo<SpatialVarianceReport | null>(() => {
    if (!protectedText) return null;
    return clientSpatialVariance(protectedText);
  }, [protectedText]);

  const stylometry: StylometricMetrics | null = matchResult?.stylometry ?? null;

  const canDownload =
    !!matchResult &&
    !!protectedText &&
    !isPending &&
    matchResult.suspectedClientId !== null &&
    matchResult.suspectedClientId !== undefined;

  const handleSaveNote = async () => {
    if (!expertNotes.trim()) return;
    setNoteSaveStatus("idle");
    try {
      // CreateForensicNoteRequest.suspectedClientId artık `string | integer | null`
      // kabul ediyor. analyze-text'ten gelen string ID'leri ("client-A",
      // "agency-client-001", "777") olduğu gibi gönderiyoruz. Backend route
      // her şeyi string'e normalize ediyor.
      const noteSuspectedClientId = normalizeSuspectedClientIdForReport(
        matchResult?.suspectedClientId,
      );
      await noteMutation.mutateAsync({
        data: {
          content: expertNotes.trim(),
          ...(noteSuspectedClientId !== null
            ? { suspectedClientId: noteSuspectedClientId }
            : {}),
          ...(matchResult?.confidenceScore !== undefined
            ? { confidenceScore: (matchResult.confidenceScore * 100).toFixed(2) + "%" }
            : {}),
        },
      });
      setNoteSaveStatus("saved");
    } catch (e) {
      console.error(e);
      setNoteSaveStatus("error");
    }
  };

  const handleDownloadPdf = async () => {
    if (!matchResult || !protectedText) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const token = getAdminToken() ?? "";
      const base = import.meta.env.BASE_URL ?? "/";
      const url = `${base}api/aegis/generate-report`;
      const diffPayload = diffResult
        ? {
            added: diffResult.added,
            removed: diffResult.removed,
            unchanged: diffResult.unchanged,
            similarity: diffResult.similarity,
          }
        : undefined;
      const spatialPayload = spatialReport
        ? {
            totalChars: spatialReport.totalChars,
            wrap: spatialReport.wrap,
            carriers: spatialReport.carriers,
            microXVariance: spatialReport.microXVariance,
            microYVariance: spatialReport.microYVariance,
            points: [],
          }
        : undefined;
      // GenerateReportRequest.suspectedClientId is `oneOf: integer | string | null`
      // — pass through as-is. NEVER `Number(...)` here, that would coerce
      // string IDs like "client-A" into NaN and the server would reject the
      // payload (or attribute the report to a meaningless number).
      const reportSuspectedClientId = normalizeSuspectedClientIdForReport(
        matchResult.suspectedClientId,
      );
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          suspectText,
          protectedText,
          suspectedClientId: reportSuspectedClientId,
          confidenceScore: matchResult.confidenceScore,
          matchedTokens: matchResult.matchedTokens,
          totalTokens: matchResult.totalTokens,
          candidates: matchResult.candidates,
          channelBreakdown: matchResult.channelBreakdown ?? undefined,
          stylometry: stylometry ?? undefined,
          diffSummary: diffPayload,
          spatialVariance: spatialPayload,
          expertNotes: expertNotes.trim() ? expertNotes.trim() : undefined,
          // Forward verdict signals so the PDF top-line matches the UI verdict.
          absoluteBreach: matchResult.absoluteBreach === true ? true : undefined,
          multiSuspect: matchResult.multiSuspect === true ? true : undefined,
          suspectedClients: matchResult.suspectedClients ?? undefined,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const m = /filename="?([^"]+)"?/.exec(dispo);
      const fname = m?.[1] ?? `tancmark-report-${Date.now()}.pdf`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "İndirme başarısız");
    } finally {
      setDownloading(false);
    }
  };

  // Render tokens with highlights
  const renderHighlightedText = (original: string, compareTo: string, isSuspect: boolean) => {
    if (!original || !compareTo) return original;
    const origTokens = original.split(/(\s+)/);
    const compTokens = compareTo.split(/(\s+)/);

    return origTokens.map((token, i) => {
      if (token.trim() === '') return token;
      const compToken = compTokens[i];
      if (token === compToken) {
        return <span key={i} className="bg-primary/20 text-primary-foreground px-0.5 rounded-sm">{token}</span>;
      } else if (isSuspect) {
        return <span key={i} className="bg-destructive/20 text-destructive-foreground px-0.5 rounded-sm">{token}</span>;
      }
      return token;
    });
  };

  const DIFF_SAMPLE_LIMIT = 80;
  const diffSample = diffResult ? diffResult.entries.slice(0, DIFF_SAMPLE_LIMIT) : [];

  return (
    <AdminGuard error={analyzeMutation.error}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
        <div className="shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
              <Fingerprint className="w-8 h-8 text-primary" />
              Forensic Compare
            </h1>
            <p className="text-muted-foreground mt-2">Şüpheli metinleri analiz edin ve Linguistic DNA eşleşmelerini bulun.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                stressMode
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
              data-testid="toggle-stress-mode"
              title="Açıkken: 'Analiz Et' tıklanmadan önce metnin ~%20'si rastgele silinir."
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={stressMode}
                onChange={(e) => {
                  setStressMode(e.target.checked);
                  if (!e.target.checked) setStressApplied(null);
                }}
              />
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Stres Testi (~%20 silme)</span>
              <span
                className={`w-2 h-2 rounded-full ${stressMode ? "bg-amber-500" : "bg-muted"}`}
              />
            </label>
            <Button
              onClick={handleDownloadPdf}
              disabled={!canDownload || downloading}
              variant="outline"
              className="px-6 border-primary/40 hover:border-primary hover:bg-primary/10 text-primary"
              data-testid="btn-indir-pdf"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              İndir (PDF)
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={isPending || !suspectText.trim()}
              className="px-8"
              data-testid="btn-analiz-et"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Analiz Et
            </Button>
          </div>
          {stressApplied && (
            <div
              className="mt-3 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400"
              data-testid="stress-mode-badge"
            >
              <span className="font-semibold">Stres Testi uygulandı:</span>{" "}
              {stressApplied.original.length.toLocaleString("tr-TR")} karakter →{" "}
              {stressApplied.mutated.length.toLocaleString("tr-TR")} karakter (
              ~%{stressApplied.droppedPct.toFixed(1)} silindi). Atıf bu mutasyona
              uğramış metin üzerinde yapıldı; PDF/koruma ise orijinal metni esas alır.
            </div>
          )}
        </div>

        {downloadError && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Rapor üretilemedi</AlertTitle>
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        {analyzeMutation.error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Hata</AlertTitle>
            <AlertDescription>Analiz işlemi başarısız oldu. Lütfen tekrar deneyin.</AlertDescription>
          </Alert>
        )}

        {matchResult && (() => {
          // Verdict semantics — confidenceScore alone is a stylometric proximity
          // score and can be high for innocent text. Decisive verdicts come
          // ONLY from absoluteBreach (single-client honeytoken hit) or
          // multiSuspect (≥2 clients with decisive trap evidence).
          // Distinct-clientId guard: ambiguous requires ≥2 *unique* trimmed
          // IDs (mirrors PDF classifyVerdict). Duplicate/whitespace payloads
          // must not downgrade an absoluteBreach hit.
          const distinctSuspectIds = Array.isArray(matchResult.suspectedClients)
            ? Array.from(new Set(
                matchResult.suspectedClients
                  .map((s) => (typeof s.clientId === "string" ? s.clientId.trim() : ""))
                  .filter((id) => id.length > 0),
              ))
            : [];
          const ms = matchResult.multiSuspect === true && distinctSuspectIds.length >= 2;
          const strong = !ms
            && matchResult.absoluteBreach === true
            && matchResult.suspectedClientId != null;
          let verdictLabel: string;
          let verdictTone: "strong" | "ambiguous" | "insufficient";
          let verdictBody: React.ReactNode;
          if (ms) {
            verdictTone = "ambiguous";
            verdictLabel = "Belirsiz / çoklu iz, kesin kaynak yok";
            verdictBody = (
              <div className="text-sm text-muted-foreground">
                Sızdırılan metin {distinctSuspectIds.length} farklı müşterinin tuzak izini içeriyor:
                {" "}
                <span className="font-mono">
                  {distinctSuspectIds.slice(0, 5).join(", ")}
                  {distinctSuspectIds.length > 5 ? ", …" : ""}
                </span>
              </div>
            );
          } else if (strong) {
            verdictTone = "strong";
            verdictLabel = "Güçlü teknik eşleşme";
            verdictBody = (
              <div className="text-2xl font-bold flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
                Müşteri <span className="font-mono text-primary">{matchResult.suspectedClientId}</span>
              </div>
            );
          } else {
            verdictTone = "insufficient";
            verdictLabel = "Kanıt yetersiz — kesin kaynak tespit edilemedi";
            verdictBody = (
              <div className="text-sm text-muted-foreground">
                Stilistik benzerlik dışında kesin (honeytoken / multi-trap) bir iz yok. Skorlar referans amaçlıdır.
              </div>
            );
          }
          const toneClass =
            verdictTone === "strong"
              ? "border-primary/40"
              : verdictTone === "ambiguous"
                ? "border-amber-500/40"
                : "border-border";
          return (
            <Card className={`bg-card/50 backdrop-blur-sm shrink-0 ${toneClass}`} data-testid="verdict-card">
              <CardContent className="p-6 flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Sonuç</div>
                  <div className="text-lg font-semibold mb-2" data-testid="verdict-label">{verdictLabel}</div>
                  {verdictBody}
                </div>
                <div className="flex gap-6 shrink-0">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Yakınlık Skoru</div>
                    <div className="text-xl font-mono text-muted-foreground" title="Stilistik proximity — tek başına suçlama için yeterli değildir">
                      {(matchResult.confidenceScore * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Eşleşen Token</div>
                    <div className="text-xl font-mono text-muted-foreground">{matchResult.matchedTokens} / {matchResult.totalTokens}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[280px]">
          <Card className="flex flex-col border-border/50">
            <CardHeader className="py-4 border-b border-border/50 shrink-0 bg-muted/20">
              <CardTitle className="text-base">Şüpheli Metin</CardTitle>
              <CardDescription>Sızdırıldığı düşünülen metni buraya yapıştırın.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex">
              {matchResult && protectedText ? (
                <div className="w-full h-full p-4 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed border-0 bg-transparent focus-visible:ring-0 resize-none">
                  {renderHighlightedText(suspectText, protectedText, true)}
                </div>
              ) : (
                <Textarea 
                  value={suspectText}
                  onChange={(e) => setSuspectText(e.target.value)}
                  placeholder="Metni yapıştırın..."
                  className="w-full h-full p-4 font-mono text-sm leading-relaxed border-0 focus-visible:ring-0 resize-none rounded-none bg-transparent"
                  data-testid="input-supheli-metin"
                />
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col border-border/50 bg-muted/10">
            <CardHeader className="py-4 border-b border-border/50 shrink-0 bg-muted/30">
              <CardTitle className="text-base text-muted-foreground">Eşleşen Müşteri Metni</CardTitle>
              <CardDescription>Sistemdeki referans metin (Otomatik oluşturulur).</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex overflow-hidden">
              <div className="w-full h-full p-4 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground" data-testid="display-musteri-metni">
                {protectedText ? renderHighlightedText(protectedText, suspectText, false) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
                    Analiz sonrası gösterilecektir
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {matchResult && matchResult.channelBreakdown && (
          <Card className="shrink-0 border-border/50">
            <CardHeader className="py-4">
              <CardTitle className="text-base">İmza Envanteri (Çok Kanallı)</CardTitle>
              <CardDescription>
                Birleşik skor: 0.5 × Linguistic + 0.3 × Homoglyph + 0.2 × Zero-Width
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const cb = matchResult.channelBreakdown!;
                  const rows = [
                    {
                      label: "Linguistic DNA",
                      sub: "Eş-anlamlı kelime",
                      matched: `${cb.synonym.matched} / ${cb.synonym.total}`,
                      score: cb.synonym.total > 0 ? cb.synonym.score : null,
                      strong: cb.synonym.total > 0 && cb.synonym.score >= 0.7,
                    },
                    {
                      label: "Homoglyph",
                      sub: "Latin↔Kiril (~%3)",
                      matched: `${cb.homoglyph.matched} / ${cb.homoglyph.total}`,
                      score: cb.homoglyph.total > 0 ? cb.homoglyph.score : null,
                      strong: cb.homoglyph.total > 0 && cb.homoglyph.score >= 0.9,
                    },
                    {
                      label: "Zero-Width",
                      sub: "16-bit clientId hash",
                      matched: cb.zeroWidth.present
                        ? `${cb.zeroWidth.matched} / ${cb.zeroWidth.total}`
                        : "—",
                      score: cb.zeroWidth.present ? cb.zeroWidth.score : null,
                      strong: cb.zeroWidth.present && cb.zeroWidth.score >= 0.95,
                    },
                  ];
                  return rows.map((r, i) => (
                    <div
                      key={i}
                      className="p-4 bg-muted/20 rounded-md border border-border/30 flex flex-col gap-2"
                      data-testid={`channel-${r.label.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{r.label}</span>
                        <Badge variant={r.strong ? "default" : "secondary"} className="font-mono">
                          {r.score === null ? "—" : `${(r.score * 100).toFixed(1)}%`}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.sub}</div>
                      <div className="font-mono text-xs text-muted-foreground/80">{r.matched}</div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============== GELİŞMİŞ ADLI KANIT BLOKLARI ============== */}

        {stylometry && (
          <Card className="shrink-0 border-border/50" data-testid="card-stylometry">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="w-4 h-4 text-primary" />
                Üslup Analizi (Stylometric DNA)
              </CardTitle>
              <CardDescription>
                Yüzey-seviyesi yazı parmak izi: cümle yapısı, sözcüksel çeşitlilik, stop-word dağılımı.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Toplam kelime", value: String(stylometry.wordCount) },
                  { label: "Tekil kelime", value: String(stylometry.uniqueWordCount) },
                  { label: "Cümle sayısı", value: String(stylometry.sentenceCount) },
                  {
                    label: "Ort. cümle uzunluğu",
                    value: `${stylometry.avgSentenceLength.toFixed(2)} kel.`,
                  },
                  { label: "Sözcüksel çeşitlilik", value: stylometry.lexicalDiversity.toFixed(3) },
                  {
                    label: "Stop-word oranı",
                    value: `${(stylometry.stopWordRatio * 100).toFixed(2)}%`,
                  },
                  {
                    label: "Ort. kelime uzunluğu",
                    value: `${stylometry.avgWordLength.toFixed(2)} kar.`,
                  },
                  { label: "Stop-word adedi", value: String(stylometry.stopWordCount) },
                ].map((m, i) => (
                  <div key={i} className="p-3 bg-muted/20 border border-border/30 rounded-md">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      {m.label}
                    </div>
                    <div className="font-mono text-sm font-bold">{m.value}</div>
                  </div>
                ))}
              </div>

              {stylometry.stopWordDistribution.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Stop-word dağılımı
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stylometry.stopWordDistribution.map((e, i) => (
                      <Badge key={i} variant="secondary" className="font-mono">
                        {e.word} <span className="ml-1 text-primary">{e.count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {diffResult && (
          <Card className="shrink-0 border-border/50" data-testid="card-visual-diff">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                Fark Analizi (Visual Diff)
              </CardTitle>
              <CardDescription>
                Mühürlü metin (orijinal) vs. şüpheli metin — kelime düzeyinde fark.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Değişmemiş</div>
                  <div className="font-mono text-xl font-bold text-primary">
                    {diffResult.unchanged}
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Eklenen</div>
                  <div className="font-mono text-xl font-bold text-emerald-400">
                    {diffResult.added}
                  </div>
                </div>
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Çıkarılan</div>
                  <div className="font-mono text-xl font-bold text-destructive">
                    {diffResult.removed}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Benzerlik</div>
                  <div className="font-mono text-xl font-bold">
                    {(diffResult.similarity * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div
                className="p-3 bg-background border border-border/30 rounded-md text-sm leading-relaxed font-mono max-h-48 overflow-y-auto"
                data-testid="diff-stream"
              >
                {diffSample.map((e, i) => {
                  if (e.op === "equal") {
                    return (
                      <span key={i} className="text-muted-foreground">
                        {e.text}{" "}
                      </span>
                    );
                  }
                  if (e.op === "add") {
                    return (
                      <span
                        key={i}
                        className="bg-emerald-500/20 text-emerald-300 px-1 rounded mr-1"
                      >
                        +{e.text}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="bg-destructive/20 text-destructive line-through px-1 rounded mr-1"
                    >
                      −{e.text}
                    </span>
                  );
                })}
                {diffResult.entries.length > DIFF_SAMPLE_LIMIT && (
                  <span className="text-muted-foreground/60 italic">
                    {" "}
                    … (+{diffResult.entries.length - DIFF_SAMPLE_LIMIT} daha)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {spatialReport && (
          <Card className="shrink-0 border-border/50" data-testid="card-spatial-variance">
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-primary" />
                Mikro-Boşluk ve Karakter Varyans
              </CardTitle>
              <CardDescription>
                Mühürlü metnin sentetik ızgara üzerindeki yerleşimi ve taşıyıcı yoğunluğu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/20 border border-border/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Toplam karakter</div>
                  <div className="font-mono text-sm font-bold">{spatialReport.totalChars}</div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Taşıyıcı</div>
                  <div className="font-mono text-sm font-bold text-primary">
                    {spatialReport.carriers}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Mikro-X varyans</div>
                  <div className="font-mono text-sm font-bold">
                    {spatialReport.microXVariance.toExponential(3)}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-md">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Mikro-Y varyans</div>
                  <div className="font-mono text-sm font-bold">
                    {spatialReport.microYVariance.toExponential(3)}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Taşıyıcı yoğunluğu:{" "}
                <span className="font-mono text-primary">
                  {spatialReport.totalChars > 0
                    ? `${((spatialReport.carriers / spatialReport.totalChars) * 100).toFixed(2)}%`
                    : "—"}
                </span>
                {" · "}Izgara genişliği:{" "}
                <span className="font-mono">{spatialReport.wrap}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shrink-0 border-border/50" data-testid="card-expert-notes">
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Uzman Yorumu
            </CardTitle>
            <CardDescription>
              Adli bulguya ilişkin yorumunuzu kaydedin — denetim kaydında saklanır ve PDF raporuna eklenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={expertNotes}
              onChange={(e) => {
                setExpertNotes(e.target.value);
                if (noteSaveStatus !== "idle") setNoteSaveStatus("idle");
              }}
              placeholder="Bulguların yorumu, atıf değerlendirmesi, ek gözlemler…"
              className="min-h-[120px] font-mono text-sm"
              maxLength={8000}
              data-testid="input-expert-notes"
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {expertNotes.length} / 8000 karakter
                {noteSaveStatus === "saved" && (
                  <span className="ml-3 text-primary">✓ Kaydedildi</span>
                )}
                {noteSaveStatus === "error" && (
                  <span className="ml-3 text-destructive">Kaydedilemedi</span>
                )}
              </div>
              <Button
                onClick={handleSaveNote}
                disabled={!expertNotes.trim() || noteMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="btn-save-note"
              >
                {noteMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
                Yorumu Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        {matchResult && matchResult.candidates && matchResult.candidates.length > 0 && (
          <Card className="shrink-0 border-border/50">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Aday Sıralaması</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {matchResult.candidates.map((cand: Candidate, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-md border border-border/30">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono">#{i+1}</Badge>
                      <span className="font-medium text-sm">Müşteri {cand.clientId}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="font-mono text-muted-foreground">{cand.matchedTokens} token</div>
                      <Badge variant={cand.confidenceScore > 0.8 ? "default" : "secondary"}>
                        {(cand.confidenceScore * 100).toFixed(1)}% Skor
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminGuard>
  );
}

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Camera,
  FileSearch,
  Info,
  Loader2,
  Search,
  Settings,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminToken } from "@/lib/admin-token-store";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = `${BASE}api/aegis`;

type FileKind = "text" | "image" | "video" | "audio" | "document" | "unknown";
type UserVerdict = "strong" | "candidate" | "none";

type ScanResult = {
  verdict: UserVerdict;
  title: "Kesin eşleşme bulundu" | "Aday iz bulundu" | "Kesin sonuç yok";
  description: string;
  supportSignals: string[];
  screenToCamera: "none" | "candidate" | "strong";
};

type ScanAllResponse = {
  found?: boolean;
  matches?: Array<{
    verdict?: string;
    risk?: string;
    found?: boolean;
  }>;
};

type AnalyzeImageResponse = {
  confirmed?: boolean;
  candidateSupport?: boolean;
  textCommonDecision?: {
    officialDecision?: string;
    candidateSupport?: boolean;
    confirmed?: boolean;
  };
  heavyOcr?: {
    candidateSupport?: boolean;
  };
  supportDetails?: {
    screenToCamera?: { present?: boolean; status?: string };
    screenToCameraCandidate?: { present?: boolean; status?: string };
  };
};

function fileKind(file: File | null): FileKind {
  if (!file) return "unknown";
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("text/")) return "text";
  if (/\.(txt|md|csv|json|log)$/i.test(name)) return "text";
  if (/\.(pdf|doc|docx|rtf)$/i.test(name)) return "document";
  return "unknown";
}

function kindLabel(kind: FileKind): string {
  if (kind === "text") return "Metin / belge metni";
  if (kind === "image") return "Fotoğraf / ekran görüntüsü";
  if (kind === "video") return "Video / sesli video";
  if (kind === "audio") return "Ses";
  if (kind === "document") return "Belge";
  return "Bilinmeyen dosya";
}

function canScanInSimpleFlow(kind: FileKind): boolean {
  return kind === "text" || kind === "image";
}

function titleFor(verdict: UserVerdict): ScanResult["title"] {
  if (verdict === "strong") return "Kesin eşleşme bulundu";
  if (verdict === "candidate") return "Aday iz bulundu";
  return "Kesin sonuç yok";
}

function screenToCameraLevel(value: AnalyzeImageResponse): ScanResult["screenToCamera"] {
  const candidate =
    value.supportDetails?.screenToCamera ?? value.supportDetails?.screenToCameraCandidate;
  if (!candidate?.present) return "none";
  const status = String(candidate.status ?? "").toLowerCase();
  return status.includes("strong") ? "strong" : "candidate";
}

function scanResultFromText(response: ScanAllResponse): ScanResult {
  const matches = response.matches ?? [];
  const strong = matches.some((match) => match.verdict === "strong");
  const candidate = matches.some(
    (match) => match.found === true || match.verdict === "ambiguous" || match.risk === "medium",
  );
  const verdict: UserVerdict = strong ? "strong" : candidate ? "candidate" : "none";
  return {
    verdict,
    title: titleFor(verdict),
    description:
      verdict === "strong"
        ? "TancMark ID ve kayıt eşleşmesiyle güçlü sonuç bulundu."
        : verdict === "candidate"
          ? "Dosyada destek sinyali bulundu; tek başına kesin sonuç değildir."
          : "Bu dosyada kesin eşleşme veya yeterli aday iz bulunmadı.",
    supportSignals: verdict === "none" ? [] : ["Metin izi"],
    screenToCamera: "none",
  };
}

function scanResultFromImage(response: AnalyzeImageResponse): ScanResult {
  const confirmed =
    response.confirmed === true ||
    response.textCommonDecision?.confirmed === true ||
    response.textCommonDecision?.officialDecision === "TEXT_CONFIRMED";
  const candidate =
    response.candidateSupport === true ||
    response.textCommonDecision?.candidateSupport === true ||
    response.heavyOcr?.candidateSupport === true;
  const screenToCamera = screenToCameraLevel(response);
  const verdict: UserVerdict = confirmed ? "strong" : candidate || screenToCamera !== "none" ? "candidate" : "none";
  const supportSignals = [
    ...(candidate ? ["Görsel/metin aday izi"] : []),
    ...(screenToCamera !== "none" ? ["Ekran Çekimi Aday İzi"] : []),
  ];
  return {
    verdict,
    title: titleFor(verdict),
    description:
      verdict === "strong"
        ? "TancMark ID ve sistem kaydı eşleşti."
        : verdict === "candidate"
          ? "Destek sinyali bulundu; kesin sonuç değildir."
          : "Bu dosyada kesin eşleşme veya yeterli aday iz bulunmadı.",
    supportSignals,
    screenToCamera,
  };
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const token = getAdminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-admin-token"] = token;
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error("Tarama tamamlanamadı");
  return data;
}

async function postImage(file: File): Promise<AnalyzeImageResponse> {
  const token = getAdminToken();
  const form = new FormData();
  form.append("image", file);
  const response = await fetch(`${API}/analyze-image`, {
    method: "POST",
    headers: token ? { "x-admin-token": token } : {},
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as AnalyzeImageResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Görsel tarama için Ayarlar bölümünde yetkili erişim gerekir."
        : "Görsel tarama tamamlanamadı",
    );
  }
  return data;
}

function ResultCard({ result }: { result: ScanResult }) {
  const badgeVariant =
    result.verdict === "strong" ? "secondary" : result.verdict === "candidate" ? "outline" : "outline";
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sonucu Gör
          <Badge variant={badgeVariant}>{result.title}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{result.description}</p>
        {result.supportSignals.length > 0 && (
          <div className="rounded-md border border-border/70 p-3">
            <div className="mb-2 font-medium">Destek sinyalleri</div>
            <div className="flex flex-wrap gap-2">
              {result.supportSignals.map((signal) => (
                <Badge key={signal} variant="outline">
                  {signal}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {result.screenToCamera !== "none" && (
          <div className="rounded-md border border-border/70 bg-background/60 p-3">
            <div className="flex items-center gap-2 font-medium">
              <Camera className="h-4 w-4" />
              Ekran Çekimi Aday İzi
            </div>
            <p className="mt-1 text-muted-foreground">
              Bu kayıt, içeriğin ekran üzerinden telefonla çekilmiş olabileceğine dair
              yardımcı sinyaldir. Kesin sonuç değildir.
            </p>
          </div>
        )}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Güvenlik notu</AlertTitle>
          <AlertDescription>
            Kesin sonuç yalnız TancMark ID okunup sistem kaydıyla eşleşirse oluşur.
            Aday izler tek başına kesin kanıt değildir.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default function UserScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const kind = useMemo(() => fileKind(file), [file]);

  const handleScan = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (kind === "text") {
        const text = (await file.text()).trim();
        if (!text) throw new Error("Dosya içinde taranacak metin bulunamadı.");
        const response = (await postJson("/scan-cloak-all", {
          text,
          limit: 25,
        })) as ScanAllResponse;
        setResult(scanResultFromText(response));
      } else if (kind === "image") {
        const response = await postImage(file);
        setResult(scanResultFromImage(response));
      } else {
        throw new Error(
          "Bu dosya türü için sade tarama ekranı henüz kullanılmaz. Gelişmiş/Admin panelindeki medya tarama akışını kullanın.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Koruma Paneli
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
              <FileSearch className="h-8 w-8 text-primary" />
              Sızan Dosyayı Tara
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Şüpheli dosyada TancMark izi arayın.
            </p>
          </div>
        </div>
        <Link href="/overview">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Gelişmiş / Admin
          </Button>
        </Link>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Güvenlik notu</AlertTitle>
        <AlertDescription>
          Kesin sonuç yalnız TancMark ID okunup sistem kaydıyla eşleşirse oluşur.
          Aday izler tek başına kesin kanıt değildir.
        </AlertDescription>
      </Alert>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle>Şüpheli dosya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="scan-file">Şüpheli Dosya Seç</Label>
            <Input
              id="scan-file"
              type="file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
              data-testid="user-scan-file-input"
            />
          </div>

          {file && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{kindLabel(kind)}</Badge>
              <Badge variant="outline">{(file.size / 1024).toFixed(1)} KB</Badge>
              <span className="text-muted-foreground">{file.name}</span>
            </div>
          )}

          {file && !canScanInSimpleFlow(kind) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Gelişmiş medya taraması gerekir</AlertTitle>
              <AlertDescription>
                Video, ses ve kapalı belge türleri için mevcut gelişmiş tarama ekranları
                kullanılmalıdır. Bu sade ekran metin ve görsel taramasıyla başlar.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleScan}
            disabled={!file || busy}
            data-testid="user-scan-submit"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Taramayı Başlat
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Tarama tamamlanamadı</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && <ResultCard result={result} />}
    </div>
  );
}

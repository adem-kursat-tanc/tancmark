import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Clock3,
  CheckCircle2,
  Download,
  FileLock2,
  FileText,
  Info,
  Loader2,
  Settings,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getAdminToken } from "@/lib/admin-token-store";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = `${BASE}api/aegis`;

type FileKind = "text" | "image" | "video" | "audio" | "document" | "unknown";
type VideoProtectionMode = "fast" | "standard" | "strong";

type ProtectResult = {
  title: "Koruma kaydı oluşturuldu";
  fileName: string;
  kindLabel: string;
  copyReady: boolean;
  evidenceReady: boolean;
  timestampLabel: string;
  protectedText: string | null;
  downloadName: string | null;
};

type CloakTextResponse = {
  protectedText?: string;
  docId?: string;
  cloakId?: string;
  enterprise?: {
    timestamp?: { queued?: boolean; referenceId?: string };
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
  if (kind === "image") return "Fotoğraf / görsel";
  if (kind === "video") return "Video / sesli video";
  if (kind === "audio") return "Ses";
  if (kind === "document") return "Belge";
  return "Bilinmeyen dosya";
}

function safeDocId(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base ? `doc-${base}` : `doc-${Date.now()}`;
}

function canReadAsText(kind: FileKind): boolean {
  return kind === "text";
}

const videoProtectionModes: Array<{
  value: VideoProtectionMode;
  label: string;
  description: string;
}> = [
  {
    value: "fast",
    label: "Hızlı Koruma",
    description:
      "Daha kısa sürede temel koruma sağlar. Kritik dosyalar veya ağır bozulma ihtimali olan paylaşımlar için Güçlü Koruma önerilir.",
  },
  {
    value: "standard",
    label: "Standart Koruma",
    description: "Günlük kullanım için dengeli koruma sağlar.",
  },
  {
    value: "strong",
    label: "Güçlü Koruma",
    description:
      "En yüksek dayanıklılık hedeflenir. Büyük videolarda daha uzun sürebilir, ancak en sağlam koruma seçeneğidir.",
  },
];

const videoProgressSteps = [
  "Hazırlanıyor",
  "Mühürleniyor",
  "Delil kaydı hazırlanıyor",
  "Tamamlandı",
  "Hata oluştu, tekrar deneyin",
];

async function readFileText(file: File): Promise<string> {
  const text = await file.text();
  return text.trim();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const token = getAdminToken();
  if (!token) {
    throw new Error("Bu işlem için doğrulanmış TancMark oturumu gerekir.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["x-admin-token"] = token;
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Bu işlem için doğrulanmış TancMark oturumu gerekir.");
    }
    throw new Error(data.error ?? "İşlem tamamlanamadı");
  }
  return data;
}

function downloadProtectedText(result: ProtectResult): void {
  if (!result.protectedText || !result.downloadName) return;
  const blob = new Blob([result.protectedText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function UserProtectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [ownershipAccepted, setOwnershipAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProtectResult | null>(null);
  const [videoMode, setVideoMode] = useState<VideoProtectionMode>("strong");

  const kind = useMemo(() => fileKind(file), [file]);
  const isVideo = kind === "video";
  const isTextReady = file !== null && canReadAsText(kind);

  const handleProtect = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (!canReadAsText(kind)) {
        throw new Error(
          "Bu dosya türü için sade ekranda henüz güvenli kopya üretimi yapılmaz. Gelişmiş/Admin panelindeki medya akışını kullanın.",
        );
      }
      const sourceText = await readFileText(file);
      if (!sourceText) throw new Error("Dosya içinde korunacak metin bulunamadı.");
      const docId = safeDocId(file.name);
      const response = (await postJson("/cloak-text", {
        text: sourceText,
        docId,
        strength: "medium",
        ownershipDeclared: ownershipAccepted,
      })) as CloakTextResponse;
      const protectedText = response.protectedText ?? "";
      setResult({
        title: "Koruma kaydı oluşturuldu",
        fileName: file.name,
        kindLabel: kindLabel(kind),
        copyReady: protectedText.length > 0,
        evidenceReady: true,
        timestampLabel: response.enterprise?.timestamp?.queued
          ? "Zaman damgası kuyruğa alındı"
          : "Zaman damgası bilgisi yok",
        protectedText,
        downloadName: `${docId}-tancmark-korumali.txt`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
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
              <FileLock2 className="h-8 w-8 text-primary" />
              Dosyanızı TancMark ile koruyun.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Fotoğraf, video, sesli video, metin veya belgeyi görünmez şekilde
              koruma altına alın.
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
          <CardTitle>Dosya Koru</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="protect-file">Dosya Seç</Label>
            <Input
              id="protect-file"
              type="file"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
                setResult(null);
              }}
              data-testid="user-protect-file-input"
            />
          </div>

          {file && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{kindLabel(kind)}</Badge>
              <Badge variant="outline">{(file.size / 1024).toFixed(1)} KB</Badge>
              <span className="text-muted-foreground">{file.name}</span>
            </div>
          )}

          {isVideo && (
            <div className="space-y-4">
              <Alert>
                <Clock3 className="h-4 w-4" />
                <AlertTitle>Video koruma işlemi biraz sürebilir</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Video koruma işlemi dosya boyutuna göre biraz sürebilir.</p>
                  <p>İşlem arka planda hazırlanıyor.</p>
                  <p>Büyük videolarda işlem birkaç dakika sürebilir.</p>
                  <p>Bu sırada sonucu daha sonra kontrol edebilirsiniz.</p>
                </AlertDescription>
              </Alert>

              <div className="rounded-md border border-border/70 bg-background/60 p-4">
                <div className="mb-3 space-y-1">
                  <div className="font-medium">Video işlem modu</div>
                  <p className="text-sm text-muted-foreground">
                    En sağlam koruma biraz daha uzun sürebilir. Kritik dosyalar için önerilen
                    seçenek Güçlü Koruma’dır. Bu seçim şimdilik kullanıcı bilgilendirmesi
                    içindir; mevcut güvenli koruma davranışı korunur.
                  </p>
                </div>
                <RadioGroup
                  value={videoMode}
                  onValueChange={(value) => setVideoMode(value as VideoProtectionMode)}
                  className="grid gap-3 md:grid-cols-3"
                >
                  {videoProtectionModes.map((mode) => (
                    <Label
                      key={mode.value}
                      htmlFor={`video-mode-${mode.value}`}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 bg-card/80 p-3"
                    >
                      <RadioGroupItem
                        id={`video-mode-${mode.value}`}
                        value={mode.value}
                        className="mt-1"
                      />
                      <span className="space-y-1">
                        <span className="block font-medium">{mode.label}</span>
                        <span className="block text-sm leading-5 text-muted-foreground">
                          {mode.description}
                        </span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
                {videoMode === "fast" && (
                  <p className="mt-3 rounded-md border border-border/70 bg-background p-3 text-sm text-muted-foreground">
                    Bu seçenek daha kısa süreli işlem için tasarlanmıştır. En yüksek
                    dayanıklılık gereken dosyalarda Güçlü Koruma önerilir.
                  </p>
                )}
              </div>

              <div className="rounded-md border border-border/70 bg-background/60 p-4">
                <div className="mb-3 font-medium">İşlem aşamaları</div>
                <div className="flex flex-wrap gap-2">
                  {videoProgressSteps.map((step) => (
                    <Badge key={step} variant="outline">
                      {step}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isTextReady && file && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Medya dosyası algılandı</AlertTitle>
              <AlertDescription>
                Bu dosya türü için mevcut gelişmiş koruma ekranları kullanılmalıdır.
                Bu sade ekran şu anda metin ve belge metni için korumalı kopya hazırlar.
              </AlertDescription>
            </Alert>
          )}

          <label className="flex items-start gap-3 rounded-md border border-border/70 bg-background/60 p-3 text-sm">
            <input
              type="checkbox"
              checked={ownershipAccepted}
              onChange={(event) => setOwnershipAccepted(event.target.checked)}
              className="mt-1"
              data-testid="user-protect-ownership"
            />
            <span>
              Bu dosyayı koruma yetkim olduğunu ve işlemin kayıt altına alınacağını
              onaylıyorum.
            </span>
          </label>

          <Button
            onClick={handleProtect}
            disabled={!file || !ownershipAccepted || busy}
            data-testid="user-protect-submit"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Mühürle ve Koru
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>İşlem tamamlanamadı</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {result.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-muted-foreground">Dosya türü</div>
                <div className="font-medium">{result.kindLabel}</div>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-muted-foreground">Dosya kopyası</div>
                <div className="font-medium">
                  {result.copyReady ? "Dosya kopyası hazır" : "Dosya kopyası yok"}
                </div>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-muted-foreground">Delil kaydı</div>
                <div className="font-medium">
                  {result.evidenceReady ? "Delil kaydı oluşturuldu" : "Delil kaydı yok"}
                </div>
              </div>
              <div className="rounded-md border border-border/70 p-3">
                <div className="text-muted-foreground">Zaman damgası</div>
                <div className="font-medium">{result.timestampLabel}</div>
              </div>
            </div>
            {result.protectedText && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => downloadProtectedText(result)}>
                  <Download className="mr-2 h-4 w-4" />
                  Korumalı Dosyayı İndir
                </Button>
                <Link href="/secure-room-report">
                  <Button variant="outline">Koruma Raporunu Gör</Button>
                </Link>
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
      )}
    </div>
  );
}

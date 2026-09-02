import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListChecks } from "lucide-react";

type SuggestionRow = {
  id: number;
  createdAt: string;
  relatedTestId?: string | null;
  topic: string;
  severity: "dusuk" | "orta" | "yuksek" | string;
  suggestion: string;
  reason: string;
  status: "bekliyor" | "onaylandi" | "reddedildi" | "tamamlandi" | string;
  actionPlan?: {
    suggestion: string;
    whyImportant: string;
    module: string;
    risk: string;
    smallStep: string;
    verification: string;
    safety: string;
  } | null;
};

type SuggestionsResponse = {
  suggestions: SuggestionRow[];
};

function severityLabel(value: string): string {
  if (value === "yuksek") return "Yuksek";
  if (value === "orta") return "Orta";
  if (value === "dusuk") return "Dusuk";
  return value;
}

function severityVariant(value: string): "default" | "destructive" | "outline" | "secondary" {
  if (value === "yuksek") return "destructive";
  if (value === "orta") return "secondary";
  return "outline";
}

export default function ImprovementSuggestionsPage() {
  const query = useQuery({
    queryKey: ["improvement-suggestions"],
    refetchInterval: 5000,
    retry: false,
    queryFn: async (): Promise<SuggestionsResponse> => {
      const token = getAdminToken();
      const res = await fetch(
        "/api/aegis/video-lab/improvement-suggestions?limit=20",
        {
          headers: token ? { "x-admin-token": token } : {},
        },
      );
      if (!res.ok) {
        throw new Error(`Gelistirme onerileri okunamadi (${res.status})`);
      }
      return res.json();
    },
  });

  const suggestions = query.data?.suggestions ?? [];

  async function updateStatus(id: number, status: string) {
    const token = getAdminToken();
    const res = await fetch(`/api/aegis/video-lab/improvement-suggestions/${id}/status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-admin-token": token } : {}),
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new Error(`Durum guncellenemedi (${res.status})`);
    }
    await query.refetch();
  }

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-primary" />
            Gelistirme Onerileri
          </h1>
          <p className="text-muted-foreground mt-2">
            Testlerden uretilen kalici aksiyon listesi. Bu liste kodu kendi
            basina degistirmez.
          </p>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Bekleyen ve Kayitli Oneriler</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading && (
              <div className="p-6 text-center text-muted-foreground">
                Yukleniyor...
              </div>
            )}
            {!query.isLoading && suggestions.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                Oneri kaydi bulunamadi.
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="space-y-4">
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    className="border border-border rounded-lg p-4 bg-background/40"
                    data-testid="improvement-suggestion-row"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant={severityVariant(item.severity)}>
                        {severityLabel(item.severity)}
                      </Badge>
                      <Badge variant="outline">{item.topic}</Badge>
                      <Badge variant="outline">{item.status}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(item.createdAt).toLocaleString("tr-TR")}
                      </span>
                    </div>
                    <div className="text-base font-medium">
                      {item.suggestion}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Neden: {item.reason}
                    </div>
                    <div className="text-xs text-muted-foreground mt-3 font-mono">
                      Ilgili test: {item.relatedTestId ?? "-"}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, "onaylandi")}
                      >
                        Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, "reddedildi")}
                      >
                        Reddet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, "tamamlandi")}
                      >
                        Tamamlandi Yap
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(item.id, "bekliyor")}
                      >
                        Bekliyor Yap
                      </Button>
                    </div>
                    {item.actionPlan && (
                      <div className="mt-4 rounded-md border border-border bg-muted/30 p-4 space-y-2">
                        <div className="font-medium">Aksiyon Plani</div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Oneri:</span>{" "}
                          {item.actionPlan.suggestion}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Neden onemli:</span>{" "}
                          {item.actionPlan.whyImportant}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Modul:</span>{" "}
                          {item.actionPlan.module}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Risk:</span>{" "}
                          {item.actionPlan.risk}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Kucuk adim:</span>{" "}
                          {item.actionPlan.smallStep}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Dogrulama:</span>{" "}
                          {item.actionPlan.verification}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.actionPlan.safety}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin-guard";
import { getAdminToken } from "@/lib/admin-token-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Library, ShieldCheck } from "lucide-react";

type RegistryResponse = {
  invariants: { registeredDnaCount: number; chiefBrainCountedAsDna: boolean; researchLibraryCountedAsDna: boolean };
  registry: Array<{ canonicalId: string; turkishName: string; healthStatus: string; testStatus: string; currentState: string }>;
};
type SummaryResponse = {
  automaticLearning: string;
  autoApply: string;
  chiefBrain: { proposals: Array<{ proposalId: string; applyReadiness: string; problemStatement: string }> };
};
type ResearchResponse = { externalProvider: string; quarantinedCount: number; externalProviderCalled: boolean };

async function adminGet<T>(path: string): Promise<T> {
  const token = getAdminToken();
  const response = await fetch(path, { headers: token ? { "x-admin-token": token } : {} });
  if (!response.ok) throw new Error(`DNA yonetim bilgisi okunamadi (${response.status})`);
  return response.json();
}

function StateCard({ label, value, safe = true }: { label: string; value: React.ReactNode; safe?: boolean }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={safe ? "default" : "outline"}>{value}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CanonicalDnaPage() {
  const query = useQuery({
    queryKey: ["canonical-dna-panel"],
    retry: false,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [registry, summary, research] = await Promise.all([
        adminGet<RegistryResponse>("/api/aegis/dna/registry"),
        adminGet<SummaryResponse>("/api/aegis/dna/summary"),
        adminGet<ResearchResponse>("/api/aegis/dna/research"),
      ]);
      return { registry, summary, research };
    },
  });

  const data = query.data;
  const proposals = data?.summary.chiefBrain.proposals ?? [];
  const forbidden = proposals.filter((proposal) => proposal.applyReadiness === "FORBIDDEN").length;
  const insufficient = data?.registry.registry.filter((dna) => dna.testStatus === "NOT_MEASURED").length ?? 0;
  const solved = data?.registry.registry.filter((dna) => dna.currentState.includes("SOLVED_CANONICAL")).length ?? 0;
  const regressions = data?.registry.registry.filter((dna) => dna.currentState.includes("NEW_REAL_REGRESSION")).length ?? 0;

  return (
    <AdminGuard error={query.error}>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3"><Brain className="w-8 h-8 text-primary" />Kanonik DNA Merkezi</h1>
          <p className="text-muted-foreground mt-2">16 DNA, Research Library ve Chief Brain icin salt-okunur yonetim ozeti.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StateCard label="DNA kaydi" value={`${data?.registry.invariants.registeredDnaCount ?? "-"} / 16`} />
          <StateCard label="Otomatik ogrenme" value={data?.summary.automaticLearning ?? "Yukleniyor"} />
          <StateCard label="Otomatik uygulama" value={data?.summary.autoApply ?? "Yukleniyor"} safe={false} />
          <StateCard label="Dis provider" value={data?.research.externalProvider ?? "Yukleniyor"} safe={false} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StateCard label="Oneri hazir" value={proposals.length} />
          <StateCard label="Insan onayi bekliyor" value={proposals.length} safe={false} />
          <StateCard label="Uygulanmasi yasak" value={forbidden} safe={forbidden === 0} />
          <StateCard label="Kaynak karantinada" value={data?.research.quarantinedCount ?? 0} safe={(data?.research.quarantinedCount ?? 0) === 0} />
          <StateCard label="Kanit yetersiz" value={insufficient} safe={insufficient === 0} />
          <StateCard label="Yeni gercek regresyon" value={regressions} safe={regressions === 0} />
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Guvenlik siniri</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>DNA sahiplik secmez, VAULT acmaz, kimlik uretmez ve partial sonucu exact yapmaz.</p>
            <p>Onceden cozulmus kayit: {solved}. Chief Brain bunu yeni klasor veya oturum nedeniyle yeniden acmaz.</p>
            <p>Chief Brain ve Research Library DNA sayilmaz: {data?.registry.invariants.chiefBrainCountedAsDna || data?.registry.invariants.researchLibraryCountedAsDna ? "HATA" : "dogru"}.</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="flex items-center gap-2"><Library className="w-5 h-5 text-primary" />16 DNA sagligi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data?.registry.registry.map((dna) => (
              <div key={dna.canonicalId} className="rounded-md border border-border p-3 flex items-center justify-between gap-3">
                <div><div className="font-medium">{dna.turkishName}</div><div className="text-xs text-muted-foreground">{dna.currentState}</div></div>
                <Badge variant={dna.healthStatus === "HEALTHY" ? "default" : "outline"}>{dna.healthStatus}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}

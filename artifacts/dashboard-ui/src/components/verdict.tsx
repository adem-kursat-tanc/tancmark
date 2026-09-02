import { Badge } from "@/components/ui/badge";

export type Verdict = "strong" | "ambiguous" | "insufficient";

const VERDICT_BADGE: Record<
  Verdict,
  { variant: "default" | "secondary" | "outline"; label: string }
> = {
  strong: { variant: "default", label: "Güçlü teknik eşleşme" },
  ambiguous: { variant: "secondary", label: "Belirsiz / kesin kaynak yok" },
  insufficient: { variant: "outline", label: "Kanıt yetersiz" },
};

export function verdictToneClass(v: Verdict): string {
  return v === "strong"
    ? "border-primary/40"
    : v === "ambiguous"
      ? "border-amber-500/40"
      : "border-border";
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const e = VERDICT_BADGE[verdict];
  return (
    <Badge variant={e.variant} data-testid={`scan-verdict-${verdict}`}>
      {e.label}
    </Badge>
  );
}

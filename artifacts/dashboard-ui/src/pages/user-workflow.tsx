import { Link } from "wouter";
import {
  ArrowRight,
  Camera,
  ClipboardList,
  FileText,
  LockKeyhole,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FlowCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof ShieldCheck;
  primary?: boolean;
};

const primaryActions: FlowCard[] = [
  {
    title: "Dosya Koru",
    description: "Fotoğraf, video, sesli video, metin veya belgeyi görünmez şekilde koruma altına alın.",
    href: "/protect-file",
    cta: "Dosya Seç",
    icon: ShieldCheck,
    primary: true,
  },
  {
    title: "Sızıntı Tara",
    description: "Sızan veya şüpheli dosyada TancMark izi arar.",
    href: "/scan-leak",
    cta: "Şüpheli Dosya Seç",
    icon: Search,
    primary: true,
  },
];

const secondaryActions: FlowCard[] = [
  {
    title: "Delil Raporu Al",
    description: "Bulunan izleri, zaman damgasını ve kayıtları sade rapor haline getirir.",
    href: "/secure-room-report",
    cta: "Koruma Raporunu Gör",
    icon: FileText,
  },
  {
    title: "Koruma Kayıtları",
    description: "Zehir ve Secure Room kayıtlarını sade şekilde gösterir.",
    href: "/zehir-report",
    cta: "Kayıtları gör",
    icon: ClipboardList,
  },
  {
    title: "Gelişmiş / Admin Paneli",
    description: "Teknik testler, modül sonuçları ve ayrıntılı kayıtlar.",
    href: "/overview",
    cta: "Gelişmişe geç",
    icon: Settings,
  },
];

function ActionCard({ action }: { action: FlowCard }) {
  const Icon = action.icon;
  return (
    <Card
      className={`border-border/60 bg-card/70 ${
        action.primary ? "min-h-[230px]" : "min-h-[190px]"
      }`}
    >
      <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
        <div className="space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className={action.primary ? "text-2xl font-semibold" : "text-xl font-semibold"}>
              {action.title}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">{action.description}</p>
          </div>
        </div>
        <Link href={action.href}>
          <Button
            className="w-full justify-between"
            variant={action.primary ? "default" : "outline"}
            data-testid={`workflow-${action.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {action.cta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function UserWorkflowPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 md:p-8">
        <section className="rounded-lg border border-border/70 bg-card/70 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge variant="outline" className="w-fit">
                Son kullanıcı akışı
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  TancMark Koruma Paneli
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Dosyanızı koruyun, şüpheli bir kopyayı tarayın ve sonucu sade bir
                  rapor olarak görün.
                </p>
              </div>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6">
              <div className="font-medium">Güvenlik notu</div>
              <div className="mt-1 text-muted-foreground">
                Kesin sonuç yalnız TancMark ID okunup sistem kaydıyla eşleşirse oluşur.
                Aday izler tek başına kesin kanıt değildir.
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {primaryActions.map((action) => (
            <ActionCard key={action.title} action={action} />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {secondaryActions.map((action) => (
            <ActionCard key={action.title} action={action} />
          ))}
        </section>

        <section className="rounded-lg border border-border/70 bg-muted/30 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-background text-primary">
                <LockKeyhole className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold">Sonuç dili sade tutulur</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Kullanıcıya yalnızca kesin eşleşme, aday iz veya kesin sonuç yok
                  durumları gösterilir.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Kesin eşleşme bulundu</Badge>
              <Badge variant="outline">Aday iz bulundu</Badge>
              <Badge variant="outline">Kesin sonuç yok</Badge>
              <Badge variant="outline">Rapor hazır</Badge>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-card/70 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-background text-primary">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold">Ekran Çekimi Aday İzi</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Bu kayıt, içeriğin ekran üzerinden telefonla çekilmiş olabileceğine dair
                  yardımcı sinyaldir. Kesin sonuç değildir.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Aday iz bulundu</Badge>
              <Badge variant="outline">Kesin sonuç değildir</Badge>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

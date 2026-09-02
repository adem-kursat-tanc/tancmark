import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Server } from "lucide-react";
import { clearAdminToken, getAdminToken, setAdminToken } from "@/lib/admin-token-store";

export default function Settings() {
  const [token, setToken] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const saved = getAdminToken();
    if (saved) setToken(saved);
  }, []);

  const handleSave = () => {
    if (token.trim()) {
      setAdminToken(token);
      toast({
        title: "Oturum Anahtari Ayarlandi",
        description: "Yonetici anahtari yalnizca bu sayfa oturumunun belleginde tutulur.",
      });
    } else {
      clearAdminToken();
      toast({
        title: "Anahtar Silindi",
        description: "Yonetici anahtari bellekten kaldirildi.",
      });
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
          <KeyRound className="w-8 h-8 text-primary" />
          Ayarlar
        </h1>
        <p className="text-muted-foreground mt-2">Sistem yapilandirmasi ve erisim yonetimi.</p>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Kimlik Dogrulama</CardTitle>
          <CardDescription>
            TancMark yonetim uc noktalarina erismek icin sistem yoneticisi anahtarina ihtiyaciniz var.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-token">Yonetici Anahtari</Label>
            <div className="flex gap-3">
              <Input
                id="admin-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="yonetici_anahtari"
                className="font-mono bg-background"
                data-testid="input-admin-token"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Bu anahtar tarayicida kalici guvenli kasa gibi saklanmaz; yalnizca acik sayfa oturumunun belleginde tutulur.
              Uretimde daha guvenli oturum yonetimi gerekir.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/50 px-6 py-4">
          <Button onClick={handleSave} data-testid="btn-save-settings">
            Ayarlari Kaydet
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Sistem Bilgisi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Server className="w-4 h-4" /> API Taban URL'si
            </Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm border border-border">
              {import.meta.env.BASE_URL || "/api"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

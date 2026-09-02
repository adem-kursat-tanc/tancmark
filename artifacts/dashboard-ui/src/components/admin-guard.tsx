import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, KeyRound } from "lucide-react";
import { useAdminToken } from "@/hooks/use-admin-token";

interface AdminGuardProps {
  children: React.ReactNode;
  error?: unknown;
}

function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 401;
}

export function AdminGuard({ children, error }: AdminGuardProps) {
  const { hasToken } = useAdminToken();

  if (!hasToken) {
    return (
      <EmptyState
        icon={<KeyRound className="w-8 h-8 text-muted-foreground" />}
        title="Yönetici Anahtarı Gerekli"
        description="Bu sayfayı görüntülemek için Ayarlar sayfasından yönetici anahtarınızı girin."
      />
    );
  }

  if (isUnauthorizedError(error)) {
    return (
      <EmptyState
        icon={<AlertCircle className="w-8 h-8 text-destructive" />}
        title="Erişim Reddedildi"
        description="Girdiğiniz yönetici anahtarı geçersiz. Lütfen Ayarlar sayfasından kontrol edin."
      />
    );
  }

  return <>{children}</>;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-8 max-w-md">{description}</p>
      <Link href="/settings">
        <Button data-testid="btn-go-to-settings">Ayarlara Git</Button>
      </Link>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import {
  Shield,
  Eye,
  FileText,
  List,
  Settings,
  Bot,
  ShieldCheck,
  Radar,
  Globe2,
  FileVideo,
  History,
  Brain,
  ListChecks,
  PlayCircle,
  MonitorCheck,
  Home,
  FileLock2,
  FileSearch,
  PlugZap,
  RadioTower,
} from "lucide-react";
import React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Koruma Paneli", icon: Home },
    { href: "/protect-file", label: "Dosya Koru", icon: FileLock2 },
    { href: "/scan-leak", label: "Sızıntı Tara", icon: FileSearch },
    { href: "/overview", label: "Teknik Genel Bakış", icon: Eye },
    { href: "/forensic", label: "Forensic Compare", icon: FileText },
    { href: "/audit", label: "Denetim Kayıtları", icon: List },
    { href: "/bot-trap", label: "Bot-Trap Pulse", icon: Bot },
    { href: "/data-cloak", label: "Data Cloak", icon: ShieldCheck },
    { href: "/radar", label: "Sızıntı Radarı", icon: Radar },
    { href: "/distribution-map", label: "Dağılım Haritası", icon: Globe2 },
    { href: "/new-mini-test", label: "Yeni Mini Test", icon: PlayCircle },
    { href: "/last-video-test", label: "Son Video Testi", icon: FileVideo },
    { href: "/test-history", label: "Test Geçmişi", icon: History },
    { href: "/learning-summary", label: "Öğrenme Özeti", icon: Brain },
    { href: "/dna-canonical", label: "Kanonik DNA Merkezi", icon: Brain },
    { href: "/improvement-suggestions", label: "Geliştirme Önerileri", icon: ListChecks },
    { href: "/zehir-report", label: "Zehir Kayıtları", icon: MonitorCheck },
    { href: "/secure-room-report", label: "Secure Room Kayıtları", icon: Shield },
    { href: "/discovery-provider-setup", label: "Discovery API Hazirlik", icon: PlugZap },
    { href: "/live-readiness", label: "Live Hazirlik", icon: RadioTower },
    { href: "/settings", label: "Ayarlar", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <img
            src="/brand/tancmark-logo-dark.svg"
            alt="TancMark"
            className="h-8 w-auto max-w-[170px]"
          />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`nav-${item.href.replace("/", "") || "home"}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border shrink-0">
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
            Sistem Aktif
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background/50">
          {children}
        </main>
      </div>
    </div>
  );
}

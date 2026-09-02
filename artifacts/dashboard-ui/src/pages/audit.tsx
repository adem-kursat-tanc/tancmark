import React, { useState } from "react";
import { AdminGuard } from "@/components/admin-guard";
import { useListAudit, getListAuditQueryKey, AuditKind } from "@workspace/api-client-react";
import { useAdminToken } from "@/hooks/use-admin-token";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { List, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function Audit() {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [ipFilter, setIpFilter] = useState("");
  const [clientIdFilter, setClientIdFilter] = useState("");
  
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const params: any = { limit: 50 };
  if (kindFilter !== "all") params.kind = kindFilter;
  if (ipFilter) params.ip = ipFilter;
  if (clientIdFilter) params.clientId = Number(clientIdFilter);

  const { hasToken } = useAdminToken();
  const { data, error, isLoading } = useListAudit(
    params,
    { query: { enabled: hasToken, retry: false, queryKey: getListAuditQueryKey(params) } }
  );

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case "canary_hit": return "destructive";
      case "anomaly": return "destructive";
      case "Linguistic_DNA": return "default";
      case "rate_limit_exceeded": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AdminGuard error={error}>
      <div className="p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="shrink-0">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <List className="w-8 h-8 text-primary" />
            Denetim Kayıtları
          </h1>
          <p className="text-muted-foreground mt-2">Sistemdeki tüm eylemlerin tam günlüğü.</p>
        </div>

        <div className="flex gap-4 shrink-0 bg-card p-4 rounded-lg border border-border/50">
          <div className="w-48">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger data-testid="filter-kind">
                <SelectValue placeholder="Tür Filtresi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {Object.keys(AuditKind).map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Input 
              placeholder="IP Adresi..." 
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
              data-testid="filter-ip"
            />
          </div>
          <div className="w-48">
            <Input 
              placeholder="Müşteri ID..." 
              value={clientIdFilter}
              onChange={(e) => setClientIdFilter(e.target.value)}
              type="number"
              data-testid="filter-clientid"
            />
          </div>
        </div>

        <div className="flex-1 bg-card rounded-lg border border-border/50 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Rota</TableHead>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : data?.events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Kayıt bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.events.map((event) => (
                    <React.Fragment key={event.id}>
                      <TableRow className="hover:bg-muted/20 cursor-pointer" onClick={() => toggleRow(event.id)} data-testid={`row-audit-${event.id}`}>
                        <TableCell>
                          {expandedRows[event.id] ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                          {format(new Date(event.ts), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getKindColor(event.kind) as any} className="font-mono text-[10px] uppercase">
                            {event.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{event.ip}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                          {event.route}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{event.clientId || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{event.userId || "-"}</TableCell>
                      </TableRow>
                      {expandedRows[event.id] && (
                        <TableRow className="bg-muted/10">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-4 pl-16 border-b border-border/30">
                              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Detaylar (JSON)</div>
                              <pre className="bg-black/50 p-4 rounded-md font-mono text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(event.details || {}, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}

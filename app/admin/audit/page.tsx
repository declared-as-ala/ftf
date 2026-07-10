'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { AuditTimeline } from '@/components/ui/AuditTimeline';

interface AuditEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  actorRole?: string;
  before?: any;
  after?: any;
  reason?: string;
  createdAt: string;
}

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    entityId: '',
  });

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.entityId) params.set('entityId', filters.entityId);
    params.set('limit', '100');

    fetch(`/api/admin/audit?${params}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d.logs); setTotal(d.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, []);

  const actionColors: Record<string, string> = {
    MATCH_FINALIZED: 'bg-green-100 text-green-800',
    MATCH_REOPENED: 'bg-orange-100 text-orange-800',
    MATCH_CREATED: 'bg-blue-100 text-blue-800',
    MATCH_RESULT_UPDATED: 'bg-yellow-100 text-yellow-800',
    SUSPENSION_CREATED: 'bg-red-100 text-red-800',
    STANDINGS_REBUILT: 'bg-purple-100 text-purple-800',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registre d'Audit"
        description="Consultez l'historique des modifications"
      />

      <Card>
        <CardHeader><CardTitle>Filtres</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground">Action</label>
              <Input
                placeholder="MATCH_FINALIZED, SUSPENSION_CREATED..."
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground">Type d'entité</label>
              <Input
                placeholder="Match, Suspension, Discipline..."
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted-foreground">ID d'entité</label>
              <Input
                placeholder="ObjectId..."
                value={filters.entityId}
                onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchLogs} className="flex items-center gap-2">
                <Search className="h-4 w-4" /> Rechercher
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{total} entrée(s) trouvée(s)</p>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune entrée d'audit trouvée</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log._id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                    {log.action}
                  </Badge>
                  <Badge variant="outline">{log.entityType}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Par {log.actorRole || '—'} · {log.reason ? `Raison: ${log.reason}` : ''}
                </p>
                <AuditTimeline entries={[{
                  _id: log._id,
                  action: log.action,
                  before: log.before,
                  after: log.after,
                  actorRole: log.actorRole || '—',
                  createdAt: log.createdAt,
                  ...(log.reason ? { reason: log.reason } : {}),
                }]} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

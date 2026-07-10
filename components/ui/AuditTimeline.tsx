import { cn } from '@/lib/utils';

interface AuditEntry {
  _id: string;
  action: string;
  before?: any;
  after?: any;
  actorRole: string;
  reason?: string;
  createdAt: string;
}

interface AuditTimelineProps {
  entries: AuditEntry[];
  className?: string;
}

const actionLabels: Record<string, string> = {
  MATCH_FINALIZED: 'Match homologué',
  MATCH_REOPENED: 'Match réouvert',
  MATCH_RESCHEDULED: 'Match reporté',
  MATCH_CREATED: 'Match créé',
  MATCH_UPDATED: 'Match modifié',
  MATCH_DELETED: 'Match supprimé',
  RESULT_UPDATED: 'Résultat modifié',
  EVENT_ADDED: 'Événement ajouté',
  EVENT_UPDATED: 'Événement modifié',
  EVENT_DELETED: 'Événement supprimé',
  RED_CARD_DECISION_RECORDED: 'Décision carton rouge enregistrée',
  SUSPENSION_CANCELLED: 'Suspension annulée',
  SUSPENSION_AMENDED: 'Suspension modifiée',
};

function getActionLabel(action: string): string {
  return actionLabels[action] || action;
}

export function AuditTimeline({ entries, className }: AuditTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Aucune entrée d&apos;audit</p>;
  }

  return (
    <div className={cn('space-y-0', className)}>
      {entries.map((entry, idx) => (
        <div key={entry._id} className="relative flex gap-4 pb-6 last:pb-0">
          {idx < entries.length - 1 && (
            <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
          )}
          <div className="flex h-4 w-4 shrink-0 items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary/60" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{getActionLabel(entry.action)}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
              {' — '}
              {entry.actorRole === 'FTF_ADMIN' ? 'Admin FTF' : 'Club'}
            </p>
            {entry.reason && (
              <p className="text-xs text-muted-foreground italic">
                Raison : {entry.reason}
              </p>
            )}
            {entry.before && entry.after && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Détails</summary>
                <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto">
                  {JSON.stringify({ avant: entry.before, après: entry.after }, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

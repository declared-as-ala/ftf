import { cn } from '@/lib/utils';
import { Bell, AlertTriangle, CheckCircle2, Shield, Trophy, RefreshCw } from 'lucide-react';
import type { NotificationType } from '@/lib/models/Notification';

interface NotificationItemProps {
  type: NotificationType;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  onMarkRead?: () => void;
  className?: string;
}

const iconMap: Record<string, typeof Bell> = {
  SUSPENSION_CREATED: Shield,
  SUSPENSION_SERVED: CheckCircle2,
  SUSPENSION_CANCELLED: Shield,
  RED_CARD_DECISION_REQUIRED: AlertTriangle,
  RED_CARD_DECISION_RECORDED: Shield,
  YELLOW_AT_RISK: AlertTriangle,
  ANOMALY_DETECTED: AlertTriangle,
  STANDINGS_UPDATED: Trophy,
  MATCH_FINALIZED: CheckCircle2,
  MATCH_REOPENED: RefreshCw,
};

export function NotificationItem({ type, subject, body, read, createdAt, onMarkRead, className }: NotificationItemProps) {
  const Icon = iconMap[type] || Bell;

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border p-3 transition-colors',
        read ? 'bg-background' : 'bg-muted/40 border-primary/20',
        className
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        read ? 'bg-muted' : 'bg-primary/10'
      )}>
        <Icon className={cn('h-4 w-4', read ? 'text-muted-foreground' : 'text-primary')} />
      </div>
      <div className="flex-1 space-y-1">
        <p className={cn('text-sm', read ? 'text-muted-foreground' : 'font-medium text-foreground')}>
          {subject}
        </p>
        <p className="text-xs text-muted-foreground">{body}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(createdAt).toLocaleString('fr-TN', { timeZone: 'Africa/Tunis' })}
        </p>
      </div>
      {!read && onMarkRead && (
        <button
          onClick={onMarkRead}
          className="self-start rounded p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover:opacity-100 transition-opacity"
          title="Marquer comme lu"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

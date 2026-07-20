'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from '@/components/ui/NotificationItem';
import type { NotificationType } from '@/lib/models/Notification';
import { Bell, CheckCheck, Loader2, Megaphone } from 'lucide-react';

interface Notification {
  _id: string;
  type: NotificationType;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
  broadcastId?: string;
}

export default function ClubNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifs = useCallback(() => {
    const params = new URLSearchParams();
    if (unreadOnly) params.set('unreadOnly', 'true');
    setLoading(true);
    fetch(`/api/club/notifications?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unreadCount || 0);
      })
      .finally(() => setLoading(false));
  }, [unreadOnly]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    await fetch('/api/club/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch('/api/club/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? (
              <span>
                <span className="font-semibold text-foreground">{unreadCount}</span> notification{unreadCount !== 1 ? 's' : ''} non lue{unreadCount !== 1 ? 's' : ''}
              </span>
            ) : (
              'Toutes les notifications ont été lues'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUnreadOnly(false)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            Toutes
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            Non lues
          </button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={markingAll}
              className="gap-2"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Tout marquer comme lu
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Bell className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
            {unreadOnly && (
              <button
                onClick={() => setUnreadOnly(false)}
                className="text-sm text-primary underline underline-offset-2"
              >
                Voir toutes les notifications
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n._id} className="flex items-start gap-2">
              <div className="flex-1">
                {n.type === 'MANUAL_BROADCAST' ? (
                  /* Custom render for broadcast messages */
                  <div className={`rounded-xl border p-4 transition-colors ${n.read ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-muted' : 'bg-blue-500/10'}`}>
                        <Megaphone className={`h-4 w-4 ${n.read ? 'text-muted-foreground' : 'text-blue-600'}`} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${n.read ? '' : 'text-foreground'}`}>{n.subject}</p>
                          <Badge variant="outline" className="text-xs">Communication officielle</Badge>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <NotificationItem
                    type={n.type}
                    subject={n.subject}
                    body={n.body}
                    read={n.read}
                    createdAt={n.createdAt}
                  />
                )}
              </div>
              {!n.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markRead(n._id)}
                  className="mt-1 shrink-0"
                  title="Marquer comme lu"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

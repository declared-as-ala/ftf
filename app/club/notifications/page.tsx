'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationItem } from '@/components/ui/NotificationItem';
import type { NotificationType } from '@/lib/models/Notification';
import { Bell } from 'lucide-react';

interface Notification {
  _id: string;
  type: NotificationType;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
}

export default function ClubNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifs = () => {
    const params = new URLSearchParams();
    if (unreadOnly) params.set('unreadOnly', 'true');
    fetch(`/api/club/notifications?${params}`)
      .then((r) => r.json())
      .then((d) => { setNotifications(d.notifications); setUnreadCount(d.unreadCount); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifs(); }, [unreadOnly]);

  const markRead = async (id: string) => {
    await fetch('/api/club/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });
    fetchNotifs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount} notification(s) non lue(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-12"><Bell className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">Aucune notification</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n._id} className="flex items-start gap-2">
              <div className="flex-1">
                <NotificationItem
                  type={n.type}
                  subject={n.subject}
                  body={n.body}
                  read={n.read}
                  createdAt={n.createdAt}
                />
              </div>
              {!n.read && (
                <Button variant="outline" size="sm" onClick={() => markRead(n._id)} className="mt-2">
                  Marquer lue
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

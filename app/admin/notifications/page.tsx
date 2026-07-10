'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationItem } from '@/components/ui/NotificationItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { Bell } from 'lucide-react';

interface Notification {
  _id: string;
  type: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const limit = 50;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (unreadOnly) params.set('unread', 'true');

        const res = await fetch(`/api/admin/notifications?${params}`);
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotal(data.total || 0);
        setUnreadCount(data.unreadCount || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, unreadOnly]);

  async function handleMarkRead(notificationId: string) {
    try {
      await fetch(`/api/club/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} notification(s) non lue(s)`}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => { setUnreadOnly(false); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
        >
          Toutes
        </button>
        <button
          onClick={() => { setUnreadOnly(true); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
        >
          Non lues
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Bell className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-12 w-12" />}
          title="Aucune notification"
          description="Vous n'avez aucune notification pour le moment"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem
              key={n._id}
              type={n.type as any}
              subject={n.subject}
              body={n.body}
              read={n.read}
              createdAt={n.createdAt}
              onMarkRead={n.read ? undefined : () => handleMarkRead(n._id)}
            />
          ))}
          {total > limit && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} / {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotificationItem } from '@/components/ui/NotificationItem';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell, Send, History, ChevronDown, ChevronUp, Users,
  CheckCircle2, Loader2, AlertCircle, Copy, Archive
} from 'lucide-react';

interface AdminNotification {
  _id: string;
  type: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface Club {
  _id: string;
  nom: string;
  code?: string;
}

interface Broadcast {
  _id: string;
  subject: string;
  body: string;
  target: 'ALL' | 'SPECIFIC';
  totalRecipients: number;
  readCount: number;
  sentAt?: string;
  createdAt: string;
  status: string;
}

type TabKey = 'inbox' | 'compose' | 'history';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('inbox');

  // ── Inbox ──────────────────────────────────────────────
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const limit = 50;

  const loadInbox = useCallback(async () => {
    setLoadingInbox(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (unreadOnly) params.set('unread', 'true');
      const res = await fetch(`/api/admin/notifications?${params}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      setLoadingInbox(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => { if (activeTab === 'inbox') loadInbox(); }, [activeTab, loadInbox]);

  async function handleMarkRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: 'PUT' });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  // ── Compose ────────────────────────────────────────────
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoaded, setClubsLoaded] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'ALL' | 'SPECIFIC'>('ALL');
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'compose' && !clubsLoaded) {
      fetch('/api/admin/clubs?limit=200')
        .then((r) => r.json())
        .then((d) => { setClubs(d.clubs || []); setClubsLoaded(true); });
    }
  }, [activeTab, clubsLoaded]);

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, target, targetClubIds: selectedClubs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult({ ok: false, msg: data.error || 'Erreur lors de l\'envoi' });
      } else {
        const { broadcast } = data;
        setSendResult({
          ok: true,
          msg: `Notification envoyée à ${broadcast.totalRecipients} club(s).`,
        });
        setSubject('');
        setBody('');
        setTarget('ALL');
        setSelectedClubs([]);
      }
    } catch {
      setSendResult({ ok: false, msg: 'Erreur réseau' });
    } finally {
      setSending(false);
    }
  }

  function toggleClub(id: string) {
    setSelectedClubs((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  // ── History ────────────────────────────────────────────
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [broadcastTotal, setBroadcastTotal] = useState(0);
  const [broadcastPage, setBroadcastPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [broadcastDetail, setBroadcastDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/notifications/broadcast?page=${broadcastPage}&limit=20`);
      const data = await res.json();
      setBroadcasts(data.broadcasts || []);
      setBroadcastTotal(data.total || 0);
    } finally {
      setLoadingHistory(false);
    }
  }, [broadcastPage]);

  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); setBroadcastDetail(null); return; }
    setExpanded(id);
    setLoadingDetail(true);
    setBroadcastDetail(null);
    try {
      const res = await fetch(`/api/admin/notifications/broadcast/${id}`);
      const data = await res.json();
      setBroadcastDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }

  const [archiving, setArchiving] = useState<string | null>(null);

  async function handleArchive(id: string) {
    setArchiving(id);
    try {
      const res = await fetch(`/api/admin/notifications/broadcast/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBroadcasts((prev) => prev.map((b) => (b._id === id ? { ...b, status: 'ARCHIVED' } : b)));
      }
    } finally {
      setArchiving(null);
    }
  }

  /** Prefill the compose form from an existing broadcast and switch to it. */
  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/admin/notifications/broadcast/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSubject(data.broadcast.subject);
    setBody(data.broadcast.body);
    setTarget(data.broadcast.target);
    setSelectedClubs((data.broadcast.targetClubIds || []).map((c: any) => c._id || c));
    setSendResult(null);
    setActiveTab('compose');
  }

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'inbox', label: 'Boîte de réception', icon: <Bell className="h-4 w-4" /> },
    { key: 'compose', label: 'Nouvelle notification', icon: <Send className="h-4 w-4" /> },
    { key: 'history', label: 'Historique des envois', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} notification(s) non lue(s) dans votre boîte`}
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── INBOX ── */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setUnreadOnly(false); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${!unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
            >Toutes</button>
            <button
              onClick={() => { setUnreadOnly(true); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${unreadOnly ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
            >Non lues</button>
          </div>

          {loadingInbox ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="Aucune notification"
              description="Toutes les alertes système apparaissent ici"
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
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Précédent</button>
                  <span className="flex items-center text-sm text-muted-foreground">Page {page} / {Math.ceil(total / limit)}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / limit)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Suivant</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── COMPOSE ── */}
      {activeTab === 'compose' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Composer une notification
              </CardTitle>
              <CardDescription>
                Envoyer un message manuel à un ou plusieurs clubs. Chaque club recevra une notification dans sa boîte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Sujet */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sujet *</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="Objet de la notification…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Corps */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Message *</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  rows={6}
                  placeholder="Contenu du message…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{body.length}/5000</p>
              </div>

              {/* Cible */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Destinataires *</label>
                <div className="flex gap-3">
                  {(['ALL', 'SPECIFIC'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTarget(t)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        target === t
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {t === 'ALL' ? <Users className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      {t === 'ALL' ? 'Tous les clubs actifs' : 'Clubs spécifiques'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Club selector when SPECIFIC */}
              {target === 'SPECIFIC' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Sélectionner les clubs ({selectedClubs.length} sélectionné{selectedClubs.length !== 1 ? 's' : ''})
                  </label>
                  <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                    {clubs.map((club) => (
                      <label key={club._id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                        <input
                          type="checkbox"
                          checked={selectedClubs.includes(club._id)}
                          onChange={() => toggleClub(club._id)}
                          className="h-4 w-4 rounded border"
                        />
                        <span className="text-sm">{club.nom}</span>
                        {club.code && <span className="ml-auto text-xs text-muted-foreground">{club.code}</span>}
                      </label>
                    ))}
                    {clubs.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">Chargement des clubs…</p>
                    )}
                  </div>
                </div>
              )}

              {/* Result banner */}
              {sendResult && (
                <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  sendResult.ok
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-500/10 text-red-700 dark:text-red-400'
                }`}>
                  {sendResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {sendResult.msg}
                </div>
              )}

              <Button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !body.trim() || (target === 'SPECIFIC' && selectedClubs.length === 0)}
                className="w-full gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Envoi en cours…' : 'Envoyer la notification'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-blue-700 dark:text-blue-400">Conseils d&apos;utilisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>• <strong>Tous les clubs actifs</strong> — pour les communications générales (calendrier, règlements).</p>
                <p>• <strong>Clubs spécifiques</strong> — pour les convocations, rappels ciblés.</p>
                <p>• Chaque notification apparaît dans la boîte de chaque club destinataire.</p>
                <p>• Les clubs peuvent marquer les notifications comme lues.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── HISTORY ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : broadcasts.length === 0 ? (
            <EmptyState
              icon={<History className="h-12 w-12" />}
              title="Aucun envoi"
              description="Les notifications manuelles envoyées apparaissent ici"
            />
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <Card key={b._id} className={b.status === 'ARCHIVED' ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{b.subject}</p>
                          <Badge variant={b.status === 'SENT' ? 'default' : 'outline'} className="text-xs shrink-0">
                            {b.status === 'SENT' ? 'Envoyé' : 'Archivé'}
                          </Badge>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {b.target === 'ALL' ? 'Tous les clubs' : 'Ciblé'}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{b.body}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {b.totalRecipients} destinataire{b.totalRecipients !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {b.readCount} lu{b.readCount !== 1 ? 's' : ''}
                            {b.totalRecipients > 0 && (
                              <span className="ml-1 text-muted-foreground/60">
                                ({Math.round((b.readCount / b.totalRecipients) * 100)}%)
                              </span>
                            )}
                          </span>
                          <span>
                            {new Date(b.sentAt || b.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleDuplicate(b._id)}
                          className="rounded-md p-1.5 hover:bg-muted"
                          title="Dupliquer vers un nouveau message"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {b.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => handleArchive(b._id)}
                            disabled={archiving === b._id}
                            className="rounded-md p-1.5 hover:bg-muted disabled:opacity-50"
                            title="Archiver"
                          >
                            {archiving === b._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpand(b._id)}
                          className="rounded-md p-1.5 hover:bg-muted"
                          title="Voir les détails"
                        >
                          {expanded === b._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded === b._id && (
                      <div className="mt-4 border-t pt-4 space-y-3">
                        {loadingDetail ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : broadcastDetail ? (
                          <>
                            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{broadcastDetail.broadcast?.body}</p>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destinataires</p>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {(broadcastDetail.recipients || []).map((r: any) => (
                                  <div key={r._id} className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-muted">
                                    <span>{r.recipientClubId?.nom ?? 'Club inconnu'}</span>
                                    {r.read ? (
                                      <span className="flex items-center gap-1 text-emerald-600">
                                        <CheckCircle2 className="h-3 w-3" /> Lu
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">Non lu</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {broadcastTotal > 20 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button onClick={() => setBroadcastPage((p) => Math.max(1, p - 1))} disabled={broadcastPage <= 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Précédent</button>
                  <span className="flex items-center text-sm text-muted-foreground">Page {broadcastPage} / {Math.ceil(broadcastTotal / 20)}</span>
                  <button onClick={() => setBroadcastPage((p) => p + 1)} disabled={broadcastPage >= Math.ceil(broadcastTotal / 20)} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">Suivant</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

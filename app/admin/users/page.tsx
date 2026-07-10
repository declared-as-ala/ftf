'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/PageHeader';
import { Plus, UserCheck, UserX, RefreshCw } from 'lucide-react';

interface ClubUser {
  _id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  clubId?: { _id: string; nom: string };
  createdAt: string;
  lastLoginAt?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<ClubUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'CLUB_ADMIN', clubId: '' });
  const [clubs, setClubs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/admin/users?limit=200')
      .then((r) => r.json())
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    fetch('/api/admin/clubs?limit=200')
      .then((r) => r.json())
      .then(setClubs);
  }, []);

  const statusToggle = async (user: ClubUser) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await fetch(`/api/admin/users/${user._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchUsers();
  };

  const resetPassword = async (user: ClubUser) => {
    const newPw = 'ChangeMe@123';
    await fetch(`/api/admin/users/${user._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPw, mustChangePassword: true }),
    });
    alert(`Mot de passe réinitialisé à: ${newPw}`);
    fetchUsers();
  };

  const createUser = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ email: '', name: '', password: '', role: 'CLUB_ADMIN', clubId: '' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      DISABLED: 'bg-gray-100 text-gray-800',
      INVITED: 'bg-blue-100 text-blue-800',
    };
    return <Badge className={colors[status] || ''}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Utilisateurs" description={`${total} utilisateur(s)`} />
        <Button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> {showCreate ? 'Annuler' : 'Nouvel utilisateur'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Créer un utilisateur</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@club.tn" />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom affiché" />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-md border p-2 bg-background">
                  <option value="CLUB_ADMIN">Administrateur de club</option>
                  <option value="FTF_ADMIN">Administrateur FTF</option>
                </select>
              </div>
              {form.role === 'CLUB_ADMIN' && (
                <div className="space-y-2">
                  <Label>Club</Label>
                  <select value={form.clubId} onChange={(e) => setForm({ ...form, clubId: e.target.value })} className="w-full rounded-md border p-2 bg-background">
                    <option value="">— Sélectionner un club —</option>
                    {clubs.map((c: any) => <option key={c._id} value={c._id}>{c.nom}</option>)}
                  </select>
                </div>
              )}
            </div>
            <Button onClick={createUser} disabled={saving}>
              {saving ? 'Création...' : 'Créer'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{u.name || u.email}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{u.email}</span>
                    <Badge variant="secondary">{u.role}</Badge>
                    {statusBadge(u.status)}
                    {u.clubId && <span>— {u.clubId.nom}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Créé le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                    {u.lastLoginAt && ` · Dernière connexion: ${new Date(u.lastLoginAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => statusToggle(u)} title={u.status === 'ACTIVE' ? 'Suspendre' : 'Activer'}>
                    {u.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resetPassword(u)} title="Réinitialiser le mot de passe">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

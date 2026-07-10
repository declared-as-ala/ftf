'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Calendar, Shield, AlertTriangle, Trophy, Bell } from 'lucide-react';

interface DashboardData {
  totalJoueurs: number;
  prochainsMatchs: any[];
  suspensionsActives: any[];
  cardsThisSeason: number;
  monClassement: any;
  unreadNotifs: number;
}

export default function ClubDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/club/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-muted-foreground">Erreur de chargement</p>;

  const statsCards = [
    { title: 'Mes Joueurs', value: data.totalJoueurs, desc: 'Joueurs actifs', icon: Users, color: 'text-green-600' },
    { title: 'Matchs à Venir', value: data.prochainsMatchs.length, desc: 'Matchs programmés', icon: Calendar, color: 'text-orange-600' },
    { title: 'Suspensions Actives', value: data.suspensionsActives.length, desc: 'Joueurs suspendus', icon: Shield, color: 'text-red-600' },
    { title: 'Cartons', value: data.cardsThisSeason, desc: 'Cette saison', icon: AlertTriangle, color: 'text-yellow-600' },
    { title: 'Notifications Non Lues', value: data.unreadNotifs, desc: 'À consulter', icon: Bell, color: 'text-blue-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Vue d&apos;ensemble de votre club</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.prochainsMatchs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prochains Matchs</CardTitle>
              <CardDescription>Calendrier à venir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.prochainsMatchs.map((m: any) => (
                  <Link key={m._id} href={`/club/matches/${m._id}`} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {m.homeClubId?.nom} vs {m.awayClubId?.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.date).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Badge variant="outline">{m.stade}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.suspensionsActives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Joueurs Suspendus</CardTitle>
              <CardDescription>Attention : joueurs indisponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.suspensionsActives.map((s: any) => (
                  <div key={s._id} className="flex items-center justify-between rounded-lg border p-3">
                    <p className="text-sm font-medium">{s.joueurId?.prenom} {s.joueurId?.nom}</p>
                    <Badge variant="destructive">{s.matchesRemaining} match{s.matchesRemaining > 1 ? 's' : ''}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.monClassement && (
          <Card>
            <CardHeader>
              <CardTitle>Classement — {data.monClassement.competition.nom}</CardTitle>
              <CardDescription>Position de votre club</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.monClassement.classement.map((row: any) => (
                  <div key={row.clubId?._id} className="flex items-center justify-between text-sm">
                    <span className={row.clubId?._id === 'current' ? 'font-bold' : ''}>
                      {row.position}. {row.clubId?.nom}
                    </span>
                    <span className="font-mono">{row.points} pts</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/club/players" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
          <Users className="h-5 w-5 text-green-600" />
          <span className="font-medium">Mes Joueurs</span>
        </Link>
        <Link href="/club/matches" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
          <Calendar className="h-5 w-5 text-orange-600" />
          <span className="font-medium">Mes Matchs</span>
        </Link>
        <Link href="/club/suspensions" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
          <Shield className="h-5 w-5 text-red-600" />
          <span className="font-medium">Suspensions</span>
        </Link>
        <Link href="/club/standings" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
          <Trophy className="h-5 w-5 text-blue-600" />
          <span className="font-medium">Classement</span>
        </Link>
        <Link href="/club/notifications" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
          <Bell className="h-5 w-5 text-purple-600" />
          <span className="font-medium">Notifications</span>
        </Link>
      </div>
    </div>
  );
}

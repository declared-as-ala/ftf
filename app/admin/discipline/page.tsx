'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, AlertTriangle, Clock, CheckCircle2, Users, ArrowRight } from 'lucide-react';

export default function DisciplineDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cardsRes, suspRes, redRes, anomalyRes] = await Promise.all([
          fetch('/api/admin/discipline/cards?limit=1'),
          fetch('/api/admin/discipline/suspensions?limit=1'),
          fetch('/api/admin/discipline/red-decisions?status=PROVISIONAL&limit=1'),
          fetch('/api/admin/discipline/anomalies?limit=1'),
        ]);

        const [cardsData, suspData, redData, anomalyData] = await Promise.all([
          cardsRes.json(), suspRes.json(), redRes.json(), anomalyRes.json(),
        ]);

        setStats({
          totalCards: cardsData.total || 0,
          activeSuspensions: suspData.total || 0,
          pendingRedDecisions: redData.total || 0,
          anomalies: anomalyData.total || 0,
        });
      } catch (err) {
        console.error('Failed to load discipline stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    {
      title: 'Cartons Actifs',
      value: stats?.totalCards ?? '—',
      description: 'Cartons jaunes en cours d\'accumulation',
      icon: Shield,
      color: 'text-yellow-600',
      href: '/admin/discipline/yellow-cards',
    },
    {
      title: 'Suspensions Actives',
      value: stats?.activeSuspensions ?? '—',
      description: 'Suspensions en cours',
      icon: Clock,
      color: 'text-red-600',
      href: '/admin/discipline/suspensions',
    },
    {
      title: 'Décisions Rouge Attendues',
      value: stats?.pendingRedDecisions ?? '—',
      description: 'Cartons rouges en attente de décision',
      icon: AlertTriangle,
      color: 'text-orange-600',
      href: '/admin/discipline/red-cards',
    },
    {
      title: 'Anomalies',
      value: stats?.anomalies ?? '—',
      description: 'Joueurs suspendus ayant participé',
      icon: AlertTriangle,
      color: 'text-rose-600',
      href: '/admin/discipline/anomalies',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discipline"
        description="Gestion des cartons, suspensions et décisions disciplinaires"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link key={i} href={card.href}>
              <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? (
                      <span className="text-muted-foreground animate-pulse">…</span>
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
            <CardDescription>Accès aux fonctionnalités disciplinaires</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/discipline/yellow-cards"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <Shield className="h-5 w-5 text-yellow-600" />
              <span className="font-medium">Cartons Jaunes</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/admin/discipline/red-cards"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium">Décisions Cartons Rouges</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/admin/discipline/suspensions"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="font-medium">Suspensions</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/admin/notifications"
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Notifications</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Règles Applicables</CardTitle>
            <CardDescription>Seuils de cartons et paramètres disciplinaires</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Seuil cartons jaunes</span>
                <span className="font-medium">3 cartons → 1 match suspension</span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Carton rouge direct</span>
                <span className="font-medium">Suspension provisoire → décision FTF</span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Double jaune → rouge</span>
                <span className="font-medium">Suspension provisoire (jaunes absorbés)</span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Matchs amicaux</span>
                <span className="font-medium">Pas d&apos;accumulation ni de purge</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

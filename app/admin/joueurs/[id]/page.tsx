'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CardBadge } from '@/components/ui/CardBadge';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { EligibilityBadge } from '@/components/ui/EligibilityBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Clock,
  Calendar,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';

interface DisciplinaryCardData {
  _id: string;
  cardType: 'YELLOW' | 'SECOND_YELLOW_RED' | 'DIRECT_RED';
  minute?: number;
  accumulationStatus: string;
  accumulationCount?: number;
  matchId: { _id: string; homeClubId: { nom: string }; awayClubId: { nom: string }; date: string };
  competitionId: { nom: string };
  createdAt: string;
}

interface SuspensionData {
  _id: string;
  suspensionType: string;
  status: string;
  scope: string;
  matchesSuspended: number;
  matchesServed: number;
  matchesRemaining: number;
  sourceMatchId?: { _id: string; homeClubId: { nom: string }; awayClubId: { nom: string } };
  createdAt: string;
  decisionDate?: string;
  decisionReason?: string;
}

interface JoueurDetail {
  _id: string;
  nom: string;
  prenom: string;
  licence: string;
  nationalite: string;
  position: string;
  clubId: { _id: string; nom: string };
  dateNaissance: string;
  numeroMaillot?: number;
  photo?: string;
  stats: {
    matchsJoues: number;
    buts: number;
    passes: number;
    cartonsJaunes: number;
    cartonsRouges: number;
  };
}

export default function JoueurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [joueur, setJoueur] = useState<JoueurDetail | null>(null);
  const [cards, setCards] = useState<DisciplinaryCardData[]>([]);
  const [suspensions, setSuspensions] = useState<SuspensionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const id = params.id as string;
        const [joueurRes, cardsRes, suspRes] = await Promise.all([
          fetch(`/api/admin/joueurs/${id}`),
          fetch(`/api/admin/discipline/cards?joueurId=${id}&limit=100`),
          fetch(`/api/admin/discipline/suspensions?joueurId=${id}&limit=100`),
        ]);

        if (!joueurRes.ok) {
          setError('Joueur introuvable');
          return;
        }

        const [joueurData, cardsData, suspData] = await Promise.all([
          joueurRes.json(),
          cardsRes.json(),
          suspRes.json(),
        ]);

        setJoueur(joueurData);
        setCards(cardsData.cards || cardsData || []);
        setSuspensions(suspData.suspensions || suspData || []);
      } catch (err) {
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !joueur) {
    return (
      <div className="p-6">
        <PageHeader title="Joueur" description="Détails du joueur" />
        <ErrorState title={error || 'Joueur introuvable'} description="Impossible de charger les informations du joueur." />
      </div>
    );
  }

  const activeCards = cards.filter((c) => c.accumulationStatus === 'ACTIVE');
  const activeSuspensions = suspensions.filter((s) => s.status === 'ACTIVE' || s.status === 'PROVISIONAL');

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la liste
      </button>

      <PageHeader
        title={`${joueur.prenom} ${joueur.nom}`}
        description={`Licence: ${joueur.licence} · ${joueur.position} · ${joueur.clubId?.nom || '—'}`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Statistiques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{joueur.stats?.matchsJoues || 0}</p>
                <p className="text-xs text-muted-foreground">Matchs joués</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{joueur.stats?.buts || 0}</p>
                <p className="text-xs text-muted-foreground">Buts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{joueur.stats?.cartonsJaunes || 0}</p>
                <p className="text-xs text-muted-foreground">Cartons jaunes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{joueur.stats?.cartonsRouges || 0}</p>
                <p className="text-xs text-muted-foreground">Cartons rouges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discipline en cours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Cartons actifs</span>
                <span className="font-bold">{activeCards.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Suspensions actives</span>
                <EligibilityBadge
                  available={activeSuspensions.length === 0}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Décisions rouges en attente</span>
                <span className="font-bold">
                  {suspensions.filter((s) => s.status === 'PROVISIONAL').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Nationalité: {joueur.nationalite}</p>
            <p>Né le: {new Date(joueur.dateNaissance).toLocaleDateString('fr-TN')}</p>
            {joueur.numeroMaillot && <p>Maillot: #{joueur.numeroMaillot}</p>}
            <p>
              Club:{' '}
              <Link href={`/admin/clubs/${joueur.clubId?._id}`} className="text-primary hover:underline">
                {joueur.clubId?.nom || '—'}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cartons disciplinaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Historique des cartons
          </CardTitle>
          <CardDescription>Tous les cartons reçus par le joueur</CardDescription>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <EmptyState title="Aucun carton" description="Ce joueur n'a reçu aucun carton." />
          ) : (
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={card._id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <CardBadge type={card.cardType} />
                    <div>
                      <p className="text-sm font-medium">
                        {card.matchId?.homeClubId?.nom} vs {card.matchId?.awayClubId?.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {card.competitionId?.nom} · {card.minute ? `${card.minute}'` : '—'}
                        {card.accumulationCount && ` · ${card.accumulationCount}e avertissement`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={card.accumulationStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                      {card.accumulationStatus === 'ACTIVE' ? 'Actif' :
                       card.accumulationStatus === 'CONSUMED_BY_SUSPENSION' ? 'Consommé' :
                       card.accumulationStatus === 'CANCELLED' ? 'Annulé' :
                       card.accumulationStatus === 'CLEARED_AT_SEASON_END' ? 'Effacé' : 'Non officiel'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(card.createdAt).toLocaleDateString('fr-TN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspensions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Suspensions
          </CardTitle>
          <CardDescription>Historique des suspensions du joueur</CardDescription>
        </CardHeader>
        <CardContent>
          {suspensions.length === 0 ? (
            <EmptyState title="Aucune suspension" description="Ce joueur n'a jamais été suspendu." />
          ) : (
            <div className="space-y-3">
              {suspensions.map((s) => (
                <div key={s._id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <SuspensionBadge status={s.status as any} type={s.suspensionType as any} />
                      <span className="text-sm font-medium">
                        {s.suspensionType === 'YELLOW_ACCUMULATION' ? 'Accumulation de jaunes' :
                         s.suspensionType === 'RED_CARD_PROVISIONAL' ? 'Carton rouge (provisoire)' :
                         s.suspensionType === 'RED_CARD_FINAL' ? 'Carton rouge (décision)' : 'Manuelle'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.matchesSuspended} match{s.matchesSuspended > 1 ? 's' : ''} · 
                      {s.matchesServed} servi{s.matchesServed > 1 ? 's' : ''} · 
                      {s.matchesRemaining} restant{s.matchesRemaining > 1 ? 's' : ''}
                      {s.scope === 'ALL_OFFICIAL_COMPETITIONS' ? ' · Toutes compétitions officielles' :
                       s.scope === 'SAME_COMPETITION' ? ' · Même compétition' : ''}
                    </p>
                    {s.decisionReason && (
                      <p className="text-xs text-muted-foreground mt-0.5">Motif: {s.decisionReason}</p>
                    )}
                  </div>
                  <Link
                    href={`/admin/discipline/suspensions/${s._id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Détails
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

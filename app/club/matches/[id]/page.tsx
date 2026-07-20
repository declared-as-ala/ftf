'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, CalendarDays, UserRound, Ban, AlertTriangle, Goal, RectangleVertical, Users } from 'lucide-react';

interface ClubRef {
  _id: string;
  nom: string;
  logo?: string;
  code?: string;
}

interface OfficialRef {
  displayName: string;
  role: string;
  categorie?: string;
}

interface MatchDetail {
  _id: string;
  date: string;
  journee?: number;
  statut: string;
  scoreHome: number;
  scoreAway: number;
  stade: string;
  venueCity?: string;
  homeClubId: ClubRef;
  awayClubId: ClubRef;
  competitionId: { _id: string; nom: string };
  saisonId: { _id: string; nom: string };
  publishedOfficials?: {
    publishedAt: string | null;
    referees: OfficialRef[];
  } | null;
  evenements: any[];
  isOfficial: boolean;
  homologue: boolean;
  clubEligibility?: {
    clubId: string;
    threshold: number;
    unavailable: {
      joueur: { _id: string; nom: string; prenom: string; numeroMaillot?: number; photo?: string; position?: string };
      status: string;
      suspensionType: string;
      matchesRemaining: number;
      reason: string;
    }[];
    atRisk: {
      joueur: { _id: string; nom: string; prenom: string; numeroMaillot?: number; photo?: string; position?: string };
      activeYellows: number;
      threshold: number;
    }[];
  };
}

function ClubBlock({ club, align }: { club: ClubRef; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className="relative h-16 w-16 shrink-0">
        {club?.logo ? (
          <Image src={club.logo} alt={club.nom} fill className="object-contain drop-shadow" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-lg font-bold">
            {club?.code || club?.nom?.[0]}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold leading-tight">{club?.nom}</p>
        {club?.code && <p className="text-xs uppercase tracking-widest text-white/50">{club.code}</p>}
      </div>
    </div>
  );
}

function eventIcon(type: string) {
  if (['But', 'GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(type)) return <Goal className="h-4 w-4 text-emerald-500" />;
  if (type === 'Carton Jaune' || type === 'YELLOW') return <RectangleVertical className="h-4 w-4 fill-amber-400 text-amber-400" />;
  if (['Carton Rouge', 'Carton Jaune Rouge', 'DIRECT_RED', 'SECOND_YELLOW_RED'].includes(type))
    return <RectangleVertical className="h-4 w-4 fill-red-500 text-red-500" />;
  return <span className="h-4 w-4 text-muted-foreground">•</span>;
}

export default function ClubMatchDetail() {
  const params = useParams();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/club/matches/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMatch)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!match) return <p className="text-muted-foreground">Match introuvable</p>;

  const played = match.statut === 'Terminé' || match.homologue;
  const elig = match.clubEligibility;

  const sortedEvents = [...(match.evenements || [])].sort(
    (a, b) => (a.minute ?? 0) - (b.minute ?? 0)
  );

  return (
    <div className="space-y-6">
      <Link
        href="/club/matches"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux matchs
      </Link>

      {/* ── Bandeau match ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl bg-[radial-gradient(120%_120%_at_50%_0%,#16305c_0%,#0b1830_60%,#070f1f_100%)] text-white shadow-lg">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#e70013]" />
        <div className="px-6 pt-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
          {match.competitionId?.nom} · {match.saisonId?.nom}
          {match.journee ? ` · Journée ${match.journee}` : ''}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-8 sm:px-10">
          <ClubBlock club={match.homeClubId} align="left" />
          <div className="text-center">
            {played ? (
              <p className="font-mono text-5xl font-black tabular-nums sm:text-6xl">
                {match.scoreHome}
                <span className="mx-2 text-white/40">–</span>
                {match.scoreAway}
              </p>
            ) : (
              <p className="text-3xl font-black text-white/50">VS</p>
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge className="bg-white/10 text-white hover:bg-white/15">{match.statut}</Badge>
              {match.homologue && (
                <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/25">
                  Homologué
                </Badge>
              )}
            </div>
          </div>
          <ClubBlock club={match.awayClubId} align="right" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 border-t border-white/10 px-6 py-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(match.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {match.stade}{match.venueCity ? `, ${match.venueCity}` : ''}
          </span>
          {match.publishedOfficials && match.publishedOfficials.referees.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5" />
              {match.publishedOfficials.referees.find((r) => r.role === 'MAIN')?.displayName}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Timeline des événements ────────────────────────────────── */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Film du match</CardTitle>
            <CardDescription>Buts et cartons par minute</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedEvents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun événement enregistré.
              </p>
            ) : (
              <div className="relative space-y-0.5">
                {sortedEvents.map((ev, i) => {
                  const isHome = ev.clubId?._id === match.homeClubId._id || ev.equipe === 'home';
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 py-2 ${isHome ? '' : 'flex-row-reverse text-right'}`}
                    >
                      <div className={`flex flex-1 items-center gap-2 min-w-0 ${isHome ? '' : 'flex-row-reverse'}`}>
                        {eventIcon(ev.type)}
                        <span className="truncate text-sm">
                          <span className="font-medium">
                            {ev.joueurId ? `${ev.joueurId.prenom} ${ev.joueurId.nom}` : ev.type}
                          </span>
                          {ev.joueurId?.numeroMaillot && (
                            <span className="text-muted-foreground"> #{ev.joueurId.numeroMaillot}</span>
                          )}
                        </span>
                      </div>
                      <span className="inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold">
                        {ev.minute != null ? `${ev.minute}'` : '—'}
                      </span>
                      <div className="flex-1" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Corps arbitral ─────────────────────────────────────────── */}
        {match.publishedOfficials && match.publishedOfficials.referees.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-blue-500" />
                Corps arbitral désigné
              </CardTitle>
              {match.publishedOfficials.publishedAt && (
                <CardDescription>
                  Publié le{' '}
                  {new Date(match.publishedOfficials.publishedAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {match.publishedOfficials.referees.map((ref, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{ref.displayName}</span>
                      {ref.categorie && (
                        <Badge variant="outline" className="text-xs">{ref.categorie}</Badge>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {ref.role === 'MAIN' ? 'Arbitre Principal' :
                        ref.role === 'ASSISTANT_1' ? 'Assistant 1' :
                        ref.role === 'ASSISTANT_2' ? 'Assistant 2' :
                        ref.role === 'FOURTH' ? '4e Arbitre' : ref.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Indisponibilités du club ───────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                <Ban className="h-4 w-4" />
                Joueurs suspendus — indisponibles
              </CardTitle>
              <CardDescription>Votre effectif concerné par une suspension en cours</CardDescription>
            </CardHeader>
            <CardContent>
              {!elig || elig.unavailable.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucun joueur suspendu — effectif au complet. ✓
                </p>
              ) : (
                <div className="space-y-2">
                  {elig.unavailable.map((u) => (
                    <Link
                      key={u.joueur._id}
                      href={`/club/players/${u.joueur._id}`}
                      className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 transition-colors hover:bg-red-500/10"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                        {u.joueur.photo ? (
                          <Image src={u.joueur.photo} alt={u.joueur.nom} fill className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
                            {u.joueur.prenom?.[0]}
                            {u.joueur.nom?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {u.joueur.prenom} {u.joueur.nom}
                          {u.joueur.numeroMaillot && (
                            <span className="text-muted-foreground"> #{u.joueur.numeroMaillot}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.reason}</p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">
                        {u.status === 'PROVISIONAL' ? 'En attente' : `${u.matchesRemaining} match(s)`}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {elig && elig.atRisk.length > 0 && (
            <Card className="border-orange-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  Joueurs à risque
                </CardTitle>
                <CardDescription>
                  À un carton jaune de la suspension automatique
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {elig.atRisk.map((r) => (
                  <Link
                    key={r.joueur._id}
                    href={`/club/players/${r.joueur._id}`}
                    className="flex items-center gap-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-2.5 transition-colors hover:bg-orange-500/10"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                      {r.joueur.photo ? (
                        <Image src={r.joueur.photo} alt={r.joueur.nom} fill className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-bold text-muted-foreground">
                          {r.joueur.prenom?.[0]}
                          {r.joueur.nom?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.joueur.prenom} {r.joueur.nom}
                        {r.joueur.numeroMaillot && (
                          <span className="text-muted-foreground"> #{r.joueur.numeroMaillot}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.activeYellows}/{r.threshold} cartons jaunes actifs
                      </p>
                    </div>
                    <span className="text-lg">🟨</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

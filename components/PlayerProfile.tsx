'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardBadge } from '@/components/ui/CardBadge';
import { SuspensionBadge } from '@/components/ui/SuspensionBadge';
import { EligibilityBadge } from '@/components/ui/EligibilityBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Goal,
  CalendarDays,
  Timer,
  Handshake,
  Shield,
  AlertTriangle,
  Ban,
  Trophy,
} from 'lucide-react';

export interface PlayerProfileData {
  joueur: any;
  goals: {
    matchId: string;
    date: string;
    journee?: number;
    minute?: number;
    homeAway: 'home' | 'away';
    opponent: { nom?: string; logo?: string } | null;
    score: string;
  }[];
  totals: {
    matchsJoues: number;
    buts: number;
    minutesEstimees: number;
    passes: number;
    cartonsJaunes: number;
    cartonsRouges: number;
    suspensionsTotal: number;
    matchsManques: number;
  };
  eligibility: {
    available: boolean;
    atRisk: boolean;
    activeYellows: number;
    threshold: number;
    reason?: string;
  };
  cards: any[];
  suspensions: any[];
}

const ACCUMULATION_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  CONSUMED_BY_SUSPENSION: 'Consommé',
  CANCELLED: 'Annulé',
  CLEARED_AT_SEASON_END: 'Effacé (fin de saison)',
  NOT_OFFICIEL: 'Non officiel',
  NOT_OFFICIAL: 'Non officiel',
};

const SUSPENSION_TYPE_LABELS: Record<string, string> = {
  YELLOW_ACCUMULATION: 'Accumulation de cartons jaunes',
  RED_CARD_PROVISIONAL: 'Carton rouge (provisoire)',
  RED_CARD_FINAL: 'Carton rouge (décision)',
  MANUAL: 'Décision manuelle',
};

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: any;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'yellow' | 'red' | 'green';
}) {
  const toneClass =
    tone === 'yellow'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'green'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Fiche joueur partagée — utilisée par /club/players/[id] (CLUB_ADMIN)
 * et /admin/joueurs/[id] (FTF_ADMIN). `suspensionLinkBase` n'est fourni
 * que côté admin (lien vers le détail de suspension).
 */
export default function PlayerProfile({
  data,
  suspensionLinkBase,
}: {
  data: PlayerProfileData;
  suspensionLinkBase?: string;
}) {
  const { joueur, goals, totals, eligibility, cards, suspensions } = data;
  const club = joueur.clubId || {};

  return (
    <div className="space-y-6">
      {/* ── En-tête identité ─────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#0b1830] via-[#16305c] to-[#e70013]" />
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative h-24 w-24 shrink-0 rounded-full overflow-hidden ring-2 ring-border bg-muted">
              {joueur.photo ? (
                <Image src={joueur.photo} alt={joueur.nom} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground">
                  {joueur.prenom?.[0]}
                  {joueur.nom?.[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  {joueur.prenom} {joueur.nom}
                </h1>
                {joueur.numeroMaillot && (
                  <span className="text-xl font-black text-muted-foreground/60">
                    #{joueur.numeroMaillot}
                  </span>
                )}
                <EligibilityBadge available={eligibility.available} atRisk={eligibility.atRisk} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{joueur.position}</Badge>
                {club?.nom && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    {club.logo && (
                      <span className="relative h-5 w-5 inline-block">
                        <Image src={club.logo} alt={club.nom} fill className="object-contain" />
                      </span>
                    )}
                    {club.nom}
                  </span>
                )}
                <span className="text-muted-foreground">· {joueur.nationalite}</span>
                <span className="text-muted-foreground">
                  · Né le {new Date(joueur.dateNaissance).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground font-mono">{joueur.licence}</p>
              {eligibility.reason && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">
                  <Ban className="h-3.5 w-3.5" />
                  {eligibility.reason}
                </p>
              )}
              {eligibility.atRisk && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5" />À risque — à un carton jaune de la
                  suspension ({eligibility.activeYellows}/{eligibility.threshold})
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tuiles statistiques ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatTile icon={CalendarDays} label="Matchs" value={totals.matchsJoues} />
        <StatTile icon={Goal} label="Buts" value={totals.buts} tone="green" />
        <StatTile
          icon={Timer}
          label="Minutes"
          value={totals.minutesEstimees.toLocaleString('fr-FR')}
          hint="estimation (matchs × 90)"
        />
        <StatTile icon={Handshake} label="Passes déc." value={totals.passes} />
        <StatTile icon={Shield} label="Cartons J" value={totals.cartonsJaunes} tone="yellow" />
        <StatTile icon={Shield} label="Cartons R" value={totals.cartonsRouges} tone="red" />
        <StatTile icon={AlertTriangle} label="Suspensions" value={totals.suspensionsTotal} />
        <StatTile icon={Ban} label="Matchs manqués" value={totals.matchsManques} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Buts marqués ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-emerald-600" />
              Buts marqués
            </CardTitle>
            <CardDescription>Matchs homologués uniquement</CardDescription>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <EmptyState icon={Goal} title="Aucun but" description="Aucun but homologué pour ce joueur." />
            ) : (
              <div className="space-y-2">
                {goals.map((g, i) => (
                  <div key={`${g.matchId}-${i}`} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {g.minute != null ? `${g.minute}'` : '⚽'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {g.homeAway === 'home' ? 'vs' : 'chez'} {g.opponent?.nom || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.journee ? `J${g.journee} · ` : ''}
                        {new Date(g.date).toLocaleDateString('fr-FR')} · {g.score}
                      </p>
                    </div>
                    {g.opponent?.logo && (
                      <span className="relative h-7 w-7 shrink-0">
                        <Image src={g.opponent.logo} alt={g.opponent?.nom || ''} fill className="object-contain" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Suspensions ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Suspensions
            </CardTitle>
            <CardDescription>Historique complet</CardDescription>
          </CardHeader>
          <CardContent>
            {suspensions.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="Aucune suspension" description="Ce joueur n'a jamais été suspendu." />
            ) : (
              <div className="space-y-2">
                {suspensions.map((s: any) => (
                  <div key={s._id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SuspensionBadge status={s.status} type={s.suspensionType} />
                        <span className="truncate text-sm font-medium">
                          {SUSPENSION_TYPE_LABELS[s.suspensionType] || s.suspensionType}
                        </span>
                      </div>
                      {suspensionLinkBase && (
                        <Link
                          href={`${suspensionLinkBase}/${s._id}`}
                          className="shrink-0 text-xs text-primary hover:underline"
                        >
                          Détails
                        </Link>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.matchesSuspended} match(s) · {s.matchesServed} purgé(s) ·{' '}
                      <span className={s.matchesRemaining > 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                        {s.matchesRemaining} restant(s)
                      </span>
                      {' · '}
                      {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    {s.decisionReason && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Motif : {s.decisionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Historique des cartons ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Historique des cartons
          </CardTitle>
          <CardDescription>
            {eligibility.activeYellows} carton(s) jaune(s) actif(s) sur un seuil de{' '}
            {eligibility.threshold}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <EmptyState icon={Shield} title="Aucun carton" description="Ce joueur n'a reçu aucun carton." />
          ) : (
            <div className="space-y-2">
              {cards.map((c: any) => (
                <div key={c._id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <CardBadge type={c.cardType} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.matchId?.homeClubId?.nom || '—'} vs {c.matchId?.awayClubId?.nom || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.competitionId?.nom ? `${c.competitionId.nom} · ` : ''}
                        {c.minute != null ? `${c.minute}' · ` : ''}
                        {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                        {c.accumulationCount ? ` · ${c.accumulationCount}ᵉ avertissement` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant={c.accumulationStatus === 'ACTIVE' ? 'default' : 'outline'}>
                    {ACCUMULATION_LABELS[c.accumulationStatus] || c.accumulationStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

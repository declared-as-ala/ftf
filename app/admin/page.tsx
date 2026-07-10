import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
import Club from '@/lib/models/Club';
import Match from '@/lib/models/Match';
import Discipline from '@/lib/models/Discipline';
import Staff from '@/lib/models/Staff';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Calendar, Shield, UserCog, Trophy, AlertTriangle, TrendingUp } from 'lucide-react';

async function getDashboardStats() {
  await connectDB();

  const [
    totalJoueurs,
    totalClubs,
    totalMatches,
    totalStaff,
    suspensionsActives,
    matchesCetteSemaine,
  ] = await Promise.all([
    Joueur.countDocuments(),
    Club.countDocuments(),
    Match.countDocuments(),
    Staff.countDocuments(),
    Discipline.countDocuments({ statut: { $in: ['En Cours', 'Validée'] } }),
    Match.countDocuments({
      date: {
        $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        $lte: new Date(new Date().setDate(new Date().getDate() + 7)),
      },
    }),
  ]);

  const joueursSuspendus = await Discipline.countDocuments({
    cible: 'Joueur',
    statut: 'En Cours',
    matchesRestants: { $gt: 0 },
  });

  const clubsSanctionnes = await Discipline.countDocuments({
    cible: 'Club',
    statut: { $in: ['En Cours', 'Validée'] },
  });

  return {
    totalJoueurs,
    totalClubs,
    totalMatches,
    totalStaff,
    suspensionsActives,
    matchesCetteSemaine,
    joueursSuspendus,
    clubsSanctionnes,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  const stats = await getDashboardStats();

  const cards = [
    {
      title: 'Total Clubs',
      value: stats.totalClubs,
      description: 'Clubs enregistrés',
      icon: Building2,
      color: 'text-blue-600',
    },
    {
      title: 'Total Joueurs',
      value: stats.totalJoueurs,
      description: 'Joueurs licenciés',
      icon: Users,
      color: 'text-green-600',
    },
    {
      title: 'Total Staff',
      value: stats.totalStaff,
      description: 'Personnel technique',
      icon: UserCog,
      color: 'text-purple-600',
    },
    {
      title: 'Total Matchs',
      value: stats.totalMatches,
      description: 'Matchs enregistrés',
      icon: Calendar,
      color: 'text-orange-600',
    },
    {
      title: 'Joueurs Suspendus',
      value: stats.joueursSuspendus,
      description: 'Suspensions actives',
      icon: Shield,
      color: 'text-red-600',
    },
    {
      title: 'Matchs Cette Semaine',
      value: stats.matchesCetteSemaine,
      description: '±7 jours',
      icon: Trophy,
      color: 'text-yellow-600',
    },
    {
      title: 'Clubs Sanctionnés',
      value: stats.clubsSanctionnes,
      description: 'Sanctions actives',
      icon: AlertTriangle,
      color: 'text-rose-600',
    },
    {
      title: 'Total Sanctions',
      value: stats.suspensionsActives,
      description: 'Toutes catégories',
      icon: TrendingUp,
      color: 'text-indigo-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Administration</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenue, {session?.user.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
            <CardDescription>
              Événements importants des derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {stats.suspensionsActives} suspensions actives
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dernière mise à jour
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {stats.matchesCetteSemaine} matchs programmés
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cette semaine
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {stats.clubsSanctionnes} clubs sanctionnés
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sanctions en cours
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
            <CardDescription>
              Raccourcis vers les fonctions principales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <a
                href="/admin/matchs"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Calendar className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Gérer les Matchs</span>
              </a>
              <a
                href="/admin/discipline"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Shield className="h-5 w-5 text-red-600" />
                <span className="font-medium">Discipline</span>
              </a>
              <a
                href="/admin/clubs"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Clubs</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


import Link from 'next/link';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import Joueur from '@/lib/models/Joueur';
import Club from '@/lib/models/Club';
import Match from '@/lib/models/Match';
import Staff from '@/lib/models/Staff';
import Suspension from '@/lib/models/Suspension';
import DisciplinaryCard from '@/lib/models/DisciplinaryCard';
import Notification from '@/lib/models/Notification';
import NotificationBroadcast from '@/lib/models/NotificationBroadcast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Building2,
  Calendar,
  Shield,
  UserCog,
  Trophy,
  AlertTriangle,
  TrendingUp,
  Bell,
  Megaphone,
} from 'lucide-react';

async function getDashboardStats(organizationId: string) {
  await connectDB();

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalJoueurs,
    totalClubs,
    totalMatches,
    totalStaff,
    matchesCetteSemaine,
    suspensionsActives,
    suspensionsProvisoires,
    joueursSuspendus,
    cardsThisMonth,
    unreadAdminNotifications,
    recentBroadcasts,
  ] = await Promise.all([
    Joueur.countDocuments({ organizationId }),
    Club.countDocuments({ organizationId }),
    Match.countDocuments({ organizationId }),
    Staff.countDocuments(),
    Match.countDocuments({ organizationId, date: { $gte: oneWeekAgo, $lte: oneWeekAhead } }),
    Suspension.countDocuments({ organizationId, status: 'ACTIVE' }),
    Suspension.countDocuments({ organizationId, status: 'PROVISIONAL' }),
    Suspension.distinct('joueurId', { organizationId, status: { $in: ['ACTIVE', 'PROVISIONAL'] } }),
    DisciplinaryCard.countDocuments({
      organizationId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
    Notification.countDocuments({ organizationId, recipientClubId: { $exists: false }, read: false }),
    NotificationBroadcast.find({ organizationId, status: 'SENT' })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('subject totalRecipients readCount createdAt')
      .lean(),
  ]);

  return {
    totalJoueurs,
    totalClubs,
    totalMatches,
    totalStaff,
    matchesCetteSemaine,
    suspensionsActives,
    suspensionsProvisoires,
    joueursSuspendus: joueursSuspendus.length,
    cardsThisMonth,
    unreadAdminNotifications,
    recentBroadcasts,
  };
}

export default async function AdminDashboard() {
  const session = await auth();
  const organizationId = session!.user.organizationId!;
  const stats = await getDashboardStats(organizationId);

  const cards = [
    { title: 'Total Clubs', value: stats.totalClubs, description: 'Clubs enregistrés', icon: Building2, color: 'text-blue-600' },
    { title: 'Total Joueurs', value: stats.totalJoueurs, description: 'Joueurs licenciés', icon: Users, color: 'text-green-600' },
    { title: 'Total Staff', value: stats.totalStaff, description: 'Personnel technique', icon: UserCog, color: 'text-purple-600' },
    { title: 'Total Matchs', value: stats.totalMatches, description: 'Matchs enregistrés', icon: Calendar, color: 'text-orange-600' },
    { title: 'Suspensions Actives', value: stats.suspensionsActives, description: `${stats.joueursSuspendus} joueur(s) indisponible(s)`, icon: Shield, color: 'text-red-600' },
    { title: 'Décisions Rouges en Attente', value: stats.suspensionsProvisoires, description: 'Suspensions provisoires', icon: AlertTriangle, color: 'text-amber-600' },
    { title: 'Matchs Cette Semaine', value: stats.matchesCetteSemaine, description: '±7 jours', icon: Trophy, color: 'text-yellow-600' },
    { title: 'Cartons (30 jours)', value: stats.cardsThisMonth, description: 'Toutes compétitions', icon: TrendingUp, color: 'text-indigo-600' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Administration</h1>
        <p className="text-muted-foreground mt-2">Bienvenue, {session?.user.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
              <CardDescription>
                {stats.unreadAdminNotifications > 0
                  ? `${stats.unreadAdminNotifications} notification(s) non lue(s)`
                  : 'Aucune notification en attente'}
              </CardDescription>
            </div>
            <Link href="/admin/notifications" className="text-xs font-medium text-primary hover:underline">
              Tout voir
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recentBroadcasts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message diffusé récemment.</p>
            ) : (
              <div className="space-y-3">
                {stats.recentBroadcasts.map((b: any) => (
                  <div key={b._id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
                      <Megaphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.readCount}/{b.totalRecipients} lu(s) · {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
            <CardDescription>Raccourcis vers les fonctions principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link href="/admin/matchs" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <Calendar className="h-5 w-5 text-orange-600" />
                <span className="font-medium">Gérer les Matchs</span>
              </Link>
              <Link href="/admin/discipline" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <Shield className="h-5 w-5 text-red-600" />
                <span className="font-medium">Discipline</span>
              </Link>
              <Link href="/admin/notifications" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <Megaphone className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">Notifications</span>
              </Link>
              <Link href="/admin/clubs" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Clubs</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

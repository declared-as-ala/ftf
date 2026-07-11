'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Shield,
  Trophy,
  Calendar,
  FileText,
  UserCog,
  Flag,
  Settings,
  BarChart3,
  Clipboard,
  AlertTriangle,
  Building2,
  Bell,
  ChevronLeft,
  ChevronRight,
  Upload,
} from 'lucide-react';

interface SidebarProps {
  role: 'FTF_ADMIN' | 'CLUB_ADMIN';
}

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clubs', label: 'Clubs', icon: Building2 },
  { href: '/admin/joueurs', label: 'Joueurs', icon: Users },
  { href: '/admin/staff', label: 'Staff', icon: UserCog },
  { href: '/admin/matchs', label: 'Matchs', icon: Calendar },
  { href: '/admin/competitions', label: 'Compétitions', icon: Trophy },
  { href: '/admin/classement', label: 'Classement', icon: BarChart3 },
  { href: '/admin/discipline', label: 'Discipline', icon: Shield },
  // Transferts / Licences / Événements : modules gelés hors périmètre v1
  // (docs/product-specification.md §1) — liens réactivés quand les modules existeront.
  { href: '/admin/arbitres', label: 'Arbitres', icon: Flag },
  { href: '/admin/saisons', label: 'Saisons', icon: Clipboard },
  { href: '/admin/imports', label: 'Import CSV', icon: Upload },
  { href: '/admin/reports', label: 'Rapports', icon: FileText },
  { href: '/admin/audit', label: 'Audit', icon: Clipboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: UserCog },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Paramètres', icon: Settings },
];

const clubLinks = [
  { href: '/club', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/club/players', label: 'Mes Joueurs', icon: Users },
  { href: '/club/matches', label: 'Mes Matchs', icon: Calendar },
  { href: '/club/cards', label: 'Cartons', icon: Shield },
  { href: '/club/suspensions', label: 'Suspensions', icon: AlertTriangle },
  { href: '/club/eligibility', label: 'Éligibilité', icon: Clipboard },
  { href: '/club/standings', label: 'Classement', icon: BarChart3 },
  { href: '/club/notifications', label: 'Notifications', icon: Bell },
  { href: '/club/profile', label: 'Profil', icon: Settings },
];

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = role === 'FTF_ADMIN' ? adminLinks : clubLinks;
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] border-r bg-background transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col gap-2 py-4 px-2 overflow-y-auto">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="mb-2 ml-auto flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label={collapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            // Only check active state after component has mounted to avoid hydration mismatch
            // Also handle nested routes (e.g., /admin/clubs/123 should match /admin/clubs)
            const isActive = mounted && pathname && (
              pathname === link.href || 
              (link.href !== '/admin' && link.href !== '/club' && pathname.startsWith(`${link.href}/`))
            );

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center' : 'gap-3',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}


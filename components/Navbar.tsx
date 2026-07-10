'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border bg-background">
              <Image
                src="/icon.png"
                alt="FTF Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="font-bold text-xl hidden md:block">
              Fédération Tunisienne de Football
            </span>
            <span className="font-bold text-xl md:hidden">FTF</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* User Info */}
          {!session ? (
            <Link href="/login">
              <Button>Connexion</Button>
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              {session.user.role === 'FTF_ADMIN' ? (
                <Badge variant="default" className="text-sm px-3 py-1">
                  Administration
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  {session.user.clubLogo && (
                    <div className="relative w-8 h-8">
                      <Image
                        src={session.user.clubLogo}
                        alt={session.user.clubName || 'Club'}
                        fill
                        className="object-contain rounded"
                      />
                    </div>
                  )}
                  <span className="font-medium hidden md:block">
                    {session.user.clubName}
                  </span>
                </div>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}


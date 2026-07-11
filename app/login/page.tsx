'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Archivo } from 'next/font/google';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Lock, Mail, ShieldCheck } from 'lucide-react';
import { LoadingButton } from '@/components/LoadingButton';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

/** Tracé de terrain de football — motif décoratif du panneau institutionnel. */
function PitchLines({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 680 1000"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke="currentColor" strokeWidth="2">
        {/* Touche */}
        <rect x="60" y="40" width="560" height="920" rx="2" />
        {/* Ligne médiane + rond central */}
        <line x1="60" y1="500" x2="620" y2="500" />
        <circle cx="340" cy="500" r="92" />
        <circle cx="340" cy="500" r="4" fill="currentColor" />
        {/* Surface de réparation haute */}
        <rect x="170" y="40" width="340" height="150" />
        <rect x="250" y="40" width="180" height="60" />
        <path d="M 265 190 A 80 80 0 0 0 415 190" />
        {/* Surface de réparation basse */}
        <rect x="170" y="810" width="340" height="150" />
        <rect x="250" y="900" width="180" height="60" />
        <path d="M 265 810 A 80 80 0 0 1 415 810" />
        {/* Corners */}
        <path d="M 60 60 A 20 20 0 0 0 80 40" />
        <path d="M 600 40 A 20 20 0 0 0 620 60" />
        <path d="M 620 940 A 20 20 0 0 0 600 960" />
        <path d="M 80 960 A 20 20 0 0 0 60 940" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email ou mot de passe incorrect');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${archivo.className} min-h-screen grid lg:grid-cols-[1.15fr_1fr]`}>
      <style>{`
        @keyframes ftf-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ftf-rise { animation: ftf-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
      `}</style>

      {/* ── Panneau institutionnel ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#0b1830] text-white flex flex-col justify-between p-8 lg:p-14 min-h-[220px]">
        {/* Fond : dégradé profond + tracé de terrain */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,#16305c_0%,#0b1830_55%,#070f1f_100%)]"
        />
        <PitchLines className="absolute -right-24 -top-16 h-[130%] w-auto text-white/[0.06] rotate-[8deg] hidden sm:block" />
        {/* Liseré rouge tunisien */}
        <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-[#e70013]" />

        <div className="relative ftf-rise" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 rounded-full bg-white p-1 ring-2 ring-[#e70013]/80 shadow-lg shadow-black/30">
              <Image src="/icon.png" alt="FTF" fill className="object-contain p-1" priority />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                République Tunisienne
              </p>
              <p className="text-sm font-bold tracking-wide">Fédération Tunisienne de Football</p>
            </div>
          </div>
        </div>

        <div className="relative hidden lg:block ftf-rise" style={{ animationDelay: '0.15s' }}>
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-tight">
            Gestion officielle
            <br />
            des compétitions
            <span className="text-[#e70013]">.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/70">
            Résultats, cartons, suspensions, éligibilité et classements — la plateforme
            centralisée de la Fédération et de ses clubs.
          </p>
        </div>

        <div
          className="relative hidden lg:flex items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50 ftf-rise"
          style={{ animationDelay: '0.25s' }}
        >
          <span>Compétitions</span>
          <span className="h-1 w-1 rounded-full bg-[#e70013]" />
          <span>Discipline</span>
          <span className="h-1 w-1 rounded-full bg-[#e70013]" />
          <span>Classements</span>
        </div>
      </div>

      {/* ── Colonne formulaire ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center bg-background px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="ftf-rise" style={{ animationDelay: '0.2s' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#e70013]">
              Espace sécurisé
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Connexion</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Accédez à votre espace fédération ou club.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive ftf-rise"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2 ftf-rise" style={{ animationDelay: '0.3s' }}>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@exemple.tn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pl-10 focus-visible:ring-[#e70013]/40"
                />
              </div>
            </div>

            <div className="space-y-2 ftf-rise" style={{ animationDelay: '0.38s' }}>
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pl-10 focus-visible:ring-[#e70013]/40"
                />
              </div>
            </div>

            <div className="ftf-rise" style={{ animationDelay: '0.46s' }}>
              <LoadingButton
                type="submit"
                loading={loading}
                loadingText="Connexion..."
                className="h-11 w-full bg-[#e70013] font-semibold tracking-wide text-white shadow-md shadow-[#e70013]/25 transition-all hover:bg-[#c50011] hover:shadow-lg hover:shadow-[#e70013]/30 active:translate-y-px"
              >
                Se connecter
              </LoadingButton>
            </div>
          </form>

          <div
            className="mt-10 flex items-center gap-2 border-t pt-5 text-xs text-muted-foreground ftf-rise"
            style={{ animationDelay: '0.54s' }}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>
              Accès réservé — les comptes sont délivrés par la Fédération Tunisienne de Football.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

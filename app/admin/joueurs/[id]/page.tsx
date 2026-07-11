'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { ArrowLeft } from 'lucide-react';
import PlayerProfile, { type PlayerProfileData } from '@/components/PlayerProfile';

export default function AdminJoueurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/joueurs/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Joueur introuvable');
        setData(await r.json());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data?.joueur) {
    return (
      <ErrorState
        title={error || 'Joueur introuvable'}
        description="Impossible de charger les informations du joueur."
      />
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
      <PlayerProfile data={data} suspensionLinkBase="/admin/discipline/suspensions" />
    </div>
  );
}

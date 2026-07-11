'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import PlayerProfile, { type PlayerProfileData } from '@/components/PlayerProfile';

export default function ClubPlayerDetail() {
  const params = useParams();
  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/club/players/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
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
  if (!data?.joueur) return <p className="text-muted-foreground">Joueur introuvable</p>;

  return (
    <div className="space-y-6">
      <Link
        href="/club/players"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux joueurs
      </Link>
      <PlayerProfile data={data} />
    </div>
  );
}

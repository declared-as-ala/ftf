import { Badge } from './badge';

interface StatusBadgeProps {
  status: string;
  active?: boolean;
}

export function StatusBadge({ status, active }: StatusBadgeProps) {
  let label = status;
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let className = '';

  const s = status.toUpperCase();

  if (s === 'ACTIVE' || active === true) {
    label = 'Actif';
    className = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20';
  } else if (s === 'DRAFT' || s === 'BROUILLON') {
    label = 'Brouillon';
    className = 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400 hover:bg-sky-500/20';
  } else if (s === 'SCHEDULED' || s === 'PROGRAMME') {
    label = 'Programmé';
    className = 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400 hover:bg-indigo-500/20';
  } else if (s === 'UPCOMING' || s === 'A VENIR') {
    label = 'À Venir';
    className = 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 hover:bg-amber-500/20';
  } else if (s === 'COMPLETED' || s === 'TERMINE') {
    label = 'Terminé';
    className = 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20';
  } else if (s === 'ARCHIVED' || s === 'ARCHIVE') {
    label = 'Archivé';
    className = 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400 hover:bg-slate-500/20';
  } else if (s === 'SUSPENDED' || s === 'SUSPENDU') {
    label = 'Suspendu';
    variant = 'destructive';
  } else {
    variant = 'outline';
  }

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

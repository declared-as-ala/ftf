import { cn } from '@/lib/utils';

export type CardType = 'YELLOW' | 'SECOND_YELLOW_RED' | 'DIRECT_RED';

interface CardBadgeProps {
  type: CardType;
  size?: 'sm' | 'md';
  className?: string;
}

const labels: Record<CardType, string> = {
  YELLOW: 'JA',
  SECOND_YELLOW_RED: 'JR',
  DIRECT_RED: 'ROUGE',
};

const colors: Record<CardType, string> = {
  YELLOW: 'bg-yellow-400 text-yellow-950 border-yellow-500',
  SECOND_YELLOW_RED: 'bg-red-500 text-white border-red-600',
  DIRECT_RED: 'bg-red-700 text-white border-red-800',
};

export function CardBadge({ type, size = 'md', className }: CardBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm border font-bold leading-none',
        size === 'sm' ? 'h-4 w-6 text-[9px]' : 'h-5 w-8 text-xs',
        colors[type],
        className
      )}
      title={type === 'YELLOW' ? 'Carton jaune' : type === 'SECOND_YELLOW_RED' ? 'Deuxième carton jaune → rouge' : 'Carton rouge direct'}
    >
      {labels[type]}
    </span>
  );
}

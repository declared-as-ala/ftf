import { cn } from '@/lib/utils';

export type SuspensionStatus = 'PROVISIONAL' | 'ACTIVE' | 'SERVED' | 'CANCELLED';
export type SuspensionType = 'YELLOW_ACCUMULATION' | 'RED_CARD_PROVISIONAL' | 'RED_CARD_FINAL' | 'MANUAL';

interface SuspensionBadgeProps {
  status: SuspensionStatus;
  type?: SuspensionType;
  className?: string;
}

const statusLabels: Record<SuspensionStatus, string> = {
  PROVISIONAL: 'Provisoire',
  ACTIVE: 'Active',
  SERVED: 'Purgée',
  CANCELLED: 'Annulée',
};

const statusColors: Record<SuspensionStatus, string> = {
  PROVISIONAL: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
  ACTIVE: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400',
  SERVED: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400',
};

export function SuspensionBadge({ status, className }: SuspensionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusColors[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

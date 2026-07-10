import { cn } from '@/lib/utils';

interface EligibilityBadgeProps {
  available: boolean;
  atRisk?: boolean;
  className?: string;
}

export function EligibilityBadge({ available, atRisk, className }: EligibilityBadgeProps) {
  if (available && atRisk) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
          className
        )}
      >
        À risque
      </span>
    );
  }

  if (available) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-green-300 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-600 dark:bg-green-900/30 dark:text-green-400',
          className
        )}
      >
        Disponible
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400',
        className
      )}
    >
      Suspendu
    </span>
  );
}

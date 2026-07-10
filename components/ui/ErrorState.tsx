import { AlertTriangle } from 'lucide-react';
import React from 'react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description = 'Impossible de charger les données. Veuillez réessayer.',
  error,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-red-300 rounded-lg p-12 text-center my-6 bg-red-50/30 dark:bg-red-950/10">
      <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-2">{description}</p>
      {error && (
        <p className="text-xs text-red-500 font-mono bg-red-50 dark:bg-red-950/20 px-3 py-1 rounded max-w-md truncate">
          {error}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

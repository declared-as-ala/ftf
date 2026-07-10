import { Clipboard } from 'lucide-react';
import React from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: any;
  children?: React.ReactNode;
}

export function EmptyState({
  title = 'Aucune donnée',
  description = 'Il n’y a aucun élément à afficher pour le moment.',
  icon: Icon = Clipboard,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed rounded-lg p-12 text-center my-6 bg-muted/20">
      <Icon className="h-12 w-12 text-muted-foreground mb-4 opacity-70" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-2">{description}</p>
      {children}
    </div>
  );
}

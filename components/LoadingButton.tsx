'use client';

import { Button } from '@/components/ui/button';
import { InlineLoader } from './Loader';
import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
  loadingText?: string;
}

export function LoadingButton({
  loading = false,
  children,
  loadingText,
  className,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={cn('relative', className)}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <InlineLoader size="sm" />
          {loadingText || children}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}





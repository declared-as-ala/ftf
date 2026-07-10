'use client';

import Image from 'next/image';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export default function Loader({ size = 'lg', className = '' }: LoaderProps) {
  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <Image
        src="/icon.png"
        alt="FTF Logo"
        fill
        className="object-contain animate-spin-smooth"
        priority
      />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Loader size="xl" />
    </div>
  );
}

export function InlineLoader({ size = 'sm', className = '' }: LoaderProps) {
  return <Loader size={size} className={className} />;
}

'use client';

import { cn } from '@/lib/utils';

interface DonnaLogoProps {
  size?: number;
  variant?: 'symbol' | 'logomark';
  className?: string;
}

export function DonnaLogo({ size = 24, variant = 'symbol', className }: DonnaLogoProps) {
  // Logomark: the "Donna" wordmark (white on transparent — for dark UI).
  if (variant === 'logomark') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/images/Tipografia.png"
        alt="Donna"
        className={cn('w-auto flex-shrink-0', className)}
        style={{ height: `${size}px` }}
        suppressHydrationWarning
      />
    );
  }

  // Symbol: the Donna avatar (circular, transparent corners) — collapsed / avatar spots.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo-nova.png"
      alt="Donna"
      className={cn('flex-shrink-0 rounded-full object-cover', className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      suppressHydrationWarning
    />
  );
}

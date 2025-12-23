import React from 'react';
import { cn } from '@/lib/utils';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-none',
};

export function PageContainer({
  children,
  className,
  maxWidth = '6xl',
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: MaxWidth;
}) {
  // Default layout for new pages:
  // - align content consistently with the app chrome (sidebar/topbar)
  // - provide comfortable left/right padding on all breakpoints
  return (
    <div className={cn('w-full px-4 sm:px-6 lg:px-8', className)}>
      <div className={cn('w-full mx-auto', MAX_WIDTH_CLASS[maxWidth])}>{children}</div>
    </div>
  );
}

export default PageContainer;










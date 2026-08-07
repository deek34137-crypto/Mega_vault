'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className, count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-2xl bg-zinc-800/50 border border-zinc-800/40',
            className || 'h-48 w-full'
          )}
        />
      ))}
    </>
  );
};

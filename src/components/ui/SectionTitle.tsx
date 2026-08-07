'use client';

import React from 'react';

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle, action }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-400 mt-1 font-normal">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
};

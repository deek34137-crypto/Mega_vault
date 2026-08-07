'use client';

import React from 'react';
import { FolderPlus, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderPlus,
  title,
  description,
  action,
}) => {
  return (
    <div className="glass-panel rounded-3xl p-12 text-center max-w-xl mx-auto my-8 border border-zinc-800/80">
      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-inner">
        <Icon className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{description}</p>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
};

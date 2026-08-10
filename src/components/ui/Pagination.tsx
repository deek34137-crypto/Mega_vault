'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Hash } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  accentColor?: 'blue' | 'amber';
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  accentColor = 'blue',
}) => {
  const [jumpInput, setJumpInput] = useState('');

  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers array with ellipsis for clean display
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  const isAmber = accentColor === 'amber';
  const activeBg = isAmber ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20' : 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20';
  const hoverText = isAmber ? 'hover:text-amber-400' : 'hover:text-blue-400';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 rounded-2xl glass-panel border border-zinc-800/80 my-6 bg-zinc-950/70">
      {/* Range Info */}
      <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
        <span>Showing</span>
        <span className="font-bold text-white">{startIndex}–{endIndex}</span>
        <span>of</span>
        <span className="font-bold text-white">{totalItems}</span>
        <span>items</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-500">Page {currentPage} of {totalPages}</span>
      </div>

      {/* Page Number Controls */}
      <div className="flex items-center space-x-1.5 flex-wrap justify-center">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous Page"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-xs font-mono text-zinc-500">
                ...
              </span>
            );
          }

          const pageNum = p as number;
          const isActive = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold font-mono border transition-all ${
                isActive
                  ? activeBg
                  : `bg-zinc-900 border-zinc-800 text-zinc-400 ${hoverText} hover:bg-zinc-850`
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next Page"
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Jump Input */}
      <form onSubmit={handleJumpSubmit} className="flex items-center space-x-1.5 text-xs">
        <div className="relative">
          <Hash className="w-3 h-3 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder="Page #"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl pl-7 pr-2 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-all"
        >
          Go
        </button>
      </form>
    </div>
  );
};

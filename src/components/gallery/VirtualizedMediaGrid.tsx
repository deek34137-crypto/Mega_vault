'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MediaItem } from '@/types';
import { MediaCard } from './MediaCard';

interface VirtualizedMediaGridProps {
  items: MediaItem[];
  onItemClick?: (media: MediaItem, index: number) => void;
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onSelectToggle?: (media: MediaItem) => void;
  onFavoriteToggle?: (media: MediaItem, isFav: boolean) => void;
}

export const VirtualizedMediaGrid: React.FC<VirtualizedMediaGridProps> = ({
  items,
  onItemClick,
  isSelectMode = false,
  selectedIds = new Set(),
  onSelectToggle,
  onFavoriteToggle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number>(4);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(800);

  // Dynamically recalculate column count on window resize
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 640) setColumns(2);
      else if (w < 1024) setColumns(3);
      else if (w < 1280) setColumns(4);
      else if (w < 1536) setColumns(5);
      else setColumns(6);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Track window scroll position for virtualization
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const topOffset = -rect.top;
        setScrollTop(Math.max(0, topOffset));
        setContainerHeight(window.innerHeight);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Split items into rows based on column count
  const rows = useMemo(() => {
    const r: MediaItem[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      r.push(items.slice(i, i + columns));
    }
    return r;
  }, [items, columns]);

  // Estimated height of each grid row (card aspect-square + gap + text paddings)
  const rowHeight = 240;
  const totalHeight = rows.length * rowHeight;

  // Buffer range: render 3 extra rows above and below current viewport
  const BUFFER_ROWS = 3;
  const startRowIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
  const endRowIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + BUFFER_ROWS
  );

  const visibleRows = useMemo(() => {
    return rows.slice(startRowIndex, endRowIndex).map((rowItems, idx) => ({
      rowIndex: startRowIndex + idx,
      items: rowItems,
    }));
  }, [rows, startRowIndex, endRowIndex]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: `${totalHeight}px` }}>
      {visibleRows.map(({ rowIndex, items: rowItems }) => (
        <div
          key={rowIndex}
          className="absolute left-0 right-0 grid gap-3 sm:gap-4 transition-none"
          style={{
            top: `${rowIndex * rowHeight}px`,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            height: `${rowHeight}px`,
          }}
        >
          {rowItems.map((media, itemInRowIdx) => {
            const globalIndex = rowIndex * columns + itemInRowIdx;
            const isSelected = selectedIds.has(media.id);

            return (
              <div key={media.id} className="h-full">
                <MediaCard
                  media={media}
                  onClick={() => onItemClick?.(media, globalIndex)}
                  isSelectMode={isSelectMode}
                  isSelected={isSelected}
                  onSelectToggle={onSelectToggle}
                  onFavoriteToggle={onFavoriteToggle}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

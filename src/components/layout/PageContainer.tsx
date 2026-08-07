'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`min-h-[calc(100vh-4rem-5rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative ${className}`}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[600px] h-[300px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 -z-10 w-[400px] h-[250px] bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none" />

      {children}
    </motion.div>
  );
};

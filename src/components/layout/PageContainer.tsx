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
      className={`min-h-[calc(100vh-4rem-5rem)] max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative ${className}`}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[300px] sm:w-[600px] h-[200px] sm:h-[300px] bg-blue-600/5 blur-[80px] sm:blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-4 sm:right-10 -z-10 w-[250px] sm:w-[400px] h-[150px] sm:h-[250px] bg-indigo-600/5 blur-[60px] sm:blur-[100px] rounded-full pointer-events-none" />

      {children}
    </motion.div>
  );
};

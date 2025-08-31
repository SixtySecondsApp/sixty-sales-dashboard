import React from 'react';
import { motion } from 'framer-motion';

export const ContactHeaderSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-gray-800/50 mb-6"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Avatar skeleton */}
          <div className="w-20 h-20 bg-gray-800/50 rounded-xl animate-pulse"></div>
          
          <div className="space-y-3">
            {/* Name skeleton */}
            <div className="h-8 w-48 bg-gray-800/50 rounded animate-pulse"></div>
            
            {/* Company skeleton */}
            <div className="h-5 w-32 bg-gray-800/50 rounded animate-pulse"></div>
            
            {/* Contact info skeleton */}
            <div className="flex gap-4">
              <div className="h-4 w-40 bg-gray-800/50 rounded animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-800/50 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        
        {/* Actions skeleton */}
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-800/50 rounded-lg animate-pulse"></div>
          <div className="h-10 w-24 bg-gray-800/50 rounded-lg animate-pulse"></div>
        </div>
      </div>
    </motion.div>
  );
};

export const ContactTabsSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 mb-6"
    >
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-20 bg-gray-800/50 rounded-lg animate-pulse"></div>
        ))}
      </div>
    </motion.div>
  );
};

export const ContactSidebarSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50"
    >
      <div className="space-y-6">
        {/* Section header */}
        <div className="h-6 w-24 bg-gray-800/50 rounded animate-pulse"></div>
        
        {/* Details */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-16 bg-gray-800/50 rounded animate-pulse"></div>
              <div className="h-5 w-32 bg-gray-800/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const ContactMainContentSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50"
    >
      <div className="space-y-6">
        {/* Content header */}
        <div className="flex justify-between items-center">
          <div className="h-7 w-40 bg-gray-800/50 rounded animate-pulse"></div>
          <div className="h-9 w-28 bg-gray-800/50 rounded-lg animate-pulse"></div>
        </div>
        
        {/* Content items */}
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 bg-gray-800/30 rounded-lg">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-5 w-48 bg-gray-800/50 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-800/50 rounded animate-pulse"></div>
                </div>
                <div className="h-4 w-full bg-gray-800/50 rounded animate-pulse"></div>
                <div className="h-4 w-3/4 bg-gray-800/50 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const ContactRightPanelSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Stats card skeleton */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
        <div className="space-y-4">
          <div className="h-6 w-24 bg-gray-800/50 rounded animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 w-12 bg-gray-800/50 rounded animate-pulse mx-auto"></div>
                <div className="h-4 w-16 bg-gray-800/50 rounded animate-pulse mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Activity timeline skeleton */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
        <div className="space-y-4">
          <div className="h-6 w-32 bg-gray-800/50 rounded animate-pulse"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 bg-gray-800/50 rounded-full animate-pulse flex-shrink-0 mt-1"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-gray-800/50 rounded animate-pulse"></div>
                  <div className="h-3 w-24 bg-gray-800/50 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ContactProfileSkeleton = () => {
  return (
    <div className="min-h-screen text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Contact Header Skeleton */}
        <ContactHeaderSkeleton />

        {/* Navigation Tabs Skeleton */}
        <ContactTabsSkeleton />

        {/* Main Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar Skeleton */}
          <div className="lg:col-span-3">
            <ContactSidebarSkeleton />
          </div>

          {/* Main Content Skeleton */}
          <div className="lg:col-span-6">
            <ContactMainContentSkeleton />
          </div>

          {/* Right Panel Skeleton */}
          <div className="lg:col-span-3">
            <ContactRightPanelSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
};
import React from 'react';
import { motion } from 'framer-motion';

interface ProgressCellProps {
  progress: number;
  isDark?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressCell({ 
  progress, 
  isDark = true, 
  showLabel = true,
  size = 'md' 
}: ProgressCellProps) {
  const getGradient = (p: number) => {
    if (p === 100) return 'from-emerald-500 to-green-400';
    if (p >= 70) return 'from-emerald-500 to-teal-400';
    if (p >= 40) return 'from-amber-500 to-yellow-400';
    return 'from-orange-500 to-red-400';
  };

  const getGlow = (p: number) => {
    if (p === 100) return 'shadow-emerald-500/30';
    if (p >= 70) return 'shadow-emerald-500/20';
    if (p >= 40) return 'shadow-amber-500/20';
    return 'shadow-orange-500/20';
  };

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="flex items-center gap-3 px-3 w-full">
      <div className={`flex-1 ${heightClasses[size]} rounded-full overflow-hidden backdrop-blur-sm 
                      ${isDark ? 'bg-gray-800/50' : 'bg-gray-200/50'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full bg-gradient-to-r ${getGradient(progress)} rounded-full
                      ${isDark ? `shadow-lg ${getGlow(progress)}` : ''} relative overflow-hidden`}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 
                          animate-shimmer" />
        </motion.div>
      </div>
      {showLabel && (
        <span className={`text-xs font-medium min-w-[2rem] text-right 
                         ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {progress}%
        </span>
      )}
    </div>
  );
}

// Circular progress indicator
export function CircularProgress({ 
  progress, 
  isDark = true,
  size = 32 
}: { 
  progress: number; 
  isDark?: boolean;
  size?: number;
}) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const getColor = (p: number) => {
    if (p === 100) return '#10B981';
    if (p >= 70) return '#14B8A6';
    if (p >= 40) return '#F59E0B';
    return '#F97316';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? '#374151' : '#E5E7EB'}
          strokeWidth="3"
          fill="none"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(progress)}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[10px] font-semibold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {progress}%
        </span>
      </div>
    </div>
  );
}


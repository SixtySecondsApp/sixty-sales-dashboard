import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { formatRank } from '@/lib/utils';

interface UserPositionCardProps {
  effectivePosition: number;
  signupPosition: number;
  referralCount: number;
  totalPoints?: number;
}

export function UserPositionCard({ effectivePosition, signupPosition, referralCount, totalPoints }: UserPositionCardProps) {
  const positionsMoved = signupPosition - effectivePosition;
  const pointsEarned = totalPoints ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background: 'rgba(17, 24, 39, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(55, 65, 81, 0.5)'
      }}
    >
      {/* Gradient Accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5" />

      <div className="relative z-10 space-y-6">
        {/* Current Position */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="text-sm text-gray-400 uppercase tracking-wide">Your Position</span>
          </div>
          <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
            #{formatRank(effectivePosition)}
          </div>
          {positionsMoved > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                Moved up {positionsMoved} {positionsMoved === 1 ? 'point' : 'points'}!
              </span>
            </motion.div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Referrals */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Referrals</span>
            </div>
            <div className="text-2xl font-bold text-white">{referralCount}</div>
            <div className="text-xs text-gray-500 mt-1">friends joined</div>
          </div>

          {/* Points Earned */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-500 uppercase tracking-wide">Total Points</span>
            </div>
            <div className="text-2xl font-bold text-white">{pointsEarned}</div>
            <div className="text-xs text-gray-500 mt-1">earned</div>
          </div>
        </div>

        {/* Original Position Reference */}
        {positionsMoved > 0 && (
          <div className="text-center pt-2">
            <span className="text-xs text-gray-600">
              Original position: #{formatRank(signupPosition)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

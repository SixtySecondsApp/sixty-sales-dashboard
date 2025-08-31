import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Video, 
  Building2, 
  User, 
  Clock,
  MessageSquare,
  TrendingUp,
  Award,
  Calendar,
  ExternalLink,
  Edit,
  Trash2,
  ChevronRight,
  Play,
  Users,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  fathom_recording_id: string;
  title: string;
  share_url: string;
  calls_url: string;
  meeting_start: string;
  meeting_end: string;
  duration_minutes: number;
  owner_user_id: string;
  owner_email: string;
  team_name: string;
  company_id: string | null;
  primary_contact_id: string | null;
  summary: string;
  transcript_doc_url: string | null;
  sentiment_score: number | null;
  coach_rating: number | null;
  talk_time_rep_pct: number | null;
  talk_time_customer_pct: number | null;
  talk_time_judgement: string | null;
  company?: {
    name: string;
    domain: string;
  };
  action_items?: {
    completed: boolean;
  }[];
}

interface MeetingCardProps {
  meeting: Meeting;
  viewMode: 'grid' | 'list';
  isSelected?: boolean;
  isSelectMode?: boolean;
  onSelect?: (meetingId: string, isSelected: boolean) => void;
  onEdit?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
  onNavigate?: (meeting: Meeting) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  viewMode,
  isSelected = false,
  isSelectMode = false,
  onSelect,
  onEdit,
  onDelete,
  onNavigate,
}) => {
  const [hovered, setHovered] = useState(false);

  // Generate meeting icon color based on sentiment or coach rating
  const getMeetingColor = () => {
    if (meeting.sentiment_score !== null) {
      if (meeting.sentiment_score > 0.25) return 'from-emerald-500 to-teal-500';
      if (meeting.sentiment_score < -0.25) return 'from-red-500 to-orange-500';
      return 'from-yellow-500 to-orange-500';
    }
    
    const colors = [
      'from-blue-500 to-purple-500',
      'from-indigo-500 to-blue-500',
      'from-purple-500 to-pink-500',
      'from-teal-500 to-cyan-500',
    ];
    
    const index = meeting.id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Get sentiment label and color
  const getSentimentInfo = () => {
    if (meeting.sentiment_score === null) return { label: 'Unknown', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    
    if (meeting.sentiment_score <= -0.25) {
      return { label: 'Challenging', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }
    if (meeting.sentiment_score < 0.25) {
      return { label: 'Neutral', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    }
    return { label: 'Positive', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  };

  // Get coach rating color
  const getCoachRatingColor = (rating: number | null) => {
    if (!rating) return 'text-gray-400';
    if (rating >= 8) return 'text-emerald-400';
    if (rating >= 6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Format meeting date
  const formatMeetingDate = () => {
    return format(new Date(meeting.meeting_start), 'MMM d, yyyy');
  };

  // Format meeting time
  const formatMeetingTime = () => {
    return format(new Date(meeting.meeting_start), 'h:mm a');
  };

  // Get days since meeting
  const getDaysSince = () => {
    const meetingDate = new Date(meeting.meeting_start);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - meetingDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Generate initials from meeting title
  const generateInitials = () => {
    return meeting.title.split(' ').map(word => word.charAt(0)).join('').slice(0, 2).toUpperCase();
  };

  // Check if meeting is recent (within 3 days)
  const isRecent = () => {
    return getDaysSince() <= 3;
  };

  // Get action items summary
  const getActionItemsSummary = () => {
    if (!meeting.action_items || meeting.action_items.length === 0) return null;
    
    const total = meeting.action_items.length;
    const completed = meeting.action_items.filter(item => item.completed).length;
    return { total, completed, pending: total - completed };
  };

  if (viewMode === 'list') {
    const sentiment = getSentimentInfo();
    const actionItems = getActionItemsSummary();

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: 4 }}
        className={`bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border transition-all duration-300 group cursor-pointer ${
          isSelected && isSelectMode 
            ? 'border-emerald-500/30 bg-emerald-500/5' 
            : 'border-gray-800/50 hover:border-emerald-500/30'
        }`}
        onClick={() => onNavigate?.(meeting)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Select Checkbox */}
            {isSelectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect?.(meeting.id, e.target.checked);
                }}
                className="w-5 h-5 text-emerald-500 bg-gray-800/80 border-2 border-gray-600 rounded-md focus:ring-emerald-500 focus:ring-2"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            
            {/* Meeting Icon */}
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getMeetingColor()} flex items-center justify-center text-white font-bold`}>
              <Video className="w-4 h-4" />
            </div>
            
            <div>
              <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                {meeting.title}
                {isRecent() && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {meeting.company && (
                  <>
                    <Building2 className="w-3 h-3" />
                    <span>{meeting.company.name}</span>
                    <span>•</span>
                  </>
                )}
                <Calendar className="w-3 h-3" />
                <span>{formatMeetingDate()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <Badge className={`text-xs ${sentiment.color} border mb-1`}>
                {sentiment.label}
              </Badge>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(meeting.duration_minutes)}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {meeting.coach_rating && (
                <div className="text-center">
                  <div className={`text-sm font-semibold ${getCoachRatingColor(meeting.coach_rating)}`}>
                    {meeting.coach_rating}/10
                  </div>
                  <div className="text-xs text-gray-500">Coach</div>
                </div>
              )}
              {actionItems && (
                <div className="text-center">
                  <div className="text-sm font-semibold text-blue-400">
                    {actionItems.completed}/{actionItems.total}
                  </div>
                  <div className="text-xs text-gray-500">Actions</div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {!isSelectMode && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(meeting.share_url, '_blank');
                    }}
                    className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(meeting);
                    }}
                    className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(meeting);
                    }}
                    className="text-gray-400 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid view
  const sentiment = getSentimentInfo();
  const actionItems = getActionItemsSummary();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-2xl p-6 border transition-all duration-300 overflow-hidden group cursor-pointer ${
        isSelected && isSelectMode 
          ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' 
          : 'border-gray-800/50 hover:border-emerald-500/30'
      }`}
      onClick={() => onNavigate?.(meeting)}
    >
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        animate={hovered ? { scale: 1.5, rotate: 180 } : { scale: 1, rotate: 0 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Select Checkbox */}
      {isSelectMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect?.(meeting.id, e.target.checked);
            }}
            className="w-5 h-5 text-emerald-500 bg-gray-800/80 border-2 border-gray-600 rounded-md focus:ring-emerald-500 focus:ring-2"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Recent indicator */}
      {isRecent() && (
        <div className="absolute top-4 right-4 z-10">
          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
        </div>
      )}

      {/* Meeting Icon */}
      <div className="relative mb-4">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getMeetingColor()} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
          <Video className="w-6 h-6" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
      </div>

      {/* Meeting Info */}
      <div className="relative z-10 mb-4">
        <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">
          {meeting.title}
        </h3>
        <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
          <Calendar className="w-3 h-3" />
          <span>{formatMeetingDate()} at {formatMeetingTime()}</span>
        </div>
        {meeting.company && (
          <div className="flex items-center gap-1 text-xs text-emerald-400/80">
            <Building2 className="w-3 h-3" />
            <span>{meeting.company.name}</span>
          </div>
        )}
      </div>

      {/* Meeting Stats */}
      <div className="relative z-10 mb-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="text-center">
            <Badge className={`text-xs ${sentiment.color} border mb-1`}>
              {sentiment.label}
            </Badge>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Duration</div>
            <div className="font-semibold text-gray-300 text-sm">
              {formatDuration(meeting.duration_minutes)}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {meeting.coach_rating && (
            <div>
              <span className="text-gray-500">Coach Rating</span>
              <div className={`font-semibold ${getCoachRatingColor(meeting.coach_rating)}`}>
                {meeting.coach_rating}/10
              </div>
            </div>
          )}
          {actionItems && (
            <div>
              <span className="text-gray-500">Action Items</span>
              <div className="font-semibold text-blue-400">
                {actionItems.completed}/{actionItems.total}
              </div>
            </div>
          )}
          {meeting.talk_time_rep_pct && (
            <div>
              <span className="text-gray-500">Talk Time</span>
              <div className="font-semibold text-purple-400">
                {Math.round(meeting.talk_time_rep_pct)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Preview */}
      {meeting.summary && (
        <div className="relative z-10 mb-4 p-3 bg-gray-800/30 rounded-lg">
          <div className="text-xs text-gray-400 mb-1">Summary</div>
          <div className="text-xs text-gray-300 line-clamp-2">
            {meeting.summary}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between pt-4 border-t border-gray-800/50">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{getDaysSince() === 0 ? 'Today' : `${getDaysSince()} days ago`}</span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isSelectMode && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(meeting.share_url, '_blank');
                }}
                className="w-8 h-8 p-0 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/20"
                title="View Recording"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(meeting);
                }}
                className="w-8 h-8 p-0 text-gray-400 hover:text-blue-400 hover:bg-blue-400/20"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(meeting);
                }}
                className="w-8 h-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-400/20"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MeetingCard;
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/clientV2'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { format } from 'date-fns'
import { 
  Grid2X2, 
  List, 
  Users, 
  User, 
  Video, 
  Clock, 
  MessageSquare,
  TrendingUp,
  Award,
  Calendar,
  ExternalLink
} from 'lucide-react'

interface Meeting {
  id: string
  fathom_recording_id: string
  title: string
  share_url: string
  calls_url: string
  meeting_start: string
  meeting_end: string
  duration_minutes: number
  owner_user_id: string
  owner_email: string
  team_name: string
  company_id: string | null
  primary_contact_id: string | null
  summary: string
  transcript_doc_url: string | null
  thumbnail_url: string | null
  sentiment_score: number | null
  coach_rating: number | null
  talk_time_rep_pct: number | null
  talk_time_customer_pct: number | null
  talk_time_judgement: string | null
  company?: {
    name: string
    domain: string
  }
  action_items?: {
    completed: boolean
  }[]
}

function sentimentLabel(score: number | null): string {
  if (score === null) return 'Unknown'
  if (score <= -0.25) return 'Challenging'
  if (score < 0.25) return 'Neutral'
  return 'Positive'
}

function sentimentTone(score: number | null): 'destructive' | 'default' | 'success' {
  if (score === null) return 'default'
  if (score <= -0.25) return 'destructive'
  if (score < 0.25) return 'default'
  return 'success'
}

const StatCard: React.FC<{ 
  title: string
  value: string
  sub?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}> = ({ title, value, sub, icon, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    whileHover={{ scale: 1.02, y: -2 }}
    className="relative overflow-hidden bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-2xl p-4 border border-gray-800/50 shadow-lg hover:shadow-xl hover:border-gray-700/60 transition-all duration-300 group"
  >
    {/* Background decoration */}
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    {/* Content */}
    <div className="relative flex items-start justify-between">
      <div className="flex flex-col gap-1">
        <div className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</div>
        <div className="text-2xl font-bold text-gray-100">{value}</div>
        {sub && (
          <div className={cn(
            "text-xs font-medium",
            trend === 'up' ? 'text-emerald-400' : 
            trend === 'down' ? 'text-red-400' : 
            'text-gray-500'
          )}>
            {sub}
          </div>
        )}
      </div>
      {icon && (
        <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
          {icon}
        </div>
      )}
    </div>
  </motion.div>
)

const MeetingsList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'me' | 'team'>('me')
  const [view, setView] = useState<'list' | 'grid'>('grid')
  const [stats, setStats] = useState({
    meetingsThisMonth: 0,
    avgDuration: 0,
    actionItemsOpen: 0,
    avgSentiment: 0,
    avgCoachRating: 0
  })
  const [thumbnailsEnsured, setThumbnailsEnsured] = useState(false)

  useEffect(() => {
    fetchMeetings()
  }, [scope, user])

  // Ensure thumbnails exist for any listed meeting with a video
  useEffect(() => {
    const ensureThumbnails = async () => {
      if (thumbnailsEnsured || meetings.length === 0) return
      try {
        for (const m of meetings) {
          if (m.thumbnail_url || !(m.share_url || m.fathom_recording_id)) continue

          // Build embed URL from share_url or recording id
          let embedUrl: string | null = null
          if (m.share_url) {
            try {
              const u = new URL(m.share_url)
              const token = u.pathname.split('/').filter(Boolean).pop()
              if (token) embedUrl = `https://fathom.video/embed/${token}`
            } catch {
              // ignore parse errors
            }
          }
          if (!embedUrl && m.fathom_recording_id) {
            embedUrl = `https://app.fathom.video/recording/${m.fathom_recording_id}`
          }

          let thumbnailUrl: string | null = null
          if (embedUrl) {
            // Choose a representative timestamp: midpoint, clamped to >=5s
            const midpointSeconds = Math.max(5, Math.floor((m.duration_minutes || 0) * 60 / 2))
            const { data, error } = await supabase.functions.invoke('generate-video-thumbnail', {
              body: {
                recording_id: m.fathom_recording_id,
                share_url: m.share_url,
                fathom_embed_url: embedUrl,
                timestamp_seconds: midpointSeconds,
                meeting_id: m.id,
              },
            })
            if (!error && (data as any)?.success && (data as any)?.thumbnail_url) {
              thumbnailUrl = (data as any).thumbnail_url as string
            }
          }

          // Fallback placeholder if generation not possible
          if (!thumbnailUrl) {
            const firstLetter = (m.title || 'M')[0].toUpperCase()
            thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
          }

          // Persist and update local state
          // If function persisted it (db_updated), skip client-side write
          if (!(data as any)?.db_updated) {
            await supabase
              .from('meetings')
              .update({ thumbnail_url: thumbnailUrl })
              .eq('id', m.id)
          }

          setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, thumbnail_url: thumbnailUrl } : x))

          // Small delay to avoid overwhelming screenshot provider
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } finally {
        setThumbnailsEnsured(true)
      }
    }

    ensureThumbnails()
  }, [meetings, thumbnailsEnsured])

  const fetchMeetings = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      let query = supabase
        .from('meetings')
        .select(`
          *,
          company:companies!fk_meetings_company_id(name, domain),
          action_items:meeting_action_items(completed)
        `)
        .order('meeting_start', { ascending: false })

      if (scope === 'me') {
        // Show only meetings conducted by the current user
        // Use email as the primary lookup to align with authentication model
        query = query.eq('owner_email', user.email)
      } else {
        // Get team meetings - for now just show all meetings the user can see
        // In production, you'd filter by team_name or organization
      }

      const { data, error } = await query

      if (error) throw error

      setMeetings(data || [])
      // Reset to allow ensureThumbnails to run for the new list
      setThumbnailsEnsured(false)
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (meetings: Meeting[]) => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const thisMonthMeetings = meetings.filter(m => 
      new Date(m.meeting_start) >= startOfMonth
    )
    
    const totalDuration = meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0)
    const avgDuration = meetings.length > 0 ? Math.round(totalDuration / meetings.length) : 0
    
    const openActionItems = meetings.reduce((sum, m) => {
      const open = m.action_items?.filter(a => !a.completed).length || 0
      return sum + open
    }, 0)
    
    const sentimentScores = meetings
      .filter(m => m.sentiment_score !== null)
      .map(m => m.sentiment_score as number)
    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : 0
    
    const coachRatings = meetings
      .filter(m => m.coach_rating !== null)
      .map(m => m.coach_rating as number)
    const avgCoachRating = coachRatings.length > 0
      ? Math.round(coachRatings.reduce((a, b) => a + b, 0) / coachRatings.length)
      : 0
    
    setStats({
      meetingsThisMonth: thisMonthMeetings.length,
      avgDuration,
      actionItemsOpen: openActionItems,
      avgSentiment,
      avgCoachRating
    })
  }

  const openMeeting = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 backdrop-blur-sm rounded-xl border border-emerald-500/20">
            <Video className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">
              Meetings
            </h1>
            <p className="text-sm text-gray-400 mt-1">Review your recorded conversations and insights</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Scope Toggle */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-1 border border-gray-800/50 shadow-lg"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScope('me')}
              className={cn(
                "relative transition-all duration-200",
                scope === 'me' 
                  ? 'bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 text-gray-100 shadow-md' 
                  : 'hover:bg-gray-800/30 text-gray-400'
              )}
            >
              <User className="h-4 w-4 mr-1.5" />
              My
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScope('team')}
              className={cn(
                "relative transition-all duration-200",
                scope === 'team' 
                  ? 'bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 text-gray-100 shadow-md' 
                  : 'hover:bg-gray-800/30 text-gray-400'
              )}
            >
              <Users className="h-4 w-4 mr-1.5" />
              Team
            </Button>
          </motion.div>
          
          {/* View Toggle */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-1 border border-gray-800/50 shadow-lg"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('list')}
              className={cn(
                "relative transition-all duration-200",
                view === 'list' 
                  ? 'bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 text-gray-100 shadow-md' 
                  : 'hover:bg-gray-800/30 text-gray-400'
              )}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('grid')}
              className={cn(
                "relative transition-all duration-200",
                view === 'grid' 
                  ? 'bg-gray-800/70 backdrop-blur-sm border border-gray-700/50 text-gray-100 shadow-md' 
                  : 'hover:bg-gray-800/30 text-gray-400'
              )}
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard 
          title="This Month" 
          value={stats.meetingsThisMonth.toString()}
          icon={<Calendar className="h-5 w-5" />}
          trend={stats.meetingsThisMonth > 0 ? 'up' : 'neutral'}
        />
        <StatCard 
          title="Avg Duration" 
          value={`${stats.avgDuration}m`}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard 
          title="Open Tasks" 
          value={stats.actionItemsOpen.toString()}
          icon={<MessageSquare className="h-5 w-5" />}
          trend={stats.actionItemsOpen > 0 ? 'down' : 'neutral'}
        />
        <StatCard 
          title="Sentiment" 
          value={sentimentLabel(stats.avgSentiment)}
          sub={stats.avgSentiment !== 0 ? `${stats.avgSentiment > 0 ? '+' : ''}${stats.avgSentiment.toFixed(2)}` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={stats.avgSentiment > 0.25 ? 'up' : stats.avgSentiment < -0.25 ? 'down' : 'neutral'}
        />
        <StatCard 
          title="Coach Score" 
          value={stats.avgCoachRating ? `${stats.avgCoachRating}%` : 'N/A'}
          icon={<Award className="h-5 w-5" />}
          trend={stats.avgCoachRating > 75 ? 'up' : stats.avgCoachRating < 50 ? 'down' : 'neutral'}
        />
      </div>

      {/* Meetings Display */}
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-gradient-to-br from-gray-900/60 to-gray-900/30 backdrop-blur-xl rounded-2xl border border-gray-800/50 overflow-hidden shadow-2xl"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800/50 hover:bg-gray-800/20">
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Company</TableHead>
                  <TableHead className="text-gray-400">Rep</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Duration</TableHead>
                  <TableHead className="text-gray-400">Sentiment</TableHead>
                  <TableHead className="text-gray-400">Coach</TableHead>
                  <TableHead className="text-gray-400">Tasks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting, index) => {
                  const openTasks = meeting.action_items?.filter(a => !a.completed).length || 0
                  
                  return (
                    <motion.tr
                      key={meeting.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="border-gray-800/50 hover:bg-gray-800/20 transition-colors group"
                    >
                      <TableCell className="font-medium text-gray-200">
                        {meeting.title || 'Untitled'}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {meeting.company?.name || '-'}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {meeting.owner_email?.split('@')[0]}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {meeting.meeting_start 
                          ? format(new Date(meeting.meeting_start), 'dd MMM yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {meeting.duration_minutes || 0}m
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={sentimentTone(meeting.sentiment_score) as any}
                          className="backdrop-blur-sm"
                        >
                          {sentimentLabel(meeting.sentiment_score)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {meeting.coach_rating !== null && (
                          <Badge variant="secondary" className="backdrop-blur-sm">
                            {meeting.coach_rating}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {openTasks > 0 && (
                          <span className="text-amber-400 font-medium">{openTasks}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openMeeting(meeting.id)}
                          className="hover:bg-gray-800/50 hover:text-emerald-400 transition-colors group-hover:opacity-100 opacity-70"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {meetings.map((meeting, index) => {
              const openTasks = meeting.action_items?.filter(a => !a.completed).length || 0
              
              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="bg-gradient-to-br from-gray-900/70 to-gray-900/40 backdrop-blur-xl rounded-2xl p-5 border border-gray-800/50 hover:border-gray-700/60 transition-all duration-300 shadow-xl hover:shadow-2xl group cursor-pointer"
                  onClick={() => openMeeting(meeting.id)}
                >
                  {/* Video Thumbnail Area */}
                  <div className="relative aspect-video bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl mb-4 overflow-hidden">
                    {meeting.thumbnail_url ? (
                      <img
                        src={meeting.thumbnail_url}
                        alt={meeting.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}
                    {/* Fallback icon (always rendered behind image) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="h-8 w-8 text-gray-600" />
                    </div>
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-900/80 backdrop-blur-sm rounded-lg text-xs text-gray-300 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meeting.duration_minutes || 0}m
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {meeting.title || 'Untitled Meeting'}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {meeting.company?.name || 'No company'}
                      </p>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant={sentimentTone(meeting.sentiment_score) as any}
                        className="backdrop-blur-sm text-xs"
                      >
                        {sentimentLabel(meeting.sentiment_score)}
                      </Badge>
                      {meeting.coach_rating !== null && (
                        <Badge variant="secondary" className="backdrop-blur-sm text-xs">
                          Coach: {meeting.coach_rating}%
                        </Badge>
                      )}
                      {openTasks > 0 && (
                        <Badge variant="outline" className="backdrop-blur-sm text-xs border-amber-500/50 text-amber-400">
                          {openTasks} tasks
                        </Badge>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                      <div className="text-xs text-gray-500">
                        {meeting.meeting_start 
                          ? format(new Date(meeting.meeting_start), 'dd MMM yyyy')
                          : 'No date'}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {meeting.owner_email?.split('@')[0]}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {meetings.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gray-900/60 to-gray-900/30 backdrop-blur-xl rounded-2xl p-12 border border-gray-800/50 text-center shadow-xl"
        >
          <Video className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No meetings found</h3>
          <p className="text-gray-500">Meetings will appear here once they are synced from Fathom.</p>
        </motion.div>
      )}
    </div>
  )
}

export default MeetingsList
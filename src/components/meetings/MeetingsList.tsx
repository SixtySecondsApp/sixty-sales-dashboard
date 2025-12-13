import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/clientV2'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useOrg } from '@/lib/contexts/OrgContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MeetingsEmptyState } from './MeetingsEmptyState'
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration'
import { toast } from 'sonner'
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
  ExternalLink,
  Play,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { MeetingUsageBar } from '@/components/MeetingUsageIndicator'

// Helper to format duration safely (filters out corrupted data)
const formatDuration = (minutes: number | null | undefined): string => {
  if (!minutes || minutes <= 0 || minutes > 480) {
    return '—' // 8 hours max, anything more is bad data
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${minutes}m`
}

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
  next_actions_count?: number | null
  meeting_type?: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general' | null
  classification_confidence?: number | null
  company?: {
    name: string
    domain: string
  }
  action_items?: {
    completed: boolean
  }[]
  tasks?: {
    status: string
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
    className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10 hover:border-gray-300/50 dark:hover:border-gray-600/40 transition-all duration-300 group"
  >
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-50">{value}</div>
        {sub && (
          <div className={cn(
            "text-xs font-medium",
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
            trend === 'down' ? 'text-red-600 dark:text-red-400' :
            'text-gray-500 dark:text-gray-400'
          )}>
            {sub}
          </div>
        )}
      </div>
      {icon && (
        <div className="p-2.5 rounded-xl bg-gray-100/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/30 text-gray-500 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-200 dark:group-hover:border-emerald-500/30 transition-all duration-300">
          {icon}
        </div>
      )}
    </div>
  </motion.div>
)

// Skeleton Components for Loading State
const StatCardSkeleton: React.FC = () => (
  <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-16 bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-9 w-14 bg-gray-200/60 dark:bg-gray-700/40" />
      </div>
      <Skeleton className="h-10 w-10 rounded-xl bg-gray-200/60 dark:bg-gray-700/40" />
    </div>
  </div>
)

const MeetingCardSkeleton: React.FC = () => (
  <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10">
    {/* Video Thumbnail Skeleton */}
    <Skeleton className="aspect-video rounded-xl mb-4 bg-gray-200/60 dark:bg-gray-700/40" />

    {/* Content */}
    <div className="space-y-3">
      <div>
        <Skeleton className="h-5 w-3/4 mb-2 bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-4 w-1/2 bg-gray-200/60 dark:bg-gray-700/40" />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16 rounded-full bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-5 w-14 rounded-full bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-5 w-20 rounded-full bg-gray-200/60 dark:bg-gray-700/40" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200/50 dark:border-gray-700/30">
        <Skeleton className="h-3 w-20 bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-3 w-16 bg-gray-200/60 dark:bg-gray-700/40" />
      </div>
    </div>
  </div>
)

const MeetingRowSkeleton: React.FC = () => (
  <TableRow className="border-gray-200/50 dark:border-gray-700/30">
    <TableCell><Skeleton className="h-4 w-32 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-4 w-16 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-4 w-12 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-5 w-14 rounded-full bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-5 w-10 rounded-full bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-4 w-6 bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
    <TableCell><Skeleton className="h-8 w-8 rounded-lg bg-gray-200/60 dark:bg-gray-700/40" /></TableCell>
  </TableRow>
)

const MeetingsListSkeleton: React.FC<{ view: 'list' | 'grid' }> = ({ view }) => (
  <div className="p-6 space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl bg-gray-200/60 dark:bg-gray-700/40" />
        <div>
          <Skeleton className="h-8 w-32 mb-2 bg-gray-200/60 dark:bg-gray-700/40" />
          <Skeleton className="h-4 w-56 bg-gray-200/60 dark:bg-gray-700/40" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-32 rounded-xl bg-gray-200/60 dark:bg-gray-700/40" />
        <Skeleton className="h-9 w-20 rounded-xl bg-gray-200/60 dark:bg-gray-700/40" />
      </div>
    </div>

    {/* Stats Skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Content Skeleton */}
    {view === 'list' ? (
      <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 overflow-hidden shadow-sm dark:shadow-lg dark:shadow-black/10">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200/50 dark:border-gray-700/30">
              <TableHead className="text-gray-500 dark:text-gray-400">Title</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Company</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Rep</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Date</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Duration</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Type</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Sentiment</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Coach</TableHead>
              <TableHead className="text-gray-500 dark:text-gray-400">Tasks</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <MeetingRowSkeleton key={i} />
            ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <MeetingCardSkeleton key={i} />
        ))}
      </div>
    )}
  </div>
)

const ITEMS_PER_PAGE = 30

const MeetingsList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeOrgId } = useOrg()
  const { syncState, isConnected, isSyncing, triggerSync } = useFathomIntegration()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'me' | 'team'>('me')
  const [view, setView] = useState<'list' | 'grid'>('grid')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({
    meetingsThisMonth: 0,
    avgDuration: 0,
    actionItemsOpen: 0,
    avgSentiment: 0,
    avgCoachRating: 0
  })
  const [myMeetingsCount, setMyMeetingsCount] = useState(0)
  const [teamMeetingsCount, setTeamMeetingsCount] = useState(0)
  const [thumbnailsEnsured, setThumbnailsEnsured] = useState(false)
  const autoSyncAttemptedRef = useRef(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // Reset to page 1 when scope or org changes
  useEffect(() => {
    setCurrentPage(1)
  }, [scope, activeOrgId])

  useEffect(() => {
    fetchMeetings()
  }, [scope, user, activeOrgId, currentPage])

  // Auto-sync when user arrives with Fathom connected but no meetings
  // This handles users coming from onboarding who skipped the sync step
  // Only runs ONCE per page load - uses ref to prevent re-triggering
  useEffect(() => {
    // Skip if we've already attempted auto-sync this session
    if (autoSyncAttemptedRef.current) return

    const shouldAutoSync =
      !loading &&
      isConnected &&
      !isSyncing &&
      meetings.length === 0

    if (shouldAutoSync) {
      // Mark as attempted BEFORE starting sync to prevent re-triggers
      autoSyncAttemptedRef.current = true

      toast.info('Syncing your meetings...', {
        description: 'We\'re importing your recent Fathom recordings in the background.'
      })

      // Trigger initial sync with limit of 10 meetings for quick feedback
      triggerSync({ sync_type: 'initial', limit: 10 })
        .then(() => {
          toast.success('Initial sync complete!', {
            description: 'Your most recent meetings are now available.'
          })
          // Refresh meetings list after sync
          fetchMeetings()
        })
        .catch((err) => {
          console.error('Auto-sync failed:', err)
          toast.error('Sync encountered an issue', {
            description: 'You can try syncing again from Settings.'
          })
        })
    }
  }, [loading, isConnected, isSyncing, meetings.length, triggerSync])

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
            const { data, error } = await supabase.functions.invoke('generate-video-thumbnail-v2', {
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
            thumbnailUrl = `https://dummyimage.com/640x360/1a1a1a/10b981&text=${encodeURIComponent(firstLetter)}`
          }

          // Persist thumbnail to database
          await supabase
            .from('meetings')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', m.id)

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
      // Supabase generic types can get extremely deep in complex query chains.
      // Use a local untyped alias to keep TS fast and stable (runtime behavior unchanged).
      const sb: any = supabase

      // First get total count for pagination
      // Supabase query typing gets extremely deep here; keep it runtime-safe and avoid TS instantiation blowups.
      let countQuery: any = sb
        .from('meetings')
        .select('*', { count: 'exact', head: true })

      if (activeOrgId) {
        countQuery = countQuery.eq('org_id', activeOrgId)
      }
      if (scope === 'me' || !activeOrgId) {
        countQuery = countQuery.or(`owner_user_id.eq.${user.id},owner_email.eq.${user.email}`)
      }

      const { count } = await countQuery
      setTotalCount(count || 0)

      // Always fetch both counts for the toggle buttons
      if (activeOrgId) {
        // Get my meetings count
        const myCountQuery: any = sb
          .from('meetings')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', activeOrgId)
          .or(`owner_user_id.eq.${user.id},owner_email.eq.${user.email}`)
        const { count: myCount } = await myCountQuery
        setMyMeetingsCount(myCount || 0)

        // Get team (all org) meetings count
        const teamCountQuery: any = sb
          .from('meetings')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', activeOrgId)
        const { count: teamCount } = await teamCountQuery
        setTeamMeetingsCount(teamCount || 0)
      } else {
        // No org - all meetings are "my" meetings
        setMyMeetingsCount(count || 0)
        setTeamMeetingsCount(count || 0)
      }

      // Now fetch paginated data
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      // Same as above: prevent excessively-deep generic instantiation.
      let query: any = sb
        .from('meetings')
        .select(`
          *,
          company:companies!fk_meetings_company_id(name, domain),
          action_items:meeting_action_items(completed),
          tasks(status)
        `)
        .order('meeting_start', { ascending: false })
        .range(from, to)

      // Apply org scoping if we have an active org
      if (activeOrgId) {
        query = query.eq('org_id', activeOrgId)
      }

      // RLS already filters by organization, so we get all meetings the user can access
      // Additional client filters:
      // - If no activeOrgId, fall back to user-owned meetings only to avoid empty state
      // - "My" scope filters to meetings where user is the owner
      if (scope === 'me' || !activeOrgId) {
        query = query.or(`owner_user_id.eq.${user.id},owner_email.eq.${user.email}`)
      }

      const { data, error } = await query

      if (error) throw error

      setMeetings((data as Meeting[]) || [])
      // Reset to allow ensureThumbnails to run for the new list
      setThumbnailsEnsured(false)
      // Only calculate stats on first page to avoid recalculating on every page
      if (currentPage === 1) {
        calculateStats(((data as Meeting[]) || []))
      }
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
    
    // Filter out unreasonable durations (> 8 hours = 480 minutes is likely bad data)
    const validDurations = meetings
      .map(m => m.duration_minutes || 0)
      .filter(d => d > 0 && d <= 480)
    const totalDuration = validDurations.reduce((sum, d) => sum + d, 0)
    const avgDuration = validDurations.length > 0 ? Math.round(totalDuration / validDurations.length) : 0
    
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
    return <MeetingsListSkeleton view={view} />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Meeting Usage Bar - Shows for free tier users */}
      <MeetingUsageBar />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/10 dark:bg-emerald-500/20 backdrop-blur-sm rounded-xl border border-emerald-600/20 dark:border-emerald-500/20">
            <Video className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Meetings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Review your recorded conversations and insights</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Scope Toggle */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-xl p-1 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10"
          >
            <Button
              variant={scope === 'me' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setScope('me')}
              className={scope === 'me' ? 'bg-gray-100 dark:bg-gray-800/60' : ''}
            >
              <User className="h-4 w-4 mr-1.5" />
              My ({myMeetingsCount.toLocaleString()})
            </Button>
            <Button
              variant={scope === 'team' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setScope('team')}
              className={scope === 'team' ? 'bg-gray-100 dark:bg-gray-800/60' : ''}
            >
              <Users className="h-4 w-4 mr-1.5" />
              Team ({teamMeetingsCount.toLocaleString()})
            </Button>
          </motion.div>

          {/* View Toggle */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-xl p-1 border border-gray-200/50 dark:border-gray-700/30 shadow-sm dark:shadow-lg dark:shadow-black/10"
          >
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className={view === 'list' ? 'bg-gray-100 dark:bg-gray-800/60' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
              className={view === 'grid' ? 'bg-gray-100 dark:bg-gray-800/60' : ''}
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
          value={stats.avgCoachRating ? `${stats.avgCoachRating}/10` : 'N/A'}
          icon={<Award className="h-5 w-5" />}
          trend={stats.avgCoachRating > 7 ? 'up' : stats.avgCoachRating < 5 ? 'down' : 'neutral'}
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
            className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/30 overflow-hidden shadow-sm dark:shadow-lg dark:shadow-black/10"
          >
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200/50 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                  <TableHead className="text-gray-500 dark:text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Company</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Rep</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Duration</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Sentiment</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Coach</TableHead>
                  <TableHead className="text-gray-500 dark:text-gray-400">Tasks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.map((meeting, index) => {
                  // Unified task count from tasks table
                  const openTasks = meeting.tasks?.filter(t => t.status !== 'completed').length || 0

                  return (
                    <motion.tr
                      key={meeting.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="border-gray-200/50 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group"
                    >
                      <TableCell className="font-medium text-gray-900 dark:text-gray-200">
                        {meeting.title || 'Untitled'}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-400">
                        {meeting.company?.name || '-'}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-400">
                        {meeting.owner_email?.split('@')[0]}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-400">
                        {meeting.meeting_start
                          ? format(new Date(meeting.meeting_start), 'dd MMM yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.duration_minutes)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {meeting.meeting_type ? (
                          <Badge
                            variant="outline"
                            className="capitalize bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 backdrop-blur-sm text-xs"
                          >
                            {meeting.meeting_type.replace('_', ' ')}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                        )}
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
                            {meeting.coach_rating}/10
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {openTasks > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{openTasks}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openMeeting(meeting.id)}
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
              // Unified task count from tasks table
              const openTasks = meeting.tasks?.filter(t => t.status !== 'completed').length || 0

              return (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/30 hover:border-gray-300/50 dark:hover:border-gray-600/40 transition-all duration-300 shadow-sm dark:shadow-lg dark:shadow-black/10 cursor-pointer group"
                  onClick={() => openMeeting(meeting.id)}
                >
                  {/* Video Thumbnail Area */}
                  <div className="relative aspect-video bg-gray-100/80 dark:bg-gray-800/40 rounded-xl mb-4 overflow-hidden border border-gray-200/30 dark:border-gray-700/20">
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
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="h-8 w-8 text-emerald-600 dark:text-emerald-400 fill-current ml-1" />
                      </div>
                    </div>
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-white/90 dark:bg-gray-900/70 backdrop-blur-md rounded-lg text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1 border border-gray-200/30 dark:border-gray-700/30">
                      <Clock className="h-3 w-3" />
                      {formatDuration(meeting.duration_minutes)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {meeting.title || 'Untitled Meeting'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {meeting.company?.name || 'No company'}
                      </p>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {meeting.meeting_type && (
                        <Badge
                          variant="outline"
                          className="capitalize bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 backdrop-blur-sm text-xs"
                        >
                          {meeting.meeting_type.replace('_', ' ')}
                        </Badge>
                      )}
                      <Badge
                        variant={sentimentTone(meeting.sentiment_score) as any}
                        className="backdrop-blur-sm text-xs"
                      >
                        {sentimentLabel(meeting.sentiment_score)}
                      </Badge>
                      {meeting.coach_rating !== null && (
                        <Badge variant="secondary" className="backdrop-blur-sm text-xs">
                          Coach: {meeting.coach_rating}/10
                        </Badge>
                      )}
                      {openTasks > 0 && (
                        <Badge variant="outline" className="backdrop-blur-sm text-xs border-amber-600/50 dark:border-amber-500/50 text-amber-600 dark:text-amber-400">
                          {openTasks} tasks
                        </Badge>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200/50 dark:border-gray-700/30">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {meeting.meeting_start
                          ? format(new Date(meeting.meeting_start), 'dd MMM yyyy')
                          : 'No date'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
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

      {/* Pagination Controls */}
      {totalCount > ITEMS_PER_PAGE && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/30 shadow-sm"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount.toLocaleString()} meetings
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'w-9 h-9',
                      currentPage === pageNum && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    )}
                  >
                    {pageNum}
                  </Button>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="text-gray-400 px-1">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-9 h-9"
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {meetings.length === 0 && !loading && (
        <MeetingsEmptyState
          meetingCount={meetings.length}
          isSyncing={syncState?.sync_status === 'syncing'}
        />
      )}
    </div>
  )
}

export default MeetingsList
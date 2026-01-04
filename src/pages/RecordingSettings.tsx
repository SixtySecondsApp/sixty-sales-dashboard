import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useRecordingSettings, useRecordingRules, useRecordingUsage } from '@/lib/hooks/useRecordings'
import { useServices } from '@/lib/services/ServiceLocator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Settings,
  Bot,
  Video,
  Calendar,
  Globe,
  Users,
  Shield,
  Sparkles,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  Loader2
} from 'lucide-react'
import type { RecordingSettings as RecordingSettingsType, RecordingRule, DomainMode } from '@/lib/types/meetingBaaS'

// Domain mode labels
const domainModeLabels: Record<DomainMode, string> = {
  external_only: 'External participants only',
  internal_only: 'Internal participants only',
  specific_domains: 'Specific domains',
  all: 'All meetings',
}

// Settings Skeleton
const SettingsSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
    <div className="grid gap-6">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  </div>
)

// Rule Card Component
const RuleCard: React.FC<{
  rule: RecordingRule
  onDelete: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
}> = ({ rule, onDelete, onToggle }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            {rule.name}
          </h4>
          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
            {rule.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {rule.priority > 0 && (
            <Badge variant="outline" className="text-xs">
              Priority: {rule.priority}
            </Badge>
          )}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <p className="flex items-center gap-2">
            <Globe className="h-3 w-3" />
            {domainModeLabels[rule.domain_mode]}
            {rule.domain_mode === 'specific_domains' && rule.specific_domains && (
              <span className="text-gray-500">({rule.specific_domains.join(', ')})</span>
            )}
          </p>
          <p className="flex items-center gap-2">
            <Users className="h-3 w-3" />
            {rule.min_attendee_count} - {rule.max_attendee_count || '∞'} attendees
          </p>
          {rule.title_keywords && rule.title_keywords.length > 0 && (
            <p className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Keywords: {rule.title_keywords.join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={rule.is_active}
          onCheckedChange={(checked) => onToggle(rule.id, checked)}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(rule.id)}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </motion.div>
)

export const RecordingSettings: React.FC = () => {
  const navigate = useNavigate()
  const { recordingService } = useServices()

  // Fetch settings and rules
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useRecordingSettings()
  const { data: rules, isLoading: rulesLoading, refetch: refetchRules } = useRecordingRules()
  const { data: usage } = useRecordingUsage()

  // Local state for settings form
  const [botName, setBotName] = useState('')
  const [botImageUrl, setBotImageUrl] = useState('')
  const [entryMessage, setEntryMessage] = useState('')
  const [entryMessageEnabled, setEntryMessageEnabled] = useState(true)
  const [autoRecord, setAutoRecord] = useState(false)
  const [saving, setSaving] = useState(false)

  // Initialize form when settings load
  React.useEffect(() => {
    if (settings) {
      setBotName(settings.bot_name || '')
      setBotImageUrl(settings.bot_image_url || '')
      setEntryMessage(settings.entry_message || '')
      setEntryMessageEnabled(settings.entry_message_enabled ?? true)
      setAutoRecord(settings.auto_record ?? false)
    }
  }, [settings])

  // Save settings
  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await recordingService.updateRecordingSettings({
        bot_name: botName || undefined,
        bot_image_url: botImageUrl || undefined,
        entry_message: entryMessage || undefined,
        entry_message_enabled: entryMessageEnabled,
        auto_record: autoRecord,
      })
      toast.success('Settings saved successfully')
      refetchSettings()
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Delete rule
  const handleDeleteRule = async (ruleId: string) => {
    try {
      await recordingService.deleteRecordingRule(ruleId)
      toast.success('Rule deleted')
      refetchRules()
    } catch (error) {
      console.error('Failed to delete rule:', error)
      toast.error('Failed to delete rule')
    }
  }

  // Toggle rule active state
  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      await recordingService.updateRecordingRule(ruleId, { is_active: isActive })
      toast.success(`Rule ${isActive ? 'enabled' : 'disabled'}`)
      refetchRules()
    } catch (error) {
      console.error('Failed to toggle rule:', error)
      toast.error('Failed to update rule')
    }
  }

  if (settingsLoading || rulesLoading) {
    return <SettingsSkeleton />
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/recordings')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Recording Settings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure your recording bot and automation rules
          </p>
        </div>
      </motion.div>

      {/* Usage Card */}
      {usage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-emerald-600" />
                Usage This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {usage.used} / {usage.limit}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    recordings used
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {usage.remaining}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    remaining
                  </p>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    usage.used / usage.limit > 0.9 ? 'bg-red-500' :
                    usage.used / usage.limit > 0.7 ? 'bg-amber-500' :
                    'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Bot Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-600" />
              Bot Appearance
            </CardTitle>
            <CardDescription>
              Customize how your recording bot appears in meetings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botName">Bot Name</Label>
              <Input
                id="botName"
                placeholder="Sixty Notetaker"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This name will appear in the meeting participant list
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="botImage">Bot Avatar URL</Label>
              <Input
                id="botImage"
                placeholder="https://example.com/avatar.png"
                value={botImageUrl}
                onChange={(e) => setBotImageUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Optional: A square image URL for the bot's avatar
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="entryMessage">Entry Message</Label>
                <Switch
                  id="entryMessageEnabled"
                  checked={entryMessageEnabled}
                  onCheckedChange={setEntryMessageEnabled}
                />
              </div>
              <Input
                id="entryMessage"
                placeholder="Hi! I'm here to take notes for {rep_name}."
                value={entryMessage}
                onChange={(e) => setEntryMessage(e.target.value)}
                disabled={!entryMessageEnabled}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use {'{rep_name}'}, {'{company_name}'}, or {'{meeting_title}'} as placeholders
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-700/30">
              <div>
                <Label htmlFor="autoRecord">Auto-Record Matching Meetings</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically start recording when a meeting matches your rules
                </p>
              </div>
              <Switch
                id="autoRecord"
                checked={autoRecord}
                onCheckedChange={setAutoRecord}
              />
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recording Rules */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  Recording Rules
                </CardTitle>
                <CardDescription>
                  Define which meetings should be automatically recorded
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules && rules.length > 0 ? (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onDelete={handleDeleteRule}
                    onToggle={handleToggleRule}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No recording rules configured yet
                </p>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Rule
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Help Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Accordion type="single" collapsible className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl rounded-xl border border-gray-200/50 dark:border-gray-700/30">
          <AccordionItem value="how-it-works">
            <AccordionTrigger className="px-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                How Recording Works
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>1. Rules Engine:</strong> When a calendar event is detected, it's evaluated against your recording rules. If it matches, a recording bot is scheduled.
                </p>
                <p>
                  <strong>2. Bot Joins:</strong> At the meeting start time, the bot joins the meeting and begins recording. Participants will see the bot in the meeting.
                </p>
                <p>
                  <strong>3. Processing:</strong> After the meeting ends, the recording is processed. Transcripts are generated and AI analysis extracts key insights.
                </p>
                <p>
                  <strong>4. CRM Sync:</strong> The recording is automatically linked to relevant CRM contacts and deals based on participant emails.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="platforms">
            <AccordionTrigger className="px-4">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-emerald-600" />
                Supported Platforms
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Zoom</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">Google Meet</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">MS Teams</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>
    </div>
  )
}

export default RecordingSettings

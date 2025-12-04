import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/clientV2'
import { useAuth } from '@/lib/contexts/AuthContext'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, Info, XCircle, TestTube2 } from 'lucide-react'

// Type definitions for user_settings table (not yet in database.types.ts)
interface UserSettings {
  id: string
  user_id: string
  preferences: Record<string, any>
  created_at?: string
  updated_at?: string
}

interface UserSettingsInsert {
  user_id: string
  preferences: Record<string, any>
  updated_at?: string
}

export function TaskSyncSettings() {
  const { user, loading: authLoading } = useAuth()

  // Debug logging
  console.log('[TaskSyncSettings] Component mounted')
  console.log('[TaskSyncSettings] user:', user)
  console.log('[TaskSyncSettings] authLoading:', authLoading)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [previewCount, setPreviewCount] = useState(0)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Test settings state
  const [recentMeetings, setRecentMeetings] = useState<any[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('')
  const [testResults, setTestResults] = useState<any[]>([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false)
  const [isTestingSettings, setIsTestingSettings] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)

  const [settings, setSettings] = useState({
    enabled: false,
    importance_levels: ['high', 'medium', 'low'], // Valid values: 'high', 'medium', 'low' (no 'critical')
    confidence_threshold: 0.8
  })

  useEffect(() => {
    if (user?.id) {
      loadSettings()
      loadRecentMeetings()
    } else {
      setIsLoading(false)
    }
  }, [user?.id])

  // Ensure settings are always valid (no 'critical' or invalid values)
  useEffect(() => {
    const validLevels = settings.importance_levels.filter(
      level => ['high', 'medium', 'low'].includes(level)
    )
    
    if (validLevels.length !== settings.importance_levels.length) {
      // Invalid values detected, sanitize
      const sanitizedLevels = validLevels.length > 0 ? validLevels : ['high', 'medium', 'low']
      setSettings({ ...settings, importance_levels: sanitizedLevels })
    }
  }, [settings.importance_levels])

  useEffect(() => {
    if (user?.id && settings.enabled) {
      loadPreviewCount()
    }
  }, [user?.id, settings.enabled, settings.importance_levels, settings.confidence_threshold])

  // Test settings when meeting or settings change
  useEffect(() => {
    if (selectedMeetingId && user?.id) {
      testSettingsAgainstMeeting()
    }
  }, [selectedMeetingId, settings.importance_levels, settings.confidence_threshold])

  const loadSettings = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // If no settings exist, create default settings
        if (error.code === 'PGRST116') {
          const insertData: UserSettingsInsert = {
            user_id: user.id,
            preferences: {
              task_auto_sync: {
                enabled: false,
                importance_levels: ['high', 'medium', 'low'], // Valid values only
                confidence_threshold: 0.8
              }
            }
          }
          const { error: insertError } = await supabase
            .from('user_settings')
            .upsert(insertData as any, {
              onConflict: 'user_id'
            })
          
          if (insertError) {
            console.error('Failed to create default settings:', insertError)
          }
        } else {
          throw error
        }
      } else if (data) {
        const settingsData = data as UserSettings
        if (settingsData.preferences) {
          const preferences = settingsData.preferences as Record<string, any>
          if (preferences.task_auto_sync) {
            // Validate and sanitize importance_levels - remove any invalid values like 'critical'
            const loadedLevels = preferences.task_auto_sync.importance_levels || []
            const validLevels = Array.isArray(loadedLevels)
              ? loadedLevels.filter((level: string) => ['high', 'medium', 'low'].includes(level))
              : ['high', 'medium', 'low']
            
            // Ensure at least one level is selected
            const sanitizedLevels = validLevels.length > 0 ? validLevels : ['high', 'medium', 'low']
            
            setSettings({
              ...preferences.task_auto_sync,
              importance_levels: sanitizedLevels
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const loadPreviewCount = async () => {
    if (!user?.id || !settings.enabled) {
      setPreviewCount(0)
      return
    }

    setIsLoadingPreview(true)
    try {
      // Filter out invalid importance levels (only 'high', 'medium', 'low' are valid)
      const validImportanceLevels = settings.importance_levels.filter(
        level => ['high', 'medium', 'low'].includes(level)
      )
      
      if (validImportanceLevels.length === 0) {
        setPreviewCount(0)
        return
      }

      // Build query - handle single value case differently to avoid encoding issues
      let query = supabase
        .from('meeting_action_items')
        .select('id', { count: 'exact', head: true })
        .eq('synced_to_task', false)

      // Use .in() for multiple values, .eq() for single value
      if (validImportanceLevels.length === 1) {
        query = query.eq('importance', validImportanceLevels[0])
      } else {
        query = query.in('importance', validImportanceLevels)
      }

      // Add confidence threshold filter if applicable
      if (settings.confidence_threshold > 0) {
        query = query.gte('confidence_score', settings.confidence_threshold)
      }

      const { count, error } = await query

      if (error) {
        console.error('Preview count query error:', error)
        throw error
      }
      setPreviewCount(count || 0)
    } catch (error) {
      console.error('Failed to load preview:', error)
      setPreviewCount(0)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const saveSettings = async () => {
    if (!user?.id) return

    setIsSaving(true)
    try {
      // Filter out invalid importance levels before saving (ensure 'critical' is never included)
      const validImportanceLevels = settings.importance_levels.filter(
        level => ['high', 'medium', 'low'].includes(level)
      )
      
      // Ensure at least one valid level is selected
      if (validImportanceLevels.length === 0) {
        toast.error('Please select at least one importance level')
        setIsSaving(false)
        return
      }
      
      const settingsToSave = {
        ...settings,
        importance_levels: validImportanceLevels
      }

      // Get existing preferences to merge with
      const { data: existingData, error: fetchError } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      const existingPreferences = existingData 
        ? ((existingData as UserSettings).preferences as Record<string, any>)
        : {}

      const updateData: UserSettingsInsert = {
        user_id: user.id,
        preferences: {
          ...existingPreferences,
          task_auto_sync: settingsToSave
        },
        updated_at: new Date().toISOString()
      }

      // Use upsert with proper conflict handling
      const { error } = await supabase
        .from('user_settings')
        .upsert(updateData as any, {
          onConflict: 'user_id'
        })

      if (error) {
        // If upsert fails with conflict, try explicit update
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          const { error: updateError } = await (supabase
            .from('user_settings') as any)
            .update(updateData)
            .eq('user_id', user.id)
          
          if (updateError) throw updateError
        } else {
          throw error
        }
      }

      toast.success('Settings saved successfully')
    } catch (error: any) {
      console.error('Failed to save settings:', error)
      const errorMessage = error?.message || 'Failed to save settings'
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const toggleImportanceLevel = (level: string) => {
    // Only allow valid importance levels
    if (!['high', 'medium', 'low'].includes(level)) {
      console.warn(`Invalid importance level attempted: ${level}`)
      return
    }

    const newLevels = settings.importance_levels.includes(level)
      ? settings.importance_levels.filter(l => l !== level)
      : [...settings.importance_levels, level]

    // Ensure we always have at least one valid level
    const validNewLevels = newLevels.filter(l => ['high', 'medium', 'low'].includes(l))
    
    setSettings({ 
      ...settings, 
      importance_levels: validNewLevels.length > 0 ? validNewLevels : ['high', 'medium', 'low']
    })
  }

  const loadRecentMeetings = async () => {
    if (!user?.id) return

    setIsLoadingMeetings(true)
    try {
      // Load recent meetings that have action items
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          meeting_start,
          meeting_action_items!inner (
            id
          )
        `)
        .eq('owner_user_id', user.id)
        .order('meeting_start', { ascending: false })
        .limit(20)

      if (error) throw error

      // Deduplicate and format meetings
      interface MeetingWithActionItems {
        id: string
        title: string | null
        meeting_start: string | null
        meeting_action_items: Array<{ id: string }>
      }

      const uniqueMeetings = (data as MeetingWithActionItems[] | null)?.reduce((acc: Array<{
        id: string
        title: string | null
        meeting_start: string | null
        action_item_count: number
      }>, meeting) => {
        if (!acc.find(m => m.id === meeting.id)) {
          acc.push({
            id: meeting.id,
            title: meeting.title,
            meeting_start: meeting.meeting_start,
            action_item_count: (data as MeetingWithActionItems[]).filter(m => m.id === meeting.id).length
          })
        }
        return acc
      }, []) || []

      setRecentMeetings(uniqueMeetings)
    } catch (error) {
      console.error('Failed to load recent meetings:', error)
      toast.error('Failed to load meetings')
    } finally {
      setIsLoadingMeetings(false)
    }
  }

  const testSettingsAgainstMeeting = async () => {
    if (!user?.id || !selectedMeetingId) return

    setIsTestingSettings(true)
    try {
      // Load action items for selected meeting
      const { data: actionItems, error } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', selectedMeetingId)
        .order('importance', { ascending: false })

      if (error) throw error

      // Test each action item against current settings
      interface ActionItemWithExtras {
        id: string
        title: string
        description?: string | null
        importance?: 'high' | 'medium' | 'low' | null
        confidence_score?: number | null
        ai_confidence_score?: number | null
        [key: string]: any
      }

      const results = (actionItems as ActionItemWithExtras[] | null)?.map(item => {
        // Use confidence_score if available, otherwise fall back to ai_confidence_score
        const confidenceScore = item.confidence_score ?? item.ai_confidence_score ?? null
        const importanceMatch = settings.importance_levels.includes((item.importance || 'medium') as string)
        const confidenceMatch = !confidenceScore || confidenceScore >= settings.confidence_threshold
        const wouldSync = importanceMatch && confidenceMatch

        return {
          ...item,
          wouldSync,
          importanceMatch,
          confidenceMatch,
          confidence_score: confidenceScore
        }
      }) || []

      setTestResults(results)
    } catch (error) {
      console.error('Failed to test settings:', error)
      toast.error('Failed to test settings')
    } finally {
      setIsTestingSettings(false)
    }
  }

  const reanalyzeImportance = async () => {
    if (!user?.id || !selectedMeetingId || testResults.length === 0) return

    setIsReanalyzing(true)
    try {
      // Call edge function to re-analyze importance
      const { data, error } = await supabase.functions.invoke('reanalyze-action-item-importance', {
        body: {
          action_item_ids: testResults.map(r => r.id)
        }
      })

      if (error) throw error

      toast.success(`Re-analyzed ${data.updated_count} action items`)

      // Refresh test results to show new importance levels
      await testSettingsAgainstMeeting()
    } catch (error: any) {
      console.error('Failed to re-analyze importance:', error)
      toast.error(error.message || 'Failed to re-analyze importance')
    } finally {
      setIsReanalyzing(false)
    }
  }

  const getImportanceBadge = (importance: string) => {
    const colors = {
      critical: 'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100 font-bold',
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
    }
    const color = colors[importance as keyof typeof colors] || colors.medium
    return color
  }

  // Show loading state while auth is loading or settings are loading
  if (authLoading || !user?.id || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {authLoading || !user?.id ? 'Loading user data...' : 'Loading settings...'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Task Auto-Sync Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure which action items automatically create tasks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Sync Configuration</CardTitle>
          <CardDescription>
            Control which action items automatically create tasks based on their importance level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Auto-Sync */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 dark:text-gray-100">Enable Auto-Sync</p>
                {settings.enabled && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Automatically create tasks from action items based on importance
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              className="ml-4"
            />
          </div>

          {/* Importance Levels */}
          <div className="space-y-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Importance Levels</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select which importance levels should auto-create tasks
              </p>
            </div>
            <div className="space-y-2 ml-1">
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <Checkbox
                  checked={settings.importance_levels.includes('high')}
                  onCheckedChange={() => toggleImportanceLevel('high')}
                  disabled={!settings.enabled}
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-gray-100">High Importance (Critical)</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 rounded">
                    HIGH
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <Checkbox
                  checked={settings.importance_levels.includes('medium')}
                  onCheckedChange={() => toggleImportanceLevel('medium')}
                  disabled={!settings.enabled}
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-gray-100">Medium Importance</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 rounded">
                    MEDIUM
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <Checkbox
                  checked={settings.importance_levels.includes('low')}
                  onCheckedChange={() => toggleImportanceLevel('low')}
                  disabled={!settings.enabled}
                />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-gray-100">Low Importance</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded">
                    LOW
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Confidence Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900 dark:text-gray-100">Confidence Threshold</p>
              <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
                {Math.round(settings.confidence_threshold * 100)}%
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Only auto-sync action items with confidence score above this threshold
            </p>
            <div className="px-2">
              <Slider
                value={[settings.confidence_threshold * 100]}
                onValueChange={(value) => setSettings({ ...settings, confidence_threshold: value[0] / 100 })}
                min={70}
                max={100}
                step={5}
                disabled={!settings.enabled}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>70%</span>
                <span>85%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          {settings.enabled && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Preview: {isLoadingPreview ? (
                      <Loader2 className="w-4 h-4 inline animate-spin" />
                    ) : (
                      <span className="font-bold">{previewCount}</span>
                    )} action item{previewCount !== 1 ? 's' : ''} would auto-create tasks
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Based on your current settings and unsynced action items
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={saveSettings}
            disabled={isSaving || settings.importance_levels.length === 0}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>

          {settings.importance_levels.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              Please select at least one importance level
            </p>
          )}
        </CardContent>
      </Card>

      {/* Test Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TestTube2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <CardTitle>Test Your Settings</CardTitle>
          </div>
          <CardDescription>
            Select a meeting to see which action items would be auto-synced with your current settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 dark:text-blue-100">
                <strong>Note:</strong> Existing action items may not have importance levels assigned yet.
                New meetings will automatically have importance extracted by AI.
                Select all importance levels to see your existing action items in tests.
              </div>
            </div>
          </div>

          {/* Meeting Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Select a Meeting
            </label>
            <Select
              value={selectedMeetingId}
              onValueChange={setSelectedMeetingId}
              disabled={isLoadingMeetings || recentMeetings.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={
                  isLoadingMeetings ? "Loading meetings..." :
                  recentMeetings.length === 0 ? "No meetings with action items found" :
                  "Choose a meeting to test"
                } />
              </SelectTrigger>
              <SelectContent>
                {recentMeetings.map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id}>
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="truncate">{meeting.title || 'Untitled Meeting'}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(meeting.meeting_start).toLocaleDateString()}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Test Results */}
          {isTestingSettings && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          )}

          {!isTestingSettings && testResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Test Results
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      {testResults.filter(r => r.wouldSync).length} would sync
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-gray-400" />
                      {testResults.filter(r => !r.wouldSync).length} would not sync
                    </span>
                  </div>
                  <Button
                    onClick={reanalyzeImportance}
                    disabled={isReanalyzing}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    {isReanalyzing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Re-analyzing...
                      </>
                    ) : (
                      <>
                        <TestTube2 className="w-3 h-3 mr-1" />
                        Re-analyze Importance
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.map((result) => (
                  <div
                    key={result.id}
                    className={`
                      p-3 rounded-lg border
                      ${result.wouldSync
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                        : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Sync Indicator */}
                      {result.wouldSync ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {result.title}
                        </p>
                        {result.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {result.description}
                          </p>
                        )}

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs ${getImportanceBadge(result.importance || 'medium')}`}>
                            {(result.importance || 'medium').toUpperCase()}
                          </Badge>
                          {result.confidence_score && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(result.confidence_score * 100)}% confidence
                            </Badge>
                          )}
                          {!result.importanceMatch && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Importance not selected
                            </Badge>
                          )}
                          {!result.confidenceMatch && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Below confidence threshold
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <p className="text-sm text-purple-900 dark:text-purple-100">
                  <strong>{testResults.filter(r => r.wouldSync).length} of {testResults.length} action items</strong> would be automatically converted to tasks with your current settings.
                </p>
              </div>
            </div>
          )}

          {!isTestingSettings && selectedMeetingId && testResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No action items found for this meeting</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>How Auto-Sync Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong className="text-gray-900 dark:text-gray-100">Automatic Mode:</strong> When enabled, action items matching your importance levels will automatically create tasks.
          </p>
          <p>
            <strong className="text-gray-900 dark:text-gray-100">Manual Mode:</strong> You can always manually select and convert action items to tasks from the meeting detail page, regardless of these settings.
          </p>
          <p>
            <strong className="text-gray-900 dark:text-gray-100">Importance Levels:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Critical:</strong> Mission-critical tasks, contract deadlines, executive requests, immediate escalations</li>
            <li><strong>High:</strong> Important commitments, urgent tasks, key deliverables, tight deadlines</li>
            <li><strong>Medium:</strong> Standard follow-ups, routine tasks, moderate urgency, regular check-ins</li>
            <li><strong>Low:</strong> Optional tasks, exploratory items, low priority, nice-to-have actions</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default TaskSyncSettings

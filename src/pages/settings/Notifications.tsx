import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/clientV2'
import { SlackConnectionButton } from '@/components/SlackConnectionButton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type SlackDelivery = 'dm' | 'channel'

export default function NotificationsSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [inAppEnabled, setInAppEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [slackEnabled, setSlackEnabled] = useState(false)
  const [slackDelivery, setSlackDelivery] = useState<SlackDelivery>('dm')
  const [slackChannelId, setSlackChannelId] = useState('')
  const [slackUserId, setSlackUserId] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }
        setUserId(user.id)

        const { data: settings } = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .single()

        const prefs = (settings?.preferences || {}) as any
        const notif = prefs.notifications || {}
        setInAppEnabled(!!notif.in_app_enabled)
        setEmailEnabled(!!notif.email_enabled)
        setSlackEnabled(!!notif.slack_enabled)
        setSlackDelivery((notif.slack_delivery || 'dm') as SlackDelivery)
        setSlackChannelId(notif.slack_channel_id || '')
        setSlackUserId(notif.slack_user_id || '')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const save = async () => {
    if (!userId) return
    setSaving(true)
    try {
      // Upsert user_settings row and merge preferences
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id, preferences')
        .eq('user_id', userId)
        .single()

      const prefs = existing?.preferences || {}
      const nextPrefs = {
        ...prefs,
        notifications: {
          in_app_enabled: inAppEnabled,
          email_enabled: emailEnabled,
          slack_enabled: slackEnabled,
          slack_delivery: slackDelivery,
          slack_channel_id: slackChannelId || null,
          slack_user_id: slackUserId || null,
        }
      }

      const upsertPayload = {
        user_id: userId,
        preferences: nextPrefs
      }

      const { error } = existing
        ? await supabase.from('user_settings').update(upsertPayload).eq('id', existing.id)
        : await supabase.from('user_settings').insert(upsertPayload)

      if (error) throw error
      toast.success('Notification preferences saved')
    } catch (e) {
      console.error('[NotificationsSettings] Save error:', e)
      toast.error(e instanceof Error ? e.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="h-8 w-48 bg-zinc-800 animate-pulse rounded mb-4" />
        <div className="h-40 bg-zinc-900 animate-pulse rounded" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">In-app notifications</div>
            <div className="text-sm text-muted-foreground">Show notifications inside the app</div>
          </div>
          <Switch checked={inAppEnabled} onCheckedChange={setInAppEnabled} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Email notifications</div>
            <div className="text-sm text-muted-foreground">Send emails for task updates</div>
          </div>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Slack notifications</div>
            <div className="text-sm text-muted-foreground">Send notifications to Slack</div>
          </div>
          <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
        </div>

        <SlackConnectionButton className="mt-2" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium mb-1">Delivery</div>
            <Select value={slackDelivery} onValueChange={(v) => setSlackDelivery(v as SlackDelivery)}>
              <SelectTrigger>
                <SelectValue placeholder="Select delivery" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dm">Direct message</SelectItem>
                <SelectItem value="channel">Channel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {slackDelivery === 'channel' ? (
            <div>
              <div className="text-sm font-medium mb-1">Channel ID</div>
              <Input value={slackChannelId} onChange={(e) => setSlackChannelId(e.target.value)} placeholder="e.g. C0123456789" />
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium mb-1">Slack User ID</div>
              <Input value={slackUserId} onChange={(e) => setSlackUserId(e.target.value)} placeholder="e.g. U0123456789" />
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Preferences'}</Button>
      </div>
    </div>
  )
}



import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Save, AlertCircle, Video, Users } from 'lucide-react';
import { FathomSettings } from '@/components/integrations/FathomSettings';
import { FathomSelfMapping } from '@/components/settings/FathomSelfMapping';
import { FathomUserMapping } from '@/components/settings/FathomUserMapping';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { useOrgStore } from '@/lib/stores/orgStore';

export default function MeetingSyncPage() {
  const [autoMeetingEnabled, setAutoMeetingEnabled] = useState(false);
  const [autoMeetingFromDate, setAutoMeetingFromDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { isConnected: isFathomConnected } = useFathomIntegration();
  const activeOrgRole = useOrgStore((s) => s.activeOrgRole);
  const isAdmin = activeOrgRole === 'owner' || activeOrgRole === 'admin';

  // Load existing auto meeting sync preference
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('user_settings')
          .select('preferences')
          .eq('user_id', user.id)
          .single();

        const pref = (data?.preferences || {}) as any;
        const auto = pref.auto_fathom_activity || {};
        setAutoMeetingEnabled(!!auto.enabled);
        setAutoMeetingFromDate(typeof auto.from_date === 'string' ? auto.from_date : '');
      } catch (e) {
        console.error('Error loading meeting sync settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      const existingPrefs = (existingSettings?.preferences || {}) as any;
      const nextPrefs = {
        ...existingPrefs,
        auto_fathom_activity: {
          enabled: autoMeetingEnabled,
          from_date: autoMeetingEnabled
            ? (autoMeetingFromDate || new Date().toISOString().slice(0, 10))
            : null
        }
      };

      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, preferences: nextPrefs }, { onConflict: 'user_id' });

      toast.success('Meeting sync settings saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
      console.error('Error saving meeting sync settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsPageWrapper
        title="Meeting Sync"
        description="Automatically log meetings as activities"
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper
      title="Meeting Sync"
      description="Connect Fathom and configure automatic meeting sync"
    >
      <div className="space-y-6">
        {/* Fathom Connection Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fathom Integration</h2>
          <FathomSettings />
        </div>

        {/* Fathom User Mapping Section - Only show when connected */}
        {isFathomConnected && (
          <>
            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Mapping
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Link Fathom users to Sixty accounts so meetings are correctly attributed to the right person.
              </p>
            </div>

            {/* Personal Fathom Mapping - For all users */}
            <FathomSelfMapping />

            {/* Org-wide User Mapping - Admin only */}
            {isAdmin && (
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">Team User Mapping</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    As an admin, you can map any Fathom user to a Sixty team member. This ensures all synced meetings are attributed to the correct owners.
                  </p>
                </div>
                <FathomUserMapping />
              </div>
            )}
          </>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Auto-Log Settings</h2>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">How it works</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                When enabled, meetings from Fathom, Fireflies, and other integrated platforms will automatically
                be logged as activities in your CRM. Only meetings from the day you enable this feature onward
                will be synced.
              </p>
            </div>
          </div>
        </div>

        {/* Supported Integrations */}
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Video className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Supported Platforms</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  Fathom
                </span>
                <span className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  Fireflies
                </span>
                <span className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  More coming soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-log Toggle */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-white">
              Auto-log new meetings as activities
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Automatically create activities for meetings from connected platforms
            </div>
          </div>
          <Switch
            checked={autoMeetingEnabled}
            onCheckedChange={setAutoMeetingEnabled}
          />
        </div>

        {/* Start Date Field */}
        {autoMeetingEnabled && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Start date
            </label>
            <input
              type="date"
              value={autoMeetingFromDate || ''}
              onChange={(e) => setAutoMeetingFromDate(e.target.value)}
              className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-all duration-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Meetings from this date forward will be automatically logged as activities
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#37bd7e] hover:bg-[#2da76c]"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </SettingsPageWrapper>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, X, Loader2, Moon, Sun, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { type BrandingSettings } from '@/lib/hooks/useBrandingSettings';
import logger from '@/lib/utils/logger';

const GLOBAL_SETTINGS_ID = '00000000-0000-0000-0000-000000000000';

export default function LogoSettings() {
  const { activeOrg, permissions } = useOrg();
  const { userData } = useUser();
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{
    lightLogo: boolean;
    darkLogo: boolean;
    icon: boolean;
  }>({
    lightLogo: false,
    darkLogo: false,
    icon: false,
  });

  const isGlobalAdmin = isUserAdmin(userData);
  const canManageOrgBranding = permissions.canManageSettings;
  const canManage = canManageOrgBranding || isGlobalAdmin;

  // Determine which settings to manage: org-specific or global
  const useOrgSettings = activeOrg && canManageOrgBranding;
  const settingsOrgId = useOrgSettings ? activeOrg.id : null;

  // Load settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      if (settingsOrgId) {
        // Load org-specific settings
        const { data, error } = await supabase
          .from('branding_settings')
          .select('*')
          .eq('org_id', settingsOrgId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          logger.error('[LogoSettings] Org settings load error:', error);
        }
        setSettings(data || null);
      } else {
        // Load global settings
        const { data, error } = await supabase
          .from('branding_settings')
          .select('*')
          .is('org_id', null)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          logger.error('[LogoSettings] Global settings load error:', error);
        }
        setSettings(data || null);
      }
    } catch (error) {
      logger.error('[LogoSettings] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [settingsOrgId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateFavicon = useCallback((iconUrl: string) => {
    const existingLinks = document.querySelectorAll('link[rel*="icon"]:not([rel*="manifest"])');
    existingLinks.forEach((link) => link.remove());

    const sizes = ['16x16', '32x32', '64x64', '128x128'];
    sizes.forEach((size) => {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.sizes = size;
      link.href = iconUrl;
      document.head.appendChild(link);
    });

    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = iconUrl;
    document.head.appendChild(appleLink);
  }, []);

  useEffect(() => {
    if (settings?.icon_url) {
      updateFavicon(settings.icon_url);
    }
  }, [settings?.icon_url, updateFavicon]);

  const ensureSettingsExist = async (): Promise<string | null> => {
    if (settings?.id) return settings.id;

    try {
      if (settingsOrgId) {
        // Create org-specific settings
        const { data, error } = await supabase
          .from('branding_settings')
          .insert({
            org_id: settingsOrgId,
            logo_light_url: null,
            logo_dark_url: null,
            icon_url: null,
          })
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        return data.id;
      } else {
        // Create/update global settings
        const { data, error } = await supabase
          .from('branding_settings')
          .upsert({
            id: GLOBAL_SETTINGS_ID,
            org_id: null,
            logo_light_url: null,
            logo_dark_url: null,
            icon_url: null,
          }, { onConflict: 'id' })
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        return data.id;
      }
    } catch (error) {
      logger.error('[LogoSettings] Error creating settings:', error);
      throw error;
    }
  };

  const handleFileUpload = async (
    file: File,
    type: 'lightLogo' | 'darkLogo' | 'icon'
  ) => {
    if (!canManage) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPEG, SVG, GIF, or WebP)');
      return;
    }

    const maxSize = type === 'icon' ? 500 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${type === 'icon' ? '500KB' : '2MB'}`);
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [type]: true }));

      const settingsId = await ensureSettingsExist();
      if (!settingsId) {
        throw new Error('Failed to create branding settings');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${settingsOrgId || 'global'}-${Date.now()}.${fileExt}`;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const { data, error: uploadError } = await supabase.functions.invoke('upload-branding-logo', {
        body: {
          image_data: base64Data,
          file_name: fileName,
          type: type,
        },
      });

      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed');
      }

      if (!data?.success || !data?.url) {
        throw new Error('Upload failed: No URL returned');
      }

      const publicUrl = data.url;

      const updateField =
        type === 'lightLogo' ? 'logo_light_url' :
        type === 'darkLogo' ? 'logo_dark_url' :
        'icon_url';

      console.log('[LogoSettings] Updating database:', { settingsId, updateField, publicUrl });

      const { data: updateData, error: updateError } = await supabase
        .from('branding_settings')
        .update({ [updateField]: publicUrl })
        .eq('id', settingsId)
        .select();

      console.log('[LogoSettings] Update result:', { updateData, updateError });

      if (updateError) throw updateError;

      if (!updateData || updateData.length === 0) {
        console.error('[LogoSettings] No rows updated - likely RLS policy issue');
        throw new Error('Update failed - no rows affected. Check RLS policies.');
      }

      setSettings((prev) => prev ? { ...prev, [updateField]: publicUrl } : null);

      if (type === 'icon') {
        updateFavicon(publicUrl);
      }

      // Dispatch event to notify AppLayout to refresh branding
      window.dispatchEvent(new CustomEvent('branding-updated'));

      toast.success(`${type === 'icon' ? 'Icon' : 'Logo'} uploaded successfully`);
    } catch (error) {
      logger.error('[LogoSettings] Upload error:', error);
      toast.error(`Failed to upload ${type === 'icon' ? 'icon' : 'logo'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleRemove = async (type: 'lightLogo' | 'darkLogo' | 'icon') => {
    if (!canManage || !settings) return;

    try {
      const updateField =
        type === 'lightLogo' ? 'logo_light_url' :
        type === 'darkLogo' ? 'logo_dark_url' :
        'icon_url';

      const { error } = await supabase
        .from('branding_settings')
        .update({ [updateField]: null })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings((prev) => prev ? { ...prev, [updateField]: null } : null);

      if (type === 'icon') {
        const defaultFavicon = '/favicon_0_32x32.png';
        updateFavicon(defaultFavicon);
      }

      toast.success(`${type === 'icon' ? 'Icon' : 'Logo'} removed`);
    } catch (error) {
      logger.error('[LogoSettings] Remove error:', error);
      toast.error(`Failed to remove ${type === 'icon' ? 'icon' : 'logo'}`);
    }
  };

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              You need admin permissions to manage logo settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#37bd7e]" />
        </div>
      </div>
    );
  }

  const scopeLabel = useOrgSettings ? activeOrg.name : 'Global';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Logo Settings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Customize logos and favicon for {scopeLabel}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Light Mode Logo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-yellow-500" />
              <CardTitle className="text-base">Light Mode Logo</CardTitle>
            </div>
            <CardDescription>
              Logo displayed in light mode (recommended: PNG with transparent background, max 2MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.logo_light_url ? (
              <div className="relative">
                <img
                  src={settings.logo_light_url}
                  alt="Light mode logo"
                  className="w-full h-24 object-contain bg-white border border-gray-200 rounded-lg p-4"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleRemove('lightLogo')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No logo uploaded</p>
              </div>
            )}
            <FileUploadButton
              onUpload={(file) => handleFileUpload(file, 'lightLogo')}
              disabled={uploading.lightLogo}
              uploading={uploading.lightLogo}
            />
          </CardContent>
        </Card>

        {/* Dark Mode Logo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base">Dark Mode Logo</CardTitle>
            </div>
            <CardDescription>
              Logo displayed in dark mode (recommended: PNG with transparent background, max 2MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.logo_dark_url ? (
              <div className="relative">
                <img
                  src={settings.logo_dark_url}
                  alt="Dark mode logo"
                  className="w-full h-24 object-contain bg-gray-900 border border-gray-700 rounded-lg p-4"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => handleRemove('darkLogo')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No logo uploaded</p>
              </div>
            )}
            <FileUploadButton
              onUpload={(file) => handleFileUpload(file, 'darkLogo')}
              disabled={uploading.darkLogo}
              uploading={uploading.darkLogo}
            />
          </CardContent>
        </Card>

        {/* Icon/Favicon */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">Icon & Favicon</CardTitle>
            </div>
            <CardDescription>
              Icon displayed as favicon and in collapsed menu (recommended: 32x32 or 64x64 PNG, max 500KB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings?.icon_url ? (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={settings.icon_url}
                    alt="Icon"
                    className="w-16 h-16 object-contain border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-2 -right-2"
                    onClick={() => handleRemove('icon')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This icon appears as the favicon in browser tabs and when the sidebar is collapsed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No icon uploaded</p>
              </div>
            )}
            <FileUploadButton
              onUpload={(file) => handleFileUpload(file, 'icon')}
              disabled={uploading.icon}
              uploading={uploading.icon}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-sm">Storage Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Logos are uploaded to S3 in the <code className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs">logos</code> bucket.
            {useOrgSettings
              ? ' These logos are specific to your organization and will be visible to all team members.'
              : ' These are global logos that will be used as defaults.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface FileUploadButtonProps {
  onUpload: (file: File) => void;
  disabled: boolean;
  uploading: boolean;
}

function FileUploadButton({ onUpload, disabled, uploading }: FileUploadButtonProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = '';
  };

  return (
    <label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/gif,image/webp"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="w-full"
        asChild
      >
        <span>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </>
          )}
        </span>
      </Button>
    </label>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/hooks/useUser';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { Camera, Save, Lock, UserCog, Link2, History, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

export default function Profile() {
  const navigate = useNavigate();
  const { userData, isLoading: userLoading } = useUser();
  const { user, userProfile, updatePassword } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Debug logging
  useEffect(() => {
    logger.log('Profile page mounted:', { 
      userData, 
      userProfile,
      user,
      userLoading 
    });
  }, [userData, userProfile, user, userLoading]);

  // Update form data when user data is loaded
  useEffect(() => {
    // Use userProfile from AuthContext if userData from useUser is not available
    const profileData = userData || userProfile;
    
    if (profileData) {
      logger.log('Setting form data from profile:', profileData);
      setFormData(prev => ({
        ...prev,
        firstName: profileData.first_name || '',
        lastName: profileData.last_name || '',
        email: profileData.email || ''
      }));
    }
  }, [userData, userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const updates = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email
    };

    try {
      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        email: formData.email,
        data: { full_name: `${formData.firstName} ${formData.lastName}` }
      });

      if (authError) throw authError;

      // Update profile record if we have a user ID
      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: `${formData.firstName} ${formData.lastName}`,
            username: formData.email // or whatever field maps to email
          })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await updatePassword(formData.newPassword);
      if (error) throw new Error(error.message);
      toast.success('Password updated successfully');
      setIsPasswordModalOpen(false);
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const fileType = file.type.toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(fileType)) {
        toast.error('Please upload a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      setUploading(true);
      
      // Create a simple file upload (you can enhance this later)
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile with new avatar URL
      if (user?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);
          
        if (updateError) throw updateError;
      }
      
      toast.success('Profile picture updated successfully');
    } catch (error) {
      toast.error('Upload failed');
      logger.error('[Profile]', error);
      setUploading(false);
    }
  };

  // Show loading state while user data is loading
  if (userLoading) {
    return (
      <div className="p-4 sm:p-8 mt-12 lg:mt-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 mt-12 lg:mt-0">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-gray-400 mt-1">Manage your account settings and preferences</p>
        </div>

        {/* Profile Form */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden">
          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#37bd7e]/20 border-2 border-[#37bd7e]/30 group-hover:border-[#37bd7e]/50 transition-all duration-300">
                  {(userData?.avatar_url || userProfile?.avatar_url) ? (
                    <img
                      src={userData?.avatar_url || userProfile?.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-medium text-[#37bd7e]">
                        {formData.firstName?.[0] || 'A'}{formData.lastName?.[0] || 'B'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploading ? (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="profile-picture"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </div>
              <label
                htmlFor="profile-picture"
                className={`text-sm text-[#37bd7e] hover:text-[#2da76c] cursor-pointer ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading ? 'Uploading...' : 'Change Picture'}
              </label>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                />
              </div>
            </div>

            {/* Password Section */}
            <div className="pt-6 border-t border-gray-800/50">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800/50 text-white hover:bg-[#37bd7e]/20 transition-all duration-300 border border-gray-700/50 hover:border-[#37bd7e]/50"
              >
                <Lock className="w-4 h-4" />
                Change Password
              </button>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#37bd7e] text-white hover:bg-[#2da76c] transition-colors"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Links Section */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">Quick Links</h2>
            <div className="space-y-2">
              {/* Admin Section - Only show if user is admin */}
              {userData?.is_admin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <UserCog className="w-5 h-5 text-[#37bd7e]" />
                    <div className="text-left">
                      <p className="font-medium">Admin Dashboard</p>
                      <p className="text-sm text-gray-400">Manage users, permissions, and system settings</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </button>
              )}

              {/* Integrations */}
              <button
                onClick={() => navigate('/integrations')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-[#37bd7e]" />
                  <div className="text-left">
                    <p className="font-medium">Integrations</p>
                    <p className="text-sm text-gray-400">Connect with Google, Fathom, and other services</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </button>

              {/* Releases */}
              <button
                onClick={() => navigate('/releases')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-[#37bd7e]" />
                  <div className="text-left">
                    <p className="font-medium">Release Notes</p>
                    <p className="text-sm text-gray-400">See what's new and upcoming features</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
        </div>

        {/* Password Change Modal */}
        {isPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setIsPasswordModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900/95 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Change Password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-gray-800/50 text-gray-300 hover:bg-gray-800 transition-colors border border-gray-700/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-[#37bd7e] text-white hover:bg-[#2da76c] transition-colors"
                  >
                    {isLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
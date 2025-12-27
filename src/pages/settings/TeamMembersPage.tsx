import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import { useState, useEffect } from 'react';
import { Users, Trash2, Loader2, AlertCircle, UserPlus, Mail, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import {
  createInvitation,
  getOrgInvitations,
  revokeInvitation,
  resendInvitation,
  type Invitation,
} from '@/lib/services/invitationService';
import { toast } from 'sonner';

interface TeamMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  created_at: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  readonly: 'View Only',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30',
  admin: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
  member: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30',
  readonly: 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-gray-500/30',
};

export default function TeamMembersPage() {
  const { activeOrgId, permissions } = useOrg();
  const { user } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);

  // Invite form state
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'member'>('member');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Load team members
  useEffect(() => {
    if (!activeOrgId) return;

    const loadMembers = async () => {
      setIsLoadingMembers(true);
      try {
        // Fetch memberships first
        const { data: memberships, error: membershipError } = await supabase
          .from('organization_memberships')
          .select('user_id, role, created_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true });

        if (membershipError) throw membershipError;
        if (!memberships?.length) {
          setMembers([]);
          return;
        }

        // Fetch profiles for all member user_ids
        const userIds = memberships.map((m) => m.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (profileError) throw profileError;

        // Create a lookup map for profiles
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Transform to expected format with user object
        const membersWithProfiles = memberships.map((m) => ({
          user_id: m.user_id,
          role: m.role as 'owner' | 'admin' | 'member' | 'readonly',
          created_at: m.created_at,
          user: profileMap.get(m.user_id) || null,
        }));

        setMembers(membersWithProfiles);
      } catch (err: any) {
        console.error('Error loading members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembers();
  }, [activeOrgId]);

  // Load invitations
  useEffect(() => {
    if (!activeOrgId) return;

    const loadInvitations = async () => {
      setIsLoadingInvites(true);
      const { data, error } = await getOrgInvitations(activeOrgId);
      if (error) {
        console.error('Error loading invitations:', error);
      } else {
        setInvitations(data || []);
      }
      setIsLoadingInvites(false);
    };

    loadInvitations();
  }, [activeOrgId]);

  // Handle sending invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !newInviteEmail.trim()) return;

    setIsSendingInvite(true);
    const { data, error } = await createInvitation({
      orgId: activeOrgId,
      email: newInviteEmail.trim(),
      role: newInviteRole,
    });

    if (error) {
      toast.error(error);
    } else if (data) {
      toast.success(`Invitation sent to ${newInviteEmail}`);
      setInvitations([data, ...invitations]);
      setNewInviteEmail('');
      setNewInviteRole('member');
    }
    setIsSendingInvite(false);
  };

  // Handle revoking invitation
  const handleRevokeInvite = async (inviteId: string) => {
    const { success, error } = await revokeInvitation(inviteId);
    if (success) {
      toast.success('Invitation revoked');
      setInvitations(invitations.filter((inv) => inv.id !== inviteId));
    } else {
      toast.error(error || 'Failed to revoke invitation');
    }
  };

  // Handle resending invitation
  const handleResendInvite = async (inviteId: string) => {
    const { data, error } = await resendInvitation(inviteId);
    if (data) {
      toast.success('Invitation resent');
      setInvitations(invitations.map((inv) => (inv.id === inviteId ? data : inv)));
    } else {
      toast.error(error || 'Failed to resend invitation');
    }
  };

  // Handle removing member
  const handleRemoveMember = async (userId: string) => {
    if (!activeOrgId) return;

    // Prevent removing self or owner
    if (userId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }

    const member = members.find((m) => m.user_id === userId);
    if (member?.role === 'owner') {
      toast.error("You can't remove the organization owner");
      return;
    }

    try {
      const { error } = await supabase
        .from('organization_memberships')
        .delete()
        .eq('org_id', activeOrgId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Member removed');
      setMembers(members.filter((m) => m.user_id !== userId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  // Handle changing member role
  const handleChangeRole = async (userId: string, newRole: 'admin' | 'member' | 'readonly') => {
    if (!activeOrgId) return;

    try {
      const response = await (supabase
        .from('organization_memberships') as any)
        .update({ role: newRole })
        .eq('org_id', activeOrgId)
        .eq('user_id', userId) as { error: any };

      if (response.error) throw response.error;

      toast.success('Role updated');
      setMembers(
        members.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  if (!activeOrgId) {
    return (
      <SettingsPageWrapper
        title="Team Members"
        description="Manage team members and invitations"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No organization selected</p>
          </div>
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper
      title="Team Members"
      description="Manage team members and invitations"
    >
      <div className="space-y-8">
        {/* Team Members List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#37bd7e]" />
            Team Members
          </h2>
          {isLoadingMembers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-900 dark:text-white font-medium">
                          {member.user?.full_name?.[0] || member.user?.email?.[0] || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {member.user?.full_name || 'Unknown User'}
                          {member.user_id === user?.id && (
                            <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">(you)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{member.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {permissions.canManageTeam && member.role !== 'owner' && member.user_id !== user?.id ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleChangeRole(member.user_id, e.target.value as 'admin' | 'member' | 'readonly')
                          }
                          className="bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="readonly">View Only</option>
                        </select>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${roleColors[member.role]}`}
                        >
                          {roleLabels[member.role]}
                        </span>
                      )}
                      {permissions.canManageTeam && member.role !== 'owner' && member.user_id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Invite New Members */}
        {permissions.canManageTeam && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#37bd7e]" />
              Invite Team Members
            </h2>
            <form onSubmit={handleSendInvite} className="flex gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-gray-400" />
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  disabled={isSendingInvite}
                  className="w-full bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent disabled:opacity-50"
                />
              </div>
              <select
                value={newInviteRole}
                onChange={(e) => setNewInviteRole(e.target.value as 'admin' | 'member')}
                disabled={isSendingInvite}
                className="bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl px-3 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent disabled:opacity-50"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <Button
                type="submit"
                disabled={isSendingInvite || !newInviteEmail.trim()}
                className="bg-[#37bd7e] hover:bg-[#2da76c]"
              >
                {isSendingInvite ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Send Invite'
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Pending Invitations */}
        {permissions.canManageTeam && invitations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#37bd7e]" />
              Pending Invitations
            </h2>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700/50 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-900 dark:text-white">{invite.email}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${roleColors[invite.role]}`}
                      >
                        {roleLabels[invite.role]}
                      </span>
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-[#37bd7e] transition-colors"
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Revoke invitation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsPageWrapper>
  );
}

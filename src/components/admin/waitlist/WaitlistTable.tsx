import { useState } from 'react';
import { Check, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { useWaitlistAdmin } from '@/lib/hooks/useWaitlistAdmin';

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  isLoading: boolean;
  onRefresh: () => void;
  adminUserId: string;
}

export function WaitlistTable({ entries, isLoading, onRefresh, adminUserId }: WaitlistTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  // Admin hook takes optional filters (not admin user id)
  const adminHook = useWaitlistAdmin();

  // Filter entries based on search
  const filteredEntries = entries.filter(entry =>
    entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.company_name && entry.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (entry.invite_code_used && entry.invite_code_used.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRelease = async (id: string) => {
    try {
      await adminHook.releaseUser(id);
      onRefresh();
    } catch {
      // toast handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await adminHook.deleteEntry(id);
        onRefresh();
      } catch {
        // toast handled in hook
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
      {/* Header with Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Company</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tools</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Referrals</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invite Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No entries found
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    #{entry.effective_position || entry.signup_position}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{entry.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.company_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="text-xs space-y-1">
                      {entry.dialer_tool && <div>📞 {entry.dialer_tool}</div>}
                      {entry.meeting_recorder_tool && <div>🎙️ {entry.meeting_recorder_tool}</div>}
                      {entry.crm_tool && <div>📊 {entry.crm_tool}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {entry.referral_count}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {entry.invite_code_used ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                        entry.invite_code_used === 'SIXTY60'
                          ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                          : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      }`}>
                        {entry.invite_code_used}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        entry.status === 'pending'
                          ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20'
                          : entry.status === 'released'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                          : 'bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {entry.status === 'pending' && (
                        <Button
                          onClick={() => handleRelease(entry.id)}
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDelete(entry.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

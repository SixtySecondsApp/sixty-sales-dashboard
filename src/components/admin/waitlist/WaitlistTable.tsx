import { useState } from 'react';
import { Check, X, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WaitlistEntry } from '@/lib/types/waitlist';

interface WaitlistTableProps {
  entries: WaitlistEntry[];
  isLoading: boolean;
  onRelease: (id: string, notes?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
}

export function WaitlistTable({ entries, isLoading, onRelease, onDelete, onExport }: WaitlistTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter entries based on search
  const filteredEntries = entries.filter(entry =>
    entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md bg-white/5 border-white/10 text-white"
          />
          <Button
            onClick={onExport}
            variant="outline"
            className="border-white/10 hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-sm font-medium text-gray-400">#</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Email</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Company</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Tools</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Referrals</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No entries found
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    #{entry.effective_position}
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{entry.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{entry.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{entry.company_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    <div className="text-xs space-y-1">
                      {entry.dialer_tool && <div>📞 {entry.dialer_tool}</div>}
                      {entry.meeting_recorder_tool && <div>🎙️ {entry.meeting_recorder_tool}</div>}
                      {entry.crm_tool && <div>📊 {entry.crm_tool}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    {entry.referral_count}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entry.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : entry.status === 'released'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {entry.status === 'pending' && (
                        <Button
                          onClick={() => onRelease(entry.id)}
                          size="sm"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this entry?')) {
                            onDelete(entry.id);
                          }
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

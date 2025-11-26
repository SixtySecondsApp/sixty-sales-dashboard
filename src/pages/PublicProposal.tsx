import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2, Lock, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Proposal {
  id: string;
  title: string;
  content: string;
  type: string;
  password_hash: string | null;
  share_views: number;
}

export function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (token) {
      fetchProposal();
    }
  }, [token]);

  const fetchProposal = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch proposal by share token
      const { data, error: fetchError } = await supabase
        .from('proposals')
        .select('id, title, content, type, password_hash, share_views')
        .eq('share_token', token)
        .eq('is_public', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Proposal not found or link has expired.');
        } else {
          setError('Failed to load proposal.');
        }
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Proposal not found.');
        setLoading(false);
        return;
      }

      setProposal(data);

      // Check if password is required
      if (data.password_hash) {
        setPasswordRequired(true);
      } else {
        // No password - increment view count and show content
        setUnlocked(true);
        incrementViews();
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const incrementViews = async () => {
    if (!token) return;
    try {
      await supabase.rpc('increment_proposal_views', { p_share_token: token });
    } catch (err) {
      console.error('Failed to increment views:', err);
    }
  };

  const verifyPassword = async () => {
    if (!password.trim()) {
      setPasswordError('Please enter a password.');
      return;
    }

    setVerifying(true);
    setPasswordError(null);

    try {
      // Call edge function to verify password
      const { data, error: verifyError } = await supabase.functions.invoke('verify-proposal-password', {
        body: { share_token: token, password }
      });

      if (verifyError || !data?.success) {
        setPasswordError(data?.error || 'Incorrect password.');
        setVerifying(false);
        return;
      }

      // Password verified - show content
      setUnlocked(true);
      incrementViews();
    } catch (err) {
      setPasswordError('Failed to verify password.');
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyPassword();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Unable to Load Proposal</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (passwordRequired && !unlocked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="max-w-md w-full px-6">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-gray-800">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">
                {proposal?.title || 'Protected Proposal'}
              </h1>
              <p className="text-gray-400 text-sm">
                This proposal is password protected. Enter the password to view.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-red-400 text-sm mt-2">{passwordError}</p>
                )}
              </div>

              <Button
                onClick={verifyPassword}
                disabled={verifying}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    View Proposal
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-center text-gray-500 text-xs mt-6">
            Powered by Sixty Seconds
          </p>
        </div>
      </div>
    );
  }

  // Show the proposal content
  if (proposal && unlocked) {
    if (proposal.type === 'proposal') {
      // HTML proposal - render in full page
      return (
        <iframe
          srcDoc={proposal.content}
          className="w-full h-screen border-0"
          title={proposal.title || 'Proposal'}
          sandbox="allow-same-origin allow-scripts"
        />
      );
    } else {
      // SOW or Goals - render as markdown/text
      return (
        <div className="min-h-screen bg-gray-950 py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-gray-800">
              <h1 className="text-2xl font-bold text-white mb-6">
                {proposal.title || 'Document'}
              </h1>
              <div className="prose prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-gray-300">
                  {proposal.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  return null;
}

export default PublicProposal;

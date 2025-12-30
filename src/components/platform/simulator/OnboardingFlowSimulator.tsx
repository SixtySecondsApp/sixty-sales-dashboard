/**
 * OnboardingFlowSimulator - Interactive walkthrough of the onboarding experience
 *
 * Allows platform admins to experience the complete onboarding flow
 * without creating any real data. All inputs are simulated.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RotateCcw,
  Video,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Building2,
  Check,
  Users,
  Plus,
  Mail,
  X,
  UserPlus,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SimulationStep = 'idle' | 'welcome' | 'org_setup' | 'team_invite' | 'fathom_connect' | 'complete';

interface SimulatedInvite {
  id: string;
  email: string;
  role: 'admin' | 'member';
}

export function OnboardingFlowSimulator() {
  const [currentStep, setCurrentStep] = useState<SimulationStep>('idle');
  const [stepIndex, setStepIndex] = useState(0);

  // Simulated form state
  const [orgName, setOrgName] = useState('Acme Sales Team');
  const [showJoinOption, setShowJoinOption] = useState(false);
  const [selectedOrgOption, setSelectedOrgOption] = useState<'join' | 'create' | null>(null);
  const [invites, setInvites] = useState<SimulatedInvite[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [fathomConnected, setFathomConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const steps: SimulationStep[] = ['welcome', 'org_setup', 'team_invite', 'fathom_connect', 'complete'];
  const stepLabels = ['Welcome', 'Team Setup', 'Invite', 'Fathom', 'Complete'];

  const startSimulation = () => {
    setCurrentStep('welcome');
    setStepIndex(0);
    resetFormState();
  };

  const resetFormState = () => {
    setOrgName('Acme Sales Team');
    setShowJoinOption(false);
    setSelectedOrgOption(null);
    setInvites([]);
    setNewEmail('');
    setNewRole('member');
    setFathomConnected(false);
    setIsConnecting(false);
  };

  const resetSimulation = () => {
    setCurrentStep('idle');
    setStepIndex(0);
    resetFormState();
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setStepIndex(index);
      setCurrentStep(steps[index]);
    }
  };

  const nextStep = () => {
    if (stepIndex < steps.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

  const prevStep = () => {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
    }
  };

  const addInvite = () => {
    if (newEmail && !invites.some(i => i.email === newEmail)) {
      setInvites([...invites, {
        id: crypto.randomUUID(),
        email: newEmail,
        role: newRole
      }]);
      setNewEmail('');
      setNewRole('member');
    }
  };

  const removeInvite = (id: string) => {
    setInvites(invites.filter(i => i.id !== id));
  };

  const simulateFathomConnect = () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      setIsConnecting(false);
      setFathomConnected(true);
    }, 2000);
  };

  // Idle state - show start button
  if (currentStep === 'idle') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-[#37bd7e]" />
            Interactive Onboarding Walkthrough
          </CardTitle>
          <CardDescription>
            Experience the complete onboarding flow as a new user would see it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e]/20 to-[#2da76c]/20 flex items-center justify-center mx-auto mb-6">
              <Play className="w-10 h-10 text-[#37bd7e]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start Simulation</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Walk through each step of the onboarding flow. Enter any data you like -
              nothing will be saved. This is purely for previewing the user experience.
            </p>
            <Button
              onClick={startSimulation}
              className="bg-[#37bd7e] hover:bg-[#2da76c]"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Walkthrough
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active simulation
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Onboarding Simulation</CardTitle>
            <CardDescription>
              Step {stepIndex + 1} of {steps.length} - {stepLabels[stepIndex]}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSimulation}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            {stepLabels.map((label, i) => (
              <button
                key={label}
                onClick={() => goToStep(i)}
                className={`text-xs transition-colors ${
                  i === stepIndex
                    ? 'text-[#37bd7e] font-medium'
                    : i < stepIndex
                    ? 'text-[#37bd7e]/60 cursor-pointer hover:text-[#37bd7e]'
                    : 'text-muted-foreground cursor-pointer hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="bg-[#37bd7e] h-2 rounded-full"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Simulated onboarding content in a dark container to match actual onboarding */}
        <div className="bg-gray-950 rounded-xl p-6 min-h-[500px] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />

          <AnimatePresence mode="wait">
            {/* Welcome Step */}
            {currentStep === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative w-full max-w-2xl mx-auto"
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-4"
                  >
                    <Video className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2 text-white">
                    Welcome to Meetings Analytics
                  </h1>
                  <p className="text-gray-400">
                    Transform your sales calls into actionable insights
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: Video, title: 'Auto-Sync Calls', desc: 'Connect Fathom to automatically sync all your meeting recordings' },
                    { icon: Sparkles, title: 'AI-Powered Insights', desc: 'Get sentiment analysis, talk time coaching, and recommendations' },
                    { icon: TrendingUp, title: 'Track Progress', desc: 'Monitor your performance over time and improve conversations' }
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center mb-3">
                        <item.icon className="w-5 h-5 text-[#37bd7e]" />
                      </div>
                      <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={nextStep}
                    className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                  >
                    Get Started
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Org Setup Step */}
            {currentStep === 'org_setup' && (
              <motion.div
                key="org_setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative w-full max-w-md mx-auto"
              >
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-4"
                  >
                    <Building2 className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2 text-white">
                    {!showJoinOption ? 'Pick your team name' : 'Join Your Team'}
                  </h1>
                  <p className="text-gray-400 text-sm">
                    {!showJoinOption ? 'This will be visible to everyone you invite' : 'We found existing teams from your domain'}
                  </p>
                </div>

                {/* Toggle to show join option (for demo purposes) */}
                <div className="mb-4 flex justify-center">
                  <button
                    onClick={() => setShowJoinOption(!showJoinOption)}
                    className="text-xs text-gray-500 hover:text-gray-400 underline"
                  >
                    {showJoinOption ? 'Hide join option (demo)' : 'Show join option (demo)'}
                  </button>
                </div>

                {showJoinOption && selectedOrgOption === null && (
                  <div className="space-y-3 mb-6">
                    <button
                      onClick={() => setSelectedOrgOption('join')}
                      className="w-full bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 text-left hover:border-[#37bd7e]/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Join Existing Team</h3>
                          <p className="text-xs text-gray-400 mt-1">2 teams found with @acme.com members</p>
                          <div className="mt-2 flex gap-2">
                            <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">Acme Sales</span>
                            <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">Acme Marketing</span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedOrgOption('create')}
                      className="w-full bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 text-left hover:border-[#37bd7e]/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#37bd7e]/20 flex items-center justify-center">
                          <Plus className="w-5 h-5 text-[#37bd7e]" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Create New Team</h3>
                          <p className="text-xs text-gray-400 mt-1">Start fresh with your own workspace</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {(!showJoinOption || selectedOrgOption === 'create') && (
                  <div className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 mb-6">
                    <label className="block text-xs font-medium text-gray-400 mb-2">
                      Team name
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g., Acme Sales Team"
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                    />
                  </div>
                )}

                {selectedOrgOption === 'join' && (
                  <div className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 mb-6">
                    <p className="text-xs text-gray-400 mb-3">Select a team to join:</p>
                    <div className="space-y-2">
                      {['Acme Sales', 'Acme Marketing'].map((name) => (
                        <button
                          key={name}
                          className="w-full p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:border-[#37bd7e] text-left transition-all"
                        >
                          <h4 className="text-sm font-medium text-white">{name}</h4>
                          <p className="text-xs text-gray-400">5 members</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => {
                      if (selectedOrgOption) {
                        setSelectedOrgOption(null);
                      } else {
                        prevStep();
                      }
                    }}
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={nextStep}
                    className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                  >
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Team Invite Step */}
            {currentStep === 'team_invite' && (
              <motion.div
                key="team_invite"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative w-full max-w-md mx-auto"
              >
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-4"
                  >
                    <Users className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2 text-white">Invite Your Team</h1>
                  <p className="text-gray-400 text-sm">Add team members to {orgName}</p>
                </div>

                <div className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 mb-6">
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addInvite()}
                        placeholder="colleague@company.com"
                        className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                      />
                    </div>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as 'admin' | 'member')}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-2 text-sm text-white focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      onClick={addInvite}
                      variant="outline"
                      size="icon"
                      className="border-gray-600 hover:border-[#37bd7e] hover:bg-[#37bd7e]/10"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {invites.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 mb-2">
                        {invites.length} team member{invites.length > 1 ? 's' : ''} to invite:
                      </p>
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                            <UserPlus className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{invite.email}</p>
                            <p className="text-xs text-gray-500">{invite.role}</p>
                          </div>
                          <button
                            onClick={() => removeInvite(invite.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <UserPlus className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Add team members above or skip this step</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={prevStep}
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    Back
                  </Button>
                  {invites.length > 0 ? (
                    <Button
                      onClick={nextStep}
                      className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send {invites.length} Invite{invites.length > 1 ? 's' : ''}
                    </Button>
                  ) : (
                    <Button
                      onClick={nextStep}
                      variant="ghost"
                      className="text-gray-400 hover:text-white"
                    >
                      Skip for now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>

                <p className="text-center text-xs text-gray-500 mt-4">
                  You can always invite more team members from Settings later
                </p>
              </motion.div>
            )}

            {/* Fathom Connection Step */}
            {currentStep === 'fathom_connect' && (
              <motion.div
                key="fathom_connect"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative w-full max-w-lg mx-auto"
              >
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                      fathomConnected
                        ? 'bg-gradient-to-br from-[#37bd7e] to-[#2da76c]'
                        : isConnecting
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                        : 'bg-gradient-to-br from-[#37bd7e] to-[#2da76c]'
                    }`}
                  >
                    {fathomConnected ? (
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    ) : isConnecting ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Video className="w-8 h-8 text-white" />
                    )}
                  </motion.div>
                  <h1 className="text-2xl font-bold mb-2 text-white">
                    Connect Your Fathom Account
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Sync your meeting recordings automatically
                  </p>
                </div>

                <div className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Video className="w-3 h-3 text-[#37bd7e]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Automatic Meeting Sync</h3>
                        <p className="text-xs text-gray-400">
                          All your Fathom recordings will be automatically synced
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-[#37bd7e]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Real-time Updates</h3>
                        <p className="text-xs text-gray-400">
                          New meetings appear as soon as they're recorded
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {fathomConnected ? (
                  <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-green-400 font-medium text-sm">Fathom Connected</p>
                        <p className="text-xs text-gray-400">demo@example.com (simulated)</p>
                      </div>
                    </div>
                  </div>
                ) : isConnecting ? (
                  <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      <div>
                        <p className="text-blue-400 font-medium text-sm">Connecting to Fathom...</p>
                        <p className="text-xs text-gray-400">Please wait while we simulate the connection...</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-yellow-400 font-medium text-sm">Not Connected</p>
                        <p className="text-xs text-gray-400">Connect your Fathom account to start syncing</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={prevStep}
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    Back
                  </Button>
                  {!fathomConnected ? (
                    <Button
                      onClick={simulateFathomConnect}
                      disabled={isConnecting}
                      className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect Fathom'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={nextStep}
                      className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                    >
                      Continue
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Completion Step */}
            {currentStep === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-lg mx-auto text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold mb-2 text-white"
                >
                  You're All Set!
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 mb-8"
                >
                  Your Meetings Analytics dashboard is ready
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-gray-900/50 rounded-lg border border-gray-800/50 p-4 mb-6 text-left"
                >
                  <h3 className="text-sm font-semibold text-white mb-3">What's Next?</h3>
                  <div className="space-y-2">
                    {[
                      { title: 'Your Meetings Are Syncing', desc: 'Importing your recent Fathom recordings' },
                      { title: 'Explore Insights', desc: 'Check out talk time coaching and sentiment analysis' },
                      { title: 'Generate Proposals', desc: 'Create proposals directly from meeting transcripts' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#37bd7e] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-white">{item.title}</p>
                          <p className="text-xs text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <Button
                  onClick={resetSimulation}
                  className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restart Simulation
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

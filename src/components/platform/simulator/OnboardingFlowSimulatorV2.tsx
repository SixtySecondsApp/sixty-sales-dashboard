/**
 * OnboardingFlowSimulatorV2 - Skills-Based Onboarding Simulator
 *
 * Allows platform admins to experience the V2 skills-based onboarding flow.
 * Simulates AI enrichment and skill configuration without creating real data.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  RotateCcw,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  X,
  Target,
  Plus,
  Trash2,
  Database,
  MessageSquare,
  GitBranch,
  UserCheck,
  Settings,
  LayoutDashboard,
  FileText,
  Mail,
  Calendar,
  Sparkles,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditableItem, EditableTag, AddItemButton } from '@/components/onboarding';

type SimulationStep = 'idle' | 'signup' | 'loading' | 'result' | 'skills' | 'complete';
type SkillId = 'lead_qualification' | 'lead_enrichment' | 'brand_voice' | 'objection_handling' | 'icp';
type SkillStatus = 'pending' | 'configured' | 'skipped';

const SKILLS = [
  { id: 'lead_qualification' as SkillId, name: 'Qualification', icon: Target, description: 'Define how leads are scored and qualified' },
  { id: 'lead_enrichment' as SkillId, name: 'Enrichment', icon: Database, description: 'Customize discovery questions' },
  { id: 'brand_voice' as SkillId, name: 'Brand Voice', icon: MessageSquare, description: 'Set your communication style' },
  { id: 'objection_handling' as SkillId, name: 'Objections', icon: GitBranch, description: 'Define response playbooks' },
  { id: 'icp' as SkillId, name: 'ICP', icon: UserCheck, description: 'Describe your perfect customers' },
];

const MOCK_ENRICHMENT = {
  company_name: 'Acme Corporation',
  domain: 'acme.com',
  industry: 'B2B SaaS / Enterprise Software',
  company_size: '50-200 employees',
  products: ['CRM Platform', 'Sales Automation', 'Analytics Dashboard'],
  competitors: ['Salesforce', 'HubSpot', 'Pipedrive'],
  target_market: 'Enterprise sales teams',
};

const MOCK_SKILL_DATA: Record<SkillId, Record<string, unknown>> = {
  lead_qualification: {
    criteria: [
      'Budget authority confirmed or path to budget identified',
      'Timeline for implementation under 90 days',
      'Technical requirements align with our platform capabilities',
      'Minimum team size of 5+ sales reps',
    ],
    disqualifiers: [
      'No executive sponsor identified',
      'Currently in contract with competitor (6+ months remaining)',
      'Company size under 20 employees',
    ],
  },
  lead_enrichment: {
    questions: [
      "What's their current sales tech stack and integration requirements?",
      "Who owns the budget for sales automation tools?",
      "What's driving their evaluation timing—any specific pain points?",
    ],
  },
  brand_voice: {
    tone: 'Professional but conversational. Tech-savvy without being jargony. Confident but not pushy.',
    avoid: ['Synergy', 'Leverage', 'Circle back', 'Low-hanging fruit', 'Move the needle'],
  },
  objection_handling: {
    objections: [
      { trigger: 'Too expensive', response: 'Focus on ROI and time saved. Reference case studies showing 3x return within 6 months.' },
      { trigger: 'We already have a solution', response: 'Acknowledge their investment. Highlight specific differentiators and integration capabilities.' },
      { trigger: 'Not the right time', response: 'Understand their timeline. Offer low-commitment pilot or educational content to stay top of mind.' },
    ],
  },
  icp: {
    companyProfile: 'B2B SaaS companies with 50-500 employees, Series A to C funded, with dedicated sales teams of 10+ reps.',
    buyerPersona: 'VP of Sales or Revenue Operations leader, 5+ years experience, measured on pipeline velocity and rep productivity.',
    buyingSignals: ['Hiring SDRs/AEs', 'Evaluating sales tools on G2', 'Outbound mentions of CRM improvements'],
  },
};

const loadingTasks = [
  { label: 'Scanning website', threshold: 20 },
  { label: 'Identifying industry', threshold: 40 },
  { label: 'Analyzing products', threshold: 60 },
  { label: 'Finding competitors', threshold: 80 },
  { label: 'Building profile', threshold: 100 },
];

export function OnboardingFlowSimulatorV2() {
  const [currentStep, setCurrentStep] = useState<SimulationStep>('idle');
  const [email, setEmail] = useState('demo@acme.com');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentSkillIndex, setCurrentSkillIndex] = useState(0);
  const [skillStatuses, setSkillStatuses] = useState<Record<SkillId, SkillStatus>>(() =>
    Object.fromEntries(SKILLS.map((s) => [s.id, 'pending'])) as Record<SkillId, SkillStatus>
  );
  const [skillData, setSkillData] = useState(MOCK_SKILL_DATA);

  const domain = email.match(/@([^@]+)$/)?.[1] || '';
  const activeSkill = SKILLS[currentSkillIndex];
  const activeConfig = skillData[activeSkill?.id];

  const startSimulation = () => {
    setCurrentStep('signup');
    resetFormState();
  };

  const resetFormState = () => {
    setEmail('demo@acme.com');
    setLoadingProgress(0);
    setCurrentSkillIndex(0);
    setSkillStatuses(Object.fromEntries(SKILLS.map((s) => [s.id, 'pending'])) as Record<SkillId, SkillStatus>);
    setSkillData(MOCK_SKILL_DATA);
  };

  const resetSimulation = () => {
    setCurrentStep('idle');
    resetFormState();
  };

  // Loading progress simulation
  useEffect(() => {
    if (currentStep !== 'loading') return;

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setCurrentStep('result'), 500);
          return 100;
        }
        return prev + 3;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [currentStep]);

  const handleSignupContinue = () => {
    setCurrentStep('loading');
  };

  const handleResultContinue = () => {
    setCurrentStep('skills');
  };

  const updateSkillData = (skillId: SkillId, updates: Record<string, unknown>) => {
    setSkillData((prev) => ({
      ...prev,
      [skillId]: { ...prev[skillId], ...updates },
    }));
  };

  const handleSaveSkill = useCallback(() => {
    setSkillStatuses((prev) => ({ ...prev, [activeSkill.id]: 'configured' }));
    if (currentSkillIndex < SKILLS.length - 1) {
      setCurrentSkillIndex(currentSkillIndex + 1);
    } else {
      setCurrentStep('complete');
    }
  }, [activeSkill?.id, currentSkillIndex]);

  const handleSkipSkill = useCallback(() => {
    setSkillStatuses((prev) => ({ ...prev, [activeSkill.id]: 'skipped' }));
    if (currentSkillIndex < SKILLS.length - 1) {
      setCurrentSkillIndex(currentSkillIndex + 1);
    } else {
      setCurrentStep('complete');
    }
  }, [activeSkill?.id, currentSkillIndex]);

  const getSkillStatus = (skillId: SkillId): SkillStatus => skillStatuses[skillId] || 'pending';

  const configuredSkillIds = SKILLS.filter((s) => skillStatuses[s.id] === 'configured').map((s) => s.id);

  // Idle state
  if (currentStep === 'idle') {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-violet-500" />
            Skills-Based Onboarding V2
          </CardTitle>
          <CardDescription>
            Experience the AI-powered skills configuration onboarding flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-violet-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Start V2 Simulation</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Walk through the new skills-based onboarding that uses AI to analyze your company
              and generate customized skill configurations.
            </p>
            <Button onClick={startSimulation} className="bg-violet-600 hover:bg-violet-700">
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
            <CardTitle className="text-lg">V2 Skills Onboarding Simulation</CardTitle>
            <CardDescription>
              {currentStep === 'signup' && 'Step 1 - Enter your email'}
              {currentStep === 'loading' && 'Step 2 - AI analyzing your company'}
              {currentStep === 'result' && 'Step 3 - Review discovered information'}
              {currentStep === 'skills' && `Step 4 - Configure skills (${currentSkillIndex + 1}/${SKILLS.length})`}
              {currentStep === 'complete' && 'Complete!'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={resetSimulation} className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="bg-gray-950 rounded-xl p-6 min-h-[500px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Signup Step */}
            {currentStep === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-md mx-auto px-4"
              >
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                      <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Get started with use60</h1>
                    <p className="mt-2 text-gray-400">Enter your work email to begin</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Work email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-gray-800 border-gray-700 text-white placeholder-gray-500 border focus:ring-2 focus:ring-blue-500"
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>

                    {domain && (
                      <div className="flex items-center gap-2 p-3.5 rounded-xl border bg-blue-900/20 border-blue-800 text-blue-300">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm">
                          We'll use <span className="font-semibold">{domain}</span> to customize your assistant
                        </span>
                      </div>
                    )}

                    <Button
                      onClick={handleSignupContinue}
                      disabled={!email.includes('@')}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading Step */}
            {currentStep === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md mx-auto px-4"
              >
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 sm:p-12 text-center">
                  <div className="relative w-24 h-24 mx-auto mb-8">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="44" stroke="#374151" strokeWidth="6" fill="none" />
                      <circle
                        cx="48"
                        cy="48"
                        r="44"
                        stroke="url(#gradient-v2)"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${(loadingProgress / 100) * 276.46} 276.46`}
                      />
                      <defs>
                        <linearGradient id="gradient-v2" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{loadingProgress}%</span>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold mb-2 text-white">Analyzing {domain}</h2>
                  <p className="mb-8 text-gray-400">Learning about your business to customize your assistant...</p>

                  <div className="space-y-2.5 text-left">
                    {loadingTasks.map((task, i) => {
                      const isDone = loadingProgress > task.threshold - 20;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all ${
                            isDone ? 'bg-emerald-900/30 text-emerald-400' : 'text-gray-500'
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                          <span className="text-sm font-medium">{task.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result Step */}
            {currentStep === 'result' && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-2xl mx-auto px-4"
              >
                <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
                  <div className="bg-violet-600 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-white">We found {MOCK_ENRICHMENT.company_name}</h2>
                        <p className="text-violet-100 text-sm">Here's what we learned</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-0.5 text-gray-500">Company</p>
                          <p className="font-medium text-white">{MOCK_ENRICHMENT.company_name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-0.5 text-gray-500">Industry</p>
                          <p className="font-medium text-sm text-white">{MOCK_ENRICHMENT.industry}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-0.5 text-gray-500">Products</p>
                          <div className="flex flex-wrap gap-1">
                            {MOCK_ENRICHMENT.products.map((p, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded-md bg-violet-900/50 text-violet-300">{p}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide mb-0.5 text-gray-500">Competitors</p>
                          <div className="flex flex-wrap gap-1">
                            {MOCK_ENRICHMENT.competitors.map((c, i) => (
                              <span key={i} className="px-2 py-0.5 text-xs rounded-md bg-gray-800 text-gray-300">{c}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleResultContinue} className="w-full bg-violet-600 hover:bg-violet-700">
                      Configure Skills
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Skills Config Step */}
            {currentStep === 'skills' && (
              <motion.div
                key="skills"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-2xl mx-auto px-4"
              >
                <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
                  {/* Tab Navigation */}
                  <div className="px-4 pt-4 border-b border-gray-800">
                    <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
                      {SKILLS.map((skill, index) => {
                        const Icon = skill.icon;
                        const status = getSkillStatus(skill.id);
                        const isActive = index === currentSkillIndex;
                        return (
                          <button
                            key={skill.id}
                            onClick={() => setCurrentSkillIndex(index)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all border-b-2 -mb-px ${
                              isActive
                                ? 'bg-gray-800 text-white border-violet-500'
                                : status === 'configured'
                                  ? 'text-green-400 border-transparent hover:bg-gray-800'
                                  : status === 'skipped'
                                    ? 'text-gray-500 border-transparent hover:bg-gray-800'
                                    : 'text-gray-400 border-transparent hover:bg-gray-800'
                            }`}
                          >
                            {status === 'configured' && !isActive ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : status === 'skipped' && !isActive ? (
                              <Clock className="w-3.5 h-3.5" />
                            ) : (
                              <Icon className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">{skill.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-6">
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{activeSkill.name}</h3>
                          <p className="text-sm text-gray-400">{activeSkill.description}</p>
                        </div>
                        <span className="text-sm text-gray-500">{currentSkillIndex + 1} of {SKILLS.length}</span>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto pr-1">
                      {/* Skill-specific content - simplified for simulator */}
                      {activeSkill.id === 'lead_qualification' && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Qualification Criteria</label>
                            <div className="space-y-1.5">
                              {(activeConfig.criteria as string[])?.map((item, i) => (
                                <EditableItem
                                  key={i}
                                  value={item}
                                  onSave={(v) => updateSkillData('lead_qualification', { criteria: (activeConfig.criteria as string[]).map((c, idx) => idx === i ? v : c) })}
                                  onDelete={() => updateSkillData('lead_qualification', { criteria: (activeConfig.criteria as string[]).filter((_, idx) => idx !== i) })}
                                  icon={Check}
                                  iconColor="text-green-500"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {activeSkill.id === 'lead_enrichment' && (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-400">Questions to ask during lead enrichment:</p>
                          {(activeConfig.questions as string[])?.map((q, i) => (
                            <div key={i} className="p-3 rounded-xl bg-gray-800 text-sm text-gray-300">{q}</div>
                          ))}
                        </div>
                      )}
                      {activeSkill.id === 'brand_voice' && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Tone Description</label>
                            <p className="p-3 rounded-xl bg-gray-800 text-sm text-gray-300">{activeConfig.tone as string}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Words to Avoid</label>
                            <div className="flex flex-wrap gap-1.5">
                              {(activeConfig.avoid as string[])?.map((word, i) => (
                                <span key={i} className="px-2.5 py-1 text-sm rounded-full bg-gray-800 text-gray-300">{word}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {activeSkill.id === 'objection_handling' && (
                        <div className="space-y-3">
                          {(activeConfig.objections as Array<{ trigger: string; response: string }>)?.map((obj, i) => (
                            <div key={i} className="p-3 rounded-xl bg-gray-800 space-y-2">
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-900/50 text-amber-300">{obj.trigger}</span>
                              <p className="text-sm text-gray-300">{obj.response}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {activeSkill.id === 'icp' && (
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Ideal Company Profile</label>
                            <p className="p-3 rounded-xl bg-gray-800 text-sm text-gray-300">{activeConfig.companyProfile as string}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">Buying Signals</label>
                            <div className="space-y-1.5">
                              {(activeConfig.buyingSignals as string[])?.map((signal, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-800 text-sm text-gray-300">
                                  <Target className="w-3.5 h-3.5 text-green-500" />
                                  {signal}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 sm:px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentSkillIndex(Math.max(0, currentSkillIndex - 1))}
                        disabled={currentSkillIndex === 0}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={handleSkipSkill} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-gray-400 hover:bg-gray-800">
                        <Clock className="w-4 h-4" />
                        <span className="hidden sm:inline">Skip for now</span>
                      </button>
                    </div>
                    <Button onClick={handleSaveSkill} className="bg-violet-600 hover:bg-violet-700">
                      {currentSkillIndex === SKILLS.length - 1 ? 'Finish' : 'Save & Next'}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-lg mx-auto px-4"
              >
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 sm:p-10 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>

                  <h2 className="text-2xl font-bold mb-3 text-white">Your Sales Assistant is Ready</h2>
                  <p className="mb-8 text-gray-400">
                    We've trained your AI on <span className="font-semibold text-white">{MOCK_ENRICHMENT.company_name}</span>'s way of selling.
                  </p>

                  <div className="rounded-xl p-5 mb-8 bg-gray-800">
                    <p className="text-sm font-semibold mb-4 text-gray-300">Skills Configured</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {SKILLS.map((skill) => {
                        const Icon = skill.icon;
                        const isConfigured = configuredSkillIds.includes(skill.id);
                        return (
                          <div
                            key={skill.id}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                              isConfigured ? 'bg-emerald-900/50 text-emerald-400' : 'bg-gray-700 text-gray-500'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {skill.name}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button onClick={resetSimulation} className="bg-violet-600 hover:bg-violet-700">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Simulation
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

import { motion } from 'framer-motion';
import { Search, ListTodo, MessageSquare, FileText, Play, CheckCircle2, Sparkles, BarChart3 } from 'lucide-react';

interface FeatureProps {
  badge: string;
  title: string;
  description: string;
  features: string[];
  mockup: React.ReactNode;
  reversed?: boolean;
  gradient: string;
  badgeColor: string;
}

function Feature({ badge, title, description, features, mockup, reversed, gradient, badgeColor }: FeatureProps) {
  return (
    <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reversed ? 'lg:flex-row-reverse' : ''}`}>
      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, x: reversed ? 30 : -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={reversed ? 'lg:order-2' : ''}
      >
        <span className={`inline-block px-4 py-1.5 rounded-full ${badgeColor} text-sm font-medium mb-4`}>
          {badge}
        </span>
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
          {title}
        </h3>
        <p className="text-lg text-gray-400 mb-8 leading-relaxed">
          {description}
        </p>
        <ul className="space-y-4">
          {features.map((feature, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="flex items-start gap-3"
            >
              <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${gradient.includes('blue') ? 'text-blue-400' : gradient.includes('emerald') ? 'text-emerald-400' : gradient.includes('purple') ? 'text-purple-400' : 'text-cyan-400'}`} />
              <span className="text-gray-300">{feature}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Mockup */}
      <motion.div
        initial={{ opacity: 0, x: reversed ? -30 : 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className={reversed ? 'lg:order-1' : ''}
      >
        {mockup}
      </motion.div>
    </div>
  );
}

// Feature 1: Meeting Intelligence Hub Mockup
function MeetingHubMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-900/50 backdrop-blur-xl shadow-2xl">
        <div className="p-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-500" />
            <div className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-sm text-gray-400">
              "Show me every pricing objection from Q4"
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[
            { title: 'Discovery Call - Enterprise Lead', time: '2:34', sentiment: 'positive', tag: 'Pricing Mentioned' },
            { title: 'Demo Follow-up - TechCorp', time: '15:22', sentiment: 'neutral', tag: 'Budget Discussion' },
            { title: 'Negotiation - Global Inc', time: '8:47', sentiment: 'positive', tag: 'Price Confirmed' },
          ].map((result, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-white">{result.title}</div>
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">{result.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${result.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {result.sentiment}
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
                  {result.tag}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Floating element */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute -right-4 -top-4 p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 text-blue-400">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">AI Search</span>
        </div>
      </motion.div>
    </div>
  );
}

// Feature 2: Smart Action Items Mockup
function ActionItemsMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-900/50 backdrop-blur-xl shadow-2xl">
        <div className="p-4 border-b border-white/10 bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Action Items</span>
          </div>
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">4 items extracted</span>
        </div>
        <div className="p-6 space-y-3">
          {[
            { task: 'Send updated pricing proposal', priority: 'high', time: '12:34', status: 'synced' },
            { task: 'Schedule technical deep-dive with engineering', priority: 'medium', time: '18:22', status: 'synced' },
            { task: 'Share customer success stories', priority: 'medium', time: '24:15', status: 'pending' },
            { task: 'Confirm implementation timeline', priority: 'high', time: '31:08', status: 'synced' },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-transparent" />
              <div className="flex-1">
                <div className="text-sm text-white">{item.task}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${item.priority === 'high' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {item.priority}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Play className="w-3 h-3" /> {item.time}
                  </span>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs ${item.status === 'synced' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {item.status === 'synced' ? '✓ Synced' : 'Convert'}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Feature 3: Coaching Analytics Mockup
function CoachingMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-900/50 backdrop-blur-xl shadow-2xl">
        <div className="p-4 border-b border-white/10 bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">Talk Time Analysis</span>
          </div>
          <span className="text-sm text-gray-400">Discovery Call - Acme Corp</span>
        </div>
        <div className="p-6 space-y-6">
          {/* Talk Time Bar */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You</span>
              <span className="text-purple-400 font-medium">42%</span>
            </div>
            <div className="h-4 rounded-full bg-gray-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: '42%' }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Customer</span>
              <span className="text-emerald-400 font-medium">58%</span>
            </div>
            <div className="h-4 rounded-full bg-gray-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: '58%' }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.4 }}
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
              />
            </div>
          </div>

          {/* Coaching Insight */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-medium text-emerald-400 mb-1">Great Discovery Ratio!</div>
                <p className="text-sm text-gray-400">
                  Your 42/58 talk ratio is optimal for discovery calls. You're listening more than talking—keep it up!
                </p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Questions Asked', value: '12' },
              { label: 'Longest Monologue', value: '45s' },
              { label: 'Sentiment Trend', value: '+0.3' },
            ].map((stat, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-white/5 text-center">
                <div className="text-lg font-bold text-white">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Feature 4: Proposal Generation Mockup
function ProposalMockup() {
  return (
    <div className="relative">
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-900/50 backdrop-blur-xl shadow-2xl">
        <div className="p-4 border-b border-white/10 bg-black/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Proposal Generator</span>
          </div>
          <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">AI Generated</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Company</span>
              <span className="text-white font-medium">Acme Corporation</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Contact</span>
              <span className="text-white font-medium">Sarah Johnson, VP Sales</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Value</span>
              <span className="text-emerald-400 font-bold">$45,000/year</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="text-sm text-gray-400 mb-2">Extracted Requirements</div>
            <div className="space-y-2">
              {['CRM Integration', 'Priority Support', 'Custom Onboarding'].map((req, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <Play className="w-3 h-3 text-blue-400" />
                  <span className="text-sm text-white">{req}</span>
                  <span className="text-xs text-gray-500 ml-auto">@{['4:22', '8:15', '12:30', '18:45'][idx]}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold hover:from-cyan-500 hover:to-cyan-400 transition-all"
          >
            Generate Proposal
          </motion.button>
        </div>
      </div>

      {/* Timer */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute -left-4 -bottom-4 p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm"
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-400">5 min</div>
          <div className="text-xs text-gray-400">vs 30+ manual</div>
        </div>
      </motion.div>
    </div>
  );
}

export function FeatureShowcase() {
  const features: FeatureProps[] = [
    {
      badge: 'Meeting Intelligence',
      title: 'Your Meetings, Centralized & Searchable',
      description: 'Semantic search across all your meetings. Ask natural questions like "What pricing concerns came up last month?" and get instant answers with video clips.',
      features: [
        'Embedded video playback with timestamped transcripts',
        'Semantic search: Find any topic across 1000s of meetings',
        'AI-powered sentiment tracking (positive/neutral/negative)',
        'Automatic speaker identification and analysis',
      ],
      mockup: <MeetingHubMockup />,
      gradient: 'from-blue-400 to-cyan-400',
      badgeColor: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
    },
    {
      badge: 'Smart Action Items',
      title: 'Never Miss a Follow-Up Again',
      description: 'AI pulls every action item from transcripts with priority levels, categories, and timestamps. One click converts to your task list with video links.',
      features: [
        'AI extracts action items with priority and category',
        'Auto-sync to your task management system',
        'One-click convert with video timestamp links',
        'Deadline detection and assignee matching',
      ],
      mockup: <ActionItemsMockup />,
      reversed: true,
      gradient: 'from-emerald-400 to-green-400',
      badgeColor: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
    },
    {
      badge: 'Coaching Analytics',
      title: 'Data-Driven Coaching for Every Rep',
      description: 'See rep vs. customer talk percentages with personalized coaching tips. Discovery calls should be 70% listening. AI spots the gap and tells you how to fix it.',
      features: [
        'Talk-time analysis with optimal ratio recommendations',
        'Sentiment trends across deals and call types',
        'Performance benchmarking across your team',
        'Automated coaching triggers for managers',
      ],
      mockup: <CoachingMockup />,
      gradient: 'from-purple-400 to-pink-400',
      badgeColor: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
    },
    {
      badge: 'Proposal Generation',
      title: 'From Meeting to Proposal While Your Coffee\'s Still Hot',
      description: 'Generate professional proposals directly from meeting context. What used to take 30+ minutes now happens in 5—with video timestamps linking back to requirements.',
      features: [
        'Generate proposals from meeting context in 5 minutes',
        'Auto-includes discussed features and pricing',
        'Customizable templates with your branding',
        'Video timestamps link to customer requirements',
      ],
      mockup: <ProposalMockup />,
      reversed: true,
      gradient: 'from-cyan-400 to-blue-400',
      badgeColor: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400',
    },
  ];

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-[#0a0d14] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 text-gray-300 text-sm font-medium mb-4"
          >
            Features
          </motion.span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Close More Deals
            </span>
          </h2>
          <p className="text-lg text-gray-400">
            AI-powered meeting intelligence that transforms every conversation into actionable insights.
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-32">
          {features.map((feature, idx) => (
            <Feature key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}


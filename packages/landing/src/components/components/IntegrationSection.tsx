import { motion } from 'framer-motion';
import { Zap, ArrowRight } from 'lucide-react';

export function IntegrationSection() {
  const integrations = [
    { name: 'Fathom', status: 'live', description: 'One-click sync' },
    { name: 'Fireflies', status: 'coming', description: 'Coming Q1' },
    { name: 'Google Calendar', status: 'live', description: 'Auto-import' },
    { name: 'Slack', status: 'live', description: 'Notifications' },
    { name: 'HubSpot', status: 'coming', description: 'Coming soon' },
    { name: 'Salesforce', status: 'coming', description: 'Coming soon' },
  ];

  return (
    <section className="relative py-24 lg:py-32 bg-gradient-to-b from-white to-gray-50 dark:from-[#0a0d14] dark:to-[#0d1117] overflow-hidden transition-colors duration-300">
      {/* Background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-30 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
            filter: 'blur(60px)',
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
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium mb-4"
          >
            Integrations
          </motion.span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Works with Your{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Existing Stack
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            No platform migration required. Sixty enhances the tools you already use and love.
          </p>
        </motion.div>

        {/* Fathom Primary Integration */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="relative p-8 lg:p-12 rounded-3xl bg-emerald-50 dark:bg-gradient-to-br dark:from-emerald-500/10 dark:to-cyan-500/10 border border-emerald-200 dark:border-emerald-500/20 overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-cyan-200/30 dark:bg-cyan-500/10 blur-3xl" />

            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30">
                    <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">Fathom Integration</div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-sm">Primary Partner</div>
                  </div>
                </div>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                  Your Fathom recordings sync automatically with embedded playback. No uploads, no exports, no friction. 
                  Click once and every conversation becomes searchable, analyzable, and ready to drive deals forward.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'One-click OAuth connection',
                    'Real-time sync of all recordings',
                    'Embedded video playback in-app',
                    'Full transcript + summary import',
                  ].map((feature, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className="flex items-center gap-3 text-gray-700 dark:text-gray-300"
                    >
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </motion.li>
                  ))}
                </ul>
                <button className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all duration-300">
                  Connect Fathom
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Visual */}
              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Connected to Fathom</span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recordings synced</span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">247</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Last sync</span>
                      <span className="text-emerald-600 dark:text-emerald-400">2 minutes ago</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status</span>
                      <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">Live</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                      <div className="text-xs text-gray-600 dark:text-gray-500 mb-2">Recent imports</div>
                      <div className="space-y-2">
                        {['Discovery Call - TechCorp', 'Demo - StartupX', 'Follow-up - Enterprise Co'].map((meeting, idx) => (
                          <div key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            {meeting}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Other Integrations Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {integrations.map((integration, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className={`relative p-4 rounded-xl border ${
                integration.status === 'live' 
                  ? 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20' 
                  : 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800/50'
              } transition-all duration-300 group`}
            >
              <div className="text-center">
                <div className={`text-lg font-semibold mb-1 ${
                  integration.status === 'live' ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                }`}>
                  {integration.name}
                </div>
                <div className={`text-xs ${
                  integration.status === 'live' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'
                }`}>
                  {integration.description}
                </div>
                {integration.status === 'live' && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


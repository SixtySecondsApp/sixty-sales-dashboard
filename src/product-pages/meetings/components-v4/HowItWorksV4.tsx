import { motion } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Database, FileText, CheckSquare, Sparkles, Loader2, CheckCircle, Check, File } from 'lucide-react';

type SimulationState = 'idle' | 'scanning' | 'complete';

export function HowItWorksV4() {
  const [simulationState, setSimulationState] = useState<SimulationState>('idle');
  const [crmActive, setCrmActive] = useState(false);
  const [proposalActive, setProposalActive] = useState(false);
  const [tasksActive, setTasksActive] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const crmRef = useRef<HTMLDivElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<HTMLDivElement>(null);

  const [paths, setPaths] = useState({ line1: '', line2: '', line3: '' });

  const updateConnectionLines = useCallback(() => {
    if (!containerRef.current || !hubRef.current || !crmRef.current || !proposalRef.current || !tasksRef.current) return;

    // Don't calculate if container is hidden (mobile view)
    if (containerRef.current.offsetParent === null) return;

    const container = containerRef.current.getBoundingClientRect();
    const hub = hubRef.current.getBoundingClientRect();
    const crm = crmRef.current.getBoundingClientRect();
    const proposal = proposalRef.current.getBoundingClientRect();
    const tasks = tasksRef.current.getBoundingClientRect();

    const getCenter = (rect: DOMRect) => ({
      x: rect.left + rect.width / 2 - container.left,
      y: rect.top + rect.height / 2 - container.top
    });

    const hubCenter = getCenter(hub);
    const crmCenter = getCenter(crm);
    const proposalCenter = getCenter(proposal);
    const tasksCenter = getCenter(tasks);

    setPaths({
      line1: `M${hubCenter.x},${hubCenter.y} Q${hubCenter.x},${crmCenter.y} ${crmCenter.x},${crmCenter.y}`,
      line2: `M${hubCenter.x},${hubCenter.y} Q${proposalCenter.x},${hubCenter.y} ${proposalCenter.x},${proposalCenter.y}`,
      line3: `M${hubCenter.x},${hubCenter.y} Q${hubCenter.x},${tasksCenter.y} ${tasksCenter.x},${tasksCenter.y}`
    });
  }, []);

  useEffect(() => {
    updateConnectionLines();
    window.addEventListener('resize', updateConnectionLines);
    const timeout = setTimeout(updateConnectionLines, 100);
    return () => {
      window.removeEventListener('resize', updateConnectionLines);
      clearTimeout(timeout);
    };
  }, [updateConnectionLines]);

  const runSimulation = () => {
    if (simulationState !== 'idle') return;

    setSimulationState('scanning');

    // Show connections after slight delay
    setTimeout(() => setShowConnections(true), 800);

    // CRM Update (1.5s)
    setTimeout(() => setCrmActive(true), 1500);

    // Proposal Update (2.2s)
    setTimeout(() => setProposalActive(true), 2200);

    // Tasks Update (2.9s)
    setTimeout(() => setTasksActive(true), 2900);

    // Complete (3.5s)
    setTimeout(() => {
      setSimulationState('complete');
      setShowConnections(false);
    }, 3500);
  };

  const resetSimulation = () => {
    setSimulationState('idle');
    setCrmActive(false);
    setProposalActive(false);
    setTasksActive(false);
    setShowConnections(false);
  };

  // Glass panel styles - dark mode only
  const glassPanel = 'bg-gray-900/80 backdrop-blur-sm border border-gray-700/50';
  const glassPanelActive = 'bg-gray-900/90 backdrop-blur-xl border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)]';

  return (
    <section
      id="how-it-works"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-[#0a0d14] to-[#0d1117] overflow-hidden"
    >
      {/* Background Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 space-y-4"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4"
          >
            How It Works
          </motion.span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            After the call, we take over.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Stop spending hours on admin. Click the button below to see how Sixty instantly turns your conversation notes into finished work.
          </p>
        </motion.div>

        {/* Mobile Layout - Simple card grid */}
        <div className="sm:hidden grid grid-cols-1 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`${glassPanel} rounded-xl p-5`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Database className="w-5 h-5 text-orange-400" />
              </div>
              <h4 className="font-medium text-gray-200">CRM Sync</h4>
            </div>
            <p className="text-sm text-gray-400">Automatically updates deal stages and contact info in your CRM.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`${glassPanel} rounded-xl p-5`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-medium text-gray-200">Draft Proposals</h4>
            </div>
            <p className="text-sm text-gray-400">AI generates proposals based on your call discussions.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className={`${glassPanel} rounded-xl p-5`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="font-medium text-gray-200">Follow-up Tasks</h4>
            </div>
            <p className="text-sm text-gray-400">Creates actionable tasks from your meeting commitments.</p>
          </motion.div>
        </div>

        {/* Interactive Stage - Hidden on mobile, shown on tablet+ */}
        <div
          ref={containerRef}
          className="relative hidden sm:flex h-[550px] w-full items-center justify-center"
        >
          {/* SVG Connections Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <linearGradient id="line-gradient-hiw" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path
              d={paths.line1}
              stroke="url(#line-gradient-hiw)"
              strokeWidth="2"
              fill="none"
              className="transition-opacity duration-300"
              style={{
                strokeDasharray: '10',
                strokeDashoffset: showConnections ? '0' : '10',
                opacity: showConnections ? 0.5 : 0,
                animation: showConnections ? 'dash 1s linear infinite' : 'none'
              }}
            />
            <path
              d={paths.line2}
              stroke="url(#line-gradient-hiw)"
              strokeWidth="2"
              fill="none"
              className="transition-opacity duration-300"
              style={{
                strokeDasharray: '10',
                opacity: showConnections ? 0.5 : 0,
                animation: showConnections ? 'dash 1s linear infinite' : 'none'
              }}
            />
            <path
              d={paths.line3}
              stroke="url(#line-gradient-hiw)"
              strokeWidth="2"
              fill="none"
              className="transition-opacity duration-300"
              style={{
                strokeDasharray: '10',
                opacity: showConnections ? 0.5 : 0,
                animation: showConnections ? 'dash 1s linear infinite' : 'none'
              }}
            />
          </svg>

          {/* Central Hub: The Call Summary */}
          <motion.div
            ref={hubRef}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className={`absolute z-20 w-72 sm:w-80 ${glassPanel} rounded-2xl p-6 transition-all duration-500 hover:scale-[1.02] border-t border-white/5`}
          >
            {/* Scanning Beam Effect */}
            {simulationState === 'scanning' && (
              <motion.div
                className="absolute inset-x-0 h-1 bg-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-30 rounded-full"
                initial={{ top: '0%', opacity: 0 }}
                animate={{ top: '100%', opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2, ease: 'linear' }}
              />
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Discovery Call</h3>
                  <p className="text-xs text-gray-400">Acme Corp • 45 mins</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-medium">
                Finished
              </span>
            </div>

            {/* Placeholder lines */}
            <div className="space-y-3 mb-6">
              <div className="h-2 w-3/4 bg-gray-800 rounded-full" />
              <div className="h-2 w-full bg-gray-800 rounded-full" />
              <div className="h-2 w-5/6 bg-gray-800 rounded-full" />
              <div className="h-2 w-2/3 bg-gray-800 rounded-full" />
            </div>

            {/* Action Button */}
            <button
              onClick={simulationState === 'complete' ? resetSimulation : runSimulation}
              disabled={simulationState === 'scanning'}
              className={`w-full group relative overflow-hidden rounded-lg p-3 text-sm font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed ${
                simulationState === 'complete'
                  ? 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500'
                  : 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500'
              }`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {simulationState === 'idle' && (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Admin Work
                  </>
                )}
                {simulationState === 'scanning' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                )}
                {simulationState === 'complete' && (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    All Done — 
                  </>
                )}
              </span>
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </button>
          </motion.div>

          {/* Satellite 1: CRM Sync (Top Left) */}
          <motion.div
            ref={crmRef}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.5, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`absolute top-0 left-2 md:left-16 lg:left-20 md:top-8 w-56 md:w-64 rounded-xl p-4 md:p-5 transition-all duration-700 transform ${
              crmActive
                ? `${glassPanelActive} opacity-100 scale-100`
                : `${glassPanel} opacity-50 scale-95 translate-y-1`
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Database className="w-5 h-5 text-orange-400" />
              </div>
              <h4 className="font-medium text-gray-200">CRM Sync</h4>
            </div>
            <div className="space-y-2">
              {!crmActive ? (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Status</span>
                  <span>Waiting...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Deal Stage</span>
                    <span className="text-blue-400 font-semibold">Negotiation</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Budget</span>
                    <span className="text-white font-mono">$50,000</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Satellite 2: Proposal (Right Center) */}
          <motion.div
            ref={proposalRef}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 0.5, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`absolute right-2 md:right-8 lg:right-10 top-1/2 -translate-y-1/2 w-56 md:w-64 rounded-xl p-4 md:p-5 transition-all duration-700 transform ${
              proposalActive
                ? `${glassPanelActive} opacity-100 scale-100`
                : `${glassPanel} opacity-50 scale-95 translate-x-1`
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <h4 className="font-medium text-gray-200">Draft Proposal</h4>
            </div>
            <div className="space-y-2">
              {!proposalActive ? (
                <div className="h-20 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center text-xs text-gray-500">
                  No Document
                </div>
              ) : (
                <>
                  <div className="bg-gray-800/50 rounded p-2 flex items-center gap-2 border border-gray-700">
                    <div className="bg-blue-500/20 p-1 rounded">
                      <File className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-xs text-white truncate">Acme_Proposal_v1.pdf</span>
                  </div>
                  <div className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Draft Created
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Satellite 3: Tasks (Bottom Left) */}
          <motion.div
            ref={tasksRef}
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 0.5, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`absolute bottom-0 left-2 md:left-16 lg:left-20 md:bottom-8 w-56 md:w-64 rounded-xl p-4 md:p-5 transition-all duration-700 transform ${
              tasksActive
                ? `${glassPanelActive} opacity-100 scale-100`
                : `${glassPanel} opacity-50 scale-95 -translate-y-1`
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
              </div>
              <h4 className="font-medium text-gray-200">Follow-up Tasks</h4>
            </div>
            <div className="space-y-2">
              {!tasksActive ? (
                <div className="flex items-center gap-2 opacity-50">
                  <div className="w-4 h-4 rounded border border-gray-600" />
                  <div className="h-2 w-20 bg-gray-700 rounded" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-200">
                    <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span>Send pricing breakdown</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-200">
                    <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span>Schedule tech review</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Add keyframes for dash animation */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}

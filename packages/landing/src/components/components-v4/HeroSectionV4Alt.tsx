import { useEffect, useState } from 'react';
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

// Add keyframe animations as a style element
const heroStyles = `
  @keyframes hero-alt-float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes hero-alt-float-delayed {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes hero-alt-scan {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes hero-alt-blob {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }
  .hero-alt-animate-float {
    animation: hero-alt-float 6s ease-in-out infinite;
  }
  .hero-alt-animate-float-delayed {
    animation: hero-alt-float-delayed 5s ease-in-out infinite 1s;
  }
  .hero-alt-animate-scan {
    animation: hero-alt-scan 3s linear infinite;
  }
  .hero-alt-animate-blob {
    animation: hero-alt-blob 7s ease-in-out infinite;
  }
  .hero-alt-animate-blob-delay-2 {
    animation: hero-alt-blob 7s ease-in-out infinite 2s;
  }
  .hero-alt-animate-blob-delay-4 {
    animation: hero-alt-blob 7s ease-in-out infinite 4s;
  }
`;

export function HeroSectionV4Alt() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Inject styles
    const styleId = 'hero-alt-animations-style';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = heroStyles;
      document.head.appendChild(styleEl);
    }

    return () => {
      // Cleanup is optional - styles can persist
    };
  }, []);

  if (!mounted) return null;

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-slate-50 dark:bg-gray-950 transition-colors duration-300">

      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal hero-alt-animate-blob" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal hero-alt-animate-blob-delay-2" />
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-400/20 dark:bg-pink-600/10 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-normal hero-alt-animate-blob-delay-4" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* Left Column: Copy (Same as main hero) */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Now integrating with Slack & Salesforce
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-gray-100 leading-[1.1] mb-6">
              Turn your sales calls into{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                instant action.
              </span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-gray-300 mb-8 leading-relaxed max-w-lg">
              60 listens to your meetings, detects promises made, and automatically executes the workflow. Never miss a "I'll send you a proposal" again.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/waitlist"
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 dark:shadow-blue-900/30"
              >
                Start for free
                <ArrowRight className="w-4 h-4" />
              </a>
              <button className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 px-8 py-4 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-gray-700 transition">
                <PlayCircle className="w-4 h-4 text-slate-400 dark:text-gray-500" />
                See how it works
              </button>
            </div>

            <div className="mt-10 flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
              <div className="flex -space-x-2">
                <img className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800" src="https://i.pravatar.cc/100?img=1" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800" src="https://i.pravatar.cc/100?img=2" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800" src="https://i.pravatar.cc/100?img=3" alt="User" />
              </div>
              <p>Trusted by 2,000+ sales reps</p>
            </div>
          </div>

          {/* Right Column: OLD Meeting Hub Dashboard Visual */}
          <div className="relative lg:h-[600px] w-full flex items-center justify-center">

            {/* Main Dashboard Card (Glassmorphism) */}
            <div className="relative w-full max-w-lg
                          bg-white dark:bg-gray-900/80
                          backdrop-blur-xl
                          border border-gray-200 dark:border-gray-700/50
                          rounded-2xl shadow-2xl dark:shadow-black/50
                          overflow-hidden
                          transform transition-all duration-500 hover:scale-[1.01]
                          hero-alt-animate-float">

              {/* Window Controls */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                <div className="ml-auto text-xs font-medium text-gray-400">use60.com</div>
              </div>

              {/* Dashboard Content */}
              <div className="p-6 space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Meeting Hub</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">3 meetings processed today</p>
                  </div>
                  <div className="px-2 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 animate-pulse">
                    AI Active
                  </div>
                </div>

                {/* Meeting List */}
                <div className="space-y-3 relative">
                  {/* Scanning Line Animation */}
                  <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent z-20 hero-alt-animate-scan opacity-50 dark:opacity-100" />

                  {/* Item 1 */}
                  <div className="group relative p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 transition-all hover:border-blue-200 dark:hover:border-blue-500/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-200">Discovery - Acme Corp</div>
                      <span className="text-xs text-gray-400">10:00 AM</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Positive</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400">Proposal Sent</span>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="group relative p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 transition-all hover:border-blue-200 dark:hover:border-blue-500/30">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-200">Demo - TechStart Inc</div>
                      <span className="text-xs text-gray-400">2:00 PM</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">High Intent</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">Processing...</span>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="group relative p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 opacity-60">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-200">Sync - Global Ltd</div>
                      <span className="text-xs text-gray-400">4:30 PM</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500">Scheduled</span>
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Action Items</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">12</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sentiment</div>
                    <div className="text-lg font-bold text-emerald-500">0.72</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Talk Time</div>
                    <div className="text-lg font-bold text-blue-500">42%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements (Decorations) */}

            {/* Floating Card 1: Proposal Success */}
            <div className="absolute -right-4 top-20 lg:-right-12 lg:top-12
                          bg-white dark:bg-gray-800
                          p-3 rounded-lg shadow-xl border border-emerald-100 dark:border-emerald-500/20
                          hero-alt-animate-float-delayed z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">Proposal Sent</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Acme Corp • $12k</div>
                </div>
              </div>
            </div>

            {/* Floating Card 2: AI Analyzing */}
            <div className="absolute -left-4 bottom-32 lg:-left-12 lg:bottom-24
                          bg-white dark:bg-gray-800
                          p-3 rounded-lg shadow-xl border border-purple-100 dark:border-purple-500/20
                          hero-alt-animate-float z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">AI Analyzing</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Extracting tasks...</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSectionV4Alt;

import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

// S3 logo URLs - fetched via logo.dev and cached in S3
const INTEGRATION_LOGOS = {
  // Recorders
  fathom: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/fathom.video.png',
  fireflies: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/fireflies.ai.png',
  microsoft: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/microsoft.com.png',
  google: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/google.com.png',
  // CRM
  hubspot: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/hubspot.com.png',
  salesforce: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/salesforce.com.png',
  pipedrive: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/pipedrive.com.png',
  zoho: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/zoho.com.png',
  // Task Lists
  trello: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/trello.com.png',
  monday: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/monday.com.png',
  jira: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/atlassian.com.png',
  asana: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/asana.com.png',
} as const;

// Inject keyframe animation for the dashed line and blobs
const integrationStyles = `
  @keyframes integrations-dash {
    to {
      stroke-dashoffset: -20;
    }
  }
  .integrations-animate-dash {
    animation: integrations-dash 1s linear infinite;
  }

  @keyframes integrations-blob {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }
  .integrations-animate-blob {
    animation: integrations-blob 7s ease-in-out infinite;
  }
  .integrations-animate-blob-delay-2 {
    animation: integrations-blob 7s ease-in-out infinite 2s;
  }
  .integrations-animate-blob-delay-4 {
    animation: integrations-blob 7s ease-in-out infinite 4s;
  }
`;

export function IntegrationsSectionV4() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Inject styles
    const styleId = 'integrations-section-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = integrationStyles;
      document.head.appendChild(styleEl);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative bg-white dark:bg-gray-950 overflow-x-hidden transition-colors duration-300">
      {/* Top transition gradient - smooth blend from section above */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white dark:from-gray-950 to-transparent pointer-events-none z-[1]" />

      {/* Ambient Background Glows (Premium Feel) - Using animated blobs like Hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-400/10 dark:bg-blue-600/15 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob" />
        <div className="absolute top-48 right-1/4 w-96 h-96 bg-purple-400/10 dark:bg-purple-600/15 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob-delay-2" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-600/15 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob-delay-4" />
      </div>

      <section id="features" className="relative z-10 pt-16 pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-24">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-8 tracking-wide uppercase">
            Ecosystem Integrations
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-8 leading-tight">
            Connect existing tools to <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
              turbocharge your sales.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            60 brings together tools you're already using and wraps them in market-leading AI for analysis and automation.
          </p>
        </div>

        {/* The Process Grid */}
        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Connection Line (Desktop) */}
          <svg
            className="hidden md:block absolute top-[3.5rem] left-0 w-full h-10 z-0 pointer-events-none"
            preserveAspectRatio="none"
          >
            <path
              d="M 100 20 L 400 20 M 500 20 L 800 20"
              stroke="rgba(55, 65, 81, 0.5)"
              strokeWidth="2"
              strokeDasharray="8 8"
              className="integrations-animate-dash"
            />
          </svg>

          {/* Card 1: Recorder */}
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 dark:hover:border-blue-500/30">
            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-blue-50 dark:bg-gray-800/80 border border-blue-200 dark:border-gray-700/50 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">1</span>
            </div>

            <h3 className="relative z-10 text-xl font-semibold text-gray-900 dark:text-white mb-4">Connect Recorder</h3>
            <p className="relative z-10 text-sm text-gray-600 dark:text-gray-400 mb-10 leading-relaxed min-h-[60px]">
              60's AI analyses each call and gives your team feedback. Ask questions about your entire call history.
            </p>

            {/* App Visuals (Logos) */}
            <div className="relative z-10 grid grid-cols-4 gap-3 mb-8">
              {/* Fathom Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.fathom} 
                  alt="Fathom" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Fathom</span>
              </div>
              {/* Fireflies Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.fireflies} 
                  alt="Fireflies" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Fireflies</span>
              </div>
              {/* Teams Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.microsoft} 
                  alt="Microsoft Teams" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Teams</span>
              </div>
              {/* Google Meet Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.google} 
                  alt="Google Meet" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Meet</span>
              </div>
            </div>

            <a href="#" className="relative z-10 inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link">
              See integration
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover/link:translate-x-1" />
            </a>
          </div>

          {/* Card 2: CRM */}
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 dark:hover:border-purple-500/30">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-purple-50 dark:bg-gray-800/80 border border-purple-200 dark:border-gray-700/50 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">2</span>
            </div>

            <h3 className="relative z-10 text-xl font-semibold text-gray-900 dark:text-white mb-4">Sync Your CRM</h3>
            <p className="relative z-10 text-sm text-gray-600 dark:text-gray-400 mb-10 leading-relaxed min-h-[60px]">
              Don't waste time manually updating fields. Lead stages, deal stages and notes always up to date.
            </p>

            {/* App Visuals (Logos) */}
            <div className="relative z-10 grid grid-cols-4 gap-3 mb-8">
              {/* Hubspot Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.hubspot} 
                  alt="HubSpot" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Hubspot</span>
              </div>
              {/* Salesforce Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.salesforce} 
                  alt="Salesforce" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Salesforce</span>
              </div>
              {/* Pipedrive Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.pipedrive} 
                  alt="Pipedrive" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Pipedrive</span>
              </div>
              {/* Zoho Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.zoho} 
                  alt="Zoho" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Zoho</span>
              </div>
            </div>

            <a href="#" className="relative z-10 inline-flex items-center text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors group/link">
              See integration
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover/link:translate-x-1" />
            </a>
          </div>

          {/* Card 3: Task Manager */}
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-500/30">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-gray-800/80 border border-emerald-200 dark:border-gray-700/50 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">3</span>
            </div>

            <h3 className="relative z-10 text-xl font-semibold text-gray-900 dark:text-white mb-4">Automate Admin</h3>
            <p className="relative z-10 text-sm text-gray-600 dark:text-gray-400 mb-10 leading-relaxed min-h-[60px]">
              Tasks and objectives are auto-generated from each call and sync'd directly into your task manager.
            </p>

            {/* App Visuals (Logos) */}
            <div className="relative z-10 grid grid-cols-4 gap-3 mb-8">
              {/* Trello Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.trello} 
                  alt="Trello" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Trello</span>
              </div>
              {/* Monday Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.monday} 
                  alt="Monday.com" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Monday</span>
              </div>
              {/* Jira Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.jira} 
                  alt="Jira" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Jira</span>
              </div>
              {/* Asana Logo */}
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors duration-300 group/icon">
                <img 
                  src={INTEGRATION_LOGOS.asana} 
                  alt="Asana" 
                  className="w-7 h-7 object-contain transition-transform duration-300 group-hover/icon:scale-110"
                  loading="lazy"
                />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover/icon:text-gray-700 dark:group-hover/icon:text-gray-300 transition-colors">Asana</span>
              </div>
            </div>

            <a href="#" className="relative z-10 inline-flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors group/link">
              See integration
              <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover/link:translate-x-1" />
            </a>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 lg:mt-20 pt-12 lg:pt-16 pb-8 lg:pb-12 text-center border-t border-gray-200 dark:border-gray-700/50">
          <p className="text-gray-600 dark:text-gray-400 mb-12 font-medium text-lg">
            Combining and automating these tools saves sales teams <span className="text-gray-900 dark:text-gray-100 font-bold">15+ hours every week.</span>
          </p>

          {/* Button Component: Theme-aware */}
          <a 
            href="/waitlist"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 h-12 px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 dark:shadow-blue-900/30"
          >
            Use For Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </a>
        </div>
      </section>
    </div>
  );
}

export default IntegrationsSectionV4;

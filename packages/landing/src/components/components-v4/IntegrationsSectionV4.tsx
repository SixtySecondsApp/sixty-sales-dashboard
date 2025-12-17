import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

// S3 logo URLs - fetched via logo.dev and cached in S3
const INTEGRATION_LOGOS = {
  // Recorders
  fathom: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/fathom.video.png',
  fireflies: 'https://erg-application-logos.s3.eu-west-2.amazonaws.com/logos/fireflies.ai.png',
  teams: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
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
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob" />
        <div className="absolute top-48 right-1/4 w-96 h-96 bg-brand-violet/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob-delay-2" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-blue/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-normal integrations-animate-blob-delay-4" />
      </div>

      <section id="features" className="relative z-10 pt-16 pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-24">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-brand-blue/20 bg-brand-blue/10 text-brand-blue text-xs font-semibold mb-8 tracking-wide uppercase">
            Ecosystem Integrations
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-8 leading-tight">
            Connect existing tools to <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-violet">
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
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-brand-blue/10 hover:border-brand-blue/30">
            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-brand-blue font-mono">1</span>
            </div>

            <h3 className="relative z-10 text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">Connect Recorder</h3>
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
                <svg
                  viewBox="0 0 2228.833 2073.333"
                  className="w-7 h-7 transition-transform duration-300 group-hover/icon:scale-110"
                  aria-label="Microsoft Teams"
                >
                  <path fill="#5059C9" d="M1554.637,777.5h575.713c54.391,0,98.483,44.092,98.483,98.483v524.398 c0,199.901-162.051,361.952-361.952,361.952h0c-199.901,0.001-361.952-162.051-361.952-361.953V875.5 C1505.93,821.473,1508.61,777.5,1554.637,777.5z"/>
                  <circle fill="#5059C9" cx="1943.75" cy="440.583" r="233.25"/>
                  <circle fill="#7B83EB" cx="1218.083" cy="336.917" r="336.917"/>
                  <path fill="#7B83EB" d="M1667.323,777.5H717.01c-53.743,1.33-96.257,45.931-95.01,99.676v598.105 c-7.505,322.519,247.657,590.16,570.167,598.053c322.51-7.893,577.671-275.534,570.167-598.053V877.176 C1763.58,823.431,1721.066,778.83,1667.323,777.5z"/>
                  <path opacity="0.1" d="M1244,777.5v838.145c-0.258,38.435-23.549,72.964-59.09,87.598 c-11.316,4.787-23.478,7.254-35.765,7.257H667.613c-6.738-17.105-12.958-34.21-18.142-51.833 c-18.144-59.477-27.402-121.307-27.472-183.49V877.02c-1.246-53.659,41.198-98.19,94.855-99.52H1244z"/>
                  <path opacity="0.2" d="M1192.167,777.5v889.978c0.015,12.287-2.453,24.449-7.257,35.765 c-14.634,35.541-49.163,58.833-87.598,59.09H691.975c-8.812-17.105-17.105-34.21-24.362-51.833 c-7.257-17.623-12.958-34.21-18.142-51.833c-18.144-59.476-27.402-121.307-27.472-183.49V877.02 c-1.246-53.659,41.198-98.19,94.855-99.52H1192.167z"/>
                  <path opacity="0.2" d="M1192.167,777.5v786.312c-0.395,52.223-42.632,94.46-94.855,94.855H648.578 c-18.144-59.476-27.402-121.307-27.472-183.49V877.02c-1.246-53.659,41.198-98.19,94.855-99.52H1192.167z"/>
                  <path opacity="0.2" d="M1140.333,777.5v786.312c-0.395,52.223-42.632,94.46-94.855,94.855H648.578 c-18.144-59.476-27.402-121.307-27.472-183.49V877.02c-1.246-53.659,41.198-98.19,94.855-99.52H1140.333z"/>
                  <linearGradient id="teams_gradient" gradientUnits="userSpaceOnUse" x1="198.0991" y1="1683.0726" x2="942.2344" y2="394.2612" gradientTransform="matrix(1 0 0 -1 0 2075.3333)">
                    <stop offset="0" style={{stopColor:"#5A62C3"}}/>
                    <stop offset="0.5" style={{stopColor:"#4D55BD"}}/>
                    <stop offset="1" style={{stopColor:"#3940AB"}}/>
                  </linearGradient>
                  <path fill="url(#teams_gradient)" d="M95.01,777.5h950.312c52.473,0,95.01,42.538,95.01,95.01v950.312 c0,52.473-42.538,95.01-95.01,95.01H95.01c-52.473,0-95.01-42.538-95.01-95.01V872.51C0,820.038,42.538,777.5,95.01,777.5z"/>
                  <path fill="#FFFFFF" d="M820.211,1100.682H630.241v517.165H509.211v-517.165H320.123v-103.849h500.088V1100.682z"/>
                </svg>
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

          </div>

          {/* Card 2: CRM */}
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-brand-violet/10 hover:border-brand-violet/30">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-violet/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-brand-violet/10 border border-brand-violet/20 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-brand-violet font-mono">2</span>
            </div>

            <h3 className="relative z-10 text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">Sync Your CRM</h3>
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

          </div>

          {/* Card 3: Task Manager */}
          <div className="group relative bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-none hover:shadow-xl hover:shadow-brand-teal/10 hover:border-brand-teal/30">
            <div className="absolute inset-0 bg-gradient-to-b from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />

            {/* Step Badge */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <span className="text-lg font-bold text-brand-teal font-mono">3</span>
            </div>

            <h3 className="relative z-10 text-xl font-heading font-bold text-gray-900 dark:text-white mb-4">Automate Admin</h3>
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
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-blue h-12 px-8 py-3 bg-gradient-to-r from-brand-blue to-brand-violet text-white hover:from-[#2351C4] hover:to-[#7024C0] shadow-lg shadow-brand-blue/25"
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

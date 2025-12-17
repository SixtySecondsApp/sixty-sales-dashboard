import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function WaitlistIntegrations() {
  const integrations = {
    dialers: ['JustCall', 'CloudTalk', 'Aircall', 'RingCentral Contact Center', 'Five9', '8x8 Contact Center', 'Dialpad', 'Talkdesk', 'Nextiva', 'Channels'],
    recorders: ['Fireflies.ai', 'Fathom', 'Otter.ai', 'Read.ai', 'tl;dv', 'Notta', 'Sembly AI', 'Grain', 'Mem', 'BuildBetter.ai'],
    crms: ['Salesforce', 'HubSpot CRM', 'Zoho CRM', 'Pipedrive', 'Microsoft Dynamics 365', 'Freshsales', 'Monday Sales CRM', 'Insightly', 'Bullhorn', 'Capsule CRM']
  };

  return (
    <section className="relative py-24 bg-[#0f1419]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
            Already Integrated With Your Stack
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Seamlessly connects with the tools revenue teams already use every day
          </p>
        </motion.div>

        <div className="space-y-12">
          {/* Dialers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="font-heading text-xl font-bold text-white mb-6 text-center">Sales Dialers</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {integrations.dialers.map((tool, i) => (
                <div key={i} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg p-4 text-center hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-white font-medium text-sm">{tool}</div>
                  </div>
                  <div className="text-xs text-emerald-400/70">Integrated</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Meeting Recorders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h3 className="font-heading text-xl font-bold text-white mb-6 text-center">Meeting Intelligence</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {integrations.recorders.map((tool, i) => (
                <div key={i} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg p-4 text-center hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-white font-medium text-sm">{tool}</div>
                  </div>
                  <div className="text-xs text-emerald-400/70">Integrated</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CRMs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="font-heading text-xl font-bold text-white mb-6 text-center">CRM Platforms</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {integrations.crms.map((tool, i) => (
                <div key={i} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg p-4 text-center hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-white font-medium text-sm">{tool}</div>
                  </div>
                  <div className="text-xs text-emerald-400/70">Integrated</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400">
            Using something else? <span className="text-emerald-400 font-medium">We integrate with 100+ tools</span> — just let us know!
          </p>
        </motion.div>
      </div>
    </section>
  );
}

import { motion } from 'framer-motion';
import { Clock, TrendingUp, Shield, Sparkles } from 'lucide-react';

export function WaitlistBenefits() {
  const benefits = [
    {
      icon: Clock,
      title: 'Reclaim 10+ Hours Weekly',
      description: 'Stop drowning in admin work. Automated meeting summaries, CRM updates, and follow-ups give you back 2 hours every day.',
      stat: '10+ hrs/week saved'
    },
    {
      icon: TrendingUp,
      title: '31% Fewer Lost Deals',
      description: 'Never lose a deal to poor follow-up again. Automatic task creation and intelligent reminders ensure every opportunity is tracked.',
      stat: '31% win rate boost'
    },
    {
      icon: Shield,
      title: 'Zero Revenue Leakage',
      description: 'Uncover hidden upsell opportunities in past conversations. Our AI searches your entire meeting history for buying signals you missed.',
      stat: '100% deal visibility'
    },
    {
      icon: Sparkles,
      title: 'VIP Early Access Benefits',
      description: 'Priority onboarding, dedicated support during launch, and a permanent 50% discount locked in for being an early supporter.',
      stat: '50% lifetime discount'
    }
  ];

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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Revenue Teams Love This
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            The waitlist isn't just access—it's measurable competitive advantage for your sales team
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-emerald-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <benefit.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-white">{benefit.title}</h3>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full whitespace-nowrap">
                      {benefit.stat}
                    </span>
                  </div>
                  <p className="text-gray-400">{benefit.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 text-sm">
            Join <span className="text-white font-semibold">500+ revenue teams</span> already in queue for early access
          </p>
        </motion.div>
      </div>
    </section>
  );
}

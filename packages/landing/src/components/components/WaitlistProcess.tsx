import { motion } from 'framer-motion';
import { UserPlus, Users, Sparkles, Rocket } from 'lucide-react';

export function WaitlistProcess() {
  const steps = [
    {
      icon: UserPlus,
      title: 'Join the Waitlist',
      description: 'Sign up in seconds and tell us which tools you use'
    },
    {
      icon: Users,
      title: 'Refer Friends',
      description: 'Share your unique link and move up 5 spots for each referral'
    },
    {
      icon: Sparkles,
      title: 'Get Early Access',
      description: 'We\'ll email you when it\'s your turn to join the beta'
    },
    {
      icon: Rocket,
      title: 'Start Using',
      description: 'Get onboarded with priority support and exclusive pricing'
    }
  ];

  return (
    <section className="relative py-24 bg-[#0a0d14]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Four simple steps to get early access
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connector Line (hidden on last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-px bg-gradient-to-r from-blue-500/50 to-purple-500/50" />
              )}

              <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                {/* Step Number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>

                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <step.icon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="font-heading text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

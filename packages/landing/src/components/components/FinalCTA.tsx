import { motion } from 'framer-motion';
import { ArrowRight, Clock, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FinalCTAProps {
  onOpenModal?: () => void;
  email?: string;
  setEmail?: (email: string) => void;
  onEmailSubmit?: (e: React.FormEvent) => void;
}

export function FinalCTA({ onOpenModal, email = '', setEmail, onEmailSubmit }: FinalCTAProps = {}) {
  return (
    <section className="relative py-24 lg:py-32 bg-gray-50 dark:bg-gray-950 overflow-hidden transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] opacity-30 dark:opacity-100"
          style={{
            background: 'radial-gradient(ellipse, rgba(42, 94, 219, 0.15) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-20 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(129, 41, 215, 0.1) 0%, transparent 60%)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full opacity-20 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(3, 173, 156, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Card Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900/80 dark:via-gray-900/80 dark:to-gray-900/80 backdrop-blur-sm" />
          <div className="absolute inset-0 border border-gray-200 dark:border-gray-700/50 rounded-3xl" />

          {/* Content */}
          <div className="relative p-8 lg:p-12 text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-blue/10 border border-brand-blue/20 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-blue"></span>
              </span>
              <span className="text-brand-blue text-sm font-medium">Limited Early Access</span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            >
              Ready to Close More Deals{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-violet">
                with AI?
              </span>
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="font-body text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto"
            >
              Join sales teams already using 60 to automate intelligent meeting actions, coach their reps, increase proposal rates and close deals faster.
            </motion.p>

            {/* Email Capture Form or CTA Button */}
            {onOpenModal && setEmail && onEmailSubmit ? (
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                onSubmit={onEmailSubmit}
                className="w-full max-w-md mx-auto mb-10"
              >
                <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl backdrop-blur-xl bg-white/5 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1 h-12 bg-transparent border-0 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                  />
                  <Button
                    type="submit"
                    className="h-12 px-6 bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0] !text-white font-semibold rounded-xl whitespace-nowrap"
                    style={{ color: 'white' }}
                  >
                    Get Early Access
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="flex justify-center mb-10"
              >
                {onOpenModal ? (
                  <button
                    onClick={onOpenModal}
                    className="group px-8 py-4 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet !text-white font-semibold text-lg hover:from-[#2351C4] hover:to-[#7024C0] transition-all duration-300 shadow-lg shadow-brand-blue/30 hover:shadow-xl hover:shadow-brand-blue/40 cursor-pointer"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Get Early Access
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                ) : (
                  <a href="/waitlist" className="group px-8 py-4 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet !text-white font-semibold text-lg hover:from-[#2351C4] hover:to-[#7024C0] transition-all duration-300 shadow-lg shadow-brand-blue/30 hover:shadow-xl hover:shadow-brand-blue/40">
                    <span className="flex items-center justify-center gap-2">
                      Get Early Access
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </a>
                )}
              </motion.div>
            )}

            {/* Trust Elements */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-blue" />
                <span>Setup in 60 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-violet" />
                <span>No credit card required</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

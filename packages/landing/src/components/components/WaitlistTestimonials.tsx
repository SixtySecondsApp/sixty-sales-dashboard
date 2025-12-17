import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export function WaitlistTestimonials() {
  const testimonials = [
    {
      quote: "We've been testing Meeting Intelligence for 3 weeks and already saved 15+ hours of manual CRM work. The AI caught buying signals we completely missed in a $200K deal.",
      author: "Marcus Chen",
      role: "VP Sales, TechFlow Solutions",
      company: "Series B SaaS"
    },
    {
      quote: "Finally—a tool that actually delivers on the 'auto-update CRM' promise. Our reps used to spend 90 minutes a day on admin work. Now it's under 10 minutes.",
      author: "Sarah Mitchell",
      role: "Head of Revenue Operations",
      company: "Enterprise Software"
    },
    {
      quote: "The follow-up task automation alone is worth it. We went from 40% follow-up rate to 98% in two weeks. Zero manual effort required.",
      author: "David Rodriguez",
      role: "Sales Director, CloudScale",
      company: "Growth-Stage Startup"
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
            Loved by Revenue Teams
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            See what early access users are saying about Meeting Intelligence
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-colors"
            >
              <Quote className="w-8 h-8 text-emerald-400/30 mb-4" />
              <p className="text-gray-300 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-white/10 pt-4">
                <div className="font-semibold text-white">{testimonial.author}</div>
                <div className="text-sm text-gray-400">{testimonial.role}</div>
                <div className="text-xs text-gray-500 mt-1">{testimonial.company}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400">
            Join the <span className="text-emerald-400 font-semibold">500+ revenue professionals</span> who've already secured their spot
          </p>
        </motion.div>
      </div>
    </section>
  );
}

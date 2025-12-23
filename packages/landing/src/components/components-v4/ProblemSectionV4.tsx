import { motion } from 'framer-motion';
import { MailX, FileClock, CalendarClock, Inbox, X } from 'lucide-react';

export function ProblemSectionV4() {
    return (
        <section id="problem" className="py-24 bg-white dark:bg-gray-950 transition-colors duration-300 scroll-mt-48">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue/10 border border-brand-blue/20 rounded-full text-sm font-medium text-brand-blue mb-4"
                    >
                        The Problem
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 tracking-tight text-gray-900 dark:text-white"
                    >
                        You're Not Bad at Sales.<br />You're Just Drowning in Admin.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-gray-600 dark:text-gray-400"
                    >
                        Every sales rep knows this cycle:
                        Great meeting → Promise to follow up → Get distracted → Forget → Deal goes cold.
                    </motion.p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                    {[
                        { icon: MailX, title: 'Follow-up Failures', desc: "You promise to follow up, then life happens. By the time you remember, the prospect has gone cold or signed with a competitor.", color: 'red' },
                        { icon: FileClock, title: 'Proposal Bottleneck', desc: "Proposals take 2-3 hours each. By the time you finish, the prospect's excitement has faded. Momentum lost.", color: 'red' },
                        { icon: CalendarClock, title: 'Meeting Prep Time Sink', desc: "30 minutes of prep for a 30-minute call. You're spending more time researching than actually selling.", color: 'red' },
                        { icon: Inbox, title: 'Inbox Avalanche', desc: "New enquiries come in while you're on calls. By the time you respond, they've moved on to whoever answered first.", color: 'red' }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.08] rounded-2xl p-7 hover:border-brand-blue/20 dark:hover:border-white/15 hover:-translate-y-1 transition-all"
                        >
                            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                                <item.icon className="w-6 h-6 text-red-500 dark:text-red-400" />
                            </div>
                            <h3 className="font-heading text-lg font-semibold mb-2 text-gray-900 dark:text-white">{item.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-5 bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.08] rounded-2xl p-8 mt-12"
                >
                    {[
                        { value: '70%', label: 'of work week on admin' },
                        { value: '£470', label: 'lost per week, per rep' },
                        { value: '1 in 4', label: 'reps meet quota' },
                        { value: '3hrs', label: 'wasted on prep weekly' }
                    ].map((stat, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-brand-blue to-brand-violet bg-clip-text text-transparent">
                                {stat.value}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

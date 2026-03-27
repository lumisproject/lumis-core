import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const TermsOfService = () => {
    return (
        <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 selection:bg-orange-500/30">
            <nav className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/80 dark:border-white/5 dark:bg-black/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
                    <Link to="/" className="flex items-center gap-2 group text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Back
                    </Link>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 mx-auto max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="space-y-12"
                >
                    <div className="space-y-4">
                        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic text-orange-500">Terms of Service</h1>
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Effective Date: March 2026</p>
                    </div>

                    <div className="space-y-8 text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium">
                        <section className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">01. Service Activation</h2>
                            <p>
                                By accessing the Lumis platform (the "Service"), you agree to follow our protocols and respect the limits of the tiered usage system. You are responsible for all actions occurring under your neural node (account), including the integrity of any repositories or ticketing systems you link.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">02. Inference Limitations</h2>
                            <p>
                                The Service is provided "as is" and "as available". Lumis uses predictive models to provide insights into your codebase. While we strive for high precision, these insights are meant for development guidance and do not guarantee bug-free or inherently correct interpretations of project logic.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">03. Professional Conduct</h2>
                            <p>
                                The platform is designed for engineering efficiency. Users are prohibited from utilizing Lumis to analyze sensitive information without authority, reverse-engineer proprietary non-open-source protocols, or engage in malicious activity that threatens the system's resilience.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">04. Billing & Capacity</h2>
                            <p>
                                Free tier access is restricted to 1 project per neural session. Upgrading your tier expands your neural capacity and project limit. Subscriptions are billed on a monthly cycle, and cancellations will return your account to the baseline free tier upon the current term's conclusion.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">05. Termination</h2>
                            <p>
                                We reserve the right to suspend or terminate your access to the Service for any violation of these terms. You may delete your account and associated intelligence at any time via the Settings panel, provided all active synchronization protocols have been halted.
                            </p>
                        </section>
                    </div>

                    <footer className="pt-20 border-t border-black/5 dark:border-white/5">
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">General Protocol Inquiries</span>
                            <span className="text-sm font-bold">david@novagate-solutions.com</span>
                        </div>
                    </footer>
                </motion.div>
            </main>
        </div>
    );
};

export default TermsOfService;

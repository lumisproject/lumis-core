import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    Cpu,
    GitBranch,
    MessageSquare,
    Shield,
    BarChart3,
    Sparkles
} from 'lucide-react';

const FeatureCard = ({ title, desc, icon: Icon, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="group relative rounded-3xl border border-black/5 bg-white/50 p-8 shadow-sm backdrop-blur-sm transition-all hover:bg-white dark:border-white/5 dark:bg-card/50 dark:hover:bg-card"
    >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Icon className="h-6 w-6" />
        </div>
        <h3 className="mb-3 text-lg font-bold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </motion.div>
);

const Landing = () => {
    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] selection:bg-primary selection:text-primary-foreground overflow-hidden">
            {/* Decorative Blur */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 h-[500px] w-full max-w-7xl">
                <div className="absolute top-[-100px] left-[10%] h-[400px] w-[400px] rounded-full bg-primary/20 blur-[120px]" />
                <div className="absolute top-[-50px] right-[10%] h-[300px] w-[300px] rounded-full bg-accent/20 blur-[100px]" />
            </div>

            {/* Nav */}
            <nav className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/50 backdrop-blur-xl dark:border-white/5 dark:bg-black/50">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <Cpu className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="text-xl font-bold tracking-tighter">Lumis</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">Log In</Link>
                        <Link to="/signup" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-105">Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative pt-40 pb-20 lg:pt-56">
                <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-black/5 bg-white/80 px-4 py-1.5 backdrop-blur-md dark:border-white/5 dark:bg-card/50"
                    >
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">The New Standard for Code Intelligence</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl"
                    >
                        The Memory Layer <br />
                        <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">for your Software</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
                    >
                        Ingest your Github repos. Ask questions in natural language. Detect risks before they become bugs. Lumis understands your code so you can move faster.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                        <Link to="/signup" className="group flex h-14 items-center gap-2 rounded-2xl bg-primary px-8 text-lg font-bold text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:scale-105">
                            Start Building Free
                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </motion.div>

                    {/* Social Proof / Used by */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-24 grayscale opacity-40 hover:grayscale-0 transition-all"
                    >
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">Trusted by engineers at</p>
                        <div className="flex flex-wrap justify-center gap-x-12 gap-y-8 text-2xl font-black tracking-tighter italic">
                            <span>Vercel</span>
                            <span>Stripe</span>
                            <span>Linear</span>
                            <span>Segment</span>
                            <span>Supabase</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <FeatureCard
                            title="Autonomous Chat"
                            desc="Ask anything about your codebase. Lumis understands context, architecture, and intent."
                            icon={MessageSquare}
                            delay={0}
                        />
                        <FeatureCard
                            title="Risk Analysis"
                            desc="Detect high-risk code paths and potential regressions before they reach production."
                            icon={Shield}
                            delay={0.1}
                        />
                        <FeatureCard
                            title="Git Deep Sync"
                            desc="Real-time webhook sync, commit analysis, and intelligent diff understanding."
                            icon={GitBranch}
                            delay={0.2}
                        />
                        <FeatureCard
                            title="Project Insights"
                            desc="Connect Jira and Notion. Lumis maps issues to code and surfaces actionable insights."
                            icon={BarChart3}
                            delay={0.3}
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-black/5 py-12 dark:border-white/5">
                <div className="mx-auto max-w-7xl px-6 md:flex md:items-center md:justify-between lg:px-8">
                    <div className="flex items-center gap-3">
                        <Cpu className="h-5 w-5 text-primary" />
                        <span className="text-lg font-bold tracking-tighter">Lumis</span>
                    </div>
                    <p className="mt-8 text-xs text-muted-foreground md:order-1 md:mt-0">
                        &copy; {new Date().getFullYear()} NovaGate Solutions Aps. All rights reserved. Built for the future of engineering.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;

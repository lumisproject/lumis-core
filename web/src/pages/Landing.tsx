import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Terminal, Database, Lock, Zap, Check, Moon, Sun, Cpu, Code2, MessageSquare } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useEffect, useRef } from 'react';

const ThemeToggle = () => {
    const { theme, setTheme } = useSettingsStore();
    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-black/5 bg-white/50 text-neutral-600 transition-all hover:bg-white hover:text-orange-500 hover:shadow-lg hover:shadow-orange-500/20 dark:border-white/10 dark:bg-black/50 dark:text-neutral-400 dark:hover:bg-black/80 dark:hover:text-yellow-400"
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? <Sun className="h-4 w-4 transition-transform group-hover:rotate-45" /> : <Moon className="h-4 w-4 transition-transform group-hover:-rotate-12" />}
        </button>
    );
};

const FeatureCard = ({ title, desc, icon: Icon, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
        className="group flex flex-col rounded-3xl border border-black/5 bg-white/40 p-8 shadow-sm backdrop-blur-md transition-all hover:border-orange-500/20 hover:bg-white hover:shadow-2xl hover:shadow-orange-500/10 dark:border-white/5 dark:bg-neutral-950/40 dark:hover:border-yellow-500/20 dark:hover:bg-black/60 dark:hover:shadow-yellow-500/10"
    >
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-yellow-500/10 text-orange-600 dark:text-yellow-500 transition-transform group-hover:-translate-y-2">
            <Icon className="h-7 w-7" />
        </div>
        <h3 className="mb-3 text-xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{desc}</p>
    </motion.div>
);

const Landing = () => {
    const { theme } = useSettingsStore();
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });
    const yVal = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const opacityVal = useTransform(scrollYProgress, [0, 1], [1, 0]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 dark:bg-[#050505] dark:text-neutral-100 font-sans selection:bg-orange-500/30 selection:text-orange-900 dark:selection:text-yellow-100 flex flex-col overflow-x-hidden">
            
            {/* Dynamic Background Mesh */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 h-[80vh] w-[80vw] translate-x-1/3 -translate-y-1/4 rounded-full bg-gradient-to-bl from-orange-400/20 via-yellow-400/10 to-transparent blur-[120px] dark:from-orange-500/10 dark:via-yellow-500/5"></div>
                <div className="absolute bottom-0 left-0 h-[60vh] w-[60vw] -translate-x-1/3 translate-y-1/4 rounded-full bg-gradient-to-tr from-yellow-500/20 via-orange-600/10 to-transparent blur-[120px] dark:from-yellow-600/10 dark:via-orange-600/5"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay dark:opacity-[0.05]"></div>
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/60 backdrop-blur-xl dark:border-white/5 dark:bg-black/60">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-2 group">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-7 w-auto block dark:hidden transition-transform group-hover:scale-105" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-7 w-auto hidden dark:block transition-transform group-hover:scale-105" />
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link to="/login" className="hidden text-sm font-semibold text-neutral-600 transition-colors hover:text-orange-500 dark:text-neutral-400 dark:hover:text-yellow-400 sm:block">Log in</Link>
                        <ThemeToggle />
                        <Link to="/signup" className="group relative flex h-10 items-center justify-center overflow-hidden rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-orange-500/20 active:scale-95 dark:bg-white dark:text-black dark:hover:shadow-yellow-500/20">
                            <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                            <span className="relative z-10 font-bold group-hover:text-white dark:group-hover:text-black">Start Building</span>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section - Non Classic, Asymmetric & Dynamic */}
            <section ref={heroRef} className="relative z-10 pt-32 lg:pt-48 pb-20 px-6 flex-1 flex flex-col justify-center">
                <div className="mx-auto max-w-7xl w-full">
                    <motion.div style={{ y: yVal, opacity: opacityVal }} className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                        
                        {/* Left Content */}
                        <div className="lg:col-span-6 flex flex-col items-start text-left">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="mb-8 inline-flex items-center justify-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-600 backdrop-blur-sm dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-400"
                            >
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 dark:bg-yellow-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600 dark:bg-yellow-500"></span>
                                </span>
                                LUMIS ENGINE
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
                                className="text-5xl font-black tracking-tighter sm:text-7xl lg:text-8xl w-full"
                            >
                                Code at the speed of <br/>
                                <span className="bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-400 bg-clip-text text-transparent">intuition.</span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
                                className="mt-8 max-w-lg text-lg sm:text-xl font-medium leading-relaxed text-neutral-600 dark:text-neutral-400"
                            >
                                Connect your Git history. Lumis constructs a living, semantic graph of your intelligence layer, instantly pointing out regressions and refactoring messy logic autonomously.
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                                className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
                            >
                                <Link to="/signup" className="group relative w-full sm:w-auto flex h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-neutral-900 px-8 text-lg font-bold text-white shadow-2xl transition-all hover:scale-105 hover:shadow-orange-500/30 dark:bg-white dark:text-black dark:hover:shadow-yellow-500/30">
                                    <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                                    <span className="relative z-10 flex items-center gap-2 group-hover:text-white dark:group-hover:text-black">
                                        Ship Faster <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </Link>
                            </motion.div>
                        </div>

                        {/* Right Content - Abstract App Visual */}
                        <div className="lg:col-span-6 relative w-full h-full flex justify-center lg:justify-end">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, rotateY: 20, rotateX: 10 }}
                                animate={{ opacity: 1, scale: 1, rotateY: -5, rotateX: 5 }}
                                transition={{ duration: 1.2, delay: 0.4, type: "spring", bounce: 0.4 }}
                                className="relative w-full max-w-lg perspective-1000"
                            >
                                {/* Floating decorative element */}
                                <motion.div
                                    animate={{ y: [-10, 10, -10], rotateZ: [0, 2, 0] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -top-10 -right-10 z-20 h-24 w-48 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                                            <Check className="h-4 w-4" />
                                        </div>
                                        <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                            Regression Avoided <br/>
                                            <span className="text-neutral-500 font-normal">in AuthModule.ts</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Main mockup window */}
                                <div className="relative z-10 rounded-3xl border border-neutral-200 bg-white shadow-2xl overflow-hidden dark:border-neutral-800 dark:bg-[#0D0D0D] ring-1 ring-black/5 dark:ring-white/5">
                                    <div className="flex h-12 items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-4 backdrop-blur-md dark:border-neutral-800/50 dark:bg-black/40">
                                        <div className="h-3 w-3 rounded-full bg-red-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-orange-400"></div>
                                        <div className="h-3 w-3 rounded-full bg-green-400"></div>
                                        <div className="ml-4 flex items-center gap-2 text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
                                            <Terminal className="h-3 w-3" /> lumis workspace
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 font-mono text-[13px] leading-loose text-neutral-700 dark:text-neutral-300">
                                        <div className="flex items-start">
                                            <span className="text-orange-500 mr-4 font-black">❯</span>
                                            <div>
                                                <p className="text-neutral-900 dark:text-white font-medium">lumis sync --source origin/main</p>
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-4 space-y-3">
                                                    <p className="text-neutral-500">→ Analyzing 48 commits...</p>
                                                    <p className="flex items-center gap-2">
                                                        <span className="text-green-500">✔</span> 
                                                        Memory graph updated structure.
                                                    </p>
                                                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 dark:border-yellow-500/20 dark:bg-yellow-500/5">
                                                        <p className="text-orange-600 dark:text-yellow-400 font-bold mb-1 flex items-center gap-2">
                                                            <Zap className="h-4 w-4"/> Architectural Insight
                                                        </p>
                                                        <p className="text-neutral-800 dark:text-neutral-300 text-xs">
                                                            Found a bottleneck in <code className="bg-white dark:bg-black px-1 rounded border border-black/10 dark:border-white/10">DataService.ts</code>.<br/>
                                                            We mapped this to Jira ticket <span className="text-blue-500">ENG-401</span>.
                                                        </p>
                                                    </div>
                                                </motion.div>
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="mt-4 flex items-center gap-2">
                                                    <span className="text-orange-500 font-black">❯</span>
                                                    <span className="h-4 w-2 bg-orange-500 block animate-pulse"></span>
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Level 2 */}
            <section className="relative z-10 py-32 border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#0A0A0A]">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mb-20 max-w-3xl">
                        <h2 className="text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl text-neutral-900 dark:text-white">
                            Beyond standard autocomplete.
                        </h2>
                        <p className="mt-6 text-xl font-medium text-neutral-600 dark:text-neutral-400">
                            Traditional tools lack top-down awareness. Lumis ingests your entire topology—linking Jira issues, pull requests, and component trees into one seamless intelligence layer.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <FeatureCard
                            title="Conversational Architecture"
                            desc="Talk to your codebase naturally. It understands framework-specific intent and business logic perfectly."
                            icon={MessageSquare}
                            delay={0.1}
                        />
                        <FeatureCard
                            title="Semantic Risk Detection"
                            desc="Not just linting. Avoid logic regressions and performance traps before they pass code review."
                            icon={Lock}
                            delay={0.2}
                        />
                        <FeatureCard
                            title="Deep Git & Issue Sync"
                            desc="Real-time webhooks keep Lumis aware of your latest commits and linked Jira tasks autonomously."
                            icon={Database}
                            delay={0.3}
                        />
                        <FeatureCard
                            title="Instant Massive Refactors"
                            desc="Plan sweeping architectural changes and have Lumis generate secure, tested PRs."
                            icon={Zap}
                            delay={0.4}
                        />
                        <FeatureCard
                            title="Universal Integration"
                            desc="Plug natively into React, Node, Python, and every major standard tech stack seamlessly."
                            icon={Code2}
                            delay={0.5}
                        />
                        <FeatureCard
                            title="Private Sub-Graphs"
                            desc="Zero data leaks. Your code trains its own isolated intelligence graph, guaranteed secure."
                            icon={Cpu}
                            delay={0.6}
                        />
                    </div>
                </div>
            </section>

            {/* Dynamic CTA */}
            <section className="relative z-10 py-40 overflow-hidden border-t border-black/5 dark:border-white/5 bg-white dark:bg-[#050505]">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                            x: [-20, 20, -20],
                            y: [-20, 20, -20]
                        }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-96 bg-gradient-to-r from-orange-500/10 via-yellow-500/10 to-transparent blur-[120px] rounded-full"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1.2, 1, 1.2],
                            rotate: [0, -90, 0],
                            x: [20, -20, 20],
                            y: [20, -20, 20]
                        }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl h-64 bg-gradient-to-l from-yellow-500/10 via-orange-500/10 to-transparent blur-[100px] rounded-full"
                    />
                </div>

                <div className="mx-auto max-w-5xl px-6 lg:px-8 text-center relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <h2 className="mx-auto max-w-4xl text-5xl font-black tracking-tighter text-neutral-900 dark:text-white sm:text-7xl leading-[1.1]">
                            Stop hunting for logic.<br/> 
                            <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent italic">Start building.</span>
                        </h2>
                        
                        <p className="mx-auto mt-8 max-w-2xl text-xl font-medium text-neutral-600 dark:text-neutral-400">
                            Join elite engineering teams shipping robust features faster with the Lumis memory engine. 
                        </p>

                        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link 
                                to="/signup" 
                                className="group relative flex h-16 w-full sm:w-auto items-center justify-center gap-3 overflow-hidden rounded-2xl bg-neutral-900 px-10 text-lg font-black text-white shadow-2xl transition-all hover:scale-105 hover:shadow-orange-500/40 active:scale-95 dark:bg-white dark:text-black dark:hover:shadow-yellow-500/40"
                            >
                                <span className="absolute inset-0 bg-gradient-to-r from-orange-600 to-yellow-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                                <span className="relative z-10 flex items-center gap-2 group-hover:text-white dark:group-hover:text-black">
                                    Create Free Workspace <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </span>
                            </Link>
                            
                            <Link 
                                to="/login" 
                                className="group flex h-16 w-full sm:w-auto items-center justify-center gap-3 rounded-2xl border border-neutral-200 bg-white/50 px-10 text-lg font-bold text-neutral-600 backdrop-blur-sm transition-all hover:border-orange-500/30 hover:bg-white hover:text-orange-500 dark:border-white/10 dark:bg-black/50 dark:text-neutral-400 dark:hover:border-yellow-500/30 dark:hover:bg-black dark:hover:text-yellow-400"
                            >
                                Log in
                            </Link>
                        </div>

                        {/* Social Proof Placeholder */}
                        <div className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
                            <span>No Credit Card REQUIRED</span>
                            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-800 mt-1.5"></span>
                            <span>Unlimited Local Sync</span>
                            <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-800 mt-1.5"></span>
                            <span>Enterprise Grade Security</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Strict Minimal Footer */}
            <footer className="relative z-10 border-t border-black/5 bg-white py-12 dark:border-white/5 dark:bg-[#050505]">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row lg:px-8">
                    <div className="flex items-center gap-2 opacity-80">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-5 w-auto block dark:hidden" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-5 w-auto hidden dark:block" />
                    </div>
                    <p className="text-[13px] font-medium text-neutral-500">
                        &copy; {new Date().getFullYear()} NovaGate Solutions Aps. All rights reserved.
                    </p>
                    <div className="flex gap-6 text-[13px] font-bold text-neutral-500">
                        <Link to="https://www.linkedin.com/company/novagate-solutions/" className="hover:text-orange-500 dark:hover:text-yellow-400 transition-colors">LinkedIn</Link>
                        <Link to="https://www.novagate-solutions.com" className="hover:text-orange-500 dark:hover:text-yellow-400 transition-colors">NovaGate Solutions Aps</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;

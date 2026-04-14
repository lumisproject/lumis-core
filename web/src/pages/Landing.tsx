import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Database, Moon, Sun, Code2, MessageSquare, ShieldAlert } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const ThemeToggle = () => {
    const { theme, setTheme } = useSettingsStore();
    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/50 text-neutral-600 transition-all hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? <Sun className="h-4 w-4 transition-transform" /> : <Moon className="h-4 w-4 transition-transform" />}
        </button>
    );
};

const FeatureCard = ({ title, desc, icon: Icon, delay, stat, large = false }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/5 dark:bg-[#0A0A0A] dark:hover:border-white/10 ${large ? "md:col-span-2" : "col-span-1"}`}
    >
        {/* Subtle hover glow effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/0 to-orange-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/0 dark:to-white/5" />

        <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-black/5 bg-neutral-50 text-neutral-900 dark:border-white/10 dark:bg-white/5 dark:text-white shadow-sm">
                    <Icon className="h-5 w-5" />
                </div>
                {stat && (
                    <div className="flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300">
                        {stat}
                    </div>
                )}
            </div>

            <div className="mt-auto">
                <h3 className="mb-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h3>
                <p className="text-sm font-medium leading-relaxed text-neutral-600 dark:text-neutral-400">{desc}</p>
            </div>
        </div>
    </motion.div>
);

const Landing = () => {
    const { theme } = useSettingsStore();
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });

    // We only use these if we want scroll effects on the hero, keeping them subtle
    const yVal = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
    const opacityVal = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

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
        <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 dark:bg-[#000000] dark:text-neutral-100 font-sans selection:bg-orange-500/30 selection:text-orange-900 dark:selection:text-yellow-100 flex flex-col overflow-x-hidden relative">

            {/* === Rich Ambient Background System === */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Primary warm orb — top center */}
                <motion.div
                    animate={{ 
                        scale: [1, 1.1, 0.9, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-[30vh] left-1/2 -translate-x-1/2 h-[90vh] w-[90vw] rounded-full bg-gradient-radial from-orange-400/25 via-yellow-400/10 to-transparent blur-[120px] dark:from-orange-500/20 dark:via-amber-500/5 transition-opacity"
                />
                {/* Secondary cool orb — bottom left */}
                <motion.div
                    animate={{ 
                        x: [0, 40, -20, 0],
                        y: [0, 30, -30, 0]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-[-10vh] left-[-10vw] h-[60vh] w-[60vw] rounded-full bg-gradient-radial from-blue-400/20 via-cyan-400/10 to-transparent blur-[100px] dark:from-blue-600/15 dark:via-cyan-600/5 transition-opacity"
                />
                {/* Tertiary accent orb — right */}
                <motion.div
                    animate={{ 
                        x: [0, -30, 20, 0],
                        y: [0, 40, -20, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute top-[20vh] right-[-10vw] h-[55vh] w-[55vw] rounded-full bg-gradient-radial from-rose-400/15 via-orange-400/5 to-transparent blur-[100px] dark:from-rose-600/10 dark:via-orange-600/5 transition-opacity"
                />

                {/* Grid Overlay */}
                <div 
                    className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]"
                    style={{
                        backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                    }}
                />
                
                {/* Film grain texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay dark:opacity-[0.06]" />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 z-50 w-full border-b border-transparent transition-all duration-300 bg-transparent backdrop-blur-md dark:border-white/5 dark:bg-black/20">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                    <Link to="/" className="flex items-center gap-2 group">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-5 w-auto block dark:hidden transition-opacity" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-5 w-auto hidden dark:block transition-opacity" />
                    </Link>
                    <div className="flex items-center gap-3 md:gap-4">
                        <Link to="/login" className="text-xs md:text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Log in</Link>
                        <Link to="/signup" className="group relative flex h-8 items-center justify-center rounded-full bg-neutral-900 px-3 md:px-4 text-[10px] md:text-xs font-semibold text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-xl shadow-black/10 dark:shadow-white/10">
                            Start Building
                        </Link>
                        <ThemeToggle />
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section ref={heroRef} className="relative z-10 flex flex-col items-center text-center pt-32 lg:pt-48 pb-20 px-6 min-h-[90vh] bg-transparent">
                {/* Hero Glow Backdrop */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.15)_0,transparent_60%)] animate-pulse" />
                </div>
                <motion.div style={{ y: yVal, opacity: opacityVal }} className="mx-auto max-w-5xl w-full flex flex-col items-center">

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="text-4xl sm:text-7xl lg:text-[6rem] font-bold tracking-tighter w-full leading-[1.05] dark:text-white text-neutral-950 px-4 md:px-0"
                    >
                        Your devs spend 75%<br />
                        <span className="inline-block bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent italic pb-2 pr-2">of their time not coding,</span><br />
                        Lumis fixes that.
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-6 md:mt-8 max-w-2xl text-base md:text-xl font-medium leading-relaxed text-neutral-600 dark:text-neutral-400 px-6 md:px-0"
                    >
                        Connect your Git history, tasks tickets, and docs into a living intelligence layer. Stop searching, re-reading, and updating. Start building.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto z-20 px-6 md:px-0"
                    >
                        <Link to="/signup" className="group flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-neutral-900 px-8 text-sm font-semibold text-white transition-all shadow-xl shadow-neutral-900/20 hover:bg-neutral-800 hover:scale-105 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:shadow-white/10">
                            Ship Faster <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>

                        <div className="flex flex-col items-center sm:items-start text-xs font-semibold text-neutral-500 dark:text-neutral-500 sm:border-l border-neutral-300 dark:border-neutral-800 sm:pl-6 text-center sm:text-left">
                            <span className="text-neutral-900 dark:text-white font-bold">~10–12 hours saved / week</span>
                            <span className="opacity-80 mt-0.5 tracking-tight text-orange-600 dark:text-orange-500">Free for individual developers</span>
                        </div>
                    </motion.div>

                    {/* Central Mockup Visual */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-12 md:mt-20 w-full max-w-5xl relative mx-auto"
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-[#FAFAFA] dark:from-[#000000] to-transparent z-20 bottom-0 h-48 mt-auto pointer-events-none" />

                        <div className="relative rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#0A0A0A]/70 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 mx-4 sm:mx-0">
                            <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#050505] overflow-hidden relative shadow-inner text-left">
                                <div className="flex h-12 items-center border-b border-black/5 dark:border-white/5 bg-neutral-50 dark:bg-[#0A0A0A] px-4">
                                    <div className="flex gap-2">
                                        <div className="h-3 w-3 rounded-full bg-red-400 dark:bg-red-500/80" />
                                        <div className="h-3 w-3 rounded-full bg-yellow-400 dark:bg-yellow-500/80" />
                                        <div className="h-3 w-3 rounded-full bg-green-400 dark:bg-green-500/80" />
                                    </div>
                                    <div className="mx-auto text-[10px] font-bold text-neutral-400 tracking-wider">LUMIS NEURAL LAYER</div>
                                </div>
                                <div className="w-full h-auto min-h-[20rem] md:h-80 bg-white dark:bg-[#050505] p-6 sm:p-8 font-mono text-sm flex flex-col justify-start items-start overflow-hidden relative">
                                    <div className="flex items-start w-full">
                                        <span className="text-orange-500 mr-4 font-bold hidden sm:block">❯</span>
                                        <div className="w-full">
                                            <p className="text-neutral-900 dark:text-white font-medium break-all mb-4 md:mb-0">lumis sync --source origin/main</p>
                                            <div className="mt-4 space-y-3">
                                                <p className="text-neutral-500 flex items-center gap-2">
                                                    <RefreshCwIcon className="h-3 w-3 animate-spin" /> Analyzing 48 commits...
                                                </p>
                                                <p className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                                                    <span className="text-green-500 font-bold">✔</span>
                                                    Memory graph updated structure.
                                                </p>
                                                <div className="rounded-xl border border-black/5 dark:border-white/5 bg-neutral-50 dark:bg-[#0A0A0A] p-4 mt-6 max-w-xl">
                                                    <p className="text-neutral-900 dark:text-white font-bold mb-2 flex items-center gap-2 text-xs sm:text-sm">
                                                        <ShieldAlert className="h-4 w-4 text-orange-500" /> Regression Avoided
                                                    </p>
                                                    <p className="text-neutral-600 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed">
                                                        Found a bottleneck in <code className="bg-white dark:bg-black px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5 text-neutral-900 dark:text-white">DataService.ts</code>.<br />
                                                        We mapped this to Jira ticket <span className="text-blue-500 hover:underline cursor-pointer">ENG-401</span>.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center gap-2">
                                                <span className="text-orange-500 font-bold hidden sm:block">❯</span>
                                                <span className="h-4 w-2 bg-orange-500 block animate-pulse"></span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Abstract background visualization inside the terminal */}
                                    <div className="absolute right-[-50px] top-[-50px] opacity-20 pointer-events-none hidden sm:block">
                                        <Database className="w-64 h-64 text-orange-500/10 dark:text-orange-500/5 rotate-12" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* Structured Features Section */}
            <section className="relative z-10 py-32 px-6 bg-transparent border-t border-black/5 dark:border-white/5">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-20 text-center max-w-2xl mx-auto flex flex-col items-center">
                        <div className="inline-flex items-center rounded-full border border-black/5 bg-neutral-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-600 dark:border-white/5 dark:bg-white/5 dark:text-neutral-400 mb-6 font-mono">
                            Capabilities
                        </div>
                        <h2 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl mb-6">
                            Reclaim your momentum.
                        </h2>
                        <p className="text-lg text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
                            Eliminate the meta-work overhead. Lumis automatically connects dots, documents changes, and points out risks before they break production.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FeatureCard
                            title="Context on Command"
                            desc="Stop hunting for that file. Persistent project memory serves relevant code instantly from across your entire ecosystem, right when you ask for it."
                            icon={Database}
                            delay={0.1}
                            large={true}
                            stat="-80% search time"
                        />
                        <FeatureCard
                            title="Project Management Sync"
                            desc="Lumis turns messages and tickets into structured, ready-to-code tasks automatically."
                            icon={MessageSquare}
                            delay={0.2}
                            stat="Auto-linked"
                        />
                        <FeatureCard
                            title="Automated PRs"
                            desc="Perfectly formatted PR descriptions generated straight from your semantic commit history."
                            icon={Code2}
                            delay={0.3}
                            stat="-60% typing"
                        />
                        <FeatureCard
                            title="Semantic Risk Detection"
                            desc="Know exactly which files break before you ship. Instant semantic dependency tracking."
                            icon={ShieldAlert}
                            delay={0.4}
                            large={true}
                            stat="Pre-flight checks"
                        />
                    </div>
                </div>
            </section>

            {/* How It Works Layer */}
            <section className="relative z-10 py-32 border-t border-black/5 dark:border-white/5 bg-transparent backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-6 lg:px-8">
                    <div className="mb-20 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                            How it works
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        {/* Desktop connection lines */}
                        <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent"></div>

                        {[
                            { step: "01", title: "Connect Repo", desc: "Link your GitHub repository securely in under 60 seconds." },
                            { step: "02", title: "Lumis Indexes", desc: "We map your architecture, logic units, and issue tracker." },
                            { step: "03", title: "Start Building", desc: "Get answers, detect risks, and let the admin handle itself." }
                        ].map((item, i) => (
                            <div key={i} className="relative flex flex-col text-left items-start md:items-center md:text-center">
                                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-black/5 text-neutral-900 shadow-sm dark:bg-[#0A0A0A] dark:border-white/5 dark:text-white font-mono text-sm font-bold relative z-10">
                                    {item.step}
                                </div>
                                <h3 className="text-xl font-bold mb-3 text-neutral-900 dark:text-white">{item.title}</h3>
                                <p className="text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed max-w-xs">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Neural Gravitational Cloud */}
            <section className="relative z-10 py-32 border-t border-black/5 dark:border-white/5 bg-transparent backdrop-blur-sm overflow-hidden">


                <div className="mx-auto max-w-6xl px-6 lg:px-8 relative z-10 flex flex-col items-center">
                    <div className="mb-20 text-center max-w-2xl">
                        <h2 className="text-5xl font-bold tracking-tighter text-neutral-900 dark:text-white mb-6 leading-[1.1]">
                            <span className="bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent">Supported Languages</span>
                        </h2>
                    </div>

                    <div className="flex flex-wrap justify-center items-center gap-4 max-w-5xl relative">
                        {[
                            { name: "Python", dot: "bg-blue-500", border: "hover:border-blue-500/50", glow: "bg-blue-500", scale: 1.1 },
                            { name: "TypeScript", dot: "bg-sky-500", border: "hover:border-sky-500/50", glow: "bg-sky-500", scale: 1 },
                            { name: "JavaScript", dot: "bg-yellow-500", border: "hover:border-yellow-500/50", glow: "bg-yellow-500", scale: 1.2 },
                            { name: "Go", dot: "bg-cyan-500", border: "hover:border-cyan-500/50", glow: "bg-cyan-500", scale: 1 },
                            { name: "Rust", dot: "bg-orange-600", border: "hover:border-orange-600/50", glow: "bg-orange-600", scale: 1.15 },
                            { name: "Java", dot: "bg-red-500", border: "hover:border-red-500/50", glow: "bg-red-500", scale: 1 },
                            { name: "C++", dot: "bg-blue-600", border: "hover:border-blue-600/50", glow: "bg-blue-600", scale: 1.05 },
                            { name: "C#", dot: "bg-purple-500", border: "hover:border-purple-500/50", glow: "bg-purple-500", scale: 1 },
                            { name: "PHP", dot: "bg-indigo-500", border: "hover:border-indigo-500/50", glow: "bg-indigo-500", scale: 0.95 },
                            { name: "Ruby", dot: "bg-rose-500", border: "hover:border-rose-500/50", glow: "bg-rose-500", scale: 1.1 },
                            { name: "Markdown", dot: "bg-neutral-500", border: "hover:border-neutral-500/50", glow: "bg-neutral-500", scale: 1 },
                            { name: "React", dot: "bg-sky-400", border: "hover:border-sky-400/50", glow: "bg-sky-400", scale: 1.2 },
                            { name: "C", dot: "bg-gray-500", border: "hover:border-gray-500/50", glow: "bg-gray-500", scale: 1 }
                        ].map((lang, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                animate={{
                                    y: [0, -15, 0],
                                    x: [0, i % 2 === 0 ? 5 : -5, 0]
                                }}
                                transition={{
                                    opacity: { delay: i * 0.05 },
                                    y: { duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
                                    x: { duration: 3 + (i % 2), repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }
                                }}
                                whileHover={{ scale: 1.1, zIndex: 50, transition: { duration: 0.2 } }}
                                className={cn(
                                    "px-8 py-4 rounded-full border border-black/5 bg-white/40 dark:bg-white/5 backdrop-blur-2xl shadow-xl flex items-center gap-3 group cursor-default transition-all hover:shadow-2xl relative",
                                    lang.border
                                )}
                                style={{
                                    scale: lang.scale,
                                }}
                            >
                                {/* Internal Glow */}
                                <div className={cn("absolute inset-0 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-md", lang.glow)} />

                                <div className={cn("h-2 w-2 rounded-full shadow-[0_0_12px_rgba(255,165,0,0.4)]", lang.dot)} />
                                <span className={cn("text-sm font-black uppercase tracking-[0.1em]", i % 2 === 0 ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400")}>
                                    {lang.name}
                                </span>


                                {/* Tech Badge (Floating above on hover) */}
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black tracking-widest bg-black dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-full">
                                    READY
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>





            {/* CTA Section Minimal */}
            <section className="relative z-10 py-40 overflow-hidden border-t border-black/5 dark:border-white/5 bg-transparent backdrop-blur-sm">
                <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 flex justify-center items-center">
                    <div className="w-full max-w-full h-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0,transparent_50%)]" />
                </div>

                <div className="mx-auto max-w-4xl px-6 text-center relative z-10 py-10">
                    <h2 className="text-4xl sm:text-7xl font-bold tracking-tighter text-neutral-900 dark:text-white mb-6 leading-[1.05]">
                        Stop hunting for logic.<br />
                        <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">Start building.</span>
                    </h2>

                    <p className="mt-8 mb-12 text-xl font-medium text-neutral-600 dark:text-neutral-400 mx-auto max-w-2xl">
                        Join elite engineering teams shipping robust features faster with the Lumis intelligence engine.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/signup"
                            className="group flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-neutral-900 px-8 text-sm font-bold text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-neutral-900/20 dark:bg-white dark:text-black dark:hover:bg-neutral-200 dark:hover:shadow-white/10"
                        >
                            Create Free Workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                        <Link
                            to="/login"
                            className="flex h-14 w-full sm:w-auto items-center justify-center rounded-full border border-black/10 bg-white px-8 text-sm font-bold text-neutral-700 transition-all hover:bg-neutral-50 dark:border-white/10 dark:bg-[#0A0A0A] dark:text-neutral-300 dark:hover:bg-white/5"
                        >
                            Log in
                        </Link>
                    </div>

                    <div className="mt-12 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600">
                        Free tier: 3 projects included • No Credit Card
                    </div>
                </div>
            </section>

            {/* Strict Minimal Footer */}
            <footer className="relative z-10 border-t border-black/5 bg-[#FAFAFA] py-10 dark:border-white/5 dark:bg-[#000000]">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row lg:px-8 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-4 w-auto block dark:hidden opacity-80" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-4 w-auto hidden dark:block opacity-80" />
                    </div>
                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                        <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-600 tracking-wider">
                            &copy; {new Date().getFullYear()} NovaGate Solutions. All rights reserved.
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/privacy" className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Simple standalone icon since we used it up there
const RefreshCwIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
)

export default Landing;

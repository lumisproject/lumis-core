import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldAlert,
    Copy,
    Check,
    Webhook,
    Github,
    ArrowRight,
    Search,
    Zap,
    Plus,
    AlertTriangle,
    RefreshCw,
    Layers,
    Binary,
    Terminal,
    Clock,
    Cpu,
    ExternalLink
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';

const IntelligencePanel = ({ children, className, title, icon: Icon, description, accent = "primary", action }: any) => {
    const accents = {
        primary: "from-primary/10 to-transparent border-primary/10 hover:border-primary/20",
        orange: "from-orange-500/10 to-transparent border-orange-500/10 hover:border-orange-500/20",
        rose: "from-rose-500/10 to-transparent border-rose-500/10 hover:border-rose-500/20",
        emerald: "from-emerald-500/10 to-transparent border-emerald-500/10 hover:border-emerald-500/20",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6, scale: 1.01 }}
            className={cn(
                "group relative p-8 rounded-[3.5rem] border bg-card/30 backdrop-blur-3xl transition-all duration-500 overflow-hidden",
                accents[accent as keyof typeof accents],
                className
            )}
        >
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                        <div className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-[1.6rem] bg-gradient-to-br shadow-inner transition-transform group-hover:rotate-6",
                            accents[accent as keyof typeof accents]
                        )}>
                            <Icon className="h-7 w-7 opacity-80" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tighter uppercase leading-none mb-1.5">{title}</h3>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{description}</p>
                        </div>
                    </div>
                    {action}
                </div>
                <div className="flex-grow">
                    {children}
                </div>
            </div>

            {/* Background flourish */}
            <div className={cn(
                "absolute -right-16 -top-16 h-64 w-64 rounded-full blur-[100px] opacity-20 transition-opacity group-hover:opacity-40",
                accents[accent as keyof typeof accents].split(' ')[0].replace('from-', 'bg-')
            )} />
        </motion.div>
    );
};

const RiskStatus = ({ risks }: { risks: any[] }) => {
    const high = risks.filter(r => r.severity === 'high').length;
    const medium = risks.filter(r => r.severity === 'medium').length;
    const low = risks.filter(r => r.severity === 'low').length;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Critical', count: high, color: 'text-rose-500', bg: 'bg-rose-500/5' },
                    { label: 'Warning', count: medium, color: 'text-orange-500', bg: 'bg-orange-500/5' },
                    { label: 'Notice', count: low, color: 'text-emerald-500', bg: 'bg-emerald-500/5' }
                ].map((stat, i) => (
                    <div key={i} className={cn("rounded-[2rem] p-6 text-center border border-black/5 dark:border-white/5 bg-accent/10 transition-transform hover:scale-105", stat.bg)}>
                        <div className={cn("text-4xl font-black tracking-tighter", stat.color)}>{stat.count}</div>
                        <div className={cn("text-[9px] uppercase tracking-widest font-black opacity-40 mt-1", stat.color)}>{stat.label}</div>
                    </div>
                ))}
            </div>
            <div className="relative h-1.5 w-full bg-accent/20 rounded-full overflow-hidden flex shadow-inner">
                {risks.length > 0 ? (
                    <>
                        {high > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(high / risks.length) * 100}%` }} className="bg-rose-500" />}
                        {medium > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(medium / risks.length) * 100}%` }} className="bg-orange-500" />}
                        {low > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${(low / risks.length) * 100}%` }} className="bg-emerald-500" />}
                    </>
                ) : (
                    <div className="w-full bg-emerald-500 opacity-20" />
                )}
            </div>
        </div>
    );
};

const VelocityAlert = ({ risk }: { risk: any }) => {
    if (!risk) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="group relative overflow-hidden rounded-[3rem] bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 shadow-2xl shadow-rose-500/10 p-8"
        >
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="relative h-16 w-16 flex items-center justify-center rounded-[2rem] bg-rose-500 text-white shadow-xl shadow-rose-500/30 overflow-hidden">
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0" 
                        />
                        <Clock className="h-8 w-8 relative z-10" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-black uppercase tracking-tighter text-rose-500 leading-tight">Velocity Collapse Detected</h3>
                            <span className="px-3 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-rose-500/20">Critical Alert</span>
                        </div>
                        <p className="text-sm font-bold text-foreground opacity-80 max-w-2xl leading-relaxed">
                            {risk.description}
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Background animated pulse */}
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-rose-500/10 blur-[80px] rounded-full animate-pulse" />
        </motion.div>
    );
};

const Dashboard = () => {
    const { user } = useUserStore();
    const { project, risks, loading: projectLoading, jiraConnected, projects, syncProject, jiraProjects } = useProjectStore();
    const [syncing, setSyncing] = useState(false);
    const { tier } = useBillingStore();
    const navigate = useNavigate();

    const isLimitReached = tier === 'free' && projects.length >= 1;
    const webhookUrl = project ? `${import.meta.env.VITE_API_URL}/api/webhook/${user?.id}/${project?.id}` : '';
    const [copied, setCopied] = useState(false);
    
    // Find velocity risk if it exists
    const velocityRisk = risks.find(r => r.riskType === 'Predictive Delay');

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getRepoName = () => {
        const slug = project?.repo_name || project?.repo_url?.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        if (!slug) return 'Unlinked Node';
        return slug.split('/').pop() || slug;
    };

    const getJiraProjectName = () => {
        if (!project?.jira_project_id) return 'Mapped';
        const match = jiraProjects.find(p => p.key === project.jira_project_id);
        return match ? match.name : project.jira_project_id;
    };

    if (projectLoading && !project) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="relative flex flex-col items-center gap-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                        <Zap className="h-16 w-16 text-primary animate-bounce relative z-10" />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary animate-pulse">Initializing Synthesis</p>
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">Connecting to Intelligence Mesh...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen pt-4 px-8 lg:px-12 space-y-10 pb-32">
            {/* Immersive Background Flourish */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/5 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-accent/20 blur-[150px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] dark:opacity-[0.05]"
                    style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 relative z-10">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-primary">
                        <Zap className="h-4 w-4" />
                        Lumis AI - version 1.0
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">LUMIS Dashboard</h1>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        Active Instance: <span className="text-foreground font-black uppercase tracking-widest bg-accent px-2 py-0.5 rounded-md border border-black/5 dark:border-white/5">{getRepoName()}</span>
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3">
                    {isLimitReached && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Tier Limit: 1 Project
                            <Link to="/app/billing" className="ml-2 underline hover:text-orange-400">Upgrade</Link>
                        </div>
                    )}
                    <button
                        onClick={() => !isLimitReached && navigate('/app/new-project')}
                        disabled={isLimitReached}
                        className={cn(
                            "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-2xl",
                            isLimitReached
                                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                                : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <Plus className="h-4 w-4" />
                        NEW REPOSITORY
                    </button>
                </div>
            </header>

            {velocityRisk && project && (
                <VelocityAlert risk={velocityRisk} />
            )}

            {!useProjectStore.getState().isUpToDate && project && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-[3rem] bg-orange-500/[0.03] backdrop-blur-xl border border-orange-500/20 shadow-2xl shadow-orange-500/10"
                >
                    <div className="flex items-center gap-6">
                        <div className="relative h-16 w-16 flex items-center justify-center rounded-[2rem] bg-orange-500 text-white shadow-xl shadow-orange-500/30">
                            <RefreshCw className="h-8 w-8 animate-spin-slow" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-widest text-orange-500 leading-tight">Sync Desynchronized</h3>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Updates detected in the master branch. Current map is invalid.</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            setSyncing(true);
                            try { await syncProject(project.id); } finally { setSyncing(false); }
                        }}
                        disabled={syncing}
                        className="h-14 px-10 rounded-2xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/20"
                    >
                        SYNCH NOW
                    </button>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* PRIMARY MONITORING LAYER */}
                <div className="lg:col-span-8">
                    <IntelligencePanel
                        title="Terminal"
                        description="Instance Status"
                        icon={Terminal}
                        accent="primary"
                        className="h-full"
                        action={project?.repo_url && (
                            <a 
                                href={project.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/action h-10 w-10 rounded-xl bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center transition-all hover:bg-primary/20 hover:border-primary/30"
                            >
                                <ExternalLink className="h-4 w-4 text-muted-foreground transition-all group-hover/action:text-primary group-hover/action:scale-110" />
                            </a>
                        )}
                    >
                        <div className="space-y-8">
                            <div className="flex items-center gap-6">
                                <a 
                                    href={project?.repo_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="h-20 w-20 rounded-[2.2rem] bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 flex-shrink-0 hover:shadow-primary/40 group/logo cursor-pointer"
                                >
                                    <Github className="h-10 w-10 transition-transform group-hover/logo:scale-110" />
                                </a>
                                <div className="min-w-0 flex-1">
                                    <div className="text-3xl font-black tracking-tighter uppercase leading-none break-all">{getRepoName()}</div>
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mt-2">
                                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                        Linked Branch: Main
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 rounded-[2.2rem] bg-accent/20 border border-black/5 dark:border-white/5 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Active Commit Layer</div>
                                        <div className="text-sm font-mono font-bold text-foreground overflow-hidden truncate">
                                            {project?.last_commit?.slice(0, 7) || '---'}
                                        </div>
                                    </div>
                                    {useProjectStore.getState().isUpToDate ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                                            <Check className="h-3 w-3" />
                                            Synced
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                            <AlertTriangle className="h-3 w-3" />
                                            Stale
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!project) return;
                                        setSyncing(true);
                                        try { await syncProject(project.id); } finally { setSyncing(false); }
                                    }}
                                    disabled={syncing || project?.sync_state?.status === 'ingesting'}
                                    className="h-20 rounded-[2.2rem] bg-accent group/btn flex items-center justify-between px-8 border border-black/5 dark:border-white/5 hover:bg-primary transition-all duration-500"
                                >
                                    <div className="flex flex-col items-start translate-x-0 group-hover/btn:translate-x-2 transition-transform">
                                        <span className="text-[10px] font-black uppercase text-primary group-hover/btn:text-primary-foreground">Manual Sync</span>
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase group-hover/btn:text-primary-foreground/60">{syncing ? 'Ingesting...' : 'Pull Records'}</span>
                                    </div>
                                    <RefreshCw className={cn("h-6 w-6 text-primary group-hover/btn:text-primary-foreground", (syncing || project?.sync_state?.status === 'ingesting') && "animate-spin")} />
                                </button>
                            </div>
                        </div>
                    </IntelligencePanel>
                </div>

                <div className="lg:col-span-4">
                    <IntelligencePanel
                        title="Risk Mesh"
                        description="Deep Scan Analysis"
                        icon={ShieldAlert}
                        accent="rose"
                        className="h-full"
                    >
                        <RiskStatus risks={risks} />
                        <Link to="/app/risks" className="mt-8 flex items-center justify-between p-5 rounded-[2rem] bg-accent/50 border border-black/5 dark:border-white/5 group/link hover:bg-primary transition-all duration-500">
                            <span className="text-[10px] font-black uppercase tracking-widest group-hover/link:text-primary-foreground">Full Security Audit</span>
                            <ArrowRight className="h-5 w-5 transition-transform group-hover/link:translate-x-2 group-hover/link:text-primary-foreground" />
                        </Link>
                    </IntelligencePanel>
                </div>

                {/* INTEGRATION & ECOSYSTEM LAYER */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8">
                        <IntelligencePanel
                            title="Neural Gateway"
                            description="Direct Integration Link"
                            icon={Webhook}
                            accent="primary"
                        >
                            <div className="space-y-6">
                                <button
                                    onClick={handleCopy}
                                    className={cn(
                                        "w-full h-20 rounded-[2.5rem] border flex items-center justify-between px-10 transition-all duration-500 active:scale-[0.98]",
                                        copied
                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20"
                                            : "bg-white/5 border-black/5 dark:border-white/5 text-foreground hover:bg-accent/50 shadow-inner"
                                    )}
                                >
                                    <div className="flex flex-col items-start">
                                        <span className={cn("text-[9px] font-black uppercase tracking-[0.3em]", copied ? "opacity-60" : "text-primary")}>
                                            {copied ? 'Link Copied' : 'Secure Transfer Link'}
                                        </span>
                                        <span className="text-[13px] font-black uppercase tracking-widest">
                                            {copied ? 'Intelligence Payload In Clipboard' : 'Transfer Integration URI'}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-all",
                                        copied ? "bg-white/20" : "bg-primary/10 text-primary shadow-inner"
                                    )}>
                                        {copied ? <Check className="h-6 w-6" /> : <Copy className="h-5 w-5" />}
                                    </div>
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary underline underline-offset-8">Setup Sequence</h4>
                                        <div className="space-y-2">
                                            {[
                                                "Settings > Webhooks",
                                                "Add New Webhook",
                                                "Input Generated Payload",
                                                "Set Type: application/json"
                                            ].map((step, i) => (
                                                <div key={i} className="flex items-center gap-4">
                                                    <div className="h-6 w-6 rounded-lg bg-accent/50 flex items-center justify-center text-[10px] font-black opacity-50">{i + 1}</div>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-[2.5rem] bg-accent/20 border border-black/5 dark:border-white/5 flex flex-col justify-center">
                                        <div className="flex items-center gap-3 mb-2 text-primary">
                                            <Binary className="h-4 w-4" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Integration Fabric</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed opacity-60">
                                            Enable "Push Events" to maintain a real-time intelligence thread.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </IntelligencePanel>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <IntelligencePanel
                            title="Ecosystem"
                            description="External Fabric"
                            icon={Layers}
                            accent="primary"
                            className="h-full"
                        >
                            <div className="flex flex-col gap-3">
                                {[
                                    { label: 'Jira', icon: Search, connected: jiraConnected, mapped: !!project?.jira_project_id },
                                    { label: 'Notion', icon: Cpu, connected: false, mapped: false, soon: true }
                                ].map((integ, i) => (
                                    <div key={i} className="group/item flex items-center justify-between p-4 rounded-2xl bg-accent/20 border border-black/5 dark:border-white/5 transition-all hover:bg-accent/40">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                integ.connected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                                                (integ.soon ? "bg-yellow-500/10 text-yellow-500 opacity-40" : "bg-muted/20 text-muted-foreground opacity-40 group-hover/item:opacity-60")
                                            )}>
                                                <integ.icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest">{integ.label}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {integ.soon ? (
                                                        <span className="text-[7px] font-black text-yellow-500 uppercase tracking-widest px-1.5 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20">Under Construction</span>
                                                    ) : (
                                                        <>
                                                            <div className={cn(
                                                                "h-1 w-1 rounded-full",
                                                                integ.mapped ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" : (integ.connected ? "bg-orange-500 animate-pulse" : "bg-muted opacity-30")
                                                            )} />
                                                            <span className={cn(
                                                                "text-[8px] font-black uppercase tracking-wider",
                                                                integ.mapped ? "text-primary" : (integ.connected ? "text-orange-500" : "text-muted-foreground opacity-40")
                                                            )}>
                                                                {integ.mapped ? (integ.label === 'Jira' ? `Linked to: ${getJiraProjectName()}` : 'Mapped') : (integ.connected ? 'Connected' : 'Disconnected')}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {integ.soon ? (
                                            <div className="px-3 py-1.5 rounded-lg bg-yellow-500/5 text-[7px] font-black uppercase tracking-[0.2em] text-yellow-500/40 border border-yellow-500/10 grayscale cursor-not-allowed">
                                                SOON
                                            </div>
                                        ) : integ.connected && !integ.mapped ? (
                                            <Link to="/app/settings" className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase tracking-widest hover:bg-orange-500/20 transition-colors border border-orange-500/10">
                                                Loom
                                            </Link>
                                        ) : !integ.connected ? (
                                            <Link to="/app/settings" className="px-3 py-1.5 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:bg-white/10 transition-colors border border-black/5 dark:border-white/5">
                                                CONNECT
                                            </Link>
                                        ) : (
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Check className="h-3 w-3" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </IntelligencePanel>
                    </div>
                </div>

                {/* CALL TO ACTION LAYER */}
                <div className="lg:col-span-12">
                    <div className="relative p-12 py-16 rounded-[4.5rem] bg-gradient-to-tr from-primary to-accent overflow-hidden group hover:scale-[1.01] transition-all duration-700 shadow-2xl shadow-primary/20 active:scale-[0.99]">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                            <div className="space-y-8 text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-primary-foreground/80">
                                    <Zap className="h-6 w-6 fill-current" />
                                    Synthesis Core Active
                                </div>
                                <h4 className="text-6xl font-black tracking-tighter uppercase leading-[0.8] text-white">
                                    ACCESS <br /> NEURAL <br /> BRAIN
                                </h4>
                            </div>

                            <div className="flex flex-col gap-4 w-full md:w-auto">
                                <Link to="/app/chat" className="inline-flex h-20 px-16 rounded-[2.5rem] bg-white text-primary text-sm font-black uppercase tracking-[0.3em] items-center justify-center gap-6 hover:gap-8 transition-all shadow-[0_20px_40px_-15px_rgba(255,255,255,0.3)] group/chat">
                                    SYSTEM CHAT
                                    <ArrowRight className="h-6 w-6" />
                                </Link>
                                <div className="grid grid-cols-2 gap-4">
                                    <Link to="/app/board" className="flex items-center justify-center h-16 rounded-[1.8rem] bg-white/10 text-white border border-white/20 text-[11px] font-black uppercase tracking-widest hover:bg-white/20 transition-all backdrop-blur-md">
                                        Tickets Control
                                    </Link>
                                    <Link to="/app/architecture" className="flex items-center justify-center h-16 rounded-[1.8rem] bg-white/10 text-white border border-white/20 text-[11px] font-black uppercase tracking-widest hover:bg-white/20 transition-all backdrop-blur-md">
                                        Visual Graph
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Abstract Background flourishes */}
                        <div className="absolute top-0 right-0 w-full h-full opacity-[0.15] pointer-events-none transition-transform group-hover:scale-110 duration-1000">
                            <Binary className="absolute -top-10 -right-10 h-96 w-96 rotate-12" />
                            <Binary className="absolute -bottom-20 -left-10 h-80 w-80 -rotate-12 opacity-50" />
                        </div>
                        <div className="absolute -right-20 -bottom-20 h-96 w-96 bg-white/30 blur-[120px] rounded-full group-hover:bg-white/40 transition-colors" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

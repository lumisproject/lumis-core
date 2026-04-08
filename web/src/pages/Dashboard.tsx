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
    ExternalLink,
    LayoutDashboard
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';
import { ProjectSwitcher } from '@/components/layout/ProjectSwitcher';

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
                "group relative p-3 md:p-4 rounded-[2rem] border bg-card/30 backdrop-blur-3xl transition-all duration-500 overflow-hidden",
                accents[accent as keyof typeof accents],
                className
            )}
        >
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner transition-transform group-hover:rotate-6",
                            accents[accent as keyof typeof accents]
                        )}>
                            <Icon className="h-5 w-5 opacity-80" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tighter uppercase leading-none mb-1">{title}</h3>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{description}</p>
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
            className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 shadow-xl shadow-rose-500/10 p-4 md:p-5"
        >
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 flex items-center justify-center rounded-[1.2rem] bg-rose-500 text-white shadow-xl shadow-rose-500/30 overflow-hidden shrink-0">
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0" 
                        />
                        <Clock className="h-6 w-6 relative z-10" />
                    </div>
                    <div>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mb-0.5">
                            <h3 className="text-base md:text-lg font-black uppercase tracking-tighter text-rose-500 leading-tight">Velocity Collapse</h3>
                            <span className="px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-rose-500/20">Critical</span>
                        </div>
                        <p className="text-[11px] font-bold text-foreground opacity-80 max-w-2xl leading-relaxed">
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

const EmptyProjectAlert = () => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="group relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 shadow-xl shadow-rose-500/10 p-4 md:p-5"
        >
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 flex items-center justify-center rounded-[1.2rem] bg-rose-500 text-white shadow-xl shadow-rose-500/30 overflow-hidden shrink-0">
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0" 
                        />
                        <ShieldAlert className="h-6 w-6 relative z-10" />
                    </div>
                    <div>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mb-0.5">
                            <h3 className="text-base md:text-lg font-black uppercase tracking-tighter text-rose-500 leading-tight">Project Ingestion Failed</h3>
                            <span className="px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-rose-500/20">Indexing Skip</span>
                        </div>
                        <p className="text-[11px] font-bold text-foreground opacity-80 max-w-2xl leading-relaxed">
                            This project has failed to ingest any data.
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
    const { project, risks, loading: projectLoading, jiraConnected, projects, syncProject, jiraProjects, isEmpty, isUpToDate } = useProjectStore();
    const [syncing, setSyncing] = useState(false);
    const { tier, limits } = useBillingStore();
    const navigate = useNavigate();

    const isLimitReached = tier === 'free' && projects.length >= (limits?.projects || 3);
    const webhookUrl = project ? `${import.meta.env.VITE_API_URL}/api/webhook/${user?.id}/${project?.id}` : '';
    const [copied, setCopied] = useState(false);

    const [copiedSecret, setCopiedSecret] = useState(false);

    const handleCopySecret = () => {
        if (project?.webhook_secret) {
            navigator.clipboard.writeText(project.webhook_secret);
            setCopiedSecret(true);
            setTimeout(() => setCopiedSecret(false), 2000);
        }
    };
    
    const velocityRisk = risks.find(r => r.riskType === 'Predictive Delay');

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getRepoName = () => {
        const slug = project?.repo_name || project?.repo_url?.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        if (!slug) return 'Unlinked Node';
        return (slug.split('/').pop() ?? slug).replace(/\.git$/, '') || slug;
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
        <div className="relative h-screen flex flex-col pt-1 px-4 md:px-6 overflow-hidden bg-background">
            {/* Immersive Background Flourish */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/5 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-accent/20 blur-[150px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] dark:opacity-[0.05]"
                    style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <header className="flex items-center justify-between gap-4 py-4 shrink-0 border-b border-black/5 dark:border-white/5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                             <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Project Dashboard</h1>
                        </div>
                        <span className="text-muted-foreground/20 font-light text-xl">/</span>
                        <div className="flex items-center">
                            <ProjectSwitcher />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isLimitReached && (
                        <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-orange-500/5 border border-orange-500/10 text-orange-500 text-[9px] font-black uppercase tracking-widest leading-none">
                            <span className="h-1 w-1 rounded-full bg-orange-500" />
                            {limits?.projects || 3} Projects Max
                        </div>
                    )}
                    <button
                        onClick={() => !isLimitReached && navigate('/app/new-project')}
                        disabled={isLimitReached}
                        className={cn(
                            "h-10 px-6 rounded-full font-black uppercase tracking-[0.2em] text-[9px] transition-all flex items-center justify-center gap-2 border shadow-sm",
                            isLimitReached
                                ? "bg-muted text-muted-foreground cursor-not-allowed border-black/5"
                                : "bg-foreground text-background border-foreground hover:opacity-90 active:scale-95"
                        )}
                    >
                        <Plus className="h-4 w-4" />
                        NEW PROJECT
                    </button>
                </div>
            </header>


            <div className="flex-grow overflow-y-auto custom-scrollbar pt-4 pb-19 space-y-4 pr-1">

            {velocityRisk && project && (
                <VelocityAlert risk={velocityRisk} />
            )}

            {isEmpty && project && (
                <EmptyProjectAlert />
            )}

            {!isUpToDate && project && (
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10 flex-grow content-start">
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
                        <div className="space-y-4">
                            <div className="flex items-center gap-6">
                                <a 
                                    href={project?.repo_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-xl transition-all hover:scale-110 flex-shrink-0 group/logo cursor-pointer"
                                >
                                    <Github className="h-6 w-6 md:h-7 md:w-7 transition-transform group-hover/logo:scale-110" />
                                </a>
                                <div className="min-w-0 flex-1">
                                    <div className="text-lg md:text-2xl font-black tracking-tighter uppercase leading-none break-all">{getRepoName()}</div>
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mt-1 md:mt-2">
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
                                    {isUpToDate ? (
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
                        <Link to="/app/risks" className="mt-4 flex items-center justify-between p-3 rounded-xl bg-accent/50 border border-black/5 dark:border-white/5 group/link hover:bg-primary transition-all">
                            <span className="text-[9px] font-black uppercase tracking-widest group-hover/link:text-primary-foreground">Security Audit</span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1 group-hover/link:text-primary-foreground" />
                        </Link>
                    </IntelligencePanel>
                </div>

                {/* INTEGRATION & ECOSYSTEM LAYER */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* WEBHOOK CONNECTION PANEL */}
                    <IntelligencePanel
                        title="GitHub Webhook Connection"
                        description="Real-time Codebase Bridge"
                        icon={Webhook}
                        accent="primary"
                        className="h-full"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4 p-4 rounded-2xl bg-accent/20 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                        project?.webhook_secret ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-orange-500/10 text-orange-500 shadow-lg shadow-orange-500/10"
                                    )}>
                                        <Github className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase tracking-tighter">Webhook Status</span>
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            <div className={cn("h-1.5 w-1.5 rounded-full", project?.webhook_secret ? "bg-emerald-500 animate-pulse" : "bg-orange-500")} />
                                            <span className={cn("text-[9px] font-black uppercase tracking-[0.1em]", project?.webhook_secret ? "text-emerald-500" : "text-orange-500")}>
                                                {project?.webhook_secret ? "Successfully Connected" : "Not Linked"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {project?.webhook_secret && (
                                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                                        <Check className="h-4 w-4" />
                                    </div>
                                )}
                            </div>

                            {!project?.webhook_secret && (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-orange-500/[0.03] border border-orange-500/10 border-dashed">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-3 flex items-center gap-2">
                                            <ShieldAlert className="h-3 w-3" />
                                            Manual Bridge Configuration
                                        </h4>
                                        <div className="space-y-3">
                                            {[
                                                { step: '1', text: 'Go to Settings > Webhooks in your GitHub repo.' },
                                                { step: '2', text: 'Add a new webhook with the following details:' },
                                            ].map((s, i) => (
                                                <div key={i} className="flex gap-3 items-start">
                                                    <span className="text-[8px] font-black h-4 w-4 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                                                    <p className="text-[9px] font-medium text-muted-foreground leading-tight">{s.text}</p>
                                                </div>
                                            ))}
                                            
                                            <div className="grid grid-cols-1 gap-2 mt-2">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Payload URL</span>
                                                    <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2 border border-white/5">
                                                        <code className="text-[8px] font-mono text-primary flex-1 truncate">{webhookUrl}</code>
                                                        <button onClick={handleCopy} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                                                            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-primary" />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Secret (Randomized)</span>
                                                    <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2 border border-white/5">
                                                        <code className="text-[8px] font-mono text-primary flex-1 truncate">Temporary Manual Secret Provided below</code>
                                                        <button onClick={handleCopySecret} className="p-1.5 hover:bg-white/10 rounded-md transition-colors">
                                                            {copiedSecret ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-primary" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] font-black h-4 w-4 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">3</span>
                                                    <p className="text-[9px] font-medium text-muted-foreground">Select <span className="text-foreground font-black uppercase">application/json</span> as content type.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[8px] font-black h-4 w-4 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">4</span>
                                                    <p className="text-[9px] font-medium text-muted-foreground">Select <span className="text-foreground font-black uppercase">Just the push event</span>.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {project?.webhook_secret && (
                                <div className="mt-auto p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                        <RefreshCw className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-0.5 text-left">Live Sync Active</h5>
                                        <p className="text-[9px] text-muted-foreground font-medium text-left">Push events are being synthesized in real-time. Codebase map is synchronized.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </IntelligencePanel>
                    {/* PROJECT MANAGEMENT & ACTION COLUMN */}
                    <div className="flex flex-col gap-4 h-full">
                        {/* SYSTEM BRAIN - NEURAL QUERY INTERFACE */}
                        <div className="relative p-8 rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 overflow-hidden group shadow-2xl flex-grow flex flex-col justify-center min-h-[200px] border border-white/5">
                            {/* Decorative Background Binary - High Clarity Adjust */}
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 select-none pointer-events-none opacity-[0.07]">
                                <div className="text-[120px] font-black leading-none tracking-tighter text-white/50 flex flex-col items-center">
                                    <span>01</span>
                                    <span>10</span>
                                </div>
                            </div>
                            
                            <div className="relative z-10 flex flex-col gap-6 items-start text-left">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-3 w-3 text-white fill-white" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Neural Query</span>
                                </div>

                                <div className="space-y-1">
                                    <h4 className="text-3xl font-black tracking-tight text-white leading-tight">
                                        INITIATE<br />BRAIN ACCESS
                                    </h4>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Link 
                                        to="/app/chat" 
                                        className="h-10 px-6 rounded-full bg-white text-black text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/90 transition-all shadow-xl active:scale-95"
                                    >
                                        System Chat <ArrowRight className="h-3 w-3" />
                                    </Link>
                                    
                                    <Link 
                                        to="/app/architecture" 
                                        className="h-10 px-6 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
                                    >
                                        <Binary className="h-3 w-3" /> Architecture
                                    </Link>

                                    <Link 
                                        to="/app/board" 
                                        className="h-10 px-6 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/20 hover:bg-white/20 transition-all active:scale-95"
                                    >
                                        <LayoutDashboard className="h-3 w-3" /> Board
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <IntelligencePanel
                            title="Project Management"
                            description="External Planning Mesh"
                            icon={Layers}
                            accent="primary"
                            className="shrink-0"
                        >
                            <div className="flex flex-col gap-4">
                                {[
                                    { 
                                        label: 'Jira', 
                                        icon: Search, 
                                        connected: jiraConnected, 
                                        mapped: !!project?.jira_project_id,
                                        detail: project?.jira_project_id ? `Linked: ${getJiraProjectName()}` : 'Platform Mapped'
                                    },
                                    { 
                                        label: 'Notion', 
                                        icon: Cpu, 
                                        connected: false, 
                                        mapped: false, 
                                        soon: true 
                                    }   
                                ].map((integ, i) => (
                                    <div key={i} className="group/item flex items-center justify-between p-4 rounded-[1.8rem] bg-accent/10 border border-black/5 dark:border-white/5 transition-all hover:bg-accent/20">
                                        <div className="flex items-center gap-4 text-left">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                integ.connected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                                                (integ.soon ? "bg-yellow-500/10 text-yellow-500 opacity-40" : "bg-muted/20 text-muted-foreground opacity-40")
                                            )}>
                                                <integ.icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{integ.label}</span>
                                                
                                                {integ.soon ? (
                                                    <span className="text-[7px] font-black text-yellow-500 uppercase tracking-[0.2em] px-2 py-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/20 w-fit">In Development</span>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <div className={cn("h-1 w-1 rounded-full", integ.connected ? "bg-primary" : "bg-muted")} />
                                                        <span className={cn("text-[9px] font-black uppercase tracking-widest", integ.connected ? "text-primary" : "text-muted-foreground opacity-40")}>
                                                            {integ.connected ? (integ.detail) : 'Not Linked'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {!integ.soon && (
                                            <Link 
                                                to="/app/settings" 
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all",
                                                    integ.connected 
                                                        ? "bg-primary/5 text-primary border border-primary/20 hover:bg-primary/20" 
                                                        : "bg-white/5 text-muted-foreground border border-black/10 dark:border-white/10 hover:bg-white/10"
                                                )}
                                            >
                                                {integ.connected ? 'CONFIGURE' : 'CONNECT'}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </IntelligencePanel>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default Dashboard;

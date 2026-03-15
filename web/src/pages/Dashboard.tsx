import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldAlert,
    GitBranch,
    Copy,
    Check,
    Webhook,
    Github,
    Cpu,
    ArrowRight,
    Search,
    Zap,
    Plus,
    AlertTriangle,
    RefreshCw
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { cn } from '@/lib/utils';
import { useNavigate, Link } from 'react-router-dom';

const BentoCard = ({ children, className, title, icon: Icon, description }: any) => (
    <motion.div
        whileHover={{ y: -4 }}
        className={cn(
            "relative flex flex-col p-8 rounded-[3rem] border border-black/5 bg-card/40 backdrop-blur-xl dark:border-white/5 overflow-hidden",
            className
        )}
    >
        <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/50 text-primary border border-black/5 dark:border-white/5 shadow-inner">
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight opacity-50">{description}</p>
                </div>
            </div>
        </div>
        <div className="flex-1 relative z-10">
            {children}
        </div>
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/5 blur-[100px]" />
    </motion.div>
);

const RiskCounter = ({ risks }: { risks: any[] }) => {
    const high = risks.filter(r => r.severity === 'high').length;
    const medium = risks.filter(r => r.severity === 'medium').length;
    const low = risks.filter(r => r.severity === 'low').length;

    return (
        <div className="grid grid-cols-3 gap-3">
            {[
                { label: 'High', count: high, color: 'text-destructive', bg: 'bg-destructive/10' },
                { label: 'Medium', count: medium, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                { label: 'Low', count: low, color: 'text-green-500', bg: 'bg-green-500/10' }
            ].map((stat, i) => (
                <div key={i} className={cn("rounded-2xl p-4 text-center border border-black/5 dark:border-white/5", stat.bg)}>
                    <div className={cn("text-xl font-black", stat.color)}>{stat.count}</div>
                    <div className={cn("text-[9px] uppercase tracking-widest font-black opacity-60", stat.color)}>{stat.label}</div>
                </div>
            ))}
        </div>
    );
};

const Dashboard = () => {
    const { user } = useUserStore();
    const { project, risks, loading: projectLoading, jiraConnected, notionConnected, projects, syncProject } = useProjectStore();
    const [syncing, setSyncing] = useState(false);
    const { tier } = useBillingStore();
    const navigate = useNavigate();

    const isLimitReached = tier === 'free' && projects.length >= 1;

    // We no longer need to trigger fetches here as they are handled globally in Layout.tsx
    // and reactively in the useProjectStore.

    const getRepoName = () => {
        const slug = project?.repo_name || project?.repo_url?.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
        if (!slug) return 'Unlinked Instance';
        return slug.split('/').pop() || slug;
    };

    const webhookUrl = project ? `https://unsparing-kaley-unmodest.ngrok-free.dev/api/webhook/${user?.id}/${project?.id}` : '';
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (projectLoading && !project) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Zap className="h-8 w-8 text-primary animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Synchronizing Neural Workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 p-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Stats Area */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <BentoCard
                        title="Risk Matrix"
                        description="Predictive Threat Detection"
                        icon={ShieldAlert}
                        className="md:col-span-1"
                    >
                        <RiskCounter risks={risks} />
                        <Link to="/app/risks" className="mt-8 flex items-center justify-between p-4 rounded-2xl bg-accent/50 border border-black/5 dark:border-white/5 group hover:bg-accent transition-all">
                            <span className="text-[10px] font-black uppercase tracking-widest">Full Security Audit</span>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </BentoCard>

                    <BentoCard
                        title="Knowledge Fabric"
                        description="Atlassian & Notion Sync"
                        icon={Cpu}
                        className="md:col-span-1"
                    >
                        <div className="space-y-3">
                            {[
                                { label: 'Jira', icon: Search, connected: jiraConnected },
                                { label: 'Notion', icon: Cpu, connected: notionConnected }
                            ].map((integ, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 border border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", integ.connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                                            <integ.icon className="h-4 w-4" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{integ.label} Hub</span>
                                    </div>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", integ.connected ? "bg-primary shadow-[0_0_8px_primary]" : "bg-muted")} />
                                </div>
                            ))}
                        </div>
                    </BentoCard>

                    <BentoCard
                        title="Unified Gateway"
                        description="Real-time Webhook Link"
                        icon={Webhook}
                        className="md:col-span-2"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex-1 bg-accent/30 rounded-2xl border border-black/5 dark:border-white/5 p-4 min-w-0">
                                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Secure Endpoint URI</div>
                                <div className="text-[10px] font-mono font-bold truncate opacity-80">{webhookUrl || 'Awaiting Instance Link...'}</div>
                            </div>
                            <button 
                                onClick={handleCopy}
                                className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                            </button>
                        </div>
                    </BentoCard>
                </div>

                {/* Side Intelligence Column */}
                <div className="lg:col-span-4 space-y-8">
                    <BentoCard
                        title="Hardware Sync"
                        description="GitHub Instance Analysis"
                        icon={Github}
                    >
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-2xl">
                                    <GitBranch className="h-8 w-8" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-lg font-black tracking-tighter truncate uppercase leading-none">{getRepoName().split('/').pop()}</div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Branch: Main/Master</div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-accent/30 border border-black/5 dark:border-white/5">
                                    <div className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Last Commit ID</div>
                                    <div className="text-xs font-mono font-bold mt-1 text-primary">{project?.last_commit?.slice(0, 7) || '---'}</div>
                                </div>
                                <button 
                                    onClick={async () => {
                                        if (!project) return;
                                        setSyncing(true);
                                        try {
                                            await syncProject(project.id);
                                        } finally {
                                            setSyncing(false);
                                        }
                                    }}
                                    disabled={syncing || project?.sync_state?.status === 'ingesting'}
                                    className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center gap-1 hover:bg-primary/20 transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={cn("h-4 w-4 text-primary", (syncing || project?.sync_state?.status === 'ingesting') && "animate-spin")} />
                                    <div className="text-[8px] font-black text-primary uppercase tracking-widest">
                                        {(syncing || project?.sync_state?.status === 'ingesting') ? 'SYNCING' : 'RE-SYNC'}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </BentoCard>

                    <div className="relative p-8 rounded-[3rem] bg-gradient-to-tr from-primary/10 to-accent/10 border border-primary/20 overflow-hidden group">
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-primary">
                                <Zap className="h-3 w-3" />
                                Neural Query
                            </div>
                            <h4 className="text-xl font-black tracking-tight uppercase leading-tight">Interact with your Intelligence layer</h4>
                            <Link to="/app/chat" className="inline-flex h-10 px-6 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20">
                                Launch Brain
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                        <div className="absolute -right-8 -bottom-8 h-32 w-32 bg-primary/20 blur-3xl rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

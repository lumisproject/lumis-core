import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Github, Globe, Plus, RefreshCw, Settings as SettingsIcon, Shield, ShieldCheck, Plug, Link2, Search, Book, ChevronRight, Database, Zap } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { API_BASE } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const NewProject = () => {
    const [selectedRepo, setSelectedRepo] = useState<any>(null);
    const [publicUrl, setPublicUrl] = useState('');
    const [ingestMode, setIngestMode] = useState<'github' | 'public'>('github');
    const [loading, setLoading] = useState(false);
    const [orgAccessError, setOrgAccessError] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const {
        startIngestion, projects, fetchProjects,
        githubConnected, fetchGithubStatus,
        githubRepos, fetchGithubRepos, setupGithubWebhook,
        selectProject, pollIngestionStatus, ingestionStatus
    } = useProjectStore();

    const { tier, fetchBilling, limits } = useBillingStore();
    const { user } = useUserStore();
    const { useDefault, provider, selectedModel, apiKey } = useSettingsStore();
    const navigate = useNavigate();

    const isConfigComplete = useDefault || (provider && selectedModel && apiKey);
    const isLimitReached = tier === 'free' && projects.length >= (limits?.projects || 3);

    const filteredRepos = useMemo(() => {
        if (!searchTerm) return githubRepos;
        return githubRepos.filter(repo =>
            repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [githubRepos, searchTerm]);

    // Fetch GitHub status and repos on mount
    useEffect(() => {
        if (user?.id) {
            fetchGithubStatus(user.id);
        }
    }, [user?.id, fetchGithubStatus]);

    useEffect(() => {
        if (user?.id && githubConnected) {
            fetchGithubRepos(user.id);
        }
    }, [user?.id, githubConnected, fetchGithubRepos]);

    const handleIngest = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetUrl = ingestMode === 'github' ? selectedRepo?.url : publicUrl;

        if (!targetUrl || !user?.id) return;

        if (isLimitReached) {
            alert(`Tier Limit Reached: Free Tier is limited to ${limits?.projects || 3} repositories.`);
            return;
        }

        if (!isConfigComplete) {
            alert("AI Engine Unconfigured: You must configure your own LLM in Settings.");
            navigate('/app/settings');
            return;
        }

        setLoading(true);
        setOrgAccessError(false); // Reset error state

        try {
            const projectId = await startIngestion(user.id, targetUrl);

            if (projectId) {
                // Try to set up the webhook only if it's GitHub connected
                if (ingestMode === 'github' && selectedRepo?.full_name) {
                    try {
                        await setupGithubWebhook(user.id, projectId, selectedRepo.full_name);
                    } catch (webhookError: any) {
                        if (webhookError.message === 'ORG_ACCESS_REQUIRED') {
                            setOrgAccessError(true);
                            setLoading(false);
                            return;
                        }
                    }
                }

                // Polling logic to wait for completion
                const checkStatus = async () => {
                    const status = await pollIngestionStatus(projectId);
                    if (status?.status === 'ready') {
                        localStorage.setItem('lumis_active_project', projectId);
                        await fetchBilling();
                        await fetchProjects(user.id);
                        selectProject(projectId);
                        setLoading(false);
                        navigate(`/app`);
                    } else if (status?.status === 'failed') {
                        setLoading(false);
                        alert("Ingestion failed: " + (status.error || "Unknown error"));
                    } else {
                        setTimeout(checkStatus, 2000);
                    }
                };

                checkStatus();
            }
        } catch (error) {
            console.error("Ingestion failed:", error);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pt-4 px-8 pb-12 animate-fade-in min-h-[calc(100vh-2rem)]">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-xs font-bold uppercase tracking-widest"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Command Center
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                <div className="space-y-8 mt-10">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[2rem] bg-primary/10 border border-primary/20 text-primary shadow-2xl">
                        <Github className="h-8 w-8" />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight uppercase">Connect Repository</h1>
                        <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed">
                            Lumis will parse and index your codebase. Select a synchronized repository to begin.
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 pt-4">
                        {[
                            { icon: ShieldCheck, title: "Secure Access", desc: "Private & Encrypted GitHub Sync" },
                            { icon: Database, title: "Codebase Indexing", desc: "Deep Analysis of your Architecture" },
                            { icon: Zap, title: "Automated Webhooks", desc: "Always up to date with zero config" }
                        ].map((feat, i) => (
                            <div key={i} className="flex gap-4 items-start">
                                <div className="mt-1 h-5 w-5 text-primary">
                                    <feat.icon className="h-full w-full" />
                                </div>
                                <div>
                                    <div className="text-sm font-black uppercase tracking-widest">{feat.title}</div>
                                    <div className="text-xs text-muted-foreground font-medium mt-1">{feat.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative group p-1">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 blur-3xl rounded-[3rem] opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative glass-panel rounded-[2.5rem] p-7 border border-black/5 dark:border-white/5 space-y-6 shadow-2xl bg-card">

                        <div className="flex bg-accent/30 p-1 rounded-2xl border border-black/5 dark:border-white/5 mb-6">
                            <button
                                onClick={() => setIngestMode('github')}
                                className={cn(
                                    "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                                    ingestMode === 'github' ? "bg-background shadow-lg text-foreground border border-black/5 dark:border-white/5" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Github className="h-4 w-4" />
                                My Repos
                            </button>
                            <button
                                onClick={() => setIngestMode('public')}
                                className={cn(
                                    "flex-1 py-3 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                                    ingestMode === 'public' ? "bg-background shadow-lg text-foreground border border-black/5 dark:border-white/5" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Globe className="h-4 w-4" />
                                Public URL
                            </button>
                        </div>

                        {ingestMode === 'github' && !githubConnected ? (
                            <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center animate-in fade-in zoom-in-95 duration-300">
                                <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center">
                                    <Github className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black uppercase tracking-tight">GitHub Not Connected</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Link your account to automatically fetch your repositories.</p>
                                </div>
                                <button
                                    onClick={() => window.location.href = `${API_BASE}/auth/github/connect?state=${user?.id}`}
                                    className="w-full flex h-14 items-center justify-center gap-3 rounded-2xl bg-neutral-900 text-white text-xs font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-black/20 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                                >
                                    <Plug className="h-5 w-5" />
                                    Link GitHub Profile
                                </button>
                            </div>
                        ) : loading ? (
                            <div className="py-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="relative h-20 w-20">
                                        <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                        <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <RefreshCw className="h-6 w-6 text-primary animate-spin-slow" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">Neural Threading Active</h3>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{ingestionStatus?.step || 'Synthesizing Architecture'}</p>
                                    </div>
                                </div>



                            </div>
                        ) : (
                            <div className="animate-in fade-in zoom-in-95 duration-300">
                                {ingestMode === 'github' && orgAccessError && (
                                    <div className="flex flex-col gap-3 rounded-3xl bg-destructive/10 p-6 border border-destructive/20 mb-6 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-destructive" />
                                            <div className="text-xs font-black uppercase tracking-widest text-destructive">
                                                Organization Access Blocked
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
                                            GitHub prevented Lumis from setting up the webhook. You must explicitly grant Lumis access to this organization in your GitHub settings.
                                        </p>
                                        <a
                                            href={`https://github.com/settings/connections/applications/${import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23limKRldRHzKDb2Xc'}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-destructive text-[10px] font-black uppercase tracking-widest text-destructive-foreground hover:bg-destructive/90 transition-all mt-2"
                                            onClick={() => setOrgAccessError(false)}
                                        >
                                            <Plug className="h-4 w-4" />
                                            Grant Access on GitHub
                                        </a>
                                    </div>
                                )}
                                <form onSubmit={handleIngest} className="space-y-6">
                                    {ingestMode === 'github' ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Select Repository</label>
                                                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">Showing {filteredRepos.length} synchronized projects</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-primary flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Connected</span>
                                            </div>

                                            {/* Search Bar */}
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Search repositories..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-accent/20 border border-black/5 dark:border-white/5 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                                                />
                                            </div>

                                            <div className="max-h-[220px] overflow-y-auto pr-2 space-y-2 custom-scrollbar custom-scrollbar-thin">
                                                {filteredRepos.length > 0 ? (
                                                    filteredRepos.map((repo) => (
                                                        <div
                                                            key={repo.id}
                                                            onClick={() => setSelectedRepo(repo)}
                                                            className={cn(
                                                                "group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden",
                                                                selectedRepo?.id === repo.id
                                                                    ? "bg-primary/[0.04] border-primary/40 shadow-[0_8px_20px_rgba(var(--primary),0.05)] dark:bg-primary/[0.08]"
                                                                    : "bg-accent/10 border-black/5 dark:border-white/5 hover:bg-accent/20 hover:border-black/10 dark:hover:border-white/10"
                                                            )}
                                                        >
                                                            {selectedRepo?.id === repo.id && (
                                                                <div className="absolute top-0 right-0 h-10 w-10 overflow-hidden">
                                                                    <div className="absolute top-0 right-0 h-[1px] w-[200%] bg-primary translate-x-[50%] rotate-45 shadow-[0_0_8px_theme(colors.primary.DEFAULT)]" />
                                                                </div>
                                                            )}

                                                            <div className="flex items-start justify-between gap-4 relative z-10">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={cn(
                                                                        "h-9 w-9 rounded-xl flex items-center justify-center border transition-all shrink-0",
                                                                        selectedRepo?.id === repo.id
                                                                            ? "bg-primary/10 border-primary/20 text-primary"
                                                                            : "bg-background border-black/5 dark:border-white/5 text-muted-foreground group-hover:border-primary/20 group-hover:text-primary"
                                                                    )}>
                                                                        <Book className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={cn(
                                                                                "text-[13px] font-black tracking-tight truncate",
                                                                                selectedRepo?.id === repo.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                                                                            )}>
                                                                                {repo.name}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] text-muted-foreground/60 truncate leading-none mt-1">
                                                                            {repo.full_name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <ChevronRight className={cn(
                                                                        "h-4 w-4 transition-all",
                                                                        selectedRepo?.id === repo.id ? "text-primary translate-x-0" : "text-muted-foreground/20 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                                                                    )} />
                                                                </div>
                                                            </div>

                                                            {repo.description && (
                                                                <p className="mt-3 text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed font-medium">
                                                                    {repo.description}
                                                                </p>
                                                            )}

                                                            <div className="mt-3 flex items-center gap-3">
                                                                {repo.language && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/30 border border-black/5 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                        {repo.language}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                                        <Search className="h-8 w-8 text-muted-foreground/20 mb-3" />
                                                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/40">No repositories matching your search</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Repository URL</label>
                                                <span className="text-[10px] font-bold text-primary flex items-center gap-1"><Link2 className="h-3 w-3" /> Public Link</span>
                                            </div>
                                            <input
                                                type="url"
                                                placeholder="https://github.com/username/repo"
                                                value={publicUrl}
                                                onChange={(e) => setPublicUrl(e.target.value)}
                                                className="flex h-12 w-full rounded-2xl border border-black/5 bg-accent/30 px-6 text-[13px] font-medium transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || (ingestMode === 'github' ? !selectedRepo : !publicUrl) || !isConfigComplete}
                                        className={cn(
                                            "w-full flex h-12 items-center justify-center gap-3 rounded-2xl font-black tracking-[0.2em] text-[10px] uppercase shadow-2xl transition-all",
                                            loading || (ingestMode === 'github' ? !selectedRepo : !publicUrl) || !isConfigComplete
                                                ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                                : "bg-primary text-primary-foreground shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                                        )}
                                    >
                                        {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                        {loading ? 'Automating Setup...' : 'Import & Index'}
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="pt-6 border-t border-black/5 dark:border-white/5 space-y-3">
                            {!isConfigComplete && (
                                <div className="flex flex-col gap-2.5 rounded-2xl bg-orange-500/10 p-5 border border-orange-500/20">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-3.5 w-3.5 text-orange-500" />
                                        <div className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                                            LLM Configuration Required
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground font-medium uppercase leading-relaxed">
                                        The indexing engine requires a custom LLM model to parse and map code logic.
                                    </p>
                                    <Link to="/app/settings" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors">
                                        <SettingsIcon className="h-2.5 w-2.5" />
                                        Setup Provider
                                    </Link>
                                </div>
                            )}

                            {isLimitReached ? (
                                <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 border border-destructive/20">
                                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                    <div className="text-[10px] font-black uppercase tracking-widest text-destructive">
                                        Tier Limit Reached: {limits?.projects || 3} Projects Max
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 rounded-2xl bg-accent/30 p-4 border border-black/5 dark:border-white/5">
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {loading
                                            ? 'Configuring Webhooks & Indexing...'
                                            : ingestMode === 'public'
                                                ? 'Ready to ingest public repository'
                                                : githubConnected
                                                    ? 'Ready to initiate sync'
                                                    : 'Connect account to proceed'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewProject;
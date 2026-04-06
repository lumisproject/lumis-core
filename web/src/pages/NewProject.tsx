import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Github, Plus, RefreshCw, ArrowLeft, ShieldCheck, Zap, Database, Shield, Settings as SettingsIcon, Plug } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { API_BASE } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const NewProject = () => {
    const [selectedRepo, setSelectedRepo] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [orgAccessError, setOrgAccessError] = useState(false);
    
    const { 
        startIngestion, projects, fetchProjects, 
        githubConnected, fetchGithubStatus, 
        githubRepos, fetchGithubRepos, setupGithubWebhook 
    } = useProjectStore();
    
    const { tier, fetchBilling } = useBillingStore();
    const { user } = useUserStore();
    const { useDefault, provider, selectedModel, apiKey } = useSettingsStore();
    const navigate = useNavigate();

    const isConfigComplete = useDefault || (provider && selectedModel && apiKey);
    const isLimitReached = tier === 'free' && projects.length >= 1;

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
        if (!selectedRepo || !user?.id) return;
        
        if (isLimitReached) {
            alert("Tier Limit Reached: Free Tier is limited to 1 active repository.");
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
            const projectId = await startIngestion(user.id, selectedRepo.url);
            
            if (projectId) {
                // Try to set up the webhook
                try {
                    await setupGithubWebhook(user.id, projectId, selectedRepo.full_name);
                } catch (webhookError: any) {
                    // Check if it's our specific Org Access error
                    if (webhookError.message === 'ORG_ACCESS_REQUIRED') {
                        setOrgAccessError(true);
                        setLoading(false);
                        return; // Stop the redirect so they can see the error!
                    }
                }
                
                await fetchBilling();
                await fetchProjects(user.id);
                navigate(`/app`); 
            }
        } catch (error) {
            console.error("Ingestion failed:", error);
        } finally {
            if (!orgAccessError) setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8 animate-fade-in">
            <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-xs font-bold uppercase tracking-widest"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Command Center
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-[2rem] bg-primary/10 border border-primary/20 text-primary shadow-2xl">
                        <Github className="h-8 w-8" />
                    </div>
                    
                    <div className="space-y-4">
                        <h1 className="text-5xl font-black tracking-tighter leading-tight uppercase">Connect Repository</h1>
                        <p className="text-lg text-muted-foreground font-medium leading-relaxed">
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
                    <div className="relative glass-panel rounded-[3rem] p-10 border border-black/5 dark:border-white/5 space-y-8 shadow-2xl bg-card">
                        
                        {!githubConnected ? (
                            <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
                                <div className="h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center">
                                    <Github className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black uppercase tracking-tight">GitHub Not Connected</h3>
                                    <p className="text-sm text-muted-foreground font-medium">Link your account to automatically fetch your repositories and set up webhooks.</p>
                                </div>
                                <button
                                    onClick={() => window.location.href = `${API_BASE}/auth/github/connect?state=${user?.id}`}
                                    className="w-full flex h-14 items-center justify-center gap-3 rounded-2xl bg-neutral-900 text-white text-xs font-black uppercase tracking-widest hover:bg-neutral-800 transition-all border border-black/20 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                                >
                                    <Plug className="h-5 w-5" />
                                    Link GitHub Profile
                                </button>
                            </div>
                        ) : (
                            <>
                                {orgAccessError && (
                                <div className="flex flex-col gap-3 rounded-3xl bg-destructive/10 p-6 border border-destructive/20 animate-in fade-in slide-in-from-top-2">
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
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Select Repository</label>
                                            <span className="text-[10px] font-bold text-primary flex items-center gap-1"><ShieldCheck className="h-3 w-3"/> Connected</span>
                                        </div>
                                        <select
                                            value={selectedRepo?.id || ""}
                                            onChange={(e) => {
                                                const repo = githubRepos.find(r => r.id.toString() === e.target.value);
                                                setSelectedRepo(repo);
                                            }}
                                            className="flex h-14 w-full rounded-2xl border border-black/5 bg-accent/30 px-6 text-sm font-medium transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5 appearance-none"
                                        >
                                            <option value="" disabled>-- Choose a synchronized repository --</option>
                                            {githubRepos.map((repo) => (
                                                <option key={repo.id} value={repo.id}>
                                                    {repo.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <button
                                        type="submit"
                                        disabled={loading || !selectedRepo || !isConfigComplete}
                                        className={cn(
                                            "w-full flex h-14 items-center justify-center gap-3 rounded-2xl font-black tracking-[0.2em] text-xs uppercase shadow-2xl transition-all",
                                            loading || !selectedRepo || !isConfigComplete
                                                ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                                : "bg-primary text-primary-foreground shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                                        )}
                                    >
                                        {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                        {loading ? 'Automating Setup...' : 'Import & Index'}
                                    </button>
                                </form>
                            </>
                        )}

                        <div className="pt-8 border-t border-black/5 dark:border-white/5 space-y-4">
                            {!isConfigComplete && (
                                <div className="flex flex-col gap-3 rounded-3xl bg-orange-500/10 p-6 border border-orange-500/20">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-orange-500" />
                                        <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                                            LLM Configuration Required
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
                                        The indexing engine requires a custom LLM model to parse and map code logic.
                                    </p>
                                    <Link to="/app/settings" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors">
                                        <SettingsIcon className="h-3 w-3" />
                                        Setup Provider in Settings
                                    </Link>
                                </div>
                            )}

                            {isLimitReached ? (
                                <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 p-4 border border-destructive/20">
                                    <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                                    <div className="text-[10px] font-black uppercase tracking-widest text-destructive">
                                        Tier Limit Reached: 1 Project Max
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 rounded-2xl bg-accent/30 p-4 border border-black/5 dark:border-white/5">
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {loading 
                                            ? 'Configuring Webhooks & Indexing...' 
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
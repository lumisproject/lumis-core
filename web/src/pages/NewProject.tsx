import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Plus, RefreshCw, ArrowLeft, ShieldCheck, Zap, Database, Shield, Settings as SettingsIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NewProject = () => {
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const { startIngestion, projects, fetchProjects } = useProjectStore();
    const { tier, fetchBilling } = useBillingStore();
    const { user } = useUserStore();
    const { useDefault, provider, selectedModel, apiKey } = useSettingsStore();
    const navigate = useNavigate();

    const isConfigComplete = useDefault || (provider && selectedModel && apiKey);
    const isLimitReached = tier === 'free' && projects.length >= 1;

    const handleIngest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoUrl || !user?.id) return;
        
        if (isLimitReached) {
            alert("Protocol Violation: Free Tier is limited to 1 active repository. Please upgrade your subscription to ingest more projects.");
            return;
        }

        if (!isConfigComplete) {
            alert("Inference Bridge Offline: You must configure your own LLM (Provider, API Key, and Model) in Settings before you can index a repository.");
            navigate('/app/settings');
            return;
        }

        setLoading(true);
        try {
            const projectId = await startIngestion(user.id, repoUrl);
            await fetchBilling();
            if (projectId) {
                await fetchProjects(user.id);
                navigate(`/app`); 
            }
        } catch (error) {
            console.error("Ingestion failed:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in">
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
                        <h1 className="text-5xl font-black tracking-tighter leading-tight uppercase">Initiate Core Protocol</h1>
                        <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                            Lumis will parse, index, and monitor your intelligence layer. Paste your repository link to begin secure indexing.
                        </p>
                    </div>

                    <div className="flex flex-col gap-6 pt-4">
                        {[
                            { icon: ShieldCheck, title: "Secure Handshake", desc: "Encrypted OAuth & Private Access" },
                            { icon: Database, title: "Deep Vector Indexing", desc: "Full Architectural Content Analysis" },
                            { icon: Zap, title: "Real-time Sync", desc: "Live Webhook Logic Mapping" }
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
                    <div className="relative glass-panel rounded-[3rem] p-10 border border-black/5 dark:border-white/5 space-y-8 shadow-2xl">
                        <form onSubmit={handleIngest} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">GitHub Repository URI</label>
                                <input
                                    type="text"
                                    placeholder="https://github.com/organization/core-intelligence"
                                    value={repoUrl}
                                    onChange={(e) => setRepoUrl(e.target.value)}
                                    className="flex h-14 w-full rounded-2xl border border-black/5 bg-accent/30 px-6 text-sm font-medium transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                                />
                            </div>
                            
                            <button
                                type="submit"
                                disabled={loading || !repoUrl || !isConfigComplete}
                                className={cn(
                                    "w-full flex h-14 items-center justify-center gap-3 rounded-2xl font-black tracking-[0.2em] text-xs uppercase shadow-2xl transition-all",
                                    loading || !repoUrl || !isConfigComplete
                                        ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                        : "bg-primary text-primary-foreground shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                                )}
                            >
                                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                {loading ? 'Indexing...' : 'Start Indexing'}
                            </button>
                        </form>

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
                                            ? 'Lumis Actived: Indexing in progress...' 
                                            : repoUrl 
                                                ? 'Ready to initiate sync' 
                                                : 'Insert your repository URL'}
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

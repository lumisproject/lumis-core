import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    User,
    Save,
    CheckCircle2,
    RefreshCw,
    Cpu,
    ShieldCheck,
    Lock,
    Plug,
    BookOpen,
    Search,
    ChevronDown,
    AlertTriangle,
    Sun,
    Moon,
    Monitor,
    PartyPopper,
    Github,
    Trello,
    Network,
    Link2
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import { API_BASE, supabase } from '@/lib/supabase';

// --- Reusable UI Components ---

const SettingSection = ({ title, description, children, icon: Icon }: any) => (
    <div className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-12 border-b border-black/5 dark:border-white/5 last:border-0">
        <div className="lg:col-span-4 pr-8">
            <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    {Icon && <Icon className="h-4 w-4" />}
                </div>
                <h3 className="text-lg font-black tracking-tight uppercase">{title}</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground font-medium">{description}</p>
        </div>
        <div className="lg:col-span-8 space-y-6">
            {children}
        </div>
    </div>
);

const ModernSelect = ({ label, icon: Icon, value, onChange, options, placeholder, loading }: any) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2 relative">
            {label && <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>}
            <div
                onClick={() => !loading && setOpen(!open)}
                className={cn(
                    "flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 bg-background px-4 text-sm transition-all hover:border-black/10 dark:border-white/5 dark:hover:border-white/10 shadow-sm",
                    open && "border-primary/50 ring-4 ring-primary/10 dark:border-primary/50"
                )}
            >
                <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(!value && "text-muted-foreground font-medium", "text-xs font-bold")}>
                        {loading ? 'Fetching records...' : options.find((o: any) => o.id === value || o.key === value)?.name || value || placeholder}
                    </span>
                </div>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /> : <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />}
            </div>

            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 5, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[320px] overflow-y-auto rounded-2xl border border-black/10 bg-card p-2 shadow-2xl dark:border-white/10"
                        >
                            {options.length === 0 ? (
                                <div className="p-4 text-center text-xs font-medium text-muted-foreground">No records found. Link account first.</div>
                            ) : (
                                options.map((opt: any) => (
                                    <button
                                        key={opt.id || opt.key}
                                        onClick={() => {
                                            onChange(opt.id || opt.key);
                                            setOpen(false);
                                        }}
                                        className="w-full flex items-center rounded-xl px-3 py-3 text-left text-xs font-bold hover:bg-accent transition-colors"
                                    >
                                        {opt.name}
                                    </button>
                                ))
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = "text", hide = false, disabled = false }: any) => (
    <div className={cn("space-y-2", disabled && "opacity-50 pointer-events-none")}>
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
        <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
                <Icon className="h-4 w-4" />
            </div>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className="flex h-12 w-full rounded-2xl border border-black/5 bg-background pl-11 pr-4 text-xs font-bold transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5 shadow-sm"
            />
        </div>
        {hide && value && (
            <div className="flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-green-500 animate-in fade-in slide-in-from-top-1">
                <ShieldCheck className="h-3 w-3" />
                Inference Token Securely Stored
            </div>
        )}
    </div>
);

// --- Main Page ---

const Settings = () => {
    const { user } = useUserStore();
    const {
        project, jiraConnected, fetchJiraStatus, fetchNotionStatus, disconnectJira,
        updateJiraMapping, jiraProjects,
        githubConnected, fetchGithubStatus, disconnectGithub
    } = useProjectStore();
    
    const {
        useDefault, setUseDefault,
        provider, setProvider,
        apiKey, setApiKey,
        selectedModel, setSelectedModel,
        theme, setTheme,
        baseUrl, setBaseUrl,
        resetDirty, _isDirty
    } = useSettingsStore();

    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showBillingSuccess, setShowBillingSuccess] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const billingSuccess = params.get('billing') === 'success';
        const msg = params.get('message');
        const err = params.get('error');

        if (billingSuccess) {
            setShowBillingSuccess(true);
            setTimeout(() => {
                setShowBillingSuccess(false);
                navigate('/app/billing', { replace: true });
            }, 5000);
        } else if (msg || err) {
            if (msg) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 5000);
            }
            navigate(location.pathname, { replace: true });
        }
    }, [location]);

    useEffect(() => {
        if (user?.id) {
            fetchJiraStatus(user.id);
            fetchNotionStatus(user.id);
            fetchGithubStatus(user.id);
        }
    }, [user?.id, project?.id, fetchJiraStatus, fetchNotionStatus, fetchGithubStatus]);

    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            if (!user?.id || hasLoaded || _isDirty) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch(`${API_BASE}/api/settings/${user.id}`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setUseDefault(data.useDefault);
                    setProvider(data.provider);
                    setSelectedModel(data.selectedModel);
                    setBaseUrl(data.baseUrl || "");
                    setApiKey(data.useDefault ? "" : data.apiKey);
                    setHasLoaded(true);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        };
        loadSettings();
    }, [user?.id, hasLoaded, _isDirty]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const payload = { provider, selectedModel, useDefault, apiKey, baseUrl };

            const res = await fetch(`${API_BASE}/api/settings/${user.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save settings');

            resetDirty();
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            console.error("Failed to save settings", e);
        } finally {
            setSaving(false);
        }
    };

    const providers = ["groq", "openrouter", "openai", "anthropic", "custom"];

    return (
        <div className="pb-20 max-w-6xl mx-auto p-8 relative animate-fade-in">
            {/* Header Area */}
            <div className="sticky top-0 z-40 -mx-8 px-8 py-6 bg-background/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5 flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase">Settings</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Global Protocol Configuration</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                        "flex h-12 items-center gap-2 rounded-2xl px-8 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-2xl",
                        success
                            ? "bg-green-500 text-white shadow-green-500/20"
                            : "bg-foreground text-background shadow-foreground/10 hover:shadow-foreground/20"
                    )}
                >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : success ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {success ? "SAVED" : "Commit Changes"}
                </button>
            </div>

            <div className="space-y-4">
                {/* 1. Identity Section */}
                <SettingSection
                    title="Developer Identity"
                    icon={User}
                    description="Your verified engineering profile and access tier."
                >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-accent/20 rounded-[2rem] border border-black/5 p-6 dark:border-white/5 gap-6">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-tr from-primary to-accent shadow-xl flex items-center justify-center text-white ring-4 ring-primary/10">
                                <User className="h-8 w-8" />
                            </div>
                            <div>
                                <div className="text-lg font-black tracking-tight">{user?.email}</div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                    Verified Session
                                </div>
                            </div>
                        </div>
                        <Link to="/app/billing" className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-background border border-black/10 dark:border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all shadow-sm">
                            Manage Subscription
                        </Link>
                    </div>
                </SettingSection>

                {/* 2. Integrations Section (Redesigned) */}
                <SettingSection
                    title="Ecosystem Integrations"
                    icon={Network}
                    description="Connect external platforms. GitHub serves as your global codebase source, while Jira and Notion are mapped per-project."
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        
                        {/* GITHUB CARD (Global) */}
                        <div className={cn(
                            "relative overflow-hidden flex flex-col justify-between p-6 rounded-[2rem] border transition-all duration-500",
                            githubConnected 
                                ? "bg-green-500/5 border-green-500/20 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]" 
                                : "bg-accent/10 border-black/5 dark:border-white/5"
                        )}>
                            {githubConnected && <div className="absolute -top-10 -right-10 h-32 w-32 bg-green-500/10 blur-3xl rounded-full" />}
                            
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", githubConnected ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-accent text-muted-foreground")}>
                                            <Github className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-widest">GitHub Sync</div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Global Data Source</div>
                                        </div>
                                    </div>
                                    <div className={cn("h-2 w-2 rounded-full", githubConnected ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-muted")} />
                                </div>

                                {githubConnected ? (
                                    <div className="pt-2">
                                        <div className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                            OAuth Session Active.<br/>
                                            Verified via <span className="font-bold text-foreground">{user?.email}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-2 text-[10px] font-medium text-muted-foreground leading-relaxed">
                                        Connect to enable automated webhook deployment and code synchronization.
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 relative z-10">
                                {githubConnected ? (
                                    <button onClick={() => user?.id && disconnectGithub(user.id)} className="w-full flex items-center justify-center h-10 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest hover:bg-destructive hover:text-white transition-all">
                                        Disconnect Node
                                    </button>
                                ) : (
                                    <button onClick={() => window.location.href = `${API_BASE}/auth/github/connect?state=${user?.id}`} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-foreground text-background text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md">
                                        <Link2 className="h-3.5 w-3.5" /> Link Account
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* JIRA CARD (Project Specific) */}
                        <div className={cn(
                            "relative overflow-hidden flex flex-col justify-between p-6 rounded-[2rem] border transition-all duration-500",
                            jiraConnected 
                                ? "bg-blue-500/5 border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]" 
                                : "bg-accent/10 border-black/5 dark:border-white/5"
                        )}>
                            {!project && (
                                <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                                    <AlertTriangle className="h-6 w-6 text-orange-500 mb-2 opacity-80" />
                                    <div className="text-[10px] font-black uppercase tracking-widest">Context Required</div>
                                    <p className="text-[9px] font-medium text-muted-foreground mt-1 max-w-[150px]">Select a project from the dashboard to map Jira boards.</p>
                                </div>
                            )}
                            
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", jiraConnected ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-accent text-muted-foreground")}>
                                            <Trello className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-widest">Jira Tickets</div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Project Mapping</div>
                                        </div>
                                    </div>
                                    <div className={cn("h-2 w-2 rounded-full", jiraConnected ? "bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-muted")} />
                                </div>

                                {jiraConnected ? (
                                    <div className="pt-2">
                                        <ModernSelect
                                            value={project?.jira_project_id || 'none'}
                                            onChange={(val: string) => project?.id && updateJiraMapping(project.id, val === 'none' ? '' : val)}
                                            options={[{ key: 'none', name: 'None / Not Linked' }, ...jiraProjects]}
                                            loading={!jiraProjects.length && jiraConnected}
                                        />
                                    </div>
                                ) : (
                                    <div className="pt-2 text-[10px] font-medium text-muted-foreground leading-relaxed">
                                        Link Atlassian to map external issues to your current project.
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 relative z-10">
                                {jiraConnected ? (
                                    <button onClick={() => user?.id && disconnectJira(user.id)} className="w-full flex items-center justify-center h-10 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest hover:bg-destructive hover:text-white transition-all">
                                        Disconnect Node
                                    </button>
                                ) : (
                                    <button onClick={() => window.location.href = `${API_BASE}/auth/jira/connect?state=${user?.id}`} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-blue-500/20">
                                        <Link2 className="h-3.5 w-3.5" /> Link Account
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* NOTION CARD (Under Construction) */}
                        <div className="relative overflow-hidden flex flex-col justify-between p-6 rounded-[2rem] border border-black/5 dark:border-white/5 bg-accent/5 opacity-70 grayscale pointer-events-none">
                            <div className="absolute inset-0 z-20 bg-background/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                <div className="px-4 py-1.5 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-full mb-3 shadow-xl shadow-yellow-500/20">
                                    In Development
                                </div>
                            </div>
                            
                            <div className="space-y-4 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-accent text-muted-foreground">
                                            <BookOpen className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-widest">Notion Docs</div>
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Project Mapping</div>
                                        </div>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-muted" />
                                </div>
                                <div className="pt-2 text-[10px] font-medium text-muted-foreground leading-relaxed">
                                    Documentation synchronization protocol is currently being synthesized.
                                </div>
                            </div>
                            <div className="mt-8 relative z-10">
                                <button className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-accent text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                                    <Lock className="h-3.5 w-3.5" /> Locked
                                </button>
                            </div>
                        </div>

                    </div>
                </SettingSection>

                {/* 3. AI Logic Layer */}
                <SettingSection
                    title="AI Logic Engine"
                    icon={Cpu}
                    description="Configure the inference provider used to analyze your architecture. Credentials are encrypted."
                >
                    <div className="space-y-8 bg-accent/10 rounded-[2rem] border border-black/5 dark:border-white/5 p-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Provider Selection</label>
                            
                            {/* Segmented Control UI */}
                            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-background rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm w-fit">
                                <button
                                    onClick={() => {
                                        setUseDefault(true);
                                        setProvider("");
                                        setSelectedModel("");
                                        setApiKey("");
                                    }}
                                    className={cn(
                                        "rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                        useDefault
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                    )}
                                >
                                    LUMIS ENGINE (DEFAULT)
                                </button>

                                {providers.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => { setProvider(p); setUseDefault(false); }}
                                        className={cn(
                                            "rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                            (provider === p && !useDefault)
                                                ? "bg-foreground text-background shadow-md"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        )}
                                    >
                                        {p === 'custom' ? 'Custom API' : p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <InputField disabled={useDefault} label="Target Model ID" icon={Cpu} value={selectedModel} onChange={setSelectedModel} placeholder="e.g. gpt-4o" />
                            {provider === 'custom' && (
                                <InputField 
                                    disabled={useDefault} 
                                    label="Provider Base URL" 
                                    icon={Plug} 
                                    value={baseUrl} 
                                    onChange={setBaseUrl} 
                                    placeholder="https://api.yourprovider.com/v1" 
                                />
                            )}
                            <div className={cn("col-span-1", provider !== 'custom' && "md:col-span-2")}>
                                <InputField disabled={useDefault} label="Inference Key (API Key)" icon={Lock} value={apiKey} onChange={setApiKey} placeholder="sk-..." type="password" hide={true} />
                            </div>
                        </div>
                    </div>
                </SettingSection>

                {/* 4. Interface Overrides */}
                <SettingSection
                    title="Interface Overrides"
                    icon={Monitor}
                    description="Customize the digital-twin terminal environment visualization."
                >
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'light', icon: Sun, label: 'Light' },
                            { id: 'dark', icon: Moon, label: 'Dark' },
                            { id: 'system', icon: Monitor, label: 'System' }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTheme(t.id as 'light' | 'dark' | 'system')}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-3 rounded-[2rem] border p-6 transition-all hover:scale-[1.02] active:scale-[0.98]",
                                    theme === t.id 
                                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary),0.15)] ring-4 ring-primary/10" 
                                        : "border-black/5 dark:border-white/5 bg-background text-muted-foreground hover:border-black/10 dark:hover:border-white/10"
                                )}
                            >
                                <t.icon className="h-6 w-6" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </SettingSection>

            </div>
        </div>
    );
};

export default Settings;
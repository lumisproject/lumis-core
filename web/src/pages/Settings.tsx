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
    Mail
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import { API_BASE, supabase } from '@/lib/supabase';

const SettingSection = ({ title, description, children, icon: Icon, id, highlight, extra }: any) => (
    <div 
        id={id} 
        className={cn(
            "grid grid-cols-1 gap-12 py-12 lg:grid-cols-3 border-b border-black/5 dark:border-white/5 last:border-0 transition-all duration-1000 relative overflow-hidden",
            highlight && "bg-primary/5 ring-1 ring-primary/20 scale-[1.02] z-30 rounded-[3rem] px-8 -mx-8 shadow-2xl"
        )}
    >
        {highlight && (
            <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.5, repeat: 1, ease: "easeInOut" }}
                className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-primary/10 to-transparent pointer-events-none"
            />
        )}
        <div className="lg:col-span-1 border-r border-black/5 dark:border-white/5 pr-8">
            <div className="flex items-center gap-3 mb-2">
                {Icon && <Icon className="h-5 w-5 text-primary" />}
                <h3 className="text-lg font-black tracking-tight uppercase">{title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium opacity-70 mb-6">{description}</p>
            {extra && <div className="mt-4 animate-in fade-in slide-in-from-top-2">{extra}</div>}
        </div>
        <div className="lg:col-span-2 space-y-6 relative z-10">
            {children}
        </div>
    </div>
);

const ModernSelect = ({ label, icon: Icon, value, onChange, options, placeholder, loading }: any) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="space-y-2 relative">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
            <div
                onClick={() => !loading && setOpen(!open)}
                className={cn(
                    "flex h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 bg-accent/30 px-4 text-sm transition-all hover:bg-accent/50 dark:border-white/5",
                    open && "border-primary/50 ring-4 ring-primary/10"
                )}
            >
                <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(!value && "text-muted-foreground")}>
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
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[320px] overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#0F0F0F]"
                        >
                            {options.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">No records found. Link account first.</div>
                            ) : (
                                options.map((opt: any) => (
                                    <button
                                        key={opt.id || opt.key}
                                        onClick={() => {
                                            onChange(opt.id || opt.key);
                                            setOpen(false);
                                        }}
                                        className="w-full flex items-center rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
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
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
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
                className="flex h-12 w-full rounded-2xl border border-black/5 bg-accent/30 pl-11 pr-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
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

const Settings = () => {
    const { user } = useUserStore();
    const {
        project, jiraConnected, fetchJiraStatus, fetchNotionStatus, disconnectJira,
        updateJiraMapping, jiraProjects,
        notionConnected, notionProjects, disconnectNotion, updateNotionMapping // <-- ADDED NOTION METHODS
    } = useProjectStore();
    const {
        useDefault, setUseDefault,
        provider, setProvider,
        apiKey, setApiKey,
        selectedModel, setSelectedModel,
        theme, setTheme,
        baseUrl, setBaseUrl,
        intakeUser, setIntakeUser,
        intakePassword, setIntakePassword,
        resetDirty, _isDirty
    } = useSettingsStore();

    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [highlightSection, setHighlightSection] = useState<string | null>(null);

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
            // Clear params from URL
            navigate(location.pathname, { replace: true });
        }
    }, [location]);

    // NEW: Handle deep linking and highlight
    useEffect(() => {
        if (location.hash === '#intake') {
            setHighlightSection('intake');
            const el = document.getElementById('intake');
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
            // Clear highlight after 5s
            const timer = setTimeout(() => setHighlightSection(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [location.hash]);

    useEffect(() => {
        if (user?.id) {
            console.log("Settings: Fetching stats/status for user", user.id);
            fetchJiraStatus(user.id);
            fetchNotionStatus(user.id);
        }
    }, [user?.id, project?.id, fetchJiraStatus, fetchNotionStatus]);

    // NEW: Fetch User Settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!user?.id || hasLoaded || _isDirty) return;
            try {
                // Must pass auth token because the backend endpoint uses Depends(get_current_user)
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch(`${API_BASE}/api/settings/${user.id}`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    // Only update if the user hasn't already started typing (isDirty check)
                    // We check if the current store values are different from defaults or empty
                    // but the easiest is to check if we've already interacted.
                    // For now, let's just ensure it only runs ONCE ever per mount.
                    
                    setUseDefault(data.useDefault);
                    setProvider(data.provider);
                    setSelectedModel(data.selectedModel);
                    setBaseUrl(data.baseUrl || "");

                    // If the backend says we are using defaults, force the local API key to be empty
                    if (data.useDefault) {
                        setApiKey("");
                    } else {
                        setApiKey(data.apiKey);
                    }
                    setHasLoaded(true);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        };
        loadSettings();
    }, [user?.id, hasLoaded]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Get the JWT session to authenticate with the backend
            const { data: { session } } = await supabase.auth.getSession();

            const payload = {
                provider: provider,
                selectedModel: selectedModel,
                useDefault: useDefault,
                apiKey: apiKey,
                baseUrl: baseUrl,
                intakeUser: intakeUser || "", // Send empty string if cleared
                intakePassword: intakePassword || "" // Send empty string if cleared
            };

            const res = await fetch(`${API_BASE}/api/settings/${user.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to save settings');
            }

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
        <div className="pb-20 max-w-5xl mx-auto p-8 relative">
            <AnimatePresence>
                {showBillingSuccess && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
                    >
                        <div className="relative max-w-md w-full overflow-hidden rounded-[3rem] border border-primary/20 bg-card p-12 text-center shadow-2xl shadow-primary/20">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                            <div className="relative z-10 space-y-6">
                                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary/10 text-primary border border-primary/20 shadow-inner overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-primary/20 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <PartyPopper className="h-10 w-10 relative z-10 animate-bounce" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black tracking-tighter uppercase text-primary">Upgrade Successful</h2>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        Your neural capacity has been expanded. Welcome to the elite tier of engineering intelligence.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 pt-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Relocating to Command Center...</div>
                                    <div className="h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: '100%' }}
                                            transition={{ duration: 5, ease: "linear" }}
                                            className="h-full bg-primary shadow-[0_0_10px_primary]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mb-8 space-y-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase">Configuration</h1>
                    <p className="mt-2 text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Global Protocol & Instance Mapping</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                        "flex h-12 items-center gap-2 rounded-2xl px-10 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50 w-fit shadow-2xl",
                        success
                            ? "bg-green-500 text-white shadow-green-500/20"
                            : "bg-gradient-to-tr from-orange-600 to-orange-400 text-white shadow-xl shadow-orange-600/30"
                    )}
                >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : success ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {success ? "SAVED" : "Commit Changes"}
                </button>
            </div>

            <SettingSection
                title="AI Logic Layer"
                icon={Cpu}
                description="Power the inference engine with your preferred provider. Credentials are encrypted at rest."
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-full md:col-span-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Inference Provider</label>
                            <div className="flex flex-wrap gap-2">
                                {/* DEFAULT BUTTON */}
                                <button
                                    onClick={() => {
                                        setUseDefault(true);
                                        setProvider("");
                                        setSelectedModel("");
                                        setApiKey("");
                                    }}
                                    className={cn(
                                        "rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                        useDefault
                                            ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_-5px_primary]"
                                            : "border-black/5 bg-accent/30 text-muted-foreground hover:bg-accent/50 dark:border-white/5"
                                    )}
                                >
                                    LUMIS ENGINE (DEFAULT)
                                </button>

                                {providers.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => { setProvider(p); setUseDefault(false); }}
                                        className={cn(
                                            "rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                            (provider === p && !useDefault)
                                                ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_-5px_primary]"
                                                : "border-black/5 bg-accent/30 text-muted-foreground hover:bg-accent/50 dark:border-white/5"
                                        )}
                                    >
                                        {p === 'custom' ? 'Custom Provider' : p}
                                    </button>
                                ))}
                            </div>
                        </div>
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
                    </div>
                    <InputField disabled={useDefault} label="Credential Protocol (API Key)" icon={Lock} value={apiKey} onChange={setApiKey} placeholder="sk-..." type="password" hide={true} />
                </div>
            </SettingSection>

            <SettingSection
                title="Interface Overrides"
                icon={Monitor}
                description="Customize the digital-twin terminal environment visualization."
            >
                <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Theme Configuration</label>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            onClick={() => setTheme('light')}
                            className={cn(
                                "flex flex-col items-center gap-3 rounded-2xl border p-4 transition-all hover:bg-accent/50",
                                theme === 'light' ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_-5px_primary]" : "border-black/5 dark:border-white/5 bg-accent/30 text-muted-foreground"
                            )}
                        >
                            <Sun className="h-6 w-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Light</span>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn(
                                "flex flex-col items-center gap-3 rounded-2xl border p-4 transition-all hover:bg-accent/50",
                                theme === 'dark' ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_-5px_primary]" : "border-black/5 dark:border-white/5 bg-accent/30 text-muted-foreground"
                            )}
                        >
                            <Moon className="h-6 w-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Dark</span>
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={cn(
                                "flex flex-col items-center gap-3 rounded-2xl border p-4 transition-all hover:bg-accent/50",
                                theme === 'system' ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_-5px_primary]" : "border-black/5 dark:border-white/5 bg-accent/30 text-muted-foreground"
                            )}
                        >
                            <Monitor className="h-6 w-6" />
                            <span className="text-[10px] font-black uppercase tracking-widest">System</span>
                        </button>
                    </div>
                </div>
            </SettingSection>

            <SettingSection
                title="Workspace Mapping"
                icon={Database}
                description="Synchronize project-specific backlogs and documentation. Mappings are unique to each neural instance."
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* JIRA INTEGRATION */}
                    <div className="space-y-4 p-6 rounded-3xl border border-black/5 bg-accent/10 dark:border-white/5 relative">
                        {!project && (
                            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-3xl">
                                <AlertTriangle className="h-6 w-6 text-orange-500 mb-2" />
                                <div className="text-[10px] font-black uppercase tracking-widest">No Active Instance</div>
                                <p className="text-[9px] text-muted-foreground mt-1">Select a project in the Command Center to map integrations.</p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Plug className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Jira Board {project?.jira_project_id && <CheckCircle2 className="inline h-3 w-3 ml-1 text-primary" />}
                                </span>
                            </div>
                            <div className={cn("h-2 w-2 rounded-full", jiraConnected ? "bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted")} />
                        </div>

                        {jiraConnected ? (
                            <div className="space-y-4">
                                <ModernSelect
                                    label="Target Project"
                                    icon={Search}
                                    value={project?.jira_project_id || 'none'}
                                    onChange={(val: string) => project?.id && updateJiraMapping(project.id, val === 'none' ? '' : val)}
                                    options={[{ key: 'none', name: 'None / Not Linked' }, ...jiraProjects]}
                                    loading={!jiraProjects.length && jiraConnected}
                                />
                                <button
                                    onClick={() => user?.id && disconnectJira(user.id)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:underline"
                                >
                                    Disconnect Node
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => window.location.href = `${API_BASE}/auth/jira/connect?state=${user?.id}`}
                                className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all border border-blue-500/20"
                            >
                                <Plug className="h-4 w-4" />
                                Link Atlassian Node
                            </button>
                        )}
                    </div>

                    {/* FULLY FUNCTIONAL NOTION INTEGRATION */}
                    <div className="space-y-4 p-6 rounded-3xl border border-black/5 bg-accent/10 dark:border-white/5 relative">
                        {!project && (
                            <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-3xl">
                                <AlertTriangle className="h-6 w-6 text-orange-500 mb-2" />
                                <div className="text-[10px] font-black uppercase tracking-widest">No Active Instance</div>
                                <p className="text-[9px] text-muted-foreground mt-1">Select a project in the Command Center to map integrations.</p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-emerald-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Notion Board {project?.notion_project_id && <CheckCircle2 className="inline h-3 w-3 ml-1 text-primary" />}
                                </span>
                            </div>
                            <div className={cn("h-2 w-2 rounded-full", notionConnected ? "bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted")} />
                        </div>

                        {notionConnected ? (
                            <div className="space-y-4">
                                <ModernSelect
                                    label="Target Database"
                                    icon={Search}
                                    value={project?.notion_project_id || 'none'}
                                    onChange={(val: string) => project?.id && updateNotionMapping(project.id, val === 'none' ? '' : val)}
                                    options={[{ id: 'none', name: 'None / Not Linked' }, ...(notionProjects || [])]}
                                    loading={!(notionProjects?.length) && notionConnected}
                                />
                                <button
                                    onClick={() => user?.id && disconnectNotion(user.id)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:underline"
                                >
                                    Disconnect Node
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => window.location.href = `${API_BASE}/auth/notion/connect?state=${user?.id}`}
                                className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                            >
                                <Plug className="h-4 w-4" />
                                Link Notion Node
                            </button>
                        )}
                    </div>
                </div>
            </SettingSection>

            <SettingSection
                id="intake"
                title="Inbox Intake Protocol"
                icon={Mail}
                highlight={highlightSection === 'intake'}
                description="Configure the direct neural link to your ticketing inbox or communication node."
                extra={
                    <div className="space-y-8">
                        {/* ACTIVE PROTOCOL */}
                        <div className="space-y-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/60 block ml-1">Available Services</span>
                            <div className="h-12 w-12 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center">
                                <img 
                                    src="/gmail.png" 
                                    className="h-9 w-9" 
                                    alt="Gmail" 
                                />
                            </div>
                        </div>

                        {/* COMING SOON */}
                        <div className="space-y-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 block ml-1">Coming Soon</span>
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center">
                                    <img 
                                        src="/outlook.webp" 
                                        className="h-9 w-9" 
                                        alt="Outlook" 
                                />
                                </div>
                                <div className="h-12 w-12 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center">
                                    <img 
                                        src="/slack.webp" 
                                        className="h-9 w-9" 
                                        alt="Slack" 
                                    />
                                </div>
                                <div className="h-12 w-12 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center">
                                    <img 
                                        src="/whatsapp.png" 
                                        className="h-9 w-9" 
                                        alt="WhatsApp" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField 
                            label="Intake Address" 
                            icon={Mail} 
                            value={intakeUser} 
                            onChange={setIntakeUser} 
                            placeholder="e.g. agent@company.com" 
                        />
                        <InputField 
                            label="App Password / Access Token" 
                            icon={Lock} 
                            value={intakePassword} 
                            onChange={setIntakePassword} 
                            placeholder="(no spaces in password)" 
                            type="password" 
                            hide={true} 
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10 flex items-start gap-4 flex-1">
                            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider">Security Requirement</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Standard passwords will not work. You must provide a service-specific 16-character password for Lumis to bridge the connection.
                                </p>
                            </div>
                        </div>

                        {/* Reset Button */}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIntakeUser('');
                                setIntakePassword('');
                            }}
                            className="flex items-center gap-2 px-6 py-2 text-rose-500 hover:text-rose-600 transition-colors group ml-4"
                        >
                            <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Unlink Account</span>
                        </button>
                    </div>
                </div>
            </SettingSection>

            <SettingSection
                title="Identity & Access"
                icon={User}
                description="Manage your verified developer profile and subscription status."
            >
                <div className="flex items-center bg-accent/10 rounded-3xl border border-black/5 p-8 dark:border-white/5">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-primary to-accent shadow-2xl flex items-center justify-center text-white ring-8 ring-primary/5">
                        <User className="h-10 w-10" />
                    </div>
                    <div className="ml-8">
                        <div className="text-lg font-black tracking-tight">{user?.email}</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Authenticated Developer Entity
                        </div>
                    </div>
                    <Link to="/app/billing" className="ml-auto flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                        Upgrade Tier
                    </Link>
                </div>
            </SettingSection>

        </div>
    );
};

export default Settings;
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    Monitor
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import { API_BASE, supabase } from '@/lib/supabase';

const SettingSection = ({ title, description, children, icon: Icon }: any) => (
    <div className="grid grid-cols-1 gap-12 py-8 lg:grid-cols-3 border-b border-black/5 dark:border-white/5 last:border-0">
        <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-2">
                {Icon && <Icon className="h-5 w-5 text-primary" />}
                <h3 className="text-lg font-black tracking-tight uppercase">{title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="lg:col-span-2 space-y-6">
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
        project, jiraConnected, notionConnected, fetchJiraStatus, fetchNotionStatus, disconnectJira, disconnectNotion,
        updateJiraMapping, updateNotionMapping
    } = useProjectStore();
    const {
        useDefault, setUseDefault,
        provider, setProvider,
        apiKey, setApiKey,
        selectedModel, setSelectedModel,
        theme, setTheme
    } = useSettingsStore();

    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    
    const [availableJiraProjects, setAvailableJiraProjects] = useState<{key: string, name: string}[]>([]);
    const [loadingJira, setLoadingJira] = useState(false);
    const [availableNotionDBs, setAvailableNotionDBs] = useState<{id: string, name: string}[]>([]);
    const [loadingNotion, setLoadingNotion] = useState(false);

    useEffect(() => {
        if (user?.id) {
            console.log("Settings: Fetching stats/status for user", user.id);
            fetchJiraStatus(user.id);
            fetchNotionStatus(user.id);
        }
    }, [user, project?.id]);

    // NEW: Fetch User Settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!user?.id) return;
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
                    setUseDefault(data.useDefault);
                    setProvider(data.provider);
                    setSelectedModel(data.selectedModel);
                    
                    // If the backend says we are using defaults, force the local API key to be empty
                    if (data.useDefault) {
                        setApiKey(""); 
                    } else {
                        setApiKey(data.apiKey);
                    }
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        };
        loadSettings();
    }, [user]);

    useEffect(() => {
        const fetchJira = async () => {
            if (jiraConnected && user?.id) {
                setLoadingJira(true);
                try {
                    const res = await fetch(`${API_BASE}/api/jira/projects/${user.id}`);
                    if (res.ok) setAvailableJiraProjects(await res.json());
                } catch (e) { console.error(e); } finally { setLoadingJira(false); }
            }
        };
        fetchJira();
    }, [jiraConnected, user]);

    useEffect(() => {
        const fetchNotion = async () => {
            if (notionConnected && user?.id) {
                setLoadingNotion(true);
                try {
                    const res = await fetch(`${API_BASE}/api/notion/databases/${user.id}`);
                    if (res.ok) setAvailableNotionDBs(await res.json());
                } catch (e) { console.error(e); } finally { setLoadingNotion(false); }
            }
        };
        fetchNotion();
    }, [notionConnected, user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Get the JWT session to authenticate with the backend
            const { data: { session } } = await supabase.auth.getSession();
            
            const payload = {
                provider: provider,
                selectedModel: selectedModel,
                useDefault: useDefault, // FIX: Use the actual state, not a hardcoded false!
                apiKey: apiKey // If it's masked (••••), the backend handles preserving the old one
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

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            console.error("Failed to save settings", e);
        } finally {
            setSaving(false);
        }
    };

    const providers = ["groq", "openrouter", "openai", "anthropic"];

    return (
        <div className="pb-20 max-w-5xl mx-auto p-8">
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
                            : "bg-primary text-primary-foreground shadow-primary/20"
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
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <InputField disabled={useDefault} label="Target Model ID" icon={Cpu} value={selectedModel} onChange={setSelectedModel} placeholder="e.g. gpt-4o" />
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
                    {/* JIRA */}
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
                                    Jira Backlog {project?.jira_project_id && <CheckCircle2 className="inline h-3 w-3 ml-1 text-primary" />}
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
                                    options={[{ key: 'none', name: 'None / Not Linked' }, ...availableJiraProjects]} 
                                    loading={loadingJira}
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

                    {/* NOTION */}
                    <div className="space-y-4 p-6 rounded-3xl border border-black/5 bg-accent/10 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-foreground" />
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Notion Docs {project?.notion_project_id && <CheckCircle2 className="inline h-3 w-3 ml-1 text-primary" />}
                                </span>
                            </div>
                            <div className={cn("h-2 w-2 rounded-full", notionConnected ? "bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" : "bg-muted")} />
                        </div>
                        
                        {notionConnected ? (
                            <div className="space-y-4">
                                <ModernSelect 
                                    label="Docs Database" 
                                    icon={Database} 
                                    value={project?.notion_project_id || 'none'} 
                                    onChange={(val: string) => project?.id && updateNotionMapping(project.id, val === 'none' ? '' : val)} 
                                    options={[{ id: 'none', name: 'None / Not Linked' }, ...availableNotionDBs]} 
                                    loading={loadingNotion}
                                />
                                <button 
                                    onClick={() => user?.id && disconnectNotion(user.id)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:underline"
                                >
                                    Disconnect Vault
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => window.location.href = `${API_BASE}/auth/notion/connect?state=${user?.id}`}
                                className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl bg-black/10 text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-black/20 dark:bg-white/5 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5"
                            >
                                <BookOpen className="h-4 w-4" />
                                Link Knowledge Base
                            </button>
                        )}
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
import { useState, useEffect, useRef } from 'react';
// LUMIS_GRID_REFRESH_ONLY_ACTIVE
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
    Mail,
    Inbox,
    Link as LinkIcon,
    Loader2,
    Send,
    ArrowLeft,
    Settings,
    Cpu,
    Database,
    ShieldCheck,
    Lock,
    Save,
    Layers,
    Sparkles,
    Calendar,
    ArrowUpRight,
    Zap,
    X,
    Play,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

// Types for our Drafts
interface DraftTicket {
    id: string;
    title: string;
    description: string;
    original_email_summary: string;
    status: 'To Do' | 'In Progress' | 'Done';
    sender: string;
    received_at: string;
}


export default function EmailDrafts() {
    const { project } = useProjectStore();
    const [drafts, setDrafts] = useState<DraftTicket[]>([]);
    const [selectedDraft, setSelectedDraft] = useState<DraftTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
    // Connection Settings State
    const [mappedEmail, setMappedEmail] = useState('');
    const [mappingLoading, setMappingLoading] = useState(false);
    const [mappedSuccess, setMappedSuccess] = useState(false);
    const [linkedEmails, setLinkedEmails] = useState<string[]>([]);

    // Detail Edit State
    const [editForm, setEditForm] = useState<Partial<DraftTicket>>({});
    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize title textarea
    useEffect(() => {
        if (titleRef.current) {
            titleRef.current.style.height = 'auto';
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
        }
    }, [editForm.title, viewMode]);

    const { intakeUser, intakePassword } = useSettingsStore();
    const isLocked = !intakeUser || !intakePassword;

    useEffect(() => {
        if (!project?.id) return;
        fetchDrafts();
        fetchLinkedEmails();
    }, [project?.id]);

    useEffect(() => {
        if (selectedDraft) {
            setEditForm(selectedDraft);
            setViewMode('detail');
        } else {
            setEditForm({});
            setViewMode('grid');
        }
    }, [selectedDraft]);

    // Real-time automatic refresh
    useEffect(() => {
        if (!project?.id) return;

        const channel = supabase
            .channel('draft-updates-grid')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'draft_tickets',
                    filter: `project_id=eq.${project.id}`
                },
                () => {
                    // Only refresh the list. Layout.tsx will handle the popup.
                    fetchDrafts();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project?.id]);

    const handleMapEmail = async () => {
        if (!project?.id || !mappedEmail) return;
        setMappingLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const res = await fetch(`${VITE_API_URL}/api/projects/${project?.id}/email-mappings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: mappedEmail.toLowerCase() })
            });

            if (res.ok) {
                setMappedSuccess(true);
                setMappedEmail('');
                fetchLinkedEmails();
                setTimeout(() => setMappedSuccess(false), 3000);
            } else {
                throw new Error("Failed to map email");
            }
        } catch (error) {
            console.error("Failed to map email", error);
            alert("Failed to map email. Check console.");
        } finally {
            setMappingLoading(false);
        }
    };

    const fetchLinkedEmails = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${VITE_API_URL}/api/projects/${project?.id}/email-mappings`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLinkedEmails(data);
            }
        } catch (error) {
            console.error("Failed to fetch linked emails", error);
        }
    };

    const handleRemoveEmail = async (email: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const res = await fetch(`${VITE_API_URL}/api/projects/${project?.id}/email-mappings?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                fetchLinkedEmails();
            }
        } catch (error) {
            console.error("Failed to remove email", error);
        }
    };

    const fetchDrafts = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const res = await fetch(`${VITE_API_URL}/api/projects/${project?.id}/drafts`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setDrafts(data);
            } else {
                console.error("Failed to fetch drafts:", await res.text());
            }
        } catch (error) {
            console.error("Failed to fetch drafts", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptDraft = async () => {
        if (!project?.id || !selectedDraft) return;
        setActionLoading('accept');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const res = await fetch(`${VITE_API_URL}/api/projects/${project.id}/board/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    title: editForm.title,
                    description: editForm.description,
                    status: editForm.status,
                    draft_id: selectedDraft.id,
                })
            });

            if (res.ok) {
                setDrafts((prev) => prev.filter(d => d.id !== selectedDraft.id));
                setSelectedDraft(null);
            } else {
                alert("Failed to push ticket: " + await res.text());
            }
        } catch (error) {
            console.error("Failed to accept draft", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectDraft = async () => {
        if (!project?.id || !selectedDraft) return;
        setActionLoading('reject');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const res = await fetch(`${VITE_API_URL}/api/projects/${project.id}/drafts/${selectedDraft.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });

            if (res.ok) {
                setDrafts((prev) => prev.filter(d => d.id !== selectedDraft.id));
                setSelectedDraft(null);
            }
        } catch (error) {
            console.error("Failed to reject draft", error);
        } finally {
            setActionLoading(null);
        }
    };

    if (!project) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
            </div>
        );
    }

    if (isLocked) {
        return (
            <div className="min-h-[90vh] flex items-center justify-center bg-background px-6">
                <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                    <div className="absolute top-[20%] left-[10%] w-[60%] h-[60%] bg-orange-500/10 blur-[200px] rounded-full opacity-50" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl w-full p-6 sm:p-10 md:p-16 rounded-[2.5rem] sm:rounded-[4rem] bg-card/40 backdrop-blur-3xl border border-black/5 dark:border-white/5 shadow-2xl text-left space-y-8 md:space-y-12 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-5">
                        <Zap className="h-64 w-64 -mr-20 -mt-20" />
                    </div>

                    <div className="space-y-4 relative z-10 border-b border-black/5 dark:border-white/5 pb-8 mb-4 md:mb-8">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                            Setup <span className="text-orange-500">Email Intake</span>
                        </h2>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-40">Follow these steps to activate</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                        {/* STEP 1 */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                    <span className="text-xs font-black text-orange-500">01</span>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest">Configure Integrations</h3>
                            </div>
                            <div className="space-y-4">
                                <ul className="space-y-3">
                                    {[
                                        { icon: Settings, text: "Go to Settings panel" },
                                        { icon: Cpu, text: "Enable AI Engine if not yet" },
                                        { icon: Database, text: "Map current Project to Jira or Notion" }
                                    ].map((step, i) => (
                                        <li key={i} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${i * 100}ms` }}>
                                            <step.icon className="h-3.5 w-3.5 text-orange-500 mt-0.5" />
                                            <span className="text-[11px] font-bold text-foreground/80 leading-tight">{step.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* STEP 2 */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                    <span className="text-xs font-black text-primary">02</span>
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest">Gmail Access Node</h3>
                            </div>
                            <div className="space-y-4">

                                <ul className="space-y-3">
                                    {[
                                        { icon: ShieldCheck, text: "Enable 2-Step Verification (ON)" },
                                        { icon: Lock, text: "Search/Click 'App Passwords'" },
                                        { icon: Settings, text: "Create new 'Lumis Intake' password" },
                                        { icon: Save, text: "Copy the 16-character code" }
                                    ].map((step, i) => (
                                        <li key={i} className="flex items-start gap-3 animate-in fade-in slide-in-from-right-2" style={{ animationDelay: `${(i + 4) * 100}ms` }}>
                                            <step.icon className="h-3.5 w-3.5 text-primary mt-0.5" />
                                            <span className="text-[11px] font-bold text-foreground/80 leading-tight">{step.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 relative z-10 flex flex-col xl:flex-row items-center justify-between gap-8 border-t border-black/5 dark:border-white/5 pt-10">
                        <p className="text-[9px] font-medium text-rose-500 italic opacity-80 max-w-[340px] text-center xl:text-left leading-relaxed">
                            We use OAuth 2.0, the same secure standard that apps like Slack, Zoom, and Google Calendar use to access your email. Lumis never sees or stores your actual Gmail password. We only receive a temporary token that grants us permission to read your inbox and send emails on your behalf. This connection is encrypted end-to-end and can be revoked instantly from your Google Account settings at any time.
                        </p>
                        <Link
                            to="/app/settings#intake"
                            className="inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 group relative overflow-hidden whitespace-nowrap w-full sm:w-auto justify-center"
                        >
                            <motion.div
                                initial={{ x: '-100%' }}
                                whileHover={{ x: '100%' }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                            />
                            <Settings className="h-3.5 w-3.5 transition-transform group-hover:rotate-90 relative z-10" />
                            <span className="relative z-10">Initialize Integrations</span>
                        </Link>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary overflow-x-hidden pt-6">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-orange-500/5 blur-[180px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-rose-500/5 blur-[180px] rounded-full" />
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="max-w-full mx-auto px-6 md:px-12 pb-24 relative z-10">
                {/* Global Header */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16 px-2">
                    <div className="space-y-6">
                        <h1 className="text-4xl md:text-5xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] md:leading-[0.8] transition-all">
                            Email <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-yellow-500">Intake</span>
                        </h1>
                        <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground max-w-md opacity-60">
                            Neural synthesis of client communications into high-fidelity engineering tickets.
                        </p>
                    </div>

                    {/* Compact Integration Toggle */}
                    <div className="bg-card/50 backdrop-blur-3xl border border-black/5 dark:border-white/5 rounded-[2.5rem] flex flex-col group hover:border-primary/20 transition-all shadow-2xl w-full lg:max-w-[420px] overflow-hidden">
                        <div className="p-6 pb-4 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-muted/10">
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-primary">Email Connection</span>
                                <span className="text-[9px] font-medium text-muted-foreground opacity-60">Connected Client Bridges</span>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                <LinkIcon className="h-4 w-4 text-orange-500" />
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Linked Emails List */}
                            <div className="flex flex-wrap gap-2">
                                {linkedEmails.length > 0 ? (
                                    linkedEmails.map(email => (
                                        <div key={email} className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-xl text-[10px] font-bold border border-black/5 dark:border-white/5 group/badge animate-in fade-in slide-in-from-top-1">
                                            <span className="text-foreground/70">{email}</span>
                                            <button
                                                onClick={() => handleRemoveEmail(email)}
                                                className="ml-1 opacity-0 group-hover/badge:opacity-60 hover:!opacity-100 transition-opacity"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-[10px] font-medium text-muted-foreground/30 italic py-2">
                                        No linked accounts yet
                                    </div>
                                )}
                            </div>

                            {/* Add New Email Mapping */}
                            <div className="pt-4 border-t border-black/5 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-muted/20 rounded-xl border border-black/5 dark:border-white/5 px-4 py-2 flex items-center gap-2 focus-within:border-primary/20 transition-all">
                                        <Mail className="h-3 w-3 text-muted-foreground/40 rotate-12 transition-transform group-focus-within:rotate-0" />
                                        <input
                                            type="email"
                                            placeholder="Link new client email..."
                                            value={mappedEmail}
                                            onChange={(e) => setMappedEmail(e.target.value)}
                                            className="bg-transparent border-none focus:ring-0 focus:outline-none text-[11px] font-bold placeholder:text-muted-foreground/30 w-full text-foreground"
                                        />
                                    </div>
                                    <button
                                        onClick={handleMapEmail}
                                        disabled={!mappedEmail || mappingLoading}
                                        className={cn(
                                            "h-9 px-4 rounded-xl text-[10px] font-bold transition-all flex-shrink-0 whitespace-nowrap shadow-sm",
                                            mappedSuccess
                                                ? "bg-emerald-500 text-white"
                                                : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 disabled:opacity-20"
                                        )}
                                    >
                                        {mappingLoading ? '...' : mappedSuccess ? 'Done' : 'Sync'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {viewMode === 'grid' ? (
                        <motion.section
                            key="grid-view"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4, ease: "circOut" }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between mb-4 px-2">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <Inbox className="h-3.5 w-3.5 text-orange-500" />
                                        Pending Tickets
                                    </h2>
                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                    <span className="text-[10px] font-bold text-muted-foreground/60 transition-opacity hover:opacity-100">
                                        {drafts.length} Records
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-48 rounded-[1.5rem] bg-card/50 border border-black/5 dark:border-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : drafts.length === 0 ? (
                                <div className="h-[30vh] flex flex-col items-center justify-center text-muted-foreground/20">
                                    <Sparkles className="h-12 w-12 mb-4 opacity-10" />
                                    <p className="text-[10px] font-bold opacity-30 tracking-tight uppercase">Neural Queue Empty</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {drafts.map((draft, idx) => (
                                        <motion.button
                                            key={idx}
                                            onClick={() => setSelectedDraft(draft)}
                                            whileHover={{ y: -4, scale: 1.01 }}
                                            className="group relative flex flex-col items-start p-5 rounded-[1.5rem] bg-card/30 backdrop-blur-xl border border-black/5 dark:border-white/5 hover:border-orange-500/20 transition-all text-left overflow-hidden min-h-[200px] shadow-lg"
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-[-2px] group-hover:translate-y-[2px]">
                                                <ArrowUpRight className="h-4 w-4 text-orange-500" />
                                            </div>
                                            <div className="flex items-center gap-2 text-[8px] font-bold text-orange-500 mb-4 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/10">
                                                <Mail className="h-2.5 w-2.5" />
                                                <span className="truncate max-w-[120px]">{draft.sender}</span>
                                            </div>
                                            <h3 className="text-base font-black tracking-tight leading-tight mb-3 group-hover:text-orange-500 transition-colors break-words">
                                                {draft.title}
                                            </h3>
                                            <p className="text-[10px] font-medium text-muted-foreground leading-relaxed line-clamp-2 mb-auto opacity-70">
                                                {draft.description}
                                            </p>
                                            <div className="w-full pt-4 mt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground/40">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {formatDistanceToNow(new Date(draft.received_at), { addSuffix: true })}
                                                </div>
                                                <div className={cn(
                                                    "text-[8px] font-bold px-2.5 py-1 rounded-lg border",
                                                    draft.status === 'Done' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-muted/30 border-black/5 dark:border-white/5 text-muted-foreground"
                                                )}>
                                                    {draft.status}
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </motion.section>
                    ) : (
                        <motion.section
                            key="detail-view"
                            initial={{ opacity: 0, scale: 0.99, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="relative w-full"
                        >
                            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

                                {/* -----------------------
                                    LEFT PANE: THE CANVAS
                                -------------------------*/}
                                <div className="flex-1 bg-card/10 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-10 lg:p-14 shadow-xl relative min-h-[450px] sm:min-h-[550px] flex flex-col group/canvas transition-all">

                                    {/* Breadcrumb Return */}
                                    <button
                                        onClick={() => setSelectedDraft(null)}
                                        className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 hover:text-foreground transition-all group mb-10 w-fit"
                                    >
                                        <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
                                        Return to List
                                    </button>

                                    {/* The Canvas Editor */}
                                    <div className="flex-1 flex flex-col gap-8">
                                        {/* Auto-Resizing Title Area */}
                                        <div className="relative group/title">
                                            <div
                                                contentEditable
                                                onInput={(e) => setEditForm(prev => ({ ...prev, title: e.currentTarget.innerText }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        // Prevent new lines in title if you want it to be single-paragraph but wrapping
                                                        // e.preventDefault(); 
                                                    }
                                                }}
                                                className="w-full bg-transparent border-none p-0 text-xl md:text-2xl lg:text-2xl font-bold tracking-tight leading-snug focus:outline-none focus:ring-0 text-foreground transition-all empty:before:content-['Draft_Title...'] empty:before:text-muted-foreground/10 break-words whitespace-pre-wrap"
                                            >
                                                {editForm.title}
                                            </div>
                                        </div>

                                        {/* Technical Description Area */}
                                        <div className="flex-1 relative group flex flex-col">
                                            <textarea
                                                value={editForm.description || ''}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                className="flex-1 w-full h-full min-h-[350px] bg-transparent border-none p-0 text-[12px] md:text-[13px] font-medium leading-[1.8] text-foreground/60 focus:outline-none focus:ring-0 transition-all placeholder:text-muted-foreground/5 resize-none selection:bg-primary/20"
                                                placeholder="Technical specifications and requirements..."
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col gap-4 lg:gap-6 shrink-0">

                                    {/* Module 1: Execution Control */}
                                    <div className="bg-muted/10 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[1.5rem] p-6 shadow-lg relative overflow-hidden group/cmd">

                                        <div className="flex items-center gap-2 mb-4">
                                            <Play className="h-2.5 w-2.5 text-black-foreground/20 fill-black-foreground/10" />
                                            <h3 className="text-[8px] font-bold uppercase tracking-[0.2em] text-black-foreground/30">Actions</h3>
                                        </div>
                                        <div className="flex flex-col gap-3 relative z-10">
                                            <button
                                                onClick={handleAcceptDraft}
                                                disabled={actionLoading !== null}
                                                className="w-full h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-600 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm hover:shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-30"
                                            >
                                                {actionLoading === 'accept' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <>
                                                        Accept & Push
                                                        <Send className="h-3 w-3" />
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleRejectDraft}
                                                disabled={actionLoading !== null}
                                                className="w-full h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 hover:text-rose-600 text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30"
                                            >
                                                Discard Draft
                                            </button>
                                        </div>
                                    </div>

                                    {/* Module 2: Status */}
                                    <div className="bg-muted/5 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[1.5rem] p-6">

                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap className="h-2.5 w-2.5 text-black-foreground/20" />
                                            <h3 className="text-[8px] font-bold uppercase tracking-[0.2em] text-black-foreground/30">Stage</h3>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {['To Do', 'In Progress', 'Done'].map((s) => (
                                                <button
                                                    key={s}
                                                    onClick={() => setEditForm(prev => ({ ...prev, status: s as any }))}
                                                    className={cn(
                                                        "h-10 rounded-lg px-4 flex items-center justify-between text-[10px] font-bold transition-all border group",
                                                        editForm.status === s
                                                            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                                                            : "bg-transparent border-transparent text-foreground/30 hover:bg-muted/10 cursor-pointer"
                                                    )}
                                                >
                                                    {s}
                                                    <div className={cn(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        editForm.status === s ? "bg-yellow-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "bg-foreground/10"
                                                    )} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Module 3: Context Archive */}
                                    <div className="bg-muted/5 backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[1.5rem] flex flex-col overflow-hidden">
                                        <div className="p-6 flex flex-col gap-4">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-3 w-3 text-black-foreground/20" />
                                                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-black-foreground/20">Email Summary</span>
                                            </div>

                                            <p className="text-[11px] font-medium text-black-foreground/40 leading-relaxed italic border-l border-primary/20 pl-4 py-2">
                                                "{selectedDraft?.original_email_summary}"
                                            </p>
                                        </div>

                                        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-background/5 grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[7px] font-bold text-black-foreground/20 uppercase tracking-[0.1em]">Sender</span>
                                                <span className="text-[9px] font-bold text-foreground/40 truncate block">{selectedDraft?.sender}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[7px] font-bold text-black-foreground/20 uppercase tracking-[0.1em]">Received</span>
                                                <span className="text-[9px] font-bold text-foreground/40 block">
                                                    {selectedDraft?.received_at ? formatDistanceToNow(new Date(selectedDraft.received_at), { addSuffix: true }) : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
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
    Layers,
    Sparkles,
    Calendar,
    ArrowUpRight,
    Zap,
    X,
    Lock,
    Settings
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
                    className="max-w-2xl w-full p-12 md:p-20 rounded-[4rem] bg-card/40 backdrop-blur-3xl border border-black/5 dark:border-white/5 shadow-2xl text-center space-y-10 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-5">
                        <Lock className="h-64 w-64 -mr-20 -mt-20" />
                    </div>

                    <div className="mx-auto h-24 w-24 rounded-[2rem] bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner">
                        <Lock className="h-10 w-10 text-orange-500" />
                    </div>

                    <div className="space-y-4 relative z-10">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                            Activate <br /> <span className="text-orange-500">Email Intake</span>
                        </h2>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed max-w-sm mx-auto opacity-70">
                            Your communication bridge is not yet active. Provide your inbox credentials in the settings protocol to enable automatic email synthesis.
                        </p>
                    </div>

                    <div className="pt-6 relative z-10">
                        <Link 
                            to="/app/settings#intake"
                            className="inline-flex items-center gap-3 px-12 py-5 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-primary/40 group relative overflow-hidden"
                        >
                            <motion.div 
                                initial={{ x: '-100%' }}
                                whileHover={{ x: '100%' }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                            />
                            <Settings className="h-4 w-4 transition-transform group-hover:rotate-90 relative z-10" />
                            <span className="relative z-10">Initialize Protocol</span>
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
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.5em] text-primary">
                            <Zap className="h-4 w-4 fill-current" />
                            <span>Lumis AI Protocol</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] md:leading-[0.8] transition-all">
                            Email <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-yellow-500">Intake</span>
                        </h1>
                        <p className="text-xs font-semibold text-muted-foreground max-w-md opacity-60">
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
                                    <div className="flex-1 bg-muted/20 rounded-xl border border-black/5 dark:border-white/5 px-4 py-2 flex items-center gap-2 group-hover:border-primary/20 transition-all">
                                        <Mail className="h-3 w-3 text-muted-foreground/40" />
                                        <input
                                            type="email"
                                            placeholder="Link new client email..."
                                            value={mappedEmail}
                                            onChange={(e) => setMappedEmail(e.target.value)}
                                            className="bg-transparent border-none focus:ring-0 text-[11px] font-bold placeholder:text-muted-foreground/30 w-full text-foreground"
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
                            className="space-y-8"
                        >
                            <div className="flex items-center justify-between mb-8 px-2">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-base font-bold flex items-center gap-3 text-foreground">
                                        <Inbox className="h-4 w-4 text-orange-500" />
                                        Pending Tickets
                                    </h2>
                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                    <span className="text-[11px] font-bold text-muted-foreground/60 transition-opacity hover:opacity-100">
                                        {drafts.length} Active Records
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-80 rounded-[2.5rem] bg-card/50 border border-black/5 dark:border-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : drafts.length === 0 ? (
                                <div className="h-[40vh] flex flex-col items-center justify-center text-muted-foreground/20">
                                    <Sparkles className="h-16 w-16 mb-6 opacity-10" />
                                    <p className="text-sm font-bold opacity-30 tracking-tight">Neural Queue Empty</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {drafts.map((draft, idx) => (
                                        <motion.button
                                            key={idx}
                                            onClick={() => setSelectedDraft(draft)}
                                            whileHover={{ y: -8, scale: 1.01 }}
                                            className="group relative flex flex-col items-start p-8 md:p-10 rounded-[2.5rem] bg-card/30 backdrop-blur-xl border border-black/5 dark:border-white/5 hover:border-orange-500/20 transition-all text-left overflow-hidden min-h-[340px] md:min-h-[380px] shadow-xl hover:shadow-orange-500/5"
                                        >
                                            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-[-4px] group-hover:translate-y-[4px]">
                                                <ArrowUpRight className="h-6 w-6 text-orange-500" />
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] font-bold text-orange-500 mb-8 bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/10">
                                                <Mail className="h-3 w-3" />
                                                {draft.sender}
                                            </div>
                                            <h3 className="text-2xl md:text-3xl font-black tracking-tighter leading-[0.9] mb-6 group-hover:text-orange-500 transition-colors">
                                                {draft.title}
                                            </h3>
                                            <p className="text-sm font-medium text-muted-foreground leading-relaxed line-clamp-3 mb-auto opacity-70">
                                                {draft.description}
                                            </p>
                                            <div className="w-full pt-8 mt-10 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDistanceToNow(new Date(draft.received_at), { addSuffix: true })}
                                                </div>
                                                <div className={cn(
                                                    "text-[10px] font-bold px-4 py-1.5 rounded-xl border",
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
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-card/40 backdrop-blur-3xl border border-black/5 dark:border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl relative"
                        >
                            {/* Detail Header */}
                            <div className="p-8 md:p-12 border-b border-black/5 dark:border-white/5 bg-background/20 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <button
                                    onClick={() => setSelectedDraft(null)}
                                    className="flex items-center gap-3 text-xs font-bold text-muted-foreground hover:text-orange-500 transition-colors group"
                                >
                                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                    Return to Queue
                                </button>
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                    <button
                                        onClick={handleRejectDraft}
                                        disabled={actionLoading !== null}
                                        className="h-12 w-full sm:w-auto px-10 rounded-2xl border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white text-xs font-bold transition-all disabled:opacity-20"
                                    >
                                        Drop Draft
                                    </button>
                                    <button
                                        onClick={handleAcceptDraft}
                                        disabled={actionLoading !== null}
                                        className="h-12 w-full sm:w-auto px-12 rounded-2xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 text-xs font-bold transition-all shadow-xl shadow-primary/20 disabled:opacity-20 flex items-center justify-center gap-3"
                                    >
                                        Accept & Push
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2">
                                {/* Left Side: Original Context */}
                                <div className="p-8 md:p-16 space-y-12 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5">
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-xs font-bold text-orange-500 bg-orange-500/5 px-4 py-2 rounded-full w-fit border border-orange-500/10">
                                            <Sparkles className="h-4 w-4" />
                                            Original Context Synthesis
                                        </div>
                                        <div className="relative p-12 rounded-[2.5rem] bg-orange-500/[0.03] border border-orange-500/10 italic shadow-inner">
                                            <p className="text-xl md:text-2xl font-bold text-foreground/80 leading-[1.6]">
                                                "{selectedDraft?.original_email_summary}"
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground/40">
                                            <Layers className="h-4 w-4" />
                                            Record Metadata
                                        </div>
                                        <div className="flex flex-col gap-6">
                                            <div className="p-8 rounded-[2rem] bg-muted/20 border border-black/5 dark:border-white/5">
                                                <span className="text-[10px] font-bold text-muted-foreground/30 block mb-3">Origin Node</span>
                                                <span className="text-sm font-bold text-foreground">{selectedDraft?.sender}</span>
                                            </div>
                                            <div className="p-8 rounded-[2rem] bg-muted/20 border border-black/5 dark:border-white/5">
                                                <span className="text-[10px] font-bold text-muted-foreground/30 block mb-3">Reception Date</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    {formatDistanceToNow(new Date(selectedDraft?.received_at || new Date()), { addSuffix: true })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Editable Fields */}
                                <div className="p-8 md:p-16 space-y-12">
                                    <div className="space-y-10">
                                        <div className="space-y-4">
                                            <label className="text-xs font-bold text-muted-foreground/40 ml-2">Ticket Title</label>
                                            <input
                                                type="text"
                                                value={editForm.title || ''}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full bg-muted/20 border border-black/5 dark:border-white/5 rounded-[1.5rem] px-8 py-5 text-2xl font-black tracking-tight focus:outline-none focus:border-orange-500/50 transition-all placeholder:opacity-20"
                                                placeholder="Enter ticket title..."
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-xs font-bold text-muted-foreground/40 ml-2">Development Status</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {['To Do', 'In Progress', 'Done'].map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setEditForm(prev => ({ ...prev, status: s as any }))}
                                                        className={cn(
                                                            "h-14 rounded-2xl text-xs font-bold transition-all border",
                                                            editForm.status === s
                                                                ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                                                                : "bg-muted/10 border-black/5 dark:border-white/5 text-muted-foreground hover:bg-muted/20"
                                                        )}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-xs font-bold text-muted-foreground/40 ml-2">Technical Description</label>
                                            <textarea
                                                value={editForm.description || ''}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                className="w-full h-80 bg-muted/20 border border-black/5 dark:border-white/5 rounded-[2.5rem] p-10 text-sm font-medium leading-[1.7] text-foreground focus:outline-none focus:border-orange-500/50 transition-all resize-none shadow-inner"
                                                placeholder="Elaborate technical specifications..."
                                            />
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

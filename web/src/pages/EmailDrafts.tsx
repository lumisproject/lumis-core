import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    Zap
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';

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

const mockDrafts: DraftTicket[] = [
    {
        id: 'draft-1',
        title: 'Implement Dark Mode Persistence',
        description: 'The user complained that their dark mode preference is not being saved across sessions. We need to store the theme preference in localStorage and load it on boot.',
        original_email_summary: 'Client requested that the app remembers their dark mode setting instead of blinding them every morning.',
        status: 'To Do',
        sender: 'client@example.com',
        received_at: '2 hrs ago'
    },
    {
        id: 'draft-2',
        title: 'Fix Pagination on Dashboard',
        description: 'Currently the dashboard shows at most 10 items. Add pagination controls to browse through all records safely.',
        original_email_summary: 'I cannot see past the first 10 projects. Need a way to view all of them.',
        status: 'To Do',
        sender: 'manager@example.com',
        received_at: '4 hrs ago'
    },
    {
        id: 'draft-3',
        title: 'Update Billing Logos',
        description: 'Replace the old CC logos with the newly designed SVG assets provided by marketing in the billing page footer.',
        original_email_summary: 'Marketing wants the new credit card icons placed on the billing page ASAP before the new campaign.',
        status: 'To Do',
        sender: 'marketing@example.com',
        received_at: '1 day ago'
    }
];

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

    // Detail Edit State
    const [editForm, setEditForm] = useState<Partial<DraftTicket>>({});
    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);

    useEffect(() => {
        if (!project?.id) return;
        fetchDrafts();
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

    const fetchDrafts = async () => {
        setLoading(true);
        try {
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            const res = await fetch(`${VITE_API_URL}/api/projects/${project?.id}/drafts`);
            if (res.ok) {
                const data = await res.json();
                setDrafts(data);
            } else {
                setDrafts(mockDrafts);
            }
        } catch (error) {
            setDrafts(mockDrafts);
        } finally {
            setLoading(false);
        }
    };

    const handleMapEmail = () => {
        setMappingLoading(true);
        setTimeout(() => {
            setMappingLoading(false);
            setMappedSuccess(true);
            setTimeout(() => setMappedSuccess(false), 3000);
        }, 1000);
    };

    const handleAcceptDraft = async () => {
        if (!project?.id || !selectedDraft) return;
        setActionLoading('accept');
        
        try {
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            await fetch(`${VITE_API_URL}/api/projects/${project.id}/board/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editForm.title,
                    description: editForm.description,
                    status: editForm.status
                })
            });
            setDrafts((prev) => prev.filter(d => d.id !== selectedDraft.id));
            setSelectedDraft(null);
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
            const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            await fetch(`${VITE_API_URL}/api/projects/${project.id}/drafts/${selectedDraft.id}`, {
                method: 'DELETE'
            });
            setDrafts((prev) => prev.filter(d => d.id !== selectedDraft.id));
            setSelectedDraft(null);
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

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary overflow-x-hidden pt-6">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-orange-500/5 blur-[180px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-rose-500/5 blur-[180px] rounded-full" />
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="max-w-[1440px] mx-auto px-6 md:px-12 pb-24 relative z-10">
                {/* Global Header */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-16 px-2">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.5em] text-primary">
                            <Zap className="h-4 w-4 fill-current" />
                            <span>Lumis AI Protocol</span>
                        </div>
                        <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase leading-[0.8] transition-all">
                            Email <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-yellow-500">Intake</span>
                        </h1>
                        <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] max-w-md opacity-60">
                            Neural synthesis of client communications into high-fidelity engineering tickets.
                        </p>
                    </div>

                    {/* Compact Integration Toggle */}
                    <div className="p-2 pr-6 bg-card/50 backdrop-blur-3xl border border-black/5 dark:border-white/5 rounded-3xl flex items-center gap-4 group hover:border-primary/20 transition-all shadow-2xl">
                        <div className="h-12 w-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:rotate-6 transition-transform">
                            <LinkIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase tracking-widest text-primary/60">Source Link</span>
                            <div className="flex items-center gap-4">
                                <input
                                    type="email"
                                    placeholder="CLIENT@DOMAIN.COM"
                                    value={mappedEmail}
                                    onChange={(e) => setMappedEmail(e.target.value)}
                                    className="bg-transparent border-none focus:ring-0 text-[11px] font-black tracking-widest placeholder:text-muted-foreground/30 w-48 uppercase text-foreground"
                                />
                                <button
                                    onClick={handleMapEmail}
                                    disabled={!mappedEmail || mappingLoading}
                                    className={cn(
                                        "h-8 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                        mappedSuccess 
                                            ? "bg-emerald-500 text-white" 
                                            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 disabled:opacity-20"
                                    )}
                                >
                                    {mappingLoading ? '...' : mappedSuccess ? 'DONE' : 'SYNC'}
                                </button>
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
                                    <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                                        <Inbox className="h-4 w-4 text-orange-500" />
                                        Pending Synthetics
                                    </h2>
                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
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
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em]">Neural Queue Empty</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {drafts.map((draft, idx) => (
                                        <motion.button
                                            key={idx}
                                            onClick={() => setSelectedDraft(draft)}
                                            whileHover={{ y: -8, scale: 1.01 }}
                                            className="group relative flex flex-col items-start p-10 rounded-[2.5rem] bg-card/30 backdrop-blur-xl border border-black/5 dark:border-white/5 hover:border-orange-500/20 transition-all text-left overflow-hidden min-h-[380px] shadow-xl hover:shadow-orange-500/5"
                                        >
                                            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-[-4px] group-hover:translate-y-[4px]">
                                                <ArrowUpRight className="h-6 w-6 text-orange-500" />
                                            </div>
                                            <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-[0.2em] text-orange-500 mb-8 bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/10">
                                                <Mail className="h-3 w-3" />
                                                {draft.sender}
                                            </div>
                                            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-[0.9] mb-6 group-hover:text-orange-500 transition-colors">
                                                {draft.title}
                                            </h3>
                                            <p className="text-sm font-medium text-muted-foreground leading-relaxed line-clamp-3 mb-auto opacity-70">
                                                {draft.description}
                                            </p>
                                            <div className="w-full pt-8 mt-10 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                                                    <Calendar className="h-3 w-3" />
                                                    {draft.received_at}
                                                </div>
                                                <div className={cn(
                                                    "text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border",
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
                                    className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-orange-500 transition-colors group"
                                >
                                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                    Return to Queue
                                </button>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleRejectDraft}
                                        disabled={actionLoading !== null}
                                        className="h-12 px-10 rounded-2xl border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-20"
                                    >
                                        Drop Draft
                                    </button>
                                    <button
                                        onClick={handleAcceptDraft}
                                        disabled={actionLoading !== null}
                                        className="h-12 px-12 rounded-2xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 text-[9px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 disabled:opacity-20 flex items-center gap-3"
                                    >
                                        Accept & Push
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2">
                                {/* Left Side: Original Context */}
                                <div className="p-10 md:p-16 space-y-12 border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5">
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/5 px-4 py-2 rounded-full w-fit border border-orange-500/10">
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
                                        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                                            <Layers className="h-4 w-4" />
                                            Record Metadata
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="p-8 rounded-[2rem] bg-muted/20 border border-black/5 dark:border-white/5">
                                                <span className="text-[8px] font-black uppercase text-muted-foreground/30 block mb-3 tracking-[0.2em]">Origin Node</span>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{selectedDraft?.sender}</span>
                                            </div>
                                            <div className="p-8 rounded-[2rem] bg-muted/20 border border-black/5 dark:border-white/5">
                                                <span className="text-[8px] font-black uppercase text-muted-foreground/30 block mb-3 tracking-[0.2em]">Reception Date</span>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{selectedDraft?.received_at}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Editable Fields */}
                                <div className="p-10 md:p-16 space-y-12">
                                    <div className="space-y-10">
                                        <div className="space-y-4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 ml-2">Ticket Title</label>
                                            <input 
                                                type="text" 
                                                value={editForm.title || ''}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full bg-muted/20 border border-black/5 dark:border-white/5 rounded-[1.5rem] px-8 py-5 text-2xl font-black uppercase tracking-tight focus:outline-none focus:border-orange-500/50 transition-all placeholder:opacity-20"
                                                placeholder="ENTER TICKET TITLE"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 ml-2">Development Status</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {['To Do', 'In Progress', 'Done'].map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setEditForm(prev => ({ ...prev, status: s as any }))}
                                                        className={cn(
                                                            "h-14 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border",
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
                                            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 ml-2">Technical Description</label>
                                            <textarea 
                                                value={editForm.description || ''}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                                className="w-full h-80 bg-muted/20 border border-black/5 dark:border-white/5 rounded-[2.5rem] p-10 text-sm font-medium leading-[1.7] text-foreground focus:outline-none focus:border-orange-500/50 transition-all resize-none shadow-inner"
                                                placeholder="ELABORATE TECHNICAL SPECIFICATIONS..."
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

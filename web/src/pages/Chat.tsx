import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Shield, Code2, AlertTriangle, Workflow, Brain, History, Plus, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useBillingStore } from '@/stores/useBillingStore';
import ChatMessage from '@/components/chat/ChatMessage';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const Chat = () => {
    const [input, setInput] = useState('');
    const [showHistory, setShowHistory] = useState(true);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const {
        reasoningEnabled, setReasoningEnabled, chatMode, setChatMode,
        messages, sending, sendMessage,
        sessions, fetchSessions, loadSession, deleteSession, startNewSession, activeSessionId
    } = useChatStore();

    const { selectedModel, useDefault, provider, apiKey } = useSettingsStore();
    const { project } = useProjectStore();
    const { user } = useUserStore();
    const { tier } = useBillingStore();

    // Fetch sessions when the active project changes
    useEffect(() => {
        if (project?.id) {
            fetchSessions(project.id);
        }
    }, [project?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages, sending]);

    const handleSend = async () => {
        if (!input.trim() || !project || !user || sending) return;
        const query = input;
        setInput('');
        await sendMessage(query, project.id, user.id);
    };

    const handleSuggestionClick = (query: string) => {
        setInput(query);
    };

    const isConfigComplete = useDefault || (provider && selectedModel && apiKey);

    return (
        <div className="flex h-full w-full overflow-hidden bg-background relative">
            {/* Overlay for mobile history drawer - Removed backdrop per user request */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowHistory(false)}
                        className="fixed inset-0 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar - Chat History */}
            <div className={cn(
                "fixed lg:relative z-50 lg:z-30 flex flex-col bg-card/30 backdrop-blur-xl transition-all duration-300 ease-in-out h-full",
                showHistory ? "w-72 border-r border-black/5 dark:border-white/5 opacity-100" : "w-0 opacity-0 lg:-translate-x-full overflow-hidden"
            )}>
                {/* Sidebar Header */}
                <div className="p-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                    </div>
                    <button
                        onClick={() => setShowHistory(false)}
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground transition-all"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-4">
                    <button
                        onClick={startNewSession}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all group"
                    >
                        <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                        <span className="text-[10px] font-black uppercase tracking-widest">New Session</span>
                    </button>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
                    {(() => {
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);

                        const groups = {
                            today: sessions.filter(s => new Date(s.updated_at) >= today),
                            yesterday: sessions.filter(s => {
                                const d = new Date(s.updated_at);
                                return d >= yesterday && d < today;
                            }),
                            older: sessions.filter(s => new Date(s.updated_at) < yesterday)
                        };

                        return Object.entries(groups).map(([key, items]) => {
                            if (items.length === 0) return null;
                            const title = key === 'today' ? 'Today' : key === 'yesterday' ? 'Yesterday' : 'Previous Intel';

                            return (
                                <div key={key} className="space-y-2">
                                    <div className="px-3 flex items-center gap-2 mb-3">
                                        <div className="h-px flex-1 bg-black/[0.03] dark:bg-white/[0.03]" />
                                        <span className="text-[7px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 whitespace-nowrap">{title}</span>
                                        <div className="h-px flex-1 bg-black/[0.03] dark:bg-white/[0.03]" />
                                    </div>
                                    <div className="space-y-1">
                                        {items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="group relative"
                                            >
                                                <div
                                                    onClick={() => loadSession(item.id)}
                                                    className={cn(
                                                        "flex flex-col gap-2 p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden group/session",
                                                        activeSessionId === item.id
                                                            ? "bg-primary/[0.08] border-primary/20 shadow-[0_8px_20px_rgba(var(--primary),0.05)]"
                                                            : "hover:bg-white/[0.03] border-transparent hover:border-white/5",
                                                        deletingSessionId === item.id && "bg-red-500/5 border-red-500/20"
                                                    )}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {deletingSessionId === item.id ? (
                                                            <motion.div
                                                                key="confirm"
                                                                initial={{ opacity: 0, scale: 0.95 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.95 }}
                                                                className="flex flex-col gap-3"
                                                            >
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-500">
                                                                    <Trash2 className="h-3 w-3" />
                                                                    Purge Intel From Cache?
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteSession(item.id);
                                                                            setDeletingSessionId(null);
                                                                        }}
                                                                        className="flex-1 py-1.5 rounded-xl bg-red-500 text-white text-[8px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 active:scale-95"
                                                                    >
                                                                        Confirm
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeletingSessionId(null);
                                                                        }}
                                                                        className="flex-1 py-1.5 rounded-xl bg-white/5 text-[8px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div
                                                                key="normal"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="relative z-10"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex flex-col min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <div className={cn(
                                                                                "h-1 w-1 rounded-full",
                                                                                activeSessionId === item.id ? "bg-primary animate-pulse shadow-[0_0_8px_theme(colors.primary.DEFAULT)]" : "bg-white/20"
                                                                            )} />
                                                                            <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground/50">Sequence #{item.id.slice(0, 4).toUpperCase()}</span>
                                                                        </div>
                                                                        <span className={cn(
                                                                            "text-[11px] font-bold truncate leading-tight tracking-tight",
                                                                            activeSessionId === item.id ? "text-primary" : "text-foreground/70 group-hover/session:text-foreground"
                                                                        )}>
                                                                            {item.title}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between mt-3">
                                                                    <div className="flex items-center gap-1.5 opacity-40">
                                                                        <div className="h-1 w-4 bg-white/20 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-primary w-2/3" />
                                                                        </div>
                                                                        <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">
                                                                            {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeletingSessionId(item.id);
                                                                        }}
                                                                        className="opacity-0 group-hover/session:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-muted-foreground/30 transition-all"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                    {activeSessionId === item.id && (
                                                        <motion.div
                                                            layoutId="session-bg-glow"
                                                            className="absolute inset-0 bg-primary/5 pointer-events-none"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}

                    {sessions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 opacity-30">
                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                <Brain className="h-8 w-8 text-primary" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-[9px] font-black uppercase tracking-[0.2em]">No Neural Cache</div>
                                <p className="text-[8px] font-medium text-muted-foreground max-w-[160px] leading-relaxed">Initiate a conversation to record architectural intelligence.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold truncate">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Engineer'}</span>
                            <span className="text-[8px] text-muted-foreground uppercase tracking-widest font-black shrink-0">{tier} License</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex flex-1 h-full flex-col overflow-hidden bg-background relative">
                {/* Panel Toggle Button (When sidebar hidden) */}
                {!showHistory && (
                    <button
                        onClick={() => setShowHistory(true)}
                        className="absolute left-4 top-20 z-40 p-2 rounded-xl bg-card border border-black/10 dark:border-white/10 shadow-xl hover:scale-105 transition-all text-primary"
                    >
                        <PanelLeftOpen className="h-4 w-4" />
                    </button>
                )}

                {/* Ambient Background Grid & Neural Synapses */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
                
                {/* Animated Synapse Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none">
                    <motion.path
                        d="M -100 100 Q 500 300 1200 100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                        className="text-primary"
                    />
                    <motion.path
                        d="M -100 600 Q 400 400 1200 700"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
                        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        className="text-accent"
                    />
                </svg>

                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 blur-[150px] rounded-full pointer-events-none animate-pulse-slow" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
                
                {/* Noise Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.012] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto relative z-10 px-4 md:px-8 mt-4"
                    style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)' }}
                >
                    <div className="w-full h-full flex flex-col mx-auto max-w-5xl">
                        {messages.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center space-y-10 text-center pb-10">
                                <div className="relative group cursor-default mt-8">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-[80px] transition-all duration-700 group-hover:bg-primary/30 group-hover:blur-[100px] animate-pulse" />
                                    <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-card/50 backdrop-blur-3xl shadow-2xl transition-transform duration-500 group-hover:scale-105">
                                        <Sparkles className="h-10 w-10 text-primary transition-transform duration-500 group-hover:scale-110" />
                                    </div>
                                </div>

                                <div className="space-y-3 px-6">
                                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">How can I assist your engineering today?</h2>
                                    <p className="max-w-lg mx-auto text-sm font-medium text-muted-foreground leading-relaxed">
                                        Analyze codebases, detect architectural risks, or build robust features. Lumis has full context of your intelligence layer.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-8">
                                    {[
                                        { icon: Code2, label: "Architecture", prompt: "Explain the core architecture and structure of this project", desc: "Scan project layout" },
                                        { icon: AlertTriangle, label: "Security", prompt: "Scan the codebase for potential security vulnerabilities", desc: "Risk audit" },
                                        { icon: Workflow, label: "Optimization", prompt: "Suggest performance optimizations for the main logic flow", desc: "Efficiency scan" },
                                        { icon: Sparkles, label: "Refactoring", prompt: "Identify complex functions that would benefit from refactoring", desc: "Logic cleanup" }
                                    ].map((suggestion, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleSuggestionClick(suggestion.prompt)}
                                            className="rounded-[2rem] border border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-md p-6 text-left transition-all hover:-translate-y-2 hover:bg-accent/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] cursor-pointer group relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative z-10">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                        <suggestion.icon className="h-5 w-5" />
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">{suggestion.desc}</span>
                                                </div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">{suggestion.label}</div>
                                                <div className="text-xs font-bold text-foreground/70 line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors">
                                                    {suggestion.prompt}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col pb-6">
                                {messages.map((msg, i) => (
                                    <ChatMessage key={`${activeSessionId}-${i}`} {...msg} />
                                ))}
                                {sending && messages[messages.length - 1]?.role !== 'lumis' && (
                                    <ChatMessage role="lumis" content="" isThinking={true} />
                                )}
                                <div className="h-12 shrink-0" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="w-full px-4 md:px-8 pb-4 relative z-20">
                    <div className="relative group">
                        {!isConfigComplete && (
                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2rem] bg-background/80 backdrop-blur-xl border border-orange-500/20 p-20 text-center">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 mb-2 border border-orange-500/20 animate-pulse">
                                    <Shield className="h-5 w-5" />
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Inference Bridge Offline</div>
                                <p className="text-[10px] text-muted-foreground mt-1 mb-4 max-w-[280px]">
                                    Your custom AI Engine is not configured. Please provide your <span className="text-foreground font-bold italic">Provider, API Key, and Model</span> to active the Brain.
                                </p>
                                <Link
                                    to="/app/settings"
                                    className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-orange-500/20"
                                >
                                    Configure Engine in Settings
                                </Link>
                            </div>
                        )}

                        <div className={cn(
                            "relative rounded-[1.8rem] border border-white/5 bg-card/30 p-1.5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] backdrop-blur-[40px] transition-all duration-700 ring-1 ring-white/5",
                            isConfigComplete && "focus-within:ring-primary/20 focus-within:border-primary/30 focus-within:bg-card/45"
                        )}>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={isConfigComplete ? "Enter neural instruction..." : "Bridge configuration required..."}
                                disabled={!isConfigComplete}
                                className="w-full resize-none bg-transparent px-6 py-3 text-[14px] font-medium focus:outline-none min-h-[52px] max-h-[200px] disabled:opacity-0 placeholder:text-muted-foreground/30 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[9px]"
                                rows={1}
                            />
                             <div className="flex flex-wrap items-center gap-3 justify-between w-full border-t border-white/5 px-4 pb-2.5 pt-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center rounded-xl bg-white/[0.03] p-0.5 gap-0.5 border border-white/5">
                                        <Link to="/app/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all group/model">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover/model:bg-primary group-hover/model:animate-ping" />
                                            <span>{!isConfigComplete ? "Link Engine" : (useDefault ? 'Lumis Core' : selectedModel)}</span>
                                        </Link>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 ml-2">
                                        <button
                                            onClick={() => tier !== 'free' && setChatMode(chatMode === 'multi-turn' ? 'single-turn' : 'multi-turn')}
                                            disabled={!isConfigComplete || tier === 'free'}
                                            className={cn(
                                                "group/mem flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden",
                                                chatMode === 'multi-turn' ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/[0.03] text-muted-foreground hover:text-foreground border border-white/5",
                                                tier === 'free' && "opacity-30 grayscale cursor-allowed"
                                            )}
                                            title="Contextual Memory"
                                        >
                                            <History className="h-3.5 w-3.5 relative z-10" />
                                            <span className="text-[9px] font-black uppercase tracking-widest relative z-10">Memory</span>
                                            {chatMode === 'multi-turn' && <div className="absolute inset-0 bg-primary/10 animate-pulse" />}
                                        </button>
                                        
                                        <button
                                            onClick={() => tier !== 'free' && setReasoningEnabled(!reasoningEnabled)}
                                            disabled={!isConfigComplete || tier === 'free'}
                                            className={cn(
                                                "group/reason flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all relative overflow-hidden",
                                                reasoningEnabled ? "bg-accent/10 text-accent border border-accent/20" : "bg-white/[0.03] text-muted-foreground hover:text-foreground border border-white/5",
                                                tier === 'free' && "opacity-30 grayscale cursor-allowed"
                                            )}
                                            title="Reasoning Engine"
                                        >
                                            <Brain className="h-3.5 w-3.5 relative z-10" />
                                            <span className="text-[9px] font-black uppercase tracking-widest relative z-10">Reasoning</span>
                                            {reasoningEnabled && <div className="absolute inset-0 bg-accent/10 animate-pulse" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end mr-1 hidden sm:flex">
                                        <span className="text-[7px] font-black uppercase tracking-[0.3em] text-primary">Transmit</span>
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || sending || !isConfigComplete}
                                        className={cn(
                                            "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 relative group/send overflow-hidden",
                                            input.trim() && !sending && isConfigComplete
                                                ? "bg-primary text-primary-foreground shadow-[0_5px_15px_rgba(var(--primary),0.2)] hover:scale-105 active:scale-95"
                                                : "bg-white/5 text-muted-foreground cursor-not-allowed"
                                        )}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover/send:opacity-100 transition-opacity" />
                                        <Send className={cn("h-4 w-4 relative z-10 transition-transform", input.trim() && "group-hover/send:-translate-y-0.5 group-hover/send:translate-x-0.5")} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="mt-3 text-center text-[10px] font-medium text-muted-foreground opacity-90">
                        Make sure to provide a good LLM model for even better accuracy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Chat;
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Zap, Sparkles, Shield, Lock, Command, Code2, AlertTriangle, Workflow, Brain, History, Plus, PanelLeftClose, PanelLeftOpen, Trash2 } from 'lucide-react';
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
    const { project, jiraConnected, notionConnected } = useProjectStore();
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
            {/* Sidebar - Chat History */}
            <div className={cn(
                "relative z-30 flex flex-col bg-card/30 backdrop-blur-xl transition-all duration-300 ease-in-out h-full",
                showHistory ? "w-72 border-r border-black/5 dark:border-white/5 opacity-100" : "w-0 opacity-0 -translate-x-full overflow-hidden"
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
                                                        "flex flex-col gap-1.5 p-3 rounded-xl cursor-pointer transition-all border relative overflow-hidden",
                                                        activeSessionId === item.id
                                                            ? "bg-primary/[0.08] border-primary/20 shadow-[0_4px_12px_rgba(var(--primary),0.05)]"
                                                            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] border-transparent hover:border-black/5 dark:hover:border-white/5",
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
                                                                className="flex flex-col gap-3 py-1"
                                                            >
                                                                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-red-500">
                                                                    <Trash2 className="h-3 w-3" />
                                                                    Delete ?
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            deleteSession(item.id);
                                                                            setDeletingSessionId(null);
                                                                        }}
                                                                        className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-[8px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                                                    >
                                                                        Confirm
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeletingSessionId(null);
                                                                        }}
                                                                        className="flex-1 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[8px] font-black uppercase tracking-widest hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
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
                                                            >
                                                                {activeSessionId === item.id && (
                                                                    <motion.div
                                                                        layoutId="sidebar-active"
                                                                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]"
                                                                    />
                                                                )}
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <div className={cn(
                                                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                                                            activeSessionId === item.id ? "bg-primary animate-pulse" : "bg-primary/20"
                                                                        )} />
                                                                        <span className={cn(
                                                                            "text-[10.5px] font-bold truncate leading-none tracking-tight",
                                                                            activeSessionId === item.id ? "text-primary" : "text-foreground/70 group-hover:text-foreground"
                                                                        )}>
                                                                            {item.title}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center justify-between pl-4 mt-2">
                                                                    <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                                                        {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeletingSessionId(item.id);
                                                                        }}
                                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground/30 transition-all"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
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

                {/* Ambient Background Grid & Glows */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />


                {/* Floating Top Header */}
                <div className="relative z-10 w-full p-4 md:p-6 pointer-events-none">
                    <div className="inline-flex items-center gap-3 rounded-2xl bg-card/60 border border-black/5 dark:border-white/5 p-2 px-3 shadow-sm backdrop-blur-xl pointer-events-auto">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
                            <Brain className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col pr-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-[11px] font-black tracking-widest uppercase">The Brain</h1>
                                {isConfigComplete ? (
                                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-500">
                                        <span className="relative flex h-1 w-1">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1 w-1 bg-green-500"></span>
                                        </span>
                                        Online
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-orange-500">
                                        <span className="relative flex h-1 w-1">
                                            <span className="relative inline-flex rounded-full h-1 w-1 bg-orange-500"></span>
                                        </span>
                                        Offline
                                    </div>
                                )}
                            </div>
                        </div>

                        {(jiraConnected && !project?.jira_project_id) || (notionConnected && !project?.notion_project_id) ? (
                            <Link to="/app/settings" className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[8px] font-black uppercase tracking-widest hover:bg-orange-500/20 transition-all">
                                <AlertTriangle className="h-3 w-3" />
                                No Project Managment tool is detected
                            </Link>
                        ) : null}
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto relative z-10 px-4 md:px-8 mt-[-20px]"
                    style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)' }}
                >
                    <div className="w-full h-full flex flex-col">
                        {messages.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center space-y-10 text-center pb-10">
                                <div className="relative group cursor-default mt-8">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-[80px] transition-all duration-700 group-hover:bg-primary/30 group-hover:blur-[100px] animate-pulse" />
                                    <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-card/50 backdrop-blur-3xl shadow-2xl transition-transform duration-500 group-hover:scale-105">
                                        <Sparkles className="h-10 w-10 text-primary transition-transform duration-500 group-hover:scale-110" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h2 className="text-3xl font-black tracking-tight">How can I assist your engineering today?</h2>
                                    <p className="max-w-lg mx-auto text-sm font-medium text-muted-foreground leading-relaxed">
                                        Analyze codebases, detect architectural risks, or build robust features. Lumis has full context of your intelligence layer.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full pt-4">
                                    {[
                                        { icon: Code2, label: "Architecture", prompt: "Explain the core architecture and structure of this project" },
                                        { icon: AlertTriangle, label: "Security", prompt: "Scan the codebase for potential security vulnerabilities" },
                                        { icon: Workflow, label: "Optimization", prompt: "Suggest performance optimizations for the main logic flow" },
                                        { icon: Sparkles, label: "Refactoring", prompt: "Identify complex functions that would benefit from refactoring" }
                                    ].map((suggestion, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleSuggestionClick(suggestion.prompt)}
                                            className="rounded-[1.5rem] border border-black/5 dark:border-white/5 bg-card/60 backdrop-blur-sm p-5 text-left transition-all hover:-translate-y-1 hover:bg-accent/60 hover:shadow-xl cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
                                                    <suggestion.icon className="h-4 w-4" />
                                                </div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-primary">{suggestion.label}</div>
                                            </div>
                                            <div className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100">
                                                {suggestion.prompt}
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
                            "relative rounded-[1.5rem] border border-black/10 bg-card/60 p-1.5 shadow-2xl backdrop-blur-2xl transition-all dark:border-white/10",
                            isConfigComplete && "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
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
                                placeholder={isConfigComplete ? "Type your instruction or question..." : "Inference engine requires configuration..."}
                                disabled={!isConfigComplete}
                                className="w-full resize-none bg-transparent px-4 py-3 text-[13px] focus:outline-none min-h-[48px] max-h-[160px] disabled:opacity-0"
                                rows={1}
                            />
                            <div className="flex items-center justify-between border-t border-black/5 px-2 pb-1.5 pt-2 dark:border-white/5">
                                <div className="flex items-center gap-1">
                                    <Link to="/app/settings" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                                        <Sparkles className={cn("h-3 w-3", !isConfigComplete ? "text-orange-500" : "text-primary")} />
                                        <span className={cn("font-bold", !isConfigComplete && "text-orange-500 italic")}>
                                            {!isConfigComplete
                                                ? "Setup LLM (API Key / Provider)"
                                                : (useDefault ? 'Lumis (Default)' : (selectedModel || 'Active Engine'))
                                            }
                                        </span>
                                    </Link>
                                    <div className="h-4 w-px bg-black/5 dark:bg-white/5 mx-2" />
                                    <button
                                        onClick={() => tier !== 'free' && setChatMode(chatMode === 'multi-turn' ? 'single-turn' : 'multi-turn')}
                                        disabled={!isConfigComplete || tier === 'free'}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                            chatMode === 'single-turn' ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-accent border border-transparent",
                                            !isConfigComplete && "opacity-0",
                                            tier === 'free' && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <Command className="h-3 w-3" />
                                        {chatMode === 'single-turn' ? "Memory: ON" : "Memory: OFF"}
                                        {tier === 'free' && <Lock className="ml-1 h-2 w-2" />}
                                    </button>
                                    <button
                                        onClick={() => tier !== 'free' && setReasoningEnabled(!reasoningEnabled)}
                                        disabled={!isConfigComplete || tier === 'free'}
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ml-1",
                                            reasoningEnabled ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-accent border border-transparent",
                                            !isConfigComplete && "opacity-0",
                                            tier === 'free' && "cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <Zap className={cn("h-3 w-3", reasoningEnabled && "fill-current")} />
                                        Reasoning
                                        {tier === 'free' && <Lock className="ml-1 h-2 w-2" />}
                                    </button>
                                    {tier === 'free' && (
                                        <Link to="/app/billing" className="group/upgrade relative ml-2">
                                            <div className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/20 transition-all border border-primary/20 shadow-sm shadow-primary/10">
                                                <Zap className="h-2.5 w-2.5 animate-pulse" />
                                                Upgrade
                                            </div>
                                        </Link>
                                    )}
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || sending || !isConfigComplete}
                                    className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                                        input.trim() && !sending && isConfigComplete
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </button>
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
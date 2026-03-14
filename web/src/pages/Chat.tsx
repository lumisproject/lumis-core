import { useState, useEffect, useRef } from 'react';
import { Send, Zap, Sparkles, Shield } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import ChatMessage from '@/components/chat/ChatMessage';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const Chat = () => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { messages, sending, sendMessage, reasoningEnabled, setReasoningEnabled, chatMode, setChatMode } = useChatStore();
    const { selectedModel, useDefault, provider, apiKey } = useSettingsStore();
    const { project } = useProjectStore();
    const { user } = useUserStore();

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

    const isConfigComplete = useDefault || (provider && selectedModel && apiKey);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/5 pb-4 dark:border-white/5">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">The Brain</h1>
                    <p className="text-xs text-muted-foreground">Autonomous Intelligence Layer</p>
                </div>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
            >
                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center space-y-8 px-4 text-center">
                        <div className="relative">
                            <div className="absolute inset-0 scale-150 rounded-full bg-primary/10 blur-3xl" />
                            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-black/5 shadow-2xl transition-transform hover:scale-110 dark:border-white/5">
                                <Sparkles className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                        <div className="max-w-md space-y-4">
                            <h2 className="text-2xl font-bold tracking-tight">How can I assist your engineering work today?</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Analyze codebases, detect architectural risks, or help you debug complex logic. Lumis understands the full context.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {messages.map((msg, i) => (
                            <ChatMessage key={i} {...msg} />
                        ))}
                        {sending && messages[messages.length - 1].role !== 'lumis' && (
                            <ChatMessage role="lumis" content="" isThinking={true} />
                        )}
                        <div className="h-40 shrink-0" />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="mx-auto w-full max-w-4xl px-4 pb-10">
                <div className="relative group">
                    {!isConfigComplete && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-background/80 backdrop-blur-xl border border-orange-500/20 p-20 text-center">
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
                        "relative rounded-2xl border border-black/10 bg-card/50 p-2 shadow-2xl backdrop-blur-2xl transition-all dark:border-white/10",
                        isConfigComplete && "focus-within:border-primary/50"
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
                            className="w-full resize-none bg-transparent px-4 py-3 text-sm focus:outline-none min-h-[60px] disabled:opacity-0"
                            rows={2}
                        />
                        <div className="flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/5">
                            <div className="flex items-center gap-1 px-2">
                                <button
                                    onClick={() => setChatMode(chatMode === 'multi-turn' ? 'single-turn' : 'multi-turn')}
                                    disabled={!isConfigComplete}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                        chatMode === 'multi-turn' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                                        !isConfigComplete && "opacity-0"
                                    )}
                                >
                                    <Sparkles className="h-3 w-3" />
                                    {chatMode === 'multi-turn' ? "Multi-turn" : "Single-turn"}
                                </button>
                                <div className="h-4 w-px bg-black/5 dark:bg-white/5 mx-1" />
                                <button
                                    onClick={() => setReasoningEnabled(!reasoningEnabled)}
                                    disabled={!isConfigComplete}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                        reasoningEnabled ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                                        !isConfigComplete && "opacity-0"
                                    )}
                                >
                                    <Zap className={cn("h-3 w-3", reasoningEnabled && "fill-current")} />
                                    Reasoning
                                </button>
                                <div className="h-4 w-px bg-black/5 dark:bg-white/5 mx-1" />
                                <Link to="/app/settings" className="flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                    <Sparkles className={cn("h-3 w-3", !isConfigComplete ? "text-orange-500" : "text-primary")} />
                                    <span className={cn("font-bold", !isConfigComplete && "text-orange-500 italic")}>
                                        {!isConfigComplete
                                            ? "Setup LLM (API Key / Provider) in Settings"
                                            : (selectedModel || (useDefault ? 'No model is selected' : 'Active Engine'))
                                        }
                                    </span>
                                </Link>
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || sending || !isConfigComplete}
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                                    input.trim() && !sending && isConfigComplete
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
                <p className="mt-3 text-center text-[10px] text-muted-foreground">
                    Lumis may make mistakes. Verify critical code outputs.
                </p>
            </div>
        </div>
    );
};

export default Chat;

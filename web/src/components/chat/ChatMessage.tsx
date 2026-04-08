import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Brain, ChevronDown, Code2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    role: 'user' | 'lumis';
    content: string;
    isThinking?: boolean;
    thoughts?: string[];
    isStreaming?: boolean;
}

const CopyButton = ({ content }: { content: string }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-muted-foreground hover:text-foreground active:scale-95"
        >
            {copied ? (
                <>
                    <span className="text-[9px] font-black uppercase tracking-widest text-green-500">Copied</span>
                </>
            ) : (
                <>
                    <span className="text-[9px] font-black uppercase tracking-widest">Copy</span>
                </>
            )}
        </button>
    );
};

const ChatMessage = ({ role, content, isThinking, thoughts }: ChatMessageProps) => {
    const [showThoughts, setShowThoughts] = React.useState(isThinking ?? false);
    const [displayedContent, setDisplayedContent] = React.useState(content);
    const [isTyping, setIsTyping] = React.useState(false);
    const [activeTrace, setActiveTrace] = React.useState(0);
    const queueRef = React.useRef("");
    const timerRef = React.useRef<any>(null);

    const traces = [
        "Initializing core inference...",
        "Analyzing architectural vectors...",
        "Querying neural architecture graph...",
        "Synthesizing latent intelligence...",
        "Optimizing logic pathways..."
    ];

    React.useEffect(() => {
        if (isThinking) {
            const interval = setInterval(() => {
                setActiveTrace(prev => (prev + 1) % traces.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [isThinking]);

    // Auto-collapse thoughts when done thinking
    React.useEffect(() => {
        if (!isThinking) {
            setShowThoughts(false);
        } else {
            setShowThoughts(true);
        }
    }, [isThinking]);

    // Initial content Sync
    React.useEffect(() => {
        if (role === 'user') {
            setDisplayedContent(content);
            return;
        }

        // For Lumis messages, we manage the stream
        if (content.length > (displayedContent.length + queueRef.current.length)) {
            const newPart = content.slice(displayedContent.length + queueRef.current.length);
            queueRef.current += newPart;
            if (!isTyping) {
                processQueue();
            }
        }
        
        // If message is finished, make sure we show everything eventually
        if (!isThinking && queueRef.current.length === 0) {
            setDisplayedContent(content);
        }
    }, [content, isThinking]);

    const processQueue = () => {
        if (queueRef.current.length === 0) {
            setIsTyping(false);
            return;
        }

        setIsTyping(true);
        
        // Faster adaptive speed
        const baseSpeed = 10;
        const speed = Math.max(1, baseSpeed - Math.floor(queueRef.current.length / 20));
        
        // Process multiple characters if the queue is backing up to keep it "snappy"
        const chunkSize = Math.max(1, Math.floor(queueRef.current.length / 100) + 1);
        
        timerRef.current = setTimeout(() => {
            const chars = queueRef.current.slice(0, chunkSize);
            queueRef.current = queueRef.current.slice(chunkSize);
            setDisplayedContent(prev => prev + chars);
            processQueue();
        }, speed);
    };

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    if (role === 'user') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex w-full justify-end px-4 py-4 md:py-6"
            >
                <div className="flex max-w-[90%] md:max-w-[85%] items-start gap-4 flex-row-reverse group">
                    <div className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_15px_theme(colors.primary.DEFAULT/30)]">
                        <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                    <div className="relative rounded-[1.8rem] rounded-tr-[0.4rem] bg-card border border-black/10 px-6 py-3.5 backdrop-blur-2xl dark:border-white/5 dark:bg-card/60 group/user">
                        {/* Technical corner highlights */}
                        <div className="absolute bottom-0 left-0 h-8 w-8 border-l-2 border-b-2 border-primary/5 rounded-bl-[1.8rem] pointer-events-none" />
                        <div className="absolute top-0 left-0 h-8 w-8 border-l border-t border-black/5 dark:border-white/5 rounded-tl-[1.8rem] pointer-events-none" />
                        
                        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed relative z-10">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <p className="mb-0 text-[13px] text-foreground/80 font-medium tracking-tight leading-normal">{children}</p>,
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                        if (inline) {
                                            return <code className="rounded-md bg-black/5 dark:bg-white/5 px-2 py-0.5 font-mono text-[11px] text-primary font-black" {...props}>{children}</code>;
                                        }
                                        return <code className="block rounded-xl bg-black/5 dark:bg-white/5 p-4 font-mono text-[11px] overflow-x-auto my-3 border border-black/5 dark:border-white/5" {...props}>{children}</code>;
                                    }
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Append a blinking cursor if it's currently thinking/generating to make the stream intentional
    // Only show cursor if we are typing or if thinking and at the end of content
    const showCursor = isTyping || (isThinking && !isTyping);
    const displayContent = displayedContent;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex w-full flex-col gap-4 py-6 md:py-8 px-4 lg:px-0"
        >
            <div className="mx-auto flex w-full max-w-4xl gap-4 md:gap-6 px-2 lg:px-6 relative group/message">
                {/* Floating animated subtle background behind the brain icon */}
                <div className="absolute left-6 top-2 h-14 w-14 rounded-full bg-primary/20 blur-xl opacity-0 group-hover/message:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                <div className="relative flex h-8 w-8 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl shadow-2xl border border-primary/30 bg-card/80 backdrop-blur-md text-primary z-10 overflow-hidden group/avatar">
                    <div className="absolute inset-0 bg-primary/10 group-hover/avatar:bg-primary/20 transition-colors" />
                    {/* Pulsing nebula effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-accent/20 animate-spin-slow opacity-50" />
                    <Brain className={cn("h-4 w-4 md:h-6 md:w-6 relative z-10 transition-transform duration-500", isTyping || isThinking ? "scale-110" : "scale-100")} />
                </div>

                <div className="flex-1 space-y-6 overflow-hidden min-w-0">
                    {thoughts && thoughts.length > 0 && (
                        <div className="rounded-[1.2rem] border border-black/5 bg-black/[0.04] dark:bg-white/[0.04] dark:border-white/5 overflow-hidden transition-all hover:border-primary/20 group/thoughts">
                            <button
                                onClick={() => setShowThoughts(!showThoughts)}
                                className="flex w-full items-center justify-between px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all bg-card/10"
                            >
                                <div className="flex items-center gap-3">
                                    <Brain className="h-3.5 w-3.5 text-primary" />
                                    <span className="flex items-center gap-2">
                                        Reasoning Gateway <span className="opacity-30">|</span> <span className="font-mono text-primary/80">{thoughts.length} Nodes</span>
                                    </span>
                                </div>
                                <motion.div animate={{ rotate: showThoughts ? 180 : 0 }}>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </motion.div>
                            </button>
                            <AnimatePresence>
                                {showThoughts && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden bg-black/[0.01] dark:bg-white/[0.01]"
                                    >
                                        <div className="border-t border-black/5 p-4 space-y-3 dark:border-white/5">
                                            {thoughts.map((thought, i) => (
                                                <div key={i} className="flex gap-4 text-[11px] font-mono text-muted-foreground/80 leading-relaxed hover:text-foreground transition-colors group/step">
                                                    <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                                                        <div className="h-1 w-1 rounded-full bg-primary/40 mt-1" />
                                                        <div className="w-px flex-1 bg-primary/10 group-last/step:hidden" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 flex-1 pb-1">
                                                        <span className="text-[7px] font-black uppercase tracking-widest text-primary/40">P{i + 1}</span>
                                                        <span>{thought}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="prose prose-sm dark:prose-invert max-w-none text-[13.5px] md:text-[14px] leading-relaxed text-foreground/90">
                        {content ? (
                            <div className="rounded-[1.5rem] rounded-tl-[0.3rem] border border-black/10 dark:border-white/10 bg-card/50 backdrop-blur-3xl p-5 md:p-6 relative overflow-hidden group/bubble">
                                {/* Technical corner glow & accents */}
                                <div className="absolute bottom-0 right-0 h-16 w-16 bg-primary/5 blur-2xl rounded-full pointer-events-none" />
                                <div className="absolute bottom-0 left-0 h-16 w-16 bg-accent/5 blur-2xl rounded-full pointer-events-none" />
                                
                                {/* Bottom corner highlights */}
                                <div className="absolute bottom-0 left-0 h-8 w-8 border-l border-b border-primary/20 rounded-bl-[1.5rem] pointer-events-none" />
                                <div className="absolute bottom-0 right-0 h-8 w-8 border-r border-b border-primary/20 rounded-br-[1.5rem] pointer-events-none" />

                                {/* Internal subtle light beam */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
                                
                                <div className="relative z-10 flex flex-wrap items-end">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({ node, inline, className, children, ...props }: any) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return !inline && match ? (
                                                    <div className="group/code relative rounded-2xl overflow-hidden border border-black/20 dark:border-white/20 my-8 shadow-2xl bg-[#0F0F12]">
                                                        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-xl">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                                    <Code2 className="h-3.5 w-3.5" />
                                                                </div>
                                                                <span className="text-primary/70">{match[1]}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <CopyButton content={String(children).replace(/\n$/, '')} />
                                                                <div className="flex gap-1.5 opacity-30 group-hover/code:opacity-100 transition-all duration-500">
                                                                    <div className="h-2 w-2 rounded-full bg-red-400" />
                                                                    <div className="h-2 w-2 rounded-full bg-orange-400" />
                                                                    <div className="h-2 w-2 rounded-full bg-green-400" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <SyntaxHighlighter
                                                            children={String(children).replace(/\n$/, '')}
                                                            style={vscDarkPlus}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '0.9rem', lineHeight: '1.8' }}
                                                            {...props}
                                                        />
                                                    </div>
                                                ) : (
                                                    <code className={cn("rounded-lg bg-primary/5 text-primary px-2.5 py-1 font-mono text-[13px] font-black border border-primary/10", className)} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            },
                                        p: ({ children }) => <span className="mb-6 last:mb-0 leading-[1.8] tracking-wide text-foreground/90 block">{children}</span>,
                                        ul: ({ children }) => <ul className="mb-6 space-y-3 list-none pl-0">{children}</ul>,
                                        ol: ({ children }) => <ol className="mb-6 space-y-3 list-decimal pl-5 font-mono text-sm marker:text-primary font-bold">{children}</ol>,
                                        li: ({ children }) => (
                                            <li className="relative pl-6 before:absolute before:left-1 before:top-[0.7em] before:h-1 before:w-1 before:rounded-sm before:bg-primary/50 before:rotate-45 text-foreground/90 leading-relaxed font-sans mt-2 first:mt-0">
                                                <span className="font-sans font-medium">{children}</span>
                                            </li>
                                        ),
                                        h1: ({ children }) => <h1 className="text-3xl font-black mb-6 tracking-tighter mt-10 text-foreground flex items-center gap-3"><Sparkles className="h-6 w-6 text-primary"/>{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-xl font-black mb-4 tracking-tight mt-8 uppercase text-foreground border-b border-black/5 dark:border-white/5 pb-2">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-lg font-bold mb-3 tracking-tight mt-6 text-primary">{children}</h3>,
                                        strong: ({ children }) => <strong className="font-black text-foreground">{children}</strong>,
                                        blockquote: ({ children }) => (
                                            <blockquote className="border-l-4 border-primary bg-primary/5 p-4 rounded-r-2xl my-6 text-foreground/80 italic shadow-sm">
                                                {children}
                                            </blockquote>
                                        ),
                                        table: ({ children }) => (
                                            <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/5 my-6 bg-card/50">
                                                <table className="min-w-full divide-y divide-black/5 dark:divide-white/5 text-sm">{children}</table>
                                            </div>
                                        ),
                                        th: ({ children }) => <th className="px-4 py-3 bg-black/5 dark:bg-white/5 font-bold uppercase tracking-widest text-[10px] text-muted-foreground text-left">{children}</th>,
                                        td: ({ children }) => <td className="px-4 py-3 border-t border-black/5 dark:border-white/5 opacity-80">{children}</td>,
                                    }}
                                    >
                                        {displayContent}
                                    </ReactMarkdown>
                                    {showCursor && (
                                        <motion.span
                                            animate={{ opacity: [0, 1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="inline-block w-2.5 h-5 bg-primary/80 ml-1.5 self-center rounded-sm shadow-[0_0_12px_theme(colors.primary.DEFAULT)]"
                                        />
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                </div>
            </div>
        </motion.div>
    );
};

export default ChatMessage;

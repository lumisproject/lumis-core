import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Brain, ChevronDown, ChevronUp, Code2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    role: 'user' | 'lumis';
    content: string;
    isThinking?: boolean;
    thoughts?: string[];
}

const ChatMessage = ({ role, content, isThinking, thoughts }: ChatMessageProps) => {
    const [showThoughts, setShowThoughts] = React.useState(true);

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
                    <div className="relative rounded-[1.5rem] rounded-tr-sm bg-card border border-black/5 dark:border-white/10 px-4 py-3 shadow-xl backdrop-blur-xl dark:bg-card/60">
                        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <p className="mb-0 text-[13px] text-foreground font-medium">{children}</p>,
                                    code: ({ node, inline, className, children, ...props }: any) => {
                                        if (inline) {
                                            return <code className="rounded-md bg-black/10 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-primary font-bold" {...props}>{children}</code>;
                                        }
                                        return <code className="block rounded-lg bg-black/10 dark:bg-white/10 p-3 font-mono text-[11px] overflow-x-auto my-2 border border-black/5 dark:border-white/5 shadow-inner" {...props}>{children}</code>;
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
    const displayContent = content + (isThinking && content ? ' ▍' : '');

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
                
                <div className="relative flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl shadow-xl border border-primary/30 bg-card/80 backdrop-blur-md text-primary z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-primary/10" />
                    <Brain className="h-4 w-4 md:h-5 md:w-5 relative z-10" />
                </div>

                <div className="flex-1 space-y-6 overflow-hidden min-w-0">
                    {thoughts && thoughts.length > 0 && (
                        <div className="rounded-2xl border border-black/5 bg-black/[0.03] dark:bg-white/[0.03] dark:border-white/5 overflow-hidden transition-all hover:border-black/10 dark:hover:border-white/10 shadow-sm">
                            <button
                                onClick={() => setShowThoughts(!showThoughts)}
                                className="flex w-full items-center justify-between px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                    Reasoning Engine ({thoughts.length} Nodes)
                                </div>
                                {showThoughts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <AnimatePresence>
                                {showThoughts && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]"
                                    >
                                        <div className="border-t border-black/5 p-5 space-y-3 dark:border-white/5">
                                            {thoughts.map((thought, i) => (
                                                <div key={i} className="flex gap-4 text-xs font-mono text-muted-foreground/70 leading-relaxed hover:text-foreground/90 transition-colors">
                                                    <span className="text-primary font-bold opacity-60 shrink-0">[{String(i + 1).padStart(2, '0')}]</span>
                                                    <span className="flex-1">{thought}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="prose prose-sm dark:prose-invert max-w-none text-[13.5px] md:text-[14px] leading-relaxed text-foreground/90">
                        {content || isThinking ? (
                            <div className="rounded-[1.5rem] rounded-tl-sm border border-black/5 dark:border-white/10 bg-card/40 backdrop-blur-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
                                {/* Subtle internal gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                                
                                <div className="relative z-10">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            return !inline && match ? (
                                                <div className="group relative rounded-2xl overflow-hidden border border-black/20 dark:border-white/10 my-8 shadow-2xl bg-[#0A0A0A]">
                                                    <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground backdrop-blur-xl">
                                                        <div className="flex items-center gap-2">
                                                            <Code2 className="h-3.5 w-3.5" />
                                                            {match[1]}
                                                        </div>
                                                        <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                            <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                                            <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                                            <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                        </div>
                                                    </div>
                                                    <SyntaxHighlighter
                                                        children={String(children).replace(/\n$/, '')}
                                                        style={vscDarkPlus}
                                                        language={match[1]}
                                                        PreTag="div"
                                                        customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '0.875rem', lineHeight: '1.7' }}
                                                        {...props}
                                                    />
                                                </div>
                                            ) : (
                                                <code className={cn("rounded-md bg-primary/10 text-primary px-2 py-0.5 font-mono text-[13px] font-bold border border-primary/20", className)} {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                        p: ({ children }) => <p className="mb-6 last:mb-0 leading-[1.8] tracking-wide text-foreground/90">{children}</p>,
                                        ul: ({ children }) => <ul className="mb-6 space-y-3 list-none pl-0">{children}</ul>,
                                        ol: ({ children }) => <ol className="mb-6 space-y-3 list-decimal pl-5 font-mono text-sm marker:text-primary font-bold">{children}</ol>,
                                        li: ({ children }) => (
                                            <li className="relative pl-7 before:absolute before:left-2 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-sm before:bg-primary/50 before:rotate-45 text-foreground/90 leading-relaxed font-sans">
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
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {isThinking && (
                        <div className="flex items-center gap-3 py-2 pl-2">
                            <div className="relative h-6 w-6">
                                <motion.div
                                    animate={{ scale: [1, 2, 1], opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                    className="absolute inset-0 rounded-full bg-primary/40 blur-md"
                                />
                                <div className="absolute inset-2 rounded-full bg-primary shadow-[0_0_15px_theme(colors.primary.DEFAULT)] border border-primary-foreground/20" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent animate-pulse">
                                Lumis is Thinking...
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ChatMessage;

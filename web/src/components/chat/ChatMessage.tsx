import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Brain, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
    role: 'user' | 'lumis';
    content: string;
    isThinking?: boolean;
    thoughts?: string[];
}

const ChatMessage = ({ role, content, isThinking, thoughts }: ChatMessageProps) => {
    const [showThoughts, setShowThoughts] = React.useState(true);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "flex w-full flex-col gap-4 py-8",
                role === 'lumis' ? "bg-accent/30 border-y border-black/5 dark:border-white/5" : "bg-transparent"
            )}
        >
            <div className="mx-auto flex w-full max-w-4xl gap-6 px-6">
                <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm lg:h-10 lg:w-10",
                    role === 'lumis' ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                )}>
                    {role === 'lumis' ? <Brain className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>

                <div className="flex-1 space-y-4 overflow-hidden">
                    {role === 'lumis' && thoughts && thoughts.length > 0 && (
                        <div className="rounded-xl border border-black/5 bg-accent/50 dark:border-white/5">
                            <button
                                onClick={() => setShowThoughts(!showThoughts)}
                                className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Terminal className="h-3 w-3" />
                                    Internal Reasoning ({thoughts.length} Steps)
                                </div>
                                {showThoughts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            <AnimatePresence>
                                {showThoughts && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-black/5 p-4 space-y-2 dark:border-white/5">
                                            {thoughts.map((thought, i) => (
                                                <div key={i} className="flex gap-3 text-xs font-mono text-muted-foreground/80">
                                                    <span className="text-primary opacity-50">[{i + 1}]</span>
                                                    <span>{thought}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm md:text-base leading-relaxed">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <div className="group relative rounded-xl overflow-hidden border border-white/10 my-4 shadow-2xl">
                                            <div className="flex items-center justify-between bg-black/40 px-4 py-2 text-[10px] font-mono text-muted-foreground backdrop-blur-md">
                                                <span>{match[1].toUpperCase()}</span>
                                                <div className="flex gap-1.5">
                                                    <div className="h-2 w-2 rounded-full bg-red-500/50" />
                                                    <div className="h-2 w-2 rounded-full bg-orange-500/50" />
                                                    <div className="h-2 w-2 rounded-full bg-green-500/50" />
                                                </div>
                                            </div>
                                            <SyntaxHighlighter
                                                children={String(children).replace(/\n$/, '')}
                                                style={vscDarkPlus}
                                                language={match[1]}
                                                PreTag="div"
                                                customStyle={{ margin: 0, padding: '1.5rem', background: '#0A0A0A', fontSize: '0.875rem' }}
                                                {...props}
                                            />
                                        </div>
                                    ) : (
                                        <code className={cn("rounded-md bg-accent/80 px-1.5 py-0.5 font-mono text-xs font-semibold", className)} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="mb-4 space-y-2 list-disc pl-4">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-4 space-y-2 list-decimal pl-4">{children}</ol>,
                                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 tracking-tight">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold mb-3 tracking-tight">{children}</h2>,
                            }}
                        >
                            {content || (isThinking ? "Thinking..." : "")}
                        </ReactMarkdown>
                    </div>

                    {isThinking && (
                        <div className="flex items-center gap-2 py-2">
                            <div className="relative h-4 w-4">
                                <motion.div
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="absolute inset-0 rounded-full bg-primary/30 blur-sm"
                                />
                                <div className="absolute inset-1 rounded-full bg-primary shadow-[0_0_8px_primary]" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground animate-pulse">Analyzing codebase context...</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ChatMessage;

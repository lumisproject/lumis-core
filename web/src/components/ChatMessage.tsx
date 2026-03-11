import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Sparkles, User, Brain } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ChatMessageProps {
  role: 'user' | 'lumis';
  content: string;
  isThinking?: boolean;
  thoughts?: string[];
}

const CopyButton = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy code'}
    </button>
  );
};

export const ChatMessage = ({ role, content, isThinking, thoughts }: ChatMessageProps) => {
  const isUser = role === 'user';
  
  // Controls the auto-expand/collapse of the accordion
  const [accordionVal, setAccordionVal] = useState<string | undefined>(isThinking ? "thoughts" : "");

  useEffect(() => {
    setAccordionVal(isThinking ? "thoughts" : "");
  }, [isThinking]);

  // Clean up ugly LLM RAG citations and strip the AI's internal summary block
  const processedContent = content
    .replace(/<SUMMARY>[\s\S]*?(<\/SUMMARY>|$)/i, '')
    .replace(/【(\d+)(?:†[^】]+)?】/g, '`[$1]`');

  return (
    <div className={cn("flex w-full py-6 px-4 sm:px-6", isUser ? "" : "bg-muted/20 border-y border-border/40")}>
      <div className={cn("mx-auto flex w-full max-w-3xl items-start gap-4 md:gap-6", isUser ? "flex-row-reverse" : "flex-row")}>
        
        {/* Avatar */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 shadow-sm border",
            isUser
              ? "bg-secondary text-secondary-foreground border-border"
              : "bg-background text-primary border-border/60"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>

        {/* Message Content */}
        <div className={cn("flex flex-col min-w-0 w-full", isUser ? "items-end" : "items-start")}>
          <span className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
            {isUser ? 'You' : 'Lumis'}
          </span>

          {/* Thoughts Accordion */}
          {!isUser && thoughts && thoughts.length > 0 && (
            <Accordion 
              type="single" 
              collapsible 
              value={accordionVal}
              onValueChange={setAccordionVal}
              className="w-full mb-4"
            >
              <AccordionItem value="thoughts" className="border-border/60 bg-background/40 rounded-xl px-4 border shadow-sm">
                <AccordionTrigger className="py-3 text-xs font-medium text-muted-foreground hover:no-underline [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2">
                    <Brain className={cn("h-4 w-4", isThinking ? "text-primary animate-pulse" : "text-muted-foreground")} />
                    {isThinking ? "Lumis is analyzing..." : "View thought process"}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground space-y-3 pb-4">
                  {thoughts.map((t, i) => (
                    <div key={i} className="flex gap-2.5 items-start font-mono leading-relaxed">
                      <span className="text-primary/50 mt-0.5 opacity-70 shrink-0">&gt;</span>
                      <span className="break-words">{t}</span>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex gap-1.5 items-center pl-5 pt-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          
          <div
            className={cn(
              "text-[15px] leading-relaxed w-full",
              isUser
                ? "bg-primary text-primary-foreground px-5 py-3 rounded-2xl rounded-tr-sm max-w-[90%] sm:max-w-[75%] shadow-sm"
                : "text-foreground prose prose-sm md:prose-base dark:prose-invert max-w-none break-words"
            )}
          >
            {/* Blinking block for empty text until we finish reasoning */}
            {!isUser && isThinking && processedContent.length === 0 ? (
               <span className="animate-pulse font-mono text-primary">_</span>
            ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]} // Parses markdown tables correctly
              components={{
                p: ({ children }) => <p className={cn("mb-4 last:mb-0", isUser ? "whitespace-pre-wrap" : "")}>{children}</p>,
                a: ({ href, children }) => <a href={href} className="text-primary underline underline-offset-4 hover:text-primary/80" target="_blank" rel="noreferrer">{children}</a>,
                ul: ({ children }) => <ul className={cn("mb-4 pl-6 list-disc space-y-1", isUser ? "" : "marker:text-muted-foreground")}>{children}</ul>,
                ol: ({ children }) => <ol className={cn("mb-4 pl-6 list-decimal space-y-1", isUser ? "" : "marker:text-muted-foreground")}>{children}</ol>,
                li: ({ children }) => <li className="pl-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mb-4 mt-6">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mb-3 mt-5">{children}</h3>,
                strong: ({ children }) => <strong className={cn("font-semibold", isUser ? "text-primary-foreground" : "text-foreground")}>{children}</strong>,
                
                // --- NEW: Premium Table Styling ---
                table: ({ children }) => (
                  <div className="my-6 w-full overflow-x-auto rounded-xl border border-border/50 bg-muted/10 shadow-sm">
                    <table className="w-full text-sm text-left border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted/50 border-b border-border/50 text-muted-foreground">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-border/30">{children}</tbody>,
                tr: ({ children }) => <tr className="transition-colors hover:bg-muted/20">{children}</tr>,
                th: ({ children }) => <th className="px-4 py-3 font-medium whitespace-nowrap">{children}</th>,
                td: ({ children }) => <td className="px-4 py-3 leading-relaxed">{children}</td>,
                
                // --- NEW: Blockquote Styling ---
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/50 pl-4 py-1 italic text-muted-foreground my-4 bg-muted/10 rounded-r-lg">
                    {children}
                  </blockquote>
                ),

                code({ className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');

                  // Multi-line code block rendering
                  if (match) {
                    return (
                      <div className="relative my-6 overflow-hidden rounded-xl border border-border/40 bg-[#0d1117] shadow-xl">
                        {/* Stylish Header with Traffic Lights */}
                        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5 mr-2">
                              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                            </div>
                            <span className="text-xs font-mono font-medium text-muted-foreground/80">{match[1]}</span>
                          </div>
                          <CopyButton code={codeStr} />
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus} // Sleeker contrast theme
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            padding: '1.25rem',
                            background: 'transparent',
                            fontSize: '0.875rem',
                            lineHeight: '1.6',
                          }}
                          {...props}
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  
                  // Inline code rendering
                  return (
                    <code
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[0.85em] font-mono",
                        isUser 
                          ? "bg-primary-foreground/20 text-primary-foreground" 
                          : "bg-muted text-foreground border border-border/50"
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
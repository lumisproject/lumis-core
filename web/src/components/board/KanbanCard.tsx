import React, { useState } from 'react';
import type { Ticket, Comment } from '../../stores/useBoardStore';
import { 
  AlertCircle, 
  ArrowUp, 
  ArrowDown, 
  MessageCircle, 
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface KanbanCardProps {
  ticket: Ticket;
  onDragStart: (e: React.DragEvent, ticketId: string) => void;
  onClick: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

const PriorityIcon = ({ priority }: { priority: Ticket['priority'] }) => {
  switch (priority) {
    case 'High':
      return <ArrowUp className="h-3.5 w-3.5 text-rose-500" />;
    case 'Medium':
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    case 'Low':
      return <ArrowDown className="h-3.5 w-3.5 text-blue-500" />;
    default:
      return null;
  }
};

export const KanbanCard: React.FC<KanbanCardProps> = ({ ticket, onDragStart, onClick, onDrop }) => {
  const hasAIChat = ticket.comments.some((c: Comment) => c.isAI);
  const [isTarget, setIsTarget] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e: React.DragEvent) => onDragStart(e, ticket.id)}
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        setIsTarget(true);
      }}
      onDragLeave={() => setIsTarget(false)}
      onDrop={(e: React.DragEvent) => {
        onDrop?.(e);
        setIsTarget(false);
      }}
      className={cn(
        "relative transition-all duration-200",
        isTarget ? "pb-2" : "pb-0"
      )}
    >
      {/* Drop Indicator - simpler line approach */}
      {isTarget && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-full z-10 -translate-y-2" />
      )}

      <div
        id={`card-${ticket.id}`}
        onClick={onClick}
        className={cn(
          "relative flex flex-col gap-3 p-4 bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing",
          hasAIChat && "ring-1 ring-purple-500/10",
          isTarget && "border-primary opacity-50"
        )}
      >
        {/* AI Indicator Glow */}
        {hasAIChat && (
          <div className="absolute -top-1 -right-1">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/40 blur-md rounded-full" />
              <Sparkles className="h-3 w-3 text-purple-400 relative z-10 fill-purple-400/20" />
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-medium leading-tight text-foreground/90 line-clamp-2">
            {ticket.title}
          </h3>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <div className="px-1.5 py-0.5 bg-secondary text-[10px] font-bold text-muted-foreground rounded border border-border/50 tracking-wider">
              {ticket.key}
            </div>
            <PriorityIcon priority={ticket.priority} />
          </div>

          <div className="flex items-center gap-3">
            {ticket.comments.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground/60">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">{ticket.comments.length}</span>
              </div>
            )}
            <img
              src={ticket.assignee.avatar}
              alt={ticket.assignee.name}
              className="h-6 w-6 rounded-full border border-border shadow-sm ring-1 ring-background"
            />
          </div>
        </div>
        
        {/* Decorative hover highlight */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-full mx-8" />
      </div>
    </div>
  );
};

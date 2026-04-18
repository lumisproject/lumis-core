import React, { useState } from 'react';
import type { StatusColumn, Ticket } from '../../stores/useBoardStore';
import { KanbanCard } from './KanbanCard';
import { MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface KanbanColumnProps {
  column: StatusColumn;
  tickets: Ticket[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, statusId: string, index?: number) => void;
  onDragStart: (e: React.DragEvent, ticketId: string) => void;
  onTicketClick: (ticket: Ticket) => void;
  onAddTicket: (statusId: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tickets,
  onDragOver,
  onDrop,
  onDragStart,
  onTicketClick,
  onAddTicket,
}) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-2xl transition-all duration-200",
        isOver ? "bg-secondary/40 ring-2 ring-primary/20" : "bg-card/20"
      )}
      onDragOver={(e) => {
        onDragOver(e);
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      // Handle dropping directly on the column
      onDrop={(e) => {
        onDrop(e, column.id);
        setIsOver(false);
      }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 group/header">
        <div className="flex items-center gap-2.5">
          <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm", column.color)} />
          <h2 className="text-sm font-semibold text-foreground/90 uppercase tracking-wider">
            {column.title}
          </h2>
          <span className="text-xs font-bold text-muted-foreground/60 bg-secondary/50 px-2 py-0.5 rounded-md border border-border/10">
            {tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button 
            onClick={() => onAddTicket(column.id)}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button className="p-1 hover:bg-secondary rounded transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 overflow-y-auto min-h-[150px] p-2 space-y-3 custom-scrollbar">
        {tickets.map((ticket: Ticket, index: number) => (
          <KanbanCard
            key={ticket.id}
            ticket={ticket}
            onDragStart={onDragStart}
            onClick={() => onTicketClick(ticket)}
            // Pass dropping support for reordering
            onDrop={(e: React.DragEvent) => {
              e.stopPropagation(); // Avoid triggering column drop
              onDrop(e, column.id, index);
              setIsOver(false);
            }}
          />
        ))}
        {tickets.length === 0 && (
          <div className="h-20 flex items-center justify-center border-2 border-dashed border-border/10 rounded-xl">
             <span className="text-xs text-muted-foreground/40 italic">Drop here</span>
          </div>
        )}
      </div>

      {/* Column Footer */}
      <div className="p-2 border-t border-border/5">
        <button 
          onClick={() => onAddTicket(column.id)}
          className="w-full flex items-center gap-2 p-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-lg transition-all"
        >
          <Plus className="h-3 w-3" />
          Add Issue
        </button>
      </div>
    </div>
  );
};

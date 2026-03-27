import React, { useEffect, useState, useMemo } from 'react';
import { 
  LayoutGrid, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Search,
  RefreshCw,
  Plus,
  Cpu
} from 'lucide-react';
import { KanbanColumn } from '../components/board/KanbanColumn';
import { TicketModal } from '../components/board/TicketModal';
import { CreateIssueModal } from '../components/board/CreateIssueModal';
import { CreateColumnModal } from '../components/board/CreateColumnModal'; // Ensure this exists
import { AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useBoardStore, type Ticket, type StatusColumn } from '../stores/useBoardStore';
import { useProjectStore } from '../stores/useProjectStore';
import { Link } from 'react-router-dom';

const Board = () => {
  const { project } = useProjectStore();
  const [activeTool, setActiveTool] = useState<'jira' | 'notion'>('jira');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [preselectedStatus, setPreselectedStatus] = useState<string | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  const { 
    tickets, 
    columns, 
    loading, 
    fetchBoard, 
    updateTicketStatus,
    addTicket,
    addColumn // Injected from store
  } = useBoardStore();

  useEffect(() => {
    if (project?.id) {
      fetchBoard(project.id, activeTool);
    }
  }, [project?.id, activeTool, fetchBoard]);


  // Keep modal data fresh if a background sync happens while open
  useEffect(() => {
    if (selectedTicket) {
      const freshTicketData = tickets.find(t => t.id === selectedTicket.id);
      if (freshTicketData) {
        setSelectedTicket(freshTicketData);
      }
    }
  }, [tickets, selectedTicket]);

  const ticketsByStatus = useMemo(() => {
    const grouped: Record<string, Ticket[]> = {};
    columns.forEach(col => grouped[col.id] = []);
    tickets.forEach(ticket => {
      if (!grouped[ticket.status]) grouped[ticket.status] = [];
      grouped[ticket.status].push(ticket);
    });
    return grouped;
  }, [tickets, columns]);

  const handleAddColumn = async (columnData: Omit<StatusColumn, 'id'>) => {
    if (!project?.id) return;
    await addColumn(project.id, activeTool, columnData);
    setIsColumnModalOpen(false);
  };
  
  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.setData('ticketId', ticketId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatusId: string, targetInStatusIndex?: number) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (!ticketId || !project?.id) return;

    await updateTicketStatus(project.id, activeTool, ticketId, targetStatusId, targetInStatusIndex);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleAddTicket = async (newTicketData: any) => {
    if (!project?.id) return;
    await addTicket(project.id, activeTool, newTicketData);
    setIsCreateModalOpen(false);
    setPreselectedStatus(null);
  };

  const isToolMapped = activeTool === 'jira' ? !!project?.jira_project_id : !!project?.notion_project_id;

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-border/40 backdrop-blur-md sticky top-0 z-20 gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col space-y-1 md:space-y-2">
            <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase leading-none">Project Board</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-black/5 dark:border-white/5">
                {project?.repo_name || 'Active Project'} <ChevronRight className="h-3 w-3" /> {activeTool.toUpperCase()}
              </span>
              <span className="text-[10px] font-bold text-yellow-500/80 uppercase tracking-[0.2em] flex items-center gap-1.5 border-l border-border/20 pl-4">
                <RefreshCw className="h-2.5 w-2.5" />
                SYNC ACTIVE
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-secondary/50 p-1 rounded-xl border border-border/50 shadow-inner">
          <button
            onClick={() => setActiveTool('jira')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              activeTool === 'jira' ? "bg-card text-blue-500 shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-3 w-3" /> Jira
          </button>
          <div className="relative group/soon">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all text-muted-foreground opacity-30 cursor-not-allowed grayscale"
            >
              <Cpu className="h-3 w-3 shrink-0" />
              Notion
            </button>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 px-1 py-0.5 bg-yellow-500 text-[6px] font-black text-black rounded-full shadow-lg shadow-yellow-500/20">SOON</div>
          </div>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 md:px-8 py-3 bg-card/30 border-b border-border/20 gap-3 sm:gap-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border/20">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Board View</span>
          </div>
          <span className="text-sm text-muted-foreground px-3 py-1 bg-secondary/50 rounded-full border border-border/20">
             {tickets.length} total issues
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={() => project?.id && fetchBoard(project.id, activeTool)}
             className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
             title="Synchronize"
          >
            <Loader2 className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-8 py-6 scrollbar-hide relative">
        {!isToolMapped ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-bold uppercase tracking-widest">Integration Not Mapped</p>
              <p className="text-xs text-muted-foreground mt-2">You need to link a {activeTool.toUpperCase()} board to this project in settings.</p>
            </div>
            <Link to="/app/settings" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold uppercase tracking-widest">
              Go to Settings
            </Link>
          </div>
        ) : (
          <div className="flex h-full gap-6 min-w-max pb-4">
            {columns.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tickets={ticketsByStatus[column.id] || []}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onTicketClick={setSelectedTicket}
                onAddTicket={() => {
                  setPreselectedStatus(column.id);
                  setIsCreateModalOpen(true);
                }}
              />
            ))}
            
            {/* Conditional Column Creation: Only for flexible tools like Notion */}
            {activeTool !== 'jira' && (
              <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="w-[300px] h-12 flex items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-xl text-muted-foreground hover:border-primary/40 hover:text-primary transition-all group shrink-0"
              >
                <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Add Column</span>
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <CreateIssueModal
            columns={columns}
            initialStatus={preselectedStatus || undefined}
            onClose={() => {
              setIsCreateModalOpen(false);
              setPreselectedStatus(null);
            }}
            onSave={handleAddTicket}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isColumnModalOpen && (
          <CreateColumnModal
            onClose={() => setIsColumnModalOpen(false)}
            onSave={handleAddColumn}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTicket && (
          <TicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Board;
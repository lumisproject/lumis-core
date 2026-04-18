import React, { useState, useEffect } from 'react';
import { X, Type, AlignLeft, Layers, Zap, ChevronDown, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Priority, StatusColumn } from '../../stores/useBoardStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface CreateIssueModalProps {
  columns: StatusColumn[];
  initialStatus?: string;
  onClose: () => void;
  onSave: (ticketData: any) => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({ columns, initialStatus, onClose, onSave }) => {
  const { project } = useProjectStore();
  const { teamMembers, fetchTeamMembers } = useBoardStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(initialStatus || (columns.length > 0 ? columns[0].id : ''));
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    if (project?.id) {
      // Assuming 'jira' as the default tool here since Notion isn't active
      fetchTeamMembers(project.id, 'jira');
    }
  }, [project?.id, fetchTeamMembers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      title,
      description,
      status,
      priority,
      assigneeId, // Pass the assigneeId to the backend
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/60 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-card border border-border/50 shadow-2xl rounded-3xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/10 bg-secondary/10">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <PlusIcon className="h-4 w-4 text-primary" />
             </div>
             <h2 className="text-xl font-bold tracking-tight">Create New Issue</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors font-bold">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-3">
             <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Issue Summary</label>
             <div className="relative group">
                <Type className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  autoFocus
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-secondary/30 border border-border/30 rounded-2xl pl-12 pr-6 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40 font-medium"
                />
             </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Status */}
             <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Status</label>
                <div className="relative">
                   <Layers className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <select 
                     value={status}
                     onChange={e => setStatus(e.target.value)}
                     className="w-full appearance-none bg-secondary/30 border border-border/30 rounded-xl pl-12 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer"
                   >
                     {columns.map(col => (
                       <option key={col.id} value={col.id} className="bg-card">{col.title}</option>
                     ))}
                   </select>
                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>
             </div>

             {/* Priority (Restored!) */}
             <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Priority</label>
                <div className="relative">
                   <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <select 
                     value={priority}
                     onChange={e => setPriority(e.target.value as Priority)}
                     className="w-full appearance-none bg-secondary/30 border border-border/30 rounded-xl pl-12 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer"
                   >
                     <option value="High" className="bg-card">High</option>
                     <option value="Medium" className="bg-card">Medium</option>
                     <option value="Low" className="bg-card">Low</option>
                   </select>
                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
             </div>

             {/* Assignee */}
             <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Assignee</label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <select 
                     value={assigneeId}
                     onChange={e => setAssigneeId(e.target.value)}
                     className="w-full appearance-none bg-secondary/30 border border-border/30 rounded-xl pl-12 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium cursor-pointer"
                   >
                     <option value="" className="bg-card">Unassigned</option>
                     {teamMembers.map(member => (
                       <option key={member.accountId} value={member.accountId} className="bg-card">{member.name}</option>
                     ))}
                   </select>
                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Description</label>
             <div className="relative group">
                <AlignLeft className="absolute left-4 top-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <textarea 
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide more details..."
                  className="w-full bg-secondary/30 border border-border/30 rounded-2xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all resize-none min-h-[120px] placeholder:text-muted-foreground/40 font-medium"
                />
             </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
             <button 
               type="button"
               onClick={onClose}
               className="px-6 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-secondary transition-all"
             >
               Cancel
             </button>
             <button 
               type="submit"
               className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
             >
               Create Issue
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const PlusIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
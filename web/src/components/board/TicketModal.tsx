import React, { useState, useEffect } from 'react';
import type { Ticket, Comment } from '../../stores/useBoardStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { 
  X, MessageSquare, Send, Bot, User, Sparkles, Trash2, Loader2, ChevronDown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TicketModalProps {
  ticket: Ticket;
  onClose: () => void;
}

const CommentItem = ({ comment, onDelete }: { comment: Comment, onDelete: (id: string) => void }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className={cn(
      "group relative flex gap-4 p-4 rounded-2xl transition-all duration-300",
      comment.isAI 
        ? "bg-purple-500/5 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.05)]" 
        : "hover:bg-secondary/30 border border-transparent hover:border-border/50"
    )}>
      <div className="relative shrink-0">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center border-2 border-background shadow-sm ring-1 ring-border",
          comment.isAI ? "bg-purple-600/10 text-purple-400" : "bg-blue-600/10 text-blue-400"
        )}>
           {comment.isAI ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        {comment.isAI && (
          <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-purple-500 rounded-full border-2 border-background flex items-center justify-center">
            <Sparkles className="h-2 w-2 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold", comment.isAI ? "text-purple-400" : "text-foreground")}>
              {comment.author}
            </span>
            {comment.isAI && (
              <span className="px-1.5 py-0.5 bg-purple-500/10 text-[10px] font-bold text-purple-400 rounded-full border border-purple-500/20">
                AI Agent
              </span>
            )}
            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              • {new Date(comment.timestamp).toLocaleDateString()}
            </span>
          </div>
          
          <button 
            onClick={() => {
              setIsDeleting(true);
              onDelete(comment.id);
            }}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded disabled:opacity-50"
            title="Delete comment"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {comment.text}
        </p>
      </div>
    </div>
  );
};

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose }) => {
  const { 
    addComment, 
    deleteComment, 
    teamMembers, 
    fetchTeamMembers, 
    assignTicket, 
    updateTicketDescription 
  } = useBoardStore();
  const { project } = useProjectStore();
  
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Description Edit State
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescText, setEditDescText] = useState(ticket.description || '');
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  // Sync edit box if ticket data changes from background fetch
  useEffect(() => {
    if (!isEditingDesc) {
      setEditDescText(ticket.description || '');
    }
  }, [ticket.description, isEditingDesc]);

  useEffect(() => {
    if (project?.id && teamMembers.length === 0) {
      fetchTeamMembers(project.id, 'jira');
    }
  }, [project?.id, fetchTeamMembers, teamMembers.length]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !project?.id) return;
    setIsSubmitting(true);
    await addComment(project.id, 'jira', ticket.id, commentText);
    setCommentText('');
    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!project?.id) return;
    await deleteComment(project.id, 'jira', ticket.id, commentId);
  };

  const handleAssigneeChange = async (accountId: string) => {
    if (!project?.id) return;
    setIsAssigning(true);
    await assignTicket(project.id, 'jira', ticket.key, accountId);
    setIsAssigning(false);
  };

  const handleSaveDescription = async () => {
    if (!project?.id) return;
    setIsSavingDesc(true);
    await updateTicketDescription(project.id, 'jira', ticket.id, editDescText);
    setIsEditingDesc(false);
    setIsSavingDesc(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="px-2 py-0.5 bg-secondary text-xs font-bold text-muted-foreground rounded border border-border shadow-sm tracking-wide">
                {ticket.key}
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-2">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors self-start">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12">
              <div className="space-y-12">
                
                {/* Description Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      Description
                    </h3>
                    {!isEditingDesc && (
                      <button 
                        onClick={() => setIsEditingDesc(true)}
                        className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  
                  {isEditingDesc ? (
                    <div className="space-y-3 animate-in fade-in">
                      <textarea
                        value={editDescText}
                        onChange={(e) => setEditDescText(e.target.value)}
                        className="w-full bg-background/50 border border-primary/50 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none min-h-[150px]"
                        placeholder="Add a description..."
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setIsEditingDesc(false);
                            setEditDescText(ticket.description || ''); // Reset on cancel
                          }}
                          disabled={isSavingDesc}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveDescription}
                          disabled={isSavingDesc}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {isSavingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingDesc(true)}
                      className="prose prose-invert max-w-none group cursor-pointer p-4 -mx-4 rounded-xl hover:bg-secondary/30 transition-colors border border-transparent hover:border-border/50"
                    >
                      <p className="text-foreground/90 leading-relaxed text-lg whitespace-pre-wrap">
                        {ticket.description || <span className="text-muted-foreground italic">No description provided. Click here to add one.</span>}
                      </p>
                    </div>
                  )}
                </section>

                <hr className="border-border/30" />

                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-bold text-foreground/40 uppercase tracking-[0.2em] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Activity
                    </h3>
                  </div>
                  
                  <div className="space-y-4">
                    {ticket.comments.map((comment: Comment) => (
                      <CommentItem key={comment.id} comment={comment} onDelete={handleDeleteComment} />
                    ))}
                    {ticket.comments.length === 0 && (
                      <div className="p-8 bg-secondary/20 rounded-2xl border border-dashed border-border/50 text-center">
                        <p className="text-sm text-muted-foreground/60 italic">No activity yet. Start the conversation.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <div className="relative">
                  <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center justify-between">
                    Assignee 
                    {isAssigning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                  </h4>
                  
                  {/* Custom Assignee Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 bg-secondary/30 border border-border/50 rounded-xl hover:border-primary/50 transition-all",
                        isDropdownOpen && "border-primary/50 ring-2 ring-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={ticket.assignee.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${ticket.assignee.name}`} 
                          className="h-7 w-7 rounded-full border border-border shadow-sm shrink-0"
                          alt="" 
                        />
                        <span className="text-sm font-semibold truncate text-foreground">
                          {ticket.assignee.name || "Unassigned"}
                        </span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isDropdownOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setIsDropdownOpen(false)} 
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-20"
                          >
                            <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                              <button
                                onClick={() => {
                                  handleAssigneeChange('');
                                  setIsDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-3 p-2 hover:bg-secondary rounded-xl transition-colors text-left"
                              >
                                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center border border-border">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">Unassigned</span>
                              </button>
                              
                              <div className="h-px bg-border/50 my-1 mx-2" />

                              {teamMembers.map(member => (
                                <button
                                  key={member.accountId}
                                  onClick={() => {
                                    handleAssigneeChange(member.accountId);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-2 hover:bg-secondary rounded-xl transition-colors text-left",
                                    ticket.assignee.name === member.name && "bg-primary/5 border border-primary/10"
                                  )}
                                >
                                  <img 
                                    src={member.avatar} 
                                    className="h-7 w-7 rounded-full border border-border"
                                    alt="" 
                                  />
                                  <span className="text-sm font-semibold truncate text-foreground">
                                    {member.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border/50 bg-secondary/10 backdrop-blur-xl">
          <div className="relative group">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment to Jira..."
              className="w-full bg-background/50 border border-border/50 rounded-2xl px-5 py-4 pr-32 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none min-h-[100px]"
            />
            <button 
              onClick={handleAddComment}
              disabled={isSubmitting || !commentText.trim()}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Sending...' : 'Reply'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUserStore } from '@/stores/useUserStore';
import { useChatStore } from '@/stores/useChatStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { ChevronDown, Github, Plus, Check, RefreshCw, Lock, Trash2, X, AlertTriangle, Search, Database } from 'lucide-react';
import { API_BASE } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export const ProjectSwitcher: React.FC = () => {
  const { projects, project, selectProject, fetchProjects, isUpToDate, syncProject, checkProjectSync } = useProjectStore();
  const { limits } = useBillingStore();
  const isAtProjectLimit = limits.projects !== null && projects.length >= limits.projects;
  const { user } = useUserStore();
  const { clearMessages } = useChatStore();
  const navigate = useNavigate();
  
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const userId = user?.id as string | undefined;

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      // Check for remote sync updates whenever the menu is opened
      if (project?.id) {
        checkProjectSync(project.id);
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, project?.id, checkProjectSync]);

  const handleSelectProject = (projectId: string) => {
    if (projectId === project?.id) return;
    selectProject(projectId);
    clearMessages();
    setOpen(false);
  };

  const handleDeleteProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !userId) return;

    const expectedName = displayName(project);

    if (deleteConfirm !== expectedName) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${userId}/${project.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown server error' }));
        alert(`Deletion Protocol Failed: ${errorData.detail || 'Internal System Error'}`);
        setDeleting(false);
        return;
      }

      await fetchProjects(userId);
      clearMessages();

      setDeleteOpen(false);
      setDeleteConfirm('');
      setOpen(false);
      navigate('/app');
    } catch (err) {
      console.error("Delete request failed:", err);
      alert("Network Error: Could not connect to the Inference Engine.");
    } finally {
      setDeleting(false);
    }
  };

  const displayName = (p: { repo_name?: string; repo_url: string }) => {
    const slug = p.repo_name || p.repo_url.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    return slug.split('/').pop() || slug;
  };

  if (projects.length === 0) return null;

  const currentSlug = project ? displayName(project) : '';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 rounded-full border border-black/5 bg-accent/50 px-4 py-2 text-xs font-black dark:border-white/5 hover:bg-accent transition-colors min-w-[200px] uppercase tracking-widest"
      >
        <div className="flex items-center gap-2 truncate">
          {project?.status === 'syncing' || project?.sync_state?.status === 'syncing' ? (
            <RefreshCw className="h-4 w-4 shrink-0 text-primary animate-spin" />
          ) : (
            <Github className="h-4 w-4 shrink-0 text-primary" />
          )}
          <span className="truncate text-foreground max-w-[120px]">
            {project?.status === 'syncing' || project?.sync_state?.status === 'syncing' ? 'Syncing...' : project ? displayName(project) : 'Select project'}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 rounded-3xl border border-black/10 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-[#0F0F0F] z-50 origin-top-right"
          >
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">
              Neural Instances
            </div>

            {!isUpToDate && project && project.status !== 'syncing' && project.sync_state?.status !== 'syncing' && (
              <div className="mx-2 mb-4 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-orange-500 text-[9px] font-black uppercase tracking-wider">
                  <AlertTriangle className="h-3 w-3" />
                  Out of Sync Detected
                </div>
                <p className="text-[9px] text-muted-foreground font-medium leading-tight">
                  New commits found on remote. Codebase mapping might be stale.
                </p>
                <button
                  onClick={() => syncProject(project.id)}
                  className="w-full py-1.5 rounded-lg bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all"
                >
                  Force Re-Sync
                </button>
              </div>
            )}
            
            <div className="space-y-1 mb-3 max-h-[300px] overflow-y-auto scrollbar-hide">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProject(p.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all text-left",
                    project?.id === p.id 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "hover:bg-accent border border-transparent"
                  )}
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    p.id === project?.id 
                      ? (p.status === 'syncing' || p.sync_state?.status === 'syncing' ? "bg-primary animate-spin border-t-2 border-transparent" : "bg-primary animate-pulse") 
                      : (p.status === 'syncing' || p.sync_state?.status === 'syncing' ? "bg-primary/40 animate-pulse" : "bg-muted")
                  )} />
                  <span className="truncate flex-1 flex items-center gap-2">
                    {displayName(p)}
                    {(p.status === 'syncing' || p.sync_state?.status === 'syncing') && <span className="text-[8px] opacity-70 italic text-primary shrink-0"> (Syncing)</span>}
                    {(p.jira_project_id || p.notion_project_id) && (
                      <div className="flex gap-1 ml-auto">
                        {p.jira_project_id && <Search className="h-2.5 w-2.5 text-blue-500 opacity-60" />}
                        {p.notion_project_id && <Database className="h-2.5 w-2.5 text-primary opacity-60" />}
                      </div>
                    )}
                  </span>
                  {project?.id === p.id && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
            
            <div className="h-px bg-black/5 dark:bg-white/5 my-2" />
            
            <div className="space-y-1">
                <button
                    onClick={() => {
                        if (isAtProjectLimit) {
                            navigate('/app/billing');
                        } else {
                            navigate('/app/new-project');
                        }
                        setOpen(false);
                    }}
                    className={cn(
                        "w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all text-left",
                        isAtProjectLimit ? "text-muted-foreground opacity-50" : "text-primary hover:bg-primary/5"
                    )}
                >
                    {isAtProjectLimit ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>{isAtProjectLimit ? 'Limit Reached' : 'Initiate New Sync'}</span>
                </button>
                
                {project && (
                    <button
                        onClick={() => {
                            setDeleteOpen(true);
                            setOpen(false);
                        }}
                        className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all text-left text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Project</span>
                    </button>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Delete Dialog */}
      <AnimatePresence>
        {deleteOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/20"
              onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[3rem] border border-destructive/20 bg-card p-12 shadow-2xl dark:bg-[#0F0F0F] z-[210] mx-auto"
            >
              <button 
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }} 
                className="absolute right-8 top-8 rounded-full p-2 hover:bg-accent text-muted-foreground transition-all active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="mb-10 text-center space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-destructive/10 text-destructive border border-destructive/20 shadow-2xl shadow-destructive/10">
                    <AlertTriangle className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black tracking-tighter uppercase text-destructive">Protocol Termination</h2>
                    <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto">
                        This action will permanently purge all vectors, logic maps, and risk data associated with this instance.
                    </p>
                </div>
              </div>

              <form onSubmit={handleDeleteProject} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-[0.1em] text-muted-foreground ml-1">Type {displayName(project || { repo_url: '' })} to confirm</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </div>
                        <input
                            placeholder={displayName(project || { repo_url: '' })}
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            className="flex h-14 w-full rounded-2xl border border-black/5 bg-accent/30 pl-12 pr-4 text-sm font-mono font-bold transition-all focus:border-destructive/50 focus:outline-none focus:ring-4 focus:ring-destructive/10 dark:border-white/5"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}
                        className="flex-1 flex h-14 items-center justify-center rounded-2xl bg-accent text-[10px] font-black uppercase tracking-widest hover:bg-accent/80 transition-all font-bold"
                    >
                        Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deleting || !project || !userId || deleteConfirm !== currentSlug}
                      className="flex-[2] flex h-14 items-center justify-center gap-3 rounded-2xl bg-destructive text-white font-black tracking-[0.2em] text-[10px] uppercase shadow-2xl shadow-destructive/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete Repository
                    </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

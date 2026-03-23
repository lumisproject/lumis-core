import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, AlertTriangle, Bug, FileWarning, Clock, UserX, 
  GitMerge, RefreshCw, Activity, FileCode
} from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const severityConfig = {
  high: { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Critical' },
  medium: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20', label: 'Warning' },
  low: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Notice' },
};

const getRiskIcon = (riskType: string, title: string) => {
  const type = (riskType || title).toLowerCase();
  if (type.includes('delay')) return Clock;
  if (type.includes('silo')) return UserX;
  if (type.includes('legacy') || type.includes('conflict')) return GitMerge;
  if (type.includes('bug')) return Bug;
  if (type.includes('code')) return FileWarning;
  return AlertTriangle;
};

const RiskCard = ({ risk }: { risk: any }) => {
  const config = severityConfig[risk.severity as keyof typeof severityConfig] || severityConfig.medium;
  const Icon = getRiskIcon(risk.riskType, risk.title);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-card/60 backdrop-blur-sm p-7 transition-all hover:bg-card hover:shadow-xl",
        config.border
      )}
    >
      <div className="flex items-start gap-5">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-card shadow-sm", config.border)}>
          <Icon className={cn("h-6 w-6", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <span className={cn("text-[9px] font-black uppercase tracking-widest", config.color)}>{config.label}</span>
             <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
             <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">{risk.riskType || 'Architectural Risk'}</span>
          </div>
          <h3 className="text-lg font-black tracking-tight text-foreground uppercase leading-tight mb-2">{risk.title}</h3>
          {risk.file && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 mb-4 bg-accent/30 w-fit px-2 py-1 rounded-md border border-black/5 dark:border-white/5">
              <FileCode className="h-3 w-3" />
              <span className="truncate">{risk.file}</span>
            </div>
          )}
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed font-medium">
             <ReactMarkdown>{risk.description}</ReactMarkdown>
          </div>
        </div>
      </div>
      <div className={cn("absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full", config.bg.replace('/10', ''))} />
    </motion.div>
  );
};

const StatButton = ({ label, count, severity, isActive, onClick }: { label: string, count: number, severity: string | null, isActive: boolean, onClick: () => void }) => {
  const config = severity ? severityConfig[severity as keyof typeof severityConfig] : { color: 'text-primary', label: 'All' };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all duration-200",
        isActive 
          ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
          : "bg-card border-black/5 dark:border-white/5 text-muted-foreground hover:border-black/20 dark:hover:border-white/20 hover:text-foreground"
      )}
    >
      <span className={cn("text-xs font-black uppercase tracking-widest", isActive ? "text-primary-foreground" : (severity ? config.color : "text-muted-foreground"))}>{label}</span>
      <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black", isActive ? "bg-white/20 text-white" : "bg-accent text-foreground opacity-60")}>{count}</span>
    </button>
  );
};

const RiskPage = () => {
  const { risks, project, analyzeRisks, pollIngestionStatus } = useProjectStore();
  const [filter, setFilter] = useState<string | null>(null);

  // Read the status strictly from the global store
  const syncState = project?.sync_state;
  const activeStates = ['ANALYZING', 'PROGRESSING', 'syncing', 'processing'];
  const isScanning = activeStates.includes(syncState?.status || '');

  // THE FIX: Automatically poll Redis when the component mounts and while scanning
  // THE FIX: Automatically poll Redis when the component mounts and while scanning
  useEffect(() => {
    if (!project?.id) return;

    // 1. Instantly check Redis status when you navigate back to this page
    pollIngestionStatus(project.id);

    // 2. If it's scanning, ping Redis every 3 seconds to update the UI
    let interval: ReturnType<typeof setInterval>;
    
    if (isScanning) {
      interval = setInterval(() => {
        pollIngestionStatus(project.id);
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [project?.id, isScanning, pollIngestionStatus]);

  const handleAnalyze = async () => {
    if (!project?.id) return;
    await analyzeRisks(project.id);
  };

  const stats = useMemo(() => ({
    total: risks.length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  }), [risks]);

  const filteredRisks = useMemo(() => {
    if (!filter) return risks;
    return risks.filter(r => r.severity === filter);
  }, [risks, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-10 p-8 pt-12 animate-fade-in pb-24">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-5xl font-black tracking-tighter uppercase leading-none text-foreground">
              Operational Risks
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">
              Instance: <span className="text-foreground">{project?.repo_name || 'Active Workspace'}</span>
            </p>
          </div>
        </div>

        {!isScanning && risks.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex flex-wrap items-center gap-3">
                <StatButton label="All" count={stats.total} severity={null} isActive={filter === null} onClick={() => setFilter(null)} />
                <StatButton label="Critical" count={stats.high} severity="high" isActive={filter === 'high'} onClick={() => setFilter('high')} />
                <StatButton label="Warning" count={stats.medium} severity="medium" isActive={filter === 'medium'} onClick={() => setFilter('medium')} />
                <StatButton label="Notice" count={stats.low} severity="low" isActive={filter === 'low'} onClick={() => setFilter('low')} />
             </div>
             <button
                onClick={handleAnalyze}
                className="group relative flex items-center gap-3 px-6 h-12 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-500 font-black uppercase tracking-widest text-[9px] transition-all hover:bg-orange-500 hover:text-white hover:shadow-2xl hover:shadow-orange-500/20 active:scale-95 overflow-hidden"
              >
                <RefreshCw className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-700" />
                <span>Re-Scan Intelligence</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isScanning ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-32 space-y-6"
          >
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-2xl" />
              <div className="absolute inset-0 border-t-4 border-primary rounded-2xl animate-spin" />
              <Activity className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Intelligence Scan</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 animate-pulse">Navigating code synapses...</span>
            </div>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-4">
            {risks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-accent/5">
                <ShieldAlert className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <h2 className="text-xl font-black tracking-tight uppercase opacity-40">System Clear</h2>
                <p className="text-[8px] text-muted-foreground mt-2 uppercase tracking-widest font-black opacity-30 mb-8">
                  No operational risks detected in the current stratum.
                </p>
                <button
                    onClick={handleAnalyze}
                    className="group relative flex items-center gap-3 px-8 h-14 rounded-2xl border border-orange-500/30 bg-orange-500/5 text-orange-500 font-black uppercase tracking-widest text-[10px] transition-all hover:bg-orange-500 hover:text-white hover:shadow-2xl hover:shadow-orange-500/20 active:scale-95 overflow-hidden"
                >
                    <RefreshCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-700" />
                    <span>Initialize Intelligence Scan</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredRisks.map((risk) => (
                    <RiskCard key={risk.id} risk={risk} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RiskPage;
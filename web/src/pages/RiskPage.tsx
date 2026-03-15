import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Bug, FileWarning, Clock, UserX, GitMerge, RefreshCw } from 'lucide-react';
import { useProjectStore } from '@/stores/useProjectStore';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const severityConfig = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', label: 'High' },
  medium: { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Medium' },
  low: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Low' },
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all hover:ring-2 hover:ring-primary/20 dark:bg-card/20",
        config.border
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", config.bg, config.border)}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <div className={cn("text-[10px] font-bold uppercase tracking-widest", config.color)}>
                {config.label} Priority
              </div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">{risk.title}</h3>
            </div>
          </div>
          {risk.file && (
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-1.5 text-[10px] font-mono text-muted-foreground border border-black/5 dark:border-white/5">
              <span className="truncate max-w-[150px]">{risk.file.split('/').pop()}</span>
            </div>
          )}
        </div>

        {risk.file && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 px-1">
            <FileWarning className="h-3 w-3" />
            <span className="truncate">{risk.file}</span>
          </div>
        )}

        <div className="relative mt-2">
          <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
            <ReactMarkdown>{risk.description}</ReactMarkdown>
          </div>
        </div>
      </div>
      
      {/* Side accent */}
      <div className={cn("absolute left-0 top-0 h-full w-1 opacity-40", config.color.replace('text-', 'bg-'))} />
    </motion.div>
  );
};

const RiskPage = () => {
  const { risks, project, analyzeRisks, fetchRisks } = useProjectStore();
  const [sessionForceLoad, setSessionForceLoad] = React.useState(false);
  const [isAnalyzingLocal, setIsAnalyzingLocal] = React.useState(false);
  const [isFetchingResults, setIsFetchingResults] = React.useState(false);

  const syncState = project?.sync_state;

  const handleAnalyze = async () => {
    if (!project?.id) return;
    
    setSessionForceLoad(true);
    setIsAnalyzingLocal(true);
    
    await analyzeRisks(project.id);
    
    // Guarantee minimum loader time, and prevent 'old ready' state from aborting early
    setTimeout(() => {
        setSessionForceLoad(false);
    }, 2500);
  };

  React.useEffect(() => {
    if (sessionForceLoad) return; // ignore any DB state until grace period ends
    if (isFetchingResults) return; // ignore state changes while actively downloading risks
    
    if (isAnalyzingLocal && syncState?.status === 'ready') {
       setIsFetchingResults(true);
       if (project?.id) {
           // Keep loader active UNTIL the new risks are fully fetched from the backend
           fetchRisks(project.id).finally(() => {
               setIsAnalyzingLocal(false);
               setIsFetchingResults(false);
           });
       } else {
           setIsAnalyzingLocal(false);
           setIsFetchingResults(false);
       }
    }
    
    if (isAnalyzingLocal && syncState?.status === 'error') {
       setIsAnalyzingLocal(false);
    }
  }, [syncState?.status, isAnalyzingLocal, sessionForceLoad, project?.id, fetchRisks, isFetchingResults]);

  // If page loads while DB is analyzing
  React.useEffect(() => {
    if (!isAnalyzingLocal && syncState?.status === 'ANALYZING') {
       setIsAnalyzingLocal(true);
    }
  }, [syncState?.status, isAnalyzingLocal]);

  const showLoader = sessionForceLoad || isAnalyzingLocal;

  return (
    <div className="space-y-8 animate-fade-in p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items_center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase text-black dark:text-white">Predictive Risk Analysis</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
              AI-driven identification of architectural vulnerabilities in <span className="text-black dark:text-white font-bold">{project?.repo_name || 'the codebase'}</span>.
            </p>
          </div>
        </div>

        <div className="flex">
          {!showLoader && (
            <button
              onClick={handleAnalyze}
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-orange-500 text-white hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/20 active:scale-95"
            >
              <ShieldAlert className="h-4 w-4 group-hover:rotate-12 transition-transform" />
              Trigger Risks Analysis
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showLoader && (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="rounded-[2rem] border border-orange-500/20 bg-orange-500/[0.03] p-12 flex items-center justify-center text-center backdrop-blur-md shadow-2xl shadow-orange-500/5"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500 text-white shadow-xl shadow-orange-500/20">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-orange-600">Lumis Architecture Scan</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest max-w-xs leading-relaxed">
                  Lumis is currently detecting architectural risks. <br/> 
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {!showLoader && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-3xl border border-dashed border-black/10 dark:border-white/10 opacity-50">
              <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold font-black tracking-tight uppercase">No active threats detected</h2>
              <p className="text-[10px] text-muted-foreground mt-2 text-center max-w-md uppercase tracking-widest font-bold">
                All code paths are currently within optimal operational parameters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {risks.map((risk) => (
                <RiskCard key={risk.id} risk={risk} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RiskPage;

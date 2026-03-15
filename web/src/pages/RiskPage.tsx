import { motion } from 'framer-motion';
import { ShieldAlert, AlertTriangle, Bug, FileWarning, Clock, UserX, GitMerge } from 'lucide-react';
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
  const { risks, project } = useProjectStore();

  return (
    <div className="space-y-8 animate-fade-in p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">Predictive Risk Analysis</h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">
            AI-driven identification of architectural vulnerabilities in <span className="text-foreground font-bold">{project?.repo_name || 'the codebase'}</span>.
          </p>
        </div>
      </div>

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
  );
};

export default RiskPage;

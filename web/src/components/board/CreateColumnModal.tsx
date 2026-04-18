import React, { useState } from 'react';
import { 
  X, 
  Layout,
  Palette,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { StatusColumn } from '../../stores/useBoardStore';

interface CreateColumnModalProps {
  onClose: () => void;
  onSave: (column: Omit<StatusColumn, 'id'>) => void;
}

const COLORS = [
  { name: 'Slate', value: 'bg-slate-500' },
  { name: 'Blue', value: 'bg-blue-500' },
  { name: 'Purple', value: 'bg-purple-500' },
  { name: 'Emerald', value: 'bg-emerald-500' },
  { name: 'Rose', value: 'bg-rose-500' },
  { name: 'Amber', value: 'bg-amber-500' },
  { name: 'Indigo', value: 'bg-indigo-500' },
  { name: 'Cyan', value: 'bg-cyan-500' },
];

export const CreateColumnModal: React.FC<CreateColumnModalProps> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      title: title.trim(),
      color: selectedColor
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
        className="relative w-full max-w-md bg-card border border-border/50 shadow-2xl rounded-3xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/10 bg-secondary/10">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Layout className="h-4 w-4 text-primary" />
             </div>
             <h2 className="text-xl font-bold tracking-tight">Add Notion Column</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Title Input */}
          <div className="space-y-3">
             <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Column Name</label>
             <div className="relative group">
                <Layout className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  autoFocus
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., In Review"
                  className="w-full bg-secondary/30 border border-border/30 rounded-2xl pl-12 pr-6 py-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40 font-medium"
                />
             </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-1 pl-1">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Theme Color</label>
             </div>
             <div className="grid grid-cols-4 gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className={cn(
                      "group relative h-12 rounded-xl flex items-center justify-center transition-all",
                      color.value,
                      selectedColor === color.value 
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105" 
                        : "opacity-70 hover:opacity-100 hover:scale-[1.02]"
                    )}
                  >
                    {selectedColor === color.value && (
                      <CheckCircle2 className="h-5 w-5 text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
             </div>
          </div>

          {/* Footer Actions */}
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
               disabled={!title.trim()}
               className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Create Column
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
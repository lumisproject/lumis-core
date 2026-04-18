import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const JiraCallback = () => {
    const [searchParams] = useSearchParams();
    const message = searchParams.get('message') || '';
    const navigate = useNavigate();
    const isSuccess = message.toLowerCase().includes('success') || !message.toLowerCase().includes('error');

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/app/settings');
        }, 3000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="flex h-[calc(100vh-64px)] items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-md rounded-[2.5rem] border border-black/5 bg-card p-10 text-center shadow-2xl dark:border-white/5"
            >
                <div className="mb-8 flex justify-center">
                    {isSuccess ? (
                        <div className="relative">
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1.2 }}
                                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
                            />
                            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                                <CheckCircle2 className="h-12 w-12 text-primary" />
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
                            <XCircle className="h-12 w-12 text-destructive" />
                        </div>
                    )}
                </div>

                <h2 className="text-3xl font-black tracking-tighter mb-4">
                    {isSuccess ? 'Atlassian Node Linked' : 'Connection Interrupted'}
                </h2>
                
                <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-10">
                    {message || (isSuccess 
                        ? 'Your Jira workspace has been successfully integrated into the Lumis intelligence layer.' 
                        : 'Lumis was unable to establish a secure handshake with Atlassian. Please retry.')}
                </p>

                <div className="flex items-center justify-center gap-3 py-4 border-t border-black/5 dark:border-white/5">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                        Returning to Configuration
                    </span>
                </div>
            </motion.div>
        </div>
    );
};

export default JiraCallback;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';

const Signup = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { signUp, loading, error, clearError } = useUserStore();
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await signUp(email, password);
        if (success) navigate('/app');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 dark:bg-[#0A0A0A]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl grid md:grid-cols-2 gap-12 items-center"
            >
                <div className="hidden md:block space-y-8">
                    <Link to="/" className="flex items-center transition-transform hover:scale-105">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-12 w-auto block dark:hidden" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-12 w-auto hidden dark:block" />
                    </Link>
                    <h1 className="text-5xl font-black tracking-tight leading-tight">Build better software with <span className="text-primary">Lumis</span>.</h1>
                    <div className="space-y-4">
                        <FeatureItem text="Analyze codebases autonomously" />
                        <FeatureItem text="Detect architectural risks early" />
                        <FeatureItem text="Sync Jira and Notion workflows" />
                        <FeatureItem text="Real-time Github integration" />
                    </div>
                </div>

                <div className="w-full max-w-md mx-auto">
                    <div className="md:hidden mb-8 flex flex-col items-center">
                        <Link to="/" className="mb-8 flex items-center justify-center transition-transform hover:scale-105">
                            <img src="/lumis-black.svg" alt="Lumis Logo" className="h-12 w-auto block dark:hidden" />
                            <img src="/lumis-white.svg" alt="Lumis Logo" className="h-12 w-auto hidden dark:block" />
                        </Link>
                        <h1 className="text-3xl font-black tracking-tight text-center">Join Lumis</h1>
                    </div>

                    <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-2xl shadow-black/5 dark:border-white/5 dark:bg-card dark:shadow-none">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mb-6 flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-medium text-destructive border border-destructive/20"
                            >
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>{error}</p>
                                <button onClick={clearError} className="ml-auto opacity-50 hover:opacity-100">×</button>
                            </motion.div>
                        )}

                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                                    placeholder="name@company.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                                    placeholder="please enter you password"
                                />
                            </div>
                            <button
                                disabled={loading}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                                {!loading && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>

                        <div className="my-8 flex items-center gap-4 text-muted-foreground">
                            <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">or</span>
                            <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-primary hover:underline">Log in</Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

const FeatureItem = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <CheckCircle2 className="h-3 w-3" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{text}</span>
    </div>
);

export default Signup;

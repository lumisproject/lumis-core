import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { signIn, loading, error, clearError } = useUserStore();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await signIn(email, password);
        if (success) navigate('/app');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 dark:bg-[#0A0A0A]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="mb-8 flex flex-col items-center">
                    <Link to="/" className="mb-8 flex items-center justify-center transition-transform hover:scale-105">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-10 w-auto block dark:hidden" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-10 w-auto hidden dark:block" />
                    </Link>
                    <h1 className="text-3xl font-black tracking-tight">Welcome back</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Continue to your intelligence layer</p>
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

                    <form onSubmit={handleLogin} className="space-y-4">
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
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                                <a href="#" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">Forgot?</a>
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
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
                    Don't have an account?{' '}
                    <Link to="/signup" className="font-bold text-primary hover:underline">Create one</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Login;

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useUserStore } from '@/stores/useUserStore';

const UpdatePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const { updatePassword, loading, error, clearError } = useUserStore();
    const navigate = useNavigate();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (password !== confirmPassword) {
            setValidationError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setValidationError("Password must be at least 6 characters.");
            return;
        }

        const { success } = await updatePassword(password);
        if (success) {
            navigate('/app'); // Redirect to dashboard once updated
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
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
                    <h1 className="text-3xl font-black tracking-tight">Update Password</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Enter your new secure password</p>
                </div>

                <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-2xl shadow-black/5 dark:border-white/5 dark:bg-card dark:shadow-none">
                    {(error || validationError) && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-medium text-destructive border border-destructive/20">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>{validationError || error}</p>
                            <button 
                                onClick={() => {
                                    clearError();
                                    setValidationError(null);
                                }} 
                                className="ml-auto opacity-50 hover:opacity-100"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">New Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5 dark:bg-white/5"
                                placeholder="••••••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5 dark:bg-white/5"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            disabled={loading}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                            {!loading && <ArrowRight className="h-4 w-4" />}
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    Remembered your password?{' '}
                    <Link to="/login" className="font-bold text-primary hover:underline">Back to login</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default UpdatePassword;
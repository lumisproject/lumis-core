import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, X, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase, API_BASE } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';

const ReportProblem = () => {
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles([...files, ...Array.from(e.target.files)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { session } = useUserStore.getState();
            if (!session) throw new Error("Not authenticated");

            // 1. Upload screenshots to Supabase Storage
            const uploadedUrls: string[] = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `${session.user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('support_attachments')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('support_attachments').getPublicUrl(filePath);
                uploadedUrls.push(data.publicUrl);
            }

            // 2. Send ticket data to Backend
            const res = await fetch(`${API_BASE}/api/support/ticket`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    subject,
                    description,
                    screenshots: uploadedUrls
                })
            });

            if (!res.ok) throw new Error("Failed to submit ticket");

            setSuccess(true);
            setSubject('');
            setDescription('');
            setFiles([]);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex h-full flex-col items-center justify-center space-y-4 p-8">
                <CheckCircle2 className="h-16 w-16 text-primary" />
                <h2 className="text-2xl font-bold">Report Submitted</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    Thank you for letting us know. Our team will look into this issue and get back to you shortly.
                </p>
                <button 
                    onClick={() => navigate('/app/settings')}
                    className="mt-4 rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-105"
                >
                    Back to Settings
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6 lg:p-8">
            <button 
                onClick={() => navigate('/app/settings')}
                className="mb-6 flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Settings
            </button>

            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight">Report a Problem</h1>
                <p className="mt-2 text-sm text-muted-foreground">Describe the issue you're facing and attach screenshots if possible.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Subject</label>
                    <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="flex h-12 w-full rounded-xl border border-black/5 bg-accent/30 px-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                        placeholder="Brief description of the issue"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Details</label>
                    <textarea
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={5}
                        className="flex w-full rounded-xl border border-black/5 bg-accent/30 p-4 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10 dark:border-white/5"
                        placeholder="Please provide steps to reproduce the problem..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Screenshots (Optional)</label>
                    <div className="rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 p-6 text-center transition-colors hover:bg-accent/50">
                        <input
                            type="file"
                            id="file-upload"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                            <UploadCloud className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm font-medium text-primary">Click to upload</span>
                            <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</span>
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-3">
                            {files.map((file, index) => (
                                <div key={index} className="relative flex items-center gap-2 rounded-lg border border-black/5 dark:border-white/5 bg-card p-2 pr-8 shadow-sm text-sm">
                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Report"}
                </button>
            </form>
        </div>
    );
};

export default ReportProblem;
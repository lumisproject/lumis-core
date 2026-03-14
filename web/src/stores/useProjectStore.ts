import { create } from 'zustand';
import { supabase, API_BASE } from '@/lib/supabase';
import { useSettingsStore } from './useSettingsStore';

interface Risk {
    id: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    riskType: string;
    description: string;
    file?: string;
}

interface Project {
    id: string;
    repo_url: string;
    repo_name?: string;
    last_commit?: string;
    status?: string;
    user_id: string;
    jira_project_id?: string;
    notion_project_id?: string;
}

interface IngestionStatus {
    status: string;
    step?: string;
    logs: string[];
    error?: string;
}

interface ProjectStats {
    nodes_count: number;
    edges_count: number;
    health_percentage: number;
}

interface ProjectState {
    projects: Project[];
    project: Project | null;
    risks: Risk[];
    jiraConnected: boolean;
    notionConnected: boolean;
    ingestionStatus: IngestionStatus | null;
    projectStats: ProjectStats | null;
    loading: boolean;
    fetchProjects: (userId: string) => Promise<void>;
    selectProject: (projectId: string) => void;
    fetchJiraStatus: (userId: string) => Promise<void>;
    fetchNotionStatus: (userId: string) => Promise<void>;
    fetchRisks: (projectId: string) => Promise<void>;
    fetchProjectStats: (projectId: string) => Promise<void>;
    startIngestion: (userId: string, repoUrl: string) => Promise<string | null>;
    pollIngestionStatus: (projectId: string) => Promise<IngestionStatus | null>;
    disconnectJira: (userId: string) => Promise<void>;
    disconnectNotion: (userId: string) => Promise<void>;
    updateJiraMapping: (projectId: string, jiraKey: string) => Promise<void>;
    updateNotionMapping: (projectId: string, notionDbId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    project: null,
    risks: [],
    jiraConnected: false,
    notionConnected: false,
    ingestionStatus: null,
    projectStats: null as ProjectStats | null,
    loading: false,

    fetchProjects: async (userId: string) => {
        set({ loading: true });
        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        const projects = (data ?? []) as Project[];

        const savedProjectId = localStorage.getItem('lumis_active_project');
        const savedProject = projects.find(p => p.id === savedProjectId);

        const current = get().project;

        const active = savedProject || (current && projects.some((p) => p.id === current.id)
            ? current
            : projects[0] ?? null);

        if (active) {
            localStorage.setItem('lumis_active_project', active.id);
            await Promise.all([
                get().fetchRisks(active.id),
                get().fetchProjectStats(active.id)
            ]);
        }

        set({ projects, project: active, loading: false });
    },

    selectProject: (projectId: string) => {
        const { projects, fetchRisks, fetchProjectStats } = get();
        const next = projects.find((p) => p.id === projectId) ?? null;

        if (next) {
            localStorage.setItem('lumis_active_project', next.id);
            fetchRisks(next.id);
            fetchProjectStats(next.id);
        }

        set({ project: next });
    },

    fetchJiraStatus: async (userId: string) => {
        const { data } = await supabase
            .from('jira_tokens')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        set({ jiraConnected: !!data });
    },

    fetchNotionStatus: async (userId: string) => {
        const { data } = await supabase
            .from('notion_tokens')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        set({ notionConnected: !!data });
    },

    fetchRisks: async (projectId: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/get_risks/${projectId}`);
            const data = await res.json();
            const apiRisks = (data?.risks ?? []) as any[];

            const normalizedRisks = apiRisks.map((risk) => {
                const severityRaw = String(risk.severity ?? 'medium').toLowerCase();
                const severity = (
                    severityRaw === 'high' || severityRaw === 'low' || severityRaw === 'medium'
                        ? severityRaw
                        : 'medium'
                ) as 'high' | 'medium' | 'low';

                return {
                    id: risk.id ?? `${risk.project_id ?? 'project'}-${risk.risk_type ?? 'risk'}`,
                    severity,
                    title: risk.title ?? risk.risk_type ?? 'Risk',
                    riskType: risk.risk_type ?? 'Risk',
                    description: risk.description ?? '',
                    file: risk.file ?? risk.file_path ?? undefined,
                };
            });

            set({ risks: normalizedRisks });
        } catch {
            set({ risks: [] });
        }
    },

    fetchProjectStats: async (projectId: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/stats/${projectId}`);
            if (!res.ok) throw new Error("Failed to fetch stats");
            const data = await res.json();
            if (data.status === 'success') {
                set({ projectStats: data });
            } else {
                set({ projectStats: null });
            }
        } catch {
            set({ projectStats: null });
        }
    },

    startIngestion: async (userId, repoUrl) => {
        const settings = useSettingsStore.getState();
        const userConfig = settings.useDefault
            ? { user_id: userId }
            : {
                provider: settings.provider,
                api_key: settings.apiKey,
                model: settings.selectedModel,
                user_id: userId,
            };

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch(`${API_BASE}/api/ingest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ user_id: userId, repo_url: repoUrl, user_config: userConfig }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || "Failed to ingest project");
            }

            const data = await res.json();
            return data.project_id || null;
        } catch (error: any) {
            console.error("Ingestion failed:", error.message);
            throw error;
        }
    },

    pollIngestionStatus: async (projectId: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/ingest/status/${projectId}`);
            const data = await res.json();
            set({ ingestionStatus: data });
            return data;
        } catch {
            return null;
        }
    },

    disconnectJira: async (userId: string) => {
        try {
            await fetch(`${API_BASE}/api/jira/disconnect/${userId}`, { method: 'DELETE' });
            set({ jiraConnected: false });
        } catch { /* ignore */ }
    },

    disconnectNotion: async (userId: string) => {
        try {
            await fetch(`${API_BASE}/api/notion/disconnect/${userId}`, { method: 'DELETE' });
            set({ notionConnected: false });
        } catch { /* ignore */ }
    },

    updateJiraMapping: async (projectId: string, jiraKey: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/jira-mapping`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ jira_project_id: jiraKey }),
            });

            if (res.ok) {
                const current = get();
                const updated = current.project?.id === projectId ? { ...current.project, jira_project_id: jiraKey } : current.project;
                set((s) => ({
                    project: updated,
                    projects: s.projects.map(p => p.id === projectId ? { ...p, jira_project_id: jiraKey } : p)
                }));
                if (updated?.id) get().fetchProjectStats(updated.id);
            } else {
                const errorData = await res.text();
                console.error(`Jira mapping failed with status ${res.status}:`, errorData);
            }
        } catch (e) {
            console.error("Failed to update Jira mapping", e);
        }
    },

    updateNotionMapping: async (projectId: string, notionDbId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        try {
            const res = await fetch(`${API_BASE}/api/projects/${projectId}/notion-mapping`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ notion_project_id: notionDbId }),
            });
            if (res.ok) {
                const current = get();
                const updated = current.project?.id === projectId ? { ...current.project, notion_project_id: notionDbId } : current.project;
                set((s) => ({
                    project: updated,
                    projects: s.projects.map(p => p.id === projectId ? { ...p, notion_project_id: notionDbId } : p)
                }));
            } else {
                const errorData = await res.text();
                console.error(`Notion mapping failed with status ${res.status}:`, errorData);
            }
        } catch (e) {
            console.error("Failed to update Notion mapping", e);
        }
    },
}));

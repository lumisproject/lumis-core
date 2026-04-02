import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface SettingsState {
    useDefault: boolean;
    provider: string;
    apiKey: string;
    selectedModel: string;
    jiraProjectKey: string;
    notionDatabaseId: string;
    theme: 'light' | 'dark' | 'system';
    baseUrl: string;
    intakeUser: string;
    intakePassword: string;

    _isDirty: boolean;
    setUseDefault: (val: boolean) => void;
    setTheme: (val: 'light' | 'dark' | 'system') => void;
    setProvider: (val: string) => void;
    setApiKey: (val: string) => void;
    setSelectedModel: (val: string) => void;
    setJiraProjectKey: (val: string) => void;
    setNotionDatabaseId: (val: string) => void;
    setBaseUrl: (val: string) => void;
    setIntakeUser: (val: string) => void;
    setIntakePassword: (val: string) => void;
    resetDirty: () => void;

    fetchSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
    useDefault: false,
    provider: '',
    apiKey: '',
    selectedModel: '',
    jiraProjectKey: '',
    notionDatabaseId: '',
    theme: 'light', // default to light mode
    baseUrl: '',
    intakeUser: '',
    intakePassword: '',
    _isDirty: false,

    setUseDefault: (val) => set({ useDefault: val, _isDirty: true }),
    setTheme: (val) => set({ theme: val }), // Theme doesn't need dirty check usually
    setProvider: (val) => set({ provider: val, _isDirty: true }),
    setApiKey: (val) => set({ apiKey: val, _isDirty: true }),
    setSelectedModel: (val) => set({ selectedModel: val, _isDirty: true }),
    setJiraProjectKey: (val) => set({ jiraProjectKey: val }),
    setNotionDatabaseId: (val) => set({ notionDatabaseId: val }),
    setBaseUrl: (val) => set({ baseUrl: val, _isDirty: true }),
    setIntakeUser: (val) => set({ intakeUser: val, _isDirty: true }),
    setIntakePassword: (val) => set({ intakePassword: val, _isDirty: true }),
    resetDirty: () => set({ _isDirty: false }),

    fetchSettings: async (userId) => {
        if (!userId) return;

        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching settings:', error);
            return;
        }

        // IMPORTANT: Do not overwrite if the user has already typed something unsaved.
        const current = (useSettingsStore.getState() as any);
        const isDirty = current._isDirty || (current.apiKey && !current.apiKey.includes('•'));

        if (data && data.user_config) {
            const config = data.user_config;
            set({
                useDefault: config.use_default ?? false,
                provider: isDirty ? current.provider : (config.provider ?? 'openai'),
                apiKey: isDirty ? current.apiKey : (config.api_key ? '••••••••••••••••' : ''),
                selectedModel: isDirty ? current.selectedModel : (config.model ?? ''),
                baseUrl: isDirty ? current.baseUrl : (config.base_url ?? ''),
                intakeUser: isDirty ? current.intakeUser : (config.intake_user ?? ''),
                intakePassword: isDirty ? current.intakePassword : (config.intake_password ? '••••••••••••••••' : ''),
                jiraProjectKey: data.jira_project_key ?? current.jiraProjectKey,
                notionDatabaseId: data.notion_database_id ?? current.notionDatabaseId,
                _isDirty: isDirty // Keep it dirty if it was dirty!
            });
        }
    },
}));

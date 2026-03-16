import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

interface SettingsState {
    useDefault: boolean;
    provider: string;
    apiKey: string;
    selectedModel: string;
    jiraProjectKey: string;
    notionDatabaseId: string;
    theme: 'light' | 'dark' | 'system';

    setUseDefault: (val: boolean) => void;
    setTheme: (val: 'light' | 'dark' | 'system') => void;
    setProvider: (val: string) => void;
    setApiKey: (val: string) => void;
    setSelectedModel: (val: string) => void;
    setJiraProjectKey: (val: string) => void;
    setNotionDatabaseId: (val: string) => void;

    fetchSettings: (userId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            useDefault: false,
            provider: '',
            apiKey: '',
            selectedModel: '',
            jiraProjectKey: '',
            notionDatabaseId: '',
            theme: 'light', // default to light mode

            setUseDefault: (val) => set({ useDefault: val }),
            setTheme: (val) => set({ theme: val }),
            setProvider: (val) => set({ provider: val }),
            setApiKey: (val) => set({ apiKey: val }),
            setSelectedModel: (val) => set({ selectedModel: val }),
            setJiraProjectKey: (val) => set({ jiraProjectKey: val }),
            setNotionDatabaseId: (val) => set({ notionDatabaseId: val }),

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
                // We detect this by checking if the current apiKey does NOT contain the mask dots '•'.
                const current = (useSettingsStore.getState() as any);
                const isDirty = current.apiKey && !current.apiKey.includes('•');

                if (data && data.user_config) {
                    const config = data.user_config;
                    set({
                        useDefault: config.use_default ?? false,
                        provider: isDirty ? current.provider : (config.provider ?? 'openai'),
                        apiKey: isDirty ? current.apiKey : (config.api_key ? '••••••••••••••••' : ''),
                        selectedModel: isDirty ? current.selectedModel : (config.model ?? ''),
                        jiraProjectKey: data.jira_project_key ?? current.jiraProjectKey,
                        notionDatabaseId: data.notion_database_id ?? current.notionDatabaseId,
                    });
                }
            },
        }),
        {
            name: 'lumis-settings',
        }
    )
);

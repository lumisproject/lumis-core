import { create } from 'zustand';
import { API_BASE, supabase } from '@/lib/supabase';
import { useSettingsStore } from './useSettingsStore';

interface ChatMessage {
    role: 'user' | 'lumis';
    content: string;
    isThinking?: boolean;
    thoughts?: string[];
}

interface ChatSession {
    id: string;
    title: string;
    updated_at: string;
}

interface ChatState {
    messages: ChatMessage[];
    sessions: ChatSession[];
    activeSessionId: string | null;
    chatMode: 'single-turn' | 'multi-turn';
    reasoningEnabled: boolean;
    sending: boolean;
    loadingSessions: boolean;
    setChatMode: (mode: 'single-turn' | 'multi-turn') => void;
    setReasoningEnabled: (enabled: boolean) => void;
    fetchSessions: (projectId: string) => Promise<void>;
    loadSession: (sessionId: string) => Promise<void>;
    deleteSession: (sessionId: string) => Promise<void>;
    startNewSession: () => void;
    sendMessage: (query: string, projectId: string, userId: string) => Promise<void>;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    sessions: [],
    activeSessionId: null,
    chatMode: 'single-turn',
    reasoningEnabled: false,
    sending: false,
    loadingSessions: false,

    setChatMode: (mode) => set({ chatMode: mode }),
    setReasoningEnabled: (enabled) => set({ reasoningEnabled: enabled }),

    // Fetches the list of history items for the sidebar
    fetchSessions: async (projectId) => {
        set({ loadingSessions: true });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE}/api/chat/sessions/${projectId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                set({ sessions: data });
            }
        } catch (e) {
            console.error("Failed to fetch sessions", e);
        } finally {
            set({ loadingSessions: false });
        }
    },

    // Loads the messages when a user clicks a past session in the sidebar
    loadSession: async (sessionId) => {
        set({ activeSessionId: sessionId, messages: [] });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE}/api/chat/messages/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Map backend roles (assistant) to frontend roles (lumis)
                const msgs = data.map((m: any) => ({
                    role: m.role === 'assistant' ? 'lumis' : m.role,
                    content: m.content
                }));
                // Force multi-turn when continuing an old conversation
                set({ messages: msgs, chatMode: 'multi-turn', sending: false });
            }
        } catch (e) {
            console.error("Failed to load session messages", e);
        }
    },
    
    deleteSession: async (sessionId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            
            if (res.ok) {
                const { activeSessionId } = get();
                set((s) => ({
                    sessions: s.sessions.filter(ses => ses.id !== sessionId),
                    // If we deleted the active session, clear the screen
                    ...(activeSessionId === sessionId ? { activeSessionId: null, messages: [] } : {})
                }));
            }
        } catch (e) {
            console.error("Failed to delete session", e);
        }
    },

    startNewSession: () => set({ activeSessionId: null, messages: [] }),

    sendMessage: async (query, projectId, userId) => {
        const { chatMode, reasoningEnabled, activeSessionId } = get();
        const settings = useSettingsStore.getState();

        const userMessage: ChatMessage = { role: 'user', content: query };
        const aiMessage: ChatMessage = {
            role: 'lumis',
            content: '',
            isThinking: true,
            thoughts: [],
        };

        set((s) => ({
            messages: [...s.messages, userMessage, aiMessage],
            sending: true,
        }));

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const userConfig = settings.useDefault
                ? { user_id: userId }
                : {
                    provider: settings.provider,
                    api_key: settings.apiKey,
                    model: settings.selectedModel,
                    user_id: userId,
                    reasoning_enabled: reasoningEnabled,
                    mode: chatMode,
                    projectId: projectId,
                };

            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    project_id: projectId,
                    query,
                    mode: chatMode,
                    reasoning: reasoningEnabled,
                    user_config: userConfig,
                    session_id: activeSessionId // Send the active session ID to the backend!
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${res.status}`);
            }

            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            set((s) => {
                                const newMessages = [...s.messages];
                                const last = newMessages[newMessages.length - 1];

                                // Capture the session ID created by the backend
                                if (data.type === 'done' && data.session_id) {
                                    if (!s.activeSessionId) {
                                        // If it's a new session, refresh the sidebar after a short delay
                                        setTimeout(() => get().fetchSessions(projectId), 1000); 
                                    }
                                    
                                    // Ensure we also update the current message's thinking state
                                    const finalMessages = [...s.messages];
                                    const lastMsg = finalMessages[finalMessages.length - 1];
                                    if (lastMsg.role === 'lumis') {
                                        lastMsg.isThinking = false;
                                    }
                                    
                                    return { 
                                        activeSessionId: data.session_id,
                                        messages: finalMessages 
                                    };
                                }

                                if (last.role === 'lumis') {
                                    if (data.type === 'thought') {
                                        last.thoughts = [...(last.thoughts || []), `🤔 ${data.content}`];
                                    } else if (data.type === 'tool') {
                                        last.thoughts = [...(last.thoughts || []), `🔧 ${data.content}`];
                                    } else if (data.type === 'answer_chunk') {
                                        last.content += data.content;
                                    } else if (data.type === 'done') {
                                        last.isThinking = false;
                                    } else if (data.type === 'error') {
                                        last.content += `\n\n**Error:** ${data.content}`;
                                        last.isThinking = false;
                                    }
                                }
                                return { messages: newMessages };
                            });
                        } catch (e) {
                            console.error('Error parsing SSE event:', e);
                        }
                    }
                }
            }
            set({ sending: false });
            
            // Update the sidebar so the timestamp updates
            if (activeSessionId) get().fetchSessions(projectId);

        } catch (error: any) {
            set((s) => ({
                messages: s.messages.map((m, i) =>
                    i === s.messages.length - 1 && m.role === 'lumis'
                        ? { ...m, isThinking: false, content: m.content || `**Error:** ${error.message || 'Failed to get a response.'}` }
                        : m
                ),
                sending: false,
            }));
        }
    },

    clearMessages: () => set({ messages: [], activeSessionId: null }),
}));
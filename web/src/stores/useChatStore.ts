import { create } from 'zustand';
import { API_BASE, supabase } from '@/lib/supabase'; // <-- Added supabase import
import { useSettingsStore } from './useSettingsStore';

interface ChatMessage {
  role: 'user' | 'lumis';
  content: string;
  isThinking?: boolean;
  thoughts?: string[];
}

interface ChatState {
  messages: ChatMessage[];
  chatMode: 'single-turn' | 'multi-turn';
  reasoningEnabled: boolean;
  sending: boolean;
  setChatMode: (mode: 'single-turn' | 'multi-turn') => void;
  setReasoningEnabled: (enabled: boolean) => void;
  sendMessage: (query: string, projectId: string, userId: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  chatMode: 'single-turn',
  reasoningEnabled: false,
  sending: false,

  setChatMode: (mode) => set({ chatMode: mode }),
  setReasoningEnabled: (enabled) => set({ reasoningEnabled: enabled }),

  sendMessage: async (query, projectId, userId) => {
    const { chatMode, reasoningEnabled } = get();
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
      // 1. Get the current active session token safely
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
          'Authorization': `Bearer ${session?.access_token}` // <-- 2. Attach Token
        },
        body: JSON.stringify({
          project_id: projectId,
          query,
          mode: chatMode,
          reasoning: reasoningEnabled,
          user_config: userConfig,
        }),
      });

      // 3. Handle specific HTTP errors (like 403 limit reached or 401 unauthorized)
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
    } catch (error: any) {
      // 4. Safely display the specific error message (e.g. "Limit Reached") in the chat
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

  clearMessages: () => set({ messages: [] }),
}));
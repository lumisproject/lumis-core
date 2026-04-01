import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { useChatStore } from './useChatStore';
import { useSettingsStore } from './useSettingsStore';

interface UserState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<boolean>;
    signUp: (email: string, password: string) => Promise<boolean>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    checkSession: () => Promise<void>;
    setupAuthListener: () => { unsubscribe: () => void };
    clearError: () => void;
    clearUser: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    user: null,
    session: null,
    loading: true,
    error: null,

    signIn: async (email, password) => {
        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            set({ loading: false, error: error.message });
            return false;
        }
        set({ user: data.user, session: data.session, loading: false });
        try { useChatStore.getState().clearMessages(); } catch { }
        return true;
    },

    signUp: async (email, password) => {
        set({ loading: true, error: null });
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            set({ loading: false, error: error.message });
            return false;
        }
        set({ user: data.user, session: data.session, loading: false });
        try { useChatStore.getState().clearMessages(); } catch { }
        return true;
    },

    signOut: async () => {
        await supabase.auth.signOut();
        get().clearUser();
        try {
            useChatStore.getState().clearMessages();
            if ((useSettingsStore as any).persist) {
                (useSettingsStore as any).persist.clearStorage();
            }
        } catch (e) {
            console.error("Error clearing stores during sign out:", e);
        }
        window.location.href = '/login';
    },

    checkSession: async () => {
        set({ loading: true });
        const { data: { session } } = await supabase.auth.getSession();
        set({ user: session?.user ?? null, session, loading: false });

        if (session?.user) {
            await useSettingsStore.getState().fetchSettings(session.user.id);
        }
    },

    // --- UPDATED GOOGLE SIGN IN ---
    signInWithGoogle: async () => {
        set({ loading: true, error: null });
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/app`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });
        
        if (error) {
            set({ loading: false, error: error.message });
        }
    },

    // --- UPDATED AUTH LISTENER ---
    setupAuthListener: () => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const user = session?.user ?? null;
            set({ user, session });

            if (user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                // The database trigger has already created the settings row.
                // Fetch the settings so the UI is immediately ready.
                await useSettingsStore.getState().fetchSettings(user.id);
                
                // Optional: You can access user.user_metadata.full_name or 
                // user.user_metadata.avatar_url here to display in the UI later.
            }
        });

        return {
            unsubscribe: () => subscription.unsubscribe()
        };
    },

    clearError: () => set({ error: null }),
    clearUser: () => set({ user: null, session: null, error: null }),
}));
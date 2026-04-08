import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY || '';

export const supabase: SupabaseClient = supabaseUrl
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (new Proxy({} as SupabaseClient, {
        get: (_target, prop) => {
            if (prop === 'auth') {
                return {
                    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured.' } }),
                    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured.' } }),
                    signOut: async () => ({ error: null }),
                    getSession: async () => ({ data: { session: null }, error: null }),
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                };
            }
            if (prop === 'from') {
                return () => ({
                    select: () => ({
                        limit: () => ({
                            execute: async () => ({ data: null, error: { message: 'Supabase not configured.' } })
                        }),
                        eq: () => ({
                            maybeSingle: async () => ({ data: null, error: null }),
                        }),
                    }),
                });
            }
            return () => { };
        },
    }));

export const API_BASE = import.meta.env.VITE_API_URL;

export async function inspectProjectsTable() {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching table info:', error.message);
            return { status: 'error', message: error.message };
        }

        if (data && data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log('Detected Columns:', columns);
            return { status: 'success', columns };
        } else {
            console.log('No data found in projects table to determine schema.');
            return { status: 'success', message: 'No data in projects table' };
        }
    } catch (err) {
        console.error('Unexpected error during DB inspection:', err);
        return { status: 'error', message: 'An unexpected error occurred' };
    }
}
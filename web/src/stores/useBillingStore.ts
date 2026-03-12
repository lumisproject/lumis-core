import { create } from 'zustand';
import { API_BASE, supabase } from '@/lib/supabase';

interface BillingState {
  tier: 'free' | 'pro' | 'team';
  limits: { queries: number; projects: number; storage_gb: number };
  usage: { query_count: number; project_count: number };
  loading: boolean;
  fetchBilling: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set) => ({
  tier: 'free',
  limits: { queries: 50, projects: 1, storage_gb: 1 },
  usage: { query_count: 0, project_count: 0 },
  loading: true,
  fetchBilling: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/api/billing/usage`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ tier: data.tier, limits: data.limits, usage: data.usage, loading: false });
      }
    } catch (e) {
      console.error("Failed to fetch billing", e);
      set({ loading: false });
    }
  }
}));
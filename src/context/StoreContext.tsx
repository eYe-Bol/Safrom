'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'owner' | 'employee';

export type StoreContextType = {
  storeId: string | null;
  role: Role | null;
  branchName: string | null;
  setBranchName: (name: string) => void;
  storeName: string | null;
  setStoreName: (name: string) => void;
  loading: boolean;
  isTrial: boolean;
  subscriptionPlan: string | null;
  isActive: boolean;
  scale: string;
  setScale: (scale: string) => void;
  branchProfiles: Record<string, string>;
  refreshBranchProfiles: () => Promise<void>;
};

type StoreState = Omit<StoreContextType, 'setBranchName' | 'setStoreName' | 'refreshBranchProfiles' | 'setScale'>;

// ─── User profile shape from DB ───────────────────────────────────────────────

type UserProfile = {
  id: string;
  role: Role | null;
  branch_name: string | null;
  store_name: string | null;
  created_at: string;
  subscription_plan: string | null;
  subscription_end_date: string | null;
  is_active: boolean | null;
  owner_id: string | null;
  scale: string | null;
};

type OwnerProfile = {
  store_name: string | null;
  created_at: string;
  subscription_plan: string | null;
  subscription_end_date: string | null;
  scale: string | null;
};

type BranchProfileRow = {
  branch_name: string;
  branch_display_name: string | null;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreContextType>({
  storeId: null,
  role: null,
  branchName: null,
  setBranchName: () => {},
  storeName: null,
  setStoreName: () => {},
  loading: true,
  isTrial: false,
  subscriptionPlan: null,
  isActive: true,
  scale: 'single',
  setScale: () => {},
  branchProfiles: {},
  refreshBranchProfiles: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>({
    storeId: null,
    role: null,
    branchName: null,
    storeName: null,
    loading: true,
    isTrial: false,
    subscriptionPlan: null,
    isActive: true,
    scale: 'single',
    branchProfiles: {},
  });

  const fetchBranchProfiles = useCallback(async (storeId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('branch_profiles')
      .select('branch_name, branch_display_name')
      .eq('owner_id', storeId);

    const map: Record<string, string> = {};
    (data as BranchProfileRow[] | null)?.forEach(bp => {
      if (bp.branch_display_name) {
        map[bp.branch_name] = bp.branch_display_name;
      }
    });
    return map;
  }, []);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setState(s => ({ ...s, loading: false }));
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileErr || !profile) {
          console.error('Profile fetch error:', profileErr);
          setState(s => ({ ...s, loading: false }));
          return;
        }

        const typedProfile = profile as UserProfile;
        let storeId = typedProfile.id;
        let finalStoreName = typedProfile.store_name;
        let isTrial = false;
        let subscriptionPlan = typedProfile.subscription_plan;
        let isActive = typedProfile.is_active !== false;
        let scale = typedProfile.scale || 'single';

        if (typedProfile.role === 'employee' && typedProfile.owner_id) {
          storeId = typedProfile.owner_id;
          const { data: ownerProfile } = await supabase
            .from('users')
            .select('store_name, created_at, subscription_plan, subscription_end_date, scale')
            .eq('id', typedProfile.owner_id)
            .single();

          const owner = ownerProfile as OwnerProfile | null;
          if (owner) {
            finalStoreName = owner.store_name;
            subscriptionPlan = owner.subscription_plan;
            scale = owner.scale || 'single';
            const trialEnd = new Date(owner.created_at);
            trialEnd.setDate(trialEnd.getDate() + 7);
            isTrial = trialEnd > new Date();
            if (!isTrial && owner.subscription_end_date) {
              isActive = new Date(owner.subscription_end_date) >= new Date();
            } else if (!isTrial && !owner.subscription_plan) {
              isActive = false;
            }
          }
        } else {
          const trialEnd = new Date(typedProfile.created_at);
          trialEnd.setDate(trialEnd.getDate() + 7);
          isTrial = trialEnd > new Date();
          if (!isTrial) {
            if (typedProfile.subscription_end_date) {
              isActive = new Date(typedProfile.subscription_end_date) >= new Date();
            } else if (!typedProfile.subscription_plan) {
              isActive = false;
            }
          }
        }

        const branchProfilesMap = await fetchBranchProfiles(storeId);

        setState({
          storeId,
          role: typedProfile.role || 'owner',
          branchName: typedProfile.branch_name || 'Main Branch',
          storeName: finalStoreName || 'My Store',
          loading: false,
          isTrial,
          subscriptionPlan,
          isActive,
          scale,
          branchProfiles: branchProfilesMap,
        });
      } catch (err) {
        console.error('Store fetch error:', err);
        setState(s => ({ ...s, loading: false }));
      }
    };

    fetchStore();
  }, [fetchBranchProfiles]);

  const setBranchName = useCallback((name: string) => {
    setState(s => ({ ...s, branchName: name }));
  }, []);

  const setStoreName = useCallback((name: string) => {
    setState(s => ({ ...s, storeName: name }));
  }, []);

  const setScale = useCallback((scale: string) => {
    setState(s => ({ ...s, scale }));
  }, []);

  const refreshBranchProfiles = useCallback(async () => {
    if (!state.storeId) return;
    const updated = await fetchBranchProfiles(state.storeId);
    setState(s => ({ ...s, branchProfiles: updated }));
  }, [state.storeId, fetchBranchProfiles]);

  return (
    <StoreContext.Provider value={{ ...state, setBranchName, setStoreName, setScale, refreshBranchProfiles }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

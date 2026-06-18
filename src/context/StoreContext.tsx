'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type StoreContextType = {
  storeId: string | null;
  role: 'owner' | 'staff' | null;
  branchName: string | null;
  storeName: string | null;
  loading: boolean;
  isTrial: boolean;
  subscriptionPlan: string | null;
};

const StoreContext = createContext<StoreContextType>({
  storeId: null,
  role: null,
  branchName: null,
  storeName: null,
  loading: true,
  isTrial: false,
  subscriptionPlan: null,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreContextType>({
    storeId: null,
    role: null,
    branchName: null,
    storeName: null,
    loading: true,
    isTrial: false,
    subscriptionPlan: null,
  });

  useEffect(() => {
    const fetchStore = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(s => ({ ...s, loading: false }));
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        const isOwner = profile.role !== 'staff';
        let storeId = profile.id;
        let finalStoreName = profile.store_name;
        let isTrial = false;
        let subscriptionPlan = profile.subscription_plan;

        if (profile.role === 'staff' && profile.owner_id) {
          storeId = profile.owner_id;
          // Fetch owner's store name and trial info
          const { data: ownerProfile } = await supabase
            .from('users')
            .select('store_name, created_at, subscription_plan')
            .eq('id', profile.owner_id)
            .single();
            
          if (ownerProfile) {
            finalStoreName = ownerProfile.store_name;
            subscriptionPlan = ownerProfile.subscription_plan;
            
            const trialEnd = new Date(ownerProfile.created_at);
            trialEnd.setDate(trialEnd.getDate() + 7);
            isTrial = trialEnd > new Date();
          }
        } else {
          // It's the owner
          const trialEnd = new Date(profile.created_at);
          trialEnd.setDate(trialEnd.getDate() + 7);
          isTrial = trialEnd > new Date();
        }

        setState({
          storeId,
          role: profile.role || 'owner',
          branchName: profile.branch_name || 'Main Branch',
          storeName: finalStoreName || 'My Store',
          loading: false,
          isTrial,
          subscriptionPlan,
        });
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    };
    
    fetchStore();
  }, []);

  return (
    <StoreContext.Provider value={state}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

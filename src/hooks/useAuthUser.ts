'use client'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

type AuthUserState = {
  user: User | null
  loading: boolean
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ user: null, loading: true });

  useEffect(() => {
    const supabase = getSupabase();

    async function fetchUserWithRole() {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user ?? null;

      if (authUser) {
        try {
          const res = await fetch(`/api/auth/role?id=${authUser.id}`);
          const json = await res.json();
          if (json?.user) {
            setState({ user: { ...authUser, ...json.user } as any, loading: false });
            return;
          }
        } catch (err) {
          console.warn("Failed to fetch user role from API:", err);
        }
      }

      setState({ user: authUser, loading: false });
    }

    fetchUserWithRole();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetch(`/api/auth/role?id=${session.user.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json?.user) {
              setState({ user: { ...session.user, ...json.user } as any, loading: false });
            } else {
              setState({ user: session.user, loading: false });
            }
          })
          .catch(() => setState({ user: session.user, loading: false }));
      } else {
        setState({ user: null, loading: false });
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return state;
}

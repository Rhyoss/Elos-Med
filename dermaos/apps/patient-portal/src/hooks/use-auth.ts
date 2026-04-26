'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { portalAuth } from '@/lib/api-client';

interface AuthState {
  loading:       boolean;
  authenticated: boolean;
  patientId:     string | null;
  email:         string | null;
  emailVerified: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    loading:       true,
    authenticated: false,
    patientId:     null,
    email:         null,
    emailVerified: false,
  });

  const checkAuth = useCallback(async () => {
    const res = await portalAuth.me();
    if (res.ok && res.data) {
      setState({
        loading:       false,
        authenticated: true,
        patientId:     res.data.patientId,
        email:         res.data.email,
        emailVerified: res.data.emailVerified,
      });
    } else {
      setState({ loading: false, authenticated: false, patientId: null, email: null, emailVerified: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await portalAuth.logout();
    setState({ loading: false, authenticated: false, patientId: null, email: null, emailVerified: false });
    router.push('/login');
  }, [router]);

  return { ...state, logout, checkAuth };
}

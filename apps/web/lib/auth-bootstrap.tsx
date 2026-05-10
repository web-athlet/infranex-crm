'use client';

import { useEffect, useRef } from 'react';

import { refreshBootstrapSession } from '@/lib/auth-refresh-coordinator';
import { useAuthStore } from '@/lib/store/auth-store';

export function AuthBootstrap() {
  const setChecking = useAuthStore((state) => state.setChecking);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const bootstrapRequestIdRef = useRef(0);

  useEffect(() => {
    const requestId = bootstrapRequestIdRef.current + 1;
    bootstrapRequestIdRef.current = requestId;
    const bootstrapGeneration = useAuthStore.getState().authGeneration;

    function isCurrentBootstrap(): boolean {
      return (
        bootstrapRequestIdRef.current === requestId &&
        useAuthStore.getState().authGeneration === bootstrapGeneration
      );
    }

    function shouldClearFailedBootstrap(): boolean {
      const state = useAuthStore.getState();
      return (
        bootstrapRequestIdRef.current === requestId &&
        state.authGeneration === bootstrapGeneration &&
        (state.status === 'idle' || state.status === 'checking')
      );
    }

    async function bootstrapAuth(): Promise<void> {
      setChecking();

      try {
        const session = await refreshBootstrapSession();

        if (!isCurrentBootstrap()) {
          return;
        }

        setAuthenticated(session.accessToken, session.user);
      } catch {
        if (shouldClearFailedBootstrap()) {
          clearAuth();
        }
      }
    }

    void bootstrapAuth();

    return () => {
      if (bootstrapRequestIdRef.current === requestId) {
        bootstrapRequestIdRef.current += 1;
      }
    };
  }, [clearAuth, setAuthenticated, setChecking]);

  return null;
}

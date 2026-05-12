'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';

export function CrmCacheBoundary() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const authenticatedUserId = useAuthStore((state) =>
    state.status === 'authenticated' ? (state.user?.id ?? null) : null,
  );
  const previousAuthenticatedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const previousAuthenticatedUserId = previousAuthenticatedUserIdRef.current;
    const isAuthenticatedUserSwitch =
      authStatus === 'authenticated' &&
      authenticatedUserId !== null &&
      authenticatedUserId !== previousAuthenticatedUserId;
    const isAuthenticatedUserMissing =
      authStatus === 'authenticated' && authenticatedUserId === null;
    const isAuthenticatedSessionExit =
      authStatus === 'unauthenticated' ||
      authStatus === 'twoFactorChallenge' ||
      authStatus === 'twoFactorSetup';

    if (
      previousAuthenticatedUserId !== null &&
      (isAuthenticatedUserSwitch || isAuthenticatedUserMissing || isAuthenticatedSessionExit)
    ) {
      queryClient.removeQueries({ queryKey: crmQueryKeys.all });
    }

    if (authStatus === 'authenticated') {
      previousAuthenticatedUserIdRef.current = authenticatedUserId;
      return;
    }

    if (isAuthenticatedSessionExit) {
      previousAuthenticatedUserIdRef.current = null;
    }
  }, [authStatus, authenticatedUserId, queryClient]);

  return null;
}

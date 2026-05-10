import { create } from 'zustand';

import type { authClient } from '@/lib/auth-client';

type AuthUser = Awaited<ReturnType<(typeof authClient)['me']>>;

type AuthStatus =
  | 'idle'
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'twoFactorChallenge'
  | 'twoFactorSetup';

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  setupToken: string | null;
  challengeToken: string | null;
  authGeneration: number;
  setChecking: () => void;
  setAuthenticated: (token: string, user: AuthUser) => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setSetupToken: (token: string | null) => void;
  setChallengeToken: (token: string | null) => void;
  clearTransientAuth: () => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'idle',
  setupToken: null,
  challengeToken: null,
  authGeneration: 0,
  setChecking: () => set({ status: 'checking' }),
  setAuthenticated: (token, user) =>
    set((state) => ({
      accessToken: token,
      user,
      status: 'authenticated',
      setupToken: null,
      challengeToken: null,
      authGeneration: state.authGeneration + 1,
    })),
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  setSetupToken: (token) =>
    set((state) => ({
      accessToken: null,
      user: null,
      setupToken: token,
      challengeToken: null,
      status: token ? 'twoFactorSetup' : 'unauthenticated',
      authGeneration: state.authGeneration + 1,
    })),
  setChallengeToken: (token) =>
    set((state) => ({
      accessToken: null,
      user: null,
      challengeToken: token,
      setupToken: null,
      status: token ? 'twoFactorChallenge' : 'unauthenticated',
      authGeneration: state.authGeneration + 1,
    })),
  clearTransientAuth: () =>
    set((state) => ({
      setupToken: null,
      challengeToken: null,
      status: 'unauthenticated',
      authGeneration: state.authGeneration + 1,
    })),
  clearAuth: () =>
    set((state) => ({
      accessToken: null,
      user: null,
      status: 'unauthenticated',
      setupToken: null,
      challengeToken: null,
      authGeneration: state.authGeneration + 1,
    })),
}));

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

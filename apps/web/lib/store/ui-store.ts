'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  navExpanded: boolean;
  contextSidebarOpen: boolean;
  setNavExpanded: (isExpanded: boolean) => void;
  toggleNavExpanded: () => void;
  setContextSidebarOpen: (isOpen: boolean) => void;
  toggleContextSidebarOpen: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      navExpanded: true,
      contextSidebarOpen: false,
      setNavExpanded: (isExpanded) => set({ navExpanded: isExpanded }),
      toggleNavExpanded: () => set((state) => ({ navExpanded: !state.navExpanded })),
      setContextSidebarOpen: (isOpen) => set({ contextSidebarOpen: isOpen }),
      toggleContextSidebarOpen: () =>
        set((state) => ({ contextSidebarOpen: !state.contextSidebarOpen })),
    }),
    {
      name: 'infranex-ui-preferences',
      partialize: (state) => ({
        navExpanded: state.navExpanded,
        contextSidebarOpen: state.contextSidebarOpen,
      }),
    },
  ),
);

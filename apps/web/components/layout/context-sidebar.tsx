'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useUiStore } from '@/lib/store/ui-store';

type ContextSidebarProps = {
  children: ReactNode;
  title?: string;
  isOpen?: boolean;
};

export function ContextSidebar({ children, title, isOpen }: ContextSidebarProps) {
  const storeOpen = useUiStore((state) => state.contextSidebarOpen);
  const resolvedOpen = isOpen ?? storeOpen;

  if (!resolvedOpen) {
    return null;
  }

  return (
    <aside
      aria-label={title ?? 'Context sidebar'}
      className={cn(
        'border-border bg-surface',
        'fixed inset-x-4 bottom-24 top-4 z-30 overflow-y-auto rounded-card border p-4 shadow-card md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:rounded-none md:border-y-0 md:border-r md:p-5 md:shadow-none',
      )}
    >
      {title ? <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2> : null}
      {children}
    </aside>
  );
}

import type { ReactNode } from 'react';

import { ContextSidebar } from '@/components/layout/context-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { NavRail } from '@/components/layout/nav-rail';

type DashboardLayoutProps = {
  children: ReactNode;
  contextSidebar?: ReactNode;
  contextSidebarTitle?: string;
};

export function DashboardLayout({
  children,
  contextSidebar,
  contextSidebarTitle,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-bg text-foreground">
      <div className="flex min-h-screen">
        <NavRail />
        <div className="flex min-w-0 flex-1">
          <main className="min-w-0 flex-1 px-5 pb-28 pt-6 md:h-screen md:overflow-y-auto md:px-8 md:pb-8">
            {children}
          </main>
          {contextSidebar ? (
            <ContextSidebar title={contextSidebarTitle}>{contextSidebar}</ContextSidebar>
          ) : null}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

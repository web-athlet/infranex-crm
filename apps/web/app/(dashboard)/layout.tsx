import type { ReactNode } from 'react';

import { DashboardLayout } from '@/components/layout/dashboard-layout';

type DashboardRouteLayoutProps = {
  children: ReactNode;
};

export default function DashboardRouteLayout({ children }: DashboardRouteLayoutProps) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

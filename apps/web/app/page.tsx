import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DashboardOverview } from '@/features/dashboard/dashboard-overview';

export default function HomePage() {
  return (
    <DashboardLayout>
      <DashboardOverview />
    </DashboardLayout>
  );
}

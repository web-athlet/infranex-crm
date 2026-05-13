'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  crmClient,
  type DashboardOverviewRecord,
  type DashboardRecentActivityRecord,
  type DashboardRecentDealRecord,
  type DashboardRecentNoteRecord,
  type DashboardStageGroupRecord,
  type DashboardStatusGroupRecord,
  type DealStatus,
  type MoneyAmountRecord,
} from '@/lib/crm-client';
import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';

const numberFormatter = new Intl.NumberFormat('de-DE');

const statusLabels: Record<DealStatus, string> = {
  OPEN: 'Offen',
  WON: 'Gewonnen',
  LOST: 'Verloren',
};

const activityTypeLabels: Record<string, string> = {
  CALL: 'Call',
  EMAIL: 'E-Mail',
  MEETING: 'Meeting',
  TASK: 'Task',
  NOTE: 'Notiz',
};

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Ohne Fälligkeit';
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatMoneyAmount(amount: MoneyAmountRecord): string {
  const numericValue = Number(amount.value);

  if (!Number.isFinite(numericValue)) {
    return `${amount.value} ${amount.currency}`;
  }

  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: amount.currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `${numberFormatter.format(numericValue)} ${amount.currency}`;
  }
}

function formatMoneyList(amounts: MoneyAmountRecord[]): string {
  if (amounts.length === 0) {
    return '0';
  }

  return amounts.map(formatMoneyAmount).join(' · ');
}

function isEmptyOverview(data: DashboardOverviewRecord): boolean {
  const summaryTotal =
    data.summary.activeContactsCount +
    data.summary.activeOrganizationsCount +
    data.summary.activeDealsCount +
    data.summary.notesCount +
    data.summary.openActivitiesCount +
    data.summary.completedActivitiesCount;

  return (
    summaryTotal === 0 &&
    data.recent.deals.length === 0 &&
    data.recent.activities.length === 0 &&
    data.recent.notes.length === 0
  );
}

function relationLabel(item: {
  organization?: { name: string } | null;
  person?: { firstName: string; lastName: string } | null;
  deal?: { title: string } | null;
}): string {
  if (item.organization) {
    return item.organization.name;
  }

  if (item.person) {
    return `${item.person.firstName} ${item.person.lastName}`;
  }

  if (item.deal) {
    return item.deal.title;
  }

  return 'Keine aktive Verknüpfung';
}

function DashboardSkeleton() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded bg-border" />
        <div className="h-4 w-72 animate-pulse rounded bg-border" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-4',
        tone === 'warning' ? 'border-destructive/40' : '',
        tone === 'success' ? 'border-primary/40' : '',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SummaryCards({ data }: { data: DashboardOverviewRecord }) {
  const summary = data.summary;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Kontakte"
        value={formatCount(summary.activeContactsCount)}
        detail={`${formatCount(summary.activeOrganizationsCount)} aktive Organisationen`}
      />
      <MetricCard
        label="Offene Pipeline"
        value={formatMoneyList(data.pipeline.openPipelineValueByCurrency)}
        detail={`${formatCount(summary.openDealsCount)} offene Deals`}
      />
      <MetricCard
        label="Überfällige Aktivitäten"
        value={formatCount(summary.overdueActivitiesCount)}
        detail={`${formatCount(summary.openActivitiesCount)} offene Aktivitäten`}
        tone={summary.overdueActivitiesCount > 0 ? 'warning' : 'neutral'}
      />
      <MetricCard
        label="Gewonnen"
        value={formatMoneyList(data.pipeline.wonDealValueByCurrency)}
        detail={`${formatCount(summary.wonDealsCount)} gewonnene Deals`}
        tone="success"
      />
      <MetricCard
        label="Deals"
        value={formatCount(summary.activeDealsCount)}
        detail={`${formatCount(summary.lostDealsCount)} verlorene Deals`}
      />
      <MetricCard
        label="Heute fällig"
        value={formatCount(summary.dueTodayActivitiesCount)}
        detail={`${formatCount(summary.upcomingActivitiesCount)} kommende Aktivitäten`}
      />
      <MetricCard
        label="Erledigt"
        value={formatCount(summary.completedActivitiesCount)}
        detail="Abgeschlossene Aktivitäten"
      />
      <MetricCard
        label="Notizen"
        value={formatCount(summary.notesCount)}
        detail="Aktive Timeline-Einträge"
      />
    </div>
  );
}

function StatusRow({ group }: { group: DashboardStatusGroupRecord }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{statusLabels[group.status]}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatMoneyList(group.totalValueByCurrency)}
        </p>
      </div>
      <span className="text-sm font-semibold text-foreground">{formatCount(group.count)}</span>
    </div>
  );
}

function StageRow({ group, maxCount }: { group: DashboardStageGroupRecord; maxCount: number }) {
  const width = maxCount > 0 ? Math.max(8, Math.round((group.count / maxCount) * 100)) : 0;

  return (
    <div className="space-y-2 border-b border-border py-3 last:border-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {group.stageName ?? 'Gelöschte Stage'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoneyList(group.totalValueByCurrency)}
          </p>
        </div>
        <span className="text-sm font-semibold text-foreground">{formatCount(group.count)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function PipelineOverview({ data }: { data: DashboardOverviewRecord }) {
  const maxStageCount = Math.max(0, ...data.pipeline.dealsByStage.map((stage) => stage.count));

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="text-base font-semibold tracking-normal text-foreground">Deal Status</h2>
          <p className="mt-1 text-sm text-muted-foreground">Serverseitig aggregierte Werte</p>
        </div>
        <div className="mt-4">
          {data.pipeline.dealsByStatus.map((group) => (
            <StatusRow key={group.status} group={group} />
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <div>
          <h2 className="text-base font-semibold tracking-normal text-foreground">
            Pipeline Stages
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Aktive Deals nach Stage</p>
        </div>
        <div className="mt-4">
          {data.pipeline.dealsByStage.length > 0 ? (
            data.pipeline.dealsByStage.map((group) => (
              <StageRow key={group.stageId} group={group} maxCount={maxStageCount} />
            ))
          ) : (
            <p className="py-6 text-sm text-muted-foreground">Keine aktiven Deals vorhanden.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function RecentDealItem({ deal }: { deal: DashboardRecentDealRecord }) {
  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{deal.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {relationLabel(deal)} · {deal.stage?.name ?? 'Stage nicht verfügbar'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatMoneyAmount({ currency: deal.currency, value: deal.value })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{statusLabels[deal.status]}</p>
        </div>
      </div>
    </li>
  );
}

function RecentActivityItem({ activity }: { activity: DashboardRecentActivityRecord }) {
  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{activity.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {relationLabel(activity)} · {formatDate(activity.dueAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          {activityTypeLabels[activity.type] ?? activity.type}
        </span>
      </div>
    </li>
  );
}

function RecentNoteItem({ note }: { note: DashboardRecentNoteRecord }) {
  return (
    <li className="border-b border-border py-3 last:border-0">
      <p className="truncate text-sm font-medium text-foreground">{note.title ?? note.type}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note.contentSnippet}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {relationLabel(note)} · {formatDateTime(note.updatedAt)}
      </p>
    </li>
  );
}

function RecentSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-base font-semibold tracking-normal text-foreground">{title}</h2>
      <ul className="mt-3">{children}</ul>
      {children === null ? <p className="py-6 text-sm text-muted-foreground">{empty}</p> : null}
    </section>
  );
}

function RecentItems({ data }: { data: DashboardOverviewRecord }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <RecentSection title="Recent Deals" empty="Keine Deals vorhanden.">
        {data.recent.deals.length > 0
          ? data.recent.deals.map((deal) => <RecentDealItem key={deal.id} deal={deal} />)
          : null}
      </RecentSection>
      <RecentSection title="Recent Activities" empty="Keine Aktivitäten vorhanden.">
        {data.recent.activities.length > 0
          ? data.recent.activities.map((activity) => (
              <RecentActivityItem key={activity.id} activity={activity} />
            ))
          : null}
      </RecentSection>
      <RecentSection title="Recent Notes" empty="Keine Notizen vorhanden.">
        {data.recent.notes.length > 0
          ? data.recent.notes.map((note) => <RecentNoteItem key={note.id} note={note} />)
          : null}
      </RecentSection>
    </div>
  );
}

function EmptyOverview() {
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-8">
      <h2 className="text-lg font-semibold tracking-normal text-foreground">CRM Overview</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Dieser Tenant hat noch keine aktiven CRM-Daten. Sobald Kontakte, Organisationen, Deals,
        Aktivitäten oder Notizen entstehen, erscheinen hier die aktuellen Kennzahlen.
      </p>
    </section>
  );
}

export function DashboardOverview() {
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const crmSessionKey = user?.id ?? null;
  const canFetchCrm =
    authStatus === 'authenticated' && accessToken !== null && crmSessionKey !== null;

  const overviewQuery = useQuery({
    queryKey: crmQueryKeys.dashboardOverview(crmSessionKey),
    queryFn: () => crmClient.getDashboardOverview(),
    enabled: canFetchCrm,
  });

  if (authStatus !== 'authenticated') {
    return (
      <section className="rounded-lg border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">CRM Overview</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sitzung wird vorbereitet.</p>
      </section>
    );
  }

  if (overviewQuery.isLoading || !canFetchCrm) {
    return <DashboardSkeleton />;
  }

  if (overviewQuery.isError) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">CRM Overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Dashboard-Metriken konnten nicht geladen werden.
        </p>
        <Button className="mt-5" type="button" onClick={() => void overviewQuery.refetch()}>
          Erneut laden
        </Button>
      </section>
    );
  }

  const data = overviewQuery.data;

  if (!data) {
    return <DashboardSkeleton />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">CRM Overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tenant-sichere Übersicht über aktive CRM-Daten
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Live aus der CRM API</p>
      </div>

      {isEmptyOverview(data) ? <EmptyOverview /> : null}
      <SummaryCards data={data} />
      <PipelineOverview data={data} />
      <RecentItems data={data} />
    </section>
  );
}

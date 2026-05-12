'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ActivityInput,
  ActivityRecord,
  ActivityType,
  ContactRecord,
  crmClient,
  DealRecord,
  Priority,
  OrganizationRecord,
} from '@/lib/crm-client';
import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';

type ActivityFormState = {
  id: string | null;
  subject: string;
  body: string;
  type: ActivityType;
  priority: Priority;
  dueAt: string;
  organizationId: string;
  personId: string;
  dealId: string;
};

const activityTypes: Array<{ value: ActivityType; label: string }> = [
  { value: 'TASK', label: 'Task' },
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'E-Mail' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Notiz' },
];

const priorities: Array<{ value: Priority; label: string }> = [
  { value: 'LOW', label: 'Niedrig' },
  { value: 'MEDIUM', label: 'Mittel' },
  { value: 'HIGH', label: 'Hoch' },
  { value: 'URGENT', label: 'Dringend' },
];

const emptyActivityForm: ActivityFormState = {
  id: null,
  subject: '',
  body: '',
  type: 'TASK',
  priority: 'MEDIUM',
  dueAt: '',
  organizationId: '',
  personId: '',
  dealId: '',
};

const relationLookupPage = 1;
const relationLookupLimit = 100;

function dateToInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function inputDateToIso(value: string): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}

function toActivityInput(form: ActivityFormState): ActivityInput {
  return {
    subject: form.subject,
    body: form.body,
    type: form.type,
    priority: form.priority,
    dueAt: inputDateToIso(form.dueAt),
    organizationId: form.organizationId || null,
    personId: form.personId || null,
    dealId: form.dealId || null,
  };
}

function activityToForm(activity: ActivityRecord): ActivityFormState {
  return {
    id: activity.id,
    subject: activity.subject,
    body: activity.body ?? '',
    type: activity.type,
    priority: activity.priority,
    dueAt: dateToInput(activity.dueAt),
    organizationId: activity.organization ? (activity.organizationId ?? '') : '',
    personId: activity.person ? (activity.personId ?? '') : '',
    dealId: activity.deal ? (activity.dealId ?? '') : '',
  };
}

function typeLabel(type: ActivityType): string {
  return activityTypes.find((option) => option.value === type)?.label ?? type;
}

function priorityLabel(priority: Priority): string {
  return priorities.find((option) => option.value === priority)?.label ?? priority;
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Aktion fehlgeschlagen';
}

export function ActivitiesDashboard() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [completionFilter, setCompletionFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [form, setForm] = useState<ActivityFormState>(emptyActivityForm);
  const crmSessionKey = user?.id ?? null;
  const canFetchCrm =
    authStatus === 'authenticated' && accessToken !== null && crmSessionKey !== null;

  const activitiesQuery = useQuery({
    queryKey: crmQueryKeys.activities(
      crmSessionKey,
      search,
      page,
      typeFilter,
      priorityFilter,
      completionFilter,
      dueFilter,
    ),
    queryFn: () =>
      crmClient.listActivities({
        search,
        page,
        limit: 25,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
        completion: completionFilter || undefined,
        due: dueFilter || undefined,
      }),
    enabled: canFetchCrm,
  });

  const organizationsQuery = useQuery({
    queryKey: crmQueryKeys.organizationsLookup(
      crmSessionKey,
      '',
      relationLookupPage,
      relationLookupLimit,
    ),
    queryFn: () =>
      crmClient.listOrganizations({ page: relationLookupPage, limit: relationLookupLimit }),
    enabled: canFetchCrm,
  });

  const contactsQuery = useQuery({
    queryKey: crmQueryKeys.contactsLookup(
      crmSessionKey,
      '',
      relationLookupPage,
      relationLookupLimit,
    ),
    queryFn: () => crmClient.listContacts({ page: relationLookupPage, limit: relationLookupLimit }),
    enabled: canFetchCrm,
  });

  const dealsQuery = useQuery({
    queryKey: crmQueryKeys.dealLookups(crmSessionKey, '', relationLookupPage, relationLookupLimit),
    queryFn: () => crmClient.listDeals({ page: relationLookupPage, limit: relationLookupLimit }),
    enabled: canFetchCrm,
  });

  useEffect(() => {
    setForm(emptyActivityForm);
    setPage(1);
  }, [crmSessionKey]);

  const activityData = canFetchCrm ? activitiesQuery.data : undefined;
  const organizations = useMemo(
    () => organizationsQuery.data?.items ?? [],
    [organizationsQuery.data?.items],
  );
  const contacts = useMemo(() => contactsQuery.data?.items ?? [], [contactsQuery.data?.items]);
  const deals = useMemo(() => dealsQuery.data?.items ?? [], [dealsQuery.data?.items]);

  const invalidateCrm = async () => {
    if (crmSessionKey === null) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: crmQueryKeys.user(crmSessionKey) });
  };

  const saveActivity = useMutation({
    mutationFn: (nextForm: ActivityFormState) =>
      nextForm.id
        ? crmClient.updateActivity(nextForm.id, toActivityInput(nextForm))
        : crmClient.createActivity(toActivityInput(nextForm)),
    onSuccess: async () => {
      setForm(emptyActivityForm);
      await invalidateCrm();
    },
  });

  const deleteActivity = useMutation({
    mutationFn: (id: string) => crmClient.deleteActivity(id),
    onSuccess: invalidateCrm,
  });

  const completeActivity = useMutation({
    mutationFn: (id: string) => crmClient.completeActivity(id),
    onSuccess: invalidateCrm,
  });

  const reopenActivity = useMutation({
    mutationFn: (id: string) => crmClient.reopenActivity(id),
    onSuccess: invalidateCrm,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveActivity.mutate(form);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Tasks & Aktivitäten
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {activityData?.total ?? 0} Aktivitäten
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[780px] xl:grid-cols-5">
          <input
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Suche"
            type="search"
          />
          <FilterSelect
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
          >
            <option value="">Alle Typen</option>
            {activityTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={priorityFilter}
            onChange={(value) => {
              setPriorityFilter(value);
              setPage(1);
            }}
          >
            <option value="">Alle Prioritäten</option>
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={completionFilter}
            onChange={(value) => {
              setCompletionFilter(value);
              setPage(1);
            }}
          >
            <option value="">Alle Status</option>
            <option value="OPEN">Offen</option>
            <option value="COMPLETED">Erledigt</option>
          </FilterSelect>
          <FilterSelect
            value={dueFilter}
            onChange={(value) => {
              setDueFilter(value);
              setPage(1);
            }}
          >
            <option value="">Alle Fälligkeiten</option>
            <option value="OVERDUE">Überfällig</option>
            <option value="TODAY">Heute</option>
            <option value="UPCOMING">Später</option>
            <option value="NO_DUE_DATE">Ohne Datum</option>
          </FilterSelect>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr_1fr_auto] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Aktivität</span>
                <span>Typ</span>
                <span>Priorität</span>
                <span>Fällig</span>
                <span>Bezug</span>
                <span>Aktion</span>
              </div>
              <div className="divide-y divide-border">
                {(activityData?.items ?? []).map((activity) => (
                  <div
                    className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr_1fr_auto] gap-3 px-4 py-3 text-sm"
                    key={activity.id}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CompletionDot completed={activity.completedAt !== null} />
                        <p className="truncate font-medium">{activity.subject}</p>
                      </div>
                      <p className="truncate text-muted-foreground">{activity.body ?? '-'}</p>
                    </div>
                    <p className="truncate text-muted-foreground">{typeLabel(activity.type)}</p>
                    <PriorityBadge priority={activity.priority} />
                    <p className="truncate text-muted-foreground">{formatDate(activity.dueAt)}</p>
                    <div className="min-w-0 text-muted-foreground">
                      <p className="truncate">{activity.deal?.title ?? '-'}</p>
                      <p className="truncate">
                        {activity.organization?.name ??
                          (activity.person
                            ? `${activity.person.firstName} ${activity.person.lastName}`
                            : '-')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {activity.completedAt ? (
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={reopenActivity.isPending}
                          onClick={() => reopenActivity.mutate(activity.id)}
                        >
                          Öffnen
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          type="button"
                          disabled={completeActivity.isPending}
                          onClick={() => completeActivity.mutate(activity.id)}
                        >
                          Erledigt
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setForm(activityToForm(activity))}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={deleteActivity.isPending}
                        onClick={() => {
                          if (window.confirm('Aktivität löschen?')) {
                            deleteActivity.mutate(activity.id);
                          }
                        }}
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                ))}
                {activitiesQuery.isLoading ? <p className="px-4 py-6 text-sm">Lädt...</p> : null}
                {!activitiesQuery.isLoading && activityData?.items.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    Keine Aktivitäten gefunden.
                  </p>
                ) : null}
                {activitiesQuery.error ? (
                  <p className="px-4 py-6 text-sm text-red-600">
                    {errorMessage(activitiesQuery.error)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <Pagination
            page={page}
            total={activityData?.total ?? 0}
            limit={activityData?.limit ?? 25}
            onPageChange={setPage}
          />
        </div>

        <ActivityForm
          form={form}
          organizations={organizations}
          contacts={contacts}
          deals={deals}
          isPending={saveActivity.isPending}
          error={
            saveActivity.error ??
            deleteActivity.error ??
            completeActivity.error ??
            reopenActivity.error
          }
          onChange={setForm}
          onCancel={() => setForm(emptyActivityForm)}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {children}
    </select>
  );
}

function CompletionDot({ completed }: { completed: boolean }) {
  return (
    <span
      className={cn(
        'h-2.5 w-2.5 shrink-0 rounded-full',
        completed ? 'bg-green-600' : 'bg-amber-500',
      )}
    />
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-fit items-center rounded-md px-2 text-xs font-semibold',
        priority === 'URGENT'
          ? 'bg-red-100 text-red-800'
          : priority === 'HIGH'
            ? 'bg-amber-100 text-amber-800'
            : priority === 'LOW'
              ? 'bg-slate-100 text-slate-700'
              : 'bg-blue-100 text-blue-800',
      )}
    >
      {priorityLabel(priority)}
    </span>
  );
}

function Pagination({
  page,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  const hasPrevious = page > 1;
  const hasNext = page * limit < total;

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Seite {page} · {total} gesamt
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          type="button"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Zurück
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}

function ActivityForm({
  form,
  organizations,
  contacts,
  deals,
  isPending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: ActivityFormState;
  organizations: OrganizationRecord[];
  contacts: ContactRecord[];
  deals: DealRecord[];
  isPending: boolean;
  error: unknown;
  onChange: (form: ActivityFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-border bg-surface p-4" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">
        {form.id ? 'Aktivität bearbeiten' : 'Aktivität anlegen'}
      </h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Betreff"
          required
          value={form.subject}
          onChange={(value) => onChange({ ...form, subject: value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Typ"
            value={form.type}
            onChange={(value) => onChange({ ...form, type: value as ActivityType })}
          >
            {activityTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <Select
            label="Priorität"
            value={form.priority}
            onChange={(value) => onChange({ ...form, priority: value as Priority })}
          >
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Fällig am"
          type="date"
          value={form.dueAt}
          onChange={(value) => onChange({ ...form, dueAt: value })}
        />
        <Select
          label="Deal"
          value={form.dealId}
          onChange={(value) => onChange({ ...form, dealId: value })}
        >
          <option value="">Keiner</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.title}
            </option>
          ))}
        </Select>
        <Select
          label="Organisation"
          value={form.organizationId}
          onChange={(value) => onChange({ ...form, organizationId: value })}
        >
          <option value="">Keine</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </Select>
        <Select
          label="Kontakt"
          value={form.personId}
          onChange={(value) => onChange({ ...form, personId: value })}
        >
          <option value="">Keiner</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.firstName} {contact.lastName}
            </option>
          ))}
        </Select>
        <Textarea
          label="Beschreibung"
          value={form.body}
          onChange={(value) => onChange({ ...form, body: value })}
        />
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{errorMessage(error)}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button type="submit" disabled={isPending}>
          Speichern
        </Button>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Zurücksetzen
        </Button>
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <select
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <textarea
        className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

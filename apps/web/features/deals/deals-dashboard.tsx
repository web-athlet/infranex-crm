'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ContactRecord,
  crmClient,
  DealInput,
  DealRecord,
  DealStatus,
  OrganizationRecord,
  PipelineStageRecord,
} from '@/lib/crm-client';
import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';

type DealFormState = {
  id: string | null;
  title: string;
  description: string;
  value: string;
  currency: string;
  status: DealStatus;
  stageId: string;
  organizationId: string;
  personId: string;
  expectedCloseAt: string;
  lostReason: string;
};

const dealStatuses: Array<{ value: DealStatus; label: string }> = [
  { value: 'OPEN', label: 'Offen' },
  { value: 'WON', label: 'Gewonnen' },
  { value: 'LOST', label: 'Verloren' },
];

const emptyDealForm: DealFormState = {
  id: null,
  title: '',
  description: '',
  value: '',
  currency: 'EUR',
  status: 'OPEN',
  stageId: '',
  organizationId: '',
  personId: '',
  expectedCloseAt: '',
  lostReason: '',
};

function parseValue(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateToInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function inputDateToIso(value: string): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}

function toDealInput(form: DealFormState): DealInput {
  return {
    title: form.title,
    description: form.description,
    value: parseValue(form.value),
    currency: form.currency,
    status: form.status,
    stageId: form.stageId || undefined,
    organizationId: form.organizationId || null,
    personId: form.personId || null,
    expectedCloseAt: inputDateToIso(form.expectedCloseAt),
    lostReason: form.lostReason,
  };
}

function dealToForm(deal: DealRecord): DealFormState {
  return {
    id: deal.id,
    title: deal.title,
    description: deal.description ?? '',
    value: deal.value ?? '',
    currency: deal.currency,
    status: deal.status,
    stageId: deal.stageId,
    organizationId: deal.organization ? (deal.organizationId ?? '') : '',
    personId: deal.person ? (deal.personId ?? '') : '',
    expectedCloseAt: dateToInput(deal.expectedCloseAt),
    lostReason: deal.lostReason ?? '',
  };
}

function statusLabel(status: DealStatus): string {
  return dealStatuses.find((option) => option.value === status)?.label ?? status;
}

function formatValue(value: string | null, currency: string): string {
  if (!value) {
    return '-';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return `${value} ${currency}`;
  }

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(parsed);
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

export function DealsDashboard() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [form, setForm] = useState<DealFormState>(emptyDealForm);
  const crmSessionKey = user?.id ?? null;
  const canFetchCrm =
    authStatus === 'authenticated' && accessToken !== null && crmSessionKey !== null;

  const pipelineQuery = useQuery({
    queryKey: crmQueryKeys.dealPipeline(crmSessionKey),
    queryFn: () => crmClient.getDealPipeline(),
    enabled: canFetchCrm,
  });

  const dealsQuery = useQuery({
    queryKey: crmQueryKeys.deals(crmSessionKey, search, page, statusFilter, stageFilter),
    queryFn: () =>
      crmClient.listDeals({
        search,
        page,
        limit: 25,
        status: statusFilter || undefined,
        stageId: stageFilter || undefined,
      }),
    enabled: canFetchCrm,
  });

  const organizationsQuery = useQuery({
    queryKey: crmQueryKeys.organizations(crmSessionKey, '', 1),
    queryFn: () => crmClient.listOrganizations({ page: 1, limit: 100 }),
    enabled: canFetchCrm,
  });

  const contactsQuery = useQuery({
    queryKey: crmQueryKeys.contacts(crmSessionKey, '', 1),
    queryFn: () => crmClient.listContacts({ page: 1, limit: 100 }),
    enabled: canFetchCrm,
  });

  useEffect(() => {
    setForm(emptyDealForm);
    setPage(1);
  }, [crmSessionKey]);

  useEffect(() => {
    const stages = pipelineQuery.data?.stages ?? [];
    if (!form.stageId && stages.length > 0) {
      setForm((current) => ({ ...current, stageId: stages[0]?.id ?? '' }));
    }
  }, [form.stageId, pipelineQuery.data?.stages]);

  const dealData = canFetchCrm ? dealsQuery.data : undefined;
  const stages = useMemo(() => pipelineQuery.data?.stages ?? [], [pipelineQuery.data?.stages]);
  const organizations = useMemo(
    () => organizationsQuery.data?.items ?? [],
    [organizationsQuery.data?.items],
  );
  const contacts = useMemo(() => contactsQuery.data?.items ?? [], [contactsQuery.data?.items]);

  const invalidateCrm = async () => {
    if (crmSessionKey === null) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: crmQueryKeys.user(crmSessionKey) });
  };

  const saveDeal = useMutation({
    mutationFn: (nextForm: DealFormState) =>
      nextForm.id
        ? crmClient.updateDeal(nextForm.id, toDealInput(nextForm))
        : crmClient.createDeal(toDealInput(nextForm)),
    onSuccess: async () => {
      setForm({ ...emptyDealForm, stageId: stages[0]?.id ?? '' });
      await invalidateCrm();
    },
  });

  const deleteDeal = useMutation({
    mutationFn: (id: string) => crmClient.deleteDeal(id),
    onSuccess: invalidateCrm,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveDeal.mutate(form);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Deals</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {dealData?.total ?? 0} Deals · {pipelineQuery.data?.name ?? 'Pipeline'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[620px]">
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
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Alle Status</option>
            {dealStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={stageFilter}
            onChange={(event) => {
              setStageFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Alle Phasen</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <StageStrip
        stages={stages}
        activeStageId={stageFilter}
        onStageSelect={(nextStageId) => {
          setStageFilter(nextStageId);
          setPage(1);
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.9fr_auto] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
                <span>Deal</span>
                <span>Kunde</span>
                <span>Wert</span>
                <span>Phase</span>
                <span>Status</span>
                <span>Aktion</span>
              </div>
              <div className="divide-y divide-border">
                {(dealData?.items ?? []).map((deal) => (
                  <div
                    className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.9fr_auto] gap-3 px-4 py-3 text-sm"
                    key={deal.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{deal.title}</p>
                      <p className="truncate text-muted-foreground">
                        Abschluss {formatDate(deal.expectedCloseAt)}
                      </p>
                    </div>
                    <div className="min-w-0 text-muted-foreground">
                      <p className="truncate">{deal.organization?.name ?? '-'}</p>
                      <p className="truncate">
                        {deal.person ? `${deal.person.firstName} ${deal.person.lastName}` : '-'}
                      </p>
                    </div>
                    <p className="truncate text-muted-foreground">
                      {formatValue(deal.value, deal.currency)}
                    </p>
                    <p className="truncate text-muted-foreground">{deal.stage.name}</p>
                    <StatusBadge status={deal.status} />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setForm(dealToForm(deal))}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={deleteDeal.isPending}
                        onClick={() => {
                          if (window.confirm('Deal löschen?')) {
                            deleteDeal.mutate(deal.id);
                          }
                        }}
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                ))}
                {dealsQuery.isLoading ? <p className="px-4 py-6 text-sm">Lädt...</p> : null}
                {!dealsQuery.isLoading && dealData?.items.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">Keine Deals gefunden.</p>
                ) : null}
                {dealsQuery.error ? (
                  <p className="px-4 py-6 text-sm text-red-600">{errorMessage(dealsQuery.error)}</p>
                ) : null}
              </div>
            </div>
          </div>
          <Pagination
            page={page}
            total={dealData?.total ?? 0}
            limit={dealData?.limit ?? 25}
            onPageChange={setPage}
          />
        </div>

        <DealForm
          form={form}
          stages={stages}
          organizations={organizations}
          contacts={contacts}
          isPending={saveDeal.isPending}
          error={saveDeal.error}
          onChange={setForm}
          onCancel={() => setForm({ ...emptyDealForm, stageId: stages[0]?.id ?? '' })}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}

function StageStrip({
  stages,
  activeStageId,
  onStageSelect,
}: {
  stages: PipelineStageRecord[];
  activeStageId: string;
  onStageSelect: (stageId: string) => void;
}) {
  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-2">
      <div className="flex min-w-max gap-2">
        <button
          className={cn(
            'h-10 rounded-md px-3 text-sm font-medium transition-colors',
            activeStageId === ''
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground',
          )}
          type="button"
          onClick={() => onStageSelect('')}
        >
          Alle
        </button>
        {stages.map((stage) => (
          <button
            className={cn(
              'h-10 rounded-md px-3 text-sm font-medium transition-colors',
              activeStageId === stage.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground',
            )}
            key={stage.id}
            type="button"
            onClick={() => onStageSelect(stage.id)}
          >
            {stage.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-fit items-center rounded-md px-2 text-xs font-semibold',
        status === 'WON'
          ? 'bg-green-100 text-green-800'
          : status === 'LOST'
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800',
      )}
    >
      {statusLabel(status)}
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

function DealForm({
  form,
  stages,
  organizations,
  contacts,
  isPending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: DealFormState;
  stages: PipelineStageRecord[];
  organizations: OrganizationRecord[];
  contacts: ContactRecord[];
  isPending: boolean;
  error: unknown;
  onChange: (form: DealFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const hasSelectableStages = stages.length > 0;

  return (
    <form className="rounded-lg border border-border bg-surface p-4" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">{form.id ? 'Deal bearbeiten' : 'Deal anlegen'}</h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Titel"
          required
          value={form.title}
          onChange={(value) => onChange({ ...form, title: value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Wert"
            min="0"
            step="0.01"
            type="number"
            value={form.value}
            onChange={(value) => onChange({ ...form, value })}
          />
          <Input
            label="Währung"
            maxLength={3}
            value={form.currency}
            onChange={(value) => onChange({ ...form, currency: value.toUpperCase() })}
          />
        </div>
        <Select
          label="Phase"
          required={hasSelectableStages}
          value={form.stageId}
          onChange={(value) => onChange({ ...form, stageId: value })}
        >
          {hasSelectableStages ? (
            stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))
          ) : (
            <option value="">Automatisch</option>
          )}
        </Select>
        <Select
          label="Status"
          value={form.status}
          onChange={(value) => onChange({ ...form, status: value as DealStatus })}
        >
          {dealStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
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
        <Input
          label="Erwarteter Abschluss"
          type="date"
          value={form.expectedCloseAt}
          onChange={(value) => onChange({ ...form, expectedCloseAt: value })}
        />
        <Textarea
          label="Beschreibung"
          value={form.description}
          onChange={(value) => onChange({ ...form, description: value })}
        />
        <Textarea
          label="Lost Reason"
          value={form.lostReason}
          onChange={(value) => onChange({ ...form, lostReason: value })}
        />
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{errorMessage(error)}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button
          type="submit"
          disabled={isPending || (hasSelectableStages && form.stageId.length === 0)}
        >
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
  min,
  step,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  step?: string;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        maxLength={maxLength}
        min={min}
        required={required}
        step={step}
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <select
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        required={required}
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

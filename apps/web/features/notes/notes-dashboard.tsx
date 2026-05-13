'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ActivityRecord,
  ContactRecord,
  crmClient,
  DealRecord,
  NoteInput,
  NoteRecord,
  NoteType,
  OrganizationRecord,
} from '@/lib/crm-client';
import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';

type NoteFormState = {
  id: string | null;
  title: string;
  content: string;
  type: NoteType;
  organizationId: string;
  personId: string;
  dealId: string;
  activityId: string;
};

const noteTypes: Array<{ value: NoteType; label: string }> = [
  { value: 'NOTE', label: 'Notiz' },
  { value: 'COMMENT', label: 'Kommentar' },
];

const emptyNoteForm: NoteFormState = {
  id: null,
  title: '',
  content: '',
  type: 'NOTE',
  organizationId: '',
  personId: '',
  dealId: '',
  activityId: '',
};

const relationLookupPage = 1;
const relationLookupLimit = 100;

function toNoteInput(form: NoteFormState): NoteInput {
  return {
    title: form.title || null,
    content: form.content,
    type: form.type,
    organizationId: form.organizationId || null,
    personId: form.personId || null,
    dealId: form.dealId || null,
    activityId: form.activityId || null,
  };
}

function noteToForm(note: NoteRecord): NoteFormState {
  return {
    id: note.id,
    title: note.title ?? '',
    content: note.content,
    type: note.type === 'COMMENT' ? 'COMMENT' : 'NOTE',
    organizationId: note.organization ? (note.organizationId ?? '') : '',
    personId: note.person ? (note.personId ?? '') : '',
    dealId: note.deal ? (note.dealId ?? '') : '',
    activityId: note.activity ? (note.activityId ?? '') : '',
  };
}

function typeLabel(type: string): string {
  return noteTypes.find((option) => option.value === type)?.label ?? type;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Aktion fehlgeschlagen';
}

export function NotesDashboard() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [dealFilter, setDealFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [form, setForm] = useState<NoteFormState>(emptyNoteForm);
  const crmSessionKey = user?.id ?? null;
  const canFetchCrm =
    authStatus === 'authenticated' && accessToken !== null && crmSessionKey !== null;

  const notesQuery = useQuery({
    queryKey: crmQueryKeys.notes(
      crmSessionKey,
      search,
      page,
      typeFilter,
      organizationFilter,
      personFilter,
      dealFilter,
      activityFilter,
    ),
    queryFn: () =>
      crmClient.listNotes({
        search,
        page,
        limit: 25,
        type: typeFilter || undefined,
        organizationId: organizationFilter || undefined,
        personId: personFilter || undefined,
        dealId: dealFilter || undefined,
        activityId: activityFilter || undefined,
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

  const activitiesQuery = useQuery({
    queryKey: crmQueryKeys.activityLookups(crmSessionKey),
    queryFn: () =>
      crmClient.listActivities({ page: relationLookupPage, limit: relationLookupLimit }),
    enabled: canFetchCrm,
  });

  useEffect(() => {
    setForm(emptyNoteForm);
    setPage(1);
  }, [crmSessionKey]);

  const noteData = canFetchCrm ? notesQuery.data : undefined;
  const organizations = useMemo(
    () => organizationsQuery.data?.items ?? [],
    [organizationsQuery.data?.items],
  );
  const contacts = useMemo(() => contactsQuery.data?.items ?? [], [contactsQuery.data?.items]);
  const deals = useMemo(() => dealsQuery.data?.items ?? [], [dealsQuery.data?.items]);
  const activities = useMemo(
    () => activitiesQuery.data?.items ?? [],
    [activitiesQuery.data?.items],
  );

  const invalidateCrm = async () => {
    if (crmSessionKey === null) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: crmQueryKeys.user(crmSessionKey) });
  };

  const saveNote = useMutation({
    mutationFn: (nextForm: NoteFormState) =>
      nextForm.id
        ? crmClient.updateNote(nextForm.id, toNoteInput(nextForm))
        : crmClient.createNote(toNoteInput(nextForm)),
    onSuccess: async () => {
      setForm(emptyNoteForm);
      await invalidateCrm();
    },
  });

  const deleteNote = useMutation({
    mutationFn: (id: string) => crmClient.deleteNote(id),
    onSuccess: invalidateCrm,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveNote.mutate(form);
  }

  function resetPageAfterFilter(change: () => void): void {
    change();
    setPage(1);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Notizen & Timeline
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{noteData?.total ?? 0} Einträge</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:min-w-[940px] 2xl:grid-cols-6">
          <input
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={(event) =>
              resetPageAfterFilter(() => {
                setSearch(event.target.value);
              })
            }
            placeholder="Suche"
            type="search"
          />
          <FilterSelect
            value={typeFilter}
            onChange={(value) =>
              resetPageAfterFilter(() => {
                setTypeFilter(value);
              })
            }
          >
            <option value="">Alle Typen</option>
            {noteTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </FilterSelect>
          <RelationFilter
            label="Alle Deals"
            value={dealFilter}
            onChange={(value) =>
              resetPageAfterFilter(() => {
                setDealFilter(value);
              })
            }
          >
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
              </option>
            ))}
          </RelationFilter>
          <RelationFilter
            label="Alle Organisationen"
            value={organizationFilter}
            onChange={(value) =>
              resetPageAfterFilter(() => {
                setOrganizationFilter(value);
              })
            }
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </RelationFilter>
          <RelationFilter
            label="Alle Kontakte"
            value={personFilter}
            onChange={(value) =>
              resetPageAfterFilter(() => {
                setPersonFilter(value);
              })
            }
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </RelationFilter>
          <RelationFilter
            label="Alle Aktivitäten"
            value={activityFilter}
            onChange={(value) =>
              resetPageAfterFilter(() => {
                setActivityFilter(value);
              })
            }
          >
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.subject}
              </option>
            ))}
          </RelationFilter>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="divide-y divide-border">
            {(noteData?.items ?? []).map((note) => (
              <NoteTimelineItem
                key={note.id}
                note={note}
                isDeleting={deleteNote.isPending}
                onEdit={() => setForm(noteToForm(note))}
                onDelete={() => {
                  if (window.confirm('Notiz löschen?')) {
                    deleteNote.mutate(note.id);
                  }
                }}
              />
            ))}
            {notesQuery.isLoading ? <p className="px-4 py-6 text-sm">Lädt...</p> : null}
            {!notesQuery.isLoading && noteData?.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Keine Notizen gefunden.</p>
            ) : null}
            {notesQuery.error ? (
              <p className="px-4 py-6 text-sm text-red-600">{errorMessage(notesQuery.error)}</p>
            ) : null}
          </div>
          <Pagination
            page={page}
            total={noteData?.total ?? 0}
            limit={noteData?.limit ?? 25}
            onPageChange={setPage}
          />
        </div>

        <NoteForm
          form={form}
          organizations={organizations}
          contacts={contacts}
          deals={deals}
          activities={activities}
          isPending={saveNote.isPending}
          error={saveNote.error ?? deleteNote.error}
          onChange={setForm}
          onCancel={() => setForm(emptyNoteForm)}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}

function NoteTimelineItem({
  note,
  isDeleting,
  onEdit,
  onDelete,
}: {
  note: NoteRecord;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[140px_minmax(0,1fr)_auto]">
      <div className="space-y-1 text-muted-foreground">
        <p className="font-medium text-foreground">{typeLabel(note.type)}</p>
        <p>{formatDateTime(note.updatedAt)}</p>
      </div>
      <div className="min-w-0 space-y-2">
        {note.title ? <h2 className="break-words font-semibold">{note.title}</h2> : null}
        <p className="whitespace-pre-wrap break-words leading-6 text-foreground">{note.content}</p>
        <RelationSummary note={note} />
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <Button variant="secondary" type="button" onClick={onEdit}>
          Bearbeiten
        </Button>
        <Button variant="secondary" type="button" disabled={isDeleting} onClick={onDelete}>
          Löschen
        </Button>
      </div>
    </article>
  );
}

function RelationSummary({ note }: { note: NoteRecord }) {
  const relations = [
    note.deal?.title,
    note.organization?.name,
    note.person ? `${note.person.firstName} ${note.person.lastName}` : null,
    note.activity?.subject,
  ].filter((value): value is string => Boolean(value));

  if (relations.length === 0) {
    return <p className="text-xs text-muted-foreground">Kein Bezug</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {relations.map((relation) => (
        <span
          className="max-w-full truncate rounded-md bg-background px-2 py-1 text-xs text-muted-foreground"
          key={relation}
        >
          {relation}
        </span>
      ))}
    </div>
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

function RelationFilter({
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
    <FilterSelect value={value} onChange={onChange}>
      <option value="">{label}</option>
      {children}
    </FilterSelect>
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

function NoteForm({
  form,
  organizations,
  contacts,
  deals,
  activities,
  isPending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: NoteFormState;
  organizations: OrganizationRecord[];
  contacts: ContactRecord[];
  deals: DealRecord[];
  activities: ActivityRecord[];
  isPending: boolean;
  error: unknown;
  onChange: (form: NoteFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-border bg-surface p-4" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">{form.id ? 'Notiz bearbeiten' : 'Notiz anlegen'}</h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Titel"
          value={form.title}
          onChange={(value) => onChange({ ...form, title: value })}
        />
        <Select
          label="Typ"
          value={form.type}
          onChange={(value) => onChange({ ...form, type: value as NoteType })}
        >
          {noteTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
        <Textarea
          label="Inhalt"
          required
          value={form.content}
          onChange={(value) => onChange({ ...form, content: value })}
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
        <Select
          label="Aktivität"
          value={form.activityId}
          onChange={(value) => onChange({ ...form, activityId: value })}
        >
          <option value="">Keine</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.subject}
            </option>
          ))}
        </Select>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{errorMessage(error)}</p> : null}
      <div className="mt-5 flex gap-2">
        <Button type="submit" disabled={isPending || form.content.trim().length === 0}>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        type="text"
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
        onChange={(event) => {
          onChange(event.target.value);
        }}
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <textarea
        className={cn(
          'min-h-40 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
        )}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

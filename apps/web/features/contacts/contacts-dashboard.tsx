'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  ContactInput,
  ContactRecord,
  crmClient,
  OrganizationInput,
  OrganizationRecord,
} from '@/lib/crm-client';
import { crmQueryKeys } from '@/lib/crm-query-keys';
import { useAuthStore } from '@/lib/store/auth-store';
import { cn } from '@/lib/utils';

type ViewMode = 'contacts' | 'organizations';

type ContactFormState = {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  organizationId: string;
  notes: string;
  optIn: boolean;
};

type OrganizationFormState = {
  id: string | null;
  name: string;
  website: string;
  domain: string;
  industry: string;
  notes: string;
};

const emptyContactForm: ContactFormState = {
  id: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  organizationId: '',
  notes: '',
  optIn: false,
};

const emptyOrganizationForm: OrganizationFormState = {
  id: null,
  name: '',
  website: '',
  domain: '',
  industry: '',
  notes: '',
};

function toContactInput(form: ContactFormState): ContactInput {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    title: form.title,
    organizationId: form.organizationId || null,
    notes: form.notes,
    optIn: form.optIn,
  };
}

function toOrganizationInput(form: OrganizationFormState): OrganizationInput {
  return {
    name: form.name,
    website: form.website,
    domain: form.domain,
    industry: form.industry,
    notes: form.notes,
  };
}

function contactToForm(contact: ContactRecord): ContactFormState {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    title: contact.title ?? '',
    organizationId: contact.organizationId ?? '',
    notes: contact.notes ?? '',
    optIn: contact.optIn,
  };
}

function organizationToForm(organization: OrganizationRecord): OrganizationFormState {
  return {
    id: organization.id,
    name: organization.name,
    website: organization.website ?? '',
    domain: organization.domain ?? '',
    industry: organization.industry ?? '',
    notes: organization.notes ?? '',
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Aktion fehlgeschlagen';
}

export function ContactsDashboard() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [mode, setMode] = useState<ViewMode>('contacts');
  const [search, setSearch] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const [organizationPage, setOrganizationPage] = useState(1);
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [organizationForm, setOrganizationForm] =
    useState<OrganizationFormState>(emptyOrganizationForm);
  const crmSessionKey = user?.id ?? null;
  const canFetchCrm =
    authStatus === 'authenticated' && accessToken !== null && crmSessionKey !== null;

  const organizationQuery = useQuery({
    queryKey: crmQueryKeys.organizations(crmSessionKey, search, organizationPage),
    queryFn: () => crmClient.listOrganizations({ search, page: organizationPage, limit: 25 }),
    enabled: canFetchCrm,
  });

  const contactQuery = useQuery({
    queryKey: crmQueryKeys.contacts(crmSessionKey, search, contactPage),
    queryFn: () => crmClient.listContacts({ search, page: contactPage, limit: 25 }),
    enabled: canFetchCrm,
  });

  useEffect(() => {
    setContactForm(emptyContactForm);
    setOrganizationForm(emptyOrganizationForm);
  }, [crmSessionKey]);

  const contactData = canFetchCrm ? contactQuery.data : undefined;
  const organizationData = canFetchCrm ? organizationQuery.data : undefined;

  const organizationOptions = useMemo(
    () => organizationData?.items ?? [],
    [organizationData?.items],
  );

  const invalidateCrm = async () => {
    if (crmSessionKey === null) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: crmQueryKeys.user(crmSessionKey) });
  };

  const saveContact = useMutation({
    mutationFn: (form: ContactFormState) =>
      form.id
        ? crmClient.updateContact(form.id, toContactInput(form))
        : crmClient.createContact(toContactInput(form)),
    onSuccess: async () => {
      setContactForm(emptyContactForm);
      await invalidateCrm();
    },
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => crmClient.deleteContact(id),
    onSuccess: invalidateCrm,
  });

  const saveOrganization = useMutation({
    mutationFn: (form: OrganizationFormState) =>
      form.id
        ? crmClient.updateOrganization(form.id, toOrganizationInput(form))
        : crmClient.createOrganization(toOrganizationInput(form)),
    onSuccess: async () => {
      setOrganizationForm(emptyOrganizationForm);
      await invalidateCrm();
    },
  });

  const deleteOrganization = useMutation({
    mutationFn: (id: string) => crmClient.deleteOrganization(id),
    onSuccess: invalidateCrm,
  });

  function handleContactSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveContact.mutate(contactForm);
  }

  function handleOrganizationSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveOrganization.mutate(organizationForm);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            Kontakte & Organisationen
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {contactData?.total ?? 0} Kontakte · {organizationData?.total ?? 0} Organisationen
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="h-10 w-full min-w-64 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setContactPage(1);
              setOrganizationPage(1);
            }}
            placeholder="Suche"
            type="search"
          />
          <div className="inline-flex h-10 rounded-md border border-border bg-surface p-1">
            <button
              className={cn(
                'rounded px-3 text-sm font-medium',
                mode === 'contacts'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              type="button"
              onClick={() => setMode('contacts')}
            >
              Kontakte
            </button>
            <button
              className={cn(
                'rounded px-3 text-sm font-medium',
                mode === 'organizations'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
              type="button"
              onClick={() => setMode('organizations')}
            >
              Organisationen
            </button>
          </div>
        </div>
      </div>

      {mode === 'contacts' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
              <span>Name</span>
              <span>Organisation</span>
              <span>Kontakt</span>
              <span>Aktion</span>
            </div>
            <div className="divide-y divide-border">
              {(contactData?.items ?? []).map((contact) => (
                <div
                  className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-3 px-4 py-3 text-sm"
                  key={contact.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="truncate text-muted-foreground">{contact.title ?? '-'}</p>
                  </div>
                  <p className="truncate text-muted-foreground">
                    {contact.organization?.name ?? '-'}
                  </p>
                  <div className="min-w-0 text-muted-foreground">
                    <p className="truncate">{contact.email ?? '-'}</p>
                    <p className="truncate">{contact.phone ?? '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setContactForm(contactToForm(contact))}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        if (window.confirm('Kontakt löschen?')) {
                          deleteContact.mutate(contact.id);
                        }
                      }}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
              {contactQuery.isLoading ? <p className="px-4 py-6 text-sm">Lädt...</p> : null}
              {!contactQuery.isLoading && contactData?.items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Keine Kontakte gefunden.</p>
              ) : null}
            </div>
            <Pagination
              page={contactPage}
              total={contactData?.total ?? 0}
              limit={contactData?.limit ?? 25}
              onPageChange={setContactPage}
            />
          </div>
          <ContactForm
            form={contactForm}
            organizations={organizationOptions}
            isPending={saveContact.isPending}
            error={saveContact.error}
            onChange={setContactForm}
            onCancel={() => setContactForm(emptyContactForm)}
            onSubmit={handleContactSubmit}
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
              <span>Name</span>
              <span>Domain</span>
              <span>Branche</span>
              <span>Aktion</span>
            </div>
            <div className="divide-y divide-border">
              {(organizationData?.items ?? []).map((organization) => (
                <div
                  className="grid grid-cols-[1.1fr_1fr_1fr_auto] gap-3 px-4 py-3 text-sm"
                  key={organization.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{organization.name}</p>
                    <p className="truncate text-muted-foreground">
                      {organization.peopleCount} Kontakte
                    </p>
                  </div>
                  <p className="truncate text-muted-foreground">{organization.domain ?? '-'}</p>
                  <p className="truncate text-muted-foreground">{organization.industry ?? '-'}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setOrganizationForm(organizationToForm(organization))}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        if (window.confirm('Organisation löschen?')) {
                          deleteOrganization.mutate(organization.id);
                        }
                      }}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
              {organizationQuery.isLoading ? <p className="px-4 py-6 text-sm">Lädt...</p> : null}
              {!organizationQuery.isLoading && organizationData?.items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Keine Organisationen gefunden.
                </p>
              ) : null}
            </div>
            <Pagination
              page={organizationPage}
              total={organizationData?.total ?? 0}
              limit={organizationData?.limit ?? 25}
              onPageChange={setOrganizationPage}
            />
          </div>
          <OrganizationForm
            form={organizationForm}
            isPending={saveOrganization.isPending}
            error={saveOrganization.error}
            onChange={setOrganizationForm}
            onCancel={() => setOrganizationForm(emptyOrganizationForm)}
            onSubmit={handleOrganizationSubmit}
          />
        </div>
      )}
    </section>
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

function ContactForm({
  form,
  organizations,
  isPending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: ContactFormState;
  organizations: OrganizationRecord[];
  isPending: boolean;
  error: unknown;
  onChange: (form: ContactFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-border bg-surface p-4" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">
        {form.id ? 'Kontakt bearbeiten' : 'Kontakt anlegen'}
      </h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Vorname"
          required
          value={form.firstName}
          onChange={(value) => onChange({ ...form, firstName: value })}
        />
        <Input
          label="Nachname"
          required
          value={form.lastName}
          onChange={(value) => onChange({ ...form, lastName: value })}
        />
        <Input
          label="E-Mail"
          type="email"
          value={form.email}
          onChange={(value) => onChange({ ...form, email: value })}
        />
        <Input
          label="Telefon"
          value={form.phone}
          onChange={(value) => onChange({ ...form, phone: value })}
        />
        <Input
          label="Titel"
          value={form.title}
          onChange={(value) => onChange({ ...form, title: value })}
        />
        <label className="block space-y-2 text-sm font-medium">
          <span>Organisation</span>
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={form.organizationId}
            onChange={(event) => onChange({ ...form, organizationId: event.target.value })}
          >
            <option value="">Keine</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <Textarea
          label="Notizen"
          value={form.notes}
          onChange={(value) => onChange({ ...form, notes: value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={form.optIn}
            type="checkbox"
            onChange={(event) => onChange({ ...form, optIn: event.target.checked })}
          />
          Opt-in
        </label>
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

function OrganizationForm({
  form,
  isPending,
  error,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: OrganizationFormState;
  isPending: boolean;
  error: unknown;
  onChange: (form: OrganizationFormState) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="rounded-lg border border-border bg-surface p-4" onSubmit={onSubmit}>
      <h2 className="text-base font-semibold">
        {form.id ? 'Organisation bearbeiten' : 'Organisation anlegen'}
      </h2>
      <div className="mt-4 space-y-3">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(value) => onChange({ ...form, name: value })}
        />
        <Input
          label="Website"
          value={form.website}
          onChange={(value) => onChange({ ...form, website: value })}
        />
        <Input
          label="Domain"
          value={form.domain}
          onChange={(value) => onChange({ ...form, domain: value })}
        />
        <Input
          label="Branche"
          value={form.industry}
          onChange={(value) => onChange({ ...form, industry: value })}
        />
        <Textarea
          label="Notizen"
          value={form.notes}
          onChange={(value) => onChange({ ...form, notes: value })}
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

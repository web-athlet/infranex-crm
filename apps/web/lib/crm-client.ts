import { api } from '@/lib/api';

type JsonRecord = Record<string, unknown>;

export type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  peopleCount: number;
};

export type ContactRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  notes: string | null;
  optIn: boolean;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
};

export type OrganizationInput = {
  name: string;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  notes?: string | null;
};

export type ContactInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  organizationId?: string | null;
  notes?: string | null;
  optIn?: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Unexpected CRM API response');
  }

  return value;
}

function readNullableString(record: JsonRecord, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('Unexpected CRM API response');
  }

  return value;
}

function readNumber(record: JsonRecord, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return value;
}

function readBoolean(record: JsonRecord, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error('Unexpected CRM API response');
  }

  return value;
}

function parseOrganization(value: unknown): OrganizationRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  const count = value._count;
  const peopleCount = isRecord(count) ? readNumber(count, 'people') : 0;

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    website: readNullableString(value, 'website'),
    domain: readNullableString(value, 'domain'),
    industry: readNullableString(value, 'industry'),
    notes: readNullableString(value, 'notes'),
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
    peopleCount,
  };
}

function parseContactOrganization(value: unknown): ContactRecord['organization'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    domain: readNullableString(value, 'domain'),
  };
}

function parseContact(value: unknown): ContactRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    firstName: readString(value, 'firstName'),
    lastName: readString(value, 'lastName'),
    email: readNullableString(value, 'email'),
    phone: readNullableString(value, 'phone'),
    title: readNullableString(value, 'title'),
    notes: readNullableString(value, 'notes'),
    optIn: readBoolean(value, 'optIn'),
    organizationId: readNullableString(value, 'organizationId'),
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseContactOrganization(value.organization),
  };
}

function parsePage<T>(value: unknown, parseItem: (item: unknown) => T): PageResult<T> {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    items: value.items.map(parseItem),
    page: readNumber(value, 'page'),
    limit: readNumber(value, 'limit'),
    total: readNumber(value, 'total'),
  };
}

function queryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim().length === 0 ? null : value,
    ]),
  ) as T;
}

async function getUnknown(path: string): Promise<unknown> {
  const response = await api.get<unknown>(path);
  return response.data;
}

async function postUnknown(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await api.post<unknown>(path, cleanPayload(body));
  return response.data;
}

async function patchUnknown(path: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await api.patch<unknown>(path, cleanPayload(body));
  return response.data;
}

async function deleteUnknown(path: string): Promise<unknown> {
  const response = await api.delete<unknown>(path);
  return response.data;
}

export const crmClient = {
  async listOrganizations(params: { search?: string; page?: number; limit?: number } = {}) {
    return parsePage(await getUnknown(`/organizations${queryString(params)}`), parseOrganization);
  },

  async createOrganization(input: OrganizationInput) {
    return parseOrganization(await postUnknown('/organizations', input));
  },

  async updateOrganization(id: string, input: OrganizationInput) {
    return parseOrganization(await patchUnknown(`/organizations/${id}`, input));
  },

  async deleteOrganization(id: string) {
    return parseOrganization(await deleteUnknown(`/organizations/${id}`));
  },

  async listContacts(
    params: {
      search?: string;
      organizationId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    return parsePage(await getUnknown(`/contacts${queryString(params)}`), parseContact);
  },

  async createContact(input: ContactInput) {
    return parseContact(await postUnknown('/contacts', input));
  },

  async updateContact(id: string, input: ContactInput) {
    return parseContact(await patchUnknown(`/contacts/${id}`, input));
  },

  async deleteContact(id: string) {
    return parseContact(await deleteUnknown(`/contacts/${id}`));
  },
};

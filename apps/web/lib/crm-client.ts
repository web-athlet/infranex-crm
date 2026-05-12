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

export type DealStatus = 'OPEN' | 'WON' | 'LOST';

export type PipelineStageRecord = {
  id: string;
  name: string;
  position: number;
  probability: number | null;
};

export type DealPipelineRecord = {
  id: string;
  name: string;
  stages: PipelineStageRecord[];
};

export type DealRecord = {
  id: string;
  organizationId: string | null;
  personId: string | null;
  pipelineId: string;
  stageId: string;
  ownerId: string;
  title: string;
  description: string | null;
  value: string | null;
  currency: string;
  status: DealStatus;
  expectedCloseAt: string | null;
  closedAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  stage: PipelineStageRecord;
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

export type DealInput = {
  title: string;
  description?: string | null;
  value?: number;
  currency?: string;
  status?: DealStatus;
  stageId?: string;
  organizationId?: string | null;
  personId?: string | null;
  expectedCloseAt?: string | null;
  lostReason?: string | null;
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

function readNullableNumber(record: JsonRecord, key: string): number | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return value;
}

function readNullableDecimal(record: JsonRecord, key: string): string | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new Error('Unexpected CRM API response');
}

function readDealStatus(record: JsonRecord, key: string): DealStatus {
  const value = record[key];

  if (value === 'OPEN' || value === 'WON' || value === 'LOST') {
    return value;
  }

  throw new Error('Unexpected CRM API response');
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

function parseDealOrganization(value: unknown): DealRecord['organization'] {
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

function parseDealPerson(value: unknown): DealRecord['person'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    firstName: readString(value, 'firstName'),
    lastName: readString(value, 'lastName'),
    email: readNullableString(value, 'email'),
  };
}

function parsePipelineStage(value: unknown): PipelineStageRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    position: readNumber(value, 'position'),
    probability: readNullableNumber(value, 'probability'),
  };
}

function parseDealPipeline(value: unknown): DealPipelineRecord {
  if (!isRecord(value) || !Array.isArray(value.stages)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    stages: value.stages.map(parsePipelineStage),
  };
}

function parseDeal(value: unknown): DealRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    organizationId: readNullableString(value, 'organizationId'),
    personId: readNullableString(value, 'personId'),
    pipelineId: readString(value, 'pipelineId'),
    stageId: readString(value, 'stageId'),
    ownerId: readString(value, 'ownerId'),
    title: readString(value, 'title'),
    description: readNullableString(value, 'description'),
    value: readNullableDecimal(value, 'value'),
    currency: readString(value, 'currency'),
    status: readDealStatus(value, 'status'),
    expectedCloseAt: readNullableString(value, 'expectedCloseAt'),
    closedAt: readNullableString(value, 'closedAt'),
    lostReason: readNullableString(value, 'lostReason'),
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseDealOrganization(value.organization),
    person: parseDealPerson(value.person),
    stage: parsePipelineStage(value.stage),
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

  async listDeals(
    params: {
      search?: string;
      page?: number;
      limit?: number;
      status?: string;
      stageId?: string;
    } = {},
  ) {
    return parsePage(await getUnknown(`/deals${queryString(params)}`), parseDeal);
  },

  async getDealPipeline() {
    return parseDealPipeline(await getUnknown('/deals/pipeline'));
  },

  async createDeal(input: DealInput) {
    return parseDeal(await postUnknown('/deals', input));
  },

  async updateDeal(id: string, input: DealInput) {
    return parseDeal(await patchUnknown(`/deals/${id}`, input));
  },

  async deleteDeal(id: string) {
    return parseDeal(await deleteUnknown(`/deals/${id}`));
  },
};

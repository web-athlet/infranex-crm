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
export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ActivityCompletionFilter = 'OPEN' | 'COMPLETED';
export type ActivityDueFilter = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'NO_DUE_DATE';
export type NoteType = 'NOTE' | 'COMMENT';

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

export type ActivityRecord = {
  id: string;
  organizationId: string | null;
  personId: string | null;
  dealId: string | null;
  ownerId: string | null;
  type: ActivityType;
  priority: Priority;
  subject: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  deal: Pick<DealRecord, 'id' | 'title'> | null;
};

export type NoteRecord = {
  id: string;
  organizationId: string | null;
  personId: string | null;
  dealId: string | null;
  activityId: string | null;
  authorId: string;
  type: string;
  title: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  deal: Pick<DealRecord, 'id' | 'title'> | null;
  activity: Pick<ActivityRecord, 'id' | 'subject' | 'type'> | null;
};

export type MoneyAmountRecord = {
  currency: string;
  value: string;
};

export type DashboardStageGroupRecord = {
  stageId: string;
  stageName: string | null;
  stagePosition: number | null;
  count: number;
  totalValueByCurrency: MoneyAmountRecord[];
};

export type DashboardStatusGroupRecord = {
  status: DealStatus;
  count: number;
  totalValueByCurrency: MoneyAmountRecord[];
};

export type DashboardRecentDealRecord = {
  id: string;
  title: string;
  value: string;
  currency: string;
  status: DealStatus;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  stage: Pick<PipelineStageRecord, 'id' | 'name' | 'position'> | null;
};

export type DashboardRecentActivityRecord = {
  id: string;
  type: ActivityType;
  priority: Priority;
  subject: string;
  dueAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  deal: Pick<DealRecord, 'id' | 'title'> | null;
};

export type DashboardRecentNoteRecord = {
  id: string;
  type: string;
  title: string | null;
  contentSnippet: string;
  updatedAt: string;
  organization: Pick<OrganizationRecord, 'id' | 'name' | 'domain'> | null;
  person: Pick<ContactRecord, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  deal: Pick<DealRecord, 'id' | 'title'> | null;
  activity: Pick<ActivityRecord, 'id' | 'subject' | 'type'> | null;
};

export type DashboardOverviewRecord = {
  summary: {
    activeContactsCount: number;
    activeOrganizationsCount: number;
    activeDealsCount: number;
    notesCount: number;
    openActivitiesCount: number;
    completedActivitiesCount: number;
    overdueActivitiesCount: number;
    dueTodayActivitiesCount: number;
    upcomingActivitiesCount: number;
    openDealsCount: number;
    wonDealsCount: number;
    lostDealsCount: number;
  };
  pipeline: {
    openPipelineValueByCurrency: MoneyAmountRecord[];
    wonDealValueByCurrency: MoneyAmountRecord[];
    dealsByStatus: DashboardStatusGroupRecord[];
    dealsByStage: DashboardStageGroupRecord[];
  };
  recent: {
    deals: DashboardRecentDealRecord[];
    activities: DashboardRecentActivityRecord[];
    notes: DashboardRecentNoteRecord[];
  };
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

export type ActivityInput = {
  subject: string;
  body?: string | null;
  type?: ActivityType;
  priority?: Priority;
  dueAt?: string | null;
  organizationId?: string | null;
  personId?: string | null;
  dealId?: string | null;
};

export type NoteInput = {
  title?: string | null;
  content: string;
  type?: string;
  organizationId?: string | null;
  personId?: string | null;
  dealId?: string | null;
  activityId?: string | null;
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

function readActivityType(record: JsonRecord, key: string): ActivityType {
  const value = record[key];

  if (
    value === 'CALL' ||
    value === 'EMAIL' ||
    value === 'MEETING' ||
    value === 'TASK' ||
    value === 'NOTE'
  ) {
    return value;
  }

  throw new Error('Unexpected CRM API response');
}

function readPriority(record: JsonRecord, key: string): Priority {
  const value = record[key];

  if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'URGENT') {
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

function parseActivityOrganization(value: unknown): ActivityRecord['organization'] {
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

function parseActivityPerson(value: unknown): ActivityRecord['person'] {
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

function parseActivityDeal(value: unknown): ActivityRecord['deal'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    title: readString(value, 'title'),
  };
}

function parseActivity(value: unknown): ActivityRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    organizationId: readNullableString(value, 'organizationId'),
    personId: readNullableString(value, 'personId'),
    dealId: readNullableString(value, 'dealId'),
    ownerId: readNullableString(value, 'ownerId'),
    type: readActivityType(value, 'type'),
    priority: readPriority(value, 'priority'),
    subject: readString(value, 'subject'),
    body: readNullableString(value, 'body'),
    dueAt: readNullableString(value, 'dueAt'),
    completedAt: readNullableString(value, 'completedAt'),
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseActivityOrganization(value.organization),
    person: parseActivityPerson(value.person),
    deal: parseActivityDeal(value.deal),
  };
}

function parseNoteOrganization(value: unknown): NoteRecord['organization'] {
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

function parseNotePerson(value: unknown): NoteRecord['person'] {
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

function parseNoteDeal(value: unknown): NoteRecord['deal'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    title: readString(value, 'title'),
  };
}

function parseNoteActivity(value: unknown): NoteRecord['activity'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    subject: readString(value, 'subject'),
    type: readActivityType(value, 'type'),
  };
}

function parseNote(value: unknown): NoteRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    organizationId: readNullableString(value, 'organizationId'),
    personId: readNullableString(value, 'personId'),
    dealId: readNullableString(value, 'dealId'),
    activityId: readNullableString(value, 'activityId'),
    authorId: readString(value, 'authorId'),
    type: readString(value, 'type'),
    title: readNullableString(value, 'title'),
    content: readString(value, 'content'),
    createdAt: readString(value, 'createdAt'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseNoteOrganization(value.organization),
    person: parseNotePerson(value.person),
    deal: parseNoteDeal(value.deal),
    activity: parseNoteActivity(value.activity),
  };
}

function parseMoneyAmount(value: unknown): MoneyAmountRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    currency: readString(value, 'currency'),
    value: readString(value, 'value'),
  };
}

function readMoneyAmounts(record: JsonRecord, key: string): MoneyAmountRecord[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return value.map(parseMoneyAmount);
}

function parseDashboardStatusGroup(value: unknown): DashboardStatusGroupRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    status: readDealStatus(value, 'status'),
    count: readNumber(value, 'count'),
    totalValueByCurrency: readMoneyAmounts(value, 'totalValueByCurrency'),
  };
}

function parseDashboardStageGroup(value: unknown): DashboardStageGroupRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    stageId: readString(value, 'stageId'),
    stageName: readNullableString(value, 'stageName'),
    stagePosition: readNullableNumber(value, 'stagePosition'),
    count: readNumber(value, 'count'),
    totalValueByCurrency: readMoneyAmounts(value, 'totalValueByCurrency'),
  };
}

function parseDashboardRecentStage(value: unknown): DashboardRecentDealRecord['stage'] {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    name: readString(value, 'name'),
    position: readNumber(value, 'position'),
  };
}

function parseDashboardRecentDeal(value: unknown): DashboardRecentDealRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    title: readString(value, 'title'),
    value: readString(value, 'value'),
    currency: readString(value, 'currency'),
    status: readDealStatus(value, 'status'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseDealOrganization(value.organization),
    person: parseDealPerson(value.person),
    stage: parseDashboardRecentStage(value.stage),
  };
}

function parseDashboardRecentActivity(value: unknown): DashboardRecentActivityRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    type: readActivityType(value, 'type'),
    priority: readPriority(value, 'priority'),
    subject: readString(value, 'subject'),
    dueAt: readNullableString(value, 'dueAt'),
    completedAt: readNullableString(value, 'completedAt'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseActivityOrganization(value.organization),
    person: parseActivityPerson(value.person),
    deal: parseActivityDeal(value.deal),
  };
}

function parseDashboardRecentNote(value: unknown): DashboardRecentNoteRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    id: readString(value, 'id'),
    type: readString(value, 'type'),
    title: readNullableString(value, 'title'),
    contentSnippet: readString(value, 'contentSnippet'),
    updatedAt: readString(value, 'updatedAt'),
    organization: parseNoteOrganization(value.organization),
    person: parseNotePerson(value.person),
    deal: parseNoteDeal(value.deal),
    activity: parseNoteActivity(value.activity),
  };
}

function parseDashboardOverview(value: unknown): DashboardOverviewRecord {
  if (!isRecord(value)) {
    throw new Error('Unexpected CRM API response');
  }

  const summary = value.summary;
  const pipeline = value.pipeline;
  const recent = value.recent;

  if (
    !isRecord(summary) ||
    !isRecord(pipeline) ||
    !isRecord(recent) ||
    !Array.isArray(recent.deals) ||
    !Array.isArray(recent.activities) ||
    !Array.isArray(recent.notes) ||
    !Array.isArray(pipeline.dealsByStatus) ||
    !Array.isArray(pipeline.dealsByStage)
  ) {
    throw new Error('Unexpected CRM API response');
  }

  return {
    summary: {
      activeContactsCount: readNumber(summary, 'activeContactsCount'),
      activeOrganizationsCount: readNumber(summary, 'activeOrganizationsCount'),
      activeDealsCount: readNumber(summary, 'activeDealsCount'),
      notesCount: readNumber(summary, 'notesCount'),
      openActivitiesCount: readNumber(summary, 'openActivitiesCount'),
      completedActivitiesCount: readNumber(summary, 'completedActivitiesCount'),
      overdueActivitiesCount: readNumber(summary, 'overdueActivitiesCount'),
      dueTodayActivitiesCount: readNumber(summary, 'dueTodayActivitiesCount'),
      upcomingActivitiesCount: readNumber(summary, 'upcomingActivitiesCount'),
      openDealsCount: readNumber(summary, 'openDealsCount'),
      wonDealsCount: readNumber(summary, 'wonDealsCount'),
      lostDealsCount: readNumber(summary, 'lostDealsCount'),
    },
    pipeline: {
      openPipelineValueByCurrency: readMoneyAmounts(pipeline, 'openPipelineValueByCurrency'),
      wonDealValueByCurrency: readMoneyAmounts(pipeline, 'wonDealValueByCurrency'),
      dealsByStatus: pipeline.dealsByStatus.map(parseDashboardStatusGroup),
      dealsByStage: pipeline.dealsByStage.map(parseDashboardStageGroup),
    },
    recent: {
      deals: recent.deals.map(parseDashboardRecentDeal),
      activities: recent.activities.map(parseDashboardRecentActivity),
      notes: recent.notes.map(parseDashboardRecentNote),
    },
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
  async getDashboardOverview() {
    return parseDashboardOverview(await getUnknown('/dashboard/overview'));
  },

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

  async listActivities(
    params: {
      search?: string;
      page?: number;
      limit?: number;
      type?: string;
      priority?: string;
      completion?: string;
      due?: string;
      organizationId?: string;
      personId?: string;
      dealId?: string;
    } = {},
  ) {
    return parsePage(await getUnknown(`/activities${queryString(params)}`), parseActivity);
  },

  async createActivity(input: ActivityInput) {
    return parseActivity(await postUnknown('/activities', input));
  },

  async updateActivity(id: string, input: ActivityInput) {
    return parseActivity(await patchUnknown(`/activities/${id}`, input));
  },

  async completeActivity(id: string) {
    return parseActivity(await patchUnknown(`/activities/${id}/complete`, {}));
  },

  async reopenActivity(id: string) {
    return parseActivity(await patchUnknown(`/activities/${id}/reopen`, {}));
  },

  async deleteActivity(id: string) {
    return parseActivity(await deleteUnknown(`/activities/${id}`));
  },

  async listNotes(
    params: {
      search?: string;
      page?: number;
      limit?: number;
      type?: string;
      organizationId?: string;
      personId?: string;
      dealId?: string;
      activityId?: string;
    } = {},
  ) {
    return parsePage(await getUnknown(`/notes${queryString(params)}`), parseNote);
  },

  async createNote(input: NoteInput) {
    return parseNote(await postUnknown('/notes', input));
  },

  async updateNote(id: string, input: NoteInput) {
    return parseNote(await patchUnknown(`/notes/${id}`, input));
  },

  async deleteNote(id: string) {
    return parseNote(await deleteUnknown(`/notes/${id}`));
  },
};

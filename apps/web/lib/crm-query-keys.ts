export const crmQueryKeys = {
  all: ['crm'] as const,
  user: (userId: string) => [...crmQueryKeys.all, userId] as const,
  contacts: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'contacts', { search, page }] as const,
  contactsLookup: (userId: string | null, search: string, page: number, limit: number) =>
    [...crmQueryKeys.all, userId, 'contacts', 'lookup', { search, page, limit }] as const,
  organizations: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'organizations', { search, page }] as const,
  organizationsLookup: (userId: string | null, search: string, page: number, limit: number) =>
    [...crmQueryKeys.all, userId, 'organizations', 'lookup', { search, page, limit }] as const,
  deals: (userId: string | null, search: string, page: number, status: string, stageId: string) =>
    [...crmQueryKeys.all, userId, 'deals', { search, page, status, stageId }] as const,
  dealPipeline: (userId: string | null) =>
    [...crmQueryKeys.all, userId, 'deals', 'pipeline'] as const,
  dealLookups: (userId: string | null, search: string, page: number, limit: number) =>
    [...crmQueryKeys.all, userId, 'deals', 'lookups', { search, page, limit }] as const,
  activities: (
    userId: string | null,
    search: string,
    page: number,
    type: string,
    priority: string,
    completion: string,
    due: string,
  ) =>
    [
      ...crmQueryKeys.all,
      userId,
      'activities',
      { search, page, type, priority, completion, due },
    ] as const,
  activityLookups: (userId: string | null) =>
    [...crmQueryKeys.all, userId, 'activities', 'lookups'] as const,
  notes: (
    userId: string | null,
    search: string,
    page: number,
    type: string,
    organizationId: string,
    personId: string,
    dealId: string,
    activityId: string,
  ) =>
    [
      ...crmQueryKeys.all,
      userId,
      'notes',
      { search, page, type, organizationId, personId, dealId, activityId },
    ] as const,
  noteLookups: (userId: string | null, search: string, page: number, limit: number) =>
    [...crmQueryKeys.all, userId, 'notes', 'lookups', { search, page, limit }] as const,
};

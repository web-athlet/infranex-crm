export const crmQueryKeys = {
  all: ['crm'] as const,
  user: (userId: string) => [...crmQueryKeys.all, userId] as const,
  contacts: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'contacts', { search, page }] as const,
  organizations: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'organizations', { search, page }] as const,
  deals: (userId: string | null, search: string, page: number, status: string, stageId: string) =>
    [...crmQueryKeys.all, userId, 'deals', { search, page, status, stageId }] as const,
  dealPipeline: (userId: string | null) =>
    [...crmQueryKeys.all, userId, 'deals', 'pipeline'] as const,
  dealLookups: (userId: string | null) =>
    [...crmQueryKeys.all, userId, 'deals', 'lookups'] as const,
};

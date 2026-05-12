export const crmQueryKeys = {
  all: ['crm'] as const,
  user: (userId: string) => [...crmQueryKeys.all, userId] as const,
  contacts: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'contacts', { search, page }] as const,
  organizations: (userId: string | null, search: string, page: number) =>
    [...crmQueryKeys.all, userId, 'organizations', { search, page }] as const,
};

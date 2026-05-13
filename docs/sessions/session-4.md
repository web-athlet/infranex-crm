# Session 4 Summary

Session 4 implemented tenant-scoped Contacts and Organizations CRUD across the
API and dashboard frontend, and introduced shared Prisma, tenant-context, CRM
client, query-key, and CRM cache-boundary patterns.

## Scope

- Implement contacts/persons and organizations CRUD on existing Prisma models.
- Add server-side tenant resolution, write-role checks, DTO validation, soft
  delete, pagination, and relation safety for contacts and organizations.
- Add a frontend contacts dashboard and CRM client/query-cache patterns.
- Keep deals, activities, and new Prisma schema changes out of scope.

## Implemented Changes

### Backend

- Added contacts and organizations controllers, services, modules, DTOs, service
  tests, and DTO validation tests.
- Added `PrismaModule` and `PrismaService` as shared database access
  infrastructure for feature modules.
- Added `TenantContextService` and module to derive tenant context from the
  authenticated user server-side.
- Implemented tenant-scoped list/get/create/update/delete paths for contacts and
  organizations.
- Added pagination caps and search/list DTOs.
- Added `assertCanWrite` write-role enforcement for mutating operations.
- Implemented soft delete through `deletedAt` updates.
- Validated contact `organizationId` links against active organizations in the
  resolved tenant.
- Mapped tenant-scoped contact email and organization domain conflicts to API
  conflict responses.
- Organization delete detaches active people from the organization before
  soft-deleting the organization.
- No Prisma migration was introduced in Session 4; the models came from
  Session 1.

### Frontend

- Replaced the contacts placeholder route with `ContactsDashboard`.
- Added organization and contact UI flows for list, create, edit, delete,
  search, pagination, and organization linking.
- Added `apps/web/lib/crm-client.ts` with CRM API responses handled as
  `unknown` and narrowed into client-internal records.
- Added `apps/web/lib/crm-query-keys.ts` for tenant/user-aware CRM query keys.
- Added `CrmCacheBoundary` to remove CRM queries on authenticated user switches,
  missing authenticated users, logout, and 2FA/auth-exit states.

### Tests

- Added `contacts.service.spec.ts`.
- Added `organizations.service.spec.ts`.
- Added `tenant-context.service.spec.ts`.
- Added `session-4-validation.spec.ts` for contacts and organizations DTOs.
- Tests cover tenant scoping, pagination caps, create/update/delete behavior,
  relation validation, conflict mapping, soft delete, and DTO normalization.

### Security / Architecture

- `tenantId` is derived server-side through `TenantContextService`, not trusted
  from client input.
- CRM writes require a write-capable membership role.
- Soft-deleted records are excluded from active list/get paths.
- Client CRM cache is scoped under CRM query keys and cleared on auth exits or
  account switches.
- No NextAuth.js dependency or implementation was introduced.

## Files / Areas Changed

- `apps/api/src/modules/contacts/**`
- `apps/api/src/modules/organizations/**`
- `apps/api/src/shared/prisma/**`
- `apps/api/src/shared/tenant/**`
- `apps/web/features/contacts/contacts-dashboard.tsx`
- `apps/web/lib/crm-client.ts`
- `apps/web/lib/crm-query-keys.ts`
- `apps/web/components/providers/crm-cache-boundary.tsx`
- `apps/web/app/(dashboard)/contacts/page.tsx`
- `apps/web/app/providers.tsx`

## Validation / Checks

- Test files added in the Session 4 diff provide coverage for the cases listed
  above.
- Exact successful command output for `npm --workspace @infranex/api test`,
  API/web lint, API/web type-check, `npm run build`, `git diff --check`, or
  `npm run format:check`: Nicht eindeutig aus Git-Historie ableitbar.

## Review Outcome

- Session 4 was merged through PR #10 from
  `web-athlet/feature/session-4-contacts`.
- Review-Ergebnis nicht eindeutig aus Git-Historie ableitbar.

## Known Risks / Follow-ups

- The tenant switcher was not implemented. `TenantContextService` documents that
  CRM requests use the first active membership deterministically until a tenant
  switcher exists.
- OpenAPI-generated frontend types were still not present; frontend CRM responses
  were narrowed at runtime from `unknown`.

## Next Session Preparation

- Reuse `TenantContextService`, `PrismaModule`, `crm-client`, `crm-query-keys`,
  and `CrmCacheBoundary` for future CRM feature modules.
- Validate all relation IDs server-side against active records in the resolved
  tenant.
- Keep soft-delete filtering and tenant-scoped constraints consistent for new
  CRM services.

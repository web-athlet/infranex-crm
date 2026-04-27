# Session 0 Summary

Session 0 established the monorepo foundation, frontend scaffold, API scaffold, local infrastructure, Docker build path, and CI baseline.

## 0A Root Setup

- Added npm workspaces with Turborepo orchestration.
- Added root TypeScript, ESLint, Prettier, lint-staged, Husky, and ignore files.
- Kept root TypeScript runtime-neutral with no DOM libs.

## 0B Web Scaffold

- Added `apps/web` with Next.js 14 App Router, React 18, strict TypeScript, Tailwind CSS, TanStack Query, Zustand 4, and Axios infrastructure.
- Prepared shadcn-compatible structure with only a minimal `button.tsx`.
- Kept DOM libs local to `apps/web/tsconfig.json`.
- Added Dockerfile for root-context web image builds.

## 0C API Scaffold

- Added `apps/api` with NestJS 10, strict TypeScript, Prisma 5 scaffold, Swagger, Helmet, validation, shared error/request-id infrastructure, and empty domain modules.
- Added Socket.io gateway with tenant-scoped rooms only:
  - `tenant:{tenantId}`
  - `tenant:{tenantId}:user:{userId}`
- Added JWT guard/service scaffold that validates tokens with `JWT_SECRET`; no refresh-token logic or business auth flow was added.

## 0D Infrastructure

- Added local Compose services for PostgreSQL 15, Redis 7, and MinIO with healthchecks and persistent volumes.
- Added `.env.example` with local development defaults and placeholders only.
- Added API Dockerfile and documented root-context image builds.
- Verified:
  - `docker compose config`
  - `docker build -f apps/api/Dockerfile .`
  - `docker build -f apps/web/Dockerfile .`

## Architecture Decisions

- Root remains orchestration-only; app dependencies stay app-local.
- API contracts start in backend DTO/OpenAPI, with no frontend duplication.
- Web components do not call APIs directly; API access stays in client/service layers.
- API has no DOM libs and imports nothing from `apps/web`.
- Redis, BullMQ, MinIO, Prisma, and WebSocket infrastructure are prepared without business jobs, models, or events.
- Docker builds use the repository root as build context and rely on root `.dockerignore`.

## Quality Notes

- Repository docs and Markdown files are Prettier-compatible.
- Root TypeScript config stays runtime-neutral; browser libs are app-local.
- TypeScript and ESLint parser versions are aligned.
- Docker context excludes env files, package-manager credentials, host dependencies, and local build artifacts.
- Docker Node base images use concrete Node 20 Alpine tags.
- API Docker builds copy npm workspace dependencies from the install stage.
- WebSocket APIs expose only tenant-scoped or tenant/user-scoped emission methods.
- JWT guard/service scaffold performs real token validation through `JWT_SECRET`.

## Known Risks

- Docker base images are tag-pinned, not digest-pinned.
- Dependency audit findings exist and require a dedicated dependency/security pass.
- Compose credentials are local development defaults only.
- Redis adapter for Socket.io is not configured yet.
- Prisma has no business models or migrations yet.
- CI does not deploy or build Docker images.

## Next Session Preparation

- Define auth/session strategy before protected CRM routes.
- Add API contract generation before frontend API-dependent features.
- Add database models with tenant-aware constraints only when domain scope is approved.
- Introduce queues, Redis adapter, and MinIO bucket setup only with concrete feature needs.

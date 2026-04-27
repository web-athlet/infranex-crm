# infranex CRM

AI-native CRM monorepo scaffold.

See [AGENTS.md](./AGENTS.md) for repository rules and [Session 0 Summary](./docs/sessions/session-0.md) for the scaffold baseline.

## Status

Monorepo scaffold for the web app, API app, and local infrastructure.

## Setup

Install dependencies:

```bash
npm install
```

Run baseline checks:

```bash
npm run lint
npm run type-check
npm run format:check
```

Build workspaces:

```bash
npm run build --workspace @infranex/web
npm run build --workspace @infranex/api
```

## Workspace Layout

```text
apps/api     NestJS API
apps/web     Next.js frontend
packages/*   Future shared packages
```

## Local Infrastructure

Copy the example env file before starting local services:

```bash
cp .env.example .env
docker compose up -d postgres redis minio
docker compose ps
```

The Compose credentials are local development defaults only.

| Service  | Port | Notes                     |
| -------- | ---- | ------------------------- |
| Postgres | 5432 | PostgreSQL 15 local DB    |
| Redis    | 6379 | Redis 7 local cache/queue |
| MinIO    | 9000 | S3-compatible API         |
| MinIO UI | 9001 | Local console             |

Validate Compose syntax without starting services:

```bash
docker compose config
```

Build app images from the repository root so `.dockerignore` is applied:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

The Docker build context must be the repository root.

Docker images use concrete Node 20 Alpine tags. They are not digest-pinned yet; pin digests later for stricter reproducibility.

## CI

GitHub Actions runs the baseline checks on push and pull requests using Node 20.19.0 and npm 11.8.0.

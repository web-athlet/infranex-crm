# infranex CRM

AI-native CRM monorepo scaffold.

## Status

Monorepo scaffold for the web app, API app, and local infrastructure.

## Commands

```bash
npm install
npm run lint
npm run type-check
npm run format:check
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

Docker images use concrete Node 20 Alpine tags. They are not digest-pinned yet; pin digests later for stricter reproducibility.

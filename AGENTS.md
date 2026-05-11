# infranex CRM — AGENTS.md

## Projekt

Wir bauen ein AI-native CRM, modular, AI-first und hoch skalierbar.

## Architektur

Monorepo via Turborepo:

apps/web → Next.js Frontend  
apps/api → NestJS Backend  
packages/shared-types → gemeinsame Types  
packages/ui-components → gemeinsame UI-Komponenten

## Stack

### Frontend

- Next.js 14 App Router
- React 18
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query
- Custom Auth Client (`apps/web/lib/auth-client.ts`), kein NextAuth.js

### Backend

- NestJS 10
- Prisma 5
- PostgreSQL 15
- Redis 7
- BullMQ 5
- Socket.io 4
- Swagger / OpenAPI

### Infra

- Docker
- GitHub Actions
- Husky
- lint-staged
- MinIO

### AI

- OpenAI SDK
- Serper.dev

## Coding Rules

- strict typing
- kein `any`; externe Daten zuerst als `unknown`, dann per DTO/Schema validieren
- no business logic in UI
- small reusable components
- feature-based modules
- optimistic UI updates, wo sinnvoll
- avoid overengineering
- clean architecture over shortcuts

## Production-Ready Definition

Production-ready bedeutet mindestens:

- typisiert
- validiert
- getestet
- fehlerbehandelt
- tenant-sicher
- sicherheitsrelevant geprüft
- strukturiert logbar/beobachtbar

Keine halbfertigen Stubs, TODO-Platzhalter oder stillen Fehlerpfade.

Abstufung:

- Kleine UI-/Bugfix-Änderungen: angemessene Checks nach Risiko.
- Security-, Tenant-, Daten- oder Auth-Änderungen: volle Production-Ready-Definition.

## Validation Boundaries

- API Boundary: DTO Validation in `apps/api`
- DB Boundary: Prisma Constraints und Transaktionen
- UI Boundary: nur UX-nahe Validierung
- externe APIs/AI: defensive Parsing/Validation
- keine unnötige Doppelvalidierung ohne fachlichen Grund

## API Types & Contracts

- Öffentliche API-Routen liegen unter `/api/v1`.
- Request/Response Types kommen aus Backend DTOs/OpenAPI.
- Frontend API-Typen werden aus OpenAPI generiert.
- Keine manuell duplizierten API-Typen in `apps/web`.
- Bis eine OpenAPI-Generation-Pipeline vorhanden ist, werden rohe API-Antworten im Frontend als `unknown` behandelt und per Runtime-Narrowing in client-interne Shapes überführt.
- `packages/shared-types` enthält nur stabile, domainübergreifende, nicht-API-spezifische Typen.

## Package Boundaries

- `apps/web` importiert niemals direkt aus `apps/api`.
- `packages/shared-types` hat keine Runtime-Abhängigkeiten auf Next, Nest oder Prisma.
- `packages/ui-components` enthält keine Business-Logik.
- Backend-Domainlogik bleibt in `apps/api`.
- Feature-interne Typen nicht globalisieren.
- UI-Komponenten erst lokal bauen; nach wiederholter Nutzung nach `packages/ui-components` extrahieren.

## Backend Layering

- Controller = HTTP Boundary.
- DTOs = Input/Output Validation.
- Guards/Policies = Auth/RBAC.
- Services = Use Cases und Business Logic.
- Prisma = Persistenz.
- Repository nur bei komplexen Queries/Domainzugriffen.

## Auth, RBAC & Multi-Tenancy

- Auth ist bewusst als Custom Auth implementiert; keine NextAuth.js-Implementierung einführen.
- Neue UI-/API-Flows müssen den bestehenden Auth-Client (`apps/web/lib/auth-client.ts`), Auth-Store (`apps/web/lib/store/auth-store.ts`) und Bootstrap-/Refresh-Mechanismus verwenden.
- Refresh Tokens bleiben ausschließlich HttpOnly Cookie; niemals in JavaScript lesen oder speichern.
- Access Tokens bleiben ausschließlich im Memory-State; niemals in `localStorage`, `sessionStorage`, Cookies oder BroadcastChannel persistieren.
- Auth-/2FA-/Reset-/OAuth-Tokens, Secrets und PII niemals loggen oder über BroadcastChannel senden.
- Jeder Datenzugriff ist tenant-scoped.
- `tenantId`/`userId` zentral serverseitig aus Auth ableiten.
- Niemals ungeprüft Client-Parametern vertrauen.
- Prisma-Zugriffe sind tenant-scoped oder laufen über geprüfte Services.
- Keine Cross-Tenant Queries ohne explizite Freigabe.
- Rollen/Rechte serverseitig prüfen, nicht nur im UI.
- Authentifizierung, Autorisierung und Tenant-Isolation sind Pflicht für CRM-Daten.

## Frontend Layering

- Feature-basierte Struktur in `apps/web`.
- API Calls nur über Client-/Service-Layer.
- Keine beliebigen `fetch` Calls in Components.
- Server und Client Components bewusst trennen.
- Forms mit `zod`/`react-hook-form`, wo sinnvoll.

## State Management

- Server State über TanStack Query.
- Client/UI State über Zustand.
- API-Daten nicht dauerhaft in Zustand spiegeln.
- Optimistic Updates nur mit Rollback-Strategie.
- Access Tokens dürfen nicht persistiert werden.
- UI-Präferenzen wie Navigation-Expanded-State dürfen in `localStorage` persistiert werden, sofern sie keine sensiblen Daten enthalten.

## Testing

- Relevante Unit-/Integrationstests ergänzen.
- Kritische Businesslogik nicht ohne Tests ändern.
- API-Module mit Service- und Controller-Tests absichern.
- Tests müssen deterministisch sein und keine externen Services voraussetzen.

## Logging & Observability

- Strukturierte Logs verwenden.
- Zentrale Exception Filter im Backend.
- Einheitliches API Error Format verwenden.
- Domain Errors auf passende HTTP Status Codes mappen.
- Keine rohen Prisma/OpenAI Errors an Clients geben.
- Keine sensiblen Daten, Tokens oder PII loggen.
- Request IDs / Correlation IDs berücksichtigen.
- Fehlerausgaben monitoring-ready halten.

## Security

- Secrets niemals committen.
- Env Validation beim Start.
- Rate Limiting für Auth/API/AI-Endpunkte.
- CSRF/CORS/Cookie-Regeln bei cookie-basierter Auth beachten.
- File Upload Validation für MinIO.
- Audit Logs für CRM-kritische Aktionen.
- Keine Reset Tokens, Access Tokens, Refresh Tokens, Provider Tokens, TOTP Secrets oder Backup Codes loggen.
- Keine E-Mail-Adressen oder account-identifying PII in Auth-/Reset-/Security-Logs schreiben.
- Keine Secrets oder Tokens über BroadcastChannel, localStorage, sessionStorage oder URL-Parameter transportieren.
- Reset-Password-Tokens in URLs nach dem Einlesen clientseitig aus der URL entfernen.

## Database Rules

- Migrationen immer explizit.
- Keine destructive migrations ohne Rückfrage.
- Additive Migrations bevorzugen.
- Transaktionen bei mehrschrittigen Writes.
- Indexe bei häufig gefilterten Feldern.
- `tenantId` Indexe für tenant-bezogene Tabellen.
- Tenant-aware Unique Constraints, z. B. `@@unique([tenantId, email])`.
- Keine globalen Lookups ohne Tenant-Filter.
- Transaktionen bei tenant-relevanten Multi-Step-Writes.
- Pagination statt unlimitierter Queries.
- Listen-Endpunkte brauchen Default- und Max-Limits.

## Infra Usage Criteria

- Stack-Komponenten dürfen gelistet sein, müssen aber nicht initial eingerichtet werden.
- Neue Infrastruktur nur mit konkretem Feature-Bedarf und Tests.
- AI Calls synchron nur für kurze, nicht-blockierende UX-Fälle.
- Lange, teure oder retrybare AI Tasks immer via BullMQ.
- Cache nur bei fachlich erlaubter Wiederverwendung.
- WebSockets nur für echte Realtime-Use-Cases.

## AI Safety

- Prompt Injection als Bedrohung behandeln.
- PII/CRM-Daten nur minimal und begründet an externe Modelle senden.
- AI Outputs niemals blind vertrauen; immer validieren.
- Token-/Kostenbudgets pro Tenant/User berücksichtigen.
- Keine ungeprüften AI-generierten DB-Writes.
- Prompt- und Tool-Inputs validieren.
- AI Request/Response Audit ohne PII-Leak.
- Serper-Daten als untrusted behandeln.

## Realtime & Queue Rules

- WebSocket Events typisieren und versionieren.
- WebSocket Events tenant/user scoped halten.
- Keine globalen Broadcasts ohne Tenant-Filter.
- Realtime-Features horizontal skalierbar planen, z. B. mit Redis Adapter.
- BullMQ Jobs müssen idempotent sein.
- Jeder Job braucht einen stabilen Idempotency Key.
- Job Payloads enthalten nur IDs und minimale Metadaten.
- Retries dürfen keine doppelten CRM-Aktionen erzeugen.
- Retry-/Backoff-Strategie definieren.
- Dead-lettered Jobs müssen beobachtbar sein.

## Session Scope Notes

- Session 2 Authentication ist abgeschlossen und nutzt Custom Auth statt NextAuth.js.
- Zukünftige Sessions dürfen keine NextAuth.js-Abhängigkeit einführen.
- Session 3 darf nur globale Navigation, Layout, Design-System und UI-State betreffen.
- Session 3 darf keine Backend-Auth-Änderungen, keine neuen Auth-Flows und keine CRM-Fachmodule implementieren.
- Ursprüngliche Prompt-Stellen, die NextAuth.js erwähnen, gelten als durch die Custom-Auth-Architektur ersetzt.

## Scope Control

- Infrastruktur-Komponenten nur einsetzen, wenn der Use Case sie rechtfertigt.
- Keine Scope-Erweiterung ohne Rückfrage.
- Keine großen Refactors als Nebenprodukt kleiner Tasks.
- > 10 Dateien gleichzeitig sind Warnschwelle, keine harte Grenze; Begründung erforderlich.
- Risiken immer explizit nennen.

## Workflow

Immer:

1. planen
2. Scope angemessen und nach Risiko production-ready implementieren
3. relevante Tests ergänzen/ausführen
4. lint
5. type-check
6. diff zeigen
7. review durchführen
8. Commit vorschlagen, niemals automatisch committen

Regeln:

- keine Scope-Erweiterung ohne Rückfrage
- keine halbfertigen Stubs
- keine TODO-Platzhalter
- keine unnötigen Extras
- keine unnötigen Dependency Major Upgrades
- keine Architekturänderungen ohne explizite Rückfrage

## Commit Convention

type(session-x): description

Beispiele:

- chore(session-0a): root monorepo setup
- feat(session-0b): web scaffold
- feat(session-0c): api scaffold + websocket
- feat(session-2): implement authentication
- feat(session-3): implement global navigation

## Regeln für Codex

- niemals große unkontrollierte Refactors
- > 10 Dateien gleichzeitig sind Warnschwelle, keine harte Grenze; Begründung erforderlich
- zuerst denken, dann implementieren
- Risiken immer explizit nennen
- Architektur > Geschwindigkeit
- AGENTS.md strikt befolgen
- Bei Widerspruch zwischen altem Session-Prompt und aktuellem Repo-Stand gilt der aktuelle Repo-Stand plus AGENTS.md
- Bei Auth-Fragen gilt immer die Custom-Auth-Architektur aus Session 2

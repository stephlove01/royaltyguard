# RoyaltyGuard — Implementation Plan

## 1. Implementation Strategy

Build vertically in small, testable increments.

Do not build the entire frontend first and automation last. Establish the contracts between components early.

## Phase 0 — Product Definition

Deliver:
- PRD
- architecture
- database design
- API specification
- n8n specification
- UI specification

Exit criteria:
- Core entities and flow are agreed.
- MVP scope is defined.

## Phase 1 — Repository & Environment

Tasks:
- Create repository structure.
- Initialize frontend.
- Initialize backend.
- Configure TypeScript.
- Create `.env.example`.
- Configure Git.
- Add README.
- Add AGENTS.md.

Exit criteria:
- Frontend starts.
- Backend starts.
- Git workflow works.

## Phase 2 — Database

Tasks:
- Create MySQL database.
- Create migrations.
- Create tables.
- Add relationships.
- Add indexes.
- Seed development data.

Exit criteria:
- Database schema can be recreated from migrations.

## Phase 3 — Backend Foundation

Tasks:
- Express application.
- Configuration.
- Error middleware.
- Validation.
- Health endpoint.
- Database connection.
- Logging.

Exit criteria:
- `GET /api/health` works.
- Invalid requests return consistent errors.

## Phase 4 — Frontend Foundation

Tasks:
- App shell.
- Routing.
- Tailwind.
- API client.
- Dashboard skeleton.
- Loading/error states.

Exit criteria:
- Frontend can call backend health endpoint.

## Phase 5 — Statement Management

Tasks:
- Statement model.
- Upload endpoint.
- File metadata.
- Statement list.
- Statement detail page.
- Processing status.

Exit criteria:
- User can upload a test statement and see it in the UI.

## Phase 6 — Audit Engine

Tasks:
- Normalize royalty rows.
- Implement rate lookup.
- Implement deterministic calculation.
- Create audit records.
- Create discrepancy records.
- Add unit tests.

Exit criteria:
- Known test cases produce expected results.

## Phase 7 — n8n Automation

Tasks:
- Create webhook trigger.
- Connect backend.
- Extract data.
- Normalize.
- Call rate source.
- Calculate.
- Store results.
- Handle errors.

Exit criteria:
- End-to-end statement-to-audit workflow works.

## Phase 8 — AI Integration

Tasks:
- Define extraction schema.
- Configure model.
- Add structured output validation.
- Add dispute drafting.
- Add AI failure handling.

Exit criteria:
- AI cannot silently change verified financial values.

## Phase 9 — Dispute Management

Tasks:
- Dispute API.
- Draft UI.
- Gmail integration.
- Send tracking.
- Follow-up state.
- Escalation.

Exit criteria:
- A test discrepancy can produce and send a test dispute.

## Phase 10 — Integration

Tasks:
- Connect all UI screens.
- Add polling or status refresh.
- Handle asynchronous processing.
- Add end-to-end tests.

Exit criteria:
- Full user journey works.

## Phase 11 — Testing

Tasks:
- Unit tests.
- API tests.
- Database integration tests.
- n8n workflow tests.
- E2E tests.
- Error-path tests.

## Phase 12 — Security

Tasks:
- Secrets review.
- Input validation.
- Authentication/authorization.
- Webhook authentication.
- File validation.
- Rate limiting where appropriate.

## Phase 13 — Deployment

Only after the local system is stable:
- Production database.
- Backend deployment.
- Frontend deployment.
- n8n deployment.
- Environment configuration.
- Monitoring.
- Backup strategy.

## Implementation Rule

Every phase should end with a working increment. Avoid large untestable batches.

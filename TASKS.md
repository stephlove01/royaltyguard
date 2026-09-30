# RoyaltyGuard — Task Tracker

**Capstone scope:** fictional demo data, simulated streaming CSVs (no live platform APIs), backend-owned royalty math, local file storage, email/password/JWT auth, user must approve dispute send. See `PRD.md` and `DECISIONS.md`.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

## Phase 0 — Product & Architecture

- [x] TASK-001 Finalize PRD (capstone scope)
- [x] TASK-002 Finalize system architecture
- [x] TASK-003 Finalize database design
- [x] TASK-004 Finalize API specification
- [x] TASK-005 Finalize AI/n8n specification
- [x] TASK-006 Finalize UI/UX specification

## Phase 1 — Repository

- [x] TASK-007 Create repository structure (`frontend/`, `backend/`, `database/`, `n8n/`, `sample-data/`)
- [x] TASK-008 Initialize frontend
- [x] TASK-009 Initialize backend
- [x] TASK-010 Configure TypeScript
- [x] TASK-011 Create `.env.example` (DB, JWT, upload dir, `N8N_WEBHOOK_SECRET`, n8n URLs)
- [x] TASK-012 Create AGENTS.md
- [x] TASK-013 Update README (capstone scope)

## Phase 2 — Database

- [x] TASK-014 Create MySQL database
- [x] TASK-015 Create migration system
- [x] TASK-016 Create users table
- [x] TASK-017 Create artists table
- [x] TASK-018 Create statements table
- [x] TASK-019 Create royalty_rows table
- [x] TASK-020 Create royalty_rates table
- [x] TASK-021 Create audits table
- [x] TASK-022 Create discrepancies table
- [x] TASK-023 Create disputes table
- [x] TASK-024 Add indexes and constraints
- [x] TASK-025 Seed demo data (fictional artists + demo platform rates: Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002)
- [x] TASK-026 Add fictional sample CSVs under `sample-data/` (`spotify_statement.csv`, `apple_music_statement.csv`, `youtube_music_statement.csv`, `audiomack_statement.csv`)

## Phase 3 — Backend

- [x] TASK-027 Create Express app
- [x] TASK-028 Add configuration
- [x] TASK-029 Add MySQL connection
- [x] TASK-030 Add error middleware
- [x] TASK-031 Add request validation
- [x] TASK-032 Add health endpoint
- [x] TASK-033 Implement auth (register, login, password hash, JWT middleware)
- [x] TASK-034 Add local filesystem upload storage for statements
- [x] TASK-035 Add webhook shared-secret middleware for n8n endpoints
- [x] TASK-036 Add statement service
- [x] TASK-037 Add statement API
- [x] TASK-038 Add audit API (including run-audit / internal audit engine entry)
- [x] TASK-039 Add discrepancy API
- [x] TASK-040 Add dispute API (draft + explicit send trigger)

## Phase 4 — Frontend

- [ ] TASK-041 Create app shell
- [ ] TASK-042 Configure routing (including `/login`)
- [ ] TASK-043 Configure Tailwind
- [ ] TASK-044 Create API client (JWT)
- [ ] TASK-045 Build login/register UI
- [ ] TASK-046 Build dashboard
- [ ] TASK-047 Build statements page
- [ ] TASK-048 Build statement detail
- [ ] TASK-049 Build audits page
- [ ] TASK-050 Build discrepancy page
- [ ] TASK-051 Build disputes page (review draft, explicit send)
- [ ] TASK-052 Add loading/error/empty states

## Phase 5 — Audit Engine

- [ ] TASK-053 Define canonical royalty schema
- [ ] TASK-054 Implement normalization
- [ ] TASK-055 Implement rate lookup (MySQL demo rates)
- [ ] TASK-056 Implement deterministic calculation (backend only)
- [ ] TASK-057 Implement discrepancy threshold
- [ ] TASK-058 Persist audit results
- [ ] TASK-059 Write calculation tests
- [ ] TASK-060 Write discrepancy tests

## Phase 6 — n8n

- [ ] TASK-061 Create statement upload trigger workflow
- [ ] TASK-062 Connect n8n to backend (HTTP + shared secret)
- [ ] TASK-063 Implement CSV extraction/ingestion
- [ ] TASK-064 Submit normalized rows to backend
- [ ] TASK-065 Invoke backend audit API (no n8n royalty math)
- [ ] TASK-066 Handle discrepancy branch from backend response
- [ ] TASK-067 Persist updates via backend API / webhooks
- [ ] TASK-068 Add retries/error paths
- [ ] TASK-069 Add idempotency handling

## Phase 7 — AI

- [ ] TASK-070 Define extraction prompt (optional for CSV; useful for classification)
- [ ] TASK-071 Define structured output schema
- [ ] TASK-072 Validate AI output
- [ ] TASK-073 Define dispute-generation prompt
- [ ] TASK-074 Prevent unsupported claims/invented facts
- [ ] TASK-075 Test AI failure cases

## Phase 8 — Disputes

- [ ] TASK-076 Create dispute draft flow (AI → draft in DB)
- [ ] TASK-077 Create dispute review UI
- [ ] TASK-078 Configure Gmail in n8n
- [ ] TASK-079 Implement send action (user-triggered → n8n/Gmail)
- [ ] TASK-080 Record sent message
- [ ] TASK-081 Implement follow-up workflow
- [ ] TASK-082 Implement escalation

## Phase 9 — Testing & Security

- [ ] TASK-083 Unit tests
- [ ] TASK-084 API integration tests (including auth and webhook secret)
- [ ] TASK-085 n8n workflow tests
- [ ] TASK-086 End-to-end test (sample CSV → audit → dispute review → send)
- [ ] TASK-087 Input validation review
- [ ] TASK-088 Secrets/security review
- [ ] TASK-089 Duplicate-processing test
- [ ] TASK-090 Failure/retry test

## Phase 10 — Deployment

- [ ] TASK-091 Prepare demo/deployment environment
- [ ] TASK-092 Configure deployment database
- [ ] TASK-093 Deploy backend
- [ ] TASK-094 Deploy frontend
- [ ] TASK-095 Deploy/configure n8n
- [ ] TASK-096 Configure monitoring (minimal)
- [ ] TASK-097 Configure backups (minimal)

## Task Rule

Before marking a task `[x]`:
1. Implementation exists.
2. Relevant test passes.
3. Documentation is updated if needed.
4. No known regression is introduced.

## Agent Rule

AI coding assistants should work on one or a small related group of TASK IDs at a time and report:
- files changed
- implementation summary
- tests run
- known issues
- next recommended task

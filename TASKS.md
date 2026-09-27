# RoyaltyGuard — Task Tracker

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

## Phase 0 — Product & Architecture

- [ ] TASK-001 Finalize PRD
- [ ] TASK-002 Finalize system architecture
- [ ] TASK-003 Finalize database design
- [ ] TASK-004 Finalize API specification
- [ ] TASK-005 Finalize AI/n8n specification
- [ ] TASK-006 Finalize UI/UX specification

## Phase 1 — Repository

- [ ] TASK-007 Create repository structure
- [ ] TASK-008 Initialize frontend
- [ ] TASK-009 Initialize backend
- [ ] TASK-010 Configure TypeScript
- [ ] TASK-011 Create `.env.example`
- [ ] TASK-012 Create AGENTS.md
- [ ] TASK-013 Update README

## Phase 2 — Database

- [ ] TASK-014 Create MySQL database
- [ ] TASK-015 Create migration system
- [ ] TASK-016 Create users table
- [ ] TASK-017 Create artists table
- [ ] TASK-018 Create statements table
- [ ] TASK-019 Create royalty_rows table
- [ ] TASK-020 Create royalty_rates table
- [ ] TASK-021 Create audits table
- [ ] TASK-022 Create discrepancies table
- [ ] TASK-023 Create disputes table
- [ ] TASK-024 Add indexes and constraints
- [ ] TASK-025 Add seed data

## Phase 3 — Backend

- [ ] TASK-026 Create Express app
- [ ] TASK-027 Add configuration
- [ ] TASK-028 Add MySQL connection
- [ ] TASK-029 Add error middleware
- [ ] TASK-030 Add request validation
- [ ] TASK-031 Add health endpoint
- [ ] TASK-032 Add statement service
- [ ] TASK-033 Add statement API
- [ ] TASK-034 Add audit API
- [ ] TASK-035 Add discrepancy API
- [ ] TASK-036 Add dispute API

## Phase 4 — Frontend

- [ ] TASK-037 Create app shell
- [ ] TASK-038 Configure routing
- [ ] TASK-039 Configure Tailwind
- [ ] TASK-040 Create API client
- [ ] TASK-041 Build dashboard
- [ ] TASK-042 Build statements page
- [ ] TASK-043 Build statement detail
- [ ] TASK-044 Build audits page
- [ ] TASK-045 Build discrepancy page
- [ ] TASK-046 Build disputes page
- [ ] TASK-047 Add loading/error/empty states

## Phase 5 — Audit Engine

- [ ] TASK-048 Define canonical royalty schema
- [ ] TASK-049 Implement normalization
- [ ] TASK-050 Implement rate lookup
- [ ] TASK-051 Implement deterministic calculation
- [ ] TASK-052 Implement discrepancy threshold
- [ ] TASK-053 Persist audit results
- [ ] TASK-054 Write calculation tests
- [ ] TASK-055 Write discrepancy tests

## Phase 6 — n8n

- [ ] TASK-056 Create statement trigger
- [ ] TASK-057 Connect n8n to backend
- [ ] TASK-058 Implement extraction
- [ ] TASK-059 Implement normalization
- [ ] TASK-060 Implement rate lookup
- [ ] TASK-061 Implement calculation
- [ ] TASK-062 Implement discrepancy branch
- [ ] TASK-063 Implement database/API update
- [ ] TASK-064 Add retries/error paths
- [ ] TASK-065 Add idempotency handling

## Phase 7 — AI

- [ ] TASK-066 Define extraction prompt
- [ ] TASK-067 Define structured output schema
- [ ] TASK-068 Validate AI output
- [ ] TASK-069 Define dispute-generation prompt
- [ ] TASK-070 Prevent unsupported claims/invented facts
- [ ] TASK-071 Test AI failure cases

## Phase 8 — Disputes

- [ ] TASK-072 Create dispute draft flow
- [ ] TASK-073 Create dispute review UI
- [ ] TASK-074 Configure Gmail
- [ ] TASK-075 Implement send action
- [ ] TASK-076 Record sent message
- [ ] TASK-077 Implement follow-up workflow
- [ ] TASK-078 Implement escalation

## Phase 9 — Testing & Security

- [ ] TASK-079 Unit tests
- [ ] TASK-080 API integration tests
- [ ] TASK-081 n8n workflow tests
- [ ] TASK-082 End-to-end test
- [ ] TASK-083 Input validation review
- [ ] TASK-084 Secrets/security review
- [ ] TASK-085 Duplicate-processing test
- [ ] TASK-086 Failure/retry test

## Phase 10 — Deployment

- [ ] TASK-087 Prepare production environment
- [ ] TASK-088 Configure production database
- [ ] TASK-089 Deploy backend
- [ ] TASK-090 Deploy frontend
- [ ] TASK-091 Deploy/configure n8n
- [ ] TASK-092 Configure monitoring
- [ ] TASK-093 Configure backups

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

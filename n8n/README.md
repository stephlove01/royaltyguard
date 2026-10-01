# RoyaltyGuard — n8n Workflows

Automation and orchestration (see `AI_N8N_SPECIFICATION.md` and `SYSTEM_ARCHITECTURE.md`).

## Purpose

Workflow definitions for Google Drive ingestion, CSV extraction, AI field mapping, rate retrieval, deterministic n8n Code calculation, and discrepancy branching. The backend remains the application/data/persistence layer; AI never performs financial calculations.

## Statement upload trigger

The first workflow export is [royaltyguard-statement-upload-trigger.json](royaltyguard-statement-upload-trigger.json).
Its first node is **Google Drive Trigger** and its path is:

```text
Google Drive Trigger
	-> Get / Download Statement File
	-> Prepare Statement Metadata
	-> HTTP - RoyaltyGuard Backend Intake
```

The workflow only orchestrates file intake. It does not calculate royalties,
apply thresholds, or persist audit results.

## Primary statement audit (TASK-063–066)

The current primary CSV workflow is [royaltyguard-statement-processing.json](royaltyguard-statement-processing.json).
It downloads Drive CSV files, extracts rows with **Extract From File**, maps
them with the installed **Information Extractor** node, validates canonical
rows, submits statement metadata/rows to the backend, retrieves rates through
HTTP, calculates in an n8n Code node, and branches on the configured threshold.
It does not call the backend audit calculation endpoint.

The workflow calls:

- `POST /api/webhooks/n8n/statements`
- `POST /api/webhooks/n8n/audit-results`

The ingestion endpoint requires `X-N8N-Webhook-Secret` and only accesses the
artist configured as `N8N_STATEMENT_ARTIST_ID` in the backend environment. Run
database migration `009_add_statement_source_metadata.sql` before using this
workflow. The result endpoint persists n8n-supplied values without financial
recalculation.

### Configuration

- `ROYALTYGUARD_STATEMENTS_FOLDER_ID`: Google Drive folder to watch.
- `ROYALTYGUARD_BACKEND_URL`: Backend origin, defaulting to `http://localhost:5000`.
- `ROYALTYGUARD_PLATFORM`: Statement platform when Drive metadata does not provide one.
- `ROYALTYGUARD_STATEMENT_PERIOD`: Statement period when Drive metadata does not provide one.
- `ROYALTYGUARD_RATE_API_URL`: full rate endpoint URL; defaults to the backend's protected `/api/webhooks/n8n/royalty-rate` local demo adapter.
- `ROYALTYGUARD_DISCREPANCY_THRESHOLD`: n8n threshold value, default `0.00`.
- `N8N_WEBHOOK_SECRET`: Shared secret sent as `X-N8N-Webhook-Secret`.
- n8n credential `Google Drive OAuth2 API`: Google Drive trigger/download access.
- n8n AI Language Model credential: required by Information Extractor.

Set `N8N_STATEMENT_ARTIST_ID` in the backend `.env` to the intended demo
artist ID. Platform and statement period are required for statements that do
not include those fields in Drive metadata. The rate adapter returns an
applicable non-negative decimal `rate` and currency/source metadata. It accepts
an empty tier; non-empty tiers are unsupported by the current `royalty_rates`
schema and return a clear error. The endpoint does not calculate payouts.

The separate initial trigger export still calls
`POST /api/webhooks/n8n/statement-uploaded` and returns `202` after validating
source metadata. Missing or invalid shared secrets return `401`. The backend
`/run-audit` routes remain available for backend/API support but are not in the
primary workflow. HTTP calls retry at most three times; exhausted errors stop
at an explicit error node. `sourceFileId` plus unique DB keys makes statement,
audit, and discrepancy writes idempotent.

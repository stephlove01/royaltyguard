# RoyaltyGuard — n8n Workflows

Automation and orchestration (see `AI_N8N_SPECIFICATION.md` and `SYSTEM_ARCHITECTURE.md`).

## Purpose

Workflow definitions for statement ingestion triggers, CSV handling, backend API calls (audit, persist), optional AI extraction/drafting, and Gmail send **after user approval**. n8n must not perform authoritative royalty calculations.

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

### Configuration

- `ROYALTYGUARD_STATEMENTS_FOLDER_ID`: Google Drive folder to watch.
- `ROYALTYGUARD_BACKEND_URL`: Backend origin, defaulting to `http://localhost:5000`.
- `N8N_WEBHOOK_SECRET`: Shared secret sent as `X-N8N-Webhook-Secret`.
- n8n credential `Google Drive OAuth2 API`: Google Drive trigger/download access.

The backend intake request is `POST /api/webhooks/n8n/statement-uploaded` and
returns `202` after validating the source file metadata. Missing or invalid
shared secrets return `401`. CSV extraction, normalized row submission, audit
execution, retries, and idempotency are intentionally handled by later tasks.

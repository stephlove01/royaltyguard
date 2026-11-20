# RoyaltyGuard — API Specification

Capstone demo API: fictional financial data, no payment processing. Protected routes use JWT unless noted.

## 1. API Principles

- RESTful HTTP API.
- JSON request/response format unless file upload is required.
- Backend validates every request.
- Frontend never accesses MySQL directly.
- Consistent HTTP status codes.
- Version API routes where appropriate.

Base path:

```text
/api
```

## 2. Authentication

### POST /api/auth/register

Body: email, password, name (optional).

Creates user with hashed password.

### POST /api/auth/login

Body: email, password.

Returns JWT for subsequent requests (e.g. `Authorization: Bearer <token>`).

OAuth is **not** in MVP scope.

## 3. Health

### GET /api/health

Response:

```json
{
  "success": true,
  "status": "ok"
}
```

## 4. Statements

### POST /api/statements/upload

Requires `Authorization: Bearer <JWT>` and accepts one multipart file in the
`file` field. CSV and PDF files up to 10 MB are accepted. The backend stores the
file under `UPLOAD_DIR` (default: `uploads`) in a directory scoped to the JWT
user, using a generated filename. This endpoint does not create a statement
record or parse the file.

Successful response (`201`):

```json
{
  "success": true,
  "data": {
    "originalFilename": "statement.csv",
    "storedFilename": "generated-uuid.csv",
    "fileSize": 123,
    "mimeType": "text/csv"
  }
}
```

Unsupported file types and missing files return `400`; files larger than 10 MB
return `413`. Requests without a valid JWT return `401`.

### POST /api/statements

Creates a statement record for a previously uploaded file. Requires
`Authorization: Bearer <JWT>` and a JSON body containing:

```json
{
  "artistId": 1,
  "platform": "Spotify",
  "statementPeriod": "2026-Q1",
  "fileName": "statement.csv",
  "storedFilename": "generated-uuid.csv"
}
```

The `artistId` must belong to the authenticated user, and `storedFilename`
must refer to a file uploaded by that user. The server derives the stored file
type and storage path. New statements have status `pending`.

### GET /api/statements

Returns all statements belonging to artists owned by the authenticated user.

### GET /api/statements/:id

Returns statement details and processing status only when the statement
belongs to an artist owned by the authenticated user. Missing and inaccessible
statements both return `404`.

### POST /api/statements/:id/run-audit

This existing backend/API support endpoint requires JWT authentication and an
owned statement. It runs the backend's deterministic audit service and
persists its result for backend/API use and regression testing. It is **not**
called by the primary n8n royalty-audit workflow, which retrieves a rate over
HTTP and performs calculation/thresholding in n8n. Repeated backend runs update
the same audit and replace generated discrepancy rows. A statement with no
royalty rows, an invalid period, or any row without an applicable backend rate
returns `422` and marks the audit failed. The backend calculation service is
retained; it is not the normal n8n calculation path.

Rates are selected by exact platform and territory first, then a platform-wide
rate (`territory IS NULL`), using the latest rate effective on the statement
period start. Supported period forms include `YYYY`, `YYYY-MM`, `YYYY-MM-DD`,
and `YYYY-QN`. The backend calculates in integer cents and rounds expected
payouts half up to two decimal places. A discrepancy is created only when
`expected - actual > DISCREPANCY_THRESHOLD`; the default threshold is `0.00`.

## 5. Audits

### GET /api/audits

Requires JWT authentication. Returns only audits whose statements belong to
the authenticated user. Supports `status`, `statementId`, `page`, and `limit`
filters; page defaults to 1 and limit defaults to 20 (maximum 100). The response
uses the standard `data` and `pagination` fields.

Supported query parameters may include:
- status
- statementId
- page
- limit
- sort

### GET /api/audits/:id

Returns:
Requires JWT authentication and returns the audit, its statement summary, and
discrepancy evidence. Audits not owned by the authenticated user return `404`.

## 6. Discrepancies

### GET /api/discrepancies

Requires JWT authentication. Returns only discrepancies belonging to the
authenticated user's statements, with `status`, `auditId`, `page`, and `limit`
filters and standard pagination metadata.

### GET /api/discrepancies/:id

Requires JWT authentication and returns the discrepancy with its statement
and royalty-row evidence. Inaccessible or missing discrepancies return `404`.

## 7. Disputes

### POST /api/disputes

Requires JWT authentication. Creates a draft for an owned discrepancy from
`discrepancyId`, `recipient`, `subject`, and `body`. The draft is user-provided;
this endpoint does not invoke AI.

### GET /api/disputes

Requires JWT authentication. Lists only the authenticated user's disputes with
optional `status`, `page`, and `limit` filters and standard pagination.

### GET /api/disputes/:id

Requires JWT authentication and returns the dispute and its discrepancy and
statement summary. Inaccessible or missing disputes return `404`.

### POST /api/disputes/:id/draft

Requires JWT authentication and a `recipient` email. The backend assembles
verified facts from persisted records owned by the authenticated user, asks
Gemini for a draft, validates its strict `{ subject, body, facts_used,
missing_information }` response, then saves it for review. `facts_used` must
contain exact supported camelCase fact paths (including `auditId` and
`discrepancyId`). The backend requests `application/json` output with a schema
matching those four fields, then validates the result again before saving.
Configure `GEMINI_API_KEY` server-side; `GEMINI_MODEL` defaults to
`gemini-3.8-flash`. Missing configuration returns `503`. Provider failure,
empty response, invalid JSON, and schema-invalid output return distinct `502`
error codes (`DISPUTE_DRAFT_FAILED`, `DISPUTE_DRAFT_EMPTY_RESPONSE`,
`DISPUTE_DRAFT_INVALID_JSON`, and `DISPUTE_DRAFT_SCHEMA_INVALID`) without
saving a draft.

Saving a valid generated dispute automatically triggers the n8n/Gmail delivery
workflow. The backend sends the saved record to
`N8N_BASE_URL + N8N_DISPUTE_WEBHOOK_PATH`, using the header named by
`N8N_WEBHOOK_HEADER_NAME` and the server-only `N8N_WEBHOOK_SECRET`. A dispute
is marked `sent` only when n8n returns `success: true`, `provider: "gmail"`, a
non-empty message ID, and matching `disputeId` and `idempotencyKey`. The active
workflow's `Respond - Send Receipt` does not include `deliveryStatus`; the
backend accepts that field when present only if it is `"sent"`. The backend
uses the production `/webhook/` route (a bare webhook slug is normalized to
that route) and the
`X-N8N-Webhook-Secret` header expected by the active workflow; it rejects a
test route or mismatched header configuration before making the request.
Delivery diagnostics log the dispute ID, destination host/path, HTTP status,
elapsed time, and safe error category only—not credentials, recipient, subject,
or message content. Definitive pre-send client errors become `send_failed`;
a timeout, upstream server error, or response without a valid receipt/message
ID sets `send_uncertain` and permanently blocks automatic resend. The backend
also refuses to reserve a draft with an existing `send_attempted_at` value,
even if its status is still `draft`, preventing a stale or interrupted attempt
from being sent again. The backend reserves each saved dispute atomically, and
n8n stores its receipt by `idempotencyKey: "dispute-<id>"`. The Gmail node must
not retry on failure.

### POST /api/disputes/:id/send

Requires JWT authentication. This endpoint remains available for authenticated
operational recovery; normal delivery is triggered automatically when a dispute
is created and it does not require an approval body.

## 8. Webhooks / n8n

### POST /api/webhooks/n8n/statement-uploaded

Used by the Google Drive-first statement trigger workflow to acknowledge a
downloaded source file. This endpoint validates metadata and accepts the event
for later extraction/orchestration; it does not calculate royalties or persist
audit results.

Requires the `X-N8N-Webhook-Secret` header matching `N8N_WEBHOOK_SECRET`.

Body:

```json
{
  "sourceFileId": "google-drive-file-id",
  "fileName": "statement.csv",
  "mimeType": "text/csv"
}
```

Successful response (`202`):

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "sourceFileId": "google-drive-file-id",
    "fileName": "statement.csv",
    "mimeType": "text/csv"
  }
}
```

### GET /api/webhooks/n8n/royalty-rate

Rate-data-only endpoint for the primary n8n workflow. Requires the
`X-N8N-Webhook-Secret` header. Query parameters:

- `platform` (required)
- `territory` (required)
- `tier` (optional; must be empty because the current `royalty_rates` schema has no tier column)
- `statementPeriod` (required; accepts `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or `YYYY-QN`)

The endpoint reuses the existing royalty-rate service. It selects an exact
platform/territory rate before a platform-wide (`territory IS NULL`) rate and
requires the effective date range to include the statement period start. It
does not calculate payout, discrepancy, or threshold values.

Example:

```text
GET /api/webhooks/n8n/royalty-rate?platform=Spotify&territory=NG&tier=&statementPeriod=2026-Q1
```

Successful response (`200`):

```json
{
  "success": true,
  "data": {
    "platform": "Spotify",
    "territory": "NG",
    "rate": "0.004000",
    "currency": "NGN",
    "source": "demo_seed"
  }
}
```

No applicable rate returns `404` with `ROYALTY_RATE_NOT_FOUND`; a non-empty
unsupported tier returns `422` with `TIER_RATE_NOT_SUPPORTED`.

### POST /api/webhooks/n8n/statements

Receives one extracted CSV statement with canonical royalty rows. Requires the
`X-N8N-Webhook-Secret` header. The backend normalizes and validates every row,
then creates the statement and royalty rows in one transaction. Access is
restricted to the artist configured by `N8N_STATEMENT_ARTIST_ID`; callers
cannot choose another artist in the request.

Body:

```json
{
  "platform": "Spotify",
  "statementPeriod": "2026-Q1",
  "rows": [
    {
      "trackName": "Test Track",
      "eligibleUnits": "100000",
      "territory": "NG",
      "tier": null,
      "actualPayout": "300.00"
    }
  ],
  "sourceMetadata": {
    "sourceFileId": "google-drive-file-id",
    "fileName": "statement.csv",
    "mimeType": "text/csv",
    "sourceLocation": "https://drive.google.com/open?id=google-drive-file-id",
    "createdTime": "2026-01-01T00:00:00.000Z",
    "modifiedTime": "2026-01-01T00:00:00.000Z"
  }
}
```

Successful response (`201`) returns `data.statementId` and the persisted
`data.sourceMetadata`. Missing artist configuration returns `503`; malformed
rows return `400`. If `sourceMetadata.sourceFileId` has already been ingested,
the endpoint returns `200` with the existing `statementId` and
`idempotentReplay: true`; it does not insert duplicate statement/royalty rows.

### POST /api/webhooks/n8n/statements/:id/run-audit

Requires the `X-N8N-Webhook-Secret` header and a statement belonging to the
configured `N8N_STATEMENT_ARTIST_ID`. It delegates to the same deterministic
audit service as `POST /api/statements/:id/run-audit` and returns the same
audit/discrepancy response shape. This compatibility endpoint remains
available but must not be called by the primary n8n audit workflow.

### POST /api/webhooks/n8n/audit-results

Persists the primary n8n-generated audit result; it does **not** calculate,
recalculate, or threshold any financial values. Requires
`X-N8N-Webhook-Secret`. The request includes `statementId`, `sourceFileId`,
precomputed statement totals, threshold, and the per-row rate/calculation /
discrepancy fields. The backend verifies that the statement belongs to the
source ID and that rows match the stored statement, then writes the supplied
values to the existing `audits` and `discrepancies` tables in one transaction.

Example body:

```json
{
  "statementId": 54,
  "sourceFileId": "google-drive-file-id",
  "threshold": "0.00",
  "totalExpected": "400.00",
  "totalActual": "300.00",
  "totalDifference": "100.00",
  "results": [
    {
      "trackName": "Test Track",
      "eligibleUnits": "100000",
      "territory": "NG",
      "tier": null,
      "actualPayout": "300.00",
      "rate": "0.004000",
      "expectedPayout": "400.00",
      "difference": "100.00",
      "shortfall": "100.00",
      "isDiscrepancy": true
    }
  ]
}
```

Repeated requests update the same audit and discrepancy rows. Unique keys on
`statements.source_file_id`, `audits.statement_id`, and
`discrepancies(audit_id, royalty_row_id)` prevent duplicate persistent records.
New/replayed valid writes return `200`; unknown statement/source pairs return
`404`; mismatched stored rows return `409`; invalid payloads return `400`.

The primary n8n path must call this endpoint after its threshold result. It
must not call either `/run-audit` endpoint to compute financial values.

Where n8n needs to notify the backend, use dedicated webhook endpoints such as:

```text
POST /api/webhooks/n8n/statement-processed
POST /api/webhooks/n8n/audit-completed
POST /api/webhooks/n8n/dispute-updated
```

Webhook requests must include the `X-N8N-Webhook-Secret` header matching the
server's `N8N_WEBHOOK_SECRET`. Reject missing configuration, missing headers,
and invalid values with `401`.

## 9. Status Codes

- `200` successful read/action
- `201` created
- `202` accepted for asynchronous processing
- `400` invalid request
- `401` unauthenticated
- `403` unauthorized
- `404` not found
- `409` conflict/duplicate
- `422` validation failure
- `429` rate limited
- `500` internal error
- `502/503` external dependency failure

## 10. Validation

Use a schema-validation library in the backend.

Never trust:
- IDs from the client.
- File metadata.
- Money values.
- AI-generated fields.
- Webhook payloads.

## 11. Pagination

Collection endpoints should use:

```text
?page=1&limit=20
```

Response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

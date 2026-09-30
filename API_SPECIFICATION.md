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

Requires JWT authentication and an owned statement. Runs the deterministic
backend audit, persists the audit and discrepancies, and returns `200` with the
audit and detected discrepancies. Repeated runs update the same audit and
replace its generated discrepancy rows. A statement with no royalty rows, an
invalid period, or any row without an applicable rate returns `422` and marks
the audit failed; the response includes the audit and a reason. A statement
that does not belong to the user returns `404`.

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
User **explicitly** triggers send after reviewing the draft. The backend sends
the dispute to the configured `N8N_DISPUTE_SEND_WEBHOOK_URL` with the
`X-N8N-Webhook-Secret` header. A successful n8n response marks the dispute
`sent`; a failed request leaves it as `draft`. If sending is not configured,
the endpoint returns `503`. Only drafts can be sent; repeat sends return
`409`. The outbound payload contains `idempotencyKey: "dispute-<id>"` so n8n
can safely deduplicate delivery retries.

### POST /api/disputes/:id/send

User **explicitly** triggers send after reviewing the draft. Backend coordinates email (e.g. n8n/Gmail). Must not send without this action.

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

# RoyaltyGuard n8n Workflow

This document describes the user-provided 18-node workflow JSON export. Its
node names and connections are the source of truth here; this README does not
describe the other workflow JSON files in this directory.

The export contains two independent entry paths that meet only at
**Final Audit Summary**:

1. A Google Drive CSV audit path.
2. An authenticated webhook path for sending a saved dispute and then sending
   an escalation email after a wait.

The owner reports that this workflow has passed an end-to-end test. This
documentation update does not repeat that test.

## Statement audit path

The audit path is connected as follows:

```text
Google Drive Trigger
-> Download File
-> Extract From File
-> AI Agent - Normalize
-> Normalize Royalty Data
-> HTTP Request
-> Expand Rate Requests
-> Rate Extraction
-> Calculate Royalty Leakage
-> IF Leakage
   true  -> Backend - Persist Audit (Draft Handoff) -> Final Audit Summary
   false -> Final Audit Summary
```

**Gemini Chat Model** is connected to **AI Agent - Normalize** as its language
model; it is not a sequential step in the main path.

### Node responsibilities and data movement

1. **Google Drive Trigger** polls every minute for one specifically selected
   file. It is not configured as a folder trigger.
2. **Download File** downloads its configured Drive file to binary property
   `data`. The trigger and download nodes have separate file selections in the
   export; confirm that they point to the intended same file before enabling
   the workflow.
3. **Extract From File** reads CSV with a comma delimiter, a header row, and
   BOM handling. This workflow does not support PDF statements.
4. **AI Agent - Normalize** uses **Gemini Chat Model** to map each CSV row to
   `trackName`, integer `plays`, `territory`, optional `tier`, and the original
   `actualPayout` text. The prompt forbids inventing fields or calculating
   rates, payouts, differences, shortfalls, or discrepancy status.
5. **Normalize Royalty Data** validates the file and row data after CSV
   extraction and Gemini normalization, before anything is sent to the
   backend:
   - Rejects PDFs and all non-CSV files.
   - Resolves platform from Drive `appProperties.platform`, then
     `ROYALTYGUARD_PLATFORM`, then recognized filename patterns. Known names
     include Spotify, Apple Music, YouTube Music, Amazon Music, and Audiomack.
   - Resolves statement period from Drive `appProperties.statementPeriod`,
     then `ROYALTYGUARD_STATEMENT_PERIOD`, then a supported year/quarter or
     year/month date in the filename.
   - Accepts `trackName`, `track_name`, `track`, or `title` for track;
     `eligibleUnits`, `eligible_units`, `plays`, `streams`, or `units` for
     units; `territory`, `country`, or `countryCode` for territory; and
     `actualPayout`, `actual_payout`, `payout`, or `royalty` for payout.
     Requires non-negative integer units and a non-negative payout with at
     most two decimal places. Non-empty tier-specific values stop for manual
     review.
   - Requires the AI row count to match the extracted CSV and compares each
     normalized value with the corresponding source row. It stops if required
     values are missing or AI output differs from the CSV.
   - Adds source metadata including the Drive file ID, filename, MIME type,
     link, and available timestamps. It does not look up the Drive parent
     folder.

Because this validation node runs after **Extract From File** and
**AI Agent - Normalize**, unsupported inputs may fail in those earlier nodes
before the explicit PDF/non-CSV validation message is reached.
6. **HTTP Request** posts the normalized statement and rows, including source
   metadata, to `POST /api/webhooks/n8n/statements`. The backend returns a
   `statementId`; **Expand Rate Requests** validates it and creates one rate
   request per royalty row.
7. **Rate Extraction** sends a GET request to the configured rate endpoint once per row with
   platform, territory, blank tier, and statement period. It sends
   `X-N8N-Webhook-Secret`. The endpoint returns the applicable rate; the
   workflow does not ask Gemini to determine rates.
8. **Calculate Royalty Leakage** uses integer/`BigInt` decimal arithmetic,
   computes expected payout from eligible units and the returned rate, rounds
   to cents, and compares expected payout with actual payout. It applies
   `ROYALTYGUARD_DISCREPANCY_THRESHOLD` (default `0.00`) and labels a positive
   over-threshold difference as a *potential discrepancy for review*.
9. **IF Leakage** branches on that calculated result. The true branch posts
   the n8n-produced audit results to
   `POST /api/webhooks/n8n/audit-results` through **Backend - Persist Audit
   (Draft Handoff)**. The false branch goes directly to the summary. Therefore
   this export only calls the audit-results persistence endpoint when a
   potential discrepancy is found; the statement and rows have already been
   submitted through the statement endpoint.
10. **Final Audit Summary** reports the audit totals, discrepancy count, and
    next step. For a potential discrepancy, the user opens it in RoyaltyGuard,
    generates and reviews the backend dispute draft, and then uses the
    separate send path below.

The backend endpoints are authenticated with the shared webhook secret. The
backend remains responsible for storage and persistence; the n8n Code node is
the primary deterministic calculation path for this workflow.

## Separate dispute email and escalation path

This path is not automatically started by the Drive audit branch. It begins
when the backend calls the authenticated n8n webhook:

```text
Webhook - Approved Dispute Send
-> Gmail - Dispute
-> Respond - Send Receipt
-> Wait - 1 Minute
-> Gmail - Escalation
-> Final Audit Summary
```

- **Webhook - Approved Dispute Send** accepts `POST
  /webhook/royaltyguard-multiplatform-approved-send` using the configured
  Header Auth credential.
- **Gmail - Dispute** sends the `recipient`, `subject`, and `body` from the
  incoming `body.dispute` payload.
- **Respond - Send Receipt** returns a JSON receipt with the dispute and
  idempotency identifiers, Gmail message/thread IDs when present, and send
  time. The response is sent before the downstream wait and escalation.
- **Wait - 1 Minute** is configured with `amount: 30` and no explicit unit in
  the supplied JSON. Verify/set the intended delay in the imported workflow.
- **Gmail - Escalation** sends a separate escalation email after the wait.
  There is **no automated reply detection and no approval gate**: the workflow
  does not inspect the Gmail thread and the escalation send follows the wait
  directly.
- The escalation node has a fixed recipient in the export. Its value is
  intentionally not reproduced here. Set an approved, controlled recipient
  in n8n before using this path. `ROYALTYGUARD_ESCALATION_APPROVER_EMAIL` is
  read by **Final Audit Summary** for a summary field; it does not configure
  the recipient used by **Gmail - Escalation**.

The webhook branch uses the dispute payload as provided; there is no separate
validation node in this export. The intended caller is the backend's eligible
dispute-send path, which must be configured to use the same webhook path and
Header Auth secret.

## Configuration and credentials

Configure values in the appropriate n8n or backend environment. Do not put
secrets in this README or in workflow expressions as literal values.

| Setting | Used for |
|---|---|
| `ROYALTYGUARD_BACKEND_URL` | Backend origin; defaults to `http://localhost:5000`. |
| `N8N_WEBHOOK_SECRET` | Shared secret sent as `X-N8N-Webhook-Secret` to the backend statement, rate, and audit endpoints. |
| `ROYALTYGUARD_RATE_API_URL` | Optional full rate endpoint URL; defaults to the backend `/api/webhooks/n8n/royalty-rate` endpoint. |
| `ROYALTYGUARD_DISCREPANCY_THRESHOLD` | Audit threshold; defaults to `0.00`. |
| `ROYALTYGUARD_PLATFORM` | Fallback platform when Drive metadata and filename do not supply one. |
| `ROYALTYGUARD_STATEMENT_PERIOD` | Fallback statement period when Drive metadata and filename do not supply one. |
| `N8N_STATEMENT_ARTIST_ID` | Backend `.env` setting that selects the artist for statement intake. This export does not implement folder-based artist identification. |
| `N8N_BASE_URL` | Backend `.env` setting for the n8n origin used by backend dispute delivery. |
| `N8N_DISPUTE_WEBHOOK_PATH` | Backend `.env` setting; use `/webhook/royaltyguard-multiplatform-approved-send` for this export. |
| `N8N_WEBHOOK_HEADER_NAME` | Backend `.env` setting for the Header Auth header name configured on the n8n webhook. |

Select or create these n8n credentials after import:

- **Google Drive account** (`Google Drive OAuth2 API`) for the trigger and
  download nodes.
- **Google Gemini(PaLM) Api account** for **Gemini Chat Model**.
- **RoyaltyGuard Webhook Secret** (Header Auth) for
  **Webhook - Approved Dispute Send**. Its configured header and secret must
  match the backend `N8N_WEBHOOK_HEADER_NAME` and `N8N_WEBHOOK_SECRET`.
- **Gmail account** (`Gmail OAuth2`) for both Gmail nodes.

The JSON contains credential references and file selections, not reusable
credentials. Re-select credentials in the target n8n instance; never copy
credential IDs or secret values into source control.

## Limitations and remaining setup

- The trigger watches a specifically selected Drive file, not a folder. The
  download node has its own file selection; align it with the intended input.
- Artist association is still controlled by backend `N8N_STATEMENT_ARTIST_ID`.
  The workflow does not fetch a parent-folder ID or map folders to artists.
- PDF files and non-empty rate tiers stop for manual review.
- Only the potential-discrepancy branch calls the audit-results endpoint.
- The dispute path sends an escalation email after its wait without checking
  for a reply or requesting approval.
- Configure the fixed escalation recipient, verify the wait duration, assign
  credentials, and align backend/n8n webhook settings before using a new n8n
  instance.
- Confirm that the target database has the existing migrations required by
  statement source metadata and idempotency. Importing the workflow does not
  apply database migrations.
- The supplied JSON does not specify a workflow activation state. Confirm the
  desired activation state in n8n after setup.

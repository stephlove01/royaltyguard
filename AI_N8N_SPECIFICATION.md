# RoyaltyGuard — AI & n8n Workflow Specification

Capstone demo: simulated platform CSV statements, fictional rates in MySQL, no live streaming APIs, no payment processing.

## 1. Purpose

n8n coordinates **ingestion and automation** (extract, normalize orchestration, AI drafting, email after approval).

The **backend** owns deterministic royalty calculation and discrepancy detection. The backend and database remain the system of record.

## 2. Main Workflow

```text
Trigger
  ↓
Get Statement
  ↓
Extract Data
  ↓
Validate Structure
  ↓
Normalize Data
  ↓
HTTP → Backend (rate lookup, audit, calculate, compare)
  ↓
IF Discrepancy
  ├── No → Complete Audit
  └── Yes
        ↓
      AI → Generate Dispute Draft (optional)
        ↓
      HTTP → Save Draft (status: draft)
        ↓
      Await User Review & Explicit Send (backend API)
        ↓
      Gmail → Send (after approval only)
        ↓
      Track Response
        ↓
      Follow Up
        ↓
      Escalate if Needed
```

## 3. Trigger

**MVP trigger:** backend notifies n8n after statement upload (e.g. webhook URL configured in environment).

Statements are **fictional CSV files** representing simulated platforms (Spotify, Apple Music, YouTube Music, Audiomack)—see `sample-data/`.

Google Drive triggers are **out of MVP scope** (future enhancement).

The trigger must create an idempotent processing record.

## 4. Extraction

For CSV:
- Parse rows directly.

PDF support is a **post-MVP** extension; capstone focuses on CSV.

## 5. AI Extraction Schema

Example:

```json
{
  "platform": "demo_platform",
  "statementPeriod": "2026-Q1",
  "tracks": [
    {
      "trackName": "Example Track",
      "plays": 100000,
      "territory": "NG",
      "actualPayout": 300
    }
  ]
}
```

AI output must be parsed and schema-validated.

## 6. Normalization

Normalize:
- column names
- dates
- currency
- numeric values
- platform names
- territory codes
- track identifiers

Canonical schema must be documented and stable.

## 7. Royalty Rate Lookup

n8n calls the **backend** (which reads demo rates from MySQL). Do not hard-code rates in n8n workflows as authoritative values.

Example demo platform rates (seed data only): Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002.

Do not present demo rates as real contractual platform rates.

## 8. Deterministic Calculation

**Must run in the backend**, not in an n8n Code node and not in an LLM.

```text
expected = eligibleUnits × rate
difference = expected - actual
```

n8n invokes backend audit endpoints and persists results via API. LLMs must never independently calculate financial results.

## 9. Discrepancy Rule

Example configurable rule:

```text
IF difference > threshold
THEN discrepancy = true
ELSE discrepancy = false
```

Threshold must be configuration, not hidden inside an AI prompt.

## 10. AI Dispute Draft

AI receives verified evidence such as:
- statement period
- platform
- affected tracks
- expected amount
- reported amount
- difference
- calculation inputs
- source/rate reference

AI generates:
- subject
- professional body
- requested review/action

AI must not invent facts.

## 11. Email

Gmail sends the dispute **only after** the user reviews the draft and explicitly triggers send (backend coordinates n8n/Gmail).

Record:
- recipient
- subject
- body
- sent timestamp
- message/reference ID if available

## 12. Follow-Up

After the configured waiting period:
- Search for a response.
- If response exists, update dispute.
- If no response, create follow-up.
- If still unresolved, notify/escalate.

For development, use a short test delay rather than 30 real days.

## 13. Webhook Security (MVP)

Inbound webhooks from n8n to the backend must include a **shared secret** (e.g. `X-Webhook-Secret` header matching `N8N_WEBHOOK_SECRET`). Reject requests with missing or invalid secrets.

Keep this mechanism simple and documented for capstone reviewers.

## 14. Error Handling

Each major step should define:
- Validation failure.
- Retry behavior.
- Logging.
- Recovery behavior.
- Duplicate-event handling.

## 15. AI Safety Rules

AI must not:
- invent rates.
- invent missing transaction data.
- alter verified financial values.
- decide whether a legal claim is valid.
- silently overwrite source data.

AI may:
- extract.
- classify.
- normalize with validation.
- summarize.
- draft correspondence.

## 16. n8n Node Naming

Use descriptive names:

```text
Webhook - Statement Uploaded
HTTP - Get Statement
Extract - Parse CSV Statement
AI - Extract Royalty Data (optional)
HTTP - Submit Normalized Rows
HTTP - Run Backend Audit
IF - Discrepancy Threshold (from backend response)
AI - Draft Dispute
HTTP - Save Dispute Draft
Wait - User Send (or HTTP triggered after POST .../send)
Gmail - Send Dispute
Wait - Follow Up
Gmail - Search Response
IF - Response Found
```

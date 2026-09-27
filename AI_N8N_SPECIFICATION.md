# RoyaltyGuard — AI & n8n Workflow Specification

## 1. Purpose

n8n coordinates external integrations and asynchronous automation.

The backend and database remain the core application/system of record.

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
Get Royalty Rate
  ↓
Calculate Expected Royalty
  ↓
Compare Actual vs Expected
  ↓
IF Discrepancy
  ├── No → Complete Audit
  └── Yes
        ↓
      Generate Dispute Draft
        ↓
      Save Draft
        ↓
      Send Email / Await Approval
        ↓
      Track Response
        ↓
      Follow Up
        ↓
      Escalate if Needed
```

## 3. Trigger

Possible MVP trigger:
- Backend webhook after statement upload.

Alternative:
- Google Drive trigger when a statement is placed in a configured folder.

The selected trigger must create an idempotent processing record.

## 4. Extraction

For CSV:
- Parse rows directly.

For PDF:
- Extract text/table content.
- Send only required structured content to the AI extraction step.
- Validate output.

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

The workflow calls the configured rate source.

Required output:

```json
{
  "rate": 0.004,
  "currency": "USD",
  "source": "configured_demo_rate_source"
}
```

The system must record the source and effective date.

Do not present demo/mock rates as real contractual platform rates.

## 8. Deterministic Calculation

Use a Code node or backend calculation service.

```text
expected = eligibleUnits × rate
difference = expected - actual
```

The calculation must be reproducible.

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

Gmail sends the approved dispute.

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

## 13. Error Handling

Each major step should define:
- Validation failure.
- Retry behavior.
- Logging.
- Recovery behavior.
- Duplicate-event handling.

## 14. AI Safety Rules

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

## 15. n8n Node Naming

Use descriptive names:

```text
Webhook - Statement Uploaded
HTTP - Get Statement
Extract - Parse Statement
AI - Extract Royalty Data
Code - Validate & Normalize
HTTP - Get Royalty Rate
Code - Calculate Expected Royalty
IF - Discrepancy Threshold
AI - Draft Dispute
HTTP - Save Dispute
Gmail - Send Dispute
Wait - Follow Up
Gmail - Search Response
IF - Response Found
```

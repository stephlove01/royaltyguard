# RoyaltyGuard — AI & n8n Workflow Specification

Capstone demo: fictional statements and values, no payment processing, and no
live streaming-platform APIs.

## 1. Responsibilities

- **n8n** owns primary statement extraction, rate retrieval, deterministic
  royalty calculation, discrepancy-threshold decisions, and later workflow
  orchestration.
- **Backend** owns authentication, users/artists, statement metadata and row
  persistence, frontend APIs, and persistence of n8n-produced audit results.
- Existing backend audit/calculation services remain available for API support,
  regression testing, and future fallback. The primary n8n workflow does not
  call them to calculate royalties.
- **AI** may extract, map, classify, summarize, and draft. It must not invent
  rates, calculate expected payouts, calculate shortfalls, or decide whether a
  financial discrepancy exists.
- **MySQL** remains the system of record for application and persisted audit
  data. n8n is the primary audit-computation path, not the data store.

## 2. Primary Audit Workflow

```text
Google Drive Trigger
  ↓
Get / Download Statement File
  ↓
Prepare Statement Metadata → Validate Supported CSV
  ↓
Extract From File
  ↓
Advanced AI Extract (Information Extractor) + configured Chat Model
  ↓
Prepare Canonical Data
  ↓
HTTP - Submit Statement / Rows to Backend (inputs only)
  ↓
Expand Rows For Rate Retrieval
  ↓
HTTP Request - Get Royalty Rate
  ↓
Code - Calculate Expected Payout (deterministic)
  ↓
IF - Above Threshold?
  ├── true  → Discrepancy Detected
  └── false → No Discrepancy
  ↓
Code - Package Audit Persistence Payload
  ↓
HTTP - Persist Audit Results to Backend
  ├── success → Audit Result Persisted
  └── exhausted retries → Code - Stop On HTTP Error
```

The primary workflow must not call `POST /api/statements/:id/run-audit` or
`POST /api/webhooks/n8n/statements/:id/run-audit` for royalty math. The existing
backend audit API is retained for backend/API support and regression tests.

TASK-067 persists the n8n-produced per-row audit results and totals through
`POST /api/webhooks/n8n/audit-results`. The packaging node only aggregates
already-calculated row outputs; the backend stores submitted values in
existing audit/discrepancy tables and does not recalculate them.

## 3. Google Drive Trigger and CSV

The workflow starts with the installed Google Drive Trigger, watches the
configured statement folder, downloads the file, preserves Drive metadata, and
uses **Extract From File** for CSV parsing. PDF extraction is not in this
workflow phase.

Required configuration:
- `ROYALTYGUARD_STATEMENTS_FOLDER_ID`
- n8n credential `Google Drive OAuth2 API`
- `ROYALTYGUARD_PLATFORM` and `ROYALTYGUARD_STATEMENT_PERIOD` when these values
  are not available in the Drive file's app properties

## 4. AI Extraction Node

The current local n8n 2.33.6 installation does not expose a node named
“Advanced AI Extract.” The closest supported built-in is
**Information Extractor**, type
`@n8n/n8n-nodes-langchain.informationExtractor`, version `1.2`. It uses the
manual JSON Schema mode and emits structured values in `json.output`. It
requires a connected AI Language Model node and configured provider credential.

The installed `@n8n/n8n-nodes-langchain` package is version `2.33.2` with n8n
2.33.6. Information Extractor 1.2 accepts `schemaType: "manual"` and an
`inputSchema` JSON Schema; its installed converter supports nested arrays,
nullable fields, required fields, and closed objects. Extract From File emits
one item per CSV row, and the extractor returns one structured result per input
item. Each result therefore wraps exactly one source record in `rows`.

## 5. Canonical Schema

Statement context:

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
  ]
}
```

Use the existing canonical contract: `trackName`, `eligibleUnits`,
`territory`, `tier`, and `actualPayout`; do not create a competing schema.
Source aliases include `track_name`, `plays`, `streams`, and
`actual_payout`. Unit and money values remain non-negative decimal strings;
territory is normalized uppercase. `platform` and `statementPeriod` are
statement-level fields. The extractor's intermediate schema uses `plays` as a
JSON number as required by TASK-071; after deterministic validation, the
canonical preparation node takes plays and all other row values from the
original CSV and maps plays to the existing `eligibleUnits` string. This is
not an API or backend schema change.

## 6. Backend Statement/Row Intake

After canonical validation, n8n may call
`POST /api/webhooks/n8n/statements` with `X-N8N-Webhook-Secret`. This stores
statement metadata and source rows under the backend-configured demo artist;
it does not calculate rates or audit results. This endpoint is an input
intake/persistence boundary, not the primary financial engine.

## 7. Rate Retrieval Boundary

The primary n8n path uses **HTTP Request - Get Royalty Rate**. Configure
`ROYALTYGUARD_RATE_API_URL` as the full endpoint URL. Its local default is
`/api/webhooks/n8n/royalty-rate`, a secret-protected backend rate-data adapter
that reuses `royaltyRateService` and the seeded demo-rate table. The request
sends:
- `platform`
- `territory`
- `tier` (empty when absent)
- `statementPeriod`

The endpoint returns an applicable non-negative decimal rate, for example:

```json
{
  "rate": "0.004000",
  "source": "configured-provider",
  "effectiveFrom": "2026-01-01"
}
```

The current local adapter is explicitly a demo-rate source, not a claim about
official platform rates. `X-N8N-Webhook-Secret` comes from
`$env.N8N_WEBHOOK_SECRET`; no secret is embedded in JSON. A future public
provider can replace the configurable URL. Missing, malformed, or out-of-period
rates must stop processing rather than default to zero.

The current rate endpoint uses the seeded Spotify/Apple Music/YouTube
Music/Audiomack rows in MySQL as an explicit local demo adapter. It returns
rate data only; n8n remains responsible for all payout/discrepancy math.

## 8. Deterministic n8n Calculation

**Code - Calculate Expected Payout** performs all financial arithmetic from
validated canonical values and the HTTP response. It uses integer cents and
integer-scaled rates, rounds expected payout half up to two decimal places, and
emits structured fields including:

`statementId`, `sourceMetadata`, `platform`, `statementPeriod`, `trackName`,
`eligibleUnits`, `territory`, `tier`, `actualPayout`, `rate`,
`expectedPayout`, `difference`, `shortfall`, `threshold`, and `isDiscrepancy`.

```text
expectedPayout = eligibleUnits × rate
difference = expectedPayout - actualPayout
shortfall = max(difference, 0)
isDiscrepancy = difference > threshold
```

Use `ROYALTYGUARD_DISCREPANCY_THRESHOLD` (default `0.00`). The IF node branches
only on the Code node's `isDiscrepancy` result. Never implement this math in an
LLM, and do not invoke the backend audit-calculation endpoint afterward.

## 9. Later Dispute Automation

TASK-073/074 define a future Gemini dispute-draft prompt contract, but do not
add the AI Agent node, Gmail send, Wait node, follow-up, or escalation. The
future draft may use only verified persisted discrepancy/audit fields and
existing artist/account identity data. Sending remains behind explicit user
approval as defined by the backend dispute API.

## 10. Webhook Security

Backend webhook requests require `X-N8N-Webhook-Secret` matching
`N8N_WEBHOOK_SECRET`. The value must come from n8n environment/credential
configuration and must never appear in exported workflow JSON.

## 11. Retry, Error, and Idempotency Behavior

HTTP submission, rate lookup, and audit-result persistence use bounded
three-attempt retries. Exhausted errors route to **Code - Stop On HTTP Error**,
which fails the execution; they cannot flow into later dispute actions.

`sourceFileId` is the idempotency key. Statement intake reuses the existing
statement for a replay; unique database keys enforce one statement source,
one audit per statement, and one discrepancy per audit/royalty row. Replaying
the result endpoint updates those records rather than creating duplicates.

## 12. Gemini Extraction Contract (TASK-071/072)

The Advanced AI Extract node uses this closed JSON Schema in its existing
manual-schema configuration:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "rows": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "trackName": { "type": "string" },
          "plays": { "type": "integer", "minimum": 0 },
          "territory": { "type": "string" },
          "tier": { "type": ["string", "null"] },
          "actualPayout": { "type": "string" }
        },
        "required": ["trackName", "plays", "territory", "actualPayout"]
      }
    }
  },
  "required": ["rows"]
}
```

Each Information Extractor result must contain exactly one row because its
input is one original CSV row. `Validate AI Output Against CSV` checks the
output count, wrapper and row shape, required values, numeric plays, exact
source payout, source track and territory, optional tier, and unsupported
fields. It maps each AI item to its corresponding source item, so duplicate,
missing, extra, or changed rows fail before canonical preparation, rate lookup,
or calculation. Financial fields are never repaired from Gemini output.
`Prepare Canonical Data` then uses the original CSV values, not AI values, for
all canonical row fields. The validator is covered by deterministic tests
that execute the JavaScript stored in the workflow export.

## 13. Future Dispute Draft Prompt (TASK-073/074)

The future Gemini dispute-generation Agent must receive only verified,
persisted audit/discrepancy data and artist/account identity fields already
stored by the application. Available verified fields may include audit,
discrepancy, and statement identifiers; platform; statement period; territory;
track name; plays; actual payout; expected payout; difference; shortfall;
discrepancy status; and existing artist/account identity. Only values already
present in persisted records may be supplied. The prompt input should
distinguish `verifiedFacts`, `inferences`, and `unknownInformation`; only
`verifiedFacts` may be stated as facts. An inference must not be presented as a
fact. Unknown or unavailable values must be omitted or explicitly represented
as unavailable, never fabricated.

Prompt contract:

```text
Write a professional, factual royalty-discrepancy message using only the
supplied verified facts. Identify the platform, statement period, territory,
and track when supplied. Explain the persisted discrepancy and request an
investigation, reconciliation, or payment correction where appropriate.

Do not make threats, accusations, legal conclusions, or unsupported claims.
Do not invent or infer rates, contracts, payment dates, contractual
obligations, distributor policies, intentional underpayment, legal violations,
previous correspondence, account/reference numbers, territories, tiers,
financial values, tax information, or currency conversions. Do not calculate,
round, or modify plays, actual payout, expected payout, difference, shortfall,
or any rate. Omit unavailable details rather than filling them in.

Return only this JSON object:
{"subject":"string","body":"string","facts_used":[],"missing_information":[]}
`facts_used` must list supplied verified field paths used in the draft;
`missing_information` may list requested context that was unavailable. The
body is a draft only and requires user review and explicit approval before
send.
```

Expected output shape:

```json
{
  "subject": "string",
  "body": "string",
  "facts_used": [],
  "missing_information": []
}
```

The future implementation must retain the originating audit and discrepancy
record identifiers with the draft and its supplied fact paths so every claim
can be traced to persisted evidence. No dispute Agent, send node, or API
contract is added by TASK-071 through TASK-074.
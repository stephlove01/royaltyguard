# RoyaltyGuard

**AI-Powered Music Royalty Audit & Dispute System (Capstone Demo)**

RoyaltyGuard is a full-stack **demonstration** application for reviewing
fictional royalty statements, calculating expected royalties, detecting
discrepancies, and managing dispute follow-up. It does **not** process real
payments or connect to live streaming APIs.

## Capstone Notice

All artists, tracks, rates, statements, and payment figures are **demo/fake
data** for education and demonstration. Demo rates are **not** official
platform payout rates.

## Architecture

```text
React Frontend
      ↓
Node + Express Backend  ← authentication, APIs & persistence
      ↓
MySQL  (statements, rows, audits, discrepancies)
      ↕
n8n Automation
   ├── Google Drive ingestion
   ├── AI extraction / drafting
   ├── HTTP rate provider → n8n Code calculation → threshold branch
   └── Backend APIs (statement input and calculated-result persistence)
```

The backend owns application data and persistence. The primary n8n audit
retrieves applicable rates through a configured HTTP provider, performs
deterministic calculation and discrepancy thresholding in a Code node, and
returns the result for backend persistence. Existing backend calculation
services remain for API support and regression tests; the primary n8n path does
not call them for royalty math. AI may extract fields or draft text, but never
calculates financial results. Local filesystem storage remains available for
the MVP.

## Core Workflow

```text
Google Drive statement (CSV)
   ↓
Google Drive Trigger → Download → Extract From File
   ↓
Information Extractor → canonical rows
   ↓
Backend statement / row intake
   ↓
HTTP rate retrieval → n8n Code calculation → threshold branch
   ↓
Backend audit-result persistence (TASK-067)
   ↓
Dashboard / later user-reviewed dispute workflow
```

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Node.js
- Express
- MySQL
- n8n
- AI/LLM for extraction and drafting only
- Gmail after user approval

## Sample Data

Fictional CSVs under `sample-data/` (Spotify, Apple Music, YouTube Music, and
Audiomack) simulate platform statements.

## Documentation

See `PRD.md`, `SYSTEM_ARCHITECTURE.md`, `TECHNICAL_SPECIFICATION.md`,
`DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `AI_N8N_SPECIFICATION.md`,
`UI_UX_SPECIFICATION.md`, `IMPLEMENTATION.md`, `TESTING.md`, `DECISIONS.md`,
`AGENTS.md`, and `TASKS.md`.

## Local Development

Install Node.js, npm, MySQL, n8n, and Git. Create environment files from
`.env.example`; never commit secrets.

## Engineering Principle

**One workflow at a time.** Financial calculations are deterministic and run
in the primary n8n Code node. Backend calculation services remain available
for non-primary support and testing.

## Project Status

Capstone MVP is under development. See `TASKS.md` for the canonical
implementation checklist.
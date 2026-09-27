# RoyaltyGuard

**AI-Powered Music Royalty Audit & Dispute System (Capstone Demo)**

RoyaltyGuard is a full-stack **demonstration** application that automates reviewing **fictional** royalty statements, calculating expected royalties, detecting discrepancies, and managing dispute follow-up. It does **not** process real payments or connect to live streaming APIs.

## Capstone Notice

All artists, tracks, rates, statements, and payment figures are **demo/fake data** for education and demonstration. Demo rates are **not** official platform payout rates.

## Architecture

```text
React Frontend
      ↓
Node + Express Backend  ← deterministic audit & royalty math
      ↓
MySQL  (demo rates, statements, audits)
      ↕
n8n Automation
   ├── AI (extract / draft)
   ├── Gmail (after user approves send)
   └── Backend API (normalization, audit, persist)
```

Local filesystem stores uploaded statement files for MVP. Google Drive may be added later as an optional enhancement.

## Core Workflow

```text
Simulated Platform Statement (CSV)
   ↓
n8n ingestion
   ↓
Normalize
   ↓
Backend Audit Engine
   ↓
Royalty Calculation (backend)
   ↓
Discrepancy Detection
   ↓
Dashboard / Dispute draft (AI optional)
   ↓
User review → explicit send
   ↓
Email (n8n/Gmail)
   ↓
Follow-up / Escalation
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
- AI/LLM
- Gmail

## Sample Data (planned)

Fictional CSVs under `sample-data/` (e.g. Spotify, Apple Music, YouTube Music, Audiomack) simulate platform statements—small and easy to explain in a capstone demo.

## Project Structure

```text
royaltyguard/
├── frontend/
├── backend/
├── n8n/
├── database/
├── sample-data/
├── docs/
├── PRD.md
├── SYSTEM_ARCHITECTURE.md
├── TECHNICAL_SPECIFICATION.md
├── DATABASE_DESIGN.md
├── API_SPECIFICATION.md
├── AI_N8N_SPECIFICATION.md
├── UI_UX_SPECIFICATION.md
├── IMPLEMENTATION.md
├── TESTING.md
├── DECISIONS.md
├── AGENTS.md
├── TASKS.md
└── README.md
```

## Documentation

| Document | Purpose |
|---|---|
| PRD.md | Product requirements |
| SYSTEM_ARCHITECTURE.md | Architecture and data flow |
| TECHNICAL_SPECIFICATION.md | Technical implementation rules |
| DATABASE_DESIGN.md | MySQL schema |
| API_SPECIFICATION.md | REST API contracts |
| AI_N8N_SPECIFICATION.md | AI and n8n workflows |
| UI_UX_SPECIFICATION.md | Frontend behavior |
| IMPLEMENTATION.md | Build roadmap |
| TESTING.md | Testing strategy |
| DECISIONS.md | Architecture decisions |
| AGENTS.md | AI coding-agent rules |
| TASKS.md | Execution checklist |

## Local Development

### Prerequisites

Install:
- Node.js
- npm
- MySQL
- n8n
- Git

### Environment

Create environment files from `.env.example`.

Never commit secrets.

## Development Order

Follow:

```text
Documentation
 → Database
 → Backend
 → Frontend
 → Audit Engine
 → n8n
 → AI
 → Disputes
 → Testing
 → Deployment
```

## Engineering Principle

**One workflow at a time.**

Build → test → break → fix → improve.

## Important Rule

Financial calculations are deterministic.

AI assists with extraction and language generation, but verified royalty inputs and financial calculations must remain under explicit application control.

## Project Status

Capstone MVP is under development (documentation foundation complete; implementation in progress).

See `TASKS.md` for the canonical implementation checklist.

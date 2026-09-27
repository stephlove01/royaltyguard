# RoyaltyGuard

**AI-Powered Music Royalty Audit & Dispute System**

RoyaltyGuard is a full-stack application that automates the process of reviewing royalty statements, calculating expected royalties, detecting potential discrepancies and managing dispute follow-up.

## Architecture

```text
React Frontend
      ↓
Node + Express Backend
      ↓
MySQL
      ↕
n8n Automation
   ├── AI
   ├── Google Drive
   ├── Gmail
   └── Royalty Rate Source
```

## Core Workflow

```text
Statement
   ↓
Extract
   ↓
Normalize
   ↓
Rate Lookup
   ↓
Calculate
   ↓
Compare
   ↓
Discrepancy
   ↓
Dispute
   ↓
Email
   ↓
Follow-up
   ↓
Escalation
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
- Google Drive

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

MVP is under development.

See `TASKS.md` for the current implementation checklist.

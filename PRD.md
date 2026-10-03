# RoyaltyGuard — Product Requirements Document (PRD)

## 0. Capstone Scope

RoyaltyGuard is a **capstone / demo** music royalty auditing system. It uses **fictional** artists, songs, streaming activity, royalty rates, statements, reported payments, expected payments, discrepancies, and disputes for demonstration and learning.

The system **does not** process real payments, move money, or connect to live streaming-platform payout APIs. All monetary figures shown in the product are **demo values** for audit comparison only—not official platform rates or real financial transactions.

## 1. Product Overview

**RoyaltyGuard** is an AI-powered music royalty audit and dispute management system (demo/capstone).

The system helps artists and their teams:
1. Upload or receive royalty statements.
2. Extract and normalize royalty data.
3. Apply a configured royalty-rate source.
4. Calculate expected royalties deterministically.
5. Compare expected royalties with reported payouts.
6. Detect discrepancies.
7. Generate dispute correspondence.
8. Send disputes through email.
9. Track responses and follow up automatically.
10. Escalate unresolved disputes.

## 2. Problem Statement

Royalty statements can contain large amounts of transaction and usage data. Manual review is time-consuming and can make it difficult to consistently identify underpayments and track disputes.

RoyaltyGuard provides a structured workflow for ingestion, audit, discrepancy detection, dispute generation, and follow-up.

## 3. Target Users

### Primary
- Independent artists
- Artist managers
- Music business administrators
- Small royalty/accounting teams

### Secondary
- Record-label operations teams
- Rights administrators
- Royalty auditors

## 4. Goals

- Reduce manual royalty statement review.
- Make royalty calculations reproducible and auditable.
- Surface potentially material discrepancies.
- Centralize audit and dispute status.
- Automate repetitive communication and follow-up.
- Provide clear evidence for each discrepancy.

## 5. Non-Goals for MVP

- Processing real payments or integrating payment gateways (Paystack, Flutterwave, Stripe, bank transfers, etc.).
- Integrating with live Spotify, Apple Music, YouTube Music, Audiomack, or other streaming APIs.
- Becoming a payment processor.
- Replacing legal counsel.
- Guaranteeing that a detected discrepancy is contractually recoverable.
- Supporting every streaming platform format.
- Automatically determining contractual royalty terms without configured source data.
- Performing financial calculations with an LLM.

## 6. Core User Journey

```text
Upload Statement
      ↓
Extract Data
      ↓
Normalize Data
      ↓
Apply Royalty Rate
      ↓
Calculate Expected Royalty
      ↓
Compare With Actual Payout
      ↓
Detect Discrepancy
      ↓
Generate Dispute
      ↓
Review / Send
      ↓
Track Response
      ↓
Follow Up / Escalate
```

## 7. Functional Requirements

### FR-01 Statement Management
Users can upload a royalty statement and view its processing status.

### FR-02 Data Extraction
The system can extract relevant fields from supported statement formats.

### FR-03 Normalization
Different source formats are transformed into a canonical RoyaltyGuard schema.

### FR-04 Royalty Rate Management
The system stores or retrieves the applicable royalty-rate data used for an audit.

### FR-05 Deterministic Calculation
The primary n8n audit calculates expected royalty in a deterministic Code node using canonical statement values and the rate returned by the configured rate provider. Existing backend calculation services may remain for API support and regression tests but are not called by the primary n8n path.

### FR-06 Discrepancy Detection
The n8n workflow compares expected and actual payouts and applies the configured threshold before branching. AI does not calculate or decide financial results.

### FR-07 Dispute Generation
The system may generate a draft dispute from verified, persisted audit and
discrepancy data, identifying the relevant statement period, platform, track,
and supported calculations. The draft must not invent missing facts, rates,
contract terms, or legal conclusions and must remain subject to user review.

### FR-08 Email Delivery
After the user **reviews** a dispute draft and **explicitly triggers send**, the system can send the dispute email (e.g. via n8n/Gmail automation).

### FR-09 Follow-Up
The system tracks the follow-up date and can initiate a follow-up workflow.

### FR-10 Audit History
Users can inspect the inputs, calculations, results and status of an audit.

## 8. Non-Functional Requirements

- **Security:** secrets must remain server-side and out of source control.
- **Reliability:** failed automation should be retryable.
- **Auditability:** calculations must be reproducible from stored inputs.
- **Performance:** normal dashboard/API operations should be responsive for MVP-scale data.
- **Maintainability:** frontend, backend, database and n8n responsibilities remain separated.
- **Extensibility:** statement formats and royalty-rate sources can be added without redesigning the entire system.

## 9. MVP Acceptance Criteria

An MVP is acceptable when a test statement can be:

1. Uploaded.
2. Stored.
3. Parsed into canonical records.
4. Audited with deterministic calculations.
5. Compared against actual payout.
6. Flagged when a configured discrepancy threshold is exceeded.
7. Used to generate a dispute draft.
8. Sent through the configured email integration.
9. Tracked in the dashboard.
10. Followed up through n8n.

## 10. Success Metrics

- Statement processing success rate.
- Extraction accuracy on the supported test format.
- Audit calculation correctness.
- Number of discrepancies correctly detected.
- Time from upload to completed audit.
- Dispute generation success rate.
- Follow-up workflow completion rate.

## 11. Assumptions

- Streaming platforms (Spotify, Apple Music, YouTube Music, Audiomack, etc.) are **simulated data sources** represented by small fictional CSV statements in `sample-data/`.
- The primary n8n audit retrieves rates through a configured HTTP rate-data API; its local adapter uses seeded MySQL demo rates. These rates are **not** official platform payout rates.
- The initial MVP uses controlled fictional sample data.
- Email is available through Gmail or another supported provider.
- n8n is responsible for extraction, rate retrieval, deterministic audit calculation, discrepancy decisions, and later automation; the backend and database remain the application system of record.

## 12. Risks

- Statement formats vary significantly.
- Royalty calculations may depend on contracts and territory-specific rules.
- Rate data may change.
- AI extraction may produce incorrect fields.
- External APIs may fail.
- Email delivery may fail or be delayed.

## 13. MVP Scope Recommendation

Start with:
- Fictional CSV statements per simulated platform (e.g. `spotify_statement.csv`, `apple_music_statement.csv`, `youtube_music_statement.csv`, `audiomack_statement.csv` under `sample-data/`).
- Demo royalty rates in MySQL (example demo values: Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002—labeled as demo only).
- n8n-owned deterministic calculation and discrepancy detection using an explicitly configured rate-provider endpoint.
- One discrepancy threshold rule.
- n8n for ingestion orchestration, AI-assisted extraction/drafting where useful, and email after user-approved send.
- Simple auth: email, password (hashed), JWT.
- Local filesystem statement storage.
- Gmail (or test email) for dispute delivery demo.
- React dashboard, Node/Express API, MySQL.

**Payment model (demo):** compare reported royalty from a statement vs calculated expected royalty (e.g. expected ₦1,250, reported ₦900, difference ₦350 → discrepancy). No real money movement.

Expand to PDFs, Google Drive sync, advanced contract rules, and richer analytics after the core capstone pipeline is reliable.

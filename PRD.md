# RoyaltyGuard — Product Requirements Document (PRD)

## 1. Product Overview

**RoyaltyGuard** is an AI-powered music royalty audit and dispute management system.

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
The system calculates expected royalty using explicit formulas and stored inputs.

### FR-06 Discrepancy Detection
The system compares expected and actual values and flags differences according to configurable rules.

### FR-07 Dispute Generation
The system generates a draft dispute containing the relevant statement period, tracks, calculations, discrepancy and supporting details.

### FR-08 Email Delivery
The system can send an approved dispute email.

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

- Royalty-rate inputs are available from an approved/configured source.
- The initial MVP uses controlled sample data.
- Email is available through Gmail or another supported provider.
- n8n is responsible for workflow orchestration, not the primary system of record.

## 12. Risks

- Statement formats vary significantly.
- Royalty calculations may depend on contracts and territory-specific rules.
- Rate data may change.
- AI extraction may produce incorrect fields.
- External APIs may fail.
- Email delivery may fail or be delayed.

## 13. MVP Scope Recommendation

Start with:
- CSV statements.
- One controlled royalty-rate source.
- One calculation model.
- One discrepancy rule.
- Gmail.
- One n8n workflow.
- React dashboard.
- Node/Express API.
- MySQL database.

Expand to PDFs, multiple providers, advanced contract rules and richer analytics after the core pipeline is reliable.

# RoyaltyGuard — Testing Strategy

Tests use **fictional** statements, rates, and amounts from `sample-data/` and database seeds. Verify the system does not treat demo rates as real platform payouts and does not perform real payment processing.

## 1. Testing Pyramid

```text
          E2E
       Integration
     API / Workflow
         Unit
```

## 2. Unit Tests

Test:
- royalty calculation
- rounding
- discrepancy threshold
- normalization
- validation
- status transitions

Example:

```text
100000 × 0.004 = 400
400 - 300 = 100
```

## 3. API Tests

Test:
- registration and login (JWT)
- protected routes without token (401)
- n8n webhooks without or with wrong shared secret (401/403)
- statement creation
- statement retrieval
- audit retrieval
- discrepancy retrieval
- dispute creation
- dispute sending
- invalid IDs
- invalid payloads
- authentication failures

## 4. Database Integration Tests

Verify:
- foreign keys
- uniqueness
- cascade behavior where intentionally configured
- decimal precision
- migration correctness

## 5. n8n Tests

Test:
- successful workflow
- invalid statement
- missing rate
- AI extraction failure
- API failure
- duplicate trigger
- email failure
- follow-up path
- escalation path

## 6. E2E Test

Primary happy path (e.g. fictional `sample-data/spotify_statement.csv`):

```text
Login
 → Upload simulated platform CSV
 → n8n ingestion
 → Backend audit on dashboard
 → Detect discrepancy
 → AI dispute draft (optional)
 → User review
 → User explicitly sends
 → Track status
```

## 7. Financial Test Cases

At minimum:
- exact match
- underpayment
- overpayment
- zero plays
- zero actual payout
- missing rate
- invalid negative values
- decimal values
- threshold exactly equal to difference
- difference below threshold

## 8. AI Tests

Verify:
- required fields are returned
- invalid outputs are rejected
- AI does not invent missing values
- AI does not alter verified calculations or compute royalty totals independently
- malformed JSON is handled

## 8.1 Out of Scope for Tests

- Payment gateway integration
- Live streaming platform APIs
- Real money movement

## 9. Definition of Test Success

A test should have:
- input
- expected output
- actual output
- pass/fail result
- reproducible setup

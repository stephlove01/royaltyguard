# RoyaltyGuard — Testing Strategy

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

Primary happy path:

```text
Upload CSV
 → Process
 → Audit
 → Detect discrepancy
 → Generate dispute
 → Review
 → Send
 → Track
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
- AI does not alter verified calculations
- malformed JSON is handled

## 9. Definition of Test Success

A test should have:
- input
- expected output
- actual output
- pass/fail result
- reproducible setup

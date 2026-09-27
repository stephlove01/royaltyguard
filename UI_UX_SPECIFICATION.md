# RoyaltyGuard — UI/UX Specification

## 1. UX Goal

Provide a clear workflow from statement upload to audit result and dispute tracking.

The interface should prioritize:
- clarity
- evidence
- status
- actionability
- responsive design
- accessibility

## 2. Routes

```text
/login
/dashboard
/statements
/statements/:id
/audits
/audits/:id
/discrepancies
/discrepancies/:id
/disputes
/disputes/:id
/settings
```

## 3. Dashboard

Display:
- total statements
- statements processing
- completed audits
- open discrepancies
- active disputes
- follow-ups due

## 4. Statement Page

Features:
- Upload statement.
- Select platform.
- Select statement period.
- View processing status.
- View extracted rows.
- View validation errors.

## 5. Audit Page

Show:
- statement information
- total expected
- total actual
- total difference
- number of discrepancies
- calculation evidence
- processing timeline

## 6. Discrepancy Page

Show:
- track
- plays/eligible units
- rate
- expected amount
- actual amount
- difference
- threshold
- status
- supporting statement reference

## 7. Dispute Page

Show:
- recipient
- subject
- draft body
- evidence
- send status
- sent date
- response status
- follow-up date

## 8. UI States

Every asynchronous operation should support:
- loading
- success
- empty
- validation error
- server error
- retry

## 9. Components

Suggested reusable components:
- AppShell
- Sidebar
- Header
- StatCard
- DataTable
- StatusBadge
- UploadDropzone
- AuditSummary
- DiscrepancyTable
- DisputeEditor
- ConfirmationModal
- Toast
- EmptyState
- ErrorState

## 10. Accessibility

- Keyboard navigable.
- Visible focus state.
- Form labels.
- Sufficient contrast.
- Semantic HTML.
- Accessible status messages.
- Do not rely on color alone for status.

## 11. Responsive Design

Support:
- desktop
- tablet
- mobile

Tables should have a responsive strategy such as horizontal scrolling or mobile cards.

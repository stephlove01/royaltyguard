# RoyaltyGuard — Database Design

All monetary amounts and rates in seed/demo data are **fictional** for the capstone demo.

## 1. Database

**Database:** MySQL

The database is the persistent system of record for RoyaltyGuard.

## 2. Core Relationships

```text
User
  │
  └── Artist
        │
        └── Statement
              │
              └── Track/Royalty Row
                    │
                    └── Audit
                          │
                          └── Discrepancy
                                │
                                └── Dispute
```

## 3. Core Tables

### users

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| email | VARCHAR | Unique |
| password_hash | VARCHAR | Required for capstone JWT auth |
| name | VARCHAR | User name |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### artists

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users |
| name | VARCHAR | Artist name |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### statements

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| artist_id | BIGINT | FK |
| platform | VARCHAR | Simulated source (e.g. Spotify, Apple Music, YouTube Music, Audiomack) |
| file_name | VARCHAR | Original file name |
| file_type | VARCHAR | csv/pdf/etc. |
| statement_period | VARCHAR | Period represented |
| storage_location | TEXT | Local filesystem path (MVP) |
| status | VARCHAR | Processing status |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### royalty_rows

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| statement_id | BIGINT | FK |
| track_name | VARCHAR | Track |
| plays | BIGINT | Eligible units |
| territory | VARCHAR | Territory |
| tier | VARCHAR | Optional |
| actual_payout | DECIMAL | Reported royalty from statement (demo) |
| created_at | DATETIME | Required |

### royalty_rates

Stores **configurable demo rates** for capstone audits (not official platform payout rates).

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| platform | VARCHAR | Simulated platform name |
| territory | VARCHAR | Optional territory |
| rate | DECIMAL | Demo rate (e.g. Spotify 0.004) |
| currency | VARCHAR | Currency |
| effective_from | DATE | Start |
| effective_to | DATE | Optional end |
| source | VARCHAR | e.g. `demo_seed` |
| created_at | DATETIME | Required |

Suggested demo seed values: Spotify 0.004, Apple Music 0.006, YouTube Music 0.003, Audiomack 0.002.

### audits

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| statement_id | BIGINT | FK |
| status | VARCHAR | pending/completed/failed |
| total_expected | DECIMAL | Expected |
| total_actual | DECIMAL | Actual |
| total_difference | DECIMAL | Difference |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

### discrepancies

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| audit_id | BIGINT | FK |
| royalty_row_id | BIGINT | FK |
| expected_amount | DECIMAL | Expected |
| actual_amount | DECIMAL | Actual |
| difference | DECIMAL | Difference |
| threshold | DECIMAL | Applied threshold |
| status | VARCHAR | Open/resolved/etc. |
| created_at | DATETIME | Required |

### disputes

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | PK |
| discrepancy_id | BIGINT | FK |
| recipient | VARCHAR | Recipient |
| subject | VARCHAR | Email subject |
| body | TEXT | Draft/sent content |
| status | VARCHAR | Draft/sent/responded/escalated |
| sent_at | DATETIME | Optional |
| response_at | DATETIME | Optional |
| follow_up_at | DATETIME | Optional |
| created_at | DATETIME | Required |
| updated_at | DATETIME | Required |

## 4. Constraints

- Foreign keys must be enforced.
- Emails should be unique where appropriate.
- Monetary fields use DECIMAL.
- Required relationships must not be nullable.
- Status fields should use controlled values.
- Add indexes to common lookup fields.

## 5. Important Indexes

Suggested:
- `users.email`
- `artists.user_id`
- `statements.artist_id`
- `statements.status`
- `royalty_rows.statement_id`
- `audits.statement_id`
- `discrepancies.audit_id`
- `discrepancies.status`
- `disputes.status`
- `disputes.follow_up_at`

## 6. Migration Policy

Schema changes must be versioned through migrations.

Do not manually change production tables without recording the migration.

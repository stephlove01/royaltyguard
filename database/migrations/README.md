# RoyaltyGuard Database Migrations

Database migrations define the structure of the RoyaltyGuard MySQL database.

## Migration Naming

Migrations use sequential numbering:

- `001_create_users.sql`
- `002_create_artists.sql`
- `003_create_statements.sql`
- `009_add_statement_source_metadata.sql`
- `010_add_n8n_result_idempotency.sql`
- `012_add_amazon_music_demo_rate.sql`

## Rules

1. Create migrations in sequential order.
2. Each migration should have one clear database purpose.
3. Do not modify an existing migration after it has been applied.
4. Test migrations against the local `royaltyguard` database.
5. Keep database structure changes documented in migration files.

Migration 010 adds the n8n source-file key and unique audit/discrepancy keys.
When backfilling an existing repeated Drive file ID, only the earliest
statement receives the key; existing statement rows are not deleted.

Migration 012 inserts the fictional Amazon Music demo rate. Apply it on an
existing database with:

```sql
SOURCE database/migrations/012_add_amazon_music_demo_rate.sql;
```

Or from the MySQL client:

```bash
mysql -u <user> -p royaltyguard < database/migrations/012_add_amazon_music_demo_rate.sql
```

Do not re-run earlier numbered migrations. The seed file
`database/seeds/001_seed_demo_royalty_rates.sql` is also idempotent and includes
the same Amazon Music row for new setups.

## Database

Development database:

`royaltyguard`
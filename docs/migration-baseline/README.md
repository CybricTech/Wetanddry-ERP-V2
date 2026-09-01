# Migration baseline

**Status as of 2026-09-01: step 1 of 2 done.** `prisma/migrations/0_init` exists and is
committed. The database bookkeeping has **not** been changed. `prisma migrate dev` is still
broken. See "Finishing the baseline" below.

## The problem

This project was ported from SQLite to PostgreSQL, and the pre-port migrations were never
rewritten. Nine of the fourteen files under `prisma/migrations/` contain SQLite-only SQL:

| Construct | Occurrences | PostgreSQL equivalent |
|---|---|---|
| `DATETIME` | 64 | `TIMESTAMP(3)` |
| `REAL` | 25 | `DOUBLE PRECISION` |
| `PRAGMA foreign_keys` / `defer_foreign_keys` | 12 | no equivalent; must be removed |

PostgreSQL rejects all of these. Two consequences:

1. **`prisma migrate dev` fails for any schema change**, repo-wide. It builds a shadow database
   by replaying every migration from scratch, and dies on the first file with
   `ERROR: type "datetime" does not exist` (Prisma error P3006).
2. **There is no working path from source control to a database.** `prisma migrate deploy`
   against an empty instance fails on migration 1 of 14. Until `0_init` was added, the schema
   existed only inside the live Neon instance — a new staging environment, a new developer's
   machine, or recovery from a Neon incident all required cloning production.

## Why the old migrations are not worth repairing

Every one of the fourteen rows in `_prisma_migrations` has `applied_steps_count = 0`. That
means each was *baselined* — marked as applied without ever being executed. **None of that
SQLite SQL has ever run against this PostgreSQL database.** The live schema was created by
`db push` or an equivalent, not by these files.

So the files do not record how this database was built. They describe a construction that never
happened — `20251209173256_add_recipe_fields`, for instance, drops a `Part.lifespan` column that
the current schema has no trace of. Porting them faithfully would reproduce fiction in valid
syntax.

## What is here

- **`prisma/migrations/0_init/migration.sql`** — generated with
  `prisma migrate diff --from-empty --to-schema-datamodel`. 43 tables, 64 indexes, 44 foreign
  keys, zero SQLite constructs. This is the first artifact in the project that can build the
  schema from nothing.
- **`_prisma_migrations.backup.json`** — all 14 bookkeeping rows as they stood on 2026-09-01,
  with their checksums. The rollback artifact for the step below.

`0_init` currently shows as *not yet applied*, because the bookkeeping still lists the fourteen
old migrations instead. Nothing runs it automatically: the build script is
`prisma generate && next build`, and no CI runs `migrate deploy`.

**To rebuild the schema from scratch today** (new staging, local instance, recovery):

```bash
npx prisma db execute --file prisma/migrations/0_init/migration.sql --schema prisma/schema.prisma
```

## Finishing the baseline

This step was deliberately left for a human: it deletes rows from Prisma's bookkeeping table on
a live production database. It touches **no application tables and no data** — only Prisma's
record of which migrations it believes it has run.

```sql
-- 1. Remove the fourteen fictional records. Targeted by name on purpose: a blanket
--    DELETE would also remove any row added concurrently by other work.
DELETE FROM "_prisma_migrations"
WHERE migration_name IN (
  '20251203211625_init_fleet_module',
  '20251203212050_init_inventory_module',
  '20251203212204_init_production_module',
  '20251203212356_init_fuel_module_retry_2',
  '20251203212558_init_exception_module_retry_2',
  '20251203213104_init_user_module_final',
  '20251209173256_add_recipe_fields',
  '20251209180330_link_recipe_to_inventory',
  '20251210100413_init_rbac',
  '20251212093500_add_notification_system',
  '20260517230000_add_custom_inventory_categories',
  '20260814120000_add_staff_exit_banking_nok',
  '20260817120000_repairs_and_approval_workflows',
  '20260831120000_maintenance_edit_approvals'
);
```

Then, from the repo:

```bash
# 2. Delete the fourteen now-unreferenced folders (0_init and migration_lock.toml stay).
# 3. Record the baseline as applied, without executing it.
npx prisma migrate resolve --applied 0_init

# 4. Verify. This builds a shadow database by replaying 0_init - which IS the
#    from-scratch rebuild - and is the proof the repair worked.
npx prisma migrate dev
#    Expected: "Already in sync, no schema change or pending migration was found."
npx prisma migrate status
#    Expected: "Database schema is up to date!"
```

**Rollback**, if step 4 does not behave: re-insert the rows from
`_prisma_migrations.backup.json` and `git checkout` the deleted folders. Application data is
untouched throughout, so there is nothing else to restore.

## Until then

`prisma migrate dev` does not work. Apply a schema change with the three-step dance instead —
this is how `20260831120000_maintenance_edit_approvals` was applied:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql

npx prisma db execute --file prisma/migrations/<timestamp>_<name>/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied <timestamp>_<name>
```

# Migrations

`schema.sql` is migration 001 (the initial schema). Future schema changes go in this folder as
numbered SQL files (`002_add_xyz.sql`, `003_...sql`). Apply them in order on the live database
**after taking a backup** (see README, "Backup and restore"). Each file must be idempotent
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` on MariaDB, or guarded checks on MySQL).

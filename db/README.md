# SQL references

These files describe the legacy SQLite schema and demonstration data. The application creates and migrates its schema through `internal/database` and seeds an empty database with random credentials in `internal/database/seed.go`.

The schema files include `DROP TABLE` statements, and `seed_users.sql` contains historical demonstration password hashes. Use them only with a disposable database when inspecting the old schema. They are not the deployment initialization path or the source of current default credentials. Keep existing production databases under the application's migration flow.

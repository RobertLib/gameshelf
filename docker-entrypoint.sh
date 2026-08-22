#!/bin/sh
# Migrations run when the container starts, not at build time - the schema has to
# be reconciled with the database in the volume, which the build never sees.
# The platform and genre lookup tables are filled by the application itself
# (CatalogSeederService).
set -e

echo "-> Applying database migrations…"
npx prisma migrate deploy --schema prisma/schema.prisma

echo "-> Starting GameShelf…"
exec "$@"

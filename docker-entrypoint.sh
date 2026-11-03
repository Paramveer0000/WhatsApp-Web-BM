#!/bin/sh
set -e

# Run Prisma schema push if running main app container
if [ "$1" = "npm" ] && [ "$2" = "start" ]; then
  echo "==> [Dokploy Startup] Ensuring database tables are synced..."
  npx prisma db push --skip-generate || true

  echo "==> [Dokploy Startup] Running database seeds (default admin & settings)..."
  npx tsx prisma/seed.ts || true
fi

echo "==> Executing command: $@"
exec "$@"


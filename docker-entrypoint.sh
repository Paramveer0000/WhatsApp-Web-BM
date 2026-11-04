#!/bin/sh
set -e

# Crucial: If app_data volume is mounted over /app/prisma, it contains an outdated schema.prisma from previous runs!
# Always overwrite /app/prisma/schema.prisma with the fresh schema from /app/prisma-dist
if [ -d "/app/prisma-dist" ]; then
  echo "==> [Dokploy Startup] Refreshing schema.prisma from container image..."
  cp -f /app/prisma-dist/schema.prisma /app/prisma/schema.prisma || true
  cp -f /app/prisma-dist/seed.ts /app/prisma/seed.ts 2>/dev/null || true
fi

# Run schema sync and seeding when starting the web application (avoids concurrent SQLite push collisions with worker)
if [ "$1" = "npm" ] && [ "$2" = "start" ]; then
  echo "==> [Dokploy Startup] Ensuring database tables are synced..."
  npx prisma db push --accept-data-loss --skip-generate || true
  echo "==> [Dokploy Startup] Running database seeds (default admin & settings)..."
  npx tsx prisma/seed.ts || true
fi

echo "==> Executing command: $@"
exec "$@"

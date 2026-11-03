FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Safe build-time environment variables (ensures build succeeds even if no env vars set in Dokploy UI)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/tmp/build-temp.db"
ENV APP_SECRET="dokploy-build-time-fallback-secret-32-chars!"
ENV JWT_SECRET="dokploy-build-time-fallback-jwt-secret!"

RUN npx prisma generate
RUN npx prisma db push --skip-generate
RUN npx next build
RUN rm -f /tmp/build-temp.db*

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Default environment fallbacks (zero-configuration out of the box)
ENV DATABASE_URL="file:/app/prisma/prod.db"
ENV APP_SECRET="default-fallback-app-secret-32-chars-long!"
ENV JWT_SECRET="default-fallback-jwt-secret-secure-random!"
ENV REDIS_URL="redis://127.0.0.1:6379"
ENV EVOLUTION_API_URL="http://evolution:8080"
ENV GLOBAL_API_KEY="429683C4C97741"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Prepare application and data directories with proper permissions
RUN mkdir -p /app/data /app/prisma && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]

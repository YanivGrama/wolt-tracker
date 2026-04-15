# Wolt Tracker – Railway deployment image
# Base: Microsoft Playwright image (ships Chromium + system deps pre-installed)
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

# Install Bun (we keep Bun as the runtime per project conventions)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:${PATH}"
ENV NODE_ENV=production
# Reuse the Chromium already installed in the Playwright image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Install dependencies (leverages layer caching)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source
COPY server.ts tsconfig.json index.html tracker.html ./
COPY src ./src
COPY frontend ./frontend
COPY public ./public

# Logs are mounted from a Railway volume at runtime (persistent JSONL store)
RUN mkdir -p /app/logs

EXPOSE 3000

CMD ["bun", "run", "server.ts"]

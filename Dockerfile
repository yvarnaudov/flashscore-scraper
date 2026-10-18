# Image tag must match the "playwright" version in package-lock.json,
# since the browsers are preinstalled in /ms-playwright for that exact version.
FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production

# Output files are written here; mount a volume to keep them.
VOLUME /app/src/data

ENTRYPOINT ["node", "src/index.js"]
# Docker has no display, so always run headless.
CMD ["headless=true"]

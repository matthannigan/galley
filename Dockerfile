FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN apk add --no-cache su-exec tzdata
RUN addgroup -S galley && adduser -S galley -G galley
WORKDIR /app
COPY --from=build --chown=galley:galley /app/node_modules ./node_modules
COPY --chown=galley:galley package.json ./
COPY --chown=galley:galley src/ ./src/
COPY --chown=galley:galley docs/sample.html ./docs/
COPY docker-entrypoint.sh /usr/local/bin/
ENV NODE_ENV=production
ENV GALLEY_DOCS_DIR=/data/docs
ENV GALLEY_BACKUP_DIR=/data/backups
EXPOSE 3000
HEALTHCHECK CMD wget -q --spider http://localhost:3000/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]

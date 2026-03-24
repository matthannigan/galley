FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN addgroup -S galley && adduser -S galley -G galley
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
ENV NODE_ENV=production
ENV GALLEY_DOCS_DIR=/docs
EXPOSE 3000
HEALTHCHECK CMD wget -q --spider http://localhost:3000/health || exit 1
USER galley
CMD ["node", "src/index.js"]

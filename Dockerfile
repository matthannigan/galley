FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN addgroup -S galley && adduser -S galley -G galley
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY src/ ./src/
USER galley
EXPOSE 3000
CMD ["node", "src/index.js"]

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Galley?

Galley is a lightweight, self-hosted HTML document editor for collaborative text editing. It serves HTML files from a directory, injects inline editing capabilities via `contenteditable`, and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

The name comes from *galley proof* — the near-final version of a document handed to an editor for text corrections before press.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Start dev server (watches for changes)
npm run dev

# Start production server
npm start

# Run all tests
npm test

# Run a single test file
npx jest path/to/test.js

# Lint
npm run lint

# Build Docker image
docker build -t galley .

# Run via Docker (mount documents directory)
docker run -p 3000:3000 -v /path/to/html/files:/docs galley

# Run via Docker Compose
docker compose up
```

## Architecture

- **Server:** Node.js (ESM) with Express, no database — filesystem only
- **Client:** Vanilla JavaScript injected into served documents, no framework
- **`src/app.js`** exports a `createApp(docsDir, options)` factory function — keeps config explicit and enables test isolation
- **`src/index.js`** reads env vars (`PORT`, `GALLEY_DOCS_DIR`, `GALLEY_BACKUP_DIR`) and starts the server
- **`src/injector.js`** reads `galley-client.js` and `galley-styles.css`, assembles and caches the injection payload, inserts it into served HTML between `<!-- galley:start -->` / `<!-- galley:end -->` markers
- **`src/galley-client.js`** is the client-side editing script (IIFE, vanilla JS) — element detection, contenteditable activation, paste interception, structure guard, save logic, and browser extension artifact cleanup
- **`src/galley-styles.css`** provides hover/focus editing indicators and save UI styles, scoped under `@media not print`
- **Tests:** Jest + supertest; tests create their own app via `createApp(fixturesDir)` pointing at `tests/fixtures/`. Client-side tests use `@jest-environment jsdom`.

### Routes
- `GET /` — file picker listing all `.html` files in the documents directory
- `GET /edit/:filename` — serves the HTML file with injected editing script and styles
- `GET /health` — health check
- `POST /save/:filename` — receives full document HTML, creates a timestamped backup in `.galley-backups/`, atomically writes the updated file

### Key Constraints
- **Save outputs must be clean:** No injected scripts, editing UI, or tool artifacts in saved files. Output must be structurally identical to input, differing only in text content. Browser extension artifacts (Grammarly, etc.) are stripped before save.
- **Editing is text-only:** No structural changes. No rich text formatting toolbar in v1.
- **Paste is plain text only:** All paste events intercepted and stripped to plain text.
- **Backups:** Before overwriting, create a timestamped backup in `.galley-backups/` (configurable via `GALLEY_BACKUP_DIR`).
- **No auth in v1:** Access control handled at the network layer (Cloudflare tunnel).
- **Default port:** 3000
- **Path traversal protection** on `/edit/:filename` and `/save/:filename` — rejects `..`, path separators, non-`.html` extensions

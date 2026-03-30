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
- **`src/index-page.js`** exports `extractTitle(html, filename)` and `renderIndexPage(files)` — generates the landing page HTML with sidebar and card grid
- **`src/injector.js`** reads `galley-client.js` and `galley-styles.css`, assembles and caches the injection payload, inserts it into served HTML between `<!-- galley:start -->` / `<!-- galley:end -->` markers
- **`src/galley-client.js`** is the client-side editing script (IIFE, vanilla JS) — element detection, contenteditable activation, paste interception, structure guard, save logic, and browser extension artifact cleanup
- **`src/galley-styles.css`** provides hover/focus editing indicators and save UI styles, scoped under `@media not print`
- **Tests:** Jest + supertest; tests create their own app via `createApp(fixturesDir)` pointing at `tests/fixtures/`. Client-side tests use `@jest-environment jsdom`.

### Routes
- `GET /` — landing page with sidebar and card grid showing all `.html` files with thumbnail previews
- `GET /edit/:filename` — serves the HTML file with injected editing script and styles
- `GET /preview/:filename` — serves the HTML file without editing injection (used for iframe thumbnails)
- `GET /download/:filename` — serves the HTML file as a browser download (`Content-Disposition: attachment`)
- `GET /status/:filename` — returns `{ lastModified }` JSON for polling
- `GET /health` — health check
- `POST /save/:filename` — receives full document HTML, creates a timestamped backup in `.galley-backups/`, atomically writes the updated file
- `POST /upload` — receives `{ filename, html }` JSON, creates or overwrites with backup

### Key Constraints
- **Save outputs must be clean:** No injected scripts, editing UI, or tool artifacts in saved files. Output must be structurally identical to input, differing only in text content. Browser extension artifacts (Grammarly, etc.) are stripped before save.
- **Editing is text-only:** No structural changes. Minimal formatting toolbar supports bold, italic, and link.
- **Paste defaults to plain text:** Ctrl+V strips formatting. Ctrl+Shift+V pastes with formatting (bold/italic/links only, everything else stripped).
- **Backups:** Before overwriting, create a timestamped backup in `.galley-backups/` (configurable via `GALLEY_BACKUP_DIR`).
- **No auth in v1:** Access control handled at the network layer (Cloudflare tunnel).
- **Default port:** 3000
- **Path traversal protection** on all `/:filename` routes — rejects `..`, path separators, non-`.html` extensions

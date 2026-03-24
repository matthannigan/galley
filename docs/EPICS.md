# Epics — Galley v1

Build order for reaching a working v1. Each epic produces a demoable increment. Requirements (R1–R15) reference `PRD.md`.

---

## Epic 1: Project Scaffolding

Set up the Node.js project, dev tooling, and a sample document for manual testing throughout development.

### Deliverables
- `package.json` with Express dependency, `dev` / `start` / `test` / `lint` scripts
- Express server skeleton listening on a configurable port (default 3000)
- Documents directory (`docs/`) with a sample HTML file containing embedded CSS, print styles, headings, paragraphs, lists, a table, and a `data-no-edit` element — exercises every editing scenario
- `.gitignore`, `Dockerfile` (minimal — just enough to not block Epic 6), `.dockerignore`
- Test harness (Jest + supertest) with a single smoke test proving the server starts and responds
- ESLint config (flat config, no framework plugins)

### Done when
- `npm install && npm run dev` starts a server on :3000
- `npm test` passes
- `npm run lint` passes with no errors

---

## Epic 2: Document Serving

Serve HTML files from the documents directory, rendered exactly as they would appear when opened as local files.

**Covers: R1, R2, R3**

### Deliverables
- `GET /edit/:filename` route that reads an HTML file from the configured documents directory and returns it with `Content-Type: text/html`
- Relative asset serving: static middleware serves images, fonts, and other assets from the same directory so relative paths in documents resolve correctly
- Path traversal protection: reject filenames containing `..`, absolute paths, or non-`.html` extensions
- No modification of the HTML at this stage — serve the raw file

### Done when
- Visiting `/edit/sample.html` renders the sample document identically to opening the file directly in the browser
- Embedded CSS, print media queries, and relative assets all work
- Attempting `/edit/../../etc/passwd` or `/edit/foo.js` returns 400/404
- Tests cover happy path and path traversal rejection

---

## Epic 3: File Picker

An index page listing all HTML files available for editing.

**Covers: R14, R15**

### Deliverables
- `GET /` returns a simple, self-contained HTML page (embedded CSS, no external dependencies)
- Lists all `.html` files in the documents directory
- Each entry shows filename and last-modified timestamp (human-readable)
- Each entry links to `/edit/:filename`
- Clean, minimal design — this is the only UI Galley owns (everything else is the user's document)

### Done when
- Adding/removing `.html` files in the documents directory is reflected on refresh
- Filenames and timestamps are accurate
- Clicking a filename opens the document in the edit view
- Tests cover directory listing and edge cases (empty directory, non-HTML files ignored)

---

## Epic 4: Editing Injection

The core feature: inject a client-side script into served documents that makes text elements editable in-place.

**Covers: R4, R5, R6, R7, R8, R9**

### Deliverables

#### Server-side injection
- Modify the `GET /edit/:filename` route to inject a `<script>` and `<style>` block before `</body>`
- The injected artifacts are clearly delimited with HTML comments (e.g., `<!-- galley:start -->` / `<!-- galley:end -->`) for reliable stripping later
- If the document has no `</body>` tag, append to the end

#### Client-side editing script (`galley-client.js`)
- **Element detection:** Query all editable tag types (`p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, `label`, `span`, `a`) — exclude any element (or descendant of an element) with `[data-no-edit]`
- **Activation:** Set `contenteditable="true"` on each detected element
- **Visual feedback:** On hover, show a subtle outline or background tint on editable elements. On focus, a slightly more visible indicator. All editing styles scoped under `@media not print` so they never appear in print
- **Paste interception:** Listen for `paste` events on editable elements. Prevent default, extract `text/plain` from the clipboard, insert at cursor position via `document.execCommand('insertText')` or the Selection API
- **Structure guard:** Listen for `keydown` and suppress Enter in elements where a newline would create a new block element (e.g., `p`, `h1`–`h6`). Allow Enter in `li` elements (creates new list items within the existing list — acceptable structural change within content editing norms)

### Done when
- Editable elements show hover/focus indicators
- Typing in a `<p>` changes its text
- Elements marked `data-no-edit` are not editable
- Pasting rich content from a webpage results in plain text only
- Pressing Enter in a `<p>` does not create a new paragraph
- The document's visual rendering is otherwise unchanged
- Tests cover injection (server-side) and element detection logic

---

## Epic 5: Save & Backup

Save edited documents back to disk with backups and a clean round-trip.

**Covers: R10, R11, R12, R13**

### Deliverables

#### Client-side save UI
- Floating save button: fixed position (bottom-right corner), outside the document flow, styled distinctly from document content, hidden via `@media print`
- Keyboard shortcut: `Ctrl+S` / `Cmd+S` triggers save (prevent default browser save dialog)
- On save: extract the full document HTML (`document.documentElement.outerHTML`), strip everything between `<!-- galley:start -->` and `<!-- galley:end -->` (inclusive), reconstruct the `<!DOCTYPE html>` declaration, POST to `/save/:filename`
- Save confirmation: brief toast/flash message on success ("Saved"), error message on failure
- Disable save button during in-flight request to prevent double-submit

#### Server-side save endpoint
- `POST /save/:filename` accepts `{ html: "..." }` (JSON body)
- Same path traversal protections as the edit route
- **Backup:** Before overwriting, copy the current file to a backups subdirectory (e.g., `.galley-backups/`) with a timestamped filename (e.g., `sample.2026-03-24T16-30-00.html`)
- **Atomic write:** Write to a temp file first, then rename into place — prevents corruption if the process is interrupted or two saves race
- Return 200 on success, 4xx/5xx with a JSON error message on failure

### Done when
- Editing text, clicking Save, then refreshing the page shows the updated text
- The saved file on disk contains no Galley artifacts (no injected script, style, or comments)
- The saved file is structurally identical to the original except for changed text content
- A backup exists in `.galley-backups/` with a timestamped name
- Rapidly clicking Save twice does not corrupt the file
- `Ctrl+S` triggers save instead of the browser save dialog
- Tests cover save round-trip, backup creation, atomic write, and path traversal

---

## Epic 6: Docker & Deployment

Package Galley for production use as a Docker container.

### Deliverables
- Multi-stage `Dockerfile`: build stage installs deps, production stage copies only what's needed, runs as non-root user
- `docker-compose.yml` example mounting a local directory and exposing port 3000
- Documents directory configurable via `GALLEY_DOCS_DIR` environment variable (default: `/docs` in container, `./docs` locally)
- Backups directory configurable via `GALLEY_BACKUP_DIR` environment variable (default: `.galley-backups/` inside the docs directory)
- `NODE_ENV=production` in container
- Health check endpoint (`GET /health`) returning 200

### Done when
- `docker compose up` starts Galley, serves documents from the mounted volume, and saves edits back to the host filesystem
- The container runs as non-root
- Environment variables override default paths
- Health check passes
- Full end-to-end workflow works: file picker → edit → save → verify file on host

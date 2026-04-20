# Changelog

All notable changes to Galley are documented here.

---

## Unreleased

**Remote delete (opt-in)**

- New hidden `/delete` page mirrors the index card grid but with red DELETE actions in the lower-right of each card, enabling remote file removal without shell access
- Clicking DELETE opens a styled confirmation page where the user must type `DELETE` to authorize the removal
- Deleted files are first copied to the backups directory (same naming and pruning policy as save backups), so removal is recoverable manually
- Disabled by default — enable with `GALLEY_DELETE_ENABLED=true` env var or `"deleteEnabled": true` in `config.json`; when disabled, all `/delete` routes return 404
- The browse page (`/`) is unchanged when the feature is enabled — `/delete` is intentionally hidden and not linked

---

## 0.4

Galley 0.4 adds static asset serving, a configuration file system, and a security audit with fixes — making it practical to use documents with locally referenced images and giving deployers more control over the application.

**Static asset serving**

- HTML documents can reference co-located images, fonts, CSS, and PDFs with relative paths — Galley serves them automatically from the docs directory
- Extension whitelist restricts served file types to safe formats: images (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.avif`), fonts (`.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`), stylesheets (`.css`), and documents (`.pdf`)
- Static assets are served with `Cache-Control: no-cache` — browsers revalidate on each request but get fast 304 responses for unchanged files
- Static files must be placed in the docs directory manually (e.g., SMB file copy, `scp`); the web upload interface remains intentionally restricted to `.html` files only

**Configuration file**

- New optional `config.json` loaded from the config directory (`GALLEY_CONFIG_DIR` env var, defaults to `./data/config/`)
- `allowedStaticExtensions` field lets deployers customize the static asset whitelist
- Fails silently when no config file exists — zero configuration required by default

**Security audit and fixes**

- **Fixed stored XSS:** the link toolbar (Ctrl+K) accepted arbitrary URLs including `javascript:`, while the paste sanitizer correctly rejected them — now both paths validate against the same `http:`/`https:`/`mailto:` allowlist
- **Security headers** on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`
- **Preview CSP:** `Content-Security-Policy: script-src 'none'` on the `/preview` route blocks script execution in document previews as defense-in-depth
- **Error message hardening:** 500 responses return generic messages instead of raw `err.message`, preventing filesystem path leakage
- **Backup retention:** configurable via `GALLEY_MAX_BACKUPS` (default 20), with automatic pruning of oldest backups per document
- **Content-Disposition hardening:** quote-escaped filenames in download headers

**Docker improvements**

- PUID/PGID support following the LinuxServer convention — the entrypoint remaps the container user to match host UID/GID for bind-mounted volumes
- Fixed entrypoint failure when the requested UID/GID already exists in the base image

**Other**

- Favicon for the Galley web interface

**What's not included (yet):**

- No authentication (use network-level access control)
- No real-time collaboration (polling-based conflict detection covers light concurrent use)
- No version history UI (timestamped backups remain on disk)

---

## 0.3

Galley 0.3 focuses on onboarding and discoverability — making the editor approachable for first-time users and easier to navigate for returning ones, without adding complexity to the editing experience itself.

**Landing page redesign**

- New index page with a sticky sidebar and responsive card grid layout
- Thumbnail previews of each document via iframe (new `GET /preview/:filename` route serves raw HTML without editing injection)
- Document titles extracted from `<title>` tags, with filenames and last-modified dates
- Documents sorted by most recently modified
- Multi-file upload from the landing page (page reloads after upload instead of redirecting to editor)
- Responsive layout collapses to single column on narrow screens
- Typography uses Google Fonts (Fraunces, Outfit, JetBrains Mono)

**Editor help panel**

- Floating `?` button in the bottom-left corner of the editing view (mirrors save button placement)
- Click to toggle a compact quick-reference panel with keyboard shortcuts, editing rules, block controls overview, and save/conflict behavior
- Keyboard shortcuts display `⌘` on Mac and `Ctrl` elsewhere
- Dismisses on click-outside or Escape
- Hidden in print output

**Interactive sample document**

- "Getting Started with Galley" replaces the generic sample document — an interactive user guide that teaches features by letting users practice on real content
- Includes embedded screenshots, keyboard shortcut reference table, and "Try it" prompts throughout
- Serves as a permanent reference that prints cleanly to PDF
- Supersedes the originally planned guided tour (Phase 5c), achieving the same onboarding goals without additional client-side code

**Docker improvements**

- Unified data directory layout: single `/data` mount with `docs/`, `backups/`, and `config/` subdirectories (replaces separate mount points and nested `.galley-backups`)
- New `docker-entrypoint.sh` runs as root to create subdirectories with correct ownership, then drops to the `galley` user via `su-exec` — fixes `EACCES` errors when saving to host-mounted volumes
- Sample document automatically seeded into an empty docs directory on first run

**What's not included (yet):**

- No authentication (use network-level access control)
- No real-time collaboration (polling-based conflict detection covers light concurrent use)
- No version history UI (timestamped backups remain on disk)
- No static asset serving for images referenced by relative paths (use external URLs or data URIs) — *added in 0.4*

---

## 0.2

Galley 0.2 adds file management, edit safety, rich text formatting, and block-level operations — four phases of features that make Galley a more complete editing environment while preserving its lightweight, structure-preserving design.

**What's new:**

**File management**

- Download HTML files directly from the file picker
- Upload .html files via the file picker (overwrites create backups automatically)
- Unsaved changes tracking: orange dot indicator on the save button, • title prefix, and browser navigation guard

**Edit safety**

- Element-level undo: Escape key reverts a focused element to its previous state (up to 20 snapshots per element), while browser-native Ctrl+Z continues to work for keystroke-level undo
- Save conflict detection: the server rejects stale saves when the file has changed on disk, with a banner offering Reload or Force Save
- Auto-reload polling: checks for external file changes every 5 seconds, silently reloads when clean or shows a banner when you have unsaved edits (pauses on hidden tabs)

**Rich text formatting**

- Floating toolbar appears on text selection with bold, italic, and link buttons
- Keyboard shortcuts: Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic), Ctrl/Cmd+K (link)
- Refined paste behavior: Ctrl+V pastes plain text; Ctrl+Shift+V pastes with sanitized formatting (bold, italic, and links only — everything else stripped)

**Block operations**

- Mark elements with data-galley-block to enable block-level controls
- Hover over a block to reveal a control strip: drag handle, duplicate, and remove
- Remove shows a 6-second undo toast for recovery
- Drag-and-drop reordering of blocks within the same parent via SortableJS
- Nested blocks target the innermost element

**Other improvements**

- New GET /status/:filename endpoint (returns file mtime for polling)
- New GET /download/:filename and POST /upload routes
- User guide and developer guide documentation
- All block and editing artifacts are stripped cleanly on save

**What's not included (yet):**

- No authentication (use network-level access control)
- No real-time collaboration (polling-based conflict detection covers light concurrent use)
- No version history UI (timestamped backups remain on disk)
- No onboarding or guided tour for new users

## 0.1 — Initial Release

A lightweight, self-hosted HTML document editor for collaborative text editing. Galley serves HTML files from a directory, makes text elements editable in the browser, and writes changes back to disk — preserving the document's structure, styling, and print layout exactly as authored.

**What works:**

- File picker listing all HTML documents in a directory
- Inline editing of text elements (`p`, headings, list items, table cells, `span`, `a`, and more) via `contenteditable`
- `data-no-edit` attribute to protect specific elements from editing
- Plain-text-only paste (rich content stripped automatically)
- Save via button or `Ctrl+S` / `Cmd+S` with visual confirmation
- Timestamped backups created automatically before each save
- Saved files are clean — no editing scripts, styles, or browser extension artifacts
- Editing UI hidden in print — documents print exactly as designed
- Docker support with configurable document and backup directories
- Health check endpoint at `/health`

**What's not included (yet):**

- No authentication (use network-level access control)
- No real-time collaboration or conflict resolution
- No rich text toolbar (bold, italic, links)
- No structural editing (adding/removing elements)
- No version history UI (backups are on disk)

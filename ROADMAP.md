# Galley Roadmap

This roadmap sequences feature work so that each phase builds foundation for what follows. The ordering is intentional — infrastructure built in earlier phases is reused by later features, reducing total effort and avoiding rework.

## Phase 1: File Management and Dirty Tracking ✓

*Completed 2026-03-29*

### 1a. Download ✓
Download button on the file picker serves raw HTML files as browser downloads (`Content-Disposition: attachment`).

### 1b. Upload ✓
File upload control accepts `.html` files. Overwrites create timestamped backups. Supports multi-file upload (Phase 5a); page reloads after upload to show new documents in the card grid.

### 1c. Unsaved Changes Tracking ✓
Dirty flag with save button indicator (orange dot), title prefix (`• `), and `beforeunload` navigation guard. Foundation for Phases 2–4.

## Phase 2: Edit Safety ✓

*Completed 2026-03-29*

### 2a. Undo ✓
Element-level snapshot stack (max 20 per element) captured on `focusin`. Escape key reverts to previous snapshot with multi-level support. Browser-native Ctrl+Z preserved for keystroke-level undo.

### 2b. Save Conflict Detection ✓
File mtime as version identifier. Client sends version with save; server returns 409 on mismatch. Banner with Reload and Force Save options.

### 2c. Auto-Reload Polling ✓
Polls `GET /status/:filename` every 5 seconds. Auto-reloads when clean; shows banner when dirty. Pauses on hidden tabs.

## Phase 3: Richer Text Editing ✓

*Completed 2026-03-29*

### 3a. Minimal Formatting Toolbar ✓
Floating toolbar on text selection with bold, italic, and link. Uses `document.execCommand`. Keyboard shortcuts (Ctrl/Cmd+B/I/K) work independently. Hidden in print.

### 3b. Paste Handling Refinement ✓
Ctrl+V pastes plain text. Ctrl+Shift+V pastes with formatting (bold/italic/links only, all else stripped via `sanitizePasteHtml`).

## Phase 4: Block Operations ✓

*Completed 2026-03-29*

### 4a. Block Duplicate and Remove ✓
`data-galley-block` attribute marks block-level content units. Floating control bar appears on hover with duplicate and remove. Remove shows undo toast (6-second recovery window). Controls target innermost block when nested.

### 4b. Block Reordering ✓
Drag-and-drop via vendored SortableJS. Per-block drag handle (`<button contenteditable="false">`) required for SortableJS handle support. Constrained to siblings within the same parent. Drag handle visually integrated with floating control bar as a unified strip (move, duplicate, remove).

## Phase 5: Onboarding and Discoverability

Phases 1–4 built a capable editing environment. Phase 5 shifts focus from functionality to usability — making the system approachable for first-time users and discoverable for returning ones, without compromising Galley's minimal aesthetic.

### 5a. Landing Page Refresh ✓

*Completed 2026-03-30*

Redesigned the index page with a sidebar + card gallery layout. Sidebar provides onboarding content (what Galley is, how editing works, backup/conflict info). Card grid shows thumbnail previews via iframe (`GET /preview/:filename` — raw HTML without editing injection), document titles extracted from `<title>` tags, filenames, and last-modified dates. Documents sorted by most recently modified. Upload card supports multi-file upload with page reload (no redirect to editor). Responsive layout collapses to single column on narrow screens. Typography uses Google Fonts (Fraunces, Outfit, JetBrains Mono).

### 5b. Editor Help Panel ✓

*Completed 2026-03-30*

A floating `?` button in a fixed corner of the editing view (mirroring the save button's placement pattern). On hover or click, it reveals a compact panel containing:

**Quick reference content:**
- Keyboard shortcuts grid (Ctrl+S save, Ctrl+B/I/K formatting, Ctrl+V/Ctrl+Shift+V paste, Escape undo)
- Brief explanation of what's editable and what isn't
- Block controls overview (hover to reveal move/duplicate/remove)
- Save behavior (auto-backup, conflict detection)

**Design constraints:**
- Hidden in print output (consistent with all Galley UI)
- Panel dismisses on click-outside or Escape
- Does not interfere with editing interactions (no overlay that blocks contenteditable)
Standalone — establishes the `?` button as the home for help features.

### 5c. Guided Tour — Superseded

*Superseded by sample document improvements (2026-03-30)*

The original plan called for a spotlight-and-tooltip walkthrough built in vanilla JS. This was superseded by transforming `sample.html` into a self-demonstrating user guide — "Getting Started with Galley" — that covers the same content (editing, saving, formatting, paste, undo, block operations, keyboard shortcuts) with embedded screenshots and interactive "Try it" prompts. Users learn features by using them on real content rather than through a synthetic overlay.

The sample document approach has advantages over an interactive tour: it serves as a permanent reference, prints cleanly to PDF, requires no additional client-side code, and is discoverable from the landing page card grid.

---

## Dependency Graph

```
Phase 1c: Dirty Tracking ✓
    ├── Phase 2a: Undo ✓
    │       └── Phase 4a: Block Duplicate/Remove ✓
    │               └── Phase 4b: Block Reordering ✓
    ├── Phase 2b: Save Conflict Detection ✓
    │       └── Phase 2c: Auto-Reload Polling ✓
    └── Phase 2c: Auto-Reload Polling ✓

Phase 1a: Download ✓
Phase 1b: Upload ✓
Phase 3a: Formatting ✓
Phase 3b: Paste ✓

Phase 5a: Landing Page Refresh ✓
Phase 5b: Editor Help Panel ✓
Phase 5c: Guided Tour — Superseded by sample.html user guide
```

---

## Future Considerations

These are not currently planned but are worth keeping in mind architecturally. They would represent a significant increase in scope and complexity.

### Real-Time Collaborative Editing

WebSocket-based sync using operational transforms or CRDTs to allow simultaneous editing with live cursors. This is a fundamental architectural change — the server becomes stateful, conflicts are resolved algorithmically rather than by last-write-wins, and the client must handle remote operations being applied to the DOM mid-edit.

**Not recommended until** the simpler polling-based workflow (Phase 2c) proves insufficient for the team's actual usage patterns. For a two-person team doing occasional editing sessions, the Phase 2 approach should be adequate.

### User Presence and Awareness

Display which users are currently viewing or editing a document (avatars, colored cursors). Requires a session/connection tracking mechanism on the server. Natural companion to real-time sync but adds complexity on its own.

### Authentication

Username/password or shared passphrase for access control. Currently handled at the network layer (Cloudflare tunnel access policies). Only needed if Galley is exposed to a broader audience or if per-user edit attribution is desired.

### Change Attribution and History

Track which user made which edits, with a visual timeline or diff viewer. Requires authentication (to identify users) and either a richer backup format or a separate change log. Significant complexity increase over the current timestamped-backup approach.

### Static Asset Serving

Serve non-HTML files (images, CSS, fonts) from the docs directory alongside documents. Currently Galley only serves `.html` files — any `<img>` in a document must reference an external URL or use an inline data URI. Adding static asset serving would let authors place images in the docs directory and reference them with relative paths, keeping documents and their assets co-located and self-hosted. Scope is small (a static file middleware on the docs directory) but introduces considerations around allowed file types, path traversal on new extensions, and cache headers.
# Galley Roadmap

This roadmap sequences feature work so that each phase builds foundation for what follows. The ordering is intentional — infrastructure built in earlier phases is reused by later features, reducing total effort and avoiding rework.

## Phase 1: File Management and Dirty Tracking ✓

*Completed 2026-03-29*

### 1a. Download ✓
Download button on the file picker serves raw HTML files as browser downloads (`Content-Disposition: attachment`).

### 1b. Upload ✓
File upload control on the file picker accepts `.html` files. Overwrites create timestamped backups. Redirects to editing view after upload.

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

## Phase 5: Future Considerations

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
```

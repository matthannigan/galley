# Galley Roadmap

This roadmap sequences feature work so that each phase builds foundation for what follows. The ordering is intentional — infrastructure built in earlier phases is reused by later features, reducing total effort and avoiding rework.

## Phase 1: File Management and Dirty Tracking

*Estimated effort: 1–2 days*

These features are independent of each other but both are foundational. Dirty tracking in particular is a prerequisite for nearly everything in Phase 2 and 3.

### 1a. Download

Add a download button to the editing view and/or file picker that serves the raw HTML file as a browser download (`Content-Disposition: attachment`). This closes the loop on the remote server workflow — documents can be retrieved without SSH or file system access.

### 1b. Upload

Add a file upload control to the file picker page. Accepts `.html` files only. If a file with the same name already exists, overwrite it with a timestamped backup (consistent with existing save behavior). After upload, navigate directly to the editing view for that file.

### 1c. Unsaved Changes Tracking

Track whether the user has modified any editable content since the last load or save. Display a visual indicator (e.g., a dot on the save button, a subtle banner, or a change to the page title) when unsaved changes exist. Prompt before navigating away or closing the tab if changes are unsaved (`beforeunload` event).

**Why this is foundational:** The dirty/clean state flag introduced here is required by save conflict detection (Phase 2), auto-reload polling (Phase 2), and undo (Phase 2). Building it first means those features can rely on an established mechanism rather than each inventing their own.

## Phase 2: Edit Safety

*Estimated effort: 2–3 days*

These features make editing sessions more resilient — protecting against accidental data loss, stale overwrites, and missed updates. All three build on the dirty tracking from Phase 1c.

### 2a. Undo

Capture a snapshot of each editable element's `innerHTML` when the user focuses it. On Ctrl+Z (within that element), restore the snapshot. This provides element-level undo for the most common mistake: accidentally deleting or mangling text in a content block.

For a more complete experience, maintain a stack of snapshots per element to support multiple undo steps. Browser-native `contenteditable` undo covers keystroke-level changes within a single editing session; this feature adds a safety net for larger accidental changes and will later extend to cover block-level operations (Phase 4).

**Why this comes before block operations:** Duplicate and especially remove are destructive operations. Undo must be solid before users can delete content blocks.

### 2b. Save Conflict Detection

Stamp each save with a version identifier (file modification timestamp or incrementing version number). When saving, the client sends the version it loaded. If the server's current version doesn't match, the save is rejected with a warning: "This document was updated since you last loaded it. Reload to see the latest version, or force-save to overwrite."

**Depends on:** Dirty tracking (Phase 1c) — the conflict warning needs to know whether the user has unsaved work, which determines whether the response is "reload automatically" or "warn and let the user decide."

### 2c. Auto-Reload Polling

The client polls a lightweight server endpoint (`GET /status/:filename`) every 3–5 seconds. The endpoint returns the file's last-modified timestamp. If the file has changed since the client's last load or save:

- **No unsaved changes:** Reload the document silently. The user sees updated content without any action.
- **Unsaved changes exist:** Display a non-blocking notification ("This document has been updated. Reload to see changes.") and let the user decide when to reload.

**Depends on:** Dirty tracking (Phase 1c) for the two-tier behavior. Benefits from save conflict detection (Phase 2b) — if the user reloads and then saves, the version check prevents stale overwrites during the transition.

**Server endpoint:** `GET /status/:filename` → `{ "lastModified": "2025-03-25T14:30:00Z" }`. Reads file stats only — no content, minimal overhead.

## Phase 3: Richer Text Editing

*Estimated effort: 1–2 days*

With the editing infrastructure stable and safe, add capabilities that make the text editing experience more capable.

### 3a. Minimal Formatting Toolbar

A small floating toolbar that appears on text selection within editable elements. Supports:

- **Bold** (Ctrl+B)
- **Italic** (Ctrl+I)
- **Link** (Ctrl+K) — prompt for URL, wrap selection in `<a>` tag

Implementation can use `document.execCommand` for simplicity despite its deprecated status — it works reliably in all current browsers for these basic operations. If future-proofing is desired, use the Selection and Range APIs directly.

The toolbar must not appear in print output. Keyboard shortcuts should work regardless of whether the toolbar is visible.

### 3b. Paste Handling Refinement

Revisit the plain-text-only paste policy now that basic formatting exists. Consider allowing "paste with formatting" as an option (Ctrl+Shift+V to paste with bold/italic preserved, Ctrl+V for plain text). This keeps the safe default while giving the Document Author a power-user escape hatch.

## Phase 4: Block Operations

*Estimated effort: 2–3 days*

This phase adds structural editing capabilities, carefully scoped to prevent users from creating unknown markup. All block operations are opt-in via data attributes applied by the Document Author.

### 4a. Block Duplicate and Remove

A `data-galley-block` attribute on container elements (typically `div` or `section`) marks them as block-level content units. When Galley detects this attribute, it renders small control icons on hover — duplicate and remove.

- **Duplicate:** `element.cloneNode(true)` inserted as the next sibling. The cloned block inherits all editing behavior from the existing injection script.
- **Remove:** Deletes the element from the DOM. Requires a confirmation prompt. Stashes the removed element in memory and displays a toast with an "Undo" button for recovery.

The hover controls must be positioned outside the document flow (absolute/fixed positioning relative to the block) and hidden in print output. Consider a small vertical toolbar anchored to the left or right edge of the block.

**Depends on:** Undo infrastructure (Phase 2a) — removing a block is destructive and must be reversible within the session.

### 4b. Block Reordering

Enable drag-and-drop reordering among sibling `data-galley-block` elements. Use a library like SortableJS to handle the interaction — hand-rolling drag-and-drop across browsers is not worth the effort.

Reordering is constrained to siblings within the same parent container. A block cannot be dragged to a different section of the document. A drag handle icon is added to the block controls alongside duplicate and remove.

**Depends on:** Block duplicate/remove (Phase 4a) for the hover controls UI and the `data-galley-block` infrastructure.

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
Phase 1c: Dirty Tracking
    ├── Phase 2a: Undo
    │       └── Phase 4a: Block Duplicate/Remove
    │               └── Phase 4b: Block Reordering
    ├── Phase 2b: Save Conflict Detection
    │       └── Phase 2c: Auto-Reload Polling
    └── Phase 2c: Auto-Reload Polling

Phase 1a: Download ──── (independent)
Phase 1b: Upload ────── (independent)
Phase 3a: Formatting ── (independent, but benefits from stable editing infra)
Phase 3b: Paste ─────── (depends on 3a)
```

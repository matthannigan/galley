# Galley Developer Guide

## Architecture Overview

Galley is a Node.js/Express application with no database — the filesystem is the only persistence layer. The client-side editing is vanilla JavaScript injected into served documents at request time.

See `CLAUDE.md` in the project root for build commands, routes, and key constraints.

## Dirty Tracking

Dirty tracking monitors whether the user has modified any editable content since the last load or save. It is a foundational mechanism that later features (save conflict detection, auto-reload polling, undo) are designed to build on.

### State

A `dirty` boolean flag lives in the client-side IIFE (`src/galley-client.js`) alongside the existing `saving` flag. It starts as `false` and is managed exclusively through the `setDirty(value)` function.

### How Changes Are Detected

A single delegated `input` event listener on `document` checks whether the event target is inside a `[contenteditable="true"]` element. If so, it calls `setDirty(true)`. This approach:

- Automatically covers all editable elements without per-element listener registration
- Fires on actual content mutations (typing, pasting, deleting), not on focus/blur
- Has no performance cost when non-editable elements emit input events

### What `setDirty` Does

When the dirty state changes, `setDirty` updates three things:

1. **Save button** — disabled when clean, enabled when dirty. Also toggles the `galley-dirty` CSS class, which renders an orange dot indicator via `::after`.
2. **Document title** — prepends a bullet character (`\u2022 `) when dirty, restores the original title when clean.
3. **Navigation guard** — a `beforeunload` listener checks the `dirty` flag and prompts the user if they try to close or navigate away with unsaved changes.

### Reset

`setDirty(false)` is called in the `xhr.onload` success branch of `saveDocument()`, after the server confirms the save. This clears the indicator, disables the save button, and removes the title prefix.

### Integration Points for Future Features

The `dirty` flag is designed to be read by other subsystems:

- **Save conflict detection** — when the server rejects a stale save, the response logic can check `dirty` to decide whether to auto-reload (clean) or warn the user (dirty).
- **Auto-reload polling** — when a polled status endpoint reports a newer file version, the client can silently reload if `!dirty`, or show a notification if `dirty`.
- **Undo** — the undo system can call `setDirty(true)` when restoring a snapshot to keep the state consistent.

## Formatting Toolbar

A floating toolbar appears when the user selects text inside a contenteditable element. It supports bold, italic, and link formatting via `document.execCommand`.

### DOM Structure

The toolbar is a `<div id="galley-toolbar">` containing three `<button>` elements with `data-command` attributes (`bold`, `italic`, `createLink`). It is created during `DOMContentLoaded` and appended inside `#galley-ui`, so it is automatically stripped on save (lives between the galley markers).

### Positioning

`updateToolbar()` runs on `selectionchange`, `mouseup`, `scroll`, and `resize`. It:

1. Checks if the selection is non-collapsed and inside a contenteditable element
2. Uses `Range.getBoundingClientRect()` to position the toolbar centered above the selection
3. Flips below the selection (with `galley-toolbar-below` class) when there isn't enough room above
4. Clamps horizontal position to stay within the viewport
5. Updates active states on buttons using `document.queryCommandState()` for bold/italic and parent-walk for links

### Button Handlers

A single `mousedown` listener on the toolbar uses event delegation. `e.preventDefault()` is critical — it prevents the browser from collapsing the selection when the button is clicked. The `createLink` command uses `window.prompt()` for URL input; if the selection is already inside an `<a>`, it calls `document.execCommand('unlink')` instead.

### Keyboard Shortcuts

A `keydown` listener intercepts Ctrl/Cmd + B, I, K when the event target is inside a contenteditable element. The shortcuts work independently of toolbar visibility. `execCommand` fires `input` events, so dirty tracking activates automatically.

## Paste Handling

Paste is intercepted on all contenteditable elements. The behavior depends on the Shift key:

- **Without Shift (Ctrl+V):** plain text only — `clipboardData.getData('text/plain')` inserted via `execCommand('insertText')`.
- **With Shift (Ctrl+Shift+V):** formatted paste — `clipboardData.getData('text/html')` is sanitized through `sanitizePasteHtml()`, then inserted via `execCommand('insertHTML')`. Falls back to plain text if no HTML is on the clipboard.

### Sanitization

`sanitizePasteHtml(html)` creates a temporary `<div>`, sets its `innerHTML`, then recursively walks the DOM tree with `sanitizeNode()`:

- `<strong>` and `<b>` are normalized to `<strong>`
- `<em>` and `<i>` are normalized to `<em>`
- `<a>` is preserved only if `href` matches `http:`, `https:`, or `mailto:` schemes (all attributes except `href` are stripped)
- Everything else is unwrapped to its text content

This prevents pasting of styles, classes, font tags, and potentially dangerous markup while keeping the three formatting types the toolbar supports.

## Undo (Element-Level Revert)

Undo provides element-level revert as a safety net on top of the browser's native `contenteditable` undo (Ctrl+Z / Cmd+Z), which handles keystroke-level changes.

### Snapshot Stack

A `Map<Element, string[]>` (`undoSnapshots`) stores innerHTML snapshots per editable element. Snapshots are captured on `focusin` events. The stack is capped at 20 entries per element (oldest dropped via `shift()`).

### Escape Key Behavior

When the user presses Escape inside an editable element:

1. Pop the most recent snapshot from the element's stack
2. If it matches current innerHTML (no changes since focus), pop again to get the previous state
3. If a different snapshot is found, restore it and call `setDirty(true)`
4. If the stack is empty, blur the element (natural Escape behavior)

This allows multi-level revert by pressing Escape repeatedly.

### Reset

`undoSnapshots.clear()` is called on successful save (both normal and force save). The saved state becomes the new baseline.

## Version Tracking and Save Conflicts

### Server-Side Version

The file's `mtime` (modification timestamp) serves as the version identifier. It flows through the system as an ISO 8601 string.

- **`GET /edit/:filename`** injects the version as `data-galley-version` attribute on the `#galley-ui` container div
- **`GET /status/:filename`** returns `{ lastModified: "ISO-8601" }` — file stats only, no content read
- **`POST /save/:filename`** accepts an optional `version` field. If present, compares against current mtime:
  - Match: save proceeds, response includes `{ ok: true, version: "new-mtime" }`
  - Mismatch: returns `409 Conflict` with `{ error: "...", currentVersion: "current-mtime" }`
  - Omitted: save proceeds without check (backwards compatibility)

### Client-Side Conflict Handling

The client reads the initial version from `data-galley-version` on DOMContentLoaded and sends it with every save. On 409 response, a persistent amber banner appears with Reload and Force Save buttons. Force Save re-sends the HTML without a version field, bypassing the check.

On successful save, the client updates its version from the response.

## Auto-Reload Polling

The client polls `GET /status/:filename` every 5 seconds to detect external file changes.

### Behavior

- **File changed + no unsaved changes (`!dirty`)**: automatic `window.location.reload()`
- **File changed + unsaved changes (`dirty`)**: shows amber banner with Reload button (does not auto-reload)
- **File unchanged or network error**: no action (errors are silently ignored)

### Page Visibility Optimization

Polling pauses when the tab is hidden (`document.visibilitychange` event). When the tab becomes visible again, an immediate poll fires followed by resuming the interval. This avoids unnecessary network requests for background tabs.

### Banner Component

Both save conflict (409) and auto-reload use the same `showBanner(message, buttons)` / `hideBanner()` functions and `#galley-banner` element. Only one banner is shown at a time — save conflict banners take priority since they include the Force Save option.

## Download Button (Hidden)

The editing view creates a download `<a>` element (`#galley-download`) in the DOM on every page load, but it is hidden via `display: none` in `src/galley-styles.css`. The `/download/:filename` route and file picker download links remain fully functional.

To re-enable the button in the editing view, change `display: none` to `display: inline-block` in the `#galley-download` CSS rule.

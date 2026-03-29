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

## Download Button (Hidden)

The editing view creates a download `<a>` element (`#galley-download`) in the DOM on every page load, but it is hidden via `display: none` in `src/galley-styles.css`. The `/download/:filename` route and file picker download links remain fully functional.

To re-enable the button in the editing view, change `display: none` to `display: inline-block` in the `#galley-download` CSS rule.

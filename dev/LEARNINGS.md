# Learnings

Reverse-chronological list of technical findings and gotchas from implementation.

## 2026-03-29 — Phase 2 (Save Conflict Detection, Undo, Auto-Reload)

### Injecting per-request data into a cached payload
The injector caches the assembled script+styles payload for performance. To inject the file's mtime (which varies per request) without breaking the cache, the route handler does a string replace on the cached output (`<div id="galley-ui">` → `<div id="galley-ui" data-galley-version="...">`) rather than passing it through the injector. Keeps caching intact with minimal coupling.

### Strict `toEqual` on response bodies breaks when fields are added
Adding `version` to the save response (`{ ok: true, version: "..." }`) broke an existing test that asserted `toEqual({ ok: true })`. Use `expect(res.body.ok).toBe(true)` for individual fields when the response shape may grow, or accept that `toEqual` tests are intentionally strict and will need updating.

### Escape-to-revert needs to skip matching snapshots
When the user focuses an element, a snapshot is pushed. If they press Escape without editing, the snapshot matches `innerHTML` exactly — restoring it would be a no-op. The handler must detect this case and pop again to reach the previous meaningful state, or blur if the stack is exhausted.

### Browser native `contenteditable` undo works well enough to preserve
Rather than intercepting Ctrl+Z with a custom undo stack (which would need to replicate fine-grained keystroke tracking), keeping native undo intact and adding Escape as a separate element-level revert gesture gives both granular and coarse undo without fighting the browser.

### ESLint browser globals accumulate as features grow
Phase 1 needed `setTimeout`/`clearTimeout`; Phase 2 added `setInterval`/`clearInterval`. The `galley-client.js` ESLint config uses an explicit globals allowlist (no `browser` environment), so each new browser API requires a manual addition. Same applies to the test file globals — `clearInterval` needed adding there too.

## 2026-03-29 — Phase 3 (Formatting Toolbar, Paste Refinement)

### `mousedown` with `preventDefault` is required for toolbar buttons
Clicking a button outside a contenteditable element collapses the selection, losing the text the user selected. Using `mousedown` (not `click`) with `e.preventDefault()` prevents the browser from moving focus and collapsing the selection. This is the standard pattern for floating formatting toolbars.

### `var` redeclaration across if/else branches triggers `no-redeclare`
ESLint's `no-redeclare` rule fires when `var text` is declared in both branches of an if/else block, even though `var` is function-scoped and this is technically valid JS. Fix by hoisting the declaration above the conditional.

### `document.execCommand` triggers `input` events automatically
When using `execCommand('bold')`, `execCommand('italic')`, or `execCommand('insertHTML')`, the browser fires an `input` event on the contenteditable element. This means the existing dirty tracking listener (`document.addEventListener('input', ...)`) picks up formatting changes without any manual `setDirty(true)` calls.

## 2026-03-29 — Phase 1 (Download, Upload, Dirty Tracking)

### `position: fixed` already contains `::after` pseudo-elements
Adding `position: relative` to an element that already has `position: fixed` will override it and break fixed positioning. `position: fixed` already establishes a containing block for absolutely positioned children and pseudo-elements — no additional positioning declaration is needed.

### `<a>` and `<button>` render at different sizes with identical styles
Even with matching `padding`, `font-size`, and `font-family`, an `<a>` with `border: 1px solid` will render larger than a `<button>` with `border: none`. Two factors: the border adds 2px to total dimensions, and the elements have different default `line-height` values. Fix with `calc()` padding compensation (subtract border width) and explicit `line-height` on both.

### `jest` global is not available in ESM mode
When running Jest with `--experimental-vm-modules`, the `jest` object (used for `jest.spyOn`, `jest.fn`, etc.) is not automatically available as a global. Workaround: use manual spies (e.g., wrapping `window.addEventListener` with a tracking function) or import `jest` from `@jest/globals`.

### ESLint test globals must be kept in sync with test usage
The eslint config for test files had `document`, `Event`, and `KeyboardEvent` as globals but not `window`. First test to reference `window` directly (the `beforeunload` handler test) triggered a lint error. When adding browser API usage in tests, check `eslint.config.js` globals.

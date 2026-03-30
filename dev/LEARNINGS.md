# Learnings

Reverse-chronological list of technical findings and gotchas from implementation.

## 2026-03-30 — Docker data directory and permissions

### Non-root container users can't write to host-mounted volumes
The Dockerfile creates a `galley` user for security, but Docker bind mounts preserve host ownership (typically root or the host user). The `galley` user inside the container can read the mounted files but can't create directories or write files. This caused `EACCES: permission denied, mkdir '/docs/.galley-backups'` on first save.

### Entrypoint script pattern for writable volumes
The standard Docker pattern: run the entrypoint as root to create subdirectories and `chown` them to the app user, then drop privileges with `su-exec` (Alpine) or `gosu` (Debian). This avoids requiring the host user to pre-create directories with specific ownership.

### Unified data directory simplifies volume management
Rather than mounting separate volumes for docs, backups, and config, a single `/data` mount with subdirectories (`docs/`, `backups/`, `config/`) is easier for users. The entrypoint creates missing subdirectories automatically. This also harmonizes local dev (`./data/docs`) with the container layout (`/data/docs`).

### Backup directory as sibling avoids write permission issues
Placing backups in a sibling directory (`../backups` relative to docs) rather than inside the docs directory (`.galley-backups/`) means the backup dir can have different ownership/permissions than the docs. In Docker, the entrypoint `chown`s both to the app user. Locally, both are under `data/` which the developer owns.

## 2026-03-30 — Phase 5a (Landing Page Refresh)

### HTML entities in `<title>` tags cause double-encoding
Extracting `<title>` content with a regex returns raw HTML entity text (e.g., `&amp;`). Passing this through `escapeHtml()` produces `&amp;amp;`, which renders literally. Fix: decode common HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&mdash;`, `&ndash;`, `&nbsp;`) in `extractTitle()` before the template's `escapeHtml()` re-encodes them.

### Iframe thumbnail scaling requires coordinated width/scale values
Iframe thumbnails use CSS `transform: scale()` to show a miniature document preview. The iframe `width` (as a percentage of the card) and `scale` factor must satisfy `width% × scale ≈ 100%` to fill the thumbnail area. For 8.5×11 documents (~850px wide), `width: 250%; scale(0.40)` shows the full page width in a ~340px card. The `height` percentage just needs to be large enough that the bottom edge isn't visible.

### Iframe scrollbars require both CSS and HTML attribute removal
`overflow: hidden` on the iframe's parent container clips the visual output but doesn't remove scrollbars rendered inside the iframe itself. The `scrolling="no"` HTML attribute (deprecated but still supported by all browsers) suppresses the iframe's internal scrollbars. Both are needed for clean thumbnails.

### `escapeHtml` became unused in app.js after extracting index page
Moving the index page template to `src/index-page.js` (which has its own `escapeHtml`) left the original in `src/app.js` unused. ESLint `no-unused-vars` caught it. The function was safe to remove since no other route handler uses it — filenames in other routes go through `validateFilename()` and are never interpolated into HTML.

## 2026-03-29 — Phase 4 (Block Operations)

### SortableJS requires handles inside the draggable element
SortableJS's `handle` option only works when the handle element is a descendant of the `draggable` element. A floating control bar outside the block cannot serve as a drag handle — synthetic `MouseEvent` dispatching doesn't work because SortableJS relies on the real browser event target chain. Solution: inject a per-block `<button class="galley-block-drag-handle">` as a child of each block, styled to visually align with the floating control bar.

### `contenteditable` inheritance blocks SortableJS drag
When a drag handle is inside a `contenteditable="true"` element (e.g., `<p data-galley-block contenteditable="true">`), the handle inherits `isContentEditable: true`. SortableJS checks `!s.isContentEditable` in `_onTapStart` and refuses to initiate drag. Fix: set `contenteditable="false"` explicitly on the drag handle element to break inheritance.

### `mouseout` fires on child-to-parent transitions within an element
Using delegated `mouseout` to hide hover controls causes premature hiding because `mouseout` bubbles and fires when the mouse moves between child elements inside the same parent. Fix: check `e.relatedTarget` — if the mouse is moving to another element inside the same block or into the controls bar, suppress the hide.

### Floating bar + per-block handle requires matched sizing
The floating control bar (`#galley-block-controls`) has `padding: 3px` which makes its total width 32px (26px buttons + 6px padding). The per-block drag handle must match this 32px width to appear as a unified strip. The hover highlight on the handle uses a `::before` pseudo-element with `inset: 3px` and `border-radius: 4px` to replicate the inset rounded square that the container padding creates for the floating bar buttons.

### Nested `data-galley-block` elements cause duplicate drag handles
When blocks are nested, CSS `:hover` triggers on all ancestors simultaneously, showing drag handles for every level. Fix: only show the drag handle via the `.galley-block-hover` class (applied exclusively to the innermost active block by JS), not via CSS `:hover`.

### `document.title` must be cleaned before save serialization
`setDirty(true)` prepends `• ` to `document.title` as a visual indicator. Since `document.documentElement.outerHTML` serializes the `<title>` element, the bullet gets saved to the file. On reload, `setDirty` adds another bullet, causing accumulation (`• • • Title`). Fix: restore `originalTitle` before serializing, re-apply the dirty prefix after. Also strip existing bullet prefixes on load for self-healing.

### Vendored JS files need ESLint ignoring
SortableJS minified source triggers hundreds of ESLint errors (no-undef, no-redeclare, etc.). Add `src/vendor/` to ESLint's `ignores` array. The `Sortable` global used in `galley-client.js` needs explicit addition to the client's ESLint globals list.

### Injector payload cache persists across nodemon restarts
The injector caches the assembled payload (styles + scripts) in a module-level variable. When nodemon restarts the server process after a file change, the new process gets a fresh cache. However, if only CSS or client JS changes, the server must be restarted to pick up the change — nodemon watches `src/` so this happens automatically in dev mode.

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

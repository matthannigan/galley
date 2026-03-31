# Learnings

Reverse-chronological list of technical findings and gotchas from implementation.

## 2026-03-31 — Static Asset Serving

### Express route params match before static middleware
The `/edit/:filename` route matches requests like `/edit/image.svg` before `express.static` middleware mounted at the same path. If the route handler returns an error (e.g., 400 for non-HTML extensions), the static middleware never runs. Fix: add an early `if (!filename.endsWith('.html')) return next()` check in the route handler to skip non-HTML requests and let them fall through to the static middleware.

### Static file extension whitelist prevents serving unintended content
An unrestricted `express.static` on the docs directory would serve any file placed there — JS files (XSS vector from same origin), `.env` files, archives, etc. A middleware that checks `path.extname()` against an allowlist before `express.static` runs is a simple gate. The whitelist (images, fonts, CSS, PDF) covers realistic embed use cases while rejecting anything unexpected.

### Config file loading should fail silently
`config.json` is optional — most users won't create one. Using try/catch around `readFile` + `JSON.parse` with an empty object fallback means zero configuration is needed by default. The `GALLEY_CONFIG_DIR` env var and `/data/config` Docker directory were already in place from the entrypoint script, so adding config file support required no infrastructure changes.

## 2026-03-31 — Security Audit

### Paste sanitizer and link toolbar had divergent URL validation
The paste sanitizer (`sanitizeNode()`) correctly validated link URLs against `/^(https?:|mailto:)/i`, rejecting `javascript:` and `data:` schemes. But `handleLinkCommand()` (Ctrl+K) passed the `prompt()` result directly to `execCommand('createLink')` with no validation. This was a stored XSS vector — a `javascript:` link entered via the toolbar gets saved into the document and executes for anyone who opens it via `/preview`. Fix: apply the same regex check in both paths. Lesson: when the same kind of input (a URL) enters through multiple paths, validation must be applied at each entry point, not just one.

### `Content-Security-Policy: script-src 'none'` on preview route is effective defense-in-depth
The `/preview` route serves raw document HTML (no editor injection) for iframe thumbnails on the landing page. Adding `script-src 'none'` blocks all script execution in previews, which neutralizes stored XSS payloads even if sanitization has gaps. This CSP can't be applied to the `/edit` route because the injected editor uses inline `<script>` tags. A nonce-based CSP for the edit route would require changes to the injector — possible but higher complexity for lower benefit since the editor already controls the page.

### JSON content-type requirement is sufficient CSRF protection for this architecture
Express 5 rejects POST bodies that don't match the declared content type. Since all POST endpoints use `express.json()`, they require `Content-Type: application/json`. Browsers enforce CORS preflight on cross-origin requests with non-simple content types (`application/json` is non-simple), and Galley sets no `Access-Control-Allow-Origin` header. This means cross-origin `fetch` with JSON is blocked by the browser's preflight check, and HTML forms can't send `application/json`. No CSRF tokens needed.

### Security headers don't need a dependency
Rather than adding `helmet` (which would double the production dependency count from 1 to 2), three `res.set()` calls in a middleware provide the headers Galley actually needs: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`. `helmet` sets many headers by default that don't apply (HSTS requires HTTPS termination at the app layer, CSP is route-specific). Keeping it manual avoids unnecessary complexity and dependency risk.

### `X-Frame-Options: SAMEORIGIN` not `DENY` because of iframe previews
The landing page embeds documents in `<iframe src="/preview/...">` for thumbnail previews. `X-Frame-Options: DENY` would block these same-origin iframes. `SAMEORIGIN` allows the landing page to frame previews while still preventing external sites from embedding Galley pages.

### Backup timestamp collisions in fast tests
The backup filename uses ISO 8601 to the second (`YYYY-MM-DDTHH-MM-SS`). In tests, multiple saves can complete within the same second, producing identical backup filenames that overwrite each other. Tests that need multiple distinct backups should pre-seed backup files with different timestamps rather than relying on real saves happening in different seconds.

### Error messages can leak filesystem structure
`err.message` for Node.js filesystem errors includes the full absolute path (e.g., `EACCES: permission denied, open '/data/docs/test.html'`). Exposing this in API responses leaks the server's directory structure and OS details. Fix: return generic error messages in HTTP responses and log the full error server-side. This is a common pattern but easy to forget when the initial implementation just does `'Save failed: ' + err.message`.

### Backup pruning sorts alphabetically, which matches chronologically
Backup filenames use ISO 8601 timestamps (`test.2026-01-01T00-00-00.html`), which sort lexicographically in chronological order. This means `Array.sort()` on filtered backup filenames produces oldest-first ordering without needing to `stat()` each file for mtime. Pruning is just `backups.slice(0, count - maxBackups)` after sorting.

## 2026-03-30 — Phase 5b (Editor Help Panel)

### Help panel headings must avoid semantic heading elements
The help panel originally used `<h3>` for section headings. JSDOM tests query `document.querySelectorAll('h1, h2, h3, h4, h5, h6')` to verify contenteditable activation — the help panel headings matched this query but weren't editable, causing test failures. Fix: use `<div class="galley-help-heading">` instead. UI labels in injected chrome should never use semantic elements that overlap with document content selectors.

### `navigator` needs explicit ESLint global for client script
The client ESLint config uses an explicit globals allowlist (no `browser` environment). Adding `navigator.platform` for Mac/Windows shortcut detection required adding `navigator` to the client's ESLint globals in `eslint.config.js`.

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

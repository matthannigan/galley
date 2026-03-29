# Learnings

Reverse-chronological list of technical findings and gotchas from implementation.

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

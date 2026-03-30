# Galley User Guide

Galley is a lightweight, self-hosted HTML document editor. It serves HTML files from a directory, injects inline editing capabilities, and writes changes back to disk. The file on disk is always the single source of truth.

## Getting Started

Start the server and point it at a directory of HTML files:

```bash
# Default: serves files from ./data/docs on port 3000
npm start

# Custom directory and port
GALLEY_DOCS_DIR=/path/to/docs PORT=8080 npm start

# Docker (mount a data directory — subdirectories are created automatically)
docker run -p 3000:3000 -v /path/to/data:/data galley
```

The docs directory and a sample document are created automatically on first run. Place additional `.html` files in `data/docs/` (or your custom directory) and open `http://localhost:3000` in your browser.

## Landing Page

The landing page at `/` shows all `.html` files in the documents directory as a card grid with thumbnail previews. A sidebar explains what Galley is and how it works. From here you can:

- **Open a document** — click any card or document title to open it in the editor
- **Download a document** — click the Download link on any card to save the raw HTML file
- **Upload documents** — click the upload card (or drag files onto it) to add one or more `.html` files. After upload, the page reloads and new documents appear in the grid.

Documents are sorted by most recently modified, so newly uploaded or saved files appear first. Each card shows a thumbnail preview, the document title (extracted from the HTML `<title>` tag), filename, and last-modified date.

## Editing

Click any editable text element (paragraphs, headings, list items, table cells, etc.) to start editing. Editable elements highlight with a subtle blue outline on hover.

All standard text elements are editable by default: `p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, `label`, `span`, `a`. Add `data-no-edit` to any element or container to protect it from editing.

### Saving

The Save button in the bottom-right corner activates when you make changes. Save with the button or `Ctrl+S` / `Cmd+S`. Each save creates a timestamped backup before overwriting the file.

If you try to close the tab or navigate away with unsaved changes, the browser will prompt you to confirm.

### Formatting

Select text to reveal a small floating toolbar with three options:

- **Bold** — click **B** or press `Ctrl+B` / `Cmd+B`
- **Italic** — click *I* or press `Ctrl+I` / `Cmd+I`
- **Link** — click A or press `Ctrl+K` / `Cmd+K`, then enter a URL. To remove a link, select linked text and press `Ctrl+K` / `Cmd+K` again.

The toolbar appears above the selection (or below if near the top of the page) and disappears when the selection is cleared. Keyboard shortcuts work whether or not the toolbar is visible. Active formatting is highlighted on the toolbar buttons.

Formatting is stored as standard HTML (`<strong>`, `<em>`, `<a>`) and persists through save/reload cycles. The toolbar is hidden in print output.

### Paste Behavior

- **`Ctrl+V` / `Cmd+V`** — pastes plain text (all formatting stripped). This is the default.
- **`Ctrl+Shift+V` / `Cmd+Shift+V`** — pastes with formatting, but only bold, italic, and links are preserved. All other formatting (colors, font sizes, styles, etc.) is stripped. Links with `javascript:` URLs are rejected for security.

### Undo

Browser undo (`Ctrl+Z` / `Cmd+Z`) works normally for keystroke-level changes.

For larger reversals, press `Escape` while editing an element to revert it to its state when you first focused it. Press `Escape` multiple times to step back through earlier states. When there's nothing left to revert, `Escape` exits the element.

Undo history is cleared after a successful save.

### Save Conflicts

If someone else (or another tab) saves the same document while you have unsaved changes, Galley will warn you when you try to save:

- **Reload** — discards your changes and loads the latest version from disk
- **Force Save** — overwrites the file with your version

If you have no unsaved changes, the document reloads automatically when it detects a newer version on disk.

### Auto-Reload

Galley polls the server every few seconds to check for file changes. If the document is updated on disk (by another editor, another tab, or a script):

- **No unsaved changes**: the page reloads automatically with the latest content
- **Unsaved changes**: a banner appears letting you choose when to reload

Polling pauses when the tab is in the background and resumes when you return.

### Editing Constraints

- **No structural changes** — pressing Enter in block elements (paragraphs, headings, etc.) is suppressed to prevent accidental structure changes. List items allow Enter for multi-line content.

## Block Operations

When the Document Author marks container elements with the `data-galley-block` attribute, Galley enables structural editing controls for those blocks.

### Controls

Hover over a block to reveal a small control bar to the left with three actions:

- **Move** (top, chevron arrows) — drag to reorder the block among its siblings. Blocks can only be reordered within the same parent container.
- **Duplicate** (middle, copy icon) — creates a copy of the block immediately below the original. The copy is fully editable.
- **Remove** (bottom, trash icon) — removes the block from the document. A toast notification with an **Undo** button appears for 6 seconds, allowing you to restore the block to its original position.

For nested blocks (a block inside another block), the controls target the innermost block.

All block operations mark the document as having unsaved changes. Block controls and drag handles are hidden in print output and are not saved to the file.

### For Document Authors

To enable block operations on a container element, add the `data-galley-block` attribute:

```html
<div data-galley-block>
  <h2>Section Title</h2>
  <p>Section content goes here.</p>
</div>

<div data-galley-block>
  <h2>Another Section</h2>
  <p>More content.</p>
</div>
```

Blocks are typically `<div>` or `<section>` elements that wrap a logical content unit. Drag-and-drop reordering is constrained to siblings within the same parent — blocks cannot be dragged to a different section of the document.

## Uploading

The landing page has an upload card that accepts one or more `.html` files. When you upload:

- If a file with the same name already exists, a timestamped backup is created before overwriting
- After all uploads complete, the page reloads and the new documents appear in the card grid
- If any uploads fail, an alert names the failed files; successfully uploaded files still appear

## Downloading

Each file in the file picker has a Download link that serves the raw HTML file as a browser download. This is the clean source file — no editing scripts or styles are included.

## Printing

Use your browser's print function (`Ctrl+P` / `Cmd+P`) from the editing view. All Galley UI (save button, editing indicators) is automatically hidden in print output. The document prints exactly as originally designed.

## Backups

Every save and overwriting upload creates a timestamped backup in the `backups/` sibling directory (next to `docs/`). This is configurable via `GALLEY_BACKUP_DIR`. Backup filenames follow the pattern `document.YYYY-MM-DDTHH-MM-SS.html`.

## For Document Authors

Galley is designed so one person owns the document structure (HTML/CSS) and others edit text through the browser. A few things to keep in mind:

- Embedded CSS, print styles, and relative assets (images, fonts) are preserved exactly
- Editing indicators are hidden in print — documents print as designed
- The saved file contains no editing artifacts — it's the same clean HTML you started with, just with updated text

## Troubleshooting: Text You Can't Edit

Galley only makes specific HTML elements editable. If you have text sitting directly inside a `<div>` or other container element, it won't be editable.

**The fix:** Wrap the text in an element Galley recognizes. The two most common patterns:

Use `<span>` for short inline text (labels, values, single lines):
```html
<!-- Before: not editable -->
<div class="card-title">Project Name</div>

<!-- After: editable -->
<div class="card-title"><span>Project Name</span></div>
```

Use `<p>` for paragraph-length text:
```html
<!-- Before: not editable -->
<div class="callout">
    This is a longer description that should be editable.
</div>

<!-- After: editable -->
<div class="callout">
    <p>This is a longer description that should be editable.</p>
</div>
```

For mixed content (a label div followed by loose text), wrap just the text:
```html
<!-- Before: label is not editable, description is not editable -->
<div class="note">
    <div class="note-title">Important</div>
    This text cannot be edited because it's a bare text node inside a div.
</div>

<!-- After: both parts are editable -->
<div class="note">
    <p class="note-title">Important</p>
    <span>This text can now be edited.</span>
</div>
```

**Tip:** When converting `<div>` to `<span>` or `<p>`, check that your CSS still applies. If the original CSS targets `div.card-title`, update it to `.card-title` (class-only selector) so it works regardless of element type.

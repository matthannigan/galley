# Galley User Guide

Galley is a lightweight, self-hosted HTML document editor. It serves HTML files from a directory, injects inline editing capabilities, and writes changes back to disk. The file on disk is always the single source of truth.

## Getting Started

Start the server and point it at a directory of HTML files:

```bash
# Default: serves files from ./mount on port 3000
npm start

# Custom directory and port
GALLEY_DOCS_DIR=/path/to/docs PORT=8080 npm start

# Docker
docker run -p 3000:3000 -v /path/to/docs:/docs galley
```

Open `http://localhost:3000` in your browser to see the file picker.

## File Picker

The file picker at `/` lists all `.html` files in the documents directory. From here you can:

- **Open a document** — click any filename to open it in the editor
- **Download a document** — click the Download link to save the raw HTML file to your computer
- **Upload a document** — use the file upload control at the bottom of the page to add a new HTML file

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

### Editing Constraints

- **No structural changes** — pressing Enter in block elements (paragraphs, headings, etc.) is suppressed to prevent accidental structure changes. List items allow Enter for multi-line content.

## Uploading

The file picker page has an upload control that accepts `.html` files. When you upload:

- If a file with the same name already exists, a timestamped backup is created before overwriting
- After upload, you are automatically redirected to the editor for that file

## Downloading

Each file in the file picker has a Download link that serves the raw HTML file as a browser download. This is the clean source file — no editing scripts or styles are included.

## Printing

Use your browser's print function (`Ctrl+P` / `Cmd+P`) from the editing view. All Galley UI (save button, editing indicators) is automatically hidden in print output. The document prints exactly as originally designed.

## Backups

Every save and overwriting upload creates a timestamped backup in `.galley-backups/` inside the documents directory (configurable via `GALLEY_BACKUP_DIR`). Backup filenames follow the pattern `document.YYYY-MM-DDTHH-MM-SS.html`.

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

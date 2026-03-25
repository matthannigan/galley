# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

Designed for small teams where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Place `.html` files in the `mount/` directory (create it if needed). Open the browser to see the file picker, click a document to edit, and press Save or Ctrl+S to write changes back to disk. A sample document is available at `docs/sample.html`.

## Docker

```bash
docker build -t galley .
docker run -p 3000:3000 -v /path/to/your/html/files:/docs galley
```

Or with Docker Compose:

```bash
docker compose up
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server listen port |
| `GALLEY_DOCS_DIR` | `./mount` (local) / `/docs` (container) | Directory containing HTML documents |
| `GALLEY_BACKUP_DIR` | `.galley-backups/` inside docs dir | Directory for timestamped backups |

## How It Works

1. Place HTML documents in your documents directory
2. Open Galley in a browser — the file picker lists all `.html` files
3. Click a document to open it in the editing view
4. Click any text element to edit it in place (headings, paragraphs, list items, table cells, etc.)
5. Click Save or press Ctrl+S / Cmd+S — the clean HTML is written back to disk
6. A timestamped backup of the previous version is saved automatically

The saved file contains no editing artifacts — it's the same clean HTML you started with, just with updated text.

## For Document Authors

- All standard text elements are editable by default (`p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, `label`, `span`, `a`)
- Add `data-no-edit` to any element to protect it from editing
- Embedded CSS, print styles, and relative assets are preserved exactly
- Editing indicators are hidden in print — documents print as designed

## Troubleshooting: Text You Can't Edit

Galley only makes specific HTML elements editable: `p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, `label`, `span`, and `a`. If you have text sitting directly inside a `<div>` or other container element, it won't be editable.

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

## License

MIT — see [LICENSE](LICENSE).

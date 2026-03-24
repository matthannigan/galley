# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

Designed for small teams where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Place `.html` files in the `docs/` directory. Open the browser to see the file picker, click a document to edit, and press Save or Ctrl+S to write changes back to disk.

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
| `GALLEY_DOCS_DIR` | `./docs` (local) / `/docs` (container) | Directory containing HTML documents |
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

## License

TBD

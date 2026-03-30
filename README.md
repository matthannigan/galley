# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

Designed for small teams where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Place `.html` files in `data/docs/`. Open the browser to see the landing page — a card grid with thumbnail previews of your documents, sorted by most recently modified. Click a card to edit, and press Save or Ctrl+S to write changes back to disk. Select text to reveal a floating toolbar for bold, italic, and link formatting. Mark containers with `data-galley-block` to enable drag-and-drop reordering, duplication, and removal. Upload one or more files directly from the landing page. Click the `?` button in the editor for a quick-reference help panel with keyboard shortcuts and feature overview.

A "Getting Started with Galley" document is automatically seeded on first run. It's an interactive guide — with screenshots, keyboard shortcuts, and "Try it" prompts — that teaches you features by letting you use them.

## Docker

```bash
docker build -t galley .
docker run -p 3000:3000 -v /path/to/data:/data galley
```

Or with Docker Compose (uses `./data` by default):

```bash
docker compose up
```

To use a different data directory:

```bash
GALLEY_DATA=/path/to/data docker compose up
```

The container automatically creates `docs/`, `backups/`, and `config/` subdirectories inside the mounted data directory.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GALLEY_DATA` | `./data` | Path to data directory — must exist before starting (Docker Compose only) |
| `PORT` | `3000` | Server listen port |
| `GALLEY_DOCS_DIR` | `$GALLEY_DATA/docs` | Directory containing HTML documents |
| `GALLEY_BACKUP_DIR` | `$GALLEY_DATA/backups` | Directory for timestamped backups |

## Documentation

- [User Guide](docs/USER-GUIDE.md) — editing, uploading, downloading, printing, troubleshooting
- [Developer Guide](docs/DEVELOPER-GUIDE.md) — architecture, dirty tracking, internal conventions

## License

MIT — see [LICENSE](LICENSE).

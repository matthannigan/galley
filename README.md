# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

Designed for small teams where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Place `.html` files in the `mount/` directory (create it if needed). Open the browser to see the file picker, click a document to edit, and press Save or Ctrl+S to write changes back to disk. Select text to reveal a floating toolbar for bold, italic, and link formatting. A sample document is available at `docs/sample.html`.

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

## Documentation

- [User Guide](docs/USER-GUIDE.md) — editing, uploading, downloading, printing, troubleshooting
- [Developer Guide](docs/DEVELOPER-GUIDE.md) — architecture, dirty tracking, internal conventions

## License

MIT — see [LICENSE](LICENSE).

# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

Designed for small teams where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Place `.html` files in `data/docs/`. Open the browser to see the landing page — a card grid with thumbnail previews of your documents, sorted by most recently modified. Click a card to edit, and press Save or Ctrl+S to write changes back to disk. Select text to reveal a floating toolbar for bold, italic, and link formatting. Mark containers with `data-galley-block` to enable drag-and-drop reordering, duplication, and removal. Upload one or more files directly from the landing page. Click the `?` button in the editor for a quick-reference help panel with keyboard shortcuts and feature overview. Static assets (images, fonts, CSS) placed alongside your HTML files are served automatically.

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
| `GALLEY_MAX_BACKUPS` | `20` | Maximum backups per document (0 = unlimited) |
| `GALLEY_CONFIG_DIR` | `$GALLEY_DATA/config` | Directory containing optional `config.json` |

## Security

Galley has **no built-in authentication**. This is a deliberate design choice — access control is your responsibility at the network layer.

**You must restrict access** before exposing Galley to any untrusted network. Recommended approaches:

- **Cloudflare Tunnel / Gateway** — zero-trust access with identity-based policies (what the maintainer uses)
- **Reverse proxy with auth** — nginx/Caddy/Traefik with OAuth2 Proxy, HTTP Basic Auth, or mutual TLS
- **VPN / firewall** — restrict access to a trusted network segment

Without network-layer access control, anyone who can reach the server can read, edit, and upload documents.

Galley includes the following built-in protections:

- **Path traversal prevention** — filenames are validated against directory escape, path separators, and non-`.html` extensions; static assets use `express.static`'s built-in traversal protection
- **Static asset whitelist** — only safe file types (images, fonts, CSS, PDF) are served from the docs directory; configurable via `config.json`
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer` on all responses
- **Preview CSP** — the `/preview` route sets `Content-Security-Policy: script-src 'none'` to block script execution in document previews
- **Paste sanitization** — pasted HTML is whitelist-filtered to bold, italic, and links with `http:`/`https:`/`mailto:` URLs only
- **Link URL validation** — the link toolbar rejects `javascript:`, `data:`, and other non-http(s) URLs
- **Atomic writes** — saves use a temp-file-then-rename pattern to prevent partial writes
- **Backup retention** — old backups are automatically pruned (configurable via `GALLEY_MAX_BACKUPS`)
- **CSRF mitigation** — POST endpoints require `Content-Type: application/json`, which triggers CORS preflight on cross-origin requests
- **Non-root Docker execution** — the container runs as a dedicated `galley` user

## Documentation

- [User Guide](docs/USER_GUIDE.md) — editing, uploading, downloading, printing, troubleshooting
- [Developer Guide](docs/DEVELOPER_GUIDE.md) — architecture, dirty tracking, internal conventions
- [Changelog](CHANGELOG.md) — release history
- [Roadmap](ROADMAP.md) — what's been built and what's next

## License

MIT — see [LICENSE](LICENSE).

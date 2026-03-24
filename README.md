# Galley

A lightweight, self-hosted HTML document editor for collaborative text editing.

Galley serves HTML files as fully rendered pages with inline editing capabilities and writes changes back to disk. The file on disk is the single source of truth — a self-contained HTML document that can be opened in any browser and printed to PDF.

**Status:** Actively developing toward v1. See [docs/EPICS.md](docs/EPICS.md) for the build plan.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
```

## Docker

```bash
docker build -t galley .
docker run -p 3000:3000 -v /path/to/your/html/files:/docs galley
```

## License

TBD

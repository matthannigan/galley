# Galley

*A lightweight, self-hosted HTML document editor for collaborative text editing.*

## Overview

Galley is a lightweight, self-hosted tool for collaboratively editing self-contained HTML documents. Designed for small teams (2–3 people) where one person owns the document structure (HTML/CSS) and others need to edit text content through a visual, browser-based interface — without touching source code.

Galley serves HTML files as fully rendered pages with inline editing capabilities, and writes changes back to disk. The file on disk remains the single source of truth: a self-contained HTML document that can be opened in any browser and printed to PDF.

The name comes from *galley proof* — the near-final version of a document handed to an editor for text corrections before going to press.

## Problem Statement

Self-contained HTML documents — with embedded CSS, print styles, and custom layouts — are an effective way to produce designer-quality printable documents outside of traditional desktop publishing tools. However, collaborative editing of these documents is poorly served by existing tools:

- **WYSIWYG collaborative editors** (Google Docs, Notion, CKEditor) impose their own document models and cannot round-trip custom HTML with embedded styles.
- **Code editors with collaboration** (VS Code Live Share, CodeSandbox) preserve the HTML faithfully but require all collaborators to work in source code.
- **Content management systems** separate content from presentation, requiring document decomposition into templates and content fields — overhead that isn't justified for small-scale, occasional use.

The gap is a simple tool that lets a non-technical collaborator edit the *text content* of a designed HTML document visually, while preserving the document's structure and styling exactly as authored.

## Users

### Document Author
- Comfortable with HTML and CSS
- Creates and maintains the document structure, layout, and styles
- May also edit text content
- Responsible for running Galley (Docker, Cloudflare tunnel)

### Content Editor
- Non-technical; should never see source code
- Needs to edit text (headings, paragraphs, list items, etc.)
- Wants to see the document rendered exactly as it will appear when printed
- Accesses Galley via a URL shared by the Document Author

## Core Requirements

### Serving and Rendering

- **R1.** Galley serves an HTML file from a configured directory, rendered in the browser exactly as it would appear when opened as a local file.
- **R2.** All embedded styles, fonts, print media queries, and relative assets are preserved and rendered correctly.
- **R3.** The served page must be visually identical to the source file — no CMS chrome, navigation, or wrapper layout in the editing view.

### Inline Editing

- **R4.** Text-containing elements in the document are editable directly in the browser via `contenteditable` or equivalent mechanism.
- **R5.** Galley automatically detects and enables editing on all conventional text-containing HTML elements (`p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, and similar). The Document Author may exclude specific elements by adding a `data-no-edit` attribute.
- **R6.** Editing must not alter document structure — only the text content within editable elements should change. No insertion or deletion of HTML elements, no style changes.
- **R7.** When in editing mode, editable regions should have a subtle visual indicator (e.g., a faint outline on hover) that does not affect the document's print appearance.
- **R8.** A basic formatting toolbar is *not* required for v1. Bold/italic/link support may be added later. Plain text editing within existing styled containers is sufficient.
- **R9.** All paste events within editable regions are intercepted and reduced to plain text. No foreign markup, inline styles, or HTML structure may be introduced via paste.

### Saving

- **R10.** Galley provides a save action (button or keyboard shortcut) that writes the current state of the document back to the HTML file on disk.
- **R11.** The saved file must be a clean, self-contained HTML document — no injected scripts, editing UI, or tool artifacts. The output file should be identical in structure to the input file, differing only in the text content that was changed.
- **R12.** Before overwriting, Galley creates a timestamped backup of the previous version in a designated backups directory.
- **R13.** Save conflicts are not expected (see Non-Requirements) but Galley should not corrupt the file if two saves occur in rapid succession.

### Multi-Document Support

- **R14.** Galley serves all HTML files in a configured directory, with a simple file picker or index page for selecting which document to edit.
- **R15.** The file picker shows filenames and last-modified timestamps. No preview thumbnails are required.

## Non-Requirements (Out of Scope for v1)

- **Real-time collaborative sync.** Two users will not edit the same document simultaneously. Sequential editing with save-to-disk is sufficient.
- **User authentication.** Access control is handled at the network layer (Cloudflare tunnel with access policies, or simply sharing the URL only with trusted collaborators).
- **Version history UI.** Timestamped backups on disk are sufficient. No in-app diff viewer or rollback mechanism.
- **Structural editing.** The Content Editor cannot add, remove, or reorder HTML elements. This is the Document Author's responsibility via source code.
- **Rich text formatting toolbar.** No bold, italic, link, or image insertion controls. Text editing is limited to changing the words within existing styled elements.
- **Mobile editing.** Desktop browser support is sufficient.
- **Multi-user presence indicators.** No cursors, avatars, or "who's editing" display.

## Architecture

### Deployment

- Packaged as a Docker container.
- Single volume mount maps a host directory containing HTML document(s) to the container's working directory.
- Exposed on a single port (default 3000).
- Designed to sit behind a Cloudflare tunnel for external access, but also works on localhost for local editing.

### Technology Stack (Suggested)

- **Server:** Node.js with Express (lightweight, minimal dependencies) or Python with Flask.
- **Client:** Vanilla JavaScript injected into the served document. No framework dependency.
- **Storage:** Filesystem only. No database.

### Request Flow

```
Browser                          Server                         Disk
  |                                |                              |
  |  GET /                         |                              |
  |------------------------------->|                              |
  |  [returns file picker page]    |                              |
  |<-------------------------------|                              |
  |                                |                              |
  |  GET /edit/my-document.html    |                              |
  |------------------------------->|  read my-document.html       |
  |                                |----------------------------->|
  |                                |<-----------------------------|
  |  [injects editing script,      |                              |
  |   returns rendered document]   |                              |
  |<-------------------------------|                              |
  |                                |                              |
  |  POST /save/my-document.html   |                              |
  |  { html: "..." }              |                              |
  |------------------------------->|  backup previous version     |
  |                                |----------------------------->|
  |                                |  write updated file          |
  |                                |----------------------------->|
  |  [200 OK]                      |                              |
  |<-------------------------------|                              |
```

### Editing Script Injection

When serving a document for editing, the server injects a small script and minimal CSS before the closing `</body>` tag. This script:

1. Identifies editable elements (conventional text elements: `p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, etc. — excluding any with `data-no-edit`).
2. Adds `contenteditable="true"` to those elements.
3. Adds hover/focus styling for visual feedback.
4. Intercepts paste events to strip formatting and insert plain text only.
5. Renders a floating save button (fixed position, outside the document flow).
6. On save, extracts the document's current HTML, strips the injected editing script and styles, and POSTs the clean HTML to the server.

The injection approach means the original HTML file is never permanently modified with editing scaffolding — it remains a clean, portable document.

## User Workflows

### Document Author: Creating a New Document

1. Creates an HTML document with embedded CSS in their local editor.
2. Places the file in the mounted documents directory.
3. Optionally adds `data-no-edit` attributes to elements that should not be editable (e.g., fixed labels, footer boilerplate). All standard text elements are editable by default.
4. Starts the Docker container (or it's already running).

### Content Editor: Editing Text

1. Opens the shared URL in a browser.
2. Selects a document from the file picker.
3. Sees the fully rendered document as it will appear when printed.
4. Clicks on any editable text area to type changes. Editable areas are subtly highlighted on hover.
5. Clicks the save button (or presses Ctrl+S / Cmd+S).
6. Sees a confirmation that changes were saved.

### Document Author: Retrieving the Updated File

1. The updated HTML file is on disk in the mounted directory — ready to open in a browser and print to PDF.
2. Previous versions are in the backups subdirectory if needed.

## Future Considerations

These are out of scope for v1 but worth keeping in mind architecturally:

- **Basic formatting toolbar:** Bold, italic, links within editable regions. Requires careful scoping to avoid enabling structural changes.
- **Simple authentication:** Username/password or shared passphrase, for scenarios where Cloudflare access policies aren't available.
- **Change tracking:** Visual diff between the current version and last saved version, shown in the editing interface.
- **WebSocket live reload:** When the Document Author changes the HTML structure in their code editor, the Content Editor's browser refreshes automatically.
- **Export controls:** A "Print to PDF" button within the editing UI using the browser's native print dialog.
- **Template support:** Define reusable document structures where new documents can be created from the editing UI by filling in content fields.

## Design Decisions

1. **Editability scope:** Auto-detect. All conventional text-containing HTML elements (`p`, `h1`–`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`, `dt`, `dd`, `label`, `span` used as text containers, etc.) are editable by default. The Document Author may optionally exclude specific elements with `data-no-edit` to protect structural text such as fixed labels or footer boilerplate.

2. **Save granularity:** Whole-document save. On save, the full document HTML is written to disk. This is simpler to implement and reason about. The tradeoff — that a Content Editor could theoretically alter structure via browser dev tools — is acceptable given the trust model (known collaborators, not public users).

3. **File format scope:** HTML only. Markdown editing is available through other tools and can be copy-pasted into HTML documents via conventional workflows. No Markdown rendering pipeline is needed.

4. **Paste handling:** Plain text only. All paste events are intercepted and stripped to plain text before insertion. This prevents the Content Editor from inadvertently introducing foreign markup, inline styles, or structural elements from other sources.

# Galley: Implement Phase 5a — Landing Page Refresh

## Goal

Replace the current index page (`/`) with a new design that combines a sticky sidebar orientation panel with a thumbnail card grid for document browsing. Also add a new `/preview/:filename` route that serves documents without editing scripts, for use as card thumbnails.

The attached `dev/option-d-sidebar-gallery.html` is the approved design mockup. Use it as the visual and structural reference — the final implementation should match its layout, typography, spacing, and behavior.

## Context

Galley is a Node.js/Express app that serves HTML documents from a configurable directory (`GALLEY_DOCS_DIR`) with injected editing capabilities. The current index page is generated server-side in `src/server.js` as a simple HTML table listing filenames, last-modified dates, and download links, plus a file upload control.

Key files:
- `src/server.js` — Express routes including `GET /` (index), `GET /edit/:filename`, `POST /save/:filename`, `POST /upload`, `GET /download/:filename`, `GET /status/:filename`
- `src/injector.js` — injects Galley editing scripts/styles into served documents
- `src/galley-client.js` — client-side editing logic
- `src/galley-styles.css` — injected editor styles

Read `CLAUDE.md` in the project root for build commands, route details, and project conventions.

## Requirements

### 1. New `/preview/:filename` route

Add a route that serves documents **without** Galley's editing scripts and styles injected. This is needed so the index page can embed iframe thumbnails that show the document content without the editing UI (save button, toolbar, drag handles, etc.).

Behavior:
- Serves the raw HTML file from the documents directory, as-is
- No script injection, no style injection — just the file contents
- Returns 404 if the file doesn't exist
- Same filename validation/sanitization as the existing `/edit/:filename` route

This should be straightforward — it's essentially what `/download/:filename` does but with `Content-Type: text/html` instead of `Content-Disposition: attachment`.

### 2. Replace the index page

Replace the current `GET /` handler with a new page matching the Option D design. The page has two sections:

**Left sidebar (sticky, 280px):**
- "Galley" brand name
- "What is this?" section — brief explanation
- "How it works" section — numbered steps (1–4)
- "Good to know" section — backup and conflict info, mentions the `?` help button
- "Take a guided tour" link pinned to the bottom (this is a placeholder — the tour feature doesn't exist yet, so use `href="#"` for now)

**Right content area (fills remaining width):**
- "Documents" header with file count
- Card grid where each card has:
  - An iframe thumbnail pointing to `/preview/:filename` (scaled to 50% via CSS transform, `pointer-events: none`, `sandbox` attribute, `loading="lazy"`)
  - Document title (extracted from the HTML file's `<title>` tag)
  - Raw filename in monospace
  - Last-modified date
  - Download link
- An upload card at the end of the grid (dashed border, `+` icon, file input)

**Responsive behavior:**
- On narrow screens (≤860px), collapse to single column — sidebar stacks above the card grid
- Card grid columns adapt: 3 columns on wide (≥1401px), 2 on medium (1101–1400px), 1 on narrow

**Typography:** The design uses Google Fonts — Fraunces (display), Outfit (body), JetBrains Mono (monospace). Load these from Google Fonts CDN.

### 3. Extract document titles

The current index page shows raw filenames. The new design should extract the `<title>` content from each HTML file to display as the card title. This requires reading each file's content (or at least enough to find the `<title>` tag) when generating the index page.

Approach: When building the file list for the index, read each HTML file and extract the content between `<title>` and `</title>`. Fall back to the filename (without `.html`) if no title is found. This doesn't need to be a full HTML parser — a simple regex on the first few KB of the file is fine.

### 4. Preserve upload functionality

The current upload uses an inline script with XHR. Keep the same upload behavior (POST to `/upload`, redirect to `/edit/:filename` on success) but integrate it with the new upload card UI. The file input should be the full-size invisible overlay on the upload card, as shown in the mockup.

## Implementation Notes

- The index page HTML is currently generated inline in the route handler in `src/server.js`. The new page is more complex, so consider whether to keep it inline or extract it to a template function. Either approach is fine — Galley doesn't use a template engine, and adding one would be overengineering. A template literal function that takes the file list and returns HTML is the simplest path.
- The CSS from the mockup can be used nearly as-is. It's self-contained with CSS custom properties.
- The iframe thumbnails will load the full document content, which is fine for 4–10 files. The `loading="lazy"` attribute helps with initial page load. The `sandbox` attribute prevents scripts in the previewed documents from executing.
- Make sure the upload card's file input `accept=".html"` and the validation logic match the current behavior.
- The index page should not include any of Galley's editing scripts — it's a standalone page, not an editable document.

## What NOT to change

- Don't modify the editing experience (`/edit/:filename`) — that's unchanged
- Don't modify the save, download, status, or upload API routes
- Don't add any npm dependencies
- Don't modify `src/galley-client.js` or `src/galley-styles.css`

## Testing

After implementation:
1. `GET /` should show the new landing page with sidebar and card grid
2. `GET /preview/sample.html` should render the document without any Galley UI
3. Iframe thumbnails should show document previews (verify they don't have save buttons or editing controls)
4. Clicking a card should navigate to `/edit/:filename`
5. Upload via the upload card should work the same as before
6. Download links should still work
7. The page should be responsive — test at narrow widths
8. Document titles should be extracted from `<title>` tags, not just raw filenames

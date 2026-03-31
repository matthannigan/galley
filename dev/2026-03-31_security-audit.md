# Security Audit 2026-03-31: Galley

## Context

Galley is a self-hosted HTML editor with a deliberately minimal security surface: one production dependency (Express), no database, no built-in auth. Authentication is handled at the network layer (e.g., Cloudflare Gateway). This audit identifies vulnerabilities within that model — things that could be exploited by an authenticated user or that would compound with a network-layer misconfiguration.

---

## Findings

### 1. Stored XSS via `handleLinkCommand()` — HIGH

**File:** `src/galley-client.js:466-479`

The link creation prompt accepts any URL and passes it directly to `execCommand('createLink')`. A user can enter `javascript:alert(1)` — this link gets saved to the document and executes for anyone who opens it (including via `/preview/:filename`, which serves raw HTML).

The paste sanitizer already has the correct check at line 86: `/^(https?:|mailto:)/i.test(href)`. The link command doesn't use it.

**Fix:** Add the same protocol check after `prompt()`:
```javascript
var url = prompt('URL:', 'https://');
if (url && /^(https?:|mailto:)/i.test(url)) {
  document.execCommand('createLink', false, url);
}
```

**Test:** Add test in `tests/galley-client.test.js` confirming `javascript:` and `data:` URIs are rejected in `handleLinkCommand()`.

---

### 2. No security headers — MEDIUM

**File:** `src/app.js` (no middleware currently)

No `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or `Content-Security-Policy` headers. This means:
- Documents could be embedded in iframes on malicious sites (clickjacking)
- Browser MIME-sniffing could misinterpret responses
- Referrer leaks document names to external links

**Fix:** Add a lightweight middleware at the top of `createApp()`:
```javascript
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');  // SAMEORIGIN needed for index page iframe previews
  res.set('Referrer-Policy', 'no-referrer');
  next();
});
```

CSP is more nuanced — the `/edit` route uses inline scripts/styles (the injected editor), and documents themselves may contain inline styles. A strict CSP would break functionality. Options:
- **Option A**: Add CSP only to `/preview` route: `Content-Security-Policy: script-src 'none'` — prevents script execution in previews (defense-in-depth against stored XSS)
- **Option B**: No CSP for now, rely on the XSS fix in Finding #1

**Recommendation:** Option A — it's a single `res.set()` call on the preview route and neutralizes stored XSS in the most dangerous surface.

**Test:** Add tests in `tests/app.test.js` checking headers on responses from each route.

---

### 3. Preview route serves raw HTML without script restrictions — MEDIUM

**File:** `src/app.js:140-153`

`/preview/:filename` serves user HTML with no editing injection and no CSP. If a document contains `<script>` tags (from a malicious save, direct file edit, or the XSS in Finding #1), they execute. The index page loads previews in iframes from this route.

**Fix:** Addressed by the CSP header in Finding #2 (Option A): add `script-src 'none'` on the preview response. This allows CSS/images to render for thumbnails while blocking script execution.

---

### 4. Error messages leak filesystem details — LOW

**File:** `src/app.js:182, 203`

Error responses include `err.message`, which for filesystem errors can reveal absolute paths, permission details, or OS info (e.g., `EACCES: permission denied, open '/data/docs/test.html'`).

**Fix:** Return generic messages for 500 errors:
```javascript
// Line 182
res.status(500).json({ error: 'Save failed' });
// Line 203
res.status(500).json({ error: 'Upload failed' });
```
Log the full error server-side with `console.error(err)` for debugging.

**Test:** Verify 500 responses don't contain filesystem paths.

---

### 5. Unbounded backup growth — LOW

**File:** `src/app.js:41-46`

Every save creates a timestamped backup with no retention limit. Active editing could create hundreds of backups per document, eventually exhausting disk space.

**Fix:** After creating a backup, prune old backups for that document beyond a configurable limit (e.g., keep last 20 per document). Use `GALLEY_MAX_BACKUPS` env var (default 20, 0 = unlimited).

**Files:** `src/app.js` (add pruning after backup copy), `src/index.js` (read env var)

---

### 6. Content-Disposition header not RFC 5987 encoded — LOW

**File:** `src/app.js:136`

```javascript
res.set('Content-Disposition', `attachment; filename="${filename}"`);
```

Filenames with quotes or non-ASCII characters could cause header injection or garbled download names. Currently mitigated by `validateFilename()` rejecting special characters, but defense-in-depth suggests encoding.

**Fix:**
```javascript
res.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '\\"')}"`);
```

---

### 7. Static asset mount exposes all docs directory contents — INFO

**File:** `src/app.js:210`

```javascript
app.use('/edit', express.static(resolvedDocsDir));
```

This serves any file type from the docs directory under `/edit/`. If non-HTML files (images, PDFs, etc.) exist in the docs directory, they're accessible. This is intentional (for document-relative asset references), but worth noting:
- Route precedence ensures `.html` files hit the edit handler first
- Non-HTML files are served without the editing injection
- No directory listing (Express static default)

**No fix needed** — this is working as designed. Document in deployment guide if desired.

---

### 8. CSRF on POST endpoints — INFO (effectively mitigated)

POST endpoints (`/save`, `/upload`) require `Content-Type: application/json`. Browsers enforce CORS preflight on cross-origin requests with JSON content type, and Galley sets no `Access-Control-Allow-Origin` header. This means cross-origin form submissions and fetch requests are blocked by the browser.

**No fix needed** — the JSON content-type requirement + absence of permissive CORS headers is sufficient CSRF protection for this deployment model.

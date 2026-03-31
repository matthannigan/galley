import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { mkdtemp, readFile, readdir, copyFile, mkdir, writeFile } from 'fs/promises';
import request from 'supertest';
import createApp from '../src/app.js';
import { extractTitle } from '../src/index-page.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');
const app = createApp(fixturesDir);

describe('GET /health', () => {
  test('returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });
});

describe('GET / (file picker)', () => {
  test('returns HTML listing .html files', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('test.html');
  });

  test('links to /edit/:filename', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('href="/edit/test.html"');
  });

  test('does not list non-HTML files', async () => {
    const res = await request(app).get('/');
    expect(res.text).not.toContain('ignore-me.txt');
  });

  test('shows empty state when no HTML files exist', async () => {
    const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'galley-test-'));
    const emptyApp = createApp(emptyDir);
    const res = await request(emptyApp).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No HTML documents found');
  });
});

describe('GET /edit/:filename', () => {
  test('serves an HTML file with correct content type', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Test content');
  });

  test('returns 404 for nonexistent file', async () => {
    const res = await request(app).get('/edit/nonexistent.html');
    expect(res.status).toBe(404);
  });

  test('falls through to static middleware for non-HTML extension', async () => {
    const res = await request(app).get('/edit/file.js');
    expect(res.status).toBe(404);
  });

  test('serves static assets from docs directory', async () => {
    const res = await request(app).get('/edit/test-image.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
  });

  test('rejects path traversal (URL-normalized away from route)', async () => {
    // Express normalizes ../.. in URLs before routing, so these
    // never reach /edit/:filename — they 404 at the router level.
    const res = await request(app).get('/edit/../../etc/passwd');
    expect(res.status).toBe(404);
  });

  test('rejects path traversal even with .html extension', async () => {
    const res = await request(app).get('/edit/../etc/passwd.html');
    expect(res.status).toBe(404);
  });

  test('rejects encoded path traversal', async () => {
    // %2e%2e = ".." URL-encoded — test that the server-side check catches it
    const res = await request(app).get('/edit/%2e%2e%2fpasswd.html');
    expect(res.status).toBe(400);
  });
});

describe('GET /edit/:filename (injection)', () => {
  test('injects galley markers after opening <body> tag', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.text).toContain('<!-- galley:start -->');
    expect(res.text).toContain('<!-- galley:end -->');
    const bodyOpen = res.text.indexOf('<body>');
    const markerStart = res.text.indexOf('<!-- galley:start -->');
    expect(markerStart).toBeGreaterThan(bodyOpen);
  });

  test('injects <style> and <script> inside markers', async () => {
    const res = await request(app).get('/edit/test.html');
    const start = res.text.indexOf('<!-- galley:start -->');
    const end = res.text.indexOf('<!-- galley:end -->');
    const injected = res.text.slice(start, end);
    expect(injected).toContain('<style>');
    expect(injected).toContain('<script>');
  });

  test('injected script contains contenteditable logic', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.text).toContain('contenteditable');
    expect(res.text).toContain('galley-editable');
  });

  test('preserves original document content', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.text).toContain('Test content');
  });

  test('prepends injection when no <body> tag exists', async () => {
    const res = await request(app).get('/edit/no-body-tag.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<!-- galley:start -->');
    expect(res.text).toContain('<!-- galley:end -->');
    expect(res.text).toContain('Content without explicit body tags');
  });
});

describe('GET /download/:filename', () => {
  test('serves file as attachment with Content-Disposition header', async () => {
    const res = await request(app).get('/download/test.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('test.html');
  });

  test('serves raw HTML without galley injection', async () => {
    const res = await request(app).get('/download/test.html');
    expect(res.text).not.toContain('<!-- galley:start -->');
    expect(res.text).toContain('Test content');
  });

  test('returns 404 for nonexistent file', async () => {
    const res = await request(app).get('/download/nonexistent.html');
    expect(res.status).toBe(404);
  });

  test('returns 400 for non-HTML extension', async () => {
    const res = await request(app).get('/download/file.js');
    expect(res.status).toBe(400);
  });

  test('rejects path traversal', async () => {
    const res = await request(app).get('/download/%2e%2e%2fpasswd.html');
    expect(res.status).toBe(400);
  });
});

describe('GET /preview/:filename', () => {
  test('serves HTML file with correct content type', async () => {
    const res = await request(app).get('/preview/test.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Test content');
  });

  test('does not include Content-Disposition header', async () => {
    const res = await request(app).get('/preview/test.html');
    expect(res.headers['content-disposition']).toBeUndefined();
  });

  test('does not inject galley editing markers', async () => {
    const res = await request(app).get('/preview/test.html');
    expect(res.text).not.toContain('<!-- galley:start -->');
    expect(res.text).not.toContain('galley-ui');
  });

  test('returns 404 for nonexistent file', async () => {
    const res = await request(app).get('/preview/nonexistent.html');
    expect(res.status).toBe(404);
  });

  test('falls through to static middleware for non-HTML extension', async () => {
    const res = await request(app).get('/preview/file.js');
    expect(res.status).toBe(404);
  });

  test('serves static assets from docs directory', async () => {
    const res = await request(app).get('/preview/test-image.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
  });

  test('rejects path traversal', async () => {
    const res = await request(app).get('/preview/%2e%2e%2fpasswd.html');
    expect(res.status).toBe(400);
  });
});

describe('file picker includes download links', () => {
  test('each file row has a download link', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('/download/test.html');
  });
});

describe('POST /save/:filename', () => {
  let tmpDir;
  let docsDir;
  let tmpApp;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-save-'));
    docsDir = path.join(tmpDir, 'docs');
    await mkdir(docsDir);
    await copyFile(
      path.join(fixturesDir, 'test.html'),
      path.join(docsDir, 'test.html')
    );
    tmpApp = createApp(docsDir);
  });

  test('saves updated HTML to disk', async () => {
    const newHtml = '<!DOCTYPE html>\n<html><head><title>Test</title></head>\n<body><p>Updated content</p></body></html>';
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: newHtml });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBeDefined();

    const saved = await readFile(path.join(docsDir, 'test.html'), 'utf-8');
    expect(saved).toBe(newHtml);
  });

  test('creates timestamped backup before overwriting', async () => {
    const newHtml = '<!DOCTYPE html>\n<html><head><title>Test</title></head>\n<body><p>New</p></body></html>';
    await request(tmpApp)
      .post('/save/test.html')
      .send({ html: newHtml });

    const backupsDir = path.join(tmpDir, 'backups');
    const backups = await readdir(backupsDir);
    expect(backups.length).toBe(1);
    expect(backups[0]).toMatch(/^test\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.html$/);

    const backupContent = await readFile(path.join(backupsDir, backups[0]), 'utf-8');
    expect(backupContent).toContain('Test content');
  });

  test('writes exactly what the client sends (no server-side stripping)', async () => {
    const htmlWithMarkers = '<!DOCTYPE html>\n<html><body><!-- galley:start -->artifact<!-- galley:end --><p>Text</p></body></html>';
    await request(tmpApp)
      .post('/save/test.html')
      .send({ html: htmlWithMarkers });

    const saved = await readFile(path.join(docsDir, 'test.html'), 'utf-8');
    expect(saved).toBe(htmlWithMarkers);
  });

  test('returns 400 for non-HTML extension', async () => {
    const res = await request(tmpApp)
      .post('/save/file.js')
      .send({ html: '<html></html>' });
    expect(res.status).toBe(400);
  });

  test('rejects path traversal', async () => {
    const res = await request(tmpApp)
      .post('/save/%2e%2e%2fpasswd.html')
      .send({ html: '<html></html>' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when html field is missing', async () => {
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when html field is empty string', async () => {
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: '' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for nonexistent file', async () => {
    const res = await request(tmpApp)
      .post('/save/nonexistent.html')
      .send({ html: '<html></html>' });
    expect(res.status).toBe(404);
  });

  test('handles rapid successive saves without corruption', async () => {
    const html1 = '<!DOCTYPE html>\n<html><body><p>Save 1</p></body></html>';
    const html2 = '<!DOCTYPE html>\n<html><body><p>Save 2</p></body></html>';

    const res1 = await request(tmpApp).post('/save/test.html').send({ html: html1 });
    const res2 = await request(tmpApp).post('/save/test.html').send({ html: html2 });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const saved = await readFile(path.join(docsDir, 'test.html'), 'utf-8');
    expect(saved).toBe(html2);

    // Verify no temp files left behind
    const files = await readdir(docsDir);
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    expect(tmpFiles.length).toBe(0);

    // Both saves should have created backups
    const backups = await readdir(path.join(tmpDir, 'backups'));
    expect(backups.length).toBeGreaterThanOrEqual(1);
  });

  test('saves backups to custom backupDir when configured', async () => {
    const customBackupDir = await mkdtemp(path.join(os.tmpdir(), 'galley-backup-'));
    const customApp = createApp(docsDir, { backupDir: customBackupDir });

    const newHtml = '<!DOCTYPE html>\n<html><body><p>Custom backup test</p></body></html>';
    const res = await request(customApp)
      .post('/save/test.html')
      .send({ html: newHtml });
    expect(res.status).toBe(200);

    // Backup should be in custom dir, not in docsDir/.galley-backups
    const backups = await readdir(customBackupDir);
    expect(backups.length).toBe(1);
    expect(backups[0]).toMatch(/^test\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.html$/);

    const backupContent = await readFile(path.join(customBackupDir, backups[0]), 'utf-8');
    expect(backupContent).toContain('Test content');
  });
});

describe('POST /upload', () => {
  let tmpDir;
  let docsDir;
  let tmpApp;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-upload-'));
    docsDir = path.join(tmpDir, 'docs');
    await mkdir(docsDir);
    tmpApp = createApp(docsDir);
  });

  test('uploads a new HTML file', async () => {
    const html = '<!DOCTYPE html>\n<html><body><p>New file</p></body></html>';
    const res = await request(tmpApp)
      .post('/upload')
      .send({ filename: 'new.html', html });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const saved = await readFile(path.join(docsDir, 'new.html'), 'utf-8');
    expect(saved).toBe(html);
  });

  test('uploaded file is accessible via /edit', async () => {
    const html = '<!DOCTYPE html>\n<html><body><p>Uploaded</p></body></html>';
    await request(tmpApp).post('/upload').send({ filename: 'uploaded.html', html });

    const res = await request(tmpApp).get('/edit/uploaded.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Uploaded');
  });

  test('creates backup when overwriting existing file', async () => {
    // Create initial file
    const original = '<!DOCTYPE html>\n<html><body><p>Original</p></body></html>';
    await request(tmpApp).post('/upload').send({ filename: 'doc.html', html: original });

    // Upload again with same name
    const updated = '<!DOCTYPE html>\n<html><body><p>Updated</p></body></html>';
    const res = await request(tmpApp).post('/upload').send({ filename: 'doc.html', html: updated });
    expect(res.status).toBe(200);

    const saved = await readFile(path.join(docsDir, 'doc.html'), 'utf-8');
    expect(saved).toBe(updated);

    const backups = await readdir(path.join(tmpDir, 'backups'));
    expect(backups.length).toBe(1);
    const backupContent = await readFile(path.join(tmpDir, 'backups', backups[0]), 'utf-8');
    expect(backupContent).toBe(original);
  });

  test('rejects non-HTML filename', async () => {
    const res = await request(tmpApp)
      .post('/upload')
      .send({ filename: 'file.js', html: '<html></html>' });
    expect(res.status).toBe(400);
  });

  test('rejects path traversal in filename', async () => {
    const res = await request(tmpApp)
      .post('/upload')
      .send({ filename: '../evil.html', html: '<html></html>' });
    expect(res.status).toBe(400);
  });

  test('rejects missing filename', async () => {
    const res = await request(tmpApp)
      .post('/upload')
      .send({ html: '<html></html>' });
    expect(res.status).toBe(400);
  });

  test('rejects missing html field', async () => {
    const res = await request(tmpApp)
      .post('/upload')
      .send({ filename: 'test.html' });
    expect(res.status).toBe(400);
  });

  test('rejects empty html field', async () => {
    const res = await request(tmpApp)
      .post('/upload')
      .send({ filename: 'test.html', html: '' });
    expect(res.status).toBe(400);
  });
});

describe('formatting tag round-trip', () => {
  let tmpDir;
  let docsDir;
  let tmpApp;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-fmt-'));
    docsDir = path.join(tmpDir, 'docs');
    await mkdir(docsDir);
    await copyFile(
      path.join(fixturesDir, 'formatted-content.html'),
      path.join(docsDir, 'formatted-content.html')
    );
    tmpApp = createApp(docsDir);
  });

  test('formatting tags survive save round-trip', async () => {
    const htmlWithFormatting = '<!DOCTYPE html>\n<html><head><title>Formatted Test</title></head>\n' +
      '<body><p>This has <strong>bold</strong>, <em>italic</em>, and <a href="https://example.com">a link</a>.</p></body></html>';
    const res = await request(tmpApp)
      .post('/save/formatted-content.html')
      .send({ html: htmlWithFormatting });
    expect(res.status).toBe(200);

    const saved = await readFile(path.join(docsDir, 'formatted-content.html'), 'utf-8');
    expect(saved).toContain('<strong>bold</strong>');
    expect(saved).toContain('<em>italic</em>');
    expect(saved).toContain('<a href="https://example.com">a link</a>');
  });

  test('injected content includes toolbar styles', async () => {
    const res = await request(tmpApp).get('/edit/formatted-content.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('galley-toolbar');
  });
});

describe('file picker includes upload control', () => {
  test('page contains upload input with multiple support', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('galley-upload');
    expect(res.text).toContain('type="file"');
    expect(res.text).toContain('multiple');
  });
});

describe('GET /status/:filename', () => {
  test('returns lastModified timestamp', async () => {
    const res = await request(app).get('/status/test.html');
    expect(res.status).toBe(200);
    expect(res.body.lastModified).toBeDefined();
    // Verify it's a valid ISO date
    expect(new Date(res.body.lastModified).toISOString()).toBe(res.body.lastModified);
  });

  test('returns 404 for nonexistent file', async () => {
    const res = await request(app).get('/status/nonexistent.html');
    expect(res.status).toBe(404);
  });

  test('returns 400 for non-HTML extension', async () => {
    const res = await request(app).get('/status/file.js');
    expect(res.status).toBe(400);
  });

  test('rejects path traversal', async () => {
    const res = await request(app).get('/status/%2e%2e%2fpasswd.html');
    expect(res.status).toBe(400);
  });
});

describe('GET /edit/:filename (version)', () => {
  test('includes data-galley-version attribute', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/data-galley-version="[^"]+"/);
  });

  test('version matches file mtime', async () => {
    const res = await request(app).get('/edit/test.html');
    const match = res.text.match(/data-galley-version="([^"]+)"/);
    expect(match).not.toBeNull();
    const statusRes = await request(app).get('/status/test.html');
    expect(match[1]).toBe(statusRes.body.lastModified);
  });
});

describe('POST /save/:filename (version conflict)', () => {
  let tmpDir;
  let docsDir;
  let tmpApp;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-conflict-'));
    docsDir = path.join(tmpDir, 'docs');
    await mkdir(docsDir);
    await copyFile(
      path.join(fixturesDir, 'test.html'),
      path.join(docsDir, 'test.html')
    );
    tmpApp = createApp(docsDir);
  });

  test('saves successfully with matching version', async () => {
    const statusRes = await request(tmpApp).get('/status/test.html');
    const currentVersion = statusRes.body.lastModified;

    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: '<html><body>Updated</body></html>', version: currentVersion });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBeDefined();
    // New version should differ from old version after write
    expect(res.body.version).not.toBe(currentVersion);
  });

  test('returns 409 when version does not match', async () => {
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: '<html><body>Stale</body></html>', version: '2000-01-01T00:00:00.000Z' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('updated since');
    expect(res.body.currentVersion).toBeDefined();
  });

  test('saves successfully without version (backwards compat)', async () => {
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: '<html><body>No version</body></html>' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.version).toBeDefined();
  });

  test('returns new version in save response', async () => {
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: '<html><body>Check version</body></html>' });
    expect(res.status).toBe(200);
    // Returned version should be a valid ISO date
    expect(new Date(res.body.version).toISOString()).toBe(res.body.version);
  });
});

describe('index page structure', () => {
  test('contains iframe thumbnails with /preview/ src', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('src="/preview/test.html"');
    expect(res.text).not.toContain('src="/edit/test.html"');
  });

  test('shows document title extracted from file', async () => {
    const res = await request(app).get('/');
    // test.html has <title>Test</title>
    expect(res.text).toContain('>Test</a>');
  });

  test('shows file count', async () => {
    const res = await request(app).get('/');
    expect(res.text).toMatch(/\d+ files?/);
  });

  test('shows sidebar with brand and sections', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('class="panel-brand"');
    expect(res.text).toContain('What is this?');
    expect(res.text).toContain('How it works');
    expect(res.text).toContain('Good to know');
  });
});

describe('extractTitle', () => {
  test('extracts title from HTML', () => {
    expect(extractTitle('<html><head><title>My Doc</title></head></html>', 'file.html'))
      .toBe('My Doc');
  });

  test('falls back to filename without .html when no title tag', () => {
    expect(extractTitle('<html><body>No title</body></html>', 'my-doc.html'))
      .toBe('my-doc');
  });

  test('falls back when title tag is empty', () => {
    expect(extractTitle('<html><head><title></title></head></html>', 'report.html'))
      .toBe('report');
  });

  test('handles whitespace in title', () => {
    expect(extractTitle('<html><head><title>  Spaced Title  </title></head></html>', 'file.html'))
      .toBe('Spaced Title');
  });

  test('decodes HTML entities in title', () => {
    expect(extractTitle('<html><head><title>R&amp;D Lab &mdash; Overview</title></head></html>', 'file.html'))
      .toBe('R&D Lab \u2014 Overview');
  });
});

describe('block operations integration', () => {
  let tmpDir;
  let docsDir;
  let tmpApp;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-block-'));
    docsDir = path.join(tmpDir, 'docs');
    await mkdir(docsDir);
    await copyFile(
      path.join(fixturesDir, 'test.html'),
      path.join(docsDir, 'test.html')
    );
    tmpApp = createApp(docsDir);
  });

  test('data-galley-block attributes survive save round-trip', async () => {
    const htmlWithBlocks = '<!DOCTYPE html>\n<html><head><title>Test</title></head><body>' +
      '<div data-galley-block><p>Block One</p></div>' +
      '<div data-galley-block><p>Block Two</p></div>' +
      '</body></html>';
    await request(tmpApp)
      .post('/save/test.html')
      .send({ html: htmlWithBlocks });
    const res = await request(tmpApp).get('/edit/test.html');
    expect(res.text).toContain('data-galley-block');
    expect(res.text).toContain('Block One');
    expect(res.text).toContain('Block Two');
  });

  test('injected payload includes SortableJS script', async () => {
    const res = await request(tmpApp).get('/edit/test.html');
    // SortableJS defines a Sortable constructor
    expect(res.text).toContain('Sortable');
    // Should have two script tags inside galley-ui
    const galleyStart = res.text.indexOf('galley:start');
    const galleyEnd = res.text.indexOf('galley:end');
    const galleyBlock = res.text.substring(galleyStart, galleyEnd);
    const scriptCount = (galleyBlock.match(/<script>/g) || []).length;
    expect(scriptCount).toBe(2);
  });
});

describe('security headers', () => {
  test('all routes include X-Content-Type-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('all routes include X-Frame-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('all routes include Referrer-Policy', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  test('preview route includes Content-Security-Policy blocking scripts', async () => {
    const res = await request(app).get('/preview/test.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBe("script-src 'none'");
  });

  test('edit route does not include script-blocking CSP', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});

describe('backup retention', () => {
  test('prunes old backups beyond maxBackups limit', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-prune-'));
    const tmpDocsDir = path.join(tmpDir, 'docs');
    const tmpBackupDir = path.join(tmpDir, 'backups');
    await mkdir(tmpDocsDir, { recursive: true });
    await mkdir(tmpBackupDir, { recursive: true });
    await copyFile(path.join(fixturesDir, 'test.html'), path.join(tmpDocsDir, 'test.html'));

    // Pre-seed 4 old backups with distinct timestamps
    for (let i = 0; i < 4; i++) {
      await writeFile(
        path.join(tmpBackupDir, `test.2026-01-0${i + 1}T00-00-00.html`),
        `<html><body>old ${i}</body></html>`
      );
    }

    const pruneApp = createApp(tmpDocsDir, { backupDir: tmpBackupDir, maxBackups: 3 });
    // This save creates a 5th backup, then prunes to 3
    await request(pruneApp)
      .post('/save/test.html')
      .send({ html: '<!DOCTYPE html><html><body><p>New</p></body></html>' })
      .expect(200);

    const backups = await readdir(tmpBackupDir);
    const testBackups = backups.filter(f => f.startsWith('test.'));
    expect(testBackups.length).toBe(3);
  });

  test('maxBackups 0 keeps all backups', async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-noprune-'));
    const tmpDocsDir = path.join(tmpDir, 'docs');
    const tmpBackupDir = path.join(tmpDir, 'backups');
    await mkdir(tmpDocsDir, { recursive: true });
    await mkdir(tmpBackupDir, { recursive: true });
    await copyFile(path.join(fixturesDir, 'test.html'), path.join(tmpDocsDir, 'test.html'));

    // Pre-seed 4 old backups
    for (let i = 0; i < 4; i++) {
      await writeFile(
        path.join(tmpBackupDir, `test.2026-01-0${i + 1}T00-00-00.html`),
        `<html><body>old ${i}</body></html>`
      );
    }

    const noLimitApp = createApp(tmpDocsDir, { backupDir: tmpBackupDir, maxBackups: 0 });
    await request(noLimitApp)
      .post('/save/test.html')
      .send({ html: '<!DOCTYPE html><html><body><p>New</p></body></html>' })
      .expect(200);

    const backups = await readdir(tmpBackupDir);
    const testBackups = backups.filter(f => f.startsWith('test.'));
    expect(testBackups.length).toBe(5);
  });
});

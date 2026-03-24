import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { mkdtemp, readFile, readdir, copyFile } from 'fs/promises';
import request from 'supertest';
import createApp from '../src/app.js';

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

  test('returns 400 for non-HTML extension', async () => {
    const res = await request(app).get('/edit/file.js');
    expect(res.status).toBe(400);
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
  test('injects galley markers before </body>', async () => {
    const res = await request(app).get('/edit/test.html');
    expect(res.text).toContain('<!-- galley:start -->');
    expect(res.text).toContain('<!-- galley:end -->');
    const markerEnd = res.text.indexOf('<!-- galley:end -->');
    const bodyClose = res.text.indexOf('</body>');
    expect(markerEnd).toBeLessThan(bodyClose);
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

  test('appends injection when no </body> tag exists', async () => {
    const res = await request(app).get('/edit/no-body-tag.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<!-- galley:start -->');
    expect(res.text).toContain('<!-- galley:end -->');
    expect(res.text).toContain('Content without explicit body tags');
  });
});

describe('POST /save/:filename', () => {
  let tmpDir;
  let tmpApp;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'galley-save-'));
    await copyFile(
      path.join(fixturesDir, 'test.html'),
      path.join(tmpDir, 'test.html')
    );
    tmpApp = createApp(tmpDir);
  });

  test('saves updated HTML to disk', async () => {
    const newHtml = '<!DOCTYPE html>\n<html><head><title>Test</title></head>\n<body><p>Updated content</p></body></html>';
    const res = await request(tmpApp)
      .post('/save/test.html')
      .send({ html: newHtml });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const saved = await readFile(path.join(tmpDir, 'test.html'), 'utf-8');
    expect(saved).toBe(newHtml);
  });

  test('creates timestamped backup before overwriting', async () => {
    const newHtml = '<!DOCTYPE html>\n<html><head><title>Test</title></head>\n<body><p>New</p></body></html>';
    await request(tmpApp)
      .post('/save/test.html')
      .send({ html: newHtml });

    const backupDir = path.join(tmpDir, '.galley-backups');
    const backups = await readdir(backupDir);
    expect(backups.length).toBe(1);
    expect(backups[0]).toMatch(/^test\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.html$/);

    const backupContent = await readFile(path.join(backupDir, backups[0]), 'utf-8');
    expect(backupContent).toContain('Test content');
  });

  test('writes exactly what the client sends (no server-side stripping)', async () => {
    const htmlWithMarkers = '<!DOCTYPE html>\n<html><body><!-- galley:start -->artifact<!-- galley:end --><p>Text</p></body></html>';
    await request(tmpApp)
      .post('/save/test.html')
      .send({ html: htmlWithMarkers });

    const saved = await readFile(path.join(tmpDir, 'test.html'), 'utf-8');
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

    const saved = await readFile(path.join(tmpDir, 'test.html'), 'utf-8');
    expect(saved).toBe(html2);

    // Verify no temp files left behind
    const files = await readdir(tmpDir);
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    expect(tmpFiles.length).toBe(0);

    // Both saves should have created backups
    const backups = await readdir(path.join(tmpDir, '.galley-backups'));
    expect(backups.length).toBeGreaterThanOrEqual(1);
  });
});

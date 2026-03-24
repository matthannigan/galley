import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { mkdtemp } from 'fs/promises';
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

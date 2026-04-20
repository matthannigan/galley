import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { readFile, readdir, stat, access, writeFile, rename, mkdir, copyFile, unlink } from 'fs/promises';
import { injectEditing } from './injector.js';
import { renderIndexPage, extractTitle, renderConfirmPage } from './index-page.js';

const DEFAULT_STATIC_EXTENSIONS = [
  '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.css',
  '.pdf',
];

export default function createApp(docsDir, options = {}) {
  const app = express();
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '5mb' }));
  const resolvedDocsDir = path.resolve(docsDir);
  const resolvedBackupDir = options.backupDir
    ? path.resolve(options.backupDir)
    : path.join(resolvedDocsDir, '..', 'backups');
  const maxBackups = options.maxBackups ?? 20;
  const deleteEnabled = options.deleteEnabled === true;
  const allowedStaticExtensions = new Set(
    (options.allowedStaticExtensions || DEFAULT_STATIC_EXTENSIONS)
      .map(ext => ext.startsWith('.') ? ext : '.' + ext)
  );

  function validateFilename(filename) {
    if (!filename.endsWith('.html')) {
      return { error: 'Only .html files are allowed', status: 400 };
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return { error: 'Invalid filename', status: 400 };
    }
    const filePath = path.join(resolvedDocsDir, filename);
    if (!filePath.startsWith(resolvedDocsDir + path.sep)) {
      return { error: 'Invalid filename', status: 400 };
    }
    return { filePath };
  }

  async function backupFile(filePath, { requireExists = true } = {}) {
    let exists = true;
    try {
      await access(filePath);
    } catch {
      if (requireExists) throw Object.assign(new Error('File not found'), { statusCode: 404 });
      exists = false;
    }

    if (exists) {
      await mkdir(resolvedBackupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
      const baseName = path.basename(filePath, '.html');
      const backupName = `${baseName}.${timestamp}.html`;
      await copyFile(filePath, path.join(resolvedBackupDir, backupName));

      // Prune old backups for this document
      if (maxBackups > 0) {
        const allFiles = await readdir(resolvedBackupDir);
        const prefix = baseName + '.';
        const backups = allFiles.filter(f => f.startsWith(prefix) && f.endsWith('.html')).sort();
        if (backups.length > maxBackups) {
          for (const old of backups.slice(0, backups.length - maxBackups)) {
            try { await unlink(path.join(resolvedBackupDir, old)); } catch { /* best-effort */ }
          }
        }
      }
    }

    return { exists };
  }

  async function atomicWriteWithBackup(filePath, content, { requireExists = true } = {}) {
    await backupFile(filePath, { requireExists });

    const tempPath = filePath + '.tmp.' + Date.now();
    await writeFile(tempPath, content, 'utf-8');
    try {
      await rename(tempPath, filePath);
    } catch (renameErr) {
      try { await unlink(tempPath); } catch { /* best-effort cleanup */ }
      throw renameErr;
    }
  }

  async function backupAndDelete(filePath) {
    await backupFile(filePath, { requireExists: true });
    await unlink(filePath);
  }

  app.get('/health', (req, res) => {
    res.status(200).send('ok');
  });

  app.get('/', async (req, res) => {
    const entries = await readdir(resolvedDocsDir);
    const htmlFiles = [];

    for (const entry of entries) {
      if (!entry.endsWith('.html') || entry.startsWith('.')) continue;
      const filePath = path.join(resolvedDocsDir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;
      const content = await readFile(filePath, 'utf-8');
      const title = extractTitle(content, entry);
      htmlFiles.push({ name: entry, modified: fileStat.mtime, title });
    }

    htmlFiles.sort((a, b) => b.modified - a.modified);
    res.type('html').send(renderIndexPage(htmlFiles));
  });

  app.get('/favicon.svg', (req, res) => {
    res.type('image/svg+xml').sendFile(path.join(__dirname, 'favicon.svg'));
  });

  app.get('/favicon.ico', (req, res) => {
    res.redirect(301, '/favicon.svg');
  });

  app.get('/status/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).json({ error: result.error });

    try {
      const fileStat = await stat(result.filePath);
      res.json({ lastModified: fileStat.mtime.toISOString() });
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
  });

  app.get('/edit/:filename', async (req, res, next) => {
    const { filename } = req.params;
    if (!filename.endsWith('.html')) return next();
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    let fileStat;
    try {
      fileStat = await stat(result.filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(result.filePath, 'utf-8');
    const injected = await injectEditing(html);
    const version = fileStat.mtime.toISOString();
    const withVersion = injected.replace(
      '<div id="galley-ui">',
      `<div id="galley-ui" data-galley-version="${version}">`
    );
    res.type('html').send(withVersion);
  });

  app.get('/download/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    try {
      await access(result.filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(result.filePath, 'utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '\\"')}"`);
    res.type('html').send(html);
  });

  app.get('/preview/:filename', async (req, res, next) => {
    const { filename } = req.params;
    if (!filename.endsWith('.html')) return next();
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    try {
      await access(result.filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(result.filePath, 'utf-8');
    res.set('Content-Security-Policy', "script-src 'none'");
    res.type('html').send(html);
  });

  app.post('/save/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).json({ error: result.error });

    if (!req.body || typeof req.body.html !== 'string' || req.body.html.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid html field' });
    }

    try {
      // Version conflict check: if client sends a version, verify it matches
      if (req.body.version) {
        const fileStat = await stat(result.filePath);
        const currentVersion = fileStat.mtime.toISOString();
        if (req.body.version !== currentVersion) {
          return res.status(409).json({
            error: 'This document was updated since you last loaded it.',
            currentVersion
          });
        }
      }

      await atomicWriteWithBackup(result.filePath, req.body.html, { requireExists: true });
      const newStat = await stat(result.filePath);
      res.json({ ok: true, version: newStat.mtime.toISOString() });
    } catch (err) {
      if (err.statusCode === 404) return res.status(404).json({ error: 'File not found' });
      console.error('Save error:', err);
      res.status(500).json({ error: 'Save failed' });
    }
  });

  app.post('/upload', async (req, res) => {
    if (!req.body || typeof req.body.filename !== 'string' || !req.body.filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }

    const { filename } = req.body;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).json({ error: result.error });

    if (typeof req.body.html !== 'string' || req.body.html.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid html field' });
    }

    try {
      await atomicWriteWithBackup(result.filePath, req.body.html, { requireExists: false });
      res.json({ ok: true });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  app.get('/delete', async (req, res) => {
    if (!deleteEnabled) return res.status(404).send('Not found');

    const entries = await readdir(resolvedDocsDir);
    const htmlFiles = [];

    for (const entry of entries) {
      if (!entry.endsWith('.html') || entry.startsWith('.')) continue;
      const filePath = path.join(resolvedDocsDir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;
      const content = await readFile(filePath, 'utf-8');
      const title = extractTitle(content, entry);
      htmlFiles.push({ name: entry, modified: fileStat.mtime, title });
    }

    htmlFiles.sort((a, b) => b.modified - a.modified);
    res.type('html').send(renderIndexPage(htmlFiles, { mode: 'delete' }));
  });

  app.get('/delete/:filename', async (req, res) => {
    if (!deleteEnabled) return res.status(404).send('Not found');

    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    let html;
    try {
      html = await readFile(result.filePath, 'utf-8');
    } catch {
      return res.status(404).send('File not found');
    }

    const title = extractTitle(html, filename);
    res.type('html').send(renderConfirmPage({ filename, title }));
  });

  app.post('/delete/:filename', async (req, res) => {
    if (!deleteEnabled) return res.status(404).send('Not found');

    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).json({ error: result.error });

    if (!req.body || req.body.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmation required: send { confirm: "DELETE" }' });
    }

    try {
      await backupAndDelete(result.filePath);
      res.json({ ok: true });
    } catch (err) {
      if (err.statusCode === 404) return res.status(404).json({ error: 'File not found' });
      console.error('Delete error:', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  // Serve static assets (images, fonts, etc.) from the docs directory
  // so that relative references in HTML documents resolve correctly.
  // Only whitelisted extensions are served; all others are rejected.
  function staticExtensionFilter(req, res, next) {
    const ext = path.extname(req.path).toLowerCase();
    if (!ext || !allowedStaticExtensions.has(ext)) {
      return res.status(404).send('Not found');
    }
    next();
  }
  const staticOptions = {
    setHeaders(res) {
      res.set('Cache-Control', 'no-cache');
    },
  };
  app.use('/edit', staticExtensionFilter, express.static(resolvedDocsDir, staticOptions));
  app.use('/preview', staticExtensionFilter, express.static(resolvedDocsDir, staticOptions));

  return app;
}

import express from 'express';
import path from 'path';
import { readFile, readdir, stat, access, writeFile, rename, mkdir, copyFile, unlink } from 'fs/promises';
import { injectEditing } from './injector.js';
import { renderIndexPage, extractTitle } from './index-page.js';

export default function createApp(docsDir, options = {}) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  const resolvedDocsDir = path.resolve(docsDir);
  const resolvedBackupDir = options.backupDir
    ? path.resolve(options.backupDir)
    : path.join(resolvedDocsDir, '..', 'backups');

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

  async function atomicWriteWithBackup(filePath, content, { requireExists = true } = {}) {
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
    }

    const tempPath = filePath + '.tmp.' + Date.now();
    await writeFile(tempPath, content, 'utf-8');
    try {
      await rename(tempPath, filePath);
    } catch (renameErr) {
      try { await unlink(tempPath); } catch { /* best-effort cleanup */ }
      throw renameErr;
    }
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

  app.get('/edit/:filename', async (req, res) => {
    const { filename } = req.params;
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
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.type('html').send(html);
  });

  app.get('/preview/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    try {
      await access(result.filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(result.filePath, 'utf-8');
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
      res.status(500).json({ error: 'Save failed: ' + err.message });
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
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  });

  // Serve static assets (images, fonts, etc.) from the docs directory
  // so that relative references in HTML documents resolve correctly.
  // Mounted after the /edit/:filename route so .html files are handled above.
  app.use('/edit', express.static(resolvedDocsDir));

  return app;
}

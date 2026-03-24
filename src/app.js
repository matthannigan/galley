import express from 'express';
import path from 'path';
import { readFile, readdir, stat, access, writeFile, rename, mkdir, copyFile, unlink } from 'fs/promises';
import { injectEditing } from './injector.js';

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function createApp(docsDir, options = {}) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  const resolvedDocsDir = path.resolve(docsDir);
  const resolvedBackupDir = options.backupDir
    ? path.resolve(options.backupDir)
    : path.join(resolvedDocsDir, '.galley-backups');

  app.get('/health', (req, res) => {
    res.send('ok');
  });

  app.get('/', async (req, res) => {
    const entries = await readdir(resolvedDocsDir);
    const htmlFiles = [];

    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      const fileStat = await stat(path.join(resolvedDocsDir, entry));
      if (!fileStat.isFile()) continue;
      htmlFiles.push({ name: entry, modified: fileStat.mtime });
    }

    htmlFiles.sort((a, b) => a.name.localeCompare(b.name));

    const fileRows = htmlFiles.length > 0
      ? htmlFiles.map(f => `
          <tr>
            <td><a href="/edit/${encodeURIComponent(f.name)}">${escapeHtml(f.name)}</a></td>
            <td>${f.modified.toLocaleString()}</td>
          </tr>`).join('')
      : '<tr><td colspan="2" class="empty">No HTML documents found.</td></tr>';

    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galley</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 3rem 1.5rem; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e0e0e0; }
    th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
    td a { color: #2c5f8a; text-decoration: none; }
    td a:hover { text-decoration: underline; }
    .empty { color: #888; font-style: italic; text-align: center; padding: 2rem; }
  </style>
</head>
<body>
  <h1>Galley</h1>
  <table>
    <thead><tr><th>Document</th><th>Last Modified</th></tr></thead>
    <tbody>${fileRows}</tbody>
  </table>
</body>
</html>`);
  });

  app.get('/edit/:filename', async (req, res) => {
    const { filename } = req.params;

    if (!filename.endsWith('.html')) {
      return res.status(400).send('Only .html files can be edited');
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).send('Invalid filename');
    }

    const filePath = path.join(resolvedDocsDir, filename);

    if (!filePath.startsWith(resolvedDocsDir + path.sep)) {
      return res.status(400).send('Invalid filename');
    }

    try {
      await access(filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(filePath, 'utf-8');
    const injected = await injectEditing(html);
    res.type('html').send(injected);
  });

  app.post('/save/:filename', async (req, res) => {
    const { filename } = req.params;

    if (!filename.endsWith('.html')) {
      return res.status(400).json({ error: 'Only .html files can be saved' });
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(resolvedDocsDir, filename);

    if (!filePath.startsWith(resolvedDocsDir + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!req.body || typeof req.body.html !== 'string' || req.body.html.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid html field' });
    }

    try {
      await access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      // Create backup
      await mkdir(resolvedBackupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
      const baseName = filename.replace(/\.html$/, '');
      const backupName = `${baseName}.${timestamp}.html`;
      await copyFile(filePath, path.join(resolvedBackupDir, backupName));

      // Atomic write: temp file then rename
      const tempPath = filePath + '.tmp.' + Date.now();
      await writeFile(tempPath, req.body.html, 'utf-8');
      try {
        await rename(tempPath, filePath);
      } catch (renameErr) {
        try { await unlink(tempPath); } catch { /* best-effort cleanup */ }
        throw renameErr;
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Save failed: ' + err.message });
    }
  });

  // Serve static assets (images, fonts, etc.) from the docs directory
  // so that relative references in HTML documents resolve correctly.
  // Mounted after the /edit/:filename route so .html files are handled above.
  app.use('/edit', express.static(resolvedDocsDir));

  return app;
}

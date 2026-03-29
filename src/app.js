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
            <td><a href="/download/${encodeURIComponent(f.name)}" class="action-link">Download</a></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="empty">No HTML documents found.</td></tr>';

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
    .action-link { font-size: 0.8125rem; color: #666; }
    .action-link:hover { color: #2c5f8a; }
    .empty { color: #888; font-style: italic; text-align: center; padding: 2rem; }
    .upload-section { margin-top: 2rem; }
    .upload-section label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 0.5rem; }
    .upload-section input[type="file"] { font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Galley</h1>
  <table>
    <thead><tr><th>Document</th><th>Last Modified</th><th></th></tr></thead>
    <tbody>${fileRows}</tbody>
  </table>
  <div class="upload-section">
    <label for="galley-upload">Upload HTML file</label>
    <input type="file" id="galley-upload" accept=".html">
  </div>
  <script>
    document.getElementById('galley-upload').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.html')) {
        alert('Only .html files are accepted.');
        e.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
          if (xhr.status === 200) {
            window.location.href = '/edit/' + encodeURIComponent(file.name);
          } else {
            var msg = 'Upload failed';
            try { msg = JSON.parse(xhr.responseText).error || msg; } catch (err) {}
            alert(msg);
            e.target.value = '';
          }
        };
        xhr.onerror = function () {
          alert('Upload failed — network error');
          e.target.value = '';
        };
        xhr.send(JSON.stringify({ filename: file.name, html: reader.result }));
      };
      reader.readAsText(file);
    });
  </script>
</body>
</html>`);
  });

  app.get('/edit/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).send(result.error);

    try {
      await access(result.filePath);
    } catch {
      return res.status(404).send('File not found');
    }

    const html = await readFile(result.filePath, 'utf-8');
    const injected = await injectEditing(html);
    res.type('html').send(injected);
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

  app.post('/save/:filename', async (req, res) => {
    const { filename } = req.params;
    const result = validateFilename(filename);
    if (result.error) return res.status(result.status).json({ error: result.error });

    if (!req.body || typeof req.body.html !== 'string' || req.body.html.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid html field' });
    }

    try {
      await atomicWriteWithBackup(result.filePath, req.body.html, { requireExists: true });
      res.json({ ok: true });
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

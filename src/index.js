import path from 'path';
import { fileURLToPath } from 'url';
import { readdir, copyFile, mkdir, readFile } from 'fs/promises';
import createApp from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;
const docsDir = path.resolve(process.env.GALLEY_DOCS_DIR || './data/docs');
const backupDir = process.env.GALLEY_BACKUP_DIR
  ? path.resolve(process.env.GALLEY_BACKUP_DIR)
  : undefined;
const maxBackups = process.env.GALLEY_MAX_BACKUPS !== undefined
  ? parseInt(process.env.GALLEY_MAX_BACKUPS, 10)
  : undefined;
const configDir = path.resolve(process.env.GALLEY_CONFIG_DIR || './data/config');

// Load config.json if it exists
let fileConfig = {};
try {
  const raw = await readFile(path.join(configDir, 'config.json'), 'utf-8');
  fileConfig = JSON.parse(raw);
} catch {
  // No config file or invalid JSON — use defaults
}

// Ensure docs directory exists and seed with sample if empty
await mkdir(docsDir, { recursive: true });
const existing = await readdir(docsDir);
if (existing.length === 0) {
  const sampleSrc = path.join(__dirname, '..', 'docs', 'sample.html');
  try {
    await copyFile(sampleSrc, path.join(docsDir, 'sample.html'));
    console.log('Seeded docs directory with sample.html');
  } catch {
    // sample.html not found (e.g. Docker image) — skip silently
  }
}

const app = createApp(docsDir, {
  backupDir,
  maxBackups,
  allowedStaticExtensions: fileConfig.allowedStaticExtensions,
});

app.listen(port, () => {
  console.log(`Galley listening on http://localhost:${port}`);
  console.log(`Serving documents from ${docsDir}`);
  console.log(`Backups stored in ${backupDir || path.join(docsDir, '..', 'backups')}`);
});

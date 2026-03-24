import path from 'path';
import createApp from './app.js';

const port = process.env.PORT || 3000;
const docsDir = path.resolve(process.env.GALLEY_DOCS_DIR || './docs');
const backupDir = process.env.GALLEY_BACKUP_DIR
  ? path.resolve(process.env.GALLEY_BACKUP_DIR)
  : undefined;

const app = createApp(docsDir, { backupDir });

app.listen(port, () => {
  console.log(`Galley listening on http://localhost:${port}`);
  console.log(`Serving documents from ${docsDir}`);
  console.log(`Backups stored in ${backupDir || path.join(docsDir, '.galley-backups')}`);
});

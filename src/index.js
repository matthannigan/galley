import path from 'path';
import createApp from './app.js';

const port = process.env.PORT || 3000;
const docsDir = path.resolve(process.env.GALLEY_DOCS_DIR || './docs');

const app = createApp(docsDir);

app.listen(port, () => {
  console.log(`Galley listening on http://localhost:${port}`);
  console.log(`Serving documents from ${docsDir}`);
});

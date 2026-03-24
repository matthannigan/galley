import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let payload = null;

async function getPayload() {
  if (payload) return payload;
  const [script, styles] = await Promise.all([
    readFile(path.join(__dirname, 'galley-client.js'), 'utf-8'),
    readFile(path.join(__dirname, 'galley-styles.css'), 'utf-8'),
  ]);
  payload = [
    '<!-- galley:start -->',
    `<style>\n${styles}</style>`,
    `<script>\n${script}</script>`,
    '<!-- galley:end -->',
  ].join('\n');
  return payload;
}

export async function injectEditing(html) {
  const block = await getPayload();
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + block + '\n' + html.slice(bodyCloseIndex);
  }
  return html + '\n' + block;
}

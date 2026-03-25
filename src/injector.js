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
    '<div id="galley-ui">',
    `<style>\n${styles}</style>`,
    `<script>\n${script}</script>`,
    '</div>',
    '<!-- galley:end -->',
  ].join('\n');
  return payload;
}

export async function injectEditing(html) {
  const block = await getPayload();
  // Insert after opening <body> tag (which may have attributes)
  const bodyOpenMatch = html.match(/<body(\s[^>]*)?>/i);
  if (bodyOpenMatch) {
    const insertAt = bodyOpenMatch.index + bodyOpenMatch[0].length;
    return html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
  }
  // No <body> tag — prepend to the content
  return block + '\n' + html;
}

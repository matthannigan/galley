function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&nbsp;/g, '\u00a0');
}

export function extractTitle(html, filename) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match && match[1].trim()) {
    return decodeHtmlEntities(match[1].trim());
  }
  return filename.replace(/\.html$/i, '');
}

function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

function renderCard(file, index, { mode = 'browse' } = {}) {
  const encodedName = encodeURIComponent(file.name);
  const delay = Math.min((index + 1) * 0.05, 0.5);
  const isDelete = mode === 'delete';
  const cardHref = isDelete ? `/delete/${encodedName}` : `/edit/${encodedName}`;
  const action = isDelete
    ? `<a class="card-delete" href="/delete/${encodedName}">Delete</a>`
    : `<a class="card-download" href="/download/${encodedName}">Download</a>`;
  return `
      <li class="card" style="animation-delay: ${delay}s">
        <div class="card-thumb">
          <a href="${cardHref}">
            <iframe src="/preview/${encodedName}" tabindex="-1" loading="lazy" sandbox scrolling="no"></iframe>
            <div class="card-thumb-overlay"></div>
          </a>
        </div>
        <div class="card-body">
          <div class="card-title"><a href="${cardHref}">${escapeHtml(file.title)}</a></div>
          <div class="card-filename">${escapeHtml(file.name)}</div>
          <div class="card-meta-row">
            <span class="card-date">${formatDate(file.modified)}</span>
            ${action}
          </div>
        </div>
      </li>`;
}

export function renderIndexPage(files, { mode = 'browse' } = {}) {
  const isDelete = mode === 'delete';
  const count = files.length;
  const countText = `${count} file${count !== 1 ? 's' : ''}`;
  const pageTitle = isDelete ? 'Galley — Delete' : 'Galley';
  const contentTitle = isDelete ? 'Delete documents' : 'Documents';

  const cards = count > 0
    ? files.map((f, i) => renderCard(f, i, { mode })).join('')
    : '';

  const emptyState = count === 0
    ? `<li class="card-empty">${isDelete ? 'No HTML documents to delete.' : 'No HTML documents found.'}</li>`
    : '';

  const banner = isDelete
    ? `<div class="warning-banner"><strong>Heads up:</strong> Deleting is permanent. A timestamped backup is saved in the backups directory and can be restored manually.</div>`
    : '';

  const uploadCard = isDelete
    ? ''
    : `      <li class="card-upload">
        <input type="file" accept=".html" id="galley-upload" multiple>
        <div class="upload-inner">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <div class="upload-text">Upload HTML file</div>
          <div class="upload-hint">.html files only</div>
        </div>
      </li>`;

  const uploadScript = isDelete ? '' : `<script>
  document.getElementById('galley-upload').addEventListener('change', function (e) {
    var files = Array.from(e.target.files);
    if (!files.length) return;
    var invalid = files.filter(function (f) { return !f.name.endsWith('.html'); });
    if (invalid.length) {
      alert('Only .html files are accepted.');
      e.target.value = '';
      return;
    }

    var errors = [];

    function uploadNext(i) {
      if (i >= files.length) {
        if (errors.length) alert('Upload failed for: ' + errors.join(', '));
        window.location.reload();
        return;
      }
      var file = files[i];
      var reader = new FileReader();
      reader.onload = function () {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
          if (xhr.status !== 200) errors.push(file.name);
          uploadNext(i + 1);
        };
        xhr.onerror = function () {
          errors.push(file.name);
          uploadNext(i + 1);
        };
        xhr.send(JSON.stringify({ filename: file.name, html: reader.result }));
      };
      reader.readAsText(file);
    }

    uploadNext(0);
  });
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Outfit:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1a1a;
    --ink-secondary: #57534e;
    --ink-tertiary: #a8a29e;
    --surface: #fafaf9;
    --surface-panel: #f3f2f0;
    --surface-card: #ffffff;
    --accent: #4a6741;
    --accent-light: #e8ede7;
    --accent-hover: #3a5233;
    --danger: #b53e3e;
    --danger-hover: #8a2e2e;
    --danger-light: #fbeaea;
    --border: #e7e5e4;
    --border-hover: #d6d3d1;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --display: 'Fraunces', Georgia, serif;
    --body: 'Outfit', system-ui, sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --radius: 6px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--body);
    color: var(--ink);
    background: var(--surface);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  .split {
    display: grid;
    grid-template-columns: 280px 1fr;
    min-height: 100vh;
  }

  .panel {
    background: var(--surface-panel);
    border-right: 1px solid var(--border);
    padding: 52px 32px 40px;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .panel-brand {
    font-family: var(--display);
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .panel-brand-icon {
    width: 0.85em;
    height: 0.85em;
    flex-shrink: 0;
  }

  .panel-section { margin-bottom: 26px; }

  .panel-heading {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-tertiary);
    margin-bottom: 10px;
  }

  .panel-text {
    font-size: 13px;
    line-height: 1.65;
    color: var(--ink-secondary);
  }

  .panel-text strong {
    font-weight: 500;
    color: var(--ink);
  }

  .github-link {
    display: block;
    margin-top: auto;
    padding-top: 16px;
    text-align: center;
    color: var(--muted);
    transition: color 0.2s;
  }

  .github-link:hover {
    color: var(--ink);
  }

  .github-link svg {
    width: 20px;
    height: 20px;
  }

  .steps {
    list-style: none;
    counter-reset: step;
  }

  .step {
    counter-increment: step;
    position: relative;
    padding-left: 28px;
    padding-bottom: 14px;
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--ink-secondary);
  }

  .step::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 1px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-light);
    color: var(--accent);
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 8.5px;
    top: 22px;
    bottom: 0;
    width: 1px;
    background: var(--border);
  }


  .content { padding: 52px 40px 80px; }

  .content-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .content-title {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 600;
  }

  .content-count {
    font-size: 12px;
    color: var(--ink-tertiary);
    font-weight: 500;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
    list-style: none;
  }

  .card {
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.25s, border-color 0.25s, transform 0.25s;
    animation: cardIn 0.4s ease both;
    display: flex;
    flex-direction: column;
  }

  .card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-hover);
    transform: translateY(-2px);
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .card-thumb {
    position: relative;
    height: 180px;
    overflow: hidden;
    background: white;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .card-thumb a {
    display: block;
    width: 100%;
    height: 100%;
  }

  .card-thumb iframe {
    width: 250%;
    height: 800%;
    transform: scale(0.4);
    transform-origin: top left;
    border: none;
    pointer-events: none;
    display: block;
    background: white;
  }

  .card-thumb-overlay {
    position: absolute;
    inset: 0;
    background: transparent;
    transition: background 0.2s;
  }

  .card:hover .card-thumb-overlay {
    background: rgba(74, 103, 65, 0.03);
  }

  .card-body {
    padding: 14px 16px 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .card-title {
    font-family: var(--display);
    font-size: 14.5px;
    font-weight: 600;
    line-height: 1.35;
    margin-bottom: 4px;
  }

  .card-title a {
    color: var(--ink);
    text-decoration: none;
    transition: color 0.15s;
  }

  .card-title a:hover { color: var(--accent); }

  .card-filename {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-tertiary);
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }

  .card-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 6px;
  }

  .card-date {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--ink-tertiary);
  }

  .card-download {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-tertiary);
    text-decoration: none;
    transition: color 0.15s;
  }

  .card-download:hover { color: var(--ink); }

  .card-delete {
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--danger);
    text-decoration: none;
    transition: color 0.15s;
  }

  .card-delete:hover { color: var(--danger-hover); }

  .warning-banner {
    background: var(--danger-light);
    border: 1px solid var(--danger);
    border-left-width: 4px;
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 18px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink);
  }

  .warning-banner strong { color: var(--danger-hover); }

  .card-upload {
    background: transparent;
    border: 1.5px dashed var(--border);
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    animation: cardIn 0.4s ease 0.25s both;
  }

  .card-upload:hover {
    border-color: var(--ink-tertiary);
    background: rgba(255,255,255,0.6);
  }

  .card-upload input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .upload-inner { text-align: center; }

  .upload-icon {
    width: 32px;
    height: 32px;
    margin: 0 auto 10px;
    color: var(--ink-tertiary);
  }

  .upload-text {
    font-size: 13px;
    color: var(--ink-secondary);
    font-weight: 500;
  }

  .upload-hint {
    font-size: 11px;
    color: var(--ink-tertiary);
    margin-top: 3px;
  }

  .card-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 3rem 1rem;
    color: var(--ink-tertiary);
    font-style: italic;
    list-style: none;
  }

  @media (max-width: 860px) {
    .split { grid-template-columns: 1fr; }
    .panel {
      position: static;
      height: auto;
      padding: 36px 24px 28px;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
    .content { padding: 28px 24px 60px; }
    .card-grid { grid-template-columns: 1fr; }
  }

  @media (min-width: 861px) and (max-width: 1100px) {
    .card-grid { grid-template-columns: 1fr; }
  }

  @media (min-width: 1101px) and (max-width: 1400px) {
    .card-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (min-width: 1401px) {
    .card-grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
</head>
<body>
<div class="split">

  <aside class="panel">
    <div class="panel-brand"><svg class="panel-brand-icon" viewBox="0 0 32 32" aria-hidden="true"><rect fill="#3d3d3a" x="1" y="2" width="30" height="4" rx="1.5" opacity="0.85"/><rect fill="none" stroke="#3d3d3a" stroke-width="1.2" x="2" y="5" width="28" height="25" rx="2"/><rect fill="#3d3d3a" x="6" y="11" width="20" height="2.2" rx="0.5" opacity="0.7"/><rect fill="#3d3d3a" x="6" y="15.5" width="20" height="2.2" rx="0.5" opacity="0.7"/><rect fill="#3d3d3a" x="6" y="20" width="20" height="2.2" rx="0.5" opacity="0.7"/><rect fill="#3d3d3a" x="6" y="24.5" width="14" height="2.2" rx="0.5" opacity="0.6"/></svg> Galley</div>

    <div class="panel-section">
      <div class="panel-heading">What is this?</div>
      <p class="panel-text">
        A lightweight editor for shared HTML documents. You edit text in the browser; changes write directly back to the&nbsp;file.
      </p>
    </div>

    <div class="panel-section">
      <div class="panel-heading">How it works</div>
      <ol class="steps">
        <li class="step">Click a document to open&nbsp;it</li>
        <li class="step">Click any text to edit \u2014 look for the blue outline on&nbsp;hover</li>
        <li class="step">Use the toolbar for <strong>bold</strong>, <em>italic</em>, and&nbsp;links</li>
        <li class="step">Hover block edges to <strong>move</strong>, <strong>duplicate</strong>, or&nbsp;<strong>remove</strong> sections</li>
        <li class="step">Press <strong>Ctrl+S</strong> or click Save to write changes to&nbsp;disk</li>
      </ol>
    </div>

    <div class="panel-section">
      <div class="panel-heading">Good to know</div>
      <p class="panel-text">
        Every save creates a backup. If someone else edits the file while you\u2019re working, you\u2019ll be&nbsp;notified.
        Press <strong>?</strong> in the editor for keyboard shortcuts.
      </p>
    </div>

    <a href="https://github.com/matthannigan/galley" class="github-link" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>
  </aside>

  <main class="content">
    <div class="content-header">
      <h2 class="content-title">${contentTitle}</h2>
      <span class="content-count">${countText}</span>
    </div>
    ${banner}
    <ul class="card-grid">
${cards}${emptyState}
${uploadCard}
    </ul>
  </main>

</div>
${uploadScript}
</body>
</html>`;
}

export function renderConfirmPage({ filename, title }) {
  const safeFilename = escapeHtml(filename);
  const safeTitle = escapeHtml(title);
  const jsonFilename = JSON.stringify(filename);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Galley — Confirm delete</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Outfit:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1a1a1a;
    --ink-secondary: #57534e;
    --ink-tertiary: #a8a29e;
    --surface: #fafaf9;
    --surface-panel: #f3f2f0;
    --surface-card: #ffffff;
    --danger: #b53e3e;
    --danger-hover: #8a2e2e;
    --danger-light: #fbeaea;
    --border: #e7e5e4;
    --border-hover: #d6d3d1;
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --display: 'Fraunces', Georgia, serif;
    --body: 'Outfit', system-ui, sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --radius: 6px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: var(--body);
    color: var(--ink);
    background: var(--surface);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    padding: 0 24px;
  }
  .confirm-card {
    max-width: 520px;
    margin: 64px auto;
    background: var(--surface-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    padding: 32px;
  }
  .confirm-title {
    font-family: var(--display);
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .confirm-doc-title {
    font-family: var(--display);
    font-size: 16px;
    color: var(--ink-secondary);
    margin-bottom: 4px;
  }
  .confirm-filename {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-tertiary);
    margin-bottom: 18px;
    word-break: break-all;
  }
  .confirm-body {
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--ink-secondary);
    margin-bottom: 20px;
  }
  .confirm-form label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-secondary);
    margin-bottom: 6px;
  }
  .confirm-form input[type="text"] {
    width: 100%;
    padding: 10px 12px;
    font-family: var(--mono);
    font-size: 14px;
    border: 1px solid var(--border-hover);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
  }
  .confirm-form input[type="text"]:focus {
    outline: none;
    border-color: var(--danger);
    box-shadow: 0 0 0 3px var(--danger-light);
  }
  .confirm-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
    justify-content: flex-end;
  }
  .btn {
    font-family: var(--body);
    font-size: 13px;
    font-weight: 600;
    padding: 9px 18px;
    border-radius: var(--radius);
    border: 1px solid transparent;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn-cancel {
    background: transparent;
    border-color: var(--border-hover);
    color: var(--ink-secondary);
  }
  .btn-cancel:hover { background: var(--surface-panel); color: var(--ink); }
  .btn-danger {
    background: var(--danger);
    color: white;
  }
  .btn-danger:hover:not(:disabled) { background: var(--danger-hover); }
  .btn-danger:disabled { opacity: 0.4; cursor: not-allowed; }
  .confirm-error {
    margin-top: 14px;
    color: var(--danger-hover);
    font-size: 12.5px;
    min-height: 1em;
  }
</style>
</head>
<body>
<div class="confirm-card">
  <div class="confirm-title">Confirm delete</div>
  <div class="confirm-doc-title">${safeTitle}</div>
  <div class="confirm-filename">${safeFilename}</div>
  <div class="confirm-body">
    This will remove the file from the documents directory. A timestamped backup is saved automatically and can be restored manually from the backups directory.
  </div>
  <form class="confirm-form" id="confirm-form" autocomplete="off">
    <label for="confirm-input">Type <strong>DELETE</strong> to confirm</label>
    <input type="text" id="confirm-input" name="confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" autofocus>
    <div class="confirm-actions">
      <a class="btn btn-cancel" href="/delete">Cancel</a>
      <button type="submit" class="btn btn-danger" id="confirm-submit" disabled>Delete file</button>
    </div>
    <div class="confirm-error" id="confirm-error"></div>
  </form>
</div>
<script>
  (function () {
    var input = document.getElementById('confirm-input');
    var submit = document.getElementById('confirm-submit');
    var form = document.getElementById('confirm-form');
    var error = document.getElementById('confirm-error');
    var filename = ${jsonFilename};

    input.addEventListener('input', function () {
      submit.disabled = input.value !== 'DELETE';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value !== 'DELETE') return;
      submit.disabled = true;
      error.textContent = '';
      fetch('/delete/' + encodeURIComponent(filename), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' })
      }).then(function (res) {
        if (res.ok) {
          window.location.href = '/delete';
          return;
        }
        return res.json().then(function (data) {
          throw new Error((data && data.error) || ('Delete failed (' + res.status + ')'));
        }, function () {
          throw new Error('Delete failed (' + res.status + ')');
        });
      }).catch(function (err) {
        error.textContent = err.message || 'Delete failed';
        submit.disabled = false;
      });
    });
  })();
</script>
</body>
</html>`;
}

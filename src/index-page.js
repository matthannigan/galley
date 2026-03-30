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

function renderCard(file, index) {
  const encodedName = encodeURIComponent(file.name);
  const delay = Math.min((index + 1) * 0.05, 0.5);
  return `
      <li class="card" style="animation-delay: ${delay}s">
        <div class="card-thumb">
          <a href="/edit/${encodedName}">
            <iframe src="/preview/${encodedName}" tabindex="-1" loading="lazy" sandbox scrolling="no"></iframe>
            <div class="card-thumb-overlay"></div>
          </a>
        </div>
        <div class="card-body">
          <div class="card-title"><a href="/edit/${encodedName}">${escapeHtml(file.title)}</a></div>
          <div class="card-filename">${escapeHtml(file.name)}</div>
          <div class="card-meta-row">
            <span class="card-date">${formatDate(file.modified)}</span>
            <a class="card-download" href="/download/${encodedName}">Download</a>
          </div>
        </div>
      </li>`;
}

export function renderIndexPage(files) {
  const count = files.length;
  const countText = `${count} file${count !== 1 ? 's' : ''}`;

  const cards = count > 0
    ? files.map((f, i) => renderCard(f, i)).join('')
    : '';

  const emptyState = count === 0
    ? '<li class="card-empty">No HTML documents found.</li>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Galley</title>
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

  .panel-tour {
    display: none;
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }

  .tour-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--accent-light);
    border-radius: var(--radius);
    text-decoration: none;
    color: var(--accent);
    font-size: 13px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .tour-link:hover { background: #d9e4d7; }

  .tour-link svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
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
    .panel-tour { margin-top: 20px; }
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
    <div class="panel-brand">Galley</div>

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

    <div class="panel-tour">
      <a href="#" class="tour-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
        </svg>
        Take a guided tour
      </a>
    </div>
  </aside>

  <main class="content">
    <div class="content-header">
      <h2 class="content-title">Documents</h2>
      <span class="content-count">${countText}</span>
    </div>

    <ul class="card-grid">
${cards}${emptyState}
      <li class="card-upload">
        <input type="file" accept=".html" id="galley-upload" multiple>
        <div class="upload-inner">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <div class="upload-text">Upload HTML file</div>
          <div class="upload-hint">.html files only</div>
        </div>
      </li>
    </ul>
  </main>

</div>
<script>
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
    var completed = 0;

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
</script>
</body>
</html>`;
}

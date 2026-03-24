(function () {
  'use strict';

  var EDITABLE_SELECTORS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'blockquote', 'figcaption',
    'dt', 'dd', 'label', 'span', 'a'
  ];

  var SUPPRESS_ENTER_TAGS = [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'figcaption', 'dt', 'dd',
    'td', 'th', 'label', 'span', 'a'
  ];

  function isExcluded(el) {
    return el.closest('[data-no-edit]') !== null;
  }

  var selector = EDITABLE_SELECTORS.join(', ');
  var elements = document.querySelectorAll(selector);

  elements.forEach(function (el) {
    if (isExcluded(el)) return;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('galley-editable');
  });

  // Paste interception: plain text only
  document.addEventListener('paste', function (e) {
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    e.preventDefault();
    var text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Structure guard: suppress Enter in block elements (allow in li)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    var tagName = target.tagName.toLowerCase();
    if (SUPPRESS_ENTER_TAGS.indexOf(tagName) !== -1) {
      e.preventDefault();
    }
  });

  // --- Save & Backup ---

  var saving = false;
  var saveBtn = null;
  var toastEl = null;
  var pathParts = window.location.pathname.split('/');
  var filename = decodeURIComponent(pathParts[pathParts.length - 1]);

  function stripGalleyArtifacts(html) {
    var startMarker = '<!-- galley:start -->';
    var endMarker = '<!-- galley:end -->';
    var startIdx = html.indexOf(startMarker);
    var endIdx = html.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1) {
      var before = html.substring(0, startIdx);
      var after = html.substring(endIdx + endMarker.length);
      if (before.endsWith('\n')) before = before.slice(0, -1);
      if (after.startsWith('\n')) after = after.slice(1);
      html = before + after;
    }
    return '<!DOCTYPE html>\n' + html;
  }

  function cleanEditableAttributes() {
    var editables = document.querySelectorAll('.galley-editable');
    editables.forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('galley-editable');
      if (el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
    });
  }

  function restoreEditableAttributes() {
    var els = document.querySelectorAll(selector);
    els.forEach(function (el) {
      if (isExcluded(el)) return;
      el.setAttribute('contenteditable', 'true');
      el.classList.add('galley-editable');
    });
  }

  function updateSaveButton(disabled) {
    if (!saveBtn) return;
    saveBtn.disabled = disabled;
    saveBtn.textContent = disabled ? 'Saving\u2026' : 'Save';
  }

  function showToast(message, isError) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = 'galley-toast-visible' + (isError ? ' galley-toast-error' : '');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () {
      toastEl.className = '';
      toastEl.textContent = '';
    }, 2000);
  }

  function saveDocument() {
    if (saving) return;
    saving = true;
    updateSaveButton(true);

    cleanEditableAttributes();
    var rawHtml = document.documentElement.outerHTML;
    restoreEditableAttributes();

    var html = stripGalleyArtifacts(rawHtml);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/save/' + encodeURIComponent(filename));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      saving = false;
      updateSaveButton(false);
      if (xhr.status === 200) {
        showToast('Saved');
      } else {
        var msg = 'Save failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* non-JSON response */ }
        showToast(msg, true);
      }
    };
    xhr.onerror = function () {
      saving = false;
      updateSaveButton(false);
      showToast('Save failed \u2014 network error', true);
    };
    xhr.send(JSON.stringify({ html: html }));
  }

  // Ctrl+S / Cmd+S keyboard shortcut
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveDocument();
    }
  });

  // Create save UI after full DOM is parsed
  document.addEventListener('DOMContentLoaded', function () {
    // Find the galley:end comment node
    var endComment = null;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim() === 'galley:end') {
        endComment = walker.currentNode;
        break;
      }
    }

    saveBtn = document.createElement('button');
    saveBtn.setAttribute('type', 'button');
    saveBtn.setAttribute('id', 'galley-save');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', saveDocument);

    toastEl = document.createElement('div');
    toastEl.setAttribute('id', 'galley-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    if (endComment && endComment.parentNode) {
      endComment.parentNode.insertBefore(toastEl, endComment);
      endComment.parentNode.insertBefore(saveBtn, endComment);
    } else {
      document.body.appendChild(saveBtn);
      document.body.appendChild(toastEl);
    }
  });
})();

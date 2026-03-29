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

  // Snapshot <html> and <body> attributes before extensions modify them
  function snapshotAttributes(el) {
    var attrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      attrs[el.attributes[i].name] = el.attributes[i].value;
    }
    return attrs;
  }
  var htmlAttrsOriginal = snapshotAttributes(document.documentElement);
  var bodyAttrsOriginal = null;

  var selector = EDITABLE_SELECTORS.join(', ');

  function activateEditing() {
    if (!bodyAttrsOriginal && document.body) {
      bodyAttrsOriginal = snapshotAttributes(document.body);
    }
    var elements = document.querySelectorAll(selector);
    elements.forEach(function (el) {
      if (isExcluded(el)) return;
      el.setAttribute('contenteditable', 'true');
      el.classList.add('galley-editable');
    });
  }

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
  var dirty = false;
  var originalTitle = document.title;
  var saveBtn = null;
  var toastEl = null;
  var pathParts = window.location.pathname.split('/');
  var filename = decodeURIComponent(pathParts[pathParts.length - 1]);

  function setDirty(value) {
    dirty = value;
    if (saveBtn) {
      saveBtn.disabled = !value;
      if (value) {
        saveBtn.classList.add('galley-dirty');
      } else {
        saveBtn.classList.remove('galley-dirty');
      }
    }
    document.title = value ? '\u2022 ' + originalTitle : originalTitle;
  }

  // Track content changes in editable elements
  document.addEventListener('input', function (e) {
    if (e.target.closest('[contenteditable="true"]')) {
      setDirty(true);
    }
  });

  // Warn before navigating away with unsaved changes
  window.addEventListener('beforeunload', function (e) {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function stripGalleyArtifacts(html) {
    // Concatenation avoids these literals appearing in the script source,
    // which would cause indexOf to match the script itself instead of the markers
    var startMarker = '<!-- galley:' + 'start -->';
    var endMarker = '<!-- galley:' + 'end -->';
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

  function restoreOriginalAttributes(el, original) {
    // Remove any attributes not in the original snapshot
    var toRemove = [];
    for (var i = 0; i < el.attributes.length; i++) {
      if (!(el.attributes[i].name in original)) {
        toRemove.push(el.attributes[i].name);
      }
    }
    toRemove.forEach(function (name) { el.removeAttribute(name); });
    // Restore original attribute values
    for (var name in original) {
      if (el.getAttribute(name) !== original[name]) {
        el.setAttribute(name, original[name]);
      }
    }
  }

  function removeExtensionElements() {
    // Custom elements (hyphenated tag names) are injected by browser extensions
    var customEls = document.querySelectorAll('*');
    var toRemove = [];
    customEls.forEach(function (el) {
      if (el.tagName.indexOf('-') !== -1) {
        toRemove.push(el);
      }
    });
    toRemove.forEach(function (el) { el.remove(); });
    return toRemove;
  }

  function cleanEditableAttributes() {
    var editables = document.querySelectorAll('.galley-editable');
    editables.forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      el.classList.remove('galley-editable');
      if (el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
    });
  }

  var restoreEditableAttributes = activateEditing;

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
    if (saving || !dirty) return;
    saving = true;
    updateSaveButton(true);

    // Clean all non-document artifacts before serializing
    restoreOriginalAttributes(document.documentElement, htmlAttrsOriginal);
    if (document.body && bodyAttrsOriginal) {
      restoreOriginalAttributes(document.body, bodyAttrsOriginal);
    }
    var removedEls = removeExtensionElements();
    cleanEditableAttributes();
    var rawHtml = document.documentElement.outerHTML;
    // Re-insert removed extension elements (they're harmless in the live DOM)
    removedEls.forEach(function (el) { document.body.appendChild(el); });
    restoreEditableAttributes();

    var html = stripGalleyArtifacts(rawHtml);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/save/' + encodeURIComponent(filename));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      saving = false;
      updateSaveButton(false);
      if (xhr.status === 200) {
        setDirty(false);
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

  // Activate editing and create save UI after full DOM is parsed
  document.addEventListener('DOMContentLoaded', function () {
    activateEditing();

    var container = document.getElementById('galley-ui');

    saveBtn = document.createElement('button');
    saveBtn.setAttribute('type', 'button');
    saveBtn.setAttribute('id', 'galley-save');
    saveBtn.textContent = 'Save';
    saveBtn.disabled = true;
    saveBtn.addEventListener('click', saveDocument);

    toastEl = document.createElement('div');
    toastEl.setAttribute('id', 'galley-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');

    var downloadBtn = document.createElement('a');
    downloadBtn.setAttribute('id', 'galley-download');
    downloadBtn.setAttribute('href', '/download/' + encodeURIComponent(filename));
    downloadBtn.textContent = 'Download';

    if (container) {
      container.appendChild(saveBtn);
      container.appendChild(downloadBtn);
      container.appendChild(toastEl);
    } else {
      document.body.appendChild(saveBtn);
      document.body.appendChild(downloadBtn);
      document.body.appendChild(toastEl);
    }
  });
})();

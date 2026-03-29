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

  // --- Paste sanitization (for Ctrl+Shift+V formatted paste) ---

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function sanitizeNode(node) {
    var result = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === 3) {
        result += child.textContent;
      } else if (child.nodeType === 1) {
        var tag = child.tagName.toLowerCase();
        if (tag === 'strong' || tag === 'b') {
          result += '<strong>' + sanitizeNode(child) + '</strong>';
        } else if (tag === 'em' || tag === 'i') {
          result += '<em>' + sanitizeNode(child) + '</em>';
        } else if (tag === 'a' && child.getAttribute('href')) {
          var href = child.getAttribute('href');
          if (/^(https?:|mailto:)/i.test(href)) {
            result += '<a href="' + escapeAttr(href) + '">' + sanitizeNode(child) + '</a>';
          } else {
            result += sanitizeNode(child);
          }
        } else {
          result += sanitizeNode(child);
        }
      }
    }
    return result;
  }

  function sanitizePasteHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return sanitizeNode(tmp);
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

  // Paste interception: plain text by default, Shift for formatted paste
  document.addEventListener('paste', function (e) {
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    e.preventDefault();

    var text = e.clipboardData.getData('text/plain');
    if (e.shiftKey) {
      var htmlContent = e.clipboardData.getData('text/html');
      if (htmlContent) {
        var sanitized = sanitizePasteHtml(htmlContent);
        document.execCommand('insertHTML', false, sanitized);
      } else {
        document.execCommand('insertText', false, text);
      }
    } else {
      document.execCommand('insertText', false, text);
    }
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

  // Formatting shortcuts: Ctrl/Cmd+B (bold), Ctrl/Cmd+I (italic), Ctrl/Cmd+K (link)
  function handleLinkCommand() {
    var sel = window.getSelection();
    if (sel && sel.anchorNode) {
      var anchor = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      if (anchor && anchor.closest('a')) {
        document.execCommand('unlink');
        return;
      }
    }
    var url = prompt('URL:', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var key = e.key.toLowerCase();
    if (key !== 'b' && key !== 'i' && key !== 'k') return;
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    e.preventDefault();
    if (key === 'b') {
      document.execCommand('bold');
    } else if (key === 'i') {
      document.execCommand('italic');
    } else if (key === 'k') {
      handleLinkCommand();
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

    // --- Formatting toolbar ---
    var toolbar = document.createElement('div');
    toolbar.setAttribute('id', 'galley-toolbar');

    var boldBtn = document.createElement('button');
    boldBtn.setAttribute('type', 'button');
    boldBtn.setAttribute('data-command', 'bold');
    boldBtn.innerHTML = '<strong>B</strong>';

    var italicBtn = document.createElement('button');
    italicBtn.setAttribute('type', 'button');
    italicBtn.setAttribute('data-command', 'italic');
    italicBtn.innerHTML = '<em>I</em>';

    var linkBtn = document.createElement('button');
    linkBtn.setAttribute('type', 'button');
    linkBtn.setAttribute('data-command', 'createLink');
    linkBtn.style.textDecoration = 'underline';
    linkBtn.textContent = 'A';

    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(linkBtn);

    // Toolbar button handlers — mousedown to preserve selection
    toolbar.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var btn = e.target.closest('button');
      if (!btn) return;
      var command = btn.getAttribute('data-command');
      if (command === 'bold' || command === 'italic') {
        document.execCommand(command);
      } else if (command === 'createLink') {
        handleLinkCommand();
      }
      updateToolbar();
    });

    if (container) {
      container.appendChild(saveBtn);
      container.appendChild(downloadBtn);
      container.appendChild(toastEl);
      container.appendChild(toolbar);
    } else {
      document.body.appendChild(saveBtn);
      document.body.appendChild(downloadBtn);
      document.body.appendChild(toastEl);
      document.body.appendChild(toolbar);
    }

    // --- Toolbar positioning and visibility ---
    function isInsideEditable(node) {
      if (!node) return false;
      var el = node.nodeType === 3 ? node.parentElement : node;
      return el && el.closest('[contenteditable="true"]') !== null;
    }

    function updateToolbar() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !isInsideEditable(sel.anchorNode)) {
        toolbar.classList.remove('galley-toolbar-visible', 'galley-toolbar-below');
        return;
      }

      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        toolbar.classList.remove('galley-toolbar-visible', 'galley-toolbar-below');
        return;
      }

      // Show toolbar to measure its dimensions
      toolbar.classList.add('galley-toolbar-visible');
      toolbar.classList.remove('galley-toolbar-below');
      var tw = toolbar.offsetWidth;
      var th = toolbar.offsetHeight;
      var gap = 8;

      var top;
      if (rect.top - th - gap < 0) {
        // Not enough room above — show below
        top = rect.bottom + gap + window.scrollY;
        toolbar.classList.add('galley-toolbar-below');
      } else {
        top = rect.top - th - gap + window.scrollY;
      }

      var left = rect.left + rect.width / 2 - tw / 2 + window.scrollX;
      left = Math.max(4, Math.min(left, document.documentElement.clientWidth - tw - 4));

      toolbar.style.top = top + 'px';
      toolbar.style.left = left + 'px';

      // Update active states
      boldBtn.classList.toggle('galley-toolbar-active', document.queryCommandState('bold'));
      italicBtn.classList.toggle('galley-toolbar-active', document.queryCommandState('italic'));
      var inLink = false;
      if (sel.anchorNode) {
        var anchorEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        inLink = anchorEl && anchorEl.closest('a') !== null;
      }
      linkBtn.classList.toggle('galley-toolbar-active', inLink);
    }

    document.addEventListener('selectionchange', updateToolbar);
    document.addEventListener('mouseup', function () {
      setTimeout(updateToolbar, 0);
    });
    window.addEventListener('scroll', function () {
      if (toolbar.classList.contains('galley-toolbar-visible')) updateToolbar();
    });
    window.addEventListener('resize', function () {
      if (toolbar.classList.contains('galley-toolbar-visible')) updateToolbar();
    });
  });
})();

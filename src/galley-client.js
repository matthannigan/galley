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

  // --- Undo (element-level snapshot stack) ---

  var MAX_UNDO_SNAPSHOTS = 20;
  var undoSnapshots = new Map();

  document.addEventListener('focusin', function (e) {
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    var stack = undoSnapshots.get(target);
    if (!stack) {
      stack = [];
      undoSnapshots.set(target, stack);
    }
    if (stack.length >= MAX_UNDO_SNAPSHOTS) stack.shift();
    stack.push(target.innerHTML);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var target = e.target.closest('[contenteditable="true"]');
    if (!target) return;
    var stack = undoSnapshots.get(target);
    if (!stack || stack.length === 0) {
      target.blur();
      return;
    }
    var snapshot = stack.pop();
    if (snapshot === target.innerHTML && stack.length > 0) {
      // Current content matches snapshot (no changes since focus) — pop again
      snapshot = stack.pop();
    }
    if (snapshot !== undefined && snapshot !== target.innerHTML) {
      target.innerHTML = snapshot;
      setDirty(true);
    } else if (stack.length === 0) {
      target.blur();
    }
  });

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
  var originalTitle = document.title.replace(/^(\u2022 )+/, '');
  var saveBtn = null;
  var toastEl = null;
  var bannerEl = null;
  var version = null;
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

  function cleanBlockAttributes() {
    // Remove drag handles injected into blocks
    var handles = document.querySelectorAll('.galley-block-drag-handle');
    handles.forEach(function (el) { el.remove(); });
    // Remove inline position:relative added for handle positioning
    var blocks = document.querySelectorAll('[data-galley-block]');
    blocks.forEach(function (el) {
      if (el.getAttribute('data-galley-pos-added') === 'true') {
        el.style.position = '';
        if (el.getAttribute('style') === '') el.removeAttribute('style');
        el.removeAttribute('data-galley-pos-added');
      }
      el.classList.remove('galley-block-hover');
      if (el.getAttribute('class') === '') el.removeAttribute('class');
    });
  }

  function restoreBlockAttributes() {
    injectDragHandles();
  }

  function injectDragHandles() {
    var blocks = document.querySelectorAll('[data-galley-block]');
    blocks.forEach(function (block) {
      if (block.querySelector('.galley-block-drag-handle')) return;
      var handle = document.createElement('button');
      handle.setAttribute('type', 'button');
      handle.className = 'galley-block-drag-handle';
      handle.setAttribute('contenteditable', 'false');
      handle.setAttribute('aria-hidden', 'true');
      handle.setAttribute('title', 'Drag to reorder');
      handle.innerHTML = '<svg viewBox="0 0 16 16"><path d="M2.5 6.5l5.5-5 5.5 5M2.5 9.5l5.5 5 5.5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var computed = window.getComputedStyle(block);
      if (computed.position === 'static' || computed.position === '') {
        block.style.position = 'relative';
        block.setAttribute('data-galley-pos-added', 'true');
      }
      block.insertBefore(handle, block.firstChild);
    });
  }

  var restoreEditableAttributes = activateEditing;

  function updateSaveButton(disabled) {
    if (!saveBtn) return;
    saveBtn.disabled = disabled;
    saveBtn.textContent = disabled ? 'Saving\u2026' : 'Save';
  }

  function showToast(message, isError, actions) {
    if (!toastEl) return;
    toastEl.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = message;
    toastEl.appendChild(msg);
    var classes = 'galley-toast-visible';
    if (isError) classes += ' galley-toast-error';
    if (actions && actions.length) {
      classes += ' galley-toast-interactive';
      actions.forEach(function (a) {
        var btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.textContent = a.label;
        btn.addEventListener('click', function () {
          a.action();
          clearTimeout(toastEl._timer);
          toastEl.className = '';
          toastEl.innerHTML = '';
        });
        toastEl.appendChild(btn);
      });
    }
    toastEl.className = classes;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () {
      toastEl.className = '';
      toastEl.innerHTML = '';
    }, actions ? 6000 : 2000);
  }

  function showBanner(message, buttons) {
    if (!bannerEl) return;
    bannerEl.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = message;
    bannerEl.appendChild(msg);
    buttons.forEach(function (btn) {
      var b = document.createElement('button');
      b.setAttribute('type', 'button');
      b.textContent = btn.label;
      if (btn.className) b.className = btn.className;
      b.addEventListener('click', btn.action);
      bannerEl.appendChild(b);
    });
    bannerEl.classList.add('galley-banner-visible');
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('galley-banner-visible');
    bannerEl.innerHTML = '';
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
    // Restore original title (remove dirty bullet prefix)
    document.title = originalTitle;
    var removedEls = removeExtensionElements();
    cleanEditableAttributes();
    cleanBlockAttributes();
    var rawHtml = document.documentElement.outerHTML;
    // Re-insert removed extension elements (they're harmless in the live DOM)
    removedEls.forEach(function (el) { document.body.appendChild(el); });
    restoreEditableAttributes();
    restoreBlockAttributes();
    // Re-apply dirty title (will be cleared by setDirty(false) on success)
    document.title = '\u2022 ' + originalTitle;

    var html = stripGalleyArtifacts(rawHtml);

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/save/' + encodeURIComponent(filename));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      saving = false;
      updateSaveButton(false);
      if (xhr.status === 200) {
        var resp;
        try { resp = JSON.parse(xhr.responseText); } catch { resp = {}; }
        if (resp.version) version = resp.version;
        setDirty(false);
        undoSnapshots.clear();
        hideBanner();
        showToast('Saved');
      } else if (xhr.status === 409) {
        var data;
        try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
        if (data.currentVersion) version = data.currentVersion;
        showBanner(data.error || 'Save conflict detected.', [
          { label: 'Reload', action: function () { window.location.reload(); } },
          { label: 'Force Save', className: 'galley-banner-force', action: function () { forceSave(html); } }
        ]);
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
    var body = { html: html };
    if (version) body.version = version;
    xhr.send(JSON.stringify(body));
  }

  function forceSave(html) {
    hideBanner();
    saving = true;
    updateSaveButton(true);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/save/' + encodeURIComponent(filename));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      saving = false;
      updateSaveButton(false);
      if (xhr.status === 200) {
        var resp;
        try { resp = JSON.parse(xhr.responseText); } catch { resp = {}; }
        if (resp.version) version = resp.version;
        setDirty(false);
        undoSnapshots.clear();
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

    // Read version from server-injected data attribute
    if (container && container.getAttribute('data-galley-version')) {
      version = container.getAttribute('data-galley-version');
    }

    bannerEl = document.createElement('div');
    bannerEl.setAttribute('id', 'galley-banner');
    bannerEl.setAttribute('role', 'alert');

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

    // --- Block controls (duplicate / drag / remove) ---
    var blockControls = document.createElement('div');
    blockControls.setAttribute('id', 'galley-block-controls');

    var dupBtn = document.createElement('button');
    dupBtn.setAttribute('type', 'button');
    dupBtn.setAttribute('data-block-action', 'duplicate');
    dupBtn.setAttribute('title', 'Duplicate block');
    dupBtn.innerHTML = '<svg viewBox="0 0 16 16"><rect x="5" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

    var removeBtn = document.createElement('button');
    removeBtn.setAttribute('type', 'button');
    removeBtn.setAttribute('data-block-action', 'remove');
    removeBtn.setAttribute('title', 'Remove block');
    removeBtn.innerHTML = '<svg viewBox="0 0 16 16"><path d="M2 4h12M5.5 4V2.5h5V4M6 7v5M10 7v5M3.5 4l.75 10h7.5L12.5 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    blockControls.appendChild(dupBtn);
    blockControls.appendChild(removeBtn);

    // Block controls hover logic
    var activeBlock = null;
    var blockHideTimer = null;

    function showBlockControls(block) {
      if (activeBlock && activeBlock !== block) {
        activeBlock.classList.remove('galley-block-hover');
      }
      activeBlock = block;
      block.classList.add('galley-block-hover');
      // Position below the per-block drag handle to form a unified strip
      var handle = block.querySelector('.galley-block-drag-handle');
      if (handle) {
        var handleRect = handle.getBoundingClientRect();
        var top = handleRect.bottom + window.scrollY;
        var left = handleRect.left + window.scrollX;
        blockControls.style.top = top + 'px';
        blockControls.style.left = left + 'px';
      } else {
        var rect = block.getBoundingClientRect();
        blockControls.style.top = (rect.top + window.scrollY) + 'px';
        blockControls.style.left = (rect.left - 36 + window.scrollX) + 'px';
      }
      blockControls.classList.add('galley-block-controls-visible');
    }

    function hideBlockControls() {
      blockControls.classList.remove('galley-block-controls-visible');
      if (activeBlock) {
        activeBlock.classList.remove('galley-block-hover');
        activeBlock = null;
      }
    }

    function scheduleHideBlockControls() {
      clearTimeout(blockHideTimer);
      blockHideTimer = setTimeout(function () {
        hideBlockControls();
      }, 150);
    }

    function cancelHideBlockControls() {
      clearTimeout(blockHideTimer);
    }

    document.addEventListener('mouseover', function (e) {
      var block = e.target.closest('[data-galley-block]');
      if (!block) return;
      // Don't show controls if hovering over the controls themselves
      if (e.target.closest('#galley-block-controls')) return;
      cancelHideBlockControls();
      showBlockControls(block);
    });

    document.addEventListener('mouseout', function (e) {
      var source = e.target.closest('[data-galley-block]') || e.target.closest('#galley-block-controls');
      if (!source) return;
      // If mouse is moving to another element inside the block or into the controls, don't hide
      var dest = e.relatedTarget;
      if (dest) {
        if (dest.closest && (dest.closest('[data-galley-block]') === activeBlock || dest.closest('#galley-block-controls'))) return;
      }
      scheduleHideBlockControls();
    });

    blockControls.addEventListener('mouseenter', function () {
      cancelHideBlockControls();
    });

    blockControls.addEventListener('mouseleave', function () {
      scheduleHideBlockControls();
    });

    // Block action handlers
    function duplicateBlock(block) {
      var clone = block.cloneNode(true);
      block.parentNode.insertBefore(clone, block.nextSibling);
      activateEditing();
      injectDragHandles();
      initBlockSorting();
      setDirty(true);
      showToast('Block duplicated');
    }

    function removeBlock(block) {
      var parent = block.parentNode;
      var nextSibling = block.nextSibling;
      parent.removeChild(block);
      activeBlock = null;
      hideBlockControls();
      setDirty(true);
      showToast('Block removed', false, [{
        label: 'Undo',
        action: function () {
          parent.insertBefore(block, nextSibling);
          activateEditing();
          injectDragHandles();
          initBlockSorting();
        }
      }]);
    }

    blockControls.addEventListener('mousedown', function (e) {
      var btn = e.target.closest('button');
      if (!btn || !activeBlock) return;
      e.preventDefault();
      var action = btn.getAttribute('data-block-action');
      if (action === 'duplicate') {
        duplicateBlock(activeBlock);
      } else if (action === 'remove') {
        removeBlock(activeBlock);
      }
    });

    // Block drag handles and SortableJS
    injectDragHandles();

    function initBlockSorting() {
      if (typeof Sortable === 'undefined') return;
      var blocks = document.querySelectorAll('[data-galley-block]');
      var parents = [];
      blocks.forEach(function (block) {
        if (block.parentNode && parents.indexOf(block.parentNode) === -1) {
          parents.push(block.parentNode);
        }
      });
      parents.forEach(function (parent) {
        // Destroy existing instance if any
        if (parent._sortable) parent._sortable.destroy();
        parent._sortable = Sortable.create(parent, {
          handle: '.galley-block-drag-handle',
          draggable: '[data-galley-block]',
          animation: 150,
          ghostClass: 'galley-block-ghost',
          chosenClass: 'galley-block-chosen',
          onEnd: function () {
            setDirty(true);
          }
        });
      });
    }

    initBlockSorting();

    if (container) {
      container.appendChild(saveBtn);
      container.appendChild(downloadBtn);
      container.appendChild(toastEl);
      container.appendChild(toolbar);
      container.appendChild(blockControls);
      container.appendChild(bannerEl);
    } else {
      document.body.appendChild(saveBtn);
      document.body.appendChild(downloadBtn);
      document.body.appendChild(toastEl);
      document.body.appendChild(toolbar);
      document.body.appendChild(blockControls);
      document.body.appendChild(bannerEl);
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
      if (activeBlock) showBlockControls(activeBlock);
    });
    window.addEventListener('resize', function () {
      if (toolbar.classList.contains('galley-toolbar-visible')) updateToolbar();
      if (activeBlock) showBlockControls(activeBlock);
    });

    // --- Auto-reload polling ---
    var POLL_INTERVAL = 5000;
    var pollTimer = null;

    function pollStatus() {
      if (!version) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/status/' + encodeURIComponent(filename));
      xhr.onload = function () {
        if (xhr.status !== 200) return;
        var data;
        try { data = JSON.parse(xhr.responseText); } catch { return; }
        if (data.lastModified && data.lastModified !== version) {
          if (!dirty) {
            window.location.reload();
          } else if (!bannerEl.classList.contains('galley-banner-visible')) {
            showBanner('This document has been updated.', [
              { label: 'Reload', action: function () { window.location.reload(); } }
            ]);
          }
        }
      };
      // Silently ignore network errors
      xhr.onerror = function () {};
      xhr.send();
    }

    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(pollStatus, POLL_INTERVAL);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    startPolling();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopPolling();
      } else {
        pollStatus();
        startPolling();
      }
    });
  });
})();

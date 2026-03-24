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
})();

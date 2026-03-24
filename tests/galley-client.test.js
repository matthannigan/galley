/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:3000/edit/test.html"}
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let clientScript;

beforeAll(async () => {
  clientScript = await readFile(
    path.join(__dirname, '..', 'src', 'galley-client.js'),
    'utf-8'
  );
});

function setupDom(bodyHtml) {
  document.body.innerHTML = bodyHtml;
  eval(clientScript);
}

describe('element detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('makes p elements contenteditable', () => {
    setupDom('<p>Hello</p>');
    expect(document.querySelector('p').getAttribute('contenteditable')).toBe('true');
  });

  test('makes heading elements contenteditable', () => {
    setupDom('<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>');
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      expect(el.getAttribute('contenteditable')).toBe('true');
    });
  });

  test('makes list items contenteditable', () => {
    setupDom('<ul><li>Item</li></ul>');
    expect(document.querySelector('li').getAttribute('contenteditable')).toBe('true');
  });

  test('makes table cells contenteditable', () => {
    setupDom('<table><tr><td>Cell</td><th>Header</th></tr></table>');
    expect(document.querySelector('td').getAttribute('contenteditable')).toBe('true');
    expect(document.querySelector('th').getAttribute('contenteditable')).toBe('true');
  });

  test('makes blockquote, figcaption, dt, dd contenteditable', () => {
    setupDom('<blockquote>Quote</blockquote><figure><figcaption>Cap</figcaption></figure><dl><dt>Term</dt><dd>Def</dd></dl>');
    ['blockquote', 'figcaption', 'dt', 'dd'].forEach(tag => {
      expect(document.querySelector(tag).getAttribute('contenteditable')).toBe('true');
    });
  });

  test('excludes elements with data-no-edit', () => {
    setupDom('<p>Editable</p><p data-no-edit>Protected</p>');
    const ps = document.querySelectorAll('p');
    expect(ps[0].getAttribute('contenteditable')).toBe('true');
    expect(ps[1].getAttribute('contenteditable')).toBeNull();
  });

  test('excludes descendants of data-no-edit', () => {
    setupDom('<div data-no-edit><p>Nested protected</p></div><p>Editable</p>');
    const ps = document.querySelectorAll('p');
    expect(ps[0].getAttribute('contenteditable')).toBeNull();
    expect(ps[1].getAttribute('contenteditable')).toBe('true');
  });

  test('adds galley-editable class to editable elements', () => {
    setupDom('<p>Hello</p>');
    expect(document.querySelector('p').classList.contains('galley-editable')).toBe(true);
  });

  test('does not add galley-editable class to excluded elements', () => {
    setupDom('<p data-no-edit>Protected</p>');
    expect(document.querySelector('p').classList.contains('galley-editable')).toBe(false);
  });
});

describe('save UI', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('creates save button on DOMContentLoaded', () => {
    document.body.innerHTML = '<!-- galley:start --><p>Content</p><!-- galley:end -->';
    eval(clientScript);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('galley-save')).not.toBeNull();
    expect(document.getElementById('galley-save').textContent).toBe('Save');
  });

  test('creates toast container on DOMContentLoaded', () => {
    document.body.innerHTML = '<!-- galley:start --><p>Content</p><!-- galley:end -->';
    eval(clientScript);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.getElementById('galley-toast')).not.toBeNull();
  });

  test('Ctrl+S prevents default browser behavior', () => {
    setupDom('<p>Content</p>');
    var event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    var prevented = !document.dispatchEvent(event);
    expect(prevented).toBe(true);
  });
});

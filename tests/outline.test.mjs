import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../dist/esm/index.js';

async function setup(t, props = {}) {
  const dom = new JSDOM(
    '<div id="mount"></div><article><h2 id="strange:&quot;[]">First</h2><h3>Second</h3></article>',
  );
  const saved = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('mount'));
  const scopeRef = createRef();
  scopeRef.current = document.querySelector('article');
  const render = async (extra = {}) =>
    act(() =>
      root.render(React.createElement(api.DocumentOutline, { scopeRef, ...props, ...extra })),
    );
  t.after(async () => {
    await act(() => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { dom, scopeRef, render };
}

test('ESM and CommonJS expose the same runtime API without browser globals', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(api).sort());
});

test('extracts scoped headings, preserves punctuation IDs, assigns collision-free IDs', () => {
  const dom = new JSDOM(
    '<h1 id="outline-heading-2">Outside</h1><article><h2 id="a[]">Inside</h2><h3>Next</h3></article>',
  );
  const headings = api.extractHeadings(dom.window.document.querySelector('article'));
  assert.equal(headings.length, 2);
  assert.equal(headings[0].id, 'a[]');
  assert.equal(headings[1].id, 'outline-heading-3');
  assert.deepEqual(api.extractHeadings(dom.window.document.querySelector('article')), headings);
  dom.window.close();
});

test('explicit headings render without DOM extraction and escape text', async (t) => {
  const { render } = await setup(t);
  await render({ headings: [{ id: 'literal', text: '<script>', level: 2 }] });
  assert.equal(document.querySelector('button').textContent, '<script>');
  assert.equal(document.querySelector('script'), null);
  await render({ headings: [] });
  assert.equal(document.querySelectorAll('button').length, 0);
});

test('DOM navigation handles unsafe selector characters and keyboard focus', async (t) => {
  const changes = [];
  const { render, scopeRef, dom } = await setup(t, { onActiveChange: (id) => changes.push(id) });
  let scrolled = 0;
  scopeRef.current.firstElementChild.scrollIntoView = () => scrolled++;
  await render();
  const buttons = document.querySelectorAll('button');
  buttons[0].focus();
  await act(() =>
    buttons[0].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    ),
  );
  assert.equal(document.activeElement, buttons[1]);
  await act(() =>
    buttons[1].dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    ),
  );
  assert.equal(document.activeElement, buttons[0]);
  await act(() => buttons[0].click());
  assert.equal(scrolled, 1);
  assert.equal(buttons[0].getAttribute('aria-current'), 'location');
  assert.equal(changes.at(-1), 'strange:"[]');
});

test('intersection observer chooses heading order and disconnects on unmount', async (t) => {
  const { render, dom, scopeRef } = await setup(t);
  let callback;
  let disconnected = 0;
  const observed = [];
  dom.window.IntersectionObserver = class {
    constructor(cb, options) {
      callback = cb;
      assert.equal(options.rootMargin, '0px 0px -65% 0px');
    }
    observe(target) {
      observed.push(target);
    }
    disconnect() {
      disconnected++;
    }
  };
  await render();
  assert.ok(observed.length >= 2);
  const elements = scopeRef.current.querySelectorAll('h2,h3');
  await act(() => callback([{ target: elements[1], isIntersecting: true }]));
  assert.equal(document.querySelectorAll('button')[1].getAttribute('aria-current'), 'location');
  await render({ observe: false });
  assert.ok(disconnected > 0);
});

test('mutation observation refreshes headings and cleans up', async (t) => {
  const { render, scopeRef, dom } = await setup(t);
  const NativeObserver = dom.window.MutationObserver;
  let disconnects = 0;
  dom.window.MutationObserver = class extends NativeObserver {
    disconnect() {
      disconnects++;
      super.disconnect();
    }
  };
  await render();
  await act(async () => {
    const heading = document.createElement('h4');
    heading.textContent = 'Added';
    scopeRef.current.append(heading);
    await Promise.resolve();
  });
  assert.equal(document.querySelectorAll('button').length, 3);
  await render({ headings: [] });
  assert.ok(disconnects > 0);
});

test('rejects duplicate IDs and invalid levels during server rendering', async () => {
  const { renderToString } = await import('react-dom/server');
  assert.throws(
    () =>
      renderToString(
        React.createElement(api.DocumentOutline, {
          headings: [
            { id: 'x', level: 2, text: 'A' },
            { id: 'x', level: 3, text: 'B' },
          ],
        }),
      ),
    RangeError,
  );
  assert.throws(
    () =>
      renderToString(
        React.createElement(api.DocumentOutline, {
          headings: [{ id: 'x', level: 7, text: 'A' }],
        }),
      ),
    RangeError,
  );
});

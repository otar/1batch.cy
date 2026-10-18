/*
 * 1batch.cy · tests/privacy.test.js
 * ---------------------------------------------------------------------------
 * The privacy rules and the site rules from CLAUDE.md:
 *   - No network requests, no cookies, no storage, no scripts from other sites.
 *   - The page writes data only with .value and .textContent.
 *   - Autocomplete and spellcheck are off. translate="no" is on the data.
 *   - The CSP in index.html is the same as the CSP header in _headers.
 *   - index.html uses root-relative URLs, because Pages sends index.html
 *     for each unknown path.
 *
 * Also, each test in each file fails if the page sends a request to a
 * different site (see tests/helpers.js).
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const h = require('./helpers');
const { SITE, readHeaderRules } = require('./server');

const site = h.useSite();
const HTML = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const TAGS = HTML.match(/<[a-z][^>]*>/gi);

/** app.js without its comments. The comments name some APIs that the code must not use. */
function appCode() {
  return fs.readFileSync(path.join(SITE, 'app.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}

/** The value of an attribute in an HTML tag, or null. */
function attribute(tag, name) {
  const found = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return found ? found[1] : null;
}

/** The addresses of the site files: '/', '/app.js', '/img/1bank-step-1.png' and more. */
function siteFiles() {
  const files = new Set(['/']);
  const walk = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name !== '_headers') files.add(`/${path.relative(SITE, file).split(path.sep).join('/')}`);
    }
  };
  walk(SITE);
  return files;
}

/* ---------- The files ---------- */

test('app.js uses no network, no storage and no HTML strings', () => {
  const code = appCode();
  assert.match(code, /function buildXml\(/, 'The comment filter removed code.');
  const forbidden = {
    'fetch()': /\bfetch\s*\(/,
    XMLHttpRequest: /XMLHttpRequest/,
    sendBeacon: /sendBeacon/,
    WebSocket: /WebSocket/,
    EventSource: /EventSource/,
    RTCPeerConnection: /RTCPeerConnection/,
    'import()': /\bimport\s*\(/,
    importScripts: /importScripts/,
    'a worker': /\bnew\s+(Shared)?Worker\b/,
    serviceWorker: /serviceWorker/,
    'an image request': /new\s+Image\b|\.src\s*=/,
    'window.open()': /\bwindow\.open\s*\(/,
    'a change of the address': /\blocation\s*(\.href\s*)?=[^=]|\blocation\.(assign|replace)\s*\(/,
    cookies: /\.cookie\b/,
    localStorage: /localStorage/,
    sessionStorage: /sessionStorage/,
    indexedDB: /indexedDB/,
    'the cache API': /\bcaches\./,
    innerHTML: /innerHTML/,
    outerHTML: /outerHTML/,
    insertAdjacentHTML: /insertAdjacentHTML/,
    'document.write()': /document\.write/,
    'eval()': /\beval\s*\(/,
    'new Function()': /new\s+Function\s*\(/,
    'a timer with a string': /set(Timeout|Interval)\s*\(\s*['"`]/,
  };
  const found = Object.entries(forbidden).filter(([, pattern]) => pattern.test(code)).map(([name]) => name);
  assert.deepEqual(found, []);
});

test('the CSP in index.html is the same as the CSP header in _headers', () => {
  const meta = TAGS.find(tag => /http-equiv="Content-Security-Policy"/i.test(tag));
  const all = readHeaderRules().find(rule => rule.pattern === '/*');
  assert.ok(all, '_headers has no rule for "/*".');
  const header = new Map(all.headers.map(([name, value]) => [name.toLowerCase(), value]));
  // A meta tag cannot set frame-ancestors. Only the header can.
  assert.equal(header.get('content-security-policy'), `${attribute(meta, 'content')}; frame-ancestors 'none'`);
  assert.match(attribute(meta, 'content'), /(^|; )connect-src 'none'(;|$)/);
  assert.match(attribute(meta, 'content'), /(^|; )default-src 'none'(;|$)/);
  assert.equal(header.get('x-content-type-options'), 'nosniff');
  assert.equal(header.get('x-frame-options'), 'DENY');
  assert.equal(header.get('referrer-policy'), 'no-referrer');
  assert.match(header.get('strict-transport-security'), /^max-age=\d+/);
});

test('index.html loads only files from this site, with root-relative URLs', () => {
  const files = siteFiles();
  const problems = [];
  for (const tag of TAGS) {
    for (const name of ['src', 'href']) {
      const url = attribute(tag, name);
      if (url === null || url.startsWith('#')) continue;
      if (/^<a\s/i.test(tag) && (url.startsWith('https://github.com/otar/') || url === 'https://otar.me')) continue;
      if (!url.startsWith('/') || url.startsWith('//')) problems.push(`not root-relative: ${url}`);
      else if (!files.has(url)) problems.push(`no such file in site/: ${url}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('index.html has no inline scripts, styles or event handlers', () => {
  const scripts = [...HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.deepEqual(scripts.map(([, attrs, body]) => [attribute(attrs, 'src'), body.trim()]), [['/app.js', '']]);
  assert.doesNotMatch(HTML, /<style\b/i);
  assert.deepEqual(TAGS.filter(tag => /\sstyle=|\son[a-z]+=/i.test(tag)), []);
  const links = TAGS.filter(tag => /^<a\s/i.test(tag) && /href="https:/.test(tag));
  assert.deepEqual(links.filter(tag => !/rel="[^"]*noopener/.test(tag)), [], 'Links to other sites need rel="noopener".');
});

test('index.html: no autocomplete, no spellcheck, and translate="no" on the data', () => {
  const problems = [];
  for (const tag of TAGS.filter(item => /^<(input|textarea)\s/i.test(item))) {
    const type = (attribute(tag, 'type') || 'text').toLowerCase();
    if (['file', 'checkbox', 'radio', 'hidden'].includes(type)) continue;
    if (attribute(tag, 'autocomplete') !== 'off') problems.push(`autocomplete is not off: ${tag}`);
    if (type !== 'date' && attribute(tag, 'spellcheck') !== 'false') problems.push(`spellcheck is not off: ${tag}`);
  }
  assert.deepEqual(problems, []);
  for (const id of ['editor', 'bar', 'done']) {
    const tag = TAGS.find(item => attribute(item, 'id') === id);
    assert.equal(attribute(tag, 'translate'), 'no', `#${id} needs translate="no".`);
  }
});

/* ---------- The page in the browser ---------- */

test('the browser blocks all connections from the page', async t => {
  // The test tries to connect on purpose. The browser writes errors in the console, and
  // Playwright reports the blocked requests to other sites. The test examines them below.
  const page = await site.open(t, { consoleErrors: true, otherSites: true });
  const finished = [];
  page.on('requestfinished', request => { if (request.url().includes('probe')) finished.push(request.url()); });
  const port = new URL(site.origin).port;
  const results = await page.evaluate(async port => {
    const attempt = run => new Promise(resolve => {
      try {
        run(() => resolve('sent'), () => resolve('blocked'));
      } catch {
        resolve('blocked');
      }
      setTimeout(() => resolve('blocked'), 2000);
    });
    return {
      fetch: await attempt((sent, blocked) => fetch('/probe-fetch').then(sent, blocked)),
      fetchOtherSite: await attempt((sent, blocked) => fetch('https://example.com/probe').then(sent, blocked)),
      xhr: await attempt((sent, blocked) => {
        const request = new XMLHttpRequest();
        request.onload = sent;
        request.onerror = blocked;
        request.open('GET', '/probe-xhr');
        request.send();
      }),
      webSocket: await attempt((sent, blocked) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/probe-ws`);
        socket.onopen = sent;
        socket.onerror = blocked;
      }),
      eventSource: await attempt((sent, blocked) => {
        const source = new EventSource('/probe-events');
        source.onopen = sent;
        source.onerror = blocked;
      }),
      beacon: await attempt((sent, blocked) => { navigator.sendBeacon('/probe-beacon', 'data'); setTimeout(blocked, 500); }),
      imageOtherSite: await attempt((sent, blocked) => {
        const image = new Image();
        image.onload = sent;
        image.onerror = blocked;
        image.src = 'https://example.com/probe.png';
      }),
    };
  }, port);
  assert.deepEqual(results, {
    fetch: 'blocked', fetchOtherSite: 'blocked', xhr: 'blocked', webSocket: 'blocked',
    eventSource: 'blocked', beacon: 'blocked', imageOtherSite: 'blocked',
  });
  assert.deepEqual(site.server.paths.filter(url => url.includes('probe')), [], 'The server received a request.');
  assert.deepEqual(finished, [], 'A request to a different site was sent.');
});

test('the page keeps nothing in the browser, and asks the server only for its own files', async t => {
  const first = site.server.paths.length;
  const page = await site.open(t);
  await h.fillPayFrom(page, { ref: 'PRIVACY-1' });
  await h.clearSample(page);
  await h.paste(page, '#paste-box', `A\t${h.IBAN.boc}\t10.00\tB\nC\t${h.IBAN.de}\t20.00\tD`);
  await h.dialogBody(page, 'Paste payments');
  await h.dialogButton(page, 'Add 2 payments');
  await h.fillRow(page, 1, { name: 'NEW NAME' });
  await h.download(page, () => page.click('[data-action="export-csv"]'));
  await h.download(page, () => page.click('#bar-btn'));
  await page.click('#done-close');
  await h.openFile(page, 'one.csv', `type,name,iban,bic,amount,description\n,B,${h.IBAN.boc},,1.00,C`);
  await page.locator('#opened').waitFor();
  await page.locator('#guide').scrollIntoViewIfNeeded();

  assert.deepEqual(await page.context().cookies(), []);
  assert.deepEqual(await page.evaluate(async () => ({
    cookie: document.cookie,
    localStorage: localStorage.length,
    sessionStorage: sessionStorage.length,
    indexedDB: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
    serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
  })), { cookie: '', localStorage: 0, sessionStorage: 0, indexedDB: 0, caches: 0, serviceWorkers: 0 });

  const files = siteFiles();
  assert.deepEqual(site.server.paths.slice(first).filter(url => !files.has(url)), []);
});

test('the page works at any address, as on Cloudflare Pages', async t => {
  const page = await site.open(t, { path: '/2026/october/payments' });
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('bar')).position), 'fixed',
    'style.css did not load.');
});

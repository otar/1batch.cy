/*
 * 1batch.cy · tests/smoke.js
 * ---------------------------------------------------------------------------
 * A smoke test of the site in a real browser (Chromium, with Playwright).
 *
 * Run:  node tests/smoke.js
 *
 * The test starts a small web server for the site/ folder. The server sends
 * the headers from site/_headers, as Cloudflare Pages does. Then the test
 * opens the page at three widths and uses the main functions:
 *   - The page opens with 8 sample payments, with no errors in the console
 *     and no requests to other sites.
 *   - The page does not scroll sideways.
 *   - "Download XML" with sample data shows the warning, then gives the file.
 *   - "Clear all" shows the 3 start cards.
 *   - "Open" loads the downloaded XML file again.
 *   - A bad IBAN and a "&" in a name show the correct messages.
 *
 * Exit code: 0 when all parts pass, 1 when a part fails, 2 when Playwright
 * or Chromium is not available. The test writes files only to a temporary
 * folder, and deletes the folder at the end.
 */

'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not available. Claude Code cloud sessions have it by default.');
  console.error('On your computer: run "npm install --no-save playwright", then "npx playwright install chromium".');
  process.exit(2);
}

const SITE = path.join(__dirname, '..', 'site');
const XML_NAMESPACE = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09';
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/* ---------- Web server ---------- */

/** Reads site/_headers. The format is the Cloudflare Pages format: a path, then indented "Name: value" lines. A "! Name" line removes a header. */
function readHeaderRules() {
  const rules = [];
  let rule = null;
  for (const line of fs.readFileSync(path.join(SITE, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rule = { pattern: line.trim(), headers: [] };
      rules.push(rule);
    } else if (rule && line.trim().startsWith('!')) {
      rule.headers.push([line.trim().slice(1).trim(), null]);
    } else if (rule) {
      const at = line.indexOf(':');
      rule.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return rules;
}

/** "*" in a _headers path agrees with all characters. */
function pathMatches(pattern, urlPath) {
  const parts = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('.*')}$`).test(urlPath);
}

/** Serves site/ on 127.0.0.1 with a free port. Cloudflare Pages does not publish _headers, so this server does not too. */
function startServer() {
  const rules = readHeaderRules();
  const server = http.createServer((request, response) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const file = path.join(SITE, path.normalize(urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath));
    const found = file.startsWith(SITE + path.sep) && path.basename(file) !== '_headers'
      && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!found) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    for (const rule of rules) {
      if (!pathMatches(rule.pattern, urlPath)) continue;
      for (const [name, value] of rule.headers) {
        if (value === null) response.removeHeader(name);
        else response.setHeader(name, value);
      }
    }
    response.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ---------- Results ---------- */

let passed = 0;
let failed = 0;

/** Runs one part of the test. The part gives true, or a text that tells what is wrong. */
async function part(name, run) {
  let problem = '';
  try {
    const outcome = await run();
    if (outcome !== true) problem = String(outcome);
  } catch (error) {
    problem = error.message.split('\n')[0];
  }
  if (problem) failed += 1; else passed += 1;
  console.log(problem ? `FAIL  ${name}: ${problem}` : `PASS  ${name}`);
}

/* ---------- The parts of the test ---------- */

/** The main functions. The test does these only at desktop width. */
async function desktopFlow(page, folder) {
  let xmlFile = '';

  await part('desktop: "Download XML" with sample data shows the warning', async () => {
    await page.fill('#debtor-name', 'TEST COMPANY LTD');
    await page.fill('#debtor-iban', 'CY17002001280000001200527600');
    await page.click('#bar-btn');
    await page.waitForFunction(() => document.getElementById('dialog').open);
    const buttons = (await page.locator('#dialog-actions button').allTextContents()).join(', ');
    return buttons === 'Download anyway, Cancel' || `the buttons are: ${buttons}`;
  });

  await part('desktop: "Download anyway" gives an XML file with 8 payments', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#dialog-actions button', { hasText: 'Download anyway' }).click(),
    ]);
    xmlFile = path.join(folder, download.suggestedFilename());
    await download.saveAs(xmlFile);
    const xml = fs.readFileSync(xmlFile, 'utf8');
    const count = (xml.match(/<CdtTrfTxInf>/g) || []).length;
    if (!xml.includes(`xmlns="${XML_NAMESPACE}"`)) return 'the file does not have the pain.001.001.09 namespace';
    return (count === 8 && xml.includes('<NbOfTxs>8</NbOfTxs>')) || `the file has ${count} payments`;
  });

  await part('desktop: the "file is ready" window opens and closes', async () => {
    await page.waitForFunction(() => document.getElementById('done').open);
    await page.click('#done-close');
    await page.waitForFunction(() => !document.getElementById('done').open);
    return true;
  });

  await part('desktop: "Clear all" shows the 3 start cards', async () => {
    await page.click('#clear-all');
    await page.waitForSelector('#start', { state: 'visible' });
    return (await page.isHidden('#sheet')) || 'the payment table is still visible';
  });

  await part('desktop: "Open" loads the downloaded XML file again', async () => {
    await page.setInputFiles('#file-input', xmlFile);
    await page.waitForFunction(() => document.querySelectorAll('#payments > li').length === 8);
    const name = await page.inputValue('#debtor-name');
    return name === 'TEST COMPANY LTD' || `the company name is "${name}"`;
  });

  await part('desktop: a bad IBAN and a "&" in a name show the correct messages', async () => {
    const row = page.locator('#payments > li').first();
    await row.locator('[data-field=iban]').fill('CY00BAD');
    await row.locator('[data-field=name]').fill('A & B');
    await page.click('#debtor-name');
    await page.click('#bar-btn');
    await page.waitForFunction(() => document.getElementById('bar-status').textContent.includes('2 problems'));
    const messages = await row.locator('.row-msgs').innerText();
    const expected = ['does not accept “&”', 'Change to', 'a CY IBAN has 28 characters'];
    const missing = expected.filter(text => !messages.includes(text));
    return !missing.length || `missing: ${missing.join(', ')}`;
  });
}

/** Opens the page at one width. At desktop width, also does the main functions. */
async function testWidth(browser, origin, size, folder) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  const outside = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) outside.push(url);
  });

  await part(`${size.name}: the page opens with 8 sample payments`, async () => {
    await page.goto(`${origin}/`);
    await page.waitForSelector('#payments > li');
    const count = await page.locator('#payments > li').count();
    if (await page.locator('#no-js').count()) return 'app.js did not start';
    return count === 8 || `the table has ${count} payments`;
  });

  await part(`${size.name}: the page does not scroll sideways`, async () => {
    const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    return extra <= 0 || `the page is ${extra}px too wide`;
  });

  if (size.name === 'desktop') await desktopFlow(page, folder);

  await part(`${size.name}: no errors in the console`, () => !errors.length || errors.join(' | '));
  await part(`${size.name}: no requests to other sites`, () => !outside.length || outside.join(', '));
  await context.close();
}

async function main() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), '1batch-smoke-'));
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    try {
      browser = await chromium.launch();
    } catch (error) {
      console.error(`Chromium does not start: ${error.message.split('\n')[0]}`);
      process.exitCode = 2;
      return;
    }
    for (const size of WIDTHS) await testWidth(browser, origin, size, folder);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  } finally {
    if (browser) await browser.close();
    server.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

main();

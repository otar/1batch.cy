/*
 * 1batch.cy · tests/helpers.js
 * ---------------------------------------------------------------------------
 * The shared parts of the tests.
 *
 * useSite() starts the web server and the browser one time for each test file.
 * The browser is Chromium. To use a different browser engine, set BROWSER:
 *   BROWSER=firefox node --test tests/*.test.js     (or BROWSER=webkit)
 * CI runs the tests in all three engines. A test that needs one engine can
 * skip the others with BROWSER.
 *
 * site.open(t) opens the page in a new browser context, with these rules:
 *   - The clock of the page stops at NOW: Friday 16 October 2026, 11:30:00
 *     in Cyprus. Thus the dates and the IDs in the files do not change.
 *   - At the end of the test, the test fails if the page had a script error,
 *     an error in the console, or a request to a different site.
 *
 * The other functions do the steps that many tests use: type a payment,
 * open a file, get a download, read the messages.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { before, after } = require('node:test');
const { startServer } = require('./server');

let playwright;
try {
  playwright = require('playwright');
} catch {
  throw new Error('Playwright is not available. Claude Code cloud sessions have it. '
    + 'On your computer, run "npm install --no-save playwright", then "npx playwright install chromium".');
}

const BROWSER = process.env.BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(BROWSER)) {
  throw new Error(`BROWSER must be chromium, firefox or webkit, not "${BROWSER}".`);
}

const NOW = new Date('2026-10-16T08:30:00Z');  // Friday 16 October 2026, 11:30:00 in Cyprus (UTC+3)
const TODAY = '2026-10-16';
const NEXT_BUSINESS_DAY = '2026-10-19';           // Monday

const SIZES = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1100 },
  phone: { width: 390, height: 844 },
};

// IBANs with correct check digits. They are not real accounts.
const IBAN = {
  company: 'CY17002001280000001200527600',        // Bank of Cyprus
  boc: 'CY21002001950000357001234567',            // Bank of Cyprus
  hellenic: 'CY15005001040000001017733441',       // Hellenic Bank, Cyprus
  de: 'DE89370400440532013000',                   // Commerzbank, Germany
  nl: 'NL91ABNA0417164300',                       // ABN AMRO, Netherlands
};

const COMPANY = { name: 'TEST COMPANY LTD', iban: IBAN.company };

/** Starts the web server and Chromium before the tests of a file, and stops them after the tests. */
function useSite() {
  const site = { origin: '', server: null, browser: null };

  before(async () => {
    site.server = await startServer();
    site.origin = `http://127.0.0.1:${site.server.address().port}`;
    site.browser = await playwright[BROWSER].launch();
  });

  after(async () => {
    if (site.browser) await site.browser.close();
    if (site.server) site.server.close();
  });

  /**
   * Opens the page in a new browser context, and closes it at the end of the test t.
   * size: 'desktop', 'tablet' or 'phone'. path: the address on the site.
   * consoleErrors, otherSites: true for a test that causes errors in the console,
   * or requests to other sites, on purpose. Then the test must examine them itself.
   * forcedColors: 'active' for the colors of a Windows contrast theme.
   */
  site.open = async (t, { size = 'desktop', path = '/', consoleErrors = false, otherSites = false, forcedColors } = {}) => {
    const context = await site.browser.newContext({
      viewport: SIZES[size], acceptDownloads: true, ...(forcedColors ? { forcedColors } : {}),
    });
    await context.clock.setFixedTime(NOW);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);

    const problems = [];
    page.on('pageerror', error => problems.push(`script error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error' && !consoleErrors) problems.push(`console error: ${message.text()}`);
    });
    page.on('request', request => {
      const url = request.url();
      if (!otherSites && !url.startsWith(`${site.origin}/`) && !/^(data|blob):/.test(url)) problems.push(`request to a different site: ${url}`);
    });
    t.after(async () => {
      await context.close();
      assert.deepEqual(problems, [], 'The page had problems.');
    });

    await page.goto(site.origin + path);
    await page.locator('#payments > li').first().waitFor();
    return page;
  };

  return site;
}

/* ---------- Payments ---------- */

/** The <li> of payment n. The first payment is 1. */
function row(page, n) {
  return page.locator('#payments > li').nth(n - 1);
}

/** The values of all payments, as the fields show them. */
function rows(page) {
  return page.$$eval('#payments > li', items => items.map(li => {
    const value = field => li.querySelector(`[data-field="${field}"]`).value;
    return { type: value('type'), name: value('name'), iban: value('iban'), bic: value('bic'), amount: value('amount'), desc: value('desc') };
  }));
}

/** The values of one field in all payments: rowField(page, 'name') gives ['A', 'B']. */
async function rowField(page, field) {
  return (await rows(page)).map(values => values[field]);
}

/**
 * Types the values into payment n, and leaves each field. Then the page shows
 * the problems of the field. For "type" and "bic", the function opens "⋯".
 */
async function fillRow(page, n, values) {
  const li = row(page, n);
  if (('type' in values || 'bic' in values) && await li.locator('.row-more').isHidden()) {
    await li.locator('.act-more').click();
  }
  for (const [field, value] of Object.entries(values)) {
    const input = li.locator(`[data-field="${field}"]`);
    if (field === 'type') {
      await input.selectOption(value);
    } else {
      await input.fill(value);
      await input.blur();
    }
  }
}

/** "Clear and start": removes the sample payments and shows the start cards. */
async function clearSample(page) {
  await page.click('#sample-note button');
  await page.locator('#start').waitFor();
}

/** Removes the sample payments, then adds the payments: one row for each item. */
async function addPayments(page, payments) {
  await clearSample(page);
  for (let i = 0; i < payments.length; i++) {
    await page.click(i === 0 ? '#start-add' : '.add-row');
    await fillRow(page, i + 1, payments[i]);
  }
}

/* ---------- Pay from ---------- */

/** Types the "Pay from" values, and leaves each field. The values that you do not give stay as they are. */
async function fillPayFrom(page, { name = COMPANY.name, iban = COMPANY.iban, date, ref } = {}) {
  for (const [selector, value] of [['#debtor-name', name], ['#debtor-iban', iban], ['#debtor-date', date]]) {
    if (value === undefined) continue;
    await page.fill(selector, value);
    await page.locator(selector).blur();
  }
  if (ref !== undefined) {
    if (await page.isHidden('#ref-field')) await page.click('#ref-toggle');
    await page.fill('#debtor-ref', ref);
    await page.locator('#debtor-ref').blur();
  }
}

/* ---------- Messages ---------- */

/**
 * The messages in the elements, as text. A button shows in square brackets:
 * 'Amount: use a dot for decimals … [Change to 1250.00]'.
 */
function messages(locator) {
  return locator.evaluateAll(nodes => nodes.map(node => [...node.children]
    .map(child => (child.tagName === 'BUTTON' ? `[${child.textContent}]` : child.textContent))
    .join(' ')));
}

/** The messages of payment n. */
function rowMessages(page, n) {
  return messages(row(page, n).locator('.row-msgs > li'));
}

/** The message of a "Pay from" field: 'name', 'iban', 'date' or 'ref'. An empty text if there is no message. */
async function payFromMessage(page, field) {
  const [text] = await messages(page.locator(`#debtor-${field}-msg`));
  return text;
}

/** The text of the element, with the spaces as a browser shows them. */
async function text(page, selector) {
  return (await page.locator(selector).innerText()).trim();
}

/** Waits for the dialog with this title. Gives the text of the dialog body. */
async function dialogBody(page, title) {
  await page.waitForFunction(() => document.getElementById('dialog').open);
  assert.equal(await page.textContent('#dialog-title'), title);
  return text(page, '#dialog-body');
}

/**
 * Clicks a button in the open dialog. The page gets the answer in the "close"
 * event, a short time after the dialog closes. Thus the function also waits
 * for one task of the page.
 */
async function dialogButton(page, label) {
  await page.locator('#dialog-actions button', { hasText: label }).click();
  await page.waitForFunction(() => !document.getElementById('dialog').open);
  await page.evaluate(() => new Promise(resolve => { setTimeout(resolve, 0); }));
}

/* ---------- Files ---------- */

/** Opens a file, as "Open XML or CSV" does. content: a string or a Buffer. */
async function openFile(page, name, content) {
  await page.setInputFiles('#file-input', {
    name,
    mimeType: name.endsWith('.xml') ? 'application/xml' : 'text/csv',
    buffer: Buffer.from(content),
  });
}

/** Does the action, and gives the file that the browser downloads: { name, text }. */
async function download(page, action) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: file.suggestedFilename(), text: fs.readFileSync(await file.path(), 'utf8') };
}

/**
 * Dispatches a paste event with the text, as a paste from Excel does.
 * The test does not use the system clipboard, because it is not the same on each computer.
 */
async function paste(page, selector, content) {
  await page.locator(selector).focus();
  await page.evaluate(value => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, content);
}

module.exports = {
  BROWSER, NOW, TODAY, NEXT_BUSINESS_DAY, SIZES, IBAN, COMPANY,
  useSite, row, rows, rowField, fillRow, clearSample, addPayments, fillPayFrom,
  messages, rowMessages, payFromMessage, text, dialogBody, dialogButton,
  openFile, download, paste,
};

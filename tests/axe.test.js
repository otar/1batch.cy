/*
 * 1batch.cy · tests/axe.test.js
 * ---------------------------------------------------------------------------
 * An automatic accessibility scan with axe-core, in the main states of the
 * page: the WCAG 2.2 rules of level A and AA.
 *
 * axe-core is not in this repository. CI installs it for this test:
 *   npm install --no-save --no-package-lock axe-core@4.11.4
 * Without axe-core, the test does not run.
 *
 * The CSP of the page allows scripts only from the site. Thus the test gives
 * axe-core to the page at a site address (/axe.min.js) with page.route().
 * The server does not get this request.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();
const XML = fs.readFileSync(path.join(__dirname, 'golden', 'payments.xml'), 'utf8');

const AXE = (() => {
  try {
    return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return null;
  }
})();

// The states of the page: [name, size, the steps to get there]
const STATES = [
  ['sample data', 'desktop', async () => {}],
  ['errors shown', 'desktop', async page => { await page.click('#bar-btn'); }],
  ['start cards', 'desktop', async page => { await h.clearSample(page); }],
  ['"⋯" panel open', 'desktop', async page => { await h.row(page, 1).locator('.act-more').click(); }],
  ['FAQ open', 'desktop', async page => { await page.click('#faq-toggle'); }],
  ['an old file open', 'desktop', async page => {
    await h.openFile(page, 'old.xml', XML.replaceAll('<Dt>2026-10-19</Dt>', '<Dt>2026-10-01</Dt>'));
    await page.locator('#opened').waitFor();
  }],
  ['paste preview', 'desktop', async page => {
    await h.paste(page, 'body', `A NAME\t${h.IBAN.boc}\t1,100.00\tTEXT\nB NAME\t${h.IBAN.de}\t200.00\tTEXT`);
    await h.dialogBody(page, 'Paste payments');
  }],
  ['"The file is ready"', 'desktop', async page => {
    await h.openFile(page, 'payments.xml', XML);
    await page.locator('#opened').waitFor();
    await h.download(page, () => page.click('#bar-btn'));
    await page.waitForFunction(() => document.getElementById('done').open);
  }],
  ['sample data', 'phone', async () => {}],
  ['errors shown', 'phone', async page => { await page.click('#bar-btn'); }],
];

test('axe-core finds no WCAG 2.2 A or AA issue in the main states of the page', {
  skip: !AXE && 'axe-core is not installed. CI installs it.',
}, async t => {
  for (const [name, size, steps] of STATES) {
    await t.test(`${size}: ${name}`, async st => {
      const page = await site.open(st, { size });
      await page.route('**/axe.min.js', route => route.fulfill({ contentType: 'text/javascript', body: AXE }));
      await steps(page);
      await page.addScriptTag({ url: '/axe.min.js' });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
          resultTypes: ['violations'],
        });
        return result.violations.map(v => `${v.id}: ${v.help} (${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')})`);
      });
      assert.deepEqual(violations, []);
    });
  }
});

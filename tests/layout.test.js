/*
 * 1batch.cy · tests/layout.test.js
 * ---------------------------------------------------------------------------
 * The page at 3 widths: desktop (a table), tablet and phone (cards).
 * The test does not compare screenshots, because each small CSS change
 * would break them. It examines the positions of the parts of the page.
 */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();

/** How many pixels the page is wider than the window. 0 or less is correct. */
function extraWidth(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** The top and bottom of each field of payment n, in pixels. */
function fieldBoxes(page, n) {
  return h.row(page, n).evaluate(li => Object.fromEntries(['name', 'iban', 'amount', 'desc'].map(field => {
    const box = li.querySelector(`[data-field="${field}"]`).getBoundingClientRect();
    return [field, { top: Math.round(box.top), bottom: Math.round(box.bottom) }];
  })));
}

for (const size of Object.keys(h.SIZES)) {
  const { width, height } = h.SIZES[size];

  test(`${size}: the page does not scroll sideways, also with long values and a wide dialog`, async t => {
    const page = await site.open(t, { size });
    assert.ok(await extraWidth(page) <= 0, 'with the sample data');

    await h.fillRow(page, 1, { name: 'W'.repeat(35), desc: 'W'.repeat(140) });
    assert.ok(await extraWidth(page) <= 0, 'with the longest name and description');

    await h.paste(page, 'body', `NAME\t${h.IBAN.de}\tCOBADEFFXXX\t3200.00\t${'W'.repeat(140)}\tsepa`);
    await h.dialogBody(page, 'Paste payments');
    const dialog = await page.locator('#dialog').boundingBox();
    assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width, 'The paste preview is wider than the window.');
    await h.dialogButton(page, 'Cancel');

    await h.clearSample(page);
    assert.ok(await extraWidth(page) <= 0, 'with the 3 start cards');
  });

  test(`${size}: the bottom bar and its button are on the screen`, async t => {
    const page = await site.open(t, { size });
    for (const selector of ['#bar', '#bar-btn']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height && box.x >= 0 && box.x + box.width <= width,
        `${selector} is not fully on the screen.`);
    }
  });
}

test('desktop: each payment is one line of a table', async t => {
  const page = await site.open(t, { size: 'desktop' });
  assert.equal(await page.isVisible('.sheet-head'), true);
  const boxes = await fieldBoxes(page, 1);
  assert.deepEqual(new Set(Object.values(boxes).map(box => box.top)).size, 1, 'The 4 fields are not on one line.');
});

for (const size of ['tablet', 'phone']) {
  test(`${size}: each payment is a card`, async t => {
    const page = await site.open(t, { size });
    assert.equal(await page.isHidden('.sheet-head'), true);
    const boxes = await fieldBoxes(page, 1);
    assert.ok(boxes.amount.top >= boxes.name.bottom, 'The amount is not below the name.');
    // On a tablet, the name and the IBAN are on one line. On a phone, each field has its own line.
    if (size === 'phone') assert.ok(boxes.iban.top >= boxes.name.bottom, 'The IBAN is not below the name.');
  });
}

test('phone: type a payment and download the file', async t => {
  const page = await site.open(t, { size: 'phone' });
  await h.fillPayFrom(page);
  await h.addPayments(page, [{ name: 'ANDREAS GEORGIOU', iban: h.IBAN.boc, amount: '2450.00', desc: 'SALARY' }]);
  assert.equal(await h.text(page, '#bar-status'), 'The payment passes the checks.');
  const file = await h.download(page, () => page.click('#bar-btn'));
  assert.match(file.text, /<NbOfTxs>1<\/NbOfTxs>/);
  await page.waitForFunction(() => document.getElementById('done').open);
  assert.ok(await extraWidth(page) <= 0, 'with the "file is ready" window');
});

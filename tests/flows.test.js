/*
 * 1batch.cy · tests/flows.test.js
 * ---------------------------------------------------------------------------
 * What a user does in the editor, at desktop width: the sample data, the
 * rows, the corrections, the warnings, "Download XML" and Undo. Also the
 * "Open all" button of the FAQ below the editor.
 */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();

// A correct TBOC payment
const PAYMENT = { name: 'ANDREAS GEORGIOU', iban: h.IBAN.boc, amount: '2450.00', desc: 'SALARY OCTOBER 2026' };

test('the page opens with the sample data and an empty "Pay from"', async t => {
  const page = await site.open(t);
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await page.isVisible('#sample-note'), true);
  assert.equal(await page.isVisible('#steps'), true);
  assert.equal(await h.text(page, '#bar-count'), '8 payments');
  assert.equal(await h.text(page, '#bar-total'), '€13,005.74');
  assert.equal(await h.text(page, '#payments-meta'), '5 SEPA · 3 TBOC');
  assert.equal(await page.inputValue('#debtor-name'), '');
  assert.equal(await page.inputValue('#debtor-iban'), '');
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY);
  assert.equal(await h.text(page, '#debtor-date-words'), 'Monday 19 October 2026');
  assert.match(await h.text(page, '#ref-text'), /^File reference [0-9A-HJKMNP-TV-Z]{6} \(random\)/);
});

test('"Clear and start" shows the 3 start cards, and the sample data can come back', async t => {
  const page = await site.open(t);
  await h.clearSample(page);
  assert.equal(await page.isHidden('#sheet'), true);
  assert.equal(await page.locator('.start-card').count(), 3);
  assert.equal(await page.isHidden('#toast'), true, 'The sample data is not your data, so there is no Undo.');
  assert.equal(await h.text(page, '#bar-status'), 'Add payments to start.');

  await page.click('[data-action="example"]');
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await h.text(page, '#toast-text'), 'Sample data is in the table. The names and accounts are not real.');
});

test('"Download XML" with sample data shows a warning first', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await page.click('#bar-btn');
  await h.dialogBody(page, 'This file has sample payments');
  assert.deepEqual(await page.locator('#dialog-actions button').allTextContents(), ['Download anyway', 'Cancel']);
  await h.dialogButton(page, 'Cancel');
  assert.equal(await page.evaluate(() => document.getElementById('done').open), false);

  await page.click('#bar-btn');
  await h.dialogBody(page, 'This file has sample payments');
  const file = await h.download(page, () => h.dialogButton(page, 'Download anyway'));
  assert.equal(file.text.match(/<CdtTrfTxInf>/g).length, 8);
  assert.match(file.text, /<NbOfTxs>8<\/NbOfTxs>/);
});

test('after the download, the window shows the values to compare in 1bank', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await h.addPayments(page, [PAYMENT, { ...PAYMENT, name: 'ELENI CHRISTOU', amount: '0.50' }]);
  const file = await h.download(page, () => page.click('#bar-btn'));
  await page.waitForFunction(() => document.getElementById('done').open);
  assert.equal(await h.text(page, '#done-name'), file.name);
  assert.equal(await h.text(page, '#done-count'), '2');
  assert.equal(await h.text(page, '#done-total'), '€2,450.50');
  assert.equal(await h.text(page, '#done-date'), 'Mon, 19 Oct 2026');
  assert.equal(await page.locator('#done .guide-sm > li').count(), 6, 'The window shows the 6 upload steps.');
  assert.match(await h.text(page, '#done .guide-sm > li:nth-child(3)'), /Make sure that 1bank shows 2 payments and €2,450\.50\./);

  await page.click('#done-close');
  assert.equal(await page.evaluate(() => document.getElementById('done').open), false);
});

test('"Download XML" with problems makes no file, and the arrows go to each problem', async t => {
  const page = await site.open(t);
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await h.addPayments(page, [{ name: 'A & B' }]);
  await page.click('#bar-btn');

  assert.equal(await h.text(page, '#toast-text'), 'Correct 6 problems first. To continue later, use Export CSV.');
  assert.match(await h.text(page, '#bar-status'), /^6 problems to correct\.\s*Problem 1: Pay from, company name: missing$/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'debtor-name');
  assert.equal(await h.payFromMessage(page, 'name'), 'Missing.');
  assert.deepEqual(await h.rowMessages(page, 1), [
    'Name: the bank does not accept “&”. [Change to A AND B]',
    'IBAN: missing.',
    'Amount: missing.',
    'Description: missing.',
  ]);

  await page.click('[data-action="next-problem"]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'debtor-iban');
  await page.click('[data-action="next-problem"]');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'name');
  await page.click('[data-action="prev-problem"]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'debtor-iban');

  await h.fillPayFrom(page);
  await h.fillRow(page, 1, PAYMENT);
  assert.equal(await h.text(page, '#bar-status'), 'The payment passes the checks.');
  assert.equal(downloads, 0);
});

test('a correction button changes only the value that it shows', async t => {
  const page = await site.open(t);
  await h.addPayments(page, [{
    name: 'MÜLLER & CO', iban: 'DE89-3704-0044-0532-0130-00', amount: '1.250,00', desc: 'INVOICE #17',
  }]);
  assert.deepEqual(await h.rowMessages(page, 1), [
    'Name: the bank does not accept “Ü” and “&”. [Change to MULLER AND CO]',
    'IBAN: must start with a 2-letter country code and 2 check digits. Then letters and digits. [Change to DE89370400440532013000]',
    'Amount: use a dot for decimals and no thousands separator, for example 1250.50. [Change to 1250.00]',
    'Description: the bank does not accept “#”. [Change to INVOICE 17]',
  ]);

  for (let i = 0; i < 4; i++) await h.row(page, 1).locator('.fix-btn').first().click();
  assert.deepEqual(await h.rows(page), [{
    type: 'auto', name: 'MULLER AND CO', iban: h.IBAN.de, bic: '', amount: '1250.00', desc: 'INVOICE 17',
  }]);
  assert.deepEqual(await h.rowMessages(page, 1), []);
});

test('"Change all" corrects the same problem in all rows, with Undo', async t => {
  const page = await site.open(t);
  await h.addPayments(page, [
    { ...PAYMENT, amount: '1,250.00' },
    { ...PAYMENT, iban: h.IBAN.de, amount: '2,500.50' },
  ]);
  assert.deepEqual(await h.rowMessages(page, 1), [
    'Amount: use a dot for decimals and no thousands separator, for example 1250.50. [Change to 1250.00] [Change all 2 amounts]',
  ]);

  await h.row(page, 1).locator('.fix-all').click();
  assert.deepEqual(await h.rowField(page, 'amount'), ['1250.00', '2500.50']);
  assert.equal(await h.text(page, '#toast-text'), '2 amounts changed.');

  await page.click('#toast-undo');
  assert.deepEqual(await h.rowField(page, 'amount'), ['1,250.00', '2,500.50']);
  assert.equal(await h.text(page, '#toast-text'), 'The change is undone.');
});

test('two payments with the same IBAN and amount show a warning, until you mark them as correct', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await h.addPayments(page, [PAYMENT]);
  await h.row(page, 1).locator('.act-duplicate').click();
  assert.equal((await h.rows(page)).length, 2);
  assert.deepEqual(await h.rowMessages(page, 1), [
    'Amount: the IBAN and the amount are the same as in payment 2. Make sure that this is correct. [This is correct]',
  ]);
  assert.deepEqual(await h.rowMessages(page, 2), [
    'Amount: the IBAN and the amount are the same as in payment 1. Make sure that this is correct. [This is correct]',
  ]);
  assert.match(await h.text(page, '#bar-status'), /^All 2 payments pass the checks\.\s*2 warnings$/);

  await h.row(page, 2).locator('.fix-btn').click();
  assert.deepEqual(await h.rowMessages(page, 1), []);
  assert.deepEqual(await h.rowMessages(page, 2), []);
  assert.equal(await h.text(page, '#bar-status'), 'All 2 payments pass the checks.');
});

test('the type comes from the IBAN, and you can change it in "⋯"', async t => {
  const page = await site.open(t);
  await h.addPayments(page, [PAYMENT]);
  const li = h.row(page, 1);
  assert.equal(await h.text(page, '#payments-meta'), '0 SEPA · 1 TBOC');
  assert.equal(await li.locator('.iban-info').textContent(), 'Valid IBAN. Bank of Cyprus · Cyprus · TBOC');
  assert.equal(await li.locator('.iban-ok').isVisible(), true);
  assert.equal(await li.locator('.type-tag').isHidden(), true);

  await h.fillRow(page, 1, { type: 'sepa' });
  assert.equal(await h.text(page, '#payments-meta'), '1 SEPA · 0 TBOC');
  assert.equal(await li.locator('.type-tag').textContent(), 'SEPA');
  assert.deepEqual(await h.rowMessages(page, 1), [
    'IBAN: this is a Bank of Cyprus account. Usually, the correct type is TBOC. [Change to TBOC]',
  ]);

  await li.locator('.fix-btn').click();
  assert.equal(await li.locator('[data-field="type"]').inputValue(), 'auto');
  assert.equal(await h.text(page, '#payments-meta'), '0 SEPA · 1 TBOC');

  await h.fillRow(page, 1, { iban: h.IBAN.hellenic });
  assert.equal(await h.text(page, '#payments-meta'), '1 SEPA · 0 TBOC');
  assert.equal(await li.locator('.iban-info').textContent(), 'Valid IBAN. Hellenic Bank · Cyprus · SEPA');
});

test('"Duplicate" puts a duplicate below the row', async t => {
  const page = await site.open(t);
  await h.row(page, 2).locator('.act-duplicate').click();
  assert.deepEqual((await h.rowField(page, 'name')).slice(0, 4),
    ['ANDREAS GEORGIOU', 'ELENI CHRISTOU', 'ELENI CHRISTOU', 'MICHALIS IOANNOU']);
  assert.equal(await page.evaluate(() => document.activeElement.closest('li').querySelector('.num').textContent), '3');
});

test('"Move up" and "Move down" change the order', async t => {
  const page = await site.open(t);
  await h.row(page, 3).locator('.act-more').click();
  await h.row(page, 3).locator('[data-row-action="up"]').click();
  assert.deepEqual((await h.rowField(page, 'name')).slice(0, 3), ['ANDREAS GEORGIOU', 'MICHALIS IOANNOU', 'ELENI CHRISTOU']);
  await h.row(page, 2).locator('[data-row-action="up"]').click();
  assert.deepEqual((await h.rowField(page, 'name')).slice(0, 3), ['MICHALIS IOANNOU', 'ANDREAS GEORGIOU', 'ELENI CHRISTOU']);
  assert.equal(await h.row(page, 1).locator('[data-row-action="up"]').isDisabled(), true);
  await h.row(page, 1).locator('[data-row-action="down"]').click();
  assert.deepEqual((await h.rowField(page, 'name')).slice(0, 3), ['ANDREAS GEORGIOU', 'MICHALIS IOANNOU', 'ELENI CHRISTOU']);
});

test('drag a row by its handle to a new position', async t => {
  const page = await site.open(t);
  await h.row(page, 2).scrollIntoViewIfNeeded();
  await h.row(page, 1).hover();
  const grip = await h.row(page, 1).locator('.grip').boundingBox();
  const target = await h.row(page, 3).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, target.y + target.height * 0.8, { steps: 10 });
  await page.mouse.up();
  assert.deepEqual((await h.rowField(page, 'name')).slice(0, 4),
    ['ELENI CHRISTOU', 'MICHALIS IOANNOU', 'ANDREAS GEORGIOU', 'LIMASSOL OFFICE RENT LTD']);
});

test('"Delete" removes a row, and Undo brings it back', async t => {
  const page = await site.open(t);
  await h.row(page, 1).locator('.act-delete').click();
  assert.equal((await h.rows(page)).length, 7);
  assert.equal((await h.rows(page))[0].name, 'ELENI CHRISTOU');
  assert.equal(await h.text(page, '#toast-text'), 'Payment 1 deleted.');

  await page.click('#toast-undo');
  assert.equal((await h.rows(page)).length, 8);
  assert.equal((await h.rows(page))[0].name, 'ANDREAS GEORGIOU');
});

test('Enter goes to the same field in the next row, and adds a row after the last row', async t => {
  const page = await site.open(t);
  await h.clearSample(page);
  await page.click('#start-add');
  await page.keyboard.type('FIRST');
  await page.keyboard.press('Enter');
  assert.equal((await h.rows(page)).length, 2, 'Enter in the last row adds a row.');
  await page.keyboard.type('SECOND');
  await page.keyboard.press('Shift+Enter');
  assert.equal(await page.evaluate(() => document.activeElement.value), 'FIRST');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.value), 'SECOND');
  assert.deepEqual(await h.rowField(page, 'name'), ['FIRST', 'SECOND']);
});

test('"Pay from": the checks, the date in words and the file reference', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page, { iban: h.IBAN.hellenic });
  assert.equal(await h.payFromMessage(page, 'iban'),
    'Bank code 005 is not Bank of Cyprus (002). The debit account must be at Bank of Cyprus.');
  await h.fillPayFrom(page);
  assert.equal(await h.payFromMessage(page, 'iban'), '');
  assert.equal(await h.text(page, '#debtor-iban-info'), '✓ Bank of Cyprus');

  await h.fillPayFrom(page, { date: '2026-10-17' });
  assert.equal(await h.text(page, '#debtor-date-words'), 'Saturday 17 October 2026. Not a business day.');
  await h.fillPayFrom(page, { date: '2026-10-15' });
  assert.equal(await h.payFromMessage(page, 'date'), 'Is in the past. [Change to Mon, 19 Oct 2026]');
  await page.click('#debtor-date-msg .fix-btn');
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY);

  await h.fillPayFrom(page, { ref: 'OCT_26' });
  assert.equal(await h.payFromMessage(page, 'ref'), 'Use only letters, digits and hyphens.');
  await h.fillPayFrom(page, { ref: 'OCT-26' });
  assert.equal(await h.payFromMessage(page, 'ref'), '');
  assert.equal(await h.text(page, '#ref-text'), 'File reference OCT-26');
});

test('"New file" empties the page, and Undo brings the data back', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await page.click('[data-action="new"]');
  assert.equal(await page.isVisible('#start'), true);
  assert.equal(await page.inputValue('#debtor-name'), '');
  assert.equal(await h.text(page, '#toast-text'), 'New file. The page is empty.');

  await page.click('#toast-undo');
  assert.equal(await page.inputValue('#debtor-name'), h.COMPANY.name);
  assert.equal((await h.rows(page)).length, 8);
});

test('the page asks before you close the tab, but only if the tab has your data', async t => {
  const sample = await site.open(t);
  await sample.click('#bar-count');
  const dialogs = [];
  sample.on('dialog', dialog => { dialogs.push(dialog.type()); dialog.accept(); });
  const closed = sample.waitForEvent('close');
  await sample.close({ runBeforeUnload: true });
  await closed;
  assert.deepEqual(dialogs, [], 'Sample data is not your data.');

  const page = await site.open(t);
  await h.fillPayFrom(page);
  const ask = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const dialog = await ask;
  assert.equal(dialog.type(), 'beforeunload');
  await dialog.dismiss();
});

test('"Open all" in the FAQ opens all the answers, and "Close all" closes them', async t => {
  const page = await site.open(t);
  const questions = await page.locator('#faq-list > details').count();
  const openAnswers = () => page.locator('#faq-list > details[open]').count();
  // The page changes the button text after the "toggle" events. Thus the test waits for the text.
  const buttonSays = label => page.waitForFunction(value => document.getElementById('faq-toggle').textContent.trim() === value, label);
  assert.equal(await h.text(page, '#faq-count'), `${questions} questions`, 'The number above the FAQ is not correct.');
  assert.equal(await openAnswers(), 0);

  await page.click('#faq-toggle');
  assert.equal(await openAnswers(), questions);
  await buttonSays('Close all');

  // You close one answer. Then the button opens all the answers again.
  await page.click('#faq-list > details:first-child > summary');
  await buttonSays('Open all');
  await page.click('#faq-toggle');
  assert.equal(await openAnswers(), questions);

  await page.click('#faq-toggle');
  assert.equal(await openAnswers(), 0);
  await buttonSays('Open all');
});

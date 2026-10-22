/*
 * 1batch.cy · tests/xml.test.js
 * ---------------------------------------------------------------------------
 * The XML file and the CSV file that the page makes. The bank gets the XML
 * file, so each byte must stay the same.
 *
 * tests/golden/ has the files:
 *   payments.csv          the input: a CSV file with spaces, lowercase
 *                         letters, an empty line, mixed line endings, and
 *                         the minimum and maximum amounts and lengths
 *   payments.xml          the correct "Download XML" output for this input
 *   payments-export.csv   the correct "Export CSV" output for this input
 *
 * If you change the XML or CSV layout on purpose, make the files again:
 *   UPDATE_GOLDEN=1 node --test tests/xml.test.js
 * Then read the changes with "git diff tests/golden" before you commit them.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();
const GOLDEN = path.join(__dirname, 'golden');
const INPUT = fs.readFileSync(path.join(GOLDEN, 'payments.csv'));
const REF = 'OCT-2026';

/** Compares the text with a file in tests/golden/. With UPDATE_GOLDEN=1, writes the file. */
function assertGolden(name, actual) {
  const file = path.join(GOLDEN, name);
  if (process.env.UPDATE_GOLDEN) {
    fs.writeFileSync(file, actual);
    return;
  }
  assert.equal(actual, fs.readFileSync(file, 'utf8'),
    `The output is not the same as tests/golden/${name}. If the change is correct, run: UPDATE_GOLDEN=1 node --test tests/xml.test.js`);
}

/** Opens the input CSV file and fills in "Pay from". */
async function openInput(page) {
  await h.openFile(page, 'payments.csv', INPUT);
  await page.locator('#opened').waitFor();
  await h.fillPayFrom(page, { ref: REF });
}

test('the XML file is the same as tests/golden/payments.xml', async t => {
  const page = await site.open(t);
  await openInput(page);
  assert.equal(await h.text(page, '#bar-count'), '8 payments');
  assert.match(await h.text(page, '#bar-status'), /^All 8 payments pass the checks/);

  const file = await h.download(page, () => page.click('#bar-btn'));
  assert.equal(file.name, `payments-${h.NEXT_BUSINESS_DAY}-${REF}.xml`);
  assertGolden('payments.xml', file.text);
});

test('an XML file from the page opens, and downloads again with the same bytes', async t => {
  const page = await site.open(t);
  const xml = fs.readFileSync(path.join(GOLDEN, 'payments.xml'));
  await h.openFile(page, 'payments.xml', xml);
  await page.locator('#opened').waitFor();

  assert.equal(await page.inputValue('#debtor-name'), h.COMPANY.name);
  assert.equal(await page.inputValue('#debtor-iban'), h.COMPANY.iban);
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY);
  assert.equal(await page.inputValue('#debtor-ref'), REF);
  assert.equal((await h.rows(page)).length, 8);

  const file = await h.download(page, () => page.click('#bar-btn'));
  assert.equal(file.text, xml.toString('utf8'));
});

test('an XML file with two dates opens, and downloads again with the same bytes', async t => {
  const page = await site.open(t);
  const xml = fs.readFileSync(path.join(GOLDEN, 'payments.xml'), 'utf8');
  // Payments 2 and 5 on Monday 26 October. The other 6 payments stay on Monday 19 October.
  const twoDates = xml.split('<PmtInf>').map((block, i) => ([2, 5].includes(i)
    ? block.replace(`<Dt>${h.NEXT_BUSINESS_DAY}</Dt>`, '<Dt>2026-10-26</Dt>')
    : block)).join('<PmtInf>');
  assert.equal(twoDates.match(/<Dt>2026-10-26<\/Dt>/g).length, 2);
  await h.openFile(page, 'two-dates.xml', twoDates);
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'), 'You opened two-dates.xml. 8 payments.');
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY, 'The date of most payments goes into "Pay from".');

  const file = await h.download(page, () => page.click('#bar-btn'));
  assert.equal(file.text, twoDates);
});

test('Export CSV is the same as tests/golden/payments-export.csv', async t => {
  const page = await site.open(t);
  await openInput(page);
  const file = await h.download(page, () => page.click('[data-action="export-csv"]'));
  assert.equal(file.name, `payments-${h.NEXT_BUSINESS_DAY}.csv`);
  assertGolden('payments-export.csv', file.text);
  assert.match(await h.text(page, '#toast-text'), /^CSV file saved with 8 payments\./);
});

test('an exported CSV file opens, and exports again with the same bytes', async t => {
  const page = await site.open(t);
  const csv = fs.readFileSync(path.join(GOLDEN, 'payments-export.csv'));
  await h.openFile(page, 'payments-export.csv', csv);
  await page.locator('#opened').waitFor();
  const file = await h.download(page, () => page.click('[data-action="export-csv"]'));
  assert.equal(file.text, csv.toString('utf8'));
});

test('with 1000 payments, the row numbers have 4 digits and the file reference must be shorter', async t => {
  const page = await site.open(t);
  const lines = ['type,name,iban,bic,amount,description'];
  for (let i = 1; i <= 1000; i++) lines.push(`,PAYEE ${i},${h.IBAN.de},,${i}.00,ITEM ${i}`);
  await h.openFile(page, 'many.csv', lines.join('\n'));
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#bar-count'), '1000 payments');

  // The longest ID: "PMT-" + "20261016-113000" + "-" + reference + "-" + "1000". The maximum is 35 characters.
  await h.fillPayFrom(page, { ref: 'ABCDEFGHIJK' });
  assert.equal(await h.payFromMessage(page, 'ref'),
    'With 1000 payments, the IDs have 36 characters. The maximum is 35. Remove 1 character(s).');

  await h.fillPayFrom(page, { ref: 'ABCDEFGHIJ' });
  assert.equal(await h.payFromMessage(page, 'ref'), '');
  const { text } = await h.download(page, () => page.click('#bar-btn'));
  assert.match(text, /<NbOfTxs>1000<\/NbOfTxs>/);
  assert.match(text, /<CtrlSum>500500\.00<\/CtrlSum>/);
  assert.match(text, /<PmtInfId>PMT-20261016-113000-ABCDEFGHIJ-0001<\/PmtInfId>/);
  assert.match(text, /<EndToEndId>E2E-20261016-113000-ABCDEFGHIJ-1000<\/EndToEndId>/);
  assert.equal(text.match(/<PmtInf>/g).length, 1000);
});

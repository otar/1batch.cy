/*
 * 1batch.cy · tests/files.test.js
 * ---------------------------------------------------------------------------
 * Open an old XML or CSV file, "New month?", and smart paste from a
 * spreadsheet. tests/xml.test.js has the tests of the file contents.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();
const XML = fs.readFileSync(path.join(__dirname, 'golden', 'payments.xml'), 'utf8');
const HEADER = 'type,name,iban,bic,amount,description';
const CANNOT_OPEN = 'The page cannot open this file';

test('an old XML file with a past date opens with the next business day', async t => {
  const page = await site.open(t);
  await h.openFile(page, 'old.xml', XML.replaceAll('<Dt>2026-10-19</Dt>', '<Dt>2026-10-01</Dt>'));
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'),
    'You opened old.xml. 8 payments. The date moved from Thu, 1 Oct 2026 to Mon, 19 Oct 2026, the next business day.');
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY);
  assert.equal(await page.inputValue('#debtor-name'), h.COMPANY.name);
  assert.equal(await page.isHidden('#sample-note'), true);
});

test('an XML file with a future date opens with the same date, also on a weekend', async t => {
  const page = await site.open(t);
  await h.openFile(page, 'saturday.xml', XML.replaceAll('<Dt>2026-10-19</Dt>', '<Dt>2026-10-24</Dt>'));
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'), 'You opened saturday.xml. 8 payments.');
  assert.equal(await page.inputValue('#debtor-date'), '2026-10-24');
  assert.equal(await h.text(page, '#debtor-date-words'), 'Saturday 24 October 2026. Not a business day.');
});

/** The golden XML file, with the date of some payments changed: { 3: '2026-10-01' } changes payment 3. */
function withDates(dates) {
  return XML.split('<PmtInf>').map((block, i) => (dates[i]
    ? block.replace(`<Dt>${h.NEXT_BUSINESS_DAY}</Dt>`, `<Dt>${dates[i]}</Dt>`)
    : block)).join('<PmtInf>');
}

test('an old XML file: a past date of one payment changes to the date of "Pay from"', async t => {
  const page = await site.open(t);
  await h.openFile(page, 'one-past.xml', withDates({ 3: '2026-10-01', 4: '2026-02-30' }));
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'), 'You opened one-past.xml. 8 payments. '
    + '1 payment had a past date. It now uses the date of “Pay from”. '
    + '1 payment had a date that is not valid. It now uses the date of “Pay from”.');
  assert.equal(await page.inputValue('#debtor-date'), h.NEXT_BUSINESS_DAY);
  const { text } = await h.download(page, () => page.click('#bar-btn'));
  assert.equal(text, XML, 'All payments must have the date of "Pay from" again.');
});

test('an old XML file with two past dates: all payments get the next business day', async t => {
  const page = await site.open(t);
  const dates = {};
  for (let i = 1; i <= 8; i++) dates[i] = i <= 6 ? '2026-10-01' : '2026-10-05';
  await h.openFile(page, 'september.xml', withDates(dates));
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'), 'You opened september.xml. 8 payments. '
    + 'The date moved from Thu, 1 Oct 2026 to Mon, 19 Oct 2026, the next business day. '
    + '2 payments had a past date. They now use the date of “Pay from”.');
  const { text } = await h.download(page, () => page.click('#bar-btn'));
  assert.equal(text, XML);
});

test('"New month?" replaces the month in the descriptions, with Undo', async t => {
  const page = await site.open(t);
  const csv = [HEADER,
    `,ANDREAS GEORGIOU,${h.IBAN.boc},,2450.00,SALARY SEPTEMBER 2026`,
    `,ELENI CHRISTOU,${h.IBAN.boc},,2180.00,Salary September 2026`,
    `,MICHALIS IOANNOU,${h.IBAN.boc},,1960.50,SALARY SEPTEMBER 2026`,
    `,LIMASSOL OFFICE RENT LTD,${h.IBAN.hellenic},,1500.00,OFFICE RENT`].join('\n');
  await h.openFile(page, 'september.csv', csv);
  await page.locator('#month').waitFor();
  assert.equal(await page.inputValue('#month-from'), 'SEPTEMBER');
  assert.equal(await page.inputValue('#month-to'), 'OCTOBER');
  assert.equal(await h.text(page, '#month-btn'), 'Replace in payments 1, 2 and 3');

  await page.click('#month-btn');
  assert.deepEqual(await h.rowField(page, 'desc'),
    ['SALARY OCTOBER 2026', 'Salary OCTOBER 2026', 'SALARY OCTOBER 2026', 'OFFICE RENT']);
  assert.equal(await h.text(page, '#toast-text'), '“SEPTEMBER” changed to “OCTOBER” in 3 descriptions.');
  assert.equal(await page.isHidden('#month'), true);

  await page.click('#toast-undo');
  assert.deepEqual(await h.rowField(page, 'desc'),
    ['SALARY SEPTEMBER 2026', 'Salary September 2026', 'SALARY SEPTEMBER 2026', 'OFFICE RENT']);
});

test('a file replaces your data, and Undo brings your data back', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page, { name: 'MY COMPANY LTD' });
  await h.openFile(page, 'payments.xml', XML);
  await page.locator('#opened').waitFor();
  assert.equal(await page.inputValue('#debtor-name'), h.COMPANY.name);
  assert.equal(await h.text(page, '#toast-text'), 'The file replaced the data on the page.');

  await page.click('#toast-undo');
  assert.equal(await page.inputValue('#debtor-name'), 'MY COMPANY LTD');
  assert.equal((await h.rows(page))[0].name, 'ANDREAS GEORGIOU');
  assert.equal(await page.isVisible('#sample-note'), true);
});

test('a CSV file replaces only the payments, and "Pay from" stays', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await h.openFile(page, 'one.csv', `${HEADER}\n,ANDREAS GEORGIOU,${h.IBAN.boc},,2450.00,SALARY`);
  await page.locator('#opened').waitFor();
  assert.equal(await h.text(page, '#opened-text'),
    'You opened one.csv. 1 payment. A CSV file has no “Pay from” data. The “Pay from” fields did not change.');
  assert.equal(await page.inputValue('#debtor-name'), h.COMPANY.name);
  assert.equal((await h.rows(page)).length, 1);
});

test('a CSV file with bad lines opens the good lines, and lists the bad lines', async t => {
  const page = await site.open(t);
  const csv = [HEADER,
    `,ANDREAS GEORGIOU,${h.IBAN.boc},,2450.00,SALARY`,
    `,ELENI CHRISTOU,${h.IBAN.boc},2180.00,SALARY`,
    `fast,MICHALIS IOANNOU,${h.IBAN.boc},,1960.50,SALARY`].join('\n');
  await h.openFile(page, 'bad-lines.csv', csv);
  const body = await h.dialogBody(page, '2 payments loaded');
  assert.equal(body, 'Look at these lines:\n\n'
    + 'Line 3: the line must have 6 columns, but it has 5. The page did not load this line.\n'
    + 'Line 4: the type “fast” is not known. The page set it to Auto. Use sepa or tboc.');
  await h.dialogButton(page, 'OK');
  assert.deepEqual(await h.rowField(page, 'name'), ['ANDREAS GEORGIOU', 'MICHALIS IOANNOU']);
});

test('a CSV file with a date column: own dates, a past date, a date in a different form', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  const csv = [`${HEADER},date`,
    `,ANDREAS GEORGIOU,${h.IBAN.boc},,2450.00,SALARY,2026-10-26`,
    `,ELENI CHRISTOU,${h.IBAN.boc},,2180.00,SALARY,`,
    `,MICHALIS IOANNOU,${h.IBAN.boc},,1960.50,SALARY,2026-10-01`,
    `,LIMASSOL OFFICE RENT LTD,${h.IBAN.hellenic},,1500.00,RENT,26/10/2026`,
    `,SIX COLUMNS LTD,${h.IBAN.boc},,10.00,TEXT`].join('\n');
  await h.openFile(page, 'dates.csv', csv);
  assert.equal(await h.dialogBody(page, '4 payments loaded'), 'Look at these lines:\n\n'
    + 'Line 5: the date “26/10/2026” is not a valid date in the format YYYY-MM-DD. The payment uses the date of “Pay from”.\n'
    + 'Line 6: the line must have 7 columns, but it has 6. The page did not load this line.');
  await h.dialogButton(page, 'OK');
  assert.equal(await h.text(page, '#opened-text'), 'You opened dates.csv. 4 payments. '
    + 'A CSV file has no “Pay from” data. The “Pay from” fields did not change. '
    + '1 payment had a past date. It now uses the date of “Pay from”.');
  assert.deepEqual(await page.$$eval('#payments [data-field="date"]', inputs => inputs.map(input => input.value)),
    ['2026-10-26', '', '', '']);
});

test('smart paste: the page finds a column of dates, and does not change a date in a different form', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await h.paste(page, 'body', [
    `ANDREAS GEORGIOU\t${h.IBAN.boc}\t2450.00\tSALARY\t2026-10-26`,
    `ELENI CHRISTOU\t${h.IBAN.boc}\t2180.00\tSALARY\t${h.NEXT_BUSINESS_DAY}`].join('\n'));
  await h.dialogBody(page, 'Paste payments');
  assert.deepEqual(await page.$$eval('#dialog select', selects => selects.map(select => select.value)),
    ['name', 'iban', 'amount', 'desc', 'date']);
  await h.dialogButton(page, 'Add 2 payments');
  const dates = () => page.$$eval('#payments [data-field="date"]', inputs => inputs.map(input => input.value));
  assert.deepEqual(await dates(), ['2026-10-26', ''], 'The date of "Pay from" is not an own date.');

  await h.paste(page, 'body', [
    `MICHALIS IOANNOU\t${h.IBAN.boc}\t1960.50\tSALARY\t26/10/2026`,
    `DE VRIES B.V.\t${h.IBAN.nl}\t875.25\tINVOICE\t27.10.2026`].join('\n'));
  const body = await h.dialogBody(page, 'Paste payments');
  assert.match(body, /2 dates are not in the format YYYY-MM-DD, for example “26\/10\/2026”\. These payments use the date of “Pay from”\. To keep the dates, format the column as yyyy-mm-dd in the spreadsheet\. Then paste again\./);
  await h.dialogButton(page, 'Add 2 payments');
  assert.match(await h.text(page, '#toast-text'), /^2 payments added\. 2 dates are not in the format YYYY-MM-DD, for example “26\/10\/2026”\./);
  assert.deepEqual(await dates(), ['2026-10-26', '', '', '']);
  assert.deepEqual(await h.rowField(page, 'amount'), ['2450.00', '2180.00', '1960.50', '875.25']);
});

test('a file that the page cannot open shows a clear message, and the data stays', async t => {
  const page = await site.open(t);
  const blocks = XML.split('<PmtInf>');
  const twoAccounts = [blocks[0], blocks[1], blocks[2].replace(h.COMPANY.iban, h.IBAN.boc), ...blocks.slice(3)].join('<PmtInf>');
  const noPayments = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
    <CstmrCdtTrfInitn><GrpHdr><MsgId>MSG-20261016-113000-X</MsgId></GrpHdr></CstmrCdtTrfInitn></Document>`;

  // [file name, file content, dialog title, dialog text]
  const cases = [
    ['notes.txt', 'Hello', CANNOT_OPEN,
      'The first line must be “type,name,iban,bic,amount,description”. This is the format of the command-line tool. '
      + 'A file from this page can also have a 7th column “date”.'],
    ['empty.csv', '', CANNOT_OPEN, 'The file is empty.'],
    ['header.csv', `${HEADER}\n`, 'No payments found', 'header.csv has no payment rows.'],
    ['other.xml', '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"/>', CANNOT_OPEN,
      'This is not a pain.001.001.09 payment file. You can open only files from this site or from the boc_payments_xml command-line tool.'],
    ['usd.xml', XML.replace('Ccy="EUR"', 'Ccy="USD"'), CANNOT_OPEN, 'The file has payments in a currency that is not EUR.'],
    ['two-accounts.xml', twoAccounts, CANNOT_OPEN,
      'The payments in this file use more than one debit account. This site makes files with one debit account.'],
    ['no-payments.xml', noPayments, CANNOT_OPEN, 'The file has no payments.'],
    ['large.csv', Buffer.alloc(5 * 1024 * 1024 + 1, ' '), 'The file is too large',
      'A payment file is much smaller than 5 MB. Make sure that you selected the correct file.'],
  ];
  for (const [name, content, title, message] of cases) {
    await t.test(name, async () => {
      await h.openFile(page, name, content);
      assert.equal(await h.dialogBody(page, title), message);
      await h.dialogButton(page, 'OK');
      assert.equal((await h.rows(page)).length, 8);
      assert.equal(await page.isHidden('#opened'), true);
    });
  }
});

// When DOMParser reads damaged XML, Chromium makes an error document with an inline style.
// The CSP of the page blocks this style and writes errors in the console. The page is not affected.
test('a damaged XML file shows a clear message', async t => {
  const page = await site.open(t, { consoleErrors: true });
  await h.openFile(page, 'broken.xml', '<Document');
  assert.equal(await h.dialogBody(page, CANNOT_OPEN), 'The file is not valid XML. It can be damaged or incomplete.');
  await h.dialogButton(page, 'OK');
  assert.equal((await h.rows(page)).length, 8);
});

test('smart paste: the page finds the columns in any order, and shows a preview first', async t => {
  const page = await site.open(t);
  const rows = [
    ['2450.00', h.IBAN.boc, 'ANDREAS GEORGIOU', 'SALARY OCTOBER 2026'],
    ['1,960.50', 'de89 3704 0044 0532 0130 00', 'MUELLER SOFTWARE GMBH', 'INVOICE 17'],
    ['875.25', h.IBAN.nl, 'DE VRIES CONSULTING B.V.', 'INVOICE NL-4471'],
  ];
  await h.paste(page, 'body', `${rows.map(cells => cells.join('\t')).join('\r\n')}\r\n`);
  const body = await h.dialogBody(page, 'Paste payments');
  assert.match(body, /^The page found 3 rows\. Make sure that the field above each column is correct\./);
  assert.deepEqual(await page.locator('#dialog select').evaluateAll(selects => selects.map(s => s.value)),
    ['amount', 'iban', 'name', 'desc']);
  assert.equal(await h.text(page, '.preview-fix'),
    'Correct 1 amount: “1,960.50” becomes “1960.50”. The bank needs a dot for decimals and no thousands separator.');
  assert.equal(await page.isChecked('.preview-fix input'), false, 'The page never corrects without a click.');

  await page.check('.preview-fix input');
  await h.dialogButton(page, 'Add 3 payments');
  assert.deepEqual(await h.rows(page), [
    { type: 'auto', name: 'ANDREAS GEORGIOU', iban: h.IBAN.boc, bic: '', amount: '2450.00', desc: 'SALARY OCTOBER 2026' },
    { type: 'auto', name: 'MUELLER SOFTWARE GMBH', iban: h.IBAN.de, bic: '', amount: '1960.50', desc: 'INVOICE 17' },
    { type: 'auto', name: 'DE VRIES CONSULTING B.V.', iban: h.IBAN.nl, bic: '', amount: '875.25', desc: 'INVOICE NL-4471' },
  ], 'The paste replaces the sample data.');
  assert.equal(await h.text(page, '#toast-text'), '3 payments added.');

  await page.click('#toast-undo');
  assert.equal((await h.rows(page)).length, 8);
});

test('smart paste: a header row sets the columns, and you can skip a column', async t => {
  const page = await site.open(t);
  await h.clearSample(page);
  const text = [
    'Payee\tIBAN\tSWIFT\tAmount\tDetails\tType',
    `ANDREAS GEORGIOU\t${h.IBAN.boc}\t\t2450.00\tSALARY\tsepa`,
    `MUELLER SOFTWARE GMBH\t${h.IBAN.de}\tcobadeffxxx\t3200.00\tINVOICE 17\tsepa`,
  ].join('\n');
  await h.paste(page, '#paste-box', text);
  assert.match(await h.dialogBody(page, 'Paste payments'), /^The page found 2 rows\./);
  const selects = page.locator('#dialog select');
  assert.deepEqual(await selects.evaluateAll(list => list.map(s => s.value)), ['name', 'iban', 'bic', 'amount', 'desc', 'type']);

  await selects.nth(4).selectOption('');
  await h.dialogButton(page, 'Add 2 payments');
  assert.deepEqual(await h.rows(page), [
    { type: 'sepa', name: 'ANDREAS GEORGIOU', iban: h.IBAN.boc, bic: '', amount: '2450.00', desc: '' },
    { type: 'auto', name: 'MUELLER SOFTWARE GMBH', iban: h.IBAN.de, bic: 'COBADEFFXXX', amount: '3200.00', desc: '' },
  ]);
});

test('smart paste: Cancel adds nothing, and one value in the paste box shows a tip', async t => {
  const page = await site.open(t);
  await h.paste(page, 'body', `A\t${h.IBAN.boc}\t10.00\tB`);
  await h.dialogBody(page, 'Paste payments');
  await h.dialogButton(page, 'Cancel');
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await page.isHidden('#toast'), true);

  await h.clearSample(page);
  await h.paste(page, '#paste-box', 'ANDREAS GEORGIOU');
  assert.equal(await h.text(page, '#toast-text'), 'Copy full rows in the spreadsheet, one row for each payment. Then paste again.');
  assert.equal(await page.isVisible('#start'), true);
});

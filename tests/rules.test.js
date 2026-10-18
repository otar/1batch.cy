/*
 * 1batch.cy · tests/rules.test.js
 * ---------------------------------------------------------------------------
 * The bank rules: the checks, the messages and the corrections.
 *
 * The functions of app.js are global, so the test calls them in the page.
 * Thus many cases run in less than one second, and app.js does not change.
 * The other test files make sure that the page shows these messages.
 *
 * Each case changes one or two values of a correct payment. Then the test
 * compares all the messages of the payment with the expected messages:
 *   'iban: the check digits are not correct. Look for a typing error.'
 *   'amount: use a dot … [Change to 1250.00]'    (a correction button)
 */

'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const h = require('./helpers');

const site = h.useSite();

const PAYMENT = { type: 'auto', name: 'TEST PAYEE LTD', iban: h.IBAN.boc, bic: '', amount: '100.00', desc: 'INVOICE 1' };
const DEBTOR = { name: h.COMPANY.name, iban: h.COMPANY.iban, bic: '', execDate: h.NEXT_BUSINESS_DAY, batchRef: '' };
const DATE_FIX = '[Change to Mon, 19 Oct 2026]';
const SHAPE = 'must start with a 2-letter country code and 2 check digits. Then letters and digits.';
const AMOUNT_DOT = 'amount: use a dot for decimals and no thousands separator, for example 1250.50.';
const AMOUNT_DIGITS = 'amount: use digits with a maximum of 2 decimals, for example 1250.50.';

// [what the case tests, the changed values, the expected errors, the expected warnings]
const PAYMENT_CASES = [
  ['a correct TBOC payment', {}, [], []],
  ['a correct SEPA payment with a BIC', { iban: h.IBAN.de, bic: 'COBADEFFXXX' }, [], []],
  ['an IBAN in lowercase, with spaces', { iban: 'cy21 0020 0195 0000 3570 0123 4567' }, [], []],
  ['a BIC in lowercase', { iban: h.IBAN.de, bic: 'cobadeffxxx' }, [], []],
  ['a name with all the punctuation that the bank accepts', { name: "A/B-C?D:E(F).G,H'I+J" }, [], []],
  ['a name with 35 characters', { name: 'N'.repeat(35) }, [], []],
  ['a description with 140 characters', { desc: 'D'.repeat(140) }, [], []],
  ['the minimum amount', { amount: '0.01' }, [], []],
  ['the maximum amount', { amount: '999999999.99' }, [], []],
  ['an amount with 1 decimal', { amount: '12.5' }, [], []],
  ['an amount with no decimals', { amount: '12' }, [], []],

  ['no name', { name: '' }, ['name: missing.'], []],
  ['a name with "&"', { name: 'A & B' }, ['name: the bank does not accept “&”. [Change to A AND B]'], []],
  ['a name with an accent', { name: 'MÜLLER GMBH' }, ['name: the bank does not accept “Ü”. [Change to MULLER GMBH]'], []],
  ['a name in Greek letters', { name: 'ΑΝΔΡΕΑΣ' },
    ['name: the bank does not accept “Α”, “Ν”, “Δ”, “Ρ”, “Ε” and “Σ”. [Change to ANDREAS]'], []],
  ['a name with a tab', { name: 'A\tB' }, ['name: the bank does not accept tab. [Change to A B]'], []],
  ['a character with no correction', { name: 'ACME™' }, ['name: the bank does not accept “™”.'], []],
  ['a correction that is too long', { name: `${'N'.repeat(33)} &` }, ['name: the bank does not accept “&”.'], []],
  ['a name with 36 characters', { name: 'N'.repeat(36) }, ['name: has 36 characters. The maximum is 35.'], []],

  ['no IBAN', { iban: '' }, ['iban: missing.'], []],
  ['an IBAN with hyphens', { iban: 'CY21-0020-0195-0000-3570-0123-4567' },
    [`iban: ${SHAPE} [Change to ${h.IBAN.boc}]`], []],
  ['a text that is not an IBAN', { iban: '12345' }, [`iban: ${SHAPE}`], []],
  ['TBOC: wrong check digits', { iban: 'CY22002001950000357001234567' },
    ['iban: the check digits are not correct. Look for a typing error.'], []],
  ['TBOC set by hand, with a German IBAN', { type: 'tboc', iban: h.IBAN.de },
    ['iban: TBOC needs a 28-character Bank of Cyprus IBAN (CY…). [Change to SEPA]'], []],
  ['TBOC set by hand, with a different Cyprus bank', { type: 'tboc', iban: h.IBAN.hellenic },
    ['iban: bank code 005 is not Bank of Cyprus (002). For other banks, use SEPA. [Change to SEPA]'], []],
  ['SEPA set by hand, for a Bank of Cyprus account', { type: 'sepa' }, [],
    ['iban: this is a Bank of Cyprus account. Usually, the correct type is TBOC. [Change to TBOC]']],
  ['SEPA: a country that is not in SEPA', { iban: 'US12345678901234' },
    ['iban: country US is not in the SEPA zone. You cannot send a SEPA payment to this country.'], []],
  ['SEPA: wrong length', { iban: 'DE8937040044053201300' }, ['iban: a DE IBAN has 22 characters. This IBAN has 21.'], []],
  ['SEPA: wrong check digits', { iban: 'DE88370400440532013000' },
    ['iban: the check digits are not correct. Look for a typing error.'], []],
  ['SEPA: wrong Belgian national check digits', { iban: 'BE41539007547035' },
    ['iban: the Belgian national check digits are not correct.'], []],

  ['a BIC with 9 characters', { iban: h.IBAN.de, bic: 'COBADEFF1' },
    ['bic: must have 8 or 11 letters and digits, for example COBADEFFXXX.'], []],
  ['a BIC with spaces', { iban: h.IBAN.de, bic: 'COBA DE FF' },
    ['bic: must have 8 or 11 letters and digits, for example COBADEFFXXX. [Change to COBADEFF]'], []],
  ['a BIC from a different country', { iban: h.IBAN.de, bic: 'ABNANL2A' },
    ['bic: the BIC country NL is not the IBAN country DE. The bank does not accept this.'], []],
  ['a BIC for a TBOC payment', { bic: 'BCYPCY2N' }, [],
    ['bic: TBOC payments do not use a BIC. The file will not include it. [Remove the BIC]']],

  ['no amount', { amount: '' }, ['amount: missing.'], []],
  ['a comma for decimals', { amount: '1250,50' }, [`${AMOUNT_DOT} [Change to 1250.50]`], []],
  ['a comma between thousands', { amount: '1,250.00' }, [`${AMOUNT_DOT} [Change to 1250.00]`], []],
  ['a dot between thousands', { amount: '1.250,00' }, [`${AMOUNT_DOT} [Change to 1250.00]`], []],
  ['an apostrophe between thousands', { amount: "1'250.00" }, [`${AMOUNT_DOT} [Change to 1250.00]`], []],
  ['"1,250": 1250 or 1.25, so no correction', { amount: '1,250' }, [AMOUNT_DOT], []],
  ['3 decimals', { amount: '10.505' }, [AMOUNT_DOT], []],
  ['a euro sign', { amount: '€1250' }, [`${AMOUNT_DIGITS} [Change to 1250.00]`], []],
  ['words', { amount: 'ten' }, [AMOUNT_DIGITS], []],
  ['a negative amount', { amount: '-5' }, [AMOUNT_DIGITS], []],
  ['zero', { amount: '0.00' }, ['amount: must be 0.01 or more.'], []],
  ['more than the maximum', { amount: '1000000000.00' }, [AMOUNT_DIGITS], []],

  ['no description', { desc: '' }, ['desc: missing.'], []],
  ['a description with "#"', { desc: 'INVOICE #17' }, ['desc: the bank does not accept “#”. [Change to INVOICE 17]'], []],
  ['a description with "€"', { desc: 'RENT 500€' }, ['desc: the bank does not accept “€”. [Change to RENT 500 EUR]'], []],
  ['a description with curly quotes', { desc: '“QUOTE”' },
    ["desc: the bank does not accept ““” and “””. [Change to 'QUOTE']"], []],
  ['a description with 141 characters', { desc: 'D'.repeat(141) }, ['desc: has 141 characters. The maximum is 140.'], []],
];

// [what the case tests, the changed values, the number of payments, the expected errors]
const DEBTOR_CASES = [
  ['correct "Pay from" data', {}, 1, []],
  ['the execution date is today', { execDate: h.TODAY }, 1, []],
  ['a company name with 70 characters', { name: 'N'.repeat(70) }, 1, []],
  ['no company name', { name: '' }, 1, ['name: missing.']],
  ['a company name with "&"', { name: 'A & B' }, 1, ['name: the bank does not accept “&”. [Change to A AND B]']],
  ['a company name with 71 characters', { name: 'N'.repeat(71) }, 1, ['name: has 71 characters. The maximum is 70.']],
  ['no debit account', { iban: '' }, 1, ['iban: missing.']],
  ['a debit account with hyphens', { iban: 'CY17-0020-0128-0000-0012-0052-7600' }, 1,
    [`iban: ${SHAPE} [Change to ${h.COMPANY.iban}]`]],
  ['a debit account that is not in Cyprus', { iban: h.IBAN.de }, 1,
    ['iban: must be a 28-character Cyprus IBAN. This IBAN has 22 characters.']],
  ['a debit account with wrong check digits', { iban: 'CY18002001280000001200527600' }, 1,
    ['iban: the check digits are not correct. Look for a typing error.']],
  ['a debit account at a different bank', { iban: h.IBAN.hellenic }, 1,
    ['iban: bank code 005 is not Bank of Cyprus (002). The debit account must be at Bank of Cyprus.']],
  ['no execution date', { execDate: '' }, 1, [`execDate: missing. ${DATE_FIX}`]],
  ['a date that does not exist', { execDate: '2026-02-30' }, 1, [`execDate: is not a valid date. ${DATE_FIX}`]],
  ['a date in the past', { execDate: '2026-10-15' }, 1, [`execDate: is in the past. ${DATE_FIX}`]],
  ['a file reference with "_"', { batchRef: 'OCT_26' }, 1, ['batchRef: use only letters, digits and hyphens.']],
  ['a file reference with 12 characters', { batchRef: 'ABCDEFGHIJKL' }, 1, ['batchRef: has 12 characters. The maximum is 11.']],
  ['a file reference with 11 characters and 999 payments', { batchRef: 'ABCDEFGHIJK' }, 999, []],
  ['a file reference with 11 characters and 1000 payments', { batchRef: 'ABCDEFGHIJK' }, 1000,
    ['batchRef: with 1000 payments, the IDs have 36 characters. The maximum is 35. Remove 1 character(s).']],
  ['a random file reference and 1000 payments', {}, 1000, []],
];

// [function in app.js, its arguments, the expected result]
const HELPER_CASES = [
  ['cleanText', ['MÜLLER & CO'], 'MULLER AND CO'],
  ['cleanText', ['Müller & Co'], 'Muller and Co'],
  ['cleanText', ['ΓΙΩΡΓΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ'], 'GIORGOS PAPADOPOULOS'],
  ['cleanText', ['ΕΥΑΓΓΕΛΙΑ'], 'EVANGELIA'],
  ['cleanText', ['Straße'], 'Strasse'],
  ['cleanText', ['A – B'], 'A - B'],
  ['cleanText', ['ACME™'], null],
  ['suggestAmount', ['1,250.00'], '1250.00'],
  ['suggestAmount', ['1.250,00'], '1250.00'],
  ['suggestAmount', ['1250,5'], '1250.50'],
  ['suggestAmount', ['€ 1 250,00'], '1250.00'],
  ['suggestAmount', ['1.000.000'], '1000000.00'],
  ['suggestAmount', ['1,250'], null],
  ['suggestAmount', ['0,00'], null],
  ['nextBusinessDay', ['2026-10-16'], '2026-10-19'],
  ['nextBusinessDay', ['2026-10-17'], '2026-10-19'],
  ['nextBusinessDay', ['2026-10-19'], '2026-10-20'],
  ['nextBusinessDay', ['2026-12-31'], '2027-01-01'],
  ['detectType', [h.IBAN.boc], 'tboc'],
  ['detectType', ['cy21 0020 0195 0000 3570 0123 4567'], 'tboc'],
  ['detectType', [h.IBAN.hellenic], 'sepa'],
  ['detectType', [h.IBAN.de], 'sepa'],
  ['monthSuggestion', [[{ desc: 'SALARY SEPTEMBER 2026' }, { desc: 'SALARY SEPTEMBER 2026' }, { desc: 'RENT OCTOBER 2026' }]],
    { from: 'SEPTEMBER', to: 'OCTOBER' }],
  ['monthSuggestion', [[{ desc: 'SALARY DECEMBER 2026' }, { desc: 'BONUS DECEMBER 2026' }]],
    { from: 'DECEMBER 2026', to: 'JANUARY 2027' }],
  ['monthSuggestion', [[{ desc: 'Rent Sep' }]], { from: 'Sep', to: 'Oct' }],
  ['monthSuggestion', [[{ desc: 'INVOICE 17' }]], null],
  ['detectColumns', [[['2450.00', h.IBAN.boc, 'ANDREAS GEORGIOU', 'SALARY'], ['99.50', h.IBAN.de, 'MUELLER GMBH', 'INVOICE 7']]],
    ['amount', 'iban', 'name', 'desc']],
  ['parseDelimited', ['a,"b,c","d ""e"""\r\nf', ','], [['a', 'b,c', 'd "e"'], ['f']]],
];

/** Changes a report of app.js into two lists of texts: { errors, warnings }. */
function reportTexts(page, call, args) {
  return page.evaluate(({ call, args }) => {
    const report = window[call](...args);
    const texts = list => Object.entries(list).flatMap(([field, items]) => items.map(item => {
      const fix = item.fix ? ` [${item.fix.text}${item.fix.value ? ` ${item.fix.value}` : ''}]` : '';
      return `${field}: ${item.text}${fix}`;
    }));
    return { errors: texts(report.errors), warnings: texts(report.warnings) };
  }, { call, args });
}

test('payment checks', async t => {
  const page = await site.open(t);
  for (const [name, changes, errors, warnings] of PAYMENT_CASES) {
    await t.test(name, async () => {
      assert.deepEqual(await reportTexts(page, 'checkPayment', [{ ...PAYMENT, ...changes }]), { errors, warnings });
    });
  }
});

test('"Pay from" checks', async t => {
  const page = await site.open(t);
  for (const [name, changes, count, errors] of DEBTOR_CASES) {
    await t.test(name, async () => {
      assert.deepEqual(await reportTexts(page, 'checkDebtor', [{ ...DEBTOR, ...changes }, count]), { errors, warnings: [] });
    });
  }
});

test('corrections, dates, types, months and columns', async t => {
  const page = await site.open(t);
  for (const [call, args, expected] of HELPER_CASES) {
    await t.test(`${call}(${JSON.stringify(args).slice(1, -1)})`, async () => {
      assert.deepEqual(await page.evaluate(({ call, args }) => window[call](...args), { call, args }), expected);
    });
  }
});

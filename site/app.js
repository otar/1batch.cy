/*
 * 1batch.cy · app.js
 * ---------------------------------------------------------------------------
 * This script makes a Bank of Cyprus (1bank) "Multiple Payments" XML file:
 * ISO 20022 pain.001.001.09, SEPA and TBOC, one PmtInf block for each payment.
 *
 * The rules and the XML layout are the same as in the command-line tool
 * boc_payments_xml.php (https://github.com/otar/boc_payments_xml). That tool
 * follows the BOC "XML Implementation Guidelines for Multiple Payments" v13.
 *
 * Privacy
 *  - No network. This file does not use fetch, XMLHttpRequest, sendBeacon,
 *    WebSocket or other ways to send data to a server. Also, the page
 *    Content-Security-Policy (connect-src 'none') blocks them.
 *  - No storage. No cookies, localStorage, sessionStorage or IndexedDB.
 *    Your data is only in the `state` object below, in the memory of this tab.
 *  - The browser reads the files that you open with File.text(). The script
 *    makes the XML and CSV files in memory. The browser saves them as downloads.
 *  - The script writes your data into the page only with .value and
 *    .textContent. It never writes your data as HTML.
 *
 * Sections
 *   1. Bank rules            6. CSV and smart paste
 *   2. Small helpers         7. State and undo
 *   3. Checks, corrections   8. Drawing the page
 *   4. Writing the XML       9. Actions
 *   5. Reading an XML file  10. Events and start-up
 */

'use strict';

/* ==========================================================================
   1. Bank rules
   ========================================================================== */

const XML_NAMESPACE = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09';
const TIME_ZONE = 'Asia/Nicosia';           // BOC uses Cyprus time

// BOC guideline 1.3: the only characters that names and descriptions can have
const DISALLOWED_CHARS = /[^A-Za-z0-9\/\-?:().,'+ ]/gu;

const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const AMOUNT_RE = /^\d{1,9}(\.\d{1,2})?$/;  // EUR with a dot for decimals: 0.01 to 999999999.99
const IBAN_SHAPE_RE = /^[A-Z]{2}\d{2}[A-Z0-9]+$/;
const BOC_BANK_CODE = '002';
const DEFAULT_DEBTOR_BIC = 'BCYPCY2NXXX';

const NAME_MAX = 35;
const DEBTOR_NAME_MAX = 70;
const DESCRIPTION_MAX = 140;

/*
 * IDs. MsgId, PmtInfId and EndToEndId use the same batch stamp:
 *   MSG-20260808-110035-K7QP9F
 *   PMT-20260808-110035-K7QP9F-001
 *   E2E-20260808-110035-K7QP9F-001
 * With the stamp, you can find the file and the row of each payment.
 * The bank asks for this information when a payment is missing.
 */
const MAX_ID_LEN = 35;                      // BOC Max35Text
const BATCH_REF_LEN = 6;                    // random reference, 30 bits
const BATCH_REF_MAX = 11;
const BATCH_REF_RE = /^[A-Za-z0-9-]+$/;
const CROCKFORD32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';  // no I, L, O or U

// SEPA countries and the length of their IBANs (ISO 13616 registry)
const SEPA_IBAN_LEN = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20,
  ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26,
  IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28,
  PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, VA: 22,
};

const COUNTRY_NAMES = {
  AD: 'Andorra', AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', CH: 'Switzerland', CY: 'Cyprus',
  CZ: 'Czechia', DE: 'Germany', DK: 'Denmark', EE: 'Estonia', ES: 'Spain', FI: 'Finland',
  FR: 'France', GB: 'United Kingdom', GI: 'Gibraltar', GR: 'Greece', HR: 'Croatia', HU: 'Hungary',
  IE: 'Ireland', IS: 'Iceland', IT: 'Italy', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg',
  LV: 'Latvia', MC: 'Monaco', MT: 'Malta', NL: 'Netherlands', NO: 'Norway', PL: 'Poland',
  PT: 'Portugal', RO: 'Romania', SE: 'Sweden', SI: 'Slovenia', SK: 'Slovakia', SM: 'San Marino',
  VA: 'Vatican City',
};

/*
 * A short list of bank codes. The page shows the bank name below the IBAN.
 * from/to: the position of the bank code in the IBAN.
 * The list is in the page, so the page does not ask a server.
 * A bank that is not in the list is not an error.
 */
const BANKS = {
  CY: { from: 4, to: 7, names: { '002': 'Bank of Cyprus', '005': 'Hellenic Bank' } },
  GR: { from: 4, to: 7, names: { '011': 'National Bank of Greece', '014': 'Alpha Bank', '017': 'Piraeus Bank', '026': 'Eurobank' } },
  DE: { from: 4, to: 12, names: { '37040044': 'Commerzbank' } },
  NL: { from: 4, to: 8, names: { ABNA: 'ABN AMRO', INGB: 'ING', RABO: 'Rabobank', TRIO: 'Triodos Bank', BUNQ: 'bunq', KNAB: 'Knab', ASNB: 'ASN Bank', SNSB: 'SNS', RBRB: 'RegioBank' } },
  GB: { from: 4, to: 8, names: { BARC: 'Barclays', HBUK: 'HSBC UK', MIDL: 'HSBC', LOYD: 'Lloyds Bank', NWBK: 'NatWest', RBOS: 'Royal Bank of Scotland', MONZ: 'Monzo', SRLG: 'Starling Bank', REVO: 'Revolut' } },
  IE: { from: 4, to: 8, names: { AIBK: 'AIB', BOFI: 'Bank of Ireland', IPBS: 'PTSB', REVO: 'Revolut' } },
  FR: { from: 4, to: 9, names: { '30004': 'BNP Paribas', '30003': 'Société Générale', '30002': 'LCL', '20041': 'La Banque Postale' } },
  ES: { from: 4, to: 8, names: { '0049': 'Banco Santander', '0182': 'BBVA', '2100': 'CaixaBank', '0081': 'Banco Sabadell' } },
  IT: { from: 5, to: 10, names: { '03069': 'Intesa Sanpaolo', '02008': 'UniCredit' } },
  LT: { from: 4, to: 9, names: { '32500': 'Revolut' } },
};

// Payment fields, in the CSV column order of the command-line tool
const FIELDS = ['type', 'name', 'iban', 'bic', 'amount', 'desc'];
const CSV_HEADER = ['type', 'name', 'iban', 'bic', 'amount', 'description'];

const FIELD_LABELS = { type: 'Type', name: 'Name', iban: 'IBAN', bic: 'BIC', amount: 'Amount', desc: 'Description' };
const FIELD_NAMES = { type: 'Type', name: 'Beneficiary name', iban: 'IBAN', bic: 'BIC', amount: 'Amount in EUR', desc: 'Description' };

// For "Change all": the plural noun of each field
const GROUP_NOUNS = { name: 'names', iban: 'IBANs', bic: 'BICs', amount: 'amounts', desc: 'descriptions' };

// Short field names for the bottom bar: "payment 3, IBAN: check digits"
const SHORT_LABELS = {
  row: { type: 'type', name: 'name', iban: 'IBAN', bic: 'BIC', amount: 'amount', desc: 'description' },
  debtor: { name: 'company name', iban: 'debit account', execDate: 'date', batchRef: 'file reference' },
};

// Month names for "New month?" after you open a file
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// "Pay from" fields: state key → input id. The page keeps the BIC of an opened file, but has no field for it.
const DEBTOR_FIELDS = { name: 'debtor-name', iban: 'debtor-iban', execDate: 'debtor-date', batchRef: 'debtor-ref' };
const DEBTOR_LABELS = { name: 'Company name', iban: 'Debit account', execDate: 'Execution date', batchRef: 'File reference' };

// Example data. The IBANs have correct check digits, but they are not real accounts.
// The page opens with these payments in the table. "Pay from" stays empty.
const EXAMPLE = {
  payments: [
    { name: 'ANDREAS GEORGIOU', iban: 'CY21002001950000357001234567', amount: '2450.00', desc: 'SALARY SEPTEMBER 2026' },
    { name: 'ELENI CHRISTOU', iban: 'CY16002003020000357009876543', amount: '2180.00', desc: 'SALARY SEPTEMBER 2026' },
    { name: 'MICHALIS IOANNOU', iban: 'CY25002005700000357004561237', amount: '1960.50', desc: 'SALARY SEPTEMBER 2026' },
    { name: 'LIMASSOL OFFICE RENT LTD', iban: 'CY15005001040000001017733441', bic: 'HEBACY2N', amount: '1500.00', desc: 'OFFICE RENT OCTOBER 2026' },
    { name: 'MUELLER SOFTWARE GMBH', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', amount: '3200.00', desc: 'INVOICE 2026-0917' },
    { name: 'DE VRIES CONSULTING B.V.', iban: 'NL91ABNA0417164300', bic: 'ABNANL2A', amount: '875.25', desc: 'INVOICE NL-4471' },
    { name: 'ATHENS DESIGN STUDIO', iban: 'GR1601101250000000012300695', bic: 'ETHNGRAA', amount: '640.00', desc: 'WEBSITE DESIGN - PHASE 2' },
    { name: 'BRUXELLES TRADING', iban: 'BE68539007547034', amount: '199.99', desc: 'ORDER 88213' },
  ],
};

/* ==========================================================================
   2. Small helpers
   ========================================================================== */

/** Uppercase, no spaces. People often type IBANs in groups of four. */
function normalizeIban(value) {
  return String(value).trim().replace(/ /g, '').toUpperCase();
}

function normalizeBic(value) {
  return String(value).trim().toUpperCase();
}

/** The characters that the bank does not accept, each one time. */
function disallowedChars(text) {
  return [...new Set(text.match(DISALLOWED_CHARS) || [])];
}

function describeChars(chars) {
  const invisible = { '\t': 'tab', '\n': 'line break', '\u00a0': 'non-breaking space' };
  const shown = chars.slice(0, 6).map(c => invisible[c] || `“${c}”`);
  if (chars.length > 6) return `${shown.join(', ')} and more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
}

/**
 * ISO 7064 mod-97 on the rearranged IBAN, in blocks of 7 digits
 * (the same calculation as in the CLI). A valid IBAN gives 1.
 */
function ibanMod97(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let digits = '';
  for (const c of rearranged) {
    if (c >= '0' && c <= '9') digits += c;
    else if (c >= 'A' && c <= 'Z') digits += String(c.charCodeAt(0) - 55);  // A=10 … Z=35
    else return -1;
  }
  let rest = 0;
  for (let i = 0; i < digits.length; i += 7) {
    rest = Number(String(rest) + digits.slice(i, i + 7)) % 97;
  }
  return rest;
}

/** Belgian national check: the last 2 BBAN digits = the first 10 BBAN digits mod 97 (0 gives 97). */
function belgianNationalCheckOk(iban) {
  const bban = iban.slice(4);
  if (!/^\d{12}$/.test(bban)) return false;
  const expected = Number(bban.slice(0, 10)) % 97 || 97;
  return bban.slice(10) === String(expected).padStart(2, '0');
}

function isBocIban(iban) {
  return iban.startsWith('CY') && iban.slice(4, 7) === BOC_BANK_CODE;
}

/** The type for "Auto": TBOC for a Bank of Cyprus account, SEPA for all other accounts. */
function detectType(iban) {
  return isBocIban(normalizeIban(iban)) ? 'tboc' : 'sepa';
}

function resolvedType(payment) {
  return payment.type === 'auto' ? detectType(payment.iban) : payment.type;
}

/**
 * What the page knows about an IBAN, from the lists in this file only:
 * { country, bank, valid }. valid: correct length and check digits.
 */
function ibanInfo(value) {
  const iban = normalizeIban(value);
  const code = iban.slice(0, 2);
  const country = COUNTRY_NAMES[code] || '';
  const banks = BANKS[code];
  const bank = banks && iban.length >= banks.to ? banks.names[iban.slice(banks.from, banks.to)] || '' : '';
  const valid = IBAN_SHAPE_RE.test(iban) && SEPA_IBAN_LEN[code] === iban.length && ibanMod97(iban) === 1;
  return { country, bank, valid };
}

/** "1250.5" gives 125050 cents. Use this only after AMOUNT_RE matches. */
function amountToCents(amount) {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function formatCents(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

const EURO = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

function money(cents) {
  return EURO.format(cents / 100);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Random Crockford base32 text. 256 is a multiple of 32. Thus, when you mask
 * a byte with 31, each character has the same chance.
 */
function randomRef(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => CROCKFORD32[b & 31]).join('');
}

/** The date and time now in Cyprus: { date: 'YYYY-MM-DD', time: 'HH:MM:SS' }. */
function cyprusNow() {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).forEach(part => { parts[part.type] = part.value; });
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

function isValidDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

/** The next Monday to Friday after the date. The CLI skips only weekends. This function does the same. */
function nextBusinessDay(iso) {
  const date = new Date(`${iso}T12:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** "Monday 12 October 2026" */
function formatDateLong(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

function isWeekend(iso) {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The word in the letter case of the sample: "SEPTEMBER" and "october" give "OCTOBER". */
function matchCase(sample, word) {
  if (sample === sample.toUpperCase()) return word.toUpperCase();
  if (sample === sample.toLowerCase()) return word.toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Makes an element with a class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================================
   3. Checks and one-click corrections
   Each check gives a report (see newReport). The page shows a correction
   as a button. It never changes your data without a click.
   ========================================================================== */

/* ---------- Corrections for characters and amounts ---------- */

// Latin letters that do not split into a letter and an accent
const LATIN_EXTRA = {
  ß: 'ss', ẞ: 'SS', æ: 'ae', Æ: 'AE', ø: 'o', Ø: 'O', œ: 'oe', Œ: 'OE', ł: 'l', Ł: 'L',
  đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'TH', ı: 'i',
};

// Greek to Latin letters (ELOT 743), after the page removes the accents
const GREEK = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const GREEK_PAIRS = { ου: 'ou', γγ: 'ng', γκ: 'gk', γξ: 'nx', γχ: 'nch', μπ: 'mp', ντ: 'nt' };

// Other characters with a clear replacement
const CHAR_SWAPS = {
  '’': "'", '‘': "'", '‛': "'", '′': "'", '`': "'", '´': "'", '"': "'", '“': "'", '”': "'", '„': "'", '″': "'",
  '–': '-', '—': '-', '‒': '-', '―': '-', '−': '-', '_': '-', ';': ',', '!': '.', '#': '',
  '[': '(', ']': ')', '{': '(', '}': ')', '€': ' EUR ',
  '\t': ' ', '\n': ' ', '\r': ' ', '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ',
};

/**
 * The text with only the characters that the bank accepts, or null if the
 * page does not know a replacement for a character.
 * "MÜLLER & CO" gives "MULLER AND CO". "ΑΝΔΡΕΑΣ" gives "ANDREAS".
 */
function cleanText(text) {
  const allUpper = text === text.toUpperCase();
  const letters = [...text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  const inCase = (source, latin) => {
    if (source === source.toLowerCase()) return latin;
    return allUpper ? latin.toUpperCase() : latin.charAt(0).toUpperCase() + latin.slice(1);
  };
  let out = '';
  for (let i = 0; i < letters.length; i++) {
    const c = letters[i];
    const lower = c.toLowerCase();
    const next = (letters[i + 1] || '').toLowerCase();
    if (GREEK_PAIRS[lower + next]) {
      out += inCase(c, GREEK_PAIRS[lower + next]);
      i++;
    } else if ((lower === 'α' || lower === 'ε' || lower === 'η') && next === 'υ') {
      // αυ, ευ, ηυ: "v" before a vowel or a voiced consonant, else "f"
      const after = (letters[i + 2] || '').toLowerCase();
      out += inCase(c, GREEK[lower] + (/[αεηιουωβγδζλμνρ]/.test(after) ? 'v' : 'f'));
      i++;
    } else if (GREEK[lower]) {
      out += inCase(c, GREEK[lower]);
    } else if (LATIN_EXTRA[c]) {
      out += allUpper ? LATIN_EXTRA[c].toUpperCase() : LATIN_EXTRA[c];
    } else if (c === '&') {
      out += allUpper ? ' AND ' : ' and ';
    } else if (c in CHAR_SWAPS) {
      out += CHAR_SWAPS[c];
    } else {
      out += c;
    }
  }
  out = out.replace(/ {2,}/g, ' ').trim();
  return out && !disallowedChars(out).length ? out : null;
}

/**
 * A sure correction for an amount, or null.
 * "1,250.00" and "1.250,00" give "1250.00". "1250,5" gives "1250.50".
 * "1,250" gives null, because it can be 1250 or 1.25.
 */
function suggestAmount(raw) {
  const s = String(raw).trim()
    .replace(/^(€|EUR)\s*/i, '').replace(/\s*(€|EUR)$/i, '')
    .replace(/[\s'’]/g, '');                                // spaces and apostrophes between thousands
  if (!/^\d([\d.,]*\d)?$/.test(s)) return null;
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  let whole = s;
  let fraction = '';
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    const at = s.lastIndexOf(decimal);
    whole = s.slice(0, at);
    fraction = s.slice(at + 1);
    if (whole.includes(decimal) || !new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`).test(whole)) return null;
    whole = whole.split(group).join('');
  } else if (dot >= 0 || comma >= 0) {
    const parts = s.split(dot >= 0 ? '.' : ',');
    if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) {
      [whole, fraction] = parts;                            // one separator, 1 or 2 digits after it: decimals
    } else if (parts.length > 2 && /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every(part => /^\d{3}$/.test(part))) {
      whole = parts.join('');                               // two or more separators: thousands
    } else {
      return null;
    }
  }
  if (!/^\d+$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return null;
  const result = `${Number(whole)}.${fraction.padEnd(2, '0')}`;
  return AMOUNT_RE.test(result) && amountToCents(result) >= 1 ? result : null;
}

/* ---------- Reports ---------- */

/**
 * A report: { errors: { field: [item] }, warnings: { field: [item] } }.
 * item: { text, short, fix }
 *   text   the full message: "the check digits are not correct. Look for a typing error."
 *   short  a few words for the bottom bar: "check digits"
 *   fix    null, or a correction that you can click:
 *          { set: { field: value }, text: 'Change to', value: 'shown value', group }
 *          { dupOk: 'IBAN|cents', text: 'This is correct' }
 *          group: rows with the same group get one "Change all" button
 */
function newReport() {
  const report = { errors: {}, warnings: {} };
  const add = (list, field, text, short, fix) => {
    (list[field] = list[field] || []).push({ text, short, fix: fix || null });
  };
  report.error = (field, text, short, fix) => add(report.errors, field, text, short, fix);
  report.warn = (field, text, short, fix) => add(report.warnings, field, text, short, fix);
  return report;
}

function setFix(set, text, value = '', group = '') {
  return { set, text, value, group };
}

/** Names and descriptions: necessary, bank characters only, length limit. */
function checkText(report, field, value, max) {
  const bad = disallowedChars(value);
  if (value === '') {
    report.error(field, 'missing.', 'missing');
  } else if (bad.length) {
    const clean = cleanText(value);
    const fix = clean && clean.length <= max ? setFix({ [field]: clean }, 'Change to', clean, 'chars') : null;
    report.error(field, `the bank does not accept ${describeChars(bad)}.`, 'characters not accepted', fix);
  } else if (value.length > max) {
    report.error(field, `has ${value.length} characters. The maximum is ${max}.`, 'too long');
  }
}

function checkPayment(payment) {
  const report = newReport();
  const type = resolvedType(payment);
  const iban = normalizeIban(payment.iban);
  const bic = normalizeBic(payment.bic);
  const amount = payment.amount.trim();

  checkText(report, 'name', payment.name.trim(), NAME_MAX);

  // IBAN. The page offers a correction only for extra characters, never for digits.
  if (iban === '') {
    report.error('iban', 'missing.', 'missing');
  } else if (!IBAN_SHAPE_RE.test(iban)) {
    const stripped = iban.replace(/[^A-Z0-9]/g, '');
    const fix = stripped !== iban && ibanInfo(stripped).valid ? setFix({ iban: stripped }, 'Change to', stripped, 'format') : null;
    report.error('iban', 'must start with a 2-letter country code and 2 check digits. Then letters and digits.', 'format', fix);
  } else {
    const country = iban.slice(0, 2);
    const bankCode = iban.slice(4, 7);
    const toSepa = setFix({ type: 'auto' }, 'Change to SEPA');
    if (type === 'tboc') {
      if (country !== 'CY' || iban.length !== 28) {
        const fix = payment.type === 'tboc' && ibanInfo(iban).valid && detectType(iban) === 'sepa' ? toSepa : null;
        report.error('iban', 'TBOC needs a 28-character Bank of Cyprus IBAN (CY…).', 'not Bank of Cyprus', fix);
      } else if (ibanMod97(iban) !== 1) {
        report.error('iban', 'the check digits are not correct. Look for a typing error.', 'check digits');
      } else if (bankCode !== BOC_BANK_CODE) {
        report.error('iban', `bank code ${bankCode} is not Bank of Cyprus (${BOC_BANK_CODE}). For other banks, use SEPA.`, 'not Bank of Cyprus', toSepa);
      }
    } else if (!SEPA_IBAN_LEN[country]) {
      report.error('iban', `country ${country} is not in the SEPA zone. You cannot send a SEPA payment to this country.`, 'country not in SEPA');
    } else if (iban.length !== SEPA_IBAN_LEN[country]) {
      report.error('iban', `a ${country} IBAN has ${SEPA_IBAN_LEN[country]} characters. This IBAN has ${iban.length}.`, 'length');
    } else if (ibanMod97(iban) !== 1) {
      report.error('iban', 'the check digits are not correct. Look for a typing error.', 'check digits');
    } else if (country === 'BE' && !belgianNationalCheckOk(iban)) {
      report.error('iban', 'the Belgian national check digits are not correct.', 'check digits');
    } else if (country === 'CY' && bankCode === BOC_BANK_CODE) {
      report.warn('iban', 'this is a Bank of Cyprus account. Usually, the correct type is TBOC.', 'usually TBOC', setFix({ type: 'auto' }, 'Change to TBOC'));
    }
  }

  // The BIC is optional
  if (bic !== '') {
    if (!BIC_RE.test(bic)) {
      const stripped = bic.replace(/[^A-Z0-9]/g, '');
      const fix = stripped !== bic && BIC_RE.test(stripped) ? setFix({ bic: stripped }, 'Change to', stripped) : null;
      report.error('bic', 'must have 8 or 11 letters and digits, for example COBADEFFXXX.', 'format', fix);
    } else if (type === 'sepa' && /^[A-Z]{2}\d{2}/.test(iban) && bic.slice(4, 6) !== iban.slice(0, 2)) {
      report.error('bic', `the BIC country ${bic.slice(4, 6)} is not the IBAN country ${iban.slice(0, 2)}. The bank does not accept this.`, 'country');
    } else if (type === 'tboc') {
      report.warn('bic', 'TBOC payments do not use a BIC. The file will not include it.', 'not used', setFix({ bic: '' }, 'Remove the BIC'));
    }
  }

  if (amount === '') {
    report.error('amount', 'missing.', 'missing');
  } else if (!AMOUNT_RE.test(amount)) {
    const sure = suggestAmount(amount);
    const fix = sure ? setFix({ amount: sure }, 'Change to', sure, 'format') : null;
    report.error('amount', /[,'’]|\.\d{3}/.test(amount)
      ? 'use a dot for decimals and no thousands separator, for example 1250.50.'
      : 'use digits with a maximum of 2 decimals, for example 1250.50.', 'format', fix);
  } else if (amountToCents(amount) < 1) {
    report.error('amount', 'must be 0.01 or more.', 'too small');
  }

  checkText(report, 'desc', payment.desc.trim(), DESCRIPTION_MAX);
  return report;
}

/**
 * Payments with the same IBAN and the same amount. This is often a mistake.
 * Gives a Map: row id → { key, others }. others: the numbers of the other payments.
 * Groups that you marked as correct are not in the Map.
 */
function findDuplicates() {
  const groups = new Map();
  state.rows.forEach((row, index) => {
    const iban = normalizeIban(row.iban);
    const amount = row.amount.trim();
    if (!iban || !AMOUNT_RE.test(amount)) return;
    const key = `${iban}|${amountToCents(amount)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: row.id, number: index + 1 });
  });
  const result = new Map();
  for (const [key, group] of groups) {
    if (group.length < 2 || state.dupOk.has(key)) continue;
    group.forEach(item => result.set(item.id, { key, others: group.filter(other => other !== item).map(other => other.number) }));
  }
  return result;
}

/** The checks of one payment, with the duplicate warning. */
function rowReport(row, duplicates) {
  const report = checkPayment(row);
  const duplicate = duplicates.get(row.id);
  if (duplicate) {
    const list = duplicate.others.join(', ');
    report.warn('amount', `the IBAN and the amount are the same as in payment ${list}. Make sure that this is correct.`,
      `same as payment ${list}`, { dupOk: duplicate.key, text: 'This is correct' });
  }
  return report;
}

function checkDebtor(debtor, paymentCount) {
  const report = newReport();
  const iban = normalizeIban(debtor.iban);
  const ref = debtor.batchRef.trim();
  const today = cyprusNow().date;
  const nextDay = nextBusinessDay(today);
  const dateFix = setFix({ execDate: nextDay }, 'Change to', formatDate(nextDay));

  checkText(report, 'name', debtor.name.trim(), DEBTOR_NAME_MAX);

  if (iban === '') {
    report.error('iban', 'missing.', 'missing');
  } else if (!IBAN_SHAPE_RE.test(iban)) {
    const stripped = iban.replace(/[^A-Z0-9]/g, '');
    const fix = stripped !== iban && isBocIban(stripped) && ibanInfo(stripped).valid ? setFix({ iban: stripped }, 'Change to', stripped) : null;
    report.error('iban', 'must start with a 2-letter country code and 2 check digits. Then letters and digits.', 'format', fix);
  } else if (!iban.startsWith('CY') || iban.length !== 28) {
    report.error('iban', `must be a 28-character Cyprus IBAN. This IBAN has ${iban.length} characters.`, 'not a Cyprus IBAN');
  } else if (ibanMod97(iban) !== 1) {
    report.error('iban', 'the check digits are not correct. Look for a typing error.', 'check digits');
  } else if (iban.slice(4, 7) !== BOC_BANK_CODE) {
    report.error('iban', `bank code ${iban.slice(4, 7)} is not Bank of Cyprus (${BOC_BANK_CODE}). The debit account must be at Bank of Cyprus.`, 'not Bank of Cyprus');
  }

  if (debtor.execDate === '') {
    report.error('execDate', 'missing.', 'missing', dateFix);
  } else if (!isValidDate(debtor.execDate)) {
    report.error('execDate', 'is not a valid date.', 'not valid', dateFix);
  } else if (debtor.execDate < today) {
    report.error('execDate', 'is in the past.', 'in the past', dateFix);
  }

  if (ref !== '' && !BATCH_REF_RE.test(ref)) {
    report.error('batchRef', 'use only letters, digits and hyphens.', 'characters');
  } else if (ref.length > BATCH_REF_MAX) {
    report.error('batchRef', `has ${ref.length} characters. The maximum is ${BATCH_REF_MAX}.`, 'too long');
  } else {
    // An ID can have a maximum of 35 characters. Only a long reference and 1000 or more payments make it too long.
    const longest = idLength(batchRef(debtor), paymentCount);
    if (longest > MAX_ID_LEN) {
      report.error('batchRef', `with ${paymentCount} payments, the IDs have ${longest} characters. The maximum is ${MAX_ID_LEN}. Remove ${longest - MAX_ID_LEN} character(s).`, 'too long');
    }
  }
  return report;
}

/** Length of the longest ID: "PMT-" + "YYYYMMDD-HHMMSS" + "-" + reference + "-" + row number. */
function idLength(ref, paymentCount) {
  return 4 + 15 + 1 + ref.length + 1 + Math.max(3, String(paymentCount).length);
}

function batchRef(debtor) {
  return debtor.batchRef.trim() || state.randomRef;
}

function debtorBic(debtor) {
  return normalizeBic(debtor.bic) || DEFAULT_DEBTOR_BIC;
}

/**
 * Checks the full page. It skips empty rows. The CLI skips empty lines in the same way.
 * Each problem: { scope: 'debtor'|'row', rowId, number, field, text, short, fix }.
 */
function checkAll() {
  const filled = [];
  state.rows.forEach((row, index) => {
    if (!isEmptyPayment(row)) filled.push({ row, number: index + 1 });
  });

  const errors = [];
  const warnings = [];
  const collect = (report, where, shorts) => {
    for (const [source, list] of [[report.errors, errors], [report.warnings, warnings]]) {
      for (const [field, items] of Object.entries(source)) {
        items.forEach(item => list.push({ ...where, field, text: item.text, short: `${shorts[field]}: ${item.short}`, fix: item.fix }));
      }
    }
  };

  collect(checkDebtor(state.debtor, filled.length), { scope: 'debtor' }, SHORT_LABELS.debtor);

  const duplicates = findDuplicates();
  let totalCents = 0;
  let sepa = 0;
  let tboc = 0;
  for (const { row, number } of filled) {
    collect(rowReport(row, duplicates), { scope: 'row', rowId: row.id, number }, SHORT_LABELS.row);
    if (resolvedType(row) === 'tboc') tboc++; else sepa++;
    const amount = row.amount.trim();
    if (AMOUNT_RE.test(amount)) totalCents += amountToCents(amount);
  }

  return { filled, errors, warnings, totalCents, sepa, tboc };
}

/* ==========================================================================
   4. Writing the XML (pain.001.001.09, one PmtInf block for each payment.
      Each element is the same as in the CLI.)
   ========================================================================== */

function escapeXml(text) {
  return String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/**
 * debtor:   { name, iban, bic, execDate }, checked and clean
 * payments: [{ type: 'sepa'|'tboc', name, iban, bic, cents, desc }]
 * ref:      batch reference
 * now:      { date, time } in Cyprus time
 */
function buildXml(debtor, payments, ref, now) {
  const stamp = `${now.date.replace(/-/g, '')}-${now.time.replace(/:/g, '')}-${ref}`;
  const seqWidth = Math.max(3, String(payments.length).length);
  const totalCents = payments.reduce((sum, p) => sum + p.cents, 0);

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  let depth = 0;
  const indent = () => '  '.repeat(depth);
  const open = (tag, attrs = '') => { lines.push(`${indent()}<${tag}${attrs}>`); depth++; };
  const close = tag => { depth--; lines.push(`${indent()}</${tag}>`); };
  const leaf = (tag, text, attrs = '') => lines.push(`${indent()}<${tag}${attrs}>${escapeXml(text)}</${tag}>`);
  // wrap('DbtrAcct/Id', () => leaf('IBAN', …)) writes <DbtrAcct><Id><IBAN>…</IBAN></Id></DbtrAcct>
  const wrap = (path, inner) => {
    const tags = path.split('/');
    tags.forEach(tag => open(tag));
    inner();
    tags.reverse().forEach(tag => close(tag));
  };

  open('Document', ` xmlns="${XML_NAMESPACE}"`);
  open('CstmrCdtTrfInitn');

  open('GrpHdr');
  leaf('MsgId', `MSG-${stamp}`);
  leaf('CreDtTm', `${now.date}T${now.time}`);
  leaf('NbOfTxs', String(payments.length));
  leaf('CtrlSum', formatCents(totalCents));
  wrap('InitgPty', () => leaf('Nm', debtor.name));
  close('GrpHdr');

  payments.forEach((payment, index) => {
    // One transaction in each block. Thus the block and the transaction use the same row number.
    const rowNo = String(index + 1).padStart(seqWidth, '0');
    const isSepa = payment.type === 'sepa';

    open('PmtInf');
    leaf('PmtInfId', `PMT-${stamp}-${rowNo}`);
    leaf('PmtMtd', 'TRF');
    wrap('PmtTpInf/SvcLvl', () => leaf('Cd', isSepa ? 'SEPA' : 'TBOC'));
    wrap('ReqdExctnDt', () => leaf('Dt', debtor.execDate));
    wrap('Dbtr', () => leaf('Nm', debtor.name));
    wrap('DbtrAcct/Id', () => leaf('IBAN', debtor.iban));
    wrap('DbtrAgt/FinInstnId', () => leaf('BICFI', debtor.bic));
    // BOC rules: SEPA charges are always shared (SLEV). Internal transfers use DEBT.
    leaf('ChrgBr', isSepa ? 'SLEV' : 'DEBT');

    open('CdtTrfTxInf');
    wrap('PmtId', () => leaf('EndToEndId', `E2E-${stamp}-${rowNo}`));
    wrap('Amt', () => leaf('InstdAmt', formatCents(payment.cents), ' Ccy="EUR"'));
    if (isSepa && payment.bic !== '') {
      wrap('CdtrAgt/FinInstnId', () => leaf('BICFI', payment.bic));
    }
    wrap('Cdtr', () => leaf('Nm', payment.name));
    wrap('CdtrAcct/Id', () => leaf('IBAN', payment.iban));
    wrap('RmtInf/Strd', () => leaf('AddtlRmtInf', payment.desc));
    close('CdtTrfTxInf');

    close('PmtInf');
  });

  close('CstmrCdtTrfInitn');
  close('Document');
  return lines.join('\n') + '\n';
}

/** A row as it goes into the file: no extra spaces, normalized, type set. */
function cleanPayment(row) {
  return {
    type: resolvedType(row),
    name: row.name.trim(),
    iban: normalizeIban(row.iban),
    bic: normalizeBic(row.bic),
    cents: amountToCents(row.amount.trim()),
    desc: row.desc.trim(),
  };
}

/* ==========================================================================
   5. Reading an XML file from this site or from the CLI
   ========================================================================== */

function readXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('The file is not valid XML. It can be damaged or incomplete.');
  }
  const root = doc.documentElement;
  if (root.localName !== 'Document' || root.namespaceURI !== XML_NAMESPACE) {
    throw new Error('This is not a pain.001.001.09 payment file. You can open only files from this site or from the boc_payments_xml command-line tool.');
  }

  const children = (node, name) => (node ? Array.from(node.children).filter(c => c.localName === name) : []);
  const find = (node, path) => path.split('/').reduce((n, name) => children(n, name)[0] || null, node);
  const value = (node, path) => {
    const found = find(node, path);
    return found ? found.textContent.trim() : '';
  };

  const initiation = find(root, 'CstmrCdtTrfInitn');
  let debtor = null;
  const payments = [];

  for (const block of children(initiation, 'PmtInf')) {
    const blockDebtor = {
      name: value(block, 'Dbtr/Nm'),
      iban: normalizeIban(value(block, 'DbtrAcct/Id/IBAN')),
      bic: normalizeBic(value(block, 'DbtrAgt/FinInstnId/BICFI')),
      execDate: value(block, 'ReqdExctnDt/Dt'),
    };
    if (!debtor) {
      debtor = blockDebtor;
    } else if (JSON.stringify(blockDebtor) !== JSON.stringify(debtor)) {
      throw new Error('The payments in this file use more than one debit account or more than one date. This site makes files with one debit account and one date.');
    }

    const code = value(block, 'PmtTpInf/SvcLvl/Cd').toLowerCase();
    for (const tx of children(block, 'CdtTrfTxInf')) {
      const amount = find(tx, 'Amt/InstdAmt');
      if (amount && amount.getAttribute('Ccy') !== 'EUR') {
        throw new Error('The file has payments in a currency that is not EUR.');
      }
      const iban = normalizeIban(value(tx, 'CdtrAcct/Id/IBAN'));
      payments.push({
        type: typeFromText(code, iban, [], ''),
        name: value(tx, 'Cdtr/Nm'),
        iban,
        bic: normalizeBic(value(tx, 'CdtrAgt/FinInstnId/BICFI')),
        amount: amount ? amount.textContent.trim() : '',
        desc: value(tx, 'RmtInf/Strd/AddtlRmtInf'),
      });
    }
  }
  if (!payments.length) throw new Error('The file has no payments.');

  // MsgId is "MSG-YYYYMMDD-HHMMSS-<batch reference>"
  const stamp = /^MSG-\d{8}-\d{6}-(.+)$/.exec(value(initiation, 'GrpHdr/MsgId'));
  return { debtor: { ...debtor, batchRef: stamp ? stamp[1] : '' }, payments };
}

/**
 * "sepa" or "tboc" from a file or a paste. If the type is the same as the
 * Auto type, it stays Auto. Then it follows the IBAN when you change the IBAN.
 */
function typeFromText(raw, iban, notes, where) {
  const type = String(raw).trim().toLowerCase();
  if (type === '' || type === 'auto') return 'auto';
  if (type !== 'sepa' && type !== 'tboc') {
    notes.push(`${where}: the type “${String(raw).trim()}” is not known. The page set it to Auto. Use sepa or tboc.`);
    return 'auto';
  }
  return type === detectType(iban) ? 'auto' : type;
}

/* ==========================================================================
   6. CSV files and smart paste
   ========================================================================== */

/** Splits CSV or tab-separated text into rows of cells (RFC 4180 quotes). */
function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Reads a CSV in the CLI format. The header is "type,name,iban,bic,amount,description". */
function readCsv(text) {
  const lines = parseDelimited(text, ',');
  const header = (lines[0] || []).map(cell => cell.trim().toLowerCase());
  if (!lines.length || header.every(cell => cell === '')) throw new Error('The file is empty.');
  if (header.join(',') !== CSV_HEADER.join(',')) {
    throw new Error(`The first line must be “${CSV_HEADER.join(',')}”. This is the format of the command-line tool.`);
  }

  const payments = [];
  const notes = [];
  lines.slice(1).forEach((cells, i) => {
    const line = i + 2;
    if (cells.every(cell => cell.trim() === '')) return;   // empty line
    if (cells.length !== CSV_HEADER.length) {
      notes.push(`Line ${line}: the line must have 6 columns, but it has ${cells.length}. The page did not load this line.`);
      return;
    }
    const [type, name, iban, bic, amount, desc] = cells.map(cell => cell.trim());
    const payment = { name, iban: normalizeIban(iban), bic: normalizeBic(bic), amount, desc };
    payment.type = typeFromText(type, payment.iban, notes, `Line ${line}`);
    payments.push(payment);
  });
  return { payments, notes };
}

function buildCsv(rows) {
  const quote = value => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [CSV_HEADER.join(',')];
  for (const row of rows) {
    lines.push([
      resolvedType(row), row.name.trim(), normalizeIban(row.iban), normalizeBic(row.bic), row.amount.trim(), row.desc.trim(),
    ].map(quote).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// Header words that the page knows in a pasted header row
const HEADER_WORDS = {
  type: 'type',
  name: 'name', beneficiary: 'name', 'beneficiary name': 'name', payee: 'name',
  iban: 'iban', account: 'iban',
  bic: 'bic', swift: 'bic', 'bic/swift': 'bic',
  amount: 'amount', 'amount, eur': 'amount', 'amount (eur)': 'amount', 'amount eur': 'amount',
  description: 'desc', desc: 'desc', details: 'desc', reference: 'desc',
};

/** If the first pasted row is a header, this gives the field of each column. Unknown words give null. */
function headerColumns(cells) {
  const columns = cells.map(cell => HEADER_WORDS[cell.trim().toLowerCase()] || null);
  return columns.includes('iban') && columns.filter(Boolean).length >= 2 ? columns : null;
}

/**
 * Smart paste: finds the field of each column from the values.
 * known: the fields from a header row. The page tests only the other columns.
 * IBAN, amount, type and BIC have a clear shape. The first column with
 * other text is the name. The second column with other text is the description.
 */
function detectColumns(lines, known = []) {
  const width = Math.max(...lines.map(cells => cells.length));
  const columns = Array.from({ length: width }, (_, c) => known[c] || null);
  const used = new Set(columns.filter(Boolean));
  const tests = {
    iban: v => /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(normalizeIban(v)),
    amount: v => /^[€\s]*\d[\d\s.,']*$/.test(v),
    type: v => ['sepa', 'tboc', 'auto'].includes(v.toLowerCase()),
    bic: v => BIC_RE.test(v.toUpperCase()) && Boolean(SEPA_IBAN_LEN[v.toUpperCase().slice(4, 6)]),
  };
  const values = Array.from({ length: width }, (_, c) => lines.map(cells => (cells[c] || '').trim()).filter(Boolean));

  for (const [field, test] of Object.entries(tests)) {
    if (used.has(field)) continue;
    let best = -1;
    let bestScore = 0.6;
    values.forEach((list, c) => {
      if (columns[c] || !list.length) return;
      const score = list.filter(test).length / list.length;
      if (score > bestScore) { best = c; bestScore = score; }
    });
    if (best >= 0) {
      columns[best] = field;
      used.add(field);
    }
  }
  const textFields = ['name', 'desc'].filter(field => !used.has(field));
  values.forEach((list, c) => {
    if (!columns[c] && list.length && textFields.length) columns[c] = textFields.shift();
  });
  return columns;
}

/* ==========================================================================
   7. State: all the data that you enter, only in the memory of this tab
   ========================================================================== */

const state = {
  debtor: null,             // { name, iban, bic, execDate, batchRef }. bic: from an opened file, else empty.
  rows: [],                 // [{ id, type: 'auto'|'sepa'|'tboc', name, iban, bic, amount, desc }]
  touched: new Set(),       // fields that you completed one or more times: "debtor.iban", "12.amount"
  showAll: false,           // after a click on "Download XML" with problems: show all problems
  openMore: new Set(),      // ids of the rows with the "⋯" panel open
  refOpen: false,           // the field for the file reference is open
  dupOk: new Set(),         // duplicate groups that you marked as correct: "IBAN|cents"
  opened: null,             // after you open a file: { name, count, note, monthFrom, monthTo, monthOffer }
  randomRef: randomRef(BATCH_REF_LEN),
  errorKey: '',             // the problem that the page showed last
  warnKey: '',              // the warning that the page showed last
  undo: null,               // a copy of the data from before the last large change, for 10 seconds
};

let nextRowId = 1;

function newPayment(values) {
  // sample: a sample payment that you did not change
  return { id: nextRowId++, type: 'auto', name: '', iban: '', bic: '', amount: '', desc: '', sample: false, ...values };
}

function emptyDebtor() {
  return { name: '', iban: '', bic: '', execDate: nextBusinessDay(cyprusNow().date), batchRef: '' };
}

function isEmptyPayment(row) {
  return ['name', 'iban', 'bic', 'amount', 'desc'].every(field => row[field].trim() === '');
}

function hasPayments() {
  return state.rows.some(row => !isEmptyPayment(row));
}

function hasData() {
  return state.debtor.name.trim() !== '' || state.debtor.iban.trim() !== '' || hasPayments();
}

/** Payments that you added or changed. Sample payments are not your data. */
function hasUserPayments() {
  return state.rows.some(row => !row.sample && !isEmptyPayment(row));
}

function hasUserData() {
  return state.debtor.name.trim() !== '' || state.debtor.iban.trim() !== '' || hasUserPayments();
}

function hasSample() {
  return state.rows.some(row => row.sample);
}

function isShown(key) {
  return state.showAll || state.touched.has(key);
}

function touchRow(row) {
  FIELDS.forEach(field => state.touched.add(`${row.id}.${field}`));
}

function touchDebtor() {
  Object.keys(DEBTOR_FIELDS).forEach(field => state.touched.add(`debtor.${field}`));
}

/** Hides the shown problems and closes the panels. The data stays. */
function resetView() {
  state.touched.clear();
  state.showAll = false;
  state.openMore.clear();
  state.refOpen = false;
  state.errorKey = '';
  state.warnKey = '';
}

/** A copy of all the data. Undo puts it back. */
function snapshot() {
  return {
    debtor: { ...state.debtor },
    rows: state.rows.map(row => ({ ...row })),
    randomRef: state.randomRef,
    touched: new Set(state.touched),
    showAll: state.showAll,
    openMore: new Set(state.openMore),
    dupOk: new Set(state.dupOk),
    opened: state.opened ? { ...state.opened } : null,
  };
}

function restore(copy) {
  resetView();
  Object.assign(state, {
    debtor: copy.debtor,
    rows: copy.rows,
    randomRef: copy.randomRef,
    touched: copy.touched,
    showAll: copy.showAll,
    openMore: copy.openMore,
    dupOk: copy.dupOk,
    opened: copy.opened,
  });
  fillMonth();
}

/* ==========================================================================
   8. Drawing the page
   ========================================================================== */

const ui = {};
const rowEls = new Map();                 // row id → its <li>
const fixTargets = new WeakMap();         // correction button → what it changes

function renderAll() {
  renderDebtor();
  renderRows();
}

/* ---------- Problems and correction buttons ---------- */

/** "IBAN: the check digits are not correct." and the correction buttons, as page elements. */
function problemParts(label, item, target, group) {
  const text = el('span', 'msg-text');
  if (label) text.append(el('strong', '', `${label}:`), ' ', item.text);
  else text.append(capitalize(item.text));
  const parts = [text];
  if (item.fix) parts.push(fixButton(item.fix, target));
  if (group && group.items.length > 1) parts.push(fixAllButton(group));
  return parts;
}

/** target: { scope: 'debtor' } or { scope: 'row', rowId } */
function fixButton(fix, target) {
  const button = el('button', 'fix-btn', fix.text);
  button.type = 'button';
  if (fix.value) button.append(' ', el('span', 'mono', fix.value));
  button.title = fix.value ? `${fix.text} ${fix.value}` : fix.text;
  fixTargets.set(button, { ...target, fix });
  return button;
}

/** group: { field, items: [{ rowId, set }] } */
function fixAllButton(group) {
  const button = el('button', 'link fix-all', `Change all ${group.items.length} ${GROUP_NOUNS[group.field]}`);
  button.type = 'button';
  fixTargets.set(button, { scope: 'all', field: group.field, items: group.items });
  return button;
}

/* ---------- Pay from ---------- */

function renderDebtor() {
  const count = state.rows.filter(row => !isEmptyPayment(row)).length;
  const report = checkDebtor(state.debtor, count);

  for (const [field, id] of Object.entries(DEBTOR_FIELDS)) {
    const input = document.getElementById(id);
    if (input.value !== state.debtor[field]) input.value = state.debtor[field];
    const items = isShown(`debtor.${field}`) ? report.errors[field] || [] : [];
    input.setAttribute('aria-invalid', items.length ? 'true' : 'false');
    const msg = document.getElementById(`${id}-msg`);
    msg.replaceChildren(...items.flatMap(item => problemParts('', item, { scope: 'debtor' })));
    msg.hidden = items.length === 0;
  }

  // Below the IBAN: a check mark for a valid Bank of Cyprus IBAN
  const iban = normalizeIban(state.debtor.iban);
  const valid = iban !== '' && isBocIban(iban) && ibanInfo(iban).valid;
  ui.debtorIbanInfo.replaceChildren(...(valid ? [el('span', 'ok', '✓ Bank of Cyprus')] : []));

  // Below the date: the date in words. Saturday and Sunday are not business days.
  const date = state.debtor.execDate;
  const validDate = isValidDate(date);
  const weekend = validDate && isWeekend(date);
  ui.dateWords.textContent = validDate ? `${formatDateLong(date)}${weekend ? '. Not a business day.' : ''}` : '';
  ui.dateWords.classList.toggle('is-warning', weekend);
  ui.dateInput.min = cyprusNow().date;

  // The file reference: one line. "Change" opens the field.
  const custom = state.debtor.batchRef.trim();
  ui.refText.textContent = `File reference ${batchRef(state.debtor)}${custom ? '' : ' (random)'}`;
  ui.refInput.placeholder = `Random: ${state.randomRef}`;
  if (report.errors.batchRef && isShown('debtor.batchRef')) state.refOpen = true;
  ui.refField.hidden = !state.refOpen;
  ui.refToggle.setAttribute('aria-expanded', state.refOpen ? 'true' : 'false');
}

/* ---------- Payments ---------- */

/** The <li> of a row. The page makes it one time from the template and uses it again. */
function rowElement(row) {
  let li = rowEls.get(row.id);
  if (!li) {
    li = ui.rowTemplate.content.firstElementChild.cloneNode(true);
    li.dataset.id = String(row.id);
    const msgsId = `row-${row.id}-msgs`;
    const infoId = `row-${row.id}-info`;
    li.querySelector('.row-msgs').id = msgsId;
    li.querySelector('.iban-info').id = infoId;
    li.querySelectorAll('[data-field]').forEach(input => input.setAttribute('aria-describedby', msgsId));
    const iban = li.querySelector('[data-field="iban"]');
    iban.id = `row-${row.id}-iban`;
    iban.setAttribute('aria-describedby', `${msgsId} ${infoId}`);
    li.querySelector('.iban-label').htmlFor = iban.id;
    rowEls.set(row.id, li);
  }
  return li;
}

/** Puts the rows in order. Rows that do not move stay in the page, so the typing focus stays. */
function renderRows() {
  const live = new Set();
  let cursor = ui.list.firstElementChild;
  state.rows.forEach((row, index) => {
    const li = rowElement(row);
    updateRow(li, row, index);
    if (li === cursor) cursor = cursor.nextElementSibling;
    else ui.list.insertBefore(li, cursor);
    live.add(row.id);
  });
  while (cursor) {
    const next = cursor.nextElementSibling;
    cursor.remove();
    cursor = next;
  }
  for (const id of [...rowEls.keys()]) {
    if (!live.has(id)) rowEls.delete(id);
  }
  refreshChecks();
  renderListChrome();
  renderSummary();
}

function updateRow(li, row, index) {
  const n = index + 1;
  li.querySelector('.num').textContent = String(n);
  li.querySelector('.grip').title = 'Drag to change the order';
  li.querySelector('.c-actions').setAttribute('aria-label', `Payment ${n}`);
  const label = (selector, text, title) => {
    const button = li.querySelector(selector);
    button.setAttribute('aria-label', text);
    button.title = title;
  };
  label('.act-copy', `Copy payment ${n}`, 'Copy');
  label('.act-delete', `Delete payment ${n}`, 'Delete');
  label('.act-more', `Type, BIC and more for payment ${n}`, 'Type, BIC and more');
  li.querySelector('[data-row-action="up"]').disabled = index === 0;
  li.querySelector('[data-row-action="down"]').disabled = index === state.rows.length - 1;

  for (const field of FIELDS) {
    const input = li.querySelector(`[data-field="${field}"]`);
    if (input.value !== row[field]) input.value = row[field];
    input.setAttribute('aria-label', `${FIELD_NAMES[field]}, payment ${n}`);
  }
}

/** Checks all rows again. A change in one row can change a duplicate warning or a "Change all" button in a different row. */
function refreshChecks() {
  const duplicates = findDuplicates();
  const reports = new Map();
  const groups = new Map();                 // "amount:format" → { field, items: [{ rowId, set }] }
  state.rows.forEach(row => {
    const report = isEmptyPayment(row) ? newReport() : rowReport(row, duplicates);
    reports.set(row.id, report);
    for (const [field, items] of Object.entries(report.errors)) {
      items.forEach(item => {
        if (!item.fix || !item.fix.group) return;
        const key = `${field}:${item.fix.group}`;
        if (!groups.has(key)) groups.set(key, { field, items: [] });
        groups.get(key).items.push({ rowId: row.id, set: item.fix.set });
      });
    }
  });
  state.rows.forEach(row => {
    const li = rowEls.get(row.id);
    if (li) updateRowChecks(li, row, reports.get(row.id), groups);
  });
}

/** The marks in the IBAN cell, the line below it, and the problems of the fields that you completed. */
function updateRowChecks(li, row, report, groups) {
  const iban = normalizeIban(row.iban);
  const type = resolvedType(row);
  const manual = row.type !== 'auto';
  const info = iban ? ibanInfo(iban) : null;
  const ok = Boolean(info && info.valid);

  const tag = li.querySelector('.type-tag');
  tag.hidden = !manual;
  tag.textContent = type.toUpperCase();
  tag.title = 'You set this type. Click to change it.';
  li.querySelector('.iban-ok').hidden = !ok;
  li.classList.toggle('has-ok', ok);
  li.classList.toggle('has-tag', manual);

  // Below the IBAN, while you type in it: bank, country, type and BIC
  const line = li.querySelector('.iban-info');
  if (!iban) {
    line.replaceChildren();
  } else {
    const bic = normalizeBic(row.bic);
    const parts = [info.bank, info.country, `${type.toUpperCase()}${manual ? ' (set by you)' : ''}`, bic && type === 'sepa' ? `BIC ${bic}` : ''];
    line.replaceChildren(...(ok ? [el('span', 'sr-only', 'Valid IBAN. ')] : []), parts.filter(Boolean).join(' · '));
  }

  li.querySelector('option[value="auto"]').textContent = iban ? `Auto (${detectType(row.iban).toUpperCase()})` : 'Auto';
  li.querySelector('[data-field="bic"]').placeholder = type === 'tboc' ? 'Not used' : 'Optional';

  const items = [];
  const target = { scope: 'row', rowId: row.id };
  for (const field of FIELDS) {
    const input = li.querySelector(`[data-field="${field}"]`);
    const shown = isShown(`${row.id}.${field}`);
    const errors = shown ? report.errors[field] || [] : [];
    const warnings = shown ? report.warnings[field] || [] : [];
    input.setAttribute('aria-invalid', errors.length ? 'true' : 'false');
    input.classList.toggle('has-warning', errors.length === 0 && warnings.length > 0);
    errors.forEach(item => {
      const group = item.fix && item.fix.group ? groups.get(`${field}:${item.fix.group}`) : null;
      const node = el('li', 'is-error');
      node.append(...problemParts(FIELD_LABELS[field], item, target, group));
      items.push(node);
    });
    warnings.forEach(item => {
      const node = el('li', 'is-warning');
      node.append(...problemParts(FIELD_LABELS[field], item, target, null));
      items.push(node);
    });
  }
  li.querySelector('.row-msgs').replaceChildren(...items);

  const open = state.openMore.has(row.id);
  li.querySelector('.row-more').hidden = !open;
  li.querySelector('.act-more').setAttribute('aria-expanded', open ? 'true' : 'false');
  li.classList.toggle('is-open', open);
}

/** The start cards or the list, the steps, the file buttons, and the message after you open a file. */
function renderListChrome() {
  const payments = hasPayments();
  const data = hasData();
  ui.start.hidden = state.rows.length > 0;
  ui.sheet.hidden = state.rows.length === 0;
  ui.clearAll.hidden = state.rows.length === 0;
  ui.sampleNote.hidden = !hasSample();
  ui.steps.hidden = hasUserPayments();
  ui.needsPayments.forEach(button => { button.hidden = !payments; });
  ui.needsData.forEach(button => { button.hidden = !data; });
  renderOpened();
}

function renderOpened() {
  const opened = state.opened;
  ui.opened.hidden = !opened;
  if (opened) {
    const title = el('strong');
    title.append('You opened ', el('span', 'mono', opened.name), '.');
    ui.openedText.replaceChildren(title, ` ${plural(opened.count, 'payment')}.${opened.note ? ` ${opened.note}` : ''}`);
  }
  renderMonth();
}

/** Puts the suggestion of the page into the "New month?" fields. */
function fillMonth() {
  ui.monthFrom.value = state.opened ? state.opened.monthFrom : '';
  ui.monthTo.value = state.opened ? state.opened.monthTo : '';
}

/** The word as a whole word, in any letter case. */
function wordRegex(word, flags = 'i') {
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(word)}(?=$|[^A-Za-z0-9])`, flags);
}

/** "New month?": the button text, and a mark on each description that will change. */
function renderMonth() {
  const on = Boolean(state.opened && state.opened.monthOffer);
  ui.month.hidden = !on;
  const from = ui.monthFrom.value.trim();
  const to = ui.monthTo.value.trim();
  const test = on && from ? wordRegex(from) : null;
  let count = 0;
  state.rows.forEach(row => {
    const hit = Boolean(test && test.test(row.desc));
    if (hit) count++;
    const li = rowEls.get(row.id);
    if (li) li.querySelector('[data-field="desc"]').classList.toggle('will-change', hit);
  });
  ui.monthBtn.textContent = count ? `Replace in ${plural(count, 'description')}` : 'Replace';
  ui.monthBtn.disabled = !count || !to || from.toLowerCase() === to.toLowerCase();
}

/* ---------- Bottom bar ---------- */

function problemKey(item) {
  return [item.scope, item.rowId || '', item.field || '', item.short].join('|');
}

function problemLabel(item) {
  return item.scope === 'row' ? `payment ${item.number}, ${item.short}` : `Pay from, ${item.short}`;
}

/** The bottom bar and the payments heading. */
function renderSummary() {
  const { filled, errors, warnings, totalCents, sepa, tboc } = checkAll();
  const count = filled.length;

  ui.meta.textContent = count ? `${sepa} SEPA · ${tboc} TBOC` : '';
  ui.barCount.textContent = plural(count, 'payment');
  ui.barTotal.textContent = money(totalCents);

  const status = count === 0 ? 'empty' : errors.length ? 'errors' : 'ready';
  ui.bar.dataset.state = status;

  const parts = [];
  if (status === 'empty') {
    parts.push(el('span', '', 'Add payments to start.'));
  } else if (status === 'errors') {
    const at = Math.max(0, errors.findIndex(item => problemKey(item) === state.errorKey));
    const where = el('button', 'bar-link', `${errors.length > 1 ? `Problem ${at + 1}: ` : ''}${problemLabel(errors[at])}`);
    where.type = 'button';
    where.dataset.action = 'current-problem';
    parts.push(el('strong', '', `${plural(errors.length, 'problem')} to correct.`), where);
  } else {
    parts.push(el('span', '', count === 1 ? 'The payment passes the checks.' : `All ${count} payments pass the checks.`));
    if (warnings.length) {
      const link = el('button', 'bar-link is-warning', plural(warnings.length, 'warning'));
      link.type = 'button';
      link.dataset.action = 'next-warning';
      parts.push(link);
    }
  }
  ui.barStatus.replaceChildren(...parts);
  ui.barNav.hidden = status !== 'errors' || errors.length < 2;
  ui.barBtn.className = `btn btn-lg ${status === 'ready' ? 'btn-primary' : status === 'errors' ? 'btn-light' : 'btn-off'}`;
  ui.barBtn.setAttribute('aria-disabled', status === 'empty' ? 'true' : 'false');
}

function fileName(ext) {
  const date = isValidDate(state.debtor.execDate) ? state.debtor.execDate : cyprusNow().date;
  return ext === 'xml' ? `payments-${date}-${batchRef(state.debtor)}.xml` : `payments-${date}.csv`;
}

/* ---------- FAQ ---------- */

/** The FAQ button says "Close all" when all the answers are open. Else it says "Open all". */
function renderFaqToggle() {
  const allOpen = ui.faqItems.every(item => item.open);
  ui.faqToggleText.textContent = allOpen ? 'Close all' : 'Open all';
  ui.faqToggle.classList.toggle('is-open', allOpen);
}

/* ---------- Messages, dialogs, focus ---------- */

let toastTimer = 0;

/** A short message above the bottom bar. With an undo copy, it shows "Undo" for 10 seconds. */
function toast(text, undoCopy = null) {
  state.undo = undoCopy;
  ui.toastText.textContent = text;
  ui.toastUndo.hidden = !undoCopy;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(closeToast, undoCopy ? 10000 : 6000);
}

function closeToast() {
  clearTimeout(toastTimer);
  ui.toast.hidden = true;
  state.undo = null;
}

function undo() {
  if (!state.undo) return;
  restore(state.undo);
  closeToast();
  renderAll();
  toast('The change is undone.');
}

/** Tells screen reader users what changed. */
function announce(text) {
  ui.announcer.textContent = '';
  requestAnimationFrame(() => { ui.announcer.textContent = text; });
}

/**
 * A modal dialog. body: a string gives a paragraph, an array gives a list,
 * a node goes in as it is. buttons: [{ label, value, kind, focus }].
 * Gives the value of the button, or 'cancel'.
 */
function ask({ title, body, buttons, wide = false }) {
  return new Promise(resolve => {
    ui.dialog.classList.toggle('is-wide', wide);
    ui.dialogTitle.textContent = title;
    ui.dialogBody.replaceChildren(...body.map(part => {
      if (part instanceof Node) return part;
      if (Array.isArray(part)) {
        const ul = el('ul');
        part.forEach(text => ul.append(el('li', '', text)));
        return ul;
      }
      return el('p', '', part);
    }));
    const nodes = buttons.map(spec => {
      const button = el('button', `btn ${spec.kind || 'btn-quiet'}`, spec.label);
      button.type = 'button';
      button.addEventListener('click', () => ui.dialog.close(spec.value));
      return button;
    });
    ui.dialogActions.replaceChildren(...nodes);
    ui.dialog.returnValue = '';
    ui.dialog.addEventListener('close', () => resolve(ui.dialog.returnValue || 'cancel'), { once: true });
    ui.dialog.showModal();
    const focusIndex = buttons.findIndex(spec => spec.focus);
    nodes[focusIndex >= 0 ? focusIndex : nodes.length - 1].focus();
  });
}

function notice(title, body) {
  return ask({ title, body, buttons: [{ label: 'OK', value: 'ok', kind: 'btn-primary' }] });
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToY(top) {
  window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function scrollToElement(node, offset = 12) {
  scrollToY(node.getBoundingClientRect().top + window.scrollY - offset);
}

/** Scrolls to a field if it is not on the screen, and puts the focus on it. */
function revealAndFocus(input) {
  const rect = input.getBoundingClientRect();
  const bottom = window.innerHeight - ui.bar.offsetHeight - 60;
  if (rect.top < 70 || rect.bottom > bottom) {
    scrollToY(window.scrollY + rect.top - Math.round(window.innerHeight / 3));
  }
  input.focus({ preventScroll: true });
}

function focusCell(rowId, field) {
  const li = rowEls.get(rowId);
  const input = li && li.querySelector(`[data-field="${field}"]`);
  if (input) revealAndFocus(input);
}

/** Goes to the field of a problem. */
function goTo(item) {
  if (item.scope === 'debtor') {
    if (item.field === 'batchRef' && !state.refOpen) {
      state.refOpen = true;
      renderDebtor();
    }
    revealAndFocus(document.getElementById(DEBTOR_FIELDS[item.field]));
  } else if (item.scope === 'row') {
    if ((item.field === 'type' || item.field === 'bic') && !state.openMore.has(item.rowId)) {
      state.openMore.add(item.rowId);
      refreshChecks();
    }
    focusCell(item.rowId, item.field);
  }
}

/* ==========================================================================
   9. Actions
   ========================================================================== */

function newFile() {
  if (!hasData()) {
    revealAndFocus(ui.debtorName);
    return;
  }
  const copy = snapshot();
  clearEverything();
  revealAndFocus(ui.debtorName);
  toast('New file. The page is empty.', copy);
}

function clearEverything() {
  state.debtor = emptyDebtor();
  state.rows = [];
  state.randomRef = randomRef(BATCH_REF_LEN);
  state.dupOk = new Set();
  state.opened = null;
  resetView();
  fillMonth();
  renderAll();
}

function sampleRows() {
  return EXAMPLE.payments.map(payment => newPayment({ ...payment, sample: true }));
}

/** Puts the sample payments in the table. "Pay from" does not change. */
function loadExample() {
  const copy = hasUserPayments() ? snapshot() : null;
  state.rows = sampleRows();
  state.dupOk = new Set();
  state.opened = null;
  state.openMore.clear();
  state.showAll = false;
  renderAll();
  scrollToElement(ui.paymentsBlock);
  toast('Sample data is in the table. The names and accounts are not real.', copy);
}

/** "Clear all" and "Clear and start": removes all payments. "Pay from" does not change. */
function clearPayments() {
  const copy = hasUserPayments() ? snapshot() : null;
  state.rows = [];
  state.dupOk = new Set();
  state.opened = null;
  state.openMore.clear();
  state.showAll = false;
  renderAll();
  scrollToElement(ui.paymentsBlock);
  ui.startAdd.focus({ preventScroll: true });
  if (copy) toast('All payments are cleared.', copy);
  else announce('The sample data is cleared.');
}

/** Adds a row at the end, or uses an empty last row, and puts the focus on it. */
function addPayment(field = 'name') {
  let row = state.rows[state.rows.length - 1];
  if (!row || !isEmptyPayment(row)) {
    row = newPayment();
    state.rows.push(row);
  }
  renderRows();
  focusCell(row.id, field);
}

function duplicateRow(id) {
  const index = state.rows.findIndex(row => row.id === id);
  if (index < 0) return;
  const { type, name, iban, bic, amount, desc } = state.rows[index];
  const copy = newPayment({ type, name, iban, bic, amount, desc });
  state.rows.splice(index + 1, 0, copy);
  FIELDS.forEach(field => {
    if (state.touched.has(`${id}.${field}`)) state.touched.add(`${copy.id}.${field}`);
  });
  renderRows();
  focusCell(copy.id, 'name');
  announce(`Payment ${index + 1} is copied as payment ${index + 2}.`);
}

/** Deletes one row, with Undo. The focus goes to the first cell of the next row. */
function deleteRow(id) {
  const index = state.rows.findIndex(row => row.id === id);
  const row = state.rows[index];
  if (!row) return;
  const copy = isEmptyPayment(row) ? null : snapshot();
  state.rows.splice(index, 1);
  state.openMore.delete(id);
  renderRows();
  const next = state.rows[Math.min(index, state.rows.length - 1)];
  if (next) focusCell(next.id, 'name');
  else ui.startAdd.focus({ preventScroll: true });
  if (copy) toast(`Payment ${index + 1} deleted.`, copy);
  else announce('Empty row deleted.');
}

function moveRow(from, to) {
  const [row] = state.rows.splice(from, 1);
  state.rows.splice(to, 0, row);
}

/** "Move up" and "Move down" in the "⋯" panel. delta: -1 or 1. */
function moveBy(id, delta) {
  const from = state.rows.findIndex(row => row.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= state.rows.length) return;
  moveRow(from, to);
  renderRows();
  const li = rowEls.get(id);
  const same = li.querySelector(`[data-row-action="${delta < 0 ? 'up' : 'down'}"]`);
  const other = li.querySelector(`[data-row-action="${delta < 0 ? 'down' : 'up'}"]`);
  revealAndFocus(same.disabled ? other : same);
  announce(`Payment moved to position ${to + 1} of ${state.rows.length}.`);
}

function toggleMore(id) {
  const open = !state.openMore.has(id);
  if (open) state.openMore.add(id); else state.openMore.delete(id);
  refreshChecks();
  if (open) rowEls.get(id).querySelector('[data-field="type"]').focus({ preventScroll: true });
}

function toggleRef() {
  state.refOpen = !state.refOpen;
  renderDebtor();
  if (state.refOpen) ui.refInput.focus();
}

function closeOpened() {
  state.opened = null;
  renderListChrome();
}

/** "Open all" opens all the FAQ answers. When all the answers are open, the button closes them. */
function toggleFaq() {
  const open = !ui.faqItems.every(item => item.open);
  ui.faqItems.forEach(item => { item.open = open; });
  renderFaqToggle();
}

function exportCsv() {
  const rows = state.rows.filter(row => !isEmptyPayment(row));
  if (!rows.length) {
    toast('There are no payments to export.');
    return;
  }
  saveFile(buildCsv(rows), fileName('csv'), 'text/csv');
  toast(`CSV file saved with ${plural(rows.length, 'payment')}. It does not include the “Pay from” data. Keep the file safe.`);
}

/* ---------- Download and problems ---------- */

/** "Download XML". If there are problems, the page shows all of them and goes to the first one. */
async function download() {
  const result = checkAll();
  if (!result.filled.length) {
    scrollToElement(ui.paymentsBlock);
    toast('Add payments first.');
    return;
  }
  if (result.errors.length) {
    state.showAll = true;
    state.errorKey = problemKey(result.errors[0]);
    renderAll();
    goTo(result.errors[0]);
    toast(`Correct ${plural(result.errors.length, 'problem')} first. To continue later, use Export CSV.`);
    return;
  }
  if (hasSample()) {
    const answer = await ask({
      title: 'This file has sample payments',
      body: ['Do not upload it to 1bank. The names and accounts in the sample data are not real.'],
      buttons: [
        { label: 'Download anyway', value: 'download' },
        { label: 'Cancel', value: 'cancel', kind: 'btn-primary', focus: true },
      ],
    });
    if (answer !== 'download') return;
  }
  downloadXml(result);
}

/** The arrows in the bottom bar. delta: -1 or 1. */
function goToProblem(delta) {
  const { errors } = checkAll();
  if (!errors.length) return;
  const keys = errors.map(problemKey);
  const at = keys.indexOf(state.errorKey);
  const next = at < 0 ? 0 : (at + delta + keys.length) % keys.length;
  state.showAll = true;
  state.errorKey = keys[next];
  renderAll();
  goTo(errors[next]);
}

/** The problem text in the bottom bar. */
function goToCurrentProblem() {
  const { errors } = checkAll();
  if (!errors.length) return;
  const item = errors[Math.max(0, errors.findIndex(error => problemKey(error) === state.errorKey))];
  state.showAll = true;
  state.errorKey = problemKey(item);
  renderAll();
  goTo(item);
}

/** "1 warning" in the bottom bar. Each click goes to the next warning. */
function nextWarning() {
  const { warnings } = checkAll();
  if (!warnings.length) return;
  const keys = warnings.map(problemKey);
  const item = warnings[(keys.indexOf(state.warnKey) + 1) % keys.length];
  state.showAll = true;
  state.warnKey = problemKey(item);
  renderAll();
  goTo(item);
}

/** A click on a correction button. The page changes only the values that the button shows. */
function applyFix(button) {
  const data = fixTargets.get(button);
  if (!data) return;

  if (data.scope === 'all') {
    const copy = snapshot();
    data.items.forEach(({ rowId, set }) => {
      const row = state.rows.find(r => r.id === rowId);
      if (row) Object.assign(row, set, { sample: false });
    });
    renderAll();
    toast(`${data.items.length} ${GROUP_NOUNS[data.field]} changed.`, copy);
    afterFix({ scope: 'row', rowId: data.items[0].rowId }, data.field);
    return;
  }

  const fix = data.fix;
  if (fix.dupOk) {
    state.dupOk.add(fix.dupOk);
    renderAll();
    announce('The page does not show this warning again for these payments.');
    return;
  }
  if (data.scope === 'debtor') {
    Object.assign(state.debtor, fix.set);
  } else {
    const row = state.rows.find(r => r.id === data.rowId);
    if (!row) return;
    Object.assign(row, fix.set, { sample: false });
  }
  renderAll();
  announce('Changed.');
  afterFix(data, Object.keys(fix.set)[0]);
}

/** After a correction: go to the next problem if the page shows all problems. Else stay in the field. */
function afterFix(target, field) {
  const { errors } = checkAll();
  if (state.showAll && errors.length) {
    const from = target.scope === 'row' ? state.rows.findIndex(row => row.id === target.rowId) : -1;
    const order = item => (item.scope === 'debtor' ? -1 : item.number - 1);
    const next = errors.find(item => order(item) >= from) || errors[0];
    state.errorKey = problemKey(next);
    renderSummary();
    goTo(next);
  } else if (target.scope === 'debtor') {
    revealAndFocus(document.getElementById(DEBTOR_FIELDS[field]));
  } else {
    focusCell(target.rowId, field === 'type' || field === 'bic' ? 'iban' : field);
  }
}

/** The CLI does the same: if one check fails, it makes no file. */
function downloadXml(result) {
  if (result.errors.length) return;
  const debtor = {
    name: state.debtor.name.trim(),
    iban: normalizeIban(state.debtor.iban),
    bic: debtorBic(state.debtor),
    execDate: state.debtor.execDate,
  };
  const payments = result.filled.map(({ row }) => cleanPayment(row));
  const name = fileName('xml');
  saveFile(buildXml(debtor, payments, batchRef(state.debtor), cyprusNow()), name, 'application/xml');
  showDone(name, payments.length, result.totalCents, debtor.execDate);
}

/** The window after the download: the values to compare in 1bank, and the upload steps. */
function showDone(name, count, cents, execDate) {
  ui.doneName.textContent = name;
  ui.doneCount.textContent = String(count);
  ui.doneTotal.textContent = money(cents);
  ui.doneDate.textContent = formatDate(execDate);
  ui.doneStep3.replaceChildren('Make sure that 1bank shows ', el('strong', '', plural(count, 'payment')), ' and ', el('strong', '', money(cents)), '.');
  closeToast();
  ui.done.showModal();
  ui.doneClose.focus();
}

/** Gives the text to the browser as a file download. The data stays on your device. */
function saveFile(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = el('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ---------- New month ---------- */

function monthIndex(word) {
  const upper = word.toUpperCase();
  const full = MONTHS.indexOf(upper);
  return full >= 0 ? full : MONTHS_SHORT.indexOf(upper === 'SEPT' ? 'SEP' : upper);
}

/**
 * The month name that most descriptions use, and the next month:
 * { from: 'SEPTEMBER', to: 'OCTOBER' }. December also changes the year:
 * { from: 'DECEMBER 2026', to: 'JANUARY 2027' }. null if no description has a month.
 */
function monthSuggestion(rows) {
  const counts = new Map();                 // month word as written → { count, years }
  rows.forEach(row => {
    const words = row.desc.split(/[^A-Za-z0-9]+/);
    const seen = new Set();
    words.forEach((word, i) => {
      if (!word || seen.has(word) || monthIndex(word) < 0) return;
      seen.add(word);
      const entry = counts.get(word) || { count: 0, years: new Map() };
      entry.count++;
      const year = /^\d{4}$/.test(words[i + 1] || '') ? words[i + 1] : '';
      if (year) entry.years.set(year, (entry.years.get(year) || 0) + 1);
      counts.set(word, entry);
    });
  });
  let best = null;
  for (const [word, entry] of counts) {
    if (!best || entry.count > best.entry.count) best = { word, entry };
  }
  if (!best) return null;

  const { word, entry } = best;
  const index = monthIndex(word);
  const list = MONTHS.includes(word.toUpperCase()) ? MONTHS : MONTHS_SHORT;
  const nextWord = matchCase(word, list[(index + 1) % 12]);
  if (index === 11) {
    const [year, times] = [...entry.years].sort((a, b) => b[1] - a[1])[0] || [];
    if (year && times * 2 >= entry.count) return { from: `${word} ${year}`, to: `${nextWord} ${Number(year) + 1}` };
  }
  return { from: word, to: nextWord };
}

/** After you open a file: the message above the list, with the suggestion for the new month. */
function showOpened(name, note) {
  const month = monthSuggestion(state.rows);
  state.opened = {
    name,
    count: state.rows.filter(row => !isEmptyPayment(row)).length,
    note,
    monthFrom: month ? month.from : '',
    monthTo: month ? month.to : '',
    monthOffer: Boolean(month),
  };
  fillMonth();
}

/** "Replace in 3 descriptions": replaces the word as a whole word, in any letter case. */
function replaceMonth() {
  const from = ui.monthFrom.value.trim();
  const to = ui.monthTo.value.trim();
  if (!from || !to || !state.opened) return;
  const pattern = wordRegex(from, 'gi');
  const copy = snapshot();
  let count = 0;
  state.rows.forEach(row => {
    const next = row.desc.replace(pattern, (match, before) => before + to);
    if (next !== row.desc) {
      row.desc = next;
      count++;
    }
  });
  if (!count) return;
  state.opened.monthOffer = false;
  renderAll();
  if (state.rows.length) focusCell(state.rows[0].id, 'amount');
  toast(`“${from}” changed to “${to}” in ${plural(count, 'description')}.`, copy);
}

/* ---------- Opening files ---------- */

async function loadFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    await notice('The file is too large', ['A payment file is much smaller than 5 MB. Make sure that you selected the correct file.']);
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch (error) {
    await notice('The page cannot read the file', ['Your browser cannot open it. Try again, or select a different file.']);
    return;
  }
  text = text.replace(/^\uFEFF/, '');                     // remove a UTF-8 byte order mark
  if (/\.xml$/i.test(file.name) || /^\s*</.test(text)) await loadXml(text, file.name);
  else await loadCsv(text, file.name);
}

/** Loads the file as it is. Only a past date moves, because the bank does not accept it. */
async function loadXml(text, name) {
  let data;
  try {
    data = readXml(text);
  } catch (error) {
    await notice('The page cannot open this file', [error.message]);
    return;
  }
  const copy = hasUserData() ? snapshot() : null;

  const today = cyprusNow().date;
  let execDate = data.debtor.execDate;
  let note = '';
  if (!isValidDate(execDate)) {
    execDate = nextBusinessDay(today);
    note = `The file had no valid date. The page uses ${formatDate(execDate)}, the next business day.`;
  } else if (execDate < today) {
    const moved = nextBusinessDay(today);
    note = `The date moved from ${formatDate(execDate)} to ${formatDate(moved)}, the next business day.`;
    execDate = moved;
  }

  resetView();
  state.debtor = {
    name: data.debtor.name,
    iban: data.debtor.iban,
    bic: BIC_RE.test(data.debtor.bic) ? data.debtor.bic : '',
    execDate,
    batchRef: data.debtor.batchRef,
  };
  state.rows = data.payments.map(payment => newPayment(payment));
  state.dupOk = new Set();
  touchDebtor();
  state.rows.forEach(touchRow);
  showOpened(name, note);
  renderAll();
  scrollToElement(ui.editor);
  if (copy) toast('The file replaced the data on the page.', copy);
}

/** A CSV file has only payments. It replaces the payments. Your "Pay from" data stays. */
async function loadCsv(text, name) {
  let data;
  try {
    data = readCsv(text);
  } catch (error) {
    await notice('The page cannot open this file', [error.message]);
    return;
  }
  if (!data.payments.length) {
    await notice('No payments found', [`${name} has no payment rows.`, ...(data.notes.length ? [data.notes] : [])]);
    return;
  }

  const copy = hasUserPayments() ? snapshot() : null;
  const keptTouched = [...state.touched].filter(key => key.startsWith('debtor.'));
  const hadDebtor = state.debtor.name.trim() !== '' || state.debtor.iban.trim() !== '';
  resetView();
  keptTouched.forEach(key => state.touched.add(key));
  state.rows = data.payments.map(payment => newPayment(payment));
  state.dupOk = new Set();
  state.rows.forEach(touchRow);
  showOpened(name, hadDebtor
    ? 'A CSV file has no “Pay from” data. The “Pay from” fields did not change.'
    : 'A CSV file has no “Pay from” data. Fill in “Pay from” above.');
  renderAll();
  scrollToElement(ui.editor);

  if (data.notes.length) {
    await notice(`${plural(state.rows.length, 'payment')} loaded`, ['Look at these lines:', data.notes]);
  }
  if (copy) toast('The file replaced the payments on the page.', copy);
}

/* ---------- Smart paste from a spreadsheet ---------- */

/** A paste of two or more cells, anywhere on the page, opens the paste preview. */
function onPaste(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (target && target.closest('dialog, #month')) return;
  const raw = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
  const text = raw.replace(/[\r\n]+$/, '');
  const inBox = Boolean(target && target.closest('#paste-box'));
  if (!text || !/[\t\r\n]/.test(text)) {
    if (inBox) {
      event.preventDefault();
      toast('Copy full rows in the spreadsheet, one row for each payment. Then paste again.');
    }
    return;                                                 // one value: the browser pastes it as usual
  }
  event.preventDefault();
  smartPaste(text);
}

const PASTE_FIELDS = ['name', 'iban', 'amount', 'desc', 'bic', 'type'];

/** Finds the columns, shows a preview, then adds the rows. */
async function smartPaste(text) {
  const delimiter = text.includes('\t') ? '\t' : text.includes(',') ? ',' : '\t';
  let lines = parseDelimited(text, delimiter).filter(cells => cells.some(cell => cell.trim() !== ''));
  if (!lines.length) return;

  const header = headerColumns(lines[0]);
  if (header) lines = lines.slice(1);
  if (!lines.length) return;
  const columns = detectColumns(lines, header || []);

  const picked = await pastePreview(lines, columns);
  if (!picked) return;

  const copy = snapshot();
  if (!hasUserPayments()) state.rows = [];                // the paste replaces the sample data
  let index = state.rows.length;                           // fill the empty rows at the end first
  while (index > 0 && isEmptyPayment(state.rows[index - 1])) index--;

  const notes = [];
  lines.forEach((cells, offset) => {
    let row = state.rows[index + offset];
    if (!row) {
      row = newPayment();
      state.rows.push(row);
    }
    let typeText = null;
    cells.forEach((value, c) => {
      const field = picked.fields[c];
      if (!field) return;
      const clean = value.trim();
      if (field === 'type') typeText = value;
      else if (field === 'iban') row.iban = normalizeIban(value);
      else if (field === 'bic') row.bic = normalizeBic(value);
      else if (field === 'amount') row.amount = (picked.fixAmounts && !AMOUNT_RE.test(clean) && suggestAmount(clean)) || clean;
      else row[field] = clean;
    });
    if (typeText !== null) row.type = typeFromText(typeText, row.iban, notes, `Payment ${index + offset + 1}`);
    touchRow(row);
  });

  renderRows();
  const first = state.rows[index];
  if (first) focusCell(first.id, 'name');
  toast(`${plural(lines.length, 'payment')} added.${notes.length ? ` ${notes.join(' ')}` : ''}`, copy);
}

/** The preview dialog. You can change the field of each column. Gives { fields, fixAmounts }, or null. */
async function pastePreview(lines, columns) {
  const width = Math.max(...lines.map(cells => cells.length));
  const selects = [];
  const table = el('table', 'preview');
  const headRow = el('tr');
  for (let c = 0; c < width; c++) {
    const th = el('th');
    const select = el('select', 'input');
    select.setAttribute('aria-label', `Field for column ${c + 1}`);
    select.append(new Option('Skip', ''));
    PASTE_FIELDS.forEach(field => select.append(new Option(FIELD_NAMES[field], field)));
    select.value = columns[c] || '';
    selects.push(select);
    th.append(select);
    headRow.append(th);
  }
  table.append(el('thead'));
  table.tHead.append(headRow);
  const body = el('tbody');
  lines.slice(0, 6).forEach(cells => {
    const tr = el('tr');
    for (let c = 0; c < width; c++) tr.append(el('td', '', (cells[c] || '').trim()));
    body.append(tr);
  });
  table.append(body);

  // Amounts with thousands separators: the page offers a correction. You must select it.
  const fixBox = el('label', 'preview-fix');
  const fixCheck = el('input');
  fixCheck.type = 'checkbox';
  const fixText = el('span');
  fixBox.append(fixCheck, fixText);

  // A field can be in one column only
  const refresh = () => {
    selects.forEach((select, c) => {
      select.classList.toggle('is-skip', !select.value);
      body.querySelectorAll(`tr > td:nth-child(${c + 1})`).forEach(td => td.classList.toggle('is-skip', !select.value));
    });
    const column = selects.findIndex(select => select.value === 'amount');
    const fixable = column < 0 ? [] : lines
      .map(cells => (cells[column] || '').trim())
      .filter(value => value && !AMOUNT_RE.test(value) && suggestAmount(value));
    fixBox.hidden = fixable.length === 0;
    if (fixable.length) {
      fixText.textContent = `Correct ${plural(fixable.length, 'amount')}: “${fixable[0]}” becomes “${suggestAmount(fixable[0])}”. The bank needs a dot for decimals and no thousands separator.`;
    }
  };
  selects.forEach(select => select.addEventListener('change', () => {
    if (select.value) selects.forEach(other => { if (other !== select && other.value === select.value) other.value = ''; });
    refresh();
  }));
  refresh();

  const wrap = el('div', 'preview-wrap');
  wrap.append(table);
  const parts = [`The page found ${plural(lines.length, 'row')}. Make sure that the field above each column is correct.`, wrap, fixBox];
  if (lines.length > 6) parts.push(el('p', 'preview-more', `The preview shows 6 rows. The page adds all ${lines.length}.`));

  const answer = await ask({
    title: 'Paste payments',
    body: parts,
    wide: true,
    buttons: [
      { label: 'Cancel', value: 'cancel' },
      { label: `Add ${plural(lines.length, 'payment')}`, value: 'add', kind: 'btn-primary', focus: true },
    ],
  });
  if (answer !== 'add') return null;
  return { fields: selects.map(select => select.value || null), fixAmounts: fixCheck.checked && !fixBox.hidden };
}

/* ==========================================================================
   10. Events and start-up
   ========================================================================== */

function rowIdOf(node) {
  return Number(node.closest('.payment').dataset.id);
}

function rowOf(node) {
  const id = rowIdOf(node);
  return state.rows.find(row => row.id === id);
}

const ACTIONS = {
  new: newFile,
  open: () => { ui.fileInput.value = ''; ui.fileInput.click(); },
  example: loadExample,
  clear: clearPayments,
  add: () => addPayment('name'),
  'export-csv': exportCsv,
  download,
  'prev-problem': () => goToProblem(-1),
  'next-problem': () => goToProblem(1),
  'current-problem': goToCurrentProblem,
  'next-warning': nextWarning,
  'edit-ref': toggleRef,
  'close-opened': closeOpened,
  'faq-toggle': toggleFaq,
  'replace-month': replaceMonth,
  'done-close': () => ui.done.close(),
  'done-new': () => { ui.done.close(); newFile(); },
};

const ROW_ACTIONS = {
  duplicate: duplicateRow,
  delete: deleteRow,
  more: toggleMore,
  up: id => moveBy(id, -1),
  down: id => moveBy(id, 1),
};

function onClick(event) {
  const fix = event.target.closest('.fix-btn, .fix-all');
  if (fix) {
    applyFix(fix);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (action && ACTIONS[action.dataset.action]) {
    event.preventDefault();
    ACTIONS[action.dataset.action]();
    return;
  }
  const rowAction = event.target.closest('[data-row-action]');
  if (rowAction && ROW_ACTIONS[rowAction.dataset.rowAction]) {
    ROW_ACTIONS[rowAction.dataset.rowAction](rowIdOf(rowAction));
  }
}

/* ---------- Pay from ---------- */

function onDebtorInput(event) {
  const field = event.target.dataset.debtor;
  if (!field) return;
  state.debtor[field] = event.target.value;
  renderDebtor();
  renderListChrome();
  renderSummary();
}

function onDebtorChange(event) {
  const field = event.target.dataset.debtor;
  if (!field) return;
  state.debtor[field] = field === 'iban' ? normalizeIban(event.target.value) : event.target.value;
  state.touched.add(`debtor.${field}`);
  renderDebtor();
  renderSummary();
}

/* ---------- Payment rows ---------- */

function onListInput(event) {
  const input = event.target.closest('[data-field]');
  if (!input) return;
  const row = rowOf(input);
  row[input.dataset.field] = input.value;
  row.sample = false;
  if (input.dataset.field === 'type') state.touched.add(`${row.id}.type`);
  refreshChecks();
  renderListChrome();
  renderSummary();
}

/** You completed a field: clean the IBAN or BIC and start to show its problems. */
function commitCell(input) {
  const row = rowOf(input);
  const field = input.dataset.field;
  if (field === 'iban') row.iban = normalizeIban(input.value);
  else if (field === 'bic') row.bic = normalizeBic(input.value);
  else row[field] = input.value;
  if (input.value !== row[field]) input.value = row[field];
  state.touched.add(`${row.id}.${field}`);
  refreshChecks();
  renderSummary();
}

function onListChange(event) {
  if (event.target.dataset.field) commitCell(event.target);
}

const GRID_FIELDS = ['name', 'iban', 'amount', 'desc'];

/** Enter goes down one row (Shift+Enter goes up), as in a spreadsheet. The arrow keys move between the row buttons. */
function onListKeydown(event) {
  const toolbar = event.target.closest('.c-actions');
  if (toolbar && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    const buttons = Array.from(toolbar.querySelectorAll('button')).filter(button => button.offsetParent !== null);
    const at = buttons.indexOf(event.target);
    let to = at + (event.key === 'ArrowLeft' ? -1 : 1);
    if (event.key === 'Home') to = 0;
    if (event.key === 'End') to = buttons.length - 1;
    event.preventDefault();
    buttons[Math.min(buttons.length - 1, Math.max(0, to))].focus();
    return;
  }
  const input = event.target.closest('input[data-field]');
  if (!input || event.key !== 'Enter' || !GRID_FIELDS.includes(input.dataset.field)) return;
  event.preventDefault();
  commitCell(input);
  const index = state.rows.findIndex(row => row.id === rowIdOf(input));
  const target = state.rows[index + (event.shiftKey ? -1 : 1)];
  if (target) focusCell(target.id, input.dataset.field);
  else if (!event.shiftKey && !isEmptyPayment(state.rows[index])) addPayment(input.dataset.field);
}

/** The row buttons are one Tab stop: the button that you used last. */
function onListFocusIn(event) {
  const toolbar = event.target.closest('.c-actions');
  if (!toolbar || event.target.tagName !== 'BUTTON') return;
  toolbar.querySelectorAll('button').forEach(button => { button.tabIndex = button === event.target ? 0 : -1; });
}

/** Drag a row by its handle. This works with a mouse, a pen or a finger. */
function onListPointerDown(event) {
  const grip = event.target.closest('.grip');
  if (!grip || event.button !== 0) return;
  const li = grip.closest('.payment');
  const items = Array.from(ui.list.children);
  const from = items.indexOf(li);
  if (items.length < 2 || from < 0) return;
  event.preventDefault();

  const scrollStart = window.scrollY;
  const tops = items.map(item => item.getBoundingClientRect().top + scrollStart);
  const heights = items.map(item => item.offsetHeight);
  const gap = parseFloat(getComputedStyle(ui.list).rowGap) || 0;
  const shift = heights[from] + gap;
  const startY = event.clientY + scrollStart;
  let pointerY = event.clientY;
  let to = from;
  let frame = 0;

  li.classList.add('is-dragging');
  ui.list.classList.add('is-reordering');
  document.body.classList.add('is-dragging');
  grip.setPointerCapture(event.pointerId);

  function layout() {
    const dy = pointerY + window.scrollY - startY;
    const center = tops[from] + heights[from] / 2 + dy;
    to = from;
    for (let i = 0; i < from; i++) {
      if (center < tops[i] + heights[i] / 2) { to = i; break; }
    }
    if (to === from) {
      for (let i = items.length - 1; i > from; i--) {
        if (center > tops[i] + heights[i] / 2) { to = i; break; }
      }
    }
    li.style.transform = `translateY(${dy}px)`;
    items.forEach((item, i) => {
      if (i === from) return;
      let offset = 0;
      if (from < to && i > from && i <= to) offset = -shift;
      if (to < from && i >= to && i < from) offset = shift;
      item.style.transform = offset ? `translateY(${offset}px)` : '';
    });
  }

  // Scroll the page when the pointer is near the top or bottom edge
  function autoScroll() {
    const edge = 80;
    const bottom = window.innerHeight - ui.bar.offsetHeight;
    let speed = 0;
    if (pointerY < edge) speed = -Math.ceil((edge - pointerY) / 5);
    else if (pointerY > bottom - edge) speed = Math.ceil((pointerY - bottom + edge) / 5);
    if (speed) {
      window.scrollBy(0, speed);
      layout();
    }
    frame = requestAnimationFrame(autoScroll);
  }

  function onMove(moveEvent) {
    pointerY = moveEvent.clientY;
    layout();
  }

  function onEnd() {
    cancelAnimationFrame(frame);
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onEnd);
    grip.removeEventListener('pointercancel', onEnd);
    ui.list.classList.remove('is-reordering');
    document.body.classList.remove('is-dragging');
    li.classList.remove('is-dragging');
    items.forEach(item => { item.style.transform = ''; });
    if (to !== from) {
      moveRow(from, to);
      renderRows();
      announce(`Payment moved to position ${to + 1}.`);
    }
  }

  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onEnd);
  grip.addEventListener('pointercancel', onEnd);
  frame = requestAnimationFrame(autoScroll);
}

/* ---------- Files: file picker, drag and drop ---------- */

function onFilePicked() {
  const file = ui.fileInput.files[0];
  if (file) loadFile(file);
}

function bindFileDrop() {
  let depth = 0;
  const hasFiles = event => event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files');
  window.addEventListener('dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth++;
    ui.drop.hidden = false;
  });
  window.addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', event => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) ui.drop.hidden = true;
  });
  window.addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    ui.drop.hidden = true;
    const file = event.dataTransfer.files[0];
    if (file) loadFile(file);
  });
}

/* ---------- Start-up ---------- */

function init() {
  const byId = id => document.getElementById(id);
  byId('no-js').remove();
  Object.assign(ui, {
    editor: byId('editor'),
    steps: byId('steps'),
    debtorBlock: byId('debtor'),
    paymentsBlock: byId('payments-block'),
    list: byId('payments'),
    rowTemplate: byId('row-template'),
    debtorName: byId('debtor-name'),
    debtorIbanInfo: byId('debtor-iban-info'),
    dateInput: byId('debtor-date'),
    dateWords: byId('debtor-date-words'),
    refText: byId('ref-text'),
    refToggle: byId('ref-toggle'),
    refField: byId('ref-field'),
    refInput: byId('debtor-ref'),
    meta: byId('payments-meta'),
    opened: byId('opened'),
    openedText: byId('opened-text'),
    month: byId('month'),
    monthFrom: byId('month-from'),
    monthTo: byId('month-to'),
    monthBtn: byId('month-btn'),
    start: byId('start'),
    startAdd: byId('start-add'),
    pasteBox: byId('paste-box'),
    sheet: byId('sheet'),
    sampleNote: byId('sample-note'),
    clearAll: byId('clear-all'),
    guide: byId('guide'),
    faqList: byId('faq-list'),
    faqToggle: byId('faq-toggle'),
    faqToggleText: byId('faq-toggle-text'),
    needsPayments: Array.from(document.querySelectorAll('[data-needs="payments"]')),
    needsData: Array.from(document.querySelectorAll('[data-needs="data"]')),
    bar: byId('bar'),
    barCount: byId('bar-count'),
    barTotal: byId('bar-total'),
    barStatus: byId('bar-status'),
    barNav: byId('bar-nav'),
    barBtn: byId('bar-btn'),
    dialog: byId('dialog'),
    dialogTitle: byId('dialog-title'),
    dialogBody: byId('dialog-body'),
    dialogActions: byId('dialog-actions'),
    done: byId('done'),
    doneName: byId('done-name'),
    doneCount: byId('done-count'),
    doneTotal: byId('done-total'),
    doneDate: byId('done-date'),
    doneClose: byId('done-close'),
    toast: byId('toast'),
    toastText: byId('toast-text'),
    toastUndo: byId('toast-undo'),
    toastClose: byId('toast-close'),
    announcer: byId('announcer'),
    drop: byId('drop'),
    fileInput: byId('file-input'),
  });
  ui.faqItems = Array.from(ui.faqList.querySelectorAll('.faq-item'));

  // The window after the download shows the same upload steps as the guide below the editor
  const doneGuide = el('ol', 'guide-sm');
  ui.guide.querySelectorAll('.guide-step').forEach((step, i) => {
    const li = el('li');
    const n = el('span', 'guide-n', String(i + 1));
    n.setAttribute('aria-hidden', 'true');
    const text = step.querySelector('p').cloneNode(true);
    li.append(n, text, step.querySelector('.shot').cloneNode(true));
    if (i === 2) ui.doneStep3 = text;
    doneGuide.append(li);
  });
  byId('done-guide').replaceWith(doneGuide);

  // The paste box: the words for a keyboard or for a touch screen
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  ui.pasteBox.placeholder = window.matchMedia('(hover: none)').matches
    ? 'Tap here, then tap Paste'
    : `Click here, then press ${mac ? '⌘V' : 'Ctrl+V'}`;

  state.debtor = emptyDebtor();
  state.rows = sampleRows();

  document.addEventListener('click', onClick);
  document.addEventListener('paste', onPaste);
  ui.debtorBlock.addEventListener('input', onDebtorInput);
  ui.debtorBlock.addEventListener('change', onDebtorChange);
  ui.list.addEventListener('input', onListInput);
  ui.list.addEventListener('change', onListChange);
  ui.list.addEventListener('keydown', onListKeydown);
  ui.list.addEventListener('focusin', onListFocusIn);
  ui.list.addEventListener('pointerdown', onListPointerDown);
  ui.monthFrom.addEventListener('input', renderMonth);
  ui.monthTo.addEventListener('input', renderMonth);
  ui.pasteBox.addEventListener('input', () => { ui.pasteBox.value = ''; });
  ui.fileInput.addEventListener('change', onFilePicked);
  ui.toastUndo.addEventListener('click', undo);
  ui.toastClose.addEventListener('click', closeToast);
  // A "toggle" event does not bubble. Thus the FAQ list gets it in the capture phase.
  ui.faqList.addEventListener('toggle', renderFaqToggle, true);
  bindFileDrop();

  // The page saves nothing. Thus it warns you before you close the tab with data in it.
  window.addEventListener('beforeunload', event => {
    if (!hasUserData()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  renderAll();
}

init();

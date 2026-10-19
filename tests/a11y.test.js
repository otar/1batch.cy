/*
 * 1batch.cy · tests/a11y.test.js
 * ---------------------------------------------------------------------------
 * Accessibility (WCAG 2.2 AA): the keyboard, the focus, screen readers,
 * colors, labels and messages. The name of each test gives the success
 * criterion (SC) that the test is for.
 *
 * Screen readers read the accessibility tree of the browser. The tests examine
 * the attributes that go into this tree (names, descriptions, live regions).
 * They do not replace a test with a real screen reader.
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

/** The contrast of two CSS colors such as "rgb(16, 24, 47)", with the WCAG formula. */
function contrast(first, second) {
  const luminance = color => {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(value => {
      const c = Number(value) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/** The accessible name of the element with the focus, or its id. */
function focusName(page) {
  return page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.id);
}

/* ---------- The message (toast) and Undo ---------- */

test('Undo has no time limit, and Ctrl+Z also undoes (SC 2.2.1)', async t => {
  const page = await site.open(t);
  await h.row(page, 1).locator('.act-delete').click();
  await page.clock.runFor(60000);
  assert.equal(await page.isVisible('#toast-undo'), true, 'Undo closed after a time.');
  assert.equal(await page.getByRole('button', { name: /^Undo (Ctrl\+Z|⌘Z)$/ }).count(), 1, 'The Undo button does not show its keys.');

  await page.keyboard.press('Control+z');
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await h.text(page, '#toast-text'), 'The change is undone.');
  assert.equal(await focusName(page), 'Beneficiary name, payment 1', 'The focus is not on the payment that came back.');
});

test('a change of data ends Undo, because Undo can only go back to the last change (SC 2.2.1)', async t => {
  const page = await site.open(t);
  await h.row(page, 1).locator('.act-delete').click();
  await page.keyboard.type('X');                        // The focus is in the name of the next payment
  assert.equal(await page.isHidden('#toast'), true);
  await page.keyboard.press('Control+z');               // Now the field undoes its own text
  assert.equal((await h.rows(page)).length, 7);
});

test('a new message keeps Undo on a second line', async t => {
  const page = await site.open(t);
  await h.fillRow(page, 1, { name: 'MY PAYEE' });       // Your data, so "Clear all" has Undo
  await page.click('#clear-all');
  assert.equal(await h.text(page, '#toast-text'), 'All payments are cleared.');

  await h.paste(page, '#paste-box', 'ANDREAS GEORGIOU');   // One value: a tip, and no change of data
  assert.equal(await h.text(page, '#toast-text'), 'Copy full rows in the spreadsheet, one row for each payment. Then paste again.');
  assert.equal(await h.text(page, '#toast-undo-text'), 'All payments are cleared.');
  await page.click('#toast-undo');
  assert.equal((await h.rows(page)).length, 8);
  assert.equal(await focusName(page), 'clear-all', 'After Undo, the focus is not on "Clear all".');
});

test('screen readers get the text of each message from the announcer (SC 4.1.3)', async t => {
  const page = await site.open(t);
  assert.equal(await page.getAttribute('#toast', 'role'), null, 'The hidden toast must not be the live region.');
  await h.row(page, 1).locator('.act-delete').click();
  await page.waitForFunction(() => document.getElementById('announcer').textContent !== '');
  // On a Mac, the page says Command+Z. WebKit in Playwright also says that it is a Mac.
  const keys = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.userAgent)) ? 'Command+Z' : 'Control+Z';
  assert.equal(await page.textContent('#announcer'), `Payment 1 deleted. To undo, press ${keys}.`);
});

test('Escape closes the message, and the focus stays where it is (SC 2.4.11)', async t => {
  const page = await site.open(t);
  await page.click('#bar-btn');
  assert.equal(await page.isVisible('#toast'), true);
  assert.equal(await focusName(page), 'debtor-name');
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#toast'), true);
  assert.equal(await focusName(page), 'debtor-name');
});

for (const size of ['desktop', 'phone']) {
  test(`${size}: Tab never puts the focus under the message or the bottom bar (SC 2.4.11)`, async t => {
    const page = await site.open(t, { size });             // With reduced motion: the test can measure at once
    await page.click('#bar-btn');                          // The message shows, and the focus goes to "Company name"
    for (let i = 1; i <= 40; i++) {
      await page.keyboard.press('Tab');
      const covered = await page.evaluate(() => {
        const node = document.activeElement;
        if (node === document.body || node.closest('#bar, #toast')) return '';
        const rect = node.getBoundingClientRect();
        const under = id => {
          const other = document.getElementById(id);
          if (other.hidden) return false;
          const box = other.getBoundingClientRect();
          return rect.bottom > box.top && rect.top < box.bottom && rect.right > box.left && rect.left < box.right;
        };
        return under('bar') ? 'the bar' : under('toast') ? 'the message' : '';
      });
      assert.equal(covered, '', `Tab ${i}: ${covered} covers the element with the focus.`);
    }
  });
}

/* ---------- Focus ---------- */

test('when an action hides its button, the focus goes to a logical place (SC 2.4.3)', async t => {
  const page = await site.open(t);

  // "Show the sample data again": the first sample payment
  await h.clearSample(page);
  await page.locator('[data-action="example"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await focusName(page), 'Beneficiary name, payment 1');

  // "This is correct": the amount of the same payment
  await h.row(page, 1).locator('.act-duplicate').click();
  await page.click('#bar-btn');                          // Shows all errors and warnings
  await h.row(page, 2).locator('.fix-btn', { hasText: 'This is correct' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await focusName(page), 'Amount, EUR, payment 2');

  // "×" in the message: back to the element that had the focus before
  await page.click('#bar-btn');
  assert.equal(await focusName(page), 'debtor-name');
  await page.locator('#toast-close').focus();
  await page.keyboard.press('Enter');
  assert.equal(await focusName(page), 'debtor-name');
});

test('after you open a file, the focus is on the message about the file (SC 4.1.3)', async t => {
  const page = await site.open(t);
  await h.openFile(page, 'old.xml', XML.replaceAll('<Dt>2026-10-19</Dt>', '<Dt>2026-10-01</Dt>'));
  await page.locator('#opened').waitFor();
  assert.equal(await focusName(page), 'opened-text');
  assert.match(await h.text(page, '#opened-text'), /The date moved from Thu, 1 Oct 2026 to Mon, 19 Oct 2026/);

  // "Close this message": the first payment, which is now in the place of the message
  await page.locator('[data-action="close-opened"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await focusName(page), 'Beneficiary name, payment 1');
});

test('the bottom bar is a region with a name, directly after the editor in the Tab order (SC 1.3.1, 2.4.3)', async t => {
  const page = await site.open(t);
  assert.equal(await page.getByRole('region', { name: 'Summary and download' }).count(), 1);
  await page.locator('.add-row').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('#bar'))), true,
    'After "Add payment", the next Tab stop is not in the bottom bar.');
});

test('the privacy note is in the header, and the file buttons are a group (SC 1.3.1)', async t => {
  const page = await site.open(t);
  assert.equal(await page.locator('header .privacy-bar').count(), 1);
  assert.equal(await page.locator('nav').count(), 0, 'A nav landmark is for links, not for buttons.');
  assert.equal(await page.getByRole('group', { name: 'File' }).count(), 1);
});

for (const size of ['tablet', 'phone']) {
  test(`${size}: "⋯" is after the description, on the screen and in the Tab order (SC 2.4.3)`, async t => {
    const page = await site.open(t, { size });
    const li = h.row(page, 1);
    const desc = await li.locator('[data-field="desc"]').boundingBox();
    const more = await li.locator('.act-more').boundingBox();
    assert.ok(more.x >= desc.x + desc.width, 'The "⋯" button is not to the right of the description.');
    assert.ok(Math.abs(more.y + more.height - (desc.y + desc.height)) <= 1, 'The "⋯" button is not on the line of the description.');
    await li.locator('[data-field="desc"]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('act-more')), true);
  });
}

test('Escape hides the bank note above the IBAN field, and the next input shows it again (SC 1.4.13)', async t => {
  const page = await site.open(t);
  const li = h.row(page, 3);
  await li.locator('[data-field="iban"]').focus();
  assert.equal(await li.locator('.iban-info').isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await li.locator('.iban-info').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'iban', 'The focus left the field.');
  await page.keyboard.press('End');
  await page.keyboard.type('1');
  assert.equal(await li.locator('.iban-info').isVisible(), true);
});

/* ---------- The bottom bar ---------- */

test('screen readers get the status of the bar only when it changes (SC 4.1.3)', async t => {
  const page = await site.open(t);
  assert.equal(await page.textContent('#bar-live'), '', 'The page is not quiet when it opens.');
  await page.evaluate(() => {
    window.liveChanges = 0;
    new MutationObserver(() => { window.liveChanges += 1; })
      .observe(document.getElementById('bar-live'), { childList: true, subtree: true, characterData: true });
  });
  await h.row(page, 1).locator('[data-field="desc"]').click();
  await page.keyboard.type(' A');
  assert.equal(await page.evaluate(() => window.liveChanges), 0, 'The status did not change, but screen readers got it again.');

  await h.fillPayFrom(page, { iban: '' });
  assert.equal(await page.textContent('#bar-live'), '1 error to correct.');
  await h.fillPayFrom(page);
  assert.match(await page.textContent('#bar-live'), /^All 8 payments pass the checks\./);
});

for (const width of [390, 320]) {
  test(`${width} px: the error link in the bottom bar is visible and not cut (SC 1.4.10, 2.4.7)`, async t => {
    const page = await site.open(t, { size: 'phone' });
    await page.setViewportSize({ width, height: 844 });
    const link = await page.locator('.bar-link').evaluate(a => ({
      text: a.textContent, width: a.getBoundingClientRect().width, cut: a.scrollWidth > a.clientWidth + 1,
    }));
    assert.equal(link.text, 'Error 1: Pay from, company name: missing');
    assert.ok(link.width > 100, `The link is only ${link.width} px wide.`);
    assert.equal(link.cut, false, 'The text of the link is cut.');
  });
}

test('the page keeps room for the real height of the bar, and a short window has a static bar (SC 1.4.10)', async t => {
  const page = await site.open(t, { size: 'phone' });
  const room = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bar-room').trim());
  const height = await page.evaluate(() => document.querySelector('.bar-in').offsetHeight);
  assert.equal(await room(), `${height}px`);

  await page.setViewportSize({ width: 844, height: 390 });  // A phone on its side
  await page.waitForFunction(() => getComputedStyle(document.getElementById('bar')).position === 'static');
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bar-room').trim() === '0px');
});

/* ---------- Colors and the focus outline ---------- */

test('fields: the placeholder, the border and the focus outline have enough contrast (SC 1.4.3, 1.4.11, 2.4.7)', async t => {
  const page = await site.open(t);
  const field = h.row(page, 2).locator('[data-field="name"]');   // Row 2 has the grey background
  const colors = await field.evaluate(input => ({
    placeholder: getComputedStyle(input, '::placeholder').color,
    border: getComputedStyle(input).borderTopColor,
    inside: getComputedStyle(input).backgroundColor,
    row: getComputedStyle(input.closest('.payment')).backgroundColor,
    amber: getComputedStyle(document.documentElement).getPropertyValue('--amber').trim(),
  }));
  assert.ok(contrast(colors.placeholder, colors.inside) >= 4.5, 'placeholder text');
  assert.ok(contrast(colors.border, colors.inside) >= 3, 'field border on white');
  assert.ok(contrast(colors.border, colors.row) >= 3, 'field border on a grey row');
  const amber = colors.amber.match(/\w\w/g).map(hex => parseInt(hex, 16)).join(', ');
  assert.ok(contrast(`rgb(${amber})`, colors.row) >= 3, 'warning border on a grey row');

  // A field with an error keeps its red border. The focus outline is navy, 2 px.
  await field.fill('');
  await field.blur();
  await field.focus();
  const outline = await field.evaluate(input => ({
    invalid: input.getAttribute('aria-invalid'),
    style: getComputedStyle(input).outlineStyle,
    width: parseFloat(getComputedStyle(input).outlineWidth),
    color: getComputedStyle(input).outlineColor,
  }));
  assert.equal(outline.invalid, 'true');
  assert.equal(outline.style, 'solid');
  assert.ok(outline.width >= 2);
  assert.ok(contrast(outline.color, colors.row) >= 3, 'focus outline');
});

// Windows contrast themes exist in Chromium browsers (Edge, Chrome) and in Firefox. WebKit has no forced colors.
test('forced colors (Windows contrast themes): a field with the focus has an outline (SC 2.4.7)', {
  skip: h.BROWSER === 'webkit' && 'WebKit has no forced colors.',
}, async t => {
  const page = await site.open(t, { forcedColors: 'active' });
  for (const selector of ['#debtor-name', '#payments [data-field="iban"]']) {
    await page.locator(selector).first().focus();
    const outline = await page.locator(selector).first().evaluate(input => ({
      style: getComputedStyle(input).outlineStyle, width: parseFloat(getComputedStyle(input).outlineWidth),
    }));
    assert.equal(outline.style, 'solid', `${selector} has no outline.`);
    assert.ok(outline.width >= 2, `${selector}: the outline is too thin.`);
  }
});

test('desktop: "⋯" always shows with 3:1 contrast, and the column names stay at the top (SC 1.4.11, 3.3.2)', async t => {
  const page = await site.open(t);
  await page.mouse.move(1, 1);
  const more = await h.row(page, 2).locator('.act-more').evaluate(button => ({
    opacity: getComputedStyle(button).opacity,
    color: getComputedStyle(button).color,
    row: getComputedStyle(button.closest('.payment')).backgroundColor,
  }));
  assert.equal(more.opacity, '1');
  assert.ok(contrast(more.color, more.row) >= 3, 'The "⋯" icon has less than 3:1 contrast.');

  await page.evaluate(() => {
    const list = document.getElementById('payments');
    window.scrollTo({ top: list.getBoundingClientRect().top + window.scrollY + 120, behavior: 'instant' });
  });
  const top = await page.locator('.sheet-head').evaluate(head => Math.round(head.getBoundingClientRect().top));
  assert.equal(top, 0, 'The column names did not stay at the top of the window.');
});

test('"New month?" names the payments that change, with a mark that is not only a color (SC 1.4.1)', async t => {
  const page = await site.open(t);
  const csv = [HEADER,
    `,ANDREAS GEORGIOU,${h.IBAN.boc},,2450.00,SALARY SEPTEMBER 2026`,
    `,ELENI CHRISTOU,${h.IBAN.boc},,2180.00,SALARY 2026`,
    `,MICHALIS IOANNOU,${h.IBAN.boc},,1960.50,BONUS SEPTEMBER 2026`].join('\n');
  await h.openFile(page, 'september.csv', csv);
  await page.locator('#month').waitFor();
  assert.equal(await h.text(page, '#month-btn'), 'Replace in payments 1 and 3');
  const marks = await page.locator('#payments [data-field="desc"]').evaluateAll(inputs => inputs.map(input => ({
    dashed: getComputedStyle(input).borderTopStyle === 'dashed',
    described: (input.getAttribute('aria-describedby') || '').split(' ').includes('will-change-note'),
  })));
  assert.deepEqual(marks, [{ dashed: true, described: true }, { dashed: false, described: false }, { dashed: true, described: true }]);

  await page.fill('#month-from', '2026');
  assert.equal(await h.text(page, '#month-btn'), 'Replace in all 3 descriptions');
});

/* ---------- Names, labels and descriptions ---------- */

test('each field in a row has only its own messages as its description (SC 1.3.1)', async t => {
  const page = await site.open(t);
  await h.addPayments(page, [{ name: 'A & B', amount: '1,5' }]);
  const description = field => h.row(page, 1).locator(`[data-field="${field}"]`).evaluate(input =>
    (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
      .map(id => document.getElementById(id).textContent).join(' | '));
  assert.match(await description('name'), /^Name error: the bank does not accept “&”\./);
  assert.match(await description('amount'), /^Amount error: /);
  assert.equal(await description('desc'), '');
});

test('the names of the fields start with their visible labels (SC 2.5.3)', async t => {
  const page = await site.open(t);
  const li = h.row(page, 1);
  await li.locator('.act-more').click();
  assert.equal(await li.locator('[data-field="bic"]').getAttribute('aria-label'), 'Beneficiary BIC, payment 1');
  assert.equal(await li.locator('[data-field="amount"]').getAttribute('aria-label'), 'Amount, EUR, payment 1');
  assert.equal(await page.getByRole('textbox', { name: 'Replace', exact: true, includeHidden: true }).count(), 1);
  assert.equal(await page.getByRole('textbox', { name: 'Replace with', exact: true, includeHidden: true }).count(), 1);
});

test('the page tells which fields are necessary (SC 3.3.2)', async t => {
  const page = await site.open(t);
  assert.equal(await h.text(page, '#debtor .block-meta'), 'All fields are necessary, except the BIC and the file reference.');
  for (const selector of ['#debtor-name', '#debtor-iban', '#debtor-date']) {
    assert.equal(await page.getAttribute(selector, 'aria-required'), 'true', selector);
  }
  for (const field of ['name', 'iban', 'amount', 'desc']) {
    assert.equal(await h.row(page, 1).locator(`[data-field="${field}"]`).getAttribute('aria-required'), 'true', field);
  }
  assert.equal(await h.row(page, 1).locator('[data-field="bic"]').getAttribute('aria-required'), null);
  assert.equal(await page.getAttribute('#debtor-ref', 'aria-required'), null);
});

test('"Pay from" has no example values in the fields, but an example below the IBAN (SC 3.3.2)', async t => {
  const page = await site.open(t);
  assert.equal(await page.getAttribute('#debtor-name', 'placeholder'), null);
  assert.equal(await page.getAttribute('#debtor-iban', 'placeholder'), null);
  assert.equal(await h.text(page, '#debtor-iban-info'), 'For example: CY17 0020 0128 0000 0012 0052 7600');
  await h.fillPayFrom(page);
  assert.equal(await h.text(page, '#debtor-iban-info'), '✓ Bank of Cyprus');
});

test('dialogs give their main text to screen readers (SC 4.1.2)', async t => {
  const page = await site.open(t);
  await h.fillPayFrom(page);
  await page.click('#bar-btn');
  await h.dialogBody(page, 'This file has sample payments');
  assert.equal(await page.evaluate(() => document.getElementById(document.getElementById('dialog').getAttribute('aria-describedby')).textContent),
    'Do not upload it to 1bank. The names and accounts in the sample data are not real.');
  const parts = await page.evaluate(() => document.getElementById('done').getAttribute('aria-describedby').split(' ')
    .map(id => (document.getElementById(id) ? id : `${id} is missing`)));
  assert.deepEqual(parts, ['done-file', 'done-nums', 'done-note']);
});

test('links and buttons say what they do (SC 2.4.4, 2.4.6, 1.3.3)', async t => {
  const page = await site.open(t);
  assert.equal(await page.getByRole('link', { name: /\(opens a larger image in a new tab\)$/ }).count(), 6);
  assert.equal(await page.getAttribute('#ref-toggle', 'aria-describedby'), 'ref-text');
  assert.match(await page.textContent('#faq'), /use the “Type, BIC and more” button \(⋯\) on the row/);
  assert.doesNotMatch(await page.textContent('#faq'), /click “⋯”/);
});

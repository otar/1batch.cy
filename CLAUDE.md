# Project notes

## Product
- Web editor that makes a Bank of Cyprus 1bank "Multiple Payments" XML file (ISO 20022 pain.001.001.09, SEPA + TBOC, one PmtInf per payment).
- Port of the CLI at https://github.com/otar/boc_payments_xml (boc_payments_xml.php). Keep the same rules, messages and XML layout.

## Hard requirements
- Plain HTML, CSS and JS only. No frameworks, no libraries, no build step. Three files: index.html, style.css, app.js. Code must be readable in View Source.
- This is a real website, not a Design Component. Do not convert it to .dc.html.
- Privacy: no network requests (CSP connect-src 'none'), no cookies, no storage of any kind, no tracking, no third-party fonts, scripts or images. Autocomplete and spellcheck are off, translate="no" on data. The privacy note must be prominent and link to the GitHub repo.
- Anonymous: no accounts. The user starts from scratch or uploads an old XML (or CSV).
- Ask clarifying questions until nothing is unclear before building.

## Decisions (round 1)
- Desktop: spreadsheet grid. Phone: cards. Typical batch: 10 to 50 payments.
- Type is auto-detected from the IBAN (CY + bank code 002 = TBOC, else SEPA), with a per-row override.
- XML upload: only files made by this site or the CLI. Load the file exactly as it is. Only a past execution date moves to the next business day, with a note.
- Input helpers: only uppercase IBAN/BIC and strip spaces. Rejected: comma decimals, auto-fix of characters, counters, IBAN grouping, auto-uppercase.
- Row actions: duplicate, drag to reorder, sort, search, select several and delete. Rejected: undo/redo.
- Extra I/O: CSV import and export (CLI format), paste from Excel/Sheets, example data. Rejected: printable summary.
- English only. Name and domain: still open (placeholders now).

## Round 2 decisions
- New look: must not resemble ipbox.cy. Candidates: Direction A - Ledger / B - Grid / C - Soft (.dc.html mockups). Pick still open.
- UX to build: (1) open straight into editor, short header, Open/New file; (2) 4 fields per payment (name, IBAN, amount, description), type as label under IBAN, BIC under "More"; (3) account check under IBAN from built-in list (country/bank, no network); (4) fixed bottom bar: count, total, one button "Show next error" -> "Download XML"; (5) smart paste: columns in any order, detect by values, preview first.
- Extras: duplicate warning (same IBAN + amount); undo for 10 s instead of confirm dialogs (delete, New file, open file, example); SHA-256 fingerprints (SRI on app.js/style.css, hashes in footer, SHA256SUMS in repo); security headers via Cloudflare Pages _headers file.
- Help/privacy text: below the editor, same page, shorter.
- ASD-STE100 (strict) for page text, messages and code comments. No README.
- Name: 1batch.cy (user kept it after the "1bank" similarity warning). Repo: otar/1batch.cy (new).
- Footer disclaimer: "Not made by, or connected to, Bank of Cyprus."
- Hosting: Cloudflare Pages (_headers file).

## Round 3 decisions (UX review)
- Users: accountants and bookkeepers (know 1bank, SEPA, BIC). One batch a month. Data: typed, pasted from Excel/Sheets, CSV from payroll software, last month's file. Monthly changes: amounts, descriptions, some payees.
- Review files: "UX Review.dc.html" (8 ranked changes, before/after mockups) and "Info Section Directions.dc.html" (1a Manual, 1b Ink band, 1c Questions). Real screenshots in review/shots/. User picks the changes, then code changes.
- Allowed: changes of any size, new flows, removal of features that do not earn their place, ideas rejected before (mark them; only as a click, never automatic).
- Copy: STE as the base. A friendlier tone is OK where strict STE sounds stiff.
- User finds too much in the editor: the "More" line, search, column sort, the type/bank line under each IBAN.
- First-visit message: one upload instead of each payment by hand; private; free and open source.
- 1bank upload guide: real 1bank screenshots as image files (exception to the three-file rule). Placeholders until the user sends screenshots and steps.
- Mockups use the current Ledger look (style.css).

## Round 3 build (done)
- User picked all 8 changes, help direction 1a Manual, all removals (search, column sort, checkboxes/Delete selected, debit BIC field), and all smaller findings.
- Built: start cards + 3 steps; one-line rows (✓ in IBAN, bank line on focus only, type tag only if set by hand, hover/focus row buttons, one Tab stop); "Download XML" always; done dialog with 1bank steps; "New month?" replace after Open; one-click fixes (Change to / Change all); shorter Pay from (date in words, file reference line); 1a info section; footer hashes.
- 1bank screenshots: placeholders in img/1bank-step-1..5.png (1600x1000). Replace with real ones, keep the names.
- SRI on style.css and app.js, hashes in footer, SHA256SUMS, _headers, LICENSE (MIT, "Otar Chekurishvili" - confirm the name).

## Round 4 (built, layout 2c Side by side)
- Copy: "Bank of Cyprus business customers" in header tagline, page title/description, step 3, FAQ "Who can use this?", footer.
- Rename "last month's file" → "old XML file" everywhere (CSV in small text).
- Page opens with the 8 example payments; "Pay from" stays empty. Banner while sample data: "This is sample data. [Clear and start]". "Clear all" always in the table header. After clear: 3 start cards.
- Download with sample data: dialog "This file has sample payments. Do not upload it to 1bank." [Download anyway] [Cancel].
- Upload guide: 6 steps. 4 = Digipass confirms upload; 5 = result in Messages, pending payments made; 6 = "[Pending Payments]" (placeholder menu name), second Digipass. img/1bank-step-6.png placeholder.
- FAQ (16 Qs, accordion) replaces Help. No numbers for cut-off, fees, limits: point to BOC website/price list/relationship manager.
- Remove footer hashes, SRI integrity attributes, and SHA256SUMS.
- Info area (round 5): three full-width blocks stacked: "Upload in 1bank" (6 steps, all visible, 3-col grid, not collapsible), "FAQ" (17 Qs accordion, no categories/filter), privacy note. Help section removed.
- Sample rows have row.sample=true until edited; hasUserData() ignores them (undo, beforeunload).
- No SRI, no footer hashes, no SHA256SUMS any more. Edits to app.js/style.css need no hash update.

## Preview tip
- The CSP meta blocks the preview tools. Test with a temporary copy without the CSP meta, then delete the copy.

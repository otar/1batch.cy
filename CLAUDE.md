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

## Repo layout
- site/ has the files that the website publishes: index.html, style.css, app.js, img/, _headers. Cloudflare Pages publishes only site/.
- CLAUDE.md and LICENSE are at the repo root. They are not on the website.
- The Claude Design handoff (chats, .dc.html review files, review/shots, uploads, support.js) is only in git history, in commit 18779ab.

## Deploy: Cloudflare Pages (live since 2026-10-14)
- Cloudflare Git integration: each push to main goes live. Other branches get preview addresses. (A Git project cannot change to Direct Upload later.)
- Pages project: name `1batch` (1batch.pages.dev), repo otar/1batch.cy, production branch main, framework none, build command empty, build output directory `site`.
- Main address: https://www.1batch.cy. Pages custom domain, DNS CNAME www → 1batch.pages.dev, proxied.
- https://1batch.cy and https://1batch.pages.dev redirect (301) to https://www.1batch.cy, with path and query. Account Bulk Redirects list `redirects_1batch` with two entries, and one rule in the account phase http_request_redirect. "Include subdomains" is off, so preview addresses (<hash>.1batch.pages.dev) do not redirect. The apex has a proxied placeholder record (AAAA 100::).
- Zone 1batch.cy: Always Use HTTPS on, minimum TLS 1.2, HSTS on (max-age 31536000, includeSubDomains, no preload), Browser Cache TTL "Respect Existing Headers", Network Error Logging off.
- Nothing may add scripts or change the HTML: Rocket Loader off, Email Obfuscation off, Automatic HTTPS Rewrites off, Web Analytics off, no Bot Fight Mode JavaScript detections.
- Web Analytics: Cloudflare turns it on by default. Turn it off in the dashboard: Web Analytics → Manage site → Disable. The zone setting "rum" says off also when the script is on. The API token cannot read it.
- Pages adds NEL and Report-To headers on www and on *.pages.dev. "! NEL" in _headers does not remove them (test on 2026-10-14). Only a zone Response Header Transform Rule can remove them on www.
- Pages sends index.html for each unknown path (there is no 404.html). Thus index.html must use root-relative URLs (/style.css, /app.js, /img/...).
- Before you change or delete a DNS record that exists, show it to the user and ask.

### Check the live site after a deploy
1. Make sure that the HTML that a browser gets is the same bytes as site/index.html: `curl -s -H 'Accept: text/html' https://www.1batch.cy/ | sha256sum`. Without "Accept: text/html", Cloudflare does not add the Web Analytics script, and the check is not correct.
2. Make sure that style.css, app.js and the images are the same bytes as site/.
3. Make sure that the headers match site/_headers.
4. Make sure that http goes to https, that the two redirects work, and that a preview address does not redirect.

### Cloudflare work later
- After the setup, the user deletes the API token. Then the start-up hook says that the token is "none found" or "NOT VALID". This is normal.
- The cloud environment "1batch deploy" has network access Custom, with these allowed domains: api.cloudflare.com, 1batch.cy, www.1batch.cy, 1batch.pages.dev, and the default list of common package managers.
- For new Cloudflare work, the user makes a new token in "1batch deploy" (env var CLOUDFLARE_API_TOKEN or a network secret for api.cloudflare.com). Permissions: Account › Cloudflare Pages › Edit, Account › Account Filter Lists › Edit, Account › Bulk URL Redirects › Edit, Zone › Zone › Read, Zone › DNS › Edit, Zone › Zone Settings › Edit. Zone resources: only 1batch.cy.
- This token cannot read Web Analytics, Bot Management, Zaraz or zone rules. The user checks them in the dashboard.
- If a push to main does not start a build, start it with the API: POST /accounts/{account_id}/pages/projects/1batch/deployments with the form field branch=main.

## Cloud sessions
- .claude/hooks/session-start.sh runs at the start of each cloud session. It shows if the site test can run, and the state of the Cloudflare API, token, zone and Pages project. If a line says BLOCKED or not found, tell the user. A missing token is normal (see "Cloudflare work later").
- Site test: node tests/smoke.js (Playwright, about 5 s). It serves site/ with the headers from site/_headers. Run it after each change to site/.
- Syntax check of the script: node --check site/app.js

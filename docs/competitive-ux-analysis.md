# 1batch.cy fills the gap that 1bank leaves

Competitive UX analysis of 1batch.cy against the Bank of Cyprus tools and the SEPA XML generators. Status: 18 October 2026.

> **Changes after this analysis.** The analysis uses commit 72f78f0 of 18 October 2026. Pull requests 6 to 10 changed `main` after this commit. These changes affect some findings:
>
> - The undo message has no timer now. "Undo" stays until the next change of data, Escape or "×". This completes R14.
> - On phones, the bar status wraps, so the error link is not cut. This completes the second part of R8, and it removes a gap in sections 3.1 and 4.3.
> - The page keeps room for the message above the bottom bar (section 4.3).
> - On desktop, the column names stay at the top of the window (section 6.1).
> - The new file `tests/a11y.test.js` has accessibility tests. This removes a limit in section 4.4. These tests can cover a part of R24.
> - The bar and the row messages say "errors", not "problems".
> - The row button "Copy" is now "Duplicate".
>
> The upload guide (R1) and FAQ 15 (R22) did not change. We did not examine the other findings again.

## Summary

We found no other tool that lets a user type, paste and correct a 1bank Multiple Payments batch with the Bank of Cyprus (BOC) rules. Other BOC-specific tools are the sibling command-line tool, a personal Sage converter, a payroll software export and an old BOC converter. Each of them converts one type of source data, and none of them has an editor. BOC gives a 35-page guide, a sample file and an XSD, but no form or template for Multiple Payments ([BOC documents page](https://www.bankofcyprus.com/en-gb/Personal/the-bank/documents/sepa--multiple-payments-files/)). Inside 1bank, the only form for many payees is the Payroll and Group Transfers beneficiary list, which accepts only SEPA payments in euro. *Inference:* the real competitors of 1batch.cy are manual entry in 1bank, the beneficiary lists and payroll software exports.

1batch.cy has the strictest privacy of all web tools that we examined, and it equals the local desktop tools without an install. Its security policy blocks all connections to servers, it keeps no data, and automatic tests enforce both rules. Of ten browser tools, only ARLing came close, with one cookieless analytics request. Five web tools send payment data to a server, by their own statement, by their page code or in our test. In our tests, Xavi Esteve, kibervarnost and XMLBridge did not do what their privacy text says.

The BOC XSD alone does not find wrong IBAN check digits, wrong totals, past dates or characters that 1bank does not accept. 1batch.cy finds these errors before the download, and no other tool that we found has one-click corrections in the row. The main gaps of 1batch.cy are scope and the accuracy of its upload guide. 1bank Multiple Payments accepts five payment types and 25 currencies, but 1batch.cy makes only SEPA and TBOC payments in euro, with one date. The upload guide uses an old menu label, a placeholder screen name and six placeholder screenshots. The page also does not explain Verification of Payee (VoP), which BOC applies from 9 October 2025.

Our first recommendations cost little: correct the upload guide, add real screenshots, explain VoP, and remove two Cloudflare headers. We recommend a new warning for a payee IBAN that changed since the last file. Payer manipulation caused 74% of the value of credit transfer fraud in the EEA in 2024 ([EBA and ECB](https://www.eba.europa.eu/sites/default/files/2025-12/1709846a-84d9-47cf-86a0-b155efb34d66/EBA%20and%20ECB%20Report%20on%20Payment%20Fraud.pdf)). In April 2025, a Cypriot company lost €642,658 after an e-mail about changed bank details ([Cyprus Mail](https://cyprus-mail.com/2025/04/28/cypriot-company-loses-over-e642000-in-online-fraud-scheme)).

## Method and limits

**What we did**

- We used public sources only. 1bank is behind a login, so we did not see the current bulk payment screens.
- On 18 October 2026, we read the BOC help pages, manuals, XML guides, sample files and XSD files.
- We validated the BOC sample, 34 changed copies of it, and the 1batch.cy golden file against the BOC XSD with xmllint.
- On 18 October 2026, we opened ten browser tools in Chromium at 1440 × 900 and 390 × 844 pixels. We used fake data only and made no accounts.
- We recorded each network request, cookie and storage entry of these tools.
- We did not install the desktop, command-line, library and Excel tools. Their facts come from vendor pages, manuals, package code and published screenshots.
- For 1batch.cy, we read the code at commit 72f78f0 and made screenshots at three widths. On the same day, the live files were the same bytes as the repository.

**Limits**

- We do not know the internet exit country of our test computer. Consent banners can be different for a visitor in Cyprus.
- We found no user reviews of any competitor tool. 1batch.cy has no usage data, by design. As a result, all statements about user preference are inferences.
- We did no accessibility audit and no keyboard test on the competitor tools.

**How to read the labels**

- A fact has a source link. "(our test)" marks a fact that we saw in our own test on 18 October 2026.
- "(vendor claim)" marks a statement of a vendor. We did no test of it.
- "(search summary)" marks a fact that comes only from a search engine summary.
- "*Inference:*" marks our own conclusion.
- "Not known", "?" and the list "What stays unknown" mark questions that the public sources do not answer.

**Dates of the bank documents**

| Document | Version and date | Use in this report |
|---|---|---|
| Multiple Payments XML guide, pain.001.001.09 | Version 13, last update 14/11/2023 | Current file rules |
| Multiple Payments sample XML and XSD, .09 | Server date 21 November 2023 | Current file rules and our XSD tests |
| Multiple Payments XML guide, pain.001.001.03 | Version 12, last update 14/01/2022 | Older document, for comparison only |
| Payroll and Group Transfers XML guide, .09 | Version 8, June 2026 | Payroll file rules |
| BOC Internet Banking Help pages, English and Greek | No date on the pages | Current menu names and steps |
| 1bank User Manual for business users | Version 6.0, 27/07/2022, with 2017 screenshots | Menu paths and screens |
| Manual for Payroll and other Multiple Payments | Edition 4, February 2017 | Background only |
| XML Conversion Tool help page and Conditions PDF | Text of 2016, PDF of 2017 | Status of the tool |
| Supplementary Agreement letter on VoP | September 2025 | VoP rules at BOC |
| SMS and APP Digipass application form | PDF of 24 November 2025 | Daily limits |

**Conflicts between sources**

| Topic | What the sources say | What this report uses |
|---|---|---|
| BOC file specification | Two BOC guides are online. The older guide is pain.001.001.03, Version 12 of 14/01/2022. The current guide is pain.001.001.09, Version 13 of 14/11/2023. An "OLD" BOC documents page still lists only the .03 files. | Version 13. We mention the .03 guide only as an older document. |
| 1bank menu path | The 1batch.cy upload guide says "Transfers & Payments › Mass Payments › Multiple Payments". The BOC help menu, the BOC service page and the 2022 manual say "Transfer & Pay". The 2017 interface used "Transfers & Payments", and one help page heading still uses it. | "Transfer & Pay › Mass Payments › Multiple Payments". A check in a live 1bank session is necessary. |
| Approval screen | The 1batch.cy upload guide uses the placeholder "[Pending Payments]". The BOC help menu says "Pending approval". The page title says "Pending for Approval". | "Pending approval" for the menu item, and "Pending for Approval" for the screen. |

**What stays unknown**

- How does 1bank apply VoP to a Multiple Payments file? Where do the results show, how does a company opt out, and does 1bank do a check on each TBOC row?
- Does 1bank show the count and the total of a Multiple Payments file before "Confirm"?
- What are the current labels and buttons of the 1bank bulk screens? All published screenshots show the 2017 interface.
- Must a user without multiple signatures also approve the uploaded payments in "Pending for Approval"?
- Does 1bank Multiple Payments accept instant payments? Which code does it expect?
- Which checks does 1bank do after the upload, and what are its message texts? Is there a limit on file size or on the number of payments?
- Does the XML Conversion Tool still operate? Its address returned HTTP 503 on 18 October 2026.
- Does 1bank add the payer address for payees in SEPA countries outside the EEA?
- Does 1bank still accept pain.001.001.03 files?

## 1. Competitor Overview

### 1.1 Products and services analyzed

We chose two groups of competitors. Fintech batch payments and other banks are not part of this analysis.

**Group A: Bank of Cyprus tools**

| Tool | What it does | Access and price | Status in October 2026 |
|---|---|---|---|
| 1bank Multiple Payments | Takes one XML file with payments of several types. Each payment becomes a separate 1bank transaction ([BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/)). | 1bank, full access to the debit account, a Digipass. BOC charges each payment (price list). | Live. *Inference:* the public flow has no change since the 2022 manual. |
| 1bank approval flow | "Pending for Approval" screen: tick the payments, then Submit, Digipass code and Confirm ([BOC help 482](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/482/)). | Part of 1bank. Roles and signatures come from signed company forms. | Live. Business users with multiple signatures can also approve in the BoC Mobile App. |
| 1bank Payroll and Group Transfers | Batches from a beneficiary list that 1bank keeps, or from an XML file. One debit line on the statement ([BOC help 956](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/956/), [BOC help 1011](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/1011/)). | Only after enrollment at the branch. Payroll is free for 1bank subscribers. | Live. File guide Version 8, June 2026. |
| BOC XML Conversion Tool | A 2016 aid. It converted 2014/15 BOC file formats to ISO 20022 XML on a bank server ([BOC help page](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/XML_Convertion_Tool_en/)). | For users of old formats, "for some period of time". | The help page is online, but no page links to the tool. Its address returned HTTP 503 (our test). |
| File made by hand | The user writes pain.001.001.09 XML from the BOC guide, sample and XSD. | Free documents. XML skills and an XSD validator are necessary. | BOC guide Version 13 of 14/11/2023. |

BOC also has B2B APIs and the Jinius platform for firms with an ERP system ([BOC B2B APIs](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/B2B_APIs/), [BOC Jinius](https://www.bankofcyprus.com/en-gb/wholesale/Digital-solutions/digitize-your-business/Jinius2/)). These routes are for large firms, so we did not analyze them in detail.

**Group B: SEPA XML generators in the browser**

| Tool | Maker and country | Price model | Account |
|---|---|---|---|
| [ARLing SEPA pain.001 Generator](https://arling.sk/sepa-pain001-generator/) | ARLing s. r. o., Slovakia. Open source. | Free up to 5,000 payments a file. Pro 79 €. File review 149 €. | No |
| [XMLBridge](https://xmlbridge.com/sepa/) | Not known. French-language site. | Demo with example data. 100 lines a month with a free account. | Optional |
| [ISO 20022 Generator](https://iso20022generator.com/en/sepa-xml-generator) | La Conciergerie Cassidaine SASU, France | Demo exports 2 lines a file. Plans from €5 to €30 a month. | For paid plans |
| [ValidateFin CSV to SEPA](https://validatefin.com/en/tools/sepa-converter) | Elni Consulting, Belgium | Free | No |
| [Xavi Esteve SEPA XML Generator](https://xaviesteve.com/pro/sepaxml/) | Individual developer, for Spanish banks | Free, with ads | No, but a captcha |
| [kibervarnost.si SEPA viewer](https://kibervarnost.si/sepaviewer/) | Slovenian security company | Free | No |
| [FreeSEPA](https://freesepa.com/) | "D-Brainiac", country not known | Free, with ads | No |
| [Mobilefish SEPA XML](https://www.mobilefish.com/services/sepa_xml/sepa_xml.php) | Site for Dutch banks, operator not known | Free, with ads | No, but a captcha |
| [fileTailored CSV to PAIN.001](https://www.filetailored.com/hubs/finance/convert/csv-to-pain001) | Privacy policy names Karnataka, India | Free | Optional |
| [EasyBankFlow](https://easybankflow.com/) | MATCHA CORP, France | 3 free conversions a month. Pro from 9 € a month. | Yes |

We also noted three services that ask for an account: [generatesepa.com](https://www.generatesepa.com/) (Spain), [sepaxml.com](https://www.sepaxml.com/) (same company as ISO 20022 Generator) and [sepaxmlgenerator.com](https://www.sepaxmlgenerator.com/). We did not use them.

**Group B: desktop, command-line, library and Excel tools**

| Tool | Type | Price | Last release |
|---|---|---|---|
| [JAM SEPA-Transfer](https://www.jam-software.com/sepa-transfer/) | Windows desktop program, Germany | From $46.80 | 11.8.2, September 2026 |
| [SEPA Generator Community and Pro](https://github.com/pierrecariou/SEPA-generator), Niryosys | Java desktop program and CLI | Community free (Apache-2.0). Pro €119 a year. | 1.4.0, August (2026 by inference) |
| [pain001](https://github.com/sebastienrousseau/pain001) | Python library and CLI | Free (Apache-2.0 or MIT) | 0.0.72, 28 September 2026 |
| [sepa.js](https://github.com/kewisch/sepa.js), [Sepa-JS-XML](https://github.com/jerebtw/Sepa-JS-XML), [php-sepa-xml](https://github.com/php-sepa-xml/php-sepa-xml) | Code libraries | Free | sepa.js 3.1.0 in September 2026. Sepa-JS-XML 3.1.1 in December 2024. |
| [VIALET PaymentsToSepa-v5.xlsm](https://vialet.notion.site/Using-the-Helper-Excel-Spreadsheet-with-CSV-Support-1c4418f30ba581b78d90f334899cfd70) | Excel macro workbook for VIALET clients | Not stated | Instruction page edited August 2025 |
| [boc-sage-to-xml-tool](https://github.com/Krispy2009/boc-sage-to-xml-tool), Cyprus | Python CLI and GUI. Sage report to BOC XML. | Free, no license stated | Updated June (2026 by inference) |
| [Codeworks PayrollPlus SEPA export](https://www.codeworks.com.cy/knowledge-base/manuals/payrollplus-manual/exports/bank-sepa-export/), Cyprus | Export in a Cypriot payroll program. One file for each bank. | Not published | Manual page of 20 July 2022 |
| [boc_payments_xml](https://github.com/otar/boc_payments_xml), baseline | Sibling PHP CLI of 1batch.cy. Same rules and same XML. | Free (MIT) | 8 commits, no releases |

### 1.2 Target audiences

1batch.cy serves accountants and bookkeepers who know 1bank, SEPA and BIC. They make one batch a month, usually 10 to 50 payments (project decisions, rounds 1 and 3).

| Tool | Main audience | Fit for 1batch.cy users |
|---|---|---|
| 1bank Multiple Payments | Customers with "many payments within or outside Cyprus". BOC expects a file from the accounting system. | High. It is the end point of each 1batch.cy file. |
| 1bank Payroll and Group Transfers | Companies that pay staff or suppliers in SEPA, after enrollment | High for salary runs. Low for mixed TBOC and SEPA batches. |
| BOC XML Conversion Tool | Users of 2014/15 BOC file formats | None today |
| File made by hand | IT staff and software vendors | Low. It is a programming task. |
| ARLing | Slovak and German bookkeepers with monthly batches | Low. No BOC rules. |
| XMLBridge, ISO 20022 Generator, ValidateFin, EasyBankFlow | French and other EU businesses | Low. No BOC rules. Small quotas at two tools. |
| Xavi Esteve, Mobilefish | Customers of Spanish and Dutch banks | Low. Rules of other countries. |
| JAM SEPA-Transfer | German SMEs and associations that bank through FinTS | Low |
| SEPA Generator | Eurozone businesses with spreadsheets, French examples | Low. No BOC rules and no grid. |
| pain001 and the libraries | Developers | Low |
| boc-sage-to-xml-tool | Its author, a Sage user | Low. One report layout. Python. |
| Codeworks PayrollPlus | Users of this Cypriot payroll program | Medium for salaries. None for suppliers. |

*Inference:* No generic tool aims at the Cyprus accountant. ARLing has the nearest audience: bookkeepers in one country with monthly batches.

### 1.3 Market positioning

The table puts each tool on two axes: knowledge of the BOC rules, and where the payment data goes.

| | Knows the BOC 1bank rules | Generic SEPA only |
|---|---|---|
| **Data stays on the device, no trackers** | 1batch.cy (also no storage). boc_payments_xml. boc-sage-to-xml-tool. | ARLing (one cookieless analytics request). SEPA Generator (daily update check, vendor claim). JAM SEPA-Transfer. pain001. VIALET Excel. |
| **Data goes to a server, or trackers load** | BOC XML Conversion Tool (bank server) | Server: XMLBridge ("Preview"), ISO 20022 Generator, EasyBankFlow, Mobilefish, Xavi Esteve. Trackers or analytics before consent: FreeSEPA, fileTailored, kibervarnost, ValidateFin. |

Of the three tools in the top-left cell, only 1batch.cy operates with no install, no build and no command line.

*Inference:* 1bank itself is not a rival of 1batch.cy. The Multiple Payments upload is the end point of each 1batch.cy file. 1batch.cy competes with the absence of a BOC form. The alternatives are manual entry in 1bank, the beneficiary lists, payroll exports and XML made by hand. Manual entry means one form and one Digipass code for each payment, because each code is specific to one transaction ([BOC transaction security](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/Transaction_Security/)).

Many "free" web tools are only trials for a batch of 10 to 50 payments. ISO 20022 Generator exports 2 lines a file without payment, and EasyBankFlow gives 3 conversions a month ([ISO 20022 Generator pricing](https://iso20022generator.com/en/pricing), [EasyBankFlow pricing](https://easybankflow.com/pricing)). 1batch.cy has no limit and no account.

### 1.4 Key differentiators

| Differentiator | 1batch.cy | Nearest competitor |
|---|---|---|
| BOC rules | Type TBOC from the IBAN (CY and bank code 002), BOC debit account, BOC character set, one PmtInf for each payment | None outside the project. No generic tool knows TBOC. |
| Privacy with a test that users can do | CSP `connect-src 'none'`, no storage, the page operates without a network | ARLing allows one analytics endpoint. |
| Corrections in the row | "Change to" and "Change all" buttons show the exact new value | SEPA Generator Pro gives suggestions in a separate report (vendor screenshot). |
| Monthly reuse | Open the XML file of last month, then "New month?" replaces the month in the descriptions | XMLBridge and kibervarnost open old files, but have no month replace. |
| Steps after the download | Upload guide and a dialog with three values to compare in 1bank | XMLBridge gives five generic upload steps. |
| Price | Free, no account, no quota | ARLing is free up to 5,000 payments a file. |

## 2. Feature Comparison

### 2.1 Feature matrix

Legend: Yes. No. Part = partly. Pro = only in the paid version. ? = not known. — = does not apply. (V) = vendor claim, with no test by us.

**Table 2a: 1batch.cy and the BOC tools**

| Feature | 1batch.cy | 1bank Multiple Payments | 1bank Payroll and Group Transfers | XML Conversion Tool | File made by hand |
|---|---|---|---|---|---|
| Main job | Makes the file in the browser | Takes the file, makes the payments | Batch from a list or a file | Converted old formats | User writes the XML |
| Account or enrollment | None | 1bank, full access, Digipass | Enrollment at the branch | Old file users (2016) | None |
| Payment data goes to | Nowhere | The bank | The bank | A bank server | Nowhere before the upload |
| Payment types | SEPA, TBOC | SEPA, TBOC, TBA, SWIF, PU | SEPA only | Old payroll and payment formats | All five types |
| Currencies | EUR | 25 currencies | EUR, and same-currency BOC accounts | — | 25 currencies |
| Dates in one file | One | One for each payment | One | — | One for each payment |
| Typed entry | Grid on a desktop, cards on a phone | No, file only | Grid in the list | No | Text editor |
| Paste or CSV | Paste with column detection, CSV | No | XML import into the list | Old formats only | No |
| Monthly reuse | Open old XML, "New month?" | No | Saved list, new amounts | No | Copy and edit by hand |
| Checks before the upload | All BOC field rules | — | Format errors at upload | Format only | XSD only |
| Error feedback | In the row, at once | Secure message after the upload | On screen at upload, later in "Response Information" | Errors at upload | Validator messages |
| Corrections | One click | Correct, then upload a new file | Correct the file or the list | Correct, then upload again | By hand |
| Totals | Count and total in a bar, CtrlSum in the file | 1bank compares NbOfTxs and CtrlSum with the payments | User types the total | — | User calculates |
| Statement lines | One for each payment (inference) | One for each payment (inference) | One debit line | — | — |
| Approval | Not part of the page | "Pending for Approval", Digipass | "Pending Approval", signatures | — | — |
| Name check (VoP) | No | ? for files | ? for files and lists | — | — |
| Instructions | 6-step upload guide, placeholder images | Help pages, 2017 and 2022 manuals | Help pages, manuals | 2016 help page | 35-page bilingual guide |

**Table 2b: 1batch.cy and the browser generators**

| Feature | 1batch.cy | ARLing | XMLBridge | ISO 20022 Generator | ValidateFin | Xavi Esteve | kibervarnost |
|---|---|---|---|---|---|---|---|
| Free limit | None | 5,000 payments a file | Demo data, or 100 lines a month | 2 lines a file | None found | None found | None found |
| Payment data to a server | No | No | On "Preview" | For the schema check (V) | No | Yes, all fields | No |
| Trackers on load | None | Cookieless Umami | Google Analytics after consent, Cloudflare beacon | Google Analytics, Google Ads | Cookieless analytics | Google Analytics, AdSense | Google Analytics, no banner |
| Payments in browser storage | No | No | Yes, autosave | Not examined | Not examined | Payer only (V) | Not examined |
| Entry | Grid, cards | Form and paste | Grid | Grid | CSV wizard | Text box | Edits old files only |
| Paste with column detection | Yes, by value | Yes | Not examined | No, fixed order | No, CSV mapping | No, fixed order | No |
| Open an old file | Yes (.09) | No | Yes | No | No | No | Yes (.03) |
| IBAN check digits | Yes | Yes | No | Yes (V) | Yes (V) | Yes | Yes |
| Error display | Message in the row, bar | Errors column, summary box | Color, counters | Notices | No message seen | List by line | Pink cell |
| One-click corrections | Yes | No | No | "Fill missing labels" only | No | No | No |
| File with errors | No file | File with a warning | File | ? | ? | No file | — |
| Output | .09, one PmtInf for each payment | .03 or .09 | .03 or .09 | .09 by default | .03 | ? | .03 |
| BOC or TBOC rules | Yes | No | No | No | No | No | No |
| Bank upload guide | 1bank, 6 steps | No | 5 generic steps | No | Tutorial | No | No |
| Phone layout | Cards | Fits | Fits | Fits | Fits | Fits | Fits |
| Open source | Yes (MIT) | Yes | No | No | No | No | No |
| Languages | English | SK, EN, DE | FR, EN, DE | 7 | ? | ? | ? |

Sources for Table 2b: our tests, and the tool pages in Section 1.1.

Four other browser tools in short:

| Tool | Summary |
|---|---|
| FreeSEPA | Form only, .03 only. The download button stays off with no message. Google trackers load at once, but the page says that data "never leaves your computer, guaranteed" (our test). |
| Mobilefish | Server processing, captcha, Dutch rules, .03 only. The XML shows on the page for a manual copy. No phone layout. |
| fileTailored | CSV with automatic mapping. Our "20,00" became 2000, and "ü" became broken text, with no warning (our test). |
| EasyBankFlow | Account before any use. Processing on servers in the EU (vendor claim). |

**Table 2c: 1batch.cy and the desktop, command-line, Excel and Cyprus tools**

| Feature | 1batch.cy | JAM SEPA-Transfer | SEPA Generator Community / Pro | pain001 | VIALET Excel | boc-sage-to-xml-tool | Codeworks PayrollPlus |
|---|---|---|---|---|---|---|---|
| Platform | Any browser | Windows | Windows, macOS, Linux | Python 3.10 or later | Excel 2019 or later, macros | Python, self-built app | Payroll program |
| Install | None | Installer | Installer | pip or Docker | Macro prompt | PyInstaller build | Part of the program |
| Price | Free | From $46.80 | Free / €119 a year | Free | Not stated | Free | Not published |
| Data leaves the device | No | No (optional FinTS upload) | Update check only (vendor claim) | No, telemetry off by default | No | No | Not documented |
| Input | Type, paste, XML, CSV | Import wizard, forms, templates | CSV or XLSX with fixed column names | CSV, JSON, SQLite | Paste into a sheet | One Sage .xlsx report | Payroll data |
| Column mapping | By value, with preview | By header names, drop-down lists | Pro only | No | No | No | No |
| Saved payees or profiles | No (old XML instead) | Yes | Pro only | No | No | Payer only | Employee data (inference) |
| Rule checks | All BOC rules | Yes, rules not public | IBAN checksum, BIC, amounts, dates | XSD validation before output | None documented | Past date only | One title rule |
| Error display | In the row | Marked records, edit form | List in a dialog. Pro: HTML report with "Suggested correction". | Exceptions | — | — | — |
| One-click corrections | Yes | No | No | No ("refused, not guessed") | No | No | No |
| BOC or TBOC rules | Yes | No | No | No | No | BOC file, version not stated | One file for each bank |
| pain.001 versions | .09 | .03, .09 | .02, .03, .09 | .03 to .12 (repository text conflicts) | Not stated | .03 (inference from its XSD) | Not stated |

Note: The columns for JAM, SEPA Generator, pain001, VIALET, boc-sage-to-xml-tool and Codeworks come from vendor pages, manuals, package code and screenshots. We did not install these tools.

### 2.2 Feature parity analysis

The table gives our assessment. It is an inference from the feature matrix.

| Area | 1batch.cy is ahead of | At parity with | Behind |
|---|---|---|---|
| Privacy | All web tools | Local desktop tools and libraries | None |
| BOC fit | All generic tools, and the XSD alone | boc_payments_xml | 1bank Multiple Payments scope |
| Entry and import | Paste in fixed order (ISO 20022 Generator, Xavi Esteve), wizards for CSV only | ARLing (automatic column detection) | JAM and SEPA Generator (.xlsx files, databases) |
| Monthly reuse | Most web tools | XMLBridge and kibervarnost (open old files) | 1bank lists and JAM (saved payees), by design |
| Rule checks | XMLBridge, VIALET, the libraries | SEPA Generator, ARLing | None |
| Errors and corrections | All tools, because of corrections in the row | ARLing (errors column) | Xavi Esteve and SEPA Generator (one full list) |
| Payment scope | Payroll and Group Transfers (SEPA only) | Most generic tools (SEPA in EUR) | 1bank Multiple Payments (5 types, 25 currencies, dates) |
| Steps after the download | All tools | None | None, but the images are placeholders |
| Phone use | All tools, and the BoC Mobile App (no bulk feature) | None | None |
| Price | Freemium tools | ARLing, ValidateFin, FreeSEPA | None |

1batch.cy leads where its users have the most risk: privacy, BOC rules and error correction. It is behind only on payment scope and on one summary list of all errors.

*Inference:* The scope gap matters only to users with SWIFT, utility, tax or own-account payments in the same monthly batch. We have no data on the number of such users.

### 2.3 Unique features

**Only in 1batch.cy**

| Feature | Why it matters | Closest thing in other tools |
|---|---|---|
| Type TBOC or SEPA from the IBAN, with an override for each row | A wrong type is an easy mistake in a mixed batch | None |
| "New month?" replace after Open | The monthly change of descriptions takes one click | XMLBridge and kibervarnost only open old files |
| "Change to" and "Change all" corrections | The user sees the exact new value and decides | SEPA Generator Pro report, with suggestions only |
| Greek to Latin correction (ELOT 743) | Greek names are common in Cyprus, and 1bank accepts only Latin characters | None found |
| No network and no storage, enforced by CSP and tests | The privacy claim is true, and users can do the test themselves | ARLing (one analytics endpoint) |
| Upload guide and the done dialog ("The file is ready") | The user compares count, total and date in 1bank | XMLBridge generic steps, SEPA Generator result tiles |
| Warning before a download with sample data | It stops an upload of fake payments | XMLBridge "Demo mode" banner |
| Same rules in a web page and a CLI | Teams can automate the same output | pain001 (generic, not BOC) |

**Features that only competitors have**

| Tool | Feature that 1batch.cy does not have |
|---|---|
| 1bank | Approval with multiple signatures, VoP at the bank, saved beneficiary lists, one statement line (Payroll), status export |
| ARLing | Bank and country profiles, automatic split into blocks by date, public API, paid file review |
| XMLBridge | Address columns, EPC QR code, XSD button, report download |
| SEPA Generator Pro | Local HTML report with a "Suggested correction" column, migration from .02 and .03 to .09 |
| JAM SEPA-Transfer | FinTS upload to German banks, VoP reports, templates, database import |
| kibervarnost | Selection of rows in an old file to make a new file |
| ISO 20022 Generator | Saved payer profiles, 7 languages, feedback form |
| pain001 | Editor diagnostics (LSP), REST server |

### 2.4 Missing features

| Feature that 1batch.cy does not have | Who has it | Value for 1batch.cy users | Conflict or note |
|---|---|---|---|
| Payment types TBA, SWIF and PU, other currencies | 1bank Multiple Payments, file made by hand | Medium, for some batches | CLI parity. More fields in the editor (R25). |
| A date for each payment | 1bank Multiple Payments, ARLing (split by date) | Low to medium | CLI parity. One date is simpler (R25). |
| Saved payee list or payer profile | 1bank lists, JAM, ISO 20022 Generator, ARLing Pro, SEPA Generator Pro | Medium | Conflicts with "no storage". The old XML file replaces it. |
| Open .xlsx files | JAM, SEPA Generator, XMLBridge | Low. Paste covers it. | The project permits no library. *Inference:* it takes much code in plain JS. |
| One list of all errors | Xavi Esteve, SEPA Generator, ARLing | Medium | None (R8) |
| Name check against the account (VoP) | 1bank (bank side), JAM (VoP reports) | High, but only a bank can do it | No network. Explain it instead (R4). |
| Instant payment request | No BOC-format tool | Not known | BOC code not public (R18) |
| Holiday calendar | None found | Low | CLI parity (R19) |
| Greek user interface | 1bank, BOC help pages | Low to medium | Conflicts with "English only" |
| Typed control total from the payroll report | 1bank Payroll "Total Amount" | Low to medium | None, as a click |
| Dark theme | FreeSEPA, SEPA Generator, ValidateFin | Low | A theme switch must remember the choice, but the page keeps no data. Only the system setting is possible. |

## 3. UX Pattern Analysis

### 3.1 Navigation patterns

| Pattern | Where | Effect for a monthly batch |
|---|---|---|
| One page with a fixed bottom bar and arrows from error to error | 1batch.cy | The main action is always in the same place. The user does not change screens. |
| Wizard: upload, preview, mapping, then the file | ValidateFin, JAM import wizard, SEPA Generator Pro | A clear order, but slow for a small change or a second run |
| Two panes: input on the left, result and errors on the right | ARLing | Errors and output show next to the input |
| One long page with numbered sections | XMLBridge | Close to 1batch.cy, with more buttons and banners |
| Upload, then results on other screens | 1bank Multiple Payments | Results come later in a secure message. Approval is on a different screen. |
| Rules spread over many documents | BOC guide, sample, XSD and help pages | The user collects the rules from about 10 pages and PDFs |

After the upload, 1bank sends a secure message with the results ([BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/)). The user opens the message with the file name and corrects the rejected payments. Then the user uploads them again in a new file. The valid payments wait in "Pending for Approval", and the "Transaction Status" screen shows their status later ([BOC help 454](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/454/)).

*Inference:* This result loop is the weakest navigation in the set. A user goes through four 1bank screens for one batch. 1batch.cy controls only the step before the upload, but its upload guide can lead the user through the other three.

1batch.cy keeps the user in one place. The bottom bar shows the count, the total and the next error, and the arrows move the focus to each error ([index.html](https://github.com/otar/1batch.cy/blob/main/site/index.html)). At 390 pixels, the bar hides the "Problem 1" link, so phone users see only the number of errors (our test).

### 3.2 Information architecture

1batch.cy puts the editor first and the instructions below it. The order of the page is:

1. Header with the name, a tagline and the file buttons
2. Privacy bar
3. Strip with three steps, which hides after the user adds payments
4. "Pay from"
5. "Payments", with the sample banner and the table
6. "Upload in 1bank", with 6 steps
7. FAQ, with 17 questions
8. Privacy note and footer

With sample data, the desktop page is about 3,614 pixels high, or about four screens. The phone page is about nine screens high. At 1440 × 900 pixels, the first view shows only 2 of the 8 sample rows, because the strip and "Pay from" use the top 650 pixels. On a phone, the first view shows no payment (our test).

BOC spreads the Multiple Payments information over help pages, two old manuals, two XML guides, sample files and XSD files. Names are different between these documents, and sometimes inside one page. The menu item is "Multiple Payments", but the heading of its help page is "Transfers & Payments - Mass Payments" ([BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/)). In Greek, the title "Πολλαπλές Πληρωμές / Προμηθευτές" (literally "multiple payments / suppliers") belongs to Group Transfers, not to Multiple Payments ([BOC help 1011, Greek](https://www.bankofcyprus.com/home-gr/Digital_Channels/Internet-Banking-Help/Functions/1011/)).

Most web competitors put the tool at the top and a long text for search engines below it (ValidateFin, kibervarnost, fileTailored). ARLing adds an "ON THIS PAGE" bar with links to "How it works", "Generator", "API", "Pro" and "FAQ".

*Inference:* The 1batch.cy order suits a user who comes back each month, because the strip hides and the editor comes first. A first-time desktop user sees explanation and setup before the data.

### 3.3 Interaction patterns

The last column gives our assessment, which is an inference.

| Pattern | 1batch.cy | Examples in other tools | Assessment |
|---|---|---|---|
| Entry | One-line rows, labeled cells, one Tab stop for the row buttons, Enter moves down | XMLBridge and ISO 20022 Generator: a box in each cell. FreeSEPA: one form row. | 1batch.cy is lighter and faster with a keyboard. |
| Paste | Detects columns by value, shows a preview and an opt-in amount correction | ARLing: automatic detection. Xavi Esteve and ISO 20022 Generator: fixed order. fileTailored: silent change of "20,00" to 2000. | 1batch.cy and ARLing lead. Silent conversion is the main risk. |
| Time of checks | After the user completes a field, or at "Download XML" | Most tools: at "Generate" | Matches "reward early, punish late" ([SIDP](https://smart-interface-design-patterns.com/articles/inline-validation-ux/)), except the first view |
| Error display | "Field: message" under the row, red border, count in the bar | ARLing: errors column and summary box. Xavi Esteve: list by line. kibervarnost: color only. FreeSEPA: nothing. | Good in the row. No full list. |
| Corrections | A button with the exact new value, and "Change all" for a group | SEPA Generator Pro: suggestion text in a report | Unique |
| Errors and the file | No file until the user corrects all errors | ARLing: file with a warning. Xavi Esteve: no file. | Same rule as the CLI. Keep it. |
| Undo and confirmation | Undo for 10 seconds. One confirmation, before a download with sample data. | NN/g: prefer undo, and use a confirmation dialog only for serious actions ([NN/g](https://www.nngroup.com/articles/confirmation-dialog/)) | Good. The 10-second limit is a WCAG timing issue. |
| Sample data | 8 sample rows at first load, a banner, a warning dialog | XMLBridge: example data and a "Demo mode" banner | Good, but the bar shows 2 errors before any action |
| Control totals | Count and total in the bar, three values in the done dialog | SEPA Generator: three result tiles. ISO 20022 Generator: "Rows" and "Total" bar. 1bank Payroll: typed total. | Good. The total leaves out invalid amounts without a note. |
| Reorder | Drag handle, and "Move up" and "Move down" | XMLBridge: drag handle | Good. The buttons give the option without a drag that WCAG 2.5.7 asks for. |

### 3.4 Visual design approach

| Tool | Look | Notes |
|---|---|---|
| 1batch.cy | "Midnight": navy bands, white cards on a light gray page, one lime accent | System fonts. Monospace for IBANs and amounts. No dark theme. |
| ARLing | Dark "terminal" look, orange accent, monospace | Dense. A long list of mapping selects. |
| XMLBridge | Dark navy, neon green and blue, emoji icons | French and English labels mixed |
| ISO 20022 Generator, ValidateFin, EasyBankFlow | Light software-service look with blue accents and cards | Clean, with marketing sections |
| Mobilefish, Xavi Esteve | Old layouts with ads | Xavi Esteve has a blank ad space of about 300 pixels under the header. |
| kibervarnost | Blue header, wide table with 16 columns | The table cuts off the cell text |
| SEPA Generator | Minimal desktop window, light and dark themes | Three result tiles |
| JAM SEPA-Transfer | Dense Windows ribbon and grids | A color and a total for each transaction type |
| 1bank | Public screenshots show the 2017 interface | The current interface is not public |

*Inference:* The 1batch.cy look reads as a finance tool, not as a copy of a bank. Monospace IBANs and right-aligned amounts give the cues of precision that accountants expect.

### 3.5 Content strategy

| Tool | Tone and honesty | Languages |
|---|---|---|
| 1batch.cy | Short STE sentences. Privacy in three places. "Not made by Bank of Cyprus" in three places. No numbers for fees, cut-off times or limits. | English |
| BOC documents | Technical, for IT staff. English and Greek in the same table cells. Copy errors, for example "Rabobank accepts the following characters". | English, Greek |
| ARLing | Specific and honest: a clean check "does not guarantee" that the bank accepts the payment (Slovak text, our translation) | SK, EN, DE |
| ISO 20022 Generator | Overclaim: "Is the generated file accepted by all banks? Yes." | 7 languages |
| FreeSEPA | Privacy "guaranteed", but trackers load at once. A broad waiver of claims. | English |
| Xavi Esteve | Clear amount examples with ✅ and ❌ marks | English (others not examined) |
| kibervarnost, fileTailored | Text with many keywords for search engines | Not examined |
| XMLBridge | Banner about the address deadline, generic upload steps | FR, EN, DE, mixed |

*Inference:* The 1batch.cy copy is the most precise in the set. It has three weak points:

1. The upload guide uses an old menu label and the placeholder "[Pending Payments]".
2. The page does not mention VoP, but VoP now affects each SEPA payee name.
3. FAQ 15 uses "would", which strict STE does not allow.

## 4. Strengths and Weaknesses

### 4.1 What each competitor does well

| Tool | Strengths |
|---|---|
| 1bank Multiple Payments | Accepts five payment types and 25 currencies in one file. Several files a day. Dates up to 6 months ahead. Search of results by file name or EndToEndId. |
| 1bank approval flow | Four-eyes control with roles and signatures. Approval of a full page in one step. A filter by file. Approval in the mobile app. |
| 1bank Payroll and Group Transfers | Saved lists, so only amounts change each month. The file content shows on screen before Submit. One statement line. Payroll is free. |
| BOC documents | Complete field tables, a sample, and an XSD that a validator can use |
| ARLing | Strict CSP, open source, automatic column detection, honest warnings, errors column, bank profiles |
| XMLBridge | Rich grid, opens old pain.001 files, XSD button, generic upload steps |
| ISO 20022 Generator | Polished grid, .09 by default, saved payer profiles, 7 languages |
| ValidateFin | Clear wizard with a preview, sensible defaults, consent banner |
| Xavi Esteve | Fastest path from a spreadsheet, list by line with OK, warning and error counts |
| kibervarnost | Opens an old file in a table, IBAN check on demand, Excel export |
| JAM SEPA-Transfer | Full desktop set: import wizard, templates, reuse of bookings, VoP reports |
| SEPA Generator | Free and open source, all errors in one list, summary tiles, clear privacy text |
| pain001 | XSD validation before output, a "refused, not guessed" policy, many versions |
| boc-sage-to-xml-tool | One step from a Sage report to a BOC file |
| Codeworks PayrollPlus | One file for each bank, from the payroll data |

### 4.2 Pain points and weaknesses

| Tool | Weaknesses and pain points |
|---|---|
| 1bank Multiple Payments | No form, only a file. Results come later in a secure message. 1bank accepts the valid payments, so the rejected ones must go in a new file. No public preview before "Confirm". |
| 1bank approval flow | *Inference:* one row for each payment of a Multiple Payments file. If not all approvers act by the end of the execution date, the payments expire. |
| 1bank Payroll and Group Transfers | SEPA in euro only. Enrollment at the branch. List codes of 7 characters and descriptions of 10, with no symbols. The user types the total. No documented export of a list. |
| BOC XML Conversion Tool | Only 2014/15 formats. Format checks only. Data goes to a bank server. No public link today. |
| BOC documents | 35 landscape pages for IT staff. Guide, sample and XSD do not agree. The sample has no SEPA payment and has invalid IBANs. Appendix C appears two times. |
| ARLing | Slovak and German focus. Dense look. Profiles, templates and history cost money. |
| XMLBridge | Marks an IBAN with wrong check digits as valid and exports it. Cuts names at 70 characters without a message. Sends the XML to its server on "Preview". Saves payments in the browser, and its policy does not say so. |
| ISO 20022 Generator | The demo exports only 2 lines. Fixed paste order. Schema check on its server. Google Ads on load. Overclaim about banks. |
| ValidateFin | CSV only. No visible message for absent mappings. .03 only. |
| Xavi Esteve | Fixed column order with tabs. Sends all data to its server, but the page says "in your browser". Ads and a captcha. |
| kibervarnost | .03 only. Double-click to edit. Wide table with cut-off text. Google Analytics without consent, against its own policy. |
| FreeSEPA | No import. The download button stays off with no reason. Google trackers load at once, next to a "guaranteed" privacy claim. |
| Mobilefish | Server processing, captcha, Dutch rules, no phone layout, content from 2013 and 2014 |
| fileTailored | Reads "20,00" as 2000. Breaks "ü". No SEPA checks seen. |
| EasyBankFlow | Account before any use. 3 free conversions a month. Server processing. |
| JAM SEPA-Transfer | Windows only, paid, German banking focus. Saved import settings keep passwords as plain text. |
| SEPA Generator | Fixed column names in Community. Mapping, profiles and XSD only in Pro. The error dialog has only "Close". No bank profiles. |
| pain001 and the libraries | For developers only. Sepa-JS-XML does not check payee IBANs and cannot make .09 files. |
| VIALET Excel | Macros, Excel 2019 or later, four fields, no documented checks |
| boc-sage-to-xml-tool | One report layout, a Python build, a past-date check only, probably .03 |
| Codeworks PayrollPlus | Salaries only. Format not documented. |

### 4.3 User experience gaps

**Gaps in the market**

| Gap | Evidence | Who closes it today |
|---|---|---|
| No current illustrated guide for the 1bank Multiple Payments flow | The newest illustrated BOC manual is from 2022, with 2017 screenshots ([2022 manual](https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/left-menu/1bank_companies_eng_final.pdf)) | Nobody. 1batch.cy has the text, but placeholder images. |
| No instructions to prepare payee names for VoP | The BOC VoP page and the bulk help pages do not mention files ([BOC VoP](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/verification-of-payee/)) | Nobody |
| No warning for a payee IBAN that changes between months | Fraud data, and the BOC advice for changes of payee details: "Confirm such requests" ([BOC instant payments](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/instant-payments/)) | Nobody |
| No safe path to send only the rejected payments again | 1bank accepts the valid payments of a file ([BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/)) | 1batch.cy explains it in FAQ 15 |
| No bulk preparation on a phone | The BoC Mobile App lists no bulk feature ([BoC Mobile App](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/digital-banking/BoC_MobileApp/)) | 1batch.cy, with cards |
| No tool knows TBOC | Keyword scan of all web tools, GitHub search (our test) | 1batch.cy and its CLI |

**Gaps in 1batch.cy**

| Gap | Evidence |
|---|---|
| The bar shows "2 problems to correct" before the user does anything | First load with sample data, at all three widths (our test) |
| The phone bar hides the "Problem 1" link | phone-01-first-view.png |
| The paste preview on a phone shows about 2 columns and scrolls sideways | phone-06-paste-preview.png |
| The touch layout shows keyboard text: "Tab goes to the next cell" and "or drop it here" | phone-05-start-cards.png |
| The total leaves out invalid amounts without a note: "7 payments €1,899.00" with two comma amounts | desktop-08-row-errors.png |
| Only 2 of the 8 sample rows show in the first desktop view | desktop-01-first-view.png |
| The undo toast covers a part of the content above the bar | desktop-08-row-errors.png |
| The date field shows the format of the browser, but the text under it uses English words | desktop-01-first-view.png |
| An old file with SWIF, PU or TBA codes loads as SEPA or TBOC without a note | `readXml()` in [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) |

### 4.4 Technical limitations

**1batch.cy**

| Limitation | Effect | Source |
|---|---|---|
| SEPA and TBOC only, EUR only | SWIFT, utility, tax and own-account payments stay manual in 1bank | [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) |
| One debit account and one date in each file | Users with two dates make two files | [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) |
| The business-day rule knows only weekends | A holiday date passes without a note | [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) |
| A bank list of 40 codes in 10 countries | It is only a hint. Cypriot banks other than BOC and Hellenic Bank show only "Cyprus · SEPA". | [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) |
| No byte comparison with the CLI | FAQ 5 says "the same XML", but no test proves it | [tests](https://github.com/otar/1batch.cy/tree/main/tests) |
| No automatic accessibility tests | A regression can stay unseen | [tests](https://github.com/otar/1batch.cy/tree/main/tests) |
| Cloudflare adds the NEL and Report-To headers | The browser can send network error reports to Cloudflare | Live headers, 18 October 2026 (our test) |

**BOC and competitors**

| Limitation | Effect | Source |
|---|---|---|
| The BOC XSD does not find wrong check digits, wrong totals, past dates, duplicate IDs or Greek letters | A file that passes the XSD can still fail in 1bank | [BOC XSD](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/pain.001.001.09.xsd) (our test) |
| The BOC guide and the XSD do not agree on name lengths, CtrlSum and the BIC tag | A user who obeys the guide can make a file that fails the XSD | [BOC guide v13](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf) (our test) |
| 1bank sends the results of its checks in a secure message after the upload | Errors show late | [BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/) |
| BOC takes the BIC from the IBAN. If BOC cannot find a BIC, it rejects the payment. | The BIC field has little value for SEPA payments | [BOC guide v13](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf) |
| Server tools do not operate without a network, and often ask for an account or have a quota | No offline use, and data leaves the office | Our tests |

## 5. Opportunities

The needs in this section come from the evidence in sections 1 to 4. The value ratings are our inferences.

### 5.1 Underserved user needs

| Need | Evidence | Served today? |
|---|---|---|
| Make a mixed TBOC and SEPA batch without IT staff | BOC: "The files must be exported from your accounting system" ([2017 manual](https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/right-menu/internet_banking_help/manual--for-payroll-and-multiple-payments.pdf)) | Only by 1batch.cy |
| Know before the upload that 1bank accepts the file | 1bank results come by secure message after the upload | Partly, by 1batch.cy |
| Send only the rejected payments again, with no double payment | 1bank accepts the valid payments of a file | Only FAQ text |
| Use the payee name that the bank of the payee holds | VoP from 9 October 2025, with four outcomes | Nobody |
| See a changed IBAN before the payment | Payer manipulation is 74% of the value of credit transfer fraud | Nobody |
| Follow the bank steps after the download | No current illustrated BOC guide | 1batch.cy, with placeholder images |
| Prepare a batch on a phone | The BoC Mobile App has no bulk feature | 1batch.cy cards |
| Keep salaries private on the statement | Multiple Payments gives one statement line for each payment (inference) | Only 1bank Payroll |

### 5.2 UX improvements we can make

| Improvement | Where | Recommendation |
|---|---|---|
| Correct the menu path, the approval screen and the Digipass text | Upload guide and done dialog | R1 |
| Put the comparison of totals where 1bank shows them | Upload guide and done dialog | R2 |
| Real, dated screenshots | Upload guide | R3 |
| VoP explanation and a name hint | Upload guide, FAQ, name messages | R4 |
| No red errors before the first user action | Bottom bar | R6 |
| One list of all errors, and the error link on phones | Bottom bar | R8 |
| A note for amounts that the total leaves out | Bottom bar | R9 |
| An undo toast with no fixed time limit | Toast | R14 |
| A card preview for paste, and touch text on touch screens | Phone layout | R15 |
| Greek 1bank labels in brackets | Upload guide | R16 |

### 5.3 Feature gaps to fill

| Gap | Value | Effort | Recommendation |
|---|---|---|---|
| Warning for a changed IBAN or a new payee after Open | High | M | R7 |
| Clear result for unknown payment types on Open | Medium | S | R10 |
| Total for each payment type, to compare with daily limits | Medium | S | R13 |
| XSD validation and a CLI comparison in CI | Medium | M | R17 |
| Holiday notes | Low | M | R19 |
| A file with one payment from a row, for a rejected payment | Low | M | R23 |
| More payment types and dates | Low until users ask | L | R25 |

### 5.4 Design patterns to adopt or avoid

**Adopt**

| Pattern | Source | How 1batch.cy can apply it |
|---|---|---|
| Error summary with a link to each field, in the same words as the field message | [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/) | A list behind the error count in the bar (R8) |
| "Reward early, punish late" | [SIDP](https://smart-interface-design-patterns.com/articles/inline-validation-ux/), [Baymard](https://baymard.com/blog/inline-form-validation) | No errors before the first action (R6) |
| A line about the limits of the checks | ARLing, pain001, SEPA Generator | One sentence in the done dialog (R12) |
| All errors together | SEPA Generator 1.4.0 | Done in the rows. Add the list (R8). |
| A total for each type | JAM export dialog | SEPA and TBOC totals in the done dialog (R13) |
| The old file as the template | XMLBridge, kibervarnost | Done. Add the changed-IBAN warning (R7). |
| A check of name and IBAN at the time that the user adds a payee | [ABE blog on bulk VoP](https://www.abe-eba.eu/2025/09/05/implementing-vop-for-bulks-the-nightmare-before-halloween/) | Warning for new or changed payees (R7) |

**Avoid**

| Anti-pattern | Seen at | 1batch.cy status |
|---|---|---|
| Silent change of data (truncation, comma conversion) | XMLBridge, fileTailored | Avoided. Corrections are clicks. |
| A "valid" result from the XSD for a wrong IBAN | XMLBridge | Avoided. Rule checks come first. |
| A disabled button with no reason | FreeSEPA | Avoided. "Download XML" explains the errors. |
| Privacy claims that the page does not keep | Xavi Esteve, kibervarnost, XMLBridge | Avoided, but remove the NEL headers (R5) |
| Autosave of payment data in the browser | XMLBridge | Avoided by the no-storage rule |
| "Free" with a very small quota | ISO 20022 Generator, EasyBankFlow | Avoided |
| Overclaims about bank acceptance | ISO 20022 Generator | Avoided. Add the line about limits (R12). |
| Text with many keywords for search engines | kibervarnost, fileTailored | Avoided |
| Captcha, ads, a block on zoom | Mobilefish, Xavi Esteve, generatesepa.com | Avoided |
| Manual entry of a total with no check | 1bank Payroll (2017 manual) | Avoided. 1batch.cy calculates CtrlSum. |

## 6. Best Practices

### 6.1 Patterns worth emulating

| Pattern | Source | 1batch.cy status |
|---|---|---|
| Show an error summary for each error, link each error to its field, and use the same words | [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/) | Partly. Arrows and one link in the bar. |
| Do not show an error before the user completes the field. When the user corrects the field, remove the error at once. | [Baymard](https://baymard.com/blog/inline-form-validation), [NN/g](https://www.nngroup.com/articles/errors-forms-design-guidelines/) | Yes, except in the first view |
| Accept formats that are not ambiguous, and ignore spaces from a paste | [GOV.UK validation pattern](https://design-system.service.gov.uk/patterns/validation/) | Yes for IBANs. Comma amounts only as a click. |
| Say what went wrong and how to correct it | [GOV.UK error message](https://design-system.service.gov.uk/components/error-message/) | Yes |
| Prefer undo to a confirmation dialog. Show a confirmation dialog only for serious actions. | [NN/g](https://www.nngroup.com/articles/confirmation-dialog/) | Yes |
| Map columns with suggestions, show a preview, correct in place, flag duplicates, show a final summary | [SIDP bulk import](https://smart-interface-design-patterns.com/articles/bulk-ux/), [OneSchema](https://www.oneschema.co/blog/building-a-csv-uploader) | Yes |
| Empty states that teach and give direct paths | [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/) | Yes, with three start cards |
| Keep the header row visible in a long table | [NN/g data tables](https://www.nngroup.com/articles/data-tables/) | Not examined |

### 6.2 Innovative approaches

| Approach | Where | Comment |
|---|---|---|
| "New month?" replace, and Enter from amount to amount | 1batch.cy | Fits the monthly job. No other tool has it. |
| Offline test of the privacy claim ("turn off Wi-Fi") | 1batch.cy | Users can see the evidence for the claim |
| One-click corrections that show the exact new value | 1batch.cy | The user keeps control of the data |
| File made, with an honest warning and an errors column | ARLing | Good words. 1batch.cy keeps its block rule. |
| Local HTML report with a "Suggested correction" column | SEPA Generator Pro | A good model for one list of all errors |
| Selection of rows in an old file to make a new file | kibervarnost | Close to the need for a file with only the rejected payment (R23) |
| "Refused, not guessed" for IBANs, BICs and amounts | pain001 | Same idea as "only as a click" |

### 6.3 Industry standards

| Standard | Status in October 2026 | Effect on 1batch.cy |
|---|---|---|
| BOC Multiple Payments guide, pain.001.001.09, Version 13 | Current from November 2023 ([BOC guide v13](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf)) | 1batch.cy follows it. Its golden file validates against the BOC XSD (our test). |
| EPC SCT customer guide 2025 | In force from 5 October 2025. Latin character set, names of 70 characters ([EPC](https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2024-11/EPC132-08%20SCT%20C2PSP%20IG%202025%20V1.0.pdf)). | 1batch.cy uses the same set and the stricter BOC limit of 35 |
| VoP, Regulation (EU) 2024/886 | In force in the euro area from 9 October 2025 ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R0886)) | Unless the company opts out, the bank compares each SEPA payee name with the account (R4) |
| Bulk VoP opt-out for non-consumers | Only for packages. A pain.001 with one payment is not a package ([Commission Q&A 33 and 138](https://finance.ec.europa.eu/document/download/f597b1a5-2a7b-481d-882c-80fb1c5cc3d5_en?filename=instant-payments-implementation-questions-answers_en.pdf)). | Affects the advice to send a new file with one payment (R4, R23) |
| Instant payments in packages | Where banks accept packages, they must also accept instant payments in packages (Art. 5a(7)) | BOC code not known (R18) |
| EPC rules for postal addresses | Unstructured addresses rejected from 15 November 2026 ([EPC153-22](https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC153-22%20v2.1%20EPC%20guidance%20document%20-%20Provision%20of%20Addresses%20under%20the%20EPC%20Payment%20Schemes.pdf)) | No effect. 1batch.cy writes no address (R18). |
| European Accessibility Act and EN 301 549 | EAA from 28 June 2025. EN 301 549 v4.1.1 with WCAG 2.2 published 2 September 2026 ([Level Access](https://www.levelaccess.com/compliance-overview/en-301-549-compliance/)). | *Inference:* probably outside the legal scope. WCAG 2.2 AA is still the right bar (R14, R24). |
| CSP `connect-src` | Main browsers apply it from 2016 ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)) | 1batch.cy uses `'none'` |
| EDPB Guidelines 2/2023 | Adopted 7 October 2024 ([EDPB](https://edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)) | Local processing that stays on the device is not "access". *Inference:* no consent banner is necessary. |

### 6.4 Emerging trends

| Trend | Dates | Meaning for 1batch.cy |
|---|---|---|
| VoP for bulk files, with opt-out at file or service level | From October 2025. BOC details not public ([ABE note](https://www.abe-eba.eu/wp-content/uploads/2025/06/eba_20250523_vop_for_bulks_key_challenges_and_pain_points.pdf)). | Name quality in the file matters more each month |
| Fraud by manipulation of the payer | 74% of the value of credit transfer fraud in 2024 ([EBA and ECB](https://www.eba.europa.eu/sites/default/files/2025-12/1709846a-84d9-47cf-86a0-b155efb34d66/EBA%20and%20ECB%20Report%20on%20Payment%20Fraud.pdf)) | Warnings for changed IBANs add value without a network |
| Wider IBAN-name check (PSR) | Provisional agreement November 2025. Application expected late 2027 to 2028 ([Norton Rose Fulbright](https://www.nortonrosefulbright.com/en/knowledge/publications/cedd39c6/psd3-and-psr-from-provisional-agreement-to-2026-readiness)). | The name check spreads to all credit transfers |
| Instant payments in files | Where banks accept packages, they must accept instant packages too | A later option, after BOC publishes its code |
| Structured postal addresses | 15 November 2026 | No effect until 1batch.cy adds addresses |
| WCAG 2.2 in EN 301 549 v4.1.1 | Published 2 September 2026 | Rules for focus, target size and timing apply to the grid and the toasts |
| Local-first, checkable privacy | Many competitors now say "in your browser" ([Ink & Switch](https://www.inkandswitch.com/essay/local-first/)) | Claims are common, so evidence matters (R5) |
| pain.001.001.09 as the default | ISO 20022 Generator and SEPA Generator use .09 by default | 1batch.cy already makes .09 |

## 7. Recommendations

This section gives our conclusions. They are inferences from the facts in sections 1 to 6.

### 7.1 What to learn from competitors

| Lesson | From | Apply as |
|---|---|---|
| Say plainly what a clean check does not prove | ARLing, SEPA Generator, pain001 | One line in the done dialog (R12) |
| Show all errors in one list | Xavi Esteve, SEPA Generator | A list behind the error count (R8) |
| Show a total for each payment type | JAM SEPA-Transfer | SEPA and TBOC totals (R13) |
| Keep payees for reuse | 1bank lists, JAM SEPA-Transfer | Do not store. Make "open old XML" safer with the changed-IBAN warning (R7). |
| Explain the bank upload with the real screens | XMLBridge (generic), BOC manuals (old) | Real, dated 1bank screenshots (R3) |
| Show errors next to the data | ARLing errors column | Done in the row |

### 7.2 What to avoid

| Avoid | Reason | Rule for 1batch.cy |
|---|---|---|
| A file with errors ("download anyway") | It breaks CLI parity, and bad files reach 1bank | Keep "no file with errors" |
| Automatic corrections | Silent changes at XMLBridge and fileTailored | Corrections only as a click (round 3 rule) |
| Saved payees, autosave, profiles | Privacy risk on shared office computers | Keep "no storage". Use the old XML file. |
| Analytics, also without cookies | ARLing and ValidateFin send usage requests | Keep "no tracking". Ask users directly (R20). |
| New fields in the main row | The round 3 review found the editor too full | Put new options behind "⋯" or a click |
| An "Instant" option before BOC publishes its code | A wrong code can cause a rejection of the full file | Wait (R18) |
| Search, column sort or a printable summary again | Removed in round 3, or rejected in round 1 | Only as a click, and only with user evidence |

### 7.3 Differentiation opportunities

**Own the steps after the download.** The largest pain of a 1bank user starts after the upload: a late secure message, partial acceptance, approval and VoP. No competitor explains these steps for 1bank, and BOC has no current illustrated guide. A correct upload guide with real screenshots, the VoP outcomes and the rule for rejected payments can make 1batch.cy the reference for the full flow.

**Add safety that operates without a network.** A warning for changed IBANs and new payees uses only the opened file and the current rows. No competitor has it, and it answers the largest type of credit transfer fraud in the EU.

**Make the privacy claim true at each layer.** 1batch.cy is already the strictest web tool. The removal of the NEL and Report-To headers closes the last gap between the claim and the HTTP responses.

**Be the honest guide to the BOC options.** An FAQ entry that compares Multiple Payments with Payroll helps users choose. It also shows that 1batch.cy is on the side of the user, not of one product.

### 7.4 Strategic recommendations

1. Stay narrow: one bank, one file type, one monthly job. No generic tool knows TBOC, so depth is the advantage.
2. Correct the bank facts first. If the 1bank steps on the page do not match the 1bank screen, users do not trust the page.
3. Grow safety before scope. Warnings that use local data (changed IBANs, names for VoP) come before new payment types.
4. Decide on scope with evidence from users. Ask users through a contact link before L-size work on SWIFT, utility or tax payments.
5. Watch these four events:
   - new BOC rules for VoP in files
   - 15 November 2026, the end of unstructured addresses
   - BOC rules for instant payments in packages
   - EN 301 549 v4.1.1 in the Official Journal of the EU

**Ranked recommendations**

| Rank | Priority | Recommendation | Effort | Evidence | Conflict with hard requirements or rejected ideas |
|---|---|---|---|---|---|
| R1 | High | Correct the upload guide. Use "Transfer & Pay › Mass Payments › Multiple Payments" and "Pending approval". Say that 1bank asks for the first Digipass code "if required". Make sure in a live 1bank session that each label and button name is correct. | S | [BOC help menu](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/menu/TransfersAndPayments/), [BOC help 482](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/482/), [BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/), [2022 manual](https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/left-menu/1bank_companies_eng_final.pdf) | None |
| R2 | High | Find where 1bank shows the count and the total, and move "Compare the totals" to that step. Tell users to open the message with the file name. In step 6, tell users to filter by file. Also tell them to approve before the end of the execution date. | S | No preview step in [BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/). File filter and expiry in [BOC help 482](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/482/) and [BOC help 454](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/454/). | None. No numbers for cut-off times. |
| R3 | High | Replace the six placeholder images with real 1bank screenshots. Use fake or masked data, and show the date of each screenshot. | M | All six images are placeholders (desktop-11-upload-guide.png). The newest BOC illustrated manual is from 2022, with 2017 screens. | None. Images are the allowed exception to the three-file rule. |
| R4 | High | Explain VoP in the upload guide and the FAQ. Give the four outcomes. Tell users to use the name on the payee account. After a "Close match", tell users to copy the correct name into the row. Say that a file with one payment cannot use the bulk opt-out. | S | [BOC VoP](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/verification-of-payee/), [BOC VoP letter](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/psd/eng/2025/supplementary-agreement-customer-informative-letter_september-2025.pdf), [Commission Q&A 33, 92, 100, 104, 138](https://finance.ec.europa.eu/document/download/f597b1a5-2a7b-481d-882c-80fb1c5cc3d5_en?filename=instant-payments-implementation-questions-answers_en.pdf), [ABE matching note](https://www.abe-eba.eu/wp-content/uploads/2025/09/EBA_20250925_Key_Challenges_for_VOP_Matching_Checks.pdf) | None. Text only, no network. Say that the 1bank display of VoP for files is not public. |
| R5 | High | Remove the NEL and Report-To headers with a Cloudflare zone Response Header Transform Rule. Add the headers to the live-site check list. | S | Live headers on 18 October 2026 (our test). Three competitors do not do what their privacy text says. | None. It enforces "no tracking". |
| R6 | High | At first load with sample data, show a neutral status. After the first user action or "Download XML", show errors in red. | S | First bar text at all widths (our test). [Baymard](https://baymard.com/blog/inline-form-validation), [SIDP](https://smart-interface-design-patterns.com/articles/inline-validation-ux/). | None |
| R7 | High | After Open, keep the opened name and IBAN pairs in memory. Show a warning for a changed IBAN and for a new payee. Also warn for one IBAN with two names in a batch. | M | [EBA and ECB fraud report](https://www.eba.europa.eu/sites/default/files/2025-12/1709846a-84d9-47cf-86a0-b155efb34d66/EBA%20and%20ECB%20Report%20on%20Payment%20Fraud.pdf), [Cyprus Mail](https://cyprus-mail.com/2025/04/28/cypriot-company-loses-over-e642000-in-online-fraud-scheme), [BOC advice](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/instant-payments/), [ABE blog](https://www.abe-eba.eu/2025/09/05/implementing-vop-for-bulks-the-nightmare-before-halloween/) | None. Memory only, no storage. A warning, no automatic change. |
| R8 | Medium | Add one list of all errors behind the error count, with a link to each field and the same words. Show the error link on phones. | M | [GOV.UK error summary](https://design-system.service.gov.uk/components/error-summary/), Xavi Esteve and SEPA Generator lists, phone-01-first-view.png | None. It is a click, not search or filter. |
| R9 | Medium | Show the amounts that the total leaves out, for example "+ 2 amounts not counted". | S | desktop-08-row-errors.png ("7 payments €1,899.00") | None |
| R10 | Medium | If an opened file has SWIF, PU or TBA codes, show a note or refuse the file. Do not change them to SEPA or TBOC without a note. | S | `readXml()` in [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js) | None. It restores "load the file exactly as it is" (round 1). |
| R11 | Medium | Add an FAQ entry "Multiple Payments or Payroll?" with the honest trade-offs: statement lines, saved lists, enrollment, SEPA only. | S | [BOC help 956](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/956/), [BOC help 1011](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/1011/), [BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/) | None |
| R12 | Medium | Add one line to the done dialog. The line says that 1bank does its own checks after the upload and can still reject a payment. | S | ARLing and pain001 disclaimers. If BOC cannot find the BIC, it rejects the payment ([BOC guide v13](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf)). | None |
| R13 | Medium | Add to FAQ 11 that 1bank has daily limits for each transfer type, with no numbers. Show the SEPA total and the TBOC total in the done dialog. | S | [Digipass form](https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/left-menu/sms_app_digipass_en.pdf) (transfers to BOC customers: 50,000 a day). JAM totals for each type. | **Constraint (project rule "no numbers for cut-off, fees, limits"):** keep the numbers off the page. |
| R14 | Medium | While the undo toast has the focus or the pointer, keep it open. Make sure that the keyboard can reach "Undo". | S | WCAG 2.2.1 Timing Adjustable ([W3C](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)), [NN/g](https://www.nngroup.com/articles/confirmation-dialog/) | **Near a rejected idea (undo/redo, round 1):** keep one snapshot and no history. |
| R15 | Medium | On phones, show the paste preview as cards. On touch screens, show touch text, not "Tab" or "drop". | M | phone-06-paste-preview.png, phone-05-start-cards.png | None |
| R16 | Medium | Add the Greek 1bank labels in brackets in the upload guide. Warn that the Greek title "Πολλαπλές Πληρωμές" belongs to Group Transfers. | S | [BOC help 970, Greek](https://www.bankofcyprus.com/home-gr/Digital_Channels/Internet-Banking-Help/Functions/970/), [BOC help 1011, Greek](https://www.bankofcyprus.com/home-gr/Digital_Channels/Internet-Banking-Help/Functions/1011/) | **Near a hard requirement (English only):** the page stays English. Greek shows only as quoted 1bank labels. |
| R17 | Medium | In CI, validate the golden XML against the BOC XSD with xmllint. Compare the output with boc_payments_xml for the same CSV. | M | FAQ 5 says "the same XML". The golden files come from this repository only. | **Possible conflict (tests use no packages):** xmllint and PHP are system tools, not npm packages. Make sure that the test rules permit them. |
| R18 | Low | Add two FAQ entries. The first says that the file has no addresses. Payments to SEPA countries outside the EEA must carry the payer address, so tell users to ask BOC. The second says that the file asks for normal, not instant, execution. | S | [EPC153-22](https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC153-22%20v2.1%20EPC%20guidance%20document%20-%20Provision%20of%20Addresses%20under%20the%20EPC%20Payment%20Schemes.pdf), [Regulation 2024/886](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R0886), [BOC instant payments](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/instant-payments/) | None |
| R19 | Low | Show "Not a business day" also for TARGET and Cyprus bank holidays, as a note only. | M | The rule knows only weekends ([app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js)). Payroll moves holiday dates ([BOC help 956](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/956/)). | **Conflict (CLI parity):** the CLI skips only weekends. Keep it a note, or change the CLI too. |
| R20 | Low | Add a "Report a problem" link to GitHub issues and an e-mail address. The page sends nothing. | S | No usage data by design. ISO 20022 Generator has a feedback form. | None. It is a link only. |
| R21 | Low | Compare the 37 SEPA countries in the page with the current EPC list and the BOC list of 36 countries. | S | [app.js](https://github.com/otar/1batch.cy/blob/main/site/app.js), [BOC instant payments](https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/instant-payments/) | **Conflict (CLI parity):** change the CLI too. |
| R22 | Low | Rewrite FAQ 15 without "would", for example "If you upload the full file again, 1bank pays the other payments two times." | S | [index.html](https://github.com/otar/1batch.cy/blob/main/site/index.html), FAQ 15 | None. It applies the STE rule. |
| R23 | Low | Add "Make a file with this payment only" to the "⋯" panel, for a payment that 1bank rejected. | M | [BOC help 971](https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/), FAQ 15, kibervarnost row selection | **Re-opens a removed feature (select several, round 3):** keep it to one row, as a click. |
| R24 | Low | Add accessibility assertions to the Playwright tests: labels, `aria-invalid`, focus not under the bar, target size. | M | No accessibility tests today. EN 301 549 v4.1.1 uses WCAG 2.2. | None. No packages. |
| R25 | Low | If users ask for them, add TBA, SWIF and PU types and a date for each payment. | L | [BOC guide v13](https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf), Appendix B. BOC sample with two dates. | **Conflict (CLI parity and round 3):** the CLI makes SEPA and TBOC in EUR with one date. More fields go against the round 3 decision for a simple editor. |

## Appendix: screenshots

All screenshots come from our test runs on 18 October 2026. The 1batch.cy images use widths of 1440, 820 and 390 pixels. The competitor images use 1440 × 900 pixels. The image files are in the folder `competitive-ux-analysis`, next to this report.

**1batch.cy**

- [desktop-01-first-view.png](competitive-ux-analysis/desktop-01-first-view.png): first desktop view with sample data. Only 2 of 8 rows show, and the bar shows 2 errors before any action.
- [desktop-01-first-view-full.png](competitive-ux-analysis/desktop-01-first-view-full.png): the full desktop page, about 3,614 pixels high, from the header to the footer.
- [desktop-02-iban-focus.png](competitive-ux-analysis/desktop-02-iban-focus.png): the bank line that shows while the IBAN field has the focus.
- [desktop-04-errors-empty-payfrom.png](competitive-ux-analysis/desktop-04-errors-empty-payfrom.png): "Download XML" with an empty "Pay from".
- [desktop-05-start-cards.png](competitive-ux-analysis/desktop-05-start-cards.png): the three start cards after "Clear and start".
- [desktop-06-paste-preview.png](competitive-ux-analysis/desktop-06-paste-preview.png): the paste preview with a select for each column and the opt-in amount correction.
- [desktop-07-done-dialog.png](competitive-ux-analysis/desktop-07-done-dialog.png): "The file is ready" dialog with three values and the old menu label in step 1.
- [desktop-08-row-errors.png](competitive-ux-analysis/desktop-08-row-errors.png): row errors with "Change to" and "Change all". The total of €1,899.00 leaves out two amounts.
- [desktop-09-sample-download-warning.png](competitive-ux-analysis/desktop-09-sample-download-warning.png): the warning before a download with sample data.
- [desktop-10-opened-old-xml-new-month.png](competitive-ux-analysis/desktop-10-opened-old-xml-new-month.png): the "New month?" replace after an old XML file opens.
- [desktop-11-upload-guide.png](competitive-ux-analysis/desktop-11-upload-guide.png): the 6-step upload guide with placeholder images and "[Pending Payments]".
- [desktop-12-faq-open.png](competitive-ux-analysis/desktop-12-faq-open.png): the FAQ with an open question.
- [desktop-13-privacy-footer.png](competitive-ux-analysis/desktop-13-privacy-footer.png): the privacy note and the footer.
- [tablet-01-first-view.png](competitive-ux-analysis/tablet-01-first-view.png): the tablet layout at 820 pixels, with cards and the full bar.
- [phone-01-first-view.png](competitive-ux-analysis/phone-01-first-view.png): the phone first view. No payment shows, and the bar hides the error link.
- [phone-05-start-cards.png](competitive-ux-analysis/phone-05-start-cards.png): the touch layout with keyboard text ("Tab goes to the next cell").
- [phone-06-paste-preview.png](competitive-ux-analysis/phone-06-paste-preview.png): the phone paste preview, with about 2 columns and a sideways scroll.
- [phone-08-row-errors.png](competitive-ux-analysis/phone-08-row-errors.png): a phone card with errors.

**Competitors**

- [competitor-arling-sk-after-bad-iban-generate.png](competitive-ux-analysis/competitor-arling-sk-after-bad-iban-generate.png): ARLing makes the file anyway, with an honest warning box and an errors column.
- [competitor-xmlbridge-after-typing-bad-iban.png](competitive-ux-analysis/competitor-xmlbridge-after-typing-bad-iban.png): XMLBridge shows an IBAN with wrong check digits as valid, and an autosave toast.
- [competitor-xmlbridge-after-load-old-xml.png](competitive-ux-analysis/competitor-xmlbridge-after-load-old-xml.png): XMLBridge with an old pain.001 file in its grid.
- [competitor-xaviesteve-after-generate.png](competitive-ux-analysis/competitor-xaviesteve-after-generate.png): Xavi Esteve result list by line, under a large ad space.
- [competitor-filetailored-after-csv-upload.png](competitive-ux-analysis/competitor-filetailored-after-csv-upload.png): fileTailored reads "20,00" as 2000 and breaks "ü".
- [competitor-freesepa-bad-iban-button-disabled.png](competitive-ux-analysis/competitor-freesepa-bad-iban-button-disabled.png): FreeSEPA keeps its download button off with no message.
- [competitor-kibervarnost-sepaviewer-after-open-xml.png](competitive-ux-analysis/competitor-kibervarnost-sepaviewer-after-open-xml.png): kibervarnost shows an old file in a table, with the invalid IBAN in pink.
- [competitor-iso20022generator-grid-sample.png](competitive-ux-analysis/competitor-iso20022generator-grid-sample.png): ISO 20022 Generator grid with a fixed paste order, the 2-line demo limit and a feedback form.
- [competitor-validatefin-mapping-step.png](competitive-ux-analysis/competitor-validatefin-mapping-step.png): ValidateFin mapping step, with no column selected from our CSV.
- [competitor-validatefin-generate-click-no-visible-message.png](competitive-ux-analysis/competitor-validatefin-generate-click-no-visible-message.png): ValidateFin shows no message after a click on "Generate SEPA file".
- [competitor-mobilefish-desktop.png](competitive-ux-analysis/competitor-mobilefish-desktop.png): Mobilefish, an old portal layout with ads.
- [competitor-easybankflow-desktop.png](competitive-ux-analysis/competitor-easybankflow-desktop.png): EasyBankFlow, with a sign-in card before any use.

## Sources

**Bank of Cyprus and 1bank**

1. BOC Internet Banking Help, Transfer & Pay menu: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/menu/TransfersAndPayments/
2. BOC help 971, Multiple Payments: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/971/
3. BOC help 482, Pending for Approval: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/482/
4. BOC help 454, Transaction Status: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/454/
5. BOC help 480, Messages: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/480/
6. BOC help 956, Payroll Create: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/956/
7. BOC help 957, Payroll beneficiary list: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/957/
8. BOC help 1010, Group Transfers lists: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/1010/
9. BOC help 1011, Group Transfers Create: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/1011/
10. BOC help 1013, Payroll Response Information: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/1013/
11. BOC help 970, Greek: https://www.bankofcyprus.com/home-gr/Digital_Channels/Internet-Banking-Help/Functions/970/
12. BOC help 1011, Greek: https://www.bankofcyprus.com/home-gr/Digital_Channels/Internet-Banking-Help/Functions/1011/
13. BOC Multiple Payments service page: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/Transfers_Payments/Multiple_Payments/
14. BOC Payroll service page: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/Transfers_Payments/Payroll/
15. BOC documents page, SEPA multiple payments files: https://www.bankofcyprus.com/en-gb/Personal/the-bank/documents/sepa--multiple-payments-files/
16. BOC "OLD" documents page: https://www.bankofcyprus.com/en-gb/Personal/the-bank/documents/sepa--multiple-payments-files_old/
17. BOC Multiple Payments XML guide, pain.001.001.09, Version 13 (14/11/2023): https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-implementation-guidelines-for-multiple-payments.pdf
18. BOC Multiple Payments sample XML, .09: https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/v9_xml-sample-file-multiple-payments-local-and-swift.xml
19. BOC Multiple Payments XSD, .09: https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-multiple-payments-files-through-1bank/pain.001.001.09.xsd
20. BOC Multiple Payments XML guide, pain.001.001.03, Version 12 (14/01/2022), older: https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/right-menu/internet_banking_help/xml-implementation-guidelines-for-multiple-payments2.pdf
21. BOC Payroll and Group Transfers XML guide, .09, Version 8 (June 2026): https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/pain09-payroll-and-group-transfers-files-through-1bank/v9_xml-implementation-guidelines-for-payroll-and-group-transfers-files.pdf
22. 1bank User Manual for business users, Version 6.0 (27/07/2022): https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/left-menu/1bank_companies_eng_final.pdf
23. Manual for Payroll and other Multiple Payments, Edition 4 (February 2017): https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/right-menu/internet_banking_help/manual--for-payroll-and-multiple-payments.pdf
24. BOC XML Conversion Tool help page: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/Internet-Banking-Help/Functions/XML_Convertion_Tool_en/
25. Conditions for using the XML Conversion Tool: https://www.bankofcyprus.com/globalassets/cyprus/org_methods/sepa/conditions-for-using-the-xml-conversion-tool.pdf
26. XML Conversion Tool address (HTTP 503 on 18 October 2026): https://online.bankofcyprus.com/netteller-web/PayrollConversionToolPage.faces
27. BOC Verification of Payee: https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/verification-of-payee/
28. BOC Supplementary Agreement letter on VoP (September 2025): https://www.bankofcyprus.com/globalassets/cyprus/org_methods/psd/eng/2025/supplementary-agreement-customer-informative-letter_september-2025.pdf
29. BOC Instant Payments: https://www.bankofcyprus.com/en-gb/wholesale/Daily_Banking/payments/instant-payments/
30. BOC SMS and APP Digipass application form (November 2025): https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/left-menu/sms_app_digipass_en.pdf
31. BOC transaction security: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/Transaction_Security/
32. 1bank Terms and Conditions: https://www.bankofcyprus.com/globalassets/cyprus/personal/internet-banking/right-menu/english/1bank_terms_en.pdf
33. BoC Mobile App: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/digital-banking/BoC_MobileApp/
34. BOC B2B APIs: https://www.bankofcyprus.com/en-gb/Personal/Digital_Channels/services/B2B_APIs/
35. BOC Jinius: https://www.bankofcyprus.com/en-gb/wholesale/Digital-solutions/digitize-your-business/Jinius2/

**EU law, payment standards and industry notes**

36. Regulation (EU) 2024/886 (instant payments and VoP): https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R0886
37. European Commission, IPR implementation questions and answers: https://finance.ec.europa.eu/document/download/f597b1a5-2a7b-481d-882c-80fb1c5cc3d5_en?filename=instant-payments-implementation-questions-answers_en.pdf
38. ABE/EBA, VoP for bulks, key challenges (2025-05): https://www.abe-eba.eu/wp-content/uploads/2025/06/eba_20250523_vop_for_bulks_key_challenges_and_pain_points.pdf
39. ABE/EBA, key challenges for VoP matching checks (September 2025): https://www.abe-eba.eu/wp-content/uploads/2025/09/EBA_20250925_Key_Challenges_for_VOP_Matching_Checks.pdf
40. ABE/EBA blog on bulk VoP (5 September 2025): https://www.abe-eba.eu/2025/09/05/implementing-vop-for-bulks-the-nightmare-before-halloween/
41. EPC SCT customer-to-PSP implementation guidelines 2025: https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2024-11/EPC132-08%20SCT%20C2PSP%20IG%202025%20V1.0.pdf
42. EPC153-22 v2.1, provision of addresses: https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC153-22%20v2.1%20EPC%20guidance%20document%20-%20Provision%20of%20Addresses%20under%20the%20EPC%20Payment%20Schemes.pdf
43. Central Bank of Cyprus, application of Regulation 2024/886: https://www.centralbank.cy/en/announcements/application-of-instant-payments-regulation-eu-2024-886-10-12-2024
44. Directive (EU) 2019/882, European Accessibility Act: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882
45. Level Access, EN 301 549: https://www.levelaccess.com/compliance-overview/en-301-549-compliance/
46. W3C, What is new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
47. EDPB Guidelines 2/2023, version 2.0: https://edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
48. MDN, CSP connect-src: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src
49. EBA and ECB, 2025 Report on Payment Fraud: https://www.eba.europa.eu/sites/default/files/2025-12/1709846a-84d9-47cf-86a0-b155efb34d66/EBA%20and%20ECB%20Report%20on%20Payment%20Fraud.pdf
50. Cyprus Mail, company loses over €642,000 (28 April 2025): https://cyprus-mail.com/2025/04/28/cypriot-company-loses-over-e642000-in-online-fraud-scheme
51. Norton Rose Fulbright, PSD3 and PSR: https://www.nortonrosefulbright.com/en/knowledge/publications/cedd39c6/psd3-and-psr-from-provisional-agreement-to-2026-readiness
52. Ink & Switch, Local-first software: https://www.inkandswitch.com/essay/local-first/

**UX guidance**

53. GOV.UK Design System, error summary: https://design-system.service.gov.uk/components/error-summary/
54. GOV.UK Design System, validation pattern: https://design-system.service.gov.uk/patterns/validation/
55. GOV.UK Design System, error message: https://design-system.service.gov.uk/components/error-message/
56. Baymard Institute, inline form validation: https://baymard.com/blog/inline-form-validation
57. NN/g, errors in forms: https://www.nngroup.com/articles/errors-forms-design-guidelines/
58. NN/g, confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/
59. NN/g, empty states: https://www.nngroup.com/articles/empty-state-interface-design/
60. NN/g, data tables: https://www.nngroup.com/articles/data-tables/
61. Smart Interface Design Patterns, inline validation: https://smart-interface-design-patterns.com/articles/inline-validation-ux/
62. Smart Interface Design Patterns, error messages: https://smart-interface-design-patterns.com/articles/error-messages-ux/
63. Smart Interface Design Patterns, bulk import: https://smart-interface-design-patterns.com/articles/bulk-ux/
64. OneSchema, CSV uploader practices: https://www.oneschema.co/blog/building-a-csv-uploader

**Competitor tools**

65. ARLing SEPA pain.001 Generator: https://arling.sk/sepa-pain001-generator/ and https://github.com/AndryRoby/sepa-pain001-generator
66. XMLBridge SEPA: https://xmlbridge.com/sepa/ and privacy policy https://xmlbridge.com/privacy/
67. XMLBridge on Product Hunt: https://www.producthunt.com/@ismail183
68. ISO 20022 Generator: https://iso20022generator.com/en/sepa-xml-generator, editor https://iso20022generator.com/en/virements/sepa, pricing https://iso20022generator.com/en/pricing
69. ValidateFin CSV to SEPA converter: https://validatefin.com/en/tools/sepa-converter
70. Xavi Esteve SEPA XML Generator: https://xaviesteve.com/pro/sepaxml/
71. kibervarnost.si SEPA viewer: https://kibervarnost.si/sepaviewer/ and privacy policy https://kibervarnost.si/privacy-policy/
72. FreeSEPA: https://freesepa.com/
73. Mobilefish SEPA XML: https://www.mobilefish.com/services/sepa_xml/sepa_xml.php
74. fileTailored CSV to PAIN.001: https://www.filetailored.com/hubs/finance/convert/csv-to-pain001
75. EasyBankFlow: https://easybankflow.com/ and pricing https://easybankflow.com/pricing
76. generatesepa.com: https://www.generatesepa.com/
77. sepaxml.com: https://www.sepaxml.com/
78. sepaxmlgenerator.com: https://www.sepaxmlgenerator.com/
79. JAM SEPA-Transfer: https://www.jam-software.com/sepa-transfer/, changelog https://www.jam-software.com/sepa-transfer/changes.shtml, editions https://www.jam-software.com/sepa-transfer/editions.shtml, import wizard https://manuals.jam-software.com/sepa-transfer/EN/importwizard.html
80. SEPA Generator Community: https://github.com/pierrecariou/SEPA-generator
81. SEPA Generator Pro: https://sepa-xml-generator.com/pro/ and report screenshot https://sepa-xml-generator.com/assets/screenshots/pro-validation-report-light.webp
82. SEPA Generator error dialog screenshot: https://raw.githubusercontent.com/pierrecariou/SEPA-generator/main/docs/assets/screenshot-sepa-generator-validation-error-light.png
83. pain001: https://github.com/sebastienrousseau/pain001 and https://pypi.org/project/pain001/
84. sepa.js: https://github.com/kewisch/sepa.js
85. Sepa-JS-XML: https://github.com/jerebtw/Sepa-JS-XML
86. php-sepa-xml: https://github.com/php-sepa-xml/php-sepa-xml
87. VIALET Excel helper: https://vialet.notion.site/Using-the-Helper-Excel-Spreadsheet-with-CSV-Support-1c4418f30ba581b78d90f334899cfd70
88. boc-sage-to-xml-tool: https://github.com/Krispy2009/boc-sage-to-xml-tool
89. Codeworks PayrollPlus, SEPA export: https://www.codeworks.com.cy/knowledge-base/manuals/payrollplus-manual/exports/bank-sepa-export/
90. boc_payments_xml: https://github.com/otar/boc_payments_xml

**1batch.cy**

91. Live site: https://www.1batch.cy/
92. Repository: https://github.com/otar/1batch.cy
93. index.html: https://github.com/otar/1batch.cy/blob/main/site/index.html
94. app.js: https://github.com/otar/1batch.cy/blob/main/site/app.js
95. style.css: https://github.com/otar/1batch.cy/blob/main/site/style.css
96. _headers: https://github.com/otar/1batch.cy/blob/main/site/_headers
97. Tests: https://github.com/otar/1batch.cy/tree/main/tests

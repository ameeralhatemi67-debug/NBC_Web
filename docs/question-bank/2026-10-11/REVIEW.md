# Supplied question banks — committee review

[official-drafts.json](official-drafts.json) contains 75 active, unapproved records: 20 middle, 25 highschool and 30 university. Stable IDs encode stage/year/original item number. The supplied option order and answer letters are preserved; true/false items use two-option single choice. Questions may repeat between stages. Question order is randomized once when an attempt is created and remains stable thereafter.

[source-review.json](source-review.json) retains every original question cell, answer letter, page reference, document hash and row reference alongside its imported wording. Text, options and keys were checked against the extracted Word tables. Word's damaged AGA Arabesque religious symbol was restored to `ﷺ`; surrounding extraction dashes and a joined option marker were repaired. Unbalanced quotation parentheses in highschool item 13 and university item 11 were repaired after checking PDF pages 31 and 23. No options were reordered.

The supplied book SHA-256 is `ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd`. All referenced pages were visually checked against that PDF. Its printed-page numbering is offset by two PDF pages. Cover items reference PDF page 1 without an invented printed number. The middle item 3 and university item 7 use explicit two-page ranges. Single-page hints show the source page and its predecessor; range hints show the two referenced pages.

The final three questions in each bank use official-source metadata and have no book-page hints:

| Topic | Evidence |
| --- | --- |
| Organizing branch | The supplied `الجهات المنظمة.docx` identifies the Eastern branch as organizer/executor. [The Presidency's website](https://www.pv.gov.sa/) is the institution reference; the campaign attribution relies on the supplied organizer document, rather than an invented public campaign claim. |
| Contact number 1909 | [Saudi national platform contact list](https://my.gov.sa/en/emergency-contact), corroborated by [Saudi Press Agency](https://www.spa.gov.sa/2009196). |
| Responsibilities | [Bureau of Experts regulation, Article 6](https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d7ab6b0a-b50b-4be5-9284-a9a700f209d4/1), supporting both listed responsibilities and therefore the supplied “جميع ما سبق” answer. |

All records retain `sourceVerified: false` and `approved: false`. Before approval, the reviewer must compare the wording, quotations, chosen answer and excerpt with the recorded source, then mark the source checked in the editor and approve through the existing committee workflow. The explanation currently identifies the supplied correct option; it does not pretend to be a verbatim book quotation. The source audit preserves punctuation issues for that review.

Import through the existing workflow after database migration/initialization:

```powershell
npm run questions:import -- docs/question-bank/2026-10-11/official-drafts.json
npm run questions:import -- docs/question-bank/2026-10-11/official-drafts.json --apply --actor <approved-committee-subject>
```

The first command validates without writing. Applying the import still creates unapproved versions and an audit entry. Re-importing increments versions and removes approval. Retire conflicting old active questions through the existing reviewed bank workflow before freezing; the freeze requires exactly 20/25/30 approved questions for a new campaign. This fresh local preview removes its synthetic question seed and imports the supplied 75 as drafts; no live bank has been changed.

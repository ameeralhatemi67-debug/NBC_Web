---
type: index
tags: [nbc, implementation, demo]
created: 2026-09-08
updated: 2026-09-29
---

# NBC implementation index

Parent: [[00-NBC-Research-Index]]

## Current delivery

The user selected **C. Deep Green & Gold** from [[2026-09-29-Design-Review]]. The application now uses the green/gold palette, a textured animated hero, prominent organisations, the supplied SAR 52,000 prize schedule, direct book access and the supplied participation rules. The user selected **B3**, now used in the shared brand and browser icon. The [logo review](../design/2026-09-29/logo-variations/index.html) is retained as design history. Registration captures the study institution through participant records, committee reports/search and CSV.

New source interpretation: [[16-Committee-Update-and-Design-Decision]].
The first working demonstration implements **Contemporary Heritage** with the selected **Deep Green & Gold** palette and restrained motion. Its purpose is a live committee presentation and proposal evaluation. The deadline and the official supplier-selection rubric are still unknown.

| Area | Current state |
|---|---|
| Arabic homepage | Working, with supplied book cover, textured green hero, motion controls, prominent organisations, prizes, eligibility, journey, and FAQs |
| Registration and login | Green/gold registration, login and OTP screens; URL-driven mode switching; local accounts with OTP and identity checks explicitly simulated |
| Participation | Ten sample questions, randomized stable order, server saves, review, single final submission |
| Reading | Supplied 66-page PDF with open/download controls and native embedding; separate demo text retains remembered chapter/font/scroll and participation panel |
| Committee | Overview, participants, editor/admin permissions, draft/approved question versions, grades, ties, reports, CSV, reminders preview, audit |
| Recovery | Database snapshot export and restoration into a new folder; old sessions invalidated |
| Proposal materials | [[02-Committee-Demo-and-Proposal]] provides the pitch and concrete commercial dependency list |
| Requirements coverage | [[01-Demo-Requirements-Coverage]] distinguishes implemented, simulated, partial, and pending items |
| Verification | Seven domain tests and 39 isolated integration checks; production build and type check pass |

## Decisions carried forward

- Preserve the committee brief's open-book, untimed, backward-navigation rules. Never use completion time to break ties.
- Freeze questions and answer keys into the attempt at its start. Editing the question bank does not change an existing attempt.
- Treat publication of individual grades separately from selecting winners. Tie decisions and prize rules are pending organizer input.
- Use a local embedded PostgreSQL engine for repeatable demonstrations. This does not establish production capacity or hosting compliance.
- Keep the original scientific-committee brief as the requirements source. The Sijillat document is a supplier offer used as a comparison, not an authority to change the rules.

## What the additional supplier document changed

Its five supplied pages establish a useful comparison for administration, reporting, responsive design, audit logging, and backups. Our response is to demonstrate these functions and give each claim evidence. It does not justify adding arbitrary page counts or claiming a superior technology stack.

The contents page points to eleven pages, but only pages 1–5 were supplied. Pages 6–11 may change pricing, hosting, support, delivery, and ownership assumptions. Implementation can proceed without inventing those terms.

## Remaining work before a real launch

Book publication rights; final question bank and review ownership; authoritative eligibility checks; actual SMS provider and delivery policies; final privacy/guardian decisions and approval of published terms; registration and campaign dates; tie/winner rules; staff authentication; production hosting and database migration; retention policy; performance/load testing; independent accessibility and security review; support agreement and pricing.

No presentation recording, real-user usability study, or production certification is claimed.

Related: [[03-Design-and-Technical-Decisions]], [[04-Verification-and-Handover]], [[08-Proposal-and-Winning-Strategy]].

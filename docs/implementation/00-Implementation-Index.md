---
type: index
tags: [nbc, implementation, demo]
created: 2026-09-08
updated: 2026-09-08
---

# NBC implementation index

Parent: [[00-NBC-Research-Index]]

## Current delivery

The first working demonstration implements the selected **Contemporary Heritage** design with **balanced editorial** motion. Its purpose is a live committee presentation and proposal evaluation. The deadline and the official supplier-selection rubric are still unknown.

| Area | Current state |
|---|---|
| Arabic homepage | Working, with original heritage illustration, responsive navigation, eligibility, journey, and FAQs |
| Registration and login | Working local accounts; OTP and identity checks explicitly simulated |
| Participation | Ten sample questions, randomized stable order, server saves, review, single final submission |
| Reading | Original sample text, font controls, remembered chapter and scroll position; desktop split view and mobile reading panel |
| Committee | Overview, participants, editor/admin permissions, draft/approved question versions, grades, ties, reports, CSV, reminders preview, audit |
| Recovery | Database snapshot export and restoration into a new folder; old sessions invalidated |
| Proposal materials | [[02-Committee-Demo-and-Proposal]] provides the pitch and concrete commercial dependency list |
| Requirements coverage | [[01-Demo-Requirements-Coverage]] distinguishes implemented, simulated, partial, and pending items |
| Verification | Six domain tests and 35 isolated integration checks; production build and type check pass |

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

Approved book and rights; final question bank and review ownership; authoritative eligibility checks; actual SMS provider and delivery policies; final terms/privacy/guardian decisions; registration and campaign dates; tie/winner rules; staff authentication; production hosting and database migration; retention policy; performance/load testing; independent accessibility and security review; support agreement and pricing.

No presentation recording, real-user usability study, or production certification is claimed.

Related: [[03-Design-and-Technical-Decisions]], [[04-Verification-and-Handover]], [[08-Proposal-and-Winning-Strategy]].

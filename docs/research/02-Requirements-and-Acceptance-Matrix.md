---
type: guide
tags:
  - nbc/research
  - nbc/requirements
created: 2026-09-07
updated: 2026-09-08
status: active
---

# Requirements and acceptance matrix

Parent: [[00-NBC-Research-Index]]

> [!important] Reading this matrix
> These 47 entries normalize all 47 source bullets, including objectives and repeated notification/report obligations. They are not 47 independent software features. “Evidence to propose” is our suggested acceptance evidence, not additional wording from the committee. Source: [[Source-Committee-PDF]], all four pages.

## Coverage and interpretation

The document is a committee views/requirements source, not a verified final tender. All baseline statements below are grounded in its rendered pages. Related scope questions are in [[11-Open-Questions-and-Evidence-Gaps]].

## Objectives

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R01 | 1 | Promote the book’s content across society | Tie the proposal narrative and content navigation to the approved book. |
| R02 | 1 | Provide an interactive knowledge and awareness experience using modern technology | Show useful interaction with accessible reading and question navigation. |
| R03 | 1 | Make the book easy for participants to benefit from | Demonstrate book access on mobile and desktop. |
| R04 | 1 | Ensure fairness and transparency in administration and results | Show approval history, scoring explanation and controlled result publication. |

## Registration

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R05 | 1 | Register with national identity or iqama number to verify eligibility | Agree an authoritative verification method; entering an ID alone is insufficient. |
| R06 | 1 | Collect four-part name and primary mobile for OTP | Validate understandable fields; separate identity verification from phone control. |
| R07 | 1 | Allow an optional backup mobile | Keep it optional; do not silently promote it to an authentication factor. |
| R08 | 1 | Select middle, secondary or university stage | Validate one supported stage; clarify category eligibility. |
| R09 | 1 | Record region, governorate, village or center or equivalent | Use a controlled hierarchy with an exception path for equivalent localities. |
| R10 | 1 | Accept competition terms before registration completes | Record terms version and acceptance; privacy notice and lawful basis remain separate matters. |

## Login

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R11 | 1 | Use identity or iqama number to sign in | Test both identifiers and numeral entry styles. |
| R12 | 1 | Verify the participant through a code sent to the primary mobile | Demonstrate OTP delivery, expiry, rate limits and supported recovery. |
| R13 | 1 | No more than one participation per person | Preserve one attempt through refresh, retries and concurrent sessions; clarify season boundary. |

## Questions

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R14 | 2 | Use only objective questions, such as multiple choice | Show supported objective formats; no essay grading in baseline. |
| R15 | 2 | Build questions from the named book | Associate each item with approved edition and source location. |
| R16 | 2 | Distribute questions randomly between participants | Approve the intended form model and retain each assigned question set. |
| R17 | 2 | Allow returning to a previous question while answering | Show backward navigation and preserved answers. |
| R18 | 2 | Allow consulting, opening and downloading the book during participation | Demonstrate book use without losing the active attempt. |
| R19 | 2 | Do not show correct answers to participants after the test | Verify absence from visible UI, network responses and exports available to participants. |
| R20 | 2 | Allow participation throughout the competition period without a time limit for answering | No attempt countdown; distinguish campaign closing date and security session expiry. |

## Results

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R21 | 2 | Calculate results electronically and automatically | Use reproducible scoring over a saved final answer set. |
| R22 | 2 | Announce winners based on the highest achieved scores | Use the approved award scope and categories, not assumed quotas. |
| R23 | 2 | Do not use time to distinguish equal scores | Show a tie test in which elapsed time and submission time do not affect rank. |
| R24 | 2 | Use a fair tie-resolution mechanism determined by organizers when needed | Keep tied cases unresolved until a documented organizer-approved rule is available. |
| R25 | 2 | Export results and statistical reports electronically | Provide authorized exports that match the approved scoring snapshot. |

## Administration

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R26 | 2 | Manage participant data and results | Demonstrate roles and logged changes. |
| R27 | 2 | Manage and update the question bank | Use controlled versions and an approved mid-competition correction policy. |
| R28 | 2 | Track complete and incomplete participations | Define completion states and verify counts. |
| R29 | 3 | Send automated reminders to incomplete participants without excessive alerts | Use approved cadence, deduplication and cancellation after completion. |
| R30 | 3 | Produce required reports and statistics | Demonstrate all required report families. |

## Reports

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R31 | 3 | Total participants by educational stage | Reconcile stage subtotals with the eligible reporting population. |
| R32 | 3 | Participants by cities, governorates, villages or centers | Resolve the city/reporting versus region/registration field mismatch. |
| R33 | 3 | Counts of complete and incomplete participations | Use explicit reporting definitions and an as-of timestamp. |
| R34 | 3 | Winners and final grades | Restrict access and publish only approved winner fields. |
| R35 | 3 | General statistical report including the preceding reports | Provide a consistent summary using the same filters and snapshot. |

## Notifications

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R36 | 3 | Send verification code at registration | Test code delivery and distinguish it from registration success. |
| R37 | 3 | Send registration confirmation messages | Send only after completed registration. |
| R38 | 3 | Send reminders for incomplete participations | Share reminder policy with R29 rather than duplicate sends. |
| R39 | 3 | Send winner congratulations and result announcement notifications | Trigger from approved release, not provisional calculation. |

## Eligibility

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R40 | 3 | Male and female students in middle, secondary and university stages | Cover specified populations in discovery and usability evaluation. |
| R41 | 3 | Include government, private and international schools and accredited universities/colleges | Agree how institution eligibility is checked without excluding international schools. |

## Technical

| ID | PDF page | Requirement in English | Evidence to propose |
|---|---:|---|---|
| R42 | 4 | Design compatible with smart devices and computers | Evaluate realistic small screens and desktop use. |
| R43 | 4 | Easy-to-use Arabic interface | Test Arabic copy, RTL layout, keyboard and assistive technology. |
| R44 | 4 | Protect participant data and privacy | Map collected fields, permissions, retention and applicable legal controls. |
| R45 | 4 | Keep data backups | Demonstrate a restore, not just backup configuration. |
| R46 | 4 | Allow future expansion and development | Document extensibility and ownership without promising unnecessary features. |
| R47 | 4 | Provide technical support throughout the competition | Agree coverage dates, channels, escalation and incident authority. |

## Four distinctions that prevent accidental non-compliance

1. **No answer timer** does not mean the competition never closes. Campaign dates and handling of in-progress attempts require an explicit policy.
2. **Random distribution** does not by itself define whether everyone receives the same questions in a different order or different questions drawn from a pool.
3. **No correct-answer disclosure** is not a direction to display an immediate numerical score. Score visibility and release timing are unresolved.
4. **One participation per person** is not one participation per phone, browser, IP address or household.

## Proposed acceptance evidence bundle

A future acceptance package should include a traceability sheet, a participant journey recording, scientific-committee content approval, fixed scoring examples, a duplicate-submission check, a tied-score case, report reconciliation, Arabic accessibility review, a backup restore record and a support runbook. No software implementation or test results are claimed by this research collection.

Related: [[05-Arabic-Design-and-Experience]], [[06-Assessment-Fairness-and-Content]], [[07-Privacy-Security-and-Operations]].


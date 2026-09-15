---
type: reference
tags: [nbc, requirements, verification]
created: 2026-09-08
updated: 2026-09-08
---

# Demo requirements coverage

Parent: [[00-Implementation-Index]]

This is a delivery evidence map, not an official acceptance certificate. IDs match the 47 bullets extracted from the scientific-committee PDF in [[02-Requirements-and-Acceptance-Matrix]]. “Implemented in demo” applies to synthetic data in the local demonstration only.

| ID | Committee requirement | Current status | Evidence and limits |
|---|---|---|---|
| R01 | Promote the book’s content across society | Partial | Homepage and reading journey implemented; approved book and campaign content pending. |
| R02 | Provide an interactive knowledge and awareness experience using modern technology | Implemented in demo | Interactive student and committee journeys, save feedback, reading controls. |
| R03 | Make the book easy for participants to benefit from | Partial | Accessible sample reading view; approved book and accessibility review pending. |
| R04 | Ensure fairness and transparency in administration and results | Partial | Versioned forms, deterministic scores, audit and approval; final policies pending. |
| R05 | Register with national identity or iqama number to verify eligibility | Simulated / pending | Identity field and format validation only; no authoritative eligibility verification. |
| R06 | Collect four-part name and primary mobile for OTP | Simulated / partial | Four-part-name check and primary phone collected; OTP is disclosed simulation. |
| R07 | Allow an optional backup mobile | Implemented in demo | Optional backup phone accepted and validated when present. |
| R08 | Select middle, secondary or university stage | Implemented in demo | Middle, secondary, and university choices. |
| R09 | Record region, governorate, village or center or equivalent | Implemented in demo | Region, city/governorate, optional village/center stored. |
| R10 | Accept competition terms before registration completes | Partial | Explicit acceptance of demo conditions; organizer terms and privacy wording pending. |
| R11 | Use identity or iqama number to sign in | Implemented in demo | Identity/iqama and primary phone match an existing demo account. |
| R12 | Verify the participant through a code sent to the primary mobile | Simulated | OTP challenge, expiry and attempt limit; no actual SMS delivery. |
| R13 | No more than one participation per person | Partial | Unique identity and one attempt per account in the demo campaign; real-person identity assurance pending. |
| R14 | Use only objective questions, such as multiple choice | Implemented in demo | Ten objective multiple-choice sample questions. |
| R15 | Build questions from the named book | Pending | Questions use original sample reading text, not the unavailable approved book. |
| R16 | Distribute questions randomly between participants | Partial | Same ten questions, random stable order per participant; final randomization policy pending. |
| R17 | Allow returning to a previous question while answering | Implemented in demo | Previous/next navigation and question map before final submission. |
| R18 | Allow consulting, opening and downloading the book during participation | Partial | Sample text can be opened during participation; approved book and download asset pending. |
| R19 | Do not show correct answers to participants after the test | Implemented in demo | Participant API projection excludes answer keys before and after submission. |
| R20 | Allow participation throughout the competition period without a time limit for answering | Partial | No answer timer; campaign dates and close-window behavior not implemented. |
| R21 | Calculate results electronically and automatically | Implemented in demo | Server scoring from the attempt snapshot, with transaction-protected finalization. |
| R22 | Announce winners based on the highest achieved scores | Pending | Scores sorted and reviewed; no automated winner announcement. |
| R23 | Do not use time to distinguish equal scores | Implemented in demo | Tie detection uses scores only; submission time is not a tie breaker. |
| R24 | Use a fair tie-resolution mechanism determined by organizers when needed | Pending | Tied groups shown as pending committee decision; no invented resolution policy. |
| R25 | Export results and statistical reports electronically | Partial | Filtered CSV of participant status and grades; approved winner export pending. |
| R26 | Manage participant data and results | Partial | Participant monitoring and grade publication; participant correction/deletion workflow deferred. |
| R27 | Manage and update the question bank | Implemented in demo | Question editing creates a draft version; admin approval separate from editor role. |
| R28 | Track complete and incomplete participations | Implemented in demo | Complete, in-progress, and not-started records are visible. |
| R29 | Send automated reminders to incomplete participants without excessive alerts | Simulated / pending | Fresh incomplete-cohort reminder preview; no scheduler, send service, or fatigue policy. |
| R30 | Produce required reports and statistics | Partial | Dashboard and filtered reports; final organizer report formats pending. |
| R31 | Total participants by educational stage | Implemented in demo | Stage counts and completion proportions. |
| R32 | Participants by cities, governorates, villages or centers | Partial | Locality fields shown in reports and CSV; dedicated locality aggregate report pending. |
| R33 | Counts of complete and incomplete participations | Implemented in demo | Complete/incomplete counts reconcile with filtered records. |
| R34 | Winners and final grades | Partial | Final grades shown to committee; winners list awaits policy and approval. |
| R35 | General statistical report including the preceding reports | Partial | General dashboard and CSV; combined approved winner report pending. |
| R36 | Send verification code at registration | Simulated | Disclosed verification code, without SMS transmission. |
| R37 | Send registration confirmation messages | Simulated / pending | On-screen registration success and audit event; external confirmation message not sent. |
| R38 | Send reminders for incomplete participations | Simulated | Reminder preview only; completed participants excluded at preview time. |
| R39 | Send winner congratulations and result announcement notifications | Pending | No congratulations or results announcement messages sent. |
| R40 | Male and female students in middle, secondary and university stages | Partial | Inclusive audience copy and all stages; eligibility/enrollment verification pending. |
| R41 | Include government, private and international schools and accredited universities/colleges | Partial | Audience copy includes the required institution types; accreditation checks pending. |
| R42 | Design compatible with smart devices and computers | Implemented in demo | Responsive desktop/mobile layouts; browser checks recorded separately. |
| R43 | Easy-to-use Arabic interface | Partial | Arabic RTL interface with locally bundled fonts; independent user/accessibility evaluation pending. |
| R44 | Protect participant data and privacy | Partial | Server authorization, private sessions, key exclusion, origin checks; production privacy/security work remains. |
| R45 | Keep data backups | Implemented in demo | Admin snapshot download and tested restore into a new directory. |
| R46 | Allow future expansion and development | Partial | Separated UI, domain and data services; production database/provider adapters require further work. |
| R47 | Provide technical support throughout the competition | Pending | Technical runbook supplied; staffing, service hours, SLA and support contract not established. |

## Acceptance boundary

The committee PDF controls the participant requirements. The supplier offer is a comparison source, not an instruction to replace those rules. Production acceptance requires organizer-approved content, identity and notification integrations, operational policies, and independent verification. See [[04-Verification-and-Handover]].

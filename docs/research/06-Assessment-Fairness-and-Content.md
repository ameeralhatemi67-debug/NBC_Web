---
type: guide
tags:
  - nbc/research
  - nbc/fairness
  - nbc/content
created: 2026-09-07
updated: 2026-09-08
status: active
---

# Assessment fairness and content governance

Parent: [[00-NBC-Research-Index]]

> [!abstract] Proposal opportunity
> Demonstrate that the committee can explain and reproduce every scoring decision. “Random questions” and “automatic results” are incomplete promises without approved content, comparable question sets and controlled changes.

## Start with the rules we actually have

The brief permits book use, returning to questions and untimed answering; requires objective questions, random distribution and automatic results; prohibits time-based tie-breaking and revealing correct answers after the test. [[Source-Committee-PDF]], p. 2. Treat this as an open-book knowledge experience when designing the interface. External help, group work, web search and AI assistance are not addressed; book permission is not blanket permission for those activities.

## Randomization options to take to the committee

ETS explains why scores across different forms require care if they are meant to carry the same meaning; conversion errors can harm fairness and validity. Its research concerns assessment programs generally and is not an NBC instruction. [Dorans, Moses and Eignor, ETS, 2010](https://www.ets.org/research/policy_research_reports/publications/report/2010/ilrs.html).

| Option | Strength | Limitation | Proposed position |
|---|---|---|---|
| Same questions, randomized presentation order | Equal content and raw-score range; easy to audit | Greater exposure/sharing risk; order effects remain possible | Ask whether this satisfies the committee’s intended random distribution. |
| Pre-reviewed parallel forms | Content coverage and difficulty can be planned | Expert judgment alone does not prove equivalent difficulty | Useful if different forms are required; pilot and review before launch. |
| Random draw constrained by a content blueprint | Better coverage than unconstrained sampling | Requires sufficient approved items in each category; calibration is still needed | Candidate for a larger bank and future seasons. |
| Unconstrained random sampling | Simple to implement | Can produce unequal topics or difficulty | Avoid presenting this alone as a fairness mechanism. |

Do not claim “equated forms” without empirical evidence and qualified assessment review. For a modest campaign, the honest solution may be a committee-approved simpler model. Educational-stage-specific pools or award categories must also be approved; the brief lists stages but does not define separate competitions.

Once an attempt begins, preserve its assigned item and option order. Refreshing or resuming must not redraw an easier set. Scoring must use stable option identifiers, not the option’s on-screen letter or position. These are proposed controls derived from the fairness requirement.

## Content workflow

ETS’s published item-development practice includes alignment, appropriate difficulty, editorial review and fairness checks. NBME’s guide supports clear one-best-answer items with a focused prompt and plausible, coherent alternatives. NBME’s medical subject matter is not applicable here; only general item-writing discipline transfers. [ETS item development](https://www.in.ets.org/k12/capabilities/item-development.html), [NBME item-writing guide](https://www.nbme.org/sites/default/files/2021-02/NBME_Item%20Writing%20Guide_R_6.pdf).

Proposed item record: stable ID; educational objective; approved book edition and page/section; Arabic prompt; permitted objective format; answer options; correct key; rationale for committee use; estimated difficulty explicitly labeled as expert judgment; author; reviewers; status; version; and any accessibility note. Neither rationale nor key should accompany participant-facing question data.

```mermaid
flowchart LR
    A["Approved book and rights"] --> B["Content blueprint"]
    B --> C["Draft objective items"]
    C --> D["Scientific and Arabic review"]
    D --> E["Fairness and accessibility review"]
    E --> F["Pilot and approve"]
    F --> G["Freeze published version"]
    G --> H["Operate and audit"]
    H --> I["Post-season review"]
```

Pilot with representatives of the specified stages and institution types. Ask whether language complexity tests reading skill unintentionally, whether distractors admit multiple defensible answers, and whether a question can be answered from the approved source. A pilot is a diagnostic exercise; it does not establish nationally representative psychometric validity.

## Ties and result approval

The PDF explicitly rules out time as a tie criterion and delegates a fair alternative to organizers. [[Source-Committee-PDF]], p. 2.

| Candidate to discuss | Benefit | Conditions and risks |
|---|---|---|
| Shared rank or award | Respects equal achievement | Prize budget and published rules must permit it. |
| Auditable random selection among tied eligible participants | Procedural equal chance when fewer awards exist | Requires organizer and applicable legal approval, advance publication, supervision and an audit record. It is not adopted here. |
| Additional approved assessment | Can distinguish demonstrated knowledge | Changes the competition process and may create a new burden; do not add it under the existing brief. |

Our default proposal behavior should be **flag the tie for the authorized committee**, not secretly use completion time, registration order, date of birth or an ID sort. A deterministic display order is acceptable only if it has no effect on rank or prizes.

A provisional score is not an approved winner. The proposed workflow is submission receipt → scoring → eligibility and exception review → tie resolution under an approved rule → two-person publication approval → notifications. The extra approval control is a recommendation.

## Corrections and appeals

Updating the question bank during a campaign can change outcomes. Propose frozen active items and a documented correction process. The committee must choose how to handle an invalid item consistently across affected attempts: re-key, remove from scoring, award credit, or another approved approach. Record the affected population and before/after totals. Do not quietly overwrite historical questions.

Define an appeals channel, submission window, decision authority and response target. Support staff should explain process but should not disclose live answers or alter grades without authority. Individual participants may receive the outcome and reasoning permitted by policy without receiving the answer key.

## Demonstration cases that make the proposal credible

- A participant opens the book and returns with all saved selections intact.
- Refreshing does not change the question set or create a second attempt.
- Two identical final answer sets produce identical scores.
- Tied scores remain tied despite different completion times.
- A publication operator cannot access or change a question key.
- A corrected item produces an auditable, consistently applied recalculation.
- No participant response, report or page source exposes the correct-answer key.

These are planned evidence, not tests already executed. Related: [[08-Proposal-and-Winning-Strategy]], [[10-Discovery-Roadmap-and-Success-Metrics]].


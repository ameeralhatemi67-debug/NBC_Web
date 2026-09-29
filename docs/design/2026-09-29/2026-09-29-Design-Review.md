---
type: decision
tags: [nbc, design, typography, review]
created: 2026-09-29
updated: 2026-09-29
status: selected
---

# September design review

Parent: [[00-Implementation-Index]]. Earlier direction: [[03-Design-and-Technical-Decisions]].

> [!success] Decision received
> The user selected **C. Deep Green & Gold**, requested texture and further motion, and asked for variations of logo B. The application now implements C. The user subsequently selected B3 from the [six logo variations](logo-variations/index.html); it is now applied. The supplied SAR 52,000 award schedule replaces the temporary prize values in the application. See [[16-Committee-Update-and-Design-Decision]] for current implementation and source findings. The original options below are retained as review history.

## Recovery point

Before edits, application code matched commit `044bcf8`, titled `feat: add initial UI and admin components, global styles, and organization assets`. The working tree contained only a pre-existing `.serena/project.yml` change and the untracked font ZIP. No new baseline commit was necessary.

The editor-settings change remains untouched and also has a local patch at `tmp/design-review-2026-09-29/preexisting-settings.patch`. The font ZIP remains at the project root and is now ignored by Git. No font source is included in the review assets. Application edits and review materials remain uncommitted for review.

## Review files

- [Interactive review](index.html) switches the three colour directions, independently selects a logo, offers a narrow layout preview, and demonstrates rotating hero information.
- [Side-by-side comparison](comparison.html) brings the three directions and marks together.
- Desktop captures: [A](option-a.jpg), [B](option-b.jpg), [C](option-c.jpg), and [B on mobile](mobile-b.jpg). The interactive page contains the remaining sections.
- The source is plain HTML, CSS and browser JavaScript. Open `index.html` directly, or serve this directory locally. It makes no external data requests and does not collect registrations.

## Directions to choose from

| Direction | Palette | Intended effect |
|---|---|---|
| A. Pearl and emerald | `#FBFCF8`, `#D5E9DC`, `#17775E`, `#155947` | Light and restrained, close to the cover's white and green |
| B. Parchment and jade | `#F9F4E9`, `#E4D5B2`, `#91AB8E`, `#214F40` | Warm Contemporary Heritage with soft gradients. Recommended |
| C. Deep green and gold | `#113F33`, `#23604B`, `#A9833F`, `#F7F3E8` | A formal dark hero, followed by a light content area |

The full name **مسابقة الانتماء واللحمة الوطنية** is the persistent main heading and header identity. Participating organisations move directly beneath the hero and gain a navigation link. Existing organisation artwork is reused without assigning new sponsor or organiser roles.

The book has direct reading links in navigation, the hero, its cover and the footer, plus a download link. The supplied PDF is available within the private review assets. This is a preview of access, not an accessible searchable reader or confirmation of publication rights.

## Logo choices

| Mark | Name | Idea |
|---|---|---|
| A | ملتقى الصفحات | Two pages meeting. The clearest link to reading and belonging. Recommended |
| B | نسيج الانتماء | Interwoven paths for connection and unity |
| C | رواق المعرفة | A book within a simple architectural arch, continuing the earlier heritage direction |

All three are original editable SVG concepts. Each review card includes small, monochrome and reversed presentations. These are proposals, not official seals or trademark clearance. The typography is identified separately from the original symbols.

## Prizes and motion

The user supplied temporary amounts of 1,000, 2,000 and 3,000. The review assumes Saudi riyals and presents descending amounts across first, second and third place. Both amounts and ordering are visibly provisional. Final categories, eligibility, totals, winner counts and award rules remain unknown.

The hero rotates secondary information every seven seconds: book access, eligible educational stages, and provisional prizes. The competition name and action links stay still. Users can pause or select a message; selecting a message pauses rotation. Rotation also stops on hover, keyboard focus, a hidden tab, or a reduced-motion preference. Reduced-motion preferences suppress entrance animation and book transforms.

## Thmanyah licence and rendering

Reviewed the [official Arabic licence](https://font.thmanyah.com/licenses) on 29 September 2026, checked the bundled English licence's permissions and restrictions, and visually inspected the first five pages of the design guide. The guide distinguishes Serif Display, Serif Text and Sans. The title artwork uses Serif Display Medium, while interactive body text retains Noto Sans Arabic.

The licence permits commercial design and logos but restricts redistribution and extraction of font files, including through web embedding. Ordinary browser font delivery makes files retrievable, even when a build tool renames them. We therefore rendered the title and wordmark locally into PNG artwork. No Thmanyah font is served, converted, modified, or committed. This is a cautious implementation choice pending written clarification, not a legal opinion.

Before live embedding, obtain written confirmation from Thmanyah of the permitted delivery method. A useful question is whether self-hosted WOFF2 in a production website is expressly permitted despite browser access to the file. No message has been sent.

Do not replace all interface text with images. The rendered title has an equivalent accessible heading, but production body text should remain selectable, responsive text once the font decision is resolved.

## Functional change already implemented

The existing registration form now requires **جهة الدراسة**, bounded to 160 characters. The server rejects missing, whitespace-only, non-text and oversized values. Verification persists the value and the participant profile returns it. Committee tables show it beneath the stage, participant search includes it, and CSV reports include a separate column.

An additive nullable database column preserves existing participants. Older records display that their institution was not recorded. A registration verification challenge created just before this change can still complete without a fabricated institution value. No old record is backfilled with an invented school.

Automated validation: six domain tests and 37 integration checks passed. The integration checks cover invalid institution inputs, persistence through verification, report data and CSV output, plus the existing participation/security/recovery flow. Production build and type check passed. The sandbox blocked the unit runner's user-profile lookup; rerunning that command outside the sandbox passed.

Visual verification covered desktop and 390px mobile presentation, all images loading, no horizontal page overflow on the checked mobile view, direction switching, logo switching and manual motion controls. A native PDF link and download are present. Reduced-motion handling is implemented but has not been verified with an operating-system preference change.

## Next decision

B3 is selected and applied. C, the book/hero changes, redesigned account screens and the supplied prize schedule are implemented in the local application. Keep the current demo question bank separate from the newly supplied book until questions are reviewed against it.

## Source record

- Supplied book: `C:/Users/User/Downloads/132558999734371470.pdf`, 66 pages. Cover and introductory pages inspected visually because much of the extracted Arabic text is not usable. No substantive book-content claims are made in these previews.
- Book SHA-256: `EC07EF57E563ADA8BBA244317AEEEF0E34C8CAA0EA7E10BEE228232615DB79FD`.
- Font ZIP SHA-256: `5B16D16A091CDA3B11F8C86DE800793ECB75C78943B7E0091003CDFF514EDE99`.
- Existing organisation artwork: `public/images/organizations/` at baseline commit `044bcf8`.
- Source SQL reference: [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html), fetched through Context7 before the additive column change.

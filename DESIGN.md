# Design System: NBC National Belonging Competition (مسابقة الانتماء واللحمة الوطنية)

Derived on 2026-10-06 from `src/app/globals.css`, `src/app/designs.css`, the participation, reader and admin components, and captured screens of the local demo. It describes what ships today plus the motion and component rules proposed in the Journey Lab review. Where a rule is proposed rather than shipped, it says so.

## 1. Visual Theme & Atmosphere

A dignified, calm reading desk. The product asks a student to read a book and answer questions about it, so the interface stays quiet and lets the book and the question carry the weight. Surfaces are warm paper and cream, text is a deep forest ink, and one olive green marks every action. Copper appears in small moments only (focus rings, hint bars, tickets). The mood is institutional but not cold: generous line height for Arabic, rounded-but-restrained controls, no decoration that does not carry information.

The product ships three interchangeable identities, switched by `data-design` on the root:

- **Original**: warm paper and cream, Naskh display type, 8px radius. The default.
- **Official**: white and cool blue, Frutiger Arabic, 4px radius, a sky-blue top rule on the header.
- **Hybrid**: white with the original greens, Frutiger Arabic, 4px radius.

Direction is right-to-left throughout. The exam is a two-pane desk: the question on the right (where reading starts), the book on the left.

## 2. Color Palette & Roles

Original identity:

- **Warm Parchment (#f7f3e8)**: base paper, panels and inputs.
- **Soft Cream (#f0eadc)**: page ground behind panels, quiet fills.
- **Sand (#e4dac5)**: selected pills, disabled strip cells, borders on warm surfaces.
- **Deep Forest Ink (#193b30)**: all body and heading text.
- **Olive Green (#18523f)**: primary actions, selected option, current question.
- **Deep Olive (#113f33)**: hover and pressed state of the primary action.
- **Aged Copper (#846326)**: focus ring, hint bar accent, the participant ticket border. Never a fill for a main action.
- **Muted Sage Grey (#667267)**: secondary text and instructions.
- **Pale Hairline (#d9dacd)**: borders and dividers.
- **Signal Red (#9a3328)**: errors and incorrect answers, always paired with an icon and the word "غير صحيحة".
- **Correct Green (#256044)** on **Pale Mint (#e8f4ec)**: correct answers and feedback, always paired with an icon and the word "الصحيحة".
- **Hint Cream-Yellow (#fff3cc)** on **Dark Amber (#574516)**: the hint banner in the reader.

Official identity: Pure White (#ffffff), Ice Blue (#f0f7fa), Mist Blue (#dbe6ed), Deep Navy Ink (#17384e), Council Blue (#074572) as the action colour, Sky Teal (#0876a2), Bright Cyan accent (#00a4e0).

Hybrid identity: Pure White (#ffffff), Pale Sage (#eff5f1), Sage (#d9e5dd), the original Forest Ink and Olive, Soft Green (#367356), Leaf accent (#4c9971).

Rule: status is never colour alone. Every correct, incorrect, pending or locked state has an icon and a label.

## 3. Typography Rules

- **Display** (headings, question text): Noto Naskh Arabic, weight 700, in the Original identity. In Official and Hybrid the display voice is the body face (Frutiger Arabic in the product, Noto Sans Arabic as a stand-in off-product). Letter spacing stays at zero for Arabic.
- **Body and controls**: Noto Sans Arabic, weights 400 to 600, 15px at line height 1.7.
- **Scale**: 40, 34, 23 (question text, line height 1.65), 20, 15, 13px. Metadata is 13px, never smaller than 12px.
- **Numbers**: Latin digits, tabular, in a left-to-right isolate (`<bdi dir="ltr">`) whenever two numbers sit around a symbol. A bare "5 / 20" in a right-to-left paragraph renders as "20 / 5".
- **Participant number**: a monospace face at 22px with slight tracking, in a ticket.

## 4. Component Stylings

- **Buttons**: gently rounded (8px original, 4px official and hybrid), 44px minimum height for primary, 36 to 40px for secondary, never under 32px. Primary is solid olive with white text, secondary is paper with a hairline border, ghost has no border. Press feedback is a scale to 0.97 for 120 to 140ms. Hover effects are gated behind `(hover: hover) and (pointer: fine)`.
- **Answer options**: full-width rows, 52px minimum, a lettered badge (أ ب ج د) at the start, no radio circle. Selected: olive border, faint olive wash, filled badge. Correct and incorrect after locking use the signal colours with icon and label. Unchosen options after locking are dimmed.
- **Progress strip (proposed)**: one segmented row, one cell per question, doubling as the question map. Cell states: unvisited, current (2px ink border), correct, incorrect, pending (dashed). Each state carries an icon.
- **Feedback panel**: appears below the options on lock, tinted by result, with the explanation and a chip that opens the source page in the book. Enters with opacity and a 6px rise over 220ms.
- **Book panel**: continuous scroll of pages on a grey-green desk, a single toolbar (contents, page stepper, zoom with real minus and plus, night mode, optional search). On a phone it becomes a draggable lower pane that keeps the question visible.
- **Sheets and dialogs**: used for the irreversible, such as the final review and submit, and for hold-to-confirm admin actions. Radius 12 to 20px, the only place a shadow appears besides the phone book pane.
- **Cards**: border only, 12px radius, never nested. Elevation is declared once, by border.
- **Inputs**: paper fill, 1px hairline, 44px height, label above, helper text below, errors below in signal red.

## 5. Layout Principles

- Two panes on desktop (question 5fr, book 6fr), stacked on narrow containers with the book as a lower pane. Layout responds to the container width, not the viewport, so the same screen works in an iframe, a device frame and a real phone.
- The exam never scrolls the page. The question column scrolls internally and keeps a sticky footer for the main action.
- Spacing is a 4px base. Tight groups inside a card (8 to 12px), generous separation between groups (16 to 24px), more space above a heading than below it.
- Admin screens use one next action at a time, with its preconditions listed above it. Irreversible actions need a hold-to-confirm or a sheet that states the impact.

## 6. Motion

One authored moment: the book opens when a student starts, and closes on the result screen. Everything else is small and functional.

- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` for entering and responding, `cubic-bezier(0.77, 0, 0.175, 1)` for movement across the screen. Never ease-in on interface elements.
- Durations: press 120 to 140ms, colour changes 160ms, feedback reveal 220ms, sheets 240ms, phone book pane snap 260ms, book opening 650ms.
- Do not animate keyboard-initiated actions such as changing question with the arrow keys.
- Animate only transform and opacity, plus clip-path and filter where smooth.
- Popovers scale from 0.96 and from their trigger. Nothing scales from 0.
- Honour `prefers-reduced-motion`: collapse transitions to near zero, open the book instantly, stop idle motion.

## 7. Open decisions

- In-book search changes difficulty. It is a committee decision, not a design one.
- The Frutiger Arabic face is licensed to the product and is not available on public font hosts, so off-product mock-ups substitute Noto Sans Arabic.

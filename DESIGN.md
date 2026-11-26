# DESIGN.md - SuiteSpot look and feel

The single source of truth for how SuiteSpot looks. If code and this file disagree, this file wins; change this file
first, then the code. Decided 26 Nov 2026 by Aleksa (Era and Spade concepts in `design/concepts/` are superseded).

**Writing rule:** no long dashes anywhere (UI text, docs, comments). Use a plain hyphen `-` or rewrite the sentence.

## 0. Where the style comes from
Aleksa supplied reference shots of a soft, airy project-management UI (not stored in the repo). We take its **style and
layout only**: floating white sidebar with round icon buttons, soft warm-to-lilac gradient, pill tabs, collapsible
translucent section cards with a white title pill and a count circle, a quiet table inside each section, small colored
pills, lots of white space. We do **not** take its name, logo, people photos, copy or its coral brand color.

## 1. Principles
1. **Calm, finance-grade.** Soft surfaces, few colors, lots of air. The data is the loudest thing on the screen.
2. **Color means something.** Purple = brand and "active". Red = hard flag and danger only. Amber = soft flag and
   "check before signing" only. Grey with a dashed border = estimate only. Never use these colors for decoration.
3. **Every number shows where it came from.** A number without a source label is a bug.
4. **Parallel work is visible.** Agent icons appear on the candidate they are working on, live.
5. **Light mode only** for the hackathon. One theme done well.

## 2. Typography
- **Font: Hanken Grotesk** (Google Fonts), free substitute for HK Grotesk by the same designer, Alfredo Marco Pradil
  (Hanken Design Co.). **License: SIL Open Font License 1.1** (free to use, embed and ship; credit it in the README).
  Load weights 400, 500, 600, 700. Fallback: `ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`.
- Numbers in tables and money: `font-variant-numeric: tabular-nums` so columns line up.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-display` | 28 / 34 px | 600 | Page title ("Live research") |
| `text-title` | 18 / 24 px | 600 | Section title inside the white pill, report headings |
| `text-body` | 14 / 20 px | 400 | Table cells, body text |
| `text-body-strong` | 14 / 20 px | 500 | Candidate name in the first column, button labels |
| `text-small` | 13 / 18 px | 400 | Breadcrumb, secondary lines (address under a name) |
| `text-label` | 12 / 16 px | 500 | Table column headers, pills, count circle |
| `text-micro` | 11 / 14 px | 500 | Source labels (`listing`, `calc`, ...) |

Letter spacing: 0 everywhere, `-0.01em` on `text-display`. Sentence case everywhere, no ALL CAPS.

## 3. Color
### 3.1 Tokens
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0B0F` | Main text, primary button fill, icons |
| `ink-2` | `#52525E` | Secondary text, breadcrumb, source labels |
| `ink-3` | `#6B6B78` | Table column headers, placeholder text. **Only on cards or white, never on the raw gradient** (3.94:1 there) |
| `line` | `#E7E3EE` | Hairlines, table row dividers (optional), input borders |
| `white` | `#FFFFFF` | Sidebar, pills, round buttons, inputs |
| `surface` | `rgba(255,255,255,0.60)` | Section cards (translucent over the gradient, 60% minimum) |
| `bg-from` | `#FCE3DC` | Page gradient, top left (soft pink-red) |
| `bg-to` | `#E6DAFA` | Page gradient, bottom right (soft lilac) |
| `purple-600` | `#6A3FD3` | **Brand.** Active tab fill, active sidebar button, count circle, links, focus ring |
| `purple-700` | `#5629B8` | Text on purple tint, hover on purple fills |
| `purple-100` | `#EFE6FD` | Purple tint pills, selected row background |
| `lavender` | `#C19BE9` | Decorative only (gradient accents, illustrations). Never behind text |
| `red-600` | `#C8281C` | **Hard flag and danger only.** Fill with white text |
| `red-700` | `#A51C12` | Hard flag text on tint |
| `red-50` | `#FDE9E7` | Hard flag pill background, rejected row tint |
| `amber-400` | `#F5A524` | **Soft flag only.** Fill with ink text (count circle of "Check before signing") |
| `amber-800` | `#8A3B07` | Soft flag text on tint |
| `amber-50` | `#FEF1D6` | Soft flag and "check before signing" pill background |
| `est-text` | `#4A4A55` | Estimate value text |
| `est-bg` | `#F3F3F5` | Estimate chip background |
| `est-border` | `#84848F` | Estimate chip border, **1px dashed** |
| `green-700` | `#0B6B3A` | Positive verdict text only ("within budget", "passes") |
| `green-50` | `#E3F7EA` | Positive verdict pill background |

Page background: `linear-gradient(135deg, #FCE3DC 0%, #F3DEEC 45%, #E6DAFA 100%)`, fixed to the viewport
(`background-attachment: fixed`) so cards scroll over it.

### 3.2 Contrast check (WCAG 2.1 AA, computed 26 Nov 2026)
Text needs 4.5:1 (3:1 for 18 px+ or 14 px bold); UI parts such as borders and focus rings need 3:1. Translucent cards
were checked as white 60% over each gradient end: `#FEF4F1` (warm side) and `#F5F0FD` (lilac side, the worse one).

| Pair | Ratio | Result |
|---|---|---|
| `ink` on gradient (both ends) | 16.05 / 14.76 | AA |
| `ink-2` on card (lilac side) / on raw gradient | 6.88 / 5.78 | AA |
| `ink-3` on card (lilac side) | 4.69 | AA |
| `ink-3` on raw gradient | 3.94 | **Fails for small text: do not use there** |
| white on `ink` (primary button) | 19.64 | AA |
| white on `purple-600` (active tab, count circle) | 6.43 | AA |
| `purple-700` on `purple-100` (purple pill) | 7.24 | AA |
| `purple-600` on card / on raw gradient (links) | 5.75 / 4.83 | AA |
| white on `lavender` | 2.30 | **Fails: lavender is decorative only** |
| white on `red-600` (hard flag fill) | 5.56 | AA |
| `red-700` on `red-50` (hard flag pill) | 6.48 | AA |
| `ink` on `amber-400` (soft flag fill) | 9.63 | AA |
| `amber-800` on `amber-50` (soft flag pill) | 6.93 | AA |
| `est-text` on `est-bg` (estimate) | 7.89 | AA |
| `green-700` on `green-50` | 5.90 | AA |
| `est-border` on `est-bg` / on card (UI, 3:1) | 3.34 / 3.30 | AA |
| `purple-600` focus ring on card (UI, 3:1) | 5.75 | AA |

Color is never the only signal: every flag pill also has an icon and a word ("Hard flag", "Check before signing").

## 4. Shape, spacing, elevation
- **Spacing scale (4 px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48. Default gap inside a card: 16. Between section
  cards: 12. Page padding: 24 (16 on narrow screens).
- **Radii:** sidebar 28 px; section card 24 px; candidate card (Cards view) 20 px; inputs and search 9999 (pill);
  buttons, tabs, pills and count circles 9999; round icon buttons are circles.
- **Elevation:** almost flat. Only white controls lift a little.
  - `shadow-soft`: `0 1px 2px rgba(11,11,15,0.04), 0 4px 12px rgba(11,11,15,0.05)` on the sidebar, round buttons,
    pills, search.
  - Section cards: no shadow, `1px solid rgba(255,255,255,0.7)` border, `backdrop-filter: blur(16px)`.
  - Menus and popovers: `0 12px 32px rgba(11,11,15,0.12)`, white, radius 16.
- **Hit targets:** 40 px minimum (round icon buttons 44 px).

## 5. App shell
```
+--------+--------------------------------------------------------------+
|        | Home > Live research                                         |
|  (S)   | Live research                [agents stack] [Search..] [New research] |
|        | [Cards] [Table] [Timeline]                      (settings) (...)     |
|  (o)   | +----------------------------------------------------------+ |
|  (o)   | | v ( Evaluating (3) )                                      | |
|  (o)   | |   Candidate   Monthly cost   Rent share   Flags   Agents  | |
|  (o)   | |   ...                                                     | |
|  (o)   | +----------------------------------------------------------+ |
|        | +----------------------------------------------------------+ |
|  (>)   | | > ( Rejected (1) )                                        | |
+--------+--------------------------------------------------------------+
```
- **Sidebar:** floating white panel, 88 px wide, radius 28, 16 px from the window edges, full height, `shadow-soft`.
  Top: the SuiteSpot mark (a simple purple monogram "S" in a 48 px circle, our own, no photo). Then the nav buttons,
  44 px white circles with an ink icon, 16 px apart. **Active:** filled `purple-600`, white icon. Hover: `purple-100`.
  Each button has a tooltip and an `aria-label` with its name. Bottom: a round "collapse" chevron button.
- **Header (top left):** breadcrumb in `text-small`, `ink-2`, with a `>` chevron; under it the page title in
  `text-display`.
- **Header (top right):** the agent stack (see 6.8), a search pill (white, 240 px, magnifier icon, placeholder
  "Search candidates..."), round settings and more buttons, and the **primary black button "New research"**.
- **Tabs row:** pill tabs under the title (see 6.2).
- Content max width 1360 px; below 1024 px the sidebar becomes a bottom bar of the same round buttons.

## 6. Components
### 6.1 Buttons
- **Primary:** `ink` fill, white text `text-body-strong`, height 40, padding 0 18, radius pill, leading icon 16 px.
  Hover: `#26262E`. One primary button per screen.
- **Secondary:** white fill, ink text, `shadow-soft`, same size. Hover: `purple-100` fill.
- **Round icon button:** 40 px (44 in the sidebar) white circle, ink icon 18 px, `shadow-soft`.
- **Danger action** (rare, for example "Reject candidate" by a human): white fill, `red-700` text and icon; only the
  confirm step uses the `red-600` fill.
- Focus: 2 px `purple-600` ring with 2 px offset on every interactive element.

### 6.2 Tabs (pill)
Height 36, padding 0 16, radius pill, icon 16 px + label `text-body-strong`, 8 px apart.
Inactive: white fill, ink text, `shadow-soft`. **Active: `purple-600` fill, white text and icon.**
Our tabs: **Cards** (grid icon), **Table** (list icon), **Timeline** (chart-line icon).

### 6.3 Section card (collapsible group)
- Translucent `surface` card, radius 24, padding 16 24 24.
- Header row: chevron button (rotates 90 degrees when collapsed), then the **title pill**: white, radius pill,
  padding 6 14, `text-title`, `shadow-soft`, followed inside the pill by the **count circle**: 20 px circle,
  `text-label`, white text on `purple-600` (or the status color, see 7.3).
- Right side of the header: optional summary in `text-small` `ink-2` (for example "2 of 8 candidates"), no "+" button.
- Collapsed: only the header row shows, card height 56. Collapse and expand animate height in 200 ms.

### 6.4 Table (inside a section card)
- No outer border, no zebra stripes, no vertical lines. Column headers in `text-label`, `ink-3`, 12 px below the
  section header. Rows 52 px high, cells `text-body`, vertical center, 16 px horizontal padding.
- Optional 1 px `line` divider between rows only when a table has more than 6 rows.
- Row hover: white at 50%. Selected row: `purple-100`.
- First column: candidate name in `text-body-strong`, a second line in `text-small` `ink-2` (area, m2, floor).
- Last column: a "more" button (three dots), opens a menu.
- Money and percentages right aligned, tabular numbers, each followed by its source label (6.6).

### 6.5 Pills (tags)
Height 24, padding 0 10, radius pill, `text-label`. Variants:
| Variant | Fill / text | Use |
|---|---|---|
| neutral | white / `ink` with `shadow-soft` | business type, aspect ("Finance", "Location") |
| brand | `purple-100` / `purple-700` | status "Evaluating", selected filters |
| hard | `red-50` / `red-700`, alert-octagon icon | "Hard flag: over budget" |
| soft | `amber-50` / `amber-800`, alert-triangle icon | "Check before signing: power supply" |
| positive | `green-50` / `green-700`, check icon | "Within budget" |
| solid hard | `red-600` / white | the one "Rejected" badge on a candidate |

### 6.6 Source label (on every number)
- A tiny pill right after the value: `text-micro`, `ink-2`, white 80% fill, 1 px `line` border, radius pill,
  padding 0 6, height 18. Text is the source kind: `listing`, `profile`, `osm`, `calc`, `est`, `lease`, `assumption`.
- Hover or focus shows a popover with the exact reference (pasted listing number and line, OSM element id, calculator
  formula and inputs, assumption key in `config/weights.json`).
- **Estimates:** the whole value sits in an estimate chip: `est-bg` fill, **1 px dashed `est-border`**, `est-text`,
  radius 8, padding 2 8, and the source label `est`. Example: `850-1,100 EUR` with `est`. The popover shows the
  method and the comparables used.
- **Missing data:** the text "missing data" in `ink-3` italic, no number, no chip.

### 6.7 Flags in context
- Hard flag on a candidate: the candidate row gets a `red-50` tint and a solid "Rejected" badge; the hard flag pill
  names the agent that raised it ("by Finance analyst").
- Soft flag: amber pill in the Flags column; hard and soft never share one pill.

### 6.8 Agent icons and the agent stack
- Every participant has one icon (lucide, see 9): Interviewer `message-circle-question`, Scout `search`, Finance
  analyst `calculator`, Lease reader `file-text`, Location analyst `map-pin`, Premises inspector `building-2`, Auditor
  `shield-check`, Ranker `list-ordered`.
- Icon chip: 32 px white circle, ink icon 16 px, `shadow-soft`. **Busy:** 2 px `purple-600` ring and a slow pulse
  (1.6 s). **Idle:** icon in `ink-3`, no ring. **Halted (agent error):** `ink-3` icon with a small grey "x" dot.
- **"Agents" column** in the table: overlapping chips (minus 8 px overlap) of the agents working on that candidate
  right now. This shows live parallel work. Chips enter and leave with a 150 ms fade.
- **Agent stack** top right: all participants in the room as overlapping chips plus a counter pill
  "4 busy, peak 6". Click opens the Timeline tab.

### 6.9 Cards view
A responsive grid (min 300 px columns, gap 16) of candidate cards inside each section card: white 80%, radius 20,
padding 20. Shows name, the key numbers with source labels (monthly cost, rent share of revenue, exit cost after 12
months), flag pills, the agent chips and the score.

### 6.10 Timeline view (agent lanes over time)
- One lane per agent loop, grouped by agent, 28 px high, label column 200 px (agent icon + candidate name).
- Bars: radius pill, `purple-100` fill with `purple-600` 2 px left edge while the loop runs; tool calls as small
  `purple-600` dots on the bar; a stopped loop ends with a red-600 "x" marker at the cancellation time.
- Time axis in `text-label` `ink-3`, seconds since start. A vertical `ink` hairline marks "now" during a live run.
- Above the lanes, a pill with "peak N loops in parallel".

### 6.11 Notices
- **Not financial or legal advice:** a white pill banner with an info icon at the top of every report, plus the same
  line in the report footer. Text: "Not financial or legal advice. SuiteSpot shows numbers with their sources; the
  decision is yours."
- **Demo data:** a `purple-100` / `purple-700` pill "Demo data" next to the page title whenever synthetic records are
  shown.

### 6.12 Inputs (questionnaire, listing paste)
White fill, radius 16 (textareas) or pill (single-line inputs), 1 px `line` border, height 44, `text-body`. Focus:
`purple-600` border plus focus ring. Labels above in `text-label` `ink`. Errors: `red-700` text under the field with
an icon. The listing paste screen shows 1 to 8 white cards, each with a textarea for the listing text and an optional
"Add lease draft" textarea.

## 7. Mapping to SuiteSpot screens
### 7.1 Sidebar (top to bottom)
| Item | Icon (lucide) | Screen |
|---|---|---|
| New research | `plus` | Questionnaire, mode choice, listing paste |
| Live research | `activity` | Live research (the demo hero) |
| Reports | `file-bar-chart` | Ranked report of the selected run |
| History | `history` | History list and detail |
| Assumptions | `sliders-horizontal` | "SuiteSpot assumptions" from `config/weights.json` |

### 7.2 Header
- Breadcrumb: `Home > Live research` (or `> Reports > <run name>`).
- Primary black button: **"New research"** (`plus` icon) on every screen except New research itself.

### 7.3 Sections (candidates grouped by status)
Order and count-circle color:
| Section | Count circle | Default | Contains |
|---|---|---|---|
| Pending | `ink-3` fill, white text | expanded | Candidates found, not yet evaluated |
| Evaluating | `purple-600` | expanded | At least one evaluator loop running |
| Check before signing | `amber-400`, ink text | expanded | Scored, but with one or more soft flags |
| Scored | `purple-600` | expanded | Scored, no open soft flags |
| Rejected | `red-600` | collapsed | A hard flag cancelled the candidate |

Note: "Check before signing" is a **view group**, not a domain status. The domain statuses stay
`pending | evaluating | rejected | scored`; the UI puts a scored candidate with soft flags into this group.

### 7.4 Table columns (Live research and Reports)
Candidate (name + area, m2, floor) / Monthly cost / Rent share of revenue / Exit cost after 12 months / Flags /
Agents (live chips) / Score / more. Reports drop the Agents column and add Rank.

## 8. Motion
- Durations: 150 ms (hover, chips), 200 ms (collapse, tabs), 300 ms (a candidate moving to another section, with a
  layout animation so the eye follows it).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- `prefers-reduced-motion`: no pulse, no layout animation, instant changes.

## 9. Assets and libraries
- Icons: **lucide** (`lucide-react`, ISC license), 1.75 px stroke. Not installed yet; add it when the UI is built.
  Icon names in this file follow lucide.dev; a few were renamed between lucide versions, so check each name against
  the installed version and keep the closest match.
- Font: Hanken Grotesk via Google Fonts (OFL 1.1).
- No photos of people, no stock images. Agents are icons, the brand is a monogram.
- Credit both in the README.

## 10. Tokens for Tailwind 4 (`web/src/index.css`)
To be pasted when the design pass starts (not applied yet):
```css
@import url("https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap");
@import "tailwindcss";

@theme {
  --font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif;
  --color-ink: #0B0B0F;
  --color-ink-2: #52525E;
  --color-ink-3: #6B6B78;
  --color-line: #E7E3EE;
  --color-bg-from: #FCE3DC;
  --color-bg-to: #E6DAFA;
  --color-purple-600: #6A3FD3;
  --color-purple-700: #5629B8;
  --color-purple-100: #EFE6FD;
  --color-lavender: #C19BE9;
  --color-red-600: #C8281C;
  --color-red-700: #A51C12;
  --color-red-50: #FDE9E7;
  --color-amber-400: #F5A524;
  --color-amber-800: #8A3B07;
  --color-amber-50: #FEF1D6;
  --color-est-text: #4A4A55;
  --color-est-bg: #F3F3F5;
  --color-est-border: #84848F;
  --color-green-700: #0B6B3A;
  --color-green-50: #E3F7EA;
  --radius-card: 24px;
  --radius-sidebar: 28px;
  --shadow-soft: 0 1px 2px rgba(11, 11, 15, 0.04), 0 4px 12px rgba(11, 11, 15, 0.05);
}
```

# DESIGN.md - SuiteSpot look and feel

The single source of truth for how SuiteSpot looks. If code and this file disagree, this file wins; change this file
first, then the code. Decided 26 Nov 2026 by Aleksa (Era and Spade concepts in `design/concepts/` are superseded).
Logo decided 27 Nov 2026 by Aleksa.

**Writing rule:** no long dashes anywhere (UI text, docs, comments). Use a plain hyphen `-` or rewrite the sentence.

## 0. Where the style comes from
Aleksa supplied reference shots of a soft, airy project-management UI (not stored in the repo). We take its **style,
layout and colours** (revised 26 Nov after a side-by-side comparison): a floating white glass sidebar with round icon
buttons, a warm coral-pink to lilac gradient with soft colour blobs, pill tabs, frosted-glass section cards with a
white title pill and a count circle, a quiet table inside each section, small coloured pills, lots of air. We do
**not** take its name, logo, people photos or copy. Changes from the reference, on purpose: the orange is pushed
towards coral red, and text on coral or lilac is black (white text there fails WCAG AA, see 3.2).

## 1. Principles
1. **Calm, finance-grade, iOS-soft.** Glass surfaces, few colours, lots of air. The data is the loudest thing.
2. **Colour means something.** Coral = brand and "active". Lilac = demo data and agent work in progress. Dark red =
   hard flag only, always with an icon and the words "Hard flag", never colour alone. Amber = soft flag and "check
   before signing" only. Grey with a dashed border = estimate only.
3. **Every number shows where it came from.** A number without a source label is a bug.
4. **Parallel work is visible.** Agent icons appear on the candidate they are working on, live.
5. **Light mode only** for the hackathon. One theme done well.

## 2. Typography
- **Font: Hanken Grotesk** (Google Fonts), free substitute for HK Grotesk by the same designer, Alfredo Marco Pradil
  (Hanken Design Co.). **License: SIL Open Font License 1.1** (free to use, embed and ship; credit it in the README).
  Load weights 400, 500, 600, 700. Fallback: `ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`.
  Checked in the browser on 26 Nov: `document.fonts.check("600 28px Hanken Grotesk")` is true, so the real font is
  used, not the fallback.
- Numbers in tables and money: `font-variant-numeric: tabular-nums` so columns line up.

| Token | Size / line height | Weight | Letter spacing | Use |
|---|---|---|---|---|
| `text-display` | 28 / 34 px | 600 | -0.025em | Page title ("Live research") |
| `text-title` | 18 / 24 px | 600 | -0.015em | Section title inside the white pill (`.title-pill`) |
| `text-body` | 14 / 20 px | 400 | 0 | Table cells, body text |
| `text-body-strong` | 14 / 20 px | 500 | 0 | Candidate name, button labels |
| `text-small` | 13 / 18 px | 400 | 0 | Breadcrumb, secondary lines |
| `text-label` | 12 / 16 px | 500 | 0 | Table column headers, pills, count circle |
| `text-micro` | 11 / 14 px | 500 | 0 | Source labels (`listing`, `calc`, ...) |

Sentence case everywhere, no ALL CAPS.

## 3. Color
### 3.1 Tokens
| Token | Value | Use |
|---|---|---|
| `ink` | `#0B0B0F` | Main text, primary button fill, text on coral and lilac |
| `ink-2` | `#4A4A56` | Secondary text, breadcrumb |
| `ink-3` | `#5A5A66` | Table column headers, placeholders. On glass only |
| `line` | `rgba(11,11,15,0.08)` | Hairlines, input borders |
| `white` | `#FFFFFF` | Text on black and on dark red, icons on coral |
| `brand` | `#F25C54` | **Brand coral.** Active tab, active sidebar button, count circles, tool dots, busy ring. Text on it is `ink` |
| `brand-600` | `#E5483F` | Hover on brand fills |
| `brand-50` | `#FDE7E3` | Brand tint |
| `brand-soft` | `#F6857B` | Active sidebar item and the account avatar while Settings is open (a lighter coral that matches the other oranges) |
| `lilac` | `#C19BE9` | Answer source pill ("Recorded run" / "Scripted demo answers"), running bars on the Timeline. Text on it is `ink` |
| `lilac-600` | `#8F5FD0` | Left edge of a running Timeline bar |
| `lilac-100` | `#EEE3FB` | Lilac tint |
| `hard` | `#9F1B12` | **Hard flag only**, darker than the brand. Fill with white text, or text on `hard-50`; always with the octagon icon |
| `hard-50` | `#FDE4E1` | Hard flag pill background, rejected row tint |
| `amber-400` | `#F5A524` | Soft flag fill (count circle of "Check before signing"), ink text |
| `amber-800` / `amber-50` | `#8A3B07` / `#FEF1D6` | Soft flag pill text / background |
| `green-700` / `green-50` | `#0B6B3A` / `#E3F7EA` | Positive (high confidence, within budget) |
| `est-text` / `est-bg` / `est-border` | `#4A4A55` / `#F3F3F5` / `#84848F` | Estimates, 1 px dashed border |

**Page background** (on `html`, fixed, so the cards scroll over it): a linear gradient `to top right` from coral
pink `#F7A48C` through `#F7C3C0` and `#F1D2E4` to lilac `#D9BFF4`, with soft radial blobs: coral `#F67B56` at the
bottom left (62%), a coral band on the left edge, a light peach glow at the top left (`#FBD6C8`), lilac `#C19BE9` at
the top right (95%), a pink-lilac glow at the centre right, and a white haze in the middle so the cards stay calm.

### 3.2 Contrast check (WCAG 2.1 AA, computed 26 Nov 2026)
Text needs 4.5:1, UI graphics (icons, borders) 3:1. Glass was checked as white 50% over the coral, pink and lilac
areas of the gradient (`#FBD2C7`, `#FAE1E7`, `#ECDFFA`).

| Pair | Ratio | Result |
|---|---|---|
| white on `brand` `#F25C54` | 3.26 | **Fails for text**, passes for icons (3:1): the active sidebar icon may be white, tab text may not |
| `ink` on `brand` | 6.02 | AA: active tab text and count circle digits are black |
| white on the reference orange `#F67B56` | 2.66 | Fails: one more reason to change it |
| `ink` on `lilac` `#C19BE9` | 8.54 | AA |
| white on `hard` `#9F1B12` | 7.96 | AA |
| `hard` on `hard-50` | 6.58 | AA |
| `ink-2` on glass (coral / pink / lilac areas) | 5.91 / 6.63 / 6.44 | AA |
| `ink-3` on glass (coral / pink / lilac areas) | 4.90 / 5.50 / 5.34 | AA |
| `ink-2` on the raw saturated coral `#F7A58E` | 4.19 | Fails: text never sits there; the top left (breadcrumb, title) is light peach |
| `amber-800` on `amber-50`, `green-700` on `green-50`, `est-text` on `est-bg` | 6.93 / 5.90 / 7.89 | AA |

Colour is never the only signal: every flag pill also has an icon and a word ("Hard flag", "Check before signing").

## 4. Shape, spacing, glass
- **Spacing scale (4 px base):** 4, 8, 12, 16, 20, 24, 28, 32, 40, 48. Between section cards: 16. Section padding:
  20 top, 28 sides, 24 bottom. Table rows 56 px. Page padding 24.
- **Radii (iOS feel, larger):** sidebar 32 px; section card 28 px; candidate card and listing card 24 px; textareas
  18 px; buttons, tabs, pills, count circles and the search field are full pills; round icon buttons are circles.
- **Glass** (`.glass`, section cards): `rgba(255,255,255,0.56)`, `backdrop-filter: blur(28px) saturate(170%)`,
  `1px solid rgba(255,255,255,0.62)`, an inner top highlight `inset 0 1px 0 rgba(255,255,255,0.8)`, a 1 px inner
  glow, and almost no shadow (`0 1px 2px rgba(11,11,15,0.03)`). The gradient must stay visible through it.
- **Strong glass** (`.glass-strong`: sidebar, pills, title pills, search, round buttons, candidate cards):
  `rgba(255,255,255,0.78)`, `blur(24px) saturate(160%)`, `1px solid rgba(255,255,255,0.85)`, inner top highlight,
  a whisper of shadow.
- Both live in `@layer components` so Tailwind utilities (for example `hover:bg-white`) can override them.
- Menus and popovers: white, radius 16, `0 12px 32px rgba(11,11,15,0.12)`.
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
  Top: the SuiteSpot mark: a magnifying glass with a short handle (coral ring, black handle) and an isometric
  commercial building inside the lens, our own, no photo; file `design/brand/suitespot-logo.svg`. In the app it
  is `web/public/suitespot-logo.svg`, shown at 56 px with no circle behind it, centred over the nav buttons and linked
  to Home ("SuiteSpot home"); hidden in the bottom bar on narrow screens. The same SVG is the favicon, with
  `favicon-64.png` as the PNG fallback. Then the nav buttons,
  44 px strong-glass circles with an ink icon, 16 px apart. **Active:** filled `brand`, white icon (an icon, 3:1 is enough). Hover: white.
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
- **Secondary:** strong glass, ink text, same size. Hover: white.
- **Round icon button:** 40 px (44 in the sidebar) white circle, ink icon 18 px, `shadow-soft`.
- **Danger action** (rare, for example "Reject candidate" by a human): strong glass, `hard` text and icon; only the
  confirm step uses the `hard` fill.
- Focus: 2 px `ink` outline with 2 px offset on every interactive element.

### 6.2 Tabs (pill)
Height 36, padding 0 16, radius pill, icon 16 px + label `text-body-strong`, 8 px apart.
Inactive: strong glass, ink text. **Active: `brand` fill, ink text and icon** (white text on coral fails AA).
Our tabs: **Cards** (grid icon), **Table** (list icon), **Timeline** (chart-line icon).

### 6.3 Section card (collapsible group)
- Translucent `surface` card, radius 24, padding 16 24 24.
- Header row: chevron button (rotates 90 degrees when collapsed), then the **title pill**: white, radius pill,
  padding 6 14, `text-title`, `shadow-soft`, followed inside the pill by the **count circle**: 20 px circle,
  `text-label`, ink text on `brand` (or the status colour, see 7.3).
- Right side of the header: optional summary in `text-small` `ink-2` (for example "2 of 8 candidates"), no "+" button.
- Collapsed: only the header row shows, card height 56. Collapse and expand animate height in 200 ms.

### 6.4 Table (inside a section card)
- No outer border, no zebra stripes, no vertical lines. Column headers in `text-label`, `ink-3`, 12 px below the
  section header. Rows 52 px high, cells `text-body`, vertical center, 16 px horizontal padding.
- Optional 1 px `line` divider between rows only when a table has more than 6 rows.
- Row hover: white at 50%. Selected row: `lilac-100`.
- First column: candidate name in `text-body-strong`, a second line in `text-small` `ink-2` (area, m2, floor).
- Last column: a "more" button (three dots), opens a menu.
- Money and percentages right aligned, tabular numbers, each followed by its source label (6.6).

### 6.5 Pills (tags)
Height 24, padding 0 10, radius pill, `text-label`. Variants:
| Variant | Fill / text | Use |
|---|---|---|
| neutral | strong glass / `ink` | "no rent stated", counts, metrics |
| brand | `lilac` / `ink` | "Demo data", peak loops |
| hard | `hard-50` / `hard`, octagon icon, text starts with "Hard flag" | "Hard flag: monthly cost over budget" |
| soft | `amber-50` / `amber-800`, triangle icon | "Check before signing: personal guarantee" |
| positive | `green-50` / `green-700`, check icon | high confidence |
| solid hard | `hard` / white, octagon icon | the "Rejected" badge on a candidate |

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
- Icon chip: 32 px white circle, ink icon 16 px, strong glass. **Busy:** 2 px `brand` ring and a slow pulse
  (1.6 s). **Idle:** icon in `ink-3`, no ring. **Halted (agent error):** `ink-3` icon with a small grey "x" dot.
- **"Agents" column** in the table: overlapping chips (minus 8 px overlap) of the agents working on that candidate
  right now. This shows live parallel work. Chips enter and leave with a 150 ms fade.
- **Agent stack** top right: all participants in the room as overlapping chips plus a counter pill
  "4 busy, peak 6". Click opens the Timeline tab.
- **The counter shows only real values from runtime events, never hand-written numbers.** "busy" = loops started
  (`message_received.started`) minus loops finished or stopped, counted per `loopId`; "peak" = the highest "busy"
  value seen in this run. Before the first event the pill shows "0 busy". The same rule applies to "peak N loops in
  parallel" on the Timeline and to every run metric on the report.
- **Reduced motion:** with `prefers-reduced-motion: reduce` the busy ring does not pulse; it stays a static 2 px
  `brand` ring, so "busy" is still visible.

### 6.9 Cards view
A responsive grid (min 300 px columns, gap 16) of candidate cards inside each section card: white 80%, radius 20,
padding 20. Shows name, the key numbers with source labels (monthly cost, rent share of revenue, exit cost after 12
months), flag pills, the agent chips and the score.

### 6.10 Timeline view (agent lanes over time)
- One lane per agent loop, grouped by agent, 28 px high, label column 200 px (agent icon + candidate name).
- Running bars: radius pill, `lilac` 60% fill with a 2 px `lilac-600` left edge and a small pulsing coral dot at the
  growing end. Tool calls: coral dots, the waiting time as a coral 35% segment. A cut loop: `hard` 25% fill with a
  `hard` edge and a dark red "x" marker at the cancellation time.
- Rejections: a dashed `hard` line plus a label "Hard flag: demo-07 rejected" with the octagon icon, in its own row
  above the time axis (it never covers the axis).
- Time axis in `text-label` `ink-3`, seconds since start. A vertical `ink` hairline marks "now" during a live run.
- Above the lanes, a lilac pill with "peak N loops in parallel".

### 6.11 Notices
- **Not financial or legal advice:** a white pill banner with an info icon at the top of every report, plus the same
  line in the report footer. Text: "Not financial or legal advice. SuiteSpot shows numbers with their sources; the
  decision is yours."
- **Demo data:** a `lilac` / `ink` pill "Demo data" next to the page title whenever synthetic records are
  shown.

### 6.12 Inputs (questionnaire, listing paste)
White fill, radius 16 (textareas) or pill (single-line inputs), 1 px `line` border, height 44, `text-body`. Focus:
`brand` border plus focus outline. Labels above in `text-label` `ink`. Errors: `hard` text under the field with
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
| Evaluating | `brand`, ink digits | expanded | At least one evaluator loop running |
| Check before signing | `amber-400`, ink text | expanded | Scored, but with one or more soft flags |
| Scored | `brand`, ink digits | expanded | Scored, no open soft flags |
| Rejected | `hard`, white digits | **expanded** | A hard flag cancelled the candidate |

**Rejected is expanded by default: it is the key moment of the demo.** Every rejected row shows the hard flag reason
(the hard pill with the claim, its source label and "by <agent>") and the agents whose loops were cancelled on that
candidate: their icon chips in `ink-3` with a small `hard` "x" dot and the word "cancelled", plus the time from
the flag to the stop (for example "stopped 2 loops in 31 ms").

Note: "Check before signing" is a **view group**, not a domain status. The domain statuses stay
`pending | evaluating | rejected | scored`; the UI puts a scored candidate with soft flags into this group.

### 7.4 Table columns (Live research and Reports)
Candidate (name + area, m2, floor) / Monthly cost / Rent share of revenue / Exit cost after 12 months / Flags /
Agents (live chips) / Score / more. Reports drop the Agents column and add Rank.

### 7.5 Sign in page (concept 27 Nov, BUILT 27 Nov: `web/src/pages/AuthScreen.tsx`; no guest button and no Demo pills in the build)
Files: `design/login/suitespot-login-mockup.png` (static mockup) and `design/login/suitespot-login-animacija.mp4`
(the animation).
- **Left:** a white glass card. Logo + "SuiteSpot" top left; "Welcome back" with "Sign in to save spaces and publish
  your listings."; Email and Password fields; black "Sign in" button; white "Continue as guest" button; "Don't have
  an account? Sign up"; footer "© 2026 SuiteSpot · Not financial or legal advice". No "Remember me" and no "Forgot
  password" until we check that our Supabase sign in supports them.
- **Right:** an animated map in the DESIGN.md colours that slides slowly; the magnifying glass from the logo stops
  over the coral dots (listings), the building from the logo pops up with a pill naming the listing (for example
  "Liman 1 · 77 m2"); pills "Demo data" and "100 synthetic listings" at the bottom.
- **Build suggestion:** SVG + CSS/JS animation; with `prefers-reduced-motion` a static image. The existing auth
  routes and logic do not change.

## 8. Motion
- Every interactive element (buttons, links, inputs, tabs) transitions background, colour, border, shadow, opacity and
  transform in **200 ms** with the iOS ease `cubic-bezier(0.2, 0, 0, 1)`; buttons scale to 0.97 while pressed.
- Agent chips fade and scale in (200 ms); the busy ring pulses coral (1.6 s).
- `prefers-reduced-motion: reduce`: all transitions off, no pulse (a static ring instead), no press scale.

## 9. Assets and libraries
- Icons: **lucide** (`lucide-react` 1.72.0, ISC license), 1.75 px stroke.
  Icon names in this file follow lucide.dev; a few were renamed between lucide versions, so check each name against
  the installed version and keep the closest match.
- Font: Hanken Grotesk via Google Fonts (OFL 1.1).
- No photos of people, no stock images. Agents are icons. The brand files are in `design/brand/`:
  `suitespot-logo.svg` (the logo), `suitespot-logo-1024.png` (PNG, 1024 px), `favicon-64.png` (favicon, 64 px) and
  `suitespot-logo-reveal.mp4` (logo reveal video, 1920x1080, 30 fps, 7 s, for the demo video).
- Credit both in the README.

## 10. Tokens for Tailwind 4
The tokens, gradient, glass classes and motion rules are implemented in `web/src/index.css` (`@theme` block and
`@layer components`). That file must match this document; change this document first.


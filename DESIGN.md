# DESIGN.md — CareLoop Frontend Build Guide

This is the implementation-ready design reference for the CareLoop hackathon build. Anyone writing frontend code should read this before starting. It consolidates the design system, layout structure, component specs, and copy rules into one buildable reference.

---

## 1. Core Idea (read this first)

**The timeline is the product.** Before / During / After are not tabs or separate screens — they are sections along one continuous visual line that runs down the page from the moment an appointment is booked through the last recovery check-in. The interface itself should communicate: *nothing about your care gets lost or disconnected.*

Every piece of patient-facing text is either:
- an **action** (something the patient must do), or
- **info** (context, explanation), or
- a **flag** (a concerning check-in response)

...and this must always be visually distinguishable, consistently, everywhere.

---

## 2. Design Tokens

```css
:root {
  /* Color */
  --color-bg: #FAF7F1;        /* page background — warm paper, not clinical white */
  --color-bg-raised: #FFFFFF; /* cards/surfaces sitting above the background */
  --color-ink: #2B2B26;       /* primary text — warm charcoal, not pure black */
  --color-ink-muted: #6B675E; /* secondary text, timestamps, source tags */
  --color-action: #1F6F5C;    /* things the patient must DO */
  --color-action-bg: #E7F0EC; /* light wash for action item backgrounds */
  --color-info: #5B6B77;      /* general/contextual information */
  --color-info-bg: #EEF1F2;   /* light wash for info item backgrounds */
  --color-flag: #A64B3F;      /* concerning/flagged check-in response */
  --color-flag-bg: #F5E9E6;   /* light wash for flagged states */
  --color-line: #E4DED2;      /* dividers, borders, and the timeline spine itself */
  --color-focus: #1F6F5C;     /* keyboard focus ring — must be visible, never removed */

  /* Typography */
  --font-headline: "Fraunces", Georgia, serif;
  --font-body: "Public Sans", "Inter", -apple-system, sans-serif;

  --text-base: 1.0625rem;   /* 17px — larger than typical app default, on purpose */
  --text-lg: 1.375rem;
  --text-xl: 2rem;
  --text-sm: 0.9rem;
  --line-height-body: 1.6;
  --line-height-tight: 1.25;
  --max-line-length: 68ch;

  /* Spacing (4px base scale) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* Radius — used deliberately, not uniformly (see §5) */
  --radius-sm: 6px;
  --radius-md: 10px;

  /* Motion */
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-standard: 240ms;
}

/* Accessibility mode overrides (toggle adds this class to <body>) */
.a11y-large-text {
  --text-base: 1.25rem;
  --text-lg: 1.6rem;
  --line-height-body: 1.75;
}

.a11y-high-contrast {
  --color-bg: #FFFFFF;
  --color-ink: #000000;
  --color-action: #145C4A;
  --color-flag: #8C2E22;
  --color-line: #999999;
}
```

**Tailwind config equivalent** (if using Tailwind, extend rather than override defaults):
```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      bg: '#FAF7F1',
      ink: '#2B2B26',
      inkMuted: '#6B675E',
      action: '#1F6F5C',
      actionBg: '#E7F0EC',
      info: '#5B6B77',
      infoBg: '#EEF1F2',
      flag: '#A64B3F',
      flagBg: '#F5E9E6',
      line: '#E4DED2',
    },
    fontFamily: {
      headline: ['Fraunces', 'serif'],
      body: ['"Public Sans"', 'Inter', 'sans-serif'],
    },
  },
}
```

---

## 3. Layout Structure

### 3.1 The Timeline Spine

The defining structural element. A single vertical line (`--color-line`, 2px) runs down the left side of the page (or center, on wide desktop viewports), connecting every phase and every check-in into one unbroken visual path.

```
┌─────────────────────────────────────┐
│  Episode Header                      │
│  "Knee Surgery — Sept 24"            │
├─┬───────────────────────────────────┤
│●│  BEFORE                            │
││ │  ┌─────────────────────────┐      │
││ │  │ Checklist card            │    │
││ │  └─────────────────────────┘      │
││ │  ┌─────────────────────────┐      │
││ │  │ Reminders + Questions      │    │
││ │  └─────────────────────────┘      │
│●│  DURING                            │
││ │  ┌─────────────────────────┐      │
││ │  │ Visit summary card         │    │
││ │  └─────────────────────────┘      │
│●│  AFTER                             │
││ │  ┌─────────────────────────┐      │
││ │  │ Action Plan (richest section)│  │
││ │  └─────────────────────────┘      │
│●│  CHECK-INS                         │
││ │  ○ Day 1 — done, no flag           │
││ │  ○ Day 3 — done, FLAGGED           │
│○│  Day 7 — upcoming                   │
└─┴───────────────────────────────────┘
```

- Filled dot (`●`) = phase reached / check-in completed
- Hollow dot (`○`) = upcoming / not yet reached
- The spine never breaks, even between phases — this is the entire visual metaphor for continuity

### 3.2 Responsive behavior

- **Desktop:** spine on the left, content cards to the right, generous margins, max content width ~720px so line lengths stay readable.
- **Mobile:** spine collapses to a thinner left rail, cards go full-width, dot markers shrink but remain visible.
- Never let the horizontal scroll happen for the main timeline — vertical scroll only.

---

## 4. Component Specs

### 4.1 Action Item
```
[✓ checkbox]  Stop eating solid food after midnight
              Source: appointment_letter.pdf ›
```
- Background: `--color-action-bg`
- Left border accent: 3px solid `--color-action`
- Checkbox interaction: tapping toggles done state, strikethrough text, checkbox fills with `--color-action`
- Source tag: `--text-sm`, `--color-ink-muted`, tappable, chevron indicates it expands

### 4.2 Info Card
```
This is a routine follow-up appointment. No preparation
needed beyond bringing your ID.
```
- Background: `--color-info-bg`
- No checkbox (info items aren't actionable)
- Same source-tag pattern as action items

### 4.3 Source Tag (appears on every generated instruction — non-negotiable)
```
Source: discharge_summary.pdf ›
```
- Always present, always tappable
- Tapping reveals a small popover/expansion showing the original extracted field verbatim
- Style: `--text-sm`, `--color-ink-muted`, underline on hover/focus only (not by default — keep it quiet)

### 4.4 Check-in Card (unflagged)
```
Day 3 check-in — "How is your incision site today?"
[ 1 ][ 2 ][ 3 ][ 4 ][ 5 ]   ← large tap-scale buttons
Looks fine ————————————— Concerned
```
- Tap targets minimum 44x44px (accessibility requirement, not optional)
- Selected state: filled with `--color-action`
- Optional text/photo input below the scale, clearly marked optional

### 4.5 Check-in Card (flagged) — the most important state in the app
```
⚠ This matches a warning sign from your discharge instructions:
   "increasing redness or swelling at incision site"

   Consider contacting your care provider.
   Source: discharge_summary.pdf ›
```
- Background: `--color-flag-bg`
- Left border accent: 3px solid `--color-flag`
- Never phrased as a diagnosis — always phrased as "this matches [your own document's stated warning sign]"
- This card should visually stand out from every other card in the app — it's the one moment where urgency is appropriate

### 4.6 Document Upload / Processing State
```
┌─────────────────────────────┐
│   Drop a file or tap to upload │
│   PDF, photo, or paste text     │
└─────────────────────────────┘
      ↓ (on upload)
┌─────────────────────────────┐
│  Reading your document...       │
│  ▓▓▓▓▓▓▓░░░░░  extracting        │
└─────────────────────────────┘
      ↓ (on complete — THE hero animation)
Timeline populates section by section, each card
fading + settling into place along the spine, ~150ms
stagger between items. This is the one orchestrated
motion moment in the app — do not add motion elsewhere.
```

---

## 5. Border Radius & Elevation Rules

Radius is not uniform — it encodes hierarchy:
- Timeline cards (checklist, action plan, check-ins): `--radius-md` (10px)
- Small inline elements (source tags, badges, buttons): `--radius-sm` (6px)
- The spine line itself and dividers: no radius, straight
- Never apply the same shadow to every card — reserve elevation (`box-shadow: 0 1px 3px rgba(43,43,38,0.08)`) for interactive/actionable cards only; static info cards stay flat.

---

## 6. Motion Rules

- **One hero moment:** the timeline populating as extraction completes (§4.6). Build this well — it's your demo's best 3 seconds.
- **Micro-interactions only respond to user action:** checkbox toggle, tap-scale selection, source-tag expand. No hover-triggered animations, no scroll-triggered fade-ins on every section.
- Respect `prefers-reduced-motion` — disable the stagger animation and use instant appearance instead.

---

## 7. Copy Rules (apply to every generated or hardcoded string)

- Sentence case always. No ALL-CAPS labels, no tracked-out eyebrows.
- Action items are phrased as direct instructions: "Stop eating after midnight," not "Fasting requirement: applicable after midnight."
- Never editorialize or add reassurance language the AI invented ("Don't worry, this is normal") — if the source document didn't say it, the UI doesn't say it either.
- Flagged states use "consider contacting your care provider" — never "you should," never a diagnostic phrase, never "this means...".
- Empty states are instructional, not apologetic: "No documents yet — upload your appointment letter to get started," not "Oops, nothing here!"

---

## 8. Accessibility Checklist (verify before demo day)

- [ ] Large-text toggle works and is reachable via keyboard
- [ ] High-contrast toggle works
- [ ] All interactive elements have a visible focus ring (`--color-focus`), never `outline: none` without a replacement
- [ ] Tap targets ≥ 44x44px throughout, especially the check-in scale
- [ ] Color is never the only signal — action/info/flag states also differ by icon, border, or label
- [ ] Body text contrast ratio ≥ 4.5:1 against background (check `--color-ink` on `--color-bg` and both accessibility-mode variants)
- [ ] Reduced-motion preference disables the stagger animation

---

## 9. Build Order (matches the 7-day plan)

1. Set up tokens (§2) and global styles first — everything else depends on this being locked.
2. Build the timeline spine + static section shells with hardcoded example data (§3).
3. Build the five core components (§4.1–4.5) against that hardcoded data.
4. Wire in the document upload + processing state and hero animation (§4.6) last, once real extraction data is flowing.
5. Accessibility pass (§8) — do not leave this for the final hour.

Full product rationale: see `CareLoop_PRD_Indepth.md`. Condensed AI-agent build context: see `GEMINI.md`.

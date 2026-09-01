# MONO design system

Private relationship journal · premium date planner · beautiful memory archive.
Romantic without childish, premium without corporate, minimal but visually rich,
photography-first, mobile-first. **No generic dashboard templates.**

## 1 · Brand

- **Wordmark** — `MONO` set in Fraunces (display serif), medium weight, `0.34em` tracking,
  uppercase. Editorial, not techy.
- **Mark** — a hairline ring + a filled clay disc, overlapping so two shapes read as one
  (`MonoMark` in `src/components/layout/logo.tsx`). Stands for "two people, one space" and
  for the name. **No hearts.** Also the favicon (`src/app/icon.svg`).
- **`<Logo variant="lockup" | "wordmark" | "mark" />`** for every placement.

## 2 · Tokens

Single source of truth: `src/app/globals.css` (`@theme` + `@theme inline`). JS mirror for
logic only: `src/lib/design/tokens.ts`, `src/lib/design/motion.ts`. **Never hardcode a raw
hex or px in a component.**

### Semantic colour (light / dark auto via `prefers-color-scheme`)

| Token | Utility | Role |
| --- | --- | --- |
| `--paper` | `bg-paper` | app background (warm ivory) |
| `--surface` | `bg-surface` | cards, inputs |
| `--elevated` | `bg-elevated` | modals, sheets, sticky bars, popovers |
| `--ink` | `text-ink` | primary text |
| `--muted` | `text-muted` | secondary text |
| `--faint` | `text-faint` | tertiary / placeholder |
| `--line` / `--line-strong` | `border-line` | hairlines / dividers |
| `--primary` (+ `-hover` `-active` `-fg` `-tint`) | `bg-primary` `text-primary` | clay — the one signature colour |
| `--accent` (+ `-hover` `-fg` `-tint`) | `bg-accent` `text-accent` | plum — milestones, emphasis |
| `--success` / `--warning` / `--error` (+ `-tint`) | `text-success` … | status |
| `--rating` / `--rating-track` | `text-rating` | star / heart ratings |
| `--ring` | `ring-ring` | focus ring |

### Scales

- **Typography** — `font-display` (Fraunces), `font-sans` (Inter), `font-mono`. Sizes: the
  Tailwind scale plus `text-2xs` (0.6875rem). `h1–h4` default to `font-display`, weight 500.
- **Radius** — `rounded-xs .375` · `sm .5` · `md .75` · `lg 1` · `xl 1.5` · `2xl 2` (rem).
  Controls use `lg`; cards `xl`; sheets `2xl` (top).
- **Shadows** — `shadow-xs … shadow-xl`, warm-tinted (`rgb(38 26 18 / …)`).
- **Control heights** — 36 / 44 / 52 px = `sm` / `md` / `lg` (`h-9` / `h-11` / `h-13`).
  Default is `md` (44 px, touch-safe). Shared via `controlSize` in `components/ui/_shared.ts`.
- **Icon sizes** — `xs 14 · sm 16 · md 20 · lg 24 · xl 28` (`ICON_SIZE`, `<Icon size>`).
- **Spacing** — Tailwind scale; layout constants as CSS vars: `--topbar-h`, `--bottomnav-h`,
  `--sidebar-w`, `--content-max`, `--prose-max`.
- **Breakpoints** — `xs 360` (small phones) · `sm 640` (large phones) · `md 768` (tablets) ·
  `lg 1024` (laptops) · `xl 1280` · `2xl 1536` (large desktops).
- **Motion** — durations `--dur-1 110` `-2 190` `-3 300` `-4 460` ms (+ `duration-fast/base/
  slow/slower`); easings `--ease-out`, `--ease-in-out`, `--ease-spring` (+ `ease-spring`).

## 3 · Components (`src/components/ui`)

Buttons (`Button`, `LinkButton`, `SubmitButton`), inputs (`Input`, `Textarea`, `InputGroup`,
`BareInput`), `Select`, `SearchInput`, `Field`, `Icon` (own line set), `Spinner`,
`Card` + `CardHeader/Body/Footer`, `ImageCard` (photo-first, `object-cover`, scrim),
`Rating` (star/heart, keyboard), `Avatar`, `CoupleAvatar` (two-as-one), `Chip`, `Badge` +
`DateStatusBadge`, `Tabs`, `Modal`, `BottomSheet` (drag-to-dismiss), toast
(`ToastProvider` + `useToast`), `ConfirmProvider` + `useConfirm`, `Skeleton*`, `EmptyState`,
`ErrorState`, `StickyBar`, `Alert`.

Every interactive component defines hover / focus-visible / active / disabled / loading.
Focus ring is the shared `focusRing` fragment. Providers are mounted once in the root layout
(`components/providers.tsx`).

## 4 · Navigation

Config: `src/lib/navigation/nav.ts` — Home · Plan Date · Our Dates · Memories · Explore ·
Couple.

- **Desktop (`lg+`)** — left `Sidebar` rail: wordmark, prominent **Plan a date** button, the
  six links, couple chip + sign-out at the bottom.
- **Mobile / tablet** — sticky `TopBar` (wordmark, explore, couple avatar) + `BottomNav`:
  four tabs with a raised centre **Plan a date** action, safe-area padded.
- `AppShell` (`components/layout/app-shell.tsx`) composes them around a single centred content
  column — deliberately not an admin panel. Pre-couple users get the minimal `SetupShell`.

## 5 · Responsive & scroll

`min-h-dvh`, `100dvh`; safe-area utilities `pt-safe`/`pb-safe`/…; `.tap` (44 px min target);
`:where(...) { min-width: 0 }` kills flex overflow; `.scroll-area` / `.scroll-x` give
contained, natural wheel/touch scrolling with slim styled scrollbars (never rely on the
browser scrollbar to navigate); `StickyBar` for sticky actions above the mobile nav;
`BottomSheet` is the mobile modal.

## 6 · Motion

Vocabulary in globals.css: `anim-fade`, `anim-rise` (card / page entrance), `anim-scale-in`
(modals), `anim-sheet-in` (sheets), `anim-pop` (selection / rating), `.skeleton` shimmer.
Page transitions: `(app)/template.tsx` re-mounts with `anim-rise`. **`prefers-reduced-motion`
is respected globally** — a single media rule neutralises every animation and transition.
Motion is applied to navigation, entrances, selection, overlays, and milestones only — not
everything.

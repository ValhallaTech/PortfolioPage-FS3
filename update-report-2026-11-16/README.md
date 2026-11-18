# PortfolioPage-FS3 — update report

Date: 2026-11-16. Read-only analysis of `main` at `65d85bd` (plus local commit `1dc41e6`, Serena config only). No source file was changed.

Detail files in this folder:
- [gsap-analysis.md](gsap-analysis.md): full animation inventory, GSAP mapping, license facts, bundle sizes, 9-step plan
- [frontend-audit.md](frontend-audit.md): accessibility, performance, headers, CSS, content
- [docs-audit.md](docs-audit.md): every stale README claim, with line numbers and fixes
- [bootstrap6-analysis.md](bootstrap6-analysis.md): every Bootstrap 6 breaking change that touches this repo, with file:line, an 8-step migration plan and a Playwright smoke-test outline

## How this was checked

| Check | Result |
|---|---|
| `yarn install --immutable` on `main` | **Failed**: "lockfile would have been modified" |
| Same, after regenerating `yarn.lock` locally (then reverted) | Install OK |
| `yarn test:ci` | 35 passed, 0 failed. Coverage 92.75% lines / 84.09% branches on `utils.js` |
| `yarn build` | Passed. JS 280 KB, CSS 342 KB raw (78 KB / 55 KB brotli on the live site) |
| `yarn lint` / `format:check` | 897 errors / 5 files, **all CRLF line endings** on this Windows checkout (`core.autocrlf=true`, no `.gitattributes`). Would pass on Linux CI. |
| `yarn npm audit` | Production deps: 0 advisories. Dev deps: 1 critical (`tar` via `node-gyp`), 6 high, 11 moderate, 1 low |
| GitHub Actions | Every run since ~2026-10 fails in 2–6 s: "account is locked due to a billing issue". Last green CI: 2026-09-25 |
| Live site | `fs3portfolio.netlify.app` is up. The README's `fs3-portfolio.netlify.app` returns 404 |

---

## 1. Broken right now (fix first)

| # | Problem | Evidence | Fix |
|---|---|---|---|
| B1 | **`main` cannot install.** Renovate PR #67 bumped Swiper in `package.json` but not `yarn.lock`. Yarn 4 refuses to change the lockfile in CI, so CI and Netlify builds fail. | `yarn install --immutable` fails locally. PR #67's Netlify deploy-preview checks failed. | Regenerate `yarn.lock` (5-line diff, Swiper 14.2.0 → 14.3.0). Production deploys since 2026-09-28 have **probably** failed, so the live site may be stale. I could not confirm this without Netlify access. |
| B2 | **Red PRs can merge.** `main` has no branch protection and no required status checks. Renovate auto-merged #67 with `Test & Build` failing. | `gh api …/branches/main/protection` → 404 | Make `Test & Build` a required check, or turn off Renovate automerge until it is. |
| B3 | **Portfolio lightbox is broken in production.** All 9 enlarged images return 404. `main.js:103-113` builds `./images/portfolio/portfolio-N.jpg`, but Parcel flattens and hashes images at the site root. | `curl` live: `/images/portfolio/portfolio-1.jpg` → 404; `/portfolio-1.afcd9577.jpg` → 200 | Take the URL from the sibling `<img>`'s resolved `src`. |
| B4 | **Those 404s are cached for a year.** The `/images/*` rule in `netlify.toml:51-55` matches nothing real, only the broken URLs. Real images get no long cache. | Live 404 carries `max-age=31536000, immutable` | Replace with `/*.jpg`, `/*.png`, `/*.webp`, `/*.avif` rules (safe because Parcel hashes them). Drop the dead `/*.ttf` rule. |
| B5 | **A bad URL hash kills the page.** `document.querySelector(location.hash)` throws on `#1x`, and every initializer after it never runs. | `main.js:251-256` | Use `getElementById(decodeURIComponent(hash.slice(1)))`. |
| B6 | **Node 25 is end-of-life** (since 2026-06-01) and does not ship Corepack, so the README's `corepack enable` fails. CI only worked because the runner image has Corepack. | `.nvmrc:1`, `netlify.toml:17`; Node 25.0.0 release notes | Move to an LTS line (24 or 26). Add `npm install -g corepack` to CI and the README. |
| B7 | **The runtime-sync workflow can't do its job.** It throws whenever `netlify.toml` needs no change. Its PR #56 has sat open since July, so `netlify.toml` says Yarn 4.17.0 and `package.json` says 4.18.1. | `sync-runtime-versions.yml:120-122` | Exit quietly when nothing changed. Merge or close #56. |
| B8 | **GitHub Actions billing lock.** Nothing has been checked by CI since ~October. | Run annotations | Account fix, outside the repo. |

---

## 2. GSAP migration (Typed.js + ScrollReveal)

**Verdict: worth doing, with two conditions.** GSAP can replace both libraries and fix real problems they have today. It also costs about 5× the animation payload and raises a license question that must be settled first.

### What it fixes

- **Hero sequencing.** Typing starts while the hero is still hidden. A GSAP timeline fades the hero in, *then* types.
- **Dead config.** `.hero-container` is revealed twice (`main.js:127` and `:131`), and the "from top" motion never happens.
- **Stagger.** Fixed `data-sr-delay` values become `ScrollTrigger.batch` staggers, so services row 2 no longer waits 300–500 ms.
- **Reduced motion.** Nothing on the page respects `prefers-reduced-motion` today. `gsap.matchMedia()` handles it in one place and reacts live when the setting changes.
- **Scroll handler.** The unthrottled scroll listener (active nav, back-to-top) can move to ScrollTrigger.

### What should *not* move to GSAP

Swiper, Isotope, GLightbox, the Bootstrap modal, the mobile nav and CSS hover transitions. Each already animates its own elements, and two engines on the same properties fight each other.

### Cost

| | Minified | Gzip |
|---|---|---|
| Today: typed.js + scrollreveal | ~27 KB | ~9 KB |
| GSAP core + ScrollTrigger | ~115 KB | ~45 KB (estimate) |

The typing effect needs no extra plugin. A short core-GSAP loop reproduces Typed.js, including erasing back only to the shared prefix. TextPlugin would add ~10 KB for no gain.

### License gate (decide before any GSAP code lands)

- This repo is **GPL-3.0**. Typed.js, ScrollReveal and Isotope are all GPL-3.0 too (checked in `node_modules/*/package.json`), so today everything matches.
- GSAP is free, plugins included, under Webflow's **"Standard 'no charge' license"**. It is **not** an open-source license. Webflow can amend or end it, and it bans use in tools that compete with Webflow's animation builder (not a concern for a portfolio).
- Whether a GPL-3.0 project may ship a bundle containing GSAP is not answered by either license. Options: add a GPLv3 §7 exception naming GSAP (you hold the copyright), relicense the repo (e.g. MIT, once the template question in §6 is settled), or stay on the GPL libraries. This is your call, not legal advice.

### Order of work (each step ships on its own)

0. License decision.
1. Cleanup with no GSAP: dead `observeSkills` code and CSS, `require` → `import` in `main.js`, throttle the scroll listener.
2. ScrollReveal → ScrollTrigger, with reduced-motion handling from day one.
3. Typed.js → GSAP typing timeline, sequenced after the hero fade, with a static accessible label.
4. Reduced motion for everything outside GSAP (CSS transitions, smooth scroll, Swiper autoplay).
5–7. Optional: active nav via ScrollTrigger, ScrollToPlugin, Isotope → GSAP Flip (would remove the last GPL animation dependency).
8. README and CHANGELOG update.

Accessibility rules the new animations must meet: [frontend-audit.md §7](frontend-audit.md). Most important: content visible without JS, a pause control or a stop after one cycle for the endless typing loop (WCAG 2.2.2), and the full sentence available to screen readers once.

---

## 2b. Bootstrap 6 upgrade

**Verdict: doable for this repo.** The page uses a small part of Bootstrap (grid, utilities, one modal, a few form classes), so the change list is short. Four changes need care. Full tables: [bootstrap6-analysis.md](bootstrap6-analysis.md).

Checked 2026-11-16:
- `npm view bootstrap dist-tags`: `next` = `6.0.0-alpha.1`.
- `npm view bootstrap@next peerDependencies`: `@floating-ui/dom` and `vanilla-calendar-pro`.
- The migration guide confirms Modal → Dialog, `hidden.bs.dialog`, and xl moving from 1200 to 1280 px.

### Changes that touch this repo

| Area | v5 today | v6 | Where |
|---|---|---|---|
| **Modal** | `.modal` div, `Modal` class, `data-bs-toggle="modal"`, `hidden.bs.modal` | Native `<dialog class="dialog">`, `Dialog` class, `data-bs-toggle="dialog"`, `hidden.bs.dialog` | `index.html:439,469-512`, `main.js:12,158,214` |
| **JS import** | `import { Modal } from 'bootstrap'` | `import Dialog from 'bootstrap/js/dist/dialog.js'`. The package root doesn't resolve under Parcel, and importing the index would pull in all 20 plugins and both peers. | `main.js:12` |
| **Popper** | `@popperjs/core` required | Not used. Remove it. Floating UI replaces it, but this page never reaches it. | `package.json` |
| **Dark mode** | Light only | Follows the OS setting by default. The background would go dark while `style.css` keeps the text dark. | Add `data-bs-theme="light"` to `<html>` (`index.html:2`) |
| **Breakpoints** | `lg` 992 px, `xl` 1200 px | `lg` 1024 px, `xl` 1280 px. Between 1200 and 1279 px, the sidebar and hamburger would both show. | `style.css:145-157,1334-1343`, `d-xl-none` at `index.html:24,78` |
| **Responsive class syntax** | `col-lg-4`, `d-xl-none`, `pt-lg-0` | Prefix form: `lg:col-4`, `xl:d-none`, `lg:pt-0` | `index.html` (grid throughout) |
| **Spacing scale** | `mt-3`, `mt-5`, `pt-4`, `mb-3` | Same visual size uses new keys (`mt-5`, `mt-12`, `pt-7`, `mb-5`). `mt-5`/`mb-5` exist in both versions with different sizes, so check each one by hand. | `index.html` |
| **CSS cascade** | Utilities use `!important` | Bootstrap sits in CSS `@layer`s, and utilities lose `!important`. Any unlayered CSS (`style.css`, Swiper, GLightbox, Font Awesome) now beats Bootstrap. No conflicts found today. | Whole page |
| **CSS size** | `bootstrap.min.css` 232 KB | 381 KB, about 64% larger | `main.js:14` |
| **Browser support** | Wide | Chrome/Edge 130+, Firefox 132+, Safari 18+, with no fallbacks | Whole page |

### Fits with the other planned work

- **Before Bootstrap 6** (same result in either version): dead CSS removal, aria labels, skip link, contrast fixes, the site's own color variables, GSAP step 1 cleanup.
- **During** (to avoid doing them twice): button classes, visible form labels and `autocomplete`, dialog live regions, removing the 2 s auto-close, breakpoint cleanup in `style.css`.
- **After**: GSAP steps 2–7, so reveal timings are tuned once against the final layout. v6 also drops v5's CSS smooth scroll, which removes a conflict with GSAP's planned smooth-scroll step.
- **Separate, measured step:** importing only the needed Bootstrap Sass parts. v6 makes this easier, but on that route CSS variables lose the `--bs-` prefix. Map the site's own color variables onto Bootstrap's only after that choice. It needs `@parcel/transformer-sass`.

### Migration steps

0. **Baseline:** screenshots at 375, 767, 768, 1000, 1023, 1024, 1200, 1279, 1280 and 1440 px, `dist/` sizes, and the modal flows.
1. **Package swap and dialog, in one commit.** Change the markup, the JS import and the event names together. The old markup throws as soon as the new Dialog opens. Add `data-bs-theme="light"`.
2. **Breakpoints:** move the sidebar and hamburger switch to 1280 px.
3. **Grid and spacing classes** in the new prefix syntax. Check Isotope at each filter.
4. **Leftovers:** `text-light`, map iframe color scheme, form labels.
5. **Buttons:** use Bootstrap's button classes instead of custom CSS.
6. **Size and cascade check** against step 0.
7. *(Optional)* Sass-parts spike, then the color-variable bridge.
8. README and CHANGELOG handoff.

There is no E2E test today. A Playwright smoke test is the only way to catch layout and dialog regressions per breakpoint; what it needs to cover is in [bootstrap6-analysis.md §6](bootstrap6-analysis.md).

### Risks

- **Renovate automerge.** It automerges everything, so a breaking alpha bump would merge with no visual check (see B2). A Renovate rule turning off automerge for `bootstrap` is not a version pin.
- **Smaller dialog title:** it shrinks from 20 px to 16 px.
- **Layout change at 992–1023 px:** Portfolio and Services go to 2 columns, and About and Contact stack.

### Not checked yet

- Whether Parcel's CSS minifier keeps v6's newer CSS syntax intact.
- How Renovate treats later alpha tags.
- Three unknowns on the Sass route.

Each one has a check written down in the detail file.

---

## 3. Stale documentation

The README was rewritten on 2026-04-28 and has drifted since. Full table with fixes: [docs-audit.md §2](docs-audit.md).

| README says | Truth |
|---|---|
| Node 24.15.0 (lines 50, 75, 129) | `.nvmrc` 25.9.0, which is EOL |
| Yarn 4.14.1 (49, 130) | 4.18.1 (`package.json`), 4.17.0 (`netlify.toml`) |
| Swiper `^12`, other caret ranges (37–42) | Swiper 14.3.0; all deps pinned exactly |
| ESLint 9 (52) | `latest` resolves to ESLint 10 |
| "Animated skills progress bars" (22) | No skills section has ever existed in `index.html` |
| Boxicons, just-validate rows (36, 42) | Installed but never imported |
| Corepack "ships with Node 16.9+" (76) | Bundled only with Node 14.19 to 24.x |
| Site URL and Netlify badge (3, 123) | Both 404. Live site is `fs3portfolio.netlify.app` |
| "CI checks must pass before merge" (147) | False: no required checks (B2) |
| "Kept in sync automatically" (132) | False: workflow defect (B7) |

Also:
- **Add a CHANGELOG.md.** There are 6 releases up to 3.0.0, and `package.json` still says `2.0.0`.
- **Replace the issue template.** It asks about "% of customers" and sprint effort, which doesn't fit a portfolio. Two issue forms (bug, feature) would fit better.
- **Code comments:** `main.js:2` says "iPortfolio v2.0.0", which matches neither the template (v1.4.0) nor the release (3.0.0). The "replaces AOS/venobox/owl" comments describe history, not the code.

---

## 4. Accessibility (WCAG 2.2 AA): High items

Full list: [frontend-audit.md §2](frontend-audit.md).

- **Filters:** the portfolio filters are `<li>` elements with click handlers, so keyboard users can't reach them. Make them `<button aria-pressed>`.
- **Unnamed controls:** the mobile nav toggle, the 4 social links and back-to-top have no accessible name.
- **Hidden focus:** `style.css:225` has `outline: none !important` on the nav toggle.
- **Hover-only links:** portfolio action links only appear on hover, so keyboard focus and touch users can't see them.
- **Autoplay:** the testimonial carousel autoplays every 5 s with no pause control.
- **Contrast:** white on `#149ddd` is 3.0:1, and the success message (white on green) is 2.0:1. 4.5:1 is needed.

Medium: two `<h1>`s, no skip link, off-screen nav links still tabbable below 1200 px, form messages not announced, no `autocomplete`.

---

## 5. Performance

- **`hero-bg.jpg`** is a 4K, 469 KB CSS background served to phones. It is probably the slowest-loading element. Ship 1280/1920/2560 WebP/AVIF.
- **Google Fonts:** 24 font faces on the old CSS v1 API, with no `display=swap` and no preconnect. Request only the weights used, or self-host.
- **Font Awesome:** 234 KB of webfonts for ~25 icons. Use SVG icons.
- **Images:** none have `width`/`height` (layout shift) or `loading="lazy"`.
- **Profile photo:** 1920×1275 shown at 120 px, and it renders as an **oval** because the source isn't square.
- **Source maps:** published publicly (`repo.*.js.map` returns 200). Low impact, since the repo is public anyway.

---

## 6. Security headers and dependencies

- **CSP:** none. Start with `Content-Security-Policy-Report-Only`; a draft is in [frontend-audit.md §4](frontend-audit.md). Needs the Security Reviewer before it is enforced.
- **Headers:** remove the deprecated `X-XSS-Protection`, and add `Permissions-Policy`. HSTS is already sent by Netlify.
- **Dev-dependency advisories:** 1 critical and 6 high, none shipped to the browser. Renovate's lock-file maintenance would refresh transitive versions, once CI runs again.
- **devDependencies on `latest`:** 5 of them, so a lock refresh can silently jump a major version (it already did for ESLint).

---

## 7. Cleanup

| Remove | Size / reason |
|---|---|
| `src/css/icofont.min.css`, `.woff`, `.woff2` | 1.3 MB, never referenced |
| `src/images/portfolio-details-*.jpg`, `testimonials/testimonials-1..5.jpg` | ~400 KB, never referenced |
| `boxicons`, `just-validate` packages | Never imported |
| ~450 of 1343 lines in `style.css` | Rules for sections that don't exist (facts, skills, resume, breadcrumbs, portfolio details, loader) |
| `observeSkills` + its tests | Targets `.skills-content`, which doesn't exist |
| Second `.mobile-nav-toggle` (`index.html:78-80`) | Duplicate; its icon never updates |

**Keep `@popperjs/core`.** Bootstrap's ESM build imports it, so removing it breaks the build.

Tooling:
- Add `.gitattributes` (`* text=auto eol=lf`) so Windows checkouts pass lint.
- Add `src/css` to Prettier.
- Fix the invalid `padding-right: 20px 15px` (`style.css:1339`).
- Put the 22 hard-coded `#149ddd` values into CSS variables.

---

## 8. Decisions only you can make

1. **Template license.** `style.css:1-6` credits BootstrapMade iPortfolio, and their free license requires keeping the footer credit. The footer now says "Designed by Fred Smith". If no Pro license was bought, the credit goes back, and the README should say the site is based on that template. That also bears on the GPL-3.0 claim.
2. **GSAP vs GPL-3.0** (§2 license gate).
3. **Placeholder content:** www.example.com, a 555 phone number, "123 Main Street", a Google Map pointing at lower Manhattan, 9 "More Details" links to `#`, empty service descriptions, and joke testimonials (Lincoln, Gandhi, Michael Jackson) on a page that says "Freelance: Available". There are also two typos ("Unites States", "If I had of").
4. **Copyright holder:** "Fred Smith III" (README) vs "Valhalla Tech" (footer).
5. **Bootstrap 6 browser floor:** dropping visitors on Safari older than 18, Chrome/Edge older than 130, and Firefox older than 132.
6. **New dev dependencies:**
   - Playwright, for the smoke test that gates the Bootstrap 6 layout work.
   - `@parcel/transformer-sass`, only if the Sass-parts route is chosen.
7. **Renovate rule:** turn off automerge for `bootstrap` while it is on an alpha.

## Sprints (one `/spec` run each)

Each sprint is one spec document. Its parts become phases in the spec's §3.5, in the order listed. Each sprint ends with its own README/CHANGELOG work items, so the docs never describe a state that doesn't exist yet.

| Sprint | Suggested slug | Phases, in order | Decisions needed before Gate 1 |
|---|---|---|---|
| **1. Stabilize** | `stabilize-and-cleanup` | (a) Live bugs B1, B3, B4, B5. (b) CI and runtime: B2 required check, B6 Node LTS + Corepack, B7 sync workflow, Renovate automerge rule. (c) Cleanup §7 and GSAP step 1. (d) Version-independent accessibility fixes (§4) and color variables. (e) Playwright smoke test as a baseline for sprint 2. (f) README/CHANGELOG fixes for what changed (§3). | §8 items 3–4 (content, copyright holder) if content fixes go in. §8 item 6 (Playwright). B8 billing lock cleared, or CI checks verified locally. |
| **2. Bootstrap 6** | `bootstrap-6-upgrade` | §2b steps 0–6, with the "during" fixes folded in (buttons, form labels, dialog live regions, breakpoint CSS). Then the README/CHANGELOG update. Step 7 (Sass parts) only if chosen. | §8 item 5 (browser floor). §8 item 6 (Sass transformer), only if step 7 is in. |
| **3. GSAP** | `gsap-animations` | GSAP steps 2–4 (ScrollReveal → ScrollTrigger, Typed.js → GSAP timeline, reduced motion everywhere). Optional steps 5–7. Then the README/CHANGELOG update. | §8 item 2 (GSAP vs GPL-3.0). §8 item 1 (template license) bears on it. |

Notes:
- **B1, B3, B4 and B5 are live in production now.** If you'd rather not wait for sprint 1's spec and review gates, they can go out as one small PR first, and sprint 1 drops phase (a).
- **Sprint 2 depends on sprint 1's Playwright baseline.** Without it, the layout changes in Bootstrap 6 have no automated check.
- **Sprint 3 comes after sprint 2,** so reveal timings are tuned once, against the final layout.

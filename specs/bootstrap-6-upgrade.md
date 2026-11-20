# Spec: Bootstrap 6 upgrade

| Field | Value |
| --- | --- |
| Slug | `bootstrap-6-upgrade` |
| Created | 2026-11-20 |
| Stage | `approved` |
| Brief | ✅ complete |
| PRD | ✅ complete |
| Technical Plan | ✅ complete |

**Test-first:** acceptance

_Every spec is TDD, and `acceptance` is the only value: each AC observable below the browser is covered by a §3.4 chain of stubs → failing acceptance tests → implementation, one chain per test seam. A spec reading `none`, or with no such line, was written before 2026-11-18 and is a record. To execute it again, the Architect first adds TDD chains to §3 and sets this line to `acceptance`, Stage returns to `draft`, and Fred approves it again at Gate 2._

> One feature, one file. Three sections, three owners. Section owners never edit
> another owner's section — contradictions are reported upward, not silently patched.
> The `Stage` row is the Architect's. It reads `draft` until Fred approves at Gate 2,
> when the Architect sets it to `approved`.

---

## 1. Brief

<!-- OWNER: Analyst. No other agent may edit this section. -->

**Status:** ✅ complete

Scope source: `update-report-2026-11-16/README.md` "Sprints" row 2 and §2b, detailed in `update-report-2026-11-16/bootstrap6-analysis.md` (§1, §5a, §6, §7), plus sprint 1 NG-2, NG-10 and NG-11 (`specs/stabilize-and-cleanup.md`).

### 1.1 Problem statement

The portfolio page (release 4.0.0) is built on Bootstrap 5, and the owner's plan moves it to Bootstrap 6 (C-1) before the animation work, so the layout is settled once (bootstrap6-analysis §5b). Bootstrap 6 changes the page's breakpoints, its contact popup, its responsive and spacing class names, and its default color scheme, so the page must be re-proven to render and behave correctly. The same contact popup and form also carry known defects that were held for this move so they are fixed once: a screen-reader user is not told whether a message was sent, the result closes itself after 2 seconds, fields have no visible labels or autofill hints, errors are not tied to their fields, the popup title is not a correct heading, the buttons are styled by site-specific rules, the form cannot be reached without JavaScript, and a no-JavaScript submission ends on a raw JSON page (bootstrap6-analysis §5a "During"; sprint 1 NG-2, NG-10, NG-11).

### 1.2 Who is affected

- **Visitors** to fs3portfolio.netlify.app, including keyboard, screen-reader, no-JavaScript and dark-mode visitors, and visitors on 992–1279 px screens, where the layout changes.
- **Visitors on browsers below the new floor** (C-2), who lose support.
- **Fred**, the owner, who wants the page to render properly and approves the release tag.

### 1.3 Goals

- **G-1** — At every width in bootstrap6-analysis §6, the page renders and behaves as on 4.0.0, except where this spec changes it on purpose, with no page errors (Sprints row 2; R1-Q12).
- **G-2** — The sidebar/menu-button switch and the grid change at the Bootstrap 6 widths (C-3). No width shows both the sidebar and the menu button, or neither, and the site's own CSS uses the same widths as the framework (R1-Q5, R1-Q7).
- **G-3** — With the visitor's OS in dark mode, the page and the embedded map stay light (R1-Q4).
- **G-4** — The contact popup keeps keyboard focus inside while open, closes with Escape, its close button and a click outside, and returns focus to the button that opened it. Its title is a correct heading and keeps its current visual size (R1-Q6, R1-Q7).
- **G-5** — After a submission, success or failure is announced to screen-reader users and stays until the visitor closes it. Field errors are identified to assistive technology on the field they belong to (R1-Q7).
- **G-6** — Every contact-form field has a visible label and an autofill hint (R1-Q7).
- **G-7** — The contact and submit buttons have at least 4.5:1 text contrast, a visible keyboard focus indicator and a hover state (R1-Q7; bootstrap6-analysis §6 step 5).
- **G-8** — Without JavaScript, a visitor can reach the contact form, and a submission ends on a readable page (R1-Q8; sprint 1 NG-11).
- **G-9** — The template leftovers in sprint 1 NG-10 are gone: the `php-email-form` name and the selectors on it, and the empty `.validate` elements with their CSS rule (R1-Q8).
- **G-10** — The rendered-page baseline asserts Bootstrap 6 behavior, changes only the assertions that change on purpose, and still proves it catches an unintended breakpoint change and an unintended popup change (R1-Q12; sprint 1 G-16, AC-91, AC-92).
- **G-11** — The CSS and JS sizes of the built site before and after the move are measured and recorded (R1-Q11; bootstrap6-analysis §6 step 6).
- **G-12** — The README and CHANGELOG describe the release (R1-Q17), and release 5.0.0 is prepared up to the tag (R1-Q16).

### 1.4 Non-goals

- **NG-1** — The Sass-partials route (report §2b step 7) and the site-wide mapping of site colors onto Bootstrap's global tokens. Placed after sprint 2 (R1-Q3; sprint 1 NG-3). The one exception is the theme for the two buttons that C-5 brings in, which takes the site's accent color only on those buttons, so they do not switch to Bootstrap's own primary color (coordinator decision during PR-2, under Fred's standing instruction).
- **NG-2** — A dark theme. A separate design task (R1-Q4).
- **NG-3** — Replacing the mobile navigation with Bootstrap 6's Drawer. Optional, and its own decision (R1-Q9; bootstrap6-analysis §5a O1).
- **NG-4** — Any content change: placeholder text, map, links, testimonials (R1-Q13).
- **NG-5** — Any Renovate change, including lifting the automerge pause or the Bootstrap prerelease hold (R1-Q14).
- **NG-6** — Enforcing the content security policy (R1-Q15).
- **NG-7** — GSAP migration steps 2–7. They come after this sprint so reveals are tuned against the final layout (bootstrap6-analysis §5b).
- **NG-8** — Shrinking the larger CSS payload. It is measured, not reduced; the lever is NG-1 (R1-Q11).
- **NG-9** — Support for browsers below the Bootstrap 6 floor (R1-Q2).
- **NG-10** — Pushing the 5.0.0 tag or GitHub release. Both wait for Fred's explicit go (R1-Q16).

### 1.5 Constraints

| ID | Constraint | Type | Source |
| --- | --- | --- | --- |
| C-1 | Production runs Bootstrap `6.0.0-alpha.1`, a prerelease and the only v6 release. | hard | Fred, grilling R1-Q10; §1.8 preamble (`npm view bootstrap dist-tags`, 2026-11-20) |
| C-2 | Supported browsers are Chrome/Edge 130+, Firefox 132+ and Safari 18+, with no fallbacks. | hard | Fred, grilling R1-Q2 |
| C-3 | `lg` is 1024 px and `xl` is 1280 px for the grid and the sidebar switch, so 992–1023 px shows 2 columns and stacked About/Contact. | hard | Fred, grilling R1-Q5 |
| C-4 | The page stays light-only. | hard | Fred, grilling R1-Q4 |
| C-5 | All bootstrap6-analysis §5a "During" items are in, including "Bootstrap button classes" for the buttons. | hard | Fred, grilling R1-Q7 |
| C-6 | No `@parcel/transformer-sass` dependency. | hard | Fred, grilling R1-Q3 |
| C-7 | A larger CSS payload is acceptable if measured and recorded. | hard | Fred, grilling R1-Q11 |
| C-8 | The smoke baseline from sprint 1 asserts Bootstrap 5 behavior; sprint 2 changes only the assertions it changes on purpose. | hard | sprint 1 C-32, G-16; Fred, grilling R1-Q12 |
| C-9 | Tests never deliver a real contact-form submission. | hard | bootstrap6-analysis §6 ("must always be mocked"); sprint 1 G-16 |
| C-10 | The CSP stays report-only, and a full visit raises no violation reports. | hard | Fred, grilling R1-Q15 |
| C-11 | GitHub Actions is unavailable; the local gate `yarn gate:linux` stands in for CI. | hard | §1.8 preamble; sprint 1 C-8 |
| C-12 | Release 5.0.0 is prepared up to the tag; the tag and GitHub release wait for Fred's explicit go. | hard | Fred, grilling R1-Q16 |
| C-13 | Toolchain: Parcel 2.16.4, Yarn 4.18.1, Node 26; `package.json` `browserslist` is `defaults, iOS >= 15` today. | soft | Sprint coordinator brief; `package.json:8` |

### 1.6 Open questions

None. Fred's standing instruction (§1.8 preamble) means no human answers; undecided points are assumptions in §1.7, and solution questions are D-1..D-9.

### 1.7 Assumptions

- **A-1** — The build toolchain (C-13) can carry Bootstrap 6's CSS unchanged (report §2b "Not checked yet"; bootstrap6-analysis R12). → If false, the page ships with broken styles, or the sprint grows to include a toolchain change.
- **A-2** — `6.0.0-alpha.1` stays the only v6 release through sprint 2 (C-1). → If a newer prerelease lands, names in bootstrap6-analysis may be wrong, and the targets move.
- **A-3** — bootstrap6-analysis was written against the pre-sprint-1 page: its line numbers are stale, and its Isotope checks now apply to Muuri, which replaced it in sprint 1 (G-22). Its findings otherwise hold for 4.0.0. → If false, a breaking change in the 4.0.0 page is missed and surfaces only in the baseline.
- **A-4** — The existing form service can end a no-JavaScript submission on a page the site controls. → If false, G-8's readable result needs another route, possibly beyond a static site.
- **A-5** — Bootstrap 6's floor (C-2) does not cut off a meaningful share of the audience (R1-Q2 reasoning; no analytics checked). → If false, those visitors get broken colors and a misbehaving popup with no fallback.
- **A-6** — Step 0's "before" measurements (G-11) are taken from the 4.0.0 build before any sprint 2 change; no screenshot set is required beyond the sprint 1 baseline (sprint 1 C-32). → If false, G-11 has no comparison point.

### 1.8 Grilling record
_Written by the Analyst, verbatim from /spec Stage 0. Decision IDs are cited as sources elsewhere in the spec._

Run by the sprint 2 session on 2026-11-20. Fred's standing instruction for sprint 2, verbatim (2026-11-20): "Do whatever you need to do to get everything up and running. I don't want any questions about script conflicts. Just pick your recommendation and keep working. I only want to hear about something if the shape of the spec changes. I also don't want a bunch of messages. Just report to me when everything is done."

So every row below was answered with the recommended option by the coordinator on Fred's behalf. None of them changes the shape of sprint 2 against the plan in `update-report-2026-11-16/README.md` ("Sprints", row 2) and `bootstrap6-analysis.md`. Each recommendation's reason is in the Answer column.

Facts looked up, not asked (2026-11-20): `npm view bootstrap dist-tags` → `next` = `6.0.0-alpha.1`, `latest` = `5.3.9`; no newer v6 prerelease since the report. `origin/main` = `8c0aeef`, release 4.0.0 tagged at `76802f4`. GitHub Actions is still unavailable, so the local gate `yarn gate:linux` stands in for CI (sprint 1 C-8).

| ID | Question | Answer | Recommendation |
|---|---|---|---|
| R1-Q1 | Use `bootstrap-6-upgrade` as the spec slug (file `specs/bootstrap-6-upgrade.md`)? | bootstrap-6-upgrade (Recommended) — the slug the update report's Sprints table names. | took (coordinator, on Fred's standing instruction) |
| R1-Q2 | Bootstrap 6 supports only Chrome/Edge 130+, Firefox 132+ and Safari 18+ with no fallbacks (report §8 item 5). Accept that browser floor for the live site? | Accept the Bootstrap 6 floor (Recommended) — it is the price of the upgrade the sprint exists for; a portfolio's audience is on current browsers. | took (coordinator) |
| R1-Q3 | Is the Bootstrap Sass-partials route (report §2b step 7) and the mapping of site colors onto Bootstrap tokens in sprint 2? | Out of sprint 2 (Recommended) — sprint 1 NG-3 already places both after sprint 2, and the report makes step 7 optional. No `@parcel/transformer-sass` dependency. | took (coordinator) |
| R1-Q4 | Bootstrap 6 follows the visitor's OS dark mode by default. Does the page stay light-only in sprint 2? | Stay light-only (Recommended) — a dark theme is a separate design task; getting it by accident gives dark text on a dark background. | took (coordinator) |
| R1-Q5 | Bootstrap 6 moves `lg` to 1024 px and `xl` to 1280 px. Accept the new widths for the grid and for the sidebar/hamburger switch (so 992–1023 px shows 2 columns and stacked About/Contact)? | Accept Bootstrap 6's breakpoints (Recommended) — one source of truth with the framework; the report accepts the 992–1023 px change. | took (coordinator) |
| R1-Q6 | The dialog title would shrink from 20 px to 16 px under Bootstrap 6 reboot. Keep its current visual size? | Keep its current size (Recommended) — the shrink is a side effect, not a design decision. | took (coordinator) |
| R1-Q7 | Which bootstrap6-analysis §5a "During" items are in sprint 2 (sprint 1 NG-2)? | All of them (Recommended): dialog live regions, removal of the 2 s auto-close, visible form labels and `autocomplete`, Bootstrap button classes, breakpoint normalization, the dialog title heading, and form error wiring ("During or after", done during). Sprint 1 NG-2 assigned them all here. | took (coordinator) |
| R1-Q8 | Sprint 1 moved two contact-form items here: NG-10 (`php-email-form` class rename with its selectors; the `.validate` divs and their CSS rule) and NG-11 (the form reachable without JavaScript, and a readable result page after a no-JS submission). Both in sprint 2? | Both in (Recommended) — Fred moved them here at sprint 1 Gate 1 so the native-dialog rebuild solves them once. | took (coordinator) |
| R1-Q9 | Bootstrap 6's responsive Drawer could replace the custom mobile nav (bootstrap6-analysis §5a O1). In sprint 2? | Out (Recommended) — optional, changes the header structure and scroll handlers, and is its own decision. | took (coordinator) |
| R1-Q10 | Is it acceptable for production to run a Bootstrap prerelease (`6.0.0-alpha.1`, the only v6 release)? | Yes (Recommended) — the sprint's goal assumes it; sprint 1 already holds Bootstrap prerelease updates for a human (sprint 1 G-3). | took (coordinator) |
| R1-Q11 | Bootstrap 6's CSS is about 64% larger. Is a larger CSS payload acceptable if it is measured and recorded? | Accept and record it (Recommended) — the Sass route that would shrink it is out (R1-Q3); numbers go in the PR. | took (coordinator) |
| R1-Q12 | Does the rendered-page baseline keep proving it catches unintended change after the upgrade (sprint 1 G-16, AC-91/AC-92), re-aimed at Bootstrap 6 behavior? | Yes (Recommended) — sprint 1's sensitivity proof targets v5 mutations that sprint 2 makes on purpose, so it must be re-aimed, not dropped. | took (coordinator) |
| R1-Q13 | Content (placeholder text, map, links, testimonials) stays as it is in sprint 2, as in sprint 1 C-3? | Stays (Recommended) — no content decisions are in the sprint 2 plan. | took (coordinator) |
| R1-Q14 | Renovate automerge stays paused for every package, and the Bootstrap-prerelease hold stays, through sprint 2? | No Renovate change in sprint 2 (Recommended) — not in the sprint 2 plan; Actions is still unavailable. | took (coordinator) |
| R1-Q15 | Sprint 1 left the CSP report-only (C-10). Does sprint 2 keep it report-only, with a full visit still raising no violation reports? | Keep report-only, no violations (Recommended) — enforcing it is not in the sprint 2 plan. | took (coordinator) |
| R1-Q16 | Does sprint 2 end in a tagged release, and with which version? | Yes, 5.0.0, prepared up to the tag; the tag and GitHub release wait for Fred's explicit go (Recommended) — the raised browser floor is a breaking change for some visitors, and a tag is irreversible. | took (coordinator) |
| R1-Q17 | Does sprint 2 end with its own README and CHANGELOG update (report: "each sprint ends with its own README/CHANGELOG work")? | Yes (Recommended). | took (coordinator) |
| Done? | Shared understanding? | Proceed (Recommended) — frontier empty, 17 decisions. | took (coordinator) |

#### Deferred to Technical Plan
_Solution-space questions raised during grilling and not asked. The Architect resolves each in §3 or raises it at Gate 2._
- D-1: How the Bootstrap 6 JavaScript is imported under Parcel (deep `bootstrap/js/dist/dialog.js` import vs `packageExports`), whether `@popperjs/core` is removed, and how the required-but-unused peers (`@floating-ui/dom`, `vanilla-calendar-pro`) are handled.
- D-2: How the contact form becomes reachable without JavaScript, and what readable page a no-JS submission ends on (Web3Forms `redirect` target, a static thank-you page, or another route).
- D-3: How the repo's `browserslist` (`defaults, iOS >= 15`) is reconciled with Bootstrap 6's floor, and how to confirm Parcel's CSS minifier keeps v6 syntax (`@layer`, `@starting-style`, `light-dark()`, escaped `:` class names) intact.
- D-4: Dialog and form markup: `<dialog class="dialog">` structure, heading level, visible labels (`.form-field` vs floating labels), `autocomplete` values, live-region roles, error wiring (`aria-invalid`, feedback element), and the `php-email-form` replacement class.
- D-5: Which smoke-baseline assertions change and how (1199/1200 → 1279/1280, 991/992 → 1023/1024, modal → dialog events and state), and how AC-91/AC-92's sensitivity mutations are re-aimed at Bootstrap 6 behavior.
- D-6: How the `style.css` sidebar breakpoints are expressed (`width < 1280px` range syntax) and how the grid and spacing classes are renamed to v6 prefix syntax with v5 sizes kept.
- D-7: Which Bootstrap 6 button classes replace the custom button CSS, and how they take the site's accent token and keep contrast and a visible focus ring.
- D-8: Whether Muuri needs a relayout across the new 1024 px breakpoint (bootstrap6-analysis R11), and the scrollbar-gutter effect on fixed controls (R13).
- D-9: How the work is sliced into PRs, given each PR must pass `yarn gate:linux` on its head.

---

## 2. PRD

<!-- OWNER: Product Manager. No other agent may edit this section. -->

**Status:** ✅ complete

### 2.1 Summary

The portfolio page moves from Bootstrap 5 to Bootstrap `6.0.0-alpha.1` and is re-proven to render and behave as release 4.0.0 did, except for the changes listed in AC-3. Those changes are the new 1024/1280 px breakpoints, a light-only page under OS dark mode, and a rebuilt contact dialog and form. The rebuilt dialog announces its result and keeps it, wires errors to fields, shows visible labels with autofill hints, uses Bootstrap buttons, and works without JavaScript. The sprint 1 smoke baseline is re-aimed at Bootstrap 6 and still proves it catches unintended change, and release 5.0.0 is prepared up to the tag.

### 2.2 Requirements

| ID | Requirement | Priority | Satisfies |
| --- | --- | --- | --- |
| R-1 | The page runs on Bootstrap `6.0.0-alpha.1` with no Sass transformer dependency (C-1, C-6). | MUST | G-1 |
| R-2 | At every §6 width, the page loads and scrolls with no page error and no horizontal scroll. | MUST | G-1 |
| R-3 | The page renders as on 4.0.0 at every §6 width, except for the intended changes listed in AC-3. | MUST | G-1 |
| R-4 | The sidebar and the menu button switch at 1280 px, and exactly one of them is shown at every width. | MUST | G-2 |
| R-5 | The grid switches at 1024 px: 2 columns and stacked About/Contact at 1023 px, 3 columns and side-by-side About/Contact at 1024 px (C-3). | MUST | G-2 |
| R-6 | The site's own breakpoint media queries use the framework widths, with no Bootstrap 5 width left. | MUST | G-2 |
| R-7 | With an OS dark preference, the page, the contact dialog and the map stay light (C-4). | MUST | G-3 |
| R-8 | The contact dialog opens as a modal from the contact button and keeps focus inside. Escape, its close button and an outside click each close it, and focus returns to the contact button. | MUST | G-4 |
| R-9 | The dialog title is a level-2 heading at its 4.0.0 size of 20 px. | MUST | G-4 |
| R-10 | Closing the dialog during a submission cancels the request and resets the form, as on 4.0.0. | MUST | G-1 |
| R-11 | A submission's success or failure is put in a live region and stays until the visitor closes the dialog. | MUST | G-5 |
| R-12 | Each invalid field is marked invalid and described by its error to assistive technology. | MUST | G-5 |
| R-13 | Every contact-form field has a visible label and an `autocomplete` value. | MUST | G-6 |
| R-14 | The contact and submit buttons meet 4.5:1 text contrast in every state, show a 3:1 keyboard focus indicator, change on hover, and are at least 44 px tall (the sprint 1 C-33 target size). | MUST | G-7 |
| R-15 | The two buttons are styled by Bootstrap button classes, not by site-specific color, border or spacing rules (C-5). | MUST | G-7 |
| R-16 | Without JavaScript, a visitor can reach the contact form, and a submission ends on a readable page on the site. | MUST | G-8 |
| R-17 | The `php-email-form` name, its selectors, the `.validate` elements and their CSS rule are gone. | MUST | G-9 |
| R-18 | Every existing suite passes on Bootstrap 6, and only the sprint 1 assertions listed under "Sprint 1 assertions changed on purpose" change (C-8, C-11). | MUST | G-10 |
| R-19 | The baseline still fails on an unintended breakpoint change and on an unintended popup change. | MUST | G-10 |
| R-20 | No test delivers a real contact-form submission, with or without JavaScript (C-9). | MUST | G-10 |
| R-21 | The CSP stays report-only, and a full visit with a submission raises no violation (C-10). | MUST | G-1 |
| R-22 | The CSS and JS sizes of the 4.0.0 build and the release build are measured and recorded (C-7). | MUST | G-11 |
| R-23 | `package.json` reads 5.0.0 at the release commit, and no 5.0.0 tag or GitHub release exists (C-12, NG-10). | MUST | G-12 |
| R-24 | The README and the CHANGELOG describe release 5.0.0. | MUST | G-12 |

### 2.3 Acceptance criteria

_Ground truth for evaluating execution agents. Every AC is written to be assertable._

#### Conventions used by every AC below

Sprint 1's conventions apply unchanged (`specs/stabilize-and-cleanup.md` §2.3 "Conventions used by every AC below"): local and live target, the `desktop`/`tablet`/`small`/`phone` viewports, full visit, Tab walk, tracked-file search, gate, smoke command, effective background, contrast, `lint`, GitHub reads and test-first. The additions and overrides are:

- **Release commit:** the commit on `main` whose `package.json` `version` is `5.0.0`. It stays untagged in this sprint (C-12).
- **§6 widths:** 375, 767, 768, 1000, 1023, 1024, 1200, 1279, 1280 and 1440 px wide, each at height 900 unless the AC says otherwise.
- **Roles, not today's selectors:**
  - The **contact button** is the button in `#contact` named "Send Me a Message" (today `.contact-modal-btn`).
  - The **dialog** is the element with role `dialog` named "Send Me a Message" (today `#contactModal`).
  - The **submit button** is the button in the dialog named "Send Message" (today `#submit-btn`).
  - The **close button** is the button in the dialog named "Close".
  - The **fields** are the controls labeled "Your Name", "Your Email", "Subject" and "Message". These are today's label texts, kept as they are (NG-4).
  - If §3 renames an element, the AC follows the role, and §3 names the selector.
- **Dialog shown:** the dialog is visible and `element.matches(':modal')` is `true`. **Dialog closed:** the dialog is not visible and `element.matches(':modal')` is `false`.
- **Web3Forms mock:** with JavaScript on, sprint 1's `mockWeb3Forms` (AC-89). With JavaScript off, the endpoint the form posts to is mocked to answer as its service documents for the fields sent. §3 cites that source (D-2). The `tests/e2e/fixtures.js` guard stays on in every test (C-9).
- **Filled form:** the four fields hold sprint 1's `CONTACT_FIELDS` values.
- **Contrast with Bootstrap 6 colors:** computed colors in any CSS color syntax (Bootstrap 6 computes `oklch()`) are converted to sRGB. A translucent color is composited onto the effective background, and then the WCAG 2.x ratio is taken. The thresholds are sprint 1's: 4.5:1 for text and 3:1 for UI components (sprint 1 R-30, AC-45).

#### Sprint 1 assertions changed on purpose

These are the only sprint 1 assertions that sprint 2 may change (C-8). AC-27 checks this list. New tests and new assertions may be added. Helpers (`tests/e2e/helpers/*`, `fixtures.js`) may change how they open, close or wait for the dialog, for example `*.bs.modal` events become Bootstrap 6 dialog events. They may not remove an assertion that is not listed below.

| File | Test (title starts with) | Change | Goal |
| --- | --- | --- | --- |
| `tests/e2e/smoke.spec.js` | `Layout:` | 1199/1200 px → 1279/1280 px. It may grow to the AC-4 table. | G-2 |
| `tests/e2e/smoke.spec.js` | `Grid:` | 991/992 px → 1023/1024 px | G-2 |
| `tests/e2e/smoke.spec.js` | `Dialog open:` | `.show`, `aria-modal="true"` and `body.modal-open` → "dialog shown" (AC-9) | G-4 |
| `tests/e2e/smoke.spec.js` | `Dialog dismiss:` | `[data-bs-dismiss="modal"]` and `hidden.bs.modal` → the close button and "dialog closed" (AC-11) | G-4 |
| `tests/e2e/smoke.spec.js` | `Abort on close:` | `hidden.bs.modal` → "dialog closed" | G-4 |
| `tests/e2e/smoke.spec.js` | `Submit, success:` | `#sent-message` visible → role `status` text that persists (AC-14) | G-5 |
| `tests/e2e/smoke.spec.js` | `Submit, error:` | `#error-message` → role `alert` (AC-15) | G-5 |
| `tests/e2e/portfolio.spec.js` | `AC-121` | The width list gains 1023, 1024, 1279 and 1280. No width is removed. | G-2 |
| `tests/e2e/cleanup.spec.js` | `AC-24` | The title's "below 1200 px" becomes "below 1280 px". The assertions are unchanged. | G-2 |
| `tests/e2e/a11y.spec.js` | `AC-45` | Rows 1, 2, 8 and 9 follow renamed selectors. The thresholds are unchanged. | G-5, G-7 |
| `__tests__/release/baseline-sensitivity.test.js` | `AC-91`, `AC-92` | The mutations are re-aimed (AC-28, AC-29) | G-10 |
| `__tests__/acceptance/cleanup.test.js` | `AC-25: @popperjs/core remains` | Retired, because Bootstrap 6 drops Popper and the dependency is removed. It may be inverted to assert that `@popperjs/core` is absent. | G-1 (C-1) |
| `__tests__/acceptance/css-hygiene.test.js` | `AC-22` | `FORM_BOX_PATTERN`'s `.php-email-form` (and `#contactModal`, if renamed) follows the NG-10 rename. The one-rule limit is unchanged. | G-9 |
| `tests/e2e/css-targets.spec.js` | `no @media or @container query in dist CSS uses range syntax` | The range check is re-aimed to `@media` params only, and its `@media` assertions are unchanged. Bootstrap 6 ships `@container (width>=…)` queries, which Lightning CSS never rewrites. Range syntax is native to container queries: every browser with `@container` support parses it, and a browser without that support drops the rule either way. | G-1 |
| `__tests__/acceptance/css-tokens.test.js` | `AC-29 (guard): no Bootstrap token is declared in style.css` | The guard still fails on any `--bs-*` declaration in `style.css`, except `--bs-theme-*` declarations inside the `.theme-site` rule. That rule is the button-only accent theme, the C-5 exception to NG-1. Everything else in the test is unchanged. | G-7 (C-5) |
| `tests/e2e/css-targets.spec.js` | `no @media or @container query in dist CSS uses range syntax` | **Conditional.** Unchanged while `browserslist` stays `defaults, iOS >= 15`. If PR-1's build shows that target breaks Bootstrap 6's CSS (§3 RK-1), the build target moves to the C-2 floor, and this test is re-aimed to that floor. Every C-2 browser parses range media queries, so this does not weaken it. | G-1 (C-2) |

#### AC-1 — Bootstrap 6.0.0-alpha.1 is installed, and no Sass transformer is

- **Verifies:** R-1
- **Given** the release commit after `yarn install --immutable`
- **When** the declared and installed Bootstrap versions and every dependency block are read
- **Then** Bootstrap is `6.0.0-alpha.1`, and `@parcel/transformer-sass` is not declared
- **Assertion:**
  - `yq -p=json '.dependencies.bootstrap' package.json` prints `6.0.0-alpha.1`.
  - `yq -p=json '.version' node_modules/bootstrap/package.json` prints `6.0.0-alpha.1`. The manifest is read by path, because Bootstrap 6's `exports` map does not export `./package.json`.
  - `yq -p=json '[.dependencies, .devDependencies, .optionalDependencies] | .[] | keys | .[]' package.json` prints no `@parcel/transformer-sass` line.
- **Executable as:** `lint`

#### AC-2 — No page error and no horizontal scroll at any §6 width

- **Verifies:** R-2
- **Given** the local target, loaded fresh at each §6 width
- **When** the page is scrolled to the bottom in 400 px steps, 100 ms apart
- **Then** no page error fires, and the page never scrolls sideways
- **Assertion:** at each width, the `pageerror` events are `[]`, and `document.documentElement.scrollWidth - document.documentElement.clientWidth` is ≤ 0 after the last step
- **Executable as:** `e2e`

#### AC-3 — The page renders as on 4.0.0, apart from the intended changes

- **Verifies:** R-3
- **Given** the local target built at the release commit and a build of tag `4.0.0`, opened side by side in desktop Chrome on Windows with classic scrollbars
- **When** a reviewer views both builds at each §6 width with these steps:
  - Scroll the whole page.
  - Open the lightbox from one portfolio item.
  - Step through the testimonial bullets.
  - Open the contact dialog.
  - Repeat at 1440 px with the OS in dark mode.
- **Then** every difference is one of these intended changes:
  1. At 992–1023 px, Services and Portfolio show 2 columns, and About and Contact stack (C-3).
  2. At 1200–1279 px, the sidebar is off-canvas behind the menu button.
  3. The open dialog sits above the sidebar, footer, menu button and back-to-top, and the page behind it does not respond.
  4. The result message stays until the dialog is closed.
  5. The field labels are visible, and field errors show on their fields.
  6. The contact and submit buttons have Bootstrap button styling in the site accent.
  7. The contact dialog takes Bootstrap 6's dialog width. It is narrower than 4.0.0's below 576 px (302 vs 357 px at 375) and wider between 576 and 991 px (694 vs 498 px at 768).
  8. With classic scrollbars, an open dialog or lightbox centers in the page area beside the scrollbar gutter, about 7–8 px left of the viewport center. Bootstrap 6 keeps `scrollbar-gutter: stable`, so the page does not shift when an overlay opens.

  Nothing is broken, overlapping or unstyled, including the menu button and back-to-top next to the classic scrollbar (bootstrap6-analysis R13).
- **Assertion:** the reviewer posts a PR comment listing each §6 width as pass or fail, and each difference found with its intended-change number. Failing widths: 0. Differences with no intended-change number: 0.
- **Executable as:** `manual`
- **Manual because:** whether a page "renders properly" is a visual judgment. A pixel diff against 4.0.0 fails by design on changes 1–8. Also, the classic-scrollbar placement (R13) does not appear in the headless Linux runner the suites use.

#### AC-4 — The sidebar layout switches at 1280 px

- **Verifies:** R-4
- **Given** the local target, loaded fresh at 1279 × 900 and again at 1280 × 900
- **When** the layout settles (polled, because `#header` slides with a transition)
- **Then** every row of this table holds:

  | Element | 1279 px | 1280 px |
  | --- | --- | --- |
  | menu button (`body > .mobile-nav-toggle` today) | visible | hidden |
  | `#header` box `x` | < 0 | 0 |
  | `#main` computed `margin-left` | `0px` | `300px` |
  | `#hero` box | `x` = 0, `width` = `documentElement.clientWidth` ± 1 | `x` = 0, `width` = `documentElement.clientWidth` ± 1 |
  | `#footer` computed style | `position: static`, `padding-top: 20px` | `position: fixed`, `width: 300px` |
- **Assertion:** each cell above, checked with `toBeVisible`/`toBeHidden`, `boundingBox()` and `toHaveCSS`
- **Executable as:** `e2e`

#### AC-5 — Exactly one of the sidebar and the menu button is shown at every width

- **Verifies:** R-4
- **Given** the local target with the nav closed, loaded fresh at each §6 width
- **When** the layout settles
- **Then** either the menu button is visible, or the sidebar is docked, but not both and not neither
- **Assertion:** at each width, `menuButtonVisible !== sidebarDocked` is `true`. `sidebarDocked` means the `#header` box `x` is 0 and `body` does not have `mobile-nav-active`. `menuButtonVisible` is true below 1280 px and false at 1280 and 1440 px.
- **Executable as:** `e2e`

#### AC-6 — The grid switches at 1024 px

- **Verifies:** R-5
- **Given** the local target. Rows 1, 3 and 4 load fresh at 1023 × 900 and at 1024 × 900. Row 2 loads at 1440 × 900, waits until the Muuri grid is ready, then resizes to 1023 and then to 1024, with a 1 s settle after each resize.
- **When** each row is measured
- **Then** every row holds:

  | # | Measure | 1023 px | 1024 px |
  | --- | --- | --- | --- |
  | 1 | Services cards sharing the first card's `offsetTop` | 2 | 3 |
  | 2 | Visible portfolio items (filter All) whose box `y` equals the first item's ± 1 | 2 | 3 |
  | 3 | About text block vs About photo | text `top` ≥ photo `bottom` | text `left` ≥ photo `right` |
  | 4 | Contact call-to-action block (`.contact-cta` column) vs contact info block | CTA `top` ≥ info `bottom` | CTA `left` ≥ info `right` |
- **Assertion:** each cell above, from `offsetTop` or `boundingBox()`
- **Executable as:** `e2e`

#### AC-7 — The site CSS has no Bootstrap 5 breakpoint left

- **Verifies:** R-6
- **Given** `src/css/style.css` at the release commit
- **When** its media queries are searched
- **Then** no query uses a Bootstrap 5 `lg` or `xl` width, and the sidebar switch uses 1280 px
- **Assertion:**
  - `rg -n -e '@media[^{]*\b(991|992|1199|1200)(\.98)?px' src/css/style.css` prints nothing and exits 1.
  - `rg -c -e '@media[^{]*\b1280px' src/css/style.css` prints ≥ 1.
- **Executable as:** `lint`

#### AC-8 — The page stays light under an OS dark preference

- **Verifies:** R-7
- **Given** the local target at `desktop`, with the dialog open, measured once under `emulateMedia({ colorScheme: 'light' })` and once under `'dark'`
- **When** these elements are read: `body`, `#about`, `#services`, `#contact`, the dialog, the "Your Name" field and the map iframe in `#contact`
- **Then** every color is the same in both schemes, and the map is rendered light
- **Assertion:**
  - For each element except the iframe, the computed `color` and the effective background are equal under light and dark. The list of differences is `[]`.
  - Under dark, `body` `background-color` is `rgb(255, 255, 255)`. This is sprint 1's `Color scheme:` row, kept.
  - Under dark, the iframe's computed `color-scheme` is `light`.
- **Executable as:** `e2e`

#### AC-9 — The contact button opens the dialog as a modal

- **Verifies:** R-8
- **Given** the local target at `desktop`
- **When** the contact button is clicked
- **Then** the dialog is shown as a modal, named by its title
- **Assertion:** `page.getByRole('dialog', { name: 'Send Me a Message' })` is visible, and `element.matches(':modal')` returns `true`
- **Executable as:** `e2e`

#### AC-10 — Focus stays inside the open dialog

- **Verifies:** R-8
- **Given** the dialog shown at `desktop` after a click on the contact button
- **When** Tab is pressed 10 times, then Shift+Tab is pressed 10 times
- **Then** focus is inside the dialog after both sequences
- **Assertion:** after each sequence, `dialog.contains(document.activeElement)` is `true`
- **Executable as:** `e2e`

#### AC-11 — Each close path closes the dialog and returns focus

- **Verifies:** R-8
- **Given** the local target at `desktop`. The dialog is opened afresh from the contact button before each path.
- **When** each path runs in turn:
  1. With focus on the "Your Name" field, Escape is pressed.
  2. The close button is clicked.
  3. The viewport is clicked at a point outside the dialog's box, which the test asserts first. §3 picks the point.
- **Then** after each path, the dialog is closed and focus is on the contact button
- **Assertion:** for each path, the dialog is closed (Conventions), and `expect(contactButton).toBeFocused()` passes
- **Executable as:** `e2e`

#### AC-12 — The dialog title is a level-2 heading at 20 px

- **Verifies:** R-9
- **Given** the dialog shown at `desktop`
- **When** its headings are read
- **Then** it has one level-2 heading, "Send Me a Message", at its 4.0.0 size
- **Assertion:** `dialog.getByRole('heading', { level: 2, name: 'Send Me a Message' })` has count 1, and its computed `font-size` is `20px`
- **Executable as:** `e2e`

#### AC-13 — Closing during a submission cancels it and resets the form

- **Verifies:** R-10
- **Given** the dialog shown at `desktop` with a filled form, and Web3Forms mocked with `{ success: true }` and a 3 s delay
- **When** Enter is pressed in the "Subject" field, the request is seen, and Escape is pressed
- **Then** the dialog closes before the mock answers, and the form is back to its start state
- **Assertion:**
  - The dialog is closed while the mock's `answered()` is 0.
  - All four fields have value `''`.
  - The submit button is enabled, with its pre-submit text.
- **Executable as:** `e2e`

#### AC-14 — A successful submission is announced and stays

- **Verifies:** R-11
- **Given** the dialog shown at `desktop` with a filled form, and Web3Forms mocked with `{ success: true }`. Before the submit, the dialog contains exactly 1 element with role `status`, present in the accessibility tree.
- **When** the submit button is clicked
- **Then** that status element shows the success text, and it is still shown 5 s later with the dialog open
- **Assertion:**
  - `dialog.getByRole('status')` has text `Your message has been sent. Thank you!` and is visible.
  - After `page.waitForTimeout(5000)`, the same element is still visible with that text, and the dialog is still shown. The 4.0.0 auto-close fired at 2 s.
- **Executable as:** `e2e`

#### AC-15 — A failed submission is announced as an alert

- **Verifies:** R-11
- **Given** the dialog shown at `desktop` with a filled form, and Web3Forms mocked with `{ success: false, message: 'x' }`. Before the submit, the dialog contains exactly 1 element with role `alert`.
- **When** the submit button is clicked
- **Then** the alert shows the service's message
- **Assertion:** `dialog.getByRole('alert')` is visible with text `x`
- **Executable as:** `e2e`

#### AC-16 — Invalid fields are marked and described on the field

- **Verifies:** R-12
- **Given** the dialog shown at `desktop`, with Web3Forms mocked with `{ success: true }`, in two cases:
  - (a) all four fields are empty.
  - (b) the form is filled except "Your Email", which holds `not-an-email`.
- **When** the submit button is clicked
- **Then** exactly the invalid fields are marked invalid and carry an error description, and nothing is sent
- **Assertion:**
  - In (a), each of the four fields has `aria-invalid="true"` and passes `toHaveAccessibleDescription(/\S/)`.
  - In (b), "Your Email" does the same, and the other three fields have no `aria-invalid="true"`.
  - In both cases, the mock's `answered()` is 0.
- **Executable as:** `e2e`

#### AC-17 — Every field has a visible label

- **Verifies:** R-13
- **Given** the dialog shown with a filled form, at `desktop` and again at `small`
- **When** each label text is looked up: "Your Name", "Your Email", "Subject", "Message"
- **Then** each one labels exactly its field and is visibly shown
- **Assertion:**
  - `dialog.getByLabel(text, { exact: true })` has count 1.
  - The `<label>` with that text is visible, and its box is at least 10 × 10 px. `.visually-hidden` gives 1 × 1, which fails.
- **Executable as:** `e2e`

#### AC-18 — Every field carries an autofill hint

- **Verifies:** R-13
- **Given** the dialog shown at `desktop`
- **When** each field's `autocomplete` attribute is read
- **Then** each field has its hint
- **Assertion:**
  - "Your Name" → `name`
  - "Your Email" → `email`
  - "Subject" → `off`
  - "Message" → `off`
- **Executable as:** `e2e`

#### AC-19 — Both buttons keep 4.5:1 text contrast at rest, on hover and on focus

- **Verifies:** R-14
- **Given** the local target at `desktop`. The contact button is scrolled into view and settled, as in sprint 1 AC-45. The submit button is read in the shown dialog.
- **When** each button's computed `color` is compared with its effective background:
  - at rest
  - while hovered (`hover()`)
  - while focused by keyboard
- **Then** each of the 6 measurements is at least 4.5:1
- **Assertion:** contrast ≥ 4.5 for all 6 (Conventions)
- **Executable as:** `e2e`

#### AC-20 — Both buttons show a 3:1 keyboard focus indicator

- **Verifies:** R-14
- **Given** the local target at `desktop`, with the dialog shown for the submit button
- **When** each button is focused by pressing Tab
- **Then** a focus indicator is drawn that contrasts with what surrounds the button
- **Assertion:**
  - The button's computed `outline-style` is not `none` with `outline-width` ≥ `1px`, or its computed `box-shadow` is not `none`. This is the sprint 1 AC-40 test.
  - The indicator color (`outline-color`, or the first `box-shadow` color) has a contrast of at least 3.0 against the effective background of the button's parent.
- **Executable as:** `e2e`

#### AC-21 — Both buttons change on hover

- **Verifies:** R-14
- **Given** the local target at `desktop`, with the dialog shown for the submit button
- **When** each button's computed `background-color`, `color` and `border-color` are read at rest and while hovered
- **Then** at least one of the three differs
- **Assertion:** for each button, `rest.backgroundColor !== hover.backgroundColor || rest.color !== hover.color || rest.borderColor !== hover.borderColor`
- **Executable as:** `e2e`

#### AC-22 — No site rule styles the two buttons

- **Verifies:** R-15
- **Given** `src/css/style.css` at the release commit, parsed as CSS, and the release build's `dist/index.html`
- **When** every rule whose selector matches the contact button or the submit button in `dist/index.html` is collected
- **Then** none of those rules sets a color, border, spacing or font property. Custom properties (`--*`) are allowed, so the buttons can take the site accent.
- **Assertion:** matching declarations among `background`, `background-color`, `color`, `border*`, `padding*`, `font*`, `text-transform` and `letter-spacing`: 0
- **Executable as:** `lint`

#### AC-23 — Without JavaScript, the contact form can be reached

- **Verifies:** R-16
- **Given** the local target at `desktop` in a context with `javaScriptEnabled: false`
- **When** the page loads, and the control in `#contact` named "Send Me a Message" (a button or a link) is focused with Tab and Enter is pressed
- **Then** the four fields are shown and can be typed into
- **Assertion:** `page.getByLabel(text, { exact: true })` is visible and editable (`toBeVisible()`, `toBeEditable()`) for all four label texts
- **Executable as:** `e2e`

#### AC-24 — Without JavaScript, a submission ends on a readable site page

- **Verifies:** R-16, R-20
- **Given** the AC-23 state with a filled form, and the no-JS Web3Forms mock (Conventions). Web3Forms redirects only to an absolute `https` URL on the site's own domain. So the mock answers with a redirect to the same path on the test's own origin: the pathname of the form's `redirect` value (§3 WI-5/WI-6).
- **When** "Send Message" is activated and the navigation settles
- **Then** the browser shows the site's own thank-you page from `dist`, not a JSON body
- **Assertion:**
  - The form's `redirect` field value is an absolute URL whose origin is `https://fs3portfolio.netlify.app`.
  - The final document URL equals the test origin plus that value's pathname, and its response is served from `dist` with a `content-type` that starts with `text/html`.
  - It has 1 visible `heading` with level 1 and non-empty text, and a link whose resolved `href` is the site root `/`.
  - `document.body.innerText.trim()` does not start with `{`.
  - The guard recorded no unmocked request.
- **Executable as:** `e2e`

#### AC-25 — The template leftovers are gone

- **Verifies:** R-17
- **Given** the release commit
- **When** a tracked-file search runs (sprint 1 Conventions) for `-e 'php-email-form' -e 'class="([^"]* )?validate( [^"]*)?"' -e '\.validate\b'`
- **Then** nothing matches
- **Assertion:** 0 matches (`rg` prints nothing and exits 1)
- **Executable as:** `lint`

#### AC-26 — Every suite passes on Bootstrap 6

- **Verifies:** R-18
- **Given** the release commit, pushed
- **When** these commands run:
  - `yarn gate:linux`
  - `yarn test:e2e:slow` against the local target
  - `yarn test:e2e:live` against the live target, after Netlify has deployed the release commit
- **Then** all three pass
- **Assertion:** the gate prints a v1 block whose SHA equals the release commit, with six exit codes of 0. Both other commands exit 0.
- **Executable as:** `build`

#### AC-27 — Only the listed sprint 1 assertions changed

- **Verifies:** R-18
- **Given** `git diff 4.0.0 <release commit> -- tests/e2e __tests__`
- **When** each removed line (`-`) containing `expect(` or `expect.poll(` is matched to the title of its enclosing `test(`, or to its helper file
- **Then** every match is a row of "Sprint 1 assertions changed on purpose". A changed pattern constant counts against the test that uses it.
- **Assertion:** removed `expect` lines, or changed pattern constants, outside a listed test: 0. The `@container` re-aim row always counts. The conditional `css-targets.spec.js` row counts only if §3 RK-1 fired.
- **Executable as:** `lint`

#### AC-28 — An unintended breakpoint change fails the Layout test

- **Verifies:** R-19
- **Given** the sprint 1 AC-91 harness, run on a scratch worktree of the release commit
- **When** every `1280px` in the sidebar-switch media queries of `src/css/style.css` becomes `1200px`, and the smoke command runs. §3 names the exact edit and asserts the match count first, as AC-91 does.
- **Then** the `Layout:` test fails on its own assertion, and the `Grid:` control test passes in the same run
- **Assertion:** `expectOnlyTargetBroken(tests, 'Layout')` passes
- **Executable as:** `integration`

#### AC-29 — An unintended popup change fails the Dialog open test

- **Verifies:** R-19
- **Given** the sprint 1 AC-92 harness, run on a scratch worktree of the release commit
- **When** the contact button's opener is broken, and the smoke command runs. By default, `data-bs-toggle="dialog"` on the contact button goes back to the Bootstrap 5 value `"modal"`. If §3 opens the dialog another way, it names the equivalent one-attribute edit.
- **Then** the `Dialog open:` test fails on its own assertion, and the `Grid:` control test passes
- **Assertion:** `expectOnlyTargetBroken(tests, 'Dialog open')` passes
- **Executable as:** `integration`

#### AC-30 — An unmocked submission still fails on the guard

- **Verifies:** R-20
- **Given** the sprint 1 AC-90 case, run on the release commit with its spec updated to the sprint 2 helpers
- **When** the uncommitted spec submits a filled form with no Web3Forms mock
- **Then** that test fails on the guard, no real Web3Forms response arrives, and every other test passes
- **Assertion:** the AC-90 checks pass unchanged:
  - The test status is `failed`, and an error contains `Web3Forms requests the test did not mock`.
  - `log.responses` is `[]`, and `log.failedRequests.length` is ≥ 1.
  - The other tests that did not pass: `[]`.
- **Executable as:** `integration`

#### AC-31 — The CSP stays report-only, with no violation

- **Verifies:** R-21
- **Given** the local target and the live target at `desktop`, with Web3Forms mocked with `{ success: true }`
- **When** a full visit runs, followed by opening the dialog and making a successful mocked submission
- **Then** no CSP violation and no CSP console message occur, and the policy is served report-only
- **Assertion:**
  - The `securitypolicyviolation` events are `[]`, and the console messages matching `/Content.Security.Policy/i` are `[]`.
  - The document response carries `content-security-policy-report-only`, equal to `netlify.toml`'s value as in sprint 1 AC-83, and carries no `content-security-policy` header.
- **Executable as:** `e2e`

#### AC-32 — The before and after build sizes are recorded

- **Verifies:** R-22
- **Given** clean builds (`yarn install --immutable && yarn build`) of tag `4.0.0` and of the release commit, and the PR body that §3 names as the size record
- **When** four sums are taken for each build: the raw and gzip byte sizes of `dist/**/*.css` and of `dist/**/*.js`. The gzip size is the sum over files of `zlib.gzipSync(file, { level: 9 }).length`.
- **Then** the record lists all 8 numbers, and each matches the measurement
- **Assertion:** `gh pr view <n> --json body` contains 8 labeled byte counts. Each is within ±1 % of the re-measured value.
- **Executable as:** `integration`

#### AC-33 — 5.0.0 is prepared and not tagged

- **Verifies:** R-23
- **Given** the release commit and `origin`, at the end of the sprint
- **When** the version and the remote tag and release are read
- **Then** the version is 5.0.0, and there is no tag or GitHub release yet
- **Assertion:**
  - `git show <release commit>:package.json | yq -p=json '.version'` prints `5.0.0`.
  - `git ls-remote --tags origin refs/tags/5.0.0` prints nothing.
  - `gh release view 5.0.0` exits non-zero.
- **Executable as:** `integration`

#### AC-34 — The CHANGELOG has a 5.0.0 entry that names the upgrade and the browser floor

- **Verifies:** R-24
- **Given** `CHANGELOG.md` at the release commit
- **When** the text from the 5.0.0 heading to the next `## [` heading is read
- **Then** the entry exists and names Bootstrap 6 and the new browser floor
- **Assertion:**
  - A line matches `^## \[5\.0\.0\] - \d{4}-\d{2}-\d{2}$`.
  - The entry contains `Bootstrap 6`, `Chrome`, `Firefox` and `Safari`.
- **Executable as:** `lint`

#### AC-35 — The README describes Bootstrap 6 and the dialog

- **Verifies:** R-24
- **Given** `README.md` at the release commit
- **When** it is searched
- **Then** it names Bootstrap 6, and no longer names Bootstrap 5 or a modal
- **Assertion:**
  - `rg -c 'Bootstrap 6' README.md` prints ≥ 1.
  - `rg -n 'Bootstrap 5' README.md` prints nothing.
  - `rg -n -i '\bmodal\b' README.md` prints nothing.
- **Executable as:** `lint`

#### AC-36 — Both buttons are at least 44 px tall

- **Verifies:** R-14
- **Given** the local target at `desktop` and again at `small`, with the dialog shown for the submit button
- **When** each button's bounding box is read
- **Then** each one meets the 44 px target size that sprint 1 applied to the social links and back-to-top (sprint 1 C-33, AC-60)
- **Assertion:** `boundingBox().height` ≥ 44 for the contact button and for the submit button, at both viewports
- **Executable as:** `e2e`

### 2.4 Success metrics

| ID | Metric | Baseline | Target | Measured by |
| --- | --- | --- | --- | --- |
| M-1 | Layout or contact-dialog regressions reported against 5.0.0 | unknown: count the same for 4.0.0 before the 5.0.0 deploy | 0 in the 30 days after the 5.0.0 deploy | `gh issue list --label bug --search "created:>=<deploy date>"`, read by hand for layout and dialog defects |
| M-2 | Lighthouse accessibility score of the live home page | unknown: needs a run against the live 4.0.0 site before the 5.0.0 deploy | ≥ 95 (the sprint 1 M-7 threshold) | Lighthouse through `npx` against `https://fs3portfolio.netlify.app/`, before and after |
| M-3 | Bytes transferred on a first, empty-cache load at `phone` | unknown: needs a HAR of the live 4.0.0 site before the 5.0.0 deploy | Recorded, with no cap (C-7, NG-8). Any growth is explained by the AC-32 CSS/JS delta. | Playwright HAR (`recordHar`) at `phone`, as in sprint 1 M-2 |
| M-4 | Contact-form submissions received per month | unknown: needs instrumentation (the Web3Forms dashboard has not been read) | Not lower than the 4.0.0 baseline | The Web3Forms dashboard, read by Fred |

### 2.5 Out of scope

**Carried from §1.4:** NG-1 (Sass partials, Bootstrap token mapping), NG-2 (dark theme), NG-3 (Drawer navigation), NG-4 (content), NG-5 (Renovate), NG-6 (CSP enforcement), NG-7 (GSAP steps 2–7), NG-8 (shrinking CSS), NG-9 (browsers below the floor), NG-10 (pushing the 5.0.0 tag or release).

**Readings and exclusions taken while writing this PRD:**
- **Media queries that are not framework breakpoints.** G-2's "same widths as the framework" covers the `lg`/`xl` widths that C-3 moves. These are the sidebar switch at 1200 → 1280, and the hero offset and footer rules that follow it. The hero image-resolution queries (1281 px, 1921 px) and the 767/768 px queries are unchanged by Bootstrap 6, and no AC touches them.
- **Screen-reader announcement.** G-5's "announced" is asserted through ARIA live-region roles that exist before the result appears (AC-14, AC-15). No AC requires a run with NVDA or VoiceOver.
- **Dialog motion under reduced motion.** bootstrap6-analysis §3 suggests a check, but no §1 goal asks for it, so no AC requires it.
- **The `browserslist` reconciliation (D-3).** It has no AC of its own. Its observable effects are covered by AC-2, AC-6 and AC-8, which fail if the minifier breaks Bootstrap 6's CSS.
- **Visible labels.** They keep today's label texts (NG-4). "Subject" and "Message" have no autofill field name, so their hint is `off` (AC-18).

### 2.6 Open questions carried forward

None for Fred. §1.6 has none, and this PRD raised no question that changes scope. These non-blocking points belong to the Architect. None of them changes an AC.

| ID | Point | Blocking? | Owner | Effect on this PRD |
| --- | --- | --- | --- | --- |
| Q-1 | AC-24's no-JS mock must model the real service's documented answer to a form POST. §3 cites that source (D-2, A-4). | no | Architect | Resolved in §3. The mock redirects to the thank-you path on the test origin, and AC-24 is worded to match. |
| Q-2 | AC-32 needs §3 to name which PR body holds the size record. | no | Architect | None |
| Q-3 | AC-28 and AC-29 need §3 to name the exact mutation edits once the media-query syntax (D-6) and the dialog opener (D-2, D-4) are fixed. | no | Architect | None |

---

## 3. Technical Plan

<!-- OWNER: Architect. No other agent may edit this section. -->

**Status:** ✅ complete

Grounded in `origin/main` at `8c0aeef`: `package.json`, `.yarnrc.yml`, `netlify.toml`, `src/index.html` (contact section and modal), `src/js/main.js`, `src/css/style.css` (breakpoints, contact form, buttons), `tests/e2e/smoke.spec.js`, `tests/e2e/helpers/contact-modal.js`, `tests/e2e/css-targets.spec.js`, `tests/e2e/viewports.js`, `__tests__/release/baseline-sensitivity.test.js`, `__tests__/acceptance/{cleanup,css-hygiene,html-semantics}.test.js`, `scripts/gate/evidence.mjs`. Line numbers in bootstrap6-analysis are stale (A-3); this plan names selectors, not lines.

New Bootstrap 6 facts this plan relies on, beyond bootstrap6-analysis F1–F22:

- **V-1** — The Dialog data-API calls `preventDefault()` for `A`/`AREA` triggers. Focus goes back to the trigger on `hidden`. Its defaults are `{ backdrop: true, keyboard: true, modal: true }` *(verified 2026-11-20 via unpkg `bootstrap@6.0.0-alpha.1/js/dist/dialog.js`)*.
- **V-2** — With `backdrop: true`, a click whose target is the `<dialog>` itself (the backdrop) calls `hide()`. A native `cancel` (Escape) calls `hide()` when `keyboard` is true. `dialog-base.js` imports no FocusTrap and handles no Tab key, so focus containment is only the browser's native `showModal()` behavior *(verified 2026-11-20 via unpkg `js/dist/dialog-base.js`)*.
- **V-3** — A closed `.dialog` is `display: flex; visibility: hidden; opacity: 0`. `[open]:not(.hiding)` sets it visible. `.dialog-title` is `font-size: var(--font-size-md)`. `_dialog.scss` has no reduced-motion rule *(verified 2026-11-20 via unpkg `scss/_dialog.scss`)*.
- **V-4** — Buttons are `btn-solid` plus a `.theme-*` class. A theme class only sets `--theme-base`, `-bg`, `-bg-subtle`, `-bg-muted`, `-fg`, `-fg-emphasis`, `-border`, `-focus-ring` and `-contrast`, and a custom theme class without Sass is documented. The dist names carry `--bs-` (F9) *(verified 2026-11-20 via Context7 `/twbs/bootstrap/v6.0.0-alpha.1`: button docs, `customize/components.mdx`, and the `bootstrap-color-system` skill)*.
- **V-5** — Web3Forms: in a plain HTML POST, a hidden `redirect` field sends the visitor to that URL after success. The URL must be absolute `https://`, and free plans must redirect within the same domain. With no `redirect`, the visitor lands on `https://web3forms.com/success`. The HTTP status of the redirect is not documented *(verified 2026-11-20 via WebFetch of docs.web3forms.com/getting-started/customizations/redirection)*.

### 3.1 Affected systems & repos

| System / repo | Nature of change | Owner domain |
| --- | --- | --- |
| PortfolioPage-FS3: `package.json`, `yarn.lock`, `.yarnrc.yml` | Bootstrap 5.3.8 → `6.0.0-alpha.1`, `@popperjs/core` removed, peers declared optional, version 5.0.0, a second build entry | frontend, ci |
| `src/index.html`, `src/js/main.js`, `src/css/style.css`, new `src/thanks.html` + `src/css/thanks.css` | Native dialog, v6 class names, 1280 px sidebar queries, form and buttons rebuilt, no-JS path | frontend |
| `netlify.toml` | CSP `form-action` gains `'self'`, and the policy stays report-only | security |
| `tests/e2e/**`, `__tests__/acceptance/**`, `__tests__/release/baseline-sensitivity.test.js` | Listed baseline rows re-aimed, plus new tests | tests |
| `README.md`, `CHANGELOG.md` | 5.0.0 | docs |
| Netlify (fs3portfolio.netlify.app) | Deploys each merge to `main`. No configuration change | none |

**Dependencies.** Changed: `bootstrap` `5.3.8` → `6.0.0-alpha.1`, exact pin, MIT (the license header of `js/dist/dialog.js`, read 2026-11-20). It is required by C-1. Removed: `@popperjs/core` `2.11.8`, MIT. v6 no longer uses Popper (F2), and nothing else imports it (`rg popper src` finds no import). Not added: `@floating-ui/dom` and `vanilla-calendar-pro`, which are required peers of v6 (F2). The deep Dialog import never reaches them (F6). Not added: `@parcel/transformer-sass` (C-6). No other dependency changes.

### 3.2 Data changes

none. No stored state. Web3Forms submissions keep the same fields. Only the `redirect` value changes (§3.3).

### 3.3 API & contract changes

- **Browser floor (breaking for visitors).** Chrome/Edge 130+, Firefox 132+ and Safari 18+ (C-2, F20). This is why the release is 5.0.0. The `browserslist` build target stays `defaults, iOS >= 15` unless RK-1 fires, in which case it moves to the C-2 floor (resolves D-3; see WI-1 and RK-1).
- **Contact dialog markup (resolves D-4).** The ids and hooks stay `#contactModal`, `.contact-modal-btn`, `#contact-form`, `#submit-btn`, `#sent-message` and `#error-message`, so the selectors in the AC Conventions resolve with no rename.
  - `<dialog class="dialog dialog-lg dialog-scrollable" id="contactModal" aria-labelledby="contactModalLabel">` (`dialog-scrollable` makes `.dialog-body` scroll, so the submit button stays reachable on short viewports) has no `aria-hidden`, `tabindex` or `fade`. Inside it, `.dialog-header` holds `<h2 class="dialog-title" id="contactModalLabel">`, pinned to `20px` in `style.css`, and `<button type="button" class="btn-close" data-bs-dismiss="dialog" aria-label="Close">`. `.dialog-body` holds the form.
  - The form is `class="contact-form"`, replacing `php-email-form`. Each field is a `<div class="form-field">` holding a visible `<label class="form-label">` (today's text), the control with `autocomplete` (`name`, `email`, `off`, `off`) and `aria-describedby="<id>-error"`, and an empty `<div class="field-error" id="<id>-error">`. Placeholders stay.
  - The status regions are always rendered and empty until a result arrives: `<div id="error-message" role="alert">` and `<div id="sent-message" role="status">`. Their colored box applies only `:not(:empty)`.
  - The opener is `<button class="btn-solid btn-lg theme-site contact-modal-btn" data-bs-toggle="dialog" data-bs-target="#contactModal" type="button">`. The submit button is `<button type="submit" id="submit-btn" class="btn-solid btn-lg theme-site">`. `btn-lg` uses Bootstrap 6's `--bs-btn-input-lg-min-height` (2.75rem, which is 44 px), so both buttons are at least 44 px tall (AC-36) with no site sizing rule (AC-22).
- **Events.** `hidden.bs.modal` becomes `hidden.bs.dialog`, and the test helpers wait on `shown.bs.dialog` and `hidden.bs.dialog` (F7). The exported helper names in `tests/e2e/helpers/contact-modal.js` stay the same, so the embedded AC-90 spec in `baseline-sensitivity.test.js` runs unchanged (AC-30).
- **No-JS path (resolves D-2).**
  - `#contact` gains `<a class="btn-solid theme-site contact-nojs-link" href="#contactModal">Send Me a Message</a>`. It is `display: none` by default. Under `@media (scripting: none)` it is shown and `.contact-modal-btn` is hidden.
  - In the same media block, `#contactModal:target` overrides V-3's closed state (`visibility`, `opacity`, `transform`) and shows the form as a fixed, centered, scrollable panel above `.back-to-top` (z-index above `99999`).
  - The form keeps `action="https://api.web3forms.com/submit" method="POST"`. Its hidden `redirect` becomes `https://fs3portfolio.netlify.app/thanks.html` (absolute, same domain: V-5).
  - The JS path sends `redirect: 'false'` in its JSON body, as 4.0.0 does, so the fetch contract is unchanged.
  - New page `/thanks.html`: one `<h1>`, a sentence, and `<a href="./">` back to the site root. It is styled by `src/css/thanks.css` with no inline style or script, and added as a second entry to the `build` script (`parcel build src/index.html src/thanks.html …`).
  - *Rejected:* a separate `contact.html` with a copy of the form, because two forms drift apart. HTML invoker commands (`command="show-modal"`), because they are missing from part of the C-2 floor and would open the dialog even with AC-29's broken toggle.
- **CSP (report-only stays, C-10).** `form-action https://api.web3forms.com` becomes `form-action 'self' https://api.web3forms.com`, because Chromium checks `form-action` against the redirect a no-JS POST follows. No other directive changes. `img-src data:` stays for the v6 `.btn-close` mask image (L10).

### 3.4 Work items

No item needs a TDD chain. §3.7 gives the reasons.

#### WI-1 — Swap to Bootstrap 6 and move the layout, atomically

- **domain:** `frontend`
- **depends-on:** none
- **satisfies:** AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-31
- **change:**
  - **Packages (resolves D-1).**
    - `bootstrap` goes to `6.0.0-alpha.1` and `@popperjs/core` is removed. `.yarnrc.yml` gains `packageExtensions: { "bootstrap@*": { peerDependenciesMeta: { "@floating-ui/dom": { optional: true }, "vanilla-calendar-pro": { optional: true } } } }`, so the install prints no missing-peer warning (B4). `yarn.lock` is regenerated.
    - `main.js`: `import Dialog from 'bootstrap/js/dist/dialog.js';`, with a one-line comment saying why the bare import is avoided (R9). No `packageExports`, so `swiper/modules/pagination.css` keeps resolving (B3). `Modal.getOrCreateInstance` becomes `Dialog.getOrCreateInstance`, and `hidden.bs.modal` becomes `hidden.bs.dialog`.
    - Add a Tab and Shift+Tab wrap on the open dialog: from the last focusable control to the first, and the reverse. Native `showModal()` lets focus leave the document (V-2), and Bootstrap 5's FocusTrap used to keep it inside (AC-10). As implemented in `4b24f15`, `main.js` also moves focus into the dialog on `shown.bs.dialog`.
    - **Bootstrap CSS import (as implemented in `4b24f15`).** The CSS is imported at the top of `style.css` with `@import 'npm:bootstrap/dist/css/bootstrap.min.css';`, and the JS-side `import 'bootstrap/dist/css/bootstrap.min.css'` is removed. Bootstrap 6's `sideEffects` field made Parcel drop the CSS import from `main.js`.
  - **Markup.** Change the dialog to the §3.3 shell (`<dialog>`, `.dialog-*` including `dialog-scrollable`, `h2.dialog-title`, `data-bs-dismiss="dialog"`). The Bootstrap 6 `.dialog` does not scroll on its own, so without `dialog-scrollable` the submit button is unreachable on short viewports (PR-1 review) and set `data-bs-toggle="dialog"` on the opener. Add `data-bs-theme="light"` to `<html>` (C2). The fields, status regions and buttons stay as they are until WI-3.
  - **Classes (resolves D-6).**
    - Rename by prefix: `d-xl-none` → `xl:d-none`; `col-lg-N` → `lg:col-N`; `col-md-6` → `md:col-6`; `pt-lg-0` → `lg:pt-0`; `mt-lg-0` → `lg:mt-0`.
    - Re-key spacing to keep the v5 sizes: `mt-3` → `mt-5`, `pt-4` → `pt-7`, `mt-5` → `mt-12`, `mb-3` → `mb-5` (L5). Check each one in the diff, because `mt-5` and `mb-5` are valid in both versions.
    - Drop `text-light` (L7).
  - **`style.css`.**
    - The four sidebar-switch queries become range syntax at the framework width: two `@media (width >= 1280px)` (`#header` bottom, `#hero` offset) and two `@media (width < 1280px)` (sidebar off-canvas, static footer).
    - Add `#contactModal .dialog-title { font-size: 20px; }` and `.contact-map { color-scheme: light; }` (C3, AC-8).
    - The 767/768, 1024, 1281 and 1921 px queries are untouched (§2.5).
  - **D-8.** Muuri already relays out on resize (`layoutOnResize: 150`, `main.js` `initPortfolioGrid`, verified), so the new 1024 px switch needs no code (R11). R13 is left to AC-3.
- **done when:**
  - In PR-1's worktree, `yarn build` passes and the built `dist/*.css` still contains `@layer`, `@starting-style` and an escaped `lg\:col-4` (D-3, R12). `rg -n 'bs\.modal|data-bs-(toggle|dismiss)="modal"|class="modal|\bModal\b|popperjs' src package.json` finds nothing.
  - WI-2's tests pass with the rest of the gate.

#### WI-2 — Re-aim the PR-1 baseline rows and add the layout, dialog and CSP tests

- **domain:** `tests`
- **depends-on:** WI-1
- **satisfies:** AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-28, AC-29, AC-31
- **change:**
  - **Listed rows only (resolves D-5).**
    - `smoke.spec.js`: `Layout:` moves to 1279/1280 and grows to the full AC-4 table, with "1280 px" in its title. `Grid:` moves to 1023/1024 (AC-6 row 1).
    - `Dialog open:` asserts AC-9 ("dialog shown").
    - `Dialog dismiss:` uses the close button, then an outside click at viewport `(5, 5)`, after asserting that the point lies outside the `<dialog>` box. Both end in "dialog closed" (AC-11 paths 2–3).
    - `Abort on close:` waits on "dialog closed" (AC-13).
    - `helpers/contact-modal.js` and `helpers/full-visit.js` move to `*.bs.dialog`.
    - `portfolio.spec.js` `AC_121_WIDTHS` gains 1023, 1024, 1279 and 1280. `cleanup.spec.js` AC-24's title says "below 1280 px".
    - `css-targets.spec.js` `no @media or @container query in dist CSS uses range syntax`: the range check is re-aimed to `@media` params only, per §2.3's unconditional row. Its `@media` assertions are unchanged. Bootstrap 6's `@container (width>=…)` queries are never rewritten by Lightning CSS.
  - **`baseline-sensitivity.test.js`** (resolves Q-3):
    - The AC-91 case becomes AC-28. In `src/css/style.css` it replaces the exact strings `(width < 1280px)` and `(width >= 1280px)` with the `1200px` forms, and first asserts that there are 4 occurrences in total.
    - The AC-92 case becomes AC-29. On the `.contact-modal-btn` tag it replaces `data-bs-toggle="dialog"` with `"modal"`, and first asserts 1 occurrence.
    - `CONTROL_TEST` stays `'Grid:'`.
  - **New smoke tests.** AC-2, AC-5, AC-6 rows 2–4, AC-8 and AC-12. AC-10 adds the 10× Shift+Tab sequence to the existing `Dialog keyboard:` test, which is allowed (an addition). AC-31 goes in `csp.spec.js`, tagged `@live` too. A short-viewport reachability test is added, for example at 375 × 500 and at 1440 × 500. It opens the dialog, scrolls `.dialog-body`, and asserts that the submit button can be scrolled into view, is in the viewport and receives a click. Its title avoids `Layout`, `Dialog open` and `Grid:`.
  - **New lint tests.** `__tests__/acceptance/bootstrap6.test.js` runs AC-1's three reads and AC-7's two searches. The installed version is read from `node_modules/bootstrap/package.json` by path (`yq -p=json '.version' node_modules/bootstrap/package.json`, or the same file read with `fs`), not with `require('bootstrap/package.json')`, because v6's `exports` map does not export `./package.json`.
  - **Retire sprint 1 `cleanup.test.js` `AC-25: @popperjs/core remains`.** Its premise (sprint 1 C-17, Bootstrap 5 imports Popper) is gone, and §2.3 lists the retirement. It may be inverted to assert that `@popperjs/core` is absent.
  - **AC-27 scope:** AC-27 walks all of `tests/e2e` and `__tests__`, and a changed pattern constant counts against the test that uses it. New constants and tests are added alongside the existing ones. No existing constant is edited unless its test is a §2.3 row (here: `smoke.spec.js` rows, `AC_121_WIDTHS`, the `css-targets.spec.js` `@media` re-aim, `baseline-sensitivity.test.js` AC-91/AC-92, `cleanup.test.js` AC-25, `css-hygiene.test.js` `FORM_BOX_PATTERN`).
  - **Title rule:** no new test title may contain `Layout`, `Dialog open` or `Grid:`, because `expectOnlyTargetBroken` needs exactly one match for each.
- **done when:** the gate shows six zeros on PR-1's head. `yarn verify:release -t 'AC-28|AC-29|AC-90'` passes, and its output goes in the PR as a comment.

#### WI-10 — Fix the README minimally for Bootstrap 6 (PR-1)

- **domain:** `docs`
- **depends-on:** WI-1
- **satisfies:** AC-35 in part. It keeps sprint 1's `readme.test.js` AC-95 green once Bootstrap 6 lands.
- **change:** in `README.md`, only the Tech Stack row (Bootstrap 6, "dialog", no `@popperjs/core` mention) and the project-tree comment for `main.js` ("Bootstrap dialog"). The rest of the 5.0.0 docs stay with WI-8 in PR-4.
- **done when:** `readme.test.js` passes in PR-1's gate.

#### WI-3 — Rebuild the contact form, status regions and buttons

- **domain:** `frontend`
- **depends-on:** WI-2
- **satisfies:** AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-25, AC-36
- **change:**
  - **Markup.** Apply the §3.3 field, status and button markup. Rename `php-email-form` to `contact-form` in HTML and CSS, and delete the `.validate` divs and their rule (NG-10).
  - **`main.js`.**
    - Remove the 2 s auto-close timer and its `getOrCreateInstance` call (A-M2). On success, write `Your message has been sent. Thank you!` into `#sent-message`. On failure, write the service message into `#error-message`.
    - On `hidden.bs.dialog`, empty both regions, clear `aria-invalid` and the error texts, and reset the form, as today.
    - **Error wiring.** Native `required`/`type=email` validation stays, so it behaves the same without JS. An `invalid` listener on each field sets `aria-invalid="true"` and writes `validationMessage` into its `.field-error`. An `input` listener clears both once the field is valid.
  - **Buttons (resolves D-7).** Both buttons get `btn-solid btn-lg theme-site`. `btn-lg` gives the 44 px minimum height (AC-36), so no site padding or size rule is needed (AC-22). `style.css` gains `.theme-site`, the button-only accent theme that is the C-5 exception to NG-1, which sets only `--bs-theme-*` custom properties (V-4) from `--color-accent-strong`, `--color-accent-strong-hover` and `--color-white`. Take the exact token names from `rg -o -- '--bs-theme-[a-z-]+' node_modules/bootstrap/dist/css/bootstrap.css`. Delete `.contact-modal-btn` and `.contact-form button[type='submit']` with their `:hover` rules. The focus ring stays the global `:focus-visible` outline (`--color-focus`, AC-20). If `btn-solid`'s derived hover color falls below 4.5:1, set the hover token in `.theme-site`.
- **done when:** WI-4's tests pass with the rest of the gate.

#### WI-4 — Re-aim the submit rows and add the form, button and leftovers tests

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-25, AC-36
- **change:**
  - `smoke.spec.js` `Submit, success:` becomes AC-14, with the 5 s persistence check. `Submit, error:` becomes AC-15.
  - New smoke tests: AC-16, AC-17, AC-18, AC-19, AC-20 and AC-21. The contrast math reuses `helpers/contrast.js`, extended to convert `oklch()` to sRGB.
  - **AC-22** goes in a Node-side spec, `tests/e2e/button-rules.spec.js`. It loads `dist/index.html` with `page.setContent`, parses `src/css/style.css` with postcss, strips dynamic pseudo-classes, and counts forbidden declarations in the rules whose selector matches either button.
  - **AC-25** goes in `cleanup.test.js` through its `trackedFileSearch`. The pattern is joined from fragments, as `PACKAGE_PATTERN` is, so the file never matches itself.
  - **AC-36:** a new smoke test checks that `boundingBox().height` is at least 44 for both buttons, at `desktop` and at `small`.
  - **`css-tokens.test.js` AC-29 guard (§2.3 row):** the guard is narrowed so that it still fails on any `--bs-*` declaration in `style.css`, except `--bs-theme-*` declarations inside the `.theme-site` rule. Nothing else in that test changes.
  - `css-hygiene.test.js` AC-22's `FORM_BOX_PATTERN` follows the rename to `.contact-form`, with its `expect` lines unchanged. `a11y.spec.js` AC-45 needs no change, because the ids are kept.
- **done when:** the gate shows six zeros on PR-2's head.

#### WI-5 — Make the form work without JavaScript, and add the thank-you page

- **domain:** `frontend`
- **depends-on:** WI-4
- **satisfies:** AC-23, AC-24
- **change:** the §3.3 no-JS path. Add `.contact-nojs-link`, the `(scripting: none)` block, `#contactModal:target`, the `redirect` value, `redirect: 'false'` in the JSON payload, `src/thanks.html` + `src/css/thanks.css`, and the second build entry. The no-JS link needs its own `color` rule, because the global `a`/`a:hover` color rules are unlayered and beat `btn-solid`.
- **done when:** WI-7's tests pass with the rest of the gate.

#### WI-6 — Allow the thank-you redirect in the report-only CSP

- **domain:** `security`
- **depends-on:** none
- **satisfies:** AC-31 (the policy stays report-only and violation-free once the no-JS redirect exists)
- **change:** in `netlify.toml`, `form-action https://api.web3forms.com` → `form-action 'self' https://api.web3forms.com`. Nothing else changes.
- **who:** the tag stays `security` because the artifact is the security control. The Security Reviewer reviews rather than authors, and has no Edit tool. So the PR-3 frontend author (the Frontend Expert on WI-5) makes this one-line edit, and the Security Reviewer reviews it in its PR-3 pass.
- **done when:** the Security Reviewer's pass on PR-3 records no open finding on this line, and AC-31 passes in the gate.

#### WI-7 — Add the no-JS tests

- **domain:** `tests`
- **depends-on:** WI-5, WI-6
- **satisfies:** AC-23, AC-24, AC-30
- **change:** `tests/e2e/no-js.spec.js` runs with `javaScriptEnabled: false` and the `fixtures.js` guard on. **AC-24's mock** (resolves Q-1):
  - The test first asserts AC-24's first bullet: the form's `redirect` field is an absolute URL whose origin is `https://fs3portfolio.netlify.app`. The value WI-5 ships is `https://fs3portfolio.netlify.app/thanks.html`.
  - `page.route(WEB3FORMS_URL)` parses the urlencoded POST. It fulfills `303` with `Location` set to the test's own origin plus that value's pathname (`/thanks.html`). This models V-5's same-domain rule for the local target. The test then asserts that the final document URL equals that location, served from `dist` as `text/html`.
- **done when:** the gate shows six zeros on PR-3's head. `yarn verify:release -t 'AC-90'` passes, because AC-90 (AC-30) must still pass with the new spec in the smoke run.

#### WI-8 — Write the README and CHANGELOG for 5.0.0

- **domain:** `docs`
- **depends-on:** WI-7
- **satisfies:** AC-34, AC-35
- **change:**
  - `README.md`: Bootstrap 6 and "dialog" in the stack table and project tree, with no "modal" and no Popper line. "Supported browsers" states the C-2 floor and the `browserslist` value that actually ships: `defaults, iOS >= 15`, or the C-2 floor if RK-1 fired. Mention the no-JS form path and `/thanks.html`.
  - `CHANGELOG.md`: `## [5.0.0] - <date>` names Bootstrap 6 and the Chrome, Firefox and Safari floor, under Keep a Changelog headings.
- **done when:** AC-34's and AC-35's commands pass on PR-4's head.

#### WI-9 — Prepare release 5.0.0 and run the release checks

- **domain:** `ci`
- **depends-on:** WI-7
- **satisfies:** AC-26, AC-27, AC-32, AC-33
- **change:**
  - Bump `package.json` `version` to `5.0.0`. No tag and no GitHub release (C-12).
  - **AC-32 record (resolves Q-2).** Measure clean builds of tag `4.0.0` and of PR-4's head, using AC-32's four sums, and give the 8 numbers to the PR Agent for PR-4's body. The version and doc edits do not change `dist/`.
  - After the merge, on the release commit, run the gate, `yarn test:e2e:slow`, `yarn verify:release -t 'AC-28|AC-29|AC-90'`, `yarn test:e2e:live` once Netlify has deployed, AC-27's diff check and AC-33's three reads.
- **done when:** every command in AC-26, AC-27, AC-28 to AC-30, AC-32 and AC-33 passes, and the results are in the final report.

#### Unmapped work items

| ID | Title | Satisfies | Recommended owner | Why unmapped |
| --- | --- | --- | --- | --- |
| U-1 | Side-by-side visual review of 4.0.0 and PR-4's head at every §6 width, in headed desktop Chrome on Windows with classic scrollbars (`channel: 'chrome'`), dark mode at 1440, posted as a PR-4 comment | AC-3 | Frontend Expert (judgment), with Fred's acceptance at the release | A review produces no artifact, so no tag fits. |

### 3.5 Sequencing

PRs follow D-9 (resolves D-9). There are four PRs, merged one at a time. Each is on its own branch, in a worktree from the current `origin/main`. Each is gated by `yarn gate:linux` (six zeros on the pushed head) and one code-reviewer pass, and authored by the PR Agent. Every PR updates the baseline rows that its behavior change touches, so `main` stays green.

| Phase / PR | Work items | Order inside | Extra gate | Why this cut |
| --- | --- | --- | --- | --- |
| 1 — PR-1 Bootstrap 6 core | WI-1, WI-2, WI-10 | WI-1 → WI-2 ∥ WI-10 (the minimal README fix keeps sprint 1's `readme.test.js` AC-95 green) | the WI-2 release cases (AC-28, AC-29, AC-90) | The package swap, dialog markup and JS must be atomic (B8). The class renames and the 1280 px queries must land with them: on v6, `col-lg-*` and `d-xl-none` do not exist, so the grid and the menu button break, and `Layout:`/`Grid:` fail. |
| 2 — PR-2 Form and buttons | WI-3, WI-4 | WI-3 → WI-4 | none | Same element as PR-1, but needs no package change. |
| 3 — PR-3 No-JS path | WI-5 ∥ WI-6, then WI-7 | WI-5 and WI-6 in parallel | Security Reviewer (form redirect, `form-action`) | Kept apart so the security-triggered change is reviewed on its own. |
| 4 — PR-4 Release 5.0.0 | WI-8 ∥ WI-9, U-1 | parallel | AC-32 numbers in the body, U-1 comment | Release text and version. The post-merge checks (WI-9) close the sprint. |

The critical path is WI-1 → WI-2 → WI-3 → WI-4 → WI-5 → WI-7 → WI-9. PR-2 and PR-3 both edit the dialog form and `main.js`, so they do not run in parallel.

### 3.6 Risks & mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Affects |
| --- | --- | --- | --- | --- | --- |
| RK-1 | Lightning CSS, targeting `defaults, iOS >= 15`, lowers v6's `light-dark()`/`oklch()` tokens or `@layer` in a way that breaks colors or dark mode. Targeting the C-2 floor instead keeps range queries, which fails sprint 1's `css-targets.spec.js` range test as written. | med | high | WI-1 greps the built CSS, and AC-2, AC-6 and AC-8 run in PR-1's gate. **If RK-1 fires (any of those fails because of the lowered CSS), there is no halt.** Inside PR-1, WI-1 sets `package.json` `browserslist` to the C-2 floor (`chrome >= 130, edge >= 130, firefox >= 132, safari >= 18, ios_saf >= 18`). WI-2 re-aims the `css-targets.spec.js` range test to that floor, as §2.3's conditional row allows, and the PR body records that RK-1 fired. AC-27 counts that row only in this case. | WI-1, WI-2, WI-8 |
| RK-2 | Native `showModal()` lets Tab leave the document (V-2), so AC-10 fails or flakes. | med | med | WI-1 adds the Tab/Shift+Tab wrap, which matches v5's FocusTrap. | WI-1 |
| RK-3 | Playwright's `javaScriptEnabled: false` may not make `(scripting: none)` match in Chromium (not verified), so AC-23 cannot pass. | low | med | Fallback inside WI-5: gate the no-JS rules on `html:not(.js)`, and have `main.js` add `js` to `<html>` first thing. | WI-5, WI-7 |
| RK-4 | The real Web3Forms response to a no-JS POST is not documented (V-5). The redirect status, and the same-domain rule's effect on the live site, stay unproven, because C-9 forbids real submissions. | med | low | The mock follows the documented behavior. M-4 (the dashboard) and M-1 (bug reports) watch the live result. | WI-5, WI-7 |
| RK-5 | Netlify deploys each merge, so production gets the new browser floor at PR-1, before the 5.0.0 notes exist. | high | low | PR-1 to PR-4 merge in one run. The floor is accepted (C-2). | all |
| RK-6 | `btn-solid`'s derived hover or focus colors miss AC-19 or AC-20 with the site accent. | low | med | Override the hover token in `.theme-site`. The unlayered `:focus-visible` outline wins over Bootstrap's. | WI-3 |

**Operations:** monitoring — a static page has no runtime telemetry, and none is added (proportionality). The live checks (`test:e2e:live`, AC-31's `@live` CSP run) after the deploy, M-1 and M-4 are the watch. Backup — not applicable: no data is destroyed or rewritten. Rollback — revert the PR's merge on `main`, or use Netlify's instant rollback to the 4.0.0 deploy. There is no point of no return, because no tag or release is pushed (NG-10).

### 3.7 Test strategy

**TDD chains: none.** Every behavioral AC is observed in the browser (`e2e`), so it stays test-after: the tests come in the same PR, right after the source item. That includes AC-28, AC-29 and AC-30: their result is a Playwright test failing or passing in a mutated smoke run, and sprint 1 tagged the same cases `e2e`. AC-1, AC-7, AC-22, AC-25, AC-27, AC-34 and AC-35 (lint), AC-26 (build) and AC-3 (manual) get no chain by rule. Two ACs are below the browser and have no chain:

- **AC-32** reads a PR body against a measurement.
- **AC-33** reads `package.json` and the remote's tag and release state.

Both are records of the release, not code behavior. There is no surface to stub, so each runs as its own commands at the release (WI-9). **Guards: none**, because no acceptance test runs against stubs.

**Title rule:** across the smoke run, exactly one test title contains `Layout`, one contains `Dialog open`, and one contains `Grid:` (AC-28, AC-29).

| AC | Check | Level | Where it runs |
| --- | --- | --- | --- |
| AC-1 | `bootstrap6.test.js`: the three AC-1 reads | lint | gate (`test:ci`), PR-1 on |
| AC-2 | new smoke test, 10 widths | e2e | gate (smoke) |
| AC-3 | U-1 reviewer comment | manual | PR-4 |
| AC-4 | `smoke.spec.js` `Layout:` | e2e | gate |
| AC-5 | new smoke test | e2e | gate |
| AC-6 | `Grid:` (row 1) and a new test (rows 2–4) | e2e | gate |
| AC-7 | `bootstrap6.test.js`: two searches | lint | gate |
| AC-8 | new smoke test, light vs dark | e2e | gate |
| AC-9 | `Dialog open:` | e2e | gate |
| AC-10 | `Dialog keyboard:` (Tab ×10, Shift+Tab ×10) | e2e | gate |
| AC-11 | `Dialog keyboard:` (Escape), `Dialog dismiss:` (close, `(5, 5)`) | e2e | gate |
| AC-12 | new smoke test | e2e | gate |
| AC-13 | `Abort on close:` | e2e | gate |
| AC-14 | `Submit, success:` | e2e | gate, PR-2 on |
| AC-15 | `Submit, error:` | e2e | gate, PR-2 on |
| AC-16 – AC-21 | new smoke tests | e2e | gate, PR-2 on |
| AC-22 | `button-rules.spec.js` | lint | gate (smoke, after build) |
| AC-23, AC-24 | `no-js.spec.js` | e2e | gate, PR-3 on |
| AC-25 | `cleanup.test.js` tracked-file search | lint | gate, PR-2 on |
| AC-36 | new smoke test, button heights at `desktop` and `small` | e2e | gate, PR-2 on |
| AC-26 | gate, `test:e2e:slow` and `test:e2e:live` on the release commit | build | WI-9, after the merge |
| AC-27 | AC-27's diff walk over `git diff 4.0.0 <release> -- tests/e2e __tests__`: removed `expect` lines and changed pattern constants, matched to §2.3 rows, with the `css-targets.spec.js` row counted only if RK-1 fired | lint | WI-9 |
| AC-28, AC-29, AC-30 | `baseline-sensitivity.test.js` via `yarn verify:release` | integration | PR-1 (AC-28, AC-29, AC-90), PR-3 (AC-90), and WI-9 on the release commit |
| AC-31 | `csp.spec.js` (local and `@live`) | e2e | gate, and live in WI-9 |
| AC-32 | AC-32's re-measure against PR-4's body | integration | WI-9 |
| AC-33 | the three AC-33 reads | integration | WI-9, after the merge |
| AC-34, AC-35 | the AC commands | lint | PR-4 |

### 3.8 Domain tag summary

| Tag | Work items | Suggested specialist |
| --- | --- | --- |
| `frontend` | WI-1, WI-3, WI-5 | Frontend Expert |
| `security` | WI-6 | Security Reviewer |
| `tests` | WI-2, WI-4, WI-7 | Playwright E2E Test Engineer (e2e and release harness); JavaScript/TypeScript Unit Test Engineer (`__tests__/acceptance`) |
| `ci` | WI-9 | CI/CD Pipeline Engineer (release preparation) |
| `docs` | WI-10, WI-8 | Documentation Agent |

Unmapped: U-1.

#### Raised for Gate 2

None. D-1 to D-9 are each decided above: D-1, D-6 and D-8 in WI-1; D-2 and D-4 in §3.3; D-3 in §3.3 and RK-1; D-5 in WI-2; D-7 in WI-3; D-9 in §3.5.

# Spec: Sprint 3 — GSAP animations and reduced motion

| Field | Value |
| --- | --- |
| Slug | `gsap-animations` |
| Created | 2026-11-20 |
| Stage | `approved` |
| Brief | ✅ complete |
| PRD | ✅ complete |
| Technical Plan | ✅ complete |

**Test-first:** acceptance

_Every spec is TDD, and `acceptance` is the only value: each AC observable below the browser is covered by a §3.4 chain of stubs → failing acceptance tests → implementation, one chain per test seam. A spec reading `none`, or with no such line, was written before 2026-11-18 and is a record. To execute it again, the Architect first adds TDD chains to §3 and sets this line to `acceptance`, Stage returns to `draft`, and Fred approves it again at Gate 2._

**Spec rules:** v2

_A spec without this exact line began Stage 0 under the earlier rules, so Gate 1 skips its newer checks and the readiness review raises no finding for content an earlier stage was never asked to write._

> One feature, one file. Three sections, three owners, plus the Architect's kernel. Section owners never edit
> another owner's section — contradictions are reported upward, not silently patched.
> The `Stage` row is the Architect's. It reads `draft` until Fred approves at Gate 2,
> when the Architect sets it to `approved`.

---

## 0. Kernel

<!-- OWNER: Architect. No other agent may edit this section. -->

_Written at Stage 3, before Gate 2, and rewritten in the same edit as any later §3 revision. At
most 20 non-blank lines, heading excluded. Each bullet is non-empty and ends with the body IDs it
summarizes, in parentheses. Where this section and the body disagree, the body wins._

- **Purpose:** Release 5.1.0 replaces Typed.js and ScrollReveal with GSAP. It makes the page follow a reduced-motion preference everywhere, including when the preference changes while the page is open. It also fixes the hero for screen readers and for visitors without script, and moves keyboard focus to the section after in-page navigation. (G-1, G-2, G-3, G-4, G-5, G-8, G-13)
- **Capabilities:** GSAP core only. Reveals start from one IntersectionObserver, and the hero fades in before it types, under `gsap.matchMedia`. A static hero sentence serves screen readers, no-JS and reduced motion. Under reduced motion, navigation jumps, and the grid, the lightbox and the CSS transitions stop moving. Nav links and a hash on load focus the target section. The README carries a section 7 permission, and the notices carry GSAP's terms. All of it ships in four PRs. A release-suite file, committed red before the work, checks the release records, and the baseline-sensitivity proof is a named guard. (AD-1, AD-2, AD-5, AD-6, AD-7, AD-8, AD-9, AD-10, AD-11, AD-12, AD-13, AD-14, AD-18, WI-1, WI-2, WI-3, WI-7, WI-10, WI-17, WI-18)
- **Constraints:** The license stays GPL-3.0-only, and the permission reaches `main` no later than GSAP. Muuri's properties are never animated, and content never depends on script. Typing and reveals keep 5.0.0's look. Nothing in focus is hidden. The CSP stays report-only and raises nothing. Every PR head passes `yarn gate:linux`. (C-2, C-4, C-5, C-7, C-8, C-10, C-16, C-19, C-21)
- **Non-goals:** No change to the scroll listener, the browser's scrolling with motion allowed, or the layout engine. No typing pause control and no content change. No Renovate change, no CSP enforcement and no tag push. The larger script is not shrunk. (NG-1, NG-2, NG-3, NG-4, NG-6, NG-7, NG-8, NG-9, NG-11)
- **Success signal:** Every AC passes at the untagged 5.1.0 release commit. The baseline's sensitivity proof holds, and the visual check finds only the intended differences. Lighthouse accessibility is at least 95 on the live site. Lab LCP and first paint are recorded each release, and while the hero fade stays, median lab LCP is at most 3.6 s. (AC-37, AC-38, AC-42, AC-44, M-1, M-2)

---

## 1. Brief

<!-- OWNER: Analyst. No other agent may edit this section. -->

**Status:** ✅ complete

_Grounded 2026-11-20 against `origin/main` at `52b7c7e` (release 5.0.0), read in the worktree on branch `docs/sprint3-spec`. The update report (`update-report-2026-11-16/README.md`, `gsap-analysis.md`, `frontend-audit.md`) predates sprints 1 and 2. Its line numbers are stale, Isotope is gone (Muuri replaced it in sprint 1), and GSAP step 1 is done. Every fact below was checked against the current code, not the report._

### 1.1 Problem statement

In release 5.0.0, the page moves content that some visitors cannot opt out of. Its hero headline also fails visitors who use screen readers or have JavaScript off, and several effects have visible timing faults.

- **Reduced motion is ignored almost everywhere.** A visitor whose system asks for reduced motion (`prefers-reduced-motion: reduce`) still sees all of this:
  - every revealed section slides 60 px into place over one second (`src/js/main.js` `initScrollReveal`, lines 282–301);
  - the hero types and erases its phrases (`main.js:57–71`);
  - nav links, a URL hash on load and the back-to-top button glide to their target instead of jumping (`src/js/utils.js:10–16`, `main.js:500`, `main.js:526`);
  - the mobile nav slides in and out (`src/css/style.css:248–259`);
  - the portfolio caption links slide up on hover (`style.css:659–667`);
  - the lightbox runs the library's own open, close and slide effects, since none are configured (`main.js:276`; gsap-analysis §1a J10).

  Only the testimonial carousel's autoplay and the portfolio filter follow the preference, and both were fixed in sprint 1. The contact dialog does not move today, as checked by the Architect while writing §3. It reads Bootstrap 6 this way: the dialog gets a transform only from the slide and static classes, which `#contactModal` does not use (`index.html:510`: `dialog dialog-lg dialog-scrollable`), and its transitions apply only when motion is allowed. G-1 still covers the dialog as a guard (grilling R2-Q2). `style.css` has no reduced-motion rule. The only mention of the preference in `src/` is `main.js:74`, which serves those two.
- **A preference change made while the page is open is not followed everywhere.** The portfolio grid reads the preference once, when it is built, and sets its show, hide and layout durations from that reading (`main.js:93–101`). Only the filter call reads it again (`main.js:112`). So a visitor who turns reduced motion on after the page loads, and then resizes the window, sees the grid's re-layout animate. That makes the promise in grilling R1-Q13 false.
- **Keyboard focus stays behind after in-page navigation.** A nav link scrolls the page to its section but leaves focus on the link (`utils.js:172–189`). A URL hash on load scrolls to its target without moving focus at all (`main.js:497–501`). In both cases the next Tab continues from wherever focus was, not from the section now on screen (frontend-audit §7 A7).
- **The hero headline fails some visitors.** The phrase after "I am" is written into the page one character at a time. A screen reader meets a changing fragment and never a stable sentence (frontend-audit §7 A2). The phrase element is empty in the HTML (`src/index.html:124–126`), so with JavaScript off the headline reads "I am" and stops.
- **The hero starts out of order.** Typing starts first thing in page setup (`main.js:491–492`). At that moment the hero is still hidden and waiting on its reveal, which has a 200 ms delay and a one-second fade (`main.js:283–290`). So the first characters are typed into a line nobody can see yet.
- **The hero flashes on load.** Content above the fold paints, disappears when the reveal setup hides it, and then fades back in. Nothing hides it before the deferred module script runs (`index.html:552`).
- **The hero is revealed twice, with conflicting settings.** `main.js:290` and `main.js:294` both match `.hero-container` (`index.html:120`). The second setting overrides the first, so the configured "from top" movement never happens, and the visible effect is a fade with no movement (gsap-analysis §1b).
- **The service boxes wait on fixed delays.** The six service boxes reveal after fixed delays of 0 to 500 ms (`index.html:338–363`). When the second row scrolls into view later, it still waits up to half a second.

There is also an ownership problem. The owner has decided that both effects move to a different animation library (C-1). That library's license is not open source (C-3), and the repository is `GPL-3.0-only`. Neither license's text says whether the two may be shipped combined (gsap-analysis §4). Fred has decided how to resolve this (C-2), and his resolution must be in place before the library is.

### 1.2 Who is affected

- **Visitors who set their system to reduce motion.** They see every movement listed in §1.1 except the carousel and the filter. Those who turn the setting on while the page is open also see the grid's re-layout animate.
- **Screen-reader users.** They meet the hero headline as a changing fragment.
- **Keyboard users.** After choosing a nav link, or arriving on a URL with a hash, their next Tab does not continue from the section on screen.
- **Visitors with JavaScript off, or whose script fails to load or run.** They see a headline that stops at "I am".
- **Every visitor.** They get the load flash, the hero typing into a hidden line, and the service-box wait.
- **Fred, as owner and copyright holder.** He carries the license question (C-2, C-3), a heavier page script (C-9) and the 5.1.0 release (C-13).
- **Whoever executes this sprint and the ones after it.** Existing tests name Typed.js, ScrollReveal or `data-sr` in at least 9 files under `__tests__/` and `tests/e2e/` (19 occurrences, counted 2026-11-20 with Grep over those directories). The rendered-page baseline also measures elements "unaffected by ScrollReveal's entrance transforms" (`tests/e2e/smoke.spec.js:155–174`, `:692–714`).

Scale: unknown. No visitor analytics were checked, and none are cited in the inputs.

### 1.3 Goals

- **G-1** — A visitor with reduced motion on sees nothing on the page slide or zoom. Content that reveals is visible at once, and the hero shows the full sentence as static text (C-22). Nav links, a URL hash on load and back-to-top jump straight to their target. The mobile nav, the portfolio caption links, the contact dialog and the lightbox appear and disappear without sliding or zooming. Fades and color changes may remain (grilling R1-Q13, R2-Q2, R2-Q4).
- **G-2** — Turning the reduced-motion preference on or off while the page is open applies to everything G-1 covers, the portfolio grid's re-layout included, with no reload (grilling R1-Q13, R2-Q1).
- **G-3** — A screen reader announces exactly the hero sentence in C-22, once, and never character by character, whether motion is on or off (grilling R1-Q9, R2-Q4; C-6).
- **G-4** — With JavaScript off, or when the script fails, the hero shows the full sentence in C-22 as static text, and every section's content is visible (grilling R1-Q9, R1-Q12, R2-Q4).
- **G-5** — The hero loads without appearing, vanishing and reappearing (grilling R1-Q12).
- **G-6** — With motion allowed, typing starts only after the hero has finished appearing. Otherwise it behaves exactly as in 5.0.0 (C-7; grilling R1-Q8, R1-Q9).
- **G-7** — With motion allowed, reveals look as they do in 5.0.0 (C-8), with two intended differences. The hero has a single entrance with today's effective look: a fade with no movement. Each row of service boxes cascades from the moment that row enters the view, and no longer waits on fixed delays (grilling R1-Q10, R1-Q11).
- **G-8** — Typed.js and ScrollReveal are no longer dependencies and are absent from the built page (grilling R1-Q4).
- **G-9** — The repository stays `GPL-3.0-only` and carries a GPLv3 §7 additional permission that allows combining it with GSAP. The permission is in place no later than the first GSAP code (C-2). GSAP's license terms appear in the deployed site's third-party notices, as every other runtime dependency's do (C-3, C-15).
- **G-10** — After the change of engine, the rendered-page baseline still fails on an unintended visual change. Its sensitivity proof (sprint 1 G-16) holds, re-aimed wherever it depended on Typed.js or ScrollReveal (grilling R1-Q16).
- **G-11** — Before the release PR, every visible difference from 5.0.0 at the sprint 2 widths is listed, and each one is intended (grilling R1-Q17).
- **G-12** — The change in shipped script size is measured from the real build and recorded. Release 5.1.0 is prepared up to the tag. The README and CHANGELOG describe what shipped, including the license permission and the size change (grilling R1-Q14, R1-Q20, R1-Q21).
- **G-13** — After a nav link takes the visitor to a section, or a URL hash on load does, keyboard focus is at the target section, so the next Tab continues from there (grilling R2-Q3; frontend-audit §7 A7; A-8).

### 1.4 Non-goals

- **NG-1** — Moving the active-nav highlight and the back-to-top visibility off the existing scroll listener (gsap-analysis step 5). Sprint 1 already removed the per-scroll cost (sprint 1 G-10), visitors would see no difference, and it would re-open tested behavior (grilling R1-Q5).
- **NG-2** — Changing how in-page scrolling glides for visitors who allow motion (gsap-analysis step 6). The browser's own scrolling stays. The only change is jumping under reduced motion (G-1) (grilling R1-Q6).
- **NG-3** — Replacing the portfolio layout engine (gsap-analysis step 7). That step assumed Isotope, and sprint 1 replaced Isotope with Muuri (grilling R1-Q7).
- **NG-4** — A pause control for the hero typing. The typing stops after one pass, which already meets WCAG 2.2.2 (grilling R1-Q8).
- **NG-5** — Restoring the original template's reveal directions. Today's directions stay, because nobody has made that design decision (grilling R1-Q10).
- **NG-6** — Any content change: text, links, testimonials or the map (grilling R1-Q18).
- **NG-7** — Any Renovate configuration change. Automerge stays paused (grilling R1-Q19).
- **NG-8** — Enforcing the content security policy. It stays report-only (grilling R1-Q15).
- **NG-9** — Pushing the 5.1.0 tag or the GitHub release. Both wait for Fred's explicit go (grilling R1-Q20).
- **NG-10** — Relicensing the repository, or staying on the GPL animation libraries. Fred chose the §7 permission instead (grilling R1-Q2).
- **NG-11** — Shrinking the larger page script. It is measured and recorded, not reduced (grilling R1-Q14).
- **NG-12** — *Withdrawn. Grilling R2-Q3 brought focus after in-page navigation into scope, so it is now G-13. The ID is kept so it is not reused.*

### 1.5 Constraints

| ID | Constraint | Type | Source |
| --- | --- | --- | --- |
| C-1 | GSAP produces the scroll reveals and the hero typing, replacing ScrollReveal and Typed.js. | hard | Fred, grilling R1-Q2 (bundling GSAP); grilling R1-Q4 |
| C-2 | The repository keeps `GPL-3.0-only` and adds a GPLv3 §7 additional permission that allows combining with GSAP. No GSAP code lands before that permission does. | hard | Fred, grilling R1-Q2; sprint 3 coordinator brief ("no GSAP code lands before that permission does"); update report §2 "License gate (decide before any GSAP code lands)" |
| C-3 | GSAP is licensed under Webflow's Standard "no charge" license. It is not an open-source license, Webflow may amend or terminate it, and it forbids removing or altering proprietary notices. | hard | `npm view gsap version license` → 3.15.1, "Standard 'no charge' license" (§1.8 facts, 2026-11-20); gsap-analysis §4 (gsap.com/standard-license, read 2026-11-16) |
| C-4 | Muuri owns the transform, opacity and display of `.portfolio-item` and `.portfolio-wrap`. Nothing else may animate those properties on those elements. | hard | Sprint 1 D-16 / WI-37; `src/js/main.js:84`; `style.css:639` |
| C-5 | Content never depends on script to be seen. With JavaScript off or failing, every section's content stays visible. | hard | Grilling R1-Q12; sprint 2 no-JS work (sprint 2 R1-Q8) |
| C-6 | The hero typing meets frontend-audit §7 A2 (the full sentence is in the accessibility tree once and stays stable, and per-character changes are never announced) and A3 (it stops after its first cycle, or it has a pause control). | hard | Sprint 1 NG-5 ("Sprint 3 replaces the effect and must meet frontend-audit §7 A2 and A3"); grilling R1-Q8, R1-Q9 |
| C-7 | The typing keeps sprint 1's behavior and timings: each phrase is typed once, in order, at 100 ms per character, held 2 s, and erased at 50 ms per character back only to the shared start. Then the text and the cursor stop. | hard | Grilling R1-Q8; sprint 1 C-31; `main.js:57–71` |
| C-8 | Reveal directions stay as they are today: the About image enters from the right, and the About text from the left. | hard | Grilling R1-Q10 |
| C-9 | A larger page script is acceptable if it is measured and recorded. gsap-analysis §6 estimates about 36–38 KB gzip more than the roughly 9 KB of the two libraries it replaces. | hard | Grilling R1-Q14 |
| C-10 | The CSP stays report-only, and a full visit raises no violation reports with motion on or reduced. The current policy is `script-src 'self'`, `style-src 'self'`, with a hashed `style-src-attr`. | hard | Grilling R1-Q15; `netlify.toml:25` |
| C-11 | The carousel's reduced-motion behavior (no autoplay, Pause/Play toggle) and the portfolio filter's (instant) stay as sprint 1 shipped them. | hard | Sprint 1 C-35, C-37; grilling R1-Q13 ("already comply") |
| C-12 | The browser floor does not change: Chrome/Edge 130+, Firefox 132+ and Safari 18+. | hard | Sprint 2 C-2; grilling R1-Q20 ("no browser floor change") |
| C-13 | Sprint 3 ends with release 5.1.0, prepared up to the tag. The tag and the GitHub release wait for Fred's explicit go. | hard | Grilling R1-Q20 |
| C-14 | The new package is pinned exactly, like every other dependency. | hard | Grilling R1-Q19 |
| C-15 | In 5.0.0, the production build strips license comments from the bundles, and the deployed site's license notices come only from `dist/THIRD-PARTY-NOTICES.txt`. Today that file is built from the license files that direct runtime dependencies ship in their packages (`LICENSE*`, `LICENCE*`, `COPYING*`). The notices step skips a dependency that ships none, with a warning, and the build still succeeds. This describes the existing build, not a rule this sprint must keep. | hard | `scripts/third-party-notices.mjs:2–15` (5.0.0) |
| C-16 | The local gate `yarn gate:linux` is the CI of record, and every PR passes it on its head. | hard | Sprint 3 coordinator brief; sprint 2 C-11; `package.json:19` |
| C-17 | The copyright holder named in the README and the footer is Valhalla Tech. | hard | Sprint 1 C-5 (Fred, sprint 1 grilling R1-Q6); `README.md:226` |
| C-18 | Toolchain: Parcel 2, Yarn 4, Node 26, Jest (unit and acceptance) and Playwright (smoke and e2e baseline). Deployed on Netlify at `fs3portfolio.netlify.app`. | soft | Sprint 3 coordinator brief; `package.json` |
| C-19 | An element is never hidden or moved out of view while it holds keyboard focus. | hard | Grilling R2-Q6; frontend-audit §7 A5 |
| C-20 | Nothing on the page flashes more than three times per second. | hard | Grilling R2-Q6; frontend-audit §7 A6 (WCAG 2.3.1) |
| C-21 | Valhalla Tech grants the GPLv3 §7 additional permission, as the copyright holder already named in the README and the footer (C-17). Fred is Valhalla Tech, so grilling R1-Q2's "Fred holds the copyright" names the same holder. | hard | Grilling R2-Q5 |
| C-22 | The hero's full sentence is "I am a Designer, a Developer, a Photographer, a Coding Ninja", capitalized as the page has it today (`index.html:123–125`). Screen readers get exactly this sentence once. Visitors with reduced motion or without JavaScript see this same sentence as static text. | hard | Grilling R2-Q4; frontend-audit §7 A2 |

### 1.6 Open questions

None open. The coordinator answered Q-1 to Q-5 under Fred's standing instruction (grilling R1-Q3), and the answers are recorded in §1.8 as R2-Q1 to R2-Q5. Each row below is kept as a record, so its ID is not reused.

| ID | Question | Blocking? | Owner |
| --- | --- | --- | --- |
| Q-1 | *Resolved by grilling R2-Q1: in scope (G-2).* Does G-2 include the portfolio grid's re-layout? The grid reads the reduced-motion preference only once, when it is built (`main.js:93–101`), so a later change is not followed. | no | — |
| Q-2 | *Resolved by grilling R2-Q2: in scope (G-1). Fades may stay.* Are the contact dialog's open and close motion and the lightbox's effects covered by R1-Q13's "All movement"? | no | — |
| Q-3 | *Resolved by grilling R2-Q3: in scope (G-13; NG-12 withdrawn).* Does moving keyboard focus to the target section after in-page navigation (frontend-audit §7 A7) come into this sprint? | no | — |
| Q-4 | *Resolved by grilling R2-Q4: the full sentence, capitalized as today (C-22).* What static hero text is shown under reduced motion and with no JavaScript, and in what wording and capitalization do screen readers hear the sentence? | no | — |
| Q-5 | *Resolved by grilling R2-Q5: Valhalla Tech (C-21).* Who grants the §7 permission: Fred (R1-Q2) or Valhalla Tech (C-17)? | no | — |

### 1.7 Assumptions

- **A-1** — Both halves of grilling R1-Q12 can be met at once. The hero loads without a flash (G-5), and it is still visible if the script is slow, never arrives, or throws before showing it (C-5, G-4). → If this is false, one half has to give. Either the flash stays, or the hero can stay hidden when the script fails. That is a scope decision for Fred, and it changes the shape of the spec.
- **A-2** — Apart from the facts the §1.1 grounding corrected, gsap-analysis §1's motion inventory still holds for 5.0.0. The corrections: line numbers have moved, Muuri replaced Isotope, step 1 is done, and the testimonials are now revealed once on the carousel container (`index.html:381`) rather than per slide. → If this is false, some motion is missed by G-1 and surfaces only in the G-11 comparison.
- **A-3** — *Withdrawn. Grilling R2-Q2 settled it: the contact dialog and the lightbox are in G-1. The ID is kept so it is not reused.*
- **A-4** — No one other than Valhalla Tech (C-21) holds copyright in the repository's own code. Grilling R2-Q5 settles who the holder is. It does not say whether anyone else has contributed code that would need their own permission. → If this is false, the permission does not cover code held by others, and G-9 is incomplete until every holder agrees.
- **A-5** — *Withdrawn. Grilling R2-Q6 adopted frontend-audit §7 A5 and A6 as constraints C-19 and C-20. The ID is kept so it is not reused.*
- **A-6** — The new library can run under the current report-only policy (C-10) without raising violations. The basis is frontend-audit §7 A9: no `eval` and no inline script are needed, and styles set from script are allowed. → If this is false, C-10 and C-1 conflict, and Fred must choose between a policy change and the library.
- **A-7** — Under reduced motion, the lightbox's motion can be limited to fades without replacing the component, and a preference change while the page is open can reach it too (G-1, G-2). The lightbox is a third-party component with its own built-in motion (`main.js:276`). The contact dialog already does not move (§1.1), so for it G-1 is a guard against change, not new work. → If this is false, meeting G-1 means replacing or forking the lightbox. That is beyond what R2-Q2 decided and changes the shape of the spec.
- **A-8** — Grilling R2-Q3 calls in-page navigation a "jump", which is accurate only under reduced motion. G-13 reads it as covering in-page navigation in both motion modes, because the keyboard defect exists in both (`utils.js:172–189`, `main.js:497–501`). Back-to-top is not covered, because R2-Q3 names only nav links and the hash on load. → If this is false, focus moves only for visitors with reduced motion, and keyboard users who allow motion keep the defect.

### 1.8 Grilling record
_Written by the Analyst, verbatim from /spec Stage 0. Decision IDs are cited as sources elsewhere in the spec._

| ID | Question | Answer | Recommendation |
|---|---|---|---|
| R1-Q1 | Use `gsap-animations` as the spec slug (file `specs/gsap-animations.md`)? | gsap-animations (Recommended) — the slug the update report's Sprints table names. | took (coordinator) |
| R1-Q2 | GSAP ships under Webflow's Standard "no charge" license, which is not open source; the repo is GPL-3.0-only. How should the repo handle bundling GSAP? | GPL §7 exception (Recommended) — keep `GPL-3.0-only` and add a GPLv3 §7 additional permission that allows combining with GSAP. Fred holds the copyright (sprint 1 R1-Q5: the design is "all me"). | took (Fred) |
| R1-Q3 | Does Fred's sprint 2 autonomy rule carry to sprint 3? | Yes, same rule (Recommended). | took (Fred) |
| R1-Q4 | Are gsap-analysis steps 2–4 in sprint 3: ScrollReveal replaced by GSAP, Typed.js replaced by GSAP, and reduced motion for everything else on the page? | All three in (Recommended) — they are the sprint's purpose in the report's Sprints table. | took (coordinator) |
| R1-Q5 | Optional step 5: move the active-nav highlight and back-to-top visibility onto GSAP and retire the scroll listener? | Out (Recommended) — sprint 1 already fixed the per-scroll cost (G-10); visitors see no difference, and it re-opens tested behavior for no gain. | took (coordinator) |
| R1-Q6 | Optional step 6: smooth scrolling through GSAP instead of the browser? | Out (Recommended) — native smooth scrolling is free; the real gap (no reduced-motion handling) is fixed by R1-Q4's reduced-motion work. | took (coordinator) |
| R1-Q7 | Optional step 7: replace the portfolio layout engine with GSAP? | Out (Recommended) — the step assumed Isotope (GPL); sprint 1 replaced it with Muuri (MIT), so the premise is gone. | took (coordinator) |
| R1-Q8 | The hero typing effect: keep sprint 1's behavior (each phrase typed once, in order, then text and cursor stop) and its timings (type 100 ms/char, erase 50 ms/char, 2 s hold, erase back only to the shared start)? | Keep it (Recommended) — it already meets WCAG 2.2.2 by stopping, so no pause control is needed; the change is the engine, not the behavior. | took (coordinator) |
| R1-Q9 | Sprint 1 NG-5 deferred these typing items to sprint 3: screen readers get the full sentence once (not letter by letter), typing starts only after the hero has faded in, and with reduced motion or no JavaScript the hero shows static text. All in? | All in (Recommended) — frontend-audit §7 A2/A3 and sprint 1 NG-5 assign them here. | took (coordinator) |
| R1-Q10 | Reveal directions: the About image enters from the right and the text from the left today (the reverse of the original template). Keep today's look? | Keep today's look (Recommended) — no visible change unless Fred asks for one; restoring the template direction is a design decision nobody has made. | took (coordinator) |
| R1-Q11 | The six service boxes reveal with fixed delays (0–500 ms) even when row 2 scrolls in much later. Change them to a stagger counted from when each group enters? | Yes (Recommended) — the report names the fixed delays as a defect; the stagger keeps the cascade without the wait. | took (coordinator) |
| R1-Q12 | Above-the-fold content can appear, vanish and fade in on load (no hide rule before script runs). Must the hero load without that flash, while all content stays visible when JavaScript is off or fails? | Both (Recommended) — the flash is visible on every load; content must never depend on script to be seen (sprint 2 no-JS work). | took (coordinator) |
| R1-Q13 | With reduced motion on, what must stop? | All movement (Recommended): reveals show content at once, typing shows static text, smooth scrolling (nav links, hash on load, back-to-top) jumps, the mobile nav and the portfolio caption stop sliding. Color and opacity hover transitions may stay (they are not movement). The carousel and filter already comply (sprint 1). Changing the preference while the page is open is followed. | took (coordinator) |
| R1-Q14 | GSAP adds roughly 36–38 KB gzip of JavaScript (report §6 estimate) against ~9 KB for the two libraries it replaces. Accept the larger script if it is measured and recorded? | Accept and record it (Recommended) — the size is the known price of the sprint; numbers go in the PR and README as in sprint 2. | took (coordinator) |
| R1-Q15 | Does the CSP stay report-only, with a full visit (motion on and reduced) still raising no violation reports? | Yes (Recommended) — enforcing the CSP is not in the sprint 3 plan. | took (coordinator) |
| R1-Q16 | Does the rendered-page baseline keep its sensitivity proof (sprint 1 G-16; re-aimed in sprint 2), re-aimed where it depends on ScrollReveal or Typed.js? | Yes (Recommended) — the baseline must keep catching unintended change after the engine swap. | took (coordinator) |
| R1-Q17 | Before the release PR, a side-by-side visual check against 5.0.0 at the sprint 2 widths, listing every intended difference? | Yes (Recommended) — in sprint 2 it caught two live defects the smoke suite missed (sprint 2 decision 17). | took (coordinator) |
| R1-Q18 | Content (text, links, testimonials, map) stays as it is? | Stays (Recommended) — no content decisions are in the sprint 3 plan. | took (coordinator) |
| R1-Q19 | Renovate configuration unchanged in sprint 3 (automerge stays paused; the new package is pinned exactly like the rest)? | No Renovate change (Recommended) — not in the sprint 3 plan. | took (coordinator) |
| R1-Q20 | Does sprint 3 end in a tagged release, and with which version? | Yes, 5.1.0, prepared up to the tag; the tag and GitHub release wait for Fred's explicit go (Recommended) — no visitor loses anything (no browser floor change), the license only gains a permission, and reduced motion is a new feature; a tag is irreversible. | took (coordinator) |
| R1-Q21 | Does sprint 3 end with its own README and CHANGELOG update, including the license exception and the bundle-size change? | Yes (Recommended). | took (coordinator) |
| Done? | Shared understanding? | Proceed (Recommended) — frontier empty, 21 decisions. | took (coordinator) |
| R2-Q1 | §1 Q-1: the portfolio grid reads the reduced-motion preference once, when it is built (`main.js:93–101`), so its re-layout ignores a preference change made while the page is open. Is the grid's re-layout in scope? | in scope. A live change of the reduced-motion preference is followed everywhere, the portfolio grid's re-layout included. Reason: R1-Q13 already promises it; the gap makes that promise false. | took (coordinator) |
| R2-Q2 | §1 Q-2: R1-Q13's answer is "All movement", but its list leaves out the contact dialog's open and close motion and the lightbox's effects. Are they in scope? | in scope. Under reduced motion, nothing slides or zooms, the contact dialog and the lightbox included; fades may stay (consistent with R1-Q13's "color and opacity may stay"). Reason: R1-Q13's headline is "all movement". | took (coordinator) |
| R2-Q3 | §1 Q-3: should moving keyboard focus to the target section after in-page navigation (frontend-audit §7 A7; §1 NG-12) come into this sprint? | in scope, not a non-goal. After a nav-link jump (and the hash-on-load jump), keyboard focus moves to the target section, so the next Tab continues from there. Reason: the same scrolling code is changed for reduced motion in this sprint; a keyboard defect in the code the sprint opens is fixed rather than left (org triage: Low in the change's blast radius is fixed). Remove NG-12 or turn it into a goal. | took (coordinator) |
| R2-Q4 | §1 Q-4: under reduced motion and with no JavaScript, what static hero text is shown, and in what wording and capitalization do screen readers hear the sentence? | the full sentence, in the capitalization the page uses today: "I am a Designer, a Developer, a Photographer, a Coding Ninja". Screen readers get exactly that sentence once, never per character (frontend-audit A2). Visitors with reduced motion or without JavaScript see that same full sentence as static text. Reason: they get the same information animated visitors see over time. | took (coordinator) |
| R2-Q5 | §1 Q-5: who grants the §7 permission, Fred (R1-Q2) or Valhalla Tech (README, footer, sprint 1 C-5)? | Valhalla Tech, the copyright holder already named in the README and footer (sprint 1 C-5). Fred is Valhalla Tech; R1-Q2's "Fred holds the copyright" means the same holder. | took (coordinator) |
| R2-Q6 | §1 A-5: do frontend-audit §7 A5 and A6 apply to the new reveals and typing as assumptions or as constraints? | adopt both as constraints, not assumptions: an element is never hidden or moved out of view while it holds keyboard focus, and nothing flashes more than 3 times per second. | took (coordinator) |

#### Deferred to Technical Plan
_Solution-space questions raised during grilling and not asked. The Architect resolves each in §3 or raises it at Gate 2._
- D-1: How GSAP is imported and its plugins registered under Parcel and Jest (one module that imports, registers and re-exports), which plugins are used, and how the bundle-size change is measured from the real build.
- D-2: The wording and location of the GPLv3 §7 additional permission (LICENSE, README, `package.json` license field and any SPDX expression), and how GSAP's license and notices survive the build (`dist/THIRD-PARTY-NOTICES.txt`, banner comments under Parcel's minifier).
- D-3: How the typing effect is rebuilt (core timeline vs TextPlugin), how erasing back to the shared start is computed and tested, how the cursor stops, and how the full sentence reaches screen readers once.
- D-4: How the hero avoids the load flash without hiding content when JavaScript is off or fails (a `scripting` media-query gate, init order, isolating other initializers).
- D-5: How the reveals map onto GSAP (per-element tweens, batch and stagger, `once`, callback limits, refresh after Muuri layout and filtering), while never animating Muuri-owned properties on `.portfolio-item`/`.portfolio-wrap` (sprint 1 D-16) or individual carousel slides.
- D-6: How reduced motion is applied to GSAP motion, CSS transitions (`left`/`bottom` → transform or none), smooth scrolling and back-to-top, and how a live preference change is followed.
- D-7: Which existing tests change (sprint 1/2 acceptance and e2e tests that name Typed.js, ScrollReveal or `data-sr`, `motion.spec.js`, the smoke baseline and its sensitivity proof) and which new tests are added.
- D-8: How the work is sliced into PRs, given each PR must pass `yarn gate:linux` on its head and the license permission must land before or with the first GSAP code.

---

## 2. PRD

<!-- OWNER: Product Manager. No other agent may edit this section. -->

**Status:** ✅ complete

### 2.1 Summary

Release 5.1.0 replaces Typed.js and ScrollReveal with GSAP, and makes the page follow a reduced-motion preference everywhere, including when the preference changes while the page is open. Visitors who reduce motion see content at once, with nothing sliding or zooming. Screen-reader users hear the hero sentence once. Visitors whose script is off or fails see the full sentence and every section. Keyboard users land on the section they navigated to. The hero loads without a flash and types only after it has appeared. Apart from that, reveals look as they do in 5.0.0. The repository adds a GPLv3 section 7 permission for GSAP no later than the first GSAP code.

### 2.2 Requirements

| ID | Requirement | Priority | Satisfies |
| --- | --- | --- | --- |
| R-1 | GSAP is a runtime dependency, pinned to an exact version, and the page script imports it to produce the reveals and the hero typing (C-1, C-14). | MUST | G-8 |
| R-2 | Typed.js and ScrollReveal are not declared, not locked, not imported and not present in the build or its third-party notices. | MUST | G-8 |
| R-3 | The repository stays `GPL-3.0-only` and carries a GPLv3 section 7 additional permission, granted by Valhalla Tech, that allows combining it with GSAP. The permission is on `main` no later than the first commit that adds GSAP (C-2, C-21). | MUST | G-9 |
| R-4 | `dist/THIRD-PARTY-NOTICES.txt` carries a section for GSAP with its pinned version and its license terms (C-3, C-15). | MUST | G-9 |
| R-5 | Under reduced motion, every reveal target is fully visible, at its final position, from the first frame it is in view. | MUST | G-1 |
| R-6 | Under reduced motion, the hero shows the C-22 sentence as static text from the first frame, and nothing in the hero changes. | MUST | G-1 |
| R-7 | Under reduced motion, nav links, a URL hash on load and back-to-top jump to their target with no intermediate scroll positions. | MUST | G-1 |
| R-8 | Under reduced motion, the mobile nav opens and closes without sliding. | MUST | G-1 |
| R-9 | Under reduced motion, the portfolio caption links appear and disappear without sliding. | MUST | G-1 |
| R-10 | Under reduced motion, the contact dialog opens and closes without moving or changing size. It may fade. | MUST | G-1 |
| R-11 | Under reduced motion, the lightbox opens, changes slide and closes without its images moving or changing size. It may fade. | MUST | G-1 |
| R-12 | The carousel's and the portfolio filter's reduced-motion behavior stays as sprint 1 shipped it (C-11). | MUST | G-1 |
| R-13 | A change of the reduced-motion preference while the page is open, in either direction, applies to everything R-5 to R-11 covers, with no reload. | MUST | G-2 |
| R-14 | The portfolio grid's re-layout follows a change of the reduced-motion preference made while the page is open, in either direction. | MUST | G-2 |
| R-15 | The accessibility tree holds the C-22 sentence once, it does not change while the hero types, and no live region inside the hero announces changes. This holds with motion allowed, with reduced motion and with JavaScript off (C-6). | MUST | G-3 |
| R-16 | With JavaScript off, or with the page script failing, the hero shows the C-22 sentence and every reveal target is visible. While the script is slow to arrive, the hero is visible (C-5, A-1). | MUST | G-4 |
| R-17 | With motion allowed, the hero's opacity never drops once it has started to appear. | MUST | G-5 |
| R-18 | With motion allowed, the first typed character appears only after the hero is fully visible. | MUST | G-6 |
| R-19 | The typing keeps 5.0.0's behavior: the phrases once, in order, at 5.0.0's speeds, erasing only back to the shared start, then the text and the cursor stop (C-7). | MUST | G-6 |
| R-20 | With motion allowed, reveals keep 5.0.0's directions, distance and duration (C-8). | MUST | G-7 |
| R-21 | With motion allowed, the hero has a single entrance: a fade with no movement. | MUST | G-7 |
| R-22 | With motion allowed, each row of Services boxes starts its cascade when the row enters the view, with no fixed per-box wait. | MUST | G-7 |
| R-23 | The reveals never disturb the portfolio grid. A filter change during the portfolio reveal ends in the filter's correct state (C-4). | MUST | G-7 |
| R-24 | An element is never hidden or moved out of view while it holds keyboard focus (C-19). | MUST | G-7, G-13 |
| R-25 | Nothing on the page flashes more than three times in any one second (C-20). | MUST | G-6, G-7 |
| R-26 | After a nav link, or a URL hash on load, takes the visitor to a section, keyboard focus is at that section, and the next Tab continues from there. This holds in both motion modes (A-8). | MUST | G-13 |
| R-27 | A URL hash that names no element, or that is malformed, is ignored: no error, no scroll, no focus move, and nothing from it is put in the page. | MUST | G-13 |
| R-28 | With motion allowed, nav links and back-to-top keep gliding, as the browser's own scrolling does in 5.0.0 (NG-2). | MUST | G-1 |
| R-29 | The rendered-page baseline's sensitivity proof (the AC-90, AC-28 and AC-29 release cases) passes at the release commit. | MUST | G-10 |
| R-30 | Every suite passes at the release commit, every sprint 3 PR passes `yarn gate:linux` on its head, and only the earlier assertions listed under "Earlier assertions changed on purpose" change (C-16). | MUST | G-10 |
| R-31 | The CSP stays report-only, and a full visit raises no violation, with motion allowed and with reduced motion (C-10). | MUST | G-8 |
| R-32 | A side-by-side visual check against 5.0.0 at the sprint 2 widths finds only the intended differences in AC-42, and is recorded before the release PR merges. | MUST | G-11 |
| R-33 | The raw and gzip JavaScript sizes of the 5.0.0 build and the release build are measured and recorded (C-9). | MUST | G-12 |
| R-34 | `package.json` reads 5.1.0 at the release commit, and no 5.1.0 tag or GitHub release exists (C-13, NG-9). | MUST | G-12 |
| R-35 | The README and the CHANGELOG describe 5.1.0: GSAP, reduced motion, the section 7 permission and the script size change. Neither names Typed.js or ScrollReveal as current, and the browser floor is unchanged (C-12). | MUST | G-12 |

#### Non-functional requirements

| ID | Category | Threshold | How measured | Planned evidence | Not applicable because |
| --- | --- | --- | --- | --- | --- |
| NFR-1 | performance | — | — | — | §1 sets no performance threshold. C-9 and NG-11 accept a larger page script with no cap, so R-33 measures and records it, and M-2 and M-3 track it after ship. |
| NFR-2 | security | 0 `securitypolicyviolation` events and 0 CSP console messages on a full visit, with motion allowed and with reduced motion, at both targets; the policy is served only as `Content-Security-Policy-Report-Only`, equal to `netlify.toml`'s value | A Playwright listener for `securitypolicyviolation`, a console filter for `/Content.Security.Policy/i`, and the document response headers | AC-41, in the gate run (local target) and in `yarn test:e2e:live` (live target) | — |
| NFR-3 | capacity | — | — | — | §1 sets no traffic, data or concurrency target. The page is static and served by Netlify. |
| NFR-4 | availability | — | — | — | §1 sets no uptime or recovery target. What the page shows when its script fails (C-5, G-4) is functional behavior, covered by R-16. |

### 2.3 Acceptance criteria

_Ground truth for evaluating execution agents. Every AC is written to be assertable._

#### Conventions used by every AC below

Sprint 1's conventions (`specs/stabilize-and-cleanup.md` §2.3) and sprint 2's additions (`specs/bootstrap-6-upgrade.md` §2.3) apply unchanged. That covers the local and live targets, the `desktop`, `tablet`, `small` and `phone` viewports, the full visit, the Tab walk, the tracked-file search, the gate, the smoke command, `lint`, GitHub reads, test-first, the §6 widths, and roles before today's selectors. The additions and overrides are these:

- **Release commit:** the commit on `main` whose `package.json` `version` is `5.1.0`. It stays untagged in this sprint (C-13).
- **Baseline:** tag `5.0.0`.
- **Reduced motion on:** `page.emulateMedia({ reducedMotion: 'reduce' })`, set before navigation. **Motion allowed:** the same call with `'no-preference'`.
- **Live switch:** the same call made after `load`, with no reload. The AC's trigger starts 500 ms after it.
- **Hero sentence:** `I am a Designer, a Developer, a Photographer, a Coding Ninja` (C-22). Text is compared after collapsing each whitespace run to one space and trimming.
- **Roles, not today's selectors.** §3 names the selector or hook for each of these:
  - The **hero container**: today `.hero-container`.
  - The **hero line**: today the `<p>` in the hero container.
  - The **typing element**: the element whose text is typed, today `.typed`.
  - The **typing cursor**: today `.typed-cursor`.
  - The **lightbox image**: today the `img` inside GLightbox's `.gslide.current`.
- **Visible hero line:** the text of the text nodes inside the hero line whose parent element is shown and has a box of at least 2 × 2 px, joined in document order and whitespace-collapsed. A visually hidden copy (1 × 1 px) is not counted.
- **Reveal targets:** the 13 elements that carry `data-sr` at 5.0.0, by role. The `data-sr` attribute itself may go, and §3 names a hook for each.
  1. the hero container
  2. the About photo column
  3. the About text column
  4. the portfolio filter row
  5. the portfolio grid container
  6. to 11. the six Services boxes, in source order. At `desktop` boxes 6–8 form row 1 and boxes 9–11 form row 2.
  12. the testimonial carousel
  13. the contact row
- **Effective opacity:** the product of the computed `opacity` of the element and every ancestor. It is 0 if the element or an ancestor has computed `visibility` other than `visible` or `display: none`. An element is **shown** when its effective opacity is above 0.
- **Frame trace:** a `requestAnimationFrame` loop in the page that records, each frame, `performance.now()`, the traced element's box (`x`, `y`, `width`, `height`), its effective opacity and `window.scrollY`. It runs for 1.5 s from the trigger unless the AC says otherwise. Boxes are document-relative (`rect.x + scrollX`, `rect.y + scrollY`) for elements in the page flow. They are viewport-relative for fixed elements: the sidebar (`#header`), the dialog, the lightbox and back-to-top. GSAP tweens do not appear in `document.getAnimations()`, so the motion ACs read frame traces, not the Web Animations list.
- **No movement:** in a frame trace, across every frame in which the element is shown, each of `x`, `y`, `width` and `height` stays within 1 px of its value in the last frame in which it is shown. Opacity may change.
- **Jump:** in a frame trace of `window.scrollY`, no value is more than 1 px away from both the first value and the last value. **Glide:** at least one value is more than 1 px away from both.
- **JS bundle:** every same-origin `.js` response that the release build's `dist/index.html` loads.
- **Flash count:** in an effective-opacity trace, each crossing of 0.5 in either direction is one transition. Any 1 000 ms window with more than 6 transitions holds more than 3 flashes.

#### Earlier assertions changed on purpose

These are the only sprint 1 and sprint 2 assertions that sprint 3 may change. AC-40 checks this list. New tests and new assertions may be added. Comment-only edits, such as the ScrollReveal wording at `smoke.spec.js:155` and `:174` and `portfolio.spec.js:148`, are free. If §3 finds another assertion that must change, it reports it back, and a row is added here before Gate 2.

| File | Test or helper (title starts with) | Change | Goal |
| --- | --- | --- | --- |
| `tests/e2e/motion.spec.js` | `AC-110` | `TYPED_ELEMENT` (`.typed`) follows the typing element, and the phrases may come from `TYPED_PHRASES` instead of the `data-typed-items` attribute. The expected list is unchanged. | G-6, G-8 |
| `tests/e2e/motion.spec.js` | `AC-111`, `AC-112` | `TYPED_ELEMENT` follows the typing element in the shared recorder. The 45 s, 10 s and `a Coding Ninja` values and the `#hero` animation check are unchanged. | G-6, G-8 |
| `tests/e2e/smoke.spec.js` | `About text and photo:` | The `[data-sr="fade-right"]` locator follows the About photo column's hook. The assertions are unchanged. | G-8 |
| `tests/e2e/smoke.spec.js` | helper `settle` | The `[data-sr]` "unrevealed" test follows the reveal-target hooks. The `expect.poll` and its running-animation check stay. | G-8 |
| `tests/e2e/a11y.spec.js` | helper `settle` (used by `AC-45`) | As in `smoke.spec.js` `settle`. | G-8 |
| `tests/e2e/helpers/portfolio.js` | `revealPortfolio` | The poll message loses its ScrollReveal wording. Its condition may add a check that the GSAP reveal has finished. The opacity and transition checks stay. | G-8 |
| `__tests__/acceptance/readme.test.js` | `AC-95` | `LIBRARY_PACKAGES` loses the `Typed.js` and `ScrollReveal` rows and gains `GSAP` → `gsap`. The check is unchanged. | G-8, G-12 |
| `__tests__/acceptance/readme.test.js` | `AC-100` | **Conditional.** Only if §3 sets `package.json` `.license` to a `GPL-3.0-only WITH <id>` expression (AC-3), the `packageLicense` expectation becomes that expression. The README checks are unchanged. | G-9 |

#### AC-1 — GSAP is installed and pinned exactly

- **Verifies:** R-1
- **Security or auth:** no
- **Given** the release commit after `yarn install --immutable`
- **When** the declared and installed GSAP versions and the page script's imports are read
- **Then** `gsap` is a runtime dependency at an exact version, installed at that version, and imported by the page script
- **Assertion:**
  - `yq -p=json '.dependencies.gsap' package.json` prints a value matching `^\d+\.\d+\.\d+$`.
  - `yq -p=json '.version' node_modules/gsap/package.json` prints the same value.
  - `rg -l -e "from ['\"]gsap(/[^'\"]*)?['\"]" src/js` prints at least 1 file.
- **Executable as:** `lint`

#### AC-2 — Typed.js and ScrollReveal are gone from the repository and the build

- **Verifies:** R-2
- **Security or auth:** no
- **Given** the release commit after `yarn install --immutable && yarn build`
- **When** the manifest, the lockfile, `src/` and `dist/` are searched
- **Then** neither library is declared, locked, imported or built in
- **Assertion:**
  - `yq -p=json '[.dependencies, .devDependencies, .optionalDependencies] | .[] | select(. != null) | keys | .[]' package.json` prints no `typed.js` line and no `scrollreveal` line, and exits 0. A section that `package.json` does not have is skipped, not an error.
  - `rg -n -e '^"?(typed\.js|scrollreveal)@' yarn.lock` prints nothing and exits 1.
  - `rg -n -e "from ['\"](typed\.js|scrollreveal)['\"]" src` prints nothing and exits 1.
  - `rg -l -F -e 'data-sr-id' -e 'typed-fade-out' dist` prints nothing and exits 1. These are ScrollReveal's marker attribute and Typed.js's default fade class, string literals that survive minification.
  - `dist/THIRD-PARTY-NOTICES.txt` has no line that starts with `typed.js ` or `scrollreveal `.
- **Executable as:** `build`

#### AC-3 — The repository stays GPL-3.0-only and carries the section 7 permission for GSAP

- **Verifies:** R-3
- **Security or auth:** no
- **Given** `README.md`, `package.json` and `LICENSE` at the release commit, and `LICENSE` at `5.0.0`
- **When** the license field, the README `## License` section and the permission text are read
- **Then** the license is still GPL-3.0-only, the GPLv3 text is intact, and a permission granted by Valhalla Tech names GSAP and GPLv3 section 7
- **Assertion:**
  - `yq -p=json '.license' package.json` matches `^GPL-3\.0-only( WITH [A-Za-z0-9.+-]+)?$`.
  - The README `## License` section contains `GPL-3.0-only` and does not contain `GPL-3.0-or-later`. This is sprint 1 AC-100, kept.
  - The permission text is the README `## License` section, or a file that section links to by relative path, and `git ls-files --error-unmatch <path>` exits 0 for that file. The permission text contains `GSAP`, contains `Valhalla Tech`, and matches `/section 7|§\s?7/i`.
  - The full text of `LICENSE` at `5.0.0` appears unchanged, as one contiguous block, in `LICENSE` at the release commit.
- **Executable as:** `lint`

#### AC-4 — The permission is on main no later than the first GSAP code

- **Verifies:** R-3
- **Security or auth:** no
- **Given** the commits `git log --first-parent --reverse --format=%H 5.0.0..<release commit>` on `main`
- **When** F is found: the first of those commits where `git show <c>:package.json | yq -p=json '.dependencies.gsap'` does not print `null`, or `git grep -l -E "from ['\"]gsap" <c> -- src` prints at least 1 file
- **Then** F's tree already carries the permission
- **Assertion:** F exists, and every AC-3 check passes when it is run on F's tree instead of the release commit's
- **Executable as:** `integration`

#### AC-5 — GSAP's license terms ship in the third-party notices

- **Verifies:** R-4
- **Security or auth:** no
- **Given** a clean build of the release commit (`yarn install --immutable && yarn build`), with the build's stderr captured
- **When** `dist/THIRD-PARTY-NOTICES.txt` and the stderr are read
- **Then** the notices file has a GSAP section with its pinned version and its license text, and the build warns about nothing for GSAP
- **Assertion:**
  - The file has a line equal to `gsap <v>`, where `<v>` is AC-1's version. The next line starts with `License: ` and contains `no charge`, case-insensitive (C-3).
  - The GSAP section's body has at least 1 line matching `^--- .+ ---$`, followed by at least 1 non-blank line. Each section opens with a header block: the name line and the `License: ` line, closed by a `====` rule line (a line matching `^====+$`) right after the `License: ` line. The body starts after that closing rule and runs up to the next `====` rule line, which opens the next section's header, or to the end of the file. This is the reading `tests/e2e/build-output.spec.js` uses.
  - The stderr has no line that starts with `third-party-notices: warning: gsap `.
- **Executable as:** `build`

#### AC-6 — Under reduced motion, every reveal target is visible at once and does not move

- **Verifies:** R-5
- **Security or auth:** no
- **Given** the local target at `desktop`, and again at `small`, with reduced motion on
- **When** the page loads and is scrolled to the bottom in 400 px steps, 100 ms apart, with a frame trace of all 13 reveal targets from `load` until 1.5 s after the last step
- **Then** in every frame in which a reveal target's box is in the viewport, the target is fully opaque and in its final position
- **Assertion:** for each reveal target, in every frame in which its viewport box intersects the viewport:
  - its effective opacity is 1;
  - its document-relative `x` and `y` are within 1 px of their values in the last frame.
- **Executable as:** `e2e`

#### AC-7 — Under reduced motion, the hero shows the full sentence as static text

- **Verifies:** R-6
- **Security or auth:** no
- **Given** the local target at `desktop` with reduced motion on, and an init script that starts a frame trace of the hero container from the first frame in which it is in the document. Each frame also records the visible hero line and the effective opacity of every element inside `#hero`.
- **When** the trace runs until 5 s after `load`
- **Then** the hero is fully visible and shows the hero sentence from the first frame, and nothing in it changes
- **Assertion:**
  - In every frame, the hero container's effective opacity is 1, and the visible hero line equals the hero sentence.
  - No element inside `#hero` has a different effective opacity in any frame than in the first frame. A blinking cursor fails this.
- **Executable as:** `e2e`

#### AC-8 — Under reduced motion, in-page navigation jumps

- **Verifies:** R-7
- **Security or auth:** no
- **Given** the local target at `desktop` with reduced motion on
- **When** each case runs with a frame trace of `window.scrollY` from its trigger:
  1. From the top of the page, the nav link "About" is clicked.
  2. From the top of the page, the nav link "Contact" is clicked.
  3. `/#services` is loaded fresh. The trace starts in an init script, at the first frame.
  4. The page is scrolled instantly to `#contact`, and back-to-top is clicked.
- **Then** every case jumps, and each ends at its target
- **Assertion:**
  - Each trace is a jump (Conventions).
  - In cases 1–3, the last `scrollY` differs from 0 by more than 100 px.
  - In case 4, the last `scrollY` is 0.
- **Executable as:** `e2e`

#### AC-9 — Under reduced motion, the mobile nav opens and closes without sliding

- **Verifies:** R-8
- **Security or auth:** no
- **Given** the local target at `small` with reduced motion on, with the nav closed
- **When** the menu button is clicked with a frame trace of `#header`, and after the trace ends, the menu button is clicked again with a second trace
- **Then** the sidebar is either fully out or fully in, in every frame
- **Assertion:**
  - In the opening trace, the last frame's `#header` `x` is 0, and no frame has an `x` between −299 and −1.
  - In the closing trace, the last frame's `x` is ≤ −300, and no frame has an `x` between −299 and −1.
- **Executable as:** `e2e`

#### AC-10 — Under reduced motion, the portfolio caption links appear without sliding

- **Verifies:** R-9
- **Security or auth:** no
- **Given** the local target at `desktop` with reduced motion on, `#portfolio` in view, the grid ready (`waitForPortfolioGrid`) and 2 s idle
- **When** the pointer hovers item 1's card (today `.portfolio-wrap`), with a 1 s frame trace of item 1's caption links (today `.portfolio-links`), and then the pointer moves to `(0, 0)`, with a second 1 s trace
- **Then** the links never sit between their hidden and shown positions
- **Assertion:**
  - In each trace, no frame has a viewport `y` more than 1 px away from both the first frame's `y` and the last frame's `y`.
  - At the end of the hover trace, the links' box `bottom` equals the card's box `bottom` ± 1 px.
- **Executable as:** `e2e`

#### AC-11 — Under reduced motion, the contact dialog opens and closes without moving

- **Verifies:** R-10
- **Security or auth:** no
- **Given** the local target at `desktop` with reduced motion on
- **When** the contact button is clicked, with a frame trace of the dialog, and after the trace ends, Escape is pressed, with a second trace
- **Then** the dialog never moves or changes size while it is shown. It may fade.
- **Assertion:**
  - Both traces show no movement (Conventions).
  - The dialog is shown in the last frame of the opening trace, and is not shown in the last frame of the closing trace.
- **Executable as:** `e2e`

#### AC-12 — Under reduced motion, the lightbox opens, changes slide and closes without moving

- **Verifies:** R-11
- **Security or auth:** no
- **Given** the local target at `desktop` with reduced motion on, `#portfolio` in view and the `All` filter active
- **When** each step runs with a frame trace:
  1. Item 1's enlarge link is clicked. The trace follows the lightbox image.
  2. ArrowRight is pressed. The trace follows both the outgoing and the incoming lightbox image.
  3. Escape is pressed. The trace follows the lightbox image.
- **Then** no lightbox image moves or changes size while it is shown. Fades may remain.
- **Assertion:**
  - Every traced image shows no movement (Conventions) in every step.
  - After step 1, the image is shown and has `naturalWidth > 0`.
  - After step 3, the lightbox is not shown.
- **Executable as:** `e2e`

#### AC-13 — The carousel and the portfolio filter keep sprint 1's reduced-motion behavior

- **Verifies:** R-12
- **Security or auth:** no
- **Given** the release commit
- **When** `yarn test:smoke` and `yarn test:e2e:slow` run against the local target with the Playwright JSON reporter
- **Then** sprint 1's reduced-motion tests pass, with their assertions as they were at `5.0.0`
- **Assertion:**
  - The tests whose titles start with `AC-109`, `AC-124` and `D-14 Reduced motion` have status `passed`.
  - `git diff 5.0.0 <release commit> -- tests/e2e/motion.spec.js tests/e2e/portfolio.spec.js tests/e2e/carousel-controls.spec.js` removes no line containing `expect(` or `expect.poll(` inside those tests.
- **Executable as:** `e2e`

#### AC-14 — A live switch to reduced motion applies everywhere G-1 covers

- **Verifies:** R-13
- **Security or auth:** no
- **Given** the local target, loaded fresh for each case with motion allowed, and then a live switch to `'reduce'`
- **When** each case runs after the switch, without a reload:
  1. **Hero:** the switch is made 3 s after `load`, while the typing element's text is not yet `a Coding Ninja` (asserted first).
  2. **Reveals:** the switch is made before any scrolling. Then AC-6's scroll and trace run at `desktop`, for reveal targets 6–13.
  3. **Scrolling:** AC-8 cases 1, 2 and 4.
  4. **Mobile nav:** AC-9.
  5. **Captions:** AC-10.
  6. **Dialog:** AC-11.
  7. **Lightbox:** AC-12.
- **Then** each case behaves as under reduced motion set before navigation
- **Assertion:**
  - Case 1: within 1 000 ms of the switch, the visible hero line equals the hero sentence, and it then stays equal in every frame for 5 s.
  - Cases 2–7: the named AC's assertions pass unchanged.
- **Executable as:** `e2e`

#### AC-15 — A live switch back to motion allowed restores the motion

- **Verifies:** R-13
- **Security or auth:** no
- **Given** the local target, loaded fresh for each case with reduced motion on, and then a live switch to `'no-preference'`
- **When** each case runs:
  1. At `desktop`, from the top of the page, the nav link "About" is clicked, with a frame trace of `window.scrollY`.
  2. At `small`, the menu button is clicked, with a frame trace of `#header`.
- **Then** both move again
- **Assertion:**
  - Case 1's trace is a glide (Conventions).
  - Case 2's trace has at least 1 frame whose `#header` `x` is between −299 and −1.
- **Executable as:** `e2e`

#### AC-16 — The portfolio grid's re-layout stops animating after a live switch to reduced motion

- **Verifies:** R-14
- **Security or auth:** no
- **Given** the local target loaded fresh at 1440 × 900 with motion allowed, the grid ready (`waitForPortfolioGrid`), `#portfolio` in view, and then a live switch to `'reduce'`
- **When** the viewport is resized to 1023 × 900, with a frame trace of all 9 portfolio items from the resize
- **Then** each item goes straight to its new place
- **Assertion:**
  - For each item, every frame's box is within 1 px of either the item's first-frame box or its last-frame box.
  - At least 1 item's last-frame box differs from its first-frame box by more than 10 px. This shows the layout changed.
- **Executable as:** `e2e`

#### AC-17 — The portfolio grid's re-layout animates again after a live switch to motion allowed

- **Verifies:** R-14
- **Security or auth:** no
- **Given** the AC-16 setup, except that the page loads with reduced motion on and the live switch is to `'no-preference'`
- **When** the viewport is resized to 1023 × 900, with a frame trace of all 9 portfolio items from the resize
- **Then** the re-layout animates
- **Assertion:** at least 1 item has at least 1 frame whose box is more than 1 px away from both its first-frame box and its last-frame box
- **Executable as:** `e2e`

#### AC-18 — Screen readers get the hero sentence once, and it never changes

- **Verifies:** R-15
- **Security or auth:** no
- **Given** the local target at `desktop` in three cases: motion allowed, reduced motion on, and `javaScriptEnabled: false`
- **When** `page.locator('#hero').ariaSnapshot()` is read at 2 s, 4 s, 8 s, 15 s and 30 s after `load`
- **Then** the accessibility tree holds the hero sentence once, it never changes, and nothing in the hero is a live region
- **Assertion:** in each case:
  - All 5 snapshots are equal strings.
  - The whitespace-collapsed snapshot contains the hero sentence exactly 1 time.
  - `#hero` contains 0 elements matching `[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"], [role="marquee"], [role="timer"]`.
- **Executable as:** `e2e`

#### AC-19 — With JavaScript off, the hero sentence and every reveal target are visible

- **Verifies:** R-16
- **Security or auth:** no
- **Given** the local target at `desktop` in a context with `javaScriptEnabled: false`
- **When** the page loads and is scrolled to the bottom in 400 px steps, 100 ms apart
- **Then** the hero shows the full sentence, and every reveal target is visible in place
- **Assertion:**
  - The visible hero line equals the hero sentence.
  - Each of the 13 reveal targets has effective opacity 1, and its computed `transform` is `none` or a matrix with zero translation and a scale of 1.
- **Executable as:** `e2e`

#### AC-20 — When the page script fails, the hero sentence and every reveal target are visible

- **Verifies:** R-16
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed, in two cases:
  - (a) every JS bundle request is aborted (`route.abort()`);
  - (b) every JS bundle request is answered 200, `content-type: text/javascript`, with the body `throw new Error('injected failure');`
- **When** 5 s pass after `load`, and the page is then scrolled to the bottom in 400 px steps, 100 ms apart
- **Then** the result is as with JavaScript off
- **Assertion:**
  - AC-19's two checks pass.
  - In case (b), the `pageerror` events are exactly 1 per JS bundle, each with message `injected failure`.
- **Executable as:** `e2e`

#### AC-21 — While the page script is slow to arrive, the hero is visible

- **Verifies:** R-16
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed, and every JS bundle response held for 10 s before it is fulfilled
- **When** 5 s pass after navigation starts, while every JS bundle is still held
- **Then** the hero is fully visible and shows the full sentence
- **Assertion:**
  - The route handler reports 0 JS bundles fulfilled so far.
  - The hero container's effective opacity is 1.
  - The visible hero line equals the hero sentence.
- **Executable as:** `e2e`

#### AC-22 — The hero never vanishes once it has started to appear

- **Verifies:** R-17
- **Security or auth:** no
- **Given** the local target at `desktop`, and again at `small`, with motion allowed and an empty cache. An init script starts a frame trace of the hero container from the first frame in which it is in the document.
- **When** the trace runs until 3 s after `load`
- **Then** the hero's opacity only ever rises or holds
- **Assertion:** for every frame `i`, the highest effective opacity in frames 0..`i` minus the effective opacity in frame `i` is ≤ 0.01
- **Executable as:** `e2e`

#### AC-23 — Typing starts only after the hero has fully appeared

- **Verifies:** R-18
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed. An init script starts a frame trace of the hero container and a `MutationObserver` on the typing element, both from `DOMContentLoaded`.
- **When** 5 s pass after `load`
- **Then** the first typed character appears after the hero is fully visible
- **Assertion:** `T_type` ≥ `T_full`:
  - `T_full` is the time of the first frame in which the hero container's effective opacity is ≥ 0.99.
  - `T_type` is the time of the first recorded change that leaves the typing element's `textContent` as a non-empty proper prefix of `a Designer`.
- **Executable as:** `e2e`

#### AC-24 — The typing keeps 5.0.0's speeds and erases only to the shared start

- **Verifies:** R-19
- **Security or auth:** no
- **Given** the sprint 1 AC-110 recording (60 s of the typing element's `textContent` from `DOMContentLoaded`, motion allowed, `desktop`), taken at the release commit
- **When** the recorded texts and their times are analyzed
- **Then** the erase points, the step speeds and the holds match 5.0.0
- **Assertion:**
  - Between each pair of consecutive complete phrases, the shortest recorded text equals the pair's longest common prefix. In order these are `a De`, `a ` and `a `.
  - The median time between consecutive changes that lengthen the text is between 100 and 150 ms. The median between consecutive changes that shorten it is between 50 and 75 ms.
  - For each of the first three complete phrases, the time from the change that completes it to the next change is between 2 000 and 2 200 ms.
  - These ranges are 5.0.0's values: Typed.js 3.0.0 adds up to 50 % random jitter to each 100 ms or 50 ms step. §3 confirms them by running this check against the `5.0.0` build as a guard. If 5.0.0 measures outside a range, 5.0.0's measured value ± 10 % becomes that range (G-6).
- **Executable as:** `e2e`

#### AC-25 — The typing cursor stops blinking when the typing stops

- **Verifies:** R-19
- **Security or auth:** no
- **Given** the sprint 1 AC-111 settle point at the release commit
- **When** a frame trace of the typing cursor runs for 3 s, starting 1 s after the settle point
- **Then** the cursor no longer blinks. Sprint 1 AC-112 cannot see a GSAP blink, because `getAnimations()` does not list GSAP tweens.
- **Assertion:** the cursor's effective opacity is the same in every frame of the trace. Whether that value is 0 or above is not checked.
- **Executable as:** `e2e`

#### AC-26 — With motion allowed, reveals keep 5.0.0's directions, distance and duration

- **Verifies:** R-20
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed, loaded at the top of the page
- **When** for each reveal target from 2 to 13, in source order, the page is scrolled instantly so that the target's top is 40 px above the viewport bottom, with a frame trace of that target from the scroll. The scroll comes from a position where the target is below the viewport. Targets that share a row enter with one scroll and are traced together: 2 and 3, Services boxes 6–8, and Services boxes 9–11.
- **Then** each target starts offset as in this table and settles in place, fully opaque:

  | Targets | Offset from final box at the first frame with effective opacity > 0.01 |
  | --- | --- |
  | 2 (About photo) | `x` +60 ± 6 px, `y` 0 ± 1 px: it enters from the right |
  | 3 (About text) | `x` −60 ± 6 px, `y` 0 ± 1 px: it enters from the left |
  | 4–12 (filter row, grid container, Services boxes, carousel) | `y` +60 ± 6 px, `x` 0 ± 1 px: it rises from below |
  | 13 (contact row) | `x` and `y` 0 ± 1 px: it fades only |
- **Assertion:**
  - Each table cell holds.
  - For each target, the time from its first frame with effective opacity > 0.01 to its first frame with effective opacity ≥ 0.99 and an offset ≤ 1 px is between 750 and 1 250 ms.
- **Executable as:** `e2e`

#### AC-27 — With motion allowed, the hero fades in once without moving

- **Verifies:** R-21
- **Security or auth:** no
- **Given** the AC-22 trace at `desktop`
- **When** the trace ends
- **Then** the hero fades in from hidden to fully visible over about 1 s, and never moves
- **Assertion:**
  - The trace shows no movement (Conventions).
  - The first frame's effective opacity is ≤ 0.01, and the last frame's is 1.
  - The time from the last frame with effective opacity ≤ 0.01 to the first frame with effective opacity ≥ 0.99 is between 750 and 1 250 ms.
- **Executable as:** `e2e`

#### AC-28 — Each row of Services boxes cascades from when it enters the view

- **Verifies:** R-22
- **Security or auth:** no
- **Given** the local target at 1440 × 900 with motion allowed and `#services` below the viewport, with a frame trace of Services boxes 1–6 (reveal targets 6–11)
- **When** two scrolls are made:
  1. The page is scrolled instantly so that box 1's top is 40 px above the viewport bottom. The test first asserts that box 4's top is below the viewport bottom.
  2. 3 s later, the page is scrolled instantly so that box 4's top is 40 px above the viewport bottom.
- **Then** each row starts at once and cascades in source order, with no fixed wait
- **Assertion:** let `start(n)` be the time of box `n`'s first frame with effective opacity > 0.01, minus the time of the scroll that brought its row in. Then:
  - `start(1)` ≤ 150 ms and `start(4)` ≤ 150 ms. In 5.0.0, `start(4)` is at least 300 ms, so 5.0.0 fails.
  - `start(2) − start(1)`, `start(3) − start(2)`, `start(5) − start(4)` and `start(6) − start(5)` are each between 50 and 150 ms.
- **Executable as:** `e2e`

#### AC-29 — A filter change during the portfolio reveal ends in the right state

- **Verifies:** R-23
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed, `#portfolio` below the viewport and all portfolio images loaded
- **When** the page is scrolled instantly so that the grid container's top is 40 px above the viewport bottom. Within 200 ms, while the grid container's effective opacity is below 1 (asserted first), the `App` filter is clicked. Then 2 s pass.
- **Then** the grid shows exactly the App items, fully visible and inside the grid
- **Assertion:**
  - Items {1, 3, 6} are visible, with effective opacity 1.
  - Items {2, 4, 5, 7, 8, 9} are not visible.
  - Each visible item's box is inside the grid container's box ± 1 px.
  - The grid container's effective opacity is 1, and its computed `transform` has zero translation.
- **Executable as:** `e2e`

#### AC-30 — A focused element is never hidden or moved out of view

- **Verifies:** R-24
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed, freshly loaded and not scrolled
- **When** a Tab walk runs with 300 ms between presses, and a frame trace records `document.activeElement` and its box and effective opacity in every frame
- **Then** whatever holds focus is fully visible and in view in every frame
- **Assertion:** in every frame where the focused element is not `body` and is not in the map iframe:
  - its effective opacity is ≥ 0.99;
  - its viewport box intersects the viewport.
- **Executable as:** `e2e`

#### AC-31 — A hash that names a hidden element does not put focus on it

- **Verifies:** R-24
- **Security or auth:** no
- **Given** the local target at `desktop` with JavaScript on, in both motion modes
- **When** `/#contactModal` is loaded fresh, and 2 s pass after `load`
- **Then** focus is not on a hidden element
- **Assertion:**
  - `document.activeElement` is `body`, or it is shown with effective opacity ≥ 0.99.
  - The `pageerror` events are `[]`.
- **Executable as:** `e2e`

#### AC-32 — Nothing flashes more than three times per second

- **Verifies:** R-25
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed
- **When** a full visit runs, then 30 s pass, with an effective-opacity frame trace of the typing element, the typing cursor and the 13 reveal targets from `load` to the end
- **Then** no traced element flashes more than three times in any second
- **Assertion:** for each traced element, every 1 000 ms window holds ≤ 6 transitions (Conventions, flash count)
- **Executable as:** `e2e`

#### AC-33 — After a nav link, focus is at the target section

- **Verifies:** R-26
- **Security or auth:** no
- **Given** the local target, freshly loaded, in both motion modes, for each case:
  1. At `desktop`, the nav link "Portfolio" is focused with Tab and Enter is pressed.
  2. At `desktop`, the nav link "Services" is clicked.
  3. At `small`, the menu button is clicked, and then the nav link "Portfolio" is clicked.
- **When** the scroll settles, meaning `scrollY` is unchanged for 500 ms, and then Tab is pressed once
- **Then** focus was at the target section, and the Tab continues from it to the next control
- **Assertion:**
  - Before the Tab, `document.activeElement` is the target section (`#portfolio` or `#services`), or is inside it.
  - After the Tab, in cases 1 and 3, the focused element is the button "All" in `#portfolio-filters`. In case 2, it is the first Tab-reachable element that follows `#services`'s start in document order, inside or after the section. At `desktop` today that is the Contact email link. This is an example, not the check.
- **Executable as:** `e2e`
- **Note (2026-11-21):** case 2 no longer expects the link "Web Development". The build strips `href=""` from the six Services title links, as 5.0.0 already did, so they cannot take focus, and content stays unchanged (R1-Q18).

#### AC-34 — After a hash on load, focus is at the target section

- **Verifies:** R-26
- **Security or auth:** no
- **Given** the local target at `desktop`, in both motion modes
- **When** `/#services` is loaded fresh, the scroll settles (`scrollY` unchanged for 500 ms), and Tab is pressed once
- **Then** focus was at `#services`, and the Tab continues from it to the next control
- **Assertion:**
  - Before the Tab, `document.activeElement` is `#services` or is inside it.
  - After the Tab, the focused element is the first Tab-reachable element that follows `#services`'s start in document order, inside or after the section. At `desktop` today that is the Contact email link. This is an example, not the check.
- **Executable as:** `e2e`
- **Note (2026-11-21):** this AC no longer expects the link "Web Development". The build strips `href=""` from the six Services title links, as 5.0.0 already did, so they cannot take focus, and content stays unchanged (R1-Q18).

#### AC-35 — A hash that names nothing, or is malformed, is ignored

- **Verifies:** R-27
- **Security or auth:** yes
- **Given** the local target at `desktop`, in both motion modes
- **When** each of these is loaded fresh, and 2 s pass after `load`:
  - `/#does-not-exist`
  - `/#%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E`
  - `/#a%22%5D%2C*`
  - `/#`
- **Then** nothing happens: no error, no scroll, no focus move, and nothing from the hash enters the page
- **Assertion:** for each URL:
  - The `pageerror` events are `[]`, and the `page.on('dialog')` events are `[]`.
  - `window.scrollY` is 0, and `document.activeElement` is `body`.
  - `document.querySelectorAll('img[src="x"]').length` is 0.
- **Executable as:** `e2e`

#### AC-36 — With motion allowed, in-page navigation still glides

- **Verifies:** R-28
- **Security or auth:** no
- **Given** the local target at `desktop` with motion allowed
- **When** each case runs with a frame trace of `window.scrollY` from its trigger:
  1. From the top of the page, the nav link "About" is clicked.
  2. The page is scrolled instantly to `#contact`, and back-to-top is clicked.
- **Then** both glide, as in 5.0.0
- **Assertion:** each trace is a glide (Conventions)
- **Executable as:** `e2e`

#### AC-37 — The baseline's sensitivity proof still holds

- **Verifies:** R-29
- **Security or auth:** no
- **Given** the release commit
- **When** `yarn verify:release` runs `__tests__/release/baseline-sensitivity.test.js` with Jest's JSON output
- **Then** all three sensitivity cases pass
- **Assertion:** the tests whose titles start with `AC-90:`, `AC-28:` and `AC-29:` each have status `passed`, and none is skipped
- **Executable as:** `integration`

#### AC-38 — Every suite passes at the release commit

- **Verifies:** R-30
- **Security or auth:** no
- **Given** the release commit, pushed
- **When** these commands run:
  - `yarn gate:linux`
  - `yarn test:e2e:slow` against the local target
  - `yarn verify:release`
  - `yarn test:e2e:live` against the live target, after Netlify has deployed the release commit
- **Then** all four pass
- **Assertion:** the gate prints a v1 block whose SHA equals the release commit, with six exit codes of 0. The other three commands exit 0.
- **Executable as:** `build`

#### AC-39 — Every sprint 3 PR passed the gate on its head commit

- **Verifies:** R-30
- **Security or auth:** no
- **Given** the merged PRs whose body contains `gsap-animations`: `gh pr list --state merged --search "gsap-animations in:body" --json number,headRefOid`
- **When** each PR's body and comments are read with `gh pr view <n> --json body,comments`
- **Then** each one records a passing `yarn gate:linux` run on its head commit
- **Assertion:** for every such PR, the body or a comment contains a gate v1 block whose SHA equals the PR's `headRefOid`, with six exit codes of 0
- **Executable as:** `integration`

#### AC-40 — Only the listed earlier assertions changed

- **Verifies:** R-30
- **Security or auth:** no
- **Given** `git diff 5.0.0 <release commit> -- tests/e2e __tests__`
- **When** each removed line (`-`) that contains `expect(` or `expect.poll(` is matched to the title of its enclosing `test(`, or to its helper
- **Then** every match is a row of "Earlier assertions changed on purpose". A changed constant counts against every test that uses it.
- **Assertion:** removed `expect` lines, or changed constants, outside a listed row: 0. The conditional `AC-100` row counts only if AC-3 found a `WITH` expression.
- **Executable as:** `lint`

#### AC-41 — The CSP stays report-only, with no violation in either motion mode

- **Verifies:** R-31, NFR-2
- **Security or auth:** yes
- **Given** the local target and the live target at `desktop`, each with motion allowed and again with reduced motion on, and Web3Forms mocked with `{ success: true }`
- **When** a full visit runs, followed by a nav-link click to `#about`, a back-to-top click, opening the dialog and a successful mocked submission
- **Then** no CSP violation and no CSP console message occur, and the policy is served report-only
- **Assertion:**
  - The `securitypolicyviolation` events number 0, and the console messages matching `/Content.Security.Policy/i` number 0.
  - The document response carries `content-security-policy-report-only` equal to `netlify.toml`'s value, as in sprint 1 AC-83, and carries no `content-security-policy` header.
- **Executable as:** `e2e`

#### AC-42 — The page looks as on 5.0.0, apart from the intended changes

- **Verifies:** R-32
- **Security or auth:** no
- **Given** the local target built at the release commit and a build of tag `5.0.0`, opened side by side in desktop Chrome on Windows with classic scrollbars
- **When** a reviewer takes these steps in both builds at each §6 width, with Windows animation effects on:
  - Reload, and watch the hero load and type.
  - Scroll the whole page.
  - Hover a portfolio item (at widths with a pointer), open the lightbox, go to the next image and close it.
  - Step through the testimonial bullets.
  - Open and close the contact dialog.
  - Below 1280 px, open the mobile nav and choose a nav link. At 1280 px and above, click a nav link.
  - Click back-to-top.

  Then the reviewer repeats all steps at 375 and 1440 px with Windows animation effects off, so that `prefers-reduced-motion: reduce` applies.
- **Then** every difference is one of these intended changes:
  1. The hero no longer appears, vanishes and reappears on load. It fades in once without moving, and the typing starts after the fade.
  2. The second row of Services boxes starts its cascade as soon as it enters the view.
  3. After a nav link or a URL hash, keyboard focus is at the target section. If a focus indicator is drawn on the section, it appears only after keyboard use.
  4. With animation effects off, content is visible at once without moving, and the hero shows the full sentence as static text. Nav links and back-to-top jump. The mobile nav, the caption links and the lightbox appear and disappear without sliding or zooming. They may fade. The contact dialog already does not move in 5.0.0 (§1.1), so it shows no difference.

  Nothing is broken, overlapping or unstyled, and no text, link, testimonial or map changed (NG-6).
- **Assertion:** before the release PR merges, the reviewer posts a comment on it listing each §6 width, and the two reduced-motion runs, as pass or fail, and each difference found with its intended-change number. Failing widths or runs: 0. Differences with no intended-change number: 0.
- **Executable as:** `manual`
- **Manual because:** whether reveals "look as they do in 5.0.0" is a visual judgment of motion. A pixel diff fails by design on changes 1–4 and on frame timing, and the classic-scrollbar layout and the OS animation setting do not exist in the headless Linux runner the suites use. AC-6 to AC-12 and AC-26 to AC-28 assert the motion itself.

#### AC-43 — The script size change is measured and recorded

- **Verifies:** R-33
- **Security or auth:** no
- **Given** clean builds (`yarn install --immutable && yarn build`) of tag `5.0.0` and of the release commit, and the PR body that §3 names as the size record
- **When** two sums are taken for each build: the raw byte size of `dist/**/*.js`, and its gzip size, which is the sum over files of `zlib.gzipSync(file, { level: 9 }).length`
- **Then** the record lists all 4 numbers, and each one matches the measurement
- **Assertion:** `gh pr view <n> --json body` contains 4 labeled byte counts, and each is within ± 1 % of the re-measured value
- **Executable as:** `integration`

#### AC-44 — 5.1.0 is prepared and not tagged

- **Verifies:** R-34
- **Security or auth:** no
- **Given** the release commit and `origin`, at the end of the sprint
- **When** the version and the remote tag and release are read
- **Then** the version is 5.1.0, and there is no tag or GitHub release yet
- **Assertion:**
  - `git show <release commit>:package.json | yq -p=json '.version'` prints `5.1.0`.
  - `git ls-remote --tags origin refs/tags/5.1.0` prints nothing.
  - `gh release view 5.1.0` exits non-zero.
- **Executable as:** `integration`

#### AC-45 — The CHANGELOG has a 5.1.0 entry that names what shipped

- **Verifies:** R-35
- **Security or auth:** no
- **Given** `CHANGELOG.md` at the release commit, and AC-43's measured gzip JS sizes
- **When** the text from the 5.1.0 heading to the next `## [` heading is read
- **Then** the entry names GSAP, reduced motion, the removed libraries, the section 7 permission and the size change
- **Assertion:**
  - A line matches `^## \[5\.1\.0\] - \d{4}-\d{2}-\d{2}$`.
  - The entry contains `GSAP`, `Typed.js` and `ScrollReveal`, contains `reduced motion` case-insensitive, and matches `/section 7|§\s?7/i`.
  - The entry states a figure in KB within ± 1 KB of the measured gzip JS growth. Either 1 KB = 1 000 bytes or 1 KB = 1 024 bytes is accepted.
- **Executable as:** `lint`

#### AC-46 — The README describes GSAP, reduced motion and the size change, and does not name the old libraries

- **Verifies:** R-35
- **Security or auth:** no
- **Given** `README.md` and `node_modules/gsap/package.json` at the release commit, and AC-43's measured gzip JS sizes
- **When** the README is searched
- **Then** it describes what shipped, and no longer names Typed.js or ScrollReveal
- **Assertion:**
  - A row of the `### Tech Stack` table has a first cell that starts with `GSAP `, followed by the installed GSAP major version. This is sprint 1 AC-95 with the re-aimed `LIBRARY_PACKAGES`.
  - `rg -n -e 'Typed\.js' -e 'ScrollReveal' README.md` prints nothing and exits 1.
  - `rg -c -i 'reduced motion' README.md` prints ≥ 1.
  - The README states a figure in KB within ± 1 KB of the measured gzip JS growth, as in AC-45.
- **Executable as:** `lint`

#### AC-47 — The browser floor is unchanged

- **Verifies:** R-35
- **Security or auth:** no
- **Given** `package.json` and `README.md` at `5.0.0` and at the release commit
- **When** the `browserslist` field and the README `### Supported browsers` section are read in both
- **Then** neither changed
- **Assertion:**
  - `yq -p=json '.browserslist' package.json` prints `defaults, iOS >= 15` at both commits.
  - The `### Supported browsers` section's text, up to the next heading, is byte-identical at both commits.
- **Executable as:** `lint`

### 2.4 Success metrics

| ID | Metric | Baseline | Target | Measured by |
| --- | --- | --- | --- | --- |
| M-1 | Lighthouse accessibility score of the live home page | unknown: needs a run against the live 5.0.0 site before the first sprint 3 PR merges, because Netlify deploys every merge to `main` | ≥ 95 (the sprint 1 M-7 threshold) | Lighthouse through `npx` against `https://fs3portfolio.netlify.app/`, before the first sprint 3 PR merges and again once the release commit is live |
| M-2 | Largest Contentful Paint of the live home page, mobile lab run, with First Contentful Paint from the same runs | 5.0.0: median lab LCP 1953.77 ms. 5.1.0: median lab LCP 3573.05 ms over 3 runs (3275.71, 3573.05, 4521.99 ms), Lighthouse 13.6.0. First Contentful Paint: unknown, recorded from the next run on | Lab LCP and FCP recorded at each release, as the median of 3 runs. While the hero fade stays (R-17, R-21, AC-27), median lab LCP is no higher than 3.6 s, the 5.1.0 value. The 2.5 s target and "no worse than 5.0.0" do not apply. See the note below. | Lighthouse mobile preset through `npx`, the same run as M-1 |
| M-3 | Bytes transferred on a first, empty-cache load at `phone` | unknown: needs a HAR of the live 5.0.0 site before the first sprint 3 PR merges | Recorded, with no cap (C-9, NG-11). Any growth is explained by the AC-43 JS delta. | Playwright HAR (`recordHar`) at `phone`, as in sprint 1 M-2 |
| M-4 | Motion, focus or hero-text defects reported against 5.1.0 | unknown: count the same for 5.0.0 before the first sprint 3 PR merges | 0 in the 30 days after the 5.1.0 deploy | `gh issue list --label bug --search "created:>=<deploy date>"`, read by hand for motion, focus and hero defects |

**M-2 amended 2026-11-21, Fred's decision.** After release, 5.1.0's median lab LCP was 3573.05 ms against 5.0.0's 1953.77 ms, with accessibility at 100 (M-1 met). Measurement traced the rise to the hero fade the spec requires (G-5, R-17, R-21, AD-5). Lighthouse's lab LCP model simulates text that is not painted in the very first frame as if it waited for the full resource set, which adds about 2 s. Any fade that starts at opacity 0.01 or less (AC-27) hits this, whether CSS or GSAP drives it. Real visitors see the hero about 0.2 s after first paint. Asked "Which should give?", Fred chose, verbatim: "Keep fade, adjust target (Recommended)". The hero fade stays, and a lab LCP of about 3.5 s is recorded as its known cost. The 2.5 s target, taken from sprint 1 M-1, no longer applies while the fade stays. A follow-up lazy-loads the map iframe, which should bring first paint about 0.7 s sooner. That is why M-2 now records FCP too.

### 2.5 Out of scope

**Carried from §1.4:** NG-1 (moving the active-nav highlight and back-to-top visibility off the scroll listener), NG-2 (changing how in-page scrolling glides with motion allowed; R-28 keeps it), NG-3 (replacing the portfolio layout engine), NG-4 (a pause control for the typing), NG-5 (restoring the template's reveal directions), NG-6 (any content change), NG-7 (any Renovate configuration change), NG-8 (enforcing the CSP), NG-9 (pushing the 5.1.0 tag or GitHub release), NG-10 (relicensing, or staying on the GPL animation libraries), NG-11 (shrinking the larger script). NG-12 is withdrawn, and its subject is now G-13.

**Cuts:** none. Every §1 goal, constraint and grilling answer is carried by a requirement, by an AC, or by the list above.

**Readings and exclusions taken while writing this PRD:**
- **A live switch from reduced motion back to motion allowed** must restore gliding, the mobile nav slide and the grid's animated re-layout (AC-15, AC-17). No AC requires the hero typing to start, or reveals to re-hide content that is already visible, after that switch.
- **Back-to-top does not move focus** (A-8). R-26 covers nav links and a hash on load only.
- **A hash that names an element which is not a section**, for example `#contactModal`, is not required to scroll or to do anything. AC-31 only requires that focus not land on a hidden element (C-19).
- **A script that arrives late.** AC-21 covers the hero while the script is still pending. No AC fixes what happens when a late script finally runs.
- **Screen-reader output** is asserted through the accessibility tree (AC-18). No AC requires a run with NVDA or VoiceOver.
- **Timing tolerances.** AC-24 and AC-26 to AC-28 use ranges around 5.0.0's measured look. They are not new performance targets.
- **The malformed-hash case** (R-27, AC-35) is the negative case of G-13, not new scope. 5.0.0 already resolves the hash by id so that a malformed hash cannot throw (`main.js:497`). R-27 keeps that true once the hash also moves focus.

### 2.6 Open questions carried forward

None for Fred. §1.6 has none open, and this PRD raised no question that changes scope. These non-blocking points belong to the Architect. None of them changes an AC unless its row says so.

| ID | Point | Blocking? | Owner | Effect on this PRD |
| --- | --- | --- | --- | --- |
| Q-1 | AC-21's 5 s sample point is a PRD test parameter. It requires any hide-until-script rule (D-4) to give way within 5 s while the script is pending. If §3 needs a longer fallback, raise it at Gate 2. | no | Architect | AC-21's 5 s changes only if Fred accepts a longer value at Gate 2 |
| Q-2 | AC-24's ranges assume Typed.js 3.0.0's jitter. §3 runs AC-24 against the `5.0.0` build as a guard before the typing chain starts. | no | Architect | AC-24 already says how its ranges follow 5.0.0's measurement |
| Q-3 | §3 names the selector or hook for each role in the Conventions: the hero container, hero line, typing element, typing cursor, lightbox image and the 13 reveal targets. | no | Architect | None |
| Q-4 | AC-43 needs §3 to name the PR whose body holds the size record. | no | Architect | None |
| Q-5 | AC-5 needs GSAP's license text in the notices. If the `gsap` package ships no `LICENSE*`, `LICENCE*` or `COPYING*` file, `scripts/third-party-notices.mjs` skips it with a warning (C-15), and D-2 must get the terms in some other way. | no | Architect | None |
| Q-6 | A-7 (the lightbox's motion can be limited to fades, including after a live switch) is untested. If it proves false, AC-12 and AC-14 case 7 cannot pass without replacing the lightbox, and that goes to Fred. The contact dialog already does not move (§1.1), so AC-11 and AC-14 case 6 are guards and do not depend on A-7. | no | Architect | AC-12 and AC-14 case 7 change only if Fred decides at that point |

---

## 3. Technical Plan

<!-- OWNER: Architect. No other agent may edit this section. -->

**Status:** ✅ complete

Grounded 2026-11-20 in this worktree (`docs/sprint3-spec`, from `origin/main` at `52b7c7e`). Read in full or in the parts named: `src/js/main.js`, `src/js/utils.js`, `src/index.html`, `src/css/style.css` (back-to-top, header, nav, hero, portfolio links, dialog, no-JS block), `package.json`, `jest.config.js`, `netlify.toml`, `.gitignore`, `.yarn/patches/muuri-*.patch`, `scripts/third-party-notices.mjs`, `scripts/gate/evidence.mjs` (`CANONICAL_COMMANDS`), `__tests__/release/baseline-sensitivity.test.js`, `__tests__/third-party-notices.test.js`, `__tests__/acceptance/readme.test.js`, `__tests__/acceptance/smoke-coverage.test.js`, `__tests__/acceptance/cleanup.test.js` (scope), `tests/e2e/motion.spec.js`, `tests/e2e/smoke.spec.js` (`layoutBox`, column pairs, `settle`), `tests/e2e/helpers/portfolio.js`, `tests/e2e/build-output.spec.js`, and `specs/bootstrap-6-upgrade.md` §3 for conventions. The worktree has no `node_modules`, and this stage has no shell, so no install ran. Third-party source was read only where the installed version equals the lockfile pin: `typed.js` 3.0.0 and `glightbox` 3.3.1 in the main checkout's `node_modules` (its `bootstrap` is a stale 5.3.8 and was not used). Everything else came from the registry and CDNs, as each fact says.

Facts this plan relies on:

- **V-1** — The latest `gsap` is 3.15.1. Its `license` field reads `Standard 'no charge' license: https://gsap.com/standard-license.`, it has `sideEffects: false` and `module: index.js`, and it has no dependencies *(verified 2026-11-20 via `https://registry.npmjs.org/gsap/latest`)*.
- **V-2** — The `gsap` 3.15.1 package root has no `LICENSE*`, `LICENCE*` or `COPYING*` file. Its root holds the plugin modules, `package.json`, `README.md` and `SECURITY.md` *(verified 2026-11-20 via the jsDelivr listing `data.jsdelivr.com/v1/packages/npm/gsap@3.15.1?structure=flat`)*. As the notices script stands, it skips `gsap` with a warning and AC-5 fails (Q-5).
- **V-3** — `gsap-core.js` 3.15.1 opens with a `/*!` banner naming `GSAP 3.15.1`, `@license Copyright 2008-2026, GreenSock. All rights reserved.` and `Subject to the terms at https://gsap.com/standard-license` *(verified 2026-11-20 via jsDelivr `gsap@3.15.1/gsap-core.js`)*.
- **V-4** — `gsap.matchMedia().add(conditions, fn)` runs `fn` when any condition matches. When any condition toggles, it reverts everything `fn` created and runs it again. Animations made later, in event callbacks, are reverted only if made through the passed context's `add()`. A function returned by `fn` is extra cleanup, and GSAP reverts the context itself *(verified 2026-11-20 via Context7 `/websites/gsap`, gsap.matchMedia page)*.
- **V-5** — Typed.js 3.0.0 times each typed or erased character as `Math.round(Math.random() * speed / 2) + speed`. So 5.0.0 types at 100–150 ms and erases at 50–75 ms per character *(verified 2026-11-20 by reading `humanizer` in `node_modules/typed.js/dist/typed.module.js`, version 3.0.0)*.
- **V-6** — GLightbox 3.3.1 reads `settings.openEffect`, `closeEffect` and `slideEffect` at each open, slide change and close. `open()` sets `settings.slideEffect = 'slide'` on a mobile user agent, then fires `open`. Its `fade` keyframes change opacity only, and the instance has `on(event, fn)` *(verified 2026-11-20 by reading `node_modules/glightbox/dist/js/glightbox.js` lines 2094–2214, 2985–2987 and 3026, and `dist/css/glightbox.css` lines 32–36 and 642–676, version 3.3.1)*.
- **V-7** — Bootstrap 6.0.0-alpha.1's `.dialog` sets a transform only under `.dialog-slide-down`, `.dialog-slide-up` and `.dialog-static`, and `#contactModal` uses none of them. Its transitions come from the `transition-props` mixin, which emits them only inside `@media (prefers-reduced-motion: no-preference)`, because `$enable-reduced-motion` defaults to `true` *(verified 2026-11-20 via unpkg `scss/_dialog.scss`, `scss/mixins/_transition.scss` and `scss/_config.scss`)*. So the dialog never moves, and under reduced motion it does not even fade. Sprint 2 V-3's "no reduced-motion rule" holds for `_dialog.scss` alone.
- **V-8** — Muuri 0.9.5 lays out on init with `layout(true)`, which is instant. Its resize handler runs `refreshItems().layout()`, which animates. It has no public way to change settings after construction, and `layout(instant)` is public *(verified 2026-11-20 via jsDelivr `muuri@0.9.5/src/Grid/Grid.js`)*.
- **V-9** — The gate runs `yarn install --immutable`, `yarn lint`, `yarn format:check`, `yarn test:ci`, `yarn build` and `yarn test:smoke`, in that order *(read 2026-11-20 in `scripts/gate/evidence.mjs`)*. `@slow` tests are outside it, so each PR runs the ones it touches as an extra gate.
- **V-10** — `baseline-sensitivity.test.js` (AC-37) asserts exactly 4 occurrences of `(width < 1280px)` and `(width >= 1280px)` in `style.css`. It needs exactly one smoke title containing `Layout`, one containing `Dialog open`, and one containing `Grid:` (the control). AC-90 needs every other smoke test to pass *(read 2026-11-20)*.

Inferred, not verified here:

- IntersectionObserver delivers all of one observer's entries from one rendering update in a single callback. This comes from reading the spec, with no probe (RK-9).
- `ScrollToOptions` `behavior: 'instant'` works across the C-12 floor (RK-8).
- `(scripting: enabled)` matches in every C-12 browser with JavaScript on. Basis: MDN Baseline, per gsap-analysis G1 (2026-11-16), and sprint 2's `(scripting: none)` rules pass in Playwright.
- GSAP writes styles only through the CSSOM, so the report-only `style-src` raises nothing (A-6). AC-41 tests this in PR-1's gate (RK-3).
- PRs are squash-merged, going by the `(#93)` subjects on `main`. AC-4 holds either way (AD-12).

### 3.0 Decisions

_Every design decision gets an `AD-n` ID that is unique in the spec and is never renumbered or
reused. A superseded decision stays in the table, with `Superseded by AD-k.` at the start of its
Decision cell. A §1.8 `D-` item is resolved only by a decision whose Resolves cell names it; a
decision that resolves none reads `—` there._

| ID | Decision | Resolves | Alternatives rejected |
| --- | --- | --- | --- |
| AD-1 | `gsap` 3.15.1, pinned exactly (C-14), is the only new package. Only GSAP core is used: no ScrollTrigger, TextPlugin, ScrollToPlugin or other plugin, so nothing is registered. A new ES module, `src/js/motion.js`, imports `{ gsap } from 'gsap'` and makes every GSAP call. Parcel resolves the import through `module: index.js` (V-1). `main.js` imports from `motion.js`. `utils.js` never imports GSAP, so Jest needs neither GSAP nor a `matchMedia` mock for it. `scrollreveal` 4.0.9 leaves in PR-1, and `typed.js` 3.0.0 leaves in PR-2. | D-1 | ScrollTrigger: about 17 KB gzip more (gsap-analysis §6). Its positions go stale after every Muuri layout and filter (gsap-analysis G5), and pre-set transforms skew what it measures. TextPlugin: it has no way to erase back to a shared prefix, and it adds about 4 KB. A separate module that only registers plugins: there is nothing to register. |
| AD-2 | Reveals are triggered by one IntersectionObserver with `threshold: 0` and no root margin. Each target is revealed once and then unobserved, as ScrollReveal's `viewFactor: 0` and `once: true` did. Until its reveal, a target is hidden with `opacity: 0` only, with no transform and no `visibility`. So its observed box is its layout box, and its controls stay focusable and in the accessibility tree. The reveal is one `gsap.fromTo`. It starts at `opacity: 0` plus the target's offset, which is applied in the same frame while the target is still invisible. It ends at `opacity: 1` with no offset, over 1 s with `power1.inOut`, then runs `clearProps: 'opacity,transform'`. The entries in one observer callback are one batch, and nothing waits for a further frame. | D-5 | ScrollTrigger and `ScrollTrigger.batch` (AD-1). Setting the offset transform before the reveal: the observer would see a box shifted 60 px, so a target 40 px into view would not reveal (AC-26). `autoAlpha`: hidden controls leave the Tab order. A root margin: reveals would start early. |
| AD-3 | Hooks. Each of the 13 reveal targets carries `data-reveal`, which replaces `data-sr` and `data-sr-delay`. Its value names where the target enters from. The hero container is `hero`: the hero intro reveals it (AD-5), and the observer never sees it. The About photo column is `from-right` (`x: 60`), and the About text column is `from-left` (`x: -60`). The filter row, the grid container, the six Services boxes and the carousel are `from-below` (`y: 60`). The contact row is `fade`, with no offset. The grid container keeps 5.0.0's delay as `data-reveal-delay="100"`. The six Services boxes carry `data-reveal-group="services"`. Within one batch, a group's targets start in source order, 100 ms apart, counted from the batch, so each row cascades from when it enters (R-22). No other target is staggered. Two pure helpers in `utils.js`, `revealOffset(kind)` and `revealDelays(targets)`, compute these values. | D-5 | Keeping `data-sr`: ScrollReveal's vocabulary on a page without ScrollReveal. Staggering every batch: the About photo and text enter together and would start 100 ms apart, unlike 5.0.0 (G-7). One page-wide stagger counter. |
| AD-4 | GSAP never targets `.portfolio-item` or `.portfolio-wrap` (C-4), or a Swiper slide. It may tween the grid container and the `.testimonials-carousel` container, as ScrollReveal did. A `focusin` listener finishes at once the reveal of any target that contains the newly focused element. A pending target is set to its final state, and a running tween jumps to its end. So a focused element is never transparent or offset (C-19, AC-30, AC-33). | D-5 | Leaving focusable content out of the reveals: that changes 5.0.0's look. Making hidden targets `inert`: that changes the Tab order. |
| AD-5 | The hero has no flash (G-5), and a failed script never leaves it hidden (C-5). In `style.css`, a block under `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)` gives `.hero-container:not(.is-shown)` `opacity: 0` and a CSS fallback reveal, `animation: <name> 1s ease-in-out 2s forwards`, ending at `opacity: 1`. In the same block, `.hero-container.is-script-owned` sets `animation: none`. The hero intro runs first in `init()`. If the hero's computed opacity is still `0`, the fallback has not started, so the intro sets inline `opacity: 0` and adds `is-script-owned`. It then runs a GSAP timeline: 0.2 s of delay, then a 1 s `power1.inOut` fade to 1 with no movement, which is 5.0.0's effective entrance (gsap-analysis §1b). After the fade it adds `is-shown` and clears its inline styles. If the fallback has already started, because the script arrived after 2 s, the intro lets it finish and adds `is-shown` on its `animationend`. The hero then keeps the static sentence, and nothing is typed. If the intro throws, it adds `is-shown` before rethrowing. The fallback makes the hero fully visible about 3 s after the first style is applied, inside AC-21's 5 s. So Q-1 asks nothing of Gate 2. | D-4 | A class added by a blocking head script: the main bundle can still fail and leave the hero hidden, and an inline script breaks the CSP. Hiding under `(scripting: enabled)` with no fallback: the hero stays hidden when the bundle fails (AC-20). No gate at all: the flash stays. Typing after a late script: the full sentence would shrink to "I am" in front of the visitor. |
| AD-6 | The typing runs on a GSAP core timeline appended to the hero intro, so the first character is typed only after the fade ends (R-18). The timeline is built from a pure `typingSchedule(phrases, { typeMs: 100, eraseMs: 50, holdMs: 2000 }, random)` in `utils.js`. The schedule reproduces Typed.js 3.0.0 (V-5): each character step takes `base + Math.round(random() * base / 2)` ms. Each phrase is typed on from the shared prefix the previous phrase left and held 2 s. It is then erased one character at a time, back to `sharedPrefixLength(current, next)`. The last phrase is not erased. The timeline writes the `textContent` of `.typed` in `call` steps. The cursor `.typed-cursor` blinks with the existing CSS class `typed-cursor--blink` only while idle: before the first character and during each hold. It is steady while characters change. At the end it gets `typed-cursor--done`, as with Typed.js, so sprint 1 AC-112 still finds no animation after the settle point. The phrases stay in `data-typed-items`. | D-3 | TextPlugin (AD-1). Fixed 100 ms and 50 ms steps: not 5.0.0's look, and their median sits on AC-24's lower bound, where frame timing can push it below. A cursor blink driven by GSAP: AC-112 cannot see it, and it gains nothing. |
| AD-7 | Hero markup (C-22, R-15). The hero line becomes `<p class="hero-line">` holding two spans. The first is `<span class="hero-sentence">I am <span class="hero-phrases">a Designer, a Developer, a Photographer, a Coding Ninja</span></span>`. The second is `<span class="hero-typing" aria-hidden="true">I am <span class="typed" data-typed-items="…"></span><span class="typed-cursor">\|</span></span>`. By default the sentence shows and `.hero-typing` is `display: none`. That covers no JavaScript, a failed or late script, and reduced motion. Typing mode is `.hero-line.is-typing`: the sentence gets Bootstrap's `.visually-hidden`, and `.hero-typing` shows. The script switches to typing mode while the hero is still invisible, before the fade. So the accessibility tree always holds the one sentence and never a changing fragment, and nothing in the hero is a live region. 5.0.0's underline (`#hero p span`) stays on `.typed`, the cursor and `.hero-phrases`, and the wrapper spans get none. The roles for the tests: hero container `.hero-container`, hero line `#hero .hero-line`, typing element `.typed`, typing cursor `.typed-cursor`, lightbox image `.gslide.current img`, and reveal targets `[data-reveal]` (13). | D-3 | `aria-label` on the typing element: a `<span>` with no role does not reliably expose a label. A visible static copy plus a separate, visually hidden copy: two copies in the tree. `aria-live`: it announces fragments. |
| AD-8 | Reduced motion. In `motion.js`, one `gsap.matchMedia()` owns the reveals and the hero (V-4). Its conditions are `motion: '(prefers-reduced-motion: no-preference)'` and `reduce: '(prefers-reduced-motion: reduce)'`. The motion branch hides the pending targets, observes them, and runs the hero intro. Every tween made later, in an observer or `focusin` callback, is made through the context's `add()`, so a switch reverts it. The branch's cleanup disconnects the observer, removes the `focusin` listener, and leaves typing mode. The reduce branch hides nothing, marks every target revealed, adds `is-shown`, and leaves typing mode. Module state means a target that has been shown is never hidden again, and the hero intro and the typing never run twice. So a switch back to motion hides nothing (§2.5). In CSS, one `@media (prefers-reduced-motion: reduce)` block sets `transition: none` on `#header`, `.mobile-nav-active #header`, `.portfolio .portfolio-wrap .portfolio-links` and `.glightbox-container .gslider`. It sits after the rules it overrides, and it adds no `(width < 1280px)` or `(width >= 1280px)` query (V-10). Code outside GSAP reads the preference when it acts (AD-9, AD-10) or on `change` (AD-11). The carousel keeps sprint 1's handling (C-11). | D-6 | A hand-written `window.matchMedia` listener that undoes tweens itself: it re-implements revert. Moving the sidebar and the caption links to transforms: a visible change no requirement asks for. One rule that stops every transition on the page under reduce: it also removes the fades R-10 and R-11 allow, and the color transitions R1-Q13 keeps. |
| AD-9 | In-page navigation. `utils.js` gains three helpers. `scrollBehaviorFor(reduce)` returns `'instant'` or `'smooth'`. `sectionTarget(hash, doc)` returns `resolveHashTarget(hash, doc)` only when the element matches `main section[id]`, and `null` otherwise. `navigateTo(section, { reduce, win })` adds `tabindex="-1"` if the section has no `tabindex`, focuses it with `preventScroll: true`, then scrolls to it. The scroll uses `smoothScrollTo(section, scrollBehaviorFor(reduce))`, and is skipped when the section's top is already within 1 px of its target position. `smoothScrollTo` gains an optional `behavior` argument, defaulting to `'smooth'`, so its existing tests stand. `setupNavClickHandlers` is unchanged. The scroll function `main.js` passes to it calls `navigateTo` for a section, and only scrolls, with no focus, for any other target. The hash on load calls `navigateTo` with `sectionTarget`, so a hash that names no section gets no scripted scroll or focus (AC-31, §2.5). Each call reads the preference at that moment (G-13, R-26, R-27). Back-to-top scrolls with `scrollBehaviorFor` and does not move focus (A-8). Sections carry no `tabindex` in the HTML. | D-6 | A static `tabindex="-1"` on every section: a mouse click anywhere in a section would focus it. Focusing after the scroll ends: no `scrollend` across the floor, and focus would lag the jump. `scrollIntoView`: it scrolls every scrollable ancestor. Removing `smoothScrollTo`: its existing `expect` lines would go (AC-40). |
| AD-10 | The portfolio grid. Muuri is built with constant 300 ms `showDuration`, `hideDuration` and `layoutDuration`. Its built-in resize relayout is turned off, with the value its `bindLayoutOnResize` treats as off (read it in `node_modules/muuri`). `main.js` binds its own 150 ms debounced `resize` handler, which runs `grid.refreshItems().layout(prefersReducedMotion())`. The relayout on `load` stays instant, and the filter keeps `portfolioFilterOptions(prefersReducedMotion())`. So every re-layout reads the preference when it runs, in both directions (R-14, V-8). | D-6 | Rebuilding the grid when the preference changes: it loses the filter state and risks C-4. Writing Muuri's private `_settings`. |
| AD-11 | The lightbox and the dialog. A pure `lightboxEffects(reduce)` in `utils.js` returns `{ openEffect: 'fade', closeEffect: 'fade', slideEffect: 'fade' }` under reduce, and GLightbox's defaults (`zoom`, `zoom`, `slide`) otherwise. `initLightbox` passes it at construction and writes it into `lightbox.settings` on each preference `change`. It writes it again on the instance's `open` event, because `open()` forces `slideEffect = 'slide'` on mobile (V-6). The dialog needs no code (V-7). So A-7 holds, and Q-6 raises nothing at Gate 2. | D-6 | Forking or replacing GLightbox. A CSS override of GLightbox's keyframes: it fights the library's class changes. A reduced-motion rule for the dialog: Bootstrap already behaves that way. |
| AD-12 | The section 7 permission. `LICENSE` stays byte-identical, so GitHub's license detection and AC-3's contiguous-block check are untouched. The README `## License` section keeps its current line and adds the permission below it. A lead sentence says that Valhalla Tech, the copyright holder (C-21), grants the permission. Then comes the FSF's template from the GNU GPL FAQ entry `GPLIncompatibleLibs`, copied verbatim, under its heading "Additional permission under GNU GPL version 3 section 7". `[name of library]` becomes GSAP, and `[name of library's license]` becomes GSAP's Standard "no charge" license (`https://gsap.com/standard-license`). The template's braced Corresponding Source sentence is left out. The FSF keeps it only when anyone may distribute the library's source, and GSAP's terms do not plainly grant that (gsap-analysis §4). `package.json` `license` stays `GPL-3.0-only`: SPDX has no exception ID for this permission, so the conditional AC-100 row stays inactive. The permission is the first commit of PR-1 after WI-17's tests, and it comes ahead of any GSAP code. A squash merge puts both in one commit on `main`, and a merge commit puts the permission first, so AC-4 holds either way. | D-2 | Appending the permission to `LICENSE`: GitHub may stop detecting GPL-3.0. An SPDX `WITH AdditionRef-…` expression: tooling support is uneven, and it changes sprint 1's AC-100 expectation. A license-only PR before PR-1: one more full gate run for the same result on `main`. |
| AD-13 | GSAP's terms in the notices (Q-5). `scripts/third-party-notices.mjs` gains one fallback. When an installed runtime dependency ships no license file, the script reads the `LICENSE*`, `LICENCE*` or `COPYING*` files in the repo's `third-party-licenses/<package name>/` folder instead, and labels each such section `--- third-party-licenses/<name>/<file> ---`. It warns only when neither exists. The package name is validated, as today, before it becomes part of a path. `third-party-licenses/gsap/LICENSE.md` holds three things: the GSAP Standard License text, taken verbatim from `https://gsap.com/standard-license` with `curl` and never through a tool that summarizes; that URL and the retrieval date; and the V-3 banner, copied byte for byte from the installed `gsap-core.js`. The minifier does not change (C-15). | D-2 | A Yarn patch that adds a license file to `gsap`: the dependency becomes a `patch:` string and fails AC-1. Keeping `@license` comments through the minifier config: it changes every bundle, and C-15. Leaving GSAP out of the notices: R-4 fails. |
| AD-14 | Four PRs, one at a time (§3.5). Each is on its own branch, in a worktree made from the current `origin/main`, and authored by the PR Agent with `gsap-animations` in its body (AC-39). Each is gated by `yarn gate:linux` on its pushed head and one code-reviewer pass. PR-1 carries the permission, the notices, GSAP and the reveals. PR-2 carries the hero typing. PR-3 carries reduced motion for the rest of the page, and focus. PR-4 is release 5.1.0. Each PR changes only the earlier-assertion rows its own behavior change needs, so `main` stays green. | D-8 | One PR: too large to review, and one red test blocks everything. A license-only PR first (AD-12). Splitting reduced motion by component: more full gate runs over the same files. |
| AD-15 | Tests. Earlier assertions change only along §2.3's rows. In PR-1, the two `settle` helpers and the About photo locator follow `[data-reveal]`. In PR-4, `readme.test.js` AC-95's `LIBRARY_PACKAGES` changes. `motion.spec.js` AC-110 to AC-112 need no edit, because `.typed`, `data-typed-items`, the cursor classes and the settle behavior all stay (AD-6, AD-7). `baseline-sensitivity.test.js` needs no edit either (V-10). In `helpers/portfolio.js`, the poll message in `revealPortfolio` loses its ScrollReveal wording, and no `expect` line changes. New e2e specs: `tests/e2e/reveals.spec.js`, `hero.spec.js`, `reduced-motion.spec.js` and `in-page-navigation.spec.js`. They share a new `tests/e2e/helpers/frame-trace.js` for the §2.3 Conventions: the frame trace, effective opacity, no movement, jump and glide, and the flash count. AC-24 and AC-25 are new tests in `motion.spec.js`, reusing its recorder. AC-41 extends `csp.spec.js`, and AC-19 extends `no-js.spec.js`. AC-2's `dist` checks and AC-5's notices content go in `build-output.spec.js`. AC-1, AC-3, and AC-2's manifest, lockfile and `src` checks go in a new `__tests__/acceptance/gsap.test.js`. AC-18, AC-24, AC-25 and AC-32 wait 30–60 s, so they carry `@slow`. The title rule: no new test title contains `Layout`, `Dialog open` or `Grid:` (V-10). Every new timing test passes `--repeat-each=5` before handoff, and no retry is added. | D-7 | Re-aiming the existing motion tests at GSAP internals. Putting the 30–60 s tests in the gate's smoke run: the gate slows, and a flake breaks AC-90. Playwright retries: they hide flakes. |
| AD-16 | The size record (AC-43, Q-4) is PR-4's body. Clean builds of tag `5.0.0` and of PR-4's head are measured with AC-43's two sums: the raw bytes of `dist/**/*.js`, and the sum over those files of `zlib.gzipSync(file, { level: 9 }).length`. The body gives the four results as labeled byte counts. The README and CHANGELOG figure is the gzip growth in KB, taken from those numbers. | D-1 | Measuring at PR-1 or PR-2: Typed.js stays in the bundle until PR-2, so neither is the release delta. Bundlephobia estimates: not the real build. |
| AD-17 | The success-metric baselines come from the live 5.0.0 site before PR-1 merges, because Netlify deploys every merge to `main`. M-1 and M-2 use Lighthouse through `npx`, with nothing added to `package.json`. M-3 is a Playwright HAR at `phone`, and M-4 is the 5.0.0 bug count. The M-1 to M-3 after-values are taken once the release commit is live. PR-1 is the first sprint 3 PR that changes the site; the spec's own PR changes no deployed file. | — | Measuring just before the 5.1.0 deploy: by then PR-1 to PR-3 are already live. |
| AD-18 | The below-browser ACs get TDD chains in the release suite, as sprint 1 did (`release-tag.test.js`, `pr-gate-evidence.test.js`). Chain R covers AC-4, AC-39, AC-43 and AC-44. Their checks go in one new file, `__tests__/release/gsap-animations-release.test.js`, run by `yarn verify:release`. It is committed red as the first commit of PR-1, before the work it checks. Its seam already exists: `origin`'s git history and tags, and GitHub's PRs and releases. So the chain has no stubs item, as sprint 1's twelve chains with existing seams had none (accepted at that spec's Gate 2). A stubs item that creates nothing would be a bucket. The **release commit** is resolved as the first commit in `git log --first-parent --reverse 5.0.0..origin/main` whose `package.json` `version` is `5.1.0`. With none, AC-43 and AC-44 fail on "no release commit yet". AC-4 walks to the release commit, or to `origin/main` until one exists, and says which in its message. The **size record** in PR-4's body is a block opened by `<!-- js-size:v1 -->` and followed by four lines: `- 5.0.0 raw: <n> bytes`, `- 5.0.0 gzip: <n> bytes`, `- 5.1.0 raw: <n> bytes`, `- 5.1.0 gzip: <n> bytes`. The AC-43 test finds the one merged `gsap-animations` PR that holds it. It builds `5.0.0` and the release commit in scratch worktrees, as `baseline-sensitivity.test.js` does, and compares within ±1 %. The AC-39 test repeats `pr-gate-evidence.test.js`'s parser in the new file, because Jest treats every `.js` file under `__tests__` as a test file. Chain G covers AC-37. Its existing `baseline-sensitivity.test.js` is a named guard: it passes at 5.0.0 by design, and its job is to stay green while the sprint renames the reveal hooks that its AC-90 case's smoke run depends on (the `settle` helpers). | — | Generalizing `pr-gate-evidence.test.js` to take a search term: it edits a sprint 1 test whose constants AC-40 protects. A shared helper module under `__tests__/release/`: Jest would run it as an empty test file. Recording the size in a tracked file: AC-43 names a PR body. A stubs item per chain: there is no new surface to stub. Making AC-37 red artificially: a mutated copy of a test that already proves what G-10 asks would prove nothing new. |

### 3.1 Affected systems & repos

| System / repo | Nature of change | Owner domain |
| --- | --- | --- |
| `package.json`, `yarn.lock` | `gsap` 3.15.1 added and `scrollreveal` removed (PR-1), `typed.js` removed (PR-2), version 5.1.0 (PR-4) | frontend, ci |
| `src/js/motion.js` (new), `src/js/main.js`, `src/js/utils.js` | GSAP reveals, hero intro and typing, the preference handling, section focus, grid and lightbox preference | frontend |
| `src/index.html` | `data-reveal*` hooks, hero line markup | frontend |
| `src/css/style.css` | Hero gate and fallback, hero line modes, reduced-motion block | frontend |
| `scripts/third-party-notices.mjs`, new `third-party-licenses/gsap/LICENSE.md` | Repo-held license fallback, and GSAP's terms | backend |
| `README.md`, `CHANGELOG.md` | The section 7 permission (PR-1), then the 5.1.0 docs (PR-4) | docs |
| `__tests__/**`, `tests/e2e/**` | New tests, plus the §2.3 rows | tests |
| `netlify.toml` | None. The CSP stays as it is, report-only (C-10) | none |
| Netlify (`fs3portfolio.netlify.app`) | Deploys each merge to `main`. No configuration change | none |

**Dependencies.** Added: `gsap` 3.15.1, exact, runtime, under the Standard "no charge" license (V-1, C-1). Removed: `scrollreveal` 4.0.9 and `typed.js` 3.0.0, both GPL-3.0 (gsap-analysis §4). No other package, dev or runtime, is added. Lighthouse (Apache-2.0) runs through `npx` for M-1 and M-2 only (AD-17), and is not added to the repo.

### 3.2 Data changes

none. The page stores no state, and there are no cache keys. `third-party-licenses/gsap/LICENSE.md` is a static build input.

### 3.3 API & contract changes

No endpoint, payload or auth change. The browser floor and `browserslist` stay as they are (C-12, AC-47), and the CSP does not change (C-10). The page script grows, as C-9 accepts, and AD-16 measures it. These contracts change, and none breaks a visitor:

- **DOM hooks, which the tests use.** `data-sr` and `data-sr-delay` become `data-reveal`, `data-reveal-delay` and `data-reveal-group` (AD-3). The hero line gets the AD-7 markup. New state classes: `.hero-container.is-shown`, `.hero-container.is-script-owned` and `.hero-line.is-typing`. These stay: `.typed`, `data-typed-items`, `.typed-cursor`, `typed-cursor--blink` and `typed-cursor--done`.
- **Focus.** A nav link, or a hash on load, that names a section in `#main` moves focus to that section, which gets `tabindex="-1"` on first use. A hash that names anything else gets no scripted scroll or focus (AD-9).
- **The notices script.** It has a new input folder, `third-party-licenses/<name>/`, and a new section label for files read from it. It still warns when a dependency has no license file anywhere (AD-13).
- **The license.** `LICENSE` and `package.json` `license` are unchanged. The README carries the section 7 permission (AD-12).

### 3.4 Work items

_Every work item carries exactly one domain tag from:_
`frontend` `backend` `database` `redis` `security` `openfga` `docker` `tests` `ci` `docs` `harness` `agents` `skills`

_`harness`, `agents` and `skills` are for specs on the `~/.claude` repo only._

_Production source and its tests are separate items: the component is `frontend`, its spec is
`tests`, the workflow job that runs it is `ci`._

**Test-first.** Two chains cover the ACs observable below the browser (AD-18; §3.7 names their seams and guards). Neither has a stubs item, because their seams already exist. This was accepted at this spec's Gate 2 on 2026-11-20, as Fred accepted it for sprint 1's chains.

- **Chain R, release records** (AC-4, AC-39, AC-43, AC-44). Stubs: none, because the seam already exists. Acceptance tests: WI-17. Implementation: WI-1 and WI-3 (AC-4), the evidence each PR posts (AC-39: WI-5, WI-9, WI-12, WI-14), and WI-15 (AC-43, AC-44).
- **Chain G, baseline sensitivity** (AC-37). Stubs: none. Acceptance tests: WI-18, which confirms the existing test as a named guard. Implementation: the items that change what it watches (WI-3, WI-5, WI-7, WI-9, WI-10, WI-12).

Every other AC is `lint`, `build`, `manual` or `e2e`. The e2e ACs follow rule 5's default: the implementation item first, then its Playwright item, in the same PR. Unit tests stay test-after.

#### WI-17 — Commit the sprint 3 release-records tests red (PR-1, first commit)

- **domain:** `tests`
- **depends-on:** none
- **decisions:** AD-18, AD-14, AD-16
- **satisfies:** AC-4, AC-39, AC-43, AC-44
- **change:** New `__tests__/release/gsap-animations-release.test.js`, with `@jest-environment node`, in the style of `release-tag.test.js` and `pr-gate-evidence.test.js`:
  - Each runs `git` and `gh` with the `JEST_*` variables removed, and never throws. Each reports a `git`, `gh` or network failure through an `expect` message.
  - Each AC has its own test, titled `AC-4:`, `AC-39:`, `AC-43:` or `AC-44:`. They resolve the release commit as AD-18 says.

  | Test | What it does |
  | --- | --- |
  | `AC-4` | Walks AC-4's first-parent commits (AD-18's end point) to find F. It runs AC-3's checks on F's tree with `git show <F>:README.md`, `git show <F>:package.json` and `git show <F>:LICENSE`, and compares `LICENSE` with `git show 5.0.0:LICENSE`. |
  | `AC-39` | Does AC-39's `gh pr list` and `gh pr view` reads. It parses v1 blocks as `pr-gate-evidence.test.js` does, and fails on an empty PR list. |
  | `AC-43` | Finds the AD-18 size record, builds `5.0.0` and the release commit in scratch worktrees, and compares AC-43's sums within ±1 %. It always removes the worktrees, as `baseline-sensitivity.test.js` does. |
  | `AC-44` | Does AC-44's three reads, and returns them as one object compared with `toEqual`. |

  The tests are committed before WI-1 on PR-1's branch, and they read `origin`, not the branch.
- **done when:** `yarn verify:release __tests__/release/gsap-animations-release.test.js` runs on PR-1's branch before WI-1, and each test fails on its own assertion, for the right reason:
  - **AC-4:** no first-parent commit after `5.0.0` adds GSAP.
  - **AC-43:** no merged `gsap-animations` PR holds a size record.
  - **AC-44:** no release commit yet.
  - **AC-39:** fails on an empty PR list, unless it is the §3.7 guard case.

  The run's output goes in PR-1 as a comment. `yarn lint` and `yarn format:check` pass on the new file.

#### WI-18 — Confirm the baseline-sensitivity proof as a guard before any GSAP code (PR-1)

- **domain:** `tests`
- **depends-on:** none
- **decisions:** AD-18, AD-15
- **satisfies:** AC-37
- **change:**
  - On PR-1's branch, before WI-3, run `yarn verify:release -t 'AC-90|AC-28|AC-29'` on 5.0.0's code. It passes, as the guard is expected to.
  - Record that `baseline-sensitivity.test.js` depends on Typed.js or ScrollReveal only through the smoke run in its AC-90 case. That run includes the `settle` helpers WI-5 re-aims.
  - The test file is not edited.
- **done when:** the passing run is posted on PR-1 as a comment that names it as chain G's guard run.

#### WI-1 — Add the GPLv3 section 7 permission for GSAP to the README (PR-1)

- **domain:** `docs`
- **depends-on:** WI-17
- **decisions:** AD-12, AD-14, AD-18
- **satisfies:** AC-3, AC-4
- **change:** In `README.md` `## License`, keep the current line and add the AD-12 text below it: a lead sentence naming Valhalla Tech as the copyright holder who grants it, then the FSF template, verbatim, with GSAP and GSAP's license filled in and the braced Corresponding Source sentence left out. Nothing else in the README changes in PR-1; the 5.1.0 docs are WI-13. `LICENSE` is not touched. This is the first commit on PR-1's branch after WI-17's tests, and it comes before any GSAP code.
- **done when:**
  - On PR-1's head, AC-3's checks pass: `gsap.test.js` (WI-4) passes, and `git diff 5.0.0 -- LICENSE` is empty.
  - Sprint 1's `readme.test.js` AC-100 still passes.
  - Once PR-1 has merged, WI-17's `AC-4` test passes without being edited.

#### WI-2 — Give GSAP's terms a repo-held source in the third-party notices (PR-1)

- **domain:** `backend`
- **depends-on:** none
- **decisions:** AD-13
- **satisfies:** AC-5
- **change:**
  - `scripts/third-party-notices.mjs`: add the AD-13 fallback. When an installed runtime dependency's root has no `LICENSE*`, `LICENCE*` or `COPYING*` file, read the matching files from `<repo root>/third-party-licenses/<name>/`, splitting scoped names into folders as the `node_modules` path does. Label those sections `--- third-party-licenses/<name>/<file> ---`. Warn and skip only when neither place has one. The package name check stays ahead of every path join. Update the file's header comment to describe the fallback.
  - New `third-party-licenses/gsap/LICENSE.md`: the GSAP Standard License text, fetched with `curl -sSL https://gsap.com/standard-license` and taken verbatim from the page's license body. Never use a summarizing fetch tool for it. Add the URL, the retrieval date and the `gsap` version it was checked against, then the V-3 banner copied byte for byte from `node_modules/gsap/gsap-core.js`.
- **done when:** Once WI-3 has installed `gsap`, `yarn build 2> build-stderr.txt` writes a `gsap 3.15.1` section. Its `License:` line contains `no charge`, and a `--- third-party-licenses/gsap/LICENSE.md ---` line follows it, then non-blank text. `build-stderr.txt` has no `third-party-notices: warning: gsap ` line. The existing `__tests__/third-party-notices.test.js` passes unchanged.

#### WI-3 — Install GSAP and move the reveals and the hero entrance onto it (PR-1)

- **domain:** `frontend`
- **depends-on:** WI-1, WI-18
- **decisions:** AD-1, AD-2, AD-3, AD-4, AD-5, AD-8, AD-14, AD-18
- **satisfies:** AC-1, AC-4 (the GSAP side of chain R), AC-6, AC-14 (case 2), AC-22, AC-26, AC-27, AC-28, AC-29, AC-30, AC-37 (kept green under chain G's guard). Also AC-19, AC-20 and AC-21 in part: with no script, every reveal target stays visible, and the hero is never stuck hidden.
- **change:**
  - **Packages.** `yarn add gsap@3.15.1 --exact` and `yarn remove scrollreveal`. Nothing else changes in `package.json`.
  - **`src/index.html`.** Replace every `data-sr` and `data-sr-delay` with the AD-3 hooks, on the same 13 elements.
  - **`src/js/motion.js` (new).** The AD-8 `gsap.matchMedia()`, with the reveal engine (AD-2, AD-3, AD-4) and the hero intro (AD-5). In PR-1 the intro has no typing step: Typed.js keeps running from `main.js` as in 5.0.0 until WI-7.
  - **`src/js/main.js`.** Remove the ScrollReveal import and `initScrollReveal`. Call the hero intro first in `init()`, and start the reveals after the other initializers.
  - **`src/js/utils.js`.** Add the pure `revealOffset(kind)` and `revealDelays(targets)` (AD-3), with no GSAP import.
  - **`src/css/style.css`.** Add the AD-5 gate and fallback block, with no width query.
- **done when:**
  - `yarn build` passes.
  - `rg -n -i scrollreveal src package.json` and `rg -n "portfolio-(item|wrap)|swiper-slide" src/js/motion.js` print nothing.
  - `rg -c "\(width (<|>=) 1280px\)" src/css/style.css` still totals 4.
  - WI-4's and WI-5's tests pass in PR-1's gate.
  - Once PR-1 has merged, WI-17's `AC-4` test passes without being edited.

#### WI-4 — Add the unit and lint tests for PR-1

- **domain:** `tests`
- **depends-on:** WI-2, WI-3
- **decisions:** AD-3, AD-12, AD-13, AD-15
- **satisfies:** AC-1, AC-3, AC-5
- **change:**
  - `__tests__/third-party-notices.test.js`: new cases, built on the existing fixtures:
    - a dependency with no license file but a `third-party-licenses/<name>/LICENSE.md` gets a section with that text and that label, and no warning;
    - a package's own license file wins over a repo-held one;
    - with neither, the dependency is skipped with a warning, as today;
    - a scoped name maps to nested folders.
    No existing `expect` line changes.
  - `__tests__/utils.test.js`: cases for `revealOffset` (each kind, and an unknown kind) and `revealDelays` (source order inside a group, 100 ms steps, `data-reveal-delay`, and no delay for ungrouped targets). Coverage of `utils.js` stays at 80 % or more.
  - New `__tests__/acceptance/gsap.test.js`:
    - **AC-1:** the three reads. It reads the installed version from `node_modules/gsap/package.json` by path.
    - **AC-3:** the license field pattern; the README section names `GPL-3.0-only` and not `GPL-3.0-or-later`; and the permission text contains `GSAP` and `Valhalla Tech` and matches `/section 7|§\s?7/i`.
    - **AC-3's `LICENSE` check:** a SHA-256 of `LICENSE` equal to the hash of `git show 5.0.0:LICENSE`. The hash is recorded as a constant, with the command that produced it, because the gate's clone may lack the tag.
- **done when:** The gate shows six zeros on PR-1's head.

#### WI-5 — Add the e2e tests for the GSAP reveals and the hero entrance, and re-aim the PR-1 rows

- **domain:** `tests`
- **depends-on:** WI-2, WI-3
- **decisions:** AD-2, AD-3, AD-4, AD-5, AD-8, AD-15, AD-18
- **satisfies:** AC-5, AC-6, AC-14 (case 2), AC-22, AC-26, AC-27, AC-28, AC-29, AC-30, AC-37, AC-39 (PR-1's evidence), AC-41
- **change:**
  - New `tests/e2e/helpers/frame-trace.js`, which implements the §2.3 Conventions.
  - `reveals.spec.js`: AC-6 at `desktop` and at `small`, AC-26, AC-28, AC-29 and AC-30.
  - `hero.spec.js`: AC-22 at `desktop` and at `small`, and AC-27.
  - `reduced-motion.spec.js`: AC-14 case 2.
  - `build-output.spec.js`: AC-5's notices-file checks (the stderr check runs in WI-16).
  - `csp.spec.js`: AC-41 in both motion modes, with the nav click, the back-to-top click, the dialog and the mocked submission, tagged `@live` too.
  - The §2.3 rows: the `settle` helpers in `smoke.spec.js` and `a11y.spec.js` test `[data-reveal]`. The About photo locator becomes `#about .row > [data-reveal="from-right"]`. In `helpers/portfolio.js` `revealPortfolio`, only the poll message changes. Follow AD-15's title rule.
- **done when:**
  - The gate shows six zeros on PR-1's head, and that `yarn gate:linux` v1 block is posted as a PR-1 comment. If the head changes before the merge, the block is re-posted for the head that merges (AC-39).
  - Each new timing test passes `npx playwright test <file> --repeat-each=5`.
  - `yarn verify:release -t 'AC-28|AC-29|AC-90'` passes, and its output goes in the PR as a comment.

#### WI-6 — Calibrate AC-24 on the 5.0.0 typing before it changes (PR-2)

- **domain:** `tests`
- **depends-on:** WI-5
- **decisions:** AD-6, AD-15
- **satisfies:** AC-24
- **change:** Add AC-24 to `motion.spec.js` as a new `@slow` test that reuses `recordTyping`. Before any typing code changes, run it against a build of tag `5.0.0`, in a scratch worktree with `yarn install --immutable && yarn build`, served the way the smoke run serves `dist`. Q-2 asks for this run, and it is a baseline calibration, not a TDD chain. If a 5.0.0 value falls outside AC-24's range, apply AC-24's own rule: 5.0.0's measured value ± 10 %. Record the measured medians and holds for PR-2's body.
- **done when:** AC-24 passes three runs in a row against the 5.0.0 build, and the numbers are recorded.

#### WI-7 — Rebuild the hero typing on GSAP and drop Typed.js (PR-2)

- **domain:** `frontend`
- **depends-on:** WI-6
- **decisions:** AD-1, AD-5, AD-6, AD-7, AD-8, AD-14
- **satisfies:** AC-2 (the Typed.js half), AC-7, AC-14 (case 1), AC-18, AC-19, AC-20, AC-21, AC-23, AC-24, AC-25, AC-32
- **change:**
  - `yarn remove typed.js`.
  - `src/index.html`: the AD-7 hero line.
  - `src/css/style.css`:
    - the hero line modes;
    - the underline scoped as AD-7 says;
    - the cursor comment loses its Typed.js wording, and the `typed-cursor*` rules stay.
  - `src/js/utils.js`: the pure `typingSchedule` and `sharedPrefixLength` (AD-6).
  - `src/js/motion.js`:
    - switch to typing mode before the fade;
    - append the typing timeline to the hero intro, with the cursor classes as AD-6 says;
    - the reduce branch and the motion cleanup leave typing mode;
    - the late-script path never types (AD-5).
  - `src/js/main.js`: remove the Typed.js import, `initTyped` and `stopTypedCursor`.
- **done when:**
  - `rg -n -i "typed\.js|from 'typed" src package.json` prints nothing.
  - On PR-2's head, `yarn test:e2e:slow --grep "AC-110|AC-111|AC-112|AC-24"` passes.
  - WI-8's and WI-9's tests pass in the gate.

#### WI-8 — Add the unit and lint tests for PR-2

- **domain:** `tests`
- **depends-on:** WI-7
- **decisions:** AD-6, AD-15
- **satisfies:** AC-2, AC-24
- **change:**
  - `__tests__/utils.test.js`: `typingSchedule` with a fixed `random`. With `() => 0`, the steps fall on exact 100 ms, 50 ms and 2 000 ms marks. With `() => 1`, they fall on 150 ms and 75 ms. Also test:
    - the erase points `a De`, `a ` and `a `;
    - the last phrase is never erased;
    - one-phrase input, and empty input.
  - `__tests__/utils.test.js`: `sharedPrefixLength`.
  - `gsap.test.js`: AC-2's manifest, lockfile and `src` import checks.
- **done when:** The gate shows six zeros on PR-2's head, with `utils.js` coverage at 80 % or more.

#### WI-9 — Add the e2e tests for the hero sentence and the typing (PR-2)

- **domain:** `tests`
- **depends-on:** WI-7
- **decisions:** AD-5, AD-6, AD-7, AD-15, AD-18
- **satisfies:** AC-2, AC-7, AC-14 (case 1), AC-18, AC-19, AC-20, AC-21, AC-23, AC-25, AC-32, AC-37, AC-39 (PR-2's evidence)
- **change:**
  - `hero.spec.js`: AC-7, AC-18 (`@slow`), AC-20, AC-21, AC-23 and AC-32 (`@slow`).
  - `motion.spec.js`: AC-25 (`@slow`), at AC-111's settle point.
  - `no-js.spec.js`: AC-19.
  - `reduced-motion.spec.js`: AC-14 case 1.
  - `build-output.spec.js`: AC-2's `dist` and notices-line checks.
- **done when:**
  - The gate shows six zeros on PR-2's head, and its v1 block is posted as a PR-2 comment for the head that merges (AC-39).
  - `yarn test:e2e:slow --grep "AC-18|AC-24|AC-25|AC-32|AC-110|AC-111|AC-112"` passes on that head, and its output goes in the PR as a comment.
  - The new smoke-level timing tests pass `--repeat-each=5`.
  - `yarn verify:release -t 'AC-90'` passes.

#### WI-10 — Reduce motion across the rest of the page, and move focus after in-page navigation (PR-3)

- **domain:** `frontend`
- **depends-on:** WI-9
- **decisions:** AD-8, AD-9, AD-10, AD-11, AD-14
- **satisfies:** AC-8, AC-9, AC-10, AC-11 (no code, per V-7), AC-12, AC-13, AC-14 (cases 3–7), AC-15, AC-16, AC-17, AC-31, AC-33, AC-34, AC-35, AC-36
- **change:**
  - `src/css/style.css`: the AD-8 reduced-motion block, with no width query.
  - `src/js/utils.js`:
    - `scrollBehaviorFor`, `sectionTarget`, `navigateTo` and `lightboxEffects` (AD-9, AD-11);
    - `smoothScrollTo` gains its optional `behavior` argument.
  - `src/js/main.js`:
    - **Navigation:** the nav-click scroll function, the hash on load and back-to-top follow AD-9.
    - **Grid:** Muuri follows AD-10.
    - **Lightbox:** `initLightbox` follows AD-11.
  - The dialog gets no change.
- **done when:**
  - WI-11's and WI-12's tests pass in PR-3's gate.
  - `rg -c "\(width (<|>=) 1280px\)" src/css/style.css` still totals 4.
  - `yarn verify:release -t 'AC-28|AC-29|AC-90'` passes.
  - The Security Reviewer's PR-3 pass on the hash handling (AC-35) records no open finding.

#### WI-11 — Add the unit tests for the PR-3 helpers

- **domain:** `tests`
- **depends-on:** WI-10
- **decisions:** AD-9, AD-11, AD-15
- **satisfies:** AC-33, AC-34, AC-35, AC-12
- **change:** New cases in `__tests__/utils.test.js`:
  - `scrollBehaviorFor`;
  - `sectionTarget`: a section; a non-section id such as `contactModal`; `#does-not-exist`; `#a%22%5D%2C*`; a malformed escape; `#` and `''`;
  - `navigateTo`:
    - `tabindex` is added only when absent;
    - focus uses `preventScroll`;
    - the scroll is skipped when the section is already aligned;
    - the behavior follows `reduce`, with `window.scrollTo` mocked;
  - the `behavior` argument of `smoothScrollTo`;
  - `lightboxEffects`.
  No existing `expect` line changes (AC-40).
- **done when:** The gate shows six zeros on PR-3's head, with `utils.js` coverage at 80 % or more.

#### WI-12 — Add the e2e tests for reduced motion, live switches and focus (PR-3)

- **domain:** `tests`
- **depends-on:** WI-10
- **decisions:** AD-8, AD-9, AD-10, AD-11, AD-15, AD-18
- **satisfies:** AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14 (cases 3–7), AC-15, AC-16, AC-17, AC-31, AC-33, AC-34, AC-35, AC-36, AC-37, AC-39 (PR-3's evidence)
- **change:**
  - `reduced-motion.spec.js`: AC-8, AC-9, AC-10, AC-11, AC-12, AC-14 cases 3–7, AC-15, AC-16 and AC-17.
  - `in-page-navigation.spec.js`: AC-31, AC-33, AC-34, AC-35 and AC-36.
  - The titles follow AD-15's title rule. For example, AC-11's title says "contact dialog opens", in lower case.
- **done when:**
  - The gate shows six zeros on PR-3's head, and its v1 block is posted as a PR-3 comment for the head that merges (AC-39).
  - `yarn test:e2e:slow --grep "AC-109|AC-124|D-14 Reduced motion"` passes on that head (AC-13).
  - The new timing tests pass `--repeat-each=5`.
  - `yarn verify:release -t 'AC-28|AC-29|AC-90'` passes, and its output goes in the PR as a comment.

#### WI-15 — Prepare 5.1.0 and measure the script size (PR-4)

- **domain:** `ci`
- **depends-on:** WI-12
- **decisions:** AD-16, AD-14, AD-18
- **satisfies:** AC-43, AC-44 (the implementation side of chain R)
- **change:**
  - Set `package.json` `version` to `5.1.0`. No tag and no GitHub release (C-13, NG-9).
  - Measure clean builds of tag `5.0.0` and of PR-4's head with AD-16's four sums. Hand the PR Agent the AD-18 size-record block for PR-4's body, with its `<!-- js-size:v1 -->` marker and four labeled lines. Hand WI-13 the gzip growth in KB. Version and doc edits do not change `dist/**/*.js`.
- **done when:**
  - PR-4's body holds the size-record block, and a re-measure is within ±1 % of each count.
  - Once PR-4 has merged, WI-17's `AC-43` and `AC-44` tests pass without being edited. WI-16 runs them.

#### WI-13 — Write the README and CHANGELOG for 5.1.0 (PR-4)

- **domain:** `docs`
- **depends-on:** WI-15
- **decisions:** AD-12, AD-16
- **satisfies:** AC-45, AC-46, AC-47
- **change:**
  - `README.md`:
    - **Tech Stack:** a `GSAP 3` row, and no Typed.js or ScrollReveal row.
    - **Background and key files:** the hero row and the `main.js` line describe GSAP, and the key files add `motion.js`.
    - **New text:** a sentence on reduced motion (live, everywhere), and the gzip size growth from WI-15.
    - **Unchanged:** the `## License` permission from WI-1 stays, and `### Supported browsers` does not change (AC-47).
  - `CHANGELOG.md`: `## [5.1.0] - <date>`, under Keep a Changelog headings. It names GSAP, the removal of Typed.js and ScrollReveal, reduced motion, the section 7 permission and the size growth in KB.
- **done when:** AC-45's and AC-47's commands pass on PR-4's head. So do AC-46's, together with WI-14.

#### WI-14 — Re-aim the README library check to GSAP (PR-4)

- **domain:** `tests`
- **depends-on:** WI-13
- **decisions:** AD-15, AD-18
- **satisfies:** AC-46, AC-39 (PR-4's evidence)
- **change:** In `__tests__/acceptance/readme.test.js`, `LIBRARY_PACKAGES` loses its `Typed.js` and `ScrollReveal` rows and gains `{ name: /^GSAP\b/i, packages: (deps) => deps.filter((dep) => dep === 'gsap') }`. The header comment's table follows. This is §2.3's AC-95 row, and nothing else changes.
- **done when:** The gate shows six zeros on PR-4's head, and its v1 block is posted as a PR-4 comment for the head that merges (AC-39).

#### WI-16 — Run the release checks on the release commit

- **domain:** `ci`
- **depends-on:** WI-13, WI-14, U-1
- **decisions:** AD-14, AD-15, AD-16, AD-18
- **satisfies:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-13, AC-37, AC-38, AC-39, AC-40, AC-41, AC-43, AC-44, AC-45, AC-46, AC-47
- **change:** After PR-4 merges, run these on the release commit:
  - AC-38's four commands, with `yarn test:e2e:live` once Netlify has deployed;
  - `yarn verify:release` in full. That covers chain G's guard (AC-37) and chain R's `gsap-animations-release.test.js` (AC-4, AC-39, AC-43, AC-44), all unedited since WI-17;
  - AC-1's, AC-3's and AC-47's commands;
  - AC-2's and AC-5's clean-build checks, with stderr captured;
  - AC-40's diff walk over `git diff 5.0.0 <release commit> -- tests/e2e __tests__`, matching against §2.3's rows (the AC-100 row stays inactive, per AD-12);
  - AC-45's and AC-46's commands.
  Then take the M-1 to M-3 after-values (AD-17).
- **done when:** Every listed command passes, and the results are in the final report.

#### Unmapped work items

_Work with no tag in the allowed set. Never invent a tag — list it here with a
recommended owner so the orchestrator can route by judgment._

| ID | Title | Satisfies | Recommended owner | Why unmapped |
| --- | --- | --- | --- | --- |
| U-1 | Side-by-side visual check of tag `5.0.0` and PR-4's head, as AC-42 lays out: every §6 width with Windows animation effects on, then 375 and 1440 px with them off, in headed desktop Chrome on Windows with classic scrollbars. Posted as a PR-4 comment before the merge. | AC-42 | Frontend Expert (judgment), with Fred's acceptance at the release | A review produces no artifact, so no tag fits. |
| U-2 | Success-metric baselines from the live 5.0.0 site before PR-1 merges: Lighthouse through `npx` for M-1 and M-2, a Playwright HAR at `phone` for M-3, and the 5.0.0 bug count for M-4. Recorded in PR-1's body (AD-17). | M-1, M-2, M-3, M-4 (no AC) | Playwright E2E Test Engineer | A measurement of the live site, not a change to any file. |

### 3.5 Sequencing

There are four PRs, as AD-14 sets out, merged one at a time. Each PR starts from the current `origin/main`, after the previous one has merged. Each one closes when three things hold: `yarn gate:linux` shows six zeros on its pushed head, that evidence is in its body or a comment (AC-39), and one code-reviewer pass is done. The PR Agent authors each PR, with `gsap-animations` in the body.

| Phase / PR | Work items | Order inside | Extra gate before merge | Why this cut |
| --- | --- | --- | --- | --- |
| 1 — PR-1 Permission, notices, GSAP and reveals | WI-17, WI-18, WI-1, WI-2, WI-3, WI-4, WI-5; U-2 | WI-17 is the first commit; its red run is posted. WI-1 follows WI-17, ahead of any GSAP code (AD-12). WI-18's guard run comes before WI-3. WI-2 and U-2 run in parallel. WI-3 follows WI-1 and WI-18. WI-4 and WI-5 run in parallel after WI-2 and WI-3. | WI-17's red run and WI-18's guard run as comments; `verify:release -t 'AC-28\|AC-29\|AC-90'`; `--repeat-each=5` on the new timing tests; AC-41 in the gate; U-2's baselines in the body | The permission must be on `main` no later than GSAP (C-2). Chain R's tests must be red before the work they check. The reveals cannot leave ScrollReveal half done, and this PR carries the first GSAP code, so the CSP check (A-6) belongs here. |
| 2 — PR-2 Hero typing | WI-6, WI-7, WI-8, WI-9 | WI-6 → WI-7 → WI-8 ∥ WI-9 | The `@slow` hero and typing run; `verify:release -t 'AC-90'`; WI-6's 5.0.0 numbers in the body | WI-6 has to measure Typed.js while it is still on `main` (Q-2). This PR changes the hero's text model, which the screen-reader and no-JS ACs judge together. |
| 3 — PR-3 Reduced motion for the rest, and focus | WI-10, WI-11, WI-12 | WI-10 → WI-11 ∥ WI-12 | Security Reviewer pass (hash → focus, AC-35); `verify:release -t 'AC-28\|AC-29\|AC-90'`; AC-13's `@slow` tests | CSS and non-GSAP code only, plus the focus behavior, which reads the same hash code. |
| 4 — PR-4 Release 5.1.0 | WI-15, WI-13, WI-14, U-1, then WI-16 after the merge | WI-15 → WI-13 → WI-14 → U-1 on the head → merge → WI-16 | AC-43's numbers in the body; U-1's comment | Release text, version and measurement. WI-16's checks close the sprint. |

The critical path is WI-17 → WI-1 → WI-3 → WI-5 → WI-6 → WI-7 → WI-9 → WI-10 → WI-12 → WI-15 → WI-13 → WI-14 → U-1 → WI-16. WI-2, WI-4, WI-8, WI-11, WI-18 and U-2 sit off it. Chain R goes green in steps after merges: AC-4 after PR-1, AC-43 and AC-44 after PR-4. AC-39 stays green as long as each PR posts its evidence. PR-1 to PR-3 all edit `main.js`, `motion.js` or `style.css`, so no two of them run in parallel.

### 3.6 Risks & mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Affects |
| --- | --- | --- | --- | --- | --- |
| RK-1 | AC-28 requires `start(1) ≤ 150 ms`. The time to the first frame above 0.01 opacity is the observer callback, one GSAP tick, and about 71 ms of `power1.inOut` before opacity reaches 0.01. That is roughly 105–120 ms, so the margin is thin. | med | med | Entries are handled in the observer callback itself, with no extra frame (AD-2). If WI-5's `--repeat-each=5` run shows a breach, WI-3 switches the reveal ease to `sine.inOut`, which reaches 0.01 sooner. That ease still fits AC-26's 750–1 250 ms window and its ±6 px offset. Both changes stay inside PR-1, with no halt. | WI-3, WI-5 |
| RK-2 | A frame-trace test flakes in the Linux container. The gate goes red, and AC-90 fails, because it needs every other smoke test to pass. | med | high | The 30–60 s tests carry `@slow` (AD-15). Each new timing test passes `--repeat-each=5` before handoff. The ranges are §2.3's, and no retries are added. A flake goes back to the test's author as a defect, not to a gate tweak. | WI-5, WI-9, WI-12 |
| RK-3 | GSAP writes a style in a way that the report-only `style-src` or `style-src-attr` flags (A-6 false). | low | high | AC-41 runs in PR-1's gate, on the first GSAP code. If it fires, the gate halts and the result goes to Fred, because C-10 and C-1 then conflict (A-6). | WI-3, WI-5 |
| RK-4 | On a slow connection the script arrives after 2 s. The CSS fallback shows the hero with the static sentence, and nothing is typed (AD-5). | med | low | This is graceful by design, and §2.5 leaves a late script open. M-2 and M-4 watch the live result. | WI-3, WI-7 |
| RK-5 | Netlify deploys every merge, so the live site shows the in-between states: PR-1's GSAP reveals with Typed.js typing, then PR-2 without PR-3's reduced motion. | high | low | Each state passes the gate and is coherent. The PRs merge in one run. U-2 takes the metric baselines before PR-1 merges (AD-17). | all |
| RK-6 | The GSAP terms in `third-party-licenses/gsap/LICENSE.md` are misquoted, or go stale: Webflow may amend them (C-3), and a future `gsap` bump would not re-fetch them. | low | med | The text is fetched with `curl`, verbatim, and the file records the URL, the date and the `gsap` version. Renovate stays paused (NG-7), so any bump is a deliberate change that re-fetches the terms. | WI-2 |
| RK-7 | A new `(width < 1280px)` query, or a new title containing `Layout`, `Dialog open` or `Grid:`, breaks AC-37's sensitivity proof. | med | high | AD-8 and AD-15 forbid both. WI-3 and WI-10 count the queries, and PR-1, PR-2 and PR-3 each run `verify:release`. | WI-3, WI-5, WI-9, WI-10, WI-12 |
| RK-8 | On a hash load under reduced motion, the browser's own fragment jump and the script's scroll land on different `scrollY` values. AC-8 case 3 then is not a jump. Separately, `behavior: 'instant'` may be missing somewhere in the C-12 floor. | low | med | `navigateTo` skips the scroll when the section is already within 1 px of its target (AD-9). AC-8 runs in Chromium in the gate. U-1 and M-4 cover the other engines. | WI-10, WI-12 |
| RK-9 | IntersectionObserver splits one row's simultaneous entries across two callbacks (inferred, not probed). Box 2 then starts at about the same time as box 1, and AC-28's 50 ms floor fails. | low | med | If WI-5 shows this, WI-3 gathers entries over one animation frame before staggering them. The change stays inside PR-1. | WI-3, WI-5 |

**Operations:** monitoring — a static page has no runtime telemetry, and none is added, which is proportionate here. The watch is the live checks after each deploy (`yarn test:e2e:live`, AC-41's `@live` run, which WI-16 runs on the release) plus M-1 to M-4. Backup — not applicable: no data is destroyed or rewritten. Rollback — revert a PR's merge on `main`, or use Netlify's instant rollback to an earlier deploy. Code has no point of no return, because no tag or release is pushed (NG-9). The one point of no return is legal. Once WI-1 publishes the section 7 permission on `main` in PR-1, copies conveyed under it keep it, and reverting the README does not withdraw it. That step is gated by Fred's decision (R1-Q2, C-2) and PR-1's review.

### 3.7 Test strategy

_Every AC maps to an executable check, or is explicitly recorded as manual. For each TDD chain, name its test seam. Name as a guard, with its reason, each acceptance test expected to pass against the stubs. Any other test that passes before implementation halts the chain._

**TDD chains.** The five `integration` ACs are below the browser, and each sits in a chain (AD-18). Neither chain has a stubs item, because their seams already exist. This was accepted at this spec's Gate 2 on 2026-11-20, as Fred accepted it for sprint 1's chains on existing seams.

| Chain | ACs | Stubs | Acceptance tests | Implementation | Test seam |
| --- | --- | --- | --- | --- | --- |
| R Release records | AC-4, AC-39, AC-43, AC-44 | none | WI-17 | WI-1, WI-3 (AC-4); the evidence posts in WI-5, WI-9, WI-12, WI-14 (AC-39); WI-15 (AC-43, AC-44) | `yarn verify:release __tests__/release/gsap-animations-release.test.js`, one test per AC titled `AC-n:`. **AC-4:** `git log --first-parent --reverse --format=%H 5.0.0..<end>`, where `<end>` is the release commit, or `origin/main` until one exists. F is the first commit where `git show <c>:package.json` has `.dependencies.gsap`, or where `git grep -l -E "from ['\"]gsap" <c> -- src` finds a file. AC-3's checks then run on `git show <F>:README.md`, `<F>:package.json` and `<F>:LICENSE`, against `git show 5.0.0:LICENSE`. **AC-39:** `gh pr list --state merged --search "gsap-animations in:body" --json number,headRefOid`, then `gh pr view <n> --json body,comments`, with v1 blocks parsed as in `pr-gate-evidence.test.js`. **AC-43:** the one merged `gsap-animations` PR whose body holds the AD-18 `<!-- js-size:v1 -->` block, and scratch-worktree builds of `5.0.0` and the release commit (`yarn install --immutable && yarn build`), summed over `dist/**/*.js` raw and with `zlib.gzipSync(file, { level: 9 })`. **AC-44:** `git show <release commit>:package.json`, `git ls-remote --tags origin refs/tags/5.1.0` and `gh release view 5.1.0`. The release commit is resolved as AD-18 says. |
| G Baseline sensitivity | AC-37 | none | WI-18 | WI-3, WI-5, WI-7, WI-9, WI-10, WI-12 (the work it must stay green through) | `yarn verify:release -t 'AC-90\|AC-28\|AC-29'`, which runs `__tests__/release/baseline-sensitivity.test.js` unedited. Its Jest results for the titles starting `AC-90:`, `AC-28:` and `AC-29:` are passed, not skipped |

**Red for the right reason (chain R, at WI-17, before WI-1).** Each test fails on its own `expect`, and the failure names the reason:

- `AC-4`: no first-parent commit after `5.0.0` adds GSAP.
- `AC-43`: no merged `gsap-animations` PR holds a size record.
- `AC-44`: no release commit yet, so the version is not 5.1.0. Its tag and release reads pass both before and after, but they sit inside the one `toEqual`, so the test stays red until the version check passes.
- `AC-39`: no merged `gsap-animations` PR.

A `git`, `gh` or network failure is a harness problem, not a red result. It is fixed before the run counts.

**Guards.** Each is named here with its reason, so the red check does not halt on it:

- **`AC-37:` (chain G, all three cases).** It passes at 5.0.0 by design. Its cases mutate the 1280 px queries and the dialog toggle, and use `Grid:` as the control. None of them names Typed.js or ScrollReveal. They depend on the old libraries only through the smoke run in the AC-90 case, whose `settle` helpers WI-5 re-aims. So the proof needs no re-aim (G-10), and its job is to stay green through PR-1 to PR-3 and at the release. WI-18 records the run on 5.0.0's code.
- **`AC-39:` (chain R), conditionally.** The spec's own PR may already have merged with `gsap-animations` in its body and its gate v1 block. In that case the test passes before any sprint 3 code PR, and from then on it guards each later PR. If that PR has not merged, or carries no slug, the test is red on the empty list, as above.

WI-6's run of AC-24 against Typed.js is a baseline calibration that Q-2 asks for. It is not part of a chain, so the red check does not apply to it.

**No chain, by rule.** Every other below-browser AC is `lint`, `build` or `manual`: AC-1, AC-3, AC-40, AC-45, AC-46 and AC-47 are `lint`, AC-2, AC-5 and AC-38 are `build`, and AC-42 is `manual`. Every behavioral AC is observed in the browser (`e2e`), so it stays test-after: implementation first, then Playwright, in the same PR. The notices script and the `utils.js` helpers get unit tests after their code (WI-4, WI-8, WI-11).

**Title rule (AC-37):** across the smoke run, exactly one title contains `Layout`, one contains `Dialog open`, and one contains `Grid:`. No new title contains any of the three.

**Roles and hooks (Q-3):** listed in AD-3 and AD-7.

| AC | Check | Level | Where it runs |
| --- | --- | --- | --- |
| AC-1 | `gsap.test.js`: AC-1's three reads | lint | gate, PR-1 on; WI-16 |
| AC-2 | `gsap.test.js` (manifest, lockfile, `src`); `build-output.spec.js` (`dist`, notices); a clean build in WI-16 | build | gate, PR-2 on; WI-16 |
| AC-3 | `gsap.test.js`: license field, README section, permission text, `LICENSE` hash | lint | gate, PR-1 on; WI-16 |
| AC-4 | Chain R: `gsap-animations-release.test.js` `AC-4:`, red at WI-17 | integration | `verify:release` in PR-1 (red), after PR-1 merges (green), WI-16 |
| AC-5 | `build-output.spec.js` (notices section); a clean build with stderr captured; WI-4's unit tests | build | gate, PR-1 on; WI-16 |
| AC-6 | `reveals.spec.js`, at `desktop` and `small` | e2e | gate, PR-1 on |
| AC-7 | `hero.spec.js` | e2e | gate, PR-2 on |
| AC-8 – AC-12 | `reduced-motion.spec.js` | e2e | gate, PR-3 on |
| AC-13 | Sprint 1's `AC-109`, `AC-124` and `D-14 Reduced motion` tests, unchanged | e2e | PR-3 extra gate (`@slow`); WI-16 |
| AC-14 | `reduced-motion.spec.js`: case 2 (PR-1), case 1 (PR-2), cases 3–7 (PR-3) | e2e | gate |
| AC-15 – AC-17 | `reduced-motion.spec.js` | e2e | gate, PR-3 on |
| AC-18 | `hero.spec.js` (`@slow`), in three contexts | e2e | PR-2 extra gate; WI-16 |
| AC-19 | `no-js.spec.js` | e2e | gate, PR-2 on |
| AC-20, AC-21 | `hero.spec.js`, with routed bundles | e2e | gate, PR-2 on |
| AC-22 | `hero.spec.js`, at `desktop` and `small` | e2e | gate, PR-1 on |
| AC-23 | `hero.spec.js` | e2e | gate, PR-2 on |
| AC-24 | `motion.spec.js` (`@slow`), on AC-110's recording; calibrated on `5.0.0` first (WI-6) | e2e | PR-2 extra gate; WI-16 |
| AC-25 | `motion.spec.js` (`@slow`), at AC-111's settle point | e2e | PR-2 extra gate; WI-16 |
| AC-26 – AC-30 | `reveals.spec.js` (AC-26, AC-28, AC-29, AC-30), `hero.spec.js` (AC-27) | e2e | gate, PR-1 on |
| AC-31, AC-33 – AC-36 | `in-page-navigation.spec.js` | e2e | gate, PR-3 on |
| AC-32 | `hero.spec.js` (`@slow`): a full visit, then 30 s | e2e | PR-2 extra gate; WI-16 |
| AC-37 | Chain G: `baseline-sensitivity.test.js` via `yarn verify:release`, a named guard | integration | WI-18 on 5.0.0's code; PR-1, PR-2, PR-3 extra gates; WI-16 |
| AC-38 | The gate, `test:e2e:slow`, `verify:release` and `test:e2e:live` on the release commit | build | WI-16 |
| AC-39 | Chain R: `gsap-animations-release.test.js` `AC-39:` (a conditional guard, see above) | integration | `verify:release` in PR-1, then WI-16 |
| AC-40 | Diff walk of removed `expect` lines and changed constants against §2.3's rows | lint | WI-16 |
| AC-41 | `csp.spec.js` in both motion modes, local and `@live` | e2e | gate, PR-1 on; live in WI-16 |
| AC-42 | U-1's reviewer comment on PR-4 | manual | PR-4 |
| AC-43 | Chain R: `gsap-animations-release.test.js` `AC-43:`, red at WI-17 | integration | `verify:release` in PR-1 (red), WI-16 (green) |
| AC-44 | Chain R: `gsap-animations-release.test.js` `AC-44:`, red at WI-17 | integration | `verify:release` in PR-1 (red), WI-16 (green) |
| AC-45 – AC-47 | The AC commands; `readme.test.js` (re-aimed) for AC-46's first check | lint | PR-4; WI-16 |

### 3.8 Domain tag summary

_The dispatch seam. One row per tag actually used._

| Tag | Work items | Suggested specialist |
| --- | --- | --- |
| `frontend` | WI-3, WI-7, WI-10 | Frontend Expert |
| `backend` | WI-2 | JavaScript/Web Coding Expert (`scripts/third-party-notices.mjs`) |
| `tests` | WI-4, WI-8, WI-11, WI-14 (unit and acceptance); WI-17, WI-18 (release suite); WI-5, WI-6, WI-9, WI-12 (e2e) | JavaScript/TypeScript Unit Test Engineer for `__tests__/acceptance/**`, `__tests__/utils.test.js` and `__tests__/third-party-notices.test.js`; Playwright E2E Test Engineer for `tests/e2e/**` and for `__tests__/release/**` (WI-17, WI-18), which drives `git`, `gh` and smoke runs as `baseline-sensitivity.test.js` does |
| `ci` | WI-15, WI-16 | CI/CD Pipeline Engineer (release preparation and checks) |
| `docs` | WI-1, WI-13 | Documentation Agent |

Unmapped: U-1, U-2. The Security Reviewer reviews PR-3's hash handling as an extra gate. That is a review, not a work item, because no security control changes.

#### Raised for Gate 2

_§1.8 D-items the Architect could not decide; each is a question for Fred at Gate 2._

None. Each of D-1 to D-8 is resolved by an AD row that names it:

| D-item | Resolved by |
| --- | --- |
| D-1 | AD-1, AD-16 |
| D-2 | AD-12, AD-13 |
| D-3 | AD-6, AD-7 |
| D-4 | AD-5 |
| D-5 | AD-2, AD-3, AD-4 |
| D-6 | AD-8, AD-9, AD-10, AD-11 |
| D-7 | AD-15 |
| D-8 | AD-14 |

The §2.6 points are settled too:

- Q-1: AD-5 keeps AC-21's 5 s.
- Q-2: WI-6.
- Q-3: AD-3 and AD-7.
- Q-4: AD-16.
- Q-5: AD-13.
- Q-6: AD-11. A-7 holds, so nothing goes to Fred.

#### Gate 2 record

<!-- OWNER: Architect. Written when /spec relays Fred's Gate 2 decision. -->

_The readiness verdict, the count of security findings, and Fred's decision. When he approved
over `FAIL`, his reason, verbatim._

- **2026-11-20, review 1:** verdict `FAIL`, 5 findings (F-1 to F-5: no TDD chain for AC-4, AC-37, AC-39, AC-43 and AC-44), 0 security findings. The decision was Request changes. The Architect repaired the findings with AD-18, chains R and G, WI-17 and WI-18.
- **2026-11-20, review 2:** verdict `CONCERNS`, 1 finding (F-1: AD-12's commit order disagreed with AD-18, WI-17, WI-1 and §3.5), 0 security findings. The decision was Approve, and F-1 was fixed in the approval edit (AD-12). The no-stubs chains G and R were accepted at this gate. Track: `full`.
- **Who decided:** the sprint coordinator took both decisions on Fred's behalf, under his standing instruction (§1.8 R1-Q3). Fred confirmed on 2026-11-20 that his sprint 2 rule carries to sprint 3.

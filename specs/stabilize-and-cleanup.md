# Spec: Sprint 1 — Stabilize and Clean Up

| Field | Value |
| --- | --- |
| Slug | `stabilize-and-cleanup` |
| Created | 2026-11-16 |
| Stage | `approved` |
| Brief | ✅ complete |
| PRD | ✅ complete |
| Technical Plan | ✅ complete |

**Test-first:** acceptance

_`none` (default) builds tests after code, as always. `acceptance` (pilot): each AC observable below the browser is covered by a §3.4 chain of stubs → failing acceptance tests → implementation, one chain per test seam. Set by the Analyst from /spec Stage 0; read by everyone else._

> One feature, one file. Three sections, three owners. Section owners never edit
> another owner's section — contradictions are reported upward, not silently patched.
> The `Stage` row is the Architect's. It reads `draft` until Fred approves at Gate 2,
> when the Architect sets it to `approved`.

---

## 1. Brief

<!-- OWNER: Analyst. No other agent may edit this section. -->

**Status:** ✅ complete

### 1.1 Problem statement

_What is wrong / missing today, in the user's terms. No solution language._

PortfolioPage-FS3 is Fred's personal portfolio site, live at `fs3portfolio.netlify.app`, and the public GPL-3.0 repo it is built from. A read-only review on 2026-11-16 (`update-report-2026-11-16/README.md` plus four detail files, cited below by file and section) found four defects live in production. Those ship in a separate hotfix ahead of this work (NG-1). This brief covers what the review left for sprint 1, plus three findings Fred brought in at Gate 1 (PRD Q-6). He brought in a fourth, the no-JS contact-form path, and then moved it to sprint 2 (PRD Q-13; NG-11). Once the hotfix lands, the remaining problems fall into eight groups.

**1. Nothing reliably stops a broken change from reaching `main`.**

- `main` has no required status check. Renovate merged PR #67 while `Test & Build` was failing, and that merge is why `main` stopped installing (report §1 B1, B2; docs-audit R14).
- GitHub Actions is locked by a billing issue. Every run fails in 2–6 s, and the last green run was 2026-09-25 (report §1 B8). Fred has ruled that CI cannot be counted on in this sprint, so local runs are the only gate (C-8).
- That local gate gives the wrong verdict on Fred's Windows checkout. `yarn lint` and `format:check` report 897 errors in 5 files. Every one is a CRLF line ending, and the same files pass on Linux (report, "How this was checked"; §7 Tooling). The format check also never looks at `src/css` (report §7).
- The pinned runtime, Node 25.9.0 (`.nvmrc:1`, `netlify.toml`), reached end of life on 2026-06-01. Node 25 does not ship Corepack, so the README's `corepack enable` step fails. CI worked only because the runner image happened to include Corepack (report §1 B6; docs-audit R17, R18).
- The runtime-sync workflow throws whenever `netlify.toml` needs no change (`sync-runtime-versions.yml:120-122`). Its PR #56 has been open since 2026-07-13. `netlify.toml` says Yarn 4.17.0 while `package.json` says 4.18.1 (report §1 B7). Renovate PR #68 is also open and changes `package.json` only.
- Renovate's single rule automerges every package (`renovate.json`). Bootstrap's `next` tag is a 6.0 alpha, so a breaking alpha bump could merge with no visual check (report §2b Risks; bootstrap6-analysis §7 R1). The hotfix pauses automerge for everything (C-2), and the pause holds through the end of sprint 1 (C-28). No rule holds back `bootstrap` in particular, so nothing would protect it once the pause lifts.

**2. The repo ships and maintains code and assets that nothing uses.**

Report §7 and frontend-audit §5a list the dead weight:
- 1.3 MB of icofont files that nothing references.
- About 400 KB of images that nothing references.
- `boxicons` and `just-validate`, which are never imported.
- About 450 of the 1,343 lines in `style.css`, which style sections that do not exist.
- `observeSkills`, plus the tests that keep it alive. It targets an element that does not exist.
- A second `.mobile-nav-toggle`, which overlaps the first and whose icon never updates.

Other problems in the same code:
- `style.css` has invalid and no-op declarations, including `padding-right: 20px 15px` at `:1339` (frontend-audit §5b).
- `#149ddd` is hard-coded 22 times, and other brand colors are repeated the same way. No single place sets a site color, so the contrast correction in group 3 means 22 coordinated edits (frontend-audit §5c).
- The template header comments name versions that match neither the template nor any release (docs-audit C1). The "replaces X" comments describe history, not the code (docs-audit C2).
- `main.js` loads `utils.js` with a CommonJS `require()` inside an ES module, which limits Parcel's scope hoisting and tree shaking (frontend-audit §3).
- A scroll listener runs `querySelectorAll` and layout reads on every scroll event (gsap-analysis §1a J6).

**3. Visitors who use a keyboard or a screen reader, or who have low vision, cannot fully use the page (WCAG 2.2 AA).**

High-severity failures (report §4; frontend-audit §2a, §2c):
- The portfolio filters cannot be reached or operated from the keyboard.
- The mobile nav toggle, the four social links and back-to-top have no accessible name.
- The nav toggle's focus indicator is removed (`style.css:225`).
- Portfolio action links appear only on hover, so keyboard focus lands on invisible links and touch users never see them.
- The testimonial carousel autoplays every 5 s, forever, with no way to pause it. It keeps autoplaying when the visitor's system asks for reduced motion.
- White on the accent color is 3.0:1, and the success message is 2.0:1.

The hero typing effect has the same WCAG 2.2.2 failure as the carousel. It types and erases its four phrases forever, with no way to stop it (frontend-audit §7 A3; gsap-analysis §1a J1).

Medium-severity failures:
- The page has two `<h1>` elements.
- There is no skip link.
- Below 1200 px, links in the closed off-screen nav stay in the tab order.
- Portfolio images are described only as "Portfolio item N".
- Nine identical links are named "More Details", and the lightbox links are named only "App 1" and similar.

Failures that neither report §4 nor bootstrap6-analysis §5a assigns to a sprint (frontend-audit §2a, §2b, §2d):
- The carousel pagination bullets have no names (Medium).
- Each bullet is 12 px on a 22 px pitch, below the 24 px target size (2.5.8, Medium).
- The social links (36 px) and back-to-top (40 px) are below the 44 px org standard (Low).
- On short viewports at 1200 px and wider, the fixed footer can cover a focused nav link (2.4.11, Low).
- `#hero` sits outside `<main>`, and the nav has no label (Low).
- The testimonial and About photos repeat the adjacent text in their alt text (Low).
- The submit button announces no busy state while sending (Low).

**4. The page sends far more than it shows.** (Report §5; frontend-audit §3.)

- The hero background is a 3840×2160, 469 KB JPEG. Phones get it at full size, and it is probably the slowest-loading element on the page.
- Fonts come from Google Fonts' old v1 API: 24 font faces, with text invisible until they load. Every visit also sends a request to Google.
- Font Awesome sends 234 KB of webfonts for about 25 icons.
- No image declares its dimensions, so the layout shifts as images load. Every image loads at page start.
- The profile photo is 1920×1275 but displays at 120 px, and it renders as an oval rather than a circle.
- Source maps are publicly served (`repo.*.js.map` returns 200).

**5. The site declares no content security policy, and the toolchain carries known advisories.** (Report §6; frontend-audit §4.)

- No CSP is sent.
- The deprecated `X-XSS-Protection` header is still sent.
- No `Permissions-Policy` is sent.
- No `Cross-Origin-Opener-Policy` is sent (frontend-audit §4, Low).
- `index.html` has inline `style` attributes at `:431` and `:480`, and any policy has to account for them.
- `yarn npm audit` reports 1 critical, 6 high, 11 moderate and 1 low advisory in dev dependencies. Production dependencies have none, and none of the flagged packages reaches the browser.
- Six devDependencies resolve through `latest` (`package.json:30-39`: `@eslint/js`, `eslint`, `eslint-config-prettier`, `eslint-plugin-prettier`, `globals`, `prettier`). Any lock refresh can silently cross a major version, which has already moved ESLint from 9 to 10 (docs-audit R5). Report §6 and docs-audit R5 count five; the repo has six.

**6. Nothing automated checks the rendered page.**

- Jest measures `src/js/utils.js` only (`jest.config.js:8`). There is no end-to-end harness.
- Sprint 2 (Bootstrap 6) moves breakpoints and re-keys the grid and spacing classes. It also turns the contact modal into a native dialog and changes the color-scheme default. Without a baseline captured first, layout and dialog regressions there go undetected (report, Sprints notes and §2b; bootstrap6-analysis §6).

**7. The documentation describes a project that does not exist.** (docs-audit §2.)

- The README cites the wrong Node and Yarn versions, Swiper `^12` and ESLint 9.
- It advertises a skills section that never existed and two libraries that are never loaded.
- It misstates the Node range that bundles Corepack.
- Its live-site URL and Netlify badge both return 404.
- It claims that CI must pass before a merge, which is false (B2), and that runtime versions stay in sync automatically, which is false (B7).
- The README's short description differs from the GitHub repo description.
- The copyright holder is "Fred Smith III" in the README and "Valhalla Tech" in the footer.
- There is no CHANGELOG, although six releases exist up to tag 3.0.0, and `package.json` still says 2.0.0.
- The only issue template asks about "% of customers" and effort in sprints. Blank issues are disabled, so it is the only way to file an issue (docs-audit T1).

**8. A few remaining defects and an unmaintained dependency.** (Brought in at Gate 1, PRD Q-6.)

- **Testimonial carousel.** It has 3 slides, shows 3 at once at 900 px and wider, and is set to loop. It cannot loop with no slides off-screen, so it is expected to log a loop warning (frontend-audit §0, Medium). The audit did not run the page, so the warning itself is unconfirmed.
- **Isotope.** The portfolio filter and grid layout depend on Isotope 3.0.6, which has not been maintained since 2018 and does a filter job for 9 items (frontend-audit §3). It is licensed GPL-3.0 or commercial (gsap-analysis §4). It also positions `.portfolio-item` elements itself, which any other motion on those elements must avoid (gsap-analysis §5 G5).

### 1.2 Who is affected

_Roles, systems, or teams that feel the problem. Rough scale if known._

- **Site visitors who use a keyboard or screen reader, or who have low vision.** They are blocked or degraded by group 3.
- **Site visitors on phones or slow connections.** Group 4 delays their first screen.
- **All site visitors.** Every visit currently sends a request to Google's font servers (group 4). No source gives visitor counts or traffic, and no analytics are cited, so the scale is unknown.
- **Fred, as owner and sole maintainer.** He cannot trust `main` (group 1), the setup steps in his own README fail (group 1, group 7), lint fails falsely on his Windows machine (group 1), and he maintains dead code (group 2).
- **Whoever carries out sprint 2 (Bootstrap 6) and sprint 3 (GSAP).** They have no automated way to detect a rendering regression (group 6). Every dead line left in place is a line they must re-verify (bootstrap6-analysis §5a, "Before" rationale).
- **Anyone who reads the public repo or files an issue.** They are misled by group 7 and must answer irrelevant template questions.

### 1.3 Goals

_Outcomes that would mean the problem is solved. Observable, not implementation._

**Merge safety and runtime**

- **G-1** — No sprint 1 change reaches `main` until the repo's checks have passed on it, and a reviewer can see the evidence. The checks are: install without modifying the lockfile, lint, format check, tests with coverage, build, and the rendered-page check from G-16 (C-8).
- **G-2** — Once Actions runs again, a PR whose `Test & Build` check fails cannot be merged into `main` (report §1 B2). While Actions stays locked, this goal is met when the check is ready to enforce. Enforcement waits for billing (C-27).
- **G-3** — A Bootstrap prerelease update cannot merge into `main` without an explicit human action. This holds whether or not automerge is paused for other packages (report §8 item 7; bootstrap6-analysis §7 R1).
- **G-4** — Local development, CI and Netlify all declare the same Node line, and that line was in support on 2026-11-16. The README setup steps, run as written on a clean machine with that line, produce a working install (report §1 B6).
- **G-5** — The runtime-sync workflow finishes without error when nothing needs changing. At release, no two files in the repo declare different Node or Yarn versions (report §1 B7).
- **G-6** — On a Windows checkout of `main`, lint and format checks give the same verdict as on Linux. The format check covers `src/css` (report §7 Tooling).

**Cleanup**

- **G-7** — Everything below is gone, and a search of tracked files for each item returns no references. The page behaves as it did, apart from the intended changes in this brief, and `@popperjs/core` remains (C-17). One frontend-audit §5a rule is an exception: the `.validate` CSS rule stays. Sprint 2 removes it together with the `.validate` divs it styles (NG-10; Gate 1, PM readings).
  - Every item in report §7's Remove table.
  - The dead selectors and the invalid and no-op declarations in frontend-audit §5a–§5b, except breakpoint normalization (NG-2).
  - The duplicate mobile-nav toggle.
- **G-8** — Each site color is declared once in `style.css`, so changing a color takes one edit (C-19).
- **G-9** — `main.js` loads `utils.js` through the same module system as its other imports. The Jest suite still runs, with coverage at or above the 80% threshold (C-25).
- **G-10** — The per-scroll work in gsap-analysis §1a J6 no longer runs on every scroll event. The active-nav highlight and back-to-top visibility (after 100 px) behave as they do today (gsap-analysis §7 step 1).

**Accessibility** (frontend-audit §2, limited to items bootstrap6-analysis §5a marks **Before**, plus C-4, C-30, C-31 and C-35)

- **G-11** — A visitor using only a keyboard, a screen reader or a low-vision setup can do each of the following:
  - **a.** Reach and operate every portfolio filter from the keyboard, and hear which filter is selected (WCAG 2.1.1, 4.1.2).
  - **b.** Hear a name for the mobile nav toggle, each social link and back-to-top. The toggle also reports whether the nav is open (4.1.2, 2.4.4).
  - **c.** See a focus indicator on every focusable control, the nav toggle included (2.4.7).
  - **d.** See portfolio action links whenever they have keyboard focus, and reach them on touch devices without hovering (2.4.7, 2.4.11).
  - **e.** Pause the testimonial carousel's automatic rotation (2.2.2). Under a reduced-motion system setting, the carousel does not rotate on its own at all (C-35).
  - **f.** Read every text pair frontend-audit §2c lists at its WCAG minimum or better (1.4.3, 1.4.11):
    - Normal text at 4.5:1.
    - Large text at 3:1. This includes the hero text over the background image, measured on the image's lightest pixel behind the text (C-33).
    - Every listed UI component at 3:1.
  - **g.** Find exactly one `<h1>`, with heading levels outside the contact dialog that do not skip (1.3.1, 2.4.6).
  - **h.** Skip past the header and nav straight to the main content (2.4.1).
  - **i.** Tab through the page below 1200 px without focus entering the closed nav (2.4.3, 2.4.11).
  - **j.** Never encounter decorative icons in the accessibility tree, and hear which nav link is the current section.
  - **k.** Hear alt text that describes what each portfolio image shows, and lightbox and detail links with distinct names (C-4).
  - **l.** *(SHOULD, C-30.)* Get each of the following:
    - A name for each carousel pagination bullet.
    - A target of at least 24 px for each bullet, and at least 44 px for the social links and back-to-top (2.5.8; C-33).
    - A focused nav link that the fixed footer never covers (2.4.11).
    - The hero inside the main landmark, and a labeled nav (1.3.1).
    - Testimonial and About photos whose alt text does not repeat the adjacent text (1.1.1).
    - An announced busy state on the contact form while it sends.
  - **m.** Watch the hero typing effect run through its phrases once and then stop (2.2.2). Its blinking cursor stops too, because it is part of the same moving content (Gate 1, PM readings). This is interim behavior until sprint 3 replaces the effect (C-31).

**Performance** (report §5, all of it per C-9)

- **G-12** — Each of these changes is observable on the live site, measured against the thresholds Fred accepted at Gate 1 (C-33):
  - **a.** A phone-width visitor is not sent the 3840×2160, 469 KB hero image.
  - **b.** No request goes to Google's font servers (C-11), and text is never invisible while fonts load.
  - **c.** The bytes spent on icons are proportionate to the about 25 icons shown, not 234 KB of webfonts.
  - **d.** Every image reserves its space before it loads, so nothing shifts. Images below the first screen do not compete with it at page load.
  - **e.** The profile photo renders as a circle.
  - **f.** Whether production serves source maps has been decided and recorded in this spec, and the live site matches that decision.

**Security and dependencies** (report §6, all of it per C-9)

- **G-13** — The live site sends a report-only content security policy (C-10). A full page visit produces no policy-violation reports in the browser console, including opening the lightbox, opening the contact dialog and loading the map. `index.html` carries no inline `style` attributes.
- **G-14** — The live site no longer sends `X-XSS-Protection`. It does send a `Permissions-Policy` (report §6) and a `Cross-Origin-Opener-Policy` (frontend-audit §4; Gate 1, PRD Q-6).
- **G-15** — `yarn npm audit` reports 0 critical and 0 high advisories across production and dev dependencies (Fred, grilling R2-Q4). No devDependency in `package.json` resolves through `latest`.

**Rendered-page baseline**

- **G-16** — An automated check of the rendered page covers every behavior that bootstrap6-analysis §6's coverage table names. Each is asserted as it behaves today on Bootstrap 5 (C-32). The check passes against the 4.0.0 release, runs locally, and never delivers a real contact-form submission (C-18). Sprint 2 then changes only the assertions it changes on purpose, so it can tell an intended layout or dialog change from an unintended one (report, Sprints notes).

**Documentation, release and intake**

- **G-17** — At release 4.0.0, every claim docs-audit §2 lists reads true against the repo and the live site:
  - Every README URL resolves.
  - No badge renders broken.
  - Versions are stated or pointed to correctly.
  - No feature, library or guarantee is claimed that does not exist.
  - The short description is identical in both places (C-6).
  - The copyright holder is Valhalla Tech (C-5).
- **G-18** — Release 4.0.0 exists as a tag, `package.json` `version` reads `4.0.0`, and `CHANGELOG.md` has entries for every release from 1.0.0 through 4.0.0 (C-12, C-13).
- **G-19** — Someone filing an issue gets a bug form or a feature form. Neither asks about customer percentages, sprint effort, timing, or internal versus customer feedback (C-14).

**Brought in at Gate 1** (PRD Q-6)

- **G-20** — The testimonial carousel logs no loop warning to the browser console at any viewport width (frontend-audit §0).
- **G-21** — *Withdrawn at Gate 1, PRD Q-13. The no-JS contact-form path moved to sprint 2 (NG-11). The ID is kept so it is not reused.*
- **G-22** — The portfolio filter and layout no longer depend on Isotope. The following must still hold:
  - Every filter shows the same items it shows today.
  - The lightbox still opens from any visible item.
  - The grid fits the page at every width: it does not cause horizontal scrolling, and no other section's layout or behavior changes.

The grid's look may change, and a justified-row or masonry look is acceptable. Filtering does not need to animate (C-36). Where it does animate, a visitor whose system asks for reduced motion (`prefers-reduced-motion: reduce`) sees the filtered result appear without animation (C-37). The smoke baseline records whichever layout ships (C-32). What replaces Isotope is a solution choice outside this brief. It was settled at Gate 2 (§1.8, D-16).

### 1.4 Non-goals

_Explicitly out of scope for this feature. Each with a one-line reason._

- **NG-1** — Live production bugs B1 (lockfile), B3 (lightbox 404s), B4 (year-long retention of those 404s) and B5 (bad URL hash halts page setup), and the Renovate automerge pause. They ship in a separate hotfix PR ahead of this spec (C-1, C-2).
- **NG-2** — The Bootstrap 6 upgrade and every item bootstrap6-analysis §5a marks **During**. That covers dialog live regions, removal of the 2 s auto-close, visible form labels and `autocomplete`, Bootstrap button classes, breakpoint normalization, the dialog title heading, and form error wiring ("During or after"). These are sprint 2, and doing them on v5 first means doing them twice.
- **NG-3** — The Bootstrap Sass-partials route and any mapping of site colors onto `--bs-*` tokens. Both come after sprint 2 (bootstrap6-analysis §4, §5a A-L1; report §2b step 7). The Sass route is also not in report §5, so C-9 does not bring it in.
- **NG-4** — GSAP migration steps 2 and later and the GSAP license decision. These are sprint 3 (report §2, Sprints table). Steps 2 and later include:
  - Replacing Typed.js and ScrollReveal.
  - Reduced-motion handling for everything except the testimonial carousel and the portfolio filter (GSAP step 4).

  Three motion changes are sprint 1 work, not sprint 3. The first two are the only reduced-motion exceptions:
  - The carousel's behavior under reduced motion: it does not autoplay (C-35; G-11e).
  - The portfolio filter's behavior under reduced motion: it changes without animation (C-37; G-22).
  - The hero typing effect stopping after one cycle (C-31; G-11m). This is the only interim typing change.

  Gsap-analysis §7 step 7 (Isotope → Flip) assumed Isotope would still be present. Sprint 1 removes the page's dependency on Isotope (G-22).
- **NG-5** — Any change to the hero typing effect beyond stopping after one cycle (C-31). Stopping includes its blinking cursor (G-11m), so that is not a further change. That rules out a pause control, a static accessible label, sequencing after the hero fade, and reduced-motion handling for the typing. Sprint 3 replaces the effect and must meet frontend-audit §7 A2 and A3.
- **NG-6** — Placeholder content and typos: www.example.com, the 555 number, the Manhattan map, links to `#`, empty service text, the joke testimonials, "Unites States" and "If I had of" (C-3).
- **NG-7** — Restoring a BootstrapMade footer credit or adding a template acknowledgment. Fred, grilling R1-Q5: "This project is so far removed from what was provided with the template that this design is now all me."
- **NG-8** — Clearing the GitHub Actions billing lock. It is an account fix outside the repo (report §1 B8).
- **NG-9** — Enforcing the content security policy. Sprint 1 ends report-only (C-10), and enforcement needs a Security Reviewer pass first (report §6).
- **NG-10** — The remaining contact-form leftovers in frontend-audit §1:
  - The template class name `php-email-form` and the selectors that hang off it. Left for sprint 2, which rebuilds the contact form markup for the Bootstrap 6 dialog (Gate 1, `php-email-form` breakout: "Leave for sprint 2 (Recommended)").
  - The unpopulated `.validate` divs. Removing them is sprint 2 work (bootstrap6-analysis §6 step 4).

  At Gate 1, Fred brought in four NG-10 findings (PRD Q-6): the Swiper loop warning, the no-JS raw-JSON path, the COOP header and the Isotope replacement. Three of them are now G-20, G-14 and G-22. The no-JS path later moved to sprint 2 (NG-11). These two leftovers were never among them, and Fred later confirmed the class rename stays out. The `.validate` CSS rule stays with its divs until sprint 2 (G-7 exception).
- **NG-11** — Making the contact form usable without JavaScript, in both senses:
  - **Reachable.** The form lives in a modal that only JavaScript opens, so a no-JS visitor cannot reach it at all.
  - **A readable result.** On submit without JavaScript, `redirect=false` (`index.html:479`) ends the visitor on a raw JSON page (frontend-audit §1).

  Moved to sprint 2 at Gate 1 (PRD Q-13, "Move to sprint 2 (Recommended)"). Sprint 2 rebuilds the form as a native dialog, so reachability and the result page get solved once, together.

### 1.5 Constraints

_Fixed facts the solution must live within: regulatory, platform, timeline, data,
existing-system, organizational. Mark each `hard` or `soft`._

| ID | Constraint | Type | Source |
| --- | --- | --- | --- |
| C-1 | B1, B3, B4 and B5 ship as a separate hotfix PR ahead of this spec. Sprint 1 has no live-bug phase. | hard | Fred, grilling R1-Q3 |
| C-2 | The Renovate automerge pause ships in that hotfix, not in this spec. | hard | Fred, grilling R2-Q5, R3-Q2 |
| C-3 | None of the placeholder content changes in sprint 1: www.example.com, the 555 phone number, the Manhattan map, the `#` links, the empty service text, the joke testimonials and the two typos. | hard | Fred, grilling R1-Q4 |
| C-4 | Portfolio alt text and link names describe what each image shows. The nine `href="#"` detail links keep their `#` targets (C-3) but get descriptive names such as "<project> details". | hard | Fred, grilling R3-Q1; Gate 1, PRD Q-10 |
| C-5 | The copyright holder named in the README and the footer is Valhalla Tech. | hard | Fred, grilling R1-Q6 |
| C-6 | The GitHub repo description and README line 5 carry the same text: the README's current line 5, "Personal portfolio website for Fred Smith III, built as a static single-page application and deployed on Netlify." | hard | Fred, grilling R1-Q11; `README.md:5` |
| C-7 | The BootstrapMade template header comments at `style.css:1-6` and `main.js:2` are removed. | hard | Fred, grilling R2-Q1 |
| C-8 | Sprint 1 cannot count on CI running before it merges. Local runs gate it. | hard | Fred, grilling R1-Q8 |
| C-9 | All of report §5 (performance) and all of report §6 (security headers, dev-dependency advisories, `latest` devDependencies) are in sprint 1. | hard | Fred, grilling R1-Q9 |
| C-10 | Sprint 1 ends with the content security policy in report-only state. | hard | Fred, grilling R2-Q2 |
| C-11 | The page makes no requests to Google's font servers. | hard | Fred, grilling R2-Q3 |
| C-12 | Sprint 1 ends in a tagged release carrying version 4.0.0. | hard | Fred, grilling R1-Q12, R2-Q6 |
| C-13 | The new CHANGELOG backfills releases 1.0.0 to 3.0.0 from the GitHub release notes. | hard | Fred, grilling R2-Q7 |
| C-14 | The issue template is replaced by two YAML issue forms, one for bugs and one for features. | hard | Fred, grilling R1-Q10 |
| C-15 | The rendered-page check is a Playwright smoke test, and `@playwright/test` is approved as a new dev dependency. | hard | Feature request phase (e); Fred, grilling R1-Q7 |
| C-16 | This spec runs test-first: acceptance tests come before code. | hard | Fred, grilling R1-Q2 |
| C-17 | `@popperjs/core` stays. Bootstrap 5.3.8's ESM build imports it, so removing it breaks the build. | hard | frontend-audit §3 "Keep" row *(verified 2026-11-16 via unpkg `bootstrap@5.3.8`)*; report §7 |
| C-18 | The smoke test never sends a real Web3Forms submission. | hard | bootstrap6-analysis §6, "Network calls to Web3Forms must always be mocked" |
| C-19 | Phase (d) includes the site's own color variables, used directly in `style.css` and not mapped onto Bootstrap tokens. | hard | Feature request phase (d); report §7 Tooling; bootstrap6-analysis §5a ("Before" row for 2c/5c) |
| C-20 | Only the Documentation Agent creates or edits `README.md` and `CHANGELOG.md`. | hard | Org standard, `~/.claude/CLAUDE.md` "Agent ownership" |
| C-21 | Only the PR Agent creates or updates pull requests. | hard | Org standard, `~/.claude/CLAUDE.md` "Agent ownership" |
| C-22 | Everything written is US English: prose, code comments, commit messages and docs. | hard | Org standard, `~/.claude/CLAUDE.md` "Writing style" |
| C-23 | The site is built by Parcel 2.16.4 with Yarn 4.18.1 (`packageManager`) and served by Netlify at `fs3portfolio.netlify.app`. | hard | `package.json:38,41`; report "How this was checked" |
| C-24 | The repo is public and licensed GPL-3.0. | hard | `LICENSE`; frontend-audit §6 (`gh repo view`, 2026-11-16) |
| C-25 | Jest enforces an 80% threshold on branches, functions, lines and statements, measured on `src/js/utils.js` only. | hard | `jest.config.js:8-16` |
| C-26 | Each sprint ends with its own README and CHANGELOG work, so the docs never describe a state that does not exist yet. | hard | Report, Sprints section preamble |
| C-27 | The `Test & Build` required check is done once it is ready to enforce. Enforcement waits until billing is restored. | hard | Gate 1, PRD Q-1 ("Ready to enforce") |
| C-28 | Renovate automerge stays paused for every package through the end of sprint 1. | hard | Gate 1, PRD Q-2 ("Stay paused") |
| C-29 | The repo's SPDX license identifier is `GPL-3.0-only`. | hard | Gate 1, PRD Q-3 |
| C-30 | The frontend-audit §2 items that no sprint assigns (G-11l) are in sprint 1 as SHOULDs. | hard | Gate 1, PRD Q-4 ("Keep as SHOULD") |
| C-31 | Until sprint 3 replaces it, the hero typing effect stops after one cycle. | hard | Gate 1, PRD Q-5 ("Stop after one cycle") |
| C-32 | The smoke-test baseline asserts today's Bootstrap 5 behavior and passes on 4.0.0. Sprint 2 updates the assertions it changes on purpose. Sprint 1 captures no step-0 screenshots and no `dist/` sizes. | hard | Gate 1, PRD Q-7 ("Bootstrap 5, no screenshots") |
| C-33 | The PRD's thresholds are accepted: CLS ≤ 0.1; hero text ≥ 3:1 on the lightest pixel; font-display swap or optional; carousel bullets ≥ 24 px; social links and back-to-top ≥ 44 px; page weight at least 500 KB lighter. | hard | Gate 1, PRD Q-8 |
| C-34 | New dependencies are allowed. Each exact package is named in §3 with its reason and license, and Fred approves the list at Gate 2. | hard | Gate 1, PRD Q-9 |
| C-35 | The testimonial carousel does not autoplay under `prefers-reduced-motion: reduce`, starting in sprint 1. | hard | Gate 1, PRD Q-11 |
| C-36 | Once Isotope is replaced, the portfolio grid may take a new layout: "A justified-row or masonry look is acceptable if it fits the page." Filtering need not animate. | hard | Gate 1, Analyst Q-8 ("New layout is fine"; overrode "Same layout, animation optional") |
| C-37 | Under a reduced-motion preference, the portfolio filter's animation is switched off, starting in sprint 1. | hard | Gate 2, filter reduced-motion breakout ("Yes, in sprint 1 (Recommended)") |

### 1.6 Open questions

_Anything that would change the shape of the work. Mark `blocking` if the PRD cannot
be written without an answer._

| ID | Question | Blocking? | Owner |
| --- | --- | --- | --- |
| Q-1 | ~~If Actions is still locked when sprint 1 ends, is B2 done once `Test & Build` is ready to become required, or only once it is enforced?~~ **Resolved:** ready to enforce (C-27). | no | Fred — resolved at Gate 1, PRD Q-1 |
| Q-2 | ~~Does sprint 1 end with Renovate automerge still paused for every package, or restore it for non-Bootstrap packages?~~ **Resolved:** it stays paused (C-28). | no | Fred — resolved at Gate 1, PRD Q-2 |
| Q-3 | ~~Which SPDX identifier does the repo declare: `GPL-3.0-only` or `GPL-3.0-or-later`?~~ **Resolved:** `GPL-3.0-only` (C-29). | no | Fred — resolved at Gate 1, PRD Q-3 |
| Q-4 | ~~Are the frontend-audit §2 items that no sprint assigns in sprint 1?~~ **Resolved:** yes, as SHOULDs (C-30; G-11l). | no | Fred — resolved at Gate 1, PRD Q-4 |
| Q-5 | ~~Should sprint 1 give the hero typing loop's 2.2.2 failure interim handling?~~ **Resolved:** it stops after one cycle (C-31; G-11m). | no | Fred — resolved at Gate 1, PRD Q-5 |
| Q-6 | ~~Should any NG-10 finding come into sprint 1?~~ **Resolved:** the Swiper loop warning, the no-JS raw-JSON path, the COOP header and the Isotope replacement all come in (G-20, G-21, G-14, G-22). The no-JS path later moved to sprint 2 (PRD Q-13; NG-11). | no | Fred — resolved at Gate 1, PRD Q-6 |
| Q-7 | ~~Does the smoke baseline assert Bootstrap 5 or Bootstrap 6 behavior, and does it include step-0 screenshots and `dist/` sizes?~~ **Resolved:** Bootstrap 5, with no screenshots or sizes (C-32). | no | Fred — resolved at Gate 1, PRD Q-7 |
| Q-8 | ~~Once Isotope is gone (G-22), must the portfolio grid keep its current look, and must filtering animate?~~ **Resolved:** a new layout is fine (justified rows or masonry, if it fits the page), and filtering need not animate (C-36). | no | Fred — resolved at Gate 1, Analyst Q-8 |

### 1.7 Assumptions

_What is being taken as true in the absence of an answer, and what breaks if it's wrong._

- **A-1** — The hotfix (B1, B3, B4, B5 and the automerge pause) has merged to `main` before sprint 1 work starts. Basis: C-1, C-2. → If false, `main` fails `yarn install --immutable`, so no local gate run can pass (G-1). The smoke baseline would also record a broken lightbox and a page whose setup stops on a bad URL hash.
- **A-2** — After the hotfix, production deploys of `main` succeed and the live site reflects `main`. The report could not confirm this without Netlify access (report §1 B1). → If false, 4.0.0 is tagged while the live site is stale, and every goal checked "on the live site" (G-12, G-13, G-14) cannot be verified.
- **A-3** — A local run on Fred's machine is a faithful stand-in for the Linux CI checks. Basis: C-8. Known divergences on the Windows host: CRLF makes lint fail locally but pass on Linux (report, "How this was checked"), and Corepack is absent from the local PATH on Node 26 (docs-audit §8). A Linux environment is also available on the same machine: Docker Desktop is running (`docker version` server 29.9.3, looked up at Gate 1). So a Linux run of the checks is feasible locally, and the stand-in need not depend on the Windows host alone. → If false, sprint 1 either blocks on false failures or merges code that fails `Test & Build` the day Actions returns and the check is enforced (G-2, C-27).
- **A-4** — The Actions billing lock lasts the whole sprint. Basis: C-8. → If false, the local-evidence requirement is extra work but harmless, and G-2 can be met in full inside the sprint.
- **A-5** — *Resolved at Gate 1, PRD Q-1. Now C-27.*
- **A-6** — *Resolved at Gate 1, PRD Q-2. Now C-28.*
- **A-7** — No page copy changes beyond C-4 to C-7, not only the placeholder items C-3 lists. Basis: R1-Q4 as read by the `/spec` orchestrator ("no content changes at all, typos included"). → If false, other copy, such as the About text or "Coding Ninja" (frontend-audit §1, Low), could be in scope, and the PRD under-scopes it.
- **A-8** — *Resolved at Gate 1, PRD Q-4. Now C-30 and G-11l.*
- **A-9** — *Resolved at Gate 1, PRD Q-7. Now C-32.*
- **A-10** — The alt text and link names that C-4 requires can be written by looking at each image, without input from Fred. → If false, the work waits on Fred to describe every portfolio image (9) and any other images in scope.
- **A-11** — Changing the visible accent, success, error and other colors to meet the contrast goal (G-11f) is a design change Fred accepts, not "content" under C-3. → If false, G-11f cannot be met without a separate design sign-off.
- **A-12** — The page keeps its current font families and icon appearance after the Google font requests and the icon webfonts are removed (G-12b, G-12c). → If false, sprint 1 ships a visible design change that nobody decided.
- **A-13** — Phase (f) covers every row of docs-audit §2 (R1–R22, C1–C3, T1), not only rows that sprint 1's code changes touch. R23 contributes only two things: the SPDX identifier `GPL-3.0-only` (C-29) and the copyright holder Valhalla Tech (C-5). R23's Thanks section, template credit and footer-credit restoration are excluded (NG-7). Basis: grilling decisions R1-Q6, R1-Q10 and R1-Q11, and Gate 1, PRD Q-3, already settle rows R23, T1 and R19. → If false, the PRD over-scopes the docs work, and some drift (R15 URL, R16 badge, R21 link) ships under 4.0.0.
- **A-14** — The GitHub release notes for 1.0.0 through 3.0.0 hold enough detail to backfill CHANGELOG entries (C-13). → If false, some entries must be rebuilt from git history, or they ship thin.
- **A-15** — The dev advisories, including the critical `tar` advisory via `node-gyp`, can reach 0 critical and 0 high by moving to fixed versions without replacing Parcel, Jest or ESLint (G-15; Fred, grilling R2-Q4). → If false, meeting G-15 means swapping a build or test tool, or waiting for an upstream fix, and the goal may not be reachable inside the sprint.
- **A-16** — If no current Netlify badge can be obtained for site `fs3portfolio`, the README carries no badge rather than a broken one (docs-audit R16 fallback). → If false, G-17 needs Netlify dashboard access that the review did not have.
- **A-17** — *Resolved at Gate 1, Analyst Q-8. Now C-36.* What remains assumed: "fits the page" (C-36) means the G-22 conditions. No horizontal scrolling at any width, no change to any other section's layout or behavior, and the same items per filter. → If false, Fred has a stricter visual bar in mind, and the PRD's G-22 criteria accept a layout he would reject. The smoke baseline (C-32) records whichever layout ships, so it cannot catch that.

### 1.8 Grilling record
_Written by the Analyst, verbatim from /spec Stage 0. Decision IDs are cited as sources elsewhere in the spec._

| ID | Question | Answer | Recommendation |
|---|---|---|---|
| R1-Q1 | Use `stabilize-and-cleanup` as the spec slug (file `specs/stabilize-and-cleanup.md`)? | stabilize-and-cleanup (Recommended) | took |
| R1-Q2 | Run this spec test-first (acceptance tests before code)? | Yes — acceptance-first pilot | overrode |
| R1-Q3 | The 4 live production bugs (B1 lockfile, B3 lightbox 404s, B4 cached 404s, B5 hash crash): ship them as a small hotfix PR before this spec, or keep them as phase (a)? | Hotfix first, drop (a) (Recommended) | took |
| R1-Q4 | How much of the placeholder content (example.com, 555 phone, Manhattan map, '#' links, empty service text, joke testimonials, 2 typos) goes in sprint 1? | None | overrode |
| R1-Q5 | Did you buy a BootstrapMade Pro or Premium license for the iPortfolio template (the free license requires their footer credit)? | It doesn't matter. This project is so far removed from what was provided with the template that this design is now all me. | none offered |
| R1-Q6 | Who is the copyright holder the README and footer should name? | Valhalla Tech | none offered |
| R1-Q7 | Approve `@playwright/test` as a new dev dependency for the smoke-test baseline? | Approve (Recommended) | took |
| R1-Q8 | GitHub Actions is billing-locked. Can sprint 1 count on CI running again before it merges? | No — local runs gate it (Recommended) | took |
| R1-Q9 | Report §5 (performance) and §6 (security headers, `latest` devDependencies) are in no sprint. How much goes in sprint 1? | All of §5 and §6 | overrode |
| R1-Q10 | Replace the issue template (customer %, sprint effort) with two YAML issue forms, bug and feature? | Yes, two forms (Recommended) | took |
| R1-Q11 | Which short description goes in both the GitHub repo description and README line 5? | README's text | none offered |
| R1-Q12 | Should sprint 1 end in a tagged release (package.json still says 2.0.0; latest tag is 3.0.0)? | Yes — tag a release (Recommended) | took |
| R2-Q1 | Since the design is now yours, should the BootstrapMade template header comments (style.css:1-6, main.js:2) be removed? Your call; this is not legal advice. | Remove both | none offered |
| R2-Q2 | What CSP state should sprint 1 end in? | Report-only (Recommended) | took |
| R2-Q3 | Is it acceptable for the page to load fonts from Google's servers? | No — no Google font requests (Recommended) | took |
| R2-Q4 | What dependency-audit result must sprint 1 reach? | 0 critical/high, all deps (Recommended) | took |
| R2-Q5 | While Actions is billing-locked, what stops a broken Renovate PR from merging? | Pause automerge now (Recommended) | took |
| R2-Q6 | What version should sprint 1's release carry? | 4.0.0 | overrode |
| R2-Q7 | Should the new CHANGELOG backfill releases 1.0.0 to 3.0.0 from the GitHub release notes? | Yes, backfill (Recommended) | took |
| R3-Q1 | Portfolio alt text and link names ('Portfolio item N', 'App 1') need real descriptions, but content is out of sprint 1. How should the accessibility fix handle them? | Describe what each image shows (Recommended) | took |
| R3-Q2 | You chose to pause Renovate automerge now. Should that pause ship in the hotfix PR, ahead of this spec? | Yes, in the hotfix (Recommended) | took |

#### Deferred to Technical Plan
_Solution-space questions raised during grilling and not asked. The Architect resolves each in §3 or raises it at Gate 2._
- D-1: Which Node LTS line (24 or 26) replaces 25.9.0 in `.nvmrc` and `netlify.toml`, and how Corepack is installed in CI, on Netlify and in the README steps.
- D-2: How fonts are self-hosted once Google Fonts requests are removed (source of the font files, which families and weights, how they are bundled).
- D-3: How the Font Awesome webfonts (~234 KB for ~25 icons) are replaced.
- D-4: How `hero-bg.jpg` and the other images get responsive and modern-format variants, intrinsic sizes and lazy loading, and how the profile photo is made square (crop vs CSS).
- D-5: Whether production keeps publishing source maps.
- D-6: The report-only CSP policy text, and whether violation reports go anywhere beyond the browser console.
- D-7: How dev-dependency advisories reach 0 critical/high, and which exact versions replace the five `latest` devDependency pins.
- D-8: The mechanism for the `Test & Build` required check once billing returns (branch protection vs the existing ruleset), and the Renovate `packageRules` entry for `bootstrap`.
- D-9: How the `sync-runtime-versions.yml` defect (B7) is fixed, whether PR #56 is merged or closed, and what happens to open Renovate PR #68.
- D-10: Which local commands stand in for CI while Actions is locked, and how their output is recorded on each PR.
- D-11: Playwright setup: browsers, viewport widths, how the site is served for the test, whether it is wired into `ci.yml`, and where baselines live.
- D-12: How `require('./utils')` becomes `import` in `main.js` without breaking Jest (GSAP step 1).
- D-13: How the scroll listener is throttled (passive + rAF vs IntersectionObserver).
- D-14: The testimonial carousel pause control: control design, pause on hover/focus, autoplay under reduced motion.
- D-15: How off-screen nav links leave the tab order below 1200 px (`inert` vs `visibility`).
- D-16 (added at Gate 1, PRD Q-6): Which library replaces Isotope for the portfolio filter and layout — candidates Fred named: Justified Gallery, Muuri, MiniMasonry.js, evaluated from their GitHub pages and Context7 docs — or whether none fits.
  - _Outcome (Gate 2):_ Muuri. The Architect recommended "No library", and Fred overrode it. See the Gate 2 record.

_Remark (Analyst): D-7's "five" is the verbatim Stage 0 wording. `package.json` has six `latest` devDependencies (`package.json:30-39`; see §1.1 group 5)._

#### Gate 1 record
_Fred's answers to the PRD's open questions, asked as breakouts at Gate 1 and relayed by the coordinator. They are cited elsewhere in §1 as "Gate 1, PRD Q-n"._

- PRD Q-1 (Analyst Q-1): the `Test & Build` required check is done once it is ready to enforce; enforcement waits for billing. → "Ready to enforce (Recommended)".
- PRD Q-2 (Analyst Q-2): Renovate automerge stays paused for every package through the end of sprint 1. → "Stay paused (Recommended)".
- PRD Q-3 (Analyst Q-3): SPDX identifier is `GPL-3.0-only`.
- PRD Q-4 (Analyst Q-4): keep the unassigned frontend-audit §2 items in sprint 1 as SHOULDs. → "Keep as SHOULD (Recommended)".
- PRD Q-5 (Analyst Q-5): the hero typing loop gets interim WCAG 2.2.2 handling in sprint 1: it stops after one cycle until sprint 3 replaces it. → "Stop after one cycle (Recommended)".
- PRD Q-6 (Analyst Q-6): from NG-10, bring into sprint 1: the COOP header, the Swiper loop warning, the no-JS contact form path ending on a raw JSON page, AND replacing Isotope. Fred on Isotope, verbatim: "Let's examine Justified Gallery, Muuri, and MiniMasonry.js as candidates to replace Isotope. We can refer to their Github pages and their Context7 docs."
- PRD Q-7 (Analyst Q-7): the smoke baseline asserts today's Bootstrap 5 behavior and passes on 4.0.0; sprint 2 updates the assertions it changes on purpose; no step-0 screenshots or dist/ sizes in sprint 1. → "Bootstrap 5, no screenshots (Recommended)".
- PRD Q-8: the PRD's thresholds are accepted (CLS ≤ 0.1, hero text ≥ 3:1 on the lightest pixel, font-display swap or optional, bullets ≥ 24 px, social/back-to-top ≥ 44 px, page weight ≥ 500 KB lighter).
- PRD Q-9: new dependencies are allowed; the Architect names each exact package with reason and license in §3, and Fred approves the list at Gate 2.
- PRD Q-10: descriptive names like "<project> details" on the nine `href="#"` links are accepted.
- PRD Q-11: the testimonial carousel stops autoplaying under `prefers-reduced-motion: reduce` in sprint 1. → "Yes (Recommended)".
- Analyst Q-8: "Once Isotope is replaced, what must the portfolio grid keep?" → "New layout is fine" — "A justified-row or masonry look is acceptable if it fits the page." (Recommended was "Same layout, animation optional"; Fred overrode it.)
- `php-email-form` class rename → "Leave for sprint 2 (Recommended)" — sprint 2 rebuilds the contact form markup for the Bootstrap 6 dialog.
- PRD Q-13: "the contact form can't be reached without JavaScript (it lives in a JS-only modal). What happens to the no-JS form item?" → "Move to sprint 2 (Recommended)" — sprint 2 rebuilds the form as a native dialog; reachability and the result page get solved once, together.
- PM readings → "Confirm both (Recommended)": (a) the `.validate` CSS rule stays until sprint 2 removes it together with its divs; (b) stopping the typing effect after one cycle also stops its blinking cursor (same WCAG 2.2.2 failure).
- Environment fact (looked up, not asked): Docker Desktop is running on Fred's machine (`docker version` server 29.9.3), so a Linux environment for local CI stand-in runs exists.

#### Gate 2 record
_Fred's Gate 2 answers that touch §1, relayed by the coordinator. Gate 2 answers that affect only §2 or §3 are not recorded here._

- D-16: "what replaces Isotope for the portfolio filter?" → "Muuri" (the Architect had recommended "No library"; Fred overrode it). Filtering will animate; C-36 allows that.
- "Should Muuri's filter animation switch off when the visitor prefers reduced motion, in sprint 1?" → "Yes, in sprint 1 (Recommended)".

---

## 2. PRD

<!-- OWNER: Product Manager. No other agent may edit this section. -->

**Status:** ✅ complete

### 2.1 Summary

_Two or three sentences: what gets built, for whom, and what changes for them._

Sprint 1 makes `main` trustworthy again. Every change passes a local gate that gives the same verdict on Windows as on Linux, the runtime moves to a supported Node line, and Renovate can no longer merge a Bootstrap prerelease on its own. The sprint also:
- strips the dead code and assets, and replaces Isotope
- fixes the version-independent WCAG 2.2 AA failures, including the endless typing and carousel motion
- cuts the page weight
- adds a report-only CSP and a COOP header
- clears the high and critical dev advisories

It ends with a Playwright smoke baseline that sprint 2 can trust, corrected docs, and a tagged 4.0.0 release.

Visitors who use a keyboard, a screen reader or a phone get a page they can operate and that loads faster. Fred gets a repo whose gate, docs and setup steps tell the truth.

### 2.2 Requirements

_Each requirement traces to a goal from §1.3. `MUST` / `SHOULD` / `MAY`._

Gate 1 resolved every earlier question, Q-13 included. Requirements that rest on a remaining §1.7 assumption say so. R-1 to R-69 keep their IDs from the first draft, and R-70 onward were added at Gate 1. Withdrawn requirements keep their rows and IDs so the IDs are never reused.

| ID | Requirement | Priority | Satisfies |
| --- | --- | --- | --- |
| R-1 | Each PR that implements this spec merges into `main` only after all six gate checks pass locally on the PR's head commit. The PR shows the result of each check for that commit. | MUST | G-1 |
| R-2 | The release commit passes all six gate checks on a fresh Windows clone made with `core.autocrlf=true`. | MUST | G-1, G-6 |
| R-3 | `main` carries a GitHub rule that requires the `Test & Build` check and is ready to enforce: the only step left is switching its enforcement on once billing returns (C-27). | MUST | G-2 |
| R-4 | The `Test & Build` job's steps succeed on the release commit in a Linux environment that has the declared Node line and no preinstalled Corepack. | MUST | G-2, G-4, G-6 |
| R-5 | Renovate never automerges a `bootstrap` prerelease update, whatever automerge setting other rules carry. | MUST | G-3 |
| R-6 | `.nvmrc`, `netlify.toml` and `ci.yml` declare one Node major line, and that line was in support on 2026-11-16. | MUST | G-4 |
| R-7 | The README Install steps, run as written in an environment with no Corepack and no global Yarn, produce a working install. | MUST | G-4 |
| R-8 | The runtime-sync workflow's update step exits 0 and changes nothing when no pin has drifted. | MUST | G-5 |
| R-9 | The runtime-sync workflow still updates every Node pin when the Node pin has drifted (regression guard for the R-8 fix). | SHOULD | G-5 |
| R-10 | At release, no two repo files declare different Node versions or different Yarn versions. | MUST | G-5 |
| R-11 | PRs #56 and #68 are not left open at release. | SHOULD | G-5 |
| R-12 | The format check covers `src/css`. | MUST | G-6 |
| R-13 | Every item in report §7's Remove table is gone (icofont files, unreferenced images, `boxicons`, `just-validate`, `observeSkills` and its tests), and a tracked-file search finds no reference to any of them. | MUST | G-7 |
| R-14 | The page has exactly one mobile-nav toggle. | MUST | G-7 |
| R-15 | The dead selectors in frontend-audit §5a are gone from `style.css`. The `.validate` rule is the exception: it stays with the `.validate` divs it styles, which NG-10 leaves for sprint 2. | MUST | G-7 |
| R-16 | The invalid and no-op declarations in frontend-audit §5b are removed or corrected. Breakpoint normalization is excluded (NG-2). | MUST | G-7 |
| R-17 | `@popperjs/core` remains a dependency (C-17). | MUST | G-7 |
| R-18 | The BootstrapMade template header comments and the "replaces X" history comments are gone from `src/` (C-7; docs-audit C1, C2). | MUST | G-17 |
| R-19 | Every color in `style.css` is declared exactly once, as a site custom property. | MUST | G-8 |
| R-20 | `style.css` does not map site colors onto Bootstrap `--bs-*` tokens (C-19, NG-3). | MUST | G-8 |
| R-21 | `main.js` loads `utils.js` through ES module `import`, like its other imports. | MUST | G-9 |
| R-22 | The Jest suite passes with coverage of `src/js/utils.js` at or above 80% on all four metrics. | MUST | G-9 |
| R-23 | The work done in response to scroll events does not grow with the number of scroll events. | MUST | G-10 |
| R-24 | The active-nav highlight and the back-to-top visibility (shown after 100 px) behave as they do today. | MUST | G-10 |
| R-25 | Every portfolio filter can be reached and operated from the keyboard, and the selected filter is exposed to assistive tech. | MUST | G-11 (a) |
| R-26 | The mobile nav toggle, the four social links and back-to-top each have an accessible name, and the toggle exposes its open state. | MUST | G-11 (b) |
| R-27 | Every focusable control shows a focus indicator, the nav toggle included. | MUST | G-11 (c) |
| R-28 | Portfolio action links are visible whenever they have keyboard focus, and are visible on touch devices without hover. | MUST | G-11 (d) |
| R-29 | A visitor can pause the testimonial carousel's automatic rotation. | MUST | G-11 (e) |
| R-30 | Every text pair in frontend-audit §2c meets its WCAG minimum: 4.5:1 for normal text and 3:1 for large text. Every listed UI component meets 3:1. The hero text is measured on the lightest pixel behind it (C-33). | MUST | G-11 (f) |
| R-31 | The page has exactly one `<h1>`, and heading levels outside the contact dialog do not skip. | MUST | G-11 (g) |
| R-32 | A skip link moves keyboard users past the header and nav to the main content. | MUST | G-11 (h) |
| R-33 | Below 1200 px, links in the closed off-screen nav are out of the tab order. | MUST | G-11 (i) |
| R-34 | Decorative icons are hidden from the accessibility tree, and the nav link for the current section is exposed as current. | MUST | G-11 (j) |
| R-35 | Portfolio image alt text describes what each image shows, and every lightbox and detail link has a distinct name (C-4). | MUST | G-11 (k) |
| R-36 | Carousel pagination bullets have accessible names and a target size of at least 24 × 24 px (C-30, C-33). | SHOULD | G-11 (l) |
| R-37 | The social links and back-to-top have targets of at least 44 × 44 px (C-30, C-33). | SHOULD | G-11 (l) |
| R-38 | On short viewports at ≥ 1200 px, the fixed footer does not cover a focused nav link (C-30). | SHOULD | G-11 (l) |
| R-39 | `#hero` sits inside `<main>`, and the primary `<nav>` has an accessible name (C-30). | SHOULD | G-11 (l) |
| R-40 | Testimonial photos and the About photo do not repeat alt text already given nearby (C-30). | SHOULD | G-11 (l) |
| R-41 | The contact form exposes a busy state while a submission is in flight (C-30). | SHOULD | G-11 (l) |
| R-42 | A phone-width visitor is never sent the 3840 px-wide hero image. | MUST | G-12 (a) |
| R-43 | The page makes no request to Google's font servers (C-11). | MUST | G-12 (b) |
| R-44 | Text is never invisible while web fonts load. | MUST | G-12 (b) |
| R-45 | The page keeps its current text font families and its icons after the font and icon sources change. _(rests on A-12)_ | MUST | G-12 (b), G-12 (c) |
| R-46 | No icon webfont is shipped or requested. | MUST | G-12 (c) |
| R-47 | Every image declares its dimensions, and the page does not shift its layout while loading. | MUST | G-12 (d) |
| R-48 | Images below the first screen are deferred so they do not compete with it at load. | MUST | G-12 (d) |
| R-49 | The header profile photo renders as a circle. | MUST | G-12 (e) |
| R-50 | The source-map decision is recorded in §3, and the live site matches it. | MUST | G-12 (f) |
| R-51 | The live site sends a `Content-Security-Policy-Report-Only` header and no enforcing `Content-Security-Policy` header (C-10, NG-9). | MUST | G-13 |
| R-52 | A full page visit produces no CSP violation, the lightbox, the contact dialog and the map included. | MUST | G-13 |
| R-53 | `index.html` has no inline `style` attributes. | MUST | G-13 |
| R-54 | The live site does not send `X-XSS-Protection`, and does send `Permissions-Policy`. | MUST | G-14 |
| R-55 | `yarn npm audit` reports 0 critical and 0 high advisories across production and dev dependencies, transitive ones included. | MUST | G-15 |
| R-56 | No entry in `package.json` `devDependencies` uses the `latest` tag. There are six today (`package.json:30-39`). | MUST | G-15 |
| R-57 | A Playwright smoke suite (C-15) covers every behavior named in bootstrap6-analysis §6's table, asserted as it behaves on Bootstrap 5 at 4.0.0, with the portfolio layout that ships. It passes on the release commit (C-32). | MUST | G-16 |
| R-58 | The smoke suite can never deliver a real Web3Forms submission (C-18). | MUST | G-16 |
| R-59 | The smoke suite fails when an unintended breakpoint or dialog change is introduced. | MUST | G-16 |
| R-60 | Every URL in the README resolves, and no README image renders broken. | MUST | G-17 |
| R-61 | No version stated in the README contradicts the repo's files. | MUST | G-17 |
| R-62 | The README claims no feature, library or guarantee that does not exist. That includes a claim that CI blocks merges, which is false while enforcement waits for billing (C-27). | MUST | G-17 |
| R-63 | The GitHub repo description and README line 5 both carry the C-6 text exactly. | MUST | G-17 |
| R-64 | The README and the footer both name Valhalla Tech as copyright holder (C-5). | MUST | G-17 |
| R-65 | The remaining docs-audit §2 rows read true: R4, R7, R11, R12, R20, R21, R22, and the SPDX part of R23. The README and `package.json` declare `GPL-3.0-only` (C-29). | MUST | G-17 |
| R-66 | The README documents how to run the smoke suite (C-26). | SHOULD | G-17 |
| R-67 | Tag `4.0.0` exists on a commit whose `package.json` `version` is `4.0.0`. | MUST | G-18 |
| R-68 | `CHANGELOG.md` has a dated entry for every release from 1.0.0 through 4.0.0. | MUST | G-18 |
| R-69 | Issue intake offers exactly a bug form and a feature form, and neither asks about customers, sprint effort, timing or the internal/customer source (C-14). | MUST | G-19 |
| R-70 | At release, Renovate automerge is still paused for every package (C-28). | MUST | G-3 |
| R-71 | Under `prefers-reduced-motion: reduce`, the testimonial carousel never rotates on its own (C-35). | MUST | G-11 (e) |
| R-72 | The hero typing effect shows each of its four phrases once, in order, and then stops. Its text and its cursor both stop changing (C-31). Nothing else about the effect changes (NG-5). | MUST | G-11 (m) |
| R-73 | The live site sends `Cross-Origin-Opener-Policy` with a protective value, not `unsafe-none`. | MUST | G-14 |
| R-74 | The testimonial carousel logs no loop warning at any viewport width. | MUST | G-20 |
| R-75 | _Withdrawn at Gate 1 (Q-13)._ It required a no-JS contact-form submission to end on a readable page. G-21 is withdrawn, and the item moved to sprint 2 (NG-11). | — | — |
| R-76 | Isotope is gone: no dependency, no import and no reference in tracked files. | MUST | G-22 |
| R-77 | Each portfolio filter shows exactly the items it shows today. | MUST | G-22 |
| R-78 | The lightbox opens from every visible portfolio item. | MUST | G-22 |
| R-79 | The portfolio grid fits the page at every width. It causes no horizontal scrolling, stays inside its own section, and leaves every other section's layout and behavior unchanged. | MUST | G-22 |
| R-80 | Fred reviews the portfolio layout that ships and accepts it as fitting the page (C-36; guards against the A-17 risk). | SHOULD | G-22 |
| R-81 | Under `prefers-reduced-motion: reduce`, a portfolio filter change shows the final item set at once, with no animation (C-37). | MUST | G-22 |

### 2.3 Acceptance criteria

_Ground truth for evaluating execution agents. Every AC is written to be assertable._

#### Conventions used by every AC below

- **Local target:** the `dist/` that `yarn build` produces at the commit under test, served over HTTP on `localhost`. §3 picks the server.
- **Live target:** `https://fs3portfolio.netlify.app/`, after the commit under test has been deployed (A-2).
- **Both targets:** the AC must pass against the local target and again against the live target.
- **Viewports:**
  - `desktop` is 1440 × 900.
  - `tablet` is 1000 × 800.
  - `small` is 375 × 812.
  - `phone` is Playwright's `iPhone 13` device descriptor: 390 × 844, DPR 3, `hasTouch`, `isMobile`.
  - Any other size is stated in the AC.
- **Full visit**, in this order:
  1. Load `/` at `desktop` and wait for `load`.
  2. Scroll to the bottom in 400 px steps, 100 ms apart.
  3. Activate the `App` filter, then `All`.
  4. Open the lightbox from the first visible portfolio item, wait until its image has loaded, and press Escape.
  5. Activate `.contact-modal-btn`, wait until the dialog is shown, and press Escape.
  6. Wait for 2 s of network idle, which includes the map iframe.
- **Tab walk:** starting from a fresh load with focus on `body`, press Tab until focus returns to the first element focused, or 120 presses, whichever comes first. Focus inside the cross-origin map iframe is skipped.
- **Tracked-file search:** run `git ls-files -z -- . ':!specs/' ':!update-report-2026-11-16/' ':!CHANGELOG.md' | xargs -0 rg -n -i -e '<pattern>'` from the repo root. "0 matches" means `rg` prints nothing and exits 1. The three excluded paths quote removed items on purpose: this spec, the source report, and the changelog's "Removed" entries.

  **Precondition:** `specs/stabilize-and-cleanup.md` and `update-report-2026-11-16/` are tracked. PR-1 commits both, as Fred decided at Gate 2 ("Commit both"). The exclusions above, and AC-79's reading of this spec "at the release commit", rely on that. If either path were untracked, the search would still be correct, because untracked files are never searched, but AC-79 could not run.
- **Gate:** these six commands, run in order:
  1. `yarn install --immutable`
  2. `yarn lint`
  3. `yarn format:check`
  4. `yarn test:ci`
  5. `yarn build`
  6. The smoke command.
- **Smoke command:** the `package.json` script that §3 names for the G-16 suite.
- **Release commit:** the commit tagged `4.0.0`.
- **Selectors and roles:** an AC that names today's class or id (for example `.portfolio-item`, `.portfolio-wrap`, `.portfolio-links`, `.mobile-nav-toggle`) means the element that plays that role. If §3 changes the markup, for example when it replaces Isotope, §3 names the replacement selector and the AC follows the role.
- **Portfolio item identity:** "item N" (1–9) is the Nth portfolio item in today's `src/index.html` source order. Today's filters show:
  - All: {1–9}
  - App: {1, 3, 6}
  - Card: {4, 7, 8}
  - Web: {2, 5, 9}

  The test identifies each item by its image's source base name `portfolio-N`, or by a stable hook that §3 provides.
- **Linux environment:** a container from the official `node:<declared major>` image under the Docker Desktop on Fred's machine (A-3).
- **Effective background:** the first ancestor-or-self with a non-transparent `background-color`, alpha-composited onto white.
- **Contrast:** the WCAG 2.x relative-luminance ratio.
- **`lint`** in `Executable as` means a static check of repository or build files (`rg`, `yq`, or a parse of HTML/CSS/YAML). It does not mean only ESLint.
- **GitHub reads:** `gh api` and `gh pr`/`gh repo`/`gh release` reads run locally and do not need GitHub Actions (C-8). Where a check exists only on GitHub's side, the AC says so.
- **Test-first:** every AC not marked `e2e` or `manual` sits below the browser, so it is a §3.4 stub → failing test → implementation chain (header `Test-first: acceptance`).

#### AC-1 — The release commit passes the gate on a fresh Windows clone

- **Verifies:** R-2, R-57, and two regression clauses through the smoke suite: G-7's "page behaves as it did" for R-13 to R-16, and G-22's "no other section's layout or behavior changes" for R-79
- **Given** a Windows machine with `git config --global core.autocrlf true` set before cloning, the declared Node line on PATH, and a fresh clone of `origin` checked out at the release commit
- **When** the six gate commands run in order from the repo root
- **Then** every command exits 0
- **Assertion:** the exit codes are `[0, 0, 0, 0, 0, 0]` for `yarn install --immutable`, `yarn lint`, `yarn format:check`, `yarn test:ci`, `yarn build` and the smoke command
- **Executable as:** `build`

#### AC-2 — Each sprint-1 PR carries gate evidence for its head commit

- **Verifies:** R-1
- **Given** the set of PRs merged into `main` whose body contains `stabilize-and-cleanup`: `gh pr list --state merged --search "stabilize-and-cleanup in:body" --json number,headRefOid`
- **When** each PR's body and comments are read: `gh pr view <n> --json body,comments`
- **Then** for every such PR, the text records the PR's `headRefOid` and an exit code of 0 against that SHA for each of the six gate commands
- **Assertion:** for each PR, the body and comments contain `headRefOid`, and contain six results naming `yarn install --immutable`, `yarn lint`, `yarn format:check`, `yarn test:ci`, `yarn build` and the smoke command, each with exit code `0`. §3 fixes the exact record format (D-10).
- **Executable as:** `integration`

#### AC-3 — A rule requiring `Test & Build` exists for `main`

- **Verifies:** R-3
- **Given** the repository `ValhallaTech/PortfolioPage-FS3` on GitHub
- **When** its rulesets are listed and each one is read: `gh api repos/ValhallaTech/PortfolioPage-FS3/rulesets`, then `gh api repos/ValhallaTech/PortfolioPage-FS3/rulesets/<id>`
- **Then** a dedicated ruleset for the required check exists alongside the existing "General Ruleset", which is unchanged. The new ruleset is ready to enforce, so turning enforcement on is the only change still needed (C-27).
- **Assertion:**
  - **Exactly one** ruleset satisfies both conditions:
    - It targets `main`: `.conditions.ref_name.include` contains `~DEFAULT_BRANCH` or `refs/heads/main`.
    - It requires `Test & Build`: `yq -p=json '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'` includes `Test & Build`.
    - Other rulesets may also target `main`. This count is of rulesets that meet both conditions.
  - That ruleset's `.enforcement` is `disabled` while Actions is billing-locked. It becomes `active` only once Actions runs again.
  - That ruleset is not the General Ruleset (ruleset `15072163`, docs-audit R14).
  - The General Ruleset is unchanged. Its `.enforcement` and the sorted list of its `.rules[].type` values (pull request, CodeQL code scanning and code quality) equal a snapshot taken before sprint 1 work began. It has no `required_status_checks` rule.
  - The snapshot comes from `gh api repos/ValhallaTech/PortfolioPage-FS3/rulesets/15072163` and is recorded in the first sprint-1 PR. Comparing the rule *types*, rather than every parameter, keeps the check stable if GitHub adds fields.
- **Executable as:** `integration`. The setting lives only on GitHub, but it reads locally via `gh`. Proving that a red PR is actually blocked needs Actions running and enforcement on, which waits for billing (C-27). That proof is outside sprint 1.

#### AC-4 — `Test & Build` steps pass on Linux without a preinstalled Corepack

- **Verifies:** R-4
- **Given** the Linux environment (a `node:<declared major>` container under Docker Desktop) where `command -v corepack` fails before any step runs, holding a fresh clone at the release commit
- **When** each `run:` value of `jobs.test.steps` in `.github/workflows/ci.yml` (`yq '.jobs.test.steps[].run' .github/workflows/ci.yml`) is executed in order in `bash`
- **Then** every step exits 0
- **Assertion:** the exit code of each `run:` step is 0. This is the local stand-in for GitHub's `Test & Build` until Actions returns.
- **Executable as:** `integration`

#### AC-5 — `renovate.json` passes Renovate's validator

- **Verifies:** R-5
- **Given** `renovate.json` at the release commit
- **When** `npx --yes --package renovate -- renovate-config-validator --strict renovate.json` runs. This uses `npx` and adds no repo dependency.
- **Then** the validator accepts the file
- **Assertion:** exit code 0
- **Executable as:** `lint`

#### AC-6 — A Bootstrap prerelease update resolves to `automerge: false` even when everything else automerges

- **Verifies:** R-5
- **Given** a variant of the release `renovate.json` in which every `packageRules` entry that does not name `bootstrap` sets `automerge: true` (this simulates automerge being restored), and a fixture `package.json` that pins `"bootstrap": "6.0.0-alpha.1"`
- **When** Renovate resolves the update config for `bootstrap` from `6.0.0-alpha.1` to a later prerelease (`6.0.0-alpha.2`)
- **Then** the resolved branch config for that update has `automerge: false`
- **Assertion:** the resolved config entry for `bootstrap` reads `automerge == false`. Run it as `npx renovate --platform=local --dry-run=lookup` with `LOG_LEVEL=debug` once a newer prerelease exists on the registry, or with a harness §3 defines (see §2.6 Q-12).
- **Executable as:** `integration`

#### AC-7 — One Node major line is declared everywhere

- **Verifies:** R-6
- **Given** the release commit
- **When** the Node declarations are read:
  - `.nvmrc` line 1
  - every `NODE_VERSION` value in `netlify.toml`
  - the `actions/setup-node` step in `.github/workflows/ci.yml`, whether it uses `node-version-file` or `node-version`
- **Then** all three resolve to the same major version
- **Assertion:** `major(.nvmrc) == major(NODE_VERSION)`. The `ci.yml` setup-node step has `node-version-file: .nvmrc`, or a `node-version` with the same major.
- **Executable as:** `lint`

#### AC-8 — The declared Node line was in support on 2026-11-16

- **Verifies:** R-6
- **Given** the major `M` from AC-7
- **When** `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json` is fetched
- **Then** entry `vM` was in its support window on 2026-11-16
- **Assertion:** `yq -p=json '.["vM"].start'` ≤ `2026-11-16` < `yq -p=json '.["vM"].end'`
- **Executable as:** `integration`

#### AC-9 — The README Install steps work without Corepack or a global Yarn

- **Verifies:** R-7
- **Given** an environment where:
  - the declared Node line is on PATH
  - `command -v corepack` and `command -v yarn` both fail. For example, a fresh `node:<major>` container after `npm uninstall -g corepack yarn` and removal of any Yarn 1 link the image itself provides (npm does not remove those), or a Windows profile in the same state.
  - a fresh clone of the release commit is the working directory
- **When** the commands in the README's Install section code block(s) are run in order. Only version-manager switch lines (`nvm use`, `fnm use`) are skipped, because the environment already satisfies them.
- **Then** the install succeeds with the pinned Yarn
- **Assertion:** every command exits 0, and `yarn --version` prints the version after `yarn@` in `package.json` `packageManager`
- **Executable as:** `integration`

#### AC-10 — The runtime-sync update step exits cleanly when nothing has drifted

- **Verifies:** R-8
- **Given** a clean checkout of the release commit and the script that the `Update pinned Node and Yarn versions` step of `.github/workflows/sync-runtime-versions.yml` runs. Its two registry lookups are stubbed: the latest Yarn 4 equals the `packageManager` version, and the latest Node for the `.nvmrc` major equals `.nvmrc`.
- **When** the script runs locally on the declared Node line
- **Then** it exits 0 and leaves the working tree unchanged
- **Assertion:** the exit code is 0, and `git status --porcelain` prints nothing
- **Executable as:** `integration`

#### AC-11 — The runtime-sync update step still propagates a Node drift

- **Verifies:** R-9
- **Given** the AC-10 setup, except that `.nvmrc` and every `NODE_VERSION` in `netlify.toml` are set to `M.0.0`, and the stubbed Node index lists `M.1.0` as the latest `M.x` release
- **When** the script runs
- **Then** both pins read `M.1.0`
- **Assertion:** the exit code is 0, `.nvmrc` line 1 is `M.1.0`, and `netlify.toml` contains `NODE_VERSION = "M.1.0"`
- **Executable as:** `integration`

#### AC-12 — No two files disagree on Node or Yarn versions

- **Verifies:** R-10
- **Given** the release commit
- **When** the version declarations are read:
  - `.nvmrc` line 1
  - every `NODE_VERSION` and `YARN_VERSION` in `netlify.toml`
  - the version after `yarn@` in `package.json` `packageManager`
- **Then** no Node declaration differs from another, and no Yarn declaration differs from another. A file that omits a key is not a conflict.
- **Assertion:** the set of Node values has size 1, and the set of Yarn values has size ≤ 1
- **Executable as:** `lint`

#### AC-13 — PRs #56 and #68 are closed out

- **Verifies:** R-11
- **Given** the date the `4.0.0` tag is pushed
- **When** `gh pr view 56 --json state` and `gh pr view 68 --json state` run
- **Then** neither PR is open
- **Assertion:** each `.state` is `MERGED` or `CLOSED`
- **Executable as:** `integration`

#### AC-14 — The format check covers `src/css`

- **Verifies:** R-12
- **Given** a scratch copy of the release commit's working tree, with the line `a{color:red}` appended to `src/css/style.css`
- **When** `yarn format:check` runs in the copy
- **Then** the check fails on that file
- **Assertion:** the exit code is non-zero, and the output names `src/css/style.css`. AC-1 already shows that the unmodified tree exits 0.
- **Executable as:** `integration`

#### AC-15 — Icofont is gone

- **Verifies:** R-13
- **Given** the release commit
- **When** `git ls-files 'src/css/icofont*'` runs, followed by a tracked-file search for `icofont`
- **Then** no tracked file is, or mentions, icofont. This includes the `.prettierignore:7` line.
- **Assertion:** `git ls-files` prints nothing, and the search returns 0 matches
- **Executable as:** `lint`

#### AC-16 — The unreferenced images are gone

- **Verifies:** R-13
- **Given** the release commit
- **When** `git ls-files 'src/images/portfolio-details-*' 'src/images/testimonials/testimonials-*'` runs, followed by a tracked-file search for `portfolio-details-[0-9]|testimonials-[0-9]`
- **Then** none of the 8 files is tracked or referenced
- **Assertion:** `git ls-files` prints nothing, and the search returns 0 matches
- **Executable as:** `lint`

#### AC-17 — `boxicons` and `just-validate` are gone

- **Verifies:** R-13
- **Given** the release commit
- **When** a tracked-file search for `boxicons|just-validate|justvalidate` runs. This covers `package.json`, `yarn.lock` and `README.md`.
- **Then** neither package is declared, locked or mentioned
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-18 — `observeSkills` and its tests are gone

- **Verifies:** R-13
- **Given** the release commit
- **When** a tracked-file search for `observeSkills|skills-content|progress-bar` runs
- **Then** no source, test, CSS or doc references the dead skills code
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-19 — There is exactly one mobile-nav toggle

- **Verifies:** R-14
- **Given** `src/index.html` at the release commit
- **When** the elements whose `class` contains `mobile-nav-toggle` are counted (static parse)
- **Then** there is exactly one
- **Assertion:** count == 1
- **Executable as:** `lint`

#### AC-20 — The frontend-audit §5a dead selectors are gone

- **Verifies:** R-15
- **Given** `src/css/style.css` at the release commit
- **When** this command runs: `rg -n -e '\.facts\b' -e '\.skills\b' -e '\.resume\b' -e '\.breadcrumbs\b' -e '\.portfolio-details\b' -e '\.loading\b' -e 'animate-loading' -e '\.info\s+\.social-links' -e 'br\s*\+\s*br' -e '#hero\s+h2' src/css/style.css`
- **Then** none of the dead blocks remain. `.validate` is not in the list, because it stays with its divs until sprint 2 (NG-10).
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-21 — _Withdrawn at Gate 1_

- **Status:** withdrawn. It asserted that the `.validate` divs were removed. The revised NG-10 leaves those divs for sprint 2 (bootstrap6-analysis §6 step 4). The ID is kept so it is not reused.

#### AC-22 — The overridden contact-form base box is collapsed

- **Verifies:** R-15
- **Given** `src/css/style.css` at the release commit
- **When** rule blocks whose whole selector is `.php-email-form` or `#contactModal .php-email-form` are counted (regex `^\s*(#contactModal\s+)?\.php-email-form\s*(\{|$)`, multiline)
- **Then** at most one such rule exists (frontend-audit §5a, rows 970-983)
- **Assertion:** count ≤ 1
- **Executable as:** `lint`

#### AC-23 — The frontend-audit §5b invalid and no-op declarations are gone

- **Verifies:** R-16
- **Given** `src/css/style.css` at the release commit, parsed into rule blocks
- **When** each check below runs
- **Then** every check finds 0 violations

  | Check | Source row |
  | --- | --- |
  | `rg -n 'padding-right:\s*20px\s+15px'` | §5b line 1339 |
  | `rg -n 'transition:\s*display'` | §5b line 52 |
  | `rg -n -e '-moz-text-align-last'` | §5b line 101 |
  | `rg -n '@-webkit-keyframes'` | §5b line 1112 |
  | No rule block declares the same property twice | §5b lines 85-86 and 601-602 |
  | No rule on a portfolio-filter `:last-child` selector declares only `margin-right: 0` | §5b lines 626-629 |
  | No `:hover`/`:focus-within` rule for `.portfolio-links` declares `opacity` | §5b line 659 vs 697 |
  | No `:hover`/`:focus-within` rule for `.portfolio-wrap::before` declares `top`, `right`, `bottom` or `left` | §5b lines 686-693 |

- **Assertion:** total violations == 0
- **Executable as:** `lint`

#### AC-24 — The corrected footer padding applies below 1200 px

- **Verifies:** R-16. This is the one §5b fix that changes rendering on purpose.
- **Given** the local target at `small`
- **When** the computed style of `#footer` is read
- **Then** it has the padding the invalid declaration intended
- **Assertion:** `getComputedStyle(#footer).paddingTop === "20px"` and `paddingLeft === "15px"`
- **Executable as:** `e2e`

#### AC-25 — `@popperjs/core` remains

- **Verifies:** R-17
- **Given** `package.json` at the release commit
- **When** `yq -p=json '.dependencies["@popperjs/core"]' package.json` runs
- **Then** the dependency is still declared
- **Assertion:** the output is not `null`
- **Executable as:** `lint`

#### AC-26 — Template and history comments are gone

- **Verifies:** R-18
- **Given** the release commit
- **When** this command runs: `rg -n -i -e 'Template Name' -e 'BootstrapMade' -e 'iPortfolio' -e 'replaces (AOS|waypoints|venobox|owl)' -e 'Overhauled' src`
- **Then** no template credit or history comment remains in `src/` (C-7; docs-audit C1, C2)
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-27 — Color literals appear only in the `:root` custom-property block

- **Verifies:** R-19
- **Given** `src/css/style.css` at the release commit, parsed into rule blocks
- **When** declarations outside the `:root` rule are scanned for color literals:
  - hex `#[0-9a-fA-F]{3,8}`
  - `rgb(`, `rgba(`, `hsl(` or `hsla(` with numeric arguments
  - any CSS named color other than `transparent`, `currentcolor` and `inherit`
- **Then** none are found, and every color outside `:root` is a `var(--…)` reference or derived from one
- **Assertion:** count of color literals outside `:root` == 0
- **Executable as:** `lint`

#### AC-28 — Each color value is declared only once

- **Verifies:** R-19
- **Given** the `:root` rule of `src/css/style.css` at the release commit
- **When** the color values of its custom properties are normalized to lowercase `rgba(r, g, b, a)`
- **Then** no value appears in two properties
- **Assertion:** the count of distinct normalized values equals the count of color custom properties
- **Executable as:** `lint`

#### AC-29 — No Bootstrap token mapping in `style.css`

- **Verifies:** R-20
- **Given** `src/css/style.css` at the release commit
- **When** `rg -n -e '--bs-[A-Za-z0-9-]+\s*:' src/css/style.css` runs
- **Then** no `--bs-*` property is declared
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-30 — `main.js` no longer uses `require()`

- **Verifies:** R-21
- **Given** `src/js` at the release commit
- **When** `rg -n 'require\(' src/js` runs
- **Then** `main.js` loads `utils.js` with the same module system as its other imports
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-31 — Jest passes with ≥ 80% coverage of `utils.js`

- **Verifies:** R-22
- **Given** the release commit with dependencies installed
- **When** `yarn test:ci --coverageReporters=json-summary` runs
- **Then** the suite passes, and the four `utils.js` metrics are each at or above 80
- **Assertion:** the exit code is 0. In `coverage/coverage-summary.json`, the entry whose key ends in `src/js/utils.js` has `lines.pct`, `branches.pct`, `functions.pct` and `statements.pct` each ≥ 80.
- **Executable as:** `unit`

#### AC-32 — Fifty scroll events cost no more work than one

- **Verifies:** R-23
- **Given** the local target at `desktop`, with a counter wrapping `Document.prototype.querySelectorAll` and `Element.prototype.querySelectorAll` installed by `addInitScript`, scrolled to y = 1200 and idle for 1 s
- **When**
  1. one `window.dispatchEvent(new Event('scroll'))` is issued, followed by two animation frames; the count is recorded as `c1` and the counter reset
  2. fifty such dispatches are issued in a single task, followed by two animation frames; the count is recorded as `c50`
- **Then** the work does not scale with the event count
- **Assertion:** `c50 <= c1`. Today `c50` is about `50 × c1` (gsap-analysis §1a J6).
- **Executable as:** `e2e`

#### AC-33 — The active-nav highlight still follows the section in view

- **Verifies:** R-24
- **Given** the local target at `desktop`
- **When** `document.querySelector('#services').scrollIntoView({ block: 'start' })` runs, followed by a 500 ms wait
- **Then** only the Services nav item is highlighted
- **Assertion:** `document.querySelectorAll('.nav-menu li.active')` has length 1, and its single element contains `a[href="#services"]`
- **Executable as:** `e2e`

#### AC-34 — Back-to-top visibility still switches at 100 px

- **Verifies:** R-24
- **Given** the local target at `desktop`
- **When** `window.scrollTo(0, 50)` runs and 500 ms pass, then `window.scrollTo(0, 150)` runs and 500 ms pass
- **Then** back-to-top is hidden at 50 and visible at 150
- **Assertion:** `.back-to-top` is hidden after the first scroll and visible after the second (Playwright `toBeHidden()`, then `toBeVisible()`)
- **Executable as:** `e2e`

#### AC-35 — The keyboard reaches all four filters as buttons

- **Verifies:** R-25
- **Given** the local target at `desktop`
- **When** a Tab walk runs
- **Then** it focuses four elements with role `button` whose accessible names are `All`, `App`, `Card` and `Web` (case-insensitive exact match)
- **Assertion:** the set of focused elements includes `getByRole('button', { name: /^all$/i })`, and the same for `app`, `card` and `web`
- **Executable as:** `e2e`

#### AC-36 — Enter on a filter applies it

- **Verifies:** R-25
- **Given** the local target at `desktop`, with the `App` filter button focused by keyboard
- **When** Enter is pressed and 1 s passes
- **Then** only the three App items are shown
- **Assertion:** the set of visible portfolio items is exactly {1, 3, 6} (see Conventions, "Portfolio item identity")
- **Executable as:** `e2e`

#### AC-37 — The selected filter is exposed as pressed

- **Verifies:** R-25
- **Given** the AC-36 state, after Enter on `App`
- **When** the `aria-pressed` attribute of the four filter buttons is read
- **Then** exactly `App` reports pressed
- **Assertion:** `App` has `aria-pressed="true"`, and `All`, `Card` and `Web` have `aria-pressed="false"`
- **Executable as:** `e2e`

#### AC-38 — The icon-only controls have accessible names

- **Verifies:** R-26
- **Given** the local target
- **When** the accessible name of each control below is computed
- **Then** each name matches its pattern, case-insensitive

  | Control | Viewport | Name must match |
  | --- | --- | --- |
  | `.mobile-nav-toggle` | `small` | `/navigation\|menu/` |
  | social link to `twitter.com` | `desktop` | `/\bx\b\|twitter/` |
  | social link to `facebook.com` | `desktop` | `/facebook/` |
  | social link to `instagram.com` | `desktop` | `/instagram/` |
  | social link to `linkedin.com` | `desktop` | `/linkedin/` |
  | `.back-to-top`, after `scrollTo(0, 150)` | `desktop` | `/top/` |

- **Assertion:** `expect(locator).toHaveAccessibleName(pattern)` passes for all six
- **Executable as:** `e2e`

#### AC-39 — The nav toggle reports open and closed

- **Verifies:** R-26
- **Given** the local target at `small`, nav closed
- **When** the toggle is clicked twice
- **Then** `aria-expanded` follows the nav state
- **Assertion:** `.mobile-nav-toggle` `aria-expanded` reads `"false"` before the clicks, `"true"` after the first and `"false"` after the second
- **Executable as:** `e2e`

#### AC-40 — The nav toggle shows a focus indicator

- **Verifies:** R-27
- **Given** the local target at `small`
- **When** Tab is pressed until `.mobile-nav-toggle` is focused
- **Then** a focus indicator is drawn (`style.css:225` removed it)
- **Assertion:** the toggle's computed `outline-style` is not `none` and its `outline-width` is ≥ `1px`, or its computed `box-shadow` is not `none`
- **Executable as:** `e2e`

#### AC-41 — Every Tab stop shows a focus indicator

- **Verifies:** R-27
- **Given** the local target at `desktop`, and again at `small` with the nav closed
- **When** a Tab walk runs
- **Then** every focused element draws a focus indicator
- **Assertion:** for each focused element, the computed `outline-style` is not `none` with `outline-width` ≥ `1px`, or the computed `box-shadow` is not `none`. Failing elements: 0.
- **Executable as:** `e2e`

#### AC-42 — A focused portfolio action link is visible

- **Verifies:** R-28
- **Given** the local target at `desktop`
- **When** Tab is pressed until the first `.portfolio-links a` is focused
- **Then** the link is fully visible inside its card
- **Assertion:** the focused link's bounding box lies inside its `.portfolio-wrap` bounding box, and the computed `opacity` of the link and of every ancestor is `1`
- **Executable as:** `e2e`

#### AC-43 — Portfolio action links are visible on touch without hover

- **Verifies:** R-28
- **Given** the local target at `phone`, with `matchMedia('(hover: none)').matches === true` as a precondition, and no hover or tap performed
- **When** the first visible `.portfolio-item` is scrolled into view
- **Then** both of its action links are visible
- **Assertion:** for each `.portfolio-links a` in that item, the bounding box lies inside its `.portfolio-wrap` box, and the computed `opacity` of the link and its ancestors is `1`
- **Executable as:** `e2e`

#### AC-44 — The pause control stops carousel rotation

- **Verifies:** R-29
- **Given**:
  - the local target at `small`, where one slide shows per view, so rotation is observable
  - no reduced-motion preference (`emulateMedia({ reducedMotion: 'no-preference' })`)
  - `#testimonials` scrolled into view
  - a sanity precondition: the `data-swiper-slide-index` of `.testimonials .swiper-slide-active` changes within 6 s with no interaction
- **When** focus moves by keyboard to the control inside `#testimonials` with role `button` and a name matching `/pause/i`, and Enter is pressed
- **Then** the active slide stops changing
- **Assertion:** the active slide's `data-swiper-slide-index` read at the moment of Enter equals the value read 11 s later, which spans two autoplay periods
- **Executable as:** `e2e`

#### AC-45 — The listed text and UI pairs meet contrast

- **Verifies:** R-30
- **Given** the local target at `desktop`, with each state below set up. Web3Forms is mocked as in AC-89.
- **When** each element's computed `color` is compared with its effective background
- **Then** every pair meets its threshold

  | # | Element and state | Threshold |
  | --- | --- | --- |
  | 1 | `.contact-modal-btn` text | 4.5 |
  | 2 | `#submit-btn` text, dialog open | 4.5 |
  | 3 | `.back-to-top` icon after `scrollTo(0, 150)` (graphical object) | 3.0 |
  | 4 | `#about a[href^="mailto:"]` | 4.5 |
  | 5 | `#contact a[href^="mailto:"]` | 4.5 |
  | 6 | filter button with `aria-pressed="true"` | 4.5 |
  | 7 | `.services .title a` while hovered | 4.5 |
  | 8 | `#sent-message` after a mocked `{ "success": true }` | 4.5 |
  | 9 | `#error-message` after a mocked `{ "success": false, "message": "x" }` | 4.5 |
  | 10 | testimonial role line (today `.testimonial-item h4`) | 4.5 |
  | 11 | inactive `.swiper-pagination-bullet` fill vs effective background (UI component) | 3.0 |

- **Assertion:** `contrast(color, effectiveBackground) >= threshold` for all 11 rows
- **Executable as:** `e2e`

#### AC-46 — Hero text meets contrast over the background image

- **Verifies:** R-30
- **Given** both targets, at `phone` and at `desktop`
- **When** `#hero` is screenshotted with `.hero-container` set to `visibility: hidden`, and the pixels inside the bounding boxes of `#hero h1` and `#hero p` are read on a canvas in the page, with no new dependency
- **Then** white text has at least 3:1 against the lightest pixel behind it. Both lines are large text: the `h1` is 64 px/700, and the `p` is 26 px.
- **Assertion:** `contrast(computed color of #hero h1, lightest pixel) >= 3.0`, and the same for `#hero p`
- **Executable as:** `e2e`

#### AC-47 — Exactly one `<h1>`

- **Verifies:** R-31
- **Given** `src/index.html` at the release commit
- **When** `h1` elements are counted (static parse)
- **Then** there is one
- **Assertion:** count == 1
- **Executable as:** `lint`

#### AC-48 — Heading levels do not skip outside the dialog

- **Verifies:** R-31
- **Given** `src/index.html` at the release commit
- **When** `h1`–`h6` elements outside `#contactModal` are listed in document order (static parse)
- **Then** the first heading is an `h1`, and no heading is more than one level deeper than the heading before it
- **Assertion:** `levels[0] == 1`, and for every `i > 0`, `levels[i] <= levels[i-1] + 1`
- **Executable as:** `lint`

#### AC-49 — The first Tab stop is a visible skip link

- **Verifies:** R-32
- **Given** the local target at `desktop`, freshly loaded
- **When** Tab is pressed once
- **Then** the focused element is a visible skip link
- **Assertion:** `document.activeElement` has role `link` and an accessible name matching `/skip/i`, and its bounding box has width > 0 and height > 0 and lies inside the viewport
- **Executable as:** `e2e`

#### AC-50 — The skip link lands in the main content

- **Verifies:** R-32
- **Given** the AC-49 state
- **When** Enter is pressed, then Tab once
- **Then** focus is inside `<main>` and not in the header
- **Assertion:** `document.activeElement.closest('main') !== null` and `document.activeElement.closest('#header') === null`
- **Executable as:** `e2e`

#### AC-51 — The closed nav is out of the tab order below 1200 px

- **Verifies:** R-33
- **Given** the local target at `small`, and again at `tablet`, nav closed
- **When** a Tab walk runs
- **Then** focus never enters the header
- **Assertion:** for every focused element, `el.closest('#header') === null`
- **Executable as:** `e2e`

#### AC-52 — The open nav is reachable by keyboard

- **Verifies:** R-33 (guards against over-correction)
- **Given** the local target at `small`
- **When** the toggle is focused and Enter is pressed, then Tab is pressed up to 20 times
- **Then** focus reaches the About nav link
- **Assertion:** at some press, `document.activeElement` matches `.nav-menu a[href="#about"]`
- **Executable as:** `e2e`

#### AC-53 — Decorative icons are hidden from the accessibility tree

- **Verifies:** R-34
- **Given** the local target at `desktop`, after `load`
- **When** every `i` and `svg` element in `document.body` is inspected
- **Then** each one is hidden from assistive tech, unless it is a named image
- **Assertion:** for each element, at least one of these holds:
  - it or an ancestor has `aria-hidden="true"`
  - it is not rendered (`display: none`)
  - it has `role="img"` and a non-empty accessible name
  - Failing elements: 0.
- **Executable as:** `e2e`

#### AC-54 — The current section's nav link is marked current

- **Verifies:** R-34
- **Given** the local target at `desktop`
- **When** `#services` is scrolled to the top of the viewport and 500 ms pass
- **Then** only the Services link is current
- **Assertion:** `.nav-menu a[href="#services"]` has `aria-current` in `{"true", "location"}`, and every other `.nav-menu a` has no `aria-current`, or `aria-current="false"`
- **Executable as:** `e2e`

#### AC-55 — Portfolio alt texts are distinct and not generic

- **Verifies:** R-35
- **Given** `src/index.html` at the release commit
- **When** the `alt` of the 9 `img` elements inside `.portfolio-item` is read (static parse)
- **Then** the alts are non-empty, distinct and not the old placeholder
- **Assertion:** 9 distinct non-empty values, none matching `/^portfolio item \d+$/i`
- **Executable as:** `lint`

#### AC-56 — Portfolio link names are distinct

- **Verifies:** R-35
- **Given** the local target at `desktop`
- **When** the accessible names of the 18 `a` elements inside `.portfolio-links` are computed
- **Then** the names are non-empty, distinct and not the old placeholders
- **Assertion:** 18 distinct non-empty names, none matching `/^(app|card|web) \d$/i` or `/^more details$/i`
- **Executable as:** `e2e`

#### AC-57 — Alt texts and link names describe the actual images

- **Verifies:** R-35 (C-4)
- **Given** the release build open at `desktop`
- **When** a reviewer views each of the 9 portfolio images next to its `alt` and its two link names
- **Then** each `alt` describes what the image shows, and both link names refer to the same project as that `alt`
- **Assertion:** the reviewer records pass or fail per image, 9 rows, in the PR. All pass.
- **Executable as:** `manual`
- **Manual because:** whether text accurately describes an image's content is a human judgment. AC-55 and AC-56 automate everything else: presence, distinctness, and no placeholders.

#### AC-58 — Carousel bullets have names

- **Verifies:** R-36
- **Given** the local target at `small`, with `#testimonials` in view
- **When** the accessible names of the `.swiper-pagination-bullet` elements are computed
- **Then** each bullet is a named button
- **Assertion:** each bullet has role `button` and a non-empty accessible name, and the names are distinct
- **Executable as:** `e2e`

#### AC-59 — Carousel bullets are at least 24 × 24 px

- **Verifies:** R-36
- **Given** the AC-58 state
- **When** each bullet's clickable bounding box is measured
- **Then** each target meets WCAG 2.5.8
- **Assertion:** `width >= 24 && height >= 24` for every bullet
- **Executable as:** `e2e`

#### AC-60 — Social links and back-to-top are at least 44 × 44 px

- **Verifies:** R-37
- **Given** the local target at `desktop`, after `scrollTo(0, 150)`
- **When** the bounding boxes of the four header social links and `.back-to-top` are measured
- **Then** each is at least 44 px square
- **Assertion:** `width >= 44 && height >= 44` for all five
- **Executable as:** `e2e`

#### AC-61 — The fixed footer does not cover a focused nav link

- **Verifies:** R-38
- **Given** the local target at 1280 × 600
- **When** each of the 5 `.nav-menu a` links is focused by Tab
- **Then** the footer never overlaps the focused link
- **Assertion:** for each link, its bounding box does not intersect `#footer`'s bounding box
- **Executable as:** `e2e`

#### AC-62 — `#hero` is inside `<main>`

- **Verifies:** R-39
- **Given** `src/index.html` at the release commit
- **When** it is parsed
- **Then** the hero is in the main landmark
- **Assertion:** `document.querySelector('main #hero') !== null`
- **Executable as:** `lint`

#### AC-63 — The primary `<nav>` has an accessible name

- **Verifies:** R-39
- **Given** `src/index.html` at the release commit
- **When** the `nav` element containing the section links is parsed
- **Then** it is named
- **Assertion:** it has a non-empty `aria-label`, or an `aria-labelledby` that points at an element with non-empty text
- **Executable as:** `lint`

#### AC-64 — Testimonial photos have empty alt text

- **Verifies:** R-40
- **Given** `src/index.html` at the release commit
- **When** the `alt` of each `img` inside `#testimonials` is read
- **Then** each photo is decorative, because its name is in the adjacent text
- **Assertion:** every `alt === ""` (3 images)
- **Executable as:** `lint`

#### AC-65 — The About photo does not repeat the header photo's alt

- **Verifies:** R-40
- **Given** `src/index.html` at the release commit
- **When** the `alt` of the `img` in `#about` and of the `img` in `#header .profile` are read
- **Then** they are not near-duplicates
- **Assertion:** the About `alt` is `""`, or differs from the header `alt` after lowercasing and stripping punctuation
- **Executable as:** `lint`

#### AC-66 — The form is busy while a submission is in flight

- **Verifies:** R-41
- **Given** the local target at `desktop`, the dialog open with valid field values, and `https://api.web3forms.com/submit` routed to answer `{ "success": true }` after a 2 s delay
- **When** the form is submitted
- **Then** the busy state is set during the request and cleared after it
- **Assertion:** `#contact-form` has `aria-busy="true"` 500 ms after submit, and does not have `aria-busy="true"` 1 s after the response
- **Executable as:** `e2e`

#### AC-67 — Phones are not sent the 3840 px hero

- **Verifies:** R-42
- **Given** both targets at `phone`, with an empty cache
- **When** the page loads and the network goes idle
- **Then** no image response decodes to a width of 3840 px or more
- **Assertion:** for every response with `resourceType() === 'image'`, `createImageBitmap(blob).width < 3840`
- **Executable as:** `e2e`

#### AC-68 — No request goes to Google's font servers

- **Verifies:** R-43
- **Given** both targets
- **When** a full visit runs
- **Then** nothing is requested from Google's font hosts
- **Assertion:** the count of requests whose URL host is `fonts.googleapis.com` or `fonts.gstatic.com` is 0
- **Executable as:** `e2e`

#### AC-69 — The build output names no Google font host

- **Verifies:** R-43
- **Given** `dist/` from `yarn build` at the release commit
- **When** `rg -uu -l 'fonts\.(googleapis|gstatic)\.com' dist` runs
- **Then** no built file references Google fonts
- **Assertion:** 0 files
- **Executable as:** `build`

#### AC-70 — Every `@font-face` swaps instead of blocking

- **Verifies:** R-44
- **Given** `dist/*.css` from `yarn build` at the release commit
- **When** the `@font-face` blocks are parsed
- **Then** each one declares a non-blocking display policy
- **Assertion:** every `@font-face` block has `font-display: swap` or `font-display: optional`. Blocks failing: 0.
- **Executable as:** `build`

#### AC-71 — The three text families actually load

- **Verifies:** R-45 _(rests on A-12)_
- **Given** both targets at `desktop`, after `document.fonts.ready`
- **When** the computed `font-family`, `font-weight` and `font-size` are read for `body`, `.section-title h2` and `#hero p`
- **Then** the first family named is Open Sans, Raleway and Poppins respectively, and each is a loaded face, not a fallback
- **Assertion:** the first family in each `font-family` is `Open Sans`, `Raleway` or `Poppins` respectively, and `document.fonts.check(\`${weight} ${size} "${family}"\`) === true` for each of the three
- **Executable as:** `e2e`

#### AC-72 — Every icon slot still renders an icon

- **Verifies:** R-45 _(rests on A-12)_
- **Given** both targets at `desktop`, and again at `small`
- **When** each icon slot below is inspected for an `svg` or `i` child:
  - the 5 nav links
  - the 4 social links
  - `.mobile-nav-toggle` (at `small`)
  - `.back-to-top` after `scrollTo(0, 150)`
  - the 6 About list items
  - the 18 portfolio action links
  - the 6 service icons
  - the 6 testimonial quote marks
  - the 3 contact info items
  - `.contact-modal-btn`
- **Then** every slot renders a glyph
- **Assertion:** each slot has a rendered `svg` or `i` with a bounding box of at least 8 × 8 px. Slots failing: 0.
- **Executable as:** `e2e`

#### AC-73 — Fonts and icons look as they did

- **Verifies:** R-45 _(rests on A-12)_
- **Given** the live site before the first sprint-1 deploy, captured as screenshots at `small` and `desktop`, and the release build at the same viewports
- **When** a reviewer compares the two side by side
- **Then** the text font families, weights and the icon shapes match
- **Assertion:** the reviewer records pass or fail per viewport in the PR. Both pass.
- **Executable as:** `manual`
- **Manual because:** the font and icon sources change on purpose, so a pixel diff flags intended rasterization differences. Whether the result is "the same design" (A-12) needs human judgment. AC-71 and AC-72 automate the measurable part.

#### AC-74 — No icon webfont is built

- **Verifies:** R-46
- **Given** `dist/` from `yarn build` at the release commit
- **When** this command runs: `fd -H -I -e woff -e woff2 -e ttf -e otf -e eot . dist`. Fall back to `Get-ChildItem -Recurse` if `fd` is absent.
- **Then** every font file present belongs to Open Sans, Raleway or Poppins. None is a Font Awesome or other icon font.
- **Assertion:** the count of font files whose name matches `/^fa-|fontawesome|icofont|boxicons/i` is 0
- **Executable as:** `build`

#### AC-75 — Every built image declares its dimensions

- **Verifies:** R-47
- **Given** `dist/index.html` from `yarn build` at the release commit
- **When** every `img` element is parsed
- **Then** each has intrinsic dimensions declared
- **Assertion:** every `img` has `width` and `height` attributes that are positive integers. Failing images: 0.
- **Executable as:** `build`

#### AC-76 — Layout does not shift while loading

- **Verifies:** R-47
- **Given** both targets at `phone` and at `desktop`, with an empty cache and no user input
- **When** layout-shift entries are collected with `PerformanceObserver({ type: 'layout-shift', buffered: true })` from navigation until 5 s after `load`
- **Then** cumulative layout shift stays in the "good" band
- **Assertion:** the sum of `value` over entries with `hadRecentInput === false` is ≤ 0.1
- **Executable as:** `e2e`

#### AC-77 — Below-the-fold images are lazy

- **Verifies:** R-48
- **Given** both targets at `phone` and at `desktop`
- **When** each `img` element's `getBoundingClientRect().top` is read right after `DOMContentLoaded`, scrolled to the top
- **Then** every image whose top is at or below the viewport height is deferred
- **Assertion:** each such image has `loading="lazy"`. Failing images: 0.
- **Executable as:** `e2e`

#### AC-78 — The profile photo is a circle

- **Verifies:** R-49
- **Given** both targets at `desktop`
- **When** the bounding box and computed `border-radius` of `#header .profile img` are read
- **Then** it renders as a circle, not an oval
- **Assertion:** `|width - height| <= 1`, and the computed `border-top-left-radius` is `50%` or ≥ `width / 2` px
- **Executable as:** `e2e`

#### AC-79 — The source-map decision is recorded

- **Verifies:** R-50
- **Given** this spec file at the release commit. It is tracked in the repo because PR-1 commits `specs/` and `update-report-2026-11-16/` (Gate 2, "Commit both"); see the Conventions, "Tracked-file search".
- **When** §3 is read for the D-5 decision
- **Then** it states one of the two outcomes
- **Assertion:** §3 contains exactly one decision line for D-5 that says production either serves or does not serve source maps
- **Executable as:** `lint`

#### AC-80 — The live site matches the source-map decision

- **Verifies:** R-50
- **Given** the live target, and the AC-79 decision
- **When** for each `<script src>` in the live `/` HTML, `curl -s -o /dev/null -w '%{http_code}' <absolute src>.map` runs
- **Then** the status matches the decision
- **Assertion:** every status is `404` if the decision is "do not serve", and `200` if it is "serve"
- **Executable as:** `integration`

#### AC-81 — The `netlify.toml` header set for `/*` is correct

- **Verifies:** R-51, R-54, R-73
- **Given** `netlify.toml` at the release commit
- **When** the header names of the `[[headers]]` entry with `for = "/*"` are read
- **Then** the set includes `Content-Security-Policy-Report-Only`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`, and excludes `Content-Security-Policy` and `X-XSS-Protection`
- **Assertion:** the set check is on lowercased names. All three included headers have non-empty values. `Cross-Origin-Opener-Policy` is one of `same-origin`, `same-origin-allow-popups` or `noopener-allow-popups`.
- **Executable as:** `lint`

#### AC-82 — The live site sends report-only CSP and no enforcing CSP

- **Verifies:** R-51
- **Given** the live target
- **When** `curl -sI https://fs3portfolio.netlify.app/` runs
- **Then** the policy is report-only
- **Assertion:** the response has a non-empty `content-security-policy-report-only` header and no `content-security-policy` header
- **Executable as:** `integration`

#### AC-83 — A full visit produces no CSP violations

- **Verifies:** R-52
- **Given** both targets. On the local target, the harness adds the `Content-Security-Policy-Report-Only` value from `netlify.toml` to the document response, because a local static server does not apply `netlify.toml`.
- **When** a full visit runs, with a listener for `securitypolicyviolation` and for console messages
- **Then** nothing violates the policy, the lightbox, the dialog and the map included
- **Assertion:** the count of `securitypolicyviolation` events is 0, and the count of console messages matching `/Content.Security.Policy/i` is 0
- **Executable as:** `e2e`

#### AC-84 — `index.html` has no inline `style` attributes

- **Verifies:** R-53
- **Given** `src/index.html` at the release commit
- **When** `rg -n '\sstyle\s*=' src/index.html` runs
- **Then** none remain. Today they are at `:431` (map) and `:480` (honeypot).
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-85 — The live site no longer sends `X-XSS-Protection`

- **Verifies:** R-54
- **Given** the live target
- **When** `curl -sI https://fs3portfolio.netlify.app/` runs
- **Then** the deprecated header is absent
- **Assertion:** there is no `x-xss-protection` header (case-insensitive)
- **Executable as:** `integration`

#### AC-86 — The live site sends `Permissions-Policy`

- **Verifies:** R-54
- **Given** the live target
- **When** `curl -sI https://fs3portfolio.netlify.app/` runs
- **Then** the header is present
- **Assertion:** there is a `permissions-policy` header with a non-empty value
- **Executable as:** `integration`

#### AC-87 — There are no critical or high advisories

- **Verifies:** R-55
- **Given** the release commit with dependencies installed
- **When** `yarn npm audit --all --recursive --environment all --severity high` runs. These are the Yarn 4 flags for all workspaces, transitive dependencies, production and dev. §3 confirms the flags against the Yarn 4.18.1 docs.
- **Then** no advisory at high or critical severity is reported
- **Assertion:** exit code 0
- **Executable as:** `integration`

#### AC-88 — No devDependency uses `latest`

- **Verifies:** R-56
- **Given** `package.json` at the release commit
- **When** `yq -p=json '.devDependencies | to_entries | map(select(.value == "latest")) | length' package.json` runs
- **Then** none of the six (`@eslint/js`, `eslint`, `eslint-config-prettier`, `eslint-plugin-prettier`, `globals`, `prettier`) still uses `latest`
- **Assertion:** the output is `0`
- **Executable as:** `lint`

#### AC-89 — The smoke suite covers every bootstrap6-analysis §6 row in Bootstrap 5 form

- **Verifies:** R-57 (C-32), and the smoke-suite rows for R-77 to R-79
- **Given** the release commit, with every Web3Forms call routed to a mock
- **When** `npx playwright test --list` runs
- **Then** for each row below, at least one listed test title contains the row name, and that test makes the stated Bootstrap 5 assertions

  The `Grid` row now measures the Services cards instead of the portfolio. They keep Bootstrap's `col-lg-4 col-md-6` grid, so the row still detects the `lg` breakpoint shift that sprint 2 brings. The portfolio's own layout is free to change once Isotope goes (C-36), so it is covered by `Portfolio filter` instead.

  | Row name | Bootstrap 5 assertions in sprint 1 |
  | --- | --- |
  | `Layout` | At 1199 px: `.mobile-nav-toggle` is visible, `#header` box `x < 0`, and `#main` `margin-left` is `0px`. At 1200 px: the toggle is hidden, `#header` `x == 0`, and `#main` `margin-left` is `300px`. |
  | `Mobile nav` | At `small`: clicking the toggle gives `body.mobile-nav-active` and puts `#header` in view. A click outside closes it. Clicking a nav link scrolls to its section and closes the nav. |
  | `Grid` | 2 Services `.icon-box` cards share the first row's `y` at 991 px, and 3 at 992 px. |
  | `Dialog open` | After clicking `.contact-modal-btn`: `#contactModal` has class `show` and `aria-modal="true"`, and `body` has class `modal-open`. |
  | `Dialog keyboard` | After 10 Tabs, `document.activeElement` is inside `#contactModal`. Escape closes it, and focus is on `.contact-modal-btn`. |
  | `Dialog dismiss` | The `[data-bs-dismiss="modal"]` button closes it. A click on the backdrop outside both the dialog box and `#header` closes it. |
  | `Submit, success` | A mocked `{ "success": true }` makes `#sent-message` visible. |
  | `Submit, error` | A mocked `{ "success": false, "message": "x" }` makes `#error-message` visible with text `x`. |
  | `Abort on close` | The mock is delayed 3 s. Submit, press Escape, and after `hidden.bs.modal` the fields are empty and `#submit-btn` is enabled with its default text. |
  | `Color scheme` | Under `emulateMedia({ colorScheme: 'dark' })`, the computed `body` `background-color` is `rgb(255, 255, 255)`. |
  | `Console` | No `pageerror` event fires during any of the above. |
  | `Portfolio filter` | At `desktop` and `small`, each filter shows exactly its item set: All {1–9}, App {1, 3, 6}, Card {4, 7, 8}, Web {2, 5, 9}. GLightbox opens from a visible item, and its image has `naturalWidth > 0`. Under each filter, `document.documentElement.scrollWidth <= clientWidth`. This records the layout that ships (C-32). |

- **Assertion:** for each of the 12 row names, the `--list` output contains ≥ 1 matching title. Every test passes as part of the gate in AC-1.
- **Executable as:** `lint`

#### AC-90 — An unmocked Web3Forms request never leaves the machine

- **Verifies:** R-58
- **Given** the smoke suite at the release commit, plus a temporary, uncommitted test that submits a valid form without registering its own Web3Forms mock
- **When** the suite runs
- **Then** the suite's guard aborts the request before it reaches the network, and the temporary test fails
- **Assertion:**
  - The temporary test's status is `failed`.
  - The request log shows 0 responses from host `api.web3forms.com` that were not produced by a route handler.
  - All other tests pass.
- **Executable as:** `e2e`

#### AC-91 — The baseline catches an unintended breakpoint change

- **Verifies:** R-59
- **Given** a scratch copy of the release commit with both `max-width: 1199px` media queries in `src/css/style.css` changed to `max-width: 1279px`
- **When** the smoke command runs against that copy's build
- **Then** the `Layout` test fails
- **Assertion:** the Playwright JSON report shows the test whose title contains `Layout` with status `failed`
- **Executable as:** `e2e`

#### AC-92 — The baseline catches an unintended dialog change

- **Verifies:** R-59
- **Given** a scratch copy of the release commit with `data-bs-toggle="modal"` on `.contact-modal-btn` changed to `data-bs-toggle="dialog"`
- **When** the smoke command runs against that copy's build
- **Then** the `Dialog open` test fails
- **Assertion:** the Playwright JSON report shows the test whose title contains `Dialog open` with status `failed`
- **Executable as:** `e2e`

#### AC-93 — Every README URL resolves

- **Verifies:** R-60
- **Given** `README.md` at the release commit
- **When** every absolute `http(s)` link target and autolink is fetched with `curl -sL -o /dev/null -w '%{http_code}'`, and every relative link target is checked with `git ls-files --error-unmatch <path>`
- **Then** every link resolves
- **Assertion:** every absolute URL returns 200–299 after redirects, and every relative target exits 0
- **Executable as:** `integration`

#### AC-94 — No README image renders broken

- **Verifies:** R-60
- **Given** `README.md` at the release commit
- **When** every image target (`![…](url)`, including badges) is fetched with `curl -sL -D -`
- **Then** each one returns an image. Under A-16, a README with no badge passes.
- **Assertion:** each returns status 200 with a `content-type` starting `image/`
- **Executable as:** `integration`

#### AC-95 — README version statements match the repo

- **Verifies:** R-61
- **Given** `README.md`, `.nvmrc` and `package.json` at the release commit
- **When** the README is scanned. Lines that mention Corepack are skipped, because they cite Node ranges on purpose.
- **Then** no stated version contradicts the files:
  - Any `x.y.z` on a line mentioning Node equals `.nvmrc`, and any Node major stated equals the `.nvmrc` major.
  - Any `x.y.z` on a line mentioning Yarn equals the `packageManager` version.
  - Any major stated for a runtime library in the Tech Stack table equals that package's major in `package.json`.
- **Assertion:** mismatches == 0
- **Executable as:** `lint`

#### AC-96 — The README makes none of the known false claims

- **Verifies:** R-62
- **Given** `README.md` at the release commit
- **When** `rg -n -i` runs with each of these patterns:
  - `skills progress bars`
  - `skill animation`
  - `Boxicons`
  - `just-validate`
  - `ESLint 9`
  - `16\.9\+`
  - `fs3-portfolio`
  - `kept in sync automatically`
  - `must pass before a PR can be merged`
- **Then** none is present. The last pattern stays forbidden because enforcement waits for billing (C-27). A README that says CI runs on every PR and should pass is acceptable.
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-97 — The repo description matches README line 5

- **Verifies:** R-63
- **Given** the release commit, and the GitHub repo
- **When** `gh repo view ValhallaTech/PortfolioPage-FS3 --json description | yq -p=json '.description'` runs, and `README.md` line 5 is read
- **Then** both carry the C-6 text
- **Assertion:** both strings equal exactly `Personal portfolio website for Fred Smith III, built as a static single-page application and deployed on Netlify.`
- **Executable as:** `integration`

#### AC-98 — Valhalla Tech is the copyright holder in both places

- **Verifies:** R-64
- **Given** `README.md` and `src/index.html` at the release commit
- **When** the README License section and the footer `.copyright` text are read
- **Then** both name Valhalla Tech
- **Assertion:** the License section matches `©\s*Valhalla Tech` and does not match `©\s*Fred Smith III`, and the footer `.copyright` text contains `Valhalla Tech`
- **Executable as:** `lint`

#### AC-99 — The remaining docs-audit rows read true

- **Verifies:** R-65
- **Given** `README.md` at the release commit
- **When** each check below runs
- **Then** every check passes

  | Row | Check |
  | --- | --- |
  | R4 | No caret range: `` rg -n '`\^\d' `` returns 0 |
  | R7 | `rg -n -i 'initialisation'` returns 0 |
  | R11 | Every line containing `80%` also contains `utils.js`, and `80 %` (with a space) returns 0 |
  | R12 | `rg -n 'no watch, strict coverage'` returns 0 |
  | R20 | Every fenced-code opening line has a language tag: `rg -n '^```\s*$'` matches only closing fences |
  | R21 | `](../../issues)` returns 0, and `https://github.com/ValhallaTech/PortfolioPage-FS3/issues` is present |
  | R22 | `https://github.com/ValhallaTech/.github/blob/main/CODE_OF_CONDUCT.md` is present |

- **Assertion:** failed checks == 0
- **Executable as:** `lint`

#### AC-100 — `GPL-3.0-only` is declared in the README and `package.json`

- **Verifies:** R-65 (C-29)
- **Given** `README.md` and `package.json` at the release commit
- **When** the README License section and `yq -p=json '.license' package.json` are read
- **Then** both state the SPDX identifier `GPL-3.0-only`
- **Assertion:**
  - `package.json` `.license` == `GPL-3.0-only`.
  - The README License section contains `GPL-3.0-only`.
  - The README License section does not contain `GPL-3.0-or-later`.
- **Executable as:** `lint`

#### AC-101 — The README documents the smoke command

- **Verifies:** R-66
- **Given** `README.md` and `package.json` at the release commit
- **When** the README Usage section's code blocks are read
- **Then** they include `yarn <script>`, where `<script>` is the smoke command's script name in `package.json` `scripts`
- **Assertion:** ≥ 1 match
- **Executable as:** `lint`

#### AC-102 — Tag `4.0.0` exists and carries version 4.0.0

- **Verifies:** R-67
- **Given** `origin`
- **When** `git ls-remote --tags origin refs/tags/4.0.0` runs, then `git show 4.0.0:package.json | yq -p=json '.version'`
- **Then** the tag exists, and its `package.json` reads `4.0.0`
- **Assertion:** the first command prints one line, and the second prints `4.0.0`
- **Executable as:** `integration`

#### AC-103 — The CHANGELOG has an entry for every release

- **Verifies:** R-68
- **Given** `CHANGELOG.md` at tag `4.0.0`, and `git tag --list` filtered to `^\d+\.\d+\.\d+$`
- **When** each tag `T` is looked up in the CHANGELOG
- **Then** every release from 1.0.0 through 4.0.0 has a dated heading
- **Assertion:** for every `T`, the CHANGELOG has a line matching `^## \[T\] - \d{4}-\d{2}-\d{2}$`. Missing tags: 0.
- **Executable as:** `lint`

#### AC-104 — CHANGELOG dates match the releases

- **Verifies:** R-68
- **Given** the AC-103 headings
- **When** each date is compared with `gh release view T --json publishedAt`, or with the tag's commit date (`git log -1 --format=%cs T`) if `T` has no GitHub release
- **Then** every date matches
- **Assertion:** the heading date equals the UTC `YYYY-MM-DD` of the source date for every `T`
- **Executable as:** `integration`

#### AC-105 — Exactly two issue forms, bug and feature

- **Verifies:** R-69
- **Given** `.github/ISSUE_TEMPLATE/` at the release commit
- **When** its files are listed and the YAML files are parsed
- **Then** the directory holds `config.yml` plus exactly two form files, and no Markdown template:
  - The two forms are `*.yml` or `*.yaml`.
  - Each form has top-level `name`, `description` and a non-empty `body` array.
  - One form's `name` matches `/bug/i`, and the other's matches `/feature/i`.
- **Assertion:** the structure checks hold, and `issue-ticket-template.md` is absent
- **Executable as:** `lint`

#### AC-106 — Neither form asks the irrelevant questions

- **Verifies:** R-69
- **Given** `.github/ISSUE_TEMPLATE/` at the release commit
- **When** `rg -n -i -e 'customer' -e 'sprint' -e 'effort' -e 'yesterday' -e 'this quarter' -e 'internal' .github/ISSUE_TEMPLATE` runs
- **Then** no field asks about customers, sprint effort, timing or the internal/customer source
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-107 — GitHub renders both forms

- **Verifies:** R-69
- **Given** the forms merged to `main`
- **When** a reviewer who is signed in opens `https://github.com/ValhallaTech/PortfolioPage-FS3/issues/new/choose`
- **Then** exactly two choices appear, one for bugs and one for features, and each opens a rendered form with no template-error banner
- **Assertion:** the reviewer records pass or fail in the PR
- **Executable as:** `manual`
- **Manual because:** GitHub's own renderer, on the default branch, is the authoritative validator for issue-form YAML. No approved repo dependency gives an equivalent local result, and the check needs a signed-in browser session. AC-105 and AC-106 automate the structure and content locally.

#### AC-108 — Renovate automerge is still paused at release

- **Verifies:** R-70 (C-28)
- **Given** `renovate.json` at the release commit
- **When** `rg -n '"automerge"\s*:\s*true' renovate.json` runs
- **Then** no rule or top-level setting turns automerge on
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-109 — Under reduced motion, the carousel does not rotate on its own

- **Verifies:** R-71 (C-35)
- **Given** the local target at `small`, with `emulateMedia({ reducedMotion: 'reduce' })` set before navigation and `#testimonials` scrolled into view
- **When** 11 s pass with no interaction, which spans two of today's 5 s autoplay periods
- **Then** the active slide never changes
- **Assertion:** the `data-swiper-slide-index` of `.testimonials .swiper-slide-active` read at the start equals the value read 11 s later
- **Executable as:** `e2e`

#### AC-110 — The typing effect shows each phrase once, in order

- **Verifies:** R-72 (C-31)
- **Given** the local target at `desktop`, with no reduced-motion preference and a `MutationObserver` recording each distinct `textContent` of the hero typing element (today `.typed`) from `DOMContentLoaded` for 60 s
- **When** the recording ends
- **Then** each phrase from `data-typed-items` appeared as the complete text exactly once, in source order
- **Assertion:** keep the recorded texts that equal a trimmed phrase, and collapse consecutive duplicates. The result equals `["a Designer", "a Developer", "a Photographer", "a Coding Ninja"]`.
- **Executable as:** `e2e`

#### AC-111 — The typing effect stops on its last phrase

- **Verifies:** R-72 (C-31)
- **Given** the AC-110 recording
- **When** the time of the last text change is found
- **Then** the text settles on the last phrase within 45 s of load and stays there
- **Assertion:** the last change happens ≤ 45 s after `load`, the final text is `a Coding Ninja`, and no further change happens in the 10 s after it
- **Executable as:** `e2e`

#### AC-112 — Nothing in the hero keeps animating after the typing stops

- **Verifies:** R-72 (C-31)
- **Given** the AC-111 settle point plus 10 s
- **When** `document.getAnimations()` is read
- **Then** no animation is still running on any element inside `#hero`, including the blinking typing cursor. Blinking that lasts more than 5 s is itself a WCAG 2.2.2 failure, so stopping the effect includes stopping the cursor.
- **Assertion:** count of animations with `playState === 'running'` whose `effect.target` is inside `#hero` == 0
- **Executable as:** `e2e`

#### AC-113 — The live site sends `Cross-Origin-Opener-Policy`

- **Verifies:** R-73
- **Given** the live target
- **When** `curl -sI https://fs3portfolio.netlify.app/` runs
- **Then** COOP is sent with a protective value
- **Assertion:** the `cross-origin-opener-policy` header is one of `same-origin`, `same-origin-allow-popups` or `noopener-allow-popups`
- **Executable as:** `integration`

#### AC-114 — The carousel logs no loop warning at any width

- **Verifies:** R-74
- **Given** the local target at widths 375, 767, 768, 899, 900, 1440 and 1920 (height 900 each), with no reduced-motion preference and a listener on every console message from navigation onward
- **When** the page loads, `#testimonials` is scrolled into view, and 12 s pass
- **Then** no loop warning is logged at any of the widths
- **Assertion:** at every width, the count of console messages matching `/loop/i` is 0
- **Executable as:** `e2e`

#### AC-115 — _Withdrawn at Gate 1_

- **Status:** withdrawn with R-75 (Q-13, NG-11). It asserted that the static form still posts to Web3Forms without `redirect=false`. The ID is kept so it is not reused.

#### AC-116 — _Withdrawn at Gate 1_

- **Status:** withdrawn with R-75 (Q-13, NG-11). It asserted that a set `redirect` target is a readable HTML page. The ID is kept so it is not reused.

#### AC-117 — _Withdrawn at Gate 1_

- **Status:** withdrawn with R-75 (Q-13, NG-11). It was the manual check that a real no-JS submission ends on a readable page. The ID is kept so it is not reused.

#### AC-118 — Isotope is gone

- **Verifies:** R-76
- **Given** the release commit
- **When** a tracked-file search for `isotope` runs. This covers `package.json`, `yarn.lock`, `src/` and `README.md`.
- **Then** Isotope is not declared, locked, imported or mentioned
- **Assertion:** 0 matches
- **Executable as:** `lint`

#### AC-119 — Each filter shows exactly today's items

- **Verifies:** R-77
- **Given** the local target at `desktop`, and again at `small`
- **When** each filter is activated by click in turn (All, App, Card, Web), with a 1 s settle after each
- **Then** the visible portfolio items are exactly that filter's set: All {1–9}, App {1, 3, 6}, Card {4, 7, 8}, Web {2, 5, 9}
- **Assertion:** the set of visible item identities equals the expected set for all four filters at both viewports
- **Executable as:** `e2e`

#### AC-120 — The lightbox opens from every portfolio item

- **Verifies:** R-78
- **Given** the local target at `desktop` under `All`
- **When** for each item 1–9, its lightbox link is activated, then Escape is pressed
- **Then** each time the lightbox opens and shows that item's image
- **Assertion:** for every item, the GLightbox container is visible and its current slide image has `naturalWidth > 0` before Escape, and the container is hidden after Escape
- **Executable as:** `e2e`

#### AC-121 — The portfolio never causes horizontal scrolling

- **Verifies:** R-79
- **Given** the local target at widths 320, 375, 768, 991, 992, 1199, 1200, 1440 and 1920 (height 900)
- **When** each filter (All, App, Card, Web) is activated, with a 1 s settle and all portfolio images loaded
- **Then** the page is never wider than the viewport
- **Assertion:** `document.documentElement.scrollWidth <= document.documentElement.clientWidth` for all 36 combinations
- **Executable as:** `e2e`

#### AC-122 — The portfolio stays inside its own section

- **Verifies:** R-79
- **Given** the local target at `desktop` and at `small`
- **When** each filter is activated, with a 1 s settle and all portfolio images loaded
- **Then** no item spills out of `#portfolio`, and `#portfolio` does not overlap the section after it
- **Assertion:** every visible item's bounding box lies inside `#portfolio`'s bounding box, and `#portfolio.bottom <= #services.top`
- **Executable as:** `e2e`

#### AC-123 — Fred accepts the portfolio layout that ships

- **Verifies:** R-80 (C-36, A-17)
- **Given** the release build at `small`, `tablet` and `desktop`
- **When** Fred views the portfolio under each of the four filters
- **Then** he accepts the layout as fitting the page
- **Assertion:** Fred records accept or reject in the PR that replaces Isotope
- **Executable as:** `manual`
- **Manual because:** C-36's "acceptable if it fits the page" is an aesthetic judgment only Fred can make. A-17 records that the automated G-22 conditions (AC-119 to AC-122) could accept a layout he would reject, and the smoke baseline records whatever ships.

#### AC-124 — Under reduced motion, a filter change jumps straight to its final state

- **Verifies:** R-81 (C-37)
- **Given**:
  - the local target at `desktop`, and again at `small`
  - `emulateMedia({ reducedMotion: 'reduce' })` set before navigation
  - `#portfolio` scrolled into view, the `All` filter active, all portfolio images loaded, and 2 s idle, so any scroll-reveal has finished
- **When** the `App` filter is clicked, and from that click a `requestAnimationFrame` loop records, for 1 s, the following for each of the 9 portfolio items (see Conventions, "Portfolio item identity"):
  - whether the item is visible
  - its bounding box
  - its computed `opacity`
- **Then** the first frame rendered after the click already shows the final result, and nothing animates toward it. "The final result" means items {1, 3, 6} visible at their final positions and items {2, 4, 5, 7, 8, 9} not visible.
- **Assertion:**
  - **Every frame matches the final state.** Every recorded frame, from the first one after the click, equals the last recorded frame. That means the same visible set, `{1, 3, 6}`, and each visible item at the same bounding box (± 1 px) with `opacity` `1`.
  - **No animation is running.** At the first frame after the click, `document.getAnimations()` returns no animation in `running` state with a duration above 0 whose `effect.target` is a portfolio item, an element inside one, or the grid container. This covers CSS transitions, CSS animations and Web Animations alike. Animations on the filter buttons themselves, such as a color transition, are not counted.
- **Executable as:** `e2e`

### 2.4 Success metrics

_How we know it worked after it ships. Metric, current baseline, target, measurement source._

| ID | Metric | Baseline | Target | Measured by |
| --- | --- | --- | --- | --- |
| M-1 | Largest Contentful Paint of the live home page, mobile lab run | unknown: needs measurement on the live site before the first sprint-1 deploy | ≤ 2.5 s | Lighthouse mobile preset against `https://fs3portfolio.netlify.app/`, run ad hoc through `npx`, not a repo dependency |
| M-2 | Bytes transferred on a first, empty-cache load at `phone` | unknown: needs a HAR capture from the live site before the first sprint-1 deploy. Known parts: `hero-bg.jpg` 480 KB, Font Awesome woff2 234 KB, CSS 55 KB br, JS 78 KB br (frontend-audit §3) | At least 500 KB less than the baseline | Playwright HAR (`recordHar`) at `phone`, before and after |
| M-3 | PRs merged into `main` while `Test & Build` was failing | 1 (PR #67, 2026-09-28; report §1 B2) | 0 in the 90 days after Actions is restored | `gh pr list --state merged` with `gh pr checks <n>` per PR |
| M-4 | Critical and high advisories across all dependencies | 1 critical, 6 high (2026-11-16; report "How this was checked") | 0, measured once on the release commit | `yarn npm audit --all --recursive --severity high`, the same run as AC-87 |
| M-5 | Node or Yarn version disagreements between repo files | Drifting since at least 2026-07-13: `netlify.toml` Yarn 4.17.0 vs `packageManager` 4.18.1 (report §1 B7) | 0, measured once on the release commit | The AC-12 check on the release commit |
| M-6 | Unintended layout or dialog regressions found after merge during sprint 2 | unknown: no harness existed to detect them | 0 | Sprint 2 PR reviews and issues tagged as regressions |
| M-7 | Lighthouse accessibility score of the live home page | unknown: needs measurement before the first sprint-1 deploy | ≥ 95 | Lighthouse via `npx`, same run as M-1 |

### 2.5 Out of scope

_Carried forward from §1.4, plus anything cut during PRD authoring._

**Carried from §1.4:**
- **NG-1:** B1, B3, B4, B5 and the Renovate automerge pause, which ship in the hotfix.
- **NG-2:** the Bootstrap 6 upgrade and every "During" item, breakpoint normalization included.
- **NG-3:** the Sass-partials route and any `--bs-*` token bridge. AC-29 guards this.
- **NG-4:** GSAP steps 2 and later, reduced motion everywhere except the carousel and the portfolio filter, and the GSAP license. Three motion changes are sprint 1: the carousel under reduced motion (R-71), the portfolio filter under reduced motion (R-81), and the typing stop (R-72).
- **NG-5:** any change to the hero typing effect beyond stopping after one cycle. That excludes a pause control, a static accessible label, sequencing, and reduced-motion handling for the typing. Stopping includes the blinking cursor (AC-112), as Fred confirmed at Gate 1.
- **NG-6:** placeholder content and typos. The nine `#` detail links keep their targets and get descriptive names (C-4).
- **NG-7:** a BootstrapMade credit or template acknowledgment.
- **NG-8:** the Actions billing lock.
- **NG-9:** CSP enforcement.
- **NG-10:** the `php-email-form` class rename and the selectors that hang off it, and removing the `.validate` divs together with their `.validate` CSS rule. G-7 states that exception. All of these are sprint 2. AC-20 leaves `.validate` out, and AC-21 is withdrawn. Collapsing the overridden `.php-email-form` base box (AC-22) and deleting `.php-email-form .loading` and `.error-message br + br` (AC-20) stay in G-7, because they remove dead rules but rename nothing.
- **NG-11:** the no-JS contact-form path, both reaching the form without JavaScript and the result page after a no-JS submission. Fred moved it to sprint 2 at Gate 1 (Q-13), because sprint 2 rebuilds the form as a native dialog and solves both together. G-21 is withdrawn. R-75 and AC-115 to AC-117 are withdrawn with their IDs kept.

**Cut or excluded during PRD authoring, with reasons:**
- **Animated filtering, as a requirement.** C-36 says filtering need not animate, so no AC requires an animation. The chosen library (Muuri, D-16) may animate. Under reduced motion it must not (R-81, AC-124).
- **The portfolio as the smoke `Grid` row's subject.** The row now measures the Services cards, because the portfolio layout may change once Isotope goes (C-36). See AC-89.
- **frontend-audit §5b rows 340-344 (`section { overflow: hidden }`) and 170-175 (`.nav-menu *`).** G-7 covers only the *invalid and no-op* declarations of §5b. These two rules have real effects, so they are not in G-7. If the focus-ring clipping that row 340-344 describes makes AC-41 fail, fixing it falls under R-27, not G-7.
- **frontend-audit §5c, beyond color tokens.** This covers `.form-group` (bootstrap6 L8, "During"), custom buttons → `.btn` (A-L2, "During"), BEM renames, and restyling Swiper bullets through Swiper's CSS variables. No goal names them. Contrast on the bullets is still asserted (AC-45 row 11).
- **docs-audit R23's "Thanks" section and footer credit.** NG-7 excludes them. Only the SPDX part of R23 is in scope (AC-100).
- **docs-audit §9 recommended checks** (lychee, markdownlint and `eslint-plugin-jsdoc` as CI jobs). No goal asks for them. AC-93 checks README links directly, with `curl`.
- **frontend-audit §2a's "move focus into the nav on open and close it on Esc".** G-11 (i) asks only that the closed nav leave the tab order. AC-52 checks that the open nav stays reachable.
- **Lighthouse, axe-core and the Renovate CLI as repo dependencies.** No AC needs them installed. The metrics and AC-5/AC-6 run them through `npx`. The dependencies the implementation needs are named in §3 under C-34.

### 2.6 Open questions carried forward

_Unresolved §1.6 questions still relevant, plus new ones raised by the PRD._

Gate 1 resolved Q-1 to Q-11 from the first draft, and Q-12 (d). They now live in §1.5 as C-27 to C-35, and Docker Desktop is recorded in A-3. Q-13, the no-JS contact form, is resolved too: Fred moved it to sprint 2 (NG-11), and R-75 and AC-115 to AC-117 are withdrawn. Only Q-12 remains open, and it is a set of constraints for the Architect, not a question for Fred.

| ID | Question | Blocking? | Owner | Effect on this PRD |
| --- | --- | --- | --- | --- |
| Q-12 | Several sequencing and harness consequences follow for §3. | no | Architect | None of the ACs change. These are constraints on how §3 satisfies them. |

**Q-12: sequencing and harness consequences for §3.**
- **(a)** AC-2 requires all six gate results on every sprint-1 PR, so the smoke suite must land in, or before, the first sprint-1 PR.
- **(b)** Under test-first, failing acceptance tests cannot merge to `main` on their own without breaking AC-2. Each chain must merge green, or mark its tests expected-to-fail until implementation lands.
- **(c)** AC-6 cannot use a live-registry Renovate dry run until a `bootstrap` prerelease newer than `6.0.0-alpha.1` exists. Define a harness.
- **(e)** The live-target ACs depend on A-2: Netlify must deploy the release commit before they can run. They are AC-46, AC-67, AC-68, AC-71, AC-72, AC-76 to AC-78, AC-80, AC-82, AC-83, AC-85, AC-86 and AC-113.
- **(f)** The Isotope replacement (D-16) changes the portfolio markup that these ACs rely on: AC-36, AC-42, AC-43, AC-56, AC-119 to AC-122, AC-124, and the `Portfolio filter` row of AC-89. §3 must name the selector for each role (item, card wrapper, action links) and a stable item-identity hook, per the Conventions.
- **(g)** AC-110 to AC-112 run up to 60 s each, and AC-114 runs 12 s at each of 7 widths. §3 should keep these out of the smoke command's critical path if gate time matters, or accept the cost.

---

## 3. Technical Plan

<!-- OWNER: Architect. No other agent may edit this section. -->

**Status:** ✅ complete: every part of §3 is written. This line says only that. Whether §3 is approved is shown only by the header's `Stage` row, which changes on Fred's Gate 2 approval and on nothing else.

_Written 2026-11-17 against `main` at `1dc41e6` plus the hotfix branch of draft PR #69 (read from its public diff and from the local worktree `.claude/worktrees/interesting-hellman-6f9b10`). Revised the same day for Fred's Gate 2 answers, as relayed by the coordinator: Muuri for D-16, R-81 and AC-124, the new AC-3 wording, M-4 and M-5 measured once, and #69 at `1988128`. Everything below assumes #69 has merged at `1988128` or later (A-1). §3.3 lists each part of this plan that builds on #69._

_Revised again on 2026-11-17, before execution, for ten defects the workflow-architect found while designing the Workflow scripts. Fred chose to have the Architect fix §3 ("Architect revises spec"). The fixes: the lint scope (WI-10, §3.3), the empty-suite exits of Playwright (WI-6, WI-7, chain C), how the second of two PRs reconciles shared manifests (§3.5 rule 6), `yaml` moved into PR-1 (WI-3, WI-11, WI-24), same-file work no longer marked parallel (§3.5 rule 7; PR-1, PR-5, PR-7 and PR-9), the Linux gate cloning from `origin` instead of a bind mount (WI-5, WI-11), Corepack on Node 25 in PR-1 (RK-22), a non-vacuous AC-2 test (WI-3), and the `--commands-file` format (chain A). The coordinator then raised three more gaps, fixed in the same revision: Corepack as a precondition on Fred's Windows host (D-10, Phase 0, WI-4 preflight); how the AC-1 test finds the release SHA before the tag exists (`AC1_REF`, WI-3, WI-65); and this section's status line, which now says that approval is shown only by `Stage`. On 2026-11-18, running PR-1 found one more defect, and Fred approved the repair ("Yes, repair both"): the `node:25` image's preinstalled Yarn 1 blocks the Corepack install with `EEXIST`. That is fixed in WI-5, D-1, D-10 and RK-22. The same rule is applied to WI-11's AC-9 test and its §3.7 row. Also on 2026-11-18: WI-7 and the chain C seam now run `--list` without Jest's `JEST_*` variables, and they count `No tests found` as an empty list only when it is the only error. WI-4's step environment and WI-61's child commands drop the `JEST_*` variables for the same reason. No Gate 1 or Gate 2 decision changed. Each fix records its evidence where it is made, and in "Facts this plan rests on"._

### 3.1 Affected systems & repos

| System / repo | Nature of change | Owner domain |
| --- | --- | --- |
| `ValhallaTech/PortfolioPage-FS3`: `src/index.html`, `src/css/style.css`, `src/js/main.js`, `src/js/utils.js`, `src/images/` | Cleanup, Isotope replaced by Muuri, accessibility, color tokens, self-hosted fonts, SVG icons, image variants, inline-style removal, motion changes | `frontend` |
| Same repo, test code: `__tests__/` (Jest), new `tests/e2e/` (Playwright), `jest.config.js`, new `jest.release.config.js`, new `playwright.config.js`, new `scripts/serve-dist.mjs` | Acceptance suites, smoke baseline, end-to-end checks, release checks | `tests` |
| Same repo, automation scripts: new `scripts/gate.mjs`, `scripts/sync-runtime-versions.mjs`; `package.json` / `yarn.lock` toolchain pins | Local gate runner, extracted runtime-sync script, devDependency pins, advisory remediation | `backend` |
| Same repo, pipeline config: `.github/workflows/ci.yml`, `.github/workflows/sync-runtime-versions.yml`, `renovate.json`, `.nvmrc`, `netlify.toml` `[build]`, `.gitattributes`, Prettier and ESLint scope, `build` script | Node 26 and Corepack, smoke step in CI, Renovate `bootstrap` rule, cross-platform line endings, source maps off | `ci` |
| Netlify response headers (`netlify.toml` `[[headers]] for = "/*"`) | CSP report-only, `Permissions-Policy`, COOP, `X-XSS-Protection` removed | `security` |
| Docker Desktop on Fred's machine | Linux gate container, the evidence of record while Actions is locked | `docker` |
| GitHub repo settings and state: rulesets, repo description, PRs #56 and #68, tag and release `4.0.0` | Disabled-but-ready `Test & Build` ruleset; description per C-6; superseded PRs closed; release | `ci`, unmapped |
| `README.md`, `CHANGELOG.md` (new), `.github/ISSUE_TEMPLATE/` | Truthful docs, backfilled changelog, two issue forms | `docs` |

### 3.2 Data changes

None. The site is static and holds no data. No database, cache, or stored state changes.

Two CDN caching facts the plan relies on:

- Parcel emits hashed file names at the `dist/` root. #69 adds one-year `immutable` cache rules for `/*.jpg`, `/*.jpeg`, `/*.png`, `/*.webp`, `/*.avif` and `/*.svg`. The new AVIF and WebP variants (WI-44) fall under those rules unchanged.
- Fontsource ships `.woff2` and `.woff` files. The existing `/*.woff2` rule covers the files browsers actually fetch. `.woff` files get Netlify's default caching, which is acceptable.

### 3.3 API & contract changes

**External contracts that change**

| Contract | Before | After | Breaking? |
| --- | --- | --- | --- |
| Response headers on `/*` | `X-Frame-Options`, `X-XSS-Protection`, `X-Content-Type-Options`, `Referrer-Policy` | Drops `X-XSS-Protection`. Adds `Content-Security-Policy-Report-Only`, `Permissions-Policy` and `Cross-Origin-Opener-Policy: same-origin` (WI-58) | No. Report-only blocks nothing, and the page opens no cross-origin windows it scripts |
| Production build output | `*.js.map` published | No source maps (WI-59) | Only for anyone debugging production from maps. The repo is public, so nothing is lost |
| Third-party requests | `fonts.googleapis.com` and `fonts.gstatic.com` on every visit | None to Google Fonts. Web3Forms and the Google Maps embed are unchanged | No |
| `src/js/utils.js` module format | CommonJS `module.exports` | ES module named exports (WI-32) | **Yes**, for any CommonJS consumer. The only consumer is `__tests__/utils.test.js`, converted in the same PR (WI-31) |
| Runtime | Node 25.9.0 (end of life), Corepack assumed present | Node 26 LTS; Corepack installed with `npm install -g corepack@0.36.0` (WI-12, WI-13) | **Yes**, for contributors. Local setups need Node 26 and the Corepack install step. The README states both |
| Netlify build environment | `NODE_VERSION = "25.9.0"`, `YARN_VERSION = "4.17.0"` | `NODE_VERSION` = the `.nvmrc` value. `YARN_VERSION` removed; Netlify takes Yarn from `packageManager` | No, if RK-2 holds. The deploy preview proves it before merge |
| npm scripts | `build`, `test`, `test:ci`, `lint`, `lint:fix`, `format`, `format:check`, `start` | Adds `test:smoke`, `test:e2e:slow`, `test:e2e:live`, `verify:release`, `gate`, `gate:linux`. `build` gains `--no-source-maps`. `format` and `format:check` cover `src/css`, `tests` and `scripts`. `lint` and `lint:fix` cover `tests` and `scripts` but not `src/css`: ESLint lints only JS and exits 2 on a directory with no file it lints (WI-10) | No |
| Renovate | One group, automerge paused | `bootstrap` in its own group with `automerge: false`, placed last so it wins. The group pause stays (WI-19) | No |
| GitHub | No ruleset requires a check. The General Ruleset (`15072163`) holds pull request, CodeQL code scanning and code quality rules | A new dedicated ruleset requires `Test & Build` on the default branch, with `enforcement: disabled` until billing returns (WI-21). The General Ruleset is not modified | No, while disabled |
| Portfolio layout engine | Isotope 3.0.6 (`fitRows`), GPL-3.0 or commercial | Muuri 0.9.5, MIT. It animates filtering, and does so instantly under reduced motion (WI-37) | No. The layout keeps the same three, two and one column widths |
| Issue intake | One Markdown template | Bug form and feature form (WI-26) | No |

**DOM contract for the tests** (resolves Q-12(f)). The ACs follow roles. These are the selectors at release.

| Role | Selector at release | Change |
| --- | --- | --- |
| Grid container | `.portfolio-container`, which carries the class `muuri` once Muuri has initialized | Muuri adds the class |
| Portfolio item | `.portfolio-item`, the Muuri item element, which carries `muuri-item` once initialized | Unchanged class |
| Item identity hook | `[data-portfolio-id="N"]`, where N = 1–9 in today's `src/index.html` source order | New stable hook. The image base name `portfolio-N` also stays |
| Item category | `[data-category="app"]`, `"card"`, `"web"` | Replaces the `filter-*` classes |
| Shown and hidden item | Shown: `.portfolio-item.muuri-item-shown`. Hidden: `.portfolio-item.muuri-item-hidden`, which Muuri also sets to `display: none` through the CSSOM when the hide finishes. Tests judge visibility with Playwright `toBeVisible()`, not by class | Muuri's default class names |
| Card wrapper | `.portfolio-wrap`, the Muuri item content: the first direct child, whose visibility Muuri animates | Unchanged |
| Action links | `.portfolio-links a`: the lightbox link `a.glightbox` first, the details link second | Unchanged |
| Filter controls | `#portfolio-filters button[data-filter]`, with `aria-pressed` and names `All`, `App`, `Card`, `Web` | Was `#portfolio-flters li` |
| Mobile nav toggle | `.mobile-nav-toggle` (exactly one), with `aria-expanded` and `aria-controls="header"` | Duplicate removed |
| Profile name | `#header .profile-name` (a `<p>`) | Was `#header .profile h1` |
| Testimonial role line | `.testimonial-item .testimonial-role` | Was `.testimonial-item h4` |
| Carousel pause control | `#testimonials .testimonials-autoplay-toggle`, role `button`, named `Pause testimonials` or `Play testimonials` | New |
| Back-to-top | `.back-to-top`, shown by the class `is-visible` | Inline `style` writes removed |
| Skip link | `a.skip-link`, first child of `<body>`, `href="#main"` | New |
| Typing element | `.typed` | Unchanged |

**Parts of this plan that build on hotfix PR #69**

- **Every gate run** needs #69's `yarn.lock` repair (B1). Without it, gate step 1 fails.
- **WI-31 and WI-32** convert #69's new `resolveHashTarget` and `resolveLightboxHref` exports and their tests to ESM.
- **WI-37** keeps the `<img>` inside each `.portfolio-wrap`, because `resolveLightboxHref` reads the lightbox URL from that sibling image (B3).
- **WI-8**'s `Portfolio filter` row asserts `naturalWidth > 0` in the lightbox. That passes only with #69's B3 fix.
- **WI-12 and WI-58** edit only the `[build.environment]` block and the `/*` header block of `netlify.toml`. They keep #69's image cache rules.
- **WI-19** builds on #69's `automerge: false` group rule, and AC-108 guards it.
- **`dependencyDashboard`:** at `1988128`, #69's `renovate.json` has no `dependencyDashboard` key at all. `config:recommended` enables the dashboard by default. No item in this plan adds the key back.
- **AC-2 scope:** #69's body no longer names the spec slug, so AC-2's scan does not include #69.

#### New packages (C-34) — approved at Gate 2

Fred approved this list at Gate 2 ("Approve all"). He approved `muuri` by choosing it for D-16.

Every package is pinned to an exact version at install time, matching the repo's existing exact-pin style. The versions shown are the registry's `latest` on 2026-11-17, read from `registry.npmjs.org/<pkg>/latest`. Licenses come from the same registry metadata, except where marked *inferred*. GPL-3.0-only can absorb permissive licenses (MIT, ISC, BSD-3-Clause, Apache-2.0). OFL-1.1 fonts are distributed alongside the code rather than combined with it. These are license facts, not legal advice.

| Package | Kind | Version on 2026-11-17 | License | Why | Added by |
| --- | --- | --- | --- | --- | --- |
| `@playwright/test` | dev | 1.65.1 | Apache-2.0 | Smoke and e2e harness. Already approved (C-15, R1-Q7) | WI-6 |
| `smol-toml` | dev | 1.9.1 | BSD-3-Clause | Parses `netlify.toml` in tests and in `serve-dist.mjs`. No dependencies | WI-6 |
| `yaml` | dev | 2.9.1 | ISC | Parses `ci.yml` and the issue forms in acceptance tests. No dependencies | WI-3 (PR-1), so that PR-2 and PR-4 both find it on `main` |
| `postcss` | dev | 8.5.33 | MIT | Parses `style.css` and `dist/*.css` into rule blocks for AC-20, AC-22, AC-23, AC-27 to AC-29 and AC-70 | WI-27 |
| `babel-jest` | dev | 30.5.2, matching Jest | MIT | Jest transform for the ESM `utils.js` (D-12). Peer: `@babel/core` `^7.11.0` or `^8.0.0-0` | WI-31 |
| `@babel/core` | dev | the major already in `yarn.lock` through Jest | MIT *(inferred: same project as preset-env)* | Peer of `babel-jest` and `@babel/preset-env` | WI-31 |
| `@babel/preset-env` | dev | same major as `@babel/core` (8.0.7 is `latest`, peer `@babel/core ^8`) | MIT | Converts ESM to CommonJS, for Jest only, through inline config | WI-31 |
| `@fontsource/open-sans` | runtime | exact at install | OFL-1.1 *(inferred from `@fontsource/poppins`)* | Self-hosted Open Sans (C-11, D-2) | WI-42 |
| `@fontsource/raleway` | runtime | exact at install | OFL-1.1 *(inferred, as above)* | Self-hosted Raleway | WI-42 |
| `@fontsource/poppins` | runtime | 5.3.0 | OFL-1.1 | Self-hosted Poppins | WI-42 |
| `muuri` | runtime | 0.9.5, pinned exactly (`"muuri": "0.9.5"`) | MIT | Portfolio filter and layout engine, replacing Isotope (D-16). No dependencies. 83,530 B minified, 23,075 B gzip, against Isotope's 32,475 B and 9,326 B | WI-37 |

**Removed:** `isotope-layout` (WI-37), `boxicons` and `just-validate` (WI-28), `@fortawesome/fontawesome-free` (WI-43).

**Tools run outside `package.json`** (listed for completeness; nothing is added to the repo):

| Tool | Version | License | Use |
| --- | --- | --- | --- |
| `corepack` | 0.36.0 | MIT | Installed globally in CI, in the Linux gate container and in the README steps (D-1) |
| `renovate` | pinned by WI-18 | AGPL-3.0 *(inferred)* | AC-5 and AC-6 via `npx`. Run, never distributed |
| `sharp-cli` | pinned in PR-7 | Apache-2.0 *(inferred)* | One-off image variant generation via `npx` (D-4) |
| `lighthouse` | via `npx` | Apache-2.0 *(inferred)* | M-1 and M-7 measurements (WI-1, release) |

#### Decisions (D-items)

**D-1 — Node line and Corepack.** Node **26** replaces 25.9.0 (resolves D-1; WI-12, WI-13).
- *Why 26:* v26 entered Active LTS on 2026-10-28 and ends on 2029-04-30. v24 moved to maintenance on 2026-10-20.
- *Pins:* `.nvmrc` pins the newest 26.x release at the time WI-12 runs. `netlify.toml` `NODE_VERSION` carries the same exact value. `ci.yml` keeps `node-version-file: .nvmrc`.
- *Corepack:* Node 25 and later do not bundle it, so every environment installs it explicitly:
  - CI, the Linux gate container and the README all run `npm install -g corepack@0.36.0`, then `corepack enable`. In PR-1 only, the Linux gate runs that install on Node 25, outside Corepack's declared engines, because `.nvmrc` moves to 26 only in PR-2 (RK-22). The `node:25` image also ships Yarn 1.22.22 linked at `/usr/local/bin/yarn`, which makes the plain install fail with `EEXIST`. The container therefore first removes the image's Yarn 1 links, and only when they are present (WI-5).
  - `ci.yml` also sets `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` on the job.
  - Netlify installs Yarn from `packageManager`, and its docs mark `YARN_VERSION` deprecated. WI-12 removes `YARN_VERSION`. RK-2 holds the fallback.
- *Lost:* Node 24 still bundles Corepack, but AC-4 and AC-9 require environments without Corepack anyway. It is also already in maintenance.

**D-2 — Fonts.** Self-hosted through Fontsource static packages: `@fontsource/open-sans`, `@fontsource/raleway` and `@fontsource/poppins` (resolves D-2; WI-42).
- *Imports:* `main.js` imports only the latin-subset CSS for the weights the page renders, for example `@fontsource/open-sans/latin-400.css` and `latin-400-italic.css`. Parcel bundles the font files into `dist/`.
- *Starting set:* Open Sans 400, 400 italic, 600 and 700; Raleway 500 and 700; Poppins 400 and 600. WI-42 confirms the set against computed styles before trimming.
- *Display:* Fontsource's default `font-display: swap` meets AC-70.
- *Lost:* hand-downloaded woff2 files have no update path. The Google css2 API keeps Google requests, which C-11 forbids.

**D-3 — Icons.** An inline SVG sprite in `index.html` replaces the Font Awesome webfonts (resolves D-3; WI-43).
- *Source:* one `<symbol>` per icon in use, copied from `@fortawesome/fontawesome-free@7.3.1/svgs/`, plus `pause`, `play` and `xmark`. The Font Awesome Free license comment is kept with the sprite.
- *Markup:* each `<i>` becomes `<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-…"></use></svg>`.
- *Removed:* the three Font Awesome CSS imports and the `@fortawesome/fontawesome-free` package.
- *Why:* the shapes stay the same (A-12). It costs 0 bytes of JS and works without JS. It fits a CSP with no inline styles, because the sprite container is hidden by a class.
- *Lost:* Font Awesome's SVG core adds about 20 KB of JS. It also injects a `<style>` element unless configured otherwise, and renders nothing without JS.

**D-4 — Images.** Variants are generated once and committed as source files. `sharp-cli` runs once through `npx`, so the build gains no image dependency (resolves D-4; WI-44).
- *Hero:* landscape 1280, 1920 and 2560 px wide, plus a 1080 × 1920 portrait crop for phones, each in AVIF and WebP. One JPEG at 1920 px is the fallback. CSS chooses among them with `image-set()` inside media queries, which keeps today's `background-attachment: fixed` effect at 1024 px and wider.
- *Profile:* a real square crop, not CSS alone, served with `srcset` at 240, 480 and 720 px. `aspect-ratio: 1; object-fit: cover` remains as a guard (AC-78).
- *Testimonials:* 180 × 180 crops.
- *Every image:* `<img>` gets `width` and `height`. Every image below the first screen gets `loading="lazy" decoding="async"`.
- *Lost:* Parcel's `?as=webp&width=` query transforms need `sharp`, a native dependency that Parcel auto-installs. That would break `yarn install --immutable` in CI and on Netlify. *(verified 2026-11-17 via Context7 `/parcel-bundler/website`, image recipe)*

**D-5 decision:** production does not serve source maps.

The `build` script gains `--no-source-maps` (resolves D-5; WI-59). Local `yarn start` keeps its maps. *(Flag verified 2026-11-17 via Context7 `/parcel-bundler/website`, targets page.)*

**D-6 — CSP text and reporting.** The report-only policy that WI-58 ships (resolves D-6):

`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.web3forms.com; frame-src https://www.google.com; form-action https://api.web3forms.com; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`

- *Why each source:*
  - `img-src data:` covers the SVG data URIs in Bootstrap's CSS.
  - `frame-src` covers the Maps embed, which C-3 keeps.
  - The two Web3Forms sources cover the form's fetch and its no-JS post.
- *Left out on purpose:* `upgrade-insecure-requests` and `sandbox`. Browsers ignore them in a report-only policy and log a console message. That message would fail AC-83.
- *Reporting:* violations go nowhere beyond the browser console in sprint 1. No `report-uri` or `report-to` is set, because no collector exists and adding one adds a third party. The signal is the AC-83 full visit, run locally and live (RK-18). A collector is a decision for the enforcement step (NG-9).

**D-7 — Advisories and `latest` pins** (resolves D-7; WI-23).
- *Pins:* all six `latest` devDependencies get the exact versions locked today. On 2026-11-17, `yarn.lock` read:

  | Package | Locked version |
  | --- | --- |
  | `@eslint/js` | 10.0.1 |
  | `eslint` | 10.2.0 |
  | `eslint-config-prettier` | 10.1.8 |
  | `eslint-plugin-prettier` | 5.5.5 |
  | `globals` | 17.5.0 |
  | `prettier` | 3.8.3 |

  WI-23 re-reads the lockfile at change time.
- *Advisories:* first `yarn up -R` on each flagged package to refresh its transitive versions. Then add a `resolutions` entry only for an advisory still open, and only where a fixed release exists in a compatible major. Each entry is listed with its advisory ID in the PR.
- *Check:* `yarn npm audit --all --recursive --environment all --severity high`. *(Flags verified 2026-11-17 via Context7 `/yarnpkg/berry`: `-A,--all`, `-R,--recursive`, `--environment` all, production or development, and a severity filter. Verified against `master` source, not the 4.18.1 tag. AC-87's test runs the command on 4.18.1.)*

**D-8 — Required check and Renovate rule** (resolves D-8; WI-21, WI-19).
- *Ruleset:* a dedicated repository **ruleset**, not classic branch protection. Classic protection has no disabled-but-ready state; rulesets have `enforcement: disabled`.
  - Name: `main: require Test & Build`.
  - Target: `~DEFAULT_BRANCH`.
  - One `required_status_checks` rule with context `Test & Build`.
  - Enforcement: `disabled`.
  - The General Ruleset (`15072163`) is never edited. Fred confirmed the new dedicated ruleset at Gate 2. WI-1 records the General Ruleset's snapshot in PR-1, and AC-3 compares it at release.
- *Renovate:* `renovate.json` gains a last `packageRules` entry: `{ "description": …, "matchPackageNames": ["bootstrap"], "groupName": "bootstrap", "automerge": false }`. Its own group keeps a Bootstrap prerelease out of a shared, all-or-nothing branch. Its last position makes it win over earlier rules. *(Rule precedence verified 2026-11-17 via Context7 `/websites/renovatebot`, `packageRules`: "later rules may override configuration options from earlier ones".)*

**D-9 — Runtime-sync defect and stale PRs** (resolves D-9; WI-14–WI-17, WI-66).
- *Script:* the inline heredoc moves to `scripts/sync-runtime-versions.mjs`. Its registry lookups can be injected for tests.
  - It writes a file only when that file's content changes, and exits 0 when nothing changed.
  - It updates every `NODE_VERSION` occurrence.
  - It updates `YARN_VERSION` only if the key is present, since WI-12 removes it.
- *Workflow:* `sync-runtime-versions.yml` calls the script. The `create-pull-request` step already does nothing when there is no diff.
- *PR #56:* closed as superseded. It targets the 25.x and 4.17 pins and the old script.
- *PR #68:* closed as superseded. If its update is still wanted, Renovate raises it again with a consistent lockfile (`rangeStrategy: update-lockfile`). Neither PR is merged.

**D-10 — Local gate and evidence format** (resolves D-10; WI-2–WI-5).
- *Runner:* `yarn gate` runs `node scripts/gate.mjs`, which runs the six gate commands in order. The smoke command is `yarn test:smoke`. The runner stops at the first non-zero exit and marks the remaining steps `not run`.
- *Evidence of record:* `yarn gate:linux` runs the same runner inside a `node:<.nvmrc major>-bookworm` container on Docker Desktop, in a fresh clone of `origin` checked out at the pushed `HEAD` (WI-5). Nothing from the host's working tree is mounted.
- *Posting:* whoever ran the gate posts its output as a PR comment with `gh pr comment <n> --body-file <file>`. Commenting is open to every agent. The PR Agent puts the slug `stabilize-and-cleanup` in every sprint-1 PR body.
- *Release:* the Windows host run is required at release (AC-1) and recommended on every PR. At release it runs through the S5 `windows-fresh-clone.test.js`, which calls `node scripts/gate.mjs --fresh-clone <origin> --ref <sha> --autocrlf` (WI-3, WI-65).
- *Windows host precondition:* Fred's Windows host has Node 26.13.1 on PATH, but neither `yarn` nor `corepack` *(checked 2026-11-17 by the coordinator: `command -v yarn corepack` found neither, and `node --version` printed `v26.13.1`; A-3 records the same)*. Every `yarn …` run on the host, whether by Fred or by an agent working in a worktree there, needs the D-1 install done once beforehand: `npm install -g corepack@0.36.0`, then `corepack enable`. That is the same command pair as CI, the container and the README. Node 26.13.1 is inside `corepack@0.36.0`'s engines (`>=26.0.0`). If the install stops with `EEXIST` on a `yarn` or `yarnpkg` file, as it does where a Yarn 1 is installed (RK-22), remove that Yarn 1 first and run the install again. Phase 0 hit `EEXIST` and was met with `npm install -g --force corepack@0.36.0` *(reported by the coordinator, 2026-11-18)*. The precondition is judged by its outcome, the check below, not by which install command was used. It is a Phase 0 gate (§3.5), and it is checked in two places:
  - **`gate.mjs` preflight** (WI-4). Before step 1, in the directory the steps will run in (the fresh clone, when there is one), it runs `yarn --version` and compares the result with the `packageManager` version. On a mismatch or a failure it prints `Gate precondition: Yarn <version> through Corepack is not available. Run npm install -g corepack@0.36.0, then corepack enable.` to stderr, writes no block, and exits 69. It also sets `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` for its steps unless the variable is already set, so Corepack never waits on a prompt.
  - **`windows-fresh-clone.test.js`** (WI-3). It reads that exit 69 and fails with the same message.
- *Format:* the exact v1 format, which AC-2 parses:

```markdown
<!-- gate-evidence:v1 -->
### Gate evidence: stabilize-and-cleanup
- Commit: `<40-hex SHA>`
- Environment: `<label, e.g. linux node:26 container | windows host>`
- Node: `<node --version>` · Yarn: `<yarn --version>`

| # | Command | Exit code |
| --- | --- | --- |
| 1 | `yarn install --immutable` | 0 |
| 2 | `yarn lint` | 0 |
| 3 | `yarn format:check` | 0 |
| 4 | `yarn test:ci` | 0 |
| 5 | `yarn build` | 0 |
| 6 | `yarn test:smoke` | 0 |
```

**D-11 — Playwright setup** (resolves D-11; WI-6).
- *Browser:* Chromium only. The `phone` viewport uses `devices['iPhone 13']` metrics (390 × 844, DPR 3, touch, mobile) on Chromium. A single `chromium` project; each test sets its viewport from the AC Conventions through `tests/e2e/viewports.js`.
- *Server:* `scripts/serve-dist.mjs` serves `dist/` over `node:http` on `127.0.0.1:4173`, with no server dependency. It applies the `[[headers]]` blocks of `netlify.toml` (parsed with `smol-toml`), so the local target carries the same CSP report-only header as Netlify. That is AC-83's local harness.
  - `webServer` starts the server only when `BASE_URL` is unset.
  - `BASE_URL=https://fs3portfolio.netlify.app` runs the live target.
- *Tags:*
  - `@slow`: kept out of the smoke command, per Q-12(g). Covers AC-44, AC-109 to AC-112 and AC-114.
  - `@live`: also run against the live target.
  - `@build`: reads `dist/` and needs no browser.
- *Scripts:*
  - `test:smoke`: `playwright test --grep-invert @slow`. This is gate step 6.
  - `test:e2e:slow`: `playwright test --grep @slow`.
  - `test:e2e:live`: `BASE_URL=https://fs3portfolio.netlify.app playwright test --grep @live`. Yarn's portable shell handles the variable on Windows.
- *CI:* wired into `ci.yml` (WI-12), so `Test & Build` equals the gate once Actions returns.
- *Baselines:* no screenshots (C-32). The baseline is the assertions in `tests/e2e/`. `test-results/` and `playwright-report/` are git-ignored.
- *Web3Forms guard:* an auto fixture routes `https://api.web3forms.com/**` to `abort()` at context level for every test, and records each request it aborts. A test's own `page.route` mock takes precedence. After each test the fixture asserts that it recorded nothing (AC-90).

**D-12 — `require` → `import` without breaking Jest** (resolves D-12; WI-31, WI-32).
- *Source:* `utils.js` switches to ES named exports, and `main.js` imports `./utils.js` by name.
- *Jest:* `jest.config.js` gains `transform: { '\\.[jt]s$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]], configFile: false, babelrc: false }] }`. The Babel config lives inline on purpose: a `babel.config.*` or `.babelrc` file would make Parcel switch its own JS pipeline to Babel.
- *Coverage:* still `src/js/utils.js` only (C-25).
- *Lost:* native ESM in Jest still needs `--experimental-vm-modules` and `"type": "module"`, which would break `jest.config.js`'s CommonJS.

**D-13 — Scroll listener** (resolves D-13; WI-33). A `{ passive: true }` scroll listener coalesces events through `requestAnimationFrame`. Section, nav-link and back-to-top references are queried once at init and cached, so no per-frame `querySelectorAll` runs (AC-32). The active-section rule (`scrollY + 200` inside a section) and the 100 px back-to-top threshold stay as they are (AC-33, AC-34). *Lost:* `IntersectionObserver` changes the active-section semantics, and jsdom does not implement it, which costs unit-testability. Sprint 3 may move this to ScrollTrigger anyway.

**D-14 — Carousel pause control** (resolves D-14; WI-52).
- *Control:* a visible `<button type="button" class="testimonials-autoplay-toggle">` inside `#testimonials`, next to the pagination. Its name and icon read `Pause testimonials` while rotating and `Play testimonials` while paused.
- *Pausing:* `autoplay.pauseOnMouseEnter: true`. Autoplay also pauses while focus is inside the carousel and resumes on focus-out, unless the visitor paused it.
- *Reduced motion:* under `prefers-reduced-motion: reduce`, autoplay never starts and the button reads `Play testimonials`. A `matchMedia` `change` listener applies a live change.
- *Loop:* `loop: true` becomes `loop: false, rewind: true`. That removes the loop warning at every width (AC-114) and keeps rotation where slides are off-screen.

**D-15 — Closed nav out of the tab order** (resolves D-15; WI-50). CSS `visibility: hidden` on the closed `#header` below 1200 px, using `transition: left .5s, visibility 0s .5s` so the slide-out animation stays. `.mobile-nav-active #header` sets `visibility: visible` at once. It is pure CSS, with no resize listener to keep a JS `inert` flag in sync across the 1200 px boundary. *Lost:* `inert` needs JS to track the breakpoint and the open state.

**D-16 — Isotope replacement: Muuri** (resolves D-16; WI-37). Fred chose Muuri at Gate 2, overriding the Architect's "no library" recommendation. The candidate comparison is kept below as the record.

- **Package and import:**
  - `muuri` is pinned exactly to `0.9.5`.
  - `main.js` uses `import Muuri from 'muuri';`. Parcel resolves the package's `module` field to `dist/muuri.module.js`, because the package has no `exports` map.
  - `yarn remove isotope-layout` runs in the same change.
- **Markup.** Muuri needs an outer item for positioning and a first direct child whose visibility it animates. Today's markup already has that shape:
  - `.portfolio-container` is the grid element.
  - `.portfolio-item` (`col-lg-4 col-md-6`) is the item.
  - `.portfolio-wrap` is the item content.
  - Items gain `data-category` and `data-portfolio-id` (§3.3).
- **Coexisting with the Bootstrap grid:**
  - The `col-lg-4 col-md-6` classes stay. Item widths remain Bootstrap's 33.333%, 50% and 100%, with the `.row > *` gutter padding inside each item.
  - `position: absolute` applies **only once Muuri has initialized**: `.portfolio-container.muuri { position: relative }` and `.portfolio-container.muuri > .portfolio-item { position: absolute }`. Until then, and with JS off, the items flow in the Bootstrap row and are all shown.
  - An absolutely positioned item's percentage width resolves against the relative container, so the widths are the same in both states.
  - Muuri's default layout (`fillGaps: false`, left to right, top first) places equal-sized items exactly where the flow row put them. The switch to absolute therefore moves nothing. *(Inferred; AC-76 and AC-121 check it.)*
  - `layoutOnResize` (150 ms) runs `refreshItems().layout()`, so the columns follow the Bootstrap breakpoints. *(Verified in the source.)*
  - `.portfolio .portfolio-item { margin-bottom: 30px }` stays. Muuri includes item margins in its layout.
- **Image sizing before the first layout (CLS):**
  - WI-37 adds `width="800" height="600"` to the nine portfolio `<img>` elements, ahead of WI-44's site-wide pass. With `.img-fluid` (`max-width: 100%; height: auto`), each item's height is known from those attributes before the image loads, so Muuri's first layout uses the final heights.
  - As a guard, a `window` `load` handler runs `grid.refreshItems().layout(true)`. `true` means instant, so nothing animates if a height changed.
  - The portfolio sits below the first screen at every AC viewport, so even a residual shift falls outside the viewport that CLS scores (AC-76 ≤ 0.1).
- **Transitions.** Muuri requires items with no CSS transitions. `transition` is removed from `.portfolio-wrap`, which today transitions `all`. Hover transitions stay only on the overlay `::before` (`opacity`) and on the action links. Neither changes during a filter.
- **Filtering:**
  - `grid.filter(selector, options)`. The selector is `.portfolio-item` for All and `[data-category="<x>"]` otherwise.
  - `portfolioFilterOptions(prefersReducedMotion)` reads `matchMedia('(prefers-reduced-motion: reduce)')` **on every click**, so a live preference change applies. It returns `{ instant: true, layout: 'instant' }` under reduce, and `{ instant: false, layout: true }` otherwise.
  - The constructor sets `showDuration`, `hideDuration` and `layoutDuration` to `0` when reduce is already set at init, so a resize under reduce does not animate either.
  - Muuri passes `instant` through to show and hide, which then set their styles without animating. *(Verified in the source.)*
  - That is R-81 and AC-124: the final set appears on the first frame, and no animation runs.
- **Hidden items:**
  - Muuri ends a hide by setting `display: none` on the item through the CSSOM. Hidden items leave the tab order and the accessibility tree.
  - DOM order stays the visual order.
  - Drag stays off (the default `dragEnabled: false`), so clicks reach the links.
- **GLightbox:**
  - Links stay `a.glightbox` inside `.portfolio-links`. #69's `resolveLightboxHref` keeps reading the sibling `<img>`.
  - Hidden items' links are `display: none` and cannot be clicked. Every visible item opens the lightbox (AC-120).
  - GLightbox's gallery still includes all nine slides, as it does today.
- **CSP.** Muuri 0.9.5 writes styles only per property (`element.style[prop] = …`) and animates through `element.animate()` (the Web Animations API). It never calls `setAttribute('style')`, never assigns `style.cssText`, and never creates a `<style>` element. CSP `style-src` does not govern either mechanism, so the D-6 policy needs no change. *(Verified 2026-11-17 by reading `unpkg.com/muuri@0.9.5/dist/muuri.module.js` in three windows: `setStyles`, `ItemVisibility._finishHide`, the resize handler, `filter`.)*
- **Sprint 3 (GSAP) interaction:**
  - Muuri owns `transform` on `.portfolio-item` (position), `opacity` and `transform` on `.portfolio-wrap` (visibility), and `display` on hidden items.
  - GSAP must not animate any of those properties on those elements. That is gsap-analysis §5 G5, which applied to Isotope too. Scroll reveals target the section or `.portfolio-container`, never items.
  - gsap-analysis §7 step 7 (Isotope → GSAP Flip) no longer applies while Muuri stays. Replacing Muuri with Flip later would be its own decision.
  - Anything that changes the container's width outside a window resize must call `grid.refreshItems().layout()`.
- **Cost and maintenance.** About +14 KB gzip net of removing Isotope, against at least 500 KB saved elsewhere (M-2). The last Muuri release was 0.9.5 on 2021-07-09 (RK-20).

#### Facts this plan rests on

**Verified 2026-11-17**

- Node release schedule: v24 `maintenance` 2026-10-20, `end` 2028-04-30; v25 `end` 2026-06-01; v26 `lts` 2026-10-28, `end` 2029-04-30. Fetched `raw.githubusercontent.com/nodejs/Release/main/schedule.json`.
- The official `node:26` image installs neither Yarn nor Corepack (`ENV NODE_VERSION=26.13.1`). Read `nodejs/docker-node` `main/26/bookworm/Dockerfile`.
- `corepack@0.36.0` is MIT, with engines `^22.22.2 || ^24.15.0 || >=26.0.0`. Read from the npm registry.
- Netlify installs Yarn when `packageManager` names it, and marks `YARN_VERSION` deprecated. Read via Context7 `/websites/netlify`, "Manage dependencies". **Not verified:** that this works on a Node line without bundled Corepack (RK-2).
- Typed.js inserts a `<style>` element when `autoInsertCss` is on. It also stops on the last string when `loop: false`, and calls `onComplete`. Read via Context7 `/mattboldt/typed.js` (initializer and `doneTyping` source) and confirmed in the installed `node_modules/typed.js/dist/typed.module.js`.
- GLightbox 3.3.1 calls `setAttribute('style', …)` only when a slide has a title or description, or on zoom and video. It reads titles from `data-*` attributes, not from `title`. Read in `node_modules/glightbox/dist/js/glightbox.js` (`parseConfig`; lines 2861–2878).
- ScrollReveal 4.0.9, `swiper/shared/swiper-core.mjs` and `bootstrap.esm.js` make no `setAttribute('style')` or `<style>` injection matched by `rg`.
- Swiper 14.3.0 emits "Swiper Loop Warning: The number of slides is not enough for loop mode" (`swiper-core.mjs:1688`). It has a `rewind` option. Its A11y module gives clickable bullets `role="button"` and the label "Go to slide N". Read in installed `node_modules/swiper`.
- Bootstrap 5.3.8 reboot sets `[hidden] { display: none !important; }`. Read in installed `bootstrap.css:598`.
- Renovate `dependencyDashboard` is `type: boolean`, and `config:recommended` enables the dashboard by default. Read via Context7 `/websites/renovatebot`. #69 at `1988128` drops the key, so nothing in this plan sets it.
- Muuri 0.9.5:
  - MIT, with no dependencies. `module` is `dist/muuri.module.js`, and the package has no `exports` map. Read from the npm registry packument.
  - Its default options include `containerClass: 'muuri'`, `itemClass: 'muuri-item'`, `itemVisibleClass: 'muuri-item-shown'`, `itemHiddenClass: 'muuri-item-hidden'`, `layoutOnResize: 150` and `layout.fillGaps: false`.
  - An item must be an outer element whose first direct child is the visibility-animated content.
  - The grid element must be positioned, and items absolutely positioned with no transitions.
  - The last three points were read via Context7 `/haltu/muuri` (`grid-constructor.md`, `getting-started.md`).
  - The source shows:
    - styles set per property;
    - `element.animate()` for animation;
    - no `setAttribute('style')`, `cssText` or `<style>` creation;
    - `_finishHide` sets `display = 'none'`;
    - the resize handler runs `grid.refreshItems().layout()`;
    - `filter` passes `instant` to show and hide;
    - the constructor adds `containerClass`.

    Read in `unpkg.com/muuri@0.9.5/dist/muuri.module.js`.
- Parcel's image transformer relies on `sharp`, which Parcel auto-installs. `--no-source-maps` exists. Read via Context7 `/parcel-bundler/website`.

**Verified 2026-11-17, for the pre-execution revision**

- ESLint 10.2.0, the locked version, exits 2 when given `src/css`: it lints only JS, and no file there is one it lints. Checked by the coordinator with `node node_modules/eslint/bin/eslint.js src/css`.
- `@playwright/test` 1.65.1 with one spec file that declares no tests: `playwright test` exits 1 (`Error: No tests found`), `playwright test --pass-with-no-tests` exits 0, and `playwright test --list` exits 1. Checked by the coordinator in a scratch project.
- *(2026-11-18)* With `JEST_WORKER_ID` set, `npx playwright test --list` refuses to load tests ("Playwright Test needs to be invoked via 'npx playwright test' and excluded from Jest test runs") and also prints `Error: No tests found`, listing 0 tests; without the variable, the same command in the PR-1 worktree lists 13. Reproduced by the coordinator in the PR-1 worktree. So `No tests found` alone does not prove an empty suite (WI-7).
- A linked git worktree's `.git` is a file, `gitdir: C:/Repo/PortfolioPage-FS3/.git/worktrees/<name>`. A Linux container cannot resolve that Windows path. Checked by the coordinator on the existing worktree, and read by the Architect in `.claude/worktrees/interesting-hellman-6f9b10/.git`.
- `corepack@0.36.0` declares engines `^22.22.2 || ^24.15.0 || >=26.0.0`, which excludes Node 25. Checked by the coordinator with `npm view corepack@0.36.0 engines`.
- Fred's Windows host has Node v26.13.1 on PATH, and neither `yarn` nor `corepack`. Checked by the coordinator with `command -v yarn corepack` and `node --version`. A-3 says the same.
- npm treats `engines` as advisory: unless `engine-strict` is set, a mismatch logs an `EBADENGINE` warning and the install proceeds. Under `--force`, `checkEngine` discards the Node version, so no `EBADENGINE` is raised at all. Read via Context7 `/npm/cli` (`package-json.md`, `engines`; arborist `#checkEngineAndPlatform`; `npm-install-checks` `checkEngine`).
- *(2026-11-18)* `node:25-bookworm` ships Yarn 1.22.22: `/usr/local/bin/yarn` is a symlink to `/opt/yarn-v1.22.22/bin/yarn`, and `yarn --version` prints `1.22.22`. `node:26-bookworm` has no `/usr/local/bin/yarn`, and `yarn` is not found. On `node:25`, `npm install -g corepack@0.36.0` fails with `npm error code EEXIST … File exists: /usr/local/bin/yarn`. Checked by the coordinator with `docker run --rm node:<25|26>-bookworm sh -c 'ls -l /usr/local/bin/yarn; yarn --version'`, and seen in PR-1's run.
- *(2026-11-18)* The docker-node Dockerfile creates both links: `ln -s /opt/yarn-v$YARN_VERSION/bin/yarn /usr/local/bin/yarn` and `ln -s /opt/yarn-v$YARN_VERSION/bin/yarnpkg /usr/local/bin/yarnpkg`, with `YARN_VERSION=1.22.22`. Read by the Architect in `nodejs/docker-node` `main/24/bookworm/Dockerfile`; `main/25/` returned 404, since 25 is end of life. That the `node:25` image has the `yarnpkg` link too is *inferred* from the same template; WI-5's removal step handles either case.
- Yarn Berry resolves conflict markers in `yarn.lock` during `yarn install` (YN0049, YN0048). It reads the two sides through `git rev-parse MERGE_HEAD HEAD` or `REBASE_HEAD`, so it must run before the merge is committed (YN0083). Under `--immutable` it refuses (YN0047). Read via Context7 `/yarnpkg/berry`, error-codes reference.
- `initTyped`, `initTestimonialsCarousel` and `initContactForm` all live in `src/js/main.js` (lines 39, 79 and 143 on `main` at `1dc41e6`). Read with a search of `src/js`. This is why WI-52, WI-53 and WI-54 no longer run in parallel.
- Nothing in `src/js` or `src/index.html` imports `boxicons` or `just-validate`. `main.js:18-20` imports the three Font Awesome CSS files, and `index.html:17` is the Google Fonts `<link>`. Read with a search of `src`.

**Inferred, not verified, and checked by the work itself**

- Lightning CSS resolves `url()` inside `image-set()` as bundle dependencies. WI-44 greps `dist/*.css` for hashed AVIF and WebP names and falls back to plain `url()` per media query.
- Chromium with `isMobile` and `hasTouch` reports `(hover: none)`. AC-43 asserts this as a precondition.
- Renovate's lookup-mode debug log carries each update's resolved `automerge` (RK-16).
- 15368 is the GitHub Actions app ID for the ruleset's `integration_id`. WI-21 checks it with `gh api /apps/github-actions --jq .id`.
- Muuri's default layout puts nine equal-sized items where the Bootstrap flow row put them, so initializing moves nothing (AC-76, AC-121).
- The General Ruleset (`15072163`) holds pull request, CodeQL code scanning and code quality rules. §2 AC-3 states this, and WI-1 confirms it by reading the ruleset live.

### 3.4 Work items

**Test-first under `**Test-first:** acceptance`.** §3.7 lists the 15 chains (A–O) and their seams. Every below-browser AC sits in one of them.

- **Stubs.** Twelve chains have no stubs item, because their seam already exists: a tracked file, `dist/`, a GitHub API, or the live site. The tests run against it and fail on the assertion. Only the three new surfaces get stubs: chain A's gate runner (WI-2), chain C's smoke command (WI-6) and chain E's sync module (WI-14). A stubs item that creates nothing would be a bucket. Fred accepted this deviation at Gate 2.
- **Unit tests** stay test-after: WI-34, WI-39 and WI-45.
- **E2E ACs** are test-after: WI-35, WI-40, WI-46, WI-51, WI-55, WI-60 and WI-61.

**Where tests live** (named again in §3.7):

| Suite | Location and runner | Runs in |
| --- | --- | --- |
| **S1** | `__tests__/acceptance/` (Jest) | The gate, as step 4 |
| **S2** | `tests/e2e/` (Playwright) | The gate, as step 6 |
| **S3** | Playwright `@slow` | Motion PRs and release |
| **S4** | Playwright `@live` | Against the live site |
| **S5** | `__tests__/release/` (Jest via `jest.release.config.js`) | `yarn verify:release`. Network, `gh`, Docker and live checks, at release and on demand. Not in the gate |

S1 tests implement the Conventions' tracked-file search in Node (`git ls-files` plus a regex), not by shelling out to `rg`, because `rg` is absent from the Linux container. They parse HTML with jsdom's `DOMParser` (`@jest-environment jsdom`), CSS with PostCSS, and YAML and TOML with `yaml` and `smol-toml`.

#### Phase 0 — preconditions

#### WI-1 — Capture the pre-sprint live baselines

- **domain:** `tests`
- **depends-on:** none. It must finish before PR-1 merges, because PR-1's merge is the first sprint-1 deploy.
- **satisfies:** AC-73 (the "before" side), AC-3 (the General Ruleset snapshot). It also records the baselines for M-1, M-2 and M-7.
- **change:** No repo file.
  - **Live site,** `https://fs3portfolio.netlify.app/` after #69 deploys:
    - full-page screenshots at `small` and `desktop`
    - a Playwright HAR at `phone` with an empty cache (M-2)
    - one Lighthouse mobile run through `npx` (M-1 LCP, M-7 accessibility score)
  - **General Ruleset snapshot,** for AC-3: read `gh api repos/ValhallaTech/PortfolioPage-FS3/rulesets/15072163` and post it as a PR-1 comment. The block is `<!-- ruleset-snapshot:15072163 -->` followed by a fenced JSON object `{ "enforcement": …, "ruleTypes": [sorted .rules[].type] }`, plus the capture date.

  Everything is attached to PR-1 as comments.
- **done when:** PR-1 has a comment with both screenshots, the HAR's total transferred bytes, the LCP and the accessibility score, each with its capture date. It also has the ruleset-snapshot comment, whose `ruleTypes` contains no `required_status_checks`.

#### Phase 1 — gate foundation (PR-1)

#### WI-2 — Stub the local gate runner

- **domain:** `backend`
- **depends-on:** none
- **satisfies:** AC-1, AC-2 (seam)
- **change:** Add `scripts/gate.mjs` with the CLI that §3.7 chain A names, including the `--commands-file` format defined there. The stub accepts every flag in the seam and ignores the content of the commands file. It prints the v1 evidence header (marker, commit SHA, environment, Node and Yarn lines) and an empty step table to stdout, writes the same text to `--out <file>` when given, then exits 0. Add the `package.json` scripts `gate` (`node scripts/gate.mjs`) and `gate:linux` (prints "not implemented" and exits 0).
- **done when:** `node scripts/gate.mjs --commands-file <json> --out <file>` runs, prints the header for `HEAD`, and writes it to the file, and the flags match the chain A seam.

#### WI-3 — Acceptance tests for the gate, plus the release-suite harness

- **domain:** `tests`
- **depends-on:** WI-2
- **satisfies:** AC-1, AC-2
- **change:**
  - **S5 harness:** add `jest.release.config.js` (`testEnvironment: 'node'`, roots `__tests__/release`, no coverage, long timeout) and the script `verify:release`. Add `/__tests__/release/` to `testPathIgnorePatterns` in `jest.config.js`.
  - **Parser package:** add `yaml` (dev, exact pin). WI-11 and WI-24 use it in PR-2 and PR-4. Adding it here, in PR-1, means neither of those parallel PRs adds a package, and WI-24 no longer waits on PR-2.
  - **S1 `gate-evidence.test.js`:** runs the runner with `--commands-file` fixtures in the chain A format and `--out <tmp file>`, then asserts the v1 block read from that file:
    - **All pass:** six `node -e "process.exit(0)"` commands. Expects the SHA line equal to `git rev-parse HEAD`, the six canonical command names in order, six `0` exit codes, and process exit 0.
    - **Fail at step 3:** steps 1 and 2 exit 0, step 3 runs `node -e "process.exit(3)"`, and step 4 writes a marker file. Expects exit codes `0`, `0`, `3`, then `not run` for steps 4 to 6, process exit 3, and no marker file.
    - **Usage error:** a file holding five strings. Expects exit 64, a message on stderr, and no block.
  - **S5 `pr-gate-evidence.test.js` (AC-2):** first asserts that the AC-2 search returns at least one merged PR, failing with "AC-2: no merged sprint-1 PR found" otherwise, so it never passes on an empty set. Then, for each PR, it requires a v1 block whose SHA equals `headRefOid` and shows six zero exit codes.
  - **S5 `windows-fresh-clone.test.js` (AC-1):** it never skips, and every failure below is an `expect` with the message shown, never a thrown error.
    1. **OS:** on anything but `win32` it fails with "AC-1 must run on Windows".
    2. **Release SHA:** the env `AC1_REF`, if set, is the SHA under test. WI-65 sets it to the PR-12 merge SHA, because AC-1 runs before the tag is created. The test also reads the peeled tag with `git ls-remote origin refs/tags/4.0.0^{}`.
       - If `AC1_REF` is unset, the tag's SHA is used.
       - If both exist, they must be equal, which proves the tag landed on the commit that was tested.
       - If neither exists, it fails with "AC-1: no release commit yet: tag 4.0.0 is not on origin and AC1_REF is unset".
    3. **Run:** it runs the runner with `--fresh-clone https://github.com/ValhallaTech/PortfolioPage-FS3 --ref <SHA> --autocrlf --out <tmp file>`.
       - If the runner exits 69, it fails with the D-10 Windows host precondition message.
       - Otherwise it expects the block's exit codes to be `[0,0,0,0,0,0]` and its SHA line to equal the SHA under test.
- **done when:** against the stub, these fail on their assertions, and none fails on an error:
  - the S1 test, on no step rows, and on exit 0 where 3 and 64 are expected;
  - the S5 AC-2 test, on its non-empty assertion, because no sprint-1 PR has merged yet;
  - the S5 AC-1 test, run on Fred's Windows host, on "no release commit yet", because tag `4.0.0` does not exist and `AC1_REF` is unset.

  The PR records all three red runs. The AC-1 test then stays red until WI-65 (§3.5 rule 4).

#### WI-4 — Implement the local gate runner

- **domain:** `backend`
- **depends-on:** WI-3
- **satisfies:** AC-1, AC-2
- **change:** `scripts/gate.mjs` runs the six commands with `shell: true` and inherited stdio, and captures each exit code. It stops at the first failure.
  - It writes the v1 block to stdout, and to `--out <file>` when given.
  - It exits with the first non-zero code, or 0.
  - `--fresh-clone <url> --ref <sha> [--autocrlf]` clones into a temp directory (`-c core.autocrlf=true` when the flag is set) and runs there.
  - `--env <label>` fills the Environment line.
  - `--commands-file` exists only for tests. It follows the chain A format: six strings replace the six commands run, the Command column keeps the canonical names, and a malformed file exits 64 with no block.
  - **Preflight:** the D-10 Windows host precondition check. It confirms Yarn through Corepack with `yarn --version` against `packageManager`, exits 69 with the named message if that fails, and sets `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` for the steps. The preflight runs in every mode, including the container and `--commands-file`.
  - **Step environment:** the steps run with `process.env` minus every `JEST_*` variable. When a Jest test starts the runner (`windows-fresh-clone.test.js`, WI-3), step 6 would otherwise inherit `JEST_WORKER_ID`, and Playwright would refuse to load the smoke tests (§3.3 facts, 2026-11-18).
- **done when:** WI-3's S1 test passes, and on Fred's Windows host, with the Phase 0 Corepack precondition met, `yarn gate` prints a v1 block for `HEAD`. In PR-1 that host run uses Node 26 while `.nvmrc` still declares 25.9.0. That is acceptable, because the host run is a recommended check, and `gate:linux` is the evidence of record (D-10).

#### WI-5 — Linux gate container wrapper

- **domain:** `docker`
- **depends-on:** WI-4, WI-6 (it reads the `@playwright/test` pin that WI-6 adds, and both change `package.json`)
- **satisfies:** AC-2 (the environment of record)
- **change:** Add `scripts/gate-linux.mjs` and point `gate:linux` at it. It works the same from the main checkout and from a linked worktree, where every sprint branch is worked.
  - **Host checks.** It refuses to run, with a message and before starting Docker, in two cases:
    - The working tree is dirty, because evidence is per commit.
    - `HEAD` is not pushed. After `git fetch origin`, `git rev-parse HEAD` must equal `git rev-parse @{u}`. AC-2 compares the evidence with `headRefOid`, which exists only once the commit is on GitHub.
  - **Inputs.** It reads the `.nvmrc` major M and the `@playwright/test` pin from the commit itself (`git show HEAD:.nvmrc`, `git show HEAD:package.json`).
  - **Container.** It runs `docker run --rm` on `node:M-bookworm` with **no bind mount of the repo**:
    - Inside the container: `git clone https://github.com/ValhallaTech/PortfolioPage-FS3.git /work`, then `git -C /work checkout --detach <SHA>`. The clone is full, not shallow, so `git tag --list` in AC-103's S1 test sees the tags. If the SHA is missing from the clone, the run fails, and that is never recorded as a pass.
    - **Image Yarn 1, removed only when present.** For each of `/usr/local/bin/yarn` and `/usr/local/bin/yarnpkg`: if it is a symlink whose target starts with `/opt/yarn-v`, remove it and print `removed image Yarn 1 link <path> -> <target>`. Anything else at that path is left alone, and the install below then fails loudly. `node:25-bookworm` has these links (Yarn 1.22.22); `node:26-bookworm` has none, so on Node 26 this step changes nothing. The same command works on both images.
    - Then `npm install -g corepack@0.36.0` (no `--force`), `corepack enable`, and `npx --yes playwright@<pin> install --with-deps chromium`.
    - Then `node scripts/gate.mjs --env "<label>"` in `/work`. The label starts as `linux node:M container`, and up to two notes are added to it, in this order:
      - `, image Yarn 1 links removed`, if the removal step removed anything;
      - `, corepack@0.36.0 outside its engines`, if the Corepack install printed `EBADENGINE`.

      In PR-1 the label therefore reads `linux node:25 container, image Yarn 1 links removed, corepack@0.36.0 outside its engines`. From PR-2 on, it is plain `linux node:26 container` (RK-22). The removal lines also appear in the run's output above the block.
    - *Why not `npm install -g --force`:* `--force` overwrites whatever owns a conflicting path, not just the two known links. It also turns off npm's engines check, because `checkEngine` discards the Node version under `force` *(verified 2026-11-17 via Context7 `/npm/cli`, `npm-install-checks` `checkEngine`)*. With `--force`, the `EBADENGINE` warning that RK-22's label relies on would never print.
  - The named volumes `portfolio-gate-playwright` (`PLAYWRIGHT_BROWSERS_PATH`) and `portfolio-gate-yarn` (Yarn cache) keep reruns fast.
  - **Why not a bind mount.** A linked worktree's `.git` is a file naming `C:/Repo/PortfolioPage-FS3/.git/worktrees/<name>`, a path the container cannot resolve, so `git clone /src` fails there *(checked 2026-11-17 by the coordinator on the existing worktree, and read by the Architect in `.claude/worktrees/interesting-hellman-6f9b10/.git`)*. Mounting the main repo's `.git` instead would work offline, but it could produce evidence for a commit that was never pushed, which no PR's `headRefOid` can match. Cloning from `origin` tests exactly what GitHub holds, which is also how AC-1 and AC-4 phrase their fresh clone.
- **done when:** on Fred's machine, with the Phase 0 Corepack precondition met (the host's `yarn` starts the script), run from a linked worktree after a push, `yarn gate:linux` prints a v1 block whose SHA equals the host `HEAD`, with all six rows present. Run with an unpushed commit, it refuses before starting Docker.

#### WI-6 — Playwright harness, the stub of the smoke command

- **domain:** `tests`
- **depends-on:** WI-3 (both add packages, so they change `package.json` and `yarn.lock` one after the other; §3.5 rule 7)
- **satisfies:** AC-89 (seam), AC-90 (guard)
- **change:**
  - **Packages:** add `@playwright/test` (exact pin) and `smol-toml`.
  - **Config:** add `playwright.config.js` (D-11).
  - **Server:** add `scripts/serve-dist.mjs` (D-11).
  - **Helpers:** add `tests/e2e/viewports.js` and `tests/e2e/fixtures.js`. The fixtures hold the Web3Forms guard and a `pageerror` collector.
  - **Spec:** add `tests/e2e/smoke.spec.js` holding only `import './fixtures.js';` and no tests, so loading the spec also loads the fixtures.
  - **Scripts:** add `test:smoke`, `test:e2e:slow` and `test:e2e:live`. None of them passes `--pass-with-no-tests`, so a smoke command that finds no tests fails gate step 6.
  - **Ignores:** add `test-results/` and `playwright-report/` to `.gitignore`, `.prettierignore` and the ESLint ignores.
- **done when:** both of these hold, and together they show that the config and the fixtures load:
  - `yarn build && yarn test:smoke --pass-with-no-tests` exits 0.
  - `npx playwright test --list` exits 1, and its output contains `No tests found` and no other error.

  With no tests, `playwright test` and `playwright test --list` both exit 1, and only `--pass-with-no-tests` exits 0 *(checked 2026-11-17 by the coordinator with `@playwright/test` 1.65.1 and one empty spec file)*.

#### WI-7 — Acceptance test for the smoke coverage (AC-89)

- **domain:** `tests`
- **depends-on:** WI-6
- **satisfies:** AC-89
- **change:** S1 `smoke-coverage.test.js` runs `npx playwright test --list` through `spawnSync` and reads stdout and stderr together.
  - **Child environment:** the child runs with `process.env` minus every variable whose name starts with `JEST_`. That covers `JEST_WORKER_ID` at least. If Playwright inherits `JEST_WORKER_ID`, it refuses to load the tests ("Playwright Test needs to be invoked via 'npx playwright test' and excluded from Jest test runs"), and it also prints `Error: No tests found` *(reproduced 2026-11-18 by the coordinator in the PR-1 worktree: `JEST_WORKER_ID=1 npx playwright test --list` listed 0 tests, and without the variable it listed 13)*.
  - **Exit handling:**
    - Exit 0 yields the listed titles.
    - Exit 1 yields an empty list only when `Error: No tests found` is the **only** error in the output. That means the line appears, and no other line matches `/error|needs to be invoked|jest/i`. Playwright 1.65.1 exits 1 on `--list` when no test exists (WI-6).
    - Any other exit, or an exit 1 with any other error, fails the test as a harness error and prints the output.
  - **Assertion:** at least one title contains each of the 12 row names: `Layout`, `Mobile nav`, `Grid`, `Dialog open`, `Dialog keyboard`, `Dialog dismiss`, `Submit, success`, `Submit, error`, `Abort on close`, `Color scheme`, `Console`, `Portfolio filter`. The failure message names every missing row.
  - Reading an empty suite as an empty list weakens nothing: an empty list still fails, on all 12 rows.
- **done when:** it fails against WI-6's empty spec on the row assertion, naming the 12 missing rows. It does not fail on the exit code of `--list`. The recorded red run shows the child's `--list` output, in which `Error: No tests found` is the only error. A red run whose output also carries the Jest refusal does not count as red for the right reason.

#### WI-8 — Smoke baseline in Bootstrap 5 form

- **domain:** `tests`
- **depends-on:** WI-7
- **satisfies:** AC-89, AC-91 and AC-92 (the rows they mutate against), AC-1 (smoke command)
- **change:** `tests/e2e/smoke.spec.js` gets the 12 rows with exactly the AC-89 assertions:
  - The submit rows use `page.route` mocks.
  - `Console` asserts no `pageerror` during a full visit, and every test also asserts it through the fixture.
  - `Portfolio filter` asserts today's Isotope-era item sets at `desktop` and `small`, using `toBeVisible` after a 1 s settle. WI-40 rewrites it for the shipped markup.
- **done when:** WI-7's test passes, and `yarn test:smoke` passes against `main`'s build.

#### WI-9 — Acceptance test for the format scope (AC-14)

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-14
- **change:** S1 `format-scope.test.js`:
  - copies the tracked tree to a temp directory with `git archive HEAD | tar -x`
  - links `node_modules` into it
  - appends `a{color:red}` to `src/css/style.css`
  - runs `scripts["format:check"]` from `package.json` with the repo's Prettier binary

  It asserts a non-zero exit and output naming `src/css/style.css`.
- **done when:** it fails today on the assertion, because `format:check` exits 0 since it never reads `src/css`.

#### WI-10 — Cross-platform line endings and lint and format scope

- **domain:** `ci`
- **depends-on:** WI-9, WI-5, WI-8. It goes last in PR-1: its lint and format scope needs `scripts/` and `tests/` to exist, it changes `package.json` and `eslint.config.mjs` after WI-5 and WI-6 have, and its formatting commit must follow every other PR-1 change.
- **satisfies:** AC-14, AC-1 (Windows parity, G-6)
- **change:**
  - **Line endings:** add `.gitattributes` with `* text=auto eol=lf`, plus `binary` for `*.jpg *.jpeg *.png *.webp *.avif *.woff *.woff2`. Run `git add --renormalize .`.
  - **Format scope:** `format` and `format:check` cover `src/js src/css __tests__ tests scripts`. That is what R-12 and AC-14 require.
  - **Lint scope:** `lint` and `lint:fix` cover `src/js __tests__ tests scripts`, **without `src/css`**. ESLint lints only JS, and given `src/css` the locked ESLint 10.2.0 exits 2, because no file there is one it lints *(checked 2026-11-17 by the coordinator: `node node_modules/eslint/bin/eslint.js src/css` exits 2)*. R-12 and AC-14 ask nothing of lint.
  - **ESLint:** `eslint.config.mjs` gives `scripts/**/*.mjs` Node globals. WI-6 has already added the Playwright output folders to the ignores.
  - **Reformat:** one formatting-only commit runs Prettier over `src/css/style.css`, with no other change in that commit.
- **done when:** WI-9's test passes, and `yarn lint && yarn format:check` exit 0 on a Windows clone made with `core.autocrlf=true`.

#### Phase 2 — runtime, automation and toolchain (PR-2, PR-3 and PR-4 in parallel)

#### WI-11 — Runtime acceptance tests

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-4, AC-7, AC-8, AC-9, AC-12
- **change:** It adds no package. `yaml` and `smol-toml` are already on `main` from PR-1 (WI-3, WI-6).
  - **S1 `runtime-pins.test.js`:** AC-7 and AC-12, reading `.nvmrc`, `netlify.toml` (`smol-toml`), `ci.yml` (`yaml`) and `package.json`.
  - **S5 `node-support.test.js`:** AC-8, fetching `schedule.json`.
  - **S5 `ci-steps-linux.test.js`:** AC-4.
    - Runs `docker run node:<major>-bookworm` with no bind mount of the repo. Inside, it makes a fresh clone of `origin` and checks out the SHA under test, as WI-5 does, so it works from a linked worktree. That SHA is the host's `git rev-parse HEAD` and must be pushed; the test fails with a message if it is not.
    - Asserts `command -v corepack` fails before any step.
    - Runs each `yq '.jobs.test.steps[].run'` value in `bash` with the job's `env`.
  - **S5 `readme-install.test.js`:** AC-9. In the same container it runs `npm uninstall -g corepack yarn`. That does not remove an image's own Yarn 1, which is not npm-installed, so it also applies WI-5's rule: it removes `/usr/local/bin/yarn` and `yarnpkg` when they are symlinks into `/opt/yarn-v*`. It then asserts that `command -v corepack` and `command -v yarn` both fail, which is AC-9's Given. Only after that does it run the fenced blocks under `## Install` in order, skipping `nvm use` and `fnm use` lines. It asserts that `yarn --version` equals the `packageManager` version.
- **done when:** AC-8, AC-12, AC-4 and AC-9 fail on their assertions. AC-7 passes today, and stays as a guard.

#### WI-12 — Move to Node 26 and install Corepack explicitly

- **domain:** `ci`
- **depends-on:** WI-11, WI-8
- **satisfies:** AC-4, AC-7, AC-8, AC-12
- **change:**
  - **Pins:** `.nvmrc` gets the newest 26.x. `netlify.toml` `NODE_VERSION` gets the same value, and `YARN_VERSION` is removed.
  - **`ci.yml`:**
    - Job `env` sets `COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'`.
    - A new step `Install Corepack` (`npm install -g corepack@0.36.0`) runs before `Enable Corepack`.
    - After `Build`, two new steps: `Install Playwright Chromium` (`yarn playwright install --with-deps chromium`) and `Smoke tests` (`yarn test:smoke`).
- **done when:**
  - WI-11's S1 tests and S5 AC-4 and AC-8 pass.
  - The Netlify deploy preview for PR-2 succeeds, and its log shows Node 26.x and Yarn 4.18.1 (RK-2).

#### WI-13 — README runtime and Install lines

- **domain:** `docs`
- **depends-on:** WI-12
- **satisfies:** AC-9
- **change:**
  - **Install:** names Node 26 with a pointer to `.nvmrc`, then the commands `npm install -g corepack@0.36.0`, `corepack enable`, `yarn install`.
  - **Corepack sentence:** Corepack is bundled only with Node 14.19 through 24.x.
  - **Deployment table:** the Node and Yarn rows point to `.nvmrc` and `packageManager` instead of repeating literal versions.
- **done when:** WI-11's S5 AC-9 test passes.

#### WI-14 — Stub the extracted runtime-sync script

- **domain:** `backend`
- **depends-on:** none
- **satisfies:** AC-10, AC-11 (seam)
- **change:** Add `scripts/sync-runtime-versions.mjs`, exporting `syncRuntimeVersions({ cwd, fetchYarnVersions, fetchNodeIndex })`. In the stub it resolves `{ changed: false, files: [] }` and touches nothing. The default fetchers wrap today's `npm view @yarnpkg/cli-dist versions --json` and the `nodejs.org/dist/index.json` lookup. The CLI entry calls the function when the file runs directly.
- **done when:** the module imports and the CLI exits 0, and its signature matches §3.7 chain E.

#### WI-15 — Acceptance tests for the runtime sync

- **domain:** `tests`
- **depends-on:** WI-14
- **satisfies:** AC-10, AC-11
- **change:** S1 `sync-runtime-versions.test.js`. It copies `package.json`, `.nvmrc` and `netlify.toml` into a temp git repo and injects stub fetchers.
  - **No drift:** expects exit or resolve without error, and an empty `git status --porcelain`.
  - **Drift:** `.nvmrc` and every `NODE_VERSION` set to `M.0.0`, with the index listing `M.1.0` as latest. Expects both to read `M.1.0`.
- **done when:** the drift case fails on its assertion against the stub, and the no-drift case passes. The stub writes nothing, so that case is already true. The PR records both results.

#### WI-16 — Implement the runtime sync

- **domain:** `backend`
- **depends-on:** WI-15
- **satisfies:** AC-10, AC-11
- **change:** The script ports today's logic: the newest Yarn of the current major, and the newest Node of the `.nvmrc` major.
  - It writes a file only when its content changes.
  - It replaces every `NODE_VERSION` with a global regex.
  - It updates `YARN_VERSION` only if the key exists.
  - It never throws on a no-op.
- **done when:** WI-15 passes.

#### WI-17 — Point the sync workflow at the script

- **domain:** `ci`
- **depends-on:** WI-16
- **satisfies:** AC-10, AC-11 (the workflow side, R-8)
- **change:** The `Update pinned Node and Yarn versions` step in `sync-runtime-versions.yml` becomes `run: node scripts/sync-runtime-versions.mjs`. The PR body text drops the `YARN_VERSION` bullet. Nothing else changes.
- **done when:** `yq '.jobs.sync-runtime-versions.steps[] | select(.name == "Update pinned Node and Yarn versions") | .run'` prints exactly that command.

#### WI-18 — Renovate acceptance tests and harness

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-5, AC-6, AC-108
- **change:**
  - **S5 `renovate-validate.test.js` (AC-5):** runs `npx --yes --package renovate@<pin> -- renovate-config-validator --strict renovate.json`.
  - **S5 `renovate-bootstrap-prerelease.test.js` (AC-6, harness for Q-12(c)):**
    1. In a temp directory, writes the AC-6 variant of `renovate.json` (every rule not naming `bootstrap` set to `automerge: true`) and a `package.json` pinning `"bootstrap": "6.0.0-alpha.1"`.
    2. Starts a stub npm registry on `127.0.0.1` with `node:http`. It serves a `bootstrap` packument with versions `5.3.8`, `6.0.0-alpha.1` and `6.0.0-alpha.2`, `dist-tags` `{ latest: '5.3.8', next: '6.0.0-alpha.2' }`, and no `repository` field, so no changelog fetch happens.
    3. Runs `npx --yes renovate@<pin> --platform=local` there with `RENOVATE_NPMRC=registry=http://127.0.0.1:<port>/`, `LOG_LEVEL=debug` and `LOG_FORMAT=json`.
    4. Reads the `packageFiles with updates` entry for `bootstrap` and asserts `automerge === false` on the `6.0.0-alpha.2` update.
    5. If that log lacks `automerge`, it resolves the same config through the same pinned Renovate package's package-rules module (RK-16).
  - **S1 `renovate-automerge-paused.test.js` (AC-108):** asserts that no `"automerge": true` appears anywhere in `renovate.json`.
- **done when:** AC-6 fails on its assertion. AC-5 and AC-108 already pass on #69's `renovate.json` at `1988128`, which has no `dependencyDashboard` key and automerge paused. They stay as guards.

#### WI-19 — Renovate `bootstrap` rule

- **domain:** `ci`
- **depends-on:** WI-18
- **satisfies:** AC-5, AC-6, AC-108
- **change:** Append the D-8 `bootstrap` rule as the last `packageRules` entry. Do not add a `dependencyDashboard` key, because `config:recommended` already enables the dashboard. Do not touch the paused group rule.
- **done when:** WI-18's three tests pass.

#### WI-20 — Acceptance tests for the ruleset and the superseded PRs

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-3, AC-13
- **change:**
  - **S5 `github-ruleset.test.js` (AC-3):** lists and reads every ruleset via `gh api`, then asserts the following.
    1. **Exactly one** ruleset both targets `main` (`.conditions.ref_name.include` contains `~DEFAULT_BRANCH` or `refs/heads/main`) and has a `required_status_checks` rule whose contexts include `Test & Build`. Other rulesets may also target `main`.
    2. That ruleset's `id` is not `15072163`.
    3. Its `.enforcement` is `disabled`. It is `active` only when the env `ACTIONS_RESTORED=1` is set.
    4. Ruleset `15072163` is unchanged. Its `.enforcement` and its sorted `.rules[].type` list equal the snapshot that WI-1 posted on PR-1. The test finds PR-1 with `gh pr list --state merged --search "stabilize-and-cleanup in:body"` (the lowest number), then parses the `<!-- ruleset-snapshot:15072163 -->` block from its comments.
    5. Ruleset `15072163` has no `required_status_checks` rule.
  - **S5 `superseded-prs.test.js` (AC-13):** asserts that `gh pr view 56|68 --json state` is `MERGED` or `CLOSED`.
- **done when:** the AC-3 test fails on clause 1 today, while clauses 4 and 5 pass against the snapshot. AC-13 fails on its assertion. PR-2 records both runs.

#### WI-21 — Create the disabled `Test & Build` ruleset

- **domain:** `ci`
- **depends-on:** WI-20, WI-1
- **satisfies:** AC-3
- **change:** No repo file. Run `gh api -X POST repos/ValhallaTech/PortfolioPage-FS3/rulesets` to create a **new** ruleset with the D-8 payload: `name: "main: require Test & Build"`, `target: branch`, `enforcement: disabled`, `conditions.ref_name.include: ["~DEFAULT_BRANCH"]`, and one `required_status_checks` rule with `{ context: "Test & Build", integration_id: <GitHub Actions app id> }` and `strict_required_status_checks_policy: false`. **Never** send a `PUT` to ruleset `15072163`, the General Ruleset. It needs a repo-admin token. Record the payload and the returned `id` in PR-2.
- **done when:** WI-20's AC-3 test passes.

#### WI-22 — Dependency acceptance tests

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-87, AC-88
- **change:**
  - **S1 `devdeps-pinned.test.js` (AC-88):** no `devDependencies` value equals `latest`.
  - **S5 `audit.test.js` (AC-87):** runs `yarn npm audit --all --recursive --environment all --severity high` and expects exit 0.
- **done when:** both fail on their assertions today.

#### WI-23 — Pin the toolchain and clear the high and critical advisories

- **domain:** `backend`
- **depends-on:** WI-22
- **satisfies:** AC-87, AC-88
- **change:** The D-7 procedure on `package.json` and `yarn.lock`. Each `resolutions` entry and each advisory it clears is listed in PR-3. If a critical or high advisory cannot be cleared without replacing Parcel, Jest or ESLint, the item halts and reports to Fred (A-15, RK-8).
- **done when:** WI-22's tests pass and the gate stays green.

#### WI-24 — Acceptance tests for the changelog and issue forms

- **domain:** `tests`
- **depends-on:** WI-3, which adds `yaml` in PR-1. It does not depend on WI-11, so PR-4 can run in parallel with PR-2.
- **satisfies:** AC-103, AC-104, AC-105, AC-106
- **change:**
  - **S1 `changelog.test.js` (AC-103):** every tag matching `^\d+\.\d+\.\d+$` from `git tag --list`, plus the `package.json` version, has `^## \[T\] - \d{4}-\d{2}-\d{2}$`. A missing file counts as empty. This passes in the gate at the release commit before the tag exists, and AC-103's full check re-runs at the tag.
  - **S5 `changelog-dates.test.js` (AC-104).**
  - **S1 `issue-forms.test.js` (AC-105, AC-106):** uses `yaml`.
- **done when:** all four fail on their assertions today.

#### WI-25 — Backfill `CHANGELOG.md` for 1.0.0–3.0.0

- **domain:** `docs`
- **depends-on:** WI-24
- **satisfies:** AC-103, AC-104
- **change:** A new `CHANGELOG.md` in Keep a Changelog form, with an `## [Unreleased]` section.
  - One entry per release tag, built from `gh release view T` notes. A tag with no GitHub release takes its tag commit date (C-13, A-14).
  - Headings are dated with the UTC date of `publishedAt`.
  - Compare links at the bottom.
- **done when:** WI-24's AC-103 and AC-104 tests pass for every existing tag.

#### WI-26 — Two issue forms

- **domain:** `docs`
- **depends-on:** WI-24
- **satisfies:** AC-105, AC-106, AC-107
- **change:** Delete `.github/ISSUE_TEMPLATE/issue-ticket-template.md`. Add `bug_report.yml` (`name: Bug report`) and `feature_request.yml` (`name: Feature request`), each with `description`, `labels` and a non-empty `body`. None of the AC-106 words may appear. Keep `config.yml` with `blank_issues_enabled: false`.
- **done when:** WI-24's AC-105 and AC-106 tests pass, and after merge Fred records AC-107 in PR-4.

#### Phase 3 — cleanup and GSAP step 1 (PR-5)

#### WI-27 — Cleanup acceptance tests

- **domain:** `tests`
- **depends-on:** WI-10
- **satisfies:** AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-22, AC-23, AC-25, AC-26, AC-30, AC-31
- **change:** Add `postcss` (dev).
  - **S1 `cleanup.test.js`:** AC-15, AC-16, AC-17, AC-18, AC-19, AC-25, AC-26 and AC-30.
  - **S1 `css-hygiene.test.js`:** AC-20, AC-22 and AC-23, with PostCSS rule blocks and the AC-20 regexes.
  - **S5 `coverage-threshold.test.js` (AC-31):** runs `yarn test:ci --coverageReporters=json-summary` and checks all four metrics of the `src/js/utils.js` entry.
- **done when:** each test fails on its assertion. AC-25 and AC-31 pass today and stay as guards.

#### WI-28 — Remove dead assets and unused packages

- **domain:** `frontend`
- **depends-on:** WI-27
- **satisfies:** AC-15, AC-16, AC-17, AC-25
- **change:**
  - Delete `src/css/icofont.min.css`, `icofont.woff` and `icofont.woff2`, and the `.prettierignore` line that names icofont.
  - Delete `src/images/portfolio-details-1..3.jpg` and `src/images/testimonials/testimonials-1..5.jpg`.
  - Run `yarn remove boxicons just-validate`.
  - Keep `@popperjs/core` (C-17).
- **done when:** WI-27's AC-15, AC-16, AC-17 and AC-25 tests pass and `yarn build` succeeds.

#### WI-29 — README: drop the Boxicons and just-validate rows

- **domain:** `docs`
- **depends-on:** WI-28
- **satisfies:** AC-17
- **change:** Remove the two Tech Stack rows (`README.md:36`, `:42`).
- **done when:** WI-27's AC-17 test passes.

#### WI-30 — Remove dead CSS and fix the invalid declarations

- **domain:** `frontend`
- **depends-on:** WI-27
- **satisfies:** AC-20, AC-22, AC-23, AC-24, AC-26
- **change:** In `src/css/style.css`:
  - **Dead blocks:** delete the frontend-audit §5a blocks: `.facts`, `.skills`, `.resume`, `.breadcrumbs`, `.portfolio-details`, `.php-email-form .loading`, the `animate-loading` keyframes (both forms), `.contact .info .social-links`, `.error-message br + br` and `#hero h2`. **Keep `.validate`** (NG-10).
  - **Form box:** collapse `.php-email-form` and `#contactModal .php-email-form` into one rule.
  - **§5b fixes:**
    - footer `padding: 20px 15px`
    - one `transition: left 0.5s` on `#header`
    - drop `transition: display`, `-moz-text-align-last` and the duplicate `padding`
    - drop the filter `:last-child` rule
    - drop the hover-only `opacity` and the repeated `::before` offsets
  - **Comment:** remove the `:1-6` template header comment.
  - Breakpoints stay as they are (NG-2).
- **done when:** WI-27's AC-20, AC-22 and AC-23 tests pass, the CSS part of AC-26 passes, and the smoke suite still passes.

#### WI-31 — Jest ESM support and unit-test updates

- **domain:** `tests`
- **depends-on:** WI-27, WI-28. WI-28's `yarn remove` and this item's `yarn add` both rewrite `package.json` and `yarn.lock`, so this item starts after WI-28 commits (§3.5 rule 7).
- **satisfies:** AC-18, AC-30, AC-31
- **change:**
  - **Packages:** add `babel-jest` (pinned to the Jest version, 30.5.2), `@babel/core` and `@babel/preset-env`. Both Babel packages are pinned to the major `yarn.lock` already resolves for Jest's own `@babel/core`.
  - **Config:** add the D-12 `transform` to `jest.config.js`.
  - **Tests:** `__tests__/utils.test.js` switches to `import { … } from '../src/js/utils.js'`. Delete the `observeSkills` tests, `:205-283` before #69's additions.
- **done when:** `yarn test:ci` passes on CommonJS `utils.js` before WI-32, and again after WI-32, with coverage at or above 80%.

#### WI-32 — JS cleanup, ESM conversion and the duplicate toggle

- **domain:** `frontend`
- **depends-on:** WI-31
- **satisfies:** AC-18, AC-19, AC-26, AC-30
- **change:**
  - **`utils.js`:** named `export`s, including #69's `resolveHashTarget` and `resolveLightboxHref`. `module.exports` is gone.
  - **`main.js`:** `import { … } from './utils.js'`.
  - **`observeSkills`:** removed from both files, along with the skills init in `init()`.
  - **Comments:** the template header (`main.js:1-4`) and every "replaces AOS/waypoints/venobox/owl" comment are gone.
  - **Markup:** the second `.mobile-nav-toggle` (`index.html:78-80`) is deleted.
- **done when:** WI-27's AC-18, AC-19, AC-26 and AC-30 tests pass, `yarn test:ci` passes, and the smoke suite passes.

#### WI-33 — rAF-throttled scroll handling and `aria-current`

- **domain:** `frontend`
- **depends-on:** WI-32, WI-30. Its back-to-top display rule goes into `style.css`, which WI-30 rewrites, so it starts after WI-30 commits (§3.5 rule 7).
- **satisfies:** AC-32, AC-33, AC-34, AC-54
- **change:** The D-13 design in `utils.js` and `main.js`:
  - `setupScrollHandlers` caches its element references.
  - `updateActiveNav(sections, navLinks, scrollY)` keeps today's rule. It also sets `aria-current="location"` on the active link and removes it from the others, as does `setupNavClickHandlers`.
  - Back-to-top toggles `is-visible`, with the display rule in CSS and no inline `style` writes.
- **done when:** WI-35's tests pass.

#### WI-34 — Unit tests for the changed utilities (test-after)

- **domain:** `tests`
- **depends-on:** WI-33
- **satisfies:** AC-31
- **change:** Jest tests for the rAF coalescing (a mocked `requestAnimationFrame`), `aria-current` and the `is-visible` toggle.
- **done when:** `yarn test:ci` passes at or above the 80% threshold.

#### WI-35 — E2E: footer padding, scroll work, active nav, back-to-top

- **domain:** `tests`
- **depends-on:** WI-30, WI-33
- **satisfies:** AC-24, AC-32, AC-33, AC-34, AC-54
- **change:** `tests/e2e/cleanup.spec.js`, written to the AC text. AC-32 installs its `querySelectorAll` counters through `addInitScript`.
- **done when:** the five tests pass in `yarn test:smoke`.

#### Phase 4 — portfolio on Muuri (PR-6)

#### WI-36 — Acceptance test: Isotope is gone

- **domain:** `tests`
- **depends-on:** WI-27
- **satisfies:** AC-118
- **change:** S1 `isotope-gone.test.js` runs the tracked-file search for `isotope`.
- **done when:** it fails today on its assertion.

#### WI-37 — Replace Isotope with Muuri for the portfolio filter and layout

- **domain:** `frontend`
- **depends-on:** WI-36, WI-35
- **satisfies:** AC-118, AC-35, AC-36, AC-37, AC-42, AC-43, AC-119, AC-120, AC-121, AC-122, AC-123, AC-124
- **change:** The D-16 design. In detail:
  - **Packages:** run `yarn remove isotope-layout`, then `yarn add muuri@0.9.5 --exact`.
  - **`main.js`:**
    - Replace the Isotope import with `import Muuri from 'muuri';`.
    - `initPortfolioGrid(container)` creates `new Muuri(container, { items: '.portfolio-item', layoutOnInit: true, layoutOnResize: 150, dragEnabled: false, showDuration, hideDuration, layoutDuration })`. The three durations are `0` when `prefers-reduced-motion: reduce` matches at init, and `300` otherwise.
    - It adds a `window` `load` listener that runs `grid.refreshItems().layout(true)`.
    - A filter button click runs `grid.filter(portfolioFilterSelector(value), portfolioFilterOptions(matchMedia('(prefers-reduced-motion: reduce)').matches))`.
  - **`utils.js`** gets three pure, unit-testable exports:
    - `setupPortfolioFilters(buttons, onFilter)` binds the buttons, keeps exactly one `aria-pressed="true"`, and calls `onFilter(button.dataset.filter)`.
    - `portfolioFilterSelector(filter)` returns `'.portfolio-item'` for `all`, and `[data-category="<filter>"]` otherwise.
    - `portfolioFilterOptions(reduce)` returns `{ instant: true, layout: 'instant' }` or `{ instant: false, layout: true }`.
  - **`index.html`:**
    - The filter list becomes `<ul id="portfolio-filters">` with `<li><button type="button" data-filter="all|app|card|web" aria-pressed="…">`.
    - Each `.portfolio-item` gets `data-category` and `data-portfolio-id`, and loses its `filter-*` class. It keeps `col-lg-4 col-md-6` and its `.portfolio-wrap` first child.
    - The nine portfolio `<img>` elements get `width="800" height="600"`, so each item's height is final before Muuri's first layout. This is the CLS guard. WI-44 later adds `loading="lazy" decoding="async"` and does not touch these dimensions.
  - **`style.css`:**
    - `.portfolio-container.muuri { position: relative }` and `.portfolio-container.muuri > .portfolio-item { position: absolute }`. There is no absolute positioning before Muuri initializes or with JS off.
    - Remove `transition` from `.portfolio-wrap`, as Muuri requires. Hover transitions stay on the overlay `::before` and the links only.
    - Button reset, and the pressed style on `[aria-pressed="true"]`.
    - `.portfolio-wrap:focus-within` reveals the action links and the overlay. `@media (hover: none)` shows the links by default.
  - **CSP:** no inline `style` attribute anywhere. Muuri writes through the CSSOM and the Web Animations API only (D-16, verified).
  - **Sprint 3:** add a one-line comment above `initPortfolioGrid`: Muuri owns the `transform`, `opacity` and `display` of `.portfolio-item` and `.portfolio-wrap`, so do not animate them with GSAP.
- **done when:**
  - WI-36's test passes, and WI-40's tests pass, including AC-124 and AC-76's CLS check at `phone` and `desktop`.
  - `yarn build` emits no `isotope` module.
  - Fred records AC-123 (accept or reject) in PR-6.

#### WI-38 — README: drop the Isotope mentions

- **domain:** `docs`
- **depends-on:** WI-37
- **satisfies:** AC-118
- **change:** Replace the Isotope Tech Stack row (`README.md:39`) with `Muuri 0.9.5 | Portfolio filter and layout`. Replace "Isotope" with "Muuri" in the key-files comment (`:62`).
- **done when:** WI-36's test passes.

#### WI-39 — Unit tests for the filter functions (test-after)

- **domain:** `tests`
- **depends-on:** WI-37
- **satisfies:** AC-31
- **change:** Jest tests for:
  - `setupPortfolioFilters`: `aria-pressed` exclusivity and the callback value.
  - `portfolioFilterSelector`: `all` and each category.
  - `portfolioFilterOptions`: both `reduce` values.

  Muuri itself is not unit-tested in jsdom, because jsdom has no layout. The e2e tests cover it.
- **done when:** `yarn test:ci` passes at or above 80%.

#### WI-40 — E2E: the portfolio, and the smoke row rewritten

- **domain:** `tests`
- **depends-on:** WI-37
- **satisfies:** AC-35, AC-36, AC-37, AC-42, AC-43, AC-89 (`Portfolio filter` row), AC-119, AC-120, AC-121, AC-122, AC-124
- **change:** Add `tests/e2e/portfolio.spec.js`, using `data-portfolio-id` and judging visibility with `toBeVisible()`.
  - **Before any portfolio assertion:** wait for `.portfolio-container.muuri`, so the tests never race Muuri's initialization.
  - **AC-124:**
    - Runs at `desktop` and `small`, with `emulateMedia({ reducedMotion: 'reduce' })` before navigation.
    - Records per-frame visibility, bounding box and opacity in a `requestAnimationFrame` loop for 1 s from the click.
    - At the first frame, checks `document.getAnimations()` for running animations on items, on their descendants, and on `.portfolio-container`, excluding the filter buttons.
    - It is about 1 s per viewport, so it stays in the smoke command.
  - **Smoke row:** rewrite the `Portfolio filter` row for the new markup, so it records the shipped Muuri layout (C-32).
- **done when:** all of them pass in `yarn test:smoke`.

#### Phase 5 — performance assets (PR-7)

#### WI-41 — Build-output acceptance tests

- **domain:** `tests`
- **depends-on:** WI-8
- **satisfies:** AC-69, AC-70, AC-74, AC-75
- **change:** `tests/e2e/build-output.spec.js`, tagged `@build` with no browser, reads `dist/`:
  - **AC-69:** a Node-side search for Google font hosts in every file.
  - **AC-70:** PostCSS over `dist/*.css`, checking `@font-face` `font-display`.
  - **AC-74:** font files by name.
  - **AC-75:** jsdom-free regex parse of `dist/index.html` `<img>` attributes, or `DOMParser` via `page.setContent`.
- **done when:** all four fail on their assertions today. Font Awesome's `@font-face` declares `font-display: block`.

#### WI-42 — Self-host the three text families

- **domain:** `frontend`
- **depends-on:** WI-41, WI-40
- **satisfies:** AC-68, AC-69, AC-70, AC-71, AC-73
- **change:** The D-2 design. Delete the Google Fonts `<link>` (`index.html:16-18`). Add `@fontsource/open-sans`, `@fontsource/raleway` and `@fontsource/poppins`, and import the latin-subset CSS for the confirmed weights from `main.js`.
- **done when:** WI-41's AC-69 and AC-70 pass and WI-46's AC-68 and AC-71 pass.

#### WI-43 — SVG icon sprite, and toggle state through `aria-expanded`

- **domain:** `frontend`
- **depends-on:** WI-41, WI-40, WI-42. Both items change `src/index.html`, `src/js/main.js`, `package.json` and `yarn.lock`, so this one starts after WI-42 commits (§3.5 rule 7).
- **satisfies:** AC-39, AC-53, AC-72, AC-73, AC-74
- **change:** The D-3 design.
  - **Sprite:** inside `<svg class="svg-sprite" aria-hidden="true">`, hidden by a class and never by a `style` attribute.
  - **CSS:** `.icon { width: 1em; height: 1em; fill: currentColor }`. The `… i` selectors are retargeted to `… .icon` so sizes and colors stay the same.
  - **Toggle:** the button carries both the bars and xmark symbols, and CSS shows one by `[aria-expanded]`. `toggleMobileNav` and `closeMobileNav` set `aria-expanded` and no longer swap icon classes.
  - **Removed:** the three Font Awesome CSS imports and `@fortawesome/fontawesome-free`.
- **done when:** WI-41's AC-74 passes, and WI-46's AC-39 and AC-72 pass.

#### WI-44 — Responsive, sized, lazy images and a square profile photo

- **domain:** `frontend`
- **depends-on:** WI-41, WI-40, WI-43. Both items change `src/index.html` and `src/css/style.css`, so this one starts after WI-43 commits (§3.5 rule 7).
- **satisfies:** AC-67, AC-75, AC-76, AC-77, AC-78
- **change:** The D-4 design.
  - **Variants:** commit the generated files, with the exact `npx sharp-cli` commands recorded in PR-7.
  - **Sources removed:** delete the superseded `hero-bg.jpg`, `profile-img.jpg` and testimonial originals. Git history keeps them.
  - **Markup:** `width` and `height` on every remaining `<img>`. The nine portfolio images already have theirs from WI-37. `loading="lazy" decoding="async"` on every image below the first screen, which excludes the header profile image.
  - **CSS:** the hero uses `image-set()` media blocks, and `#header .profile img` gets the circle guard.
  - **Check:** grep the `dist/` CSS for hashed AVIF and WebP names, and fall back if needed (RK-11).
- **done when:** WI-41's AC-75 passes and WI-46's AC-67 and AC-76 to AC-78 pass.

#### WI-45 — Unit tests for the toggle state (test-after)

- **domain:** `tests`
- **depends-on:** WI-43
- **satisfies:** AC-31
- **change:** Update the `toggleMobileNav` and `closeMobileNav` tests for `aria-expanded`, and drop the icon-class assertions.
- **done when:** `yarn test:ci` passes at or above 80%.

#### WI-46 — E2E: fonts, icons and images

- **domain:** `tests`
- **depends-on:** WI-42, WI-43, WI-44
- **satisfies:** AC-39, AC-67, AC-68, AC-71, AC-72, AC-76, AC-77, AC-78
- **change:** `tests/e2e/assets.spec.js`. Tests for both-target ACs (AC-67, AC-68, AC-71, AC-72, AC-76 to AC-78) carry `@live`.
- **done when:** they pass in `yarn test:smoke`. A reviewer records AC-73 against WI-1's screenshots in PR-7.

#### Phase 6 — accessibility and color variables (PR-8), then motion and form (PR-9)

#### WI-47 — Static acceptance tests for markup and tokens

- **domain:** `tests`
- **depends-on:** WI-27
- **satisfies:** AC-27, AC-28, AC-29, AC-47, AC-48, AC-55, AC-62, AC-63, AC-64, AC-65
- **change:**
  - **S1 `css-tokens.test.js`:** AC-27, AC-28 and AC-29, with PostCSS. Named colors are checked against the CSS named-color list.
  - **S1 `html-semantics.test.js`:** AC-47, AC-48, AC-55 and AC-62 to AC-65, in the jsdom environment.
- **done when:** each fails on its assertion today. AC-29 passes today and stays as a guard.

#### WI-48 — Site color tokens and contrast-safe values

- **domain:** `frontend`
- **depends-on:** WI-47, WI-46
- **satisfies:** AC-27, AC-28, AC-29, AC-45, AC-46
- **change:** `:root` declares one custom property per distinct color value, alpha variants included. Every literal outside `:root` becomes `var(--…)`. No `--bs-*` is declared (NG-3). Values meet frontend-audit §2c:
  - accent text and filled buttons, for example `#0b6f9e`
  - success and error message pairs
  - the testimonial role line
  - inactive bullets
  - a hero overlay strong enough for AC-46 on the WI-44 images

  `#149ddd` remains for decorative fills.
- **done when:** WI-47's AC-27 to AC-29 pass and WI-51's AC-45 and AC-46 pass.

#### WI-49 — Document structure, names and alt text

- **domain:** `frontend`
- **depends-on:** WI-48
- **satisfies:** AC-38, AC-47, AC-48, AC-49, AC-50, AC-53, AC-55, AC-56, AC-57, AC-62, AC-63, AC-64, AC-65
- **change:** In `src/index.html`, with matching CSS selector updates:
  - **Headings:**
    - Header `h1` becomes `<p class="profile-name">`.
    - Services `h4` becomes `h3`.
    - The testimonial name becomes `<p class="testimonial-name">` and the role `<p class="testimonial-role">`.
    - Contact-info `h4` becomes `h3`.
  - **Landmarks:**
    - `#hero` moves inside `<main>`, staying full-bleed at 1200 px and wider.
    - `<nav class="nav-menu" aria-label="Primary">`.
    - A skip link `a.skip-link` to `#main` is the first child of `<body>`. It uses `visually-hidden-focusable` and is fixed on top when focused. `#main` gets `tabindex="-1"`.
  - **Names:**
    - Toggle: `aria-label="Navigation menu"`.
    - Social links: "X (Twitter), opens in new tab" and the same pattern for the others.
    - Back-to-top: `href="#hero"`, `aria-label="Back to top"`.
  - **Portfolio** (C-4):
    - Nine descriptive `alt` values, written from each image (A-10).
    - Lightbox links: `aria-label="Enlarge <project>"`.
    - Details links: `aria-label="<project> details"`, still `href="#"`.
    - `title` attributes removed. No `data-title` or `data-description` is added, so GLightbox never writes inline styles (RK-7).
  - **Photos:** testimonial and About `alt=""`.
- **done when:** WI-47's heading, landmark and alt tests pass, WI-51's tests pass, and a reviewer records AC-57 (9 rows) in PR-8.

#### WI-50 — Focus indicators, closed-nav visibility, footer overlap and target sizes

- **domain:** `frontend`
- **depends-on:** WI-49
- **satisfies:** AC-40, AC-41, AC-51, AC-52, AC-60, AC-61
- **change:** In `src/css/style.css`:
  - **Focus:** delete `outline: none !important` (`:225`). Add a global `:focus-visible` outline in a token color, with at least 3:1 against both the dark sidebar and the light content. If `section { overflow: hidden }` clips the ring, scope that rule to the sections that need it (PRD §2.5).
  - **Closed nav:** the D-15 `visibility` rules below 1200 px.
  - **Footer overlap:** at 1200 px and wider, `#header` ends where `#footer` begins, through a shared `--footer-height` token. The header's scroll area therefore never sits under the fixed footer.
  - **Targets:** social links and back-to-top at 44 × 44 px.
- **done when:** WI-51's AC-40, AC-41, AC-51, AC-52, AC-60 and AC-61 pass, and the smoke `Layout` and `Mobile nav` rows still pass.

#### WI-51 — E2E: accessibility and contrast

- **domain:** `tests`
- **depends-on:** WI-48, WI-49, WI-50
- **satisfies:** AC-38, AC-40, AC-41, AC-45, AC-46, AC-49, AC-50, AC-51, AC-52, AC-53, AC-56, AC-60, AC-61
- **change:** `tests/e2e/a11y.spec.js`, with shared Tab-walk and contrast helpers in `tests/e2e/helpers/`. AC-46 reads pixels on an in-page canvas with no new dependency and carries `@live`. AC-45 uses the Web3Forms mocks.
- **done when:** they pass in `yarn test:smoke`.

#### WI-52 — Testimonial carousel: pause control, reduced motion, named bullets, no loop warning

- **domain:** `frontend`
- **depends-on:** WI-51
- **satisfies:** AC-44, AC-58, AC-59, AC-109, AC-114
- **change:** The D-14 design in `main.js`, `index.html` and `style.css`:
  - Import `A11y` from `swiper/modules`.
  - Set `loop: false, rewind: true`.
  - Add the toggle button with the sprite's pause and play icons.
  - Give each pagination bullet a hit area of at least 24 × 24 px, with the visible dot inside it.
- **done when:** WI-55's carousel tests pass.

#### WI-53 — Hero typing stops after one cycle

- **domain:** `frontend`
- **depends-on:** WI-51, WI-52. Both items change `src/js/main.js` and `src/css/style.css`, so this one starts after WI-52 commits (§3.5 rule 7).
- **satisfies:** AC-110, AC-111, AC-112
- **change:**
  - `initTyped` sets `loop: false` and `autoInsertCss: false`.
  - The cursor CSS (`.typed-cursor`, the blink keyframes) moves into `style.css`.
  - `onComplete` removes the cursor's blink class and adds `typed-cursor--done` (`animation: none`), so the cursor stays visible and stops.
  - Speeds, strings and smart backspace are unchanged (NG-5).
- **done when:** WI-55's typing tests pass.

#### WI-54 — Announce a busy state while the form sends

- **domain:** `frontend`
- **depends-on:** WI-51, WI-53. `initContactForm` sits in `src/js/main.js` with `initTyped` and the carousel setup, so this item starts after WI-53 commits (§3.5 rule 7).
- **satisfies:** AC-66
- **change:** `initContactForm` sets `aria-busy="true"` on `#contact-form` when a request starts. It removes the attribute in `finally` and in the `hidden.bs.modal` reset.
- **done when:** WI-55's AC-66 test passes.

#### WI-55 — E2E: motion and form

- **domain:** `tests`
- **depends-on:** WI-52, WI-53, WI-54
- **satisfies:** AC-44, AC-58, AC-59, AC-66, AC-109, AC-110, AC-111, AC-112, AC-114
- **change:** `tests/e2e/motion.spec.js`. AC-44, AC-109, AC-110 to AC-112 and AC-114 are tagged `@slow`. AC-114 runs each width in parallel workers.
- **done when:** `yarn test:smoke` and `yarn test:e2e:slow` pass. PR-9 posts the `test:e2e:slow` result next to its gate evidence.

#### Phase 7 — security headers, CSP and source maps (PR-10)

#### WI-56 — Acceptance tests for headers, inline styles and the D-5 decision

- **domain:** `tests`
- **depends-on:** WI-11
- **satisfies:** AC-79, AC-80, AC-81, AC-82, AC-84, AC-85, AC-86, AC-113
- **change:**
  - **S1 `headers-config.test.js` (AC-81):** `smol-toml` over `netlify.toml`.
  - **S1 `inline-styles.test.js` (AC-84).**
  - **S1 `spec-decisions.test.js` (AC-79):** counts the lines in §3 of `specs/stabilize-and-cleanup.md` matching `^\*\*D-5 decision:\*\* production (does not serve|serves) source maps\.$` and expects exactly 1.
  - **S5 `live-headers.test.js`:** AC-82, AC-85, AC-86 and AC-113, with `curl -sI`-equivalent `fetch` HEAD requests.
  - **S5 `live-sourcemaps.test.js` (AC-80).**
- **done when:** AC-81, AC-84 and the live tests fail on their assertions. AC-79 passes once this spec is committed (PR-1) and stays as a guard.

#### WI-57 — Remove the inline `style` attributes

- **domain:** `frontend`
- **depends-on:** WI-56, WI-55
- **satisfies:** AC-84
- **change:**
  - **Honeypot (`index.html:480`):** `class="d-none" tabindex="-1" autocomplete="off" aria-hidden="true"`.
  - **Map iframe (`:427-432`):** `class="contact-map"`, with border, height and width moved to CSS. Drop the deprecated `frameborder`. The `src` and `title` stay as they are (C-3).
- **done when:** WI-56's AC-84 test passes and the smoke suite passes.

#### WI-58 — Netlify security headers and the report-only CSP

- **domain:** `security`
- **depends-on:** WI-56, WI-57, WI-42, WI-53
- **satisfies:** AC-81, AC-82, AC-83, AC-85, AC-86, AC-113
- **change:** In the `netlify.toml` `[[headers]] for = "/*"` block:
  - remove `X-XSS-Protection`
  - add `Content-Security-Policy-Report-Only` with the D-6 text
  - add `Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"`, with no deprecated features that log console errors
  - add `Cross-Origin-Opener-Policy = "same-origin"`
  - keep `X-Frame-Options`, `X-Content-Type-Options` and `Referrer-Policy`

  The Security Reviewer authors the policy and signs it off in PR-10. If AC-83 finds a library that needs inline style attributes, the reviewer chooses between a code change and `style-src-attr 'unsafe-inline'` in writing (RK-7).
- **done when:** WI-56's AC-81 passes and WI-60's AC-83 passes locally. AC-82, AC-85, AC-86 and AC-113 pass on the live site at release.

#### WI-59 — Build without source maps

- **domain:** `ci`
- **depends-on:** WI-56
- **satisfies:** AC-79, AC-80
- **change:** The `package.json` `build` script becomes `parcel build src/index.html --public-url ./ --no-source-maps`.
- **done when:** `yarn build` emits no `*.map` into `dist/`, and AC-80 passes live at release.

#### WI-60 — E2E: a full visit raises no CSP violations

- **domain:** `tests`
- **depends-on:** WI-58
- **satisfies:** AC-83
- **change:** `tests/e2e/csp.spec.js` runs the Conventions' full visit with `securitypolicyviolation` and console listeners, tagged `@live`. Locally, `serve-dist.mjs` supplies the header.
- **done when:** it passes in `yarn test:smoke`.

#### Phase 8 — baseline finalization (PR-11)

#### WI-61 — Prove that the baseline catches unintended changes, and that the Web3Forms guard holds

- **domain:** `tests`
- **depends-on:** WI-60
- **satisfies:** AC-90, AC-91, AC-92
- **change:** S5 `baseline-sensitivity.test.js`. Each case creates a scratch `git worktree` at `HEAD`, applies one change, runs `yarn install --immutable`, `yarn build` and `yarn test:smoke --reporter=json` with `process.env` minus every `JEST_*` variable (as WI-7 does, so that Playwright loads the tests), then removes the worktree:
  - **AC-90:** an uncommitted spec that submits without a mock. It must fail, with 0 real `api.web3forms.com` responses, and every other test must pass.
  - **AC-91:** both `max-width: 1199px` queries set to `1279px`. The `Layout` test must fail.
  - **AC-92:** `data-bs-toggle="modal"` set to `"dialog"`. The `Dialog open` test must fail.
- **done when:** all three pass via `yarn verify:release`, and `yarn test:e2e:slow` passes on PR-11's head.

#### Phase 9 — docs and release (PR-12, then post-merge)

#### WI-62 — Acceptance tests for the docs and the release

- **domain:** `tests`
- **depends-on:** WI-3
- **satisfies:** AC-93, AC-94, AC-95, AC-96, AC-97, AC-98, AC-99, AC-100, AC-101, AC-102
- **change:**
  - **S1 `readme.test.js`:** AC-95, AC-96, AC-98 to AC-101.
  - **S5 `readme-links.test.js`:** AC-93 and AC-94.
  - **S5 `repo-description.test.js`:** AC-97.
  - **S5 `release-tag.test.js`:** AC-102.
- **done when:** each fails on its assertion today.

#### WI-63 — README for the 4.0.0 state

- **domain:** `docs`
- **depends-on:** WI-62, WI-61
- **satisfies:** AC-93, AC-94, AC-95, AC-96, AC-98, AC-99, AC-100, AC-101
- **change:** Every docs-audit §2 row (A-13):
  - **URLs:** the live URL is `fs3portfolio.netlify.app`. The badge is current, or there is none (A-16).
  - **Tech Stack:** majors match `package.json`, with no caret ranges. The libraries list reflects the page: no Isotope, Boxicons or just-validate. Fontsource and the SVG icons appear.
  - **Claims removed:** "skills", "kept in sync automatically" and "must pass before a PR can be merged". The CI section says enforcement waits for billing (C-27).
  - **Usage:** documents `yarn test:smoke`.
  - **Wording:** "initialization"; a language tag on every fence; absolute issues and Code of Conduct links.
  - **License:** `© Valhalla Tech` and `GPL-3.0-only`.
  - **Line 5** is unchanged (C-6).
- **done when:** WI-62's S1 README tests and AC-93 and AC-94 pass.

#### WI-64 — CHANGELOG entry for 4.0.0

- **domain:** `docs`
- **depends-on:** WI-63
- **satisfies:** AC-103, AC-104
- **change:** `## [4.0.0] - <planned publish date, UTC>`, with Added, Changed, Removed, Fixed and Security entries covering sprint 1. It notes that the `Test & Build` ruleset waits for billing before enforcement. `[Unreleased]` and the compare links are updated.
- **done when:** WI-24's AC-103 test passes with `package.json` at 4.0.0, and AC-104 passes after WI-65 publishes.

#### WI-65 — Release 4.0.0

- **domain:** `ci`
- **depends-on:** WI-64, WI-67, WI-66
- **satisfies:** AC-1, AC-2, AC-100, AC-102
- **change:**
  1. **In PR-12:** `package.json` gets `"version": "4.0.0"` and `"license": "GPL-3.0-only"`.
  2. **After PR-12 merges:**
     - Confirm Netlify's production deploy of the merge commit.
     - Run `yarn test:e2e:live`, `yarn test:e2e:slow` and `yarn verify:release`. AC-102 and AC-104 are expected red until the tag and release exist. AC-1 is red in that run too, because `AC1_REF` is unset and there is no tag yet. Its own run is the next step.
     - Run AC-1 on Fred's Windows host, with the Phase 0 Corepack precondition met: `yarn verify:release windows-fresh-clone` (a Jest path pattern, so only that file runs) with the env `AC1_REF` set to the merge SHA. The test runs `node scripts/gate.mjs --fresh-clone https://github.com/ValhallaTech/PortfolioPage-FS3 --ref <merge SHA> --autocrlf` (WI-3).
  3. **Only when all of that is green:** create the annotated tag `4.0.0` on the merge commit, push it, and run `gh release create 4.0.0` with the CHANGELOG 4.0.0 section as notes, on the same UTC date as the CHANGELOG heading. This is the point of no return (RK-19).
- **done when:** `yarn verify:release`, run on Fred's Windows host with `AC1_REF` unset, is fully green after the release is published. That includes AC-2, AC-102 and AC-104, and AC-1 against the peeled `4.0.0` tag.

#### Unmapped work items

| ID | Title | Satisfies | Recommended owner | Why unmapped |
| --- | --- | --- | --- | --- |
| WI-66 | Close PRs #56 and #68 as superseded, after PR-2 merges. Each gets a closing comment naming PR-2 (D-9) | AC-13 | PR Agent | Changing a PR's state is reserved to the PR Agent by the org standard. No domain tag covers GitHub PR state. `ci` covers pipeline config, not PR lifecycle |
| WI-67 | Set the GitHub repo description to the C-6 text: `gh repo edit ValhallaTech/PortfolioPage-FS3 --description "Personal portfolio website for Fred Smith III, built as a static single-page application and deployed on Netlify."` | AC-97 | Documentation Agent | It is repo metadata, not a repo documentation file, so `docs` (README, CHANGELOG, `/docs`, CONTRIBUTING) does not strictly cover it. The Documentation Agent owns the README line 5 text it must mirror |

### 3.5 Sequencing

**Merge discipline for every sprint-1 PR** (Q-12(b), AC-2):

1. **Authorship:** the PR Agent authors every PR, and each body contains `stabilize-and-cleanup`.
2. **Same-PR landing:** a chain's acceptance-tests item and its implementation item land in the **same PR**, tests commit first. The person who runs the tests at that commit posts the red run, showing assertion failures, as a PR comment. No expected-fail markers are used.
3. **Merge condition:** a PR merges only when its latest v1 gate-evidence comment (`yarn gate:linux`) names the current `headRefOid` with six zero exit codes. Any push, including a rule-6 catch-up merge, means re-running the gate.
4. **Release-suite tests:** S5 tests are not in the gate, so they cannot break `main`. These are expected red for a while: AC-2 until PR-1 merges with its evidence; AC-8 until PR-2; and until WI-65, the tests that can pass only at release: AC-1, AC-80, AC-82, AC-85, AC-86, AC-102, AC-104 and AC-113.
5. **Shared files:** `src/index.html`, `src/css/style.css` and `src/js/main.js` are shared by most phases, so the PRs that touch them merge one at a time, in the order below.
6. **Catching up with `main`:** a PR branch that falls behind `main`, for example the second of two parallel PRs to merge, catches up by **merging** `origin/main` into its branch. It never rebases. A rebase rewrites the tests commit, so the red run posted under rule 2, and the check that later commits left the acceptance tests unedited, would point at a commit that is no longer in the PR, and AC-2's evidence would name a SHA the PR no longer has. The steps:
   1. `git fetch origin`, then `git merge origin/main`.
   2. If `package.json` conflicts, keep both sides' entries by hand.
   3. Before committing the merge, run `yarn install` without `--immutable`. Yarn resolves `yarn.lock` conflict markers itself (YN0049, YN0048), but only while `MERGE_HEAD` exists, and never under `--immutable` (YN0047) *(verified 2026-11-17 via Context7 `/yarnpkg/berry`, error-codes reference)*. If Yarn reports YN0046 or YN0083, stop and report; never commit a lockfile that still holds markers.
   4. Commit the merge, together with the regenerated `yarn.lock`. Push, then re-run `yarn gate:linux` and post the new evidence (rule 3).
7. **Parallel work inside one PR:** items marked parallel change disjoint files. Each one commits only the paths it changed. Two items that change the same file never run in parallel, and that includes `package.json` and `yarn.lock` (any `yarn add`, `yarn remove` or `yarn up`). The plan orders such items with a `depends-on` edge.

| Phase | PR | Work items | Can run in parallel with | Gate to the next phase |
| --- | --- | --- | --- | --- |
| 0. Preconditions | none | WI-1 | none | Fred's Windows host has Corepack: `npm install -g corepack@0.36.0`, then `corepack enable`, after which `yarn --version` in the repo prints the `packageManager` version (D-10 Windows host precondition). #69 merged at `1988128` or later, with no `dependencyDashboard` key (RK-1). Netlify's production deploy of #69 verified live (A-2, RK-3): the lightbox opens and the live HTML's hashed names match a local build of `main`. WI-1's baselines and the General Ruleset snapshot attached to PR-1. Gate 2 approved |
| 1. Gate foundation: report (b), plus the (e) baseline per Q-12(a) | PR-1 | WI-2 → WI-3; then WI-3 → WI-4 → WI-5; WI-3 → WI-6 → WI-7 → WI-8; WI-6 → WI-5; WI-3 → WI-9; and WI-5, WI-8, WI-9 → WI-10 | After WI-3: WI-4, WI-6 and WI-9 in parallel; then WI-7 and WI-8 alongside WI-5. The items that change `package.json`, `yarn.lock` or `eslint.config.mjs` take turns in this order: WI-2, WI-3, WI-6, WI-5, WI-10 (rule 7). WI-10, with its formatting commit, goes last | PR-1 merged with green `gate:linux` evidence. PR-1 also commits `specs/stabilize-and-cleanup.md` and `update-report-2026-11-16/`, as Fred confirmed at Gate 2 ("Commit both"). That is AC-79's stated precondition and the reason the Conventions exclude those paths. No CSS work starts before PR-1 merges (RK-6) |
| 2a. Runtime and automation: report (b) | PR-2 | WI-11 → WI-12 → WI-13; WI-14 → WI-15 → WI-16 → WI-17; WI-18 → WI-19; WI-20 (tests only) | PR-3, PR-4. WI-21 any time after WI-20 | The PR-2 deploy preview builds on Node 26 with Yarn 4.18.1 (RK-2). Merged. Then WI-21 and WI-66 run |
| 2b. Toolchain pins and audit: report §6 dependencies | PR-3 | WI-22 → WI-23 | PR-2, PR-4. Only PR-3 changes `package.json` and `yarn.lock`: `yaml` now comes from WI-3 in PR-1, and no PR-2 or PR-4 item adds, removes or upgrades a package. The planned files are otherwise disjoint too: PR-2 changes `.nvmrc`, `netlify.toml`, the two workflows, `README.md`, `renovate.json` and `scripts/sync-runtime-versions.mjs`; PR-4 changes `CHANGELOG.md` and `.github/ISSUE_TEMPLATE/`; each adds only its own new test files. Whichever of the three merges second or third is behind `main` anyway, so it catches up under rule 6 and re-runs its gate. Rule 6 also resolves any manifest overlap the plan did not foresee | Merged |
| 2c. Changelog backfill and issue forms | PR-4 | WI-24 → WI-25, WI-26 | PR-2, PR-3. WI-24 needs only `yaml`, which is on `main` from PR-1, so PR-4 does not wait for PR-2 | Merged. Fred records AC-107 |
| 3. Cleanup and GSAP step 1: report (c) | PR-5 | WI-27 → WI-28 → WI-31 → WI-32 → WI-33 → WI-34; WI-28 → WI-29; WI-27 → WI-30 → WI-33; WI-30 and WI-33 → WI-35 | WI-30 in parallel with WI-28, WI-31 and WI-32; WI-29 alongside anything after WI-28. Not in parallel: WI-28 and WI-31 both rewrite `package.json` and `yarn.lock`, and WI-30 and WI-33 both edit `style.css` (rule 7) | Merged |
| 4. Isotope replaced by Muuri: Gate 1 addition, D-16 at Gate 2 | PR-6 | WI-36 → WI-37 → WI-38, WI-39, WI-40 | none (shared files) | Fred records AC-123 **accept**. A reject sends WI-37 back before merge |
| 5. Performance assets: report §5 | PR-7 | WI-41 → WI-42 → WI-43 → WI-44; WI-43 → WI-45; WI-42, WI-43 and WI-44 → WI-46 | WI-45 in parallel with WI-44. WI-42, WI-43 and WI-44 run one after another: all three edit `src/index.html`; WI-42 and WI-43 both edit `main.js` and rewrite `package.json` and `yarn.lock`; WI-43 and WI-44 both edit `style.css` (rule 7) | Merged. AC-73 recorded against WI-1 |
| 6a. Accessibility and color variables: report (d) | PR-8 | WI-47 → WI-48 → WI-49 → WI-50 → WI-51 | none | Merged. AC-57 recorded |
| 6b. Motion and form: Gate 1 additions and (d) | PR-9 | WI-52 → WI-53 → WI-54 → WI-55 | none. All three implementation items edit `src/js/main.js`, and WI-52 and WI-53 both edit `style.css` (rule 7) | Merged, with `test:e2e:slow` green |
| 7. Headers, CSP and source maps: report §6 | PR-10 | WI-56 → WI-57 → WI-58; WI-59; WI-58 → WI-60 | WI-59 in parallel with WI-57 and WI-58 | Security Reviewer sign-off on the policy. Merged |
| 8. Baseline finalization: report (e) | PR-11 | WI-61 | none | `verify:release` cases AC-90 to AC-92 green; `test:e2e:slow` green |
| 9. Docs and release: report (f) | PR-12, then post-merge | WI-62 → WI-63 → WI-64; WI-67; WI-65 (step 1 in PR-12, steps 2–3 after merge) | WI-67 any time | PR-12 merged → production deploy verified → live, slow and release suites green → Windows AC-1 gate green → **tag and release (point of no return)** → `verify:release` fully green |

The report sprint-1 order is kept, minus phase (a):

- **§6 dependencies** sit in phase 2, because they are toolchain work.
- **§5 performance** sits before accessibility. The icon swap rewrites every `<i>` that the accessibility work then labels, and the font swap changes what the contrast checks measure.
- **The CSP** comes after all markup changes, so the policy is written against final markup.
- **The Muuri replacement** sits between cleanup and accessibility, because it rewrites the filter markup that R-25 needs. It also sets the portfolio image dimensions before PR-7's site-wide image pass, to protect CLS.

**Critical path:** Phase 0 → PR-1 → PR-2 → PR-5 → PR-6 → PR-7 → PR-8 → PR-9 → PR-10 → PR-11 → PR-12 → production deploy → live verification → tag. PR-3, PR-4, WI-21, WI-66 and WI-67 run off the critical path.

### 3.6 Risks & mitigations

| ID | Risk | Likelihood | Impact | Mitigation | Affects |
| --- | --- | --- | --- | --- | --- |
| RK-1 | #69 merges at a commit older than `1988128`, or a later edit adds a `dependencyDashboard` value that is not a boolean, so AC-5 fails. The original object-form value was fixed upstream at `1988128`, which removed the key | low | med | Phase 0 confirms the merged #69 is `1988128` or later. WI-19 adds no `dependencyDashboard` key. WI-18's AC-5 guard catches any regression | WI-18, WI-19 |
| RK-2 | Netlify on Node 26, with `YARN_VERSION` removed, fails to provision Yarn 4.18.1, because Node 26 bundles no Corepack. Production deploys would fail | med | high | WI-12's done-when requires a green PR-2 deploy preview showing Node 26 and Yarn 4.18.1. Fallback: keep `YARN_VERSION = "4.18.1"` (deprecated but supported); WI-16 keeps it aligned when present | WI-12, WI-16 |
| RK-3 | Live ACs rest on A-2, and production deploys may have been failing since 2026-09-28 | med | high | Phase 0 verifies the post-#69 production deploy before any sprint-1 work. WI-65 verifies the release deploy before tagging | WI-1, WI-65 |
| RK-4 | Timing-based tests make the gate flaky: scroll waits, the 11 s carousel checks, the 60 s typing checks | med | med | Slow tests sit outside the smoke command (`@slow`). Web-first assertions and `expect.poll` replace fixed sleeps where an AC allows. `retries: 0` in the gate, because a flaky test is a defect that goes back to its author | WI-8, WI-35, WI-40, WI-46, WI-51, WI-55 |
| RK-5 | The Chromium-only baseline misses WebKit regressions in sprint 2, such as the Bootstrap 6 dialog on Safari 18 | med | med | The `phone` viewport uses iPhone 13 metrics. Sprint 2 can add a WebKit project with one config entry and `playwright install webkit`. Accepted for sprint 1 | WI-6, WI-8 |
| RK-6 | WI-10's whole-file Prettier pass over `style.css` conflicts with any branch already editing CSS | low | low | It lands in PR-1, in a formatting-only commit, and no CSS work starts before PR-1 merges | WI-10 |
| RK-7 | CSP report-only violations from libraries. Verified sources: Typed.js `<style>` injection, and GLightbox `setAttribute('style')` when a slide has a title or description. Muuri 0.9.5 was checked and writes only through the CSSOM and the Web Animations API | med | med | WI-53 turns off `autoInsertCss`. WI-49 adds no `data-title` or `data-description`. AC-83 catches the rest. The Security Reviewer decides any inline-style allowance in writing, never silently | WI-49, WI-53, WI-58, WI-60 |
| RK-8 | Some high or critical dev advisories have no fix in a compatible range (A-15) | med | med | `yarn up -R` first, then targeted `resolutions` with the gate re-run after each. If an advisory needs a tool swap, WI-23 halts and the finding goes to Fred. It is not dropped | WI-23 |
| RK-9 | The ESM switch drags Parcel into Babel, or coverage falls below 80% once `observeSkills` and its tests go | low | med | The Babel config sits inline in `jest.config.js` (D-12). WI-34, WI-39 and WI-45 add tests for every new function. The threshold fails the gate if they fall short | WI-31, WI-32 |
| RK-10 | The font and icon swap changes rendering. A missed weight gives faux bold; a mis-sized `.icon` shifts layout | med | low | WI-42 derives the weights from computed styles. AC-71 and AC-72 automate the measurable part. AC-73 compares against WI-1's live screenshots | WI-42, WI-43 |
| RK-11 | Parcel does not resolve URLs inside `image-set()`, or the variants lose LCP or quality | low | med | WI-44 greps `dist/` for hashed AVIF and WebP names. The fallback is a plain `url()` per media query (WebP). M-1 is measured at release against WI-1's baseline | WI-44 |
| RK-12 | `visibility: hidden` on the closed nav cuts the slide-out animation short, or leaves the sidebar hidden at 1200 px and wider after a resize | low | med | The rule sits only inside `max-width: 1199px`, with a `visibility` transition delay. AC-51 and AC-52 plus the smoke `Layout` and `Mobile nav` rows cover both sides of 1200 px | WI-50 |
| RK-13 | The release slips past UTC midnight, so the CHANGELOG 4.0.0 date no longer matches the GitHub release (AC-104) | low | low | Publish on the heading's UTC date. If the date slips, a date-fix commit lands before the tag | WI-64, WI-65 |
| RK-14 | Serial merges on shared files mean repeated catch-ups with `main`, and each one invalidates gate evidence. A rebase used to catch up would also drop the red-run tests commit from the PR's history | high | low | The order in §3.5, and its rule 6: catch up by merging `origin/main`, never by rebasing, with `yarn install` resolving `yarn.lock` before the merge is committed. The gate re-runs after every catch-up; that cost is accepted as the price of AC-2 | all PRs |
| RK-15 | Billing returns but the ruleset stays `disabled`, so G-2 is never enforced (M-3) | med | med | The CHANGELOG 4.0.0 entry and the README CI section state the one switch: `gh api -X PUT …/rulesets/<id> -f enforcement=active`. WI-20's test accepts `ACTIONS_RESTORED=1` to check it | WI-21, WI-63, WI-64 |
| RK-16 | Renovate's lookup-mode log may not carry each update's resolved `automerge` (inferred, not verified) | med | med | WI-18's fallback evaluates the config with the same pinned Renovate package's package-rules module. If neither path works, WI-18 halts and reports. It never weakens the assertion | WI-18 |
| RK-17 | The Linux gate depends on network access: the clone from GitHub, apt for Playwright dependencies, Corepack and npm | med | low | Named Docker volumes cache the browsers and the Yarn cache. The image tag is pinned to the `.nvmrc` major. A network failure is reported as a gate failure and never recorded as a pass | WI-5 |
| RK-18 | **Monitoring:** the site has no production telemetry. A failed deploy, or a CSP violation on a real visitor, would go unseen | med | med | Signals and where they are watched: (1) Netlify deploy status for every PR preview and production deploy, which Fred watches in the Netlify UI and its failure notifications. (2) `yarn test:e2e:live` and the live S5 checks after each sprint-1 production deploy and at release. (3) The AC-83 full visit, as the report-only CSP's only signal, because no collector exists (D-6). (4) M-4 and M-5 are measured once, on the release commit: M-4 is the AC-87 audit run, M-5 the AC-12 check, with target 0 for both (§2.4). Fred dropped the weekly follow-up at Gate 2, so nothing watches for drift after 4.0.0. That is an accepted gap, not a tracked one. No new telemetry is built: none of these changes needs one | WI-58, WI-60, WI-65 |
| RK-19 | **Rollback:** a shipped change misbehaves | low | med | Code: `git revert` of the PR's merge commit, and Netlify "Publish deploy" on the previous production deploy, which is instant. Settings: delete or edit the ruleset (`gh api`), reopen #56 or #68, revert `renovate.json`. **Point of no return: WI-65 pushing tag `4.0.0` and publishing the GitHub release.** It is gated in §3.5 by a verified production deploy, green live, slow and release suites, and a green Windows AC-1 gate | WI-65 |
| RK-20 | Muuri has had no release since 0.9.5 (2021-07-09). A future browser change could break its layout or Web Animations path with no upstream fix. Its absolute positioning also constrains sprint 3, because GSAP must not animate the item and wrap transforms | low (near term), med (over time) | med | Pin it exactly (`0.9.5`). The smoke `Portfolio filter` row and AC-119 to AC-122 and AC-124 fail loudly on any breakage. The D-16 sprint-3 rules and the code comment in WI-37 record what GSAP must not touch. If Muuri breaks later, the exit is a small swap: no library (the `hidden`-attribute design in the Gate 2 record) or GSAP Flip. That would be its own decision | WI-37, WI-40 |
| RK-21 | Muuri's switch from flow to absolute layout shifts the portfolio or the sections below it: CLS (AC-76), the `Layout` smoke row, or a container height that does not cover its items (AC-122) | low | med | Absolute positioning applies only under `.muuri`. The nine images carry `width="800" height="600"` before the first layout, and a `load` handler re-lays out instantly. The portfolio sits below the first screen at every AC viewport. AC-76, AC-121 and AC-122 run at `phone`, `small` and `desktop` and at nine widths | WI-37, WI-40 |
| RK-22 | PR-1's Linux gate runs on Node 25, because `.nvmrc` reads 25.9.0 until WI-12 in PR-2. That has two effects. (1) The `node:25-bookworm` image ships Yarn 1.22.22, linked at `/usr/local/bin/yarn`, so a plain `npm install -g corepack@0.36.0` fails with `EEXIST`. `corepack enable` is then never reached, and `yarn install --immutable` runs against Yarn 1. This happened in PR-1's run (WI-4's green verify, and Phase 0). (2) `corepack@0.36.0`'s engines (`^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) exclude Node 25, so for that one PR Corepack runs outside its supported range and may misbehave | high (1), low (2) | med (1): no gate step can pass; low (2) | (1) WI-5 removes the image's Yarn 1 `yarn` and `yarnpkg` links before the install, only when they are symlinks into `/opt/yarn-v*`. It then installs without `--force` and adds `image Yarn 1 links removed` to the evidence label. On `node:26` the step changes nothing. (2) PR-1's gate goes ahead on Node 25, with the out-of-range install made visible: npm treats `engines` as advisory without `engine-strict`, so the install proceeds with an `EBADENGINE` warning *(verified 2026-11-17 via Context7 `/npm/cli`)*, and WI-5 then labels the evidence `corepack@0.36.0 outside its engines`. A real incompatibility fails a gate step, which halts and goes to Fred; it is never worked around or recorded as a pass. The exposure ends at WI-12, after which every gate runs on Node 26, inside the range. *Lost:* a `node:26` container for PR-1 would produce evidence for a Node line that PR-1's commits do not declare. An older Corepack pinned for PR-1 alone would test an install that no later environment, and no part of D-1, uses | WI-5, WI-12 |

**Operations:** monitoring — RK-18; backup — not applicable: the site holds no data, every deleted file and replaced image stays in git history, Netlify keeps prior deploys, and closing #56 and #68 is reversible by reopening; rollback — RK-19.

### 3.7 Test strategy

**Suites and where they run.** These are the suites S1–S5 from §3.4.

| Suite | Contents | Runs |
| --- | --- | --- |
| **S1** | `__tests__/acceptance/` (Jest), offline | `yarn test:ci`, gate step 4 |
| **S2** | `tests/e2e/` (Playwright, Chromium) against the local target, untagged and `@build` | `yarn test:smoke`, gate step 6, on every PR |
| **S3** | `@slow` | `yarn test:e2e:slow` on PR-9, PR-11 and at release |
| **S4** | `@live` against `https://fs3portfolio.netlify.app/` | `yarn test:e2e:live` after production deploys and at release |
| **S5** | `__tests__/release/` (Jest; network, `gh`, Docker, live) | `yarn verify:release`, at release and on demand |
| **Manual** | Human checks | Recorded by the named reviewer in the named PR |

**Test-first chains and seams.**

- Each AC id has its own test case.
- "Stubs: none" means the seam already exists in the repo, on GitHub, or on the live site (see §3.4).
- Browser-observable ACs (`e2e`) and `manual` ACs have no chain, as the rule requires.

| Chain | ACs | Stubs | Acceptance tests | Implementation | Test seam |
| --- | --- | --- | --- | --- | --- |
| A Gate runner | AC-1, AC-2 | WI-2 | WI-3 | WI-4, WI-5, WI-65 | CLI `node scripts/gate.mjs [--env <label>] [--fresh-clone <url> --ref <sha> [--autocrlf]] [--commands-file <json>] [--out <file>]`. Stdout ends with the v1 evidence block (D-10), after any output of the steps; `--out` writes the block alone. Exit code = first non-zero step, or 0. **`--commands-file` format** (tests only): a UTF-8 JSON file holding an array of exactly six strings, for example `["node -e \"process.exit(0)\"", …]`. String *i* is the shell command run for gate step *i* + 1 in place of the real one. The block's Command column still prints the six canonical commands, so tests assert the real v1 table. Any other content (not an array, not six items, or a non-string item) is a usage error: a message on stderr, no block, exit 64. **Preflight:** if Yarn through Corepack is unavailable, it prints the D-10 Windows host precondition message on stderr, writes no block, and exits 69. For AC-1, `AC1_REF` or the peeled `4.0.0` tag gives the SHA (WI-3). For AC-2, also `gh pr list` / `gh pr view`; an empty PR list fails the test |
| B Format scope | AC-14 | none | WI-9 | WI-10 | `package.json` `scripts["format:check"]`, run with the repo's Prettier in a scratch copy of the tracked tree |
| C Smoke listing | AC-89 | WI-6 | WI-7 | WI-8, WI-40 | `npx playwright test --list` with `playwright.config.js`, which lists titles. It runs in a child process without Jest's `JEST_*` environment variables, `JEST_WORKER_ID` included. With no tests it exits 1 and prints `Error: No tests found`. The test reads that as an empty list only when it is the only error in the output; any other error is a harness error that fails the test (WI-7) |
| D Runtime | AC-4, AC-7, AC-8, AC-9, AC-12 | none | WI-11 | WI-12, WI-13 | `.nvmrc` line 1; `netlify.toml` `[build.environment]`; `.github/workflows/ci.yml` `jobs.test.steps[].run` and `env`; `package.json` `packageManager`; `README.md` `## Install` fenced blocks; `nodejs/Release` `schedule.json` |
| E Runtime sync | AC-10, AC-11 | WI-14 | WI-15 | WI-16, WI-17 | `export async function syncRuntimeVersions({ cwd, fetchYarnVersions, fetchNodeIndex })` in `scripts/sync-runtime-versions.mjs`. It resolves `{ changed: boolean, files: string[] }`; the CLI exits 0 |
| F Renovate | AC-5, AC-6, AC-108 | none | WI-18 | WI-19 | `renovate.json`. `renovate-config-validator --strict`. `renovate --platform=local` (lookup) against the WI-18 stub npm registry |
| G GitHub state | AC-3, AC-13 | none | WI-20 | WI-21, WI-66 (snapshot: WI-1) | `GET /repos/ValhallaTech/PortfolioPage-FS3/rulesets` and `/rulesets/{id}`; the `<!-- ruleset-snapshot:15072163 -->` comment on PR-1; `gh pr view 56 --json state`, and the same for 68 |
| H Dependencies | AC-87, AC-88 | none | WI-22 | WI-23 | `package.json` `devDependencies`; exit code of `yarn npm audit --all --recursive --environment all --severity high` |
| I Changelog and intake | AC-103, AC-104, AC-105, AC-106 | none | WI-24 | WI-25, WI-26, WI-64 | `CHANGELOG.md` `## [T] - YYYY-MM-DD` headings against `git tag --list` and `gh release view T --json publishedAt`; `.github/ISSUE_TEMPLATE/` |
| J Cleanup | AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-22, AC-23, AC-25, AC-26, AC-30, AC-31 | none | WI-27 | WI-28 to WI-32, WI-34 | Tracked-file search (Conventions); `src/index.html` (`DOMParser`); `src/css/style.css` (PostCSS rule blocks); `src/js/*.js`; `package.json`; `coverage/coverage-summary.json` |
| K Isotope gone | AC-118 | none | WI-36 | WI-37, WI-38 | Tracked-file search for `isotope` |
| L Build output | AC-69, AC-70, AC-74, AC-75 | none | WI-41 | WI-42, WI-43, WI-44 | `dist/` after `yarn build`: every file's text, `dist/*.css` `@font-face` blocks, font file names, `dist/index.html` `<img>` attributes |
| M Markup and tokens | AC-27, AC-28, AC-29, AC-47, AC-48, AC-55, AC-62, AC-63, AC-64, AC-65 | none | WI-47 | WI-48, WI-49 | `src/index.html` (`DOMParser`); `src/css/style.css` `:root` and other rule blocks (PostCSS) |
| N Headers and D-5 | AC-79, AC-80, AC-81, AC-82, AC-84, AC-85, AC-86, AC-113 | none | WI-56 | WI-57, WI-58, WI-59 | The `**D-5 decision:**` line in §3 of this spec; the `netlify.toml` `[[headers]]` entry with `for = "/*"`; `src/index.html`; the live `HEAD /` response headers; the live `<script src>.map` status codes |
| O Docs and release | AC-93, AC-94, AC-95, AC-96, AC-97, AC-98, AC-99, AC-100, AC-101, AC-102 | none | WI-62 | WI-63, WI-65, WI-67 | `README.md`; `package.json` `license` and `version`; `src/index.html` footer `.copyright`; `gh repo view --json description`; `git ls-remote --tags origin refs/tags/4.0.0` |

**Every AC.** Levels follow the PRD's `Executable as` unchanged.

| AC | Check | Level | Where it runs |
| --- | --- | --- | --- |
| AC-1 | `windows-fresh-clone.test.js`: `gate.mjs --fresh-clone … --autocrlf` on Windows; exit codes `[0,0,0,0,0,0]`. The SHA comes from `AC1_REF`, or else from the peeled `4.0.0` tag; with neither it fails with "no release commit yet". Needs the Windows host Corepack precondition (D-10) | build | S5 on Fred's Windows host, at release (WI-65) |
| AC-2 | `pr-gate-evidence.test.js`, which fails when the search finds no merged PR, plus the S1 `gate-evidence.test.js` format check | integration | S5 at release; the format check in S1 |
| AC-3 | `github-ruleset.test.js`: exactly one ruleset that targets `main` and requires the check, not `15072163`, `disabled`; the General Ruleset matches WI-1's PR-1 snapshot | integration | S5 |
| AC-4 | `ci-steps-linux.test.js` (plain `node:26-bookworm`, no Corepack) | integration | S5 (Docker) |
| AC-5 | `renovate-validate.test.js` (validator `--strict` via `npx`) | lint | S5 (needs npm network) |
| AC-6 | `renovate-bootstrap-prerelease.test.js` (stub registry harness) | integration | S5 |
| AC-7 | `runtime-pins.test.js` | lint | S1 |
| AC-8 | `node-support.test.js` | integration | S5 |
| AC-9 | `readme-install.test.js` (container after `npm uninstall -g corepack yarn`, with any image Yarn 1 links removed, and `command -v corepack` and `command -v yarn` both asserted to fail) | integration | S5 (Docker) |
| AC-10 | `sync-runtime-versions.test.js`, no-drift case | integration | S1 |
| AC-11 | `sync-runtime-versions.test.js`, drift case | integration | S1 |
| AC-12 | `runtime-pins.test.js` | lint | S1 |
| AC-13 | `superseded-prs.test.js` | integration | S5 |
| AC-14 | `format-scope.test.js` | integration | S1 |
| AC-15 | `cleanup.test.js`: `git ls-files` plus a tracked search for `icofont` | lint | S1 |
| AC-16 | `cleanup.test.js`: the 8 images | lint | S1 |
| AC-17 | `cleanup.test.js`: `boxicons`, `just-validate` | lint | S1 |
| AC-18 | `cleanup.test.js`: `observeSkills`, `skills-content`, `progress-bar` | lint | S1 |
| AC-19 | `cleanup.test.js`: toggle count | lint | S1 |
| AC-20 | `css-hygiene.test.js`: the AC-20 regexes | lint | S1 |
| AC-22 | `css-hygiene.test.js`: `.php-email-form` rule count ≤ 1 | lint | S1 |
| AC-23 | `css-hygiene.test.js`: the 8 checks | lint | S1 |
| AC-24 | `cleanup.spec.js`: `#footer` padding at `small` | e2e | S2 |
| AC-25 | `cleanup.test.js`: `@popperjs/core` present | lint | S1 |
| AC-26 | `cleanup.test.js`: the AC-26 patterns in `src` | lint | S1 |
| AC-27 | `css-tokens.test.js`: no literals outside `:root` | lint | S1 |
| AC-28 | `css-tokens.test.js`: distinct normalized values | lint | S1 |
| AC-29 | `css-tokens.test.js`: no `--bs-*` declarations | lint | S1 |
| AC-30 | `cleanup.test.js`: no `require(` in `src/js` | lint | S1 |
| AC-31 | `coverage-threshold.test.js` (json-summary); the gate's own threshold enforces it on every PR | unit | S5, and gate step 4 |
| AC-32 | `cleanup.spec.js`: `querySelectorAll` counters, `c50 <= c1` | e2e | S2 |
| AC-33 | `cleanup.spec.js`: active nav after `scrollIntoView(#services)` | e2e | S2 |
| AC-34 | `cleanup.spec.js`: back-to-top at 50 px and 150 px | e2e | S2 |
| AC-35 | `portfolio.spec.js`: Tab walk reaches the four filter buttons | e2e | S2 |
| AC-36 | `portfolio.spec.js`: Enter on `App` shows {1, 3, 6} | e2e | S2 |
| AC-37 | `portfolio.spec.js`: `aria-pressed` | e2e | S2 |
| AC-38 | `a11y.spec.js`: `toHaveAccessibleName` × 6 | e2e | S2 |
| AC-39 | `assets.spec.js`: `aria-expanded` sequence | e2e | S2 |
| AC-40 | `a11y.spec.js`: toggle focus outline | e2e | S2 |
| AC-41 | `a11y.spec.js`: Tab walk focus indicators at `desktop` and `small` | e2e | S2 |
| AC-42 | `portfolio.spec.js`: focused action link inside its wrap, opacity 1 | e2e | S2 |
| AC-43 | `portfolio.spec.js`: `phone`, `(hover: none)` precondition | e2e | S2 |
| AC-44 | `motion.spec.js`: the pause button stops rotation for 11 s | e2e | S3 |
| AC-45 | `a11y.spec.js`: the 11 contrast rows | e2e | S2 |
| AC-46 | `a11y.spec.js`: hero lightest-pixel contrast at `phone` and `desktop` (`@live`) | e2e | S2 and S4 |
| AC-47 | `html-semantics.test.js`: one `h1` | lint | S1 |
| AC-48 | `html-semantics.test.js`: heading levels outside `#contactModal` | lint | S1 |
| AC-49 | `a11y.spec.js`: first Tab stop is the skip link | e2e | S2 |
| AC-50 | `a11y.spec.js`: skip link lands in `main` | e2e | S2 |
| AC-51 | `a11y.spec.js`: Tab walk never enters `#header` at `small` and `tablet` | e2e | S2 |
| AC-52 | `a11y.spec.js`: the open nav reaches About | e2e | S2 |
| AC-53 | `a11y.spec.js`: every `i` and `svg` is hidden or a named image | e2e | S2 |
| AC-54 | `cleanup.spec.js`: `aria-current` on Services | e2e | S2 |
| AC-55 | `html-semantics.test.js`: 9 distinct, non-generic alts | lint | S1 |
| AC-56 | `a11y.spec.js`: 18 distinct link names | e2e | S2 |
| AC-57 | Reviewer compares 9 images, alts and link names | manual | PR-8, reviewer (Fred) |
| AC-58 | `motion.spec.js`: bullets are named buttons | e2e | S2 |
| AC-59 | `motion.spec.js`: bullet boxes ≥ 24 × 24 | e2e | S2 |
| AC-60 | `a11y.spec.js`: 5 targets ≥ 44 × 44 | e2e | S2 |
| AC-61 | `a11y.spec.js`: at 1280 × 600, footer never intersects the focused nav link | e2e | S2 |
| AC-62 | `html-semantics.test.js`: `main #hero` | lint | S1 |
| AC-63 | `html-semantics.test.js`: nav name | lint | S1 |
| AC-64 | `html-semantics.test.js`: testimonial `alt=""` | lint | S1 |
| AC-65 | `html-semantics.test.js`: About alt against the header alt | lint | S1 |
| AC-66 | `motion.spec.js`: `aria-busy` with a delayed mock | e2e | S2 |
| AC-67 | `assets.spec.js`: no image response decodes to 3840 px or wider at `phone` (`@live`) | e2e | S2 and S4 |
| AC-68 | `assets.spec.js`: 0 Google font requests on a full visit (`@live`) | e2e | S2 and S4 |
| AC-69 | `build-output.spec.js`: no Google font hosts in `dist/` | build | S2 (`@build`) |
| AC-70 | `build-output.spec.js`: `font-display` | build | S2 (`@build`) |
| AC-71 | `assets.spec.js`: computed families and `document.fonts.check` (`@live`) | e2e | S2 and S4 |
| AC-72 | `assets.spec.js`: every icon slot renders ≥ 8 × 8 (`@live`) | e2e | S2 and S4 |
| AC-73 | Side-by-side against WI-1's screenshots | manual | PR-7, reviewer (Fred) |
| AC-74 | `build-output.spec.js`: no icon font files | build | S2 (`@build`) |
| AC-75 | `build-output.spec.js`: `<img>` `width` and `height` | build | S2 (`@build`) |
| AC-76 | `assets.spec.js`: CLS ≤ 0.1 at `phone` and `desktop` (`@live`) | e2e | S2 and S4 |
| AC-77 | `assets.spec.js`: below-fold images lazy (`@live`) | e2e | S2 and S4 |
| AC-78 | `assets.spec.js`: profile image is a circle (`@live`) | e2e | S2 and S4 |
| AC-79 | `spec-decisions.test.js`: exactly one D-5 decision line | lint | S1 |
| AC-80 | `live-sourcemaps.test.js`: every `<script src>.map` returns 404 | integration | S5 (live) |
| AC-81 | `headers-config.test.js` | lint | S1 |
| AC-82 | `live-headers.test.js`: report-only CSP present, enforcing CSP absent | integration | S5 (live) |
| AC-83 | `csp.spec.js`: full visit, 0 violations and 0 CSP console messages (`@live`) | e2e | S2 and S4 |
| AC-84 | `inline-styles.test.js` | lint | S1 |
| AC-85 | `live-headers.test.js`: no `x-xss-protection` | integration | S5 (live) |
| AC-86 | `live-headers.test.js`: `permissions-policy` | integration | S5 (live) |
| AC-87 | `audit.test.js` | integration | S5 |
| AC-88 | `devdeps-pinned.test.js` | lint | S1 |
| AC-89 | `smoke-coverage.test.js` (`--list`), and every row passes in the gate | lint | S1, plus S2 |
| AC-90 | `baseline-sensitivity.test.js`: unmocked submit case | e2e | S5 (drives S2 in a worktree) |
| AC-91 | `baseline-sensitivity.test.js`: breakpoint case | e2e | S5 (drives S2 in a worktree) |
| AC-92 | `baseline-sensitivity.test.js`: dialog case | e2e | S5 (drives S2 in a worktree) |
| AC-93 | `readme-links.test.js`: absolute URLs 2xx, relative targets tracked | integration | S5 |
| AC-94 | `readme-links.test.js`: images return 200 `image/*` | integration | S5 |
| AC-95 | `readme.test.js`: version statements | lint | S1 |
| AC-96 | `readme.test.js`: the 9 forbidden patterns | lint | S1 |
| AC-97 | `repo-description.test.js` | integration | S5 |
| AC-98 | `readme.test.js`: © in README and footer | lint | S1 |
| AC-99 | `readme.test.js`: the 7 docs-audit rows | lint | S1 |
| AC-100 | `readme.test.js`: `GPL-3.0-only` in README and `package.json` | lint | S1 |
| AC-101 | `readme.test.js`: `yarn test:smoke` in Usage | lint | S1 |
| AC-102 | `release-tag.test.js` | integration | S5, after WI-65 |
| AC-103 | `changelog.test.js` | lint | S1, and re-run at the tag |
| AC-104 | `changelog-dates.test.js` | integration | S5, after WI-65 |
| AC-105 | `issue-forms.test.js`: structure | lint | S1 |
| AC-106 | `issue-forms.test.js`: forbidden words | lint | S1 |
| AC-107 | Signed-in reviewer opens `/issues/new/choose` | manual | PR-4, after merge, reviewer (Fred) |
| AC-108 | `renovate-automerge-paused.test.js` | lint | S1 |
| AC-109 | `motion.spec.js`: reduced motion, no rotation for 11 s | e2e | S3 |
| AC-110 | `motion.spec.js`: `MutationObserver` phrase sequence | e2e | S3 |
| AC-111 | `motion.spec.js`: settles on the last phrase within 45 s | e2e | S3 |
| AC-112 | `motion.spec.js`: no running animations in `#hero` | e2e | S3 |
| AC-113 | `live-headers.test.js`: COOP value | integration | S5 (live) |
| AC-114 | `motion.spec.js`: no `/loop/i` console message at 7 widths | e2e | S3 |
| AC-118 | `isotope-gone.test.js` | lint | S1 |
| AC-119 | `portfolio.spec.js`: filter sets at `desktop` and `small` | e2e | S2 |
| AC-120 | `portfolio.spec.js`: lightbox from items 1–9 | e2e | S2 |
| AC-121 | `portfolio.spec.js`: 9 widths × 4 filters, no horizontal scroll | e2e | S2 |
| AC-122 | `portfolio.spec.js`: items inside `#portfolio`, which ends above `#services` | e2e | S2 |
| AC-123 | Fred views the layout at `small`, `tablet` and `desktop` × 4 filters | manual | PR-6, Fred |
| AC-124 | `portfolio.spec.js`: under reduced motion, every frame after the `App` click equals the final state, and no animation runs on the items or the grid, at `desktop` and `small` | e2e | S2 |

AC-21, AC-115, AC-116 and AC-117 are withdrawn in §2.3 and have no check.

### 3.8 Domain tag summary

| Tag | Work items | Suggested specialist |
| --- | --- | --- |
| `frontend` | WI-28, WI-30, WI-32, WI-33, WI-37, WI-42, WI-43, WI-44, WI-48, WI-49, WI-50, WI-52, WI-53, WI-54, WI-57 (15) | Frontend Expert |
| `backend` | WI-2, WI-4, WI-14, WI-16, WI-23 (5) | JavaScript/Web Coding Expert: Node automation scripts and the toolchain manifest |
| `security` | WI-58 (1) | Security Reviewer |
| `docker` | WI-5 (1) | Docker Expert |
| `tests` | WI-1, WI-3, WI-6, WI-7, WI-8, WI-9, WI-11, WI-15, WI-18, WI-20, WI-22, WI-24, WI-27, WI-31, WI-34, WI-35, WI-36, WI-39, WI-40, WI-41, WI-45, WI-46, WI-47, WI-51, WI-55, WI-56, WI-60, WI-61, WI-62 (29) | Playwright E2E Test Engineer: WI-1, WI-6, WI-7, WI-8, WI-35, WI-40, WI-41, WI-46, WI-51, WI-55, WI-60, WI-61. JavaScript/TypeScript Unit Test Engineer: all others |
| `ci` | WI-10, WI-12, WI-17, WI-19, WI-21, WI-59, WI-65 (7) | CI/CD Pipeline Engineer |
| `docs` | WI-13, WI-25, WI-26, WI-29, WI-38, WI-63, WI-64 (7) | Documentation Agent |
| unmapped | WI-66, WI-67 (2) | PR Agent; Documentation Agent |

`database`, `redis` and `openfga` are unused. Total: 65 tagged and 2 unmapped, so 67 work items.

#### Raised for Gate 2

None remain. Fred answered D-16 at Gate 2 with **Muuri**, overriding the Architect's "no library" recommendation. It is resolved in §3.3 (D-16) and in WI-37.

##### D-16 candidate comparison (Gate 2 record)

At Gate 2 the Architect recommended no library. The reasons were that nine equal-ratio images make justified or masonry layouts identical to today's grid, that it costs 0 bytes, that it needs no absolute positioning, and that it shows every item with JS off. Fred chose Muuri for its animated filtering. The no-library design stays on record as the exit route if Muuri ever breaks (RK-20).

**Evidence** (all checked 2026-11-17):
- *Methods:* Context7 `/haltu/muuri`, `/spope/minimasonry.js` and `/nk-o/flickr-justified-gallery`; the GitHub pages `haltu/muuri`, `miromannino/Justified-Gallery` and `Spope/MiniMasonry.js`; the npm registry packuments; the bundlephobia size API; `justified-gallery@4.0.2` `dist/*.d.ts` and `dist/justified-gallery.js` via unpkg.
- *Context7 resolution:* "Justified Gallery" resolved to nK's *Flickr Justified Gallery* (`flickr-justified-gallery` 2.2.0, MIT, ESM). That is a different project. The candidate below is miromannino's `justified-gallery`.

| | Justified Gallery (`justified-gallery` 4.0.2) | Muuri 0.9.5 | MiniMasonry.js 1.3.2 | No library |
| --- | --- | --- | --- | --- |
| Filtering | A `filter` setting (selector or function), read once on init. No API to change it later, so each filter click means destroying and re-initializing | Built in: `grid.filter(predicate, { instant, layout })` | None. Hide the items yourself and call `layout()`; behavior with hidden children not verified | Toggle `hidden` (one function) |
| Layout model | Justified rows. Absolute `top`/`left` set per item; entries stay hidden by CSS until positioned | Absolute items with transform; animated show, hide and move | Absolute items with transform, in a masonry of columns | Bootstrap flex grid, the same look as today |
| Maintenance | npm package republished 2026-08-28 (1.0.0, then 4.0.0 the same day); 4.0.2 on 2026-09-13; 124 open issues. The jQuery-era plugin lives on as the separate `justifiedGallery` package | Last release 0.9.5 on 2021-07-09 (packument modified 2022-06-20); 96 open issues | Last release 1.3.2 on 2023-04-03; 5 open issues | Not applicable |
| License (repo is `GPL-3.0-only`) | MIT, compatible | MIT, compatible | MIT, compatible | Not applicable. Removing Isotope (GPL-3.0 or commercial) removes a dual-licensed dependency |
| Size | Not measured: bundlephobia returned 429. The whole package unpacks to 45,344 bytes, including CSS and types, and its JS is about 13–14 KB of text | 83,530 B minified / 23,075 B gzip | 4,295 B minified / 1,294 B gzip | 0 B (Isotope today: 32,475 / 9,326 B) |
| jQuery | No (v4 is a plain class) | No | No | No |
| ESM / Parcel | `type: module`; `exports` provides `import` and `./style.css` | `module: dist/muuri.module.js` | `module: build/minimasonry.esm.js` | Not applicable |
| Filtering accessibility | Adds the class `jg-filtered`; DOM order kept. The layout depends on JS, so with JS off the entries stay hidden | Hides after an animation (then `display: none`); DOM order kept. Animations ignore reduced motion unless configured | Depends on how hiding is done by hand | DOM order kept; hidden items leave the tab order and the accessibility tree; works with JS off |
| CSP | Sets individual style properties (CSSOM): compliant | Per-property CSSOM plus `element.animate()`: compliant. Verified after Gate 2 in `muuri.module.js` | Transforms by style properties (README): compliant | Compliant |

**How the others compared:**
- **MiniMasonry.js** is the lightest of the three, but has no filtering of its own.
- **Muuri** (chosen) is the only one with animated filtering, at about 23 KB gzip. It has been unmaintained since 2021 and uses absolute positioning (RK-20, RK-21).
- **Justified Gallery 4** was rewritten in 2026 and can only set its filter at initialization.

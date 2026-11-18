# GSAP migration analysis: PortfolioPage-FS3

Read-only analysis, 2026-11-16. No repo file was changed. `node_modules` is **not installed** in the repo (checked with `ls`), so package facts come from the npm registry (`npm view`), jsDelivr's metadata API, and bundlephobia's API. They do not come from local files.

Paths are relative to `C:\Repo\PortfolioPage-FS3`. "main" means `src/js/main.js`, "utils" means `src/js/utils.js`, "html" means `src/index.html`, and "css" means `src/css/style.css`.

---

## 1. Inventory of every animation and motion on the page

### 1a. JavaScript-driven

| # | Motion | Where | What it does today | Notes |
|---|---|---|---|---|
| J1 | Hero typing | main:6, 39–51, 244–245; html:91–93 | Typed.js with `loop`, `typeSpeed:100`, `backSpeed:50`, `backDelay:2000` over 4 strings from `data-typed-items` | The cursor (`.typed-cursor`) and its blink CSS are injected by Typed.js at runtime: `rg typed-cursor css` finds 0 matches. Typed's `smartBackspace` is on by default, so it erases only the part that differs from the next string ("a De…"). That default is unverified here because `node_modules` is absent; confirm it in `node_modules/typed.js` after install. The span is empty in the HTML, so with no JS the hero reads "I am" followed by nothing. |
| J2 | Scroll reveals | main:7, 119–138, 303 | ScrollReveal is created with `distance 60px`, `duration 1000`, `ease-in-out`, `once:true`, then given 10 `reveal()` calls | The page has 15 `data-sr` elements and 8 `data-sr-delay` elements, listed in the next table. |
| J3 | Smooth scroll to section | utils:10–16, 122–142; main:248, 251–256 | Native `window.scrollTo({behavior:'smooth'})`, plus a 100 ms timeout for the URL hash on load | It never checks reduced motion: `behavior:'smooth'` is hard-coded. |
| J4 | Back-to-top show/hide | utils:79–89; main:274–277 | Writes inline `display:flex/none` on **every** scroll event | It does not animate, because `transition: display` at css:52 is a no-op. |
| J5 | Back-to-top click | main:280–286 | Native smooth scroll to the top | Same reduced-motion gap as J3. |
| J6 | Active nav on scroll | utils:47–74; main:274–277 | A scroll listener that is not throttled and not passive. On every event it runs `querySelectorAll` over every section and every nav link. | This is a performance smell, not motion, but it shares the scroll listener. |
| J7 | Skills progress bars | utils:96–114; main:289–290; css:479–514 (`.skills .progress-bar { transition: .9s }`) | Not applicable | **Dead code.** `.skills-content` does not exist in html: `rg -n -i "skills\|progress" src/index.html` matches only prose at lines 107 and 353. `observeSkills(null)` returns `null`. It is still covered by tests at `__tests__/utils.test.js:205–283`. |
| J8 | Isotope filter | main:8, 58–72 | Isotope's own hide, reveal and move transitions on `.portfolio-item` (Outlayer opacity, scale and translate) | Isotope's defaults are not overridden here. |
| J9 | Testimonials carousel | main:79–92 | Swiper slide transition, `autoplay 5000ms`, `loop:true`, 1, 2 or 3 slides per view | Loop mode moves slide DOM nodes with `prepend`/`append` *(verified 2026-11-16 via Context7 `/websites/deepwiki_nolimits4web_swiper`, "Loop Fix Algorithm")*. There are 3 slides and `slidesPerView:3` at ≥900px, so expect Swiper's "not enough slides for loop" console warning. Confirm in a browser. |
| J10 | Lightbox | main:102–114 | GLightbox's built-in open, close and slide effects | |
| J11 | Contact modal | html:469 (`.modal.fade`); main:12, 214 | Bootstrap fade and slide CSS transition | |
| J12 | Mobile nav open/close | utils:21–42 → css:239–247 | A class toggle on `body` animates `#header` `left` from -300px to 0 through the transition at css:85–86 | It animates `left`, a property that triggers layout. css:85 is a dead duplicate of css:86. |

### 1b. `data-sr` targets in index.html

| html line | Element | `data-sr` | Delay | Resulting ScrollReveal config |
|---|---|---|---|---|
| 87 | `.hero-container` | fade-in | Not set | **Revealed twice.** main:127 sets `{origin:top, delay:200}` and main:131 then sets `{origin:bottom, distance:0}`. A later `reveal()` layers onto the element's existing config *(verified 2026-11-16 via scrollrevealjs.org/api/reveal.html)*. The effective result is a fade with no movement and a 200 ms delay, so `origin:'top'` is dead config. |
| 111 | About image column | fade-right | Not set | `origin:right` enters **from the right**. AOS `fade-right`, which ScrollReveal replaced (main:117), moved from the left. The direction flipped in the earlier migration. |
| 116 | About text column | fade-left | Not set | Enters from the left. Same inversion as line 111. |
| 150 | Portfolio filter row | fade-up | Not set | |
| 161 | `.portfolio-container` | fade-up | 100 | This is the Isotope container. The reveal targets the container, not the items, which is correct. |
| 303–328 | 6 × `.services .icon-box` | fade-up | 0, 100, 200, 300, 400 and 500 | A fixed absolute delay per element. On a 3-column grid, row 2 waits 300–500 ms even when it enters the viewport much later. |
| 350, 363, 376 | `.testimonial-item` inside `.swiper-slide` | fade-up | 0, 100 and 200 | The reveal is per slide inside a looping carousel. See the gotchas in section 5. |
| 403 | Contact row | fade-in | Not set | |

### 1c. CSS-only motion

| css line | Selector | Property animated | Live? |
|---|---|---|---|
| 52 | `.back-to-top` | `transition: display` | It does nothing, because `display` does not transition without `transition-behavior: allow-discrete`. |
| 69 | `.back-to-top:hover` | background | Live |
| 85–86 | `#header` | all 0.5s (mobile nav `left`) | Live. Line 85 is a duplicate. |
| 129 | `#header .profile .social-links a` | all 0.3s | Live |
| 191 | `.nav-menu a` | all 0.3s | Live |
| 230 | `.mobile-nav-toggle` | all 0.4s | Live |
| 467 | `.facts .count-box a` | all 0.3s | **Dead.** No `.facts` element exists in html. |
| 512 | `.skills .progress-bar` | width 0.9s | **Dead** (J7) |
| 617 | `#portfolio-flters li` | color | Live |
| 635, 649, 662, 672 | `.portfolio-wrap` hover overlay | opacity, and `bottom` from -60px to 0 | Live. Animating `bottom` triggers layout. |
| 720 | `.services .icon` | background | Live |
| 909, 952 | `.contact .info` icons and social links | colors | Live |
| 1034, 1099 | Submit and contact-modal buttons | background | Live |
| 1050–1053, 1112–1136 | `.php-email-form .loading` and `@keyframes animate-loading` | rotate spinner | **Dead.** No `.loading` element exists in html. |
| 310–317 | `#hero` `background-attachment: fixed` | Static parallax effect | Live. This is not an animation. |

There is no `prefers-reduced-motion` query anywhere in `style.css`, and main.js does no reduced-motion check (rg found 0 matches).

---

## 2. GSAP mapping

| # | Today | GSAP replacement | Move it? | Why |
|---|---|---|---|---|
| J1 | Typed.js | Core `gsap.timeline({repeat:-1})` that tweens a proxy `{n}` and writes `textContent = str.slice(0, n)` on each update. The cursor blinks with `gsap.to(cursor,{autoAlpha:0, repeat:-1, yoyo:true, ease:'steps(1)'})`. | **Yes** | With no plugin it adds 0 bytes on top of core. It reproduces `smartBackspace` (erase back to the common prefix), the separate type and erase speeds, and `backDelay`. The pure string logic can be unit-tested in utils. See the comparison with TextPlugin in section 3. |
| J2 | ScrollReveal | `gsap.from(el, {autoAlpha:0, x/y:±60, duration:1, ease:'power1.inOut', scrollTrigger:{trigger:el, once:true}})` for single elements, and `ScrollTrigger.batch()` with `stagger` for the services and testimonials groups | **Yes** | This is the core of the migration. `batch` replaces the fixed `data-sr-delay` values with a stagger that runs relative to when each row enters, which behaves better than the current delays. |
| Hero | ScrollReveal plus Typed run independently | One hero timeline: fade the container in, **then** start the typing timeline | **Yes** | Today typing starts at init while the hero is still hidden or fading. Sequencing these is GSAP's strongest advantage here. |
| J3, J5 | Native smooth scroll | `ScrollToPlugin`: `gsap.to(window,{scrollTo:{y:target, autoKill:true}})` | **Optional** | Native scrolling is free. The plugin buys a consistent ease and duration, `autoKill`, and reduced-motion handling in the same `matchMedia` block. It is cheap at 4.1 KB minified. If you skip it, fix the reduced-motion gap in J3 anyway. |
| J4 | Inline `display` toggle | CSS class toggle with `opacity`/`visibility` transitions, driven by a ScrollTrigger `onToggle` (`start: 100` px) | **Trigger yes, motion in CSS** | You can drop the per-scroll inline style writes. A fade on hover or show is CSS work. |
| J6 | Scroll listener that is not throttled | A ScrollTrigger per section with `onToggle`/`onEnter` that sets the active link | **Yes, if ScrollTrigger lands** | It removes the hand-rolled scroll listener. Keep a pure `getActiveSectionId()` in utils so the logic stays tested. |
| J7 | Dead skills bars | None | **Delete** | Remove the code, its tests and the CSS. Do not migrate dead code. |
| J8 | Isotope transitions | None. Optionally replace Isotope as a whole with GSAP **Flip** plus CSS grid. | **No**, unless Isotope is dropped | Isotope owns `transform` and `left`/`top` on `.portfolio-item`, and two engines writing the same properties overwrite each other. Replacing Isotope with Flip is a separate decision: it would remove a GPL-or-commercial dependency (32.5 KB minified, 9.3 KB gzip) and add 25.6 KB minified for Flip. |
| J9 | Swiper | None | **No** | Swiper owns the wrapper transform, touch physics and loop DOM moves, and GSAP would fight it. Use reduced motion to pause autoplay instead. |
| J10, J11 | GLightbox and Bootstrap modal | None | **No** | These are the libraries' own internal transitions. |
| J12 | Mobile nav `left` transition | None. Change it to a CSS `transform: translateX()` transition. | **No (keep CSS)** | It is a two-state class toggle, which CSS handles best. The real fix is compositor-only properties. |
| CSS hovers | `:hover` transitions | None | **No** | They are declarative, need no JS, and cost nothing. Moving them to GSAP adds listeners and bytes for no gain. Fix the layout-triggering `bottom` at css:655/697 by switching to `transform`. |
| Reduced motion | No handling anywhere | `gsap.matchMedia()` with conditions `{motion:'(prefers-reduced-motion: no-preference)', reduce:'(prefers-reduced-motion: reduce)'}`. Use `duration:0` or no `from` state under `reduce`. Add a CSS `@media (prefers-reduced-motion: reduce)` block for the CSS transitions. | **Yes** | It puts reduced-motion handling for all GSAP motion in one place, and it reverts and re-runs automatically when the preference changes. |

**Not needed:** SplitText, because nothing splits words or lines.

---

## 3. GSAP facts, verified live

| Fact | Finding | Verification |
|---|---|---|
| npm package | `gsap`. The registry's current version at check time was 3.15.1. Renovate manages the version, so this is not a recommendation. | *(verified 2026-11-16 via `npm view gsap version`)* |
| Plugins on public npm | The private registry (npm.greensock.com) is no longer maintained, and "all the plugins are now freely available on npm". The `gsap` package ships `ScrollTrigger.js`, `ScrollToPlugin.js`, `TextPlugin.js`, `SplitText.js` and `Flip`, each with a `dist/*.min.js`. | *(verified 2026-11-16 via gsap.com/docs/v3/Installation and the jsDelivr data API file listing for gsap@3.15.1)* |
| ESM import paths | The `exports` map has `"./*": {import:"./*.js", require:"./dist/*.js"}`. So `import { ScrollTrigger } from 'gsap/ScrollTrigger'` resolves to ESM under Parcel, and `require('gsap')` resolves to the UMD build under Jest. `sideEffects:false`. | *(verified 2026-11-16 via `npm view gsap@3.15.1 exports sideEffects`)* |
| Registration | Call `gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)` once, before use. Bundlers need it to stop tree shaking from dropping the plugin, and registering twice is harmless. The docs recommend a single module that imports, registers and re-exports. | *(verified 2026-11-16 via Context7 `/websites/gsap`, gsap.registerPlugin and Installation pages)* |
| TextPlugin | `text:{value, delimiter, speed, newClass, oldClass, rtl, type:'diff', …}`. `speed` sets duration as "0.05 / speed × changes". Rewinding a tween reverts the text. It has no loop, back-delete speed, cursor or smart-backspace concepts, so you build those in a timeline. Its UMD minified file is 10,570 B, about the size of all of typed.js. | *(verified 2026-11-16 via Context7 `/websites/gsap`, TextPlugin page; size from the jsDelivr API)* |
| TextPlugin vs a hand-written loop | **Recommend a core-only loop.** It costs 0 extra bytes, does smart backspace with a pure `commonPrefixLength(a, b)`, and keeps separate type and erase speeds (100 and 50 ms per character) and a 2 s hold, all testable. TextPlugin is a valid alternative if Fred prefers less code. Erasing by tweening to `''` replaces text from the left, which does not look like backspace, so you need reverse or yoyo tricks. | Design judgment based on the facts above |
| `once` | `once:true` makes the trigger kill itself after its first end, calls `onEnter` at most once, does **not** kill the animation, and sets `toggleActions` to `"play none none none"`. That matches ScrollReveal's `once:true`. | *(verified 2026-11-16 via Context7 `/websites/gsap`, ScrollTrigger config)* |
| `toggleActions` default | `"play none none none"` | Same source as above |
| `ScrollTrigger.batch` | Creates one trigger per element and batches callbacks that fire within `interval` (default about one rAF). `batchMax` caps a batch and can be a function re-evaluated on refresh. It accepts "most normal ScrollTrigger values" such as `start`, `end` and `once`. When you pre-set `y`, docs advise resetting it in `refreshInit` so measurements stay accurate. | *(verified 2026-11-16 via Context7 `/websites/gsap`, static.batch())* |
| Refresh | ScrollTrigger auto-refreshes on `visibilitychange,DOMContentLoaded,load,resize`. After other DOM reflows you must call `ScrollTrigger.refresh()` yourself, and `refresh(true)` waits for render. | *(verified 2026-11-16 via Context7 `/websites/gsap`, static.refresh() and static.config())* |
| `gsap.matchMedia` | Conditions syntax `{isDesktop, reduceMotion:"(prefers-reduced-motion: reduce)"}` reads booleans from `context.conditions`. It reverts and re-runs when any condition toggles. `gsap.matchMediaRefresh()` re-runs everything. | *(verified 2026-11-16 via Context7 `/websites/gsap`, gsap.matchMedia())* |
| ScrollToPlugin | `scrollTo:{y:'#id'\|number, offsetY, autoKill, onAutoKill}` | *(verified 2026-11-16 via Context7 `/websites/gsap`, ScrollToPlugin)* |
| Cost | "GSAP is now 100% free for all users, thanks to Webflow's support", and the page states that it is maintained by the GSAP team at Webflow | *(verified 2026-11-16 via gsap.com/pricing)* |

---

## 4. License analysis (facts, plus a flagged question; not legal advice)

| Package | License | Verification |
|---|---|---|
| This repo | GPL-3.0 | `LICENSE` header read 2026-11-16 |
| typed.js 3.0.0 | **GPL-3.0** ("version 3 … or any later version") | *(verified 2026-11-16 via `npm view typed.js license` and raw GitHub `LICENSE.txt`)* |
| scrollreveal 4.0.9 | **GPL-3.0**. The vendor also sells commercial licenses (Developer, Team and Extended). | *(verified 2026-11-16 via `npm view` and scrollrevealjs.org/pricing)* |
| isotope-layout 3.0.6 | **GPL-3.0**, or commercial or OEM. Metafizzy says that releasing a project using Isotope under GPLv3 "requires your project to be licensed under the GPLv3". | *(verified 2026-11-16 via `npm view` and isotope.metafizzy.co/license.html)* |
| swiper and glightbox | MIT | *(verified 2026-11-16 via `npm view`)* |
| **gsap** | npm `license`: "Standard 'no charge' license: https://gsap.com/standard-license." The terms are Webflow's, effective 2025-04-30 and last modified 2025-05-30. | *(verified 2026-11-16 via `npm view` and gsap.com/standard-license)* |

**GSAP Standard License terms that matter here (as summarized from the page):**
- It is free, including commercial use, and it includes the former members-only plugins.
- **Prohibited Uses**: tools that let users build visual animations without code where that competes with Webflow's animation builder. A portfolio page is not that kind of use.
- You may not remove or alter proprietary notices or branding.
- Webflow keeps all IP, may **terminate** the license for non-compliance, and may **amend** it. Continued use counts as acceptance, although earlier versions stay usable on their original terms.
- The page does **not** call it open source or OSI-approved and does not mention GPL compatibility. It also does not explicitly cover redistribution in bundled form; it grants "use, reproduce, display, and implement".

**Flagged question for Fred (an owner or counsel decision):**
Today every animation dependency is GPL-3.0, which matches the repo's license. After the migration, `dist/` would bundle GSAP. GSAP's license is not an OSI license and carries a field-of-use restriction plus termination and amendment clauses. Whether a GPL-3.0 work may be distributed combined with that library is not answered by either license's text as summarized above.

Options people commonly weigh:
- (a) Fred is the copyright holder of the repo's own code, so he could add a GPLv3 §7 additional permission (a linking exception) naming GSAP.
- (b) Relicense the repo.
- (c) Ship a third-party notices file that states GSAP's separate terms.
- (d) Stay on the GPL libraries.

This document does not pick one. Isotope stays GPL-3.0 under every option unless it is replaced.

**Build check that follows from the "do not remove notices" term:** after `yarn build`, confirm GSAP's header comment survives Parcel's minifier, for example with `rg -c "standard-license" dist/`. If it does not survive, configure the minifier to keep license comments.

---

## 5. Code-level gotchas

| # | Gotcha | Evidence | Recommendation |
|---|---|---|---|
| G1 | **Content flash before reveal, today and after migration.** No CSS hides `[data-sr]`. ScrollReveal applies inline hidden styles only when the module script runs, so above-the-fold content (the hero, and the About section on tall screens) can paint, then disappear, then fade in. If JS fails, everything stays visible, which is good. `gsap.from()` has the same timing. | css: `rg "data-sr\|visibility" style.css` finds no hide rule. html:515 loads `type="module"`. | Gate the hero only, in CSS: `@media (scripting: enabled) and (prefers-reduced-motion: no-preference) { .hero-container { visibility:hidden } }`, revealed with `autoAlpha`. The `scripting` media feature is Baseline "widely available" since December 2023 *(verified 2026-11-16 via MDN `@media/scripting`)*. Risk: if main.js throws before the hero tween, the hero stays hidden. Run the hero animation first in `init()` and isolate the other initializers with `try/catch`. Do not CSS-gate elements below the fold. |
| G2 | **The hero is revealed twice** | main:127 and main:131 both match html:87, and the configs merge (section 1b) | Use a single hero timeline in GSAP and remove `data-sr` from `.hero-container`. Decide on purpose whether "from top" was intended. Today it is dead config. |
| G3 | **Direction names are inverted against the original AOS semantics** | html:111 and 116 with main:128–129 | When mapping, choose `x:+60` to keep today's look or `x:-60` to restore the original template, and name the attributes after the direction of motion. |
| G4 | **Reveals on slides inside a looping Swiper** | html:350, 363, 376. Swiper loop moves slide nodes (J9), and slides that are off-screen horizontally are positioned by the wrapper's transform. | Reveal the `.testimonials .swiper` container once. Do not animate individual `.testimonial-item`s. Per-slide delays are meaningless at 1 slide per view, and they interact with loop rearrangement. |
| G5 | **Isotope and GSAP on the same elements** | Isotope writes `transform`, `opacity` and position on `.portfolio-item` (J8) | Never tween `.portfolio-item`. Tweening the container (html:161) is fine. Filtering changes the container height, which makes the start and end positions of every trigger below it stale. Call `iso.on('arrangeComplete', () => ScrollTrigger.refresh())`. |
| G6 | **`observeSkills` targets a missing element** | main:289. `.skills-content` is absent from html (rg confirmed). | **Confirmed dead.** Delete it from utils, main and css:479–514, and delete its tests at utils.test.js:205–283. Test edits belong to the JS/TS Unit Test Engineer. Do not port it to GSAP. |
| G7 | **jsdom has no `window.matchMedia`** | *(verified 2026-11-16 via jestjs.io/docs/manual-mocks: "This is e.g. the case with `window.matchMedia()`")* | Any test that loads `gsap.matchMedia` needs the documented mock. That is a further reason to keep GSAP out of utils.js. |
| G8 | **Testability and coverage** | jest.config.js:8 collects coverage only from utils.js, with an 80% threshold. Tests `require()` CommonJS, and there is no Babel config, so Jest cannot import ESM. | Put the **pure** logic in utils and test it: `commonPrefixLength`, `typingFrames(strings)`, `revealVarsFor(dataSr, distance)`, `getActiveSectionId(sections, scrollY)`, `parseDelayMs(attr)`. Put the GSAP wiring in a new `src/js/animations.js`, which is ESM and does no logic. It sits outside coverage on purpose, as main.js does today. If animations.js is ever unit-tested, `require('gsap')` resolves to the UMD build through the exports map (section 3), so it works under Jest. |
| G9 | **`limitCallbacks` default is `false`** | Context7 static.config() | After a reload in the middle of the page, `onEnter` fires for every trigger above the viewport, so those elements animate in off-screen. That is harmless with `once`, but setting `ScrollTrigger.config({limitCallbacks:true})` avoids the wasted work. |
| G10 | **Typed text accessibility** | html:91–93 is empty and filled only by JS | Put the first string statically in the HTML, mark the animated span `aria-hidden="true"`, and give screen readers a static visually hidden phrase. Under reduced motion, show one static string and do not type. |

---

## 6. Bundle size (minified / gzip bytes)

| Payload | Minified | Gzip | Source |
|---|---|---|---|
| typed.js 3.0.0 | 10,551 | 3,198 | bundlephobia API |
| scrollreveal 4.0.9 | 16,408 | 5,561 | bundlephobia API |
| **Before (animation libraries)** | **26,959** | **8,759** | |
| gsap core, including CSSPlugin (`index`) | 70,628 | 27,434 | bundlephobia API |
| ScrollTrigger | 44,683 | ~17,300 (est.) | jsDelivr `dist/ScrollTrigger.min.js`. Gzip is estimated at the core's measured ratio of 0.388. |
| ScrollToPlugin (optional) | 4,059 | ~1,600 (est.) | jsDelivr `dist/ScrollToPlugin.min.js` |
| TextPlugin (only if chosen over the core loop) | 10,570 | ~4,100 (est.) | jsDelivr `dist/TextPlugin.min.js`. This is UMD and includes its string utilities, so the ESM size will be smaller. |
| **After (core + ScrollTrigger)** | **~115,300** | **~44,700 (est.)** | |
| After, plus ScrollToPlugin | ~119,400 | ~46,300 (est.) | |
| **Change** | **+88 to +92 KB** | **+36 to +38 KB (about 5×)** | |
| Optional: Isotope swapped for Flip | -32,475 + 25,596 | -9,326 + ~9,900 (est.) | About neutral |

All sizes were checked 2026-11-16: bundlephobia `api/size` for whole packages, and the jsDelivr `data.jsdelivr.com/v1/packages/npm/<pkg>@<ver>?structure=flat` file listing for individual plugin files. Plugin gzip numbers are estimates, because the files were not downloaded. Verify against the real build by comparing `dist/*.js` sizes, gzipped, from `yarn build` on `main` and on the branch.

---

## 7. Proposed migration sequence

Each step ships on its own and is reviewed on its own. Every step runs the CI gates that `.github/workflows/ci.yml` runs: `yarn lint`, `yarn format:check`, `yarn test:ci` and `yarn build`. The repo has **no E2E harness**. Adding Playwright would be a new dev dependency, which Fred has to approve, so the manual checks below stand in for it until then.

| Step | Change | Files | Proof it works |
|---|---|---|---|
| 0 | **License decision** (section 4). This is a gate before any GSAP code lands. | Possibly `LICENSE`, plus a third-party notices file | Fred's written decision |
| 1 | **Pre-existing cleanup, with no GSAP:** delete the dead skills code (G6) and the dead `.facts`, `.skills` and `.loading` CSS and keyframes. Change `require('./utils')` to `import * as utils from './utils'` (Parcel interop, so Jest is untouched). Make the scroll listener `{passive:true}` and throttle it with rAF. Remove the no-op `transition: display` (css:52) and the duplicate transition (css:85). | utils.js, main.js, style.css; `__tests__/utils.test.js` goes to the Unit Test Engineer | Gates are green and coverage is still ≥80%. `rg -n "skills-content\|observeSkills\|animate-loading" src __tests__` returns 0. Manually: active nav still highlights while scrolling, and back-to-top still appears after 100 px. |
| 2 | **ScrollReveal → ScrollTrigger**, with `gsap.matchMedia` reduced-motion handling from day one. Add `gsap` and remove `scrollreveal`. Add `animations.js`, which registers plugins once. Add pure `revealVarsFor`/`parseDelayMs` to utils with tests. Use batch for services. The testimonials container gets a single reveal (G4), and Isotope `arrangeComplete` calls refresh (G5). | package.json, yarn.lock, main.js, `src/js/animations.js` (new), utils.js, index.html (attribute cleanup at :87, :350/:363/:376), tests | Gates are green. `rg -n -i scrollreveal src package.json` returns 0. Bundle diff is recorded. The GSAP banner is still in `dist` (section 4). Manually in Chrome and Firefox: every section reveals once; nothing re-hides on scroll-up; with OS reduce-motion on, content is visible immediately; after filtering the portfolio, sections below still reveal at the right point; reloading mid-page shows no stuck-hidden elements. |
| 3 | **Typed.js → GSAP core typing timeline**, sequenced after the hero fade (G1, G2, G10). Pure `commonPrefixLength` and `typingFrames` live in utils with tests. Remove `typed.js` and add the hero CSS gate. | package.json, yarn.lock, main.js, animations.js, utils.js, index.html:87–93, style.css (cursor and `scripting` gate), tests | Gates are green. `rg -n -i "typed\.js\|from 'typed" src package.json` returns 0. Manually: the loop cycles through all 4 strings, erases back to the common prefix, holds 2 s and blinks the cursor. Under reduced motion the text is static. With JS disabled the hero still shows the static text. |
| 4 | **Reduced motion for what stays outside GSAP:** add a CSS `@media (prefers-reduced-motion: reduce)` block for transitions, have smooth scroll in utils pick `'auto'` under reduce, and stop Swiper autoplay under reduce. | style.css, utils.js, main.js, tests | Gates are green. New utils branches are tested with a `matchMedia` mock (G7). Manually with OS reduce-motion on: no smooth scroll and no autoplay. |
| 5 | *(Optional)* **Active nav and back-to-top through ScrollTrigger**, which retires the scroll listener. Pure `getActiveSectionId` stays in utils. | main.js, animations.js, utils.js, style.css (back-to-top class), tests | Gates are green. `rg -n "addEventListener\('scroll'" src` returns 0. Manually: nav highlights correctly on every section in both directions, and back-to-top fades at 100 px. |
| 6 | *(Optional)* **Smooth scroll through ScrollToPlugin** (`autoKill`, reduced motion through matchMedia) | animations.js, main.js, utils.js (keep the injected `scrollFn` seam, utils:122) | Gates are green. Manually: nav clicks, URL hash on load, back-to-top click, and dragging the scrollbar mid-scroll cancels the tween. |
| 7 | *(Optional, separate decision)* **Isotope → GSAP Flip** filtering. This removes the last GPL-or-commercial animation dependency. | main.js, animations.js, style.css (grid), package.json | Gates are green. Manually: all filters, the layout at each breakpoint, and GLightbox still opens. |
| 8 | **Documentation handoff** to the Documentation Agent, after steps 2 and 3. README:21 and :37–38 name Typed.js and ScrollReveal, and README:62 lists them in main.js. Fix the pre-existing drift too: README:40 says Swiper `^12` while package.json has 14.3.0, and README:62 uses the UK spelling "initialisation". | README.md | Documentation Agent review |

### Other JavaScript modernization worth doing nearby

| Item | Where | Note |
|---|---|---|
| Mixed `import` and `require` | main:6–32 | Step 1. A full ESM conversion of utils.js would need Babel or Jest's ESM mode, which is a new dev dependency or flag, so it should be flagged before anyone does it. |
| Scroll handler that is neither throttled nor passive | main:274–277 | Step 1 for now, retired in step 5 |
| `updateActiveNav` re-queries the DOM for every section and link on every call | utils:47–74 | Refactor to a pure `getActiveSectionId` plus a thin DOM writer (step 5) |
| `.back-to-top` styled through inline `style` writes | utils:79–89 | Use a class toggle (step 5), which is also easier to assert in tests |
| `setupPortfolioFilters` uses `function`/`this` | utils:152 | Use `event.currentTarget` with an arrow function. This is minor, so fix it if utils is already open in that step. |
| Layout-triggering transitions | css:85–86 (`left`), 655/697 (`bottom`) | Switch to `transform` |

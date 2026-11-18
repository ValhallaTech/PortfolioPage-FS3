# Bootstrap 6 migration analysis: PortfolioPage-FS3

Read-only analysis. No repo file was changed. Today the repo runs Bootstrap 5.3.8, imported at `src/js/main.js:12` (JS) and `:14` (CSS). The target is the npm `next` dist-tag.

Search tooling: `rg` and `yq` were used (no fallback was needed). Enumerations below are `rg -n` over `src/`, `__tests__/`, `package.json`, `.github/`, `netlify.toml` and `README.md`. `node_modules` was used only to check v5 internals and other packages' `exports` maps.

---

## 0. Verified facts this analysis rests on

| # | Fact | Verification |
|---|---|---|
| F1 | npm dist-tags: `next` = `6.0.0-alpha.1` (published 2026-10-08), `latest` = `5.3.9`. Install with `yarn add bootstrap@next`; Renovate manages it from there. | *(verified 2026-11-16 via `npm view bootstrap dist-tags` and `npm view bootstrap@next time`)* |
| F2 | `bootstrap@next` has **no `dependencies`**. Its `peerDependencies` are `@floating-ui/dom ^1.7.6` and `vanilla-calendar-pro ^3.4.0`, with **no `peerDependenciesMeta`**, so both are required peers. `@popperjs/core` is gone. | *(verified 2026-11-16 via `npm view bootstrap@next dependencies peerDependencies peerDependenciesMeta --json`)* |
| F3 | `bootstrap@next` has **no `main` and no `module` field**, only an `exports` map (`.` → `./js/dist/index.js`, plus `./scss/*`, `./dist/css/*`, `./js/dist/*`, `./dist/js/*`, `./js/src/*`). There is **no `index.js` at the package root**. | *(verified 2026-11-16 via `npm view bootstrap@next main module exports --json` and the jsDelivr flat file listing `data.jsdelivr.com/v1/packages/npm/bootstrap@6.0.0-alpha.1?structure=flat`)* |
| F4 | **Parcel ignores `exports` by default.** It is opt-in via `"@parcel/resolver-default": { "packageExports": true }` in the root `package.json`. Without `main`/`module`/`source`, Parcel falls back to a root index file, which does not exist (F3). | *(verified 2026-11-16 via parceljs.org/features/dependency-resolution)* |
| F5 | `js/dist/index.js` statically imports all 20 plugins, including `datepicker.js`, which does `import { Calendar, months } from "vanilla-calendar-pro"` at the top level. `sideEffects` lists `./js/dist/*.js`, so Parcel cannot drop unused plugins. | *(verified 2026-11-16 via unpkg `bootstrap@6.0.0-alpha.1/js/dist/index.js`, `datepicker.js`, `npm view bootstrap@next sideEffects`)* |
| F6 | `js/dist/dialog.js` imports only `dialog-base.js`, `dom/*` and `util/*`. `util/index.js` has no imports. `util/component-functions.js` imports only `dom/*` and `util/index.js`. Neither Floating UI nor Vanilla Calendar Pro is on that path. `dom/*` and `util/config.js` were not read. | *(verified 2026-11-16 via unpkg `js/dist/dialog.js`, `dialog-base.js`, `base-component.js`, `util/index.js`, `util/component-functions.js`)* |
| F7 | Dialog: `NAME = "dialog"`, events `show/shown/hide/hidden/hidePrevented/cancel.bs.dialog`, data-API selector `[data-bs-toggle="dialog"]`, dismiss `[data-bs-dismiss="dialog"]`. `show()`/`hide()`/`toggle()` are `async` and return promises. It opens with native `showModal()`, so the element **must be a `<dialog>`**. Scroll lock adds `dialog-open` to `<html>`. `getInstance`/`getOrCreateInstance` keep the v5 signatures. | *(verified 2026-11-16 via unpkg `js/dist/dialog.js`, `dialog-base.js`, `base-component.js`, and getbootstrap.com/docs/6.0/components/dialog)* |
| F8 | Dialog CSS: `.dialog` uses `margin: auto` (centered by default, with no centering class), and `.dialog-lg` sets `--dialog-width: 800px`. It is wrapped in `@layer components`, and the backdrop is native `::backdrop` with a blur. | *(verified 2026-11-16 via unpkg `scss/_dialog.scss`)* |
| F9 | The dist CSS declares `@layer colors, config, root, reboot, layout, content, forms, components, custom, helpers, utilities;`. Custom properties in dist are `--bs-` prefixed. Sass source tokens are **unprefixed**, and the prefix is added by PostCSS in Bootstrap's own build. | *(verified 2026-11-16 via unpkg `dist/css/bootstrap.css`, `scss/_root.scss`, and Context7 `/twbs/bootstrap/v6.0.0-alpha.1` "bootstrap-color-system" skill)* |
| F10 | Utilities are **not `!important`** by default. The `important` flag exists per utility, but none of the keys this repo uses set it. They live in `@layer utilities`. | *(verified 2026-11-16 via unpkg `scss/_utilities.scss` and `scss/mixins/_utilities.scss`)* |
| F11 | `:root, :host` sets `color-scheme: light dark` and `scrollbar-gutter: stable`. By default the page follows the OS color scheme. To force a mode, set `data-bs-theme="light"` on `<html>`. Body uses `background-color: var(--bg-body)`. | *(verified 2026-11-16 via unpkg `scss/_root.scss`, `scss/content/_reboot.scss`, and getbootstrap.com/docs/6.0/customize/color-modes)* |
| F12 | v5 does **not** follow the OS. Its `color-scheme: dark` is only under `[data-bs-theme=dark]`. v5 sets `:root { scroll-behavior: smooth }` under `prefers-reduced-motion: no-preference`. v6 defaults `$enable-smooth-scroll: false`. | *(verified 2026-11-16 via `rg` on `node_modules/bootstrap/dist/css/bootstrap.css` (5.3.8) and unpkg `scss/_config.scss`)* |
| F13 | Breakpoints: `sm 576, md 768, lg 1024, xl 1280, 2xl 1536`. Containers: `lg 960, xl 1200, 2xl 1440`. Media queries use range syntax (`@media (width >= 1024px)`). | *(verified 2026-11-16 via unpkg `scss/_config.scss` and `dist/css/bootstrap.css`)* |
| F14 | Spacer scale: `1 .25rem, 2 .375rem, 3 .5rem, 4 .75rem, 5 1rem, 6 1.25rem, 7 1.5rem, … 12 3rem`. Margin and padding utilities use logical properties. | *(verified 2026-11-16 via the migration guide and unpkg `scss/_utilities.scss`)* |
| F15 | v6 adds a **new** `.form-group { display:grid; gap:.5rem }` and `.form-field` (grid, gap .5rem), both in `@layer forms`. v5 had no `.form-group`. | *(verified 2026-11-16 via unpkg `scss/forms/_form-field.scss`)* |
| F16 | `.visually-hidden` and `.visually-hidden-focusable` are unchanged (`@layer helpers`). In v6 `.form-floating` puts the `<label>` **first**, then the input (v5 was input first). | *(verified 2026-11-16 via unpkg `scss/helpers/_visually-hidden.scss` and Context7 `/twbs/bootstrap/v6.0.0-alpha.1` floating-labels docs)* |
| F17 | Reboot heading sizes: h1 `--font-size-3xl` through h5 `--font-size-md` (1rem). `iframe { color-scheme: light dark; border: 0 }`. | *(verified 2026-11-16 via unpkg `scss/content/_reboot.scss`)* |
| F18 | Grid rows still use negative margins plus column padding (not `gap`), and columns still use `flex: 0 0 auto; width: %`. | *(verified 2026-11-16 via unpkg `scss/mixins/_grid.scss`)* |
| F19 | Dist CSS size: v6 `bootstrap.min.css` is **381,199 B**, against v5.3.8 at **232,111 B** (+64% raw; gzip not measured). | *(verified 2026-11-16 via unpkg `?meta` and `ls -la node_modules/bootstrap/dist/css/bootstrap.min.css`)* |
| F20 | Browser floor: Chrome/Edge 130, Firefox 132, Safari 18 (macOS and iOS). It relies on `light-dark()`, `:has()`, container queries, native `<dialog>`, `color-mix()` and `oklch()`, and ships no fallbacks. | *(verified 2026-11-16 via getbootstrap.com/docs/6.0/guides/migration)* |
| F21 | Parcel guide: Parcel auto-installs `@parcel/transformer-sass` when it sees Sass, or you add it manually. The full import is `@use "bootstrap/scss/bootstrap"`. `@parcel/transformer-sass@2.16.4` depends on `sass ^1.88.0` (Dart Sass). | *(verified 2026-11-16 via getbootstrap.com/docs/6.0/guides/parcel and `npm view @parcel/transformer-sass dependencies`)* |
| F22 | `swiper/modules/pagination.css` (`main.js:16`) is **not** a key in Swiper's `exports` map. The exported path is `swiper/css/pagination`. `swiper/swiper.css` is exported. | *(verified 2026-11-16 via `yq` on `node_modules/swiper/package.json`)* |

Context7 has a v6 library id, `/twbs/bootstrap/v6.0.0-alpha.1`, which was used for F9 and F16.

---

## 1. Breaking changes that touch this repo

The CSS rows assume the shipped dist CSS. Rows marked "same in Sass" behave the same on the Sass-partials route (section 4).

### 1a. Build, packaging, JS

| # | v6 change | Where here | What to change |
|---|---|---|---|
| B1 | `Modal` export → `Dialog` | `src/js/main.js:12` | `import Dialog from 'bootstrap/js/dist/dialog.js';` (deep import; see section 2). |
| B2 | Package has no `main`/`module`, so the bare `'bootstrap'` specifier fails under Parcel's default resolver (F3, F4) | `src/js/main.js:12` | Prefer the deep import in B1, which resolves as a real file path with no config. Alternative: `packageExports: true`, but then fix B3 first. |
| B3 | (Only if `packageExports` is enabled) Swiper's exports map has no `./modules/pagination.css` (F22) | `src/js/main.js:16` | `import 'swiper/css/pagination';`. `swiper/swiper.css` (`:15`), `glightbox/dist/...` (`:17`), FA (`:18-20`) and `bootstrap/dist/css/...` (`:14`) resolve either way (no `exports` map for glightbox/FA; `./dist/css/*` is exported by Bootstrap). |
| B4 | Popper replaced by Floating UI; peers are `@floating-ui/dom` and `vanilla-calendar-pro` (F2) | `package.json:19` (`@popperjs/core`), `yarn.lock:2235-2237, 2963-2967` | Remove `@popperjs/core`. The deep Dialog import reaches neither peer (F6), so do not add them. Yarn 4 will print a missing-peer warning (`YN0002`), which does not fail `--immutable`. To silence it without installing unused packages, add to `.yarnrc.yml`: `packageExtensions: { "bootstrap@*": { peerDependenciesMeta: { "@floating-ui/dom": { optional: true }, "vanilla-calendar-pro": { optional: true } } } }`. |
| B5 | Events `*.bs.modal` → `*.bs.dialog` | `src/js/main.js:158` (`hidden.bs.modal`), comments at `:156`, `:223`, `:229` | `'hidden.bs.dialog'`. Update the three comments. |
| B6 | `Modal.getOrCreateInstance(el).hide()` → `Dialog.getOrCreateInstance(el).hide()`, which now returns a promise (F7) | `src/js/main.js:214` | Rename. The promise can be ignored, because `hidden.bs.dialog` still fires. The auto-close timer itself should go (section 5, A-M2). |
| B7 | Data API: `data-bs-toggle="modal"` → `"dialog"`, `data-bs-dismiss="modal"` → `"dialog"` | `src/index.html:439`, `:474` | Change the values. `data-bs-target="#contactModal"` (`:439`) stays. |
| B8 | Dialog requires a native `<dialog>` (it calls `showModal()`, F7) | `src/index.html:469-512` | Replace the `div.modal > .modal-dialog > .modal-content` structure (see B9). This must land in the **same commit** as B1/B5–B7: a `div` target throws at `showModal()`. |
| B9 | Modal markup and classes → Dialog | `src/index.html:469` (`modal fade`, `aria-hidden="true"`, `tabindex="-1"`), `:470` (`modal-dialog modal-dialog-centered modal-lg`), `:471` (`modal-content`), `:472` (`modal-header`), `:473` (`modal-title`), `:476` (`modal-body`), `:510-511` (closing wrappers) | `<dialog class="dialog dialog-lg" id="contactModal" aria-labelledby="contactModalLabel">`, then `.dialog-header`, `.dialog-title`, `.dialog-body`. **Remove `aria-hidden="true"`** (on a native dialog it would hide the open dialog from assistive tech), and remove `tabindex="-1"` and `fade`. `modal-dialog-centered` has no replacement because dialogs are centered by default (F8). `.dialog-lg` is 800px, the same as `modal-lg`. |
| B10 | All dist JS is ESM, `window.bootstrap`/UMD removed, `require()` unsupported | `main.js` uses `import` | No change needed. The `require('./utils')` at `main.js:32` is the repo's own module. |

### 1b. CSS cascade and theming

| # | v6 change | Where here | What to change |
|---|---|---|---|
| C1 | **Bootstrap lives in cascade layers (F9); `style.css`, Swiper, GLightbox and Font Awesome are unlayered.** Any unlayered rule now beats any Bootstrap rule regardless of specificity or order, and utilities are no longer `!important` (F10). | All of `src/css/style.css`, `main.js:14-21` import order | Mostly a simplification. Re-check every place where v5 Bootstrap used to win: a `style.css` rule on an element that also carries a utility now overrides it. `rg` found **no** `style.css` `display`/margin/padding/`text-align` rule on an element carrying a utility class (`#hero`, `header > div`, `.social-links`, `.about .content`, `.contact-cta`, col wrappers). Re-run that check after the CSS dead-code cleanup. |
| C2 | **The page follows the OS dark mode by default (F11)**, unlike v5 (F12). Body background becomes `--bs-bg-body` (dark), while `style.css:11-15` forces `color: #272829`, which gives dark text on a dark background. Sections without their own background (About, Services, Contact, the dialog body) go dark. | `src/index.html:2`, `src/css/style.css:11-15` | Add `data-bs-theme="light"` to `<html>` (`index.html:2`) in the same commit as the CSS swap. Dark mode is a separate design task; do not get it by accident. |
| C3 | Reboot puts `iframe { color-scheme: light dark }` (F17). The guide's fix for a no-dark-mode embed is `.color-scheme-light`. | `src/index.html:427-432` (Google Maps) | Add `class="color-scheme-light"`. Reboot now also sets `border: 0` on iframes, so the inline `style="border:0"` part is redundant (the audit 2e iframe fix covers the rest). If the audit's "replace map with a link" option is taken, this row disappears. |
| C4 | `--bs-*-rgb`, `--bs-body-color` and `--bs-primary` patterns are gone. Colors are `oklch`, and themes are `--bs-{color}-base` with derived `-bg`, `-fg`, `-contrast`, `-border`, `-focus-ring` and `-bg-subtle` tokens. Overriding only `-base` at runtime does not recolor every derived token. | Not used today. It affects the audit 5c token-mapping recommendation (`frontend-audit.md:232`). | See section 4: map the repo's own tokens onto Bootstrap **once**, after the CSS delivery route is chosen. |
| C5 | Heading sizes come from tokens (F17). h5 drops from 1.25rem to 1rem. | `src/index.html:473` (`h5.modal-title`, no `style.css` size). All other headings have explicit sizes in `style.css` (`:103, :288, :359, :390, :742, :790, :798, :916`). | Only the dialog title changes visibly. The audit suggests making it an `<h2 class="dialog-title">`, so set its size in `style.css` then. |
| C6 | v5 `:root { scroll-behavior: smooth }` is gone (F12) | No `style.css` rule depends on it. JS uses `behavior:'smooth'` explicitly (`main.js:284`, `utils.js:12-15`). | No change. It helps the GSAP plan (section 5). |
| C7 | `:root` gets `scrollbar-gutter: stable` and `:root.dialog-open { overflow:hidden }` (F11, F8) | `.mobile-nav-active { overflow:hidden }` on `body` (`style.css:239-242`) | No change. The scroll lock no longer shifts the layout. Check visually that the fixed `.mobile-nav-toggle` (`right:15px`) and `.back-to-top` still sit where expected on Windows (classic scrollbars). |

### 1c. Layout, breakpoints, utilities (HTML)

| # | v6 change | Where here (`src/index.html`) | What to change |
|---|---|---|---|
| L1 | Responsive infix → prefix: `.d-xl-none` → `.xl:d-none` | `:24`, `:78` | `class="xl:d-none mobile-nav-toggle"`. Unescaped colon in HTML. |
| L2 | **`xl` moves from 1200 to 1280px (F13). `style.css` hard-codes the sidebar switch at `max-width: 1199px`.** Between 1200 and 1279px, the fixed sidebar is shown **and** the hamburger is visible. | `src/css/style.css:145-157` (`#header`/`#main`), `:1334-1343` (`#footer`) | Move both to `@media (width < 1280px)`. This is one source of truth with `xl:d-none`, and it also closes audit 5b's "mixed breakpoints" row, so do not normalize to `1199.98px` first. |
| L3 | `lg` moves from 992 to 1024px | `col-lg-*` at `:111, :116, :119, :126, :151, :163-275 (×9), :303-328 (×6), :405, :436` | Rename (L4). Between 992 and 1023px, About and Contact now stack, and Portfolio/Services show 2 columns (md) instead of 3. Accept or adjust; check visually at 1000px. The `style.css:319` `min-width:1024px` hero rule now coincides with `lg`. |
| L4 | Grid prefix: `.col-lg-N` → `.lg:col-N`, `.col-md-6` → `.md:col-6` | `col-lg-4` ×16, `col-lg-5` `:405`, `col-lg-6` `:119, :126`, `col-lg-7` `:436`, `col-lg-8` `:116`, `col-lg-12` `:151`, `col-md-6` ×15 (`:163-275`, `:303-328`) | Mechanical rename. `container` (`:103, :144, :296, :340, :397, :454`) and `row` (`:110, :118, :150, :161, :302, :403`) are unchanged. |
| L5 | Spacer scale re-keyed (F14) | `mt-3` `:39` (1rem), `pt-4` `:116` (1.5rem), `mt-5` `:436` (3rem), `mb-3` `:501` (1rem) | To keep v5 sizes: `mt-3`→`mt-5`, `pt-4`→`pt-7`, `mt-5`→`mt-12`, `mb-3`→`mb-5`. |
| L6 | Responsive spacing prefix | `pt-lg-0` `:116`, `mt-lg-0` `:436` | `lg:pt-0`, `lg:mt-0`. |
| L7 | `.text-*` colors → `.fg-*`; there is no `light` theme color, so `.text-light` has no v6 class | `:36` (`h1.text-light`) | Delete the class. No visual change: the h1's only content is the `<a>`, colored `#fff` by `style.css:110-115`. |
| L8 | New `.form-group` meaning (F15) | `:482, :487, :492, :496` (plus `style.css:985-988`) | Today the effect is negligible (the hidden label is absolutely positioned, and `.validate` is `display:none`), but the class now means "group of checks". Replace it with `.form-field` when the audit's visible labels land (section 5, A-M3). |
| L9 | `.form-control` always has a `min-height` and focuses on `:focus-within` | `:484, :489, :494, :498` | The unlayered `style.css:1064-1080` (`height:44px`, `border-radius:0`, textarea padding) still wins (C1). Visual check only. |
| L10 | `.btn-close` icon is now a CSS `mask-image` with `currentcolor` | `:474` | Class unchanged; only the `data-bs-dismiss` value changes (B7). Keep `img-src data:` in the planned CSP until the built CSS is checked for `data:` URIs. |

Unchanged and verified present in v6: `img-fluid` (`:34, :113, :165-277`), `rounded-circle` (`:34`, still 50%), `text-center` (`:39, :437, :505`), `d-flex`/`flex-column`/`align-items-center|stretch`/`justify-content-center` (`:30, :86, :151, :405, :436`), `visually-hidden` (`:483, :488, :493, :497`) *(verified 2026-11-16 via unpkg `scss/_utilities.scss`, `scss/helpers/_visually-hidden.scss`, `dist/css/bootstrap.css`)*.

### 1d. v6 changes checked that do not affect this repo

| Area | Why it does not apply |
|---|---|
| Offcanvas → Drawer | Not used. The mobile nav is custom (but see section 5, optional O1). |
| Dropdown → Menu, `popperConfig` → `floatingConfig` | Not used. |
| Accordion → `<details>` | Not used. |
| Carousel rebuild (scroll-snap, `ride` → `autoplay`) | Not used. Testimonials use Swiper. |
| Collapse (`.collapsing`, `toggle` option) | Not used. |
| Tabs, ScrollSpy (`offset` → `topMargin`) | Not used. Active nav is custom. |
| Tooltip/Popover/Toast/Alert promise and transition changes | Not used. |
| Buttons `.btn-primary` → `.btn-solid theme-primary` | No `.btn` in the markup today (but see A-L2). |
| Cards, badges, breadcrumbs, list group, tables, pagination, placeholders | Not used. |
| Navbar (Drawer-based, `.md:navbar-expand`) | Not used. |
| Checks/radios/switches, `.form-select`, range, input group, toggle buttons, form adorn | Not used. The honeypot checkbox has no Bootstrap class. |
| Validation (`.was-validated`, `.needs-validation`) | Not used. Opportunity in A-L3. |
| `.display-*`, `.lead`, `.fs-1..6`, `.lh-base`, `.fw-*` | Not used. |
| Border radius scale (`.rounded`, `-1..-4`) | Only `rounded-circle`, which is unchanged. |
| `.text-bg-*`, `.bg-light/.bg-dark`, `.bg-body-*` | Not used. |
| Link utilities (`link-*` → `underline-*`), shadows, `.mh-*/.mw-*`, negative margins, clearfix, ratio | Not used. |
| Sass changes (`$grid-breakpoints` → `$breakpoints`, RFS removed, `$prefix` removed, Node Sass dropped, renamed partials) | The repo does not compile Bootstrap Sass today. They matter only if section 4 option S is taken. |
| `$zindex-*` renames, `--bs-z-dialog` | No z-index overrides of Bootstrap. The native top layer ignores z-index anyway (R5). |
| `:host` token emission | No Web Components. |
| `@types/bootstrap`, TS sources, Rolldown, `bootstrap.esm.js` removal | No TS. The repo never imported `bootstrap.esm.js` by path. |
| jQuery removal | Already jQuery-free (`main.js:3`). |
| `aria-pressed` auto-add on toggle buttons | No `data-bs-toggle="button"`. |
| Jest | `rg -n -i bootstrap __tests__ jest.config.js` returns nothing. Tests cover `utils.js` only (`jest.config.js:8`). |

---

## 2. JavaScript answers

| Question | Answer |
|---|---|
| Does `import { Modal } from 'bootstrap'` still work? | **No, twice over.** `Modal` no longer exists (it is `Dialog`), and Parcel cannot resolve bare `'bootstrap'` without `packageExports: true` (F3, F4). |
| Recommended import | `import Dialog from 'bootstrap/js/dist/dialog.js';` It resolves as a plain file path, needs no Parcel config, and pulls in Dialog plus its base classes only (F6). |
| Why not `import { Dialog } from 'bootstrap'` with `packageExports: true`? | `index.js` statically imports all 20 plugins, and `sideEffects` keeps them all, so the bundle grows by every plugin plus **both** peers. `vanilla-calendar-pro` must then be installed or the build fails (F5). It also flips exports resolution on for every package (B3). |
| Data-API changes | `data-bs-toggle="dialog"`, `data-bs-dismiss="dialog"`. The dismiss handler finds its target via `closest('.dialog, [class*=":dialog"]')`, so the `<dialog>` must carry `class="dialog"`. *(verified 2026-11-16 via unpkg `util/component-functions.js`)* |
| `hidden.bs.modal` (`main.js:158`) | → `hidden.bs.dialog`. It fires after the CSS transition. A new `cancel.bs.dialog` fires on Escape. |
| `Modal.getOrCreateInstance` (`main.js:214`) | → `Dialog.getOrCreateInstance(modalEl)`. Same signature. `.hide()` now returns a promise. |
| Focus handling | The data-API registers focus restoration to the trigger on `show`. The native `showModal()` makes the rest of the page inert and traps focus. Verify manually that the programmatic `hide()` path at `main.js:214` still returns focus to `.contact-modal-btn`. |
| Popper | Removed. Replaced by Floating UI, which is used only by Menu, Tooltip and Popover. Delete `@popperjs/core` (`package.json:19`). Do not add `@floating-ui/dom` (B4). |
| Form inside dialog | No v6 change. `main.js:173-236` keeps `preventDefault()` and `fetch`. Enter-to-submit and Escape-to-cancel are native. |

---

## 3. GSAP interaction (JS and transitions)

| Point | Effect |
|---|---|
| v5 sets CSS `scroll-behavior: smooth` on `:root`; v6 does not (F12) | GSAP plan step 6 (ScrollToPlugin) no longer has to fight a CSS smooth-scroll rule. Doing Bootstrap 6 first removes the need for a `html { scroll-behavior: auto }` workaround. |
| v6 dialog motion uses CSS transitions and `@starting-style`, and its hide/show promises resolve after the transition | GSAP does not animate the modal (gsap-analysis section 1), so there is no overlap. Do not add GSAP to the dialog. v6 defaults `$enable-reduced-motion: true` *(verified 2026-11-16 via unpkg `scss/_config.scss`)*, but `_dialog.scss` has no reduced-motion query of its own, so check in step 1, with OS reduce-motion on, that the dialog opens without a slide. |
| `scrollbar-gutter: stable` and `:root.dialog-open { overflow:hidden }` | Opening the dialog no longer changes the viewport width, so ScrollTrigger sees no resize and needs no `refresh()`. |
| Layout shifts from L2, L3, L5 and C5 | Every ScrollTrigger start and end position depends on layout. Tuning reveals before the breakpoint and spacing change means re-tuning after it. |
| Cascade layers (C1) | GSAP and ScrollReveal write inline styles, which beat every layer, so they are unaffected. The planned hero `visibility:hidden` gate (gsap-analysis G1) lives in unlayered `style.css` and wins over Bootstrap. |
| Isotope (gsap-analysis G5) | Grid columns are still padded flex items (F18), so Isotope's `fitRows` measurements behave as in v5. |

---

## 4. CSS delivery

| Question | Answer |
|---|---|
| New dist files? | Same names: `dist/css/bootstrap{,-grid,-reboot,-utilities}{,.min}.css`. `main.js:14` keeps working as a path (and under `exports`, `./dist/css/*` is mapped). It is **64% larger** raw (F19). |
| Sass modules | v6 is `@use`/`@forward` only. Full: `@use "bootstrap/scss/bootstrap" with (...)`. Partial: `@use ".../scss/root"` **first** (it holds config, tokens and the `@layer` order), then partials. *(verified 2026-11-16 via getbootstrap.com/docs/6.0/customize/sass)* |
| CSS layers | Declared in `_root.scss`. A partial build that starts with `root` keeps the layer order. `@use` cannot be wrapped in `@layer`. |
| What Parcel needs for the Sass route | `@parcel/transformer-sass` as an explicit devDependency (which brings Dart Sass, F21). Do not rely on Parcel's auto-install, because CI runs `yarn install --immutable` (`.github/workflows/ci.yml`). Import a `src/scss/bootstrap.scss` from `main.js` in place of `:14`. This is a new build dependency, so it needs Fred's approval. |
| Partials this page would need | `root`, `content` (reboot, images), `layout` (containers, grid), `forms` (form-control, form-field), `buttons` (close button lives in `buttons/_close.scss`), `dialog`, `helpers` (visually-hidden), `utilities/api`. *(file list verified 2026-11-16 via unpkg `?meta`)* |
| Unverified on the Sass route | (a) whether `@use "bootstrap/scss/root"` resolves through Parcel's Sass importer. Fallback: a relative `../../node_modules/bootstrap/scss/...` path, which is what the docs show. (b) how to pass `with (...)` config when using partials. The docs show `with` only on the full entrypoint. (c) whether the utility API emits only the utilities used. It does not purge, so expect the full utility set. Prove all three with a build before committing to the route. |
| Token names differ by route | **Dist CSS:** `--bs-primary-base`, `--bs-link-color`, `--bs-bg-body`, `--bs-fg-body`, `--bs-body-font-family`. **Sass build:** the same names **without** `--bs-` (F9). Adding the prefix needs PostCSS (`postcss-prefix-custom-properties`), which would switch Parcel's CSS pipeline to PostCSS, another dependency. |
| Does v6 make "import only needed partials" easier? | **Yes in structure, no in payoff certainty.** The documented `@use` partial list, `root`-first rule and single module loading remove v5's `@import` ordering traps. The payoff is larger than in v5 because the dist CSS is 64% bigger. But it is still an extra dependency, and the three unknowns above need a spike. |
| Does v6 make "map tokens onto `--bs-*`" easier? | **Different.** v6 is CSS-variable-first (good), but `--bs-*-rgb` and `--bs-primary` are gone, a theme is a set of derived tokens (`-base`, `-bg`, `-fg`, `-contrast`, `-border`, `-focus-ring`, `-bg-subtle`), and the names change again if you later switch to Sass. With Sass, you set the primary color once at compile time and the derived tokens follow, so v6 makes **compile-time** theming the easier path. |
| Recommendation | **Phase 1:** migrate on dist CSS (`bootstrap/dist/css/bootstrap.min.css`) to keep the diff reviewable. **Phase 2:** a Sass-partials spike, measured against the Phase 1 CSS size, kept only if the saving is worth the dependency. Write the Bootstrap token bridge **after** Phase 2 is decided, so the names are written once. Until then, use the repo's own `--color-*` tokens directly in `style.css`, which works under either route. |
| Browserslist | The repo has none. Parcel/Lightning CSS therefore does not downlevel `oklch()`, `color-mix()` or `light-dark()`, which is correct for v6. If one is ever added, set it to v6's floor (F20). An older target would make Lightning CSS add fallbacks to a framework that declares none. |

---

## 5. Overlap with the other planned work

### 5a. Audit items: before, during, or after the Bootstrap 6 move

| Audit item (`frontend-audit.md`) | When | Why |
|---|---|---|
| 5a dead-CSS deletion (~450 lines), 5b no-op and invalid declarations (except breakpoints) | **Before** | Version-independent. It shrinks the surface to re-verify under cascade layers (C1). It matches GSAP step 1. |
| 2a aria-labels (toggle, social, back-to-top), `aria-hidden` on icons, heading fixes outside the modal, portfolio filter buttons, `aria-current` | **Before** | No Bootstrap class involved. |
| 2a skip link `visually-hidden-focusable` | **Before** | Same class in v5 and v6 (F16). |
| 2b honeypot `class="d-none"` | **Before** | `d-none` exists in both. |
| 2e iframe inline style → class | **Before** (the `color-scheme-light` part during, C3) | Reboot's `border:0` makes it simpler in v6, but moving the style is version-independent. |
| 2c contrast fixes and 5c repo tokens (`--color-accent`, `--color-accent-strong`, …) used **directly** in `style.css` | **Before** | High-severity contrast, version-independent. Do not map onto `--bs-*` yet (section 4). |
| 5b breakpoint normalization (`1199px` → `1199.98px`) | **During** (L2) | The target becomes 1280px. Normalizing to the v5 value first means doing it twice. |
| A-L1: 5c `--bs-*` token bridge (`--bs-link-color`, `--bs-body-*`, primary) | **After** the delivery-route decision (section 4, Phase 2) | The v5 names (`--bs-primary-rgb`, `--bs-body-color`) do not exist in v6, and the v6 names lose `--bs-` under Sass. |
| A-L2: 5c custom buttons → `.btn .btn-primary` (`style.css:1024-1040, 1089-1105`; `index.html:439, :506`) | **During** | v6 uses `btn-solid theme-primary`. Doing the v5 classes first means doing them twice. Combine with the accent contrast token. |
| A-M1: 2b live regions (`role="alert"`/`role="status"` on `:502-503`) | **During** (dialog commit) | Same lines as B9. |
| A-M2: 2b remove the 2s auto-close (`main.js:210-216`) | **During** (dialog commit) | Same code as B6. This removes the `getOrCreateInstance` call entirely, or replaces it with a visible Close button using `data-bs-dismiss="dialog"`. |
| A-M3: 2b visible labels / `form-floating`, `autocomplete` | **During** | `form-floating` markup order flips in v6 (label first, F16), and `.form-group` → `.form-field` (L8). `.form-field` plus a visible `.form-label` is the simpler fit. |
| A-L3: 2b error wiring (`aria-invalid`, `.is-invalid`) | **During or after** | v6 adds `data-bs-validate` on `<form>` for `:user-invalid` styling, and `.is-invalid`/`.is-valid` still work (migration guide). Confirm the feedback-element class name on the v6 validation page before using it. |
| 2b modal title heading level (`:473`) | **During** | Same element as B9 and C5. |
| 3 Performance: "import only Bootstrap partials" | **After** (Phase 2 spike) | See section 4. |
| 2a off-screen nav focus (Medium) | **Before**, with `inert`; or **after**, via optional O1 | Independent of the migration either way. |

**O1 (optional, after):** v6's responsive Drawer (`<dialog class="drawer">` with `.xl:drawer`-style prefixes) could replace the custom off-canvas header below `xl`, giving native focus trap, Escape and inert for free. It changes the header's structure and the scroll handlers in `utils.js`, so it is its own decision and its own change.

### 5b. Ordering with the GSAP migration

| Order | Work | Reason |
|---|---|---|
| 1 | GSAP step 1 (cleanup) together with the audit "before" items above | Both are version-independent and shrink both later diffs. |
| 2 | **Bootstrap 6** (section 6, steps 1–6) | It settles the layout baseline (breakpoints, spacing, heading sizes) once, before reveal timings are tuned, and it removes v5's CSS smooth scroll ahead of GSAP step 6. |
| 3 | GSAP steps 2–7 | Each reveal is tuned once, against the final layout. |
| 4 | Bootstrap Phase 2 (Sass spike), then the token bridge (A-L1) | Independent of GSAP. Measured against step 2's CSS size. |

If the Bootstrap 6 alpha has to be backed out (R1), GSAP step 2 onward still applies cleanly to v5, because they touch disjoint attributes (`data-sr*` against `class`).

---

## 6. Migration sequence

Every step runs the CI gates from `.github/workflows/ci.yml` (`yarn lint`, `yarn format:check`, `yarn test:ci`, `yarn build`) and ships as its own reviewable commit. Manual breakpoint widths for each step: **375, 767, 768, 1000, 1023, 1024, 1200, 1279, 1280, 1440** px.

| Step | Change | Files | Verification |
|---|---|---|---|
| 0 | Baseline: screenshots of `main` at every width above, the CSS and JS byte sizes of `dist/` (raw and gzip), and a record of the modal flows. | none | Artifacts saved for comparison. |
| 1 | **Package swap and dialog, atomically.** `yarn add bootstrap@next`, `yarn remove @popperjs/core`, optional `packageExtensions` (B4). Deep `Dialog` import (B1, B2). Event and instance renames (B5, B6). Dialog markup (B7–B9). `data-bs-theme="light"` on `<html>` (C2). Fold in A-M1, A-M2 and the dialog title heading. | `package.json`, `yarn.lock`, `.yarnrc.yml` (optional), `src/js/main.js:12,156-171,210-229`, `src/index.html:2,439,469-512` | Gates green. `rg -n "bs\.modal\|data-bs-(toggle\|dismiss)=\"modal\"\|class=\"modal\|\bModal\.\|\{ Modal \}\|popperjs" src package.json` returns 0. Manual: open via button; Tab cycles inside the dialog only; Escape closes; backdrop click closes; ✕ closes; focus returns to `.contact-modal-btn`; submit success shows the status message (live region announced in NVDA or VoiceOver); submit error shows the alert; closing mid-request aborts (DevTools network shows `(canceled)`) and resets the form; the page does not shift when the dialog opens. **OS dark mode on: the page is still light.** |
| 2 | **Breakpoint and sidebar alignment.** L1 and L2 (both `style.css` blocks to `@media (width < 1280px)`). | `src/index.html:24,78`, `src/css/style.css:145-157,1334-1343` | Gates green. At 1279px: hamburger visible, sidebar hidden, `#main` full width. At 1280px: sidebar visible, no hamburger, fixed footer inside the sidebar. Toggle open and close at 375 and 1000. |
| 3 | **Grid and spacing classes.** L3–L6. | `src/index.html` (lines in L4–L6) | Gates green. `rg -n "col-(lg\|md)-\|-(lg\|xl\|md)-0\b\|d-xl-none" src/index.html` returns 0. The four spacing classes are checked against the L5 table in the diff, because `mt-5`/`mb-5` are valid in both versions with different values. Compare against step 0 screenshots at every width. At 1000px, 2-column Portfolio/Services and stacked About/Contact are expected (L3). Isotope: every filter re-flows correctly at 375, 768, 1024 and 1440. |
| 4 | **Leftovers.** L7 (`text-light`), C3 (`color-scheme-light` on the iframe), L8 + A-M3 (`.form-field`, visible labels, `autocomplete`; delete the `.validate` divs and `style.css:985-997`). | `src/index.html:36,427-432,482-500`, `src/css/style.css` | Gates green. Visible labels at 375 and 1440. The map renders light with OS dark mode on. The form submits. |
| 5 | **Buttons.** A-L2: `.contact-modal-btn` and submit → `btn-solid theme-primary`, with the accent token from the "before" contrast work. Delete the custom button CSS. | `src/index.html:439,506`, `src/css/style.css:1024-1040,1089-1105` | Gates green. Contrast ≥ 4.5:1 (DevTools). A visible `:focus-visible` ring on both buttons. Hover state present. |
| 6 | **Size and cascade audit.** Compare `dist/` CSS and JS sizes against step 0. Re-run the C1 check (`rg` for `style.css` rules hitting utility-bearing elements). | none (report only) | Numbers recorded in the PR body. Expect larger CSS (F19) and likely smaller JS (Dialog only, no Popper); measure, do not assume. |
| 7 | *(Separate decision)* Phase 2 Sass-partials spike, then the token bridge (A-L1). | `package.json` (`@parcel/transformer-sass`), `src/scss/` (new), `main.js:14`, `style.css` | Gates green. Visual parity with step 5 at every width. CSS size delta recorded. |
| 8 | **Documentation handoff** to the Documentation Agent: `README.md:34` ("Bootstrap 5 \| Layout and modal") becomes Bootstrap 6 and "dialog". | `README.md` | Documentation Agent review. |

### What a Playwright smoke test would need to cover

The repo has no E2E harness. Adding `@playwright/test` is a new dev dependency that Fred must approve. A minimal smoke suite for this migration:

| Test | Assertions |
|---|---|
| Layout at 1279 and 1280 | At 1279: `.mobile-nav-toggle` visible, `#header` out of view (bounding box `x < 0`). At 1280: the reverse. `#main` `margin-left` is 0 or 300px. |
| Mobile nav at 375 | Click the toggle: `body` has `.mobile-nav-active` and `#header` is in view. Click outside: it closes. Click a nav link: it scrolls to the section and closes the nav. |
| Grid at 1000 and 1024 | Portfolio items per row: 2 at 1000, 3 at 1024 (count distinct `boundingBox().y` values). |
| Dialog open | Click `.contact-modal-btn`: `#contactModal` has the `open` attribute, `:modal` matches, and `<html>` has `.dialog-open`. |
| Dialog keyboard | Tab 10 times: `document.activeElement` stays inside `#contactModal`. Escape: the dialog closes and focus is back on `.contact-modal-btn`. |
| Dialog dismiss paths | The ✕ button and a backdrop click (click at viewport `(5,5)`) each close it. |
| Submit, success | `page.route('https://api.web3forms.com/submit', …)` fulfills `{success:true}`. `#sent-message` becomes visible with its live-region role. |
| Submit, error | The route fulfills `{success:false, message:'x'}`. `#error-message` shows `x`. |
| Abort on close | The route delays 3 s. Submit, then press Escape. After `hidden.bs.dialog`, the form is reset and the submit button is re-enabled. |
| Color scheme | `page.emulateMedia({ colorScheme: 'dark' })`: the computed `body` background is still light. |
| Console | No `pageerror` events during any of the above (catches a missed `Modal` import or a `showModal` on a non-dialog). |
| Portfolio filter (regression) | Clicking each filter shows the expected item count, and GLightbox opens from a visible item. |

Network calls to Web3Forms must always be mocked, so the suite never sends real submissions.

---

## 7. Risks specific to this repo

| # | Sev | Risk | Mitigation |
|---|---|---|---|
| R1 | **High** | **Renovate automerges every dependency** (`renovate.json`: `automerge: true`, `matchPackageNames: ["*"]`). Alpha-to-alpha bumps can rename classes or APIs, and CI has no visual or E2E check, so a breaking alpha would merge green and deploy. Whether Renovate offers alpha.N+1 when the current version is already a prerelease was **not verified** (the Renovate `ignoreUnstable` docs section could not be read). | Add a `packageRules` entry for `bootstrap` with `automerge: false` while on a prerelease. This is not a version pin. Add the Playwright smoke suite before relying on any automerge again. |
| R2 | **High** | OS dark mode turns the page dark with dark body text (C2). This is invisible during development on a light-mode machine. | `data-bs-theme="light"` in step 1. Add the Playwright color-scheme test. |
| R3 | **High** | Browser floor (F20): visitors on Safari/iOS below 18, Chrome below 130 or Firefox below 132 get no fallbacks. `light-dark()` and `oklch()` tokens go invalid, which breaks colors, and the dialog may misbehave. The v5 floor was Chrome/Firefox 60 and Safari 12. | Fred decides whether that audience matters for a portfolio. If it does, check analytics before shipping. No polyfill path exists. |
| R4 | Medium | Sidebar/hamburger double display between 1200 and 1279px if L2 lands without L1 (or the reverse). | Same commit (step 2). Playwright 1279/1280 test. |
| R5 | Medium | Stacking order changes. In v5, the fixed `#header` (z 9997), `.mobile-nav-toggle` (9998), `#footer` (9999) and `.back-to-top` (99999) painted **above** the modal backdrop (z 1050–1055). The v6 native top layer puts the dialog above all of them, and the page behind it is inert. This is an improvement, but it is a visible change at ≥1280px. | Visual check in step 1. No code. |
| R6 | Medium | Cascade layers invert old specificity wins. Third-party unlayered CSS (Swiper `swiper.css`, GLightbox, Font Awesome) now beats Bootstrap's reboot wherever both style the same element. Previously the two interleaved by specificity and source order. Which GLightbox and Swiper rules overlap with reboot was not enumerated. | Manual: open the lightbox and step through images. Check the Swiper pagination bullets. Neither library uses Bootstrap classes, so expect parity, but check. |
| R7 | Medium | The dialog title shrinks (C5), and the `lg` 992 → 1024 shift (L3) changes layout for 992–1023px viewports (common landscape tablets). | Accept and document in the PR, or set sizes explicitly. Screenshots at 1000px. |
| R8 | Medium | The CSS payload grows about 149 KB raw (F19), working against the audit's performance goal. | Measure in step 6. The Phase 2 Sass spike is the lever. |
| R9 | Low | The peers are declared required (F2). If someone later switches to `import … from 'bootstrap'` (index), the build fails until `vanilla-calendar-pro` is installed, and the JS bundle includes all plugins (F5). | Keep the deep import, and say why in a one-line comment at `main.js:12`. |
| R10 | Low | `packageExports: true` (if chosen over the deep import) changes resolution for every dependency. `swiper/modules/pagination.css` breaks (F22), and future dependencies may resolve differently. | Prefer the deep import. If exports are enabled, fix `main.js:16` in the same commit and diff the bundle. |
| R11 | Low | Isotope with v6 grid: unchanged mechanics (F18), but column widths change at the new `lg`. Isotope lays out on init and on filter, not on breakpoint change, so a resize across 1024px could leave stale positions. That is true today at 992px too. | Manual resize across 1024px, then click a filter. If stale, call `iso.layout()` on resize (JS/Web Coding Expert). |
| R12 | Low | Lightning CSS (Parcel's CSS minifier) must parse `@layer`, `@starting-style`, `:has()`, `light-dark()`, `oklch()`, range media queries and escaped `:` class names. This was not verified against Parcel 2.16.4's bundled Lightning CSS version. | Step 1 `yarn build`. Grep the built CSS for `@starting-style` and `lg\:col-4` to confirm they survived minification. |
| R13 | Low | The `.mobile-nav-toggle` and `.back-to-top` positions relative to the scrollbar on Windows, after `scrollbar-gutter: stable` (C7). | Visual check in step 1 on Windows. |

---

## Handoffs implied by this analysis

| To | Item |
|---|---|
| JS/Web Coding Expert | `main.js` import, event, instance and auto-close changes (B1, B5, B6, A-M2). Optional Isotope resize relayout (R11). |
| Frontend Expert | HTML and CSS steps 1–5, 7. |
| JS/TS Unit Test Engineer | None required, since Jest does not touch Bootstrap. A Playwright suite, if Fred approves the dependency. |
| Security Reviewer | Confirm `img-src data:` is still needed with v6 `mask-image` icons before the CSP leaves report-only (L10). |
| Documentation Agent | `README.md:34` (step 8). |
| Fred (decision) | R1 Renovate rule, R3 browser floor, Phase 2 Sass dependency, Playwright dependency, O1 drawer. |

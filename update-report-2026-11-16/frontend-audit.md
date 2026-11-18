# PortfolioPage-FS3: frontend audit

Read-only audit of `C:\Repo\PortfolioPage-FS3` at `1dc41e6` (main). No repo file was edited.
Date: 2026-11-16. Out of scope: the Typed.js/ScrollReveal replacement plan, which another specialist owns. Section 7 lists only the accessibility requirements any replacement must meet.

**How this was checked**
- I read every source file: `src/index.html`, `src/css/style.css`, `src/js/main.js`, `src/js/utils.js`, `netlify.toml`, `package.json`, `README.md`, `.nvmrc`, `.yarnrc.yml` and `ci.yml`.
- Image dimensions come from `System.Drawing.Image`. File sizes come from `stat` over `fd -H -I -t f . src`.
- References were searched with `git ls-files -z | xargs -0 rg`, so only tracked files were searched.
- There is no local `dist/` or `node_modules/`. Build output was checked against the live deploy at `https://fs3portfolio.netlify.app` (the GitHub repo homepage) with `curl -sI` and `curl -o`. It was not checked against a local build.
- Contrast ratios were calculated by hand with the WCAG relative-luminance formula.

---

## 0. New findings, not in the orchestrator's list

| Sev | Finding | Evidence | Change |
|---|---|---|---|
| **High** | **The portfolio lightbox is broken in production. All 9 full-size images return 404.** `initLightbox()` builds `./images/portfolio/portfolio-N.jpg`. Parcel never emits that path, because `data-src` is not a bundled reference, and the `<img src>` files ship flattened and hashed (`portfolio-1.afcd9577.jpg`). | `src/js/main.js:103-113`, `src/index.html:167,181,…,279`. *(verified 2026-11-16: `curl https://fs3portfolio.netlify.app/images/portfolio/portfolio-1.jpg` returned 404 text/html, while `/portfolio-1.afcd9577.jpg` returned 200)* | Point the lightbox at the bundled URL. Either read `href` from the sibling `<img>`'s resolved `src` (`el.closest('.portfolio-wrap').querySelector('img').src`), or use real `href="./images/portfolio/portfolio-N.jpg"` and drop the `<img>` duplicate-bundle workaround. Hand off to the JS/Web Coding Expert: it is `main.js` logic. |
| **High** | The **404s above are cached as `immutable` for one year**, because they fall under the `/images/*` header rule. | `netlify.toml:52-55`. The same curl returned `cache=public,max-age=31536000,immutable` on the 404. | Remove or replace the `/images/*` rule (see section 4). |
| Medium | **Header profile photo renders as an ellipse.** The source is 1920x1275 (3:2). CSS sets only `width:120px`, and `rounded-circle` on a 120x80 box draws an oval. | `src/index.html:33-35`, `src/css/style.css:91-97` | Add `aspect-ratio:1; object-fit:cover;` to `#header .profile img`, and ship a square crop (240x240 for 2x). |
| Medium | **Swiper loop with 3 slides at `slidesPerView: 3`**. Loop mode needs more slides than are visible, so at ≥900px Swiper cannot loop and logs a loop warning. | `src/js/main.js:84-90`, `src/index.html:349-386` | Add slides, set `loop:false`, or lower `slidesPerView` to 2 or less. Confirm the warning in the browser console. I did not run the page. |
| Medium | **Deep links with an invalid selector crash `init()`.** `document.querySelector(window.location.hash)` throws on a hash such as `#1x` or `#a%20b`, and every initializer after it (Isotope, lightbox, Swiper, ScrollReveal, contact form) never runs. | `src/js/main.js:251-256` | Use `document.getElementById(decodeURIComponent(location.hash.slice(1)))`. Hand off to the JS/Web Coding Expert. |
| Medium | `.nvmrc` and `netlify.toml` pin **Node 25, which reached end of life on 2026-06-01**. | `.nvmrc:1`, `netlify.toml:16`. *(verified 2026-11-16 via `nodejs/Release/main/schedule.json`: v25 `end: "2026-06-01"`)* | Move to an LTS line (24 or 26). Renovate and `sync-runtime-versions` handle the exact version. |
| Low | `YARN_VERSION = "4.17.0"` drifts from `packageManager: yarn@4.18.1`. | `netlify.toml:17`, `package.json:41` | Align them, or drop `YARN_VERSION` and let Corepack read `packageManager`. |
| Low | **README drift.** It cites `https://fs3-portfolio.netlify.app`, which returns **404**; the live site is `fs3portfolio.netlify.app`. It also cites Node 24.15.0 / Yarn 4.14.1, "Swiper ^12" (actual 14.3.0), Boxicons, just-validate and "skills progress bars". | `README.md:3,22,36,40,42,49-50,123,129-130`. *(404 verified 2026-11-16 via `curl -sI`)* | Hand off to the **Documentation Agent** after the code changes land. |
| Low | `observeSkills` is dead code wired into `init()`, and its tests keep it alive. | `src/js/main.js:288-290`, `src/js/utils.js:96-114,168`, `__tests__/utils.test.js:239-267` | Remove it. JS/Web Coding Expert removes the code, and the JS/TS Unit Test Engineer updates the tests. |
| Low | Template version comment disagrees with the CSS header (`v2.0.0` vs `v1.4.0`). | `src/js/main.js:2`, `src/css/style.css:2` | See section 6. |

---

## 1. Placeholder and content issues (orchestrator list confirmed)

| Sev | File:line | Confirmed | Change |
|---|---|---|---|
| Medium | `src/index.html:121` | `Website: www.example.com` | Real URL as a link, or remove the row. |
| Medium | `src/index.html:122`, `:424` | `+1 704 555 6969` appears twice. 555 is a fictional exchange. | Real number as `<a href="tel:+1…">`, or remove both. |
| Medium | `src/index.html:410` | `123 Main Street, Winston-Salem, NC 27106` | City only (matches `:123`), or a real address. |
| Medium | `src/index.html:427-432` | Maps embed `!2d-74.0062269!3d40.7101282` with `Downtown Conference Center` is lower Manhattan, and the UI locale is `!1smk!2sbg` (Macedonian/Bulgaria). | Replace it with a Winston-Salem embed, or with a static "Winston-Salem, NC" text or link (preferred: no third-party iframe; see 2.x and 4.x). |
| Medium | `src/index.html:170,184,198,212,226,240,254,268,282` | 9x "More Details" `href="#"` | Link to real project pages or repos, or remove the second link. |
| Low | `src/index.html:167-279` | Lightbox titles are generic (`App 1`, `Web 3`…). `Web 3` appears twice (`:181`, `:279`) and there is no `Web 1`. | Use real project names. |
| Medium | `src/index.html:305,310,315,320,325,330` | `<a href="">` reloads the page. | Remove the anchors (plain `<h3>`), or link to real content. |
| Medium | `src/index.html:306,311,316,321,326,331` | Empty `<p class="description"></p>` | Write the copy, or remove the element. |
| Low | `src/index.html:358` | "Unites States" | "United States" |
| Low | `src/index.html:353` | "If I had of" | "If I had" |
| Medium | `src/index.html:339-393` | Testimonials are fabricated quotes from Lincoln, Gandhi and Michael Jackson, with photos of unknown license (`testimonials/AbeLincoln.jpg`, `Gandhi.jpg`, `MichaelJackson.jpg`). This is fact only. On a freelance page ("Freelance: Available", `:132`) the section reads as client testimonials. | Owner decision: replace them with real client quotes, relabel the section as clearly humorous, or remove it. Confirm image rights either way. |
| Low | `src/index.html:130,417` | Contact email `junker.bunker69@…` is shown in plaintext twice. This is fact only. | Owner decision: a professional address, or form-only contact. |
| Low | `src/index.html:117`, `:92` | "Coding Ninja" appears in both h3 and the hero. Fact only. | Owner copy decision. |
| Low | `src/index.html:107` | The About copy describes a Windows Server/networking profile, while the Services section lists dev and UX services. | Owner copy decision. |

**Duplicate `.mobile-nav-toggle` (confirmed: `src/index.html:24-26` and `:78-80`).** Both buttons are fixed at top-right and overlap. `toggleMobileNav()` swaps the icon on `document.querySelector('.mobile-nav-toggle i')` only (`src/js/utils.js:23,36`), so the second button's icon never changes. Screen readers announce two unnamed buttons. **Remove `:78-80`.** (Medium)

**Contact form leftovers (confirmed).**

| Sev | File:line | Issue | Change |
|---|---|---|---|
| Low | `src/index.html:477` | `class="php-email-form"` is a template leftover, and all form CSS hangs off it (`style.css:970-1080`). | Rename it to a BEM block (`contact-form`) and update the selectors. |
| Low | `src/index.html:477` | The `action`/`method` attributes are harmless as a no-JS fallback (Web3Forms accepts a plain POST), but `redirect=false` (`:479`) makes the no-JS path end on a raw JSON page. | Keep `action` for progressive enhancement and remove `redirect=false`, or set it to a thank-you URL. |
| Low | `src/index.html:485,490,499` | Three `<div class="validate">` that nothing populates. CSS hides them (`style.css:990-997`). | Remove them. Native constraint validation (`required`, `type=email`) is already in place. |
| Info | `src/index.html:478` | The Web3Forms `access_key` is in the HTML. Web3Forms designs this key to be public. | No change. Optionally restrict allowed domains in the Web3Forms dashboard. |

---

## 2. Accessibility (WCAG 2.2 AA)

### 2a. Names, roles, keyboard

| Sev | WCAG | File:line | Issue | Change |
|---|---|---|---|---|
| **High** | 2.1.1, 4.1.2 | `src/index.html:152-157`, `src/js/utils.js:149-160` | Portfolio filters are `<li>` elements with click handlers only. They cannot be focused or operated by keyboard, and the selected state is not exposed. | `<li><button type="button" class="portfolio-filter__btn" aria-pressed="true">All</button></li>`. Bind the handler to the buttons and toggle `aria-pressed`. JS/Web Coding Expert updates the handler, and the JS/TS Unit Test Engineer updates the tests. |
| **High** | 4.1.2, 1.1.1 | `src/index.html:24`, `:78` | Icon-only mobile toggle button has no accessible name and no state. | `aria-label="Open navigation"`, `aria-expanded="false"`, `aria-controls="header"`. Toggle `aria-expanded` and the label in `toggleMobileNav()`/`closeMobileNav()`. |
| **High** | 2.4.4, 4.1.2 | `src/index.html:40-51` | Four icon-only social links have no accessible name. | `aria-label="X (Twitter), opens in new tab"` and similar. Add `aria-hidden="true"` to each `<i>`. |
| **High** | 2.4.4, 4.1.2 | `src/index.html:464-466` | Back-to-top `<a href="#">` has no name. | `<a class="back-to-top" href="#hero" aria-label="Back to top">`, with `aria-hidden="true"` on the icon. |
| **High** | 2.4.7, 2.4.11 | `src/css/style.css:225` | `.mobile-nav-toggle { outline: none !important; }` removes the focus indicator. | Delete the line. Add `.mobile-nav-toggle:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`. |
| **High** | 2.4.7, 2.4.11, 2.5.x | `src/css/style.css:653-699` | Portfolio action links sit at `bottom:-60px` inside `overflow:hidden` and appear only on `:hover`. Keyboard focus lands on invisible links, and touch users never see them. | Add `.portfolio-wrap:focus-within .portfolio-links { bottom:0 }` and the matching `::before`. Show the links by default under `@media (hover: none)`. |
| **High** | 2.2.2 | `src/js/main.js:79-92` | The testimonial carousel autoplays every 5s, forever (`disableOnInteraction:false`), with no pause control. | Add a visible pause/play button. Set `autoplay.pauseOnMouseEnter:true`, pause on `focusin`, and disable autoplay under `prefers-reduced-motion: reduce`. |
| Medium | 2.4.3, 2.4.11 | `src/css/style.css:76-89,145-157` | Below 1200px the closed off-canvas header is only moved to `left:-300px`. Its links stay in the tab order, and focus moves off-screen. | Make the closed state `visibility:hidden` (or set `inert` on `#header`) and remove it when `.mobile-nav-active` is set. Move focus into the nav on open, and close it on Esc. |
| Medium | 4.1.2, 1.3.1 | `src/js/main.js:79-92` | The Swiper `A11y` module is not loaded, so pagination bullets are unnamed `<span>` elements and slides have no group/roledescription. | Import `A11y` from `swiper/modules` and add it to `modules`. |
| Medium | 2.4.1 | `src/index.html:21` | No skip link. Keyboard users must tab through 4 social links and 5 nav links on every load. | Add `<a class="visually-hidden-focusable" href="#main">Skip to content</a>` as the first child of `<body>`. This is a Bootstrap utility. |
| Medium | 1.3.1, 2.4.6 | `src/index.html:36`, `:88` | **Two `<h1>`** ("Fred Smith" in both). | Keep the hero `<h1>`. Change the header name to `<p class="profile__name">`. |
| Low | 1.3.1 | `src/index.html:305-330` (h4 after h2), `:356-358` (h3/h4 for name/role), `:409,415,423` (h4 after h2), `:473` (h5) | Heading levels skip, and some headings are not real headings. | Services titles become `<h3>`. Testimonial name/role become `<figcaption>` or `<cite>` (not headings), and contact labels become `<h3>` or `<dt>`. The modal title can stay as is or become an `<h2>`; style it by class. |
| Medium | 1.1.1 | `src/index.html:165,179,193,207,221,235,249,263,277` | `alt="Portfolio item N"` gives no information. | Describe each project, for example `alt="Screenshot of <project> dashboard"`. |
| Medium | 2.4.4 | `src/index.html:167-283` | Lightbox and detail links are named only by `title` (`App 1`, `More Details`), and nine of them are identical. | `aria-label="Enlarge <project>"` and `aria-label="<project> details"`. Remove `title`. |
| Low | 1.1.1 | `src/index.html:356,369,382` | `alt` repeats the `<h3>` name next to it. | `alt=""` (decorative). |
| Low | 1.1.1 | `src/index.html:112` | The About photo duplicates the header photo, with near-identical alt text. | `alt=""`, or a distinct description. |
| Low | 1.1.1 | all `<i class="fa-…">` | Font Awesome webfont icons are not hidden from assistive tech. | Add `aria-hidden="true"` to every decorative `<i>`. |
| Low | 4.1.2 | `src/index.html:57`, `src/js/utils.js:47-74,133-137` | The active nav item is marked by a class only. | Set `aria-current="true"` on the active `<a>` and clear it on the others. |
| Low | 3.2.5 (AAA, advisory) | `src/index.html:40-51` | `target="_blank"` gives no warning. | Covered by the "opens in new tab" `aria-label` above. |
| Low | 1.3.1 | `src/index.html:86-96` | `#hero` is outside `<main>`, and `.nav-menu` is a plain `<nav>`. | Move `#hero` inside `<main>` (adjust `#main` margin rules) and give the nav `aria-label="Primary"`. |

### 2b. Contact modal and form

| Sev | WCAG | File:line | Issue | Change |
|---|---|---|---|---|
| Medium | 4.1.3 | `src/index.html:502-503`, `src/js/main.js:206-227` | Success and error messages toggle `display` with no live region, so screen readers hear nothing. | `role="alert"` on `#error-message`, and `role="status"` or `aria-live="polite"` on `#sent-message`. |
| Medium | 2.2.1, 4.1.3 | `src/js/main.js:210-216` | The modal auto-closes 2s after success, which can be too short to read or announce. | Leave the modal open with the success message and a Close button, or wait at least 5s. |
| Medium | 3.3.2 | `src/index.html:483-498` | Labels are `visually-hidden`, so the only visible label is a placeholder that disappears while typing. | Use visible labels, or Bootstrap `form-floating`. |
| Medium | 1.3.5 | `src/index.html:484,489` | No `autocomplete`. | `autocomplete="name"` and `autocomplete="email"`. |
| Low | 3.3.1 | `src/index.html:482-500` | No `aria-invalid` or `aria-describedby` error wiring. Native bubbles are the only feedback. | Optional: wire Bootstrap `.is-invalid` with `.invalid-feedback`, plus `aria-describedby`. |
| Low | — | `src/index.html:480` | The honeypot uses an inline `style="display:none"`, which conflicts with the no-inline-styles convention and with CSP (section 4). | Use `class="d-none"`, plus `tabindex="-1" autocomplete="off" aria-hidden="true"`. |
| Low | — | `src/js/main.js:186-187` | The submit button shows "Sending..." with no busy state. | `aria-busy="true"` on the form while sending. |
| Info | — | `src/index.html:469-474` | The modal markup follows the Bootstrap 5.3 pattern (labelledby, close `aria-label`), and Bootstrap manages focus trap and return. | No change. |

### 2c. Color contrast (from `style.css` values)

| Sev | Pair | Ratio | Needed | Where | Change |
|---|---|---|---|---|---|
| **High** | `#fff` on `#149ddd` | **3.0:1** | 4.5:1 (text is 15-16px/600, not large) | `.contact-modal-btn` `style.css:1089-1100`, submit `:1024-1035`, back-to-top `:42-55` | Darken the accent for filled buttons: `#0b6f9e` gives about 5.5:1 with white. Define it once as a token (see 5c). |
| **High** | `#149ddd` text on `#fff` / `#f5f8fd` | **3.0:1 / about 2.8:1** | 4.5:1 | Links `style.css:17-20`, active filter `:620-624`, service title hover `:753-756`, email link in About and Contact | Use the darker accent for text, and keep `#149ddd` for decorative fills. |
| **High** | `#fff` on `#18d26e` | **2.0:1** | 4.5:1 | `.sent-message` `style.css:1014-1022` | Dark text (`#05301a`) on the green, or a darker green (`#0f7a40` or darker). |
| Medium | `#fff` on `#ed3c0d` | **4.0:1** | 4.5:1 | `.error-message` `style.css:999-1007` | `#c0300a` or darker. |
| Medium | `#999` on `#f5f8fd` | **2.7:1** | 4.5:1 | Testimonial role `style.css:795-800` | `#5f6368` or darker. |
| Medium | `#ddd` bullets on `#f5f8fd` | about 1.3:1 | 3:1 (UI component) | `style.css:856-865` | `#8a94a6` or darker for inactive bullets. |
| Medium | white text on `hero-bg.jpg` + `rgba(5,13,24,.3)` overlay | image-dependent | 4.5:1 / 3:1 | `style.css:266-276,285-308` | Raise the overlay to `.55`, or add a text-shadow. Verify with a contrast picker on the real image. |
| Pass | `#a8a9b4` on `#040b14` | 8.5:1 | — | Nav `style.css:183-192` | — |
| Pass | `#6f7180` icons on `#040b14` | 4.1:1 | 3:1 | `style.css:194-199` | — |

### 2d. Target size and motion

| Sev | WCAG | File:line | Issue | Change |
|---|---|---|---|---|
| Medium | 2.5.8 | `style.css:856-865` | Swiper bullets are 12px with 5px margins (22px pitch), which fails the 24px target/spacing rule. | Size the hit area to at least 24px, with the visual dot inside it (`padding` or `::before`). |
| Low | org std (44px) | `style.css:117-131` (36px), `:42-55` (40px) | Social links and back-to-top are under the 44px web standard. They pass the 2.5.8 24px minimum. | Use 44x44. |
| Medium | 2.3.3 / user pref | `style.css` (no `prefers-reduced-motion` anywhere); `utils.js:12-15`, `main.js:284` (`behavior:'smooth'`); `style.css:310-317` (`background-attachment:fixed`); many `transition:` rules | Smooth scroll, parallax and transitions ignore the reduced-motion preference. | Add `@media (prefers-reduced-motion: reduce)`: `transition:none`, `background-attachment:scroll`. In JS, use `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`. |
| Low | 2.4.11 | `style.css:1308-1319` | The fixed footer (z-index 9999) overlays the bottom of the fixed header nav on short viewports at ≥1200px, which can hide a focused nav link. | Put the footer content inside `#header`'s flex column (`margin-top:auto`) instead of `position:fixed`. |

### 2e. iframe

| Sev | File:line | Issue | Change |
|---|---|---|---|
| Medium | `src/index.html:427-432` | Wrong location (section 1). Inline `style` (conflicts with convention and CSP). Deprecated `frameborder`. No `loading="lazy"`. Google cookies and requests load on page load. The `title` is generic. | If kept: `loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map of Winston-Salem, NC" class="contact__map"`, with styles moved to CSS. Preferred: replace it with a text link to Maps, which removes a third-party frame, a CSP `frame-src` entry and about 0.5 MB+ of Maps JS. |

---

## 3. Performance

Measured on the live deploy *(2026-11-16, `curl` with `Accept-Encoding: br, gzip`)*:
- CSS bundle: 342 KB raw, **55 KB br**.
- JS bundle: 280 KB raw, **78 KB br**.
- Font Awesome woff2: solid 119 KB + brands 115 KB.
- `hero-bg.jpg`: 480 KB, served byte-identical to the source.

| Sev | File:line | Issue | Change |
|---|---|---|---|
| **High** | `src/css/style.css:260`, `src/images/hero-bg.jpg` (3840x2160, 469 KB) | The likely LCP element is a 4K JPEG loaded as a CSS background. The browser discovers it late (HTML, then CSS, then the image), and it is served at full size to phones. | Ship 1280/1920/2560 widths in AVIF/WebP. Use `image-set()` in CSS, or move it to an `<img fetchpriority="high">` with `srcset`/`sizes` inside `#hero` (`object-fit:cover`). Parcel can generate variants with `?as=webp&width=1920` query params; confirm against Parcel docs before relying on this. |
| Medium | `src/index.html:17-18` | Google Fonts **CSS v1**: 3 families x 8 styles (24 faces), no `display=swap` (invisible text until the font loads), no `preconnect`, render-blocking third-party CSS. | Request only the weights in use, on the css2 API: `family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Raleway:wght@600;700&family=Poppins:wght@400;600&display=swap`. Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`. Better still, self-host the woff2 files and drop the third-party request, which also removes Google from CSP and privacy scope. Weights 300 and 500 are used only by dead CSS (`.breadcrumbs h2` 300) or not at all. |
| Medium | `src/js/main.js:18-20` | Full Font Awesome CSS (every icon class) plus two webfonts (234 KB woff2) for **about 25 icons**. | Inline SVG icons (an SVG sprite, or Font Awesome's SVG core with only the icons you import, which is still Font Awesome). Removes about 234 KB of fonts and most of the FA CSS. |
| Medium | `src/js/main.js:14` | Full `bootstrap.min.css` is the bulk of the 55 KB br CSS, while the page uses the grid, a few utilities, modal, `btn-close`, `form-control` and `visually-hidden`. | Import Bootstrap's Sass partials for only those parts. This needs `sass`, which Parcel supports through `@parcel/transformer-sass`. That is an added build dependency, so flag it as such. |
| Medium | every `<img>`: `src/index.html:33,112,165,179,193,207,221,235,249,263,277,356,369,382` | No `width`/`height` (layout shift), no `loading="lazy"` below the fold, no `decoding="async"`. | Add intrinsic `width`/`height` to every image, and `loading="lazy" decoding="async"` to all but the header profile image. |
| Medium | `src/images/profile-img.jpg` (1920x1275, 107 KB; 90 KB after Parcel) | Displayed at 120px (header) and about 350px (About). | Square crop with `srcset` at 240/480/720 in WebP/AVIF. |
| Low | `src/images/testimonials/{AbeLincoln,Gandhi,MichaelJackson}.jpg` (480x791, 900x450, 982x726; 142 KB total) | Displayed at 90x90. | 180x180 square crops (about 8 KB each). |
| Low | `src/images/portfolio/portfolio-*.jpg` (800x600, 10-59 KB) | Reasonable size, but JPEG only. | Add WebP/AVIF through `<picture>`. |
| Low | `src/css/style.css:310-317` | `background-attachment:fixed` repaints on every scroll and is ignored by iOS Safari. | Drop it, or make it part of the motion work. Also handled by reduced motion (2d). |
| Low | `src/js/main.js:274-277`, `src/js/utils.js:47-89` | An unthrottled scroll listener runs `querySelectorAll` and `offsetTop`/`offsetHeight` layout reads on every scroll event, and the listener is not passive. | Use `IntersectionObserver` for the active nav and back-to-top, or `{ passive: true }` plus `requestAnimationFrame` throttling. JS/Web Coding Expert. |
| Low | `src/js/main.js:8,58-72` | Isotope (unmaintained since 2018) runs for 9 items. | A `hidden` attribute toggle plus CSS grid does the same job without the library. Coordinate with the GSAP specialist if they plan Flip-based filter animation. |
| Low | `src/js/main.js:23-32` | A CommonJS `require()` inside an ES module limits Parcel scope hoisting and tree shaking. | Convert `utils.js` to ESM exports. JS/Web Coding Expert and Unit Test Engineer (Jest config). |

### Unused assets and dependencies (orchestrator list verified)

| Sev | Item | Evidence | Change |
|---|---|---|---|
| Low | `src/css/icofont.min.css` (123 KB), `icofont.woff` (646 KB), `icofont.woff2` (538 KB) | Referenced only by `.prettierignore:7`. Not imported anywhere. | Delete all three, and remove the `.prettierignore` line. 1.3 MB out of the repo. |
| Low | `src/images/portfolio-details-1..3.jpg` (1200x695, 315 KB total) | No reference in tracked files. | Delete. |
| Low | `src/images/testimonials/testimonials-1..5.jpg` (400x400, 81 KB total) | No reference in tracked files. | Delete. |
| Low | `boxicons` (`package.json:21`) | No import. Mentioned only in `README.md:36`. | Remove. |
| Low | `just-validate` (`package.json:24`) | No import. Mentioned only in `README.md:42`. | Remove. |
| **Keep** | `@popperjs/core` (`package.json:19`) | **Required.** Bootstrap 5.3.8 has `"module": "dist/js/bootstrap.esm.js"`, and that file statically does `import * as Popper from '@popperjs/core'`. It is also a declared `peerDependency` (`yarn.lock:2966-2967`). Importing `{ Modal }` still resolves the whole ESM file, so removing Popper breaks the build. *(verified 2026-11-16 via unpkg `bootstrap@5.3.8/package.json` and `dist/js/bootstrap.esm.js` line 6)* | Keep it. |

---

## 4. Netlify headers (`netlify.toml`)

Live response headers *(2026-11-16, `curl -sI https://fs3portfolio.netlify.app/`)*: `X-Frame-Options: DENY`, `X-Xss-Protection: 1; mode=block`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and **`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Netlify adds this itself)**. No CSP and no Permissions-Policy.

Parcel output is **flat and hashed at the `dist/` root**. The live HTML references `profile-img.47ae0d78.jpg`, `portfolio-1.afcd9577.jpg`, `hero-bg.2a611c00.jpg`, `fa-solid-900.031e0008.woff2` and `repo.a303b21b.css`, none of them under `/images/`.

| Sev | File:line | Issue | Change |
|---|---|---|---|
| **High** | `netlify.toml:51-55` | `/images/*` **matches no built asset**. It matches only the broken lightbox 404s and caches them `immutable` for a year (section 0). The hashed images are served `max-age=0, must-revalidate`: `portfolio-1.afcd9577.jpg` and `hero-bg.2a611c00.jpg` were measured. | Replace it with `for = "/*.jpg"`, `"/*.jpeg"`, `"/*.png"`, `"/*.webp"`, `"/*.avif"`, `"/*.svg"`, each `public, max-age=31536000, immutable`. This is safe because Parcel content-hashes every one of them. |
| Medium | `netlify.toml:20-26` | No `Content-Security-Policy`. | Start with **`Content-Security-Policy-Report-Only`**: `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src https://api.web3forms.com; frame-src https://www.google.com; form-action https://api.web3forms.com; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`. Prerequisites: remove the inline `style=` attributes (`index.html:431,480`). Bootstrap's `data:` SVGs need `img-src data:`, which is already included. Drop the Google entries if fonts are self-hosted and the map is removed. **Route this to the Security Reviewer before enforcing.** |
| Low | `netlify.toml:24` | `X-XSS-Protection: 1; mode=block` is deprecated, and the filter it enables can itself be abused. | Remove it, or set `"0"`. |
| Low | `netlify.toml:20-26` | No `Permissions-Policy`. | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| Low | `netlify.toml:20-26` | No `Cross-Origin-Opener-Policy`. | `same-origin` |
| Info | — | HSTS is already sent by Netlify. | No change needed for `*.netlify.app`. Add it explicitly only if a custom domain should carry `preload`. |
| Low | `netlify.toml:57-61` | `/*.html` does not match the request path `/`, so the root document falls back to Netlify's default, which is already `public,max-age=0,must-revalidate` (observed). | Optionally add `for = "/"` for clarity. Behavior is already correct. |
| Low | `netlify.toml:40-49` | The `/*.ttf` rule has nothing to match. Only `woff2` is emitted (FA 7). | Remove it. |
| Low | `netlify.toml:23` | `X-Frame-Options: DENY` is fine. | Mirror it with CSP `frame-ancestors 'none'` (above). |

---

## 5. CSS (`src/css/style.css`)

### 5a. Dead selectors (no matching element in `index.html` or JS)

| Lines | Block | Change |
|---|---|---|
| 417-473 | `.facts …` (count boxes) | Delete. |
| 475-514 | `.skills …` (progress bars; README advertises this section) | Delete. README fix goes to the Documentation Agent. |
| 516-584 | `.resume …` | Delete. |
| 1138-1194 | `.breadcrumbs …` | Delete. |
| 1196-1302 | `.portfolio-details …` | Delete (with `portfolio-details-*.jpg`). |
| 1042-1062, 1112-1136 | `.php-email-form .loading`, `@-webkit-keyframes` / `@keyframes animate-loading` | Delete. |
| 935-960 | `.contact .info .social-links …` (no social links in Contact) | Delete. |
| 1009-1012 | `.error-message br + br` | Delete. |
| 990-997 | `.validate` (elements are never shown) | Delete along with the HTML divs. |
| 328-333 | `#hero h2` (no h2 in hero) | Delete. |
| 970-976 + 978-983 | `.php-email-form` base box, which is fully overridden by `#contactModal .php-email-form` (the only form is in the modal) | Collapse to a single rule, or none. |

That is roughly 450 of 1343 lines.

### 5b. Template leftovers and invalid or no-op declarations

| Sev | Line | Issue | Change |
|---|---|---|---|
| Low | 85-86 | Duplicate `transition` (second wins). Also `transition: all` on `#header`. | One `transition: left .5s`. |
| Low | 1339 | `padding-right: 20px 15px` is **invalid**, because `padding-right` takes one value, so the declaration is dropped. | `padding: 20px 15px`. |
| Low | 52 | `transition: display .5s` does nothing (display is discrete). | Remove it. Handle visibility with `opacity`/`visibility` if needed. |
| Low | 601-602 | `padding: 0; padding: 2px 15px;` | Keep the second. |
| Low | 626-629 | `li:last-child { margin-right:0 }`, where no margin-right is ever set. | Delete. |
| Low | 659 vs 697 | `.portfolio-links` has `opacity:1` in both states. The template intended `0`, then `1`. | Fold into the 2a focus-within fix. |
| Low | 686-693 | The hover `::before` repeats offsets that are already set. | Keep only `opacity:1`. |
| Low | 101 | `-moz-text-align-last` is obsolete. | Delete. |
| Low | 1112 | `@-webkit-keyframes` is obsolete. | Delete with the loader block. |
| Low | 145-146, 319-320, 872-873, 1334-1335 | Mixed breakpoints (`1199px`, `768px`, `767px`) and odd `@media\n( … )` formatting. | Use Bootstrap's `1199.98px` / `767.98px` (or `min-width` mobile-first). Prettier currently skips CSS (`format` script covers `src/js` only); consider adding `src/css`. |
| Low | 340-344 | `section { overflow:hidden }` globally clips focus rings at section edges. | Scope it to sections that need it (hero, portfolio). |
| Low | 170-175 | `.nav-menu *` resets every descendant. | `.nav-menu ul, .nav-menu li`. |

### 5c. Bootstrap 5 duplication and tokens

| Sev | Line | Issue | Change |
|---|---|---|---|
| Medium | 22 occurrences of `#149ddd`, plus `#37b3ed`, `#2eafec`, `#173b6c`, `#040b14`, `#050d18` throughout | No design tokens. Color fixes (2c) would mean 22 edits. | Define `:root { --color-accent:#149ddd; --color-accent-strong:#0b6f9e; --color-ink:#173b6c; --color-sidebar:#040b14; … }` and map Bootstrap onto it: `--bs-link-color`, `--bs-link-hover-color`, `--bs-body-font-family`, `--bs-body-color`, `--bs-primary`/`--bs-primary-rgb`. |
| Low | 11-26 | `body` font/color and `a` color override Bootstrap with raw values instead of `--bs-body-*` and `--bs-link-*` variables. | As above. |
| Low | 985-988 | `.form-group` was removed in Bootstrap 5. | Use the `mb-3` utility in the HTML and drop the rule. |
| Low | 1024-1040, 1089-1105 | Custom submit and CTA buttons re-implement `.btn .btn-primary`. | Use `.btn .btn-primary` with the token-mapped `--bs-btn-*` variables, which brings focus-visible styles for free. |
| Low | 856-870 | Re-styles Swiper bullets that Swiper's CSS already styles. | Use Swiper's `--swiper-pagination-color`, `--swiper-pagination-bullet-inactive-color`, `--swiper-pagination-bullet-size` and `--swiper-pagination-bullet-horizontal-gap` variables. |
| Low | (none) | No BEM in the custom CSS (`.icon-box`, `.count-box`, `#portfolio-flters`; note the "flters" typo). | Rename to BEM as blocks are touched (`.portfolio-filter__btn`, `.service-card__title`). |

---

## 6. Template attribution (facts only)

| Fact | Source |
|---|---|
| The site is the BootstrapMade "iPortfolio" template. The CSS header keeps the template name, URL, author and `License: https://bootstrapmade.com/license/`. | `src/css/style.css:1-6` |
| The JS header says "Template Name: iPortfolio - v2.0.0" (the CSS says v1.4.0). | `src/js/main.js:2` |
| The footer credit reads "Designed by Fred Smith". There is no BootstrapMade credit or link. | `src/index.html:458-460` |
| BootstrapMade **Free License**: you must keep the footer credit line as is ("Designed by BootstrapMade"), and the free license does not allow removing or changing it. | bootstrapmade.com/license *(fetched 2026-11-16)* |
| **Pro License** (paid, single template): "You can remove the footer credit link." The **Premium Plan** (paid) allows the same. | same |
| None of the licenses allow reselling or mass redistribution of the templates. | same |
| The license page **does not address** public GitHub repos or applying an open-source license to template files. It directs such questions to BootstrapMade. | same |
| This repo is **public** on GitHub (`ValhallaTech/PortfolioPage-FS3`) and is licensed **GPL-3.0** (`LICENSE`, `README.md:152`). | `gh repo view --json visibility,licenseInfo` *(2026-11-16)* |
| Whether a Pro or Premium license was purchased could not be determined from the repo. | — |

---

## 7. Requirements for the animation replacement (for the GSAP specialist; no plan here)

| Req | Applies to | Requirement |
|---|---|---|
| A1 | All motion | Respect `prefers-reduced-motion: reduce`. Reveal effects become instant (or opacity-only, at most 200ms), with no translate or parallax. Branch with `matchMedia`, not a one-time check, so a live preference change applies. |
| A2 | Hero typing (`index.html:89-94`) | The full sentence must be in the accessibility tree once and stay stable. Put the static text in a `visually-hidden` span (`I am a designer, a developer, a photographer, a coding ninja`), and mark the animated span `aria-hidden="true"`. Never announce per-character mutations (no `aria-live` on it). |
| A3 | Hero typing loop | It loops forever, which counts as auto-updating content lasting more than 5s, so WCAG **2.2.2** needs a pause/stop control, or the animation must stop after its first cycle. Under reduced motion, show the static text with no animation. |
| A4 | Scroll reveals | Content must be visible and readable **without JS** and before the animation runs. Do not ship `opacity:0` in CSS. Set the hidden starting state from JS only, so a script failure (for example the `init()` crash in section 0) cannot leave sections invisible. |
| A5 | Scroll reveals | Never animate an element that has keyboard focus out of view. Elements must be focusable and readable (not `visibility:hidden`) at the moment they are tabbed to. |
| A6 | Any flashing | Nothing flashes more than 3 times per second (2.3.1). |
| A7 | Smooth scroll / back-to-top | Use `behavior:'auto'` under reduced motion, and move focus to the target section (`tabindex="-1"` plus `.focus({preventScroll:true})`) after in-page navigation. |
| A8 | Carousel autoplay (if touched) | Same 2.2.2 pause control as 2a, and autoplay off under reduced motion. |
| A9 | CSP | The library must run under `script-src 'self'`, with no `eval` and no inline `<script>`. Setting styles through `element.style` (CSSOM) is fine under the planned CSP. |

---

## Handoffs implied by this audit

- **JS/Web Coding Expert:** lightbox URL fix (0), hash `querySelector` crash (0), filter buttons and `aria-pressed` (2a), mobile nav ARIA, focus and `inert` (2a), live regions and modal auto-close (2b), scroll listener (3), ESM `utils.js` (3), `observeSkills` removal (0).
- **JS/TS Unit Test Engineer:** `__tests__/utils.test.js` updates for the filter, nav and `observeSkills` changes.
- **Security Reviewer:** CSP rollout (4).
- **Documentation Agent:** README drift and the 404 URL (0).
- **Owner decisions:** testimonials content, contact details, map, and template license status (1, 6).

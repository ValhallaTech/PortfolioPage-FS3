# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.1.0] - 2026-11-21

### Added

- The page follows the visitor's reduced motion setting everywhere, and follows it live, so a
  change takes effect without a reload: the scroll reveals, the hero typing, in-page scrolling,
  the mobile nav, the portfolio caption links, the lightbox and the portfolio grid ([#94],
  [#95], [#96]).
- An in-page link, such as a nav item, moves keyboard focus to the section it scrolls to
  ([#96]).
- The hero headline is one sentence for screen readers and for visitors without JavaScript,
  while the typing effect plays for everyone else ([#95]).
- A GPLv3 section 7 additional permission, granted by Valhalla Tech, to combine the site with
  GSAP under GSAP's Standard "no charge" license. It is in the README License section; `LICENSE`
  is unchanged ([#94]).
- GSAP's license terms, kept in the repo in `third-party-licenses/gsap/LICENSE.md` because the
  GSAP package ships no license file. The build copies them into
  `dist/THIRD-PARTY-NOTICES.txt` ([#94]).

### Changed

- GSAP 3 animates the hero entrance, the hero typing and the scroll reveals, instead of Typed.js
  and ScrollReveal ([#94], [#95]).
- The page script grew by 20.7 KB gzipped, from 77,495 to 98,707 bytes (273,270 to 323,699 bytes
  raw).
- The Contact map loads only when it is about to scroll into view, so the page draws sooner.

### Removed

- The `typed.js` and `scrollreveal` packages ([#94], [#95]).

## [5.0.0] - 2026-11-20

### Added

- The contact form works without JavaScript. A "Send Me a Message" link opens the form as a
  panel, and a submission ends on a new `/thanks.html` page ([#91]).
- Every contact-form field has a visible label and an autofill hint. Field errors are announced
  on the field they belong to ([#90]).

### Changed

- **BREAKING:** The site uses Bootstrap 6, pinned to the prerelease `6.0.0-alpha.1`, instead of
  Bootstrap 5.3.8. Supported browsers are now Chrome and Edge 130 and later, Firefox 132 and
  later, and Safari 18 and later, with no fallbacks for older browsers. The `browserslist` build
  target stays `defaults, iOS >= 15` ([#89]).
- The contact popup is a native `<dialog>`, driven by the Bootstrap 6 Dialog component. Keyboard
  focus stays inside it while it is open, and its form scrolls on short screens ([#89]).
- The sidebar and the menu button switch at 1280 px, and the grid changes at 1024 px, so widths
  from 992 to 1023 px show 2 columns ([#89]).
- The page, the contact dialog and the embedded map stay light when the operating system is in dark mode ([#89]).
- Contact-form results are announced to screen readers and stay until the dialog closes, instead
  of closing it after 2 seconds ([#90]).
- The contact and submit buttons use Bootstrap 6 button classes in the site accent color, and
  are 44 px tall ([#90]).

### Removed

- The `@popperjs/core` package, which Bootstrap 6 does not use ([#89]).
- The template leftovers: the `php-email-form` class, renamed `contact-form`, and the empty
  `.validate` elements with their CSS rule ([#90]).

### Security

- The report-only Content Security Policy allows `'self'` in `form-action`, so a form submission
  without JavaScript can redirect to `/thanks.html` ([#91]).

## [4.0.0] - 2026-11-20

### Added

- A local gate: `yarn gate` runs `yarn install --immutable`, `yarn lint`, `yarn format:check`,
  `yarn test:ci`, `yarn build` and `yarn test:smoke` in order, stops at the first failure and
  prints an evidence block, and `yarn gate:linux` runs it in a Linux Docker container on a fresh
  clone of the pushed commit ([#70]).
- Playwright end-to-end tests against the built site, served locally with the `netlify.toml`
  headers: the smoke baseline (`yarn test:smoke`), the slow timing tests (`yarn test:e2e:slow`)
  and the live-site tests (`yarn test:e2e:live`). CI runs the smoke baseline after the build
  ([#70], [#73]).
- A release suite, `yarn verify:release`, for the network, `gh`, Docker and live-site checks that
  the gate does not run ([#70]).
- Bug report and feature request issue forms, and this changelog, backfilled for 1.0.0 through
  3.0.0 ([#72]).
- A Renovate rule that gives Bootstrap its own group and never automerges it, so a Bootstrap
  prerelease cannot ride along with other updates ([#73]).
- A `main: require Test & Build` ruleset, created disabled. Its enforcement waits until GitHub
  Actions billing is restored.
- The build writes `dist/THIRD-PARTY-NOTICES.txt` with the license notices of the direct runtime
  dependencies, because the production bundles drop their license comments ([#79]).
- Responsive images: AVIF, WebP and JPEG variants with explicit dimensions, and lazy loading
  below the fold ([#80]).
- A skip link to the main content, a visible focus outline, and names for the nav toggle, social
  links, back-to-top button and portfolio links ([#82]).
- A pause/play button for the testimonials carousel. Keyboard focus or a mouse over the carousel
  holds rotation, and it never autoplays when the visitor asks for reduced motion ([#83]).

### Changed

- **BREAKING:** The runtime is Node.js 26. Node.js 25 and later no longer bundle Corepack, so CI
  and the README install steps now install it with `npm install -g corepack` before
  `corepack enable` ([#73]).
- The portfolio filter and layout use Muuri 0.9.5 instead of Isotope. Muuri carries a one-line
  Yarn patch so layout runs synchronously, without web workers. The filters are buttons with
  `aria-pressed`, and with reduced motion the grid jumps straight to its filtered layout ([#79]).
- Fonts are self-hosted through Fontsource instead of loaded from Google Fonts, and the
  Font Awesome webfonts are replaced by an inline SVG sprite of the Font Awesome Free 7.3.1 icons
  the page uses ([#80]).
- The hero headline types each phrase once and stops on the last one, and its cursor stops
  blinking ([#83]).
- The testimonials carousel uses Swiper's A11y module and rewinds instead of looping. Its bullets
  are named 24 × 24 px buttons, and slide changes are announced unless it is rotating ([#83]).
- Accessibility: one `h1` and corrected heading levels, a labeled primary nav, descriptive
  portfolio image text, contrast-safe colors from `:root` color tokens, 44 × 44 px touch targets,
  and the closed mobile nav kept out of the tab order ([#82]).
- The active nav link carries `aria-current="location"`, and scroll handling is throttled with
  `requestAnimationFrame` ([#77]).
- The contact form sets `aria-busy` while it sends ([#83]).
- `src/js/main.js` and `src/js/utils.js` are ES modules, and Jest transforms them with Babel
  ([#77]).
- ESLint now checks `src/js`, `__tests__`, `tests` and `scripts`, and Prettier checks the same
  folders plus `src/css`. `.gitattributes` gives every platform the same line endings ([#70]).
- Every dependency range is pinned to an exact version instead of a caret range, and `yarn.lock`
  uses the exact specifiers ([#34]).
- The six devDependencies that used `latest` are pinned to exact versions, including ESLint 10
  and Prettier 3 ([#71]).
- The runtime-version sync moved into `scripts/sync-runtime-versions.mjs`. It updates every
  `NODE_VERSION` in `netlify.toml`, updates `YARN_VERSION` only where that key exists, and its
  workflow opens a draft pull request ([#73]).
- Renovate automerge is paused ([#69]).
- Dependency updates from Renovate since 3.0.0, including Swiper 14 ([#53], [#67]) and Yarn 4.18.1
  ([#66]).
- `package.json` declares the license as `GPL-3.0-only`, and the README names Valhalla Tech as the
  copyright holder.

### Removed

- Isotope (`isotope-layout`), replaced by Muuri ([#79]).
- The unused `boxicons` and `just-validate` packages, the unreferenced IcoFont CSS and font files,
  and eight unreferenced images ([#77]).
- The dead skills-section code (`observeSkills`) and CSS, other unused CSS blocks, the template
  header comments, and the duplicate mobile nav toggle ([#77]).
- The `@fortawesome/fontawesome-free` package and the Google Fonts link ([#80]).
- The Markdown issue template, replaced by the two issue forms ([#72]).
- The `X-XSS-Protection` header ([#84]).

### Fixed

- Every responsive breakpoint was ignored by iOS Safari before 16.4, which cannot parse the
  range-syntax media queries (`@media (width>=1200px)`) that the build emitted with no browser
  targets set. `package.json` now sets `"browserslist": "defaults, iOS >= 15"`, so the CSS uses
  `min-width` and `max-width` queries, and Swiper's nested CSS rules are flattened for browsers
  that ignored them (Chrome before 120, iOS Safari before 17.2) ([#81]).
- `yarn install --immutable` failed on `main`, so CI and Netlify could not install, because a
  Swiper update changed `package.json` without `yarn.lock` ([#69]).
- All nine portfolio lightbox images returned 404, and those 404s were cached as immutable for a
  year. Lightbox links now use the bundled image URLs, and the cache rules match the
  content-hashed image files ([#69]).
- A malformed URL hash such as `#1x` threw an error that stopped every feature initialized after
  it ([#69]).
- The runtime-version sync workflow failed whenever `netlify.toml` needed no change ([#73]).
- Invalid and duplicate CSS declarations ([#77]).
- About 6% of cold-cache builds on Windows crashed on exit. The `build` script now runs Parcel's
  workers as child processes ([#85]).
- Production kept serving the old response headers after [#84]. A `/*.woff` cache rule was added
  and the site rebuilt without the stale build cache ([#86]).
- `package.json` carried version 2.0.0 through the 3.0.0 release. It now carries 4.0.0.

### Security

- `netlify.toml` adds a report-only Content Security Policy, `Permissions-Policy` and
  `Cross-Origin-Opener-Policy: same-origin`, and the remaining inline styles moved to CSS
  ([#84]).
- The production build no longer publishes source maps ([#84]).
- The page no longer loads fonts or icons from third-party hosts ([#80]).
- Lockfile updates cleared all 20 high and critical advisories in the dependency tree ([#71]).
- Workflow actions are pinned to commit SHAs, checkouts do not persist the token, and each job
  gets only the permissions it needs ([#75]).
- Lightbox links accept only same-origin `http(s)` URLs ([#69]).

## [3.0.0] - 2026-04-20

### Added

- Parcel build, Jest tests, a GitHub Actions CI workflow and a Netlify configuration, as part of
  the project overhaul ([#19]).
- An inline Web3Forms contact form that submits with AJAX ([#25]).
- ESLint and Prettier, with both checks enforced in CI ([#26]).
- A script that keeps the Yarn and Node.js version pins in sync ([#30]).
- Renovate updates for the dependencies of the GitHub Actions workflows ([#31]).

### Changed

- Modernized the stack in a full project overhaul ([#19]).
- Replaced the Boxicons and IcoFont icons with Font Awesome 7.2.0 across the app entry points
  ([#23]).
- Updated Yarn to 4.14.0 ([#24]), then to 4.14.1 ([#29]).
- Aligned the Yarn and Node.js version pins ([#30]).
- Updated all dependencies to their new major versions ([#32]).

### Removed

- The deprecated `lib` directory.
- The committed `node_modules` directory and the Visual Studio project files
  (`PortfolioPage_FS3.csproj`, `PortfolioPage_FS3.sln` and the `web.config` files), in the
  project overhaul ([#19]).

### Fixed

- The Yarn 4 legacy configuration error and Corepack activation in CI, and aligned
  `netlify.toml` with the team standard ([#21]).
- A malformed `package.json` ([#22]).
- Broken image links in the portfolio section ([#27]).
- Uneven sizes of the testimonial avatar images ([#28]).

## [2.5.0] - 2021-12-30

### Changed

- Every vendor resource now points at its package in `node_modules` ([#10], [#12]).
- Updated Yarn to 3.1.1.
- Updated owl.carousel, jquery.easing and jquery.isotope to their latest versions.

### Deprecated

- The `lib` directory, in favor of `node_modules`.

## [2.0.2] - 2021-12-28

### Fixed

- Committed the installed `node_modules` directory, so the site can load the vendor files it
  references ([#10]).

## [2.0.1] - 2021-12-28

### Fixed

- The site did not render properly because `.gitignore` excluded `node_modules`, which the site
  loads its vendor files from. Removed that entry ([#10], [#11]).

## [2.0.0] - 2021-12-28

### Changed

- Updated Bootstrap 4 to Bootstrap 5 ([#7]).

## [1.0.0] - 2021-07-03

### Added

- Initial release.

[Unreleased]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/5.1.0...HEAD
[5.1.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/5.0.0...5.1.0
[5.0.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/4.0.0...5.0.0
[4.0.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/3.0.0...4.0.0
[3.0.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/2.5.0...3.0.0
[2.5.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/2.0.2...2.5.0
[2.0.2]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/2.0.1...2.0.2
[2.0.1]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/2.0.0...2.0.1
[2.0.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/1.0.0...2.0.0
[1.0.0]: https://github.com/ValhallaTech/PortfolioPage-FS3/releases/tag/1.0.0
[#7]: https://github.com/ValhallaTech/PortfolioPage-FS3/issues/7
[#10]: https://github.com/ValhallaTech/PortfolioPage-FS3/issues/10
[#11]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/11
[#12]: https://github.com/ValhallaTech/PortfolioPage-FS3/issues/12
[#19]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/19
[#21]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/21
[#22]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/22
[#23]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/23
[#24]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/24
[#25]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/25
[#26]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/26
[#27]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/27
[#28]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/28
[#29]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/29
[#30]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/30
[#31]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/31
[#32]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/32
[#34]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/34
[#53]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/53
[#66]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/66
[#67]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/67
[#69]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/69
[#70]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/70
[#71]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/71
[#72]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/72
[#73]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/73
[#75]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/75
[#77]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/77
[#79]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/79
[#80]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/80
[#81]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/81
[#82]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/82
[#83]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/83
[#84]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/84
[#85]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/85
[#86]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/86
[#89]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/89
[#90]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/90
[#91]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/91
[#94]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/94
[#95]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/95
[#96]: https://github.com/ValhallaTech/PortfolioPage-FS3/pull/96

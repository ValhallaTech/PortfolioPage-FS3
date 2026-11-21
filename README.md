# PortfolioPage-FS3

[![Netlify Status](https://api.netlify.com/api/v1/badges/e94d35f3-bee7-49b4-b4d3-99678b8a98ec/deploy-status)](https://app.netlify.com/projects/fs3portfolio/deploys)

Personal portfolio website for Fred Smith III, built as a static single-page application and deployed on Netlify.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Background

The site is a single-page application (`src/index.html`) composed of six sections:

| Section | Description |
|---|---|
| **Hero** | Typing headline animated with GSAP: each phrase is typed once, and the effect stops on the last one. Screen readers, and visitors without JavaScript, get the whole headline as one sentence |
| **About** | Bio and personal details |
| **Portfolio** | Filterable image gallery (All / App / Card / Web) laid out by Muuri, with a GLightbox viewer |
| **Services** | Six service cards: Web Development, Mobile App Developer, Quality Assurance, C# Programming, .NET Core Framework Development, UI/UX Design |
| **Testimonials** | Swiper carousel with a pause/play button. Focus or a mouse over it holds rotation, and it never autoplays when the visitor asks for reduced motion |
| **Contact** | Contact details, a map, and a contact form in a native dialog, submitted to the Web3Forms API. Without JavaScript, a link opens the form as a panel, and a submission ends on `/thanks.html` |

The page follows the visitor's reduced motion setting everywhere, and follows it live, so changing it takes effect without a reload: the scroll reveals, the hero typing, in-page scrolling, the mobile nav, the portfolio caption links, the lightbox, the carousel and the portfolio grid all stop animating. An in-page link, such as a nav item, also moves keyboard focus to the section it scrolls to.

### Tech Stack

**Runtime libraries**

| Library | Purpose |
|---|---|
| Bootstrap 6 | Layout and the contact dialog, pinned to the prerelease `6.0.0-alpha.1` |
| Fontsource 5 (Open Sans, Raleway, Poppins) | Self-hosted web fonts, imported from `src/js/main.js` |
| Font Awesome Free 7.3.1 icon shapes | Inline SVG icon sprite in `src/index.html`, not an installed package (license notice kept in the sprite) |
| GSAP 3 | Hero entrance and typing, and the scroll-triggered reveals (GSAP core only, no plugins) |
| Muuri 0.9.5 | Portfolio filter and layout, patched by one line so layout runs synchronously, without web workers |
| Swiper 14 | Testimonials carousel |
| GLightbox 3 | Portfolio lightbox |

`package.json` pins every dependency to an exact version.

GSAP replaced two animation libraries in 5.1.0, and the page script grew by 20.7 KB: the built JavaScript went from 77,495 to 98,707 bytes gzipped (273,270 to 323,699 bytes raw), measured on clean builds of 5.0.0 and 5.1.0.

**Dev tooling**

| Tool | Purpose |
|---|---|
| Parcel 2 | Bundler (entries: `src/index.html` and `src/thanks.html`, output: `dist/`) |
| Yarn 4 | Package manager, at the version in the `packageManager` field of `package.json` (run through Corepack) |
| Node 26 | Runtime, at the exact version pinned in `.nvmrc` |
| Jest 30 + jsdom | Unit and acceptance tests; 80% coverage threshold on `src/js/utils.js` |
| Babel | Jest transform for the ES modules in `src/js` |
| Playwright 1 (Chromium) | End-to-end tests in `tests/e2e/`, including the smoke baseline |
| ESLint 10 flat config | Linting (`eslint.config.mjs`) |
| Prettier 3 | Code formatting |
| Renovate Bot | Automated dependency updates (`renovate.json`) |

### Supported browsers

The site supports Chrome and Edge 130 and later, Firefox 132 and later, and Safari 18 and later: the floor of the Bootstrap 6 release the site uses. Older browsers are not supported.

The build target is a separate setting: the Browserslist query `defaults, iOS >= 15`, set in the `browserslist` field of `package.json`. Change it there; Parcel reads it for both the CSS and the JS output.

- `defaults` is Browserslist's default set: browsers with more than 0.5% usage, the last two versions of each browser, and Firefox ESR, leaving out browsers without updates for 24 months.
- `iOS >= 15` adds Safari on iOS 15 and later. Without it, Lightning CSS (Parcel's CSS transformer) keeps range-syntax media queries such as `@media (width>=1280px)`, which iOS Safari before 16.4 cannot parse, so those browsers lose every breakpoint. The iOS 15 floor makes it emit `min-width`/`max-width` instead, and it also flattens the nested CSS in Swiper's stylesheet.

### Key files

```text
src/
  index.html            # Main HTML entry point, with the inline SVG icon sprite
  thanks.html           # Page a contact-form submission without JavaScript ends on
  js/
    main.js             # App initialization (GSAP motion, Muuri, Swiper, GLightbox, Bootstrap dialog, contact form)
    motion.js           # Every GSAP call: hero entrance and typing, scroll reveals, reduced motion
    utils.js            # DOM helpers (nav, scroll, back-to-top, portfolio filters, hash and lightbox links)
  css/
    style.css           # Site styles and color tokens
    thanks.css          # Styles for thanks.html
  images/               # Favicons, plus hero, portfolio, profile and testimonials images (AVIF, WebP and JPEG variants)
__tests__/              # Jest tests: unit tests, acceptance/ (run by yarn test) and release/ (run by yarn verify:release)
tests/e2e/              # Playwright end-to-end tests and the smoke baseline
scripts/                # Gate runners, local dist server, runtime-version sync and third-party notices
third-party-licenses/   # License terms for the notices, for a dependency whose package ships none (GSAP)
netlify.toml            # Netlify build, security headers and cache rules
playwright.config.js    # Playwright setup: Chromium only, local or live target
jest.config.js          # Jest setup for yarn test
jest.release.config.js  # Jest setup for yarn verify:release
```

## Install

### Dependencies

- [Node.js](https://nodejs.org/) 26, at the exact version pinned in `.nvmrc` (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match it)
- [Corepack](https://github.com/nodejs/corepack), installed with npm as shown below: Corepack is bundled only with Node.js 14.19 through 24.x, so Node 26 does not include it
- [Docker](https://www.docker.com/), only for `yarn gate:linux` and some release checks
- [GitHub CLI](https://cli.github.com/) (`gh`), signed in, only for the release checks

`package.json` pins Yarn 4 via the `packageManager` field. The system-default Yarn 1.x will reject this; **Corepack must be enabled first**.

```bash
# Switch to the pinned Node version (if using nvm)
nvm use

# Install Corepack, which Node 26 does not bundle
npm install -g corepack@0.36.0

# Enable Corepack so Node delegates to the pinned Yarn version
corepack enable

# Install dependencies
yarn install
```

## Usage

### CLI

```bash
# Start the Parcel development server
yarn start

# Production build → dist/ (no source maps), then write dist/THIRD-PARTY-NOTICES.txt
yarn build

# Run the Jest unit and acceptance tests with coverage
yarn test

# Run the Jest tests as CI does (--ci: a missing snapshot fails instead of being written)
yarn test:ci

# Lint src/js, __tests__, tests and scripts
yarn lint

# Auto-fix lint issues
yarn lint:fix

# Format src/js, src/css, __tests__, tests and scripts with Prettier
yarn format

# Check formatting without writing changes
yarn format:check
```

The `build` script in `package.json` starts with `PARCEL_WORKER_BACKEND=process`, which makes Parcel run its workers as child processes instead of worker threads. Keep it. With worker threads, about 6% of cold-cache builds on Windows crashed on exit (0xC0000005), because Node unloads Lightning CSS while worker threads still use it ([parcel-bundler/parcel#7603](https://github.com/parcel-bundler/parcel/issues/7603)). With workers as processes, 0 of 50 cold builds crashed.

### End-to-end tests

The Playwright tests run in Chromium. Without `BASE_URL`, they run against `dist/`, served on `http://127.0.0.1:4173` by `scripts/serve-dist.mjs` with the same response headers as `netlify.toml`, so build first.

```bash
# Download the Playwright Chromium build (once)
yarn playwright install chromium

# Smoke baseline: every Playwright test not tagged @slow, against the local build
yarn build
yarn test:smoke

# Only the @slow tests (carousel and motion timing), against the local build
yarn test:e2e:slow

# Only the @live tests, against the production site
yarn test:e2e:live
```

### Gate

The gate runs the six commands CI runs, in order, and stops at the first failure: `yarn install --immutable`, `yarn lint`, `yarn format:check`, `yarn test:ci`, `yarn build` and `yarn test:smoke`. It ends with an evidence block that names the commit and each exit code.

```bash
# Run the gate in this working tree
yarn gate

# Run the gate in a Linux Docker container, on a fresh clone of origin at the pushed HEAD
yarn gate:linux
```

`yarn gate` needs a clean working tree (it exits 65 otherwise) and Yarn through Corepack at the `packageManager` version (it exits 69 otherwise). `yarn gate:linux` also needs Docker, and `HEAD` pushed to its upstream branch. It uses the image `node:<.nvmrc major>-bookworm` and mounts nothing from the working tree.

### Release checks

The release suite (`__tests__/release/`) checks things the gate cannot: live headers, links, the GitHub ruleset, the release tag and a fresh-clone install. It needs network access, and some tests need `gh` or Docker. It is never a gate step.

```bash
# Run every release check
yarn verify:release

# Run the release test files whose path matches a pattern
yarn verify:release readme-links
```

### Deployment

The site is deployed on **Netlify** at <https://fs3portfolio.netlify.app>.

| Setting | Value |
|---|---|
| Build command | `yarn build` |
| Publish directory | `dist/` |
| Node version | Pinned in `.nvmrc` |
| Yarn version | `packageManager` field of `package.json` |

Node is pinned in `.nvmrc` and in `NODE_VERSION` under `[build.environment]` in `netlify.toml`, and Yarn comes from the `packageManager` field of `package.json`. `netlify.toml` also sets the response headers: a report-only Content Security Policy, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, framing and content-type protection, and long-lived caching for content-hashed assets.

### CI

This repository uses two GitHub Actions workflows:

- **`ci.yml`** (`Test & Build`) runs on every pull request to `main` and on every push to `main`. It sets up Node from `.nvmrc`, installs and enables Corepack, runs `yarn install --immutable`, ESLint, the Prettier check, Jest and the Parcel build, then installs Playwright Chromium and runs the smoke tests.
- **`sync-runtime-versions.yml`** runs weekly (and can also be triggered manually). It runs `scripts/sync-runtime-versions.mjs`, which moves `.nvmrc`, `NODE_VERSION` in `netlify.toml` and `packageManager` in `package.json` to the newest release of their current majors. When a pin changes, it opens a draft pull request to merge.

Renovate opens dependency update pull requests. Automerge is paused, and Bootstrap updates get their own group so a prerelease cannot ride along with other updates.

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

- [Open an issue](https://github.com/ValhallaTech/PortfolioPage-FS3/issues) with the bug report or feature request form.
- Follow [Conventional Commits](https://www.conventionalcommits.org) for commit messages.
- CI (`Test & Build`: lint, format, tests, build and smoke tests) runs on every pull request, and it should pass. Run `yarn gate` locally to check the same commands. The `Test & Build` ruleset that will make the check required exists, but its enforcement waits until GitHub Actions billing is restored.
- See the org-wide [CONTRIBUTING.md](https://github.com/ValhallaTech/.github/blob/main/CONTRIBUTING.md) for the full contribution guide.
- See the org-wide [Code of Conduct](https://github.com/ValhallaTech/.github/blob/main/CODE_OF_CONDUCT.md).

## License

[GNU General Public License v3.0 only](LICENSE) (`GPL-3.0-only`) © Valhalla Tech

Valhalla Tech, the copyright holder, grants the following additional permission.

### Additional permission under GNU GPL version 3 section 7

If you modify this Program, or any covered work, by linking or combining it with GSAP (or a modified version of that library), containing parts covered by the terms of [GSAP's Standard "no charge" license](https://gsap.com/standard-license), the licensors of this Program grant you additional permission to convey the resulting work.

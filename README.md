# PortfolioPage-FS3

[![Netlify Status](https://api.netlify.com/api/v1/badges/7d62d7f0-91f1-4c8f-94dd-b4ab456be91e/deploy-status)](https://app.netlify.com/sites/fs3-portfolio/deploys)

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
| **Hero** | Animated typing headline powered by Typed.js |
| **About** | Bio, personal details, and animated skills progress bars |
| **Portfolio** | Filterable image gallery (App / Card / Web) with a lightbox viewer |
| **Services** | Six service cards: Web Development, Mobile App Developer, Quality Assurance, C# Programming, .NET Core Framework Development, UI/UX Design |
| **Testimonials** | Auto-playing carousel |
| **Contact** | Modal contact form submitted via the Web3Forms API |

### Tech Stack

**Runtime libraries**

| Library | Purpose |
|---|---|
| Bootstrap 5 | Layout and modal |
| Font Awesome 7 | Icons |
| Boxicons | Additional icons |
| Typed.js `^3.0.0` | Hero typing animation |
| ScrollReveal `^4.0.9` | Scroll-triggered reveal animations |
| Isotope Layout `^3.0.6` | Portfolio filter/sort |
| Swiper `^12` | Testimonials carousel |
| GLightbox `^3.3.1` | Portfolio lightbox |
| just-validate `^4.3.0` | Contact form validation |

**Dev tooling**

| Tool | Purpose |
|---|---|
| Parcel v2 | Bundler (entry: `src/index.html`, output: `dist/`) |
| Yarn 4.14.1 | Package manager (via Corepack) |
| Node 24.15.0 | Runtime (pinned in `.nvmrc`) |
| Jest 30 + jsdom | Unit tests with 80 % coverage threshold |
| ESLint 9 flat config | Linting (`eslint.config.mjs`) |
| Prettier | Code formatting |
| Renovate Bot | Automated dependency updates |

### Key files

```
src/
  index.html          # Single-page HTML entry point
  js/
    main.js           # App initialisation (Typed, Isotope, Swiper, GLightbox, ScrollReveal, contact form)
    utils.js          # Utility functions (nav, scroll, skill animation, etc.)
  css/
    style.css         # Custom styles
  images/             # Profile photo, portfolio images, favicons
__tests__/            # Jest unit tests
netlify.toml          # Netlify build + security headers + cache config
```

## Install

### Dependencies

- [Node.js](https://nodejs.org/) 26, at the exact version pinned in `.nvmrc` (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to match it)
- [Corepack](https://nodejs.org/api/corepack.html), installed with npm as shown below: Corepack is bundled only with Node.js 14.19 through 24.x, so Node 26 does not include it

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

# Production build → dist/
yarn build

# Run tests with coverage
yarn test

# Run tests in CI mode (no watch, strict coverage)
yarn test:ci

# Lint src/js and __tests__
yarn lint

# Auto-fix lint issues
yarn lint:fix

# Format src/js and __tests__ with Prettier
yarn format

# Check formatting without writing changes
yarn format:check
```

### Deployment

The site is deployed on **Netlify** at <https://fs3-portfolio.netlify.app>.

| Setting | Value |
|---|---|
| Build command | `yarn build` |
| Publish directory | `dist/` |
| Node version | Pinned in `.nvmrc` |
| Yarn version | `packageManager` field of `package.json` |

Node is pinned in `.nvmrc` and in `NODE_VERSION` under `[build.environment]` in `netlify.toml`, Yarn comes from the `packageManager` field of `package.json`, and the `sync-runtime-versions` scheduled workflow keeps them aligned.

### CI

This repository uses two GitHub Actions workflows:

- **`ci.yml`** — runs on every push and pull request to `main`, installing Corepack, enabling it, installing dependencies, then running ESLint, Prettier check, Jest, and Parcel build, installing Playwright Chromium, and running the smoke tests in sequence.
- **`sync-runtime-versions.yml`** — runs weekly (and can also be triggered manually) to sync the Node and Yarn versions across `package.json`, `.nvmrc`, and `netlify.toml`, then opens a pull request when versions drift.

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

- [Open an issue](../../issues)
- Follow [Conventional Commits](https://www.conventionalcommits.org) for commit messages.
- All CI checks (lint, format, tests, build) must pass before a PR can be merged.
- See the org-wide [CONTRIBUTING.md](https://github.com/ValhallaTech/.github/blob/main/CONTRIBUTING.md) for the full contribution guide.

## License

[GNU General Public License v3.0](LICENSE) © Fred Smith III

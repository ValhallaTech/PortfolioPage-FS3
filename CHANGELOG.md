# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Every responsive breakpoint was ignored by iOS Safari before 16.4, which cannot parse the
  range-syntax media queries (`@media (width>=1200px)`) that the build emitted with no browser
  targets set. `package.json` now sets `"browserslist": "defaults, iOS >= 15"`, so the CSS uses
  `min-width` and `max-width` queries, and Swiper's nested CSS rules are flattened for browsers
  that ignored them (Chrome before 120, iOS Safari before 17.2).

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

[Unreleased]: https://github.com/ValhallaTech/PortfolioPage-FS3/compare/3.0.0...HEAD
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

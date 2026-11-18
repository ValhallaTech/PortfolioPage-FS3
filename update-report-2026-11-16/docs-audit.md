# Documentation audit: ValhallaTech/PortfolioPage-FS3

Audit date: 2026-11-16. Mode: **Analyze only**. No repo file was edited. Every probe was read-only.
Repo state: `main` at `1dc41e6`, with one untracked file (`.serena/.gitignore`).

Scope: `README.md`, `LICENSE`, `.github/ISSUE_TEMPLATE/*`, and in-code comments that make factual claims about the project.

---

## 1. Stale-docs check (real output)

Command (exit 0):

```
pwsh -NoProfile -NonInteractive -File "$HOME/.claude/skills/stale-docs/scripts/Get-StaleDoc.ps1" -RepoPath "C:/Repo/PortfolioPage-FS3" -AsJson
```

| DocPath | ReferencePath | Doc last commit | Ref last commit | Commits since doc | Decision |
|---|---|---|---|---|---|
| README.md | package.json | 2026-04-28 | 2026-09-28 | 26 | **Doc wrong.** Swiper went `^12.1.3` to `14.3.0`, every range became an exact pin (from `2af8d1c`, 2026-05-28), and Yarn went to `4.18.1`. See rows R1, R3 and R4. |
| README.md | netlify.toml | 2026-04-28 | 2026-06-23 | 3 | **Doc wrong.** `NODE_VERSION` is now `25.9.0` and `YARN_VERSION` is `4.17.0`. See R1, R2 and R13. |
| README.md | .nvmrc | 2026-04-28 | 2026-05-28 | 2 | **Doc wrong.** `.nvmrc` went `24.15.0` to `26.2.0` (`9ae572c`), then to `25.9.0` (`c58e26d`). See R1. |

The README was last committed on 2026-04-28 (`6479c17`, "docs(readme): rewrite README with full Standard Readme spec coverage (#33)"). Three rows came back, and each one is real drift. The check cannot see drift in prose that names no file. That is how the "skills progress bars" claim (R6) got through: it was already false when it was written, because the `src/index.html` at `6479c17` has no skills section. `git log -S'class="skills'` on `src/index.html` returns nothing, so the section never existed in this repo's history.

---

## 2. Stale and false claims: claim, truth, location, fix

| # | Claim (file:line) | What is true (evidence) | Proposed fix |
|---|---|---|---|
| R1 | Node `24.15.0`: README.md:50, :75, :129 | `.nvmrc:1` = `25.9.0`. `netlify.toml:17` `NODE_VERSION = "25.9.0"`. | Stop hardcoding the version. Say "the version in `.nvmrc`" at :50, :75 and :129 so the doc cannot drift again. If a number must appear, use `25.9.0`. |
| R2 | Yarn `4.14.1`: README.md:49, :130 | `package.json:43` `"packageManager": "yarn@4.18.1"`. `netlify.toml:18` `YARN_VERSION = "4.17.0"`. The two config files also disagree with each other (R13). | Say "the version in `package.json` `packageManager`" without a number. At :130, point to `netlify.toml` and do not restate the value. |
| R3 | Swiper `^12`: README.md:40 | `package.json:28` `"swiper": "14.3.0"`. | `Swiper 14` |
| R4 | Caret ranges `^3.0.0`, `^4.0.9`, `^3.0.6`, `^3.3.1`, `^4.3.0`: README.md:37–42 | Every runtime dependency is pinned exactly (`package.json:18–29`). The carets matched `package.json` when the README was written and were dropped on 2026-05-28. | Show major versions only (`Typed.js 3`, `ScrollReveal 4`, and so on), the way rows :34–36 already do. Exact pins belong to `package.json`. |
| R5 | "ESLint 9 flat config": README.md:52 | `package.json:33` `"eslint": "latest"`, and `yarn.lock:3487` resolves to **10.2.0**. Prettier also floats on `latest` (3.8.3 in the lock). | `ESLint (flat config)`, with no major. Separate code finding for the language specialist: `latest` on five devDependencies (`package.json:32–41`) means a lock refresh can change a major silently. |
| R6 | About has "animated skills progress bars": README.md:22 | `src/index.html:102–140` has no skills markup. `rg 'skill' src/index.html` finds only prose at :353. `main.js:289–290` queries `.skills-content`, gets `null`, and `observeSkills` returns early (`utils.js:97`). The CSS for it is dead too (`style.css:476–510`). | `Bio and personal details`. Code finding for the JS specialist: `observeSkills` and its call are dead on this page. Either remove them with the CSS and tests, or add the section. |
| R7 | Key files: `main.js` "App initialisation (Typed, Isotope, Swiper, GLightbox, ScrollReveal, contact form)": README.md:62 | The list is accurate (`main.js:39, 58, 79, 102, 119, 143`), but "initialisation" is UK spelling. It also leaves out Bootstrap `Modal`, which `main.js:12, 214` uses. | `App initialization (Typed.js, Isotope, Swiper, GLightbox, ScrollReveal, Bootstrap modal, contact form)` |
| R8 | Key files: `utils.js` "(nav, scroll, skill animation, etc.)": README.md:63 | `observeSkills` exists (`utils.js:96`), but it animates nothing on the page (R6). | `Pure DOM helpers (nav, smooth scroll, back-to-top, portfolio filters)`. Remove "skill animation" once the code owner settles R6. |
| R9 | "Boxicons: Additional icons": README.md:36 | `boxicons` is a dependency (`package.json:22`), but nothing loads or uses it. `rg -i 'boxicons\|\bbx\b\|bx-' src` finds no matches, and `main.js` imports only Font Awesome CSS (:18–20). | Remove the row. Code finding: the dependency is unused and can be dropped from `package.json`. |
| R10 | "just-validate: Contact form validation": README.md:42 | `just-validate` is a dependency (`package.json:25`), but nothing imports it. `rg -i 'just-validate\|justvalidate' src __tests__` finds no matches. The form relies on the browser and Web3Forms (`main.js:143–237`). | Remove the row, or rename it to "Contact form: native HTML5 validation + Web3Forms". Code finding: the dependency is unused. |
| R11 | "Jest 30 + jsdom: Unit tests with 80 % coverage threshold": README.md:51 | The threshold is 80 for all four metrics (`jest.config.js:9–15`), but coverage is collected only from `src/js/utils.js` (`jest.config.js:8`). `main.js` is not measured. "80 %" has a space that US style drops. | `Unit tests; 80% coverage threshold on src/js/utils.js` |
| R12 | `yarn test:ci` "(no watch, strict coverage)": README.md:105 | `test` is `jest --coverage` and `test:ci` is `jest --coverage --ci` (`package.json:10–11`). Neither one watches, and both use the same threshold. `--ci` only changes snapshot handling: a missing snapshot fails instead of being written. | `# Run tests as CI does (--ci: missing snapshots fail instead of being written)` |
| R13 | "kept in sync automatically via the `sync-runtime-versions` scheduled workflow": README.md:132 | Versions have drifted: Yarn is `4.18.1` in `package.json` and `4.17.0` in `netlify.toml`. The sync PR #56 has been open since 2026-07-13 (its diff now changes only `YARN_VERSION 4.17.0 → 4.18.1`), and every Actions job fails at start because of the account billing lock. There is also a **workflow defect**: `sync-runtime-versions.yml:120–122` throws whenever the `netlify.toml` replacement changes nothing. When only `package.json` or `.nvmrc` drift, or nothing drifts, the job fails instead of exiting quietly. | Replace with: "`sync-runtime-versions.yml` opens a PR when the pins drift; Renovate updates `packageManager` separately, so merge the sync PR to keep `netlify.toml` aligned." The workflow defect and the drift go to the CI/CD Pipeline Engineer (see §5). |
| R14 | "All CI checks (lint, format, tests, build) must pass before a PR can be merged.": README.md:147 | **False.** `main` has no branch protection (`gh api …/branches/main/protection` returns 404). The active "General Ruleset" requires a PR, CodeQL code scanning and code quality, but **no required status checks**. PR #67 merged on 2026-09-28 with `Test & Build: FAILURE` and failed Netlify checks. | Either the repo owner adds `Test & Build` as a required status check (CI/CD Pipeline Engineer), or the README says: "CI (lint, format, tests, build) runs on every PR; please make sure it passes." Today only the second is true. |
| R15 | Live site `https://fs3-portfolio.netlify.app`: README.md:123 | That URL returns **404**. `https://fs3portfolio.netlify.app` (no hyphen) returns 200 and matches the GitHub homepage field and the Netlify check names (`netlify/fs3portfolio/deploy-preview`). | `<https://fs3portfolio.netlify.app>` |
| R16 | Netlify badge: README.md:3 | The badge image `api.netlify.com/api/v1/badges/7d62d7f0-…/deploy-status` returns **404**, so it renders broken. The badge link (`app.netlify.com/sites/fs3-portfolio/deploys`) points at the hyphenated site name, which no longer matches the live site (`fs3portfolio`). The 200 that `app.netlify.com` returns is a single-page-app shell and proves nothing. | Copy the current badge snippet from Netlify (Site configuration, then Status badges) for site `fs3portfolio`. Until then, remove the badge rather than show a broken image. |
| R17 | Corepack "ships with Node.js `16.9+`": README.md:76, with `corepack enable` at :82 | Corepack is bundled with Node **14.19.0 up to (not including) 25.0.0** (nodejs/corepack README). Node v25.0.0 release notes list "build: stop distributing Corepack (#57617)" as SEMVER-MAJOR. The pinned Node `25.9.0` therefore ships **without** Corepack, so `corepack enable` (:82) fails with command not found, as observed locally on Node v26.13.1. `https://nodejs.org/api/corepack.html` now redirects to the GitHub repo. | Replace the line with: "Corepack: bundled with Node.js 14.19–24.x; on Node 25+ install it first with `npm install -g corepack`." Add that command to the :80–89 block before `corepack enable`. Update the :75 link to `https://github.com/nodejs/corepack`. |
| R18 | CI enables Corepack: README.md:138, `ci.yml:25–26` | On the last green run (36084883610, 2026-09-25), `corepack enable` worked on Node `v25.9.0` and fetched Yarn 4.18.1. The `corepack` binary cannot have come from the Node 25 distribution. `actions/setup-node` (v7) has no Corepack input, so it most likely came from the runner image's preinstalled tooling. **Inferred, not verified.** The step works only because of the image. | No README change. CI/CD finding: add `npm install -g corepack` before `corepack enable` in `ci.yml` so CI does not depend on the image. |
| R19 | Short description: README.md:5 | 113 characters (passes the 120 limit), but it does not match the GitHub description ("IT/Developer portfolio for Fred Smith."), which Standard Readme requires. | Fred chooses one text, and both places carry it. |
| R20 | Key files tree: README.md:58–69 | Every listed path is tracked (`git ls-files --error-unmatch`, exit 0). The tree omits `src/images/testimonials/` and the tracked but **unreferenced** `src/css/icofont.min.css`, `icofont.woff` and `icofont.woff2`. `rg icofont` outside the file itself finds only `.prettierignore:7`. The fence has no language tag (markdownlint MD040). | Use ```` ```text ````. Add `testimonials` to the `images/` comment. Code finding: the icofont files are dead weight; the JS specialist removes them, or the README lists them. |
| R21 | Contributing links: README.md:145 `[Open an issue](../../issues)` | This relative link resolves only on github.com. It would fail `lychee --offline`. | `https://github.com/ValhallaTech/PortfolioPage-FS3/issues` |
| R22 | Contributing section: README.md:141–148 | Links to the org CONTRIBUTING.md (verified to exist). It does not link the org CODE_OF_CONDUCT.md, which exists at `ValhallaTech/.github/CODE_OF_CONDUCT.md`. | Add: `- See the org-wide [Code of Conduct](https://github.com/ValhallaTech/.github/blob/main/CODE_OF_CONDUCT.md).` |
| R23 | License: README.md:152 "GNU General Public License v3.0 © Fred Smith III" | `LICENSE` is the unmodified GPL-3.0 text (674 lines). GitHub detects `gpl-3.0`. Two conflicts: **(a)** `src/css/style.css:1–6` carries "Template Name: iPortfolio - v1.4.0 … Author: BootstrapMade.com … License: https://bootstrapmade.com/license/". BootstrapMade's free license says "You must keep the footer credit line as is", but the footer (`index.html:458–460`) reads "Designed by Fred Smith" and has no BootstrapMade credit. Unless a Pro license was bought, the GPL claim over the whole repo and the removed credit are a **licensing discrepancy I cannot resolve**. **(b)** The copyright holder is "Fred Smith III" in the README and "Valhalla Tech" in the footer (`index.html:456`). The README also gives no SPDX identifier (`GPL-3.0-only` or `-or-later`), and `package.json` has no `license` field. | Fred decides (see §6). After that: state the SPDX id. Add a Thanks section (Standard Readme optional, before Contributing) crediting the BootstrapMade iPortfolio template and its license. Restore the footer credit if the free license applies. Pick one copyright holder. |
| C1 | `src/js/main.js:2` "Template Name: iPortfolio - v2.0.0" | The upstream template version is **v1.4.0** (`style.css:2`). `2.0.0` matches `package.json:3` `"version": "2.0.0"`, which is itself stale: the latest tag and release is **3.0.0** (2026-04-20). The comment reads as an upstream version that never existed. | JS specialist (in-code prose, not mine): `Based on the BootstrapMade iPortfolio template v1.4.0 (https://bootstrapmade.com/license/)`. Separate code finding: `package.json` version vs tag 3.0.0. |
| C2 | `main.js:117` and `:302` "replaces AOS"; `:288` "replaces waypoints"; `:296` "replaces venobox"; `:299` "Swiper replaces owl.carousel"; `:3` "Overhauled: jQuery removed" | These are true as **history** (they describe the jQuery-era iPortfolio), but they describe what used to be there, not the code. `:288` also comments a feature that does not exist (R6). | JS specialist: drop the "replaces X" clauses. That history belongs in a CHANGELOG entry (see §4). |
| C3 | `utils.js:92` "Animate skill progress bars" | True of the function, but nothing on the page uses it (R6). | Resolved with R6. |
| T1 | `.github/ISSUE_TEMPLATE/issue-ticket-template.md` | Wrong fit for a personal portfolio. :2 `name: issue-ticket-template` is a slug, not a label. :10 mixes bug and feature in one form. :31–33 "internal vs customer feedback", with **Internal pre-checked** (`[x]`). :35–40 effort in sprints. :42–49 "~% of customers affected". :51–56 "Yesterday … This year". Numbering is inconsistent (:14 ` 1.` is indented, :21 `2.` is not). `config.yml:1` `blank_issues_enabled: false` makes this the only way to file an issue. The org `.github` repo has no ISSUE_TEMPLATE to inherit. | Replace with two YAML issue forms: **Bug report** (what happened, expected behavior, browser and device, URL/section) and **Feature request** (idea, why). Drop the customer, effort and timing fields. Keep `blank_issues_enabled: false` only if the forms cover every case. These are repo config, not one of my owned files, so Fred approves this before anyone writes it. |

---

## 3. CI dependency of README claims

GitHub Actions jobs have failed in 2–6 s since about 2026-10, with "account is locked due to a billing issue" (orchestrator observation, run 43925447698). The last green CI run was 36084883610 on 2026-09-25. Today:

- README.md:132 (sync "automatically"), :138–139 (workflow behavior) and :147 (CI gates merges) describe automation that is not running.
- :138–139 describe the workflow files correctly (`ci.yml:3–7, 25–41`; `sync-runtime-versions.yml:3–7, 125–137`). I did not flag them as wrong.
- :147 is false whether or not billing is fixed (R14).
- The Netlify deploy-preview checks also fail on PR #67 (merged) and PR #56. I did not check why, so this is **not run**. If production builds fail too, the live site is behind `main`. Hand this to the CI/CD Pipeline Engineer with R13 and R18.

---

## 4. Missing files (org conventions)

| File | Present | Should it exist? |
|---|---|---|
| `README.md` | Yes | Compliant in structure. Required sections are present and in order: Title, Badges, Short description, ToC (needed: 153 lines > 100), Background, Install, Usage, Contributing, License. The ToC is accurate. Content defects are listed above. |
| `CHANGELOG.md` | No | **Yes.** The repo has six tags and releases (1.0.0 to 3.0.0, latest 2026-04-20), a deployed site, and user-visible changes (jQuery removal, library swaps, the proposed GSAP migration). Org convention requires Keep a Changelog. Seed it with `[Unreleased]` and backfill `[3.0.0] - 2026-04-20` (and earlier) from the GitHub release notes. This is mine to write once Fred approves. |
| `CONTRIBUTING.md` (repo) | No | **No.** The org file applies (`ValhallaTech/.github/CONTRIBUTING.md`, verified), and nothing in this repo needs an override. |
| `CODE_OF_CONDUCT.md` (repo) | No | **No.** The org file applies (verified). Link it from the README (R22). |
| `/docs` | No | **No.** A single-page static site with two JS files. The README's Background and Key files sections are the right home. |

---

## 5. Findings routed to other owners (not documentation)

| Finding | Owner | Severity |
|---|---|---|
| `sync-runtime-versions.yml:120–122` throws when `netlify.toml` needs no change, so the weekly job fails whenever only `package.json` or `.nvmrc` drift, or nothing drifts. | CI/CD Pipeline Engineer | Medium (the workflow cannot keep the promise its own README line makes) |
| `ci.yml:25–26` `corepack enable` on Node 25+ depends on the runner image (R18). | CI/CD Pipeline Engineer | Medium |
| `Test & Build` is not a required check; #67 merged red (R14). | CI/CD Pipeline Engineer / repo owner | Medium |
| `netlify.toml:18` `YARN_VERSION 4.17.0` vs `packageManager yarn@4.18.1`. PR #56 fixes it. | CI/CD Pipeline Engineer (merge #56) | Low |
| Unused dependencies `boxicons` and `just-validate`; unreferenced `src/css/icofont.*`; dead `observeSkills` and `.skills` CSS. | JavaScript/Web specialist | Low |
| `package.json` `version: 2.0.0` vs tag 3.0.0; devDependencies on `latest`. | JavaScript/Web specialist | Low |
| `main.js:2` template version comment (C1) and "replaces X" comments (C2). | JavaScript/Web specialist (in-code prose) | Nit |
| BootstrapMade footer credit removed vs free-license terms (R23a). | Fred (license decision) | Medium (compliance). A decision for Fred, not a code fix. |

---

## 6. Decisions only Fred can make

1. **License provenance (R23).** Was a BootstrapMade Pro license bought for iPortfolio? If not, the free license requires the footer credit, and the README should say the site is derived from that template. Also choose `GPL-3.0-only` or `GPL-3.0-or-later`, and one copyright holder (Fred Smith III or Valhalla Tech).
2. **Short description (R19).** Which text goes in both the GitHub description and README.md:5.
3. **Issue template (T1).** Whether to replace it with two issue forms.

---

## 7. GSAP migration: README lines that would change

If GSAP replaces Typed.js and ScrollReveal:

| Line | Current | Change |
|---|---|---|
| README.md:21 | "Animated typing headline powered by Typed.js" | "…powered by GSAP (TextPlugin)", or whichever plugin is chosen |
| README.md:22 | "animated skills progress bars" | Already false (R6). If the bars are rebuilt with GSAP ScrollTrigger, describe that instead. |
| README.md:37 | Typed.js row | Remove |
| README.md:38 | ScrollReveal row | Remove |
| (new row near :37) | — | `GSAP 3 (+ plugins used) \| Hero typing and scroll-triggered animations` |
| README.md:62 | main.js init list names Typed and ScrollReveal | Replace with GSAP |
| README.md:63 | utils "skill animation" | Update if `observeSkills` is replaced by ScrollTrigger |
| README.md:150–152 (License) | — | GSAP ships under the "Standard 'No Charge' GSAP License" (gsap.com/standard-license). It is free for website use including plugins, but it is **not** an OSI license and Webflow keeps the IP. Note that in the README (Thanks or Tech Stack), and have Fred confirm that bundling it fits the repo's GPL-3.0 claim. |
| CHANGELOG.md (new) | — | `### Changed`: animations migrated to GSAP. `### Removed`: Typed.js, ScrollReveal. |
| In-code | `main.js:6–7, 34–51, 116–138, 302–303` | JS specialist's change. Remove the "replaces AOS" comments along with the code. |

---

## 8. Verification log

| Claim | Check | Result |
|---|---|---|
| Paths in Key files and Background (`src/index.html`, `src/js/main.js`, `src/js/utils.js`, `src/css/style.css`, `__tests__`, `netlify.toml`, `.nvmrc`, `eslint.config.mjs`, `LICENSE`, both workflows, `package.json`) | `git ls-files --error-unmatch …` | **verified** (exit 0). `src/images` has 24 tracked files. |
| `[LICENSE](LICENSE)` (README.md:152) | `git ls-files --error-unmatch LICENSE` | **verified** |
| `../../issues` (README.md:145) | `curl -L` of the github.com equivalent | **verified** on github.com only (200). It would fail off-GitHub (R21). |
| Org CONTRIBUTING.md (README.md:148) | `gh api repos/ValhallaTech/.github/contents/CONTRIBUTING.md` | **verified** |
| Org CODE_OF_CONDUCT.md | `gh api …/contents/CODE_OF_CONDUCT.md` | **verified** (exists, not linked) |
| conventionalcommits.org, nvm, fnm (README.md:75, :146) | `curl -s -o /dev/null -L -w '%{http_code}'` | **verified** (200) |
| nodejs.org/api/corepack.html (README.md:76) | same | **verified**, but it redirects to github.com/nodejs/corepack, so the target has moved (R17) |
| `https://fs3-portfolio.netlify.app` (README.md:123) | same | **failed** (404). `fs3portfolio.netlify.app` returns 200. |
| Netlify badge image (README.md:3) | same | **failed** (404) |
| Netlify badge link `app.netlify.com/sites/fs3-portfolio/deploys` | same | **not run** in any meaningful sense: the 200 is a single-page-app shell and does not prove the site exists |
| Corepack Node range | WebFetch nodejs.org/en/blog/release/v25.0.0 and github.com/nodejs/corepack | **verified**: removed in 25.0.0; bundled 14.19.0–<25.0.0 |
| `corepack` on local PATH | `command -v corepack` (Git Bash, Node v26.13.1) | absent, which confirms the orchestrator's observation |
| Yarn scripts `start`, `build`, `test`, `test:ci`, `lint`, `lint:fix`, `format`, `format:check` (README.md:96–118) | Read `package.json:8–16` | **verified** to exist. **Not run**: running `yarn` would need Corepack (absent) and an install. |
| `corepack enable`, `nvm use`, `yarn install` (README.md:82–88) | — | **not run** (install and environment-changing commands). `corepack enable` is expected to fail on the pinned Node (R17). |
| CI gates merges (README.md:147) | `gh api …/branches/main/protection`, `…/rulesets/15072163`, `gh pr view 67` | **failed** (R14) |
| Netlify deploy-preview failure cause | — | **not run** (out of doc scope; routed in §3) |
| Code examples lint | README has only bash and tree blocks, no JS | n/a |
| Markdown links overall | `lychee` | **not run**: `lychee` is not on PATH. Relative and external links were checked by hand as listed above. |

Tools: `rg`, `yq` and `gh` were used. The local check used Git Bash's `command -v`. `fd` was not needed.

## 9. Recommended per-repo checks (do not wire up here)

- **lychee** (`lychee --offline --include-fragments README.md` locally, plus a CI job for external links). It would have caught R15, R16 and R21. Owner: CI/CD Pipeline Engineer.
- **eslint-plugin-jsdoc** `check-param-names` for `src/js/*.js`, since both files carry JSDoc `@param` blocks. Owner: JavaScript/Web specialist.
- **markdownlint** (MD040 fenced-code language, among others). Owner: CI/CD Pipeline Engineer.

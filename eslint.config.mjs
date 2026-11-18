import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

const E2E_IMPORT_MESSAGE =
  'Import test and expect from tests/e2e/fixtures.js and use the configured browser, which block real Web3Forms submissions (C-18, AC-90).';

/** Matches @playwright/test, playwright/test, playwright and playwright-core. */
const PLAYWRIGHT_MODULE_PATTERN = '/^(@?playwright\\/test|playwright(-core)?)$/';

export default [
  js.configs.recommended,
  prettierConfig,
  prettierPlugin,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'prettier/prettier': 'error',
    },
  },
  {
    // Jest test files
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    // Playwright specs and helpers: `test` and `expect` come only from fixtures.js,
    // so every test gets the Web3Forms guard and the page-error guard (C-18, AC-90).
    // The extensions match Playwright's default testMatch, `**/*.@(spec|test).?(c|m)[jt]s?(x)`,
    // so every file Playwright can collect is linted. This config has no TypeScript or JSX
    // parser, so a .ts or JSX spec that uses that syntax fails lint with a parse error
    // instead of running unguarded.
    files: ['tests/e2e/**/*.{js,cjs,mjs,jsx,cjsx,mjsx,ts,cts,mts,tsx,ctsx,mtsx}'],
    ignores: ['tests/e2e/fixtures.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // `default` is the unguarded base test, the same object as the named `test`.
          // chromium, firefox and webkit launch a browser outside the configured one, which
          // skips playwright.config.js launchOptions and with it the Web3Forms host block.
          paths: [
            {
              name: '@playwright/test',
              importNames: ['default', 'test', 'expect', 'chromium', 'firefox', 'webkit'],
              message: E2E_IMPORT_MESSAGE,
            },
            {
              // @playwright/test only re-exports playwright/test, which is installed at the top
              // level, so the same unguarded test is importable under this name too.
              name: 'playwright/test',
              importNames: ['default', 'test', 'expect', 'chromium', 'firefox', 'webkit'],
              message: E2E_IMPORT_MESSAGE,
            },
            {
              // playwright and playwright-core are installed at the top level as dependencies of
              // @playwright/test, and export the same browser launchers.
              name: 'playwright',
              importNames: ['default', 'chromium', 'firefox', 'webkit'],
              message: E2E_IMPORT_MESSAGE,
            },
            {
              name: 'playwright-core',
              importNames: ['default', 'chromium', 'firefox', 'webkit'],
              message: E2E_IMPORT_MESSAGE,
            },
          ],
        },
      ],
      // no-restricted-imports does not see require() or import(), so block both forms here,
      // for every module named above.
      'no-restricted-syntax': [
        'error',
        {
          selector: `CallExpression[callee.name='require'][arguments.0.value=${PLAYWRIGHT_MODULE_PATTERN}]`,
          message: E2E_IMPORT_MESSAGE,
        },
        {
          selector: `ImportExpression[source.value=${PLAYWRIGHT_MODULE_PATTERN}]`,
          message: E2E_IMPORT_MESSAGE,
        },
      ],
    },
  },
  {
    // Node scripts: the gate and the dist server
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      '.parcel-cache/',
      'test-results/',
      'playwright-report/',
    ],
  },
];

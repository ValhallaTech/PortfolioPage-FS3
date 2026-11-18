import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

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
          paths: [
            {
              name: '@playwright/test',
              // `default` is the unguarded base test, the same object as the named `test`.
              importNames: ['default', 'test', 'expect'],
              message:
                'Import test and expect from tests/e2e/fixtures.js, which blocks real Web3Forms submissions (C-18, AC-90).',
            },
            {
              // @playwright/test only re-exports playwright/test, which is installed at the top
              // level, so the same unguarded test is importable under this name too.
              name: 'playwright/test',
              importNames: ['default', 'test', 'expect'],
              message:
                'Import test and expect from tests/e2e/fixtures.js, which blocks real Web3Forms submissions (C-18, AC-90).',
            },
          ],
        },
      ],
      // no-restricted-imports does not see require() or import(), so block both forms here,
      // for both @playwright/test and playwright/test.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/^@?playwright\\/test$/]",
          message:
            'Import test and expect from tests/e2e/fixtures.js, which blocks real Web3Forms submissions (C-18, AC-90).',
        },
        {
          selector: 'ImportExpression[source.value=/^@?playwright\\/test$/]',
          message:
            'Import test and expect from tests/e2e/fixtures.js, which blocks real Web3Forms submissions (C-18, AC-90).',
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

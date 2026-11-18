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
    files: ['tests/e2e/**/*.js'],
    ignores: ['tests/e2e/fixtures.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test', 'expect'],
              message:
                'Import test and expect from tests/e2e/fixtures.js, which blocks real Web3Forms submissions (C-18, AC-90).',
            },
          ],
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

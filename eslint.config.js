import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        document: 'readonly',
      },
    },
  },
  {
    files: ['src/galley-client.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'docs/'],
  },
];

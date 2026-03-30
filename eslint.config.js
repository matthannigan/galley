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
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        window: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
  {
    files: ['src/galley-client.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        document: 'readonly',
        window: 'readonly',
        XMLHttpRequest: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        prompt: 'readonly',
        decodeURIComponent: 'readonly',
        encodeURIComponent: 'readonly',
        JSON: 'readonly',
        Map: 'readonly',
        Sortable: 'readonly',
        navigator: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'docs/', 'mount/', 'src/vendor/'],
  },
];

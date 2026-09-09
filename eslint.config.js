// Flat config (ESLint 9, the default from Expo SDK 53 onward).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const reactHooks = require('eslint-plugin-react-hooks');
const react = require('eslint-plugin-react');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'scripts/fixtures/*', 'android/*', 'ios/*'],
  },
  {
    // Rule calibration. The bundled react-hooks plugin ships the newer
    // React Compiler-oriented rules; this app doesn't use the compiler.
    //   - refs / immutability: kept on (as warnings) — the codebase is now
    //     clean of both, so a warning here catches a regression.
    //   - set-state-in-effect: off. It flags the standard, correct pattern of
    //     re-initializing a modal's form state when it opens or its edited
    //     record changes (and async "fetch then setState" effects). The
    //     compiler-friendly alternatives (remount via `key`, derive-in-render)
    //     are per-call-site structural rewrites with no user-facing benefit.
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Node scripts and config files: CommonJS, Node globals.
    files: ['scripts/**/*.js', '*.config.js', 'jest.setup.ts'],
    languageOptions: {
      globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    // Test files legitimately call jest.mock() before their imports so the
    // mock is registered before the module under test is loaded.
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/test-support/**'],
    rules: {
      'import/first': 'off',
      // Tests use mid-body require() to re-import a module after a jest.mock or
      // to read fresh module state — legitimate in a test, not in app code.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

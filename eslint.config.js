// Flat config (ESLint 10).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const reactHooks = require('eslint-plugin-react-hooks');
const react = require('eslint-plugin-react');

// eslint-plugin-react and eslint-plugin-import (both pulled in by eslint-config-expo) still call context APIs that
// ESLint 10 removed (context.getFilename), which crashes linting. Wrapping every plugin with ESLint's own compat
// layer restores those calls. Each plugin is wrapped once, so a plugin registered in several config blocks stays one
// object. Remove this wrapper once those plugins release ESLint 10 support.
const { fixupPluginRules } = require('@eslint/compat');
const wrapped = new Map();
const compat = (plugin) => {
  if (!wrapped.has(plugin)) wrapped.set(plugin, fixupPluginRules(plugin));
  return wrapped.get(plugin);
};

const configs = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'android/*', 'ios/*', 'sites/**', 'design-preview/**'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**', 'src/test-support/**', 'src/perf/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // Rule calibration for the bundled react-hooks plugin, whose newer rules target the React Compiler (not used):
    // refs and immutability stay on as warnings; set-state-in-effect is off because re-initialising a form when
    // its sheet opens is the correct pattern here.
    plugins: { 'react-hooks': reactHooks, react },
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      // expo-notifications 58 re-exports its Android enums in a form this rule cannot follow, so it reports
      // existing members (AndroidImportance) as missing. The TypeScript compiler already rejects a namespace
      // member that does not exist, which makes this rule redundant here.
      'import/namespace': 'off',
    },
  },
  {
    // Node scripts and config files: CommonJS, Node globals.
    files: ['scripts/**/*.js', 'scripts/**/*.cjs', '*.config.js', 'jest.setup.ts'],
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

module.exports = configs.map((config) =>
  config.plugins
    ? {
        ...config,
        plugins: Object.fromEntries(
          Object.entries(config.plugins).map(([name, plugin]) => [name, compat(plugin)])
        ),
      }
    : config
);

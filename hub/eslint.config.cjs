// ESLint 10 flat config. Real linting of JS, TypeScript, React hooks and tests.
// No eslint-disable blanket, no test exclusion and no fake-success bypass.
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const reactHooks = require('eslint-plugin-react-hooks')
const cypress = require('eslint-plugin-cypress')
const globals = require('globals')

const source = ['src/**/*.{ts,tsx,js,jsx}', 'scripts/**/*.{js,cjs,mjs}', 'cypress/**/*.{js,jsx,ts,tsx}', '*.{js,cjs,mjs}']
const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  ...globals.jest,
  ...globals.mocha,
  ...globals.cypress,
}

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**', 'dist/**', 'build/**', 'coverage/**',
      'cypress/screenshots/**', 'cypress/videos/**', '**/*.min.js',
      'src/react-app-env.d.ts', '**/*.tsbuildinfo',
    ],
  },
  {
    files: source,
    languageOptions: {
      globals: sharedGlobals,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['**/*.{js,jsx,cjs,mjs}'],
    rules: js.configs.recommended.rules,
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // The NodeMCU flasher loads its native serial stack inside try/catch so a
    // missing addon cannot stop the Hub; pkg needs the literal require() to
    // bundle it. Only this module is allowed, nothing else.
    files: ['src/flasher/NodeMcuConnector.ts'],
    rules: { '@typescript-eslint/no-require-imports': ['error', { allow: ['^nodemcu-tool$'] }] },
  },
  {
    files: ['cypress/**/*.{js,jsx,ts,tsx}'],
    plugins: { cypress },
    rules: { 'cypress/no-assigning-return-values': 'error' },
  },
)

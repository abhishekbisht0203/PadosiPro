// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config.
 *
 * Deliberately small. The value of linting here is catching the things a
 * typechecker cannot — unused bindings, floating promises, accidental `any`,
 * hand-written promises inside a loop — not enforcing house style. Every rule
 * below is either a correctness rule or a plain bug catcher.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'android/**', 'ios/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Widen the project so the type-aware rules apply to the dev scripts and the
  // vitest config too, not just `src`.
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ['eslint.config.mjs'],
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Type-aware linting: the correctness rules below (floating promises,
        // misused promises, require-await) can only work with type information.
        // `tsconfig.eslint.json` widens the build's `include` to cover the dev
        // scripts and the vitest config, which ship outside `src`.
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Console output is how this service reports operational events (SMTP
      // failures, migration progress). The no-console rule is suppressed per
      // file where it is used deliberately instead of globally.
      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',

      // Correctness rules. Express handlers legitimately return a promise from
      // an async callback, and they all funnel errors into next(err), so the
      // misused-promises check is relaxed for callbacks only.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-empty-function': 'error',
    },
  },

  {
    // Test doubles are async purely to satisfy a callback signature, and scripts
    // legitimately fire-and-forget a top-level teardown.
    files: ['src/tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-console': 'off',
    },
  },
);

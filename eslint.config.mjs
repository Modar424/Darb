import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs', 'jest.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    files: ['src/database/seeds/**/*.ts', 'src/database/reset.ts', 'src/main.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);

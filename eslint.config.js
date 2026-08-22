import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Lint for the whole monorepo.
 *
 * The intent is narrow: to guard what `tsc` cannot and what can genuinely break
 * in this project - the hook rules, a forgotten `await`, a silent `any`. It is
 * not a style check; Prettier takes care of that.
 *
 * The type-aware rules need a real TS project. For the API that is
 * `tsconfig.check.json` - unlike `tsconfig.json` it also includes the tests, the
 * seed and `prisma.config.ts`, which could otherwise not be processed at all.
 *
 * `eslint-plugin-react-refresh` is deliberately absent: its only rule flags even
 * perfectly idiomatic files (the `useAuth` hook next to `AuthProvider`), so it
 * would have to be permanently disabled.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/api/prisma/generated/**',
    ],
  },

  js.configs.recommended,

  // --- @gameshelf/contracts ------------------------------------------------
  {
    files: ['packages/contracts/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./packages/contracts/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // --- @gameshelf/api ------------------------------------------------------
  {
    files: ['apps/api/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ['./apps/api/tsconfig.check.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * `@Module({})`, `@Injectable()` - Nest builds the application out of
       * classes that either contain nothing themselves or have only a
       * constructor with DI parameters.
       */
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // --- @gameshelf/web ------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ['./apps/web/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // --- plain JS: tool configuration and the theme script -------------------
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // --- tests ---------------------------------------------------------------
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // The tests touch supertest's untyped response body and stubs.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);

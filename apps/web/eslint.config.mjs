import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Reforçados — protegem contra a classe de bugs que motivou esta config.
      '@typescript-eslint/no-floating-promises': [
        'error',
        { ignoreVoid: true, ignoreIIFE: true },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='navigator'][object.property.name='clipboard']",
          message:
            "Use o helper copyText() de '@/lib/clipboard' em vez de navigator.clipboard direto — ele captura rejeições do browser quando a aba está sem foco ou contexto inseguro.",
        },
      ],

      // Tech-debt pré-existente — emitido como warning até ser limpo.
      // Promova de volta a error caso a caso conforme for resolvendo.
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },

  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'src/_archive/**'],
  },
);

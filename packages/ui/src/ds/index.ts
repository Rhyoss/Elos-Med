// ElosMed "Quite Clear" Design System — public entry point.
//
// Subpath import (does not pollute the root `@dermaos/ui` namespace, which
// still exports the legacy shadcn primitives):
//
//   import { Glass, Btn, Stat, Mono, T } from '@dermaos/ui/ds';
//
export * from './components/index.js';
export * from './layouts/index.js';

// Re-export tokens for convenience — the canonical source remains
// '@dermaos/ui/tokens' / '@dermaos/ui'.
export {
  T,
  tokens,
  colors,
  typography,
  spacing,
  radius,
  shadow,
  surfaces,
  gradients,
  zIndex,
  motion,
  type Theme,
  type Tokens,
} from '../tokens.js';

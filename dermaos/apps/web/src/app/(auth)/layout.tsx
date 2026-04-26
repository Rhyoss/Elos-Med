import type { ReactNode } from 'react';

/**
 * Layout pass-through para o segmento (auth).
 * Cada página de auth (login / forgot-password / reset-password) controla
 * sua própria moldura: o login usa split-screen full-bleed, e as demais
 * usam um card centrado com brand mark.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}

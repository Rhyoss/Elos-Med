import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-app px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white font-bold text-xl shadow-lg">
          D
        </span>
        <span className="text-xl font-semibold tracking-tight text-foreground">
          DermaOS
        </span>
      </div>

      {/* Card de autenticação */}
      <div className="w-full max-w-[400px] rounded-xl border bg-card shadow-md p-8">
        {children}
      </div>

      <p className="mt-6 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()} DermaOS · Plataforma para Clínicas Dermatológicas
      </p>
    </div>
  );
}

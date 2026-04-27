import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DashboardShell } from '@/components/dashboard-shell';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const hasToken = cookieStore.has('access_token');

  if (!hasToken) {
    redirect('/login');
  }

  return <DashboardShell>{children}</DashboardShell>;
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/bottom-nav';
import { useAuth } from '@/hooks/use-auth';
import { portalHome } from '@/lib/api-client';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, authenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace('/login');
    }
  }, [loading, authenticated, router]);

  // Buscar contagem de avisos não lidos para o badge da bottom nav
  useEffect(() => {
    if (authenticated) {
      portalHome.get().then((res) => {
        if (res.ok && res.data) {
          setUnreadCount(res.data.unreadCount);
        }
      });
    }
  }, [authenticated]);

  if (loading) {
    return (
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '100dvh',
        }}
        aria-label="Carregando..."
      >
        <div
          style={{
            width:        '40px',
            height:       '40px',
            borderRadius: '50%',
            border:       '3px solid #e5e5e5',
            borderTopColor: '#b8860b',
            animation:    'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div
      style={{
        minHeight:      '100dvh',
        paddingBottom:  'calc(64px + env(safe-area-inset-bottom))',
        paddingTop:     'env(safe-area-inset-top)',
        backgroundColor: 'var(--color-neutral-50, #fafafa)',
      }}
    >
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}

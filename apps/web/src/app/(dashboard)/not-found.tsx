import { T, Ico } from '@dermaos/ui/ds';
import Link from 'next/link';

export default function DashboardNotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        textAlign: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.primaryBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ico name="search" size={24} color={T.primary} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: T.textPrimary,
            margin: 0,
          }}
        >
          Página não encontrada
        </h2>
        <p
          style={{
            fontSize: 14,
            color: T.textSecondary,
            maxWidth: 380,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          O conteúdo que você procura não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/"
        style={{
          marginTop: 4,
          padding: '8px 20px',
          borderRadius: 8,
          background: T.primary,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}

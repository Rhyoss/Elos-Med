'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '1rem',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            background: '#f1f5f9',
          }}
        >
          <span style={{ fontSize: '4rem' }} aria-hidden="true">⚠️</span>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Algo deu errado
            </h1>
            <p style={{ color: '#64748b', maxWidth: '30rem' }}>
              Ocorreu um erro inesperado na aplicação.
              {error.digest && (
                <> Código de erro: <code>{error.digest}</code></>
              )}
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#0e7490',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}

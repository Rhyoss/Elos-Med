'use client';

export default function OfflinePage() {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100dvh',
        padding:        '24px',
        textAlign:      'center',
        backgroundColor: '#ffffff',
        color:           '#171717',
      }}
    >
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>📡</div>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
        Sem conexão
      </h1>
      <p style={{ color: '#737373', fontSize: '16px', maxWidth: '320px' }}>
        Verifique sua internet e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop:       '24px',
          padding:         '14px 32px',
          backgroundColor: '#b8860b',
          color:           '#ffffff',
          border:          'none',
          borderRadius:    '12px',
          fontSize:        '16px',
          fontWeight:      600,
          cursor:          'pointer',
          minHeight:       '44px',
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}

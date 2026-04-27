export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight:      '100dvh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 20px',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Logo / branding */}
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div
          style={{
            width:           '64px',
            height:          '64px',
            borderRadius:    '16px',
            backgroundColor: '#b8860b',
            margin:          '0 auto 12px',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
          aria-hidden="true"
        >
          <span style={{ color: '#fff', fontSize: '28px', fontWeight: 800 }}>D</span>
        </div>
        <p style={{ color: '#737373', fontSize: '14px', margin: 0 }}>Portal do Paciente</p>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {children}
      </div>
    </div>
  );
}

'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { portalAuth } from '@/lib/api-client';

function EsqueciSenhaForm() {
  const params = useSearchParams();
  const clinicSlug = params.get('clinica') ?? '';

  const [email, setEmail] = useState('');
  const [clinic, setClinic] = useState(clinicSlug);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !clinic) {
      setError('Preencha todos os campos.');
      return;
    }

    setError('');
    setLoading(true);

    await portalAuth.requestMagicLink({ email, clinicSlug: clinic });

    // Sempre mostrar mensagem de sucesso — não revelar se e-mail existe
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#171717' }}>
          Verifique seu e-mail
        </h2>
        <p style={{ color: '#737373', fontSize: '15px', marginBottom: '24px' }}>
          Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes.
        </p>
        <Link href="/login" style={{ color: '#b8860b', fontSize: '14px', textDecoration: 'none' }}>
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#171717' }}>
        Esqueci minha senha
      </h1>
      <p style={{ color: '#737373', fontSize: '15px', marginBottom: '32px' }}>
        Informe seu e-mail e enviaremos um link para redefinir a senha.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {!clinicSlug && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="clinic" style={labelStyle}>Clínica</label>
            <input
              id="clinic"
              type="text"
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              placeholder="nome-da-clinica"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="email" style={labelStyle}>E-mail</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={inputStyle}
          />
        </div>

        {error && (
          <div role="alert" style={alertStyle}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle(loading)}>
          {loading ? 'Enviando...' : 'Enviar link'}
        </button>
      </form>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Link href="/login" style={{ color: '#b8860b', fontSize: '14px', textDecoration: 'none' }}>
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '14px', fontWeight: 500, color: '#404040', marginBottom: '6px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: '48px', padding: '0 14px', fontSize: '16px',
  borderRadius: '10px', border: '1.5px solid #d4d4d4',
  outline: 'none', backgroundColor: '#ffffff', color: '#171717', display: 'block',
};
const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};
function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', height: '52px',
    backgroundColor: disabled ? '#d4d4d4' : '#b8860b',
    color: '#ffffff', border: 'none', borderRadius: '12px',
    fontSize: '16px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export default function EsqueciSenhaPage() {
  return (
    <Suspense>
      <EsqueciSenhaForm />
    </Suspense>
  );
}

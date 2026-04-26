'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalAuth } from '@/lib/api-client';

const schema = z.object({
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve ter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve ter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path:    ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function PrimeiroAcessoPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [purpose, setPurpose] = useState<string>('first_access');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    portalAuth.validateMagicLink(token).then((res) => {
      setValidating(false);
      if (res.ok && res.data?.valid) {
        setTokenValid(true);
        setPurpose(res.data.purpose);
      }
    });
  }, [token]);

  const onSubmit = async (data: FormData) => {
    setError('');
    setLoading(true);

    const fn = purpose === 'password_reset'
      ? portalAuth.resetPassword
      : portalAuth.firstAccess;

    const res = await fn({ token, password: data.password, confirmPassword: data.confirmPassword });
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setError(res.error ?? 'Erro ao definir senha. O link pode ter expirado.');
    }
  };

  if (validating) {
    return <p style={{ textAlign: 'center', color: '#737373' }}>Verificando link...</p>;
  }

  if (!tokenValid) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: '16px', marginBottom: '16px' }}>
          Este link é inválido ou expirou.
        </p>
        <a href="/login" style={{ color: '#b8860b', fontSize: '14px' }}>
          Voltar ao login
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Senha definida com sucesso!
        </h2>
        <p style={{ color: '#737373' }}>Redirecionando para o login...</p>
      </div>
    );
  }

  const title = purpose === 'password_reset' ? 'Redefinir senha' : 'Criar senha';
  const subtitle = purpose === 'password_reset'
    ? 'Defina sua nova senha para o portal.'
    : 'Bem-vindo! Configure sua senha para acessar o portal.';

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#171717' }}>
        {title}
      </h1>
      <p style={{ color: '#737373', fontSize: '15px', marginBottom: '32px' }}>{subtitle}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="password" style={labelStyle}>Nova senha</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('password')}
            style={inputStyle(!!errors.password)}
          />
          {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
          <p style={{ fontSize: '12px', color: '#737373', marginTop: '4px' }}>
            Mínimo 8 caracteres, uma maiúscula e um número.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="confirmPassword" style={labelStyle}>Confirmar senha</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            style={inputStyle(!!errors.confirmPassword)}
          />
          {errors.confirmPassword && <p style={errorStyle}>{errors.confirmPassword.message}</p>}
        </div>

        {error && (
          <div role="alert" style={alertStyle}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle(loading)}>
          {loading ? 'Salvando...' : 'Salvar senha'}
        </button>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '14px', fontWeight: 500,
  color: '#404040', marginBottom: '6px',
};
function inputStyle(e: boolean): React.CSSProperties {
  return {
    width: '100%', height: '48px', padding: '0 14px', fontSize: '16px',
    borderRadius: '10px', border: `1.5px solid ${e ? '#ef4444' : '#d4d4d4'}`,
    outline: 'none', backgroundColor: '#ffffff', color: '#171717', display: 'block',
  };
}
const errorStyle: React.CSSProperties = { marginTop: '4px', fontSize: '13px', color: '#dc2626' };
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

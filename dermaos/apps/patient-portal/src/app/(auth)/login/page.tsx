'use client';
import { Suspense, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { portalAuth } from '@/lib/api-client';

const schema = z.object({
  email:      z.string().email('E-mail inválido'),
  password:   z.string().min(1, 'Informe a senha'),
  clinicSlug: z.string().min(1, 'Informe a clínica'),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const clinicSlug = params.get('clinica') ?? '';

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver:     zodResolver(schema),
    defaultValues: { clinicSlug },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setLoading(true);

    const res = await portalAuth.login({
      email:        data.email,
      password:     data.password,
      clinicSlug:   data.clinicSlug,
      captchaToken: captchaToken || undefined,
    });

    setLoading(false);

    if (res.ok) {
      router.push('/inicio');
      return;
    }

    const resData = res.error;
    if ((res as any).data?.captchaRequired) {
      setCaptchaRequired(true);
    }

    setError(resData ?? 'Erro ao fazer login. Tente novamente.');
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#171717' }}>
        Entrar
      </h1>
      <p style={{ color: '#737373', fontSize: '15px', marginBottom: '32px' }}>
        Acesse sua conta no portal da clínica.
      </p>

      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Campo oculto: slug da clínica */}
        {!clinicSlug && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="clinicSlug" style={labelStyle}>
              Clínica
            </label>
            <input
              id="clinicSlug"
              type="text"
              autoComplete="organization"
              placeholder="nome-da-clinica"
              {...register('clinicSlug')}
              style={inputStyle(!!errors.clinicSlug)}
            />
            {errors.clinicSlug && <p style={errorStyle}>{errors.clinicSlug.message}</p>}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={labelStyle}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="seu@email.com"
            {...register('email')}
            style={inputStyle(!!errors.email)}
          />
          {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label htmlFor="password" style={labelStyle}>
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
            style={inputStyle(!!errors.password)}
          />
          {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
        </div>

        {/* CAPTCHA placeholder — integrado com hCaptcha/Turnstile em produção */}
        {captchaRequired && (
          <div
            style={{
              marginBottom: '16px',
              padding:      '12px',
              backgroundColor: '#fdf9ee',
              borderRadius: '8px',
              border:       '1px solid #f3dd99',
              fontSize:     '14px',
              color:        '#737373',
            }}
          >
            Por segurança, complete a verificação abaixo antes de continuar.
            {/* Widget hCaptcha/Turnstile renderizado aqui em produção */}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginBottom:    '16px',
              padding:         '12px 16px',
              backgroundColor: '#fef2f2',
              border:          '1px solid #fecaca',
              borderRadius:    '10px',
              color:           '#991b1b',
              fontSize:        '14px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle(loading)}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Link
          href={`/esqueci-senha${clinicSlug ? `?clinica=${clinicSlug}` : ''}`}
          style={{ color: '#b8860b', fontSize: '14px', textDecoration: 'none' }}
        >
          Esqueci minha senha
        </Link>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display:      'block',
  fontSize:     '14px',
  fontWeight:   500,
  color:        '#404040',
  marginBottom: '6px',
};

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width:        '100%',
    height:       '48px',
    padding:      '0 14px',
    fontSize:     '16px',
    borderRadius: '10px',
    border:       `1.5px solid ${hasError ? '#ef4444' : '#d4d4d4'}`,
    outline:      'none',
    backgroundColor: '#ffffff',
    color:        '#171717',
    display:      'block',
  };
}

const errorStyle: React.CSSProperties = {
  marginTop: '4px',
  fontSize:  '13px',
  color:     '#dc2626',
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    width:           '100%',
    height:          '52px',
    backgroundColor: disabled ? '#d4d4d4' : '#b8860b',
    color:           '#ffffff',
    border:          'none',
    borderRadius:    '12px',
    fontSize:        '16px',
    fontWeight:      600,
    cursor:          disabled ? 'not-allowed' : 'pointer',
    transition:      'background-color 0.15s',
  };
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

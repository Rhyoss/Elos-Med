'use client';
import { useEffect, useState } from 'react';
import { portalProfile, portalAuth } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { CardSkeleton } from '@/components/ui/skeleton';

type Profile = {
  displayName: string; birthDate: string | null; phone: string | null;
  address: Record<string, string> | null; email: string | null;
  emailVerified: boolean; bloodType: string | null;
};

export default function PerfilPage() {
  const { logout } = useAuth();
  const { permission, subscribed, subscribe, unsubscribe } = usePushNotifications();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    portalProfile.get().then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setProfile(res.data);
        setPhone(res.data.phone ?? '');
      }
    });
  }, []);

  const handleSavePhone = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const res = await portalProfile.update({ phone: phone || undefined });
    setSaving(false);

    if (res.ok) {
      setSuccess('Telefone atualizado com sucesso.');
      setEditing(false);
      setProfile((prev) => prev ? { ...prev, phone } : prev);
    } else {
      setError(res.error ?? 'Erro ao salvar.');
    }
  };

  const handleEmailChangeRequest = async () => {
    if (!newEmail) return;
    setSaving(true);
    setError('');

    const res = await portalProfile.requestEmailChange(newEmail);
    setSaving(false);

    if (res.ok) {
      setEmailChangeSent(true);
    } else {
      setError(res.error ?? 'Erro ao solicitar troca de e-mail.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setError('');
    setSuccess('');

    const res = await portalAuth.changePassword({ currentPassword, newPassword });
    setChangingPassword(false);

    if (res.ok) {
      setSuccess('Senha alterada. Você será redirecionado para o login.');
      setTimeout(() => logout(), 2000);
    } else {
      setError(res.error ?? 'Erro ao alterar senha.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Meu Perfil
      </h1>

      {success && (
        <div role="status" style={successStyle}>{success}</div>
      )}
      {error && (
        <div role="alert" style={alertStyle}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : (
        <>
          {/* Dados pessoais */}
          <section aria-labelledby="dados-pessoais" style={{ ...cardStyle, marginBottom: '16px' }}>
            <h2 id="dados-pessoais" style={sectionTitle}>Dados pessoais</h2>

            <ReadOnlyField label="Nome" value={profile?.displayName ?? '—'} note="Alterações requerem atendimento presencial" />
            <ReadOnlyField label="Data de nascimento" value={profile?.birthDate ? formatDate(profile.birthDate) : '—'} note="Alterações requerem atendimento presencial" />
            {profile?.bloodType && <ReadOnlyField label="Tipo sanguíneo" value={profile.bloodType} />}

            {/* Telefone — editável */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid #f5f5f5', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#737373' }}>Telefone</span>
                <button
                  onClick={() => setEditing(!editing)}
                  style={{ fontSize: '13px', color: '#b8860b', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
                >
                  {editing ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editing ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={handleSavePhone} disabled={saving} style={saveBtn(saving)}>
                    {saving ? '...' : 'Salvar'}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '15px', color: '#171717' }}>{profile?.phone ?? 'Não informado'}</p>
              )}
            </div>
          </section>

          {/* Conta e acesso */}
          <section aria-labelledby="conta-acesso" style={{ ...cardStyle, marginBottom: '16px' }}>
            <h2 id="conta-acesso" style={sectionTitle}>Conta e acesso</h2>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '13px', color: '#737373', marginBottom: '2px' }}>E-mail</p>
                  <p style={{ fontSize: '15px', color: '#171717' }}>
                    {profile?.email ?? '—'}
                    {profile?.emailVerified && (
                      <span style={{ marginLeft: '6px', fontSize: '12px', color: '#15803d' }}>✓ verificado</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowEmailChange(!showEmailChange)}
                  style={{ fontSize: '13px', color: '#b8860b', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', minWidth: '44px' }}
                >
                  Alterar
                </button>
              </div>
            </div>

            {showEmailChange && (
              emailChangeSent ? (
                <p style={{ fontSize: '14px', color: '#15803d', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                  Enviamos um link de confirmação para {newEmail}. Acesse seu e-mail para confirmar a alteração.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="email"
                    inputMode="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Novo e-mail"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={handleEmailChangeRequest} disabled={saving || !newEmail} style={saveBtn(saving || !newEmail)}>
                    Enviar
                  </button>
                </div>
              )
            )}

            {/* Alterar senha */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
              <button
                onClick={() => setShowPasswordChange(!showPasswordChange)}
                style={{
                  fontSize: '15px', color: '#b8860b', background: 'none', border: 'none',
                  cursor: 'pointer', minHeight: '44px', padding: 0, fontWeight: 500,
                }}
              >
                {showPasswordChange ? '↑ Ocultar' : 'Alterar senha'}
              </button>

              {showPasswordChange && (
                <form onSubmit={handlePasswordChange} style={{ marginTop: '12px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label htmlFor="currentPass" style={labelStyle}>Senha atual</label>
                    <input
                      id="currentPass" type="password" autoComplete="current-password"
                      value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="newPass" style={labelStyle}>Nova senha</label>
                    <input
                      id="newPass" type="password" autoComplete="new-password"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mín. 8 chars, 1 maiúscula, 1 número"
                      style={inputStyle}
                    />
                  </div>
                  <button type="submit" disabled={changingPassword || !currentPassword || !newPassword} style={primaryBtn(changingPassword || !currentPassword || !newPassword)}>
                    {changingPassword ? 'Alterando...' : 'Alterar senha'}
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* Notificações push */}
          {permission !== 'unsupported' && (
            <section aria-labelledby="notificacoes" style={{ ...cardStyle, marginBottom: '16px' }}>
              <h2 id="notificacoes" style={sectionTitle}>Notificações</h2>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '15px', color: '#171717', marginBottom: '2px' }}>
                    Lembretes de consulta
                  </p>
                  <p style={{ fontSize: '13px', color: '#737373' }}>
                    {permission === 'denied'
                      ? 'Notificações bloqueadas. Ative nas configurações do navegador.'
                      : subscribed ? 'Ativas' : 'Inativas'}
                  </p>
                </div>
                {permission !== 'denied' && (
                  <button
                    onClick={subscribed ? unsubscribe : subscribe}
                    style={{
                      padding:         '10px 16px',
                      borderRadius:    '10px',
                      border:          `1.5px solid ${subscribed ? '#e5e5e5' : '#b8860b'}`,
                      backgroundColor: subscribed ? '#f5f5f5' : '#b8860b',
                      color:           subscribed ? '#525252' : '#ffffff',
                      fontSize:        '14px',
                      fontWeight:      600,
                      cursor:          'pointer',
                      minHeight:       '44px',
                    }}
                  >
                    {subscribed ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Sair */}
          <button
            onClick={logout}
            style={{
              width:           '100%',
              height:          '52px',
              backgroundColor: '#ffffff',
              color:           '#dc2626',
              border:          '1.5px solid #fecaca',
              borderRadius:    '12px',
              fontSize:        '16px',
              fontWeight:      600,
              cursor:          'pointer',
            }}
          >
            Sair da conta
          </button>
        </>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid #f5f5f5' }}>
      <p style={{ fontSize: '13px', color: '#737373', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '15px', color: '#171717' }}>{value}</p>
      {note && <p style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>{note}</p>}
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f5f5f5',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#737373', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '16px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: '48px', padding: '0 14px', fontSize: '15px',
  borderRadius: '10px', border: '1.5px solid #d4d4d4', outline: 'none',
  backgroundColor: '#ffffff', color: '#171717',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '14px', fontWeight: 500, color: '#404040', marginBottom: '6px',
};

function saveBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0 16px', height: '48px', borderRadius: '10px', border: 'none',
    backgroundColor: disabled ? '#d4d4d4' : '#b8860b',
    color: '#ffffff', fontSize: '14px', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', height: '48px', borderRadius: '10px', border: 'none',
    backgroundColor: disabled ? '#d4d4d4' : '#b8860b',
    color: '#ffffff', fontSize: '15px', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

const successStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0', borderRadius: '10px', color: '#15803d', fontSize: '14px',
};

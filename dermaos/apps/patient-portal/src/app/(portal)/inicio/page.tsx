'use client';
import { useEffect, useState } from 'react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { portalHome } from '@/lib/api-client';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';

type HomeData = Awaited<ReturnType<typeof portalHome.get>>['data'];

function formatAppointmentDate(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d))    return `Hoje às ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Amanhã às ${format(d, 'HH:mm')}`;
  return format(d, "d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

export default function InicioPage() {
  const [data, setData] = useState<HomeData>(null as unknown as HomeData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    portalHome.get().then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setError('Erro ao carregar informações.');
      }
    });
  }, []);

  const handleMarkRead = async (id: string) => {
    await portalHome.markNoticeRead(id);
    setData((prev) => prev
      ? { ...prev, unreadNotices: prev.unreadNotices.filter((n) => n.id !== id), unreadCount: prev.unreadCount - 1 }
      : prev,
    );
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Início
      </h1>

      {/* Próxima consulta */}
      <section aria-labelledby="proxima-consulta" style={{ marginBottom: '24px' }}>
        <h2 id="proxima-consulta" style={sectionTitle}>Próxima consulta</h2>

        {loading ? (
          <CardSkeleton />
        ) : data?.nextAppointment ? (
          <div style={cardStyle}>
            <p style={{ fontSize: '18px', fontWeight: 600, color: '#b8860b', marginBottom: '4px' }}>
              {formatAppointmentDate(data.nextAppointment.scheduledAt)}
            </p>
            <p style={{ fontSize: '15px', color: '#404040', marginBottom: '2px' }}>
              {data.nextAppointment.providerName}
            </p>
            {data.nextAppointment.serviceName && (
              <p style={{ fontSize: '14px', color: '#737373' }}>{data.nextAppointment.serviceName}</p>
            )}
            <span style={statusBadge(data.nextAppointment.status)}>
              {statusLabel(data.nextAppointment.status)}
            </span>
          </div>
        ) : (
          <EmptyState
            icon="📅"
            label="Nenhuma consulta agendada"
            action={{ href: '/agendar', label: 'Agendar consulta' }}
          />
        )}
      </section>

      {/* Prescrições ativas */}
      <section aria-labelledby="prescricoes-ativas" style={{ marginBottom: '24px' }}>
        <h2 id="prescricoes-ativas" style={sectionTitle}>Prescrições ativas</h2>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CardSkeleton /><CardSkeleton />
          </div>
        ) : data?.activePrescriptions?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.activePrescriptions.map((rx) => (
              <a
                key={rx.id}
                href={`/prescricoes`}
                style={{ ...cardStyle, textDecoration: 'none', display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '2px' }}>
                      Prescrição {rx.type === 'topica' ? 'Tópica' :
                                  rx.type === 'sistemica' ? 'Sistêmica' :
                                  rx.type === 'manipulada' ? 'Manipulada' : 'Cosmecêutica'}
                    </p>
                    {rx.prescriptionNumber && (
                      <p style={{ fontSize: '13px', color: '#737373' }}>Nº {rx.prescriptionNumber}</p>
                    )}
                  </div>
                  {rx.validUntil && (
                    <span style={{ fontSize: '12px', color: '#737373', whiteSpace: 'nowrap' }}>
                      Válida até {format(parseISO(rx.validUntil), 'dd/MM/yy')}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState icon="💊" label="Nenhuma prescrição ativa" />
        )}
      </section>

      {/* Avisos */}
      {(loading || (data?.unreadNotices?.length ?? 0) > 0) && (
        <section aria-labelledby="avisos" style={{ marginBottom: '24px' }}>
          <h2 id="avisos" style={sectionTitle}>Avisos</h2>

          {loading ? (
            <CardSkeleton />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data?.unreadNotices?.map((notice) => (
                <div key={notice.id} style={{ ...cardStyle, borderLeft: '3px solid #b8860b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                        {notice.title}
                      </p>
                      <p style={{ fontSize: '14px', color: '#525252' }}>{notice.body}</p>
                    </div>
                    <button
                      onClick={() => handleMarkRead(notice.id)}
                      aria-label="Marcar como lido"
                      style={{
                        marginLeft:      '12px',
                        padding:         '4px 8px',
                        fontSize:        '12px',
                        color:           '#737373',
                        background:      'none',
                        border:          'none',
                        cursor:          'pointer',
                        minHeight:       '44px',
                        minWidth:        '44px',
                        borderRadius:    '6px',
                      }}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function EmptyState({ icon, label, action }: {
  icon: string; label: string;
  action?: { href: string; label: string };
}) {
  return (
    <div style={{
      ...cardStyle,
      textAlign: 'center',
      padding: '32px 16px',
      color: '#737373',
    }}>
      <div style={{ fontSize: '40px', marginBottom: '8px' }}>{icon}</div>
      <p style={{ fontSize: '14px', marginBottom: action ? '16px' : 0 }}>{label}</p>
      {action && (
        <a
          href={action.href}
          style={{
            display:         'inline-block',
            padding:         '10px 20px',
            backgroundColor: '#b8860b',
            color:           '#ffffff',
            borderRadius:    '10px',
            fontSize:        '14px',
            fontWeight:      600,
            textDecoration:  'none',
            minHeight:       '44px',
            lineHeight:      '24px',
          }}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: '#737373',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: '12px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius:    '16px',
  padding:         '16px',
  boxShadow:       '0 1px 3px rgba(0,0,0,0.08)',
  border:          '1px solid #f5f5f5',
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    scheduled:  'Agendada',
    confirmed:  'Confirmada',
    waiting:    'Aguardando',
    in_progress:'Em andamento',
    completed:  'Concluída',
    cancelled:  'Cancelada',
    no_show:    'Faltou',
    rescheduled:'Reagendada',
  };
  return map[status] ?? status;
}

function statusBadge(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    scheduled:  { bg: '#eff6ff', color: '#1d4ed8' },
    confirmed:  { bg: '#f0fdf4', color: '#15803d' },
    cancelled:  { bg: '#fef2f2', color: '#dc2626' },
    completed:  { bg: '#f5f5f5', color: '#525252' },
  };
  const c = colors[status] ?? { bg: '#f5f5f5', color: '#525252' };
  return {
    display:         'inline-block',
    marginTop:       '8px',
    padding:         '4px 10px',
    borderRadius:    '20px',
    fontSize:        '12px',
    fontWeight:      600,
    backgroundColor: c.bg,
    color:           c.color,
  };
}

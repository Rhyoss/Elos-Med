'use client';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { portalAppointments } from '@/lib/api-client';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';

type Appt = {
  id: string; scheduledAt: string; durationMin: number; status: string;
  type: string; providerName: string; serviceName: string | null;
};

type Filter = 'upcoming' | 'past' | 'all';

export default function ConsultasPage() {
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Appt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [error, setError] = useState('');
  const LIMIT = 10;

  const load = async (f: Filter, p: number) => {
    setLoading(true);
    const res = await portalAppointments.list({ filter: f, page: p, limit: LIMIT });
    setLoading(false);
    if (res.ok && res.data) {
      setData(res.data.data);
      setTotal(res.data.pagination.total);
    }
  };

  useEffect(() => { load(filter, page); }, [filter, page]);

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    setPage(1);
    setData([]);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Confirmar cancelamento desta consulta?')) return;
    setCanceling(id);
    const res = await portalAppointments.cancel(id);
    setCanceling(null);
    if (res.ok) {
      setData((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' } : a));
    } else {
      setError(res.error ?? 'Erro ao cancelar consulta.');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Minhas Consultas
      </h1>

      {/* Filtros */}
      <div
        role="tablist"
        style={{
          display:      'flex',
          gap:          '8px',
          marginBottom: '20px',
          overflowX:    'auto',
          paddingBottom:'4px',
        }}
      >
        {(['upcoming', 'past', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => handleFilterChange(f)}
            style={{
              padding:         '8px 16px',
              borderRadius:    '20px',
              border:          'none',
              cursor:          'pointer',
              fontSize:        '14px',
              fontWeight:      filter === f ? 600 : 400,
              whiteSpace:      'nowrap',
              minHeight:       '44px',
              backgroundColor: filter === f ? '#b8860b' : '#f5f5f5',
              color:           filter === f ? '#ffffff' : '#525252',
              transition:      'all 0.15s',
            }}
          >
            {f === 'upcoming' ? 'Próximas' : f === 'past' ? 'Anteriores' : 'Todas'}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" style={alertStyle}>{error}</div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#737373' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>📋</p>
          <p style={{ fontSize: '14px' }}>Nenhuma consulta registrada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((appt) => (
            <div key={appt.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                    {format(parseISO(appt.scheduledAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p style={{ fontSize: '14px', color: '#525252', marginBottom: '2px' }}>
                    {format(parseISO(appt.scheduledAt), 'HH:mm')} • {appt.providerName}
                  </p>
                  {appt.serviceName && (
                    <p style={{ fontSize: '13px', color: '#737373' }}>{appt.serviceName}</p>
                  )}
                </div>
                <span style={statusBadge(appt.status)}>
                  {statusLabel(appt.status)}
                </span>
              </div>

              {/* Cancelar — apenas para consultas futuras não canceladas */}
              {['scheduled', 'confirmed'].includes(appt.status) &&
               new Date(appt.scheduledAt) > new Date() && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                  <button
                    onClick={() => handleCancel(appt.id)}
                    disabled={canceling === appt.id}
                    style={{
                      padding:         '8px 16px',
                      fontSize:        '13px',
                      color:           '#dc2626',
                      background:      'none',
                      border:          '1px solid #fecaca',
                      borderRadius:    '8px',
                      cursor:          'pointer',
                      minHeight:       '44px',
                    }}
                  >
                    {canceling === appt.id ? 'Cancelando...' : 'Cancelar consulta'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={paginationBtn(page === 1)}
          >
            Anterior
          </button>
          <span style={{ lineHeight: '44px', color: '#737373', fontSize: '14px' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={paginationBtn(page === totalPages)}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px',
  padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #f5f5f5',
};

function statusLabel(s: string) {
  const m: Record<string, string> = {
    scheduled: 'Agendada', confirmed: 'Confirmada', waiting: 'Aguardando',
    in_progress: 'Em andamento', completed: 'Concluída',
    cancelled: 'Cancelada', no_show: 'Faltou', rescheduled: 'Reagendada',
  };
  return m[s] ?? s;
}

function statusBadge(s: string): React.CSSProperties {
  const c: Record<string, { bg: string; color: string }> = {
    scheduled: { bg: '#eff6ff', color: '#1d4ed8' },
    confirmed: { bg: '#f0fdf4', color: '#15803d' },
    cancelled: { bg: '#fef2f2', color: '#dc2626' },
    completed: { bg: '#f5f5f5', color: '#525252' },
  };
  const col = c[s] ?? { bg: '#f5f5f5', color: '#525252' };
  return {
    padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
    fontWeight: 600, backgroundColor: col.bg, color: col.color,
    whiteSpace: 'nowrap', marginLeft: '8px',
  };
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', minHeight: '44px', borderRadius: '8px',
    border: '1px solid #d4d4d4', cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff', color: disabled ? '#d4d4d4' : '#171717',
    fontSize: '14px',
  };
}

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

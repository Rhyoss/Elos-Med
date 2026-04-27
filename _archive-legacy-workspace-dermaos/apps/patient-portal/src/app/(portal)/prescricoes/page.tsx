'use client';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { portalPrescriptions } from '@/lib/api-client';
import { CardSkeleton } from '@/components/ui/skeleton';

type Rx = {
  id: string; type: string; status: string; validUntil: string | null;
  createdAt: string; prescriptionNumber: string | null;
  prescriberName: string; hasPdf: boolean;
};

export default function PrescricoesPage() {
  const [data, setData] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const LIMIT = 10;

  useEffect(() => {
    setLoading(true);
    portalPrescriptions.list({ page, limit: LIMIT }).then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data.data);
        setTotal(res.data.pagination.total);
      }
    });
  }, [page]);

  const handleDownload = async (id: string, number: string | null) => {
    setDownloadingId(id);
    setError('');

    const res = await portalPrescriptions.getDownloadUrl(id);
    setDownloadingId(null);

    if (!res.ok || !res.data) {
      setError(res.error ?? 'Erro ao gerar link. Tente novamente.');
      return;
    }

    // Download via <a> com download attribute para evitar exposição via Referer
    const a = document.createElement('a');
    a.href = res.data.url;
    a.download = `prescricao-${number ?? id}.pdf`;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Prescrições
      </h1>

      {error && (
        <div role="alert" style={alertStyle}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#737373' }}>
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>💊</p>
          <p>Nenhuma prescrição disponível.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((rx) => (
            <div key={rx.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                    {typeLabel(rx.type)}
                  </p>
                  <p style={{ fontSize: '13px', color: '#737373', marginBottom: '2px' }}>
                    Dr(a). {rx.prescriberName}
                  </p>
                  <p style={{ fontSize: '13px', color: '#737373' }}>
                    Emitida em {format(parseISO(rx.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {rx.validUntil && (
                    <p style={{ fontSize: '13px', color: '#525252', marginTop: '2px' }}>
                      Válida até {format(parseISO(rx.validUntil), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  )}
                  {rx.prescriptionNumber && (
                    <p style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>
                      Nº {rx.prescriptionNumber}
                    </p>
                  )}
                </div>
              </div>

              {rx.hasPdf && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                  <button
                    onClick={() => handleDownload(rx.id, rx.prescriptionNumber)}
                    disabled={downloadingId === rx.id}
                    aria-label={`Baixar prescrição ${rx.prescriptionNumber ?? ''}`}
                    style={downloadBtn(downloadingId === rx.id)}
                  >
                    {downloadingId === rx.id ? '⏳ Gerando...' : '⬇ Baixar PDF'}
                  </button>
                  <p style={{ fontSize: '11px', color: '#a3a3a3', marginTop: '4px' }}>
                    Link válido por 15 minutos após gerado.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '24px' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>
            Anterior
          </button>
          <span style={{ lineHeight: '44px', color: '#737373', fontSize: '14px' }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginationBtn(page === totalPages)}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

function typeLabel(t: string) {
  const m: Record<string, string> = {
    topica: 'Prescrição Tópica', sistemica: 'Prescrição Sistêmica',
    manipulada: 'Prescrição Manipulada', cosmeceutica: 'Prescrição Cosmecêutica',
  };
  return m[t] ?? t;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f5f5f5',
};

function downloadBtn(loading: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '10px 16px', borderRadius: '10px', border: 'none',
    backgroundColor: loading ? '#f5f5f5' : '#fdf9ee',
    color: loading ? '#a3a3a3' : '#b8860b',
    fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
    minHeight: '44px',
  };
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', minHeight: '44px', borderRadius: '8px',
    border: '1px solid #d4d4d4', cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
    color: disabled ? '#d4d4d4' : '#171717', fontSize: '14px',
  };
}

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

'use client';
import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { portalResults } from '@/lib/api-client';
import { CardSkeleton } from '@/components/ui/skeleton';

type Result = {
  id: string; type: string; status: string; collectedAt: string;
  releasedAt: string; releasedByName: string; labName: string | null; hasPdf: boolean;
};

export default function ResultadosPage() {
  const [data, setData] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const LIMIT = 10;

  useEffect(() => {
    setLoading(true);
    portalResults.list({ page, limit: LIMIT }).then((res) => {
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data.data);
        setTotal(res.data.pagination.total);
      }
    });
  }, [page]);

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    setError('');

    const res = await portalResults.getDownloadUrl(id);
    setDownloadingId(null);

    if (!res.ok || !res.data) {
      setError(res.error ?? 'Erro ao gerar link. Tente novamente.');
      return;
    }

    const a = document.createElement('a');
    a.href = res.data.url;
    a.download = `laudo-${id}.pdf`;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px', color: '#171717' }}>
        Resultados
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
          <p style={{ fontSize: '40px', marginBottom: '8px' }}>🔬</p>
          <p>Nenhum resultado disponível.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((r) => (
            <div key={r.id} style={cardStyle}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                {biopsyTypeLabel(r.type)}
              </p>
              {r.labName && (
                <p style={{ fontSize: '13px', color: '#737373', marginBottom: '2px' }}>
                  Laboratório: {r.labName}
                </p>
              )}
              <p style={{ fontSize: '13px', color: '#737373', marginBottom: '2px' }}>
                Coletada em {format(parseISO(r.collectedAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p style={{ fontSize: '13px', color: '#525252', marginBottom: '4px' }}>
                Disponibilizado em {format(parseISO(r.releasedAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                {' '}por Dr(a). {r.releasedByName}
              </p>

              {r.hasPdf && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f5f5f5' }}>
                  <button
                    onClick={() => handleDownload(r.id)}
                    disabled={downloadingId === r.id}
                    aria-label="Baixar laudo"
                    style={downloadBtn(downloadingId === r.id)}
                  >
                    {downloadingId === r.id ? '⏳ Gerando...' : '⬇ Baixar laudo'}
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

function biopsyTypeLabel(t: string) {
  const m: Record<string, string> = {
    punch: 'Biópsia Punch', shave: 'Biópsia Shave',
    excisional: 'Biópsia Excisional', incisional: 'Biópsia Incisional',
  };
  return m[t] ?? `Biópsia ${t}`;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f5f5f5',
};

function downloadBtn(l: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
    borderRadius: '10px', border: 'none', backgroundColor: l ? '#f5f5f5' : '#fdf9ee',
    color: l ? '#a3a3a3' : '#b8860b', fontSize: '14px', fontWeight: 600,
    cursor: l ? 'not-allowed' : 'pointer', minHeight: '44px',
  };
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', minHeight: '44px', borderRadius: '8px', border: '1px solid #d4d4d4',
    cursor: disabled ? 'not-allowed' : 'pointer',
    backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
    color: disabled ? '#d4d4d4' : '#171717', fontSize: '14px',
  };
}

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

'use client';

import * as React from 'react';
import { FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
} from '@dermaos/ui';
import type { EmbeddingStatus, KnowledgeItem, UploadPreview } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';

const STATUS_LABELS: Record<EmbeddingStatus, string> = {
  pending:    'Aguardando',
  processing: 'Processando',
  completed:  'Pronto',
  failed:     'Falhou',
};

const STATUS_VARIANTS: Record<EmbeddingStatus, 'success' | 'warning' | 'neutral' | 'danger'> = {
  pending:    'neutral',
  processing: 'warning',
  completed:  'success',
  failed:     'danger',
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = React.use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const canConfigure = usePermission('omni', 'ai_config');

  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<UploadPreview | null>(null);
  const [editedTitle, setEditedTitle] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const listQuery = trpc.aurora.admin.listKnowledge.useQuery(
    { agentId },
    {
      // Polling leve quando há docs em processamento
      refetchInterval: (q) => {
        const items = q.state.data?.items ?? [];
        const hasPending = items.some((d) =>
          d.embeddingStatus === 'pending' || d.embeddingStatus === 'processing',
        );
        return hasPending ? 4_000 : false;
      },
    },
  );

  const items = listQuery.data?.items ?? [];

  const deleteMutation = trpc.aurora.admin.deleteKnowledge.useMutation({
    onSuccess: () => {
      toast.success('Documento removido');
      void utils.aurora.admin.listKnowledge.invalidate({ agentId });
    },
    onError: (err) => {
      toast.error('Falha ao remover', { description: err.message });
    },
  });

  const reembedMutation = trpc.aurora.admin.reembedKnowledge.useMutation({
    onSuccess: () => {
      toast.success('Reindexação enfileirada');
      void utils.aurora.admin.listKnowledge.invalidate({ agentId });
    },
    onError: (err) => {
      toast.error('Falha ao reindexar', { description: err.message });
    },
  });

  const confirmMutation = trpc.aurora.admin.confirmEmbedding.useMutation({
    onSuccess: () => {
      toast.success('Documento enfileirado para indexação');
      setPreview(null);
      setEditedTitle('');
      void utils.aurora.admin.listKnowledge.invalidate({ agentId });
    },
    onError: (err) => {
      toast.error('Falha ao confirmar', { description: err.message });
    },
  });

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo excede 5MB');
      return;
    }
    const allowed = ['.txt', '.md', '.pdf', '.docx'];
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error('Formato não suportado', {
        description: 'Use .txt, .md, .pdf ou .docx.',
      });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `/api/v1/ai-agents/${agentId}/knowledge/upload`,
        { method: 'POST', body: form, credentials: 'include' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Upload falhou (${res.status})`);
      }
      const body = (await res.json()) as { preview: UploadPreview; truncated: boolean };
      setPreview(body.preview);
      setEditedTitle(body.preview.title);
      if (body.truncated) {
        toast.warning('Texto truncado', {
          description: 'O arquivo foi encurtado para 50k caracteres.',
        });
      }
    } catch (err: unknown) {
      toast.error('Upload falhou', {
        description: (err as Error)?.message ?? 'Tente novamente.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function confirmPreview() {
    if (!preview) return;
    confirmMutation.mutate({
      agentId,
      documentId: preview.documentId,
      title: editedTitle.trim() || undefined,
    });
  }

  const columns: ColumnDef<KnowledgeItem>[] = React.useMemo(
    () => [
      {
        id:     'title',
        header: 'Título',
        cell:   ({ row }) => (
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">{row.original.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {row.original.originalFilename ?? '—'}
              </div>
            </div>
          </div>
        ),
        size: 320,
      },
      {
        id:     'size',
        header: 'Tamanho',
        cell:   ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatSize(row.original.fileSizeBytes)}
          </span>
        ),
        size: 100,
      },
      {
        id:     'status',
        header: 'Status',
        cell:   ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <Badge variant={STATUS_VARIANTS[row.original.embeddingStatus]} size="sm" dot>
              {STATUS_LABELS[row.original.embeddingStatus]}
            </Badge>
            {row.original.embeddingStatus === 'failed' && row.original.embeddingError && (
              <span className="text-xs text-danger-700 truncate max-w-[220px]">
                {row.original.embeddingError}
              </span>
            )}
          </div>
        ),
        size: 160,
      },
      {
        id:     'createdAt',
        header: 'Adicionado',
        cell:   ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
        size: 160,
      },
      {
        id:     'actions',
        header: '',
        cell:   ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {canConfigure && row.original.embeddingStatus === 'failed' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  reembedMutation.mutate({ agentId, id: row.original.id })
                }
                disabled={reembedMutation.isPending}
                aria-label="Reindexar documento"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            {canConfigure && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Remover documento da base?')) {
                    deleteMutation.mutate({ agentId, id: row.original.id });
                  }
                }}
                disabled={deleteMutation.isPending}
                aria-label="Remover documento"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        ),
        size: 100,
      },
    ],
    [agentId, canConfigure, deleteMutation, reembedMutation],
  );

  return (
    <div className="p-6 flex flex-col gap-4">
      {canConfigure && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-6">
            <div>
              <h3 className="text-sm font-semibold">Adicionar documento</h3>
              <p className="text-xs text-muted-foreground">
                .txt, .md, .pdf ou .docx · até 5 MB · será indexado por embedding.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div>
              <h3 className="text-sm font-semibold">Confirmar upload</h3>
              <p className="text-xs text-muted-foreground">
                Revise o título e o conteúdo extraído antes de indexar.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Título</label>
              <input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo extraído</label>
              <textarea
                readOnly
                value={preview.extractedText}
                rows={10}
                className="mt-1 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreview(null);
                  setEditedTitle('');
                }}
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={confirmPreview}
                disabled={confirmMutation.isPending || editedTitle.trim().length === 0}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Indexar documento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!listQuery.isLoading && items.length === 0 ? (
        <EmptyState
          title="Nenhum documento"
          description="Adicione documentos para a Aurora responder com base no conteúdo da clínica."
        />
      ) : (
        <DataTable<KnowledgeItem>
          data={items}
          columns={columns}
          isLoading={listQuery.isLoading}
          emptyTitle="Sem documentos"
          emptyDescription="Faça upload do primeiro arquivo."
          stickyHeader
        />
      )}
    </div>
  );
}

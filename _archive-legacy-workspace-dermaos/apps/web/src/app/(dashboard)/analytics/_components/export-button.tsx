'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import {
  Button,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';
import type { AnalyticsExportInput } from '@dermaos/shared';

interface ExportButtonProps {
  tab:   AnalyticsExportInput['tab'];
  start: string;
  end:   string;
  /** Quando false, esconde o botão (sem permissão analytics.export). */
  enabled?: boolean;
}

export function ExportButton({ tab, start, end, enabled = true }: ExportButtonProps) {
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const exportMutation = trpc.analytics.exportReport.useMutation();

  if (!enabled) return null;

  async function handle(format: 'pdf' | 'csv') {
    setBusy(format);
    try {
      const result = await exportMutation.mutateAsync({ tab, start, end, format });
      if (result.format === 'pdf') {
        const html = atob(result.contentBase64);
        triggerDownload(result.filename, html, result.mimeType);
      } else {
        triggerDownload(result.filename, result.content, result.mimeType);
      }
    } catch (err) {
      // Silencioso — o tRPC error formatter vai exibir feedback se for FORBIDDEN.
      console.error('export failed', err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handle('pdf')} disabled={busy !== null}>
          <FileText className="h-4 w-4 mr-2" /> Relatório imprimível (HTML)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handle('csv')} disabled={busy !== null}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Planilha CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

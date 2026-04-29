'use client';

import * as React from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  SheetRoot,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  Badge,
  LoadingSkeleton,
} from '@dermaos/ui';
import { ADVERSE_SEVERITY_LABELS } from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';

interface SessionDetailSheetProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function SessionDetailSheet({ sessionId, open, onOpenChange }: SessionDetailSheetProps) {
  const query = trpc.clinical.protocols.getSessionById.useQuery(
    { sessionId: sessionId ?? '' },
    { enabled: open && !!sessionId },
  );

  const session = query.data?.session;

  return (
    <SheetRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[480px]">
        <SheetHeader>
          <SheetTitle>
            {session ? `Sessão ${session.sessionNumber}` : 'Sessão'}
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {query.isLoading && <LoadingSkeleton className="h-24 w-full rounded-md" />}

          {session && (
            <>
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">Realizada em: </span>
                  {formatDateTime(session.performedAt)}
                </p>
                {session.durationMin && (
                  <p>
                    <span className="text-muted-foreground">Duração: </span>
                    {session.durationMin} min
                  </p>
                )}
              </div>

              {session.flagMedicalReview && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive">
                      Flagged para revisão médica
                    </p>
                    <p className="text-muted-foreground">
                      Evento adverso grave registrado — severidade máxima:{' '}
                      {ADVERSE_SEVERITY_LABELS[session.adverseSeverityMax]}
                    </p>
                  </div>
                </div>
              )}

              {session.insufficientStock && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  Estoque insuficiente durante o registro — verificar consumo e reposição.
                </div>
              )}

              <CollapsibleSection title="Parâmetros" defaultOpen>
                {Object.keys(session.parameters).length > 0 ? (
                  <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded-md">
                    {JSON.stringify(session.parameters, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum parâmetro registrado.</p>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Resposta do paciente">
                <p className="text-sm whitespace-pre-wrap">
                  {session.patientResponse ?? <span className="text-muted-foreground">—</span>}
                </p>
              </CollapsibleSection>

              <CollapsibleSection title={`Eventos adversos (${session.adverseEvents.length})`}>
                {session.adverseEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum evento.</p>
                ) : (
                  <ul className="space-y-2">
                    {session.adverseEvents.map((e, i) => (
                      <li key={i} className="text-sm rounded-md border border-border p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={e.severity === 'grave' ? 'danger' : e.severity === 'moderado' ? 'warning' : 'neutral'}>
                            {ADVERSE_SEVERITY_LABELS[e.severity]}
                          </Badge>
                          <span>{e.description}</span>
                        </div>
                        {e.action && (
                          <p className="text-muted-foreground mt-1">Conduta: {e.action}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>

              <CollapsibleSection title={`Produtos consumidos (${session.productsConsumed.length})`}>
                {session.productsConsumed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum consumo.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {session.productsConsumed.map((p, i) => (
                      <li key={i} className="rounded-md border border-border p-2 font-mono text-xs">
                        <span>produto: {p.productId}</span><br />
                        <span>qtd: {p.quantity}</span>
                        {p.lotId && <><br /><span>lote: {p.lotId}</span></>}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Fotos">
                <div className="text-sm text-muted-foreground">
                  Pré: {session.preImageIds.length} · Pós: {session.postImageIds.length}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Desfecho / próxima sessão">
                <p className="text-sm whitespace-pre-wrap">
                  {session.outcome ?? <span className="text-muted-foreground">—</span>}
                </p>
                {session.scheduledNextAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Próxima sessão sugerida:{' '}
                    {formatDate(session.scheduledNextAt)}
                  </p>
                )}
              </CollapsibleSection>

              <p className="text-xs text-muted-foreground italic pt-2 border-t">
                Sessão registrada — somente profissional com permissão de assinatura pode corrigir.
              </p>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </SheetRoot>
  );
}

function CollapsibleSection({
  title, children, defaultOpen = false,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        aria-expanded={open}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="px-3 pb-3 border-t border-border">{children}</div>}
    </div>
  );
}

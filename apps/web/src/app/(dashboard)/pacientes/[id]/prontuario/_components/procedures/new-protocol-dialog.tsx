'use client';

import * as React from 'react';
import { Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { LabeledInput } from './labeled-input';
import { PROTOCOL_TYPES, PROTOCOL_TYPE_LABELS, type ProtocolType } from '@dermaos/shared';
import { useCreateProtocol } from '@/lib/hooks/use-procedures';
import { useProviders } from '@/lib/hooks/use-scheduling';
import { ProductLotPicker, type SelectedProduct } from './product-lot-picker';

interface NewProtocolDialogProps {
  patientId: string;
  patientName: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (protocolId: string) => void;
}

export function NewProtocolDialog({
  patientId,
  patientName,
  open,
  onClose,
  onCreated,
}: NewProtocolDialogProps) {
  const createMut = useCreateProtocol(patientId);
  const providersQ = useProviders();
  const providers = providersQ.data?.providers ?? [];

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<ProtocolType>('peeling');
  const [description, setDescription] = React.useState('');
  const [totalSessions, setTotalSessions] = React.useState(6);
  const [intervalDays, setIntervalDays] = React.useState(21);
  const [providerId, setProviderId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [products, setProducts] = React.useState<SelectedProduct[]>([]);
  const [showProducts, setShowProducts] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setType('peeling');
      setDescription('');
      setTotalSessions(6);
      setIntervalDays(21);
      setProviderId('');
      setNotes('');
      setProducts([]);
      setShowProducts(false);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length >= 2 && providerId && totalSessions > 0 && intervalDays > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      const result = await createMut.mutateAsync({
        patientId,
        providerId,
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        totalSessions,
        intervalDays,
        notes: notes.trim() || undefined,
        productLinks: products.map((p) => ({
          productId: p.productId,
          quantityPerSession: p.quantity,
          notes: p.notes,
        })),
      });
      onCreated?.(result.protocol.id);
      onClose();
    } catch {
      // error handled by mutation hook
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: 580, maxHeight: '90vh',
          background: '#fff', borderRadius: T.r.xl,
          boxShadow: T.shadow.xl, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: T.textPrimary }}>
              Novo Protocolo Seriado
            </p>
            <Mono size={10} color={T.textMuted}>
              {patientName}
            </Mono>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Ico name="x" size={20} color={T.textMuted} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Protocol type */}
          <div>
            <Mono size={9} spacing="1px" color={T.textMuted} style={{ marginBottom: 8 }}>
              TIPO DE PROTOCOLO
            </Mono>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PROTOCOL_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setType(pt)}
                  style={{
                    padding: '6px 14px', borderRadius: T.r.md,
                    border: `1.5px solid ${type === pt ? T.clinical.color : T.glassBorder}`,
                    background: type === pt ? T.clinical.bg : 'rgba(255,255,255,0.5)',
                    color: type === pt ? T.clinical.color : T.textSecondary,
                    fontSize: 13, fontWeight: type === pt ? 600 : 400,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    cursor: 'pointer',
                  }}
                >
                  {PROTOCOL_TYPE_LABELS[pt]}
                </button>
              ))}
            </div>
          </div>

          <LabeledInput
            label="Nome do protocolo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Peeling de rejuvenescimento facial"
          />

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre o protocolo…"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                resize: 'vertical', color: T.textPrimary,
              }}
            />
          </div>

          {/* Sessions & interval */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <LabeledInput
                label="Total de sessões *"
                type="number"
                value={String(totalSessions)}
                onChange={(e) => setTotalSessions(Math.max(1, Number(e.target.value)))}
                min={1}
                max={100}
              />
            </div>
            <div style={{ flex: 1 }}>
              <LabeledInput
                label="Intervalo entre sessões (dias) *"
                type="number"
                value={String(intervalDays)}
                onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value)))}
                min={1}
                max={365}
              />
            </div>
          </div>

          {/* Provider */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Profissional responsável *
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                color: providerId ? T.textPrimary : T.textMuted,
              }}
            >
              <option value="">Selecione o profissional…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Product links */}
          <Glass style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>
                  Produtos por sessão
                </p>
                <p style={{ fontSize: 12, color: T.textMuted }}>
                  Produtos vinculados serão sugeridos ao registrar cada sessão.
                </p>
              </div>
              <Btn
                variant="ghost" small icon="chevDown"
                onClick={() => setShowProducts(!showProducts)}
              >
                {products.length > 0 ? `${products.length} produto(s)` : 'Adicionar'}
              </Btn>
            </div>
            {showProducts && (
              <div style={{ marginTop: 12 }}>
                <ProductLotPicker value={products} onChange={setProducts} />
              </div>
            )}
          </Glass>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, display: 'block' }}>
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações internas sobre o protocolo…"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: T.r.md,
                border: `1px solid ${T.inputBorder}`, background: T.inputBg,
                fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
                resize: 'vertical', color: T.textPrimary,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.divider}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Btn variant="ghost" small onClick={onClose}>Cancelar</Btn>
          <Btn small icon="layers" onClick={handleSubmit} disabled={!canSubmit || createMut.isPending}>
            {createMut.isPending ? 'Criando…' : 'Criar Protocolo'}
          </Btn>
        </div>

        {createMut.isError && (
          <div style={{
            padding: '8px 20px 12px', background: T.dangerBg,
          }}>
            <p style={{ fontSize: 12, color: T.danger }}>
              Erro ao criar protocolo: {createMut.error?.message ?? 'Erro desconhecido'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

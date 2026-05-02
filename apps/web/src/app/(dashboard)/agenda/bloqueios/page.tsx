'use client';

import * as React from 'react';
import Link from 'next/link';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Btn, Glass, Mono, Badge, Ico, EmptyState,
  PageHero, formatHeroDate, T,
} from '@dermaos/ui/ds';
import { Input, useToast } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';

/* ── Types ─────────────────────────────────────────────────────────────── */

type BlockType = 'horario' | 'ferias' | 'feriado' | 'manutencao' | 'outro';

interface ScheduleBlock {
  id: string;
  providerId: string | null;
  providerName: string | null;
  type: BlockType;
  title: string;
  reason: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  recurring: boolean;
  recurrenceDays: number[];
  createdAt: string;
}

const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  horario:    'Bloqueio de Horário',
  ferias:     'Férias',
  feriado:    'Feriado',
  manutencao: 'Manutenção',
  outro:      'Outro',
};

const BLOCK_TYPE_ICON: Record<BlockType, 'lock' | 'calendar' | 'globe' | 'settings' | 'alert'> = {
  horario:    'lock',
  ferias:     'calendar',
  feriado:    'globe',
  manutencao: 'settings',
  outro:      'alert',
};

const BLOCK_TYPE_VARIANT: Record<BlockType, 'danger' | 'warning' | 'success' | 'default'> = {
  horario:    'danger',
  ferias:     'warning',
  feriado:    'success',
  manutencao: 'default',
  outro:      'default',
};

const BLOCK_TYPE_COLOR: Record<BlockType, string> = {
  horario:    T.danger,
  ferias:     T.warning,
  feriado:    T.success,
  manutencao: T.textMuted,
  outro:      T.textMuted,
};

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/* ── Mock data (replace with tRPC when backend endpoint exists) ──────── */

function useMockBlocks() {
  const [blocks, setBlocks] = React.useState<ScheduleBlock[]>([
    {
      id: '1',
      providerId: null,
      providerName: null,
      type: 'feriado',
      title: 'Dia do Trabalho',
      reason: 'Feriado nacional',
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      startTime: null,
      endTime: null,
      allDay: true,
      recurring: false,
      recurrenceDays: [],
      createdAt: '2026-04-01T10:00:00Z',
    },
  ]);

  function addBlock(block: Omit<ScheduleBlock, 'id' | 'createdAt'>) {
    setBlocks((prev) => [
      {
        ...block,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return { blocks, addBlock, removeBlock };
}

/* ── Glass form modal ──────────────────────────────────────────────────── */

interface BlockFormProps {
  providers: Array<{ id: string; name: string }>;
  onSubmit: (data: Omit<ScheduleBlock, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

function BlockForm({ providers, onSubmit, onCancel }: BlockFormProps) {
  const [type, setType] = React.useState<BlockType>('horario');
  const [title, setTitle] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [providerId, setProviderId] = React.useState('all');
  const [startDate, setStartDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('18:00');
  const [allDay, setAllDay] = React.useState(false);
  const [recurring, setRecurring] = React.useState(false);
  const [recurrenceDays, setRecurrenceDays] = React.useState<number[]>([]);

  function toggleDay(day: number) {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const provider = providers.find((p) => p.id === providerId);
    onSubmit({
      type,
      title: title || BLOCK_TYPE_LABEL[type],
      reason,
      providerId: providerId === 'all' ? null : providerId,
      providerName: provider?.name ?? null,
      startDate,
      endDate,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      allDay,
      recurring,
      recurrenceDays: recurring ? recurrenceDays : [],
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-form-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.xl,
          boxShadow: '0 24px 56px rgba(0,0,0,0.12), 0 6px 14px rgba(0,0,0,0.06)',
          padding: '28px 24px 20px',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '44%',
            background: T.metalHighlight,
            borderRadius: `${T.r.xl}px ${T.r.xl}px 0 0`,
            pointerEvents: 'none',
            opacity: 0.18,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <Mono size={11} spacing="1.2px" color={T.primary}>NOVO BLOQUEIO</Mono>
              <h2 id="block-form-title" style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 4 }}>
                Bloquear Horário
              </h2>
            </div>
            <Btn variant="ghost" small iconOnly icon="x" onClick={onCancel} aria-label="Fechar" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tipo */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                Tipo de bloqueio
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(BLOCK_TYPE_LABEL) as BlockType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: T.r.md,
                      background: type === t ? T.primaryBg : T.glass,
                      border: `1px solid ${type === t ? T.primary : T.glassBorder}`,
                      backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      fontSize: 13,
                      fontWeight: 500,
                      color: type === t ? T.primary : T.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ico name={BLOCK_TYPE_ICON[t]} size={14} color={type === t ? T.primary : T.textMuted} />
                    {BLOCK_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Profissional */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                Profissional
              </label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  border: `1px solid ${T.glassBorder}`,
                  fontSize: 13,
                  color: T.textPrimary,
                }}
              >
                <option value="all">Toda a clínica</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                Título
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={BLOCK_TYPE_LABEL[type]}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  border: `1px solid ${T.glassBorder}`,
                  fontSize: 13,
                  color: T.textPrimary,
                }}
              />
            </div>

            {/* Datas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Data início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    border: `1px solid ${T.glassBorder}`,
                    fontSize: 15,
                    color: T.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                  Data fim
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={startDate}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: T.r.md,
                    background: T.glass,
                    backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                    border: `1px solid ${T.glassBorder}`,
                    fontSize: 15,
                    color: T.textPrimary,
                  }}
                />
              </div>
            </div>

            {/* Dia inteiro toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                onClick={() => setAllDay(!allDay)}
                role="switch"
                aria-checked={allDay}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAllDay(!allDay); } }}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: allDay ? T.primary : T.divider,
                  padding: 2,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: allDay ? 'translateX(16px)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>Dia inteiro</span>
            </label>

            {/* Horários (se não for dia inteiro) */}
            {!allDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                    Horário início
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: T.r.md,
                      background: T.glass,
                      backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      border: `1px solid ${T.glassBorder}`,
                      fontSize: 13,
                      color: T.textPrimary,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                    Horário fim
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: T.r.md,
                      background: T.glass,
                      backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      border: `1px solid ${T.glassBorder}`,
                      fontSize: 13,
                      color: T.textPrimary,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Recorrência */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div
                onClick={() => setRecurring(!recurring)}
                role="switch"
                aria-checked={recurring}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRecurring(!recurring); } }}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: recurring ? T.primary : T.divider,
                  padding: 2,
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: recurring ? 'translateX(16px)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>Recorrência semanal</span>
            </label>

            {recurring && (
              <div style={{ display: 'flex', gap: 6 }}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: T.r.md,
                      background: recurrenceDays.includes(i) ? T.primaryBg : T.glass,
                      border: `1px solid ${recurrenceDays.includes(i) ? T.primary : T.glassBorder}`,
                      backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                      color: recurrenceDays.includes(i) ? T.primary : T.textMuted,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Motivo */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, display: 'block', marginBottom: 8 }}>
                Motivo / Observação
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Opcional — motivo do bloqueio…"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: T.r.md,
                  background: T.glass,
                  backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
                  border: `1px solid ${T.glassBorder}`,
                  fontSize: 13,
                  color: T.textPrimary,
                  resize: 'none',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Btn variant="ghost" small onClick={onCancel}>Cancelar</Btn>
              <Btn small icon="check" type="submit">Criar Bloqueio</Btn>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── Delete confirmation ───────────────────────────────────────────────── */

function DeleteConfirm({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="del-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        aria-hidden
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 380,
          background: T.glass,
          backdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(170%)`,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.xl,
          boxShadow: '0 24px 56px rgba(0,0,0,0.12), 0 6px 14px rgba(0,0,0,0.06)',
          padding: '24px 20px',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '44%',
            background: T.metalHighlight,
            borderRadius: `${T.r.xl}px ${T.r.xl}px 0 0`,
            pointerEvents: 'none',
            opacity: 0.18,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: T.r.lg,
                background: T.dangerBg,
                border: `1px solid ${T.dangerBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico name="alert" size={20} color={T.danger} />
            </div>
            <div>
              <h3 id="del-title" style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>
                Remover bloqueio?
              </h3>
              <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                O bloqueio <strong>{title}</strong> será removido e os horários voltarão a ficar disponíveis.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" small onClick={onCancel}>Cancelar</Btn>
            <Btn variant="danger" small icon="x" onClick={onConfirm}>Remover</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */

export default function BloqueiosPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ScheduleBlock | null>(null);
  const [filter, setFilter] = React.useState<BlockType | 'all'>('all');

  const providersQuery = trpc.scheduling.listProviders.useQuery();
  const providers = providersQuery.data?.providers ?? [];

  const { blocks, addBlock, removeBlock } = useMockBlocks();

  const filtered = filter === 'all' ? blocks : blocks.filter((b) => b.type === filter);

  const activeCount = blocks.filter((b) => {
    const end = new Date(b.endDate);
    return !isBefore(end, startOfDay(new Date()));
  }).length;

  function handleCreate(data: Omit<ScheduleBlock, 'id' | 'createdAt'>) {
    addBlock(data);
    setShowForm(false);
    toast.success('Bloqueio criado', { description: data.title });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    removeBlock(deleteTarget.id);
    toast.success('Bloqueio removido');
    setDeleteTarget(null);
  }

  function formatBlockDate(start: string, end: string, allDay: boolean, startTime: string | null, endTime: string | null): string {
    const s = new Date(start + 'T00:00');
    const e = new Date(end + 'T00:00');
    const sameDay = start === end;
    const dateStr = sameDay
      ? format(s, "dd 'de' MMMM", { locale: ptBR })
      : `${format(s, 'dd/MM', { locale: ptBR })} — ${format(e, 'dd/MM', { locale: ptBR })}`;
    if (allDay) return `${dateStr} · Dia inteiro`;
    return `${dateStr} · ${startTime} — ${endTime}`;
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '22px 26px' }}>
      <PageHero
        eyebrow={formatHeroDate(new Date())}
        title="Bloqueios & Ausências"
        module="clinical"
        icon="lock"
        description={`${activeCount} bloqueio${activeCount === 1 ? '' : 's'} ativo${activeCount === 1 ? '' : 's'}`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/agenda" style={{ textDecoration: 'none' }}>
              <Btn variant="glass" small icon="arrowLeft">Voltar à Agenda</Btn>
            </Link>
            <Btn small icon="plus" onClick={() => setShowForm(true)}>Novo Bloqueio</Btn>
          </div>
        }
      />

      {/* Filter bar */}
      <Glass style={{ padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        {(['all', 'horario', 'ferias', 'feriado', 'manutencao', 'outro'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px',
              borderRadius: T.r.md,
              background: filter === f ? T.primaryBg : 'transparent',
              border: `1px solid ${filter === f ? T.primaryBorder : 'transparent'}`,
              color: filter === f ? T.primary : T.textMuted,
              fontSize: 12,
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.4px',
            }}
          >
            {f === 'all' ? 'TODOS' : BLOCK_TYPE_LABEL[f].toUpperCase()}
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <Mono size={11}>{filtered.length} {filtered.length === 1 ? 'BLOQUEIO' : 'BLOQUEIOS'}</Mono>
        </span>
      </Glass>

      {/* Blocks list */}
      {filtered.length === 0 ? (
        <Glass style={{ padding: 40 }}>
          <EmptyState
            icon="lock"
            title="Nenhum bloqueio encontrado"
            description={
              filter === 'all'
                ? 'Crie um bloqueio para impedir agendamentos em horários específicos, férias ou feriados.'
                : 'Nenhum bloqueio deste tipo. Ajuste o filtro ou crie um novo.'
            }
            action={
              <Btn variant="glass" small icon="plus" onClick={() => setShowForm(true)}>
                Criar bloqueio
              </Btn>
            }
          />
        </Glass>
      ) : (
        <div role="list" aria-label="Lista de bloqueios" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((block) => {
            const isPast = isBefore(new Date(block.endDate), startOfDay(new Date()));
            return (
              <Glass
                key={block.id}
                style={{
                  padding: '16px 18px',
                  borderLeft: `3px solid ${isPast ? T.textMuted : BLOCK_TYPE_COLOR[block.type]}`,
                  opacity: isPast ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: T.r.md,
                        background: isPast ? T.glass : (block.type === 'ferias' ? T.warningBg : block.type === 'feriado' ? T.successBg : block.type === 'horario' ? T.dangerBg : T.glass),
                        border: `1px solid ${T.glassBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Ico
                        name={BLOCK_TYPE_ICON[block.type]}
                        size={18}
                        color={isPast ? T.textMuted : (block.type === 'ferias' ? T.warning : block.type === 'feriado' ? T.success : block.type === 'horario' ? T.danger : T.textSecondary)}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>{block.title}</p>
                        <Badge variant={BLOCK_TYPE_VARIANT[block.type]} dot={false}>
                          {BLOCK_TYPE_LABEL[block.type]}
                        </Badge>
                        {isPast && <Badge variant="default" dot={false}>Expirado</Badge>}
                        {block.recurring && <Badge variant="default" dot={false}>Recorrente</Badge>}
                      </div>
                      <Mono size={11}>
                        {formatBlockDate(block.startDate, block.endDate, block.allDay, block.startTime, block.endTime)}
                      </Mono>
                      {block.providerName && (
                        <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
                          <Ico name="user" size={12} color={T.textMuted} style={{ marginRight: 4 }} />
                          {block.providerName}
                        </p>
                      )}
                      {block.reason && (
                        <p style={{ fontSize: 13, color: T.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                          {block.reason}
                        </p>
                      )}
                      {block.recurring && block.recurrenceDays.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          {WEEKDAY_LABELS.map((label, i) => (
                            <span
                              key={i}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: T.r.sm,
                                background: block.recurrenceDays.includes(i) ? T.primaryBg : 'transparent',
                                border: `1px solid ${block.recurrenceDays.includes(i) ? T.primaryBorder : T.divider}`,
                                color: block.recurrenceDays.includes(i) ? T.primary : T.textMuted,
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {label.slice(0, 1)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Btn
                    variant="ghost"
                    small
                    iconOnly
                    icon="x"
                    onClick={() => setDeleteTarget(block)}
                    aria-label={`Remover bloqueio ${block.title}`}
                  />
                </div>
              </Glass>
            );
          })}
        </div>
      )}

      {showForm && (
        <BlockForm
          providers={providers}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

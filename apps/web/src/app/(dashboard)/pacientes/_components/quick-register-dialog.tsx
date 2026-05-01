'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Btn, Ico, T, Field } from '@dermaos/ui/ds';
import { useToast } from '@dermaos/ui';
import { trpc } from '@/lib/trpc-provider';

/* ── Schema for quick registration ────────────────────────────────────── */

const quickRegisterSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(200, 'Nome muito longo')
    .trim(),
  phone: z
    .string()
    .regex(/^\d{10,11}$/, 'Telefone deve conter 10 ou 11 dígitos')
    .optional()
    .or(z.literal('')),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve conter 11 dígitos')
    .optional()
    .or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  internalNotes: z.string().max(500).optional().or(z.literal('')),
});

type QuickRegisterForm = z.infer<typeof quickRegisterSchema>;

/* ── Glass input for quick form ───────────────────────────────────────── */

const glassStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  borderRadius: T.r.md,
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  fontSize: 15,
  color: T.textPrimary,
  fontFamily: "'IBM Plex Sans', sans-serif",
  transition: 'border-color 0.15s, box-shadow 0.15s',
  outline: 'none',
};

/* ── Props ────────────────────────────────────────────────────────────── */

export interface QuickRegisterDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after successful creation with the new patient ID */
  onCreated?: (patientId: string) => void;
}

export function QuickRegisterDialog({ open, onClose, onCreated }: QuickRegisterDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [duplicate, setDuplicate] = React.useState<{ id: string; name: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<QuickRegisterForm>({
    resolver: zodResolver(quickRegisterSchema),
    defaultValues: {
      name: '',
      phone: '',
      cpf: '',
      birthDate: '',
      internalNotes: '',
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset();
      setDuplicate(null);
    }
  }, [open, reset]);

  const createMutation = trpc.patients.create.useMutation({
    onSuccess: () => {
      void utils.patients.list.invalidate();
    },
  });

  const utils = trpc.useUtils();

  async function onSubmit(data: QuickRegisterForm, action: 'save' | 'save-schedule' | 'save-record') {
    setDuplicate(null);
    try {
      const result = await createMutation.mutateAsync({
        name: data.name,
        phone: data.phone || undefined,
        cpf: data.cpf || undefined,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
        internalNotes: data.internalNotes || undefined,
      });

      if (result.isDuplicate) {
        setDuplicate({ id: result.existing.id, name: result.existing.name });
        return;
      }

      const newId = result.patient.id;
      toast.success('Paciente cadastrado', { description: result.patient.name });

      if (action === 'save-schedule') {
        router.push(`/agenda?paciente=${newId}`);
      } else if (action === 'save-record') {
        router.push(`/pacientes/${newId}/prontuario`);
      } else {
        onCreated?.(newId);
      }
      onClose();
    } catch (err) {
      toast.error('Erro ao cadastrar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  }

  // Handle form actions
  const submitRef = React.useRef<'save' | 'save-schedule' | 'save-record'>('save');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-register-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px) saturate(170%)',
          WebkitBackdropFilter: 'blur(24px) saturate(170%)',
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.xl,
          boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 8px 20px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Metal highlight */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: T.metalHighlight,
            borderRadius: `${T.r.xl}px ${T.r.xl}px 0 0`,
            pointerEvents: 'none',
            opacity: 0.12,
          }}
        />

        <form
          onSubmit={handleSubmit((data) => onSubmit(data, submitRef.current))}
          noValidate
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: `1px solid ${T.divider}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: T.r.md,
                  background: T.primaryBg,
                  border: `1px solid ${T.primaryBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ico name="zap" size={18} color={T.primary} />
              </div>
              <div>
                <h2 id="quick-register-title" style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>
                  Cadastro Rápido
                </h2>
                <p style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>
                  Preencha o mínimo e complete depois
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: T.r.sm,
                display: 'flex',
              }}
            >
              <Ico name="x" size={16} color={T.textMuted} />
            </button>
          </div>

          {/* Fields */}
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Duplicate warning */}
            {duplicate && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: T.r.md,
                  background: T.warningBg,
                  border: `1px solid ${T.warningBorder}`,
                }}
              >
                <Ico name="alert" size={16} color={T.warning} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: T.warning, fontWeight: 600 }}>
                    Paciente já cadastrado: {duplicate.name}
                  </p>
                </div>
                <Btn
                  variant="ghost"
                  small
                  icon="eye"
                  onClick={() => {
                    router.push(`/pacientes/${duplicate.id}/prontuario`);
                    onClose();
                  }}
                >
                  Ver
                </Btn>
              </div>
            )}

            <Field label="Nome completo" required error={errors.name?.message}>
              <input
                {...register('name')}
                placeholder="Maria da Silva"
                autoComplete="name"
                autoFocus
                style={{
                  ...glassStyle,
                  borderColor: errors.name ? T.danger : T.inputBorder,
                }}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Telefone" error={errors.phone?.message} icon="phone">
                <input
                  {...register('phone')}
                  placeholder="11999999999"
                  inputMode="tel"
                  maxLength={11}
                  style={{
                    ...glassStyle,
                    borderColor: errors.phone ? T.danger : T.inputBorder,
                  }}
                />
              </Field>

              <Field label="CPF" error={errors.cpf?.message} icon="shield">
                <input
                  {...register('cpf')}
                  placeholder="00000000000"
                  inputMode="numeric"
                  maxLength={11}
                  style={{
                    ...glassStyle,
                    borderColor: errors.cpf ? T.danger : T.inputBorder,
                  }}
                />
              </Field>
            </div>

            <Field label="Data de nascimento" error={errors.birthDate?.message} icon="calendar">
              <input
                type="date"
                {...register('birthDate')}
                max={new Date().toISOString().split('T')[0]}
                style={{
                  ...glassStyle,
                  borderColor: errors.birthDate ? T.danger : T.inputBorder,
                }}
              />
            </Field>

            <Field label="Observação rápida" error={errors.internalNotes?.message} icon="file">
              <textarea
                {...register('internalNotes')}
                rows={2}
                placeholder="Informação relevante para a equipe…"
                style={{
                  ...glassStyle,
                  resize: 'none',
                  borderColor: errors.internalNotes ? T.danger : T.inputBorder,
                }}
              />
            </Field>
          </div>

          {/* Actions — sticky at bottom */}
          <div
            style={{
              padding: '14px 22px 18px',
              borderTop: `1px solid ${T.divider}`,
              display: 'flex',
              gap: 8,
              background: 'rgba(255,255,255,0.6)',
            }}
          >
            <Btn
              type="submit"
              small
              icon="check"
              loading={isSubmitting && submitRef.current === 'save'}
              disabled={isSubmitting}
              onClick={() => { submitRef.current = 'save'; }}
            >
              Salvar
            </Btn>
            <Btn
              type="submit"
              variant="glass"
              small
              icon="calendar"
              loading={isSubmitting && submitRef.current === 'save-schedule'}
              disabled={isSubmitting}
              onClick={() => { submitRef.current = 'save-schedule'; }}
            >
              Salvar e agendar
            </Btn>
            <Btn
              type="submit"
              variant="glass"
              small
              icon="edit"
              loading={isSubmitting && submitRef.current === 'save-record'}
              disabled={isSubmitting}
              onClick={() => { submitRef.current = 'save-record'; }}
            >
              Salvar e abrir prontuário
            </Btn>
            <div style={{ flex: 1 }} />
            <Btn
              type="button"
              variant="ghost"
              small
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

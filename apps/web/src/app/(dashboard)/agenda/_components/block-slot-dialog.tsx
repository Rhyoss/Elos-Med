'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@dermaos/ui';
import { Btn, Ico, Mono, T } from '@dermaos/ui/ds';

interface BlockSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
}

export function BlockSlotDialog({
  open,
  onOpenChange,
  initialDate,
}: BlockSlotDialogProps) {
  const [reason, setReason] = React.useState('');
  const [dateStr, setDateStr] = React.useState(
    initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
  );
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('09:00');

  React.useEffect(() => {
    if (initialDate) {
      setDateStr(format(initialDate, 'yyyy-MM-dd'));
      setStartTime(
        `${initialDate.getHours().toString().padStart(2, '0')}:${initialDate.getMinutes().toString().padStart(2, '0')}`,
      );
      const end = new Date(initialDate.getTime() + 60 * 60_000);
      setEndTime(
        `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
      );
    }
  }, [initialDate]);

  function handleSubmit() {
    // TODO: integrate with backend block-slot endpoint when available
    onOpenChange(false);
    setReason('');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: T.r.md,
    background: T.glass,
    border: `1px solid ${T.glassBorder}`,
    fontSize: 14,
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: T.textPrimary,
    outline: 'none',
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" style={{ color: T.textPrimary }}>
            Bloquear horário
          </DialogTitle>
          <DialogDescription className="text-sm" style={{ color: T.textMuted }}>
            Reserve um período na agenda para intervalos, reuniões ou manutenção.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: T.textSecondary }}>
              Data
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: T.textSecondary }}>
                Início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: T.textSecondary }}>
                Fim
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: T.textSecondary }}>
              Motivo
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Almoço, reunião, manutenção de equipamento…"
              rows={2}
              style={{
                ...inputStyle,
                resize: 'vertical' as const,
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Btn variant="ghost" small onClick={() => onOpenChange(false)}>
            Cancelar
          </Btn>
          <Btn small icon="lock" onClick={handleSubmit} disabled={!reason.trim()}>
            Bloquear
          </Btn>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

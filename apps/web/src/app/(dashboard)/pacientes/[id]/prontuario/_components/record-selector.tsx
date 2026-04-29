'use client';

import * as React from 'react';
import {
  Badge,
  Btn,
  Glass,
  Ico,
  Mono,
  T,
  type IcoName,
} from '@dermaos/ui/ds';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TYPE_LABEL,
  getDisplayStatus,
  type EncounterListItem,
  type RecordType,
} from './types';

function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    day:   '2-digit',
    month: 'short',
    year:  '2-digit',
  }).format(date);
}

function recordIcon(type: string): IcoName {
  if (type === 'aesthetic')    return 'zap';
  if (type === 'followup')     return 'clock';
  if (type === 'emergency')    return 'alert';
  if (type === 'telemedicine') return 'globe';
  return 'calendar';
}

export interface RecordSelectorProps {
  encounters:  ReadonlyArray<EncounterListItem>;
  selectedId?: string | null;
  onSelect:    (id: string) => void;
  onCreateNew: () => void;
  /** Disable the dropdown (e.g. while editing). */
  disabled?:   boolean;
}

/**
 * Compact selector that replaces the dedicated timeline column.
 *
 * Renders a dropdown trigger (selected encounter summary) + button to create
 * new. Clicking opens a popover with searchable encounter list. The historical
 * audit trail of profile-level events lives under the Perfil tab as
 * "Histórico de Atividade", so this component focuses purely on clinical
 * encounter navigation.
 */
export function RecordSelector({
  encounters,
  selectedId,
  onSelect,
  onCreateNew,
  disabled,
}: RecordSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const selected = encounters.find((e) => e.id === selectedId) ?? null;

  // Close popover on click outside
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return encounters;
    return encounters.filter((enc) => {
      const hay = [
        enc.chiefComplaint,
        ...enc.diagnoses.map((d) => `${d.code} ${d.description}`),
        TYPE_LABEL[enc.type as RecordType] ?? enc.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [encounters, search]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 22px',
        borderBottom: `1px solid ${T.divider}`,
        background: T.glass,
        backdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${T.glassBlur}px) saturate(160%)`,
        flexShrink: 0,
      }}
    >
      <Mono size={9} spacing="1.2px" color={T.clinical.color}>
        REGISTRO
      </Mono>

      {/* Dropdown trigger */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }} ref={popoverRef}>
        <button
          type="button"
          onClick={() => !disabled && setOpen((s) => !s)}
          disabled={disabled || encounters.length === 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: T.r.md,
            background: T.inputBg,
            border: `1px solid ${open ? T.primary : T.inputBorder}`,
            color: T.textPrimary,
            cursor: disabled || encounters.length === 0 ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'border 0.15s',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {selected ? (
            <>
              <Ico
                name={recordIcon(selected.type)}
                size={13}
                color={T.clinical.color}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <strong>{TYPE_LABEL[selected.type as RecordType] ?? selected.type}</strong>
                <span style={{ color: T.textMuted }}> · {fmtDate(selected.createdAt)}</span>
                {selected.chiefComplaint && (
                  <span style={{ color: T.textSecondary }}> · {selected.chiefComplaint}</span>
                )}
              </span>
              <Badge
                variant={STATUS_VARIANT[getDisplayStatus(selected.status)]}
                dot={false}
              >
                {STATUS_LABEL[getDisplayStatus(selected.status)]}
              </Badge>
            </>
          ) : encounters.length === 0 ? (
            <span style={{ fontSize: 12, color: T.textMuted, flex: 1 }}>
              Nenhum prontuário registrado
            </span>
          ) : (
            <span style={{ fontSize: 12, color: T.textMuted, flex: 1 }}>
              Selecionar prontuário…
            </span>
          )}
          <Ico
            name={open ? 'chevDown' : 'chevDown'}
            size={14}
            color={T.textMuted}
          />
        </button>

        {/* Popover */}
        {open && (
          <Glass
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 50,
              padding: 0,
              maxHeight: 360,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: 8,
                borderBottom: `1px solid ${T.divider}`,
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 18,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <Ico name="search" size={12} color={T.textMuted} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar queixa, CID, diagnóstico…"
                autoFocus
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  borderRadius: T.r.sm,
                  background: T.inputBg,
                  border: `1px solid ${T.inputBorder}`,
                  color: T.textPrimary,
                  fontSize: 11,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  outline: 'none',
                }}
              />
            </div>
            <div
              role="listbox"
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: 6,
              }}
            >
              {filtered.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center' }}>
                  <Mono size={9}>NENHUM REGISTRO ENCONTRADO</Mono>
                </div>
              ) : (
                filtered.map((enc) => {
                  const ds = getDisplayStatus(enc.status);
                  const isSelected = enc.id === selectedId;
                  const dx = enc.diagnoses[0];
                  return (
                    <button
                      key={enc.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(enc.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: T.r.sm,
                        background: isSelected ? T.primaryBg : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginBottom: 2,
                        transition: 'background 0.12s',
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: T.r.sm,
                          background: T.clinical.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Ico
                          name={recordIcon(enc.type)}
                          size={12}
                          color={T.clinical.color}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 2,
                          }}
                        >
                          <Mono size={8} color={T.clinical.color}>
                            {(TYPE_LABEL[enc.type as RecordType] ?? enc.type).toUpperCase()}
                          </Mono>
                          <Mono size={8}>{fmtDate(enc.createdAt)}</Mono>
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: T.textPrimary,
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {enc.chiefComplaint ?? '— Sem queixa principal —'}
                        </p>
                        {dx && (
                          <p
                            style={{
                              fontSize: 10,
                              color: T.textSecondary,
                              margin: '2px 0 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Mono size={7} color={T.primary}>{dx.code}</Mono> {dx.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={STATUS_VARIANT[ds]} dot={false}>
                        {STATUS_LABEL[ds]}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </Glass>
        )}
      </div>

      <Btn small icon="plus" onClick={onCreateNew} disabled={disabled}>
        Novo prontuário
      </Btn>
    </div>
  );
}

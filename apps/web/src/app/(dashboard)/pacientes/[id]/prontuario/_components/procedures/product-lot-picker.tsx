'use client';

import * as React from 'react';
import { Badge, Btn, Glass, Ico, Mono, T } from '@dermaos/ui/ds';
import { trpc } from '@/lib/trpc-provider';
import { LabeledInput } from './labeled-input';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface SelectedProduct {
  productId: string;
  productName: string;
  quantity: number;
  lotId?: string;
  lotNumber?: string;
  expiryDate?: string | null;
  unit: string;
  notes?: string;
}

interface ProductLotPickerProps {
  value: SelectedProduct[];
  onChange: (products: SelectedProduct[]) => void;
  max?: number;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function formatExpiry(date: string | null | undefined): string {
  if (!date) return 'S/ validade';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function expiryStatus(date: string | null | undefined): 'ok' | 'warning' | 'expired' {
  if (!date) return 'ok';
  const d = new Date(date);
  const now = new Date();
  if (d < now) return 'expired';
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 30) return 'warning';
  return 'ok';
}

const EXPIRY_BADGE: Record<string, { variant: 'danger' | 'warning' | 'success'; label: string }> = {
  expired: { variant: 'danger', label: 'VENCIDO' },
  warning: { variant: 'warning', label: 'VENC. PRÓXIMO' },
  ok:      { variant: 'success', label: 'OK' },
};

/* ── Component ─────────────────────────────────────────────────────────── */

export function ProductLotPicker({ value, onChange, max = 20 }: ProductLotPickerProps) {
  const [search, setSearch] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [expandedProduct, setExpandedProduct] = React.useState<string | null>(null);

  const searchQ = trpc.supply.products.list.useQuery(
    { search, page: 1, limit: 10 },
    { enabled: search.length >= 2, staleTime: 30_000 },
  );

  const products = searchQ.data?.data ?? [];

  function addProduct(product: { id: string; name: string; unit?: string }) {
    if (value.some((p) => p.productId === product.id)) return;
    if (value.length >= max) return;

    onChange([
      ...value,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unit: product.unit ?? 'unidade',
      },
    ]);
    setSearch('');
    setShowSearch(false);
    setExpandedProduct(product.id);
  }

  function removeProduct(productId: string) {
    onChange(value.filter((p) => p.productId !== productId));
    if (expandedProduct === productId) setExpandedProduct(null);
  }

  function updateProduct(productId: string, patch: Partial<SelectedProduct>) {
    onChange(value.map((p) => (p.productId === productId ? { ...p, ...patch } : p)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Selected products */}
      {value.map((item) => (
        <SelectedProductCard
          key={item.productId}
          item={item}
          expanded={expandedProduct === item.productId}
          onToggle={() => setExpandedProduct(expandedProduct === item.productId ? null : item.productId)}
          onUpdate={(patch) => updateProduct(item.productId, patch)}
          onRemove={() => removeProduct(item.productId)}
        />
      ))}

      {/* Add product */}
      {showSearch ? (
        <Glass style={{ padding: 14 }}>
          <LabeledInput
            label="Buscar produto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, código ou registro ANVISA…"
            autoFocus
          />

          {search.length >= 2 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchQ.isLoading && (
                <Mono size={11} color={T.textMuted}>Buscando…</Mono>
              )}
              {products.length === 0 && !searchQ.isLoading && (
                <Mono size={11} color={T.textMuted}>Nenhum produto encontrado</Mono>
              )}
              {products.map((p) => {
                const alreadyAdded = value.some((v) => v.productId === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addProduct(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: T.r.md,
                      border: `1px solid ${T.glassBorder}`,
                      background: alreadyAdded ? T.primaryBg : 'rgba(255,255,255,0.6)',
                      cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      opacity: alreadyAdded ? 0.5 : 1,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary }}>
                        {p.name}
                      </p>
                      <Mono size={9} color={T.textMuted}>
                        {p.sku ?? p.id.slice(0, 8)} · {p.unit ?? 'unidade'}
                      </Mono>
                    </div>
                    {alreadyAdded ? (
                      <Ico name="check" size={14} color={T.primary} />
                    ) : (
                      <Ico name="plus" size={14} color={T.textMuted} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" small onClick={() => { setShowSearch(false); setSearch(''); }}>
              Cancelar
            </Btn>
          </div>
        </Glass>
      ) : (
        <Btn
          variant="glass"
          small
          icon="plus"
          onClick={() => setShowSearch(true)}
          disabled={value.length >= max}
        >
          Adicionar produto
        </Btn>
      )}
    </div>
  );
}

/* ── Selected product card with lot picker ─────────────────────────────── */

function SelectedProductCard({
  item,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: SelectedProduct;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<SelectedProduct>) => void;
  onRemove: () => void;
}) {
  const fefoQ = trpc.supply.lots.fefoSuggest.useQuery(
    { productId: item.productId, quantity: item.quantity },
    { enabled: expanded && item.quantity > 0, staleTime: 10_000 },
  );

  const fefo = fefoQ.data;
  const expStatus = expiryStatus(item.expiryDate);
  const isExpired = expStatus === 'expired';

  return (
    <Glass style={{ padding: 0, overflow: 'hidden', border: isExpired ? `1.5px solid ${T.danger}` : undefined }}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: T.r.md,
            background: T.supply.bg, border: `1px solid ${T.supply.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ico name="box" size={15} color={T.supply.color} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontSize: 13, fontWeight: 600, color: T.textPrimary,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {item.productName}
            </p>
            <Mono size={9} color={T.textMuted}>
              {item.quantity} {item.unit}
              {item.lotNumber && ` · Lote ${item.lotNumber}`}
              {item.expiryDate && ` · Val. ${formatExpiry(item.expiryDate)}`}
            </Mono>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.lotId && (
            <Badge variant={EXPIRY_BADGE[expStatus]?.variant ?? 'success'} dot={false}>
              {EXPIRY_BADGE[expStatus]?.label ?? 'OK'}
            </Badge>
          )}
          <span style={{
            display: 'inline-flex',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>
            <Ico name="chevDown" size={14} color={T.textMuted} />
          </span>
        </div>
      </button>

      {/* Expanded: quantity + lot selection */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${T.divider}` }}>
          {/* Quantity */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <LabeledInput
                label={`Quantidade (${item.unit})`}
                type="number"
                value={String(item.quantity)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0 && v <= 9999) onUpdate({ quantity: v });
                }}
                min={1}
                max={9999}
              />
            </div>
            <Btn variant="ghost" small icon="x" onClick={onRemove} style={{ color: T.danger }}>
              Remover
            </Btn>
          </div>

          {/* FEFO lot suggestions */}
          {fefoQ.isLoading && (
            <Mono size={10} color={T.textMuted} style={{ marginTop: 10 }}>
              Consultando lotes…
            </Mono>
          )}

          {fefo && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Mono size={9} spacing="1px" color={T.textMuted}>
                  LOTES DISPONÍVEIS (FEFO)
                </Mono>
                {!fefo.available && (
                  <Badge variant="danger" dot={false}>
                    Estoque insuficiente ({fefo.totalAvailable} disponível)
                  </Badge>
                )}
              </div>

              {fefo.lots.length === 0 && (
                <div style={{
                  padding: '10px 12px', borderRadius: T.r.md,
                  background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
                }}>
                  <p style={{ fontSize: 12, color: T.danger }}>
                    Nenhum lote ativo encontrado para este produto.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fefo.lots.map((lot) => {
                  const selected = item.lotId === lot.lotId;
                  const lotExpStatus = expiryStatus(lot.expiryDate);
                  const lotExpired = lotExpStatus === 'expired';

                  return (
                    <button
                      key={lot.lotId}
                      type="button"
                      disabled={lotExpired}
                      onClick={() => {
                        if (lotExpired) return;
                        onUpdate({
                          lotId: lot.lotId,
                          lotNumber: lot.lotNumber,
                          expiryDate: lot.expiryDate,
                          quantity: Math.min(item.quantity, lot.quantityAvailable),
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: T.r.md,
                        border: `1.5px solid ${selected ? T.clinical.color : lotExpired ? T.dangerBorder : T.glassBorder}`,
                        background: selected
                          ? T.clinical.bg
                          : lotExpired
                            ? T.dangerBg
                            : 'rgba(255,255,255,0.5)',
                        cursor: lotExpired ? 'not-allowed' : 'pointer',
                        opacity: lotExpired ? 0.6 : 1,
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mono size={11} color={selected ? T.clinical.color : T.textPrimary}>
                            {lot.lotNumber}
                          </Mono>
                          <Badge variant={EXPIRY_BADGE[lotExpStatus]?.variant ?? 'success'} dot={false}>
                            {lotExpired ? 'VENCIDO' : `Val. ${formatExpiry(lot.expiryDate)}`}
                          </Badge>
                        </div>
                        <Mono size={9} color={T.textMuted} style={{ marginTop: 2 }}>
                          Disponível: {lot.quantityAvailable} · Sugerido: {lot.quantityFromLot}
                        </Mono>
                      </div>
                      {selected && <Ico name="check" size={16} color={T.clinical.color} />}
                      {lotExpired && <Ico name="lock" size={14} color={T.danger} />}
                    </button>
                  );
                })}
              </div>

              {item.lotId && fefo.lots.some((l) => l.lotId === item.lotId) && (
                <div style={{ marginTop: 6 }}>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => onUpdate({ lotId: undefined, lotNumber: undefined, expiryDate: undefined })}
                  >
                    Limpar seleção de lote
                  </Btn>
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {isExpired && item.lotId && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: T.r.md,
              background: T.dangerBg, border: `1px solid ${T.dangerBorder}`,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <Ico name="alert" size={14} color={T.danger} />
              <p style={{ fontSize: 12, color: T.danger, fontWeight: 500 }}>
                Lote vencido — selecione outro lote para prosseguir.
              </p>
            </div>
          )}
        </div>
      )}
    </Glass>
  );
}

'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useToast } from '@dermaos/ui';
import { Glass, Ico, Mono, T } from '@dermaos/ui/ds';

/* ── Template definitions ──────────────────────────────────────────── */

interface TemplateSection {
  key: string;
  label: string;
  content: string;
}

interface ClinicalTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  sections: TemplateSection[];
}

const DERMATOLOGY_TEMPLATES: ClinicalTemplate[] = [
  {
    id: 'acne-vulgaris',
    name: 'Acne vulgar',
    category: 'Clínico',
    icon: '🔬',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente refere lesões acneicas em face há ___ meses/anos. Piora com ___. Já utilizou ___. Nega uso de isotretinoína prévia.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Presença de comedões abertos e fechados, pápulas e pústulas em ___. Classificação: Acne grau ___/IV (Pillsbury). Sem cicatrizes atróficas/hipertróficas significativas.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Acne vulgar grau ___ (L70.0). Diagnóstico diferencial: rosácea, foliculite, dermatite perioral.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Higiene facial com sabonete adequado ao tipo de pele\n2. Tratamento tópico: ___\n3. Tratamento sistêmico (se indicado): ___\n4. Fotoproteção diária\n5. Retorno em ___ dias para reavaliação</p>' },
    ],
  },
  {
    id: 'dermatite-atopica',
    name: 'Dermatite atópica',
    category: 'Clínico',
    icon: '🧴',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente com história de prurido intenso e lesões eczematosas há ___. Fatores de piora: ___. Antecedentes: asma/rinite alérgica (sim/não). Uso de emolientes: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Xerose cutânea difusa. Placas eczematosas em ___. Escoriações por coçadura. SCORAD estimado: ___. Liquenificação em ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Dermatite atópica (L20.9), gravidade ___. Superinfecção bacteriana: sim/não.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Hidratação intensiva com emoliente ___\n2. Corticoide tópico: ___\n3. Anti-histamínico se prurido noturno\n4. Orientações sobre cuidados de barreira cutânea\n5. Retorno em ___ dias</p>' },
    ],
  },
  {
    id: 'melasma',
    name: 'Melasma',
    category: 'Clínico',
    icon: '☀️',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente refere manchas escuras em face há ___. Uso de anticoncepcional: sim/não. Exposição solar: ___. Gestação recente: sim/não. Tratamentos prévios: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Máculas acastanhadas, simétricas, em padrão ___ (centrofacial/malar/mandibular). Lâmpada de Wood: epidérmico/dérmico/misto. MASI score: ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Melasma ___ (L81.1), padrão ___, componente ___.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Fotoproteção rigorosa (FPS 50+, reaplicação a cada 2h)\n2. Despigmentante tópico: ___\n3. Considerar peeling químico/laser: ___\n4. Retorno em ___ dias para reavaliação com fotodocumentação</p>' },
    ],
  },
  {
    id: 'psoriase',
    name: 'Psoríase',
    category: 'Clínico',
    icon: '🩺',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente com diagnóstico de psoríase há ___. Acometimento articular: sim/não. Comorbidades: ___. Tratamentos prévios: ___. DLQI: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Placas eritemato-descamativas, bordas bem definidas, com escamas branco-prateadas em ___. Sinal de Auspitz: presente/ausente. BSA estimado: ___%. PASI: ___. Alterações ungueais: ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Psoríase vulgar (L40.0), gravidade ___ (leve/moderada/grave). PASI ___.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Tratamento tópico: ___\n2. Fototerapia: indicação ___\n3. Tratamento sistêmico: ___\n4. Rastreamento de comorbidades\n5. Retorno em ___ dias</p>' },
    ],
  },
  {
    id: 'procedimento-botox',
    name: 'Toxina botulínica',
    category: 'Procedimento',
    icon: '💉',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente deseja tratamento com toxina botulínica para ___. Aplicações prévias: sim/não. Última aplicação: ___. Alergias: ___. Gestação/amamentação: não.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Avaliação da musculatura facial em repouso e contração. Rugas dinâmicas em ___. Assimetrias: ___. Skin type: ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Indicação de toxina botulínica para ___ (rugas glabelares/frontais/periorbiculares/outros).</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Toxina botulínica tipo A — marca: ___\n2. Dose total: ___ U\n3. Pontos de aplicação: ___\n4. Lote: ___ Validade: ___\n5. TCLE assinado\n6. Orientações pós-procedimento\n7. Retorno em 15 dias para revisão</p>' },
    ],
  },
  {
    id: 'procedimento-laser',
    name: 'Laser / luz pulsada',
    category: 'Procedimento',
    icon: '⚡',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente em tratamento com ___ para ___. Sessão ___/___. Tolerância prévia: ___. Intercorrências anteriores: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Avaliação pré-procedimento: pele íntegra em área de tratamento. Fitzpatrick: ___. Uso de fotoproteção adequado: sim/não.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Sessão ___ de protocolo de ___ com ___.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Equipamento: ___\n2. Parâmetros: fluência ___ J/cm², pulso ___ ms, spot ___ mm\n3. Área tratada: ___\n4. Anestesia: ___\n5. Reações imediatas: ___\n6. Orientações pós: crioterapia, FPS, evitar sol\n7. Próxima sessão: ___</p>' },
    ],
  },
  {
    id: 'peeling-quimico',
    name: 'Peeling químico',
    category: 'Procedimento',
    icon: '🧪',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente realizando peeling químico para ___. Preparo prévio com ___. Uso de isotretinoína nos últimos 6 meses: não. Histórico de cicatrização: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Pele preparada adequadamente. Fitzpatrick: ___. Ausência de lesões ativas/herpes: ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Peeling ___ (superficial/médio) com ___ para tratamento de ___.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. Agente: ___ concentração ___\n2. Tempo de exposição: ___\n3. Neutralização: ___\n4. Reação obtida: frost nível ___\n5. Orientações pós: evitar sol, hidratante, FPS\n6. Retorno em ___ dias</p>' },
    ],
  },
  {
    id: 'retorno-geral',
    name: 'Retorno / reavaliação',
    category: 'Retorno',
    icon: '🔄',
    sections: [
      { key: 'subjective', label: 'Subjetivo', content: '<p>Paciente retorna para reavaliação de ___. Desde última consulta: melhora/piora/estável. Aderência ao tratamento: ___. Efeitos adversos: ___.</p>' },
      { key: 'objective', label: 'Objetivo', content: '<p>Comparação com consulta anterior: ___. Exame das áreas tratadas: ___. Novos achados: ___.</p>' },
      { key: 'assessment', label: 'Avaliação', content: '<p>Evolução ___ (favorável/estável/desfavorável) de ___. Manutenção/ajuste de conduta.</p>' },
      { key: 'plan', label: 'Plano', content: '<p>1. ___\n2. ___\n3. Próximo retorno: ___</p>' },
    ],
  },
];

const CATEGORIES = ['Todos', 'Clínico', 'Procedimento', 'Retorno'] as const;

/* ── Component ─────────────────────────────────────────────────────── */

interface TemplatePanelProps {
  onApplyTemplate: (sections: TemplateSection[]) => void;
  disabled?: boolean;
}

export type { TemplateSection };

export function TemplatePanel({ onApplyTemplate, disabled }: TemplatePanelProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<string>('Todos');
  const { toast } = useToast();

  const filtered = React.useMemo(() => {
    return DERMATOLOGY_TEMPLATES.filter((t) => {
      if (category !== 'Todos' && t.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, category]);

  function handleApply(template: ClinicalTemplate) {
    onApplyTemplate(template.sections);
    setOpen(false);
    toast.info(`Template "${template.name}" aplicado`, {
      description: 'Revise e edite os campos preenchidos.',
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: T.glass,
          border: `1px solid ${T.glassBorder}`,
          borderRadius: T.r.md,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 0.12s',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: T.r.md,
            background: T.clinical.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ico name="file" size={16} color={T.clinical.color} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
            Templates clínicos
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, margin: '1px 0 0' }}>
            {DERMATOLOGY_TEMPLATES.length} modelos disponíveis
          </p>
        </div>
        <Ico name="chevDown" size={14} color={T.textMuted} />
      </button>
    );
  }

  return (
    <Glass style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${T.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Mono size={9} spacing="0.8px" color={T.primary}>TEMPLATES CLÍNICOS</Mono>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            borderRadius: T.r.sm,
          }}
          aria-label="Fechar painel de templates"
        >
          <Ico name="x" size={14} color={T.textMuted} />
        </button>
      </div>

      <div style={{ padding: '8px 12px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 14,
              height: 14,
              color: T.textMuted,
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar template…"
            aria-label="Buscar template"
            style={{
              width: '100%',
              padding: '7px 8px 7px 28px',
              borderRadius: T.r.md,
              background: T.glass,
              border: `1px solid ${T.glassBorder}`,
              fontSize: 12,
              color: T.textPrimary,
              outline: 'none',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              style={{
                padding: '3px 8px',
                borderRadius: T.r.sm,
                background: category === cat ? T.primaryBg : 'transparent',
                border: `1px solid ${category === cat ? T.primaryBorder : T.glassBorder}`,
                color: category === cat ? T.primary : T.textMuted,
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.3px',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0 8px 8px' }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: 16 }}>
            Nenhum template encontrado.
          </p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleApply(t)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${T.divider}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                borderRadius: 0,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, margin: 0 }}>
                  {t.name}
                </p>
                <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0' }}>
                  {t.category} · {t.sections.length} seções
                </p>
              </div>
              <Ico name="arrowRight" size={12} color={T.textMuted} />
            </button>
          ))
        )}
      </div>
    </Glass>
  );
}

'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  useToast,
} from '@dermaos/ui';
import type {
  EscalationRule,
  EscalationCondition,
  EscalationAction,
} from '@dermaos/shared';
import { trpc } from '@/lib/trpc-provider';
import { usePermission } from '@/lib/auth';

/* ── Config das condições/ações ───────────────────────────────────────── */

const CONDITION_TYPE_LABELS: Record<EscalationCondition['type'], string> = {
  sentiment:           'Sentimento',
  intent:              'Intenção',
  keyword:             'Palavra-chave',
  time_of_day:         'Horário',
  unresolved_messages: 'Mensagens sem resposta',
};

const OPERATOR_LABELS: Record<EscalationCondition['operator'], string> = {
  equals:       '=',
  not_equals:   '≠',
  contains:     'contém',
  greater_than: '>',
};

const SENTIMENT_VALUES = ['muito_negativo', 'negativo', 'neutro', 'positivo'] as const;
const INTENT_VALUES = [
  'saudacao',
  'agendar_consulta',
  'remarcar_consulta',
  'cancelar_consulta',
  'confirmar_consulta',
  'consultar_horarios',
  'informacoes_clinica',
  'duvida_procedimento',
  'pos_atendimento',
  'emergencia',
  'fora_de_escopo',
] as const;

const ACTION_LABELS: Record<EscalationAction['type'], string> = {
  escalate_to_role: 'Transferir para',
  mark_urgent:      'Marcar como urgente',
  notify_internal:  'Notificar equipe',
};

const ROLE_LABELS: Record<NonNullable<EscalationAction['target_role']>, string> = {
  receptionist:   'Recepcionista',
  dermatologist:  'Dermatologista',
  admin:          'Administrador',
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function newRule(priority: number): EscalationRule {
  return {
    id:       crypto.randomUUID(),
    priority,
    name:     'Nova regra',
    isActive: true,
    conditions: [
      { type: 'sentiment', operator: 'equals', value: 'muito_negativo' },
    ],
    action: { type: 'escalate_to_role', target_role: 'receptionist' },
  };
}

/* ── Editor de condição ────────────────────────────────────────────────── */

function ConditionEditor({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value:    EscalationCondition;
  onChange: (v: EscalationCondition) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const valueInput = React.useMemo(() => {
    if (value.type === 'sentiment') {
      return (
        <select
          value={String(value.value)}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {SENTIMENT_VALUES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      );
    }
    if (value.type === 'intent') {
      return (
        <select
          value={String(value.value)}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {INTENT_VALUES.map((i) => (
            <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>
          ))}
        </select>
      );
    }
    if (value.type === 'unresolved_messages') {
      return (
        <input
          type="number"
          min={1}
          max={99}
          value={Number(value.value) || 3}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
        />
      );
    }
    // keyword / time_of_day
    return (
      <input
        type="text"
        value={String(value.value)}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        placeholder={value.type === 'time_of_day' ? '09:00' : 'urgência'}
        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
      />
    );
  }, [value, onChange, disabled]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
      <select
        value={value.type}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as EscalationCondition['type'];
          const defaultValue: string | number =
            next === 'sentiment' ? 'muito_negativo' :
            next === 'intent'    ? 'emergencia' :
            next === 'unresolved_messages' ? 3 :
            '';
          onChange({ type: next, operator: next === 'unresolved_messages' ? 'greater_than' : 'equals', value: defaultValue });
        }}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {(Object.keys(CONDITION_TYPE_LABELS) as EscalationCondition['type'][]).map((t) => (
          <option key={t} value={t}>{CONDITION_TYPE_LABELS[t]}</option>
        ))}
      </select>

      <select
        value={value.operator}
        disabled={disabled}
        onChange={(e) =>
          onChange({ ...value, operator: e.target.value as EscalationCondition['operator'] })
        }
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {(Object.keys(OPERATOR_LABELS) as EscalationCondition['operator'][]).map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {valueInput}

      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remover condição"
          className="ml-auto"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/* ── Editor de regra ───────────────────────────────────────────────────── */

function RuleEditor({
  rule,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
}: {
  rule:        EscalationRule;
  onChange:    (v: EscalationRule) => void;
  onRemove:    () => void;
  onMoveUp:    () => void;
  onMoveDown:  () => void;
  canMoveUp:   boolean;
  canMoveDown: boolean;
  disabled:    boolean;
}) {
  function updateCondition(i: number, next: EscalationCondition) {
    const copy = [...rule.conditions];
    copy[i] = next;
    onChange({ ...rule, conditions: copy });
  }
  function removeCondition(i: number) {
    if (rule.conditions.length <= 1) return;
    const copy = rule.conditions.filter((_, idx) => idx !== i);
    onChange({ ...rule, conditions: copy });
  }
  function addCondition() {
    if (rule.conditions.length >= 10) return;
    onChange({
      ...rule,
      conditions: [
        ...rule.conditions,
        { type: 'keyword', operator: 'contains', value: '' },
      ],
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">#{rule.priority}</Badge>
          <input
            value={rule.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
            placeholder="Nome da regra"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={rule.isActive}
              disabled={disabled}
              onChange={(e) => onChange({ ...rule, isActive: e.target.checked })}
            />
            Ativa
          </label>
          {!disabled && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                aria-label="Subir prioridade"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                aria-label="Descer prioridade"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label="Remover regra"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              SE (todas as condições)
            </span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addCondition}
                disabled={rule.conditions.length >= 10}
              >
                <Plus className="h-3.5 w-3.5" /> Condição
              </Button>
            )}
          </div>
          {rule.conditions.map((cond, i) => (
            <ConditionEditor
              key={i}
              value={cond}
              disabled={disabled}
              onChange={(next) => updateCondition(i, next)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-primary-100/30 p-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">ENTÃO</span>
          <select
            value={rule.action.type}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...rule,
                action: {
                  ...rule.action,
                  type: e.target.value as EscalationAction['type'],
                },
              })
            }
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {(Object.keys(ACTION_LABELS) as EscalationAction['type'][]).map((t) => (
              <option key={t} value={t}>{ACTION_LABELS[t]}</option>
            ))}
          </select>

          {rule.action.type === 'escalate_to_role' && (
            <select
              value={rule.action.target_role ?? 'receptionist'}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...rule,
                  action: {
                    ...rule.action,
                    target_role: e.target.value as NonNullable<EscalationAction['target_role']>,
                  },
                })
              }
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {(Object.keys(ROLE_LABELS) as Array<NonNullable<EscalationAction['target_role']>>).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          )}

          {rule.action.type === 'notify_internal' && (
            <select
              value={rule.action.notify_channel ?? 'socket'}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...rule,
                  action: {
                    ...rule.action,
                    notify_channel: e.target.value as 'socket' | 'email',
                  },
                })
              }
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              <option value="socket">Socket (tempo real)</option>
              <option value="email">E-mail</option>
            </select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Página principal ──────────────────────────────────────────────────── */

export default function EscalacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const canConfigure = usePermission('omni', 'ai_config');

  const { data, isLoading } = trpc.aurora.admin.get.useQuery({ id });
  const [rules, setRules] = React.useState<EscalationRule[]>([]);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (data?.agent?.config?.escalation_rules) {
      setRules(data.agent.config.escalation_rules);
      setDirty(false);
    }
  }, [data]);

  const updateMutation = trpc.aurora.admin.update.useMutation({
    onSuccess: () => {
      toast.success('Regras salvas');
      setDirty(false);
      void utils.aurora.admin.get.invalidate({ id });
    },
    onError: (err) => toast.error('Falha ao salvar', { description: err.message }),
  });

  const testMutation = trpc.aurora.admin.testEscalation.useMutation({
    onError: (err) => toast.error('Falha ao testar', { description: err.message }),
  });

  function setAndMark(next: EscalationRule[]) {
    setRules(next);
    setDirty(true);
  }

  function addRule() {
    const maxP = rules.reduce((acc, r) => Math.max(acc, r.priority), 0);
    setAndMark([...rules, newRule(maxP + 1)]);
  }

  function updateRule(i: number, next: EscalationRule) {
    const copy = [...rules];
    copy[i] = next;
    setAndMark(copy);
  }

  function removeRule(i: number) {
    const copy = rules
      .filter((_, idx) => idx !== i)
      .map((r, idx) => ({ ...r, priority: idx + 1 }));
    setAndMark(copy);
  }

  function moveRule(from: number, to: number) {
    if (to < 0 || to >= rules.length) return;
    const copy = [...rules];
    const [item] = copy.splice(from, 1);
    if (!item) return;
    copy.splice(to, 0, item);
    const reprioritized = copy.map((r, idx) => ({ ...r, priority: idx + 1 }));
    setAndMark(reprioritized);
  }

  function saveRules() {
    const config = {
      ...(data?.agent?.config ?? {}),
      escalation_rules: rules,
    };
    updateMutation.mutate({ id, config });
  }

  const [testInput, setTestInput] = React.useState('');
  const testResult = testMutation.data;

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Regras de escalação</h2>
          <p className="text-xs text-muted-foreground">
            Avaliadas na ordem (prioridade). A primeira regra que casar executa a ação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canConfigure && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRule}
              disabled={rules.length >= 20}
            >
              <Plus className="h-4 w-4" /> Regra
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={saveRules}
            disabled={!canConfigure || !dirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma regra configurada. Adicione ao menos uma para poder ativar o agente.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule, i) => (
            <RuleEditor
              key={rule.id}
              rule={rule}
              disabled={!canConfigure}
              onChange={(next) => updateRule(i, next)}
              onRemove={() => removeRule(i)}
              onMoveUp={() => moveRule(i, i - 1)}
              onMoveDown={() => moveRule(i, i + 1)}
              canMoveUp={i > 0}
              canMoveDown={i < rules.length - 1}
            />
          ))}
        </div>
      )}

      {/* Simulador */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div>
            <h3 className="text-sm font-semibold">Testar escalação</h3>
            <p className="text-xs text-muted-foreground">
              Cole uma mensagem do paciente e veja se alguma regra casaria.
            </p>
          </div>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            rows={3}
            placeholder="Estou péssima, quero processar a clínica…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                testMutation.mutate({ agentId: id, message: testInput.trim() })
              }
              disabled={!testInput.trim() || testMutation.isPending}
            >
              {testMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Testar
            </Button>
          </div>

          {testResult && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" size="sm">
                  Intenção: {testResult.intent}
                </Badge>
                <Badge
                  variant={
                    testResult.sentiment === 'muito_negativo' ? 'danger' :
                    testResult.sentiment === 'negativo'       ? 'warning' :
                    testResult.sentiment === 'positivo'       ? 'success' : 'neutral'
                  }
                  size="sm"
                >
                  Sentimento: {testResult.sentiment.replace('_', ' ')}
                </Badge>
              </div>
              {testResult.wouldEscalate && testResult.matchedRule ? (
                <div className="flex items-center gap-2 text-warning-700">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  <span>
                    <strong>Escalaria</strong> via regra{' '}
                    <code>{testResult.matchedRule.name}</code>
                    {' '}(#{testResult.matchedRule.priority}) → {ACTION_LABELS[testResult.matchedRule.action.type]}
                    {testResult.matchedRule.action.target_role
                      ? ` · ${ROLE_LABELS[testResult.matchedRule.action.target_role]}`
                      : ''}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Nenhuma regra casou — Aurora seguiria atendendo normalmente.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

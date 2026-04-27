/**
 * DermaIQ Analytics — geração de relatórios PDF e CSV.
 *
 * - PDF: HTML renderizado server-side (string), retornado como base64.
 *        SHA-256 do conteúdo é armazenado no audit.access_log para integridade.
 * - CSV: streaming line-by-line; protege contra CSV-injection escapando células
 *        que começam com '=', '+', '-', '@' (RFC 4180-ish + OWASP).
 * - Toda exportação grava `action='export'` em audit.access_log.
 */

import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { logger } from '../../lib/logger.js';
import {
  getOverview, getPatientJourney, getSupplyIntelligence,
  getOmniPerformance, getFinancialAdvanced,
} from './analytics.service.js';

export type ExportTab = 'overview' | 'journey' | 'supply' | 'omni' | 'financial';

const TAB_LABEL: Record<ExportTab, string> = {
  overview:  'Visão Geral',
  journey:   'Jornada do Paciente',
  supply:    'Inteligência de Insumos',
  omni:      'Desempenho Omni',
  financial: 'Financeiro Avançado',
};

const CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PERCENT  = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

/** Escape contra injeção em CSV (Excel/Numbers/LibreOffice). */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Bloqueia execução de fórmula iniciando célula com '\t' (não imprime, mas força texto).
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  // Escape de aspas duplas + quoting se contém vírgula/quebra de linha/aspas.
  if (/["\n\r,]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

function hashSha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

async function logExport(
  ctx: { clinicId: string; userId: string; ip: string | null; tab: ExportTab; format: 'pdf' | 'csv'; sha: string },
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit.access_log
         (clinic_id, user_id, resource_type, resource_id, action, ip_address, request_path)
       VALUES ($1, $2, $3, $4, 'export', $5::inet, $6)`,
      [
        ctx.clinicId,
        ctx.userId,
        `analytics_${ctx.tab}`,
        ctx.userId, // resource_id é obrigatório; usamos o user como proxy quando não há recurso único.
        ctx.ip,
        `analytics:${ctx.tab}:${ctx.format}:${ctx.sha.slice(0, 12)}`,
      ],
    );
  } catch (err) {
    logger.warn({ err }, 'analytics export audit log failed');
  }
}

/* ── PDF (HTML report) ───────────────────────────────────────────────────── */

export interface PdfPayload {
  filename:     string;
  contentBase64: string;
  contentSha256: string;
  mimeType:     string;
  generatedAt:  string;
}

export async function generatePdf(
  ctx: { clinicId: string; userId: string; ip: string | null },
  input: { tab: ExportTab; start: string; end: string },
): Promise<PdfPayload> {
  const html = await buildHtml(ctx.clinicId, input);
  // Sem dependência de puppeteer — entregamos HTML como "PDF-ready" base64.
  // Frontend pode imprimir → PDF via window.print(). Mantém o pipeline estável e auditado.
  const sha = hashSha256(html);
  await logExport({ ...ctx, tab: input.tab, format: 'pdf', sha });

  return {
    filename:      `dermaiq-${input.tab}-${input.start}-${input.end}.html`,
    contentBase64: Buffer.from(html, 'utf8').toString('base64'),
    contentSha256: sha,
    mimeType:      'text/html; charset=utf-8',
    generatedAt:   new Date().toISOString(),
  };
}

async function buildHtml(
  clinicId: string,
  input: { tab: ExportTab; start: string; end: string },
): Promise<string> {
  const title = `DermaIQ — ${TAB_LABEL[input.tab]}`;
  const period = `${input.start} a ${input.end}`;
  const body   = await buildSectionHtml(clinicId, input);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(period)}</title>
<style>
  @page { size: A4; margin: 1.6cm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #0F172A; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
  .muted { color: #64748B; font-size: 12px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
  .kpi { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
  .kpi .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
  .kpi .trend { font-size: 11px; margin-top: 4px; }
  .kpi .trend.up    { color: #047857; }
  .kpi .trend.down  { color: #B91C1C; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align: left; }
  th { background: #F8FAFC; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .sig { margin-top: 32px; font-size: 10px; color: #94A3B8; text-align: center; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">Período: ${escapeHtml(period)} · Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
  </header>
  ${body}
  <div class="sig">DermaOS · DermaIQ Analytics · Documento auditado</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(v: number | null): string {
  if (v === null) return '—';
  return CURRENCY.format(v);
}

function fmtPercent(v: number | null): string {
  if (v === null) return '—';
  return PERCENT.format(v);
}

function fmtCount(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR');
}

function fmtTrend(t: number | null): string {
  if (t === null) return '<span class="trend muted">—</span>';
  const cls = t > 0 ? 'up' : t < 0 ? 'down' : '';
  const sign = t > 0 ? '+' : '';
  return `<span class="trend ${cls}">${sign}${t.toFixed(1)}% vs período anterior</span>`;
}

async function buildSectionHtml(
  clinicId: string,
  input: { tab: ExportTab; start: string; end: string },
): Promise<string> {
  const range = { start: input.start, end: input.end };
  switch (input.tab) {
    case 'overview': {
      const d = await getOverview(clinicId, range);
      const k = d.kpis;
      return `
        <h2>KPIs</h2>
        <div class="kpi-grid">
          ${kpi('Receita',         fmtCurrency(k.revenue.value),   fmtTrend(k.revenue.trendPct))}
          ${kpi('Atendimentos',    fmtCount(k.appointments.value), fmtTrend(k.appointments.trendPct))}
          ${kpi('Novos pacientes', fmtCount(k.newPatients.value),  fmtTrend(k.newPatients.trendPct))}
          ${kpi('Pacientes ativos', fmtCount(k.activePatients.value), fmtTrend(k.activePatients.trendPct))}
          ${kpi('Ticket médio',    fmtCurrency(k.avgTicket.value), fmtTrend(k.avgTicket.trendPct))}
          ${kpi('Cancelamento',    fmtPercent(k.cancellationRate.value), fmtTrend(k.cancellationRate.trendPct))}
        </div>
        <h2>Receita diária</h2>
        ${seriesTable(['Data','Receita'], d.series.revenueDaily.map((r) => [r.date, fmtCurrency(r.value)]))}
        <h2>Atendimentos por dia</h2>
        ${seriesTable(
          ['Data','Total','Concluídos','No-show','Cancelados'],
          d.series.appointmentsDaily.map((r) => [r.date, r.total, r.completed, r.noShow, r.cancelled]),
        )}
      `;
    }
    case 'journey': {
      const d = await getPatientJourney(clinicId, { ...range, cohortMonths: 12 });
      return `
        <h2>Funil</h2>
        <div class="kpi-grid">
          ${kpi('Leads',                  fmtCount(d.funnel.leads), '')}
          ${kpi('Primeira consulta',      fmtCount(d.funnel.firstAppointment), '')}
          ${kpi('Consulta concluída',     fmtCount(d.funnel.completed), '')}
          ${kpi('Retornaram',             fmtCount(d.funnel.returned), '')}
        </div>
        <h2>Coortes mensais</h2>
        ${seriesTable(
          ['Coorte','Tamanho','M1','M3','M6','M12','LTV médio'],
          d.cohorts.map((c) => [c.cohortMonth, c.cohortSize, fmtPercent(c.retentionM1), fmtPercent(c.retentionM3), fmtPercent(c.retentionM6), fmtPercent(c.retentionM12), fmtCurrency(c.avgLtv)]),
        )}
        <h2>Top 10 — Risco de churn</h2>
        ${seriesTable(
          ['Paciente','Risco','Dias sem visita','LTV previsto'],
          d.topChurnRisk.map((c) => [c.patientName, fmtPercent(c.churnRisk), c.daysSinceVisit ?? '—', fmtCurrency(c.ltvPredicted)]),
        )}
      `;
    }
    case 'supply': {
      const d = await getSupplyIntelligence(clinicId, { ...range, topN: 20 });
      return `
        <h2>Top consumidos</h2>
        ${seriesTable(
          ['Produto','Quantidade','Movimentos'],
          d.topConsumed.map((p) => [p.productName, p.quantity, p.movements]),
        )}
        <h2>Forecast</h2>
        ${seriesTable(
          ['Produto','Consumo previsto','Reposição estimada','Confiança','Dias de estoque'],
          d.forecasts.map((p) => [p.productName, p.predictedConsumption, p.predictedReorderDate ?? '—', p.confidenceScore !== null ? fmtPercent(p.confidenceScore) : '—', p.daysOfStock ?? '—']),
        )}
        <h2>Análise ABC</h2>
        <p class="muted">A: ${d.abcAnalysis.a} · B: ${d.abcAnalysis.b} · C: ${d.abcAnalysis.c}</p>
      `;
    }
    case 'omni': {
      const d = await getOmniPerformance(clinicId, range);
      return `
        <h2>Por canal</h2>
        ${seriesTable(
          ['Canal','Inbound','Outbound','Automatizadas','Tempo médio (s)'],
          d.byChannel.map((c) => [c.channel, c.inbound, c.outbound, c.automated, c.avgResponseSec ?? '—']),
        )}
        <h2>Funil omnicanal</h2>
        <div class="kpi-grid">
          ${kpi('Conversas',              fmtCount(d.funnel.contacted), '')}
          ${kpi('Respondidas',            fmtCount(d.funnel.responded), '')}
          ${kpi('Agendamentos gerados',   fmtCount(d.funnel.scheduled), '')}
          ${kpi('Atendimentos concluídos', fmtCount(d.funnel.completed), '')}
        </div>
      `;
    }
    case 'financial': {
      const d = await getFinancialAdvanced(clinicId, range);
      const k = d.kpis;
      return `
        <h2>KPIs financeiros</h2>
        <div class="kpi-grid">
          ${kpi('Receita bruta', fmtCurrency(k.revenue.value),       fmtTrend(k.revenue.trendPct))}
          ${kpi('Receita líquida', fmtCurrency(k.netRevenue.value), fmtTrend(k.netRevenue.trendPct))}
          ${kpi('Estornos',      fmtCurrency(k.refunds.value),       fmtTrend(k.refunds.trendPct))}
          ${kpi('Ticket médio',  fmtCurrency(k.avgTicket.value),     fmtTrend(k.avgTicket.trendPct))}
          ${kpi('Faturas pagas', fmtCount(k.paidInvoices.value),     fmtTrend(k.paidInvoices.trendPct))}
          ${kpi('Inadimplência total', fmtCurrency(k.overdueAmount.value), '')}
        </div>
        <h2>Por método</h2>
        ${seriesTable(
          ['Método','Valor','Qtd','Participação'],
          d.byMethod.map((m) => [m.method, fmtCurrency(m.amount), m.count, fmtPercent(m.share)]),
        )}
        <h2>Aging</h2>
        ${seriesTable(
          ['Faixa','Valor'],
          [
            ['A vencer',          fmtCurrency(d.agingBuckets.current)],
            ['0–30 dias',         fmtCurrency(d.agingBuckets.d0_30)],
            ['31–60 dias',        fmtCurrency(d.agingBuckets.d31_60)],
            ['61–90 dias',        fmtCurrency(d.agingBuckets.d61_90)],
            ['Mais de 90 dias',   fmtCurrency(d.agingBuckets.d90Plus)],
          ],
        )}
        <h2>Top serviços</h2>
        ${seriesTable(
          ['Serviço','Receita','Atendimentos'],
          d.topServices.map((s) => [s.name, fmtCurrency(s.revenue), s.count]),
        )}
        <h2>Por profissional</h2>
        ${seriesTable(
          ['Profissional','Receita'],
          d.byProvider.map((p) => [p.providerName, fmtCurrency(p.revenue)]),
        )}
      `;
    }
  }
}

function kpi(label: string, value: string, trendHtml: string): string {
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div>${trendHtml}</div>`;
}

function seriesTable(headers: string[], rows: Array<Array<string | number | null>>): string {
  if (rows.length === 0) return '<p class="muted">Sem dados no período.</p>';
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows.map((row) =>
    `<tr>${row.map((cell, idx) => {
      const isNum = typeof cell === 'number';
      const display = cell === null || cell === undefined ? '—' : String(cell);
      return `<td class="${isNum ? 'num' : ''}">${escapeHtml(display)}</td>`;
    }).join('')}</tr>`,
  ).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/* ── CSV (streaming-safe) ────────────────────────────────────────────────── */

export interface CsvPayload {
  filename:     string;
  content:      string;   // string já completa — frontend pode emitir Blob
  contentSha256: string;
  mimeType:     string;
  generatedAt:  string;
}

export async function generateCsv(
  ctx: { clinicId: string; userId: string; ip: string | null },
  input: { tab: ExportTab; start: string; end: string },
): Promise<CsvPayload> {
  const lines = await buildCsvLines(ctx.clinicId, input);
  const content = lines.join('\r\n') + '\r\n';
  const sha = hashSha256(content);
  await logExport({ ...ctx, tab: input.tab, format: 'csv', sha });

  return {
    filename:      `dermaiq-${input.tab}-${input.start}-${input.end}.csv`,
    content,
    contentSha256: sha,
    mimeType:      'text/csv; charset=utf-8',
    generatedAt:   new Date().toISOString(),
  };
}

async function buildCsvLines(
  clinicId: string,
  input: { tab: ExportTab; start: string; end: string },
): Promise<string[]> {
  const range = { start: input.start, end: input.end };
  const lines: string[] = [];
  lines.push(csvRow(['DermaIQ', TAB_LABEL[input.tab], `${input.start} → ${input.end}`]));
  lines.push('');

  switch (input.tab) {
    case 'overview': {
      const d = await getOverview(clinicId, range);
      lines.push(csvRow(['Métrica', 'Valor', 'Tendência %']));
      const k = d.kpis;
      lines.push(csvRow(['Receita',          k.revenue.value,        k.revenue.trendPct]));
      lines.push(csvRow(['Atendimentos',     k.appointments.value,   k.appointments.trendPct]));
      lines.push(csvRow(['Novos pacientes',  k.newPatients.value,    k.newPatients.trendPct]));
      lines.push(csvRow(['Pacientes ativos', k.activePatients.value, k.activePatients.trendPct]));
      lines.push(csvRow(['Ticket médio',     k.avgTicket.value,      k.avgTicket.trendPct]));
      lines.push(csvRow(['Cancelamento',     k.cancellationRate.value, k.cancellationRate.trendPct]));
      lines.push('');
      lines.push(csvRow(['Data', 'Receita', 'Atendimentos total', 'Concluídos', 'No-show', 'Cancelados', 'Novos pacientes']));
      const idxAppt = new Map(d.series.appointmentsDaily.map((a) => [a.date, a]));
      const idxNew  = new Map(d.series.newPatientsDaily.map((a) => [a.date, a.value]));
      for (const r of d.series.revenueDaily) {
        const a = idxAppt.get(r.date);
        lines.push(csvRow([r.date, r.value, a?.total ?? 0, a?.completed ?? 0, a?.noShow ?? 0, a?.cancelled ?? 0, idxNew.get(r.date) ?? 0]));
      }
      break;
    }
    case 'journey': {
      const d = await getPatientJourney(clinicId, { ...range, cohortMonths: 12 });
      lines.push(csvRow(['Etapa', 'Total']));
      lines.push(csvRow(['Leads',              d.funnel.leads]));
      lines.push(csvRow(['Primeira consulta',  d.funnel.firstAppointment]));
      lines.push(csvRow(['Consultas concluídas', d.funnel.completed]));
      lines.push(csvRow(['Retornaram',         d.funnel.returned]));
      lines.push('');
      lines.push(csvRow(['Coorte', 'Tamanho', 'M1', 'M3', 'M6', 'M12', 'LTV médio']));
      for (const c of d.cohorts) {
        lines.push(csvRow([c.cohortMonth, c.cohortSize, c.retainedM1, c.retainedM3, c.retainedM6, c.retainedM12, c.avgLtv]));
      }
      lines.push('');
      lines.push(csvRow(['Paciente', 'Risco churn', 'Dias sem visita', 'LTV previsto']));
      for (const r of d.topChurnRisk) {
        lines.push(csvRow([r.patientName, r.churnRisk, r.daysSinceVisit ?? '', r.ltvPredicted]));
      }
      break;
    }
    case 'supply': {
      const d = await getSupplyIntelligence(clinicId, { ...range, topN: 50 });
      lines.push(csvRow(['Produto', 'Quantidade', 'Movimentos']));
      for (const p of d.topConsumed) {
        lines.push(csvRow([p.productName, p.quantity, p.movements]));
      }
      lines.push('');
      lines.push(csvRow(['Produto', 'Consumo previsto', 'Reposição estimada', 'Confiança', 'Dias de estoque']));
      for (const p of d.forecasts) {
        lines.push(csvRow([p.productName, p.predictedConsumption, p.predictedReorderDate ?? '', p.confidenceScore ?? '', p.daysOfStock ?? '']));
      }
      lines.push('');
      lines.push(csvRow(['Produto', 'Classificação', 'Participação']));
      for (const p of d.abcAnalysis.items) {
        lines.push(csvRow([p.productName, p.classification, p.share]));
      }
      break;
    }
    case 'omni': {
      const d = await getOmniPerformance(clinicId, range);
      lines.push(csvRow(['Canal', 'Inbound', 'Outbound', 'Automatizadas', 'Tempo médio (s)']));
      for (const c of d.byChannel) {
        lines.push(csvRow([c.channel, c.inbound, c.outbound, c.automated, c.avgResponseSec ?? '']));
      }
      lines.push('');
      lines.push(csvRow(['Etapa', 'Total']));
      lines.push(csvRow(['Conversas',              d.funnel.contacted]));
      lines.push(csvRow(['Respondidas',            d.funnel.responded]));
      lines.push(csvRow(['Agendamentos gerados',   d.funnel.scheduled]));
      lines.push(csvRow(['Atendimentos concluídos', d.funnel.completed]));
      break;
    }
    case 'financial': {
      const d = await getFinancialAdvanced(clinicId, range);
      const k = d.kpis;
      lines.push(csvRow(['Métrica', 'Valor', 'Tendência %']));
      lines.push(csvRow(['Receita bruta',     k.revenue.value,       k.revenue.trendPct]));
      lines.push(csvRow(['Receita líquida',   k.netRevenue.value,    k.netRevenue.trendPct]));
      lines.push(csvRow(['Estornos',          k.refunds.value,       k.refunds.trendPct]));
      lines.push(csvRow(['Ticket médio',      k.avgTicket.value,     k.avgTicket.trendPct]));
      lines.push(csvRow(['Faturas pagas',     k.paidInvoices.value,  k.paidInvoices.trendPct]));
      lines.push(csvRow(['Inadimplência total', k.overdueAmount.value, '']));
      lines.push('');
      lines.push(csvRow(['Método', 'Valor', 'Qtd', 'Participação']));
      for (const m of d.byMethod) {
        lines.push(csvRow([m.method, m.amount, m.count, m.share]));
      }
      lines.push('');
      lines.push(csvRow(['Faixa', 'Valor']));
      lines.push(csvRow(['A vencer',          d.agingBuckets.current]));
      lines.push(csvRow(['0–30 dias',         d.agingBuckets.d0_30]));
      lines.push(csvRow(['31–60 dias',        d.agingBuckets.d31_60]));
      lines.push(csvRow(['61–90 dias',        d.agingBuckets.d61_90]));
      lines.push(csvRow(['Mais de 90 dias',   d.agingBuckets.d90Plus]));
      lines.push('');
      lines.push(csvRow(['Serviço', 'Receita', 'Atendimentos']));
      for (const s of d.topServices) {
        lines.push(csvRow([s.name, s.revenue, s.count]));
      }
      lines.push('');
      lines.push(csvRow(['Profissional', 'Receita']));
      for (const p of d.byProvider) {
        lines.push(csvRow([p.providerName, p.revenue]));
      }
      break;
    }
  }
  return lines;
}

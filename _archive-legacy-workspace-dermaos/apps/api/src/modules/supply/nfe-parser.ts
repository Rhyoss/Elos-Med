import { createHash } from 'node:crypto';
import type { NfeParsed, NfeParsedItem } from '@dermaos/shared';

/*
 * Parser seguro de NF-e (XML) sem dependências externas.
 *
 * Segurança:
 * - Tamanho máximo: 5 MB (validado no schema Zod antes de chegar aqui).
 * - Detecção de XXE: rejeita qualquer XML que contenha <!DOCTYPE, <!ENTITY,
 *   SYSTEM ou PUBLIC — padrões usados em ataques XML External Entity.
 * - Não executa entidades externas porque não usamos um parser DOM completo.
 * - Usa extração via RegExp sobre o texto plano do XML.
 */

const XXE_PATTERNS: RegExp[] = [
  /<!DOCTYPE/i,
  /<!ENTITY/i,
  /\bSYSTEM\s*["']/i,
  /\bPUBLIC\s*["']/i,
];

function detectXXE(xml: string): boolean {
  return XXE_PATTERNS.some((p) => p.test(xml));
}

/**
 * Extrai o conteúdo de texto do primeiro elemento com a tag informada.
 * Suporta tags com namespace (ex: `<nfe:nNF>`) e atributos.
 */
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}(?:\\s[^>]*)?>([^<]*)<\\/`);
  const m  = re.exec(xml);
  return m ? m[1]!.trim() : null;
}

/**
 * Extrai o conteúdo da seção <emit>...</emit> para isolar o CNPJ do emitente
 * de outros CNPJs presentes no XML (destinatário, transportadora, etc.).
 */
function extractEmitSection(xml: string): string | null {
  const start = xml.search(/<(?:[\w]+:)?emit(?:\s[^>]*)?>/);
  if (start === -1) return null;
  const tagEnd = xml.indexOf('>', start);
  if (tagEnd === -1) return null;
  const closeTag  = /<\/(?:[\w]+:)?emit>/;
  const closeMatch = closeTag.exec(xml.slice(tagEnd + 1));
  if (!closeMatch) return null;
  return xml.slice(tagEnd + 1, tagEnd + 1 + closeMatch.index);
}

/**
 * Extrai todos os blocos <det ...>...</det> do XML.
 * Usa exec em loop para capturar múltiplas ocorrências.
 */
function extractDetBlocks(xml: string): string[] {
  const re    = /<(?:[\w]+:)?det\s[^>]*>([\s\S]*?)<\/(?:[\w]+:)?det>/g;
  const dets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    dets.push(m[1]!);
  }
  return dets;
}

/**
 * Normaliza data ISO do campo dhEmi (ex: "2024-01-15T10:00:00-03:00")
 * para YYYY-MM-DD.
 */
function normalizeDate(raw: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return m ? m[1]! : raw;
}

/* ── API pública ──────────────────────────────────────────────────────────── */

export function computeXmlHash(xml: string): string {
  return createHash('sha256').update(xml, 'utf8').digest('hex');
}

/**
 * Parseia um XML NF-e e retorna os dados estruturados.
 *
 * @throws {Error} se o XML contiver padrões XXE, estiver malformado ou
 *   não for uma NF-e válida (campos obrigatórios ausentes).
 */
export function parseNfeXml(xml: string): NfeParsed {
  if (xml.length > 5 * 1024 * 1024) {
    throw new Error('XML excede o tamanho máximo de 5 MB.');
  }

  if (detectXXE(xml)) {
    throw new Error(
      'XML rejeitado: contém declarações de entidades externas (XXE). ' +
      'Verifique se o arquivo é uma NF-e válida.',
    );
  }

  // Número e série
  const numero = extractTag(xml, 'nNF');
  const serie  = extractTag(xml, 'serie') ?? '1';

  if (!numero) {
    throw new Error(
      'Não foi possível ler o XML. ' +
      'Verifique se é uma NF-e válida (campo <nNF> não encontrado).',
    );
  }

  // Data de emissão
  const dhEmiRaw  = extractTag(xml, 'dhEmi') ?? extractTag(xml, 'dEmi');
  const dataEmissao = dhEmiRaw ? normalizeDate(dhEmiRaw) : '';

  // CNPJ emitente — extrai somente da seção <emit>
  const emitSection = extractEmitSection(xml);
  const cnpjEmitente = emitSection
    ? (extractTag(emitSection, 'CNPJ') ?? '')
    : (extractTag(xml, 'CNPJ') ?? '');

  // Itens
  const dets  = extractDetBlocks(xml);
  const itens: NfeParsedItem[] = dets.map((det) => {
    const prodSection = (() => {
      const s = det.search(/<(?:[\w]+:)?prod(?:\s[^>]*)?>/);
      if (s === -1) return det;
      const e = det.indexOf('>', s);
      const close = /<\/(?:[\w]+:)?prod>/.exec(det.slice(e + 1));
      return close ? det.slice(e + 1, e + 1 + close.index) : det;
    })();

    return {
      codigo:        extractTag(prodSection, 'cProd') ?? '',
      descricao:     extractTag(prodSection, 'xProd') ?? '',
      quantidade:    parseFloat(extractTag(prodSection, 'qCom') ?? '0'),
      valorUnitario: parseFloat(extractTag(prodSection, 'vUnCom') ?? '0'),
      valorTotal:    parseFloat(extractTag(prodSection, 'vProd') ?? '0'),
    };
  });

  return { numero, serie, cnpjEmitente, dataEmissao, itens };
}

import { TEMPLATE_PREVIEW_DATA, type TemplateVariable } from '@dermaos/shared';

const VAR_PATTERN = /\{\{([a-z_]+)\}\}/g;

/** Substitui variáveis {{...}} por dados fictícios para preview no frontend. */
export function previewTemplate(body: string): string {
  return body.replace(VAR_PATTERN, (_match, key) => {
    const placeholder = `{{${key}}}` as TemplateVariable;
    return TEMPLATE_PREVIEW_DATA[placeholder] ?? '';
  });
}

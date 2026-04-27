/**
 * Mensagens padrão da Aurora (Anexo B §B.3).
 *
 * Textos LITERAIS do anexo — nenhuma mensagem pode ser parafraseada ou
 * modificada sem atualização do anexo e revisão DPO + RT da clínica.
 *
 * Variáveis `{{...}}` são interpoladas em runtime via `render()` abaixo.
 * Variáveis não resolvidas permanecem no texto (comportamento proposital:
 * ausência de dado deve ser visível em QA, não silenciosamente apagada).
 */

export const AURORA_MESSAGE_CODES = [
  'B.3.1',  'B.3.2',  'B.3.3',  'B.3.4',  'B.3.5',  'B.3.6',
  'B.3.7',  'B.3.8',  'B.3.9',  'B.3.10', 'B.3.11', 'B.3.12',
  'B.3.13', 'B.3.14', 'B.3.15', 'B.3.16', 'B.3.17', 'B.3.18',
] as const;

export type AuroraMessageCode = (typeof AURORA_MESSAGE_CODES)[number];

/**
 * Catálogo canônico — chave = código do anexo, valor = texto literal.
 * NÃO modificar sem PR com revisão DPO + RT.
 */
export const AURORA_MESSAGES: Record<AuroraMessageCode, string> = {
  'B.3.1':  'Olá! Sou a Aurora, assistente da {{clinic.name}}. Posso te ajudar com agendamento, reagendamento, cancelamento, horários, endereço da clínica e dúvidas em geral.. Como posso te ajudar hoje?',
  'B.3.2':  'Para te atender por aqui, preciso registrar essa conversa e usar seus dados (nome e telefone) apenas para fins de agendamento, conforme nossa Política de Privacidade. Tudo bem se eu prosseguir?',
  'B.3.3':  'Pronto, {{paciente.primeiroNome}}! Sua consulta com {{provider.nome}} está marcada para *{{data}}* às *{{hora}}*. Endereço: {{clinic.endereco}}. Você receberá um lembrete 24 h antes. Até lá!',
  'B.3.4':  'Oi, {{paciente.primeiroNome}}! Estou passando para lembrar da sua consulta amanhã, *{{data}}* às *{{hora}}*, com {{provider.nome}}. Posso confirmar sua presença?',
  'B.3.5':  '{{paciente.primeiroNome}}, sua consulta começa em 2 horas, às *{{hora}}*. Endereço: {{clinic.endereco}}. Em caso de imprevisto, é só avisar por aqui.',
  'B.3.6':  'Sua consulta de *{{data}}* às *{{hora}}* foi cancelada. Quando quiser remarcar, é só me chamar.',
  'B.3.7':  'Tudo bem. Vou te transferir para nossa equipe agora. Em alguns instantes alguém te responde por aqui. Muito brigada pela paciência.',
  'B.3.8':  'Nosso atendimento funciona de {{horario.inicio}} às {{horario.fim}}, {{dias}}. Neste momento posso apenas realizar agendamento ou lhe ajudar com informações gerais. Também posso registrar seu pedido para a equipe te responder no próximo expediente.',
  'B.3.9':  'Ops, tive um problema técnico aqui. Pode tentar de novo em alguns instantes? Se preferir, posso lhe transferir para a equipe.',
  'B.3.10': 'Esse assunto foge do que consigo te ajudar por aqui. Posso te transferir para a equipe ou te ajudar com agendamento, horários ou algum outro assunto relacionado a nossa clínica?',
  'B.3.11': 'Não posso avaliar sintomas, imagens ou condições por mensagem — isso exige consulta presencial com a dermatologista. Quer que eu veja um horário para você?',
  'B.3.12': 'Não posso indicar nem comentar medicamentos. Qualquer orientação de tratamento precisa vir da dermatologista em consulta. Posso agendar para você?',
  'B.3.13': 'Pelo que você descreveu, pode ser uma situação urgente. Por favor, ligue agora para o *SAMU (192)* ou vá ao pronto-socorro mais próximo. Estou transferindo essa conversa para nossa equipe também.',
  'B.3.14': 'Resultados variam de paciente para paciente. Quem pode avaliar o seu caso é a dermatologista, em consulta. Posso te ajudar a agendar um horário?',
  'B.3.15': 'Combinado, {{paciente.primeiroNome}}! Qualquer coisa, é só me chamar por aqui. Tenha um ótimo dia.',
  'B.3.16': 'Recebi seu arquivo. Como não consigo avaliar imagens ou documentos por aqui, vou encaminhar para a equipe da clínica dar uma olhada. Em breve alguém da equipe irá lhe responder.',
  'B.3.17': 'Tudo bem. Não vou mais enviar mensagens automáticas para esse número. Se mudar de ideia, é só nos chamar de volta.',
  'B.3.18': 'Para sua segurança, não consegui confirmar sua identidade por aqui. Vou te transferir para nossa equipe finalizar essa solicitação.',
};

export type AuroraMessageVars = Partial<Record<
  | 'paciente.primeiroNome'
  | 'provider.nome'
  | 'data'
  | 'hora'
  | 'clinic.endereco'
  | 'clinic.name'
  | 'horario.inicio'
  | 'horario.fim'
  | 'dias',
  string
>>;

/**
 * Interpola variáveis no texto literal da mensagem. Variáveis ausentes
 * permanecem no formato `{{...}}` propositalmente — ausência é visível
 * em QA/monitoramento e nunca é preenchida com strings vazias.
 */
export function renderAuroraMessage(
  code: AuroraMessageCode,
  vars: AuroraMessageVars = {},
): string {
  const template = AURORA_MESSAGES[code];
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const k = key.trim() as keyof AuroraMessageVars;
    return vars[k] ?? `{{${key}}}`;
  });
}

/**
 * Helpers semânticos — reduzem risco de digitar código errado no call-site.
 * Se o Anexo B evoluir, basta trocar o código de retorno em um só lugar.
 */
export const AuroraMsg = {
  greeting:               'B.3.1' as const,
  optIn:                  'B.3.2' as const,
  appointmentConfirmed:   'B.3.3' as const,
  reminder24h:            'B.3.4' as const,
  reminder2h:             'B.3.5' as const,
  cancellationConfirmed:  'B.3.6' as const,
  transferToHuman:        'B.3.7' as const,
  outsideHours:           'B.3.8' as const,
  technicalError:         'B.3.9' as const,
  outOfScope:             'B.3.10' as const,
  diagnosisRefusal:       'B.3.11' as const,
  prescriptionRefusal:    'B.3.12' as const,
  emergency:              'B.3.13' as const,
  promiseRefusal:         'B.3.14' as const,
  closing:                'B.3.15' as const,
  mediaReceived:          'B.3.16' as const,
  optOutConfirmed:        'B.3.17' as const,
  identityMismatch:       'B.3.18' as const,
};

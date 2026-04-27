import type { IMessageChannel } from './channel.interface.js';
import { whatsappChannel }  from './whatsapp.channel.js';
import { instagramChannel } from './instagram.channel.js';
import { telegramChannel }  from './telegram.channel.js';
import { emailChannel }     from './email.channel.js';

/** Mapeia o tipo (enum) para a implementação concreta do canal. */
const registry: Record<string, IMessageChannel> = {
  whatsapp:  whatsappChannel,
  instagram: instagramChannel,
  email:     emailChannel,
  sms:       telegramChannel,   // Telegram reutiliza o slot 'sms' do enum DB atual
  webchat:   whatsappChannel,   // placeholder até termos canal webchat próprio
  phone:     whatsappChannel,   // voice/DTMF tratado em call_logs, não via channel
};

export function getChannelDriver(type: string): IMessageChannel {
  const impl = registry[type];
  if (!impl) throw new Error(`Channel driver not found for type: ${type}`);
  return impl;
}

export function getProviderDriver(provider: 'whatsapp' | 'instagram' | 'telegram' | 'email'): IMessageChannel {
  switch (provider) {
    case 'whatsapp':  return whatsappChannel;
    case 'instagram': return instagramChannel;
    case 'telegram':  return telegramChannel;
    case 'email':     return emailChannel;
  }
}

'use client';

import { Mail, MessageCircle, MessageSquare, Phone, Globe, Instagram } from 'lucide-react';

export interface ChannelIconProps {
  type: 'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';
  className?: string;
}

export function ChannelIcon({ type, className = 'h-4 w-4' }: ChannelIconProps) {
  switch (type) {
    case 'whatsapp':  return <MessageCircle className={className} aria-label="WhatsApp" />;
    case 'instagram': return <Instagram     className={className} aria-label="Instagram" />;
    case 'email':     return <Mail          className={className} aria-label="E-mail" />;
    case 'sms':       return <MessageSquare className={className} aria-label="SMS / Telegram" />;
    case 'webchat':   return <Globe         className={className} aria-label="Webchat" />;
    case 'phone':     return <Phone         className={className} aria-label="Telefone" />;
    default:          return <MessageSquare className={className} aria-hidden="true" />;
  }
}

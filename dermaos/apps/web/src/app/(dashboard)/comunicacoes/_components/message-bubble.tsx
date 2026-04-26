'use client';

import { cn } from '@/lib/utils';
import { Bot, Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import { AiBadge } from '@dermaos/ui';
import { formatClockTime } from '../_lib/relative-time';

export interface MessageBubbleProps {
  message: {
    id:             string;
    senderType:     'patient' | 'user' | 'ai_agent' | 'system';
    senderName:     string | null;
    contentType:    'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
    content:        string | null;
    mediaUrl:       string | null;
    status:         'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    createdAt:      Date;
    isInternalNote: boolean;
  };
  onRetry?: (messageId: string) => void;
}

function StatusIcon({ status }: { status: MessageBubbleProps['message']['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock     className="h-3 w-3 text-muted-foreground" aria-label="Enviando" />;
    case 'sent':
      return <Check     className="h-3 w-3 text-muted-foreground" aria-label="Enviada" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" aria-label="Entregue" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-primary"         aria-label="Lida" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-danger-500"     aria-label="Falha no envio" />;
    default:
      return null;
  }
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  if (message.senderType === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.content}
        </span>
      </div>
    );
  }

  const isInbound = message.senderType === 'patient';
  const isAI      = message.senderType === 'ai_agent';

  return (
    <div className={cn('mb-3 flex', isInbound ? 'justify-start' : 'justify-end')}>
      <div className="flex max-w-[75%] flex-col">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {isAI && <AiBadge size="inline" />}
          {!isInbound && !isAI && message.senderName && (
            <span>{message.senderName}</span>
          )}
          {message.isInternalNote && (
            <span className="rounded-sm bg-warning-100 px-1 text-warning-700">
              nota interna
            </span>
          )}
        </div>

        <div
          className={cn(
            'relative rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
            isInbound
              ? 'rounded-bl-sm bg-muted text-foreground'
              : isAI
              ? 'rounded-br-sm bg-ai-100 text-ai-900'
              : message.isInternalNote
              ? 'rounded-br-sm bg-warning-50 text-warning-900 border border-warning-200'
              : 'rounded-br-sm bg-primary text-primary-foreground',
          )}
        >
          {message.contentType === 'image' && message.mediaUrl && (
            <img
              src={message.mediaUrl}
              alt={message.content ?? 'imagem'}
              className="mb-1 max-h-64 rounded-lg"
            />
          )}
          {message.contentType === 'document' && message.mediaUrl && (
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 block underline"
            >
              Ver documento
            </a>
          )}
          {message.content && <p>{message.content}</p>}

          <div className="mt-1 flex items-center justify-end gap-1">
            <time dateTime={message.createdAt.toISOString()} className="text-[10px] opacity-70">
              {formatClockTime(message.createdAt)}
            </time>
            {!isInbound && <StatusIcon status={message.status} />}
          </div>
        </div>

        {message.status === 'failed' && !isInbound && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(message.id)}
            className="mt-1 self-end text-[10px] text-danger-600 underline"
          >
            Reenviar
          </button>
        )}
      </div>
    </div>
  );
}

export function AITransitionSeparator() {
  return (
    <div className="my-4 flex items-center gap-2" role="separator">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1 rounded-full bg-ai-100 px-2 py-0.5 text-[10px] text-ai-700">
        <Bot className="h-3 w-3" aria-hidden="true" />
        Atendimento transferido para humano
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

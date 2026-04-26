'use client';
import { useEffect, useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { portalMessages } from '@/lib/api-client';
import { CardSkeleton } from '@/components/ui/skeleton';

type Conversation = {
  id: string; subject: string | null; status: string;
  lastMessageAt: string; unreadCount: number;
};

type Message = { id: string; body: string; direction: string; createdAt: string };

export default function MensagensPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    portalMessages.list().then((res) => {
      setLoading(false);
      if (res.ok && res.data) setConversations(res.data.conversations);
    });
  }, []);

  const loadMessages = async (id: string) => {
    setSelected(id);
    setLoadingMessages(true);
    const res = await portalMessages.get(id);
    setLoadingMessages(false);
    if (res.ok && res.data) {
      setMessages(res.data.messages);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setError('');

    const res = await portalMessages.reply(selected, { body: replyText });
    setSending(false);

    if (res.ok) {
      setReplyText('');
      loadMessages(selected);
    } else {
      setError(res.error ?? 'Erro ao enviar mensagem.');
    }
  };

  const handleCreate = async () => {
    if (!newBody.trim()) return;
    setCreating(true);
    setError('');

    const res = await portalMessages.create({ body: newBody, subject: newSubject || undefined });
    setCreating(false);

    if (res.ok && res.data) {
      setShowNew(false);
      setNewBody('');
      setNewSubject('');
      // Recarregar lista e abrir nova conversa
      const listRes = await portalMessages.list();
      if (listRes.ok && listRes.data) setConversations(listRes.data.conversations);
      loadMessages(res.data.conversationId);
    } else {
      setError(res.error ?? 'Erro ao criar mensagem.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#171717', margin: 0 }}>
          Mensagens
        </h1>
        <button
          onClick={() => { setShowNew(!showNew); setSelected(null); }}
          style={{
            padding: '10px 16px', backgroundColor: '#b8860b', color: '#ffffff',
            border: 'none', borderRadius: '10px', fontSize: '14px',
            fontWeight: 600, cursor: 'pointer', minHeight: '44px',
          }}
        >
          + Nova mensagem
        </button>
      </div>

      {error && <div role="alert" style={alertStyle}>{error}</div>}

      {/* Nova mensagem */}
      {showNew && (
        <div style={{ ...cardStyle, marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Nova mensagem</h2>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="subject" style={labelStyle}>Assunto (opcional)</label>
            <input
              id="subject"
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              maxLength={200}
              placeholder="Assunto da mensagem"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="newBody" style={labelStyle}>
              Mensagem <span style={{ color: '#a3a3a3', fontSize: '12px' }}>({newBody.length}/2000)</span>
            </label>
            <textarea
              id="newBody"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value.slice(0, 2000))}
              placeholder="Escreva sua mensagem..."
              style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newBody.trim()}
            style={primaryBtn(creating || !newBody.trim())}
          >
            {creating ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      )}

      {/* Lista de conversas */}
      {!selected && !showNew && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CardSkeleton /><CardSkeleton />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#737373' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>💬</p>
            <p>Nenhuma mensagem enviada.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadMessages(c.id)}
                style={{
                  ...cardStyle, textAlign: 'left', cursor: 'pointer',
                  border: `1.5px solid ${c.unreadCount > 0 ? '#b8860b' : '#f5f5f5'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                    {c.subject ?? 'Mensagem sem assunto'}
                  </p>
                  {c.unreadCount > 0 && (
                    <span style={{
                      backgroundColor: '#b8860b', color: '#fff', borderRadius: '20px',
                      padding: '2px 8px', fontSize: '12px', fontWeight: 700,
                    }}>
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#737373' }}>
                  {c.lastMessageAt
                    ? format(parseISO(c.lastMessageAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })
                    : '—'}
                </p>
              </button>
            ))}
          </div>
        )
      )}

      {/* Thread de mensagens */}
      {selected && (
        <div>
          <button
            onClick={() => { setSelected(null); setMessages([]); }}
            style={{ background: 'none', border: 'none', color: '#737373', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', minHeight: '44px', padding: 0 }}
          >
            ← Voltar
          </button>

          {loadingMessages ? (
            <CardSkeleton />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display:      'flex',
                    flexDirection: m.direction === 'outbound' ? 'row-reverse' : 'row',
                  }}
                >
                  <div style={{
                    maxWidth:        '75%',
                    padding:         '12px 14px',
                    borderRadius:    m.direction === 'outbound' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    backgroundColor: m.direction === 'outbound' ? '#b8860b' : '#f5f5f5',
                    color:           m.direction === 'outbound' ? '#ffffff' : '#171717',
                  }}>
                    <p style={{ fontSize: '14px', marginBottom: '4px' }}>{m.body}</p>
                    <p style={{ fontSize: '11px', opacity: 0.7 }}>
                      {format(parseISO(m.createdAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Campo de resposta */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 2000))}
              placeholder="Responder..."
              aria-label="Escrever resposta"
              style={{
                flex: 1, minHeight: '52px', maxHeight: '120px', padding: '12px',
                fontSize: '15px', borderRadius: '12px', border: '1.5px solid #d4d4d4',
                resize: 'vertical', outline: 'none',
              }}
            />
            <button
              onClick={handleReply}
              disabled={sending || !replyText.trim()}
              aria-label="Enviar resposta"
              style={{
                width: '52px', height: '52px', borderRadius: '12px', border: 'none',
                backgroundColor: sending || !replyText.trim() ? '#d4d4d4' : '#b8860b',
                color: '#ffffff', cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer',
                fontSize: '20px', flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#a3a3a3', marginTop: '4px' }}>
            {replyText.length}/2000 caracteres
          </p>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #f5f5f5', width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '14px', fontWeight: 500, color: '#404040', marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: '15px', borderRadius: '10px',
  border: '1.5px solid #d4d4d4', outline: 'none', display: 'block',
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', height: '48px', backgroundColor: disabled ? '#d4d4d4' : '#b8860b',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const alertStyle: React.CSSProperties = {
  marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '14px',
};

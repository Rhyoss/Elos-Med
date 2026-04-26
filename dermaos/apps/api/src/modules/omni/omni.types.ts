/* ── Row types (camada DB) ─────────────────────────────────────────────── */

export interface ContactRow {
  id:                string;
  clinic_id:         string;
  patient_id:        string | null;
  type:              'patient' | 'lead' | 'anonymous' | 'bot';
  status:            'active' | 'inactive' | 'blocked' | 'opted_out';
  name:              string;
  phone:             string | null;
  email:             string | null;
  external_ids:      Record<string, string>;
  tags:              string[];
  last_contacted_at: string | null;
  created_at:        string;
  updated_at:        string;
}

export interface ChannelRow {
  id:          string;
  clinic_id:   string;
  type:        'whatsapp' | 'instagram' | 'email' | 'sms' | 'webchat' | 'phone';
  name:        string;
  is_active:   boolean;
  config:      Record<string, unknown>;
  ai_agent_id: string | null;
}

export interface ConversationRow {
  id:                    string;
  clinic_id:             string;
  contact_id:            string;
  channel_id:            string;
  assigned_to:           string | null;
  status:                'open' | 'pending' | 'resolved' | 'spam' | 'archived';
  priority:              'low' | 'normal' | 'high' | 'urgent';
  subject:               string | null;
  last_message_at:       string | null;
  last_message_preview:  string | null;
  unread_count:          number;
  tags:                  string[];
  metadata:              Record<string, unknown>;
  resolved_at:           string | null;
  resolved_by:           string | null;
  created_at:            string;
  updated_at:            string;
}

export interface MessageRow {
  id:                  string;
  clinic_id:           string;
  conversation_id:     string;
  sender_type:         'patient' | 'user' | 'ai_agent' | 'system';
  sender_user_id:      string | null;
  sender_agent_id:     string | null;
  content_type:        'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
  content:             string | null;
  media_url:           string | null;
  media_metadata:      Record<string, unknown>;
  status:              'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  external_message_id: string | null;
  sent_at:             string | null;
  delivered_at:        string | null;
  read_at:             string | null;
  is_internal_note:    boolean;
  created_at:          string;
  updated_at:          string;
}

/* ── Public types (camada app) ─────────────────────────────────────────── */

export interface ConversationCard {
  id:                  string;
  contactId:           string;
  contactName:         string;
  contactPatientId:    string | null;
  channelId:           string;
  channelType:         ChannelRow['type'];
  channelName:         string;
  status:              ConversationRow['status'];
  priority:            ConversationRow['priority'];
  assignedTo:          string | null;
  assignedToName:      string | null;
  unreadCount:         number;
  lastMessageAt:       Date | null;
  lastMessagePreview:  string | null;
  tags:                string[];
}

export interface ConversationDetail extends ConversationCard {
  subject:      string | null;
  metadata:     Record<string, unknown>;
  resolvedAt:   Date | null;
  resolvedBy:   string | null;
  createdAt:    Date;
  updatedAt:    Date;
}

export interface MessagePublic {
  id:                string;
  conversationId:    string;
  senderType:        MessageRow['sender_type'];
  senderUserId:      string | null;
  senderAgentId:     string | null;
  senderName:        string | null;
  contentType:       MessageRow['content_type'];
  content:           string | null;
  mediaUrl:          string | null;
  mediaMetadata:     Record<string, unknown>;
  status:            MessageRow['status'];
  externalMessageId: string | null;
  sentAt:            Date | null;
  deliveredAt:       Date | null;
  readAt:            Date | null;
  isInternalNote:    boolean;
  createdAt:         Date;
}

export interface ContactContext {
  id:             string;
  patientId:      string | null;
  type:           ContactRow['type'];
  name:           string;
  phone:          string | null;
  email:          string | null;
  tags:           string[];
  /** populado só se contact.patient_id != null */
  patient:        {
    id:            string;
    name:          string;
    totalVisits:   number;
    lastVisitAt:   Date | null;
    recentEncounters: Array<{ id: string; encounteredAt: Date; summary: string | null }>;
    nextAppointment: { id: string; scheduledAt: Date; type: string } | null;
  } | null;
  /** se lead, pontuação vem de metadata ou cálculo externo */
  leadScore:      number | null;
}

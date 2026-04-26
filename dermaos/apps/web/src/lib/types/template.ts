export interface TemplateRow {
  id:           string;
  clinic_id:    string;
  name:         string;
  channel_type: string | null;
  body:         string;
  body_html:    string | null;
  subject:      string | null;
  external_id:  string | null;
  is_default:   boolean;
  is_active:    boolean;
  created_at:   string;
  updated_at:   string;
  created_by:   string | null;
}

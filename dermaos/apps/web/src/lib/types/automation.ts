export interface AutomationRow {
  id:            string;
  clinic_id:     string;
  name:          string;
  trigger:       string;
  template_id:   string | null;
  channel_id:    string | null;
  delay_minutes: number;
  conditions:    unknown[];
  is_active:     boolean;
  run_count:     number;
  last_run_at:   string | null;
  created_at:    string;
  updated_at:    string;
  created_by:    string | null;
  template_name: string | null;
  channel_name:  string | null;
  channel_type:  string | null;
  last_exec_at?:     string | null;
  last_exec_status?: string | null;
}

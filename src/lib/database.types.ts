export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      calendar_connections: {
        Row: {
          calendar_id: string;
          calendar_summary: string | null;
          connection_status: string;
          created_at: string | null;
          is_enabled: boolean;
          last_synced_at: string | null;
          provider: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          calendar_id?: string;
          calendar_summary?: string | null;
          connection_status?: string;
          created_at?: string | null;
          is_enabled?: boolean;
          last_synced_at?: string | null;
          provider?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          calendar_id?: string;
          calendar_summary?: string | null;
          connection_status?: string;
          created_at?: string | null;
          is_enabled?: boolean;
          last_synced_at?: string | null;
          provider?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          accent: string;
          key: string;
          label_en: string;
          label_zh: string;
          order_index: number;
        };
        Insert: {
          accent: string;
          key: string;
          label_en: string;
          label_zh: string;
          order_index?: number;
        };
        Update: {
          accent?: string;
          key?: string;
          label_en?: string;
          label_zh?: string;
          order_index?: number;
        };
        Relationships: [];
      };
      items: {
        Row: {
          created_at: string | null;
          due_date: string | null;
          end_at: string | null;
          estimated_minutes: number | null;
          google_event_id: string | null;
          group_key: string;
          id: string;
          is_all_day: boolean;
          needs_confirmation: boolean;
          notes: string | null;
          parse_confidence: number | null;
          priority: string;
          source_text: string | null;
          start_at: string | null;
          status: string;
          sync_state: string;
          title: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          due_date?: string | null;
          end_at?: string | null;
          estimated_minutes?: number | null;
          google_event_id?: string | null;
          group_key?: string;
          id?: string;
          is_all_day?: boolean;
          needs_confirmation?: boolean;
          notes?: string | null;
          parse_confidence?: number | null;
          priority?: string;
          source_text?: string | null;
          start_at?: string | null;
          status?: string;
          sync_state?: string;
          title: string;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          due_date?: string | null;
          end_at?: string | null;
          estimated_minutes?: number | null;
          google_event_id?: string | null;
          group_key?: string;
          id?: string;
          is_all_day?: boolean;
          needs_confirmation?: boolean;
          notes?: string | null;
          parse_confidence?: number | null;
          priority?: string;
          source_text?: string | null;
          start_at?: string | null;
          status?: string;
          sync_state?: string;
          title?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

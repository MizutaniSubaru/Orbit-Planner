import type { Database } from '@/lib/database.types';
import type {
  EVENT_STATUSES,
  GROUPS,
  PRIORITIES,
  TODO_STATUSES,
} from '@/lib/constants';

export type Item = Database['public']['Tables']['items']['Row'];
export type CalendarConnection =
  Database['public']['Tables']['calendar_connections']['Row'];
export type GroupKey = (typeof GROUPS)[number]['key'];
export type Priority = (typeof PRIORITIES)[number];
export type TodoStatus = (typeof TODO_STATUSES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

export type ItemType = 'todo' | 'event';

export type ParseResult = {
  ambiguity_reason: string | null;
  confidence: number;
  due_date: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  group_key: GroupKey;
  is_all_day: boolean;
  needs_confirmation: boolean;
  notes: string;
  priority: Priority;
  start_at: string | null;
  title: string;
  type: ItemType;
};

export type CreateItemPayload = {
  due_date: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  google_access_token?: string | null;
  group_key: GroupKey;
  is_all_day: boolean;
  notes: string;
  parse_confidence: number | null;
  priority: Priority;
  source_text: string;
  start_at: string | null;
  status: string;
  title: string;
  type: ItemType;
};

export type UpdateItemPayload = Partial<CreateItemPayload> & {
  google_access_token?: string | null;
  status?: string;
};

export type LocaleCopy = {
  actions: {
    analyze: string;
    cancel: string;
    connectGoogle: string;
    create: string;
    delete: string;
    refresh: string;
    save: string;
    signIn: string;
    signOut: string;
  };
  badges: {
    aiSuggested: string;
    allDay: string;
    demoFallback: string;
    googleReady: string;
    localOnly: string;
    needsConfirmation: string;
  };
  labels: {
    dueDate: string;
    end: string;
    estimatedMinutes: string;
    group: string;
    notes: string;
    priority: string;
    source: string;
    start: string;
    status: string;
    title: string;
    type: string;
  };
  sections: {
    calendar: string;
    confirmation: string;
    editor: string;
    intake: string;
    todo: string;
  };
};

'use client';

import {
  type Dispatch,
  type SetStateAction,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { CalendarMonth } from '@/components/calendar-month';
import { CalendarWeek } from '@/components/calendar-week';
import { ItemEditor } from '@/components/item-editor';
import {
  CALENDAR_VIEWS,
  DEFAULT_TIMEZONE,
  GROUPS,
  PRIORITIES,
} from '@/lib/constants';
import { COPY } from '@/lib/copy';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { sortItems, toDateInputValue, toDateTimeInputValue } from '@/lib/time';
import type {
  CalendarConnection,
  Item,
  ItemType,
  ParseResult,
  Priority,
} from '@/lib/types';

type ComposerPanelProps = {
  busy: boolean;
  copy: typeof COPY.en;
  locale: string;
  onAnalyze: () => void;
  onConnectGoogle: () => void;
  onSignOut: () => void;
  providerTokenAvailable: boolean;
  session: Session;
  setComposerText: (value: string) => void;
  text: string;
  connection: CalendarConnection | null;
};

type ConfirmationPanelProps = {
  busy: boolean;
  copy: typeof COPY.en;
  draft: ParseResult | null;
  locale: string;
  mode: 'ai' | 'fallback' | null;
  onChange: (draft: ParseResult) => void;
  onCreate: () => void;
  onReset: () => void;
  sourceText: string;
};

type TodoRailProps = {
  copy: typeof COPY.en;
  items: Item[];
  locale: string;
  onQuickStatus: (item: Item, status: string) => void;
  onSelectItem: (item: Item) => void;
  search: string;
  setGroupFilter: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  statusFilter: string;
  groupFilter: string;
  priorityFilter: string;
};

function resolveLocale() {
  if (typeof navigator === 'undefined') {
    return 'zh-CN';
  }

  return navigator.language?.startsWith('zh') ? 'zh-CN' : navigator.language || 'en-US';
}

function resolveCopy(locale: string) {
  return locale.startsWith('zh') ? COPY.zh : COPY.en;
}

async function loadWorkspaceSnapshot(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string
) {
  const [{ data: nextItems }, { data: nextConnection }] = await Promise.all([
    supabase.from('items').select('*').order('created_at', { ascending: false }),
    supabase.from('calendar_connections').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  return {
    connection: (nextConnection as CalendarConnection | null) ?? null,
    items: sortItems((nextItems ?? []) as Item[]),
  };
}

async function syncWorkspaceState(input: {
  activeSession: Session | null;
  setConnection: Dispatch<SetStateAction<CalendarConnection | null>>;
  setItems: Dispatch<SetStateAction<Item[]>>;
  setSelectedItem: Dispatch<SetStateAction<Item | null>>;
  supabase: ReturnType<typeof getSupabaseClient>;
}) {
  const { activeSession, setConnection, setItems, setSelectedItem, supabase } = input;

  if (!supabase || !activeSession?.user) {
    setItems([]);
    setConnection(null);
    setSelectedItem(null);
    return;
  }

  const snapshot = await loadWorkspaceSnapshot(supabase, activeSession.user.id);
  setItems(snapshot.items);
  setConnection(snapshot.connection);
  setSelectedItem((current) =>
    current ? snapshot.items.find((item) => item.id === current.id) ?? null : null
  );
}

function toIsoOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function LandingScreen({
  configured,
  copy,
  onSignIn,
}: {
  configured: boolean;
  copy: typeof COPY.en;
  onSignIn: () => void;
}) {
  return (
    <main className="landing-shell">
      <div className="landing-shell__glow" />
      <section className="landing-card">
        <p className="landing-card__eyebrow">AI planner / natural-language calendar</p>
        <h1 className="landing-card__title">
          Calendar intelligence without manual time surgery.
        </h1>
        <p className="landing-card__body">
          Describe a task the way you think. The system decides whether it belongs on the
          calendar or in the to-do rail, then drafts time, group, priority, and sync state
          before you confirm.
        </p>
        <div className="landing-card__actions">
          <button
            className="planner-button"
            disabled={!configured}
            onClick={onSignIn}
            type="button"
          >
            {copy.actions.signIn}
          </button>
          {!configured ? (
            <p className="landing-card__hint">
              Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` first.
            </p>
          ) : (
            <p className="landing-card__hint">
              Google login also grants the token used for one-way Calendar sync.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function ComposerPanel({
  busy,
  connection,
  copy,
  locale,
  onAnalyze,
  onConnectGoogle,
  onSignOut,
  providerTokenAvailable,
  session,
  setComposerText,
  text,
}: ComposerPanelProps) {
  return (
    <section className="planner-panel planner-panel--intake">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.intake}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '一句话录入你的安排' : 'Describe the plan once'}
          </h2>
        </div>
        <button className="planner-button planner-button--ghost" onClick={onSignOut} type="button">
          {copy.actions.signOut}
        </button>
      </div>

      <div className="planner-stack">
        <div className="status-strip">
          <div>
            <strong>{session.user.email}</strong>
            <span>{locale.startsWith('zh') ? '当前工作区' : 'Current workspace'}</span>
          </div>
          <div>
            <strong>
              {connection?.is_enabled
                ? copy.badges.googleReady
                : locale.startsWith('zh')
                  ? '尚未连接 Google 日历'
                  : 'Google Calendar not connected'}
            </strong>
            <span>
              {connection?.calendar_summary ??
                (locale.startsWith('zh') ? '仅本地保存' : 'Saving locally')}
            </span>
          </div>
        </div>

        <textarea
          className="composer-textarea"
          onChange={(event) => setComposerText(event.target.value)}
          placeholder={
            locale.startsWith('zh')
              ? '例如：明天下午 3 点和导师开会；或者：记得买打印纸'
              : 'Try: Meet my advisor tomorrow at 3pm, or Buy printer paper'
          }
          rows={5}
          value={text}
        />

        <div className="composer-actions">
          <button
            className="planner-button"
            disabled={!text.trim() || busy}
            onClick={onAnalyze}
            type="button"
          >
            {copy.actions.analyze}
          </button>
          <button
            className="planner-button planner-button--ghost"
            disabled={!providerTokenAvailable || busy}
            onClick={onConnectGoogle}
            type="button"
          >
            {copy.actions.connectGoogle}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmationPanel({
  busy,
  copy,
  draft,
  locale,
  mode,
  onChange,
  onCreate,
  onReset,
  sourceText,
}: ConfirmationPanelProps) {
  if (!draft) {
    return (
      <section className="planner-panel planner-panel--confirmation">
        <div className="planner-panel__header">
          <div>
            <p className="planner-panel__eyebrow">{copy.sections.confirmation}</p>
            <h2 className="planner-panel__title">
              {locale.startsWith('zh') ? '等待 AI 解析结果' : 'Waiting for structured output'}
            </h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="planner-panel planner-panel--confirmation">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.confirmation}</p>
          <h2 className="planner-panel__title">{draft.title}</h2>
        </div>
        <div className="planner-badges">
          <span className="planner-badge">
            {mode === 'fallback' ? copy.badges.demoFallback : copy.badges.aiSuggested}
          </span>
          {draft.needs_confirmation ? (
            <span className="planner-badge planner-badge--warning">
              {copy.badges.needsConfirmation}
            </span>
          ) : null}
        </div>
      </div>

      <div className="editor-grid">
        <label className="field">
          <span>{copy.labels.title}</span>
          <input
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            value={draft.title}
          />
        </label>

        <label className="field">
          <span>{copy.labels.type}</span>
          <select
            onChange={(event) =>
              onChange({ ...draft, type: event.target.value as ItemType })
            }
            value={draft.type}
          >
            <option value="todo">todo</option>
            <option value="event">event</option>
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.group}</span>
          <select
            onChange={(event) =>
              onChange({
                ...draft,
                group_key: event.target.value as ParseResult['group_key'],
              })
            }
            value={draft.group_key}
          >
            {GROUPS.map((group) => (
              <option key={group.key} value={group.key}>
                {locale.startsWith('zh') ? group.labelZh : group.labelEn}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.priority}</span>
          <select
            onChange={(event) =>
              onChange({
                ...draft,
                priority: event.target.value as Priority,
              })
            }
            value={draft.priority}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>{copy.labels.estimatedMinutes}</span>
          <input
            min={0}
            onChange={(event) =>
              onChange({
                ...draft,
                estimated_minutes: Number(event.target.value || 0),
              })
            }
            type="number"
            value={draft.estimated_minutes ?? 0}
          />
        </label>

        <label className="field field--checkbox">
          <span>{copy.badges.allDay}</span>
          <input
            checked={draft.is_all_day}
            onChange={(event) =>
              onChange({
                ...draft,
                end_at: event.target.checked ? null : draft.end_at,
                is_all_day: event.target.checked,
                start_at: event.target.checked ? null : draft.start_at,
              })
            }
            type="checkbox"
          />
        </label>

        <label className="field">
          <span>{copy.labels.dueDate}</span>
          <input
            onChange={(event) =>
              onChange({
                ...draft,
                due_date: event.target.value || null,
              })
            }
            type="date"
            value={draft.due_date ?? toDateInputValue(draft.start_at)}
          />
        </label>

        {!draft.is_all_day ? (
          <>
            <label className="field">
              <span>{copy.labels.start}</span>
              <input
                onChange={(event) =>
                  onChange({
                    ...draft,
                    start_at: event.target.value || null,
                  })
                }
                type="datetime-local"
                value={toDateTimeInputValue(draft.start_at)}
              />
            </label>

            <label className="field">
              <span>{copy.labels.end}</span>
              <input
                onChange={(event) =>
                  onChange({
                    ...draft,
                    end_at: event.target.value || null,
                  })
                }
                type="datetime-local"
                value={toDateTimeInputValue(draft.end_at)}
              />
            </label>
          </>
        ) : null}

        <label className="field field--full">
          <span>{copy.labels.notes}</span>
          <textarea
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            rows={4}
            value={draft.notes}
          />
        </label>

        <label className="field field--full">
          <span>{copy.labels.source}</span>
          <textarea readOnly rows={3} value={sourceText} />
        </label>
      </div>

      {draft.ambiguity_reason ? (
        <p className="panel-note panel-note--warning">{draft.ambiguity_reason}</p>
      ) : null}

      <div className="editor-actions">
        <button className="planner-button planner-button--ghost" onClick={onReset} type="button">
          {copy.actions.cancel}
        </button>
        <button className="planner-button" disabled={busy} onClick={onCreate} type="button">
          {copy.actions.create}
        </button>
      </div>
    </section>
  );
}

function TodoRail({
  copy,
  groupFilter,
  items,
  locale,
  onQuickStatus,
  onSelectItem,
  priorityFilter,
  search,
  setGroupFilter,
  setPriorityFilter,
  setSearch,
  setStatusFilter,
  statusFilter,
}: TodoRailProps) {
  return (
    <section className="planner-panel planner-panel--todo">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">{copy.sections.todo}</p>
          <h2 className="planner-panel__title">
            {locale.startsWith('zh') ? '待办筛选与执行' : 'To-do filter rail'}
          </h2>
        </div>
      </div>

      <div className="todo-filters">
        <input
          onChange={(event) => setSearch(event.target.value)}
          placeholder={locale.startsWith('zh') ? '搜索标题或备注' : 'Search title or notes'}
          value={search}
        />
        <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
          <option value="all">{locale.startsWith('zh') ? '全部状态' : 'All statuses'}</option>
          <option value="pending">pending</option>
          <option value="completed">completed</option>
          <option value="scheduled">scheduled</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select onChange={(event) => setGroupFilter(event.target.value)} value={groupFilter}>
          <option value="all">{locale.startsWith('zh') ? '全部分组' : 'All groups'}</option>
          {GROUPS.map((group) => (
            <option key={group.key} value={group.key}>
              {locale.startsWith('zh') ? group.labelZh : group.labelEn}
            </option>
          ))}
        </select>
        <select
          onChange={(event) => setPriorityFilter(event.target.value)}
          value={priorityFilter}
        >
          <option value="all">{locale.startsWith('zh') ? '全部优先级' : 'All priorities'}</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </div>

      <div className="todo-list">
        {items.length === 0 ? (
          <p className="todo-list__empty">
            {locale.startsWith('zh') ? '当前筛选条件下没有事项。' : 'No items match the current filter.'}
          </p>
        ) : null}
        {items.map((item) => (
          <article className="todo-card" key={item.id}>
            <button className="todo-card__main" onClick={() => onSelectItem(item)} type="button">
              <span className={`todo-card__dot todo-card__dot--${item.priority}`} />
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.type} · {item.group_key} · {item.status}
                </p>
              </div>
            </button>
            <div className="todo-card__actions">
              {item.status !== 'completed' ? (
                <button onClick={() => onQuickStatus(item, 'completed')} type="button">
                  {locale.startsWith('zh') ? '完成' : 'Complete'}
                </button>
              ) : (
                <button onClick={() => onQuickStatus(item, item.type === 'event' ? 'scheduled' : 'pending')} type="button">
                  {locale.startsWith('zh') ? '恢复' : 'Reopen'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PlannerApp() {
  const supabase = getSupabaseClient();
  const configured = isSupabaseConfigured();
  const [locale, setLocale] = useState(resolveLocale);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [composerText, setComposerText] = useState('');
  const [draft, setDraft] = useState<ParseResult | null>(null);
  const [parseMode, setParseMode] = useState<'ai' | 'fallback' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [calendarView, setCalendarView] = useState<(typeof CALENDAR_VIEWS)[number]>('month');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const deferredSearch = useDeferredValue(search);
  const copy = resolveCopy(locale);

  useEffect(() => {
    setLocale(resolveLocale());

    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE);
    } catch {
      setTimezone(DEFAULT_TIMEZONE);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      startTransition(() => {
        void syncWorkspaceState({
          activeSession: data.session,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      startTransition(() => {
        void syncWorkspaceState({
          activeSession: nextSession,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function authedRequest(path: string, init?: RequestInit) {
    if (!session?.access_token) {
      throw new Error('Missing auth session.');
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'Request failed.');
    }

    return payload;
  }

  async function handleSignIn() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signInWithOAuth({
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
      },
      provider: 'google',
    });
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setDraft(null);
    setComposerText('');
    setMessage(null);
  }

  async function handleAnalyze() {
    if (!composerText.trim()) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch('/api/nl/parse', {
        body: JSON.stringify({
          locale,
          text: composerText,
          timezone,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to analyze request.');
      }

      setDraft(payload.result as ParseResult);
      setParseMode(payload.mode as 'ai' | 'fallback');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to analyze request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!draft) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest('/api/items', {
        body: JSON.stringify({
          ...draft,
          due_date: draft.is_all_day
            ? draft.due_date ?? toDateInputValue(draft.start_at)
            : draft.due_date,
          end_at: draft.is_all_day ? null : toIsoOrNull(draft.end_at),
          google_access_token: session?.provider_token ?? null,
          parse_confidence: draft.confidence,
          source_text: composerText,
          start_at: draft.is_all_day ? null : toIsoOrNull(draft.start_at),
          status: draft.type === 'event' ? 'scheduled' : 'pending',
          timezone,
        }),
        method: 'POST',
      });

      setComposerText('');
      setDraft(null);
      setParseMode(null);
      setMessage(locale.startsWith('zh') ? '事项已创建。' : 'Item created.');

      startTransition(() => {
        void syncWorkspaceState({
          activeSession: session,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectGoogle() {
    if (!session?.provider_token) {
      setMessage(
        locale.startsWith('zh')
          ? '当前会话没有 Google provider token，请重新登录。'
          : 'No Google provider token was found. Please sign in again.'
      );
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await authedRequest('/api/google-calendar/connect', {
        body: JSON.stringify({
          google_access_token: session.provider_token,
        }),
        method: 'POST',
      });
      setMessage(
        locale.startsWith('zh')
          ? 'Google Calendar 已连接。'
          : 'Google Calendar is connected.'
      );
      startTransition(() => {
        void syncWorkspaceState({
          activeSession: session,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to connect Google Calendar.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveItem(item: Item) {
    setBusy(true);
    setMessage(null);

    try {
      await authedRequest(`/api/items/${item.id}`, {
        body: JSON.stringify({
          due_date: item.is_all_day ? item.due_date : item.due_date,
          end_at: item.is_all_day ? null : toIsoOrNull(item.end_at),
          estimated_minutes: item.estimated_minutes,
          google_access_token: session?.provider_token ?? null,
          group_key: item.group_key,
          is_all_day: item.is_all_day,
          notes: item.notes,
          parse_confidence: item.parse_confidence,
          priority: item.priority,
          source_text: item.source_text,
          start_at: item.is_all_day ? null : toIsoOrNull(item.start_at),
          status: item.status,
          timezone,
          title: item.title,
          type: item.type,
        }),
        method: 'PATCH',
      });
      setMessage(locale.startsWith('zh') ? '事项已更新。' : 'Item updated.');
      startTransition(() => {
        void syncWorkspaceState({
          activeSession: session,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteItem(item: Item) {
    setBusy(true);
    setMessage(null);

    try {
      await authedRequest(`/api/items/${item.id}`, {
        body: JSON.stringify({
          google_access_token: session?.provider_token ?? null,
        }),
        method: 'DELETE',
      });
      setSelectedItem(null);
      setMessage(locale.startsWith('zh') ? '事项已删除。' : 'Item deleted.');
      startTransition(() => {
        void syncWorkspaceState({
          activeSession: session,
          setConnection,
          setItems,
          setSelectedItem,
          supabase,
        });
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete item.');
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickStatus(item: Item, status: string) {
    await handleSaveItem({ ...item, status });
  }

  const calendarItems = items.filter(
    (item) => item.type === 'event' || (item.is_all_day && Boolean(item.due_date))
  );

  const filteredTodos = sortItems(
    items.filter((item) => {
      const haystack = `${item.title} ${item.notes ?? ''}`.toLowerCase();

      if (deferredSearch.trim() && !haystack.includes(deferredSearch.toLowerCase())) {
        return false;
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (groupFilter !== 'all' && item.group_key !== groupFilter) {
        return false;
      }

      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }

      return true;
    })
  );

  if (!configured || !session) {
    return (
      <LandingScreen configured={configured} copy={copy} onSignIn={() => void handleSignIn()} />
    );
  }

  return (
    <main className="planner-shell">
      <div className="planner-shell__halo planner-shell__halo--one" />
      <div className="planner-shell__halo planner-shell__halo--two" />

      <section className="planner-hero">
        <div>
          <p className="planner-hero__eyebrow">Task calendar management / AI intake</p>
          <h1 className="planner-hero__title">
            {locale.startsWith('zh')
              ? '自然语言直接生成日历与待办'
              : 'Natural language, straight into calendar and to-do views'}
          </h1>
        </div>
        <div className="planner-hero__controls">
          {CALENDAR_VIEWS.map((view) => (
            <button
              className={`planner-tab ${calendarView === view ? 'is-active' : ''}`}
              key={view}
              onClick={() => setCalendarView(view)}
              type="button"
            >
              {view}
            </button>
          ))}
          <button
            className="planner-button planner-button--ghost"
            onClick={() =>
              startTransition(() => {
                void syncWorkspaceState({
                  activeSession: session,
                  setConnection,
                  setItems,
                  setSelectedItem,
                  supabase,
                });
              })
            }
            type="button"
          >
            {copy.actions.refresh}
          </button>
        </div>
      </section>

      {message ? <div className="planner-toast">{message}</div> : null}

      <section className="planner-grid planner-grid--top">
        <ComposerPanel
          busy={busy}
          connection={connection}
          copy={copy}
          locale={locale}
          onAnalyze={() => void handleAnalyze()}
          onConnectGoogle={() => void handleConnectGoogle()}
          onSignOut={() => void handleSignOut()}
          providerTokenAvailable={Boolean(session.provider_token)}
          session={session}
          setComposerText={setComposerText}
          text={composerText}
        />
        <ConfirmationPanel
          busy={busy}
          copy={copy}
          draft={draft}
          locale={locale}
          mode={parseMode}
          onChange={setDraft}
          onCreate={() => void handleCreate()}
          onReset={() => {
            setDraft(null);
            setParseMode(null);
          }}
          sourceText={composerText}
        />
      </section>

      <section className="planner-grid planner-grid--bottom">
        {calendarView === 'month' ? (
          <CalendarMonth
            focusDate={focusDate}
            items={calendarItems}
            locale={locale}
            onFocusDateChange={setFocusDate}
            onSelectItem={setSelectedItem}
          />
        ) : (
          <CalendarWeek
            focusDate={focusDate}
            items={calendarItems}
            locale={locale}
            onFocusDateChange={setFocusDate}
            onSelectItem={setSelectedItem}
          />
        )}
        <TodoRail
          copy={copy}
          groupFilter={groupFilter}
          items={filteredTodos}
          locale={locale}
          onQuickStatus={(item, status) => void handleQuickStatus(item, status)}
          onSelectItem={setSelectedItem}
          priorityFilter={priorityFilter}
          search={search}
          setGroupFilter={setGroupFilter}
          setPriorityFilter={setPriorityFilter}
          setSearch={setSearch}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
        />
      </section>

      <ItemEditor
        item={selectedItem}
        locale={locale}
        onChange={setSelectedItem}
        onDelete={(item) => void handleDeleteItem(item)}
        onSave={(item) => void handleSaveItem(item)}
      />
    </main>
  );
}

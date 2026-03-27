'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core';
import zhCnLocale from '@fullcalendar/core/locales/zh-cn';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { GROUPS } from '@/lib/constants';
import type { Item } from '@/lib/types';

type CalendarFullProps = {
  calendarView: 'month' | 'week';
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item) => void;
};

const groupAccentMap = new Map<string, string>(
  GROUPS.map((group) => [group.key, group.accent])
);

function resolveStart(item: Item) {
  if (item.is_all_day) {
    return item.due_date ?? item.start_at ?? item.created_at;
  }

  return item.start_at ?? item.created_at;
}

const HARMONIOUS_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
];

function getEventColor(item: Item) {
  // 通过事项 ID 生成固定的 Hash，确保渲染出来的颜色不会在每次 React 更新时发生闪烁改变
  const hash = String(item.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return HARMONIOUS_COLORS[hash % HARMONIOUS_COLORS.length];
}

function toCalendarEvent(item: Item): EventInput | null {
  const start = resolveStart(item);

  if (!start) {
    return null;
  }

  const accent = getEventColor(item);

  return {
    allDay: item.is_all_day,
    backgroundColor: `${accent}22`,
    borderColor: accent,
    end: item.is_all_day ? undefined : item.end_at ?? undefined,
    extendedProps: {
      sourceItem: item,
    },
    id: String(item.id),
    start,
    textColor: '#14213d',
    title: item.title,
  };
}

function sameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function CalendarFull({
  calendarView,
  focusDate,
  items,
  locale,
  onFocusDateChange,
  onSelectItem,
}: CalendarFullProps) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const events = useMemo(
    () =>
      items
        .map((item) => toCalendarEvent(item))
        .filter((event): event is EventInput => Boolean(event)),
    [items]
  );

  const isChinese = locale.startsWith('zh');
  const viewName = calendarView === 'month' ? 'dayGridMonth' : 'timeGridWeek';

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    if (calendarApi.view.type !== viewName) {
      calendarApi.changeView(viewName);
    }
  }, [viewName]);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    const currentDate = calendarApi.getDate();
    if (!sameDate(currentDate, focusDate)) {
      calendarApi.gotoDate(focusDate);
    }
  }, [focusDate]);

  function handleDatesSet(args: DatesSetArg) {
    const calendarApi = calendarRef.current?.getApi();

    if (calendarApi) {
      const activeDate = calendarApi.getDate();
      if (!sameDate(activeDate, focusDate)) {
        onFocusDateChange(activeDate);
      }
    }
  }

  function handleEventClick(args: EventClickArg) {
    const sourceItem = args.event.extendedProps.sourceItem as Item | undefined;
    if (sourceItem) {
      onSelectItem(sourceItem);
    }
  }

  return (
    <section className="planner-panel planner-panel--calendar">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">
            {isChinese ? '日历视图（FullCalendar）' : 'Calendar view (FullCalendar)'}
          </p>
        </div>
      </div>

      <div className="planner-fullcalendar">
        <FullCalendar
          buttonText={{
            month: isChinese ? '月' : 'Month',
            today: isChinese ? '今天' : 'Today',
            week: isChinese ? '周' : 'Week',
          }}
          datesSet={handleDatesSet}
          dayMaxEvents={3}
          eventClick={handleEventClick}
          events={events}
          firstDay={1}
          headerToolbar={{
            center: 'title',
            left: 'prev,next today',
            right: 'dayGridMonth,timeGridWeek',
          }}
          height="auto"
          initialDate={focusDate}
          initialView={viewName}
          locale={isChinese ? 'zh-cn' : 'en'}
          locales={[zhCnLocale]}
          plugins={[dayGridPlugin, timeGridPlugin]}
          ref={calendarRef}
        />
      </div>
    </section>
  );
}

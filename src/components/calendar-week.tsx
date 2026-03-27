'use client';

import { GROUPS, WEEKDAY_NAMES_EN, WEEKDAY_NAMES_ZH } from '@/lib/constants';
import { getWeekRange, isItemOnDate } from '@/lib/time';
import type { Item } from '@/lib/types';

type CalendarWeekProps = {
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item) => void;
};

const groupAccentMap = new Map<string, string>(
  GROUPS.map((group) => [group.key, group.accent])
);

function renderTimeLabel(locale: string, item: Item) {
  if (item.is_all_day) {
    return locale.startsWith('zh') ? '全天' : 'All-day';
  }

  if (!item.start_at) {
    return locale.startsWith('zh') ? '待安排' : 'Unscheduled';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(item.start_at));
}

export function CalendarWeek({
  focusDate,
  items,
  locale,
  onFocusDateChange,
  onSelectItem,
}: CalendarWeekProps) {
  const week = getWeekRange(focusDate);
  const weekdayNames = locale.startsWith('zh') ? WEEKDAY_NAMES_ZH : WEEKDAY_NAMES_EN;

  return (
    <section className="planner-panel planner-panel--calendar">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">
            {locale.startsWith('zh') ? '周视图' : 'Week view'}
          </p>
          <h2 className="planner-panel__title">
            {new Intl.DateTimeFormat(locale, {
              month: 'short',
              day: 'numeric',
            }).format(week[0])}{' '}
            -{' '}
            {new Intl.DateTimeFormat(locale, {
              month: 'short',
              day: 'numeric',
            }).format(week[6])}
          </h2>
        </div>
        <div className="planner-nav">
          <button
            className="planner-nav__button"
            onClick={() => onFocusDateChange(new Date(focusDate.getTime() - 7 * 86400000))}
            type="button"
          >
            {locale.startsWith('zh') ? '上周' : 'Prev'}
          </button>
          <button
            className="planner-nav__button"
            onClick={() => onFocusDateChange(new Date())}
            type="button"
          >
            {locale.startsWith('zh') ? '本周' : 'This week'}
          </button>
          <button
            className="planner-nav__button"
            onClick={() => onFocusDateChange(new Date(focusDate.getTime() + 7 * 86400000))}
            type="button"
          >
            {locale.startsWith('zh') ? '下周' : 'Next'}
          </button>
        </div>
      </div>

      <div className="week-grid">
        {week.map((day, index) => {
          const dayItems = items
            .filter((item) => isItemOnDate(item, day))
            .sort((left, right) => {
              const leftTime = left.start_at ? new Date(left.start_at).getTime() : 0;
              const rightTime = right.start_at ? new Date(right.start_at).getTime() : 0;
              return leftTime - rightTime;
            });

          return (
            <section
              className={`week-grid__day ${
                day.toDateString() === new Date().toDateString() ? 'is-today' : ''
              }`}
              key={day.toISOString()}
            >
              <header className="week-grid__header">
                <span>{weekdayNames[index]}</span>
                <strong>{day.getDate()}</strong>
              </header>

              <div className="week-grid__items">
                {dayItems.length === 0 ? (
                  <p className="week-grid__empty">
                    {locale.startsWith('zh') ? '暂无安排' : 'No plans'}
                  </p>
                ) : null}

                {dayItems.map((item) => (
                  <button
                    className="week-grid__item"
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    style={{
                      background: `${groupAccentMap.get(item.group_key) ?? '#14213d'}18`,
                      borderColor: groupAccentMap.get(item.group_key) ?? '#14213d',
                    }}
                    type="button"
                  >
                    <span>{renderTimeLabel(locale, item)}</span>
                    <strong>{item.title}</strong>
                    <small>{item.priority}</small>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

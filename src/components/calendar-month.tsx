'use client';

import { GROUPS, WEEKDAY_NAMES_EN, WEEKDAY_NAMES_ZH } from '@/lib/constants';
import { getMonthGrid, isItemOnDate, pickItemDate, toDateInputValue } from '@/lib/time';
import type { Item } from '@/lib/types';

type CalendarMonthProps = {
  focusDate: Date;
  items: Item[];
  locale: string;
  onFocusDateChange: (date: Date) => void;
  onSelectItem: (item: Item) => void;
};

const groupAccentMap = new Map<string, string>(
  GROUPS.map((group) => [group.key, group.accent])
);

export function CalendarMonth({
  focusDate,
  items,
  locale,
  onFocusDateChange,
  onSelectItem,
}: CalendarMonthProps) {
  const grid = getMonthGrid(focusDate);
  const weekdayNames = locale.startsWith('zh') ? WEEKDAY_NAMES_ZH : WEEKDAY_NAMES_EN;

  return (
    <section className="planner-panel planner-panel--calendar">
      <div className="planner-panel__header">
        <div>
          <p className="planner-panel__eyebrow">
            {locale.startsWith('zh') ? '月份总览' : 'Month overview'}
          </p>
          <h2 className="planner-panel__title">
            {new Intl.DateTimeFormat(locale, {
              month: 'long',
              year: 'numeric',
            }).format(focusDate)}
          </h2>
        </div>
        <div className="planner-nav">
          <button
            className="planner-nav__button"
            onClick={() =>
              onFocusDateChange(new Date(focusDate.getFullYear(), focusDate.getMonth() - 1, 1))
            }
            type="button"
          >
            {locale.startsWith('zh') ? '上月' : 'Prev'}
          </button>
          <button
            className="planner-nav__button"
            onClick={() => onFocusDateChange(new Date())}
            type="button"
          >
            {locale.startsWith('zh') ? '今天' : 'Today'}
          </button>
          <button
            className="planner-nav__button"
            onClick={() =>
              onFocusDateChange(new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 1))
            }
            type="button"
          >
            {locale.startsWith('zh') ? '下月' : 'Next'}
          </button>
        </div>
      </div>

      <div className="month-grid">
        {weekdayNames.map((weekday) => (
          <div className="month-grid__weekday" key={weekday}>
            {weekday}
          </div>
        ))}
        {grid.map((day) => {
          const dayKey = toDateInputValue(day);
          const dayItems = items
            .filter((item) => isItemOnDate(item, day))
            .sort((left, right) => {
              const leftTime = new Date(pickItemDate(left) ?? '').getTime();
              const rightTime = new Date(pickItemDate(right) ?? '').getTime();
              return leftTime - rightTime;
            });

          return (
            <article
              className={`month-grid__cell ${
                day.getMonth() === focusDate.getMonth() ? '' : 'is-muted'
              } ${toDateInputValue(new Date()) === dayKey ? 'is-today' : ''}`}
              key={dayKey}
            >
              <header className="month-grid__cellHeader">
                <span>{day.getDate()}</span>
                <small>{dayItems.length}</small>
              </header>
              <div className="month-grid__items">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    className="month-grid__item"
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    style={{
                      borderColor: groupAccentMap.get(item.group_key) ?? '#14213d',
                    }}
                    type="button"
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.is_all_day
                        ? locale.startsWith('zh')
                          ? '全天'
                          : 'All-day'
                        : new Intl.DateTimeFormat(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          }).format(new Date(item.start_at ?? item.created_at ?? Date.now()))}
                    </span>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

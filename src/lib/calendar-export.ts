import type { Item } from './types';

/**
 * 生成 iCalendar (.ics) 格式的日历数据
 */
export function generateICalendar(items: Item[], calendarName: string = 'My Calendar'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UNNC Planner//CN',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  items.forEach((item) => {
    const start = item.start_at ?? item.due_date ?? item.created_at;
    if (!start) return;

    const dtStart = formatICalDate(new Date(start), item.is_all_day);
    const dtEnd = item.end_at
      ? formatICalDate(new Date(item.end_at), item.is_all_day)
      : dtStart;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@planner.local`,
      `DTSTAMP:${formatICalDate(new Date(), false)}`,
      `DTSTART${item.is_all_day ? ';VALUE=DATE' : ''}:${dtStart}`,
      `DTEND${item.is_all_day ? ';VALUE=DATE' : ''}:${dtEnd}`,
      `SUMMARY:${escapeICalText(item.title)}`,
      `DESCRIPTION:${escapeICalText(item.notes || '')}`,
      item.location ? `LOCATION:${escapeICalText(item.location)}` : '',
      `STATUS:${item.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      item.group_key ? `CATEGORIES:${item.group_key}` : '',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

/**
 * 格式化日期为 iCalendar 格式
 */
function formatICalDate(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * 转义 iCalendar 文本
 */
function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * 生成可用于点击订阅的 Webcal URl
 */
export function generateWebcalUrl(userId?: string): string {
  if (typeof window === 'undefined') return '';
  const currentUrl = window.location.origin;
  const webcalBase = currentUrl.replace(/^https?:\/\//, 'webcal://');
  return `${webcalBase}/api/calendar/subscribe${userId ? `?userId=${userId}` : ''}`;
}

/**
 * 下载 .ics 文件
 */
export function downloadICalendar(items: Item[], filename: string = 'calendar.ics') {
  const icsContent = generateICalendar(items);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

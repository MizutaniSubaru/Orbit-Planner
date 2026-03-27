export const GROUPS = [
  {
    key: 'study',
    labelEn: 'Study',
    labelZh: '学习',
    accent: '#4f7cff',
    order: 1,
  },
  {
    key: 'work',
    labelEn: 'Work',
    labelZh: '工作',
    accent: '#ff6b4a',
    order: 2,
  },
  {
    key: 'life',
    labelEn: 'Life',
    labelZh: '生活',
    accent: '#39b07a',
    order: 3,
  },
  {
    key: 'health',
    labelEn: 'Health',
    labelZh: '健康',
    accent: '#f5a623',
    order: 4,
  },
  {
    key: 'other',
    labelEn: 'Other',
    labelZh: '其他',
    accent: '#7b6ef6',
    order: 5,
  },
] as const;

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const TODO_STATUSES = ['pending', 'completed'] as const;
export const EVENT_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
export const CALENDAR_VIEWS = ['month', 'week'] as const;

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';
export const DEFAULT_EVENT_MINUTES = 60;
export const DEFAULT_TODO_MINUTES = 45;

export const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_NAMES_ZH = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

export const WEEKDAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const HARMONIOUS_COLORS = [
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

export function getItemColor(id: number | string): string {
  const hash = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return HARMONIOUS_COLORS[hash % HARMONIOUS_COLORS.length];
}

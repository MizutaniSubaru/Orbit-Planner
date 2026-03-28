'use client';

import { MotionButton } from '@/components/ui/motion-button';
import { downloadICalendar } from '@/lib/calendar-export';
import type { Item } from '@/lib/types';

type CalendarExportButtonProps = {
  items: Item[];
  locale?: string;
};

export function CalendarExportButton({ items, locale }: CalendarExportButtonProps) {
  const isChinese =
    typeof locale === 'string'
      ? locale.startsWith('zh')
      : typeof navigator !== 'undefined'
        ? navigator.language.toLowerCase().startsWith('zh')
        : true;
  const buttonLabel = isChinese
    ? '\u5bfc\u51fa\u4e3a ICS \u6587\u4ef6'
    : 'Export as ICS file';

  const handleDownload = () => {
    downloadICalendar(items, `calendar-${new Date().toISOString().split('T')[0]}.ics`);
  };

  return (
    <MotionButton
      aria-label={buttonLabel}
      className="relative z-[60] inline-flex h-11 min-w-fit items-center justify-center justify-self-end gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      motionPreset="subtle"
      onClick={handleDownload}
      title={buttonLabel}
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>{buttonLabel}</span>
    </MotionButton>
  );
}

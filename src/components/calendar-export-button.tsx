'use client';

import React, { useState } from 'react';
import { generateWebcalUrl, downloadICalendar } from '@/lib/calendar-export';
import type { Item } from '@/lib/types';

type CalendarExportButtonProps = {
  items: Item[];
  userId?: string;
};

export function CalendarExportButton({ items, userId }: CalendarExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    downloadICalendar(items, `calendar-${new Date().toISOString().split('T')[0]}.ics`);
    setShowMenu(false);
  };

  const handleCopyUrl = async () => {
    const httpsUrl = generateWebcalUrl(userId).replace(/^webcal:\/\//, window.location.protocol + '//');
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleOpenInCalendar = () => {
    const webcalUrl = generateWebcalUrl(userId);
    window.location.href = webcalUrl;
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Sync Calendar
      </button>

      {showMenu && (
        <React.Fragment>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <button
                 onClick={handleOpenInCalendar}
                 className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                🗓️ Open in System Calendar
              </button>

              <button
                 onClick={handleCopyUrl}
                 className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {copied ? '✅ Link Copied' : '🔗 Copy Subscribe URL'}
              </button>

              <button
                 onClick={handleDownload}
                 className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                📥 Download .ics File
              </button>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

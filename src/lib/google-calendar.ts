import { addDays } from '@/lib/time';
import type { Item } from '@/lib/types';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function googleFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Google Calendar request failed: ${payload}`);
  }

  return (await response.json()) as T;
}

export async function getPrimaryCalendar(accessToken: string) {
  return googleFetch<{ id: string; summary: string }>('/users/me/calendarList/primary', accessToken);
}

function buildEventPayload(item: Item, timezone: string) {
  if (item.is_all_day && item.due_date) {
    return {
      description: item.notes ?? '',
      end: {
        date: addDays(item.due_date, 1),
      },
      start: {
        date: item.due_date,
      },
      summary: item.title,
    };
  }

  return {
    description: item.notes ?? '',
    end: {
      dateTime: item.end_at,
      timeZone: timezone,
    },
    start: {
      dateTime: item.start_at,
      timeZone: timezone,
    },
    summary: item.title,
  };
}

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  item: Item,
  timezone: string
) {
  return googleFetch<{ id: string; htmlLink?: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    accessToken,
    {
      body: JSON.stringify(buildEventPayload(item, timezone)),
      method: 'POST',
    }
  );
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  item: Item,
  timezone: string
) {
  return googleFetch<{ id: string; htmlLink?: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      body: JSON.stringify(buildEventPayload(item, timezone)),
      method: 'PUT',
    }
  );
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
) {
  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'DELETE',
    }
  );

  if (!response.ok && response.status !== 404) {
    const payload = await response.text();
    throw new Error(`Failed to delete Google Calendar event: ${payload}`);
  }
}

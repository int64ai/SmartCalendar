/** Google Calendar API client — uses chrome.identity for OAuth */

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  organizer?: boolean;
  self?: boolean;
}

export interface GoogleCalendarReminders {
  useDefault: boolean;
  overrides?: Array<{ method: 'email' | 'popup'; minutes: number }>;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  colorId?: string;
  attendees?: GoogleCalendarAttendee[];
  reminders?: GoogleCalendarReminders;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  recurrence?: string[];
}

export interface GoogleCalendarList {
  items: Array<{
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
  }>;
}

export interface GoogleEventList {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

// ── Auth ──

export async function getAuthToken(interactive: boolean = true): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: SCOPES }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Google 인증에 실패했습니다.'));
      } else {
        resolve(token);
      }
    });
  });
}

export async function revokeAuthToken(): Promise<void> {
  const token = await getAuthToken(false).catch(() => null);
  if (!token) return;
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => {
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).finally(() => resolve());
    });
  });
}

export async function isSignedIn(): Promise<boolean> {
  try {
    await getAuthToken(false);
    return true;
  } catch {
    return false;
  }
}

// ── API helpers ──

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAuthToken(false);
  const url = path.startsWith('http') ? path : `${CALENDAR_API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    // Token expired — remove cached and retry once
    await new Promise<void>((resolve) =>
      chrome.identity.removeCachedAuthToken({ token }, () => resolve()),
    );
    return apiFetch<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Calendar API 오류 (${res.status}): ${body.slice(0, 200)}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Calendar list ──

export async function listCalendars(): Promise<GoogleCalendarList> {
  return apiFetch<GoogleCalendarList>('/users/me/calendarList');
}

// ── Events CRUD ──

export async function listEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  maxResults = 250,
  query?: string,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: toRFC3339(timeMin),
    timeMax: toRFC3339(timeMax),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  if (query) params.set('q', query);

  const result = await apiFetch<GoogleEventList>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  );
  return result.items ?? [];
}

export async function getEvent(
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEvent> {
  return apiFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
}

export async function createEvent(
  calendarId: string,
  event: Partial<GoogleCalendarEvent>,
): Promise<GoogleCalendarEvent> {
  return apiFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(event) },
  );
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
): Promise<GoogleCalendarEvent> {
  return apiFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(event) },
  );
}

export async function deleteEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  await apiFetch<void>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
}

// ── Utility ──

function toRFC3339(dateStr: string): string {
  if (dateStr.includes('T') && (dateStr.endsWith('Z') || dateStr.includes('+'))) {
    return dateStr;
  }
  if (dateStr.includes('T')) {
    return dateStr + getTimezoneOffsetString();
  }
  return dateStr + 'T00:00:00' + getTimezoneOffsetString();
}

function getTimezoneOffsetString(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

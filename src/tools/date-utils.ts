/** Date/time parsing utilities (ported from query.py helpers) */

/**
 * Parse a date string (YYYY-MM-DD or ISO 8601) into a Date object.
 */
export function parseDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      throw new Error(
        `잘못된 날짜 형식입니다: '${dateStr}'. YYYY-MM-DD 또는 ISO 8601 형식을 사용하세요.`,
      );
    }
    return d;
  }
  // YYYY-MM-DD -> treat as local midnight
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(
      `잘못된 날짜 형식입니다: '${dateStr}'. YYYY-MM-DD 또는 ISO 8601 형식을 사용하세요.`,
    );
  }
  const d = new Date(
    parseInt(parts[0]!, 10),
    parseInt(parts[1]!, 10) - 1,
    parseInt(parts[2]!, 10),
  );
  if (isNaN(d.getTime())) {
    throw new Error(
      `잘못된 날짜 형식입니다: '${dateStr}'. YYYY-MM-DD 또는 ISO 8601 형식을 사용하세요.`,
    );
  }
  return d;
}

/**
 * Parse a time string "HH:MM" into [hour, minute].
 */
export function parseTime(timeStr: string): [number, number] {
  const parts = timeStr.split(':');
  if (parts.length < 2) {
    throw new Error(
      `잘못된 시간 형식입니다: '${timeStr}'. HH:MM 형식을 사용하세요.`,
    );
  }
  const hour = parseInt(parts[0]!, 10);
  const minute = parseInt(parts[1]!, 10);
  if (isNaN(hour) || isNaN(minute)) {
    throw new Error(
      `잘못된 시간 형식입니다: '${timeStr}'. HH:MM 형식을 사용하세요.`,
    );
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(
      `시간 범위 오류: '${timeStr}'. 00:00~23:59 사이여야 합니다.`,
    );
  }
  return [hour, minute];
}

/**
 * Format a Date as local-time ISO string (YYYY-MM-DDTHH:MM:SS) without Z suffix.
 * This matches the format used by the LLM and stored in IndexedDB.
 */
export function toLocalISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

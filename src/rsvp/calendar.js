import { event } from '../config.js';

function formatUtcDate(date) {
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function formatLocalDateTime(time) {
  return `${event.date.replaceAll('-', '')}T${time.replace(':', '')}00`;
}

function escapeIcsText(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const chunks = [];
  let chunk = '';
  let byteLength = 0;

  for (const character of line) {
    const characterLength = encoder.encode(character).length;
    if (byteLength + characterLength > 75) {
      chunks.push(chunk);
      chunk = ' ';
      byteLength = 1;
    }
    chunk += character;
    byteLength += characterLength;
  }

  chunks.push(chunk);
  return chunks.join('\r\n');
}

export function createGoogleCalendarUrl(response) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatLocalDateTime(event.startTime)}/${formatLocalDateTime(event.endTime)}`,
    details: `${event.calendarDetails} Code : ${response.token}`,
    location: event.location,
    ctz: event.timeZone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function createIcsFile(response) {
  const uid = `${response.token.toLowerCase()}@noces-de-vermeil`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Noces de vermeil//Invitation 45 ans//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${event.timeZone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `DTSTART;TZID=${event.timeZone}:${formatLocalDateTime(event.startTime)}`,
    `DTEND;TZID=${event.timeZone}:${formatLocalDateTime(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(`${event.calendarDetails} Code : ${response.token}`)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return new Blob([`${lines.map(foldIcsLine).join('\r\n')}\r\n`], {
    type: 'text/calendar;charset=utf-8',
  });
}

export function downloadIcsFile(response) {
  const url = URL.createObjectURL(createIcsFile(response));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `noces-de-vermeil-${response.token.toLowerCase()}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

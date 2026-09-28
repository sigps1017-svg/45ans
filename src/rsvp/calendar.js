import { event } from '../config.js';

function formatUtcDate(date) {
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function zonedDateTimeToUtc(time) {
  const [year, month, day] = event.date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formattedParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: event.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(localTimeAsUtc));
  const parts = Object.fromEntries(
    formattedParts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );
  const zonedTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return new Date(localTimeAsUtc - (zonedTimeAsUtc - localTimeAsUtc));
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
  const start = zonedDateTimeToUtc(event.startTime);
  const end = zonedDateTimeToUtc(event.endTime);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatUtcDate(start)}/${formatUtcDate(end)}`,
    details: `${event.calendarDetails} Code : ${response.token}`,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function createIcsFile(response) {
  const [year, month, day] = event.date.split('-');
  const uid = `${response.token.toLowerCase()}@noces-de-saphir`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Noces de saphir//Invitation 45 ans//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${event.timeZone}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0300',
    'TZNAME:ADT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0400',
    'TZNAME:AST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `DTSTART;TZID=${event.timeZone}:${year}${month}${day}T${event.startTime.replace(':', '')}00`,
    `DTEND;TZID=${event.timeZone}:${year}${month}${day}T${event.endTime.replace(':', '')}00`,
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
  anchor.download = `noces-de-saphir-${response.token.toLowerCase()}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

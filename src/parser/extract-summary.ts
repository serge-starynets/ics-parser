import { findComponents, findProperty } from './component-utils.ts';
import type {
  IcsComponentJson,
  IcsEventSummary,
  IcsParseResult,
  IcsPropertyJson,
} from './types.ts';

function formatPropertyText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return unescapeIcsText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatPropertyText(entry) ?? String(entry)).join(', ');
  }

  return String(value);
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
}

function stripMailto(value: string): string {
  return value.replace(/^mailto:/i, '');
}

function formatPerson(property: IcsPropertyJson): string {
  const email = stripMailto(formatPropertyText(property.value) ?? '');
  const commonName = property.parameters.cn;

  if (typeof commonName === 'string' && commonName.length > 0) {
    if (commonName.toLowerCase() === email.toLowerCase()) {
      return email;
    }

    return `${commonName} <${email}>`;
  }

  if (Array.isArray(commonName) && commonName.length > 0) {
    return commonName.join(', ');
  }

  return email;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

function formatDateTimeValue(value: string): string {
  const isUtc = value.endsWith('Z');
  const normalized = isUtc ? value.slice(0, -1) : value;
  const [datePart, timePart = '00:00:00'] = normalized.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = '0'] = timePart.split(':');
  const date = new Date(
    Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second)),
  );

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function formatWhen(property: IcsPropertyJson): string {
  const value = formatPropertyText(property.value);
  if (!value) {
    return '—';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDateOnly(value);
  }

  const formatted = formatDateTimeValue(value);
  const tzid = property.parameters.tzid;

  if (typeof tzid === 'string' && tzid.length > 0 && !value.endsWith('Z')) {
    return `${formatted} (${tzid})`;
  }

  if (value.endsWith('Z')) {
    return `${formatted} UTC`;
  }

  return formatted;
}

function formatWhenRange(
  startProperty: IcsPropertyJson | undefined,
  endProperty: IcsPropertyJson | undefined,
): string {
  if (!startProperty) {
    return '—';
  }

  const start = formatWhen(startProperty);
  if (!endProperty) {
    return start;
  }

  return `${start} – ${formatWhen(endProperty)}`;
}

const PLATFORM_RULES = [
  { name: 'Google Calendar', propertyPrefix: 'x-google-', prodidPattern: /google/i },
  { name: 'Microsoft Outlook', propertyPrefix: 'x-microsoft-', prodidPattern: /microsoft/i },
  { name: 'Apple Calendar', propertyPrefix: 'x-apple-', prodidPattern: /apple/i },
  { name: 'Zoom', propertyPrefix: 'x-zoom-', prodidPattern: /zoom/i },
  { name: 'Yahoo Calendar', prodidPattern: /yahoo/i },
] as const;

function detectPlatform(calendar: IcsComponentJson, event?: IcsComponentJson | null): string {
  const properties = event ? [...calendar.properties, ...event.properties] : calendar.properties;
  const propertyNames = properties.map((property) => property.name);
  const prodid = formatPropertyText(findProperty(calendar, 'prodid')?.value) ?? '';

  for (const rule of PLATFORM_RULES) {
    const matchesProperty =
      'propertyPrefix' in rule
        ? propertyNames.some((name) => name.startsWith(rule.propertyPrefix))
        : false;

    if (matchesProperty || rule.prodidPattern.test(prodid)) {
      return rule.name;
    }
  }

  return prodid || 'Unknown';
}

function findPrimaryComponent(calendar: IcsComponentJson): IcsComponentJson | null {
  const events = findComponents(calendar, 'vevent');
  const masterEvent = events.find((event) => !findProperty(event, 'recurrence-id'));
  if (masterEvent) {
    return masterEvent;
  }

  if (events[0]) {
    return events[0];
  }

  return findComponents(calendar, 'vtodo')[0] ?? null;
}

function emptySummary(calendar: IcsComponentJson): IcsEventSummary {
  return {
    platform: detectPlatform(calendar),
    when: '—',
    organizer: null,
    invitees: [],
    location: null,
    description: null,
    status: null,
  };
}

export function extractSummary(result: IcsParseResult): IcsEventSummary | null {
  const calendar = result.calendars[0];
  if (!calendar) {
    return null;
  }

  const event = findPrimaryComponent(calendar);
  if (!event) {
    return emptySummary(calendar);
  }

  const organizerProperty = findProperty(event, 'organizer');

  return {
    platform: detectPlatform(calendar, event),
    when: formatWhenRange(findProperty(event, 'dtstart'), findProperty(event, 'dtend')),
    organizer: organizerProperty ? formatPerson(organizerProperty) : null,
    invitees: event.properties
      .filter((property) => property.name === 'attendee')
      .map((property) => formatPerson(property)),
    location: formatPropertyText(findProperty(event, 'location')?.value),
    description: formatPropertyText(findProperty(event, 'description')?.value),
    status: formatPropertyText(findProperty(event, 'status')?.value),
  };
}

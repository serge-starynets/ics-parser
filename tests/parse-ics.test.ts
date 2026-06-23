import { describe, expect, it } from 'vitest';
import { parseIcs } from '../src/parser/parse-ics.ts';
import { IcsParseError } from '../src/parser/types.ts';
import { readFixture, sourceFor } from './helpers.ts';

describe('parseIcs', () => {
  it('parses Google calendar fixtures with vendor properties', () => {
    const result = parseIcs(readFixture('google.ics'), sourceFor('google.ics'));

    expect(result.calendars).toHaveLength(1);
    expect(result.calendars[0].component).toBe('vcalendar');

    const event = result.calendars[0].components[0];
    expect(event.component).toBe('vevent');

    const summary = event.properties.find((property) => property.name === 'summary');
    expect(summary?.value).toBe('Google Calendar Meeting');

    const vendorProperty = event.properties.find(
      (property) => property.name === 'x-google-calendar-content-title',
    );
    expect(vendorProperty?.value).toBe('Google Calendar Meeting');
  });

  it('parses Outlook fixtures and preserves TZID parameters', () => {
    const result = parseIcs(readFixture('outlook.ics'), sourceFor('outlook.ics'));
    const event = result.calendars[0].components[0];

    const dtstart = event.properties.find((property) => property.name === 'dtstart');
    expect(dtstart?.parameters.tzid).toBe('Pacific Standard Time');
    expect(dtstart?.value).toBe('2026-06-23T10:00:00');
  });

  it('parses Apple fixtures with X- properties', () => {
    const result = parseIcs(readFixture('apple.ics'), sourceFor('apple.ics'));
    const event = result.calendars[0].components[0];

    const vendorProperty = event.properties.find(
      (property) => property.name === 'x-apple-travel-advisory-behavior',
    );
    expect(vendorProperty?.value).toBe('AUTOMATIC');
  });

  it('parses Zoom fixtures', () => {
    const result = parseIcs(readFixture('zoom.ics'), sourceFor('zoom.ics'));
    const event = result.calendars[0].components[0];

    const zoomId = event.properties.find((property) => property.name === 'x-zoom-meeting-id');
    expect(zoomId?.value).toBe('123456789');
  });

  it('preserves recurrence rules without expanding occurrences', () => {
    const result = parseIcs(readFixture('recurring.ics'), sourceFor('recurring.ics'));
    const events = result.calendars[0].components.filter(
      (component) => component.component === 'vevent',
    );

    expect(events).toHaveLength(2);

    const master = events[0];
    const rrule = master.properties.find((property) => property.name === 'rrule');
    expect(rrule?.type).toBe('recur');
    expect(String(rrule?.value)).toContain('FREQ=WEEKLY');

    const exdate = master.properties.find((property) => property.name === 'exdate');
    expect(exdate?.parameters.tzid).toBe('Europe/Madrid');

    const override = events[1];
    const recurrenceId = override.properties.find(
      (property) => property.name === 'recurrence-id',
    );
    expect(recurrenceId?.value).toBe('2026-06-30T10:00:00');
  });

  it('preserves VTIMEZONE components and local date values', () => {
    const result = parseIcs(readFixture('timezone.ics'), sourceFor('timezone.ics'));

    const timezone = result.calendars[0].components.find(
      (component) => component.component === 'vtimezone',
    );
    expect(timezone).toBeDefined();
    expect(timezone?.properties.find((property) => property.name === 'tzid')?.value).toBe(
      'Europe/Madrid',
    );

    const event = result.calendars[0].components.find(
      (component) => component.component === 'vevent',
    );
    const dtstart = event?.properties.find((property) => property.name === 'dtstart');
    expect(dtstart?.parameters.tzid).toBe('Europe/Madrid');
    expect(dtstart?.value).toBe('2026-06-23T10:00:00');
    expect(dtstart?.value).not.toMatch(/Z$/);
  });

  it('includes source metadata in parse results', () => {
    const source = sourceFor('google.ics');
    const result = parseIcs(readFixture('google.ics'), source);

    expect(result.source).toEqual(source);
  });

  it('rejects empty files', () => {
    expect(() => parseIcs('   \n', sourceFor('google.ics'))).toThrow(IcsParseError);

    try {
      parseIcs('   \n', sourceFor('google.ics'));
    } catch (error) {
      expect(error).toBeInstanceOf(IcsParseError);
      expect((error as IcsParseError).code).toBe('EMPTY_FILE');
    }
  });

  it('rejects files without VCALENDAR', () => {
    expect(() => parseIcs('BEGIN:VEVENT\nEND:VEVENT\n', sourceFor('google.ics'))).toThrow(
      IcsParseError,
    );
  });

  it('reports malformed calendar files', () => {
    expect(() => parseIcs(readFixture('malformed.ics'), sourceFor('malformed.ics'))).toThrow(
      IcsParseError,
    );
  });
});

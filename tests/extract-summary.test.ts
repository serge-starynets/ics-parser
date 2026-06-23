import { describe, expect, it } from 'vitest';
import { extractSummary } from '../src/parser/extract-summary.ts';
import { parseIcs } from '../src/parser/parse-ics.ts';
import { readFixture, sourceFor } from './helpers.ts';

describe('extractSummary', () => {
  it('extracts Google Calendar summary fields', () => {
    const result = parseIcs(readFixture('google.ics'), sourceFor('google.ics'));
    const summary = extractSummary(result);

    expect(summary?.platform).toBe('Google Calendar');
    expect(summary?.when).toContain('UTC');
    expect(summary?.location).toBe('https://meet.google.com/abc-defg-hij');
    expect(summary?.description).toBe('Weekly sync');
    expect(summary?.status).toBe('CONFIRMED');
  });

  it('detects Microsoft Outlook and preserves timezone in When', () => {
    const result = parseIcs(readFixture('outlook.ics'), sourceFor('outlook.ics'));
    const summary = extractSummary(result);

    expect(summary?.platform).toBe('Microsoft Outlook');
    expect(summary?.when).toContain('Pacific Standard Time');
  });

  it('detects Apple Calendar', () => {
    const result = parseIcs(readFixture('apple.ics'), sourceFor('apple.ics'));
    const summary = extractSummary(result);

    expect(summary?.platform).toBe('Apple Calendar');
    expect(summary?.when).toContain('Europe/Madrid');
    expect(summary?.location).toBe('Cafe Central');
  });

  it('detects Zoom', () => {
    const result = parseIcs(readFixture('zoom.ics'), sourceFor('zoom.ics'));
    const summary = extractSummary(result);

    expect(summary?.platform).toBe('Zoom');
    expect(summary?.description).toContain('zoom.us');
  });
});

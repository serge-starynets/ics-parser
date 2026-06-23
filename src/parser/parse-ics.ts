import ICAL from 'ical.js';
import { jcalArrayToJson } from './jcal-to-json.ts';
import {
  IcsParseError,
  type IcsParseResult,
  type IcsSourceMetadata,
  MAX_FILE_SIZE_BYTES,
} from './types.ts';

function classifyParserError(error: unknown): IcsParseError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('component began but did not end')) {
    return new IcsParseError('UNCLOSED_COMPONENT', message);
  }

  if (lowerMessage.includes('invalid line')) {
    return new IcsParseError('INVALID_PROPERTY_LINE', message);
  }

  if (lowerMessage.includes('duration')) {
    return new IcsParseError('INVALID_DURATION', message);
  }

  if (lowerMessage.includes('recur') || lowerMessage.includes('rrule')) {
    return new IcsParseError('INVALID_RECURRENCE', message);
  }

  if (lowerMessage.includes('invalid date')) {
    return new IcsParseError('INVALID_DATE', message);
  }

  return new IcsParseError('PARSER_ERROR', message);
}

function validateBeforeParse(text: string, source: IcsSourceMetadata): void {
  if (source.size > MAX_FILE_SIZE_BYTES) {
    throw new IcsParseError(
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes.`,
    );
  }

  if (text.length === 0 || text.trim().length === 0) {
    throw new IcsParseError('EMPTY_FILE', 'The selected file is empty.');
  }

  if (!/BEGIN:VCALENDAR/i.test(text)) {
    throw new IcsParseError(
      'MISSING_VCALENDAR',
      'The file does not contain a BEGIN:VCALENDAR component.',
    );
  }
}

export function parseIcs(text: string, source: IcsSourceMetadata): IcsParseResult {
  validateBeforeParse(text, source);

  let parsed: ReturnType<typeof ICAL.parse>;

  try {
    parsed = ICAL.parse(text) as ReturnType<typeof ICAL.parse>;
  } catch (error) {
    throw classifyParserError(error);
  }

  return {
    source,
    calendars: jcalArrayToJson(parsed as Parameters<typeof jcalArrayToJson>[0]),
  };
}

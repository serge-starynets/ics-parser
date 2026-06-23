export type LoadedFile = {
  file: File;
  text: string;
};

export type IcsPropertyJson = {
  name: string;
  type: string;
  parameters: Record<string, string | string[]>;
  value: unknown;
};

export type IcsComponentJson = {
  component: string;
  properties: IcsPropertyJson[];
  components: IcsComponentJson[];
};

export type IcsSourceMetadata = {
  filename: string;
  size: number;
  mimeType: string;
};

export type IcsParseResult = {
  source: IcsSourceMetadata;
  calendars: IcsComponentJson[];
};

export type IcsEventSummary = {
  platform: string;
  when: string;
  organizer: string | null;
  invitees: string[];
  location: string | null;
  description: string | null;
  status: string | null;
};

export type ParseErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_ENCODING'
  | 'MISSING_VCALENDAR'
  | 'UNCLOSED_COMPONENT'
  | 'INVALID_PROPERTY_LINE'
  | 'INVALID_DATE'
  | 'INVALID_DURATION'
  | 'INVALID_RECURRENCE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_EXTENSION'
  | 'PARSER_ERROR';

export class IcsParseError extends Error {
  readonly code: ParseErrorCode;

  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = 'IcsParseError';
    this.code = code;
  }
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export type WorkerParseRequest = {
  text: string;
  source: IcsSourceMetadata;
};

export type WorkerParseSuccess = {
  type: 'success';
  result: IcsParseResult;
};

export type WorkerParseFailure = {
  type: 'error';
  code: ParseErrorCode;
  message: string;
};

export type WorkerParseResponse = WorkerParseSuccess | WorkerParseFailure;

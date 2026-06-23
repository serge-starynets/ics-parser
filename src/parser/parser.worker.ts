import { parseIcs } from './parse-ics.ts';
import type { WorkerParseRequest, WorkerParseResponse } from './types.ts';
import { IcsParseError } from './types.ts';

self.onmessage = (event: MessageEvent<WorkerParseRequest>) => {
  try {
    const result = parseIcs(event.data.text, event.data.source);
    const response: WorkerParseResponse = { type: 'success', result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerParseResponse =
      error instanceof IcsParseError
        ? { type: 'error', code: error.code, message: error.message }
        : {
            type: 'error',
            code: 'PARSER_ERROR',
            message: error instanceof Error ? error.message : String(error),
          };

    self.postMessage(response);
  }
};

export {};

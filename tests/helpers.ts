import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IcsSourceMetadata } from '../src/parser/types.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

export function sourceFor(name: string): IcsSourceMetadata {
  const text = readFixture(name);
  return {
    filename: name,
    size: Buffer.byteLength(text, 'utf-8'),
    mimeType: 'text/calendar',
  };
}

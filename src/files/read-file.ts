import {
  IcsParseError,
  MAX_FILE_SIZE_BYTES,
  type LoadedFile,
} from '../parser/types.ts';

const ICS_EXTENSION_PATTERN = /\.ics$/i;

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const isAscii =
      bytes.length === 0 || bytes.every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e));

    if (isAscii) {
      return new TextDecoder('latin-1').decode(bytes);
    }

    throw new IcsParseError(
      'UNSUPPORTED_ENCODING',
      'The file uses an unsupported character encoding. UTF-8 is required.',
    );
  }
}

export function isValidIcsExtension(filename: string): boolean {
  return ICS_EXTENSION_PATTERN.test(filename);
}

export async function readIcsFile(file: File): Promise<LoadedFile> {
  if (!isValidIcsExtension(file.name)) {
    throw new IcsParseError(
      'INVALID_EXTENSION',
      'Please select a file with the .ics extension.',
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new IcsParseError(
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES} bytes.`,
    );
  }

  const buffer = await file.arrayBuffer();
  const text = decodeText(buffer);

  return { file, text };
}

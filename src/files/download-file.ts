export function downloadFile(
  blob: Blob,
  filename: string,
): () => void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return () => {
    URL.revokeObjectURL(url);
  };
}

export function downloadOriginalFile(file: File): () => void {
  return downloadFile(file, file.name);
}

export function downloadJson(
  data: unknown,
  filename: string,
): () => void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const jsonFilename = filename.replace(/\.ics$/i, '') + '.json';
  return downloadFile(blob, jsonFilename);
}

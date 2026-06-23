export type ResultTab = 'original' | 'json';

function appendLine(container: HTMLElement, line: string): void {
  const lineElement = document.createElement('div');
  lineElement.className = 'result-line';
  lineElement.textContent = line;
  container.appendChild(lineElement);
}

function appendHighlightedNameLine(
  container: HTMLElement,
  before: string,
  name: string,
  after: string,
): void {
  const lineElement = document.createElement('div');
  lineElement.className = 'result-line';

  if (before) {
    lineElement.appendChild(document.createTextNode(before));
  }

  const label = document.createElement('strong');
  label.textContent = name;
  lineElement.appendChild(label);
  lineElement.appendChild(document.createTextNode(after));

  container.appendChild(lineElement);
}

function findIcsFieldNameEnd(line: string): number {
  const semicolonIndex = line.indexOf(';');
  const colonIndex = line.indexOf(':');

  if (semicolonIndex === -1) {
    return colonIndex;
  }

  if (colonIndex === -1) {
    return semicolonIndex;
  }

  return Math.min(semicolonIndex, colonIndex);
}

function renderOriginalResult(container: HTMLElement, content: string): void {
  container.replaceChildren();

  for (const line of content.split('\n')) {
    if (line.length === 0 || line.startsWith(' ') || line.startsWith('\t')) {
      appendLine(container, line);
      continue;
    }

    const nameEnd = findIcsFieldNameEnd(line);
    if (nameEnd > 0) {
      appendHighlightedNameLine(container, '', line.slice(0, nameEnd), line.slice(nameEnd));
      continue;
    }

    appendLine(container, line);
  }
}

function renderJsonResult(container: HTMLElement, content: string): void {
  container.replaceChildren();

  for (const line of content.split('\n')) {
    const match = line.match(/^(\s*)"([^"]+)":(.*)$/);
    if (!match) {
      appendLine(container, line);
      continue;
    }

    appendHighlightedNameLine(container, `${match[1]}"`, match[2], `":${match[3]}`);
  }
}

export function renderResult(
  container: HTMLElement,
  content: string,
  format: ResultTab,
): void {
  if (format === 'original') {
    renderOriginalResult(container, content);
    return;
  }

  renderJsonResult(container, content);
}

export function formatJsonResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

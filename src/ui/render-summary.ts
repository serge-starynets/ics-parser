import type { IcsEventSummary } from '../parser/types.ts';

const SUMMARY_FIELDS: Array<{ key: keyof IcsEventSummary; label: string }> = [
  { key: 'platform', label: 'Platform' },
  { key: 'when', label: 'When' },
  { key: 'organizer', label: 'Organizer' },
  { key: 'invitees', label: 'Invitees' },
  { key: 'location', label: 'Location' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
];

function formatSummaryValue(summary: IcsEventSummary, key: keyof IcsEventSummary): string {
  if (key === 'invitees') {
    return summary.invitees.length > 0 ? summary.invitees.join('\n') : '—';
  }

  const value = summary[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return '—';
}

export function renderSummary(container: HTMLElement, summary: IcsEventSummary | null): void {
  container.replaceChildren();

  if (!summary) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  const heading = document.createElement('h2');
  heading.textContent = 'Summary';
  container.appendChild(heading);

  const list = document.createElement('dl');
  list.className = 'summary-list';

  for (const field of SUMMARY_FIELDS) {
    const term = document.createElement('dt');
    const label = document.createElement('strong');
    label.textContent = field.label;
    term.appendChild(label);

    const definition = document.createElement('dd');
    definition.textContent = formatSummaryValue(summary, field.key);

    list.appendChild(term);
    list.appendChild(definition);
  }

  container.appendChild(list);
}

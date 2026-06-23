import { downloadJson, downloadOriginalFile } from '../files/download-file.ts';
import { readIcsFile } from '../files/read-file.ts';
import { extractSummary } from '../parser/extract-summary.ts';
import type { IcsParseResult, LoadedFile, WorkerParseRequest } from '../parser/types.ts';
import { clearError, renderError } from './render-error.ts';
import { formatJsonResult, renderResult, type ResultTab } from './render-result.ts';
import { renderSummary } from './render-summary.ts';

export type FileTabState = {
	id: string;
	title: string;
	loadedFile: LoadedFile | null;
	parseResult: IcsParseResult | null;
	jsonText: string | null;
	resultView: ResultTab;
	isParsing: boolean;
	showResults: boolean;
};

export type FileTab = {
	id: string;
	state: FileTabState;
	panel: HTMLElement;
	tabItem: HTMLElement;
	activate: () => void;
	deactivate: () => void;
	updateTabTitle: () => void;
	destroy: () => void;
};

type ParseInWorker = (request: WorkerParseRequest) => Promise<import('../parser/types.ts').WorkerParseResponse>;

let nextTabId = 1;

const TAB_TITLE_MAX_LENGTH = 12;

function formatTabTitle(title: string): string {
	if (title.length <= TAB_TITLE_MAX_LENGTH) {
		return title;
	}

	return `${title.slice(0, TAB_TITLE_MAX_LENGTH)}…`;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildParseRequest(loadedFile: LoadedFile): WorkerParseRequest {
	return {
		text: loadedFile.text,
		source: {
			filename: loadedFile.file.name,
			size: loadedFile.file.size,
			mimeType: loadedFile.file.type || 'text/calendar',
		},
	};
}

export function createFileTab(parseInWorker: ParseInWorker, panelsContainer: HTMLElement): FileTab {
	const id = `tab-${nextTabId++}`;
	const state: FileTabState = {
		id,
		title: 'New tab',
		loadedFile: null,
		parseResult: null,
		jsonText: null,
		resultView: 'original',
		isParsing: false,
		showResults: false,
	};

	const panel = document.createElement('section');
	panel.className = 'file-tab-panel hidden';
	panel.dataset.tabId = id;
	panel.innerHTML = `
    <div class="file-row">
      <input class="file-input" type="file" accept=".ics,text/calendar" />
      <span class="file-meta hidden"></span>
    </div>

    <fieldset class="output-format">
      <legend>Output format</legend>
      <label>
        <input class="output-format-original" type="radio" name="output-format-${id}" value="original" checked />
        Original
      </label>
      <label>
        <input class="output-format-json" type="radio" name="output-format-${id}" value="json" />
        JSON
      </label>
    </fieldset>

    <div class="actions">
      <button class="parse-button primary" type="button" disabled>Parse</button>
    </div>

    <p class="status-message hidden"></p>
    <div class="error-message hidden"></div>

    <hr class="divider" />

    <section class="result-section hidden">
      <div class="result-layout">
        <div class="result-panel">
          <div class="result-header">
            <h2>Result</h2>
            <div class="result-tabs">
              <button class="view-tab-original active" type="button">Original</button>
              <button class="view-tab-json" type="button" disabled>JSON</button>
            </div>
          </div>
          <div class="result-output"></div>
          <div class="download-actions">
            <button class="download-ics" type="button" disabled>Download .ics</button>
            <button class="download-json" type="button" disabled>Download .json</button>
          </div>
        </div>
        <aside class="summary-panel hidden"></aside>
      </div>
    </section>
  `;

	const tabItem = document.createElement('div');
	tabItem.className = 'file-tab-item';
	tabItem.dataset.tabId = id;

	const tabCloseButton = document.createElement('button');
	tabCloseButton.type = 'button';
	tabCloseButton.className = 'file-tab-close';
	tabCloseButton.setAttribute('aria-label', 'Close tab');
	tabCloseButton.textContent = '×';

	const tabSelectButton = document.createElement('button');
	tabSelectButton.type = 'button';
	tabSelectButton.className = 'file-tab-select';

	tabItem.appendChild(tabCloseButton);
	tabItem.appendChild(tabSelectButton);

	const fileInput = panel.querySelector<HTMLInputElement>('.file-input')!;
	const fileMeta = panel.querySelector<HTMLSpanElement>('.file-meta')!;
	const parseButton = panel.querySelector<HTMLButtonElement>('.parse-button')!;
	const statusMessage = panel.querySelector<HTMLParagraphElement>('.status-message')!;
	const errorMessage = panel.querySelector<HTMLDivElement>('.error-message')!;
	const resultSection = panel.querySelector<HTMLElement>('.result-section')!;
	const resultOutput = panel.querySelector<HTMLDivElement>('.result-output')!;
	const viewTabOriginal = panel.querySelector<HTMLButtonElement>('.view-tab-original')!;
	const viewTabJson = panel.querySelector<HTMLButtonElement>('.view-tab-json')!;
	const downloadIcsButton = panel.querySelector<HTMLButtonElement>('.download-ics')!;
	const downloadJsonButton = panel.querySelector<HTMLButtonElement>('.download-json')!;
	const summaryPanel = panel.querySelector<HTMLElement>('.summary-panel')!;
	const outputFormatOriginal = panel.querySelector<HTMLInputElement>('.output-format-original')!;
	const outputFormatJson = panel.querySelector<HTMLInputElement>('.output-format-json')!;

	let revokeDownloadUrl: (() => void) | null = null;

	function setStatus(message: string): void {
		statusMessage.textContent = message;
		statusMessage.classList.toggle('hidden', message.length === 0);
	}

	function setJsonAvailable(available: boolean): void {
		viewTabJson.disabled = !available;
		downloadJsonButton.disabled = !available;
	}

	function updateTabTitle(): void {
		tabSelectButton.textContent = formatTabTitle(state.title);
		tabSelectButton.title = state.title;
		tabItem.title = state.title;
	}

	updateTabTitle();

	function updateResultView(): void {
		if (!state.loadedFile) {
			resultOutput.replaceChildren();
			return;
		}

		if (state.resultView === 'original') {
			renderResult(resultOutput, state.loadedFile.text, 'original');
			return;
		}

		if (state.parseResult) {
			state.jsonText ??= formatJsonResult(state.parseResult);
			renderResult(resultOutput, state.jsonText, 'json');
			return;
		}

		resultOutput.replaceChildren();
	}

	function setResultView(view: ResultTab): void {
		state.resultView = view;
		viewTabOriginal.classList.toggle('active', view === 'original');
		viewTabJson.classList.toggle('active', view === 'json');
		updateResultView();
	}

	function clearResult(): void {
		state.parseResult = null;
		state.jsonText = null;
		state.showResults = false;
		resultSection.classList.add('hidden');
		resultOutput.replaceChildren();
		renderSummary(summaryPanel, null);
		summaryPanel.classList.add('hidden');
		downloadIcsButton.disabled = true;
		setJsonAvailable(false);
	}

	function showParsedResult(): void {
		state.showResults = true;
		resultSection.classList.remove('hidden');
		downloadIcsButton.disabled = false;
		setJsonAvailable(Boolean(state.parseResult));

		if (state.parseResult) {
			renderSummary(summaryPanel, extractSummary(state.parseResult));
			summaryPanel.classList.remove('hidden');
		} else {
			renderSummary(summaryPanel, null);
			summaryPanel.classList.add('hidden');
		}

		const preferredView =
			(panel.querySelector<HTMLInputElement>(`input[name="output-format-${id}"]:checked`)?.value as ResultTab | undefined) ?? 'original';
		setResultView(state.parseResult ? preferredView : 'original');
	}

	function handleParseFailure(message: string): void {
		state.parseResult = null;
		state.jsonText = null;
		showParsedResult();
		setResultView('original');
		renderError(errorMessage, message);
	}

	fileInput.addEventListener('change', async () => {
		clearError(errorMessage);
		clearResult();
		setStatus('');

		const selectedFile = fileInput.files?.[0];
		if (!selectedFile) {
			state.loadedFile = null;
			state.title = 'New tab';
			updateTabTitle();
			fileMeta.classList.add('hidden');
			parseButton.disabled = true;
			return;
		}

		try {
			state.loadedFile = await readIcsFile(selectedFile);
			state.title = selectedFile.name;
			updateTabTitle();
			fileMeta.textContent = `${selectedFile.name} (${formatFileSize(selectedFile.size)})`;
			fileMeta.classList.remove('hidden');
			parseButton.disabled = false;
		} catch (error) {
			state.loadedFile = null;
			state.title = 'New tab';
			updateTabTitle();
			fileMeta.classList.add('hidden');
			parseButton.disabled = true;
			renderError(errorMessage, error instanceof Error ? error.message : 'Failed to read the selected file.');
		}
	});

	parseButton.addEventListener('click', async () => {
		if (!state.loadedFile || state.isParsing) {
			return;
		}

		clearError(errorMessage);
		state.isParsing = true;
		parseButton.disabled = true;
		setStatus('Parsing…');

		try {
			const response = await parseInWorker(buildParseRequest(state.loadedFile));

			if (response.type === 'error') {
				handleParseFailure(response.message);
				return;
			}

			state.parseResult = response.result;
			state.jsonText = null;
			showParsedResult();
		} catch (error) {
			handleParseFailure(error instanceof Error ? error.message : 'An unexpected parsing error occurred.');
		} finally {
			state.isParsing = false;
			parseButton.disabled = !state.loadedFile;
			setStatus('');
		}
	});

	outputFormatOriginal.addEventListener('change', () => {
		if (!state.loadedFile || !state.parseResult) {
			return;
		}

		setResultView('original');
	});

	outputFormatJson.addEventListener('change', () => {
		if (!state.loadedFile || !state.parseResult) {
			return;
		}

		setResultView('json');
	});

	viewTabOriginal.addEventListener('click', () => {
		setResultView('original');
	});

	viewTabJson.addEventListener('click', () => {
		if (!state.parseResult) {
			return;
		}

		setResultView('json');
	});

	downloadIcsButton.addEventListener('click', () => {
		if (!state.loadedFile) {
			return;
		}

		revokeDownloadUrl?.();
		revokeDownloadUrl = downloadOriginalFile(state.loadedFile.file);
	});

	downloadJsonButton.addEventListener('click', () => {
		if (!state.parseResult) {
			return;
		}

		revokeDownloadUrl?.();
		revokeDownloadUrl = downloadJson(state.parseResult, state.parseResult.source.filename);
	});

	panelsContainer.appendChild(panel);

	return {
		id,
		state,
		panel,
		tabItem,
		activate() {
			panel.classList.remove('hidden');
			tabItem.classList.add('active');
		},
		deactivate() {
			panel.classList.add('hidden');
			tabItem.classList.remove('active');
		},
		updateTabTitle,
		destroy() {
			revokeDownloadUrl?.();
			panel.remove();
			tabItem.remove();
		},
	};
}

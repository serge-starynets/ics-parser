import type { WorkerParseRequest, WorkerParseResponse } from '../parser/types.ts';
import { createFileTab, type FileTab } from './file-tab.ts';

const tabList = document.querySelector<HTMLDivElement>('#file-tab-list')!;
const addTabButton = document.querySelector<HTMLButtonElement>('#add-tab-button')!;
const panelsContainer = document.querySelector<HTMLDivElement>('#tab-panels')!;

const MAX_TABS = 10;

const tabs = new Map<string, FileTab>();
let activeTabId: string | null = null;
let parserWorker: Worker | null = null;

function getParserWorker(): Worker {
	parserWorker ??= new Worker(new URL('../parser/parser.worker.ts', import.meta.url), {
		type: 'module',
	});

	return parserWorker;
}

function parseInWorker(request: WorkerParseRequest): Promise<WorkerParseResponse> {
	return new Promise((resolve, reject) => {
		const worker = getParserWorker();

		worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
			resolve(event.data);
		};

		worker.onerror = (event) => {
			reject(new Error(event.message || 'Worker failed to parse the file.'));
		};

		worker.postMessage(request);
	});
}

function switchToTab(tabId: string): void {
	if (activeTabId === tabId) {
		return;
	}

	const currentTab = activeTabId ? tabs.get(activeTabId) : null;
	currentTab?.deactivate();

	activeTabId = tabId;
	tabs.get(tabId)?.activate();
}

function updateTabBarState(): void {
	const showCloseButtons = tabs.size > 1;

	for (const tab of tabs.values()) {
		tab.tabItem.querySelector<HTMLButtonElement>('.file-tab-close')?.classList.toggle('hidden', !showCloseButtons);
	}

	addTabButton.disabled = tabs.size >= MAX_TABS;
	addTabButton.title = tabs.size >= MAX_TABS ? `Maximum ${MAX_TABS} tabs` : 'New tab';
}

function closeTab(tabId: string): void {
	const tab = tabs.get(tabId);
	if (!tab) {
		return;
	}

	const tabIds = [...tabs.keys()];
	const closedIndex = tabIds.indexOf(tabId);
	const wasActive = activeTabId === tabId;

	tab.destroy();
	tabs.delete(tabId);
	updateTabBarState();

	if (!wasActive) {
		return;
	}

	activeTabId = null;

	if (tabs.size === 0) {
		addTab(true);
		return;
	}

	const nextTabId = tabIds[closedIndex + 1] ?? tabIds[closedIndex - 1];
	switchToTab(nextTabId);
}

function addTab(activate = true): FileTab | null {
	if (tabs.size >= MAX_TABS) {
		return null;
	}

	const tab = createFileTab(parseInWorker, panelsContainer);
	tabs.set(tab.id, tab);
	tabList.appendChild(tab.tabItem);

	const tabSelectButton = tab.tabItem.querySelector<HTMLButtonElement>('.file-tab-select')!;
	const tabCloseButton = tab.tabItem.querySelector<HTMLButtonElement>('.file-tab-close')!;

	tabSelectButton.addEventListener('click', () => {
		switchToTab(tab.id);
	});

	tabCloseButton.addEventListener('click', (event) => {
		event.stopPropagation();
		closeTab(tab.id);
	});

	if (activate) {
		switchToTab(tab.id);
	}

	updateTabBarState();

	return tab;
}

addTabButton.addEventListener('click', () => {
	addTab(true);
});

addTab(true);

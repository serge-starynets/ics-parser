export function renderError(container: HTMLElement, message: string): void {
  container.className = 'error-message';
  container.textContent = message;
}

export function clearError(container: HTMLElement): void {
  container.className = 'error-message hidden';
  container.textContent = '';
}

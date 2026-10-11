// ============================================================================
// FILE: src/io/browserFiles.ts
// The two file operations the app needs, for the web build (the PC version): a download, and a file picker. Phones use
// expo-file-system, expo-sharing and expo-document-picker instead; callers branch on Platform.OS === 'web' and never reach
// this file on a phone. Pure DOM, no React.
// ============================================================================

/** Saves `content` as a file: the browser (or desktop shell) shows its normal download or save dialog. */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // The click starts the download synchronously; release the object URL afterwards.
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}

/**
 * Opens the browser's file picker and reads the chosen file as text. Resolves null when the person cancels.
 * `accept` is an `<input accept>` string such as ".json,.grimoire-pack" (an empty string accepts anything).
 */
export function pickTextFileInBrowser(accept = ''): Promise<{ name: string; text: string } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.style.display = 'none';
    input.setAttribute('data-grimoire-file-input', 'true');
    let settled = false;
    const done = (value: { name: string; text: string } | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { done(null); return; }
      file.text().then(text => done({ name: file.name, text }), () => done(null));
    });
    // Newer browsers fire `cancel` when the dialog is dismissed; older ones simply never fire anything.
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

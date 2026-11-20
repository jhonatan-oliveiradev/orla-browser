import { websiteAddress } from './session.js';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function readBookmarkFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('O arquivo de favoritos precisa ter até 8 MB.');
  // Template contents remain inert and never enter the browser interface.
  const template = document.createElement('template');
  template.innerHTML = await file.text();
  const bookmarks = new Map();
  for (const link of template.content.querySelectorAll('a[href]')) {
    const url = websiteAddress(link.getAttribute('href')?.trim());
    if (!url || bookmarks.has(url)) continue;
    const title = link.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);
    bookmarks.set(url, title || new URL(url).hostname);
  }
  if (!bookmarks.size) throw new Error('Nenhum favorito HTTP ou HTTPS foi encontrado neste arquivo.');
  return bookmarks;
}

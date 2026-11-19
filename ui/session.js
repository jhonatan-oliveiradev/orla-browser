export const SESSION_KEY = 'orla.session.v1';

const initialFavorites = [
  { url: 'https://github.com/', title: 'GitHub' },
  { url: 'https://developer.mozilla.org/', title: 'MDN Web Docs' },
  { url: 'https://www.figma.com/', title: 'Figma' },
];

export function websiteAddress(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return '';
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return '';
    if (['tauri.localhost', 'ipc.localhost'].includes(url.hostname.replace(/\.$/, ''))) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function readSession(serialized) {
  let saved;
  try {
    saved = JSON.parse(serialized);
  } catch {
    // An unreadable snapshot starts a fresh session.
  }

  const tabs = Array.isArray(saved?.tabs) && saved.tabs.length
    ? Array.from(saved.tabs, websiteAddress)
    : [''];
  const activeIndex = Number.isInteger(saved?.activeIndex)
    && saved.activeIndex >= 0 && saved.activeIndex < tabs.length
    ? saved.activeIndex : 0;
  const pinnedIndices = new Set(Array.isArray(saved?.pinnedIndices)
    ? saved.pinnedIndices.filter((index) => Number.isInteger(index) && tabs[index])
    : []);

  const favorites = new Map();
  for (const item of Array.isArray(saved?.favorites) ? saved.favorites : initialFavorites) {
    const url = websiteAddress(item?.url);
    if (!url || favorites.has(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 100) : '';
    favorites.set(url, title || new URL(url).hostname);
  }
  return { tabs, activeIndex, favorites, pinnedIndices };
}

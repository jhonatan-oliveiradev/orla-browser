import { readAppearance } from './appearance.js';
import { sidebarWidth } from './sidebar.js';

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

export function workspaceName(value) {
  return typeof value === 'string' ? Array.from(value.trim().replace(/\s+/g, ' ')).slice(0, 40).join('').trimEnd() : '';
}

function searchQuery(value) {
  return typeof value === 'string' ? Array.from(value.trim()).slice(0, 300).join('') : '';
}

function readTabGroup(value) {
  const tabs = Array.isArray(value?.tabs) && value.tabs.length
    ? Array.from(value.tabs, websiteAddress)
    : [''];
  const activeIndex = Number.isInteger(value?.activeIndex)
    && value.activeIndex >= 0 && value.activeIndex < tabs.length
    ? value.activeIndex : 0;
  const pinnedIndices = new Set(Array.isArray(value?.pinnedIndices)
    ? value.pinnedIndices.filter((index) => Number.isInteger(index) && tabs[index])
    : []);

  const queries = Array.isArray(value?.queries)
    ? tabs.map((url, index) => url ? '' : searchQuery(value.queries[index]))
    : tabs.map(() => '');
  return { tabs, queries, activeIndex, pinnedIndices };
}

export function readSession(serialized) {
  let saved;
  try {
    saved = JSON.parse(serialized);
  } catch {
    // An unreadable snapshot starts a fresh session.
  }

  const workspaces = [];
  const ids = new Set();
  if (Array.isArray(saved?.workspaces)) {
    for (const entry of saved.workspaces) {
      const id = entry?.id;
      if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) continue;
      ids.add(id);
      workspaces.push({
        id, name: workspaceName(entry.name) || 'Espaço de trabalho',
        ...readTabGroup(entry),
      });
    }
  }
  if (!workspaces.length) workspaces.push({ id: 0, name: 'Principal', ...readTabGroup(saved) });
  const activeWorkspaceId = ids.has(saved?.activeWorkspaceId) ? saved.activeWorkspaceId : workspaces[0].id;

  const favorites = new Map();
  for (const item of Array.isArray(saved?.favorites) ? saved.favorites : initialFavorites) {
    const url = websiteAddress(item?.url);
    if (!url || favorites.has(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 100) : '';
    favorites.set(url, title || new URL(url).hostname);
  }
  const sidebar = {
    width: sidebarWidth(saved?.sidebar?.width),
    collapsed: saved?.sidebar?.collapsed === true,
  };
  const appearance = readAppearance(saved?.appearance);
  const searchProvider = typeof saved?.searchProvider === 'string' ? saved.searchProvider.slice(0, 500) : '';
  return { workspaces, activeWorkspaceId, favorites, sidebar, appearance, searchProvider };
}

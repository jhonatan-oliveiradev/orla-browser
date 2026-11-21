import { readClips } from './clips.js';
import { readSplit } from './split.js';
import { readAppearance } from './appearance.js';
import { sidebarWidth } from './sidebar.js';

export const SESSION_KEY = 'orla.session.v1';
export const SESSION_BACKUP_KEY = 'orla.session.backup.v1';
export const LEGACY_NOTE_KEY = 'orla.home.note.v1';

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
  const split = readSplit(value?.split, tabs);
  return { tabs, queries, activeIndex, pinnedIndices, ...(split ? { split } : {}) };
}

export function readProfile(value) {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function readReadingList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 100).flatMap((item) => {
    const url = websiteAddress(item?.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ url, title: typeof item.title === 'string' && item.title.trim() ? item.title.slice(0, 160) : new URL(url).hostname }];
  });
}

export function workspaceNotes(value) {
  return typeof value === 'string' ? value.slice(0, 4000) : '';
}

export function readSavedProject(value) {
  const name = workspaceName(value?.name);
  if (!name || !Number.isSafeInteger(value.savedAt) || value.savedAt < 1 || value.savedAt > 8_640_000_000_000_000) return null;
  const group = readTabGroup(value);
  const clips = readClips(value.clips);
  if (!clips.length && !group.tabs.some(Boolean) && !group.queries.some(Boolean) && !workspaceNotes(value.notes).trim()) return null;
  return { name, savedAt: value.savedAt, notes: workspaceNotes(value.notes), ...(clips.length ? { clips } : {}), ...group, pinnedIndices: [...group.pinnedIndices] };
}

function parseSnapshot(serialized) {
  try {
    const value = JSON.parse(serialized);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // Try the previous snapshot if available.
  }
  return null;
}

export function saveSnapshot(storage, value) {
  const previous = storage.getItem(SESSION_KEY);
  const next = JSON.stringify(value);
  if (previous === next) return;
  if (parseSnapshot(previous)) {
    try { storage.setItem(SESSION_BACKUP_KEY, previous); } catch { /* The current snapshot can still be saved. */ }
  }
  storage.setItem(SESSION_KEY, next);
}

export function readSession(serialized, legacyNote, backup) {
  const primary = parseSnapshot(serialized);
  const recovered = primary ? null : parseSnapshot(backup);
  const saved = primary || recovered;

  const workspaces = [];
  const entriesById = new Map();
  const ids = new Set();
  if (Array.isArray(saved?.workspaces)) {
    for (const entry of saved.workspaces) {
      const id = entry?.id;
      if (!Number.isSafeInteger(id) || id < 0 || ids.has(id)) continue;
      ids.add(id);
      entriesById.set(id, entry);
      workspaces.push({
        id, name: workspaceName(entry.name) || 'Espaço de trabalho',
        ...(Array.isArray(entry.recentlyClosed) ? {
          recentlyClosed: entry.recentlyClosed.slice(-20).flatMap((item) => {
            const url = websiteAddress(item?.url);
            return url ? [{ url, pinned: item.pinned === true, title: typeof item.title === 'string' ? item.title.slice(0, 160) : '' }] : [];
          }),
        } : {}),
        ...(readProfile(entry.profile) ? { profile: readProfile(entry.profile) } : {}),
        ...(Array.isArray(entry.reading) ? { reading: readReadingList(entry.reading) } : {}),
        ...(Array.isArray(entry.clips) ? { clips: readClips(entry.clips) } : {}),
        ...readTabGroup(entry),
      });
    }
  }
  if (!workspaces.length) workspaces.push({ id: 0, name: 'Principal', ...readTabGroup(saved) });
  const originalWorkspace = workspaces.find(({ id }) => id === 0) ?? workspaces[0];
  const notes = new Map(workspaces.map(({ id }) => {
    const stored = entriesById.get(id)?.notes;
    return [id, workspaceNotes(stored ?? (id === originalWorkspace.id ? legacyNote : ''))];
  }));
  const projects = Array.isArray(saved?.projects) ? saved.projects.map(readSavedProject).filter(Boolean) : [];
  const activeWorkspaceId = ids.has(saved?.activeWorkspaceId) ? saved.activeWorkspaceId : workspaces[0].id;

  const favorites = new Map();
  for (const item of Array.isArray(saved?.favorites) ? saved.favorites : initialFavorites) {
    const url = websiteAddress(item?.url);
    if (!url || favorites.has(url)) continue;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 100) : '';
    favorites.set(url, title || new URL(url).hostname);
  }
  const bookmarkFolders = new Map();
  for (const item of (Array.isArray(saved?.favorites) ? saved.favorites : [])) {
    const url = websiteAddress(item?.url);
    const path = readFolderPath(item?.folder);
    if (favorites.has(url) && path.length && !bookmarkFolders.has(url)) bookmarkFolders.set(url, path);
  }
  const folders = (Array.isArray(saved?.folders) ? saved.folders : []).slice(0, 300).map(readFolderPath).filter((path) => path.length);
  const sidebar = {
    width: sidebarWidth(saved?.sidebar?.width),
    collapsed: saved?.sidebar?.collapsed === true,
  };
  const appearance = readAppearance(saved?.appearance);
  const searchProvider = typeof saved?.searchProvider === 'string' ? saved.searchProvider.slice(0, 500) : '';
  return { workspaces, activeWorkspaceId, notes, projects, favorites, bookmarkFolders, folders, sidebar, appearance, searchProvider, recovered: Boolean(recovered) };
}

export function readFolderPath(value) {
  return Array.isArray(value) ? value.slice(0, 12).map(workspaceName).filter(Boolean) : [];
}

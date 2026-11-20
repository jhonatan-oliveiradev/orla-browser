import { websiteAddress } from './session.js';

export const HISTORY_KEY = 'orla.history.v1';
const VISIT_LIMIT = 500;

export function pageTitle(value) {
  return typeof value === 'string' ? value.trim().slice(0, 160) : '';
}

function visitEntry({ url, title, visitedAt }) {
  const address = websiteAddress(url);
  if (!address || address.length > 4096 || !Number.isSafeInteger(visitedAt) ||
    visitedAt <= 0 || visitedAt > 8_640_000_000_000_000) return null;
  return { url: address, title: pageTitle(title), visitedAt };
}

export function readHistory(serialized) {
  try {
    const entries = JSON.parse(serialized);
    return Array.isArray(entries)
      ? entries.map((entry) => entry && visitEntry(entry)).filter(Boolean)
        .sort((first, second) => second.visitedAt - first.visitedAt).slice(0, VISIT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function addVisit(history, url, title, visitedAt = Date.now()) {
  const entry = visitEntry({ url, title, visitedAt });
  if (!entry) return null;
  history.unshift(entry);
  history.length = Math.min(history.length, VISIT_LIMIT);
  return entry;
}

function normalize(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

export function matchesPage(query, url, title = '') {
  const terms = normalize(query.trim()).split(/\s+/u);
  const search = normalize(title + ' ' + url);
  const decoded = readableAddress(url);
  const readable = decoded === url ? search : search + ' ' + normalize(decoded);
  return terms.every((term) => readable.includes(term));
}

function readableAddress(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export function suggestPages(query, { tabs, favorites, history, activeId, workspaces = new Map(), activeWorkspaceId }) {
  const term = normalize(query.trim());
  if (!term) return [];
  const matches = new Map();
  const openTabs = new Map();
  for (const [id, tab] of tabs) {
    if (id === activeId || !tab.url) continue;
    const workspace = workspaces.get(tab.workspaceId)?.name;
    const existing = openTabs.get(tab.url);
    if (!existing || tab.workspaceId === activeWorkspaceId) openTabs.set(tab.url, { id, tab, workspace });
    if (!matchesPage(term, tab.url, [tab.title, workspace].filter(Boolean).join(' '))) continue;
    const title = pageTitle(tab.title) || new URL(tab.url).hostname;
    const startsWithTerm = [title, new URL(tab.url).hostname].some((value) => normalize(value).startsWith(term));
    const key = 'tab:' + (tab.workspaceId ?? '') + ':' + tab.url;
    if (!matches.has(key)) matches.set(key, { url: tab.url, title, kind: 'tab', id, workspace, startsWithTerm });
  }

  for (const [id, { name }] of workspaces) {
    if (id === activeWorkspaceId || !matchesPage(term, '', name)) continue;
    matches.set('workspace:' + id, { url: '', title: name, id, kind: 'workspace', startsWithTerm: normalize(name).startsWith(term) });
  }

  function add(url, title, kind) {
    if (!url || !matchesPage(term, url, title)) return;
    const host = new URL(url).hostname;
    const label = pageTitle(title);
    const startsWithTerm = [host, label].some((value) => normalize(value).startsWith(term));
    const open = openTabs.get(url);
    const key = open ? 'tab:' + (open.tab.workspaceId ?? '') + ':' + url : url;
    if (!matches.has(key)) matches.set(key, {
      url, title: label || host, kind: open ? 'tab' : kind, id: open?.id, workspace: open?.workspace, startsWithTerm,
    });
  }

  for (const [url, title] of favorites) add(url, title, 'favorite');
  for (const { url, title } of history) add(url, title, 'history');

  return [...matches.values()]
    .sort((a, b) => Number(b.startsWithTerm) - Number(a.startsWithTerm))
    .slice(0, 6);
}

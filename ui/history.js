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

export function suggestPages(query, { tabs, favorites, history, activeId }) {
  const term = normalize(query.trim());
  if (!term) return [];
  const matches = new Map();

  function add(url, title, kind, id) {
    if (!url || matches.has(url) || !matchesPage(term, url, title)) return;
    const host = new URL(url).hostname;
    const label = pageTitle(title);
    const startsWithTerm = [host, label].some((value) => normalize(value).startsWith(term));
    matches.set(url, { url, title: label || host, kind, id, startsWithTerm });
  }

  for (const [id, tab] of tabs) {
    if (id !== activeId) add(tab.url, tab.title, 'tab', id);
  }
  for (const [url, title] of favorites) add(url, title, 'favorite');
  for (const { url, title } of history) add(url, title, 'history');

  return [...matches.values()]
    .sort((a, b) => Number(b.startsWithTerm) - Number(a.startsWithTerm))
    .slice(0, 6);
}

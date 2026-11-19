import { resolveAddress } from './address.js';
import { initHome } from './home.js';
import { readSession, SESSION_KEY, websiteAddress } from './session.js';

const tauri = window.__TAURI__;
const byId = (id) => document.getElementById(id);
const address = byId('address');
const home = byId('home');
const status = byId('status');
const query = byId('query');
const searchDialog = byId('search-dialog');
const tabDialog = byId('tab-dialog');
const tabFilter = byId('tab-filter');
const tabList = byId('tab-list');
const reopenButton = byId('reopen-tab');
const favoriteButton = byId('favorite-page');
const recentlyClosed = [];

let snapshot = null;
try {
  if (tauri) snapshot = localStorage.getItem(SESSION_KEY);
} catch {
  // Navigation remains available if the WebView storage cannot be read.
}
const session = readSession(snapshot);
const favorites = session.favorites;
const tabs = new Map(session.tabs.map((url, id) => [id, { url, loaded: false }]));
let activeId = session.activeIndex;
let nextId = tabs.size;
let pending = Promise.resolve();
let storageFailed = false;

function showError(error) {
  status.textContent = String(error.message ?? error);
  status.hidden = false;
}

function schedule(action) {
  pending = pending.then(action).catch(showError);
  return pending;
}

async function invoke(command, args = {}) {
  if (!tauri) throw new Error('Abra o Orla pelo aplicativo desktop.');
  return tauri.core.invoke(command, args);
}

function saveSession() {
  if (!tauri) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      tabs: Array.from(tabs.values(), (tab) => tab.url),
      activeIndex: Array.from(tabs.keys()).indexOf(activeId),
      favorites: Array.from(favorites, ([url, title]) => ({ url, title })),
    }));
    storageFailed = false;
  } catch {
    if (!storageFailed) showError('O Orla não conseguiu salvar a sessão neste dispositivo.');
    storageFailed = true;
  }
}

function render() {
  const tab = tabs.get(activeId);
  address.querySelector('span').textContent = tab.url || 'Pesquisar ou digitar endereço';
  home.hidden = tab.loaded;
  for (const button of document.querySelectorAll('[data-tab-action]')) {
    button.disabled = !tab.loaded;
  }

  const saved = favorites.has(tab.url);
  const label = saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  favoriteButton.disabled = !tab.url;
  favoriteButton.setAttribute('aria-pressed', String(saved));
  favoriteButton.setAttribute('aria-label', label);
  favoriteButton.title = label;
  favoriteButton.textContent = saved ? '★' : '☆';
}

function renderFavorites() {
  const list = byId('favorites-list');
  list.replaceChildren();
  byId('favorites-empty').hidden = favorites.size > 0;
  for (const [url, title] of favorites) {
    const button = document.createElement('button');
    button.textContent = title;
    button.title = url;
    button.addEventListener('click', () => schedule(() => go(url)));
    list.append(button);
  }
}

function resumeRow(url, activate) {
  const row = document.createElement('li');
  const button = document.createElement('button');
  const host = document.createElement('strong');
  const detail = document.createElement('span');
  const address = new URL(url);
  host.textContent = address.hostname;
  detail.textContent = address.pathname + address.search + address.hash;
  button.title = url;
  button.append(host, detail);
  button.addEventListener('click', () => schedule(activate));
  row.append(button);
  return row;
}

function renderResume() {
  const open = byId('resume-open');
  const closed = byId('resume-closed');
  open.replaceChildren();
  closed.replaceChildren();
  for (const [id, tab] of tabs) {
    if (!tab.url || id === activeId) continue;
    open.append(resumeRow(tab.url, () => selectTab(id)));
  }
  for (let index = recentlyClosed.length - 1; index >= 0; index--) {
    const entry = recentlyClosed[index];
    closed.append(resumeRow(entry.url, () => reopenTab(entry)));
  }
  byId('resume-open-empty').hidden = open.childElementCount > 0;
  byId('resume-closed-empty').hidden = closed.childElementCount > 0;
}

const resetHome = initHome(renderResume);

async function selectTab(id) {
  if (!tabs.has(id)) return;
  activeId = id;
  saveSession();
  if (tabDialog.open) tabDialog.close();
  else await syncView();
}

async function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (tab.loaded) await invoke('tab_action', { id, action: 'close' });

  if (tab.url) {
    recentlyClosed.push({ url: tab.url });
    if (recentlyClosed.length > 20) recentlyClosed.shift();
  }
  const ids = Array.from(tabs.keys());
  const index = ids.indexOf(id);
  tabs.delete(id);
  if (!tabs.size) createTab();
  else if (id === activeId) activeId = ids[index + 1] ?? ids[index - 1];
  saveSession();
  await syncView();
  if (tabDialog.open) {
    refreshTabList();
    const nextRow = tabList.children[Math.min(index, tabList.children.length - 1)];
    (nextRow?.querySelector('button') ?? tabFilter).focus();
  }
}

function refreshTabList() {
  tabList.replaceChildren();
  reopenButton.disabled = !recentlyClosed.length;
  const filter = tabFilter.value.trim().toLocaleLowerCase('pt-BR');
  for (const [id, tab] of tabs) {
    const title = tab.url ? new URL(tab.url).hostname : 'Nova aba';
    if (filter && !title.toLocaleLowerCase('pt-BR').includes(filter)
      && !tab.url.toLowerCase().includes(filter)) continue;

    const row = document.createElement('li');
    const select = document.createElement('button');
    select.textContent = title;
    select.title = tab.url || title;
    if (id === activeId) select.setAttribute('aria-current', 'true');
    select.addEventListener('click', () => schedule(() => selectTab(id)));

    const close = document.createElement('button');
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar aba ' + title);
    close.addEventListener('click', () => schedule(() => closeTab(id)));
    row.append(select, close);
    tabList.append(row);
  }
  byId('tabs-empty').hidden = tabList.childElementCount > 0;
}

function createTab(url = '') {
  activeId = nextId++;
  tabs.set(activeId, { url, loaded: false });
}

async function syncView() {
  render();
  if (!home.hidden && !byId('home-resume').hidden) renderResume();
  if (!tauri) return;
  const tab = tabs.get(activeId);
  if (!tab.url || document.querySelector('dialog[open]')) {
    await invoke('show_tab', { id: null });
    return;
  }
  if (!tab.loaded) {
    await invoke('show_tab', { id: null });
    await invoke('navigate_tab', { id: activeId, address: tab.url });
    tab.loaded = true;
    render();
  }
  await invoke('show_tab', { id: activeId });
}

async function go(url) {
  status.hidden = true;
  const target = websiteAddress(url);
  if (!target) throw new Error('Use um endereço HTTP ou HTTPS válido, sem credenciais.');

  const id = activeId;
  const tab = tabs.get(id);
  await invoke('navigate_tab', { id, address: target });
  tab.url = target;
  tab.loaded = true;
  saveSession();
  if (searchDialog.open) searchDialog.close();
  else await syncView();
}

function openDialog(dialog) {
  schedule(async () => {
    if (document.querySelector('dialog[open]')) return;
    if (tauri) await invoke('show_tab', { id: null });
    if (dialog === tabDialog) {
      tabFilter.value = '';
      refreshTabList();
    }
    if (dialog === searchDialog) {
      query.setCustomValidity('');
      query.value = tabs.get(activeId).url;
    }
    dialog.showModal();
    if (dialog === searchDialog) query.select();
  });
}

async function openTab(url) {
  createTab(url);
  if (!url) resetHome();
  saveSession();
  if (tabDialog.open) tabDialog.close();
  else await syncView();
  address.focus();
}

function reopenTab(entry = recentlyClosed.at(-1)) {
  const index = recentlyClosed.indexOf(entry);
  if (index < 0) return;
  recentlyClosed.splice(index, 1);
  return openTab(entry.url);
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => schedule(syncView));
}
for (const button of document.querySelectorAll('[data-dismiss]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
for (const element of [address, byId('home-search')]) {
  element.addEventListener('click', () => openDialog(searchDialog));
}
byId('tabs-toggle').addEventListener('click', () => openDialog(tabDialog));
byId('agent').addEventListener('click', () => openDialog(byId('agent-dialog')));
for (const button of [byId('new-tab'), byId('add-tab')]) {
  button.addEventListener('click', () => schedule(() => openTab()));
}
reopenButton.addEventListener('click', () => schedule(reopenTab));
tabFilter.addEventListener('input', refreshTabList);
favoriteButton.addEventListener('click', () => {
  const url = tabs.get(activeId).url;
  if (!url) return;
  if (favorites.has(url)) favorites.delete(url);
  else favorites.set(url, new URL(url).hostname);
  saveSession();
  renderFavorites();
  render();
});

for (const button of document.querySelectorAll('[data-tab-action]')) {
  button.addEventListener('click', () => schedule(() => invoke('tab_action', { id: activeId, action: button.dataset.tabAction })));
}
for (const button of document.querySelectorAll('[data-window-action]')) {
  button.addEventListener('click', () => schedule(() => invoke('window_action', { action: button.dataset.windowAction })));
}
byId('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = query.value;
  schedule(async () => {
    try {
      await go(resolveAddress(value));
    } catch (error) {
      if (!searchDialog.open) throw error;
      query.setCustomValidity(String(error.message ?? error));
      query.reportValidity();
    }
  });
});
query.addEventListener('input', () => query.setCustomValidity(''));
document.addEventListener('keydown', (event) => {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  const key = event.key.toLowerCase();
  if (key === 'l' && !event.shiftKey) {
    event.preventDefault();
    openDialog(searchDialog);
    return;
  }
  if (document.querySelector('dialog[open]')) return;
  if (key === 't') {
    event.preventDefault();
    schedule(event.shiftKey ? reopenTab : () => openTab());
  } else if (key === 'w' && !event.shiftKey) {
    event.preventDefault();
    schedule(() => closeTab(activeId));
  }
});

renderFavorites();
render();
if (tauri) {
  schedule(async () => {
    await tauri.event.listen('orla-location', ({ payload }) => {
      const id = Number(payload.id.slice(4));
      const tab = tabs.get(id);
      const url = websiteAddress(payload.url);
      if (!tab || !url || url === tab.url) return;
      tab.url = url;
      saveSession();
      if (id === activeId) render();
      if (tabDialog.open) refreshTabList();
      if (!home.hidden && !byId('home-resume').hidden) renderResume();
    });
    await syncView();
  });
  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => schedule(() => invoke('resize_tabs', {
      width: window.innerWidth,
      height: window.innerHeight,
    })));
  });
}

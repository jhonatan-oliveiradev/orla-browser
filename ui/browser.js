import { resolveAddress } from './address.js';
import { initHome } from './home.js';
import { initSidebar } from './sidebar.js';
import { readSession, SESSION_KEY, websiteAddress } from './session.js';

const tauri = window.__TAURI__;
const byId = (id) => document.getElementById(id);
const address = byId('address');
const home = byId('home');
const status = byId('status');
const homeSearch = byId('home-search');
const stage = byId('site-stage');
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
const tabs = new Map(session.tabs.map((url, id) => [id, {
  url, loaded: false, pinned: session.pinnedIndices.has(id),
}]));
let activeId = session.activeIndex;
let sidebarSettings = session.sidebar;
let addressDirty = false;
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
    const entries = Array.from(tabs.entries());
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      tabs: entries.map(([, tab]) => tab.url),
      activeIndex: entries.findIndex(([id]) => id === activeId),
      pinnedIndices: entries.flatMap(([, tab], index) => tab.pinned ? [index] : []),
      favorites: Array.from(favorites, ([url, title]) => ({ url, title })),
      sidebar: sidebarSettings,
    }));
    storageFailed = false;
  } catch {
    if (!storageFailed) showError('O Orla não conseguiu salvar a sessão neste dispositivo.');
    storageFailed = true;
  }
}

function render() {
  const tab = tabs.get(activeId);
  if (!addressDirty) address.value = tab.url;
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

function orderedTabs() {
  return [...tabs].sort(([, first], [, second]) => Number(second.pinned) - Number(first.pinned));
}

function renderResume() {
  const open = byId('resume-open');
  const closed = byId('resume-closed');
  open.replaceChildren();
  closed.replaceChildren();
  for (const [id, tab] of orderedTabs()) {
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

function showCurrentAddress() {
  addressDirty = false;
  address.setCustomValidity('');
  address.value = tabs.get(activeId).url;
}

function sidebarOffset() {
  return stage.getBoundingClientRect().left;
}

async function selectTab(id) {
  if (!tabs.has(id)) return;
  if (id !== activeId) {
    activeId = id;
    showCurrentAddress();
    saveSession();
  }
  await syncView(id);
}

async function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (tab.loaded) await invoke('tab_action', { id, action: 'close' });

  if (tab.url) {
    recentlyClosed.push({ url: tab.url, pinned: tab.pinned });
    if (recentlyClosed.length > 20) recentlyClosed.shift();
  }
  const previousActive = activeId;
  const ids = orderedTabs().map(([id]) => id);
  const index = ids.indexOf(id);
  tabs.delete(id);
  if (!tabs.size) createTab();
  else if (id === activeId) activeId = ids[index + 1] ?? ids[index - 1];
  if (activeId !== previousActive) {
    showCurrentAddress();
  }
  saveSession();
  await syncView();
}

function refreshTabList() {
  const focused = document.activeElement;
  const target = focused?.closest('#tab-list button')?.dataset.focusKey;
  const scroll = tabList.scrollTop;
  tabList.replaceChildren();
  reopenButton.disabled = !recentlyClosed.length;
  const filter = sidebarSettings.collapsed ? '' : (tabFilter.value || '').trim().toLocaleLowerCase('pt-BR');
  for (const [id, tab] of orderedTabs()) {
    if (sidebarSettings.collapsed && id !== activeId) continue;
    const title = tab.url ? new URL(tab.url).hostname : 'Nova aba';
    if (filter && !title.toLocaleLowerCase('pt-BR').includes(filter)
      && !tab.url.toLowerCase().includes(filter)) continue;

    const row = document.createElement('li');
    row.dataset.pinned = String(tab.pinned);
    const select = document.createElement('button');
    select.textContent = sidebarSettings.collapsed ? Array.from(title)[0].toUpperCase() : title;
    select.title = tab.url || title;
    select.setAttribute('aria-label', title);
    select.dataset.focusKey = 'select-' + id;
    if (id === activeId) select.setAttribute('aria-current', 'true');
    select.addEventListener('click', () => schedule(() => selectTab(id)));

    const close = document.createElement('button');
    close.textContent = '×';
    close.dataset.focusKey = 'close-' + id;
    close.setAttribute('aria-label', 'Fechar aba ' + title);
    close.addEventListener('click', () => schedule(() => closeTab(id)));
    row.append(select);
    if (tab.url && !sidebarSettings.collapsed) {
      const pin = document.createElement('button');
      const label = tab.pinned ? 'Desafixar' : 'Fixar';
      pin.textContent = label;
      pin.dataset.pin = String(id);
      pin.dataset.focusKey = 'pin-' + id;
      pin.setAttribute('aria-label', label + ' aba ' + title);
      pin.addEventListener('click', () => schedule(() => {
        if (!tabs.has(id)) return;
        tab.pinned = !tab.pinned;
        saveSession();
        refreshTabList();
        tabList.querySelector(`[data-pin="${id}"]`)?.focus();
      }));
      row.append(pin);
    }
    if (!sidebarSettings.collapsed) row.append(close);
    tabList.append(row);
  }
  byId('tabs-empty').hidden = tabList.childElementCount > 0;
  tabList.scrollTop = scroll;
  if (target) {
    const next = tabList.querySelector(`[data-focus-key="${target}"]`)
      ?? tabList.querySelector('[aria-current="true"]') ?? tabFilter;
    next.focus({ preventScroll: true });
  }
}

function createTab(url = '', pinned = false) {
  activeId = nextId++;
  tabs.set(activeId, { url, loaded: false, pinned });
}

async function syncView(focusTabId) {
  render();
  refreshTabList();
  if (!home.hidden && !byId('home-resume').hidden) renderResume();
  if (!tauri) return;
  const tab = tabs.get(activeId);
  if (!tab.url || document.querySelector('dialog[open]')) {
    await invoke('show_tab', { id: null });
    return;
  }
  if (!tab.loaded) {
    await invoke('show_tab', { id: null });
    await invoke('navigate_tab', { id: activeId, address: tab.url, sidebarLeft: sidebarOffset() });
    tab.loaded = true;
    render();
  }
  await invoke('show_tab', { id: activeId, focus: focusTabId === activeId });
}

async function go(url) {
  status.hidden = true;
  const target = websiteAddress(url);
  if (!target) throw new Error('Use um endereço HTTP ou HTTPS válido, sem credenciais.');

  const id = activeId;
  const tab = tabs.get(id);
  await invoke('navigate_tab', { id, address: target, sidebarLeft: sidebarOffset() });
  tab.url = target;
  tab.loaded = true;
  showCurrentAddress();
  homeSearch.value = '';
  saveSession();
  await syncView(id);
}

function openDialog(dialog) {
  schedule(async () => {
    if (document.querySelector('dialog[open]')) return;
    if (tauri) await invoke('show_tab', { id: null });
    dialog.showModal();
  });
}

async function openTab(url, pinned) {
  createTab(url, pinned);
  if (!url) resetHome();
  showCurrentAddress();
  saveSession();
  await syncView(url ? activeId : undefined);
  if (!url) address.focus();
}

function reopenTab(entry = recentlyClosed.at(-1)) {
  const index = recentlyClosed.indexOf(entry);
  if (index < 0) return;
  recentlyClosed.splice(index, 1);
  return openTab(entry.url, entry.pinned);
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => schedule(syncView));
}
for (const button of document.querySelectorAll('[data-dismiss]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
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
if (tauri?.window) {
  const frame = tauri.window.getCurrentWindow();
  for (const [action, run] of [
    ['minimize', () => frame.minimize()],
    ['maximize', () => frame.toggleMaximize()],
    ['close', () => frame.close()],
  ]) {
    document.querySelector(`[data-window-action="${action}"]`)
      .addEventListener('click', () => run().catch(showError));
  }
  for (const edge of document.querySelectorAll('[data-resize]')) {
    edge.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      frame.startResizeDragging(edge.dataset.resize).catch(showError);
    });
  }
}
for (const [form, input] of [[byId('address-form'), address], [byId('home-search-form'), homeSearch]]) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value;
    schedule(async () => {
      try {
        await go(resolveAddress(value));
      } catch (error) {
        input.setCustomValidity(String(error.message ?? error));
        input.reportValidity();
      }
    });
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
}
address.addEventListener('input', () => { addressDirty = true; });
address.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  showCurrentAddress();
  address.select();
});

document.addEventListener('keydown', (event) => {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  const key = event.key.toLowerCase();
  if (key === 'l' && !event.shiftKey) {
    event.preventDefault();
    if (document.querySelector('dialog[open]')) return;
    address.focus();
    address.select();
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

let resizeFrame;
function scheduleLayout() {
  if (!tauri) return;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => schedule(() => invoke('resize_tabs', {
    width: window.innerWidth,
    height: window.innerHeight,
    sidebarLeft: sidebarOffset(),
  })));
}

initSidebar({
  ...sidebarSettings,
  onChange(settings) {
    const changedMode = settings.collapsed !== sidebarSettings.collapsed;
    sidebarSettings = settings;
    if (changedMode) {
      tabFilter.value = '';
      refreshTabList();
    }
    saveSession();
  },
  onResize: scheduleLayout,
});
renderFavorites();
render();
refreshTabList();
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
      refreshTabList();
      if (!home.hidden && !byId('home-resume').hidden) renderResume();
    });
    await syncView();
  });
  window.addEventListener('resize', scheduleLayout);
}

import { duckDuckGo, resolveNavigation } from './address.js';
import { initDownloads } from './downloads.js';
import { initOffline } from './offline.js';
import { releaseIcon, setIcon } from './icons.js';
import { initAppearance } from './appearance.js';
import { addVisit, HISTORY_KEY, matchesPage, pageTitle, readHistory, suggestPages } from './history.js';
import { initOmnibox } from './omnibox.js';
import { initWebSearch, providerAddress } from './web-search.js';
import { initHome } from './home.js';
import { initSidebar } from './sidebar.js';
import { readSession, SESSION_KEY, websiteAddress } from './session.js';
import { initWorkspaces } from './workspaces.js';

const tauri = window.__TAURI__;
const byId = (id) => document.getElementById(id);
const address = byId('address');
const home = byId('home');
const status = byId('status');
const homeSearch = byId('home-search');
const providerInput = byId('search-provider-url');
const providerDialog = byId('search-provider-dialog');
const providerStatus = byId('provider-status');
let providerTestRequest = 0;
const stage = byId('site-viewport');
const historyFilter = byId('history-filter');
const historyList = byId('history-list');
const historyClear = byId('history-clear');
const historyConfirm = byId('history-confirm');
const visitDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const tabFilter = byId('tab-filter');
const tabList = byId('tab-list');
const reopenButton = byId('reopen-tab');
const favoriteButton = byId('favorite-page');

let snapshot = null;
let history = [];
try {
  if (tauri) {
    snapshot = localStorage.getItem(SESSION_KEY);
    history = readHistory(localStorage.getItem(HISTORY_KEY));
  }
} catch {
  // Navigation remains available if the WebView storage cannot be read.
}
const session = readSession(snapshot);
const knownTitles = new Map(history.slice().reverse().map(({ url, title }) => [url, title]));
const favorites = session.favorites;
const tabs = new Map();
const workspaces = new Map();
let nextId = 0;
for (const { id, name, tabs: urls, queries, pinnedIndices, activeIndex } of session.workspaces) {
  workspaces.set(id, { id, name, activeId: nextId + activeIndex, recentlyClosed: [] });
  for (const [index, url] of urls.entries()) {
    const tab = { workspaceId: id, url, loaded: false, pinned: pinnedIndices.has(index), title: knownTitles.get(url) || '' };
    if (queries[index]) tab.webSearch = searchState(queries[index], 'Pesquise novamente para atualizar os resultados.');
    tabs.set(nextId++, tab);
  }
}
let activeWorkspace = workspaces.get(session.activeWorkspaceId);
let sidebarSettings = session.sidebar;
let appearance = session.appearance;
let searchProvider = session.searchProvider;
let addressDirty = false;
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
    const groups = new Map([...workspaces.keys()].map((id) => [id, []]));
    for (const [id, tab] of tabs) groups.get(tab.workspaceId).push([id, tab]);
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      workspaces: [...workspaces.values()].map(({ id, name, activeId }) => {
        const entries = groups.get(id);
        return {
          id,
          name,
          tabs: entries.map(([, tab]) => tab.url),
          queries: entries.map(([, tab]) => tab.webSearch?.query || ''),
          activeIndex: entries.findIndex(([tabId]) => tabId === activeId),
          pinnedIndices: entries.flatMap(([, tab], index) => tab.pinned ? [index] : []),
        };
      }),
      activeWorkspaceId: activeWorkspace.id,
      favorites: Array.from(favorites, ([url, title]) => ({ url, title })),
      sidebar: sidebarSettings,
      appearance,
      searchProvider,
    }));
    storageFailed = false;
  } catch {
    if (!storageFailed) showError('O Orla não conseguiu salvar a sessão neste dispositivo.');
    storageFailed = true;
  }
}

const showOffline = initOffline();
const downloads = initDownloads(invoke);

function render() {
  const tab = tabs.get(activeWorkspace.activeId);
  workspaceControls.renderCurrent(activeWorkspace.name);
  updateWindowTitle();
  if (!addressDirty) address.value = tab.url || tab.webSearch?.query || '';
  home.hidden = tab.loaded || Boolean(tab.webSearch);
  showOffline(tab.failure);
  webSearch.render(tab.webSearch);
  for (const button of document.querySelectorAll('[data-tab-action]')) {
    button.disabled = !tab.loaded;
  }

  const saved = favorites.has(tab.url);
  const label = saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  favoriteButton.disabled = !tab.url;
  favoriteButton.setAttribute('aria-pressed', String(saved));
  favoriteButton.title = label;
  setIcon(favoriteButton, saved ? 'starred' : 'star');
}

function renderFavorites() {
  const list = byId('favorites-list');
  list.replaceChildren();
  byId('favorites-empty').hidden = favorites.size > 0;
  for (const [url, title] of favorites) {
    const button = document.createElement('button');
    const mark = document.createElement('span');
    mark.className = 'favorite-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = Array.from(title)[0].toLocaleUpperCase('pt-BR');
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = title;
    const host = document.createElement('small');
    host.textContent = new URL(url).hostname.replace(/^www\./, '');
    text.append(name, host);
    button.append(mark, text);
    button.title = url;
    button.addEventListener('click', () => schedule(() => go(url)));
    list.append(button);
  }
}

function resumeRow(url, activate, title = '', date = null) {
  const row = document.createElement('li');
  const button = document.createElement('button');
  const host = document.createElement('strong');
  const detail = document.createElement('span');
  const address = new URL(url);
  host.textContent = title || address.hostname;
  detail.textContent = date ? visitDate.format(date) + ' · ' + address.hostname : address.pathname + address.search + address.hash;
  button.title = url;
  button.append(host, detail);
  button.addEventListener('click', () => schedule(activate));
  row.append(button);
  return row;
}

function workspaceTabs(workspace = activeWorkspace) {
  return [...tabs].filter(([, tab]) => tab.workspaceId === workspace.id);
}

function orderedTabs() {
  return workspaceTabs().sort(([, first], [, second]) => Number(second.pinned) - Number(first.pinned));
}

function renderResume() {
  const open = byId('resume-open');
  const closed = byId('resume-closed');
  open.replaceChildren();
  closed.replaceChildren();
  for (const [id, tab] of orderedTabs()) {
    if (!tab.url || id === activeWorkspace.activeId) continue;
    open.append(resumeRow(tab.url, () => selectTab(id), tab.title));
  }
  for (let index = activeWorkspace.recentlyClosed.length - 1; index >= 0; index--) {
    const entry = activeWorkspace.recentlyClosed[index];
    closed.append(resumeRow(entry.url, () => reopenTab(entry), entry.title));
  }
  byId('resume-open-empty').hidden = open.childElementCount > 0;
  byId('resume-closed-empty').hidden = closed.childElementCount > 0;
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    showError('O Orla não conseguiu salvar o histórico neste dispositivo.');
  }
}

function renderHistory() {
  const empty = byId('history-empty');
  const query = historyFilter.value.trim();
  const entries = history.filter((entry) => matchesPage(query, entry.url, entry.title));
  historyList.replaceChildren();
  historyClear.disabled = !history.length;
  if (!history.length) historyConfirm.hidden = true;
  empty.hidden = entries.length > 0;
  empty.textContent = query ? 'Nenhuma visita encontrada.' : 'As páginas visitadas aparecem aqui.';
  for (const entry of entries) {
    const row = resumeRow(entry.url, () => go(entry.url), entry.title, entry.visitedAt);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-visit';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Apagar visita a ' + (entry.title || new URL(entry.url).hostname));
    remove.addEventListener('click', () => {
      history = history.filter((item) => item !== entry);
      saveHistory();
      renderHistory();
      historyFilter.focus();
    });
    row.append(remove);
    historyList.append(row);
  }
}

historyFilter.addEventListener('input', renderHistory);
historyClear.addEventListener('click', () => {
  historyConfirm.hidden = false;
  byId('history-cancel').focus();
});
byId('history-cancel').addEventListener('click', () => {
  historyConfirm.hidden = true;
  historyClear.focus();
});
byId('history-delete-all').addEventListener('click', () => {
  history = [];
  historyConfirm.hidden = true;
  saveHistory();
  renderHistory();
  historyFilter.focus();
});

const resetHome = initHome(renderResume);

function showCurrentAddress() {
  addressDirty = false;
  address.setCustomValidity('');
  const tab = tabs.get(activeWorkspace.activeId);
  address.value = tab.url || tab.webSearch?.query || '';
}

function stagePosition() {
  const { x, y, width, height } = stage.getBoundingClientRect();
  return { viewport: { x, y, width, height } };
}

async function selectTab(id) {
  omnibox.close();
  if (tabs.get(id)?.workspaceId !== activeWorkspace.id) return;
  if (id !== activeWorkspace.activeId) {
    activeWorkspace.activeId = id;
    showCurrentAddress();
    saveSession();
  }
  await syncView(id);
}

async function closeTab(id) {
  const tab = tabs.get(id);
  if (tab?.workspaceId !== activeWorkspace.id) return;
  if (tab.loaded) await invoke('tab_action', { id, action: 'close' });

  if (tab.url) {
    activeWorkspace.recentlyClosed.push({ url: tab.url, pinned: tab.pinned, title: tab.title });
    if (activeWorkspace.recentlyClosed.length > 20) activeWorkspace.recentlyClosed.shift();
  }
  detachActiveWorkspaceTab(id);
  saveSession();
  await syncView();
}

const tabPreview = byId('tab-preview');
const previewImage = byId('tab-preview-image');
let previewTarget;
let previewTimer;

function closeTabPreview() {
  clearTimeout(previewTimer);
  previewTarget?.removeAttribute('aria-describedby');
  previewTarget = undefined;
  tabPreview.hidden = true;
}

function renderTabPreview() {
  if (!previewTarget) return;
  const tab = tabs.get(Number(previewTarget.dataset.tabId));
  if (!tab?.url) return;
  const description = byId('tab-preview-description');
  description.textContent = tab.description || '';
  description.hidden = !description.textContent;
  byId('tab-preview-title').textContent = tab.socialTitle || tab.title || new URL(tab.url).hostname;
  byId('tab-preview-host').textContent = new URL(tab.url).hostname;
  previewImage.hidden = !tab.thumbnail;
  if (tab.thumbnail) previewImage.src = tab.thumbnail;
  else previewImage.removeAttribute('src');
  previewTarget.setAttribute('aria-describedby', 'tab-preview');
  tabPreview.hidden = false;
}

function queueTabPreview(button) {
  if (previewTarget === button) return;
  closeTabPreview();
  const id = Number(button.dataset.tabId);
  const tab = tabs.get(id);
  if (!tab?.url || sidebarSettings.collapsed) return;
  previewTarget = button;
  previewTimer = setTimeout(() => {
    renderTabPreview();
    if (!tauri || !tab.loaded || !tab.ready || tab.failure || tab.thumbnail) return;
    const { width, height } = stage.getBoundingClientRect();
    invoke('tab_preview', { id, width: Math.round(width), height: Math.round(height) }).catch(() => {
      // Metadata remains available if a page cannot be captured.
    });
  }, 350);
}

function updateWindowTitle() {
  const title = tabs.get(activeWorkspace.activeId)?.title;
  const fullTitle = title ? title + ' · Orla Browser' : 'Orla Browser';
  if (document.title === fullTitle) return;
  document.title = fullTitle;
  tauri?.window?.getCurrentWindow().setTitle?.(fullTitle).catch(showError);
}

function updateTabTitle(id, url, title) {
  const tab = tabs.get(id);
  if (!tab || !title) return;
  tab.pendingTitle = { url, title };
  if (tab.url !== url || tab.title === title) return;
  tab.title = title;
  if (id === activeWorkspace.activeId) updateWindowTitle();
  if (tab.visit?.url === url && history.includes(tab.visit)) {
    tab.visit.title = title;
    saveHistory();
  }
  if (tab.workspaceId === activeWorkspace.id) refreshTabList();
}

function resetTabPreview(tab) {
  delete tab.socialTitle;
  delete tab.description;
  delete tab.thumbnail;
  delete tab.ready;
}

const tabRows = new Map();

function buildTabRow(id) {
  const row = document.createElement('li');
  const select = document.createElement('button');
  select.className = 'tab-select';
  select.dataset.tabId = String(id);
  select.dataset.focusKey = 'select-' + id;
  const mark = document.createElement('span');
  mark.className = 'tab-mark';
  mark.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'tab-title';
  select.append(mark, text);
  select.addEventListener('click', () => {
    closeTabPreview();
    schedule(() => selectTab(id));
  });
  select.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') queueTabPreview(select);
  });
  select.addEventListener('pointerleave', () => {
    if (previewTarget === select) closeTabPreview();
  });
  select.addEventListener('focus', () => {
    if (select.matches(':focus-visible')) queueTabPreview(select);
  });
  select.addEventListener('blur', () => {
    if (previewTarget === select) closeTabPreview();
  });
  select.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && previewTarget === select) closeTabPreview();
  });

  const actions = document.createElement('div');
  actions.className = 'tab-actions';
  const pin = document.createElement('button');
  pin.className = 'icon';
  pin.dataset.pin = String(id);
  pin.dataset.focusKey = 'pin-' + id;
  pin.addEventListener('click', () => schedule(() => togglePin(id)));
  const close = document.createElement('button');
  close.className = 'icon';
  close.dataset.focusKey = 'close-' + id;
  close.addEventListener('click', () => schedule(() => closeTab(id)));
  setIcon(close, 'close');
  actions.append(pin, close);
  row.append(select, actions);
  const parts = { row, select, mark, text, actions, pin, close };
  tabRows.set(id, parts);
  return parts;
}

function togglePin(id) {
  const tab = tabs.get(id);
  if (tab?.workspaceId !== activeWorkspace.id || !tab.url) return;
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const positions = new Map();
  if (animate) {
    for (const row of tabList.children) {
      positions.set(row, row.getBoundingClientRect().top);
      for (const animation of row.getAnimations()) animation.cancel();
    }
  }
  tab.pinned = !tab.pinned;
  saveSession();
  refreshTabList(id);
  for (const [row, top] of positions) {
    const delta = top - row.getBoundingClientRect().top;
    if (row.isConnected && delta) {
      row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration: 180, easing: 'cubic-bezier(.2,.75,.25,1)',
      });
    }
  }
}

function refreshTabList(animatedPinId) {
  const target = document.activeElement?.closest('#tab-list button')?.dataset.focusKey;
  const scroll = tabList.scrollTop;
  const visible = new Set();
  closeTabPreview();
  reopenButton.disabled = !activeWorkspace.recentlyClosed.length;
  const filter = sidebarSettings.collapsed ? '' : tabFilter.value.trim().toLocaleLowerCase('pt-BR');
  let index = 0;
  for (const [id, tab] of orderedTabs()) {
    if (sidebarSettings.collapsed && id !== activeWorkspace.activeId) continue;
    const title = tab.url ? tab.title || new URL(tab.url).hostname : tab.webSearch?.query || 'Nova aba';
    if (filter && !title.toLocaleLowerCase('pt-BR').includes(filter) && !tab.url.toLowerCase().includes(filter)) continue;
    const { row, select, mark, text, actions, pin, close } = tabRows.get(id) ?? buildTabRow(id);
    visible.add(id);
    row.dataset.pinned = String(tab.pinned);
    row.dataset.active = String(id === activeWorkspace.activeId);
    select.setAttribute('aria-label', title);
    if (id === activeWorkspace.activeId) select.setAttribute('aria-current', 'true');
    else select.removeAttribute('aria-current');
    if (!tab.url || sidebarSettings.collapsed) select.title = title;
    else select.removeAttribute('title');
    setIcon(mark, tab.url ? 'globe' : tab.webSearch ? 'search' : 'page');
    text.textContent = title;
    pin.hidden = !tab.url;
    actions.hidden = sidebarSettings.collapsed;
    setIcon(pin, tab.pinned ? 'pinned' : 'pin', id === animatedPinId);
    pin.setAttribute('aria-label', 'Fixar aba ' + title);
    pin.setAttribute('aria-pressed', String(tab.pinned));
    pin.title = tab.pinned ? 'Desafixar aba' : 'Fixar aba';
    close.setAttribute('aria-label', 'Fechar aba ' + title);
    close.title = 'Fechar aba';
    const slot = tabList.children[index++];
    if (slot !== row) tabList.insertBefore(row, slot ?? null);
  }
  for (const [id, { row, pin }] of tabRows) {
    if (visible.has(id)) continue;
    releaseIcon(pin);
    row.remove();
    tabRows.delete(id);
  }
  byId('tabs-empty').hidden = visible.size > 0;
  tabList.scrollTop = scroll;
  if (target) {
    const next = tabList.querySelector(`[data-focus-key="${target}"]:not([hidden])`)
      ?? tabList.querySelector('[aria-current="true"]') ?? tabFilter;
    if (next !== document.activeElement) next.focus({ preventScroll: true });
  }
}

function createTab(url = '', pinned = false, workspace = activeWorkspace) {
  const id = nextId++;
  tabs.set(id, { workspaceId: workspace.id, url, loaded: false, pinned, title: knownTitles.get(url) || '' });
  if (workspace === activeWorkspace) workspace.activeId = id;
}

function detachActiveWorkspaceTab(id) {
  const ids = orderedTabs().map(([tabId]) => tabId);
  const index = ids.indexOf(id);
  tabs.delete(id);
  if (id !== activeWorkspace.activeId) return;
  if (ids.length === 1) createTab();
  else activeWorkspace.activeId = ids[index + 1] ?? ids[index - 1];
  showCurrentAddress();
}

function searchState(query, status = '') {
  return { query, results: [], status };
}

async function syncView(focusTabId) {
  render();
  refreshTabList();
  if (!home.hidden && !byId('home-resume').hidden) renderResume();
  if (!tauri) return;
  const tab = tabs.get(activeWorkspace.activeId);
  if (!tab.url || tab.failure || document.querySelector('dialog[open]')) {
    await invoke('show_tab', { id: null, focus: Boolean(tab.failure) });
    return;
  }
  if (!tab.loaded) {
    await invoke('show_tab', { id: null });
    try {
      await invoke('navigate_tab', { id: activeWorkspace.activeId, address: tab.url, ...stagePosition() });
    } catch {
      tab.failure = 'navigation';
      tab.loaded = true;
      render();
      return;
    }
    tab.loaded = true;
    render();
  }
  await invoke('show_tab', { id: activeWorkspace.activeId, focus: focusTabId === activeWorkspace.activeId, ...stagePosition() });
}

async function go(url) {
  status.hidden = true;
  omnibox.close();
  const target = websiteAddress(url);
  if (!target) throw new Error('Use um endereço HTTP ou HTTPS válido, sem credenciais.');

  const id = activeWorkspace.activeId;
  const tab = tabs.get(id);
  try {
    await invoke('navigate_tab', { id, address: target, ...stagePosition() });
    delete tab.failure;
  } catch {
    tab.failure = 'navigation';
  }
  if (tab.url !== target) {
    resetTabPreview(tab);
    tab.title = '';
  }
  tab.url = target;
  delete tab.webSearch;
  tab.loaded = true;
  showCurrentAddress();
  homeSearch.value = '';
  saveSession();
  await syncView(id);
}

function openDialog(dialog) {
  schedule(async () => {
    if (document.querySelector('dialog[open]')) return;
    omnibox.close();
    if (tauri) await invoke('show_tab', { id: null });
    dialog.showModal();
  });
}

async function openTab(url, pinned) {
  omnibox.close();
  createTab(url, pinned);
  if (!url) resetHome();
  showCurrentAddress();
  saveSession();
  await syncView(url ? activeWorkspace.activeId : undefined);
  if (!url) address.focus();
}

function hasContent(tab) {
  return Boolean(tab.url || tab.webSearch);
}

function workspaceOptions() {
  const counts = new Map();
  for (const { workspaceId, url, webSearch } of tabs.values()) {
    if (url || webSearch) counts.set(workspaceId, (counts.get(workspaceId) || 0) + 1);
  }
  return [...workspaces.values()].map(({ id, name }) => ({ id, name, count: counts.get(id) || 0 }));
}

const workspaceControls = initWorkspaces({
  open: openDialog,
  getState: () => ({
    spaces: workspaceOptions(),
    activeId: activeWorkspace.id,
    canMove: hasContent(tabs.get(activeWorkspace.activeId)),
    canRemove: workspaces.size > 1 && workspaceTabs().every(([, tab]) => !hasContent(tab)),
  }),
  select: (id) => schedule(() => {
    const workspace = workspaces.get(id);
    if (workspace) switchWorkspace(workspace);
  }),
  create: (name) => schedule(() => {
    let id = 0;
    while (workspaces.has(id)) id++;
    const workspace = { id, name, activeId: undefined, recentlyClosed: [] };
    workspaces.set(id, workspace);
    switchWorkspace(workspace);
  }),
  rename: (name) => schedule(() => {
    activeWorkspace.name = name;
    saveSession();
    workspaceControls.renderCurrent(name);
    workspaceControls.renderDialog();
  }),
  move: (id) => schedule(() => {
    const target = workspaces.get(id);
    const tabId = activeWorkspace.activeId;
    const tab = tabs.get(tabId);
    if (!target || target === activeWorkspace || !hasContent(tab)) return;
    detachActiveWorkspaceTab(tabId);
    const targetEntries = workspaceTabs(target);
    if (targetEntries.length === 1 && !hasContent(targetEntries[0][1])) {
      tabs.delete(targetEntries[0][0]);
      target.activeId = tabId;
    }
    tab.workspaceId = target.id;
    tabs.set(tabId, tab);
    saveSession();
    workspaceControls.close();
  }),
  remove: () => schedule(() => {
    const target = [...workspaces.values()].find((workspace) => workspace !== activeWorkspace);
    const entries = workspaceTabs();
    if (!target || entries.some(([, tab]) => hasContent(tab))) return;
    for (const [id] of entries) tabs.delete(id);
    workspaces.delete(activeWorkspace.id);
    switchWorkspace(target);
  }),
});

function switchWorkspace(workspace) {
  omnibox.close();
  closeTabPreview();
  activeWorkspace = workspace;
  if (workspace.activeId === undefined) createTab();
  tabFilter.value = '';
  showCurrentAddress();
  saveSession();
  workspaceControls.close();
}

function reopenTab(entry = activeWorkspace.recentlyClosed.at(-1)) {
  const index = activeWorkspace.recentlyClosed.indexOf(entry);
  if (index < 0) return;
  activeWorkspace.recentlyClosed.splice(index, 1);
  return openTab(entry.url, entry.pinned);
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => schedule(syncView));
}
for (const button of document.querySelectorAll('[data-dismiss]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
byId('downloads-toggle').addEventListener('click', () => openDialog(byId('downloads-dialog')));
byId('offline-retry').addEventListener('click', () => schedule(() => go(tabs.get(activeWorkspace.activeId).url)));
byId('appearance').addEventListener('click', () => openDialog(byId('appearance-dialog')));
byId('agent').addEventListener('click', () => openDialog(byId('agent-dialog')));
for (const button of [byId('new-tab'), byId('add-tab')]) {
  button.addEventListener('click', () => schedule(() => openTab()));
}
reopenButton.addEventListener('click', () => schedule(reopenTab));
tabFilter.addEventListener('input', refreshTabList);
favoriteButton.addEventListener('click', () => {
  const url = tabs.get(activeWorkspace.activeId).url;
  if (!url) return;
  if (favorites.has(url)) favorites.delete(url);
  else favorites.set(url, new URL(url).hostname);
  saveSession();
  renderFavorites();
  setIcon(favoriteButton, favorites.has(url) ? 'starred' : 'star', true);
  render();
});

for (const button of document.querySelectorAll('[data-tab-action]')) {
  button.addEventListener('click', () => schedule(() => invoke('tab_action', { id: activeWorkspace.activeId, action: button.dataset.tabAction })));
}
if (tauri?.window) {
  const frame = tauri.window.getCurrentWindow();
  const maximizeButton = document.querySelector('[data-window-action="maximize"]');
  let resizeTimer;
  let stateVersion = 0;

  async function updateMaximizeIcon(animate = true) {
    const version = ++stateVersion;
    const maximized = await frame.isMaximized();
    if (version !== stateVersion) return;
    const label = maximized ? 'Restaurar janela' : 'Maximizar janela';
    maximizeButton.setAttribute('aria-label', label);
    maximizeButton.title = label;
    setIcon(maximizeButton, maximized ? 'restore' : 'maximize', animate);
  }

  setIcon(maximizeButton, 'maximize');
  updateMaximizeIcon(false).catch(showError);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => updateMaximizeIcon().catch(showError), 90);
  });
  for (const [action, run] of [
    ['minimize', () => frame.minimize()],
    ['maximize', async () => {
      await frame.toggleMaximize();
      await updateMaximizeIcon();
    }],
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
const webSearch = initWebSearch({
  invoke,
  isActive: (state) => tabs.get(activeWorkspace.activeId).webSearch === state,
  openResult: (url) => schedule(() => openTab(url)),
});

async function searchWeb(query) {
  if (Array.from(query).length > 300) throw new Error('Digite uma pesquisa de até 300 caracteres.');
  if (tabs.get(activeWorkspace.activeId).url) createTab();
  const tab = tabs.get(activeWorkspace.activeId);
  tab.webSearch = searchState(query);
  showCurrentAddress();
  homeSearch.value = '';
  saveSession();
  await syncView();
  webSearch.run(tab.webSearch, searchProvider);
}

function submitNavigation(value) {
  const destination = resolveNavigation(value);
  return destination.url ? go(destination.url) : searchWeb(destination.query);
}

byId('web-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const query = byId('web-search-query').value.trim();
  if (query) schedule(() => searchWeb(query));
});
byId('search-fallback').addEventListener('click', () => {
  const query = tabs.get(activeWorkspace.activeId).webSearch?.query;
  if (query) schedule(() => openTab(duckDuckGo(query)));
});
function openProviderSettings() {
  providerTestRequest++;
  providerStatus.textContent = '';
  providerInput.setCustomValidity('');
  providerInput.value = searchProvider;
  openDialog(providerDialog);
}

byId('search-provider-toggle').addEventListener('click', openProviderSettings);
byId('settings-search').addEventListener('click', () => {
  byId('appearance-dialog').close();
  openProviderSettings();
});
byId('provider-test').addEventListener('click', async () => {
  const token = ++providerTestRequest;
  try {
    const provider = providerAddress(providerInput.value);
    if (!provider) throw new Error('Informe o endereço da instância para testar a conexão.');
    providerStatus.textContent = 'Testando a conexão…';
    await invoke('search_web', { provider, query: 'Orla' });
    if (token === providerTestRequest) providerStatus.textContent = 'A conexão funcionou e o provedor retornou JSON.';
  } catch (error) {
    if (token === providerTestRequest) providerStatus.textContent = String(error.message ?? error);
  }
});
byId('search-provider-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    searchProvider = providerAddress(providerInput.value);
  } catch (error) {
    providerInput.setCustomValidity(error.message);
    providerInput.reportValidity();
    return;
  }
  saveSession();
  providerDialog.close();
  const state = tabs.get(activeWorkspace.activeId).webSearch;
  if (state) webSearch.run(state, searchProvider);
});
providerInput.addEventListener('input', () => {
  providerInput.setCustomValidity('');
  providerTestRequest++;
  providerStatus.textContent = '';
});

const omnibox = initOmnibox({
  input: address,
  list: byId('address-suggestions'),
  search: (query) => suggestPages(query, { tabs: workspaceTabs(), favorites, history, activeId: activeWorkspace.activeId }),
  onSelect: (result) => schedule(() => result.kind === 'tab' ? selectTab(result.id) : go(result.url)),
  onLayout: scheduleLayout,
});

for (const [form, input] of [[byId('address-form'), address], [byId('home-search-form'), homeSearch]]) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input === address && omnibox.submit()) return;
    omnibox.close();
    const value = input.value;
    schedule(async () => {
      try {
        await submitNavigation(value);
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
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  showCurrentAddress();
  address.select();
});

function runShortcut(action) {
  if (document.querySelector('dialog[open]')) return false;
  switch (action) {
    case 'address':
      omnibox.close();
      address.focus();
      address.select();
      return true;
    case 'new-tab': schedule(() => openTab()); return true;
    case 'reopen-tab': schedule(() => reopenTab()); return true;
    case 'close-tab': schedule(() => closeTab(activeWorkspace.activeId)); return true;
    default: return false;
  }
}

document.addEventListener('keydown', (event) => {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.isComposing) return;
  const action = (event.shiftKey
    ? { t: 'reopen-tab' }
    : { l: 'address', t: 'new-tab', w: 'close-tab' })[event.key.toLowerCase()];
  if (runShortcut(action)) event.preventDefault();
});

let resizeFrame;
let resizing = false;
let resizePending = false;

function scheduleLayout() {
  if (!tauri) return;
  resizePending = true;
  if (resizeFrame || resizing) return;
  resizeFrame = requestAnimationFrame(async () => {
    resizeFrame = undefined;
    resizePending = false;
    resizing = true;
    try {
      await invoke('resize_tabs', stagePosition());
    } catch (error) {
      showError(error);
    } finally {
      resizing = false;
      if (resizePending) scheduleLayout();
    }
  });
}

initAppearance(appearance, (settings) => {
  appearance = settings;
  saveSession();
});

for (const element of document.querySelectorAll('[data-static-icon]')) {
  if (!element.dataset.iconState) setIcon(element, element.dataset.staticIcon);
}
const sidebarToggle = byId('tabs-toggle');
setIcon(sidebarToggle, sidebarSettings.collapsed ? 'sidebarClosed' : 'sidebar');
initSidebar({
  ...sidebarSettings,
  onChange(settings) {
    const changedMode = settings.collapsed !== sidebarSettings.collapsed;
    sidebarSettings = settings;
    if (changedMode) {
      setIcon(sidebarToggle, settings.collapsed ? 'sidebarClosed' : 'sidebar', true);
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
    await tauri.event.listen('orla-location', ({ payload }) => schedule(async () => {
      const id = Number(payload.id.slice(4));
      const tab = tabs.get(id);
      const url = websiteAddress(payload.url);
      if (!tab || !url) return;
      if (!payload.finished) resetTabPreview(tab);
      if (url !== tab.url) {
        tab.url = url;
        tab.title = tab.pendingTitle?.url === url ? tab.pendingTitle.title : '';
        saveSession();
        if (id === activeWorkspace.activeId) render();
        if (tab.workspaceId === activeWorkspace.id) refreshTabList();
      }
      if (payload.failure) {
        tab.failure = payload.failure;
        tab.loaded = true;
        if (id === activeWorkspace.activeId) {
          await syncView();
          byId('offline-retry').focus();
        }
        return;
      }
      if (payload.finished) {
        tab.ready = true;
        tab.visit = addVisit(history, url, tab.title);
        if (tab.visit) saveHistory();
      }
      if (!home.hidden && !byId('home-resume').hidden) renderResume();
    }));
    await tauri.event.listen('orla-title', ({ payload }) => schedule(() => {
      const url = websiteAddress(payload.url);
      if (url) updateTabTitle(Number(payload.id.slice(4)), url, pageTitle(payload.title));
    }));
    await tauri.event.listen('orla-page-metadata', ({ payload }) => schedule(() => {
      const id = Number(payload.id.slice(4));
      const tab = tabs.get(id);
      const url = websiteAddress(payload.page.url);
      if (!tab || !url || tab.url !== url || tab.failure) return;
      tab.description = typeof payload.page.description === 'string'
        ? payload.page.description.trim().slice(0, 320) : '';
      tab.socialTitle = pageTitle(payload.page.socialTitle);
      if (!tab.title) updateTabTitle(id, url, pageTitle(payload.page.title) || tab.socialTitle);
      if (!tabPreview.hidden && Number(previewTarget?.dataset.tabId) === id) renderTabPreview();
    }));
    await tauri.event.listen('orla-tab-preview', ({ payload }) => {
      const tab = tabs.get(payload.id);
      const url = websiteAddress(payload.url);
      const data = payload.image;
      if (!tab || tab.url !== url || !tab.ready || tab.failure || typeof data !== 'string'
        || data.length > 400000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) return;
      tab.thumbnail = 'data:image/jpeg;base64,' + data;
      if (!tabPreview.hidden && Number(previewTarget?.dataset.tabId) === payload.id) renderTabPreview();
    });
    await tauri.event.listen('orla-new-tab', ({ payload }) => schedule(() => {
      const url = websiteAddress(payload.url);
      const source = tabs.get(Number(payload.id.slice(4)));
      if (!url || !source) return;
      const workspace = workspaces.get(source.workspaceId);
      if (workspace === activeWorkspace) return openTab(url);
      createTab(url, false, workspace);
      saveSession();
    }));
    await tauri.event.listen('orla-download', ({ payload }) => downloads.update(payload));
    await tauri.event.listen('orla-download-error', ({ payload }) => downloads.reportError(payload));
    await tauri.event.listen('orla-shortcut', ({ payload }) => runShortcut(payload));
    await syncView();
  });
  new ResizeObserver(scheduleLayout).observe(stage);
  window.addEventListener('resize', scheduleLayout);
}

import { duckDuckGo, resolveNavigation } from './address.js';
import { initDownloads } from './downloads.js';
import { initOffline } from './offline.js';
import { initAppearance } from './appearance.js';
import { addVisit, HISTORY_KEY, matchesPage, pageTitle, readHistory, suggestPages } from './history.js';
import { initOmnibox } from './omnibox.js';
import { initWebSearch, providerAddress } from './web-search.js';
import { initHome } from './home.js';
import { initSidebar } from './sidebar.js';
import { readSession, SESSION_KEY, websiteAddress } from './session.js';

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
const recentlyClosed = [];

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
const tabs = new Map(session.tabs.map((url, id) => [id, {
  url, loaded: false, pinned: session.pinnedIndices.has(id), title: knownTitles.get(url) || '',
}]));
let activeId = session.activeIndex;
let sidebarSettings = session.sidebar;
let appearance = session.appearance;
let searchProvider = session.searchProvider;
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
  const tab = tabs.get(activeId);
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
    open.append(resumeRow(tab.url, () => selectTab(id), tab.title));
  }
  for (let index = recentlyClosed.length - 1; index >= 0; index--) {
    const entry = recentlyClosed[index];
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
  const tab = tabs.get(activeId);
  address.value = tab.url || tab.webSearch?.query || '';
}

function stagePosition() {
  const { x, y, width, height } = stage.getBoundingClientRect();
  return { viewport: { x, y, width, height } };
}

async function selectTab(id) {
  omnibox.close();
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
    recentlyClosed.push({ url: tab.url, pinned: tab.pinned, title: tab.title });
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
  const title = tabs.get(activeId)?.title;
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
  if (id === activeId) updateWindowTitle();
  if (tab.visit?.url === url && history.includes(tab.visit)) {
    tab.visit.title = title;
    saveHistory();
  }
  refreshTabList();
}

function resetTabPreview(tab) {
  delete tab.socialTitle;
  delete tab.description;
  delete tab.thumbnail;
  delete tab.ready;
}

function refreshTabList() {
  const focused = document.activeElement;
  const target = focused?.closest('#tab-list button')?.dataset.focusKey;
  const scroll = tabList.scrollTop;
  closeTabPreview();
  tabList.replaceChildren();
  reopenButton.disabled = !recentlyClosed.length;
  const filter = sidebarSettings.collapsed ? '' : (tabFilter.value || '').trim().toLocaleLowerCase('pt-BR');
  for (const [id, tab] of orderedTabs()) {
    if (sidebarSettings.collapsed && id !== activeId) continue;
    const title = tab.url ? tab.title || new URL(tab.url).hostname : tab.webSearch?.query || 'Nova aba';
    if (filter && !title.toLocaleLowerCase('pt-BR').includes(filter)
      && !tab.url.toLowerCase().includes(filter)) continue;

    const row = document.createElement('li');
    row.dataset.pinned = String(tab.pinned);
    const select = document.createElement('button');
    select.textContent = sidebarSettings.collapsed ? Array.from(title)[0].toUpperCase() : title;
    select.dataset.tabId = String(id);
    if (!tab.url) select.title = title;
    select.setAttribute('aria-label', title);
    select.dataset.focusKey = 'select-' + id;
    if (id === activeId) select.setAttribute('aria-current', 'true');
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
  tabs.set(activeId, { url, loaded: false, pinned, title: '' });
}

async function syncView(focusTabId) {
  render();
  refreshTabList();
  if (!home.hidden && !byId('home-resume').hidden) renderResume();
  if (!tauri) return;
  const tab = tabs.get(activeId);
  if (!tab.url || tab.failure || document.querySelector('dialog[open]')) {
    await invoke('show_tab', { id: null, focus: Boolean(tab.failure) });
    return;
  }
  if (!tab.loaded) {
    await invoke('show_tab', { id: null });
    try {
      await invoke('navigate_tab', { id: activeId, address: tab.url, ...stagePosition() });
    } catch {
      tab.failure = 'navigation';
      tab.loaded = true;
      render();
      return;
    }
    tab.loaded = true;
    render();
  }
  await invoke('show_tab', { id: activeId, focus: focusTabId === activeId, ...stagePosition() });
}

async function go(url) {
  status.hidden = true;
  omnibox.close();
  const target = websiteAddress(url);
  if (!target) throw new Error('Use um endereço HTTP ou HTTPS válido, sem credenciais.');

  const id = activeId;
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
byId('downloads-toggle').addEventListener('click', () => openDialog(byId('downloads-dialog')));
byId('offline-retry').addEventListener('click', () => schedule(() => go(tabs.get(activeId).url)));
byId('appearance').addEventListener('click', () => openDialog(byId('appearance-dialog')));
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
const webSearch = initWebSearch({
  invoke,
  isActive: (state) => tabs.get(activeId).webSearch === state,
  openResult: (url) => schedule(() => openTab(url)),
});

async function searchWeb(query) {
  if (Array.from(query).length > 300) throw new Error('Digite uma pesquisa de até 300 caracteres.');
  if (tabs.get(activeId).url) createTab();
  const tab = tabs.get(activeId);
  tab.webSearch = { query, results: [], status: '' };
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
  const query = tabs.get(activeId).webSearch?.query;
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
  const state = tabs.get(activeId).webSearch;
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
  search: (query) => suggestPages(query, { tabs, favorites, history, activeId }),
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
    case 'close-tab': schedule(() => closeTab(activeId)); return true;
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
        if (id === activeId) render();
        refreshTabList();
      }
      if (payload.failure) {
        tab.failure = payload.failure;
        tab.loaded = true;
        if (id === activeId) {
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
    await tauri.event.listen('orla-new-tab', ({ payload }) => {
      const url = websiteAddress(payload);
      if (url) schedule(() => openTab(url));
    });
    await tauri.event.listen('orla-download', ({ payload }) => downloads.update(payload));
    await tauri.event.listen('orla-download-error', ({ payload }) => downloads.reportError(payload));
    await tauri.event.listen('orla-shortcut', ({ payload }) => runShortcut(payload));
    await syncView();
  });
  new ResizeObserver(scheduleLayout).observe(stage);
  window.addEventListener('resize', scheduleLayout);
}

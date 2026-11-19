import { resolveAddress } from './address.js';

const tauri = window.__TAURI__;
const byId = (id) => document.getElementById(id);
const address = byId('address');
const home = byId('home');
const status = byId('status');
const query = byId('query');
const searchDialog = byId('search-dialog');
const tabDialog = byId('tab-dialog');
const tabs = new Map();
let activeId = 0;
let nextId = 1;
let pending = Promise.resolve();

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

function render() {
  const tab = tabs.get(activeId);
  address.querySelector('span').textContent = tab.url || 'Pesquisar ou digitar endereço';
  home.hidden = Boolean(tab.url);
  for (const button of document.querySelectorAll('[data-tab-action]')) {
    button.disabled = !tab.url;
  }
}

function refreshTabList() {
  const list = byId('tab-list');
  list.replaceChildren();
  for (const [id, tab] of tabs) {
    const row = document.createElement('li');
    const select = document.createElement('button');
    select.textContent = tab.url ? new URL(tab.url).hostname : 'Nova aba';
    if (id === activeId) select.setAttribute('aria-current', 'true');
    select.addEventListener('click', () => schedule(async () => {
      activeId = id;
      tabDialog.close();
      await syncView();
    }));
    const close = document.createElement('button');
    close.textContent = '×';
    close.setAttribute('aria-label', 'Fechar aba ' + select.textContent);
    close.addEventListener('click', () => schedule(async () => {
      if (tab.url) await invoke('tab_action', { id, action: 'close' });
      tabs.delete(id);
      if (!tabs.size) createTab();
      if (id === activeId) activeId = tabs.keys().next().value;
      refreshTabList();
      render();
      tabDialog.querySelector('#add-tab').focus();
    }));
    row.append(select, close);
    list.append(row);
  }
}

function createTab() {
  activeId = nextId++;
  tabs.set(activeId, { url: '' });
  render();
}

async function syncView() {
  render();
  const viewing = tabs.get(activeId).url && !document.querySelector('dialog[open]');
  if (tauri) await invoke('show_tab', { id: viewing ? activeId : null });
}

async function go(url) {
  status.hidden = true;
  await invoke('navigate_tab', { id: activeId, address: url });
  tabs.get(activeId).url = url;
  if (searchDialog.open) searchDialog.close();
  await syncView();
}

function openDialog(dialog) {
  schedule(async () => {
    if (document.querySelector('dialog[open]')) return;
    if (tauri) await invoke('show_tab', { id: null });
    if (dialog === tabDialog) refreshTabList();
    if (dialog === searchDialog) query.value = tabs.get(activeId).url;
    dialog.showModal();
    if (dialog === searchDialog) query.select();
  });
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
  button.addEventListener('click', () => schedule(async () => {
    createTab();
    if (tabDialog.open) tabDialog.close();
    await syncView();
    address.focus();
  }));
}
for (const button of document.querySelectorAll('[data-url]')) {
  button.addEventListener('click', () => schedule(() => go(button.dataset.url)));
}
for (const button of document.querySelectorAll('[data-tab-action]')) {
  button.addEventListener('click', () => schedule(() => invoke('tab_action', { id: activeId, action: button.dataset.tabAction })));
}
for (const button of document.querySelectorAll('[data-window-action]')) {
  button.addEventListener('click', () => schedule(() => invoke('window_action', { action: button.dataset.windowAction })));
}
byId('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  schedule(() => go(resolveAddress(query.value))).then(() => {
    if (searchDialog.open && !status.hidden) {
      query.setCustomValidity(status.textContent);
      query.reportValidity();
    }
  });
});
query.addEventListener('input', () => query.setCustomValidity(''));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    openDialog(searchDialog);
  }
});

createTab();
if (tauri) {
  tauri.event.listen('orla-location', ({ payload }) => {
    const id = Number(payload.id.slice(4));
    const tab = tabs.get(id);
    if (tab) {
      tab.url = payload.url;
      if (id === activeId) render();
    }
  }).catch(showError);
  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => schedule(() => invoke('resize_tabs', {
      width: window.innerWidth,
      height: window.innerHeight,
    })));
  });
}

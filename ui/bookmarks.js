import { readFolderPath, websiteAddress, workspaceName } from './session.js';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const key = (path) => JSON.stringify(path);
const startsWith = (path, prefix) => prefix.every((part, index) => path[index] === part);

function treeOf(favorites, locations, folders) {
  const root = { path: [], folders: new Map(), links: [] };
  function folder(path) {
    let node = root;
    for (const name of path) {
      if (!node.folders.has(name)) node.folders.set(name, { path: [...node.path, name], folders: new Map(), links: [] });
      node = node.folders.get(name);
    }
    return node;
  }
  for (const path of folders) folder(path);
  for (const [url, title] of favorites) folder(locations.get(url) || []).links.push({ url, title });
  return root;
}

export async function readBookmarkFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('O arquivo de favoritos precisa ter até 8 MB.');
  const template = document.createElement('template');
  template.innerHTML = await file.text();
  const bookmarks = new Map();
  const folders = new Map();
  function visit(parent, path) {
    let pending;
    for (const element of parent.children) {
      const tag = element.tagName;
      if (tag === 'A' || tag === 'H3') {
        const title = element.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);
        if (tag === 'H3') pending = workspaceName(title);
        else {
          const url = websiteAddress(element.getAttribute('href')?.trim());
          if (url && !bookmarks.has(url)) bookmarks.set(url, { title: title || new URL(url).hostname, path });
        }
      } else if (tag === 'DL') {
        const next = pending ? readFolderPath([...path, pending]) : path;
        if (next.length && folders.size < 300) folders.set(key(next), next);
        visit(element, next);
        pending = undefined;
      } else if (['DT', 'P', 'DD', 'DIV'].includes(tag)) {
        const heading = element.firstElementChild;
        if (tag === 'DT' && heading?.tagName === 'H3' && !element.querySelector('dl')) pending = workspaceName(heading.textContent);
        else visit(element, path);
      }
    }
  }
  visit(template.content, []);
  if (!bookmarks.size && !folders.size) throw new Error('Nenhum favorito HTTP ou HTTPS ou pasta foi encontrado.');
  return { bookmarks, folders: [...folders.values()] };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function exportBookmarks(favorites, locations, folders) {
  function contents(node) {
    const links = node.links.map(({ url, title }) => '<DT><A HREF="' + escapeHtml(url) + '">' + escapeHtml(title) + '</A>');
    const groups = [...node.folders].map(([name, child]) => '<DT><H3>' + escapeHtml(name) + '</H3>\n<DL><p>\n' + contents(child) + '\n</DL><p>');
    return [...links, ...groups].join('\n');
  }
  return '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n'
    + '<TITLE>Favoritos do Orla</TITLE>\n<H1>Favoritos do Orla</H1>\n<DL><p>\n'
    + contents(treeOf(favorites, locations, folders)) + '\n</DL><p>\n';
}

export function initBookmarks(favorites, locations, folders, onChange, open, navigate) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('bookmarks-dialog');
  const list = byId('bookmarks-tree');
  const form = byId('bookmark-editor');
  const name = byId('bookmark-name');
  const parent = byId('bookmark-parent');
  const status = byId('bookmark-editor-status');
  let editing;

  function edit(item = {}) {
    editing = item;
    const options = [new Option('Raiz dos favoritos', '[]')];
    function append(node) {
      for (const child of node.folders.values()) {
        if (item.folder && startsWith(child.path, item.folder)) continue;
        options.push(new Option(child.path.join(' / '), key(child.path)));
        append(child);
      }
    }
    append(treeOf(favorites, locations, folders));
    parent.replaceChildren(...options);
    parent.value = key(item.folder?.slice(0, -1) || item.path || []);
    name.value = item.title || item.folder?.at(-1) || '';
    form.hidden = false;
    status.textContent = '';
    name.focus();
  }

  function render() {
    list.replaceChildren();
    function row(label, depth, openItem, editItem) {
      const li = document.createElement('li');
      li.style.setProperty('--folder-depth', depth);
      const display = document.createElement(openItem ? 'button' : 'strong');
      display.textContent = label;
      if (openItem) display.addEventListener('click', openItem);
      const button = document.createElement('button');
      button.textContent = 'Editar';
      button.setAttribute('aria-label', 'Editar ' + label);
      button.addEventListener('click', editItem);
      li.append(display, button);
      list.append(li);
    }
    function append(node) {
      for (const child of node.folders.values()) {
        row(child.path.at(-1), node.path.length, null, () => edit({ folder: child.path }));
        append(child);
      }
      for (const { url, title } of node.links) {
        row(title, node.path.length, () => { dialog.close(); navigate(url); }, () => edit({ url, title, path: node.path }));
      }
    }
    append(treeOf(favorites, locations, folders));
  }

  byId('bookmarks-manage').addEventListener('click', () => {
    render();
    status.textContent = '';
    form.hidden = true;
    open(dialog);
  });
  byId('bookmarks-new-folder').addEventListener('click', () => edit());
  byId('bookmark-edit-cancel').addEventListener('click', () => {
    form.hidden = true;
    byId('bookmarks-new-folder').focus();
  });
  byId('bookmarks-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportBookmarks(favorites, locations, folders)], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'favoritos-orla.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = editing.url ? name.value.trim().slice(0, 100) : workspaceName(name.value);
    if (!title) return;
    const destination = JSON.parse(parent.value || '[]');
    const next = [...destination, title];
    if (editing.folder && startsWith(destination, editing.folder)) return;
    if (!editing.url && next.length > 12) {
      status.textContent = 'Escolha uma pasta com menos níveis.';
      return;
    }
    const previous = editing.folder;
    const remap = (path) => startsWith(path, previous) ? [...next, ...path.slice(previous.length)] : path;
    if (previous && [...folders, ...locations.values()].some((path) => remap(path).length > 12)) {
      status.textContent = 'Escolha um destino com menos níveis para manter as subpastas.';
      return;
    }
    if (editing.url) {
      favorites.set(editing.url, title);
      if (destination.length) locations.set(editing.url, destination);
      else locations.delete(editing.url);
    } else if (previous) {
      for (const [url, path] of locations) locations.set(url, remap(path));
      const moved = folders.map(remap);
      folders.splice(0, folders.length, ...new Map(moved.map((path) => [key(path), path])).values());
    } else if (!folders.some((path) => key(path) === key(next))) {
      if (folders.length >= 300) { status.textContent = 'Limite de 300 pastas criadas.'; return; }
      folders.push(next);
    }
    form.hidden = true;
    status.textContent = onChange() ? 'Alterações salvas.' : 'Não foi possível salvar as alterações.';
    render();
    byId('bookmarks-new-folder').focus();
  });
}

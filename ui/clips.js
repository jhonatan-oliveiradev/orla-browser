import { websiteAddress } from './session.js';

export const CLIP_LIMIT = 60;
export const CLIP_TEXT_LIMIT = 2000;
export const CLIP_NOTE_LIMIT = 500;

export function readClips(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, CLIP_LIMIT).flatMap((item) => {
    const url = websiteAddress(item?.url);
    const id = item?.id;
    if (!url || typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || ids.has(id)) return [];
    ids.add(id);
    const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
    return [{
      id, url, title: trim(item.title, 160) || new URL(url).hostname,
      text: trim(item.text, CLIP_TEXT_LIMIT), note: trim(item.note, CLIP_NOTE_LIMIT),
    }];
  });
}

export function initClips({ open, save, remove, navigate }) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('clip-dialog');
  const form = byId('clip-form');
  const text = byId('clip-text');
  const note = byId('clip-note');
  const status = byId('clip-status');
  const list = byId('clips-list');
  let draft;
  let space;

  function edit(workspace, item) {
    space = workspace;
    draft = item;
    byId('clip-heading').textContent = item.id ? 'Editar captura' : 'Capturar página';
    byId('clip-source').textContent = item.title + ' · ' + new URL(item.url).hostname;
    byId('clip-open-source').hidden = !item.id;
    text.value = item.text || '';
    note.value = item.note || '';
    status.textContent = '';
    open(dialog);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const item = { ...draft, text: text.value.trim(), note: note.value.trim() };
    const error = save(space, item);
    if (error) status.textContent = error;
    else dialog.close();
  });
  byId('clip-open-source').addEventListener('click', () => {
    dialog.close();
    navigate(space, draft.url);
  });

  function render(workspace) {
    list.replaceChildren();
    byId('clips-empty').hidden = Boolean(workspace.clips.length);
    for (const item of workspace.clips) {
      const row = document.createElement('li');
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = 'clip-item';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const preview = document.createElement('small');
      preview.textContent = item.text || item.note || new URL(item.url).hostname;
      heading.append(title, preview);
      heading.addEventListener('click', () => edit(workspace, item));
      const discard = document.createElement('button');
      discard.type = 'button';
      discard.textContent = 'Remover';
      discard.setAttribute('aria-label', 'Remover captura de ' + item.title);
      discard.addEventListener('click', () => {
        if (!remove(workspace, item.id)) return;
        render(workspace);
        (list.querySelector('button') ?? byId('home-resume-tab')).focus();
      });
      row.append(heading, discard);
      list.append(row);
    }
  }
  return { edit, render };
}

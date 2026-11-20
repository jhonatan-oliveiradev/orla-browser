export function initExtensions(invoke) {
  const dialog = document.getElementById('extensions-dialog');
  const list = document.getElementById('extensions-list');
  const status = document.getElementById('extensions-status');
  const form = document.getElementById('extension-form');
  const path = document.getElementById('extension-path');
  const review = document.getElementById('extension-review');
  const confirm = document.getElementById('extension-confirm');
  let reviewedPath;
  let busy = false;

  function clearReview() {
    reviewedPath = undefined;
    review.hidden = true;
  }

  async function preview() {
    if (busy) return;
    const selected = path.value;
    clearReview();
    busy = true;
    dialog.setAttribute('aria-busy', 'true');
    status.textContent = 'Lendo manifesto…';
    try {
      const info = await invoke('extension_action', { action: 'preview', path: selected });
      if (selected !== path.value || !dialog.open) return;
      document.getElementById('extension-review-title').textContent = info.name;
      document.getElementById('extension-review-version').textContent =
        'Versão ' + info.version + (Number.isInteger(info.manifestVersion) ? ' · Manifest V' + info.manifestVersion : '');
      const list = document.getElementById('extension-permissions');
      list.replaceChildren();
      for (const permission of info.permissions) {
        const item = document.createElement('li');
        item.textContent = permission;
        list.append(item);
      }
      if (info.truncated) {
        const item = document.createElement('li');
        item.textContent = 'Consulte o manifesto para ver as demais permissões.';
        list.append(item);
      }
      document.getElementById('extension-permissions-empty').hidden = Boolean(list.childElementCount);
      reviewedPath = selected;
      review.hidden = false;
      status.textContent = '';
      confirm.focus();
    } catch (error) {
      status.textContent = String(error.message ?? error);
    } finally {
      busy = false;
      dialog.removeAttribute('aria-busy');
    }
  }

  function actionButton(text, action, dangerous = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    if (dangerous) button.className = 'danger';
    button.addEventListener('click', action);
    return button;
  }

  async function load() {
    const items = await invoke('extension_action', { action: 'list' });
    const focusedId = dialog.contains(document.activeElement) ? document.activeElement.closest('li')?.dataset.id : '';
    list.replaceChildren();
    document.getElementById('extensions-empty').hidden = Boolean(items?.length);
    for (const item of items || []) {
      const row = document.createElement('li');
      row.dataset.id = item.id;
      const name = document.createElement('strong');
      const current = document.createElement('small');
      name.textContent = item.name;
      current.textContent = item.enabled ? 'Ativa' : 'Desativada';
      const toggle = actionButton(item.enabled ? 'Desativar' : 'Ativar', () => operate('enable', { id: item.id, enabled: !item.enabled }));
      const remove = actionButton('Remover', () => {
        if (remove.dataset.confirm === 'true') return operate('remove', { id: item.id });
        remove.dataset.confirm = 'true';
        remove.textContent = 'Confirmar remoção';
        remove.setAttribute('aria-label', 'Confirmar remoção de ' + item.name);
      }, true);
      toggle.setAttribute('aria-label', toggle.textContent + ' ' + item.name);
      remove.setAttribute('aria-label', 'Remover ' + item.name);
      const details = document.createElement('div');
      details.append(name, current);
      const actions = document.createElement('div');
      actions.className = 'dialog-actions';
      actions.append(toggle, remove);
      row.append(details, actions);
      list.append(row);
      if (focusedId === item.id) toggle.focus();
    }
    if (focusedId && !items?.some((item) => item.id === focusedId)) path.focus();
  }

  async function operate(action, args = {}) {
    if (busy) return;
    busy = true;
    dialog.setAttribute('aria-busy', 'true');
    status.textContent = action === 'list' ? 'Carregando extensões…' : 'Aplicando alteração…';
    try {
      if (action !== 'list') await invoke('extension_action', { action, ...args });
      await load();
      if (action === 'install') {
        form.reset();
        clearReview();
        path.focus();
      }
      status.textContent = {
        list: '',
        install: 'Extensão adicionada.',
        enable: args.enabled ? 'Extensão ativada.' : 'Extensão desativada.',
        remove: 'Extensão removida.',
      }[action];
    } catch (error) {
      status.textContent = String(error.message ?? error);
    } finally {
      busy = false;
      dialog.removeAttribute('aria-busy');
    }
  }

  const browse = document.getElementById('extension-browse');
  browse.addEventListener('click', async () => {
    if (busy) return;
    browse.disabled = true;
    try {
      const selected = await invoke('choose_extension_folder');
      if (selected) {
        path.value = selected;
        await preview();
      } else path.focus();
    } catch (error) {
      status.textContent = String(error.message ?? error);
    } finally {
      browse.disabled = false;
    }
  });

  path.addEventListener('input', clearReview);
  dialog.addEventListener('close', clearReview);
  confirm.addEventListener('click', () => {
    if (reviewedPath && reviewedPath === path.value) operate('install', { path: reviewedPath });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    preview();
  });

  return { load: () => operate('list') };
}

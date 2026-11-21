import { workspaceName } from './session.js';

export function initWorkspaces({ open, getState, select, create, rename, move, remove }) {
  const byId = (id) => document.getElementById(id);
  const toggle = byId('workspace-toggle');
  const dialog = byId('workspaces-dialog');
  const list = byId('workspaces-list');
  const createInput = byId('workspace-create-name');
  const isolated = byId('workspace-isolated');
  const renameInput = byId('workspace-rename-name');
  const moveForm = byId('workspace-move-form');
  const target = byId('workspace-move-target');
  const removeButton = byId('workspace-remove');

  function renderCurrent(name) {
    byId('workspace-name').textContent = name;
    byId('workspace-initial').textContent = Array.from(name)[0].toLocaleUpperCase('pt-BR');
    toggle.setAttribute('aria-label', 'Espaços de trabalho · ' + name);
    toggle.title = name;
  }

  function renderDialog() {
    const { spaces, activeId, canMove, canRemove } = getState();
    list.replaceChildren();
    target.replaceChildren();
    for (const { id, name, count, profile } of spaces) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('strong');
      title.textContent = name;
      const detail = document.createElement('small');
      detail.textContent = id === activeId ? 'Atual' : count === 1 ? '1 aba' : count + ' abas';
      if (profile) detail.textContent += ' · Perfil separado';
      if (id === activeId) {
        button.setAttribute('aria-current', 'true');
        renameInput.value = name;
      } else {
        target.add(new Option(name, String(id)));
      }
      button.append(title, detail);
      button.addEventListener('click', () => select(id));
      row.append(button);
      list.append(row);
    }
    moveForm.hidden = !canMove || target.options.length === 0;
    removeButton.disabled = !canRemove;
    byId('workspace-remove-hint').hidden = canRemove || spaces.length === 1;
  }

  toggle.addEventListener('click', () => {
    createInput.value = '';
    isolated.checked = false;
    createInput.setCustomValidity('');
    renameInput.setCustomValidity('');
    renderDialog();
    open(dialog);
  });

  function bindName(formId, input, save) {
    byId(formId).addEventListener('submit', (event) => {
      event.preventDefault();
      const name = workspaceName(input.value);
      if (name) save(name);
      else {
        input.setCustomValidity('Informe um nome para o espaço.');
        input.reportValidity();
      }
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
  }

  bindName('workspace-create-form', createInput, (name) => create(name, isolated.checked));
  bindName('workspace-rename-form', renameInput, rename);
  moveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (target.value !== '') move(Number(target.value));
  });
  removeButton.addEventListener('click', remove);

  return { renderCurrent, renderDialog, close: () => dialog.close() };
}

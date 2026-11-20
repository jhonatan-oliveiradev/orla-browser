import { readSavedProject, workspaceName } from './session.js';

const PROJECT_FORMAT = 'orla-project';
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function projectDownload(project) {
  const file = new Blob([JSON.stringify({ format: PROJECT_FORMAT, version: 1, project }, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  const filename = project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '').trim() || 'sessao';
  link.download = filename + '.orla.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function initProjects({ getProjects, getWorkspaceName, open, save, importProject, restore, remove }) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('project-save-dialog');
  const input = byId('project-name');
  const list = byId('projects-list');
  const file = byId('project-import-file');
  const status = byId('project-status');
  const saveStatus = byId('project-save-status');
  const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });

  function action(label, run) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', run);
    return button;
  }

  function render() {
    const projects = getProjects();
    list.replaceChildren();
    byId('projects-empty').hidden = projects.length > 0;
    for (const project of projects) {
      const row = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = project.name;
      const detail = document.createElement('small');
      const count = project.tabs.filter(Boolean).length + project.queries.filter(Boolean).length;
      detail.textContent = (count === 1 ? '1 aba' : count + ' abas') + ' · ' + dateFormat.format(project.savedAt);
      const actions = document.createElement('div');
      actions.className = 'project-actions';
      const reopen = action('Reabrir', () => restore(project));
      const download = action('Exportar', () => projectDownload(project));
      const deleteButton = action('Excluir', () => {
        deleteButton.hidden = true;
        confirmation.hidden = false;
        confirmButton.focus();
      });
      for (const button of [reopen, download, deleteButton]) {
        button.setAttribute('aria-label', button.textContent + ' sessão ' + project.name);
      }
      const confirmation = document.createElement('span');
      confirmation.hidden = true;
      const confirmButton = action('Confirmar exclusão', () => {
        if (remove(project)) {
          status.textContent = 'Sessão excluída.';
          render();
          byId('project-save').focus();
        }
      });
      confirmation.append(confirmButton, action('Cancelar', () => {
        confirmation.hidden = true;
        deleteButton.hidden = false;
        deleteButton.focus();
      }));
      actions.append(reopen, download, deleteButton, confirmation);
      row.append(name, detail, actions);
      list.append(row);
    }
  }

  function openSave() {
    saveStatus.textContent = '';
    input.value = getWorkspaceName();
    open(dialog);
  }

  byId('project-save').addEventListener('click', openSave);
  byId('project-import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const selected = file.files[0];
    file.value = '';
    if (!selected) return;
    try {
      if (selected.size > MAX_FILE_BYTES) throw new Error('O arquivo de sessão precisa ter até 4 MB.');
      const parsed = JSON.parse(await selected.text());
      const project = parsed?.format === PROJECT_FORMAT && parsed?.version === 1 && readSavedProject(parsed.project);
      if (!project) throw new Error('Selecione um arquivo de sessão exportado pelo Orla.');
      if (!importProject(project)) throw new Error('Não foi possível gravar a sessão neste dispositivo.');
      status.textContent = 'Sessão importada.';
      render();
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'O arquivo de sessão está inválido.' : error.message;
    }
  });
  byId('project-save-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = workspaceName(input.value);
    if (!name) {
      saveStatus.textContent = 'Informe um nome para a sessão.';
      input.focus();
      return;
    }
    const result = save(name);
    if (result !== true) {
      saveStatus.textContent = result;
      return;
    }
    status.textContent = 'Sessão salva.';
    render();
    dialog.close();
  });

  return { openSave, render };
}

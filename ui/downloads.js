const labels = {
  running: 'Baixando',
  completed: 'Concluído',
  interrupted: 'Interrompido',
  cancelled: 'Cancelado',
};
const bytes = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function size(value) {
  if (value < 1024) return bytes.format(value) + ' B';
  if (value < 1024 * 1024) return bytes.format(value / 1024) + ' KB';
  return bytes.format(value / (1024 * 1024)) + ' MB';
}

export function initDownloads(invoke) {
  const list = document.getElementById('downloads-list');
  const empty = document.getElementById('downloads-empty');
  const error = document.getElementById('downloads-error');
  const toggle = document.getElementById('downloads-toggle');
  const rows = new Map();

  function reportError(value) {
    error.textContent = String(value?.message ?? value);
    toggle.setAttribute('data-activity', 'true');
  }

  function update(data) {
    if (!Object.hasOwn(labels, data.state)) return;
    let row = rows.get(data.id);
    if (!row) {
      const container = document.createElement('li');
      const name = document.createElement('strong');
      const status = document.createElement('small');
      const progress = document.createElement('progress');
      const action = document.createElement('button');
      progress.setAttribute('aria-label', 'Progresso do download');
      container.append(name, status, progress, action);
      list.prepend(container);
      row = { container, name, status, progress, action, state: '' };
      rows.set(data.id, row);
    }
    const { name, status, progress, action } = row;
    name.textContent = data.name;
    const running = data.state === 'running';
    status.textContent = labels[data.state] + (running
      ? ' · ' + size(data.received) + (data.total > 0 ? ' de ' + size(data.total) : '')
      : '');
    progress.hidden = !running;
    if (running && data.total > 0) {
      progress.max = data.total;
      progress.value = data.received;
    } else progress.removeAttribute('value');

    if (row.state !== data.state) {
      action.hidden = !running && data.state !== 'completed';
      action.textContent = running ? 'Cancelar' : 'Mostrar na pasta';
      action.onclick = () => {
        error.textContent = '';
        invoke('download_action', { id: data.id, action: running ? 'cancel' : 'reveal' }).catch(reportError);
      };
      row.state = data.state;
    }
    for (const [id, candidate] of rows) {
      if (rows.size <= 100) break;
      if (candidate.state === 'running') continue;
      candidate.container.remove();
      rows.delete(id);
    }
    empty.hidden = rows.size > 0;
    toggle.setAttribute('data-activity', String([...rows.values()].some((item) => item.state === 'running')));
  }

  return { update, reportError, restore: (data) => { if (!rows.has(data.id)) update(data); } };
}

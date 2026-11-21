export function findTabs(query, entries) {
  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(({ title, url, workspace, searchText }) => {
    const haystack = normalize([title, url, workspace, searchText].join(' '));
    return terms.every((term) => haystack.includes(term));
  }).slice(0, 80);
}

export function initQuickTabs(open, entries, select) {
  const dialog = document.getElementById('quick-tabs');
  const field = document.getElementById('quick-tabs-query');
  const list = document.getElementById('quick-tabs-results');

  function render() {
    list.replaceChildren();
    for (const item of findTabs(field.value, entries())) {
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('small');
      detail.textContent = item.clip
        ? 'Captura · ' + item.workspace + ' · ' + (item.clip.text || item.clip.note || item.url).slice(0, 110)
        : item.id === undefined ? 'Espaço de trabalho' : item.workspace + (item.url ? ' · ' + item.url : '');
      button.append(title, detail);
      button.addEventListener('click', () => {
        dialog.close();
        select(item);
      });
      row.append(button);
      list.append(row);
    }
    document.getElementById('quick-tabs-empty').hidden = list.childElementCount > 0;
  }

  field.addEventListener('input', render);
  dialog.addEventListener('keydown', (event) => {
    const buttons = [...list.querySelectorAll('button')];
    if (event.key === 'Enter' && event.target === field) {
      event.preventDefault();
      buttons[0]?.click();
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      const current = buttons.indexOf(document.activeElement);
      const next = current + (event.key === 'ArrowDown' ? 1 : -1);
      if (buttons.length) {
        event.preventDefault();
        (buttons[next] ?? (next < 0 ? field : buttons.at(-1))).focus();
      }
    }
  });

  return () => {
    field.value = '';
    render();
    open(dialog);
  };
}

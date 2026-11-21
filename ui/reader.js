export function initReader(invoke, open) {
  const byId = (id) => document.getElementById(id);
  const dialog = byId('reader-dialog');
  const content = byId('reader-content');
  const status = byId('reader-status');
  for (const option of ['font', 'size', 'width']) {
    const input = byId('reader-' + option);
    input.addEventListener('change', () => { content.dataset[option] = input.value; });
  }
  let revision = 0;
  return async (id) => {
    const request = ++revision;
    byId('page-dialog').close();
    content.replaceChildren();
    status.textContent = 'Preparando leitura…';
    open(dialog);
    try {
      const article = await invoke('read_page', { id });
      if (request !== revision) return;
      const title = document.createElement('h3');
      title.textContent = article.title;
      content.append(title);
      for (const block of article.blocks) {
        const item = document.createElement(block.heading ? 'h4' : 'p');
        item.textContent = block.text;
        content.append(item);
      }
      status.textContent = '';
    } catch (error) {
      if (request === revision) status.textContent = String(error.message ?? error);
    }
  };
}

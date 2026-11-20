export function initFind(invoke, layout) {
  const bar = document.getElementById('find-bar');
  const field = document.getElementById('find-query');
  const status = document.getElementById('find-status');
  let page = null;
  let timer;

  function send(id, action, query) {
    return invoke('find_in_page', { id, action, query }).catch((error) => {
      if (id === page?.id && !bar.hidden) status.textContent = String(error.message ?? error);
    });
  }

  function search() {
    if (!page || bar.hidden) return;
    status.textContent = '';
    const value = field.value;
    if (value) send(page.id, 'start', value);
    else send(page.id, 'stop');
  }

  function close(restoreFocus = false) {
    if (bar.hidden) return;
    clearTimeout(timer);
    timer = undefined;
    bar.hidden = true;
    if (page) send(page.id, 'stop');
    layout(restoreFocus ? page?.id : undefined);
  }

  function setPage(next) {
    if (next?.id !== page?.id || !next) close();
    page = next;
  }

  function open() {
    if (!page) return false;
    const wasHidden = bar.hidden;
    bar.hidden = false;
    field.focus();
    field.select();
    if (wasHidden) {
      layout();
      search();
    }
    return true;
  }

  function step(action) {
    if (page && field.value && !bar.hidden) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        search();
      } else send(page.id, action);
    }
  }

  bar.addEventListener('submit', (event) => {
    event.preventDefault();
    step('next');
  });
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Enter' && event.shiftKey && event.target === field) {
      event.preventDefault();
      step('previous');
    }
  });
  field.addEventListener('input', () => {
    clearTimeout(timer);
    status.textContent = '';
    timer = setTimeout(() => { timer = undefined; search(); }, 125);
  });
  document.getElementById('find-prev').addEventListener('click', () => step('previous'));
  document.getElementById('find-next').addEventListener('click', () => step('next'));
  document.getElementById('find-close').addEventListener('click', () => close(true));

  function receive({ id, index, count, error }) {
    if (bar.hidden || id !== 'tab-' + page?.id || !field.value || timer !== undefined) return;
    status.textContent = error
      ? 'Busca indisponível. Atualize o WebView2 Runtime.'
      : count > 0 ? Math.max(0, index) + ' / ' + count : 'Sem resultados';
    status.title = error || '';
  }

  return { setPage, open, receive, navigated(id) { if (id === page?.id) search(); } };
}

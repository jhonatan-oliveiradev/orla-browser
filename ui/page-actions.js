const KEY = 'orla.page.zoom.v1';
const LEVELS = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200];

export function initPageActions(invoke, close, openCopy) {
  const byId = (id) => document.getElementById(id);
  const levels = new Map();
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(stored)) {
      for (const entry of stored.slice(-200)) {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && LEVELS.includes(entry[1])) levels.set(...entry.slice(0, 2));
      }
    }
  } catch { /* Default to 100%. */ }
  let page;
  const zoom = () => levels.get(page?.site) || 100;
  const feedback = byId('page-options-status');

  function render() {
    byId('page-options').disabled = !page;
    byId('page-zoom-reset').textContent = zoom() + '%';
    byId('page-zoom-in').disabled = !page || zoom() >= LEVELS.at(-1);
    byId('page-zoom-out').disabled = !page || zoom() <= LEVELS[0];
    byId('page-options').title = page ? 'Ações da página · Zoom ' + zoom() + '%' : 'Ações da página';
  }

  function apply() {
    return page ? invoke('zoom_tab', { id: page.id, percent: zoom() }) : Promise.resolve();
  }

  async function adjust(action) {
    if (!page) return;
    const index = LEVELS.indexOf(zoom());
    const next = LEVELS[index + (action === 'zoom-in' ? 1 : -1)];
    const percent = action === 'zoom-reset' ? 100 : next;
    if (!percent || percent === zoom()) return;
    const { site, id } = page;
    await invoke('zoom_tab', { id, percent });
    levels.delete(site);
    if (percent !== 100) levels.set(site, percent);
    if (levels.size > 200) levels.delete(levels.keys().next().value);
    try { localStorage.setItem(KEY, JSON.stringify([...levels])); } catch { /* Keep the setting in memory. */ }
    render();
  }

  for (const [id, action] of [['page-zoom-in', 'zoom-in'], ['page-zoom-out', 'zoom-out'], ['page-zoom-reset', 'zoom-reset']]) {
    byId(id).addEventListener('click', () => adjust(action).catch((error) => { feedback.textContent = String(error.message ?? error); }));
  }
  byId('page-copy').addEventListener('click', async () => {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(page.url);
      feedback.textContent = 'Endereço copiado.';
    } catch {
      feedback.textContent = 'Não foi possível copiar. Use Ctrl+L e Ctrl+C.';
    }
  });
  byId('page-duplicate').addEventListener('click', () => {
    if (!page) return;
    close();
    openCopy(page.url);
  });

  return {
    set(next) {
      if (!next || page?.url !== next.url || page.id !== next.id) feedback.textContent = '';
      page = next ? { ...next, site: new URL(next.url).hostname } : null;
      render();
    },
    apply,
    adjust,
  };
}

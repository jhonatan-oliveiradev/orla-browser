import { websiteAddress } from './session.js';

export function providerAddress(input) {
  const value = input.trim();
  if (!value) return '';
  const safe = websiteAddress(value);
  const url = safe ? new URL(safe) : null;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url?.hostname);
  if (!url || (!local && url.protocol !== 'https:') || url.search || url.hash) {
    throw new Error('Informe um endereço HTTPS ou uma instância HTTP no próprio computador.');
  }
  return url.href;
}

export function initWebSearch({ invoke, isActive, openResult }) {
  const view = document.getElementById('web-search');
  const query = document.getElementById('web-search-query');
  const status = document.getElementById('web-search-status');
  const list = document.getElementById('web-search-results');
  let rendered;

  function render(state) {
    view.hidden = !state;
    if (!state || rendered === state) return;
    update(state);
  }

  function update(state) {
    if (rendered !== state || document.activeElement !== query) query.value = state.query;
    rendered = state;
    status.textContent = state.status;
    list.replaceChildren();
    for (const result of state.results) {
      const url = websiteAddress(result.url);
      if (!url) continue;
      const row = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const host = document.createElement('small');
      host.textContent = new URL(url).hostname;
      const title = document.createElement('strong');
      title.textContent = result.title || url;
      const excerpt = document.createElement('span');
      excerpt.textContent = result.excerpt;
      button.append(host, title, excerpt);
      button.addEventListener('click', () => openResult(url));
      row.append(button);
      list.append(row);
    }
  }

  async function run(state, provider) {
    const request = Symbol();
    state.request = request;
    state.results = [];
    state.status = provider ? 'Buscando na web…' : 'Configure uma instância SearXNG para pesquisar no Orla.';
    if (isActive(state)) update(state);
    if (!provider) return;
    try {
      const results = await invoke('search_web', { provider, query: state.query });
      if (state.request !== request) return;
      state.results = results;
      state.status = results.length ? '' : 'Nenhum resultado encontrado.';
    } catch (error) {
      if (state.request !== request) return;
      state.status = String(error.message ?? error);
    }
    if (isActive(state)) update(state);
  }

  return { render, run };
}

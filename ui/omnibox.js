const kinds = { tab: 'Alternar para aba', favorite: 'Favorito', history: 'Histórico' };

export function initOmnibox({ input, list, search, onSelect, onLayout }) {
  let results = [];
  let selected = -1;

  function close() {
    const wasOpen = !list.hidden;
    list.hidden = true;
    results = [];
    selected = -1;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (wasOpen) onLayout();
  }

  function activate(index) {
    const result = results[index];
    if (!result) return false;
    close();
    onSelect(result);
    return true;
  }

  function refresh() {
    if (document.activeElement !== input) return;
    results = search(input.value);
    if (!results.length) {
      close();
      return;
    }
    selected = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren();
    for (const [index, result] of results.entries()) {
      const option = document.createElement('li');
      option.id = 'address-result-' + index;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const title = document.createElement('strong');
      title.textContent = result.title;
      const url = document.createElement('span');
      url.textContent = result.url;
      const kind = document.createElement('small');
      kind.textContent = kinds[result.kind];
      option.append(title, url, kind);
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => activate(index));
      list.append(option);
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    onLayout();
  }

  input.addEventListener('input', refresh);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || list.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    selected = selected < 0 && direction < 0
      ? results.length - 1 : (selected + direction + results.length) % results.length;
    for (const [index, option] of [...list.children].entries()) {
      option.setAttribute('aria-selected', String(index === selected));
    }
    const option = list.children[selected];
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  });

  return { close, submit: () => activate(selected) };
}

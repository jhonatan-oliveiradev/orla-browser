(async () => {
  const { url, extension, phase } = window.orlaSmoke;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const get = (selector) => document.querySelector(selector);
  const contains = (selector, value) => get(selector)?.innerText.includes(value);
  const click = (selector) => get(selector).click();
  const fill = (selector, value) => {
    const field = get(selector);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const shortcut = (key, ctrlKey = false) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }));
  };

  async function until(message, check) {
    const end = Date.now() + 10000;
    let lastError;
    while (Date.now() < end) {
      try {
        if (await check()) return;
      } catch (error) {
        lastError = String(error.message ?? error);
      }
      await delay(125);
    }
    throw new Error(message + (lastError ? ' (' + lastError + ')' : ''));
  }

  function evaluatePage(expression) {
    return window.__TAURI__.core.invoke('devtools_action', {
      id: Number(get('#tab-list [aria-current="true"]').dataset.tabId),
      action: 'evaluate',
      expression,
    });
  }

  try {
    await until('A interface do Orla não abriu.', () => get('#address') && get('#tab-list button'));
    if (phase === 'verify') {
      await until('A aba do projeto não foi restaurada.', () => contains('#tab-list', 'Teste local Orla'));
      click('#downloads-toggle');
      await until('O histórico de downloads não foi restaurado.', () => contains('#downloads-list', 'orla-smoke.txt'));
      get('#downloads-dialog').close();
      await delay(250);
      click('#extensions-toggle');
      await until('A extensão não permaneceu instalada.', () => contains('#extensions-list', 'Orla smoke fixture'));
    } else {
      click('#home-widgets-tab');
      fill('#widget-notes', 'Nota de teste do Orla');
      fill('#address', url);
      get('#address-form').requestSubmit();
      await until('A página de teste não abriu.', () => contains('#tab-list', 'Teste local Orla'));

      shortcut('f', true);
      fill('#find-query', 'marcador');
      await until('A busca nativa não retornou duas ocorrências.', () => contains('#find-status', '/ 2'));
      click('#find-close');
      shortcut('F12');
      await until('A DevTools integrada não inspecionou o documento.', () => contains('#devtools-tree', '<body>'));
      click('#devtools-close');

      click('#extensions-toggle');
      await until('O gerenciador de extensões não abriu.', () => get('#extensions-dialog').open && !get('#extensions-dialog').hasAttribute('aria-busy'));
      fill('#extension-path', extension);
      get('#extension-form').requestSubmit();
      await until('A extensão não foi instalada.', () => {
        const status = get('#extensions-status').innerText;
        if (!get('#extensions-dialog').hasAttribute('aria-busy') && !contains('#extensions-list', 'Orla smoke fixture')) {
          throw new Error(status);
        }
        return contains('#extensions-list', 'Orla smoke fixture');
      });
      get('#extensions-dialog').close();
      await delay(250);
      click('[data-tab-action="reload"]');
      click('#devtools-toggle');
      await until('A extensão não foi executada na página.', async () => (
        await evaluatePage('document.documentElement.dataset.orlaSmoke')
      ).text === 'loaded');
      await evaluatePage('document.getElementById("download").click()');
      click('#downloads-toggle');
      await until('O download não foi concluído.', () => contains('#downloads-list', 'Concluído'));
    }
    if (get('#widget-notes').value !== 'Nota de teste do Orla') throw new Error('A nota do espaço ficou indisponível.');
    await window.__TAURI__.core.invoke('smoke_reply', { message: 'ok' });
  } catch (error) {
    await window.__TAURI__.core.invoke('smoke_reply', { message: String(error.stack ?? error) });
  }
})();

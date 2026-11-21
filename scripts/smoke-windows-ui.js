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
      await until('O par de abas não foi restaurado.', () => !get('#split-view').hidden && get('#split-divider').getAttribute('aria-valuenow') === '54');
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
      const stage = get('#site-stage');
      const select = get('#devtools-position');
      const previous = get('#site-viewport').getBoundingClientRect();
      select.value = 'left';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await until('A DevTools não reservou espaço à esquerda.', () => stage.dataset.devtoolsDock === 'left' && get('#site-viewport').getBoundingClientRect().x > previous.x);
      const body = [...get('#devtools-tree').querySelectorAll('[data-inspect-node]')].find((node) => node.textContent === '<body>');
      body.click();
      const styleMode = get('#devtools-style-view');
      styleMode.value = 'rules';
      styleMode.dispatchEvent(new Event('change', { bubbles: true }));
      await until('As regras CSS do elemento não apareceram.', () => get('#devtools-rules section'));
      click('#devtools-close');

      click('#page-options');
      await until('O menu da página não abriu.', () => get('#page-dialog').open);
      click('#page-zoom-in');
      await until('O zoom não mudou para 110%.', () => get('#page-zoom-reset').textContent === '110%');
      click('#page-zoom-reset');
      await until('O zoom não voltou a 100%.', () => get('#page-zoom-reset').textContent === '100%');
      get('#page-dialog').close();

      click('#extensions-toggle');
      await until('O gerenciador de extensões não abriu.', () => get('#extensions-dialog').open && !get('#extensions-dialog').hasAttribute('aria-busy'));
      fill('#extension-path', extension);
      get('#extension-form').requestSubmit();
      await until('A revisão do manifesto não abriu.', () => !get('#extension-review').hidden);
      click('#extension-confirm');
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
      await evaluatePage("document.cookie = 'orla_profile=regular; path=/'");
      await until('O cookie do perfil padrão não foi criado.', async () => (await evaluatePage('document.cookie')).text.includes('orla_profile=regular'));
      await evaluatePage('document.getElementById("download").click()');
      click('#downloads-toggle');
      await until('O download não foi concluído.', () => contains('#downloads-list', 'Concluído'));

      get('#downloads-dialog').close();
      if (!get('#devtools-panel').hidden) click('#devtools-close');
      click('#page-options');
      await until('As ações da página não abriram.', () => get('#page-dialog').open);
      click('#page-reader');
      await until('O texto do artigo não apareceu.', () => contains('#reader-content', 'Artigo Orla'));
      get('#reader-dialog').close();
      click('#workspace-toggle');
      await until('Os espaços de trabalho não abriram.', () => get('#workspaces-dialog').open);
      fill('#workspace-create-name', 'Perfil isolado');
      get('#workspace-isolated').checked = true;
      get('#workspace-create-form').requestSubmit();
      await until('O perfil separado não abriu.', () => contains('#workspace-name', 'Perfil isolado'));
      fill('#address', url);
      get('#address-form').requestSubmit();
      await until('O perfil separado não navegou.', () => contains('#tab-list', 'Teste local Orla'));
      click('#devtools-toggle');
      await until('O cookie vazou entre perfis.', async () => (await evaluatePage('document.cookie')).text === '');
      click('#devtools-close');
      click('#quick-tabs-toggle');
      await until('A busca entre espaços não abriu.', () => get('#quick-tabs').open);
      fill('#quick-tabs-query', 'Principal');
      get('#quick-tabs-results button').click();
      await until('O espaço Principal não voltou.', () => contains('#workspace-name', 'Principal'));

      click('#new-tab');
      await until('A nova aba não abriu.', () => get('#address').value === '');
      fill('#address', new URL('/second', url).href);
      get('#address-form').requestSubmit();
      await until('O segundo site não abriu.', () => contains('#tab-list', 'Segundo painel Orla'));
      const sourceRow = [...get('#tab-list').children].find((row) => row.innerText.includes('Teste local Orla'));
      sourceRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await until('As ações da aba não abriram.', () => get('#tab-dialog').open);
      click('#tab-menu-split');
      await until('As páginas não abriram lado a lado.', () => !get('#split-view').hidden
        && get('#split-left').getBoundingClientRect().right < get('#split-right').getBoundingClientRect().left);
      get('#split-divider').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await until('O divisor não mudou de posição.', () => get('#split-divider').getAttribute('aria-valuenow') === '54');
      click('#split-left-title');
      await until('O endereço da aba esquerda não foi selecionado.', () => get('#address').value.endsWith('/second'));

    }
    if (get('#widget-notes').value !== 'Nota de teste do Orla') throw new Error('A nota do espaço ficou indisponível.');
    window.orlaSmokeResult = 'ok';
  } catch (error) {
    window.orlaSmokeResult = String(error.stack ?? error);
  }
})();

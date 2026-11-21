import { initDevToolsDock } from './devtools-dock.js';

const MAX_ENTRIES = 250;
const MAX_NODES = 1500;

export function initDevTools(invoke, onLayout) {
  const byId = (id) => document.getElementById(id);
  const dock = byId('devtools-panel');
  const toggle = byId('devtools-toggle');
  const heading = byId('devtools-heading');
  const status = byId('devtools-status');
  const tree = byId('devtools-tree');
  const styles = byId('devtools-styles');
  const rules = byId('devtools-rules');
  const styleView = byId('devtools-style-view');
  const styleFilter = byId('devtools-style-filter');
  const consoleList = byId('devtools-console-list');
  const consoleFilter = byId('devtools-console-filter');
  const consoleLevel = byId('devtools-level');
  const detail = byId('devtools-request-details');
  const detailFields = byId('devtools-request-fields');
  const keepNetwork = byId('devtools-keep-network');
  const expression = byId('devtools-expression');
  const requests = byId('devtools-requests');
  const networkFilter = byId('devtools-network-filter');
  const nodes = new Map();
  const logs = [];
  const network = new Map();
  const buttons = [...dock.querySelectorAll('[data-devtools-section]')];
  let section = 'elements';
  let page = null;
  let target = null;
  let attached = null;
  let connected = false;
  let ready = false;
  let queue = Promise.resolve();
  let selectedNode = null;
  let computedStyles = [];
  let matchedRules = [];
  let domRequest = 0;
  let paint = 0;
  let highlighted = null;
  let highlightTimer;
  let selectedRequest;
  let networkDocument;
  let mainFrame;
  let attachedFrame;
  const expressionHistory = [];
  let historyIndex = 0;
  let expressionDraft = '';

  function command(id, action, params = {}) {
    return invoke('devtools_action', { id, action, ...params });
  }

  function setStatus(text = '') {
    status.textContent = text;
  }

  function updateControls() {
    for (const control of dock.querySelectorAll('[data-requires-devtools]')) control.disabled = !ready;
  }

  function renderNode(label, node) {
    const token = (text, kind) => {
      const span = document.createElement('span');
      span.className = 'devtools-syntax-' + kind;
      span.textContent = text;
      label.append(span);
    };
    const name = node.localName || node.nodeName || '#nó';
    if (node.nodeType !== 1) {
      token(name + (node.nodeValue ? ' ' + node.nodeValue.trim().slice(0, 90) : ''), node.nodeType === 8 ? 'comment' : 'text');
      return;
    }
    token('<' + name, 'tag');
    const attributes = node.attributes || [];
    for (let index = 0; index + 1 < Math.min(attributes.length, 8); index += 2) {
      token(' ' + attributes[index], 'attribute');
      token('="' + String(attributes[index + 1]).slice(0, 45) + '"', 'value');
    }
    token('>', 'tag');
  }

  function highlight(nodeId = null) {
    clearTimeout(highlightTimer);
    if (nodeId === highlighted || target === null || !ready) return;
    const id = target;
    highlightTimer = setTimeout(() => {
      if (id !== target || section !== 'elements' && nodeId !== null) return;
      highlighted = nodeId;
      const request = nodeId ? command(id, 'highlight', { nodeId }) : command(id, 'hide-highlight');
      request.catch(() => { if (id === target && highlighted === nodeId) highlighted = null; });
    }, nodeId ? 65 : 0);
  }

  function renderStyles() {
    const term = styleFilter.value.toLowerCase().trim();
    const isRules = styleView.value === 'rules';
    styles.hidden = isRules;
    rules.hidden = !isRules;
    if (isRules) {
      rules.replaceChildren();
      for (const { selector, properties } of matchedRules) {
        const matches = properties.filter(({ name, value }) => !term || (selector + ' ' + name + ' ' + value).toLowerCase().includes(term));
        if (!matches.length) continue;
        const block = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = selector;
        const code = document.createElement('pre');
        code.textContent = matches.map(({ name, value, important }) => name + ': ' + value + (important ? ' !important' : '') + ';').join('\n');
        block.append(heading, code);
        rules.append(block);
      }
      const empty = byId('devtools-style-empty');
      empty.hidden = Boolean(rules.childElementCount);
      empty.textContent = selectedNode ? 'Nenhuma regra CSS para exibir.' : 'Selecione um elemento para ver seus estilos.';
      return;
    }
    const content = document.createDocumentFragment();
    for (const { name, value } of computedStyles) {
      if (term && !(name + ' ' + value).toLowerCase().includes(term)) continue;
      const property = document.createElement('dt');
      const data = document.createElement('dd');
      property.textContent = name;
      data.textContent = value;
      content.append(property, data);
    }
    styles.replaceChildren(content);
    const empty = byId('devtools-style-empty');
    empty.hidden = Boolean(styles.childElementCount);
    empty.textContent = selectedNode ? 'Nenhum estilo para exibir.' : 'Selecione um elemento para ver seus estilos.';
  }

  async function selectNode(record) {
    selectedNode?.label.removeAttribute('aria-current');
    selectedNode = record;
    record.label.setAttribute('aria-current', 'true');
    computedStyles = [];
    matchedRules = [];
    renderStyles();
    if (record.node.nodeType !== 1 || !ready) return;
    const id = target;
    const mode = styleView.value;
    try {
      const result = await command(id, mode === 'rules' ? 'rules' : 'styles', { nodeId: record.node.nodeId });
      if (target !== id || selectedNode !== record || mode !== styleView.value) return;
      if (mode === 'rules') {
        const entries = (result.matchedCSSRules || []).slice(-100).reverse().map(({ rule }) => ({
          selector: rule.selectorList?.text || 'Regra CSS', properties: rule.style?.cssProperties || [],
        }));
        if (result.inlineStyle) entries.unshift({ selector: 'element.style', properties: result.inlineStyle.cssProperties || [] });
        matchedRules = entries.map(({ selector, properties }) => ({
          selector, properties: properties.filter((property) => !property.disabled && property.parsedOk !== false),
        }));
      } else computedStyles = result.computedStyle || [];
      renderStyles();
    } catch (error) {
      if (target === id && selectedNode === record) setStatus(String(error.message ?? error));
    }
  }

  function addNodes(list, children) {
    for (const node of children) {
      if (nodes.size >= MAX_NODES) {
        setStatus('A árvore atingiu o limite de 1.500 elementos.');
        break;
      }
      if (!node.nodeId || (node.nodeType === 3 && !node.nodeValue?.trim())) continue;
      const row = document.createElement('li');
      const line = document.createElement('div');
      line.className = 'devtools-node';
      const label = document.createElement('button');
      renderNode(label, node);
      label.title = label.textContent;
      label.type = 'button';
      const childrenList = document.createElement('ul');
      const record = { node, label, list: childrenList };
      nodes.set(node.nodeId, record);
      if (node.childNodeCount || node.children?.length) {
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.className = 'devtools-expand';
        expand.setAttribute('aria-label', 'Expandir ou recolher ' + (node.localName || node.nodeName));
        expand.setAttribute('aria-expanded', String(Boolean(node.children)));
        expand.textContent = node.children ? '▾' : '▸';
        childrenList.hidden = !node.children;
        if (node.children) addNodes(childrenList, node.children);
        expand.addEventListener('click', async () => {
          childrenList.hidden = !childrenList.hidden;
          expand.setAttribute('aria-expanded', String(!childrenList.hidden));
          expand.textContent = childrenList.hidden ? '▸' : '▾';
          if (childrenList.hidden || childrenList.childElementCount) return;
          const id = target;
          try {
            await command(id, 'children', { nodeId: node.nodeId });
          } catch (error) {
            if (id === target) setStatus(String(error.message ?? error));
          }
        });
        line.append(expand);
      }
      label.addEventListener('click', () => selectNode(record));
      if (node.nodeType === 1) label.dataset.inspectNode = String(node.nodeId);
      line.append(label);
      row.append(line, childrenList);
      list.append(row);
    }
  }

  async function refreshDocument() {
    if (!ready) return;
    const id = target;
    const request = ++domRequest;
    try {
      const { root } = await command(id, 'document');
      if (target !== id || request !== domRequest) return;
      highlight();
      nodes.clear();
      selectedNode = null;
      computedStyles = [];
      matchedRules = [];
      tree.replaceChildren();
      renderStyles();
      if (root) addNodes(tree, root.children || [root]);
    } catch (error) {
      if (target === id && request === domRequest) setStatus(String(error.message ?? error));
    }
  }

  function renderConsole() {
    const content = document.createDocumentFragment();
    const filter = consoleFilter.value.trim().toLowerCase();
    for (const { level, text } of logs) {
      const category = ['error', 'assert'].includes(level) ? 'error'
        : ['warning', 'warn'].includes(level) ? 'warning' : 'info';
      if (consoleLevel.value !== 'all' && category !== consoleLevel.value) continue;
      if (filter && !text.toLowerCase().includes(filter)) continue;
      const row = document.createElement('li');
      row.dataset.level = level;
      row.dataset.category = category;
      const kind = document.createElement('small');
      const message = document.createElement('code');
      kind.textContent = { error: 'Erro', assert: 'Erro', warning: 'Aviso', warn: 'Aviso',
        entrada: 'Entrada', resultado: 'Resultado', info: 'Info', log: 'Log', debug: 'Debug' }[level] || level;
      message.textContent = text;
      row.append(kind, message);
      content.append(row);
    }
    const scroller = consoleList.parentElement;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 30;
    consoleList.replaceChildren(content);
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
    const empty = byId('devtools-console-empty');
    empty.hidden = Boolean(consoleList.childElementCount);
    empty.textContent = logs.length ? 'Nenhuma mensagem corresponde aos filtros.' : 'As mensagens da página aparecem aqui.';
  }

  function networkState(request) {
    if (request.error) return ['Falhou', 'error'];
    if (!request.status) return [request.duration === undefined ? 'Pendente' : 'Sem status', 'pending'];
    const status = Number(request.status);
    return [request.status, status >= 400 ? 'error' : status >= 300 && status !== 304 ? 'warning' : 'success'];
  }

  function renderRequest() {
    const request = network.get(selectedRequest);
    detail.hidden = !request;
    if (!request) return;
    detailFields.replaceChildren();
    for (const [name, value] of [
      ['URL', request.url], ['Método', request.method], ['Status', networkState(request)[0]],
      ['Tipo', request.kind], ['MIME', request.mime], ['Protocolo', request.protocol],
      ['Duração', request.duration === undefined ? undefined : Math.round(request.duration) + ' ms'],
      ['Transferido', request.bytes === undefined ? undefined : new Intl.NumberFormat('pt-BR').format(request.bytes) + ' B'],
      ['Origem', request.cache ? 'Cache' : undefined], ['Falha', request.error],
    ]) {
      if (value === undefined || value === null || value === '') continue;
      const key = document.createElement('dt');
      const data = document.createElement('dd');
      key.textContent = name;
      data.textContent = value;
      detailFields.append(key, data);
    }
  }

  function renderNetwork() {
    const filter = networkFilter.value.trim().toLowerCase();
    const content = document.createDocumentFragment();
    const focused = requests.contains(document.activeElement) ? document.activeElement.dataset.requestId : undefined;
    let focus;
    for (const request of network.values()) {
      const [state, color] = networkState(request);
      if (filter && ![request.url, request.method, state, request.kind, request.error]
        .some((part) => String(part || '').toLowerCase().includes(filter))) continue;
      const row = document.createElement('tr');
      row.dataset.status = color;
      for (const value of [request.method || '—', state, request.kind || '—']) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      const cell = document.createElement('td');
      const link = document.createElement('button');
      link.type = 'button';
      link.dataset.requestId = request.id;
      link.textContent = request.url || 'Requisição';
      link.title = link.textContent;
      link.setAttribute('aria-expanded', String(selectedRequest === request.id));
      link.setAttribute('aria-controls', detail.id);
      link.addEventListener('click', () => {
        selectedRequest = selectedRequest === request.id ? undefined : request.id;
        renderNetwork();
      });
      if (request.id === focused) focus = link;
      cell.append(link);
      row.append(cell);
      content.append(row);
    }
    const empty = byId('devtools-network-empty');
    empty.hidden = Boolean(content.childElementCount);
    empty.textContent = network.size ? 'Nenhuma requisição corresponde ao filtro.' : 'Recarregue a página para capturar as requisições.';
    requests.replaceChildren(content);
    focus?.focus({ preventScroll: true });
    renderRequest();
  }

  function schedulePaint() {
    if (paint) return;
    paint = requestAnimationFrame(() => {
      paint = 0;
      if (dock.hidden) return;
      if (section === 'console') renderConsole();
      if (section === 'network') renderNetwork();
    });
  }

  function appendLog(entry) {
    logs.push(entry);
    if (logs.length > MAX_ENTRIES) logs.shift();
    schedulePaint();
  }

  function clear() {
    domRequest++;
    nodes.clear();
    selectedNode = null;
    computedStyles = [];
    matchedRules = [];
    tree.replaceChildren();
    logs.length = 0;
    network.clear();
    selectedRequest = undefined;
    networkDocument = undefined;
    mainFrame = undefined;
    highlighted = null;
    clearTimeout(highlightTimer);
    expressionHistory.length = 0;
    historyIndex = 0;
    expression.value = '';
    expressionDraft = '';
    renderStyles();
    schedulePaint();
  }

  function updateTarget(retry = false) {
    const next = dock.hidden ? null : page?.id ?? null;
    heading.title = page?.url || '';
    byId('devtools-site').textContent = page?.url ? new URL(page.url).host : '';
    if (target === next && !retry) return;
    target = next;
    ready = false;
    updateControls();
    clear();
    setStatus(next === null ? 'Abra uma página para inspecionar.' : 'Conectando à aba…');
    queue = queue.then(async () => {
      if (attached !== null && attached !== target) {
        const previous = attached;
        attached = null;
        connected = false;
        try { await command(previous, 'stop'); } catch { /* A aba pode ter sido fechada. */ }
      }
      const id = target;
      if (id === null) return;
      try {
        if (!connected) {
          attached = id;
          attachedFrame = (await command(id, 'start'))?.frame;
          connected = true;
        }
        if (target !== id) return;
        mainFrame = attachedFrame;
        ready = true;
        updateControls();
        setStatus();
        await refreshDocument();
      } catch (error) {
        attached = null;
        connected = false;
        if (target === id) setStatus(String(error.message ?? error));
        try { await command(id, 'stop'); } catch { /* A aba pode ter sido fechada. */ }
      }
    });
  }

  function setPage(value) {
    page = value;
    updateTarget();
  }

  function choose(button) {
    section = button.dataset.devtoolsSection;
    if (section !== 'elements') highlight();
    for (const item of buttons) {
      const active = item === button;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      byId(item.getAttribute('aria-controls')).hidden = !active;
    }
    schedulePaint();
  }

  function toggleDock() {
    dock.hidden = !dock.hidden;
    toggle.setAttribute('aria-expanded', String(!dock.hidden));
    if (!dock.hidden && page === null) setStatus('Abra uma página para inspecionar.');
    updateTarget();
    onLayout();
    (dock.hidden ? toggle : buttons.find((item) => item.dataset.devtoolsSection === section))?.focus();
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => choose(button));
    button.addEventListener('keydown', (event) => {
      const next = {
        ArrowLeft: (index + buttons.length - 1) % buttons.length,
        ArrowRight: (index + 1) % buttons.length,
        Home: 0,
        End: buttons.length - 1,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      choose(buttons[next]);
    });
  });
  toggle.addEventListener('click', toggleDock);
  byId('devtools-close').addEventListener('click', toggleDock);
  byId('devtools-refresh').addEventListener('click', refreshDocument);
  styleFilter.addEventListener('input', renderStyles);
  styleView.addEventListener('change', () => selectedNode ? selectNode(selectedNode) : renderStyles());
  consoleFilter.addEventListener('input', renderConsole);
  consoleLevel.addEventListener('change', renderConsole);
  for (const [start, end] of [['pointerover', 'pointerout'], ['focusin', 'focusout']]) {
    tree.addEventListener(start, (event) => {
      const node = event.target.closest('[data-inspect-node]');
      if (node && !node.contains(event.relatedTarget)) highlight(Number(node.dataset.inspectNode));
    });
    tree.addEventListener(end, (event) => {
      const node = event.target.closest('[data-inspect-node]');
      if (node && !node.contains(event.relatedTarget)) highlight();
    });
  }
  byId('devtools-request-close').addEventListener('click', () => {
    const id = selectedRequest;
    selectedRequest = undefined;
    renderNetwork();
    ([...requests.querySelectorAll('button')].find((button) => button.dataset.requestId === id) || networkFilter).focus();
  });
  networkFilter.addEventListener('input', renderNetwork);
  byId('devtools-clear-console').addEventListener('click', () => { logs.length = 0; renderConsole(); });
  byId('devtools-clear-network').addEventListener('click', () => { network.clear(); renderNetwork(); });
  byId('devtools-console-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = expression.value.trim();
    if (!ready || !code) return;
    const id = target;
    if (expressionHistory.at(-1) !== code) expressionHistory.push(code);
    if (expressionHistory.length > 100) expressionHistory.shift();
    historyIndex = expressionHistory.length;
    expressionDraft = '';
    expression.value = '';
    appendLog({ level: 'entrada', text: code });
    try {
      const { text } = await command(id, 'evaluate', { expression: code });
      if (target === id) appendLog({ level: 'resultado', text });
    } catch (error) {
      if (target === id) appendLog({ level: 'error', text: String(error.message ?? error) });
    }
  });

  expression.addEventListener('keydown', (event) => {
    const delta = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!delta || !expressionHistory.length || event.shiftKey || event.altKey || event.ctrlKey) return;
    event.preventDefault();
    if (historyIndex === expressionHistory.length) expressionDraft = expression.value;
    historyIndex = Math.min(expressionHistory.length, Math.max(0, historyIndex + delta));
    expression.value = expressionHistory[historyIndex] ?? expressionDraft;
  });

  initDevToolsDock(dock, onLayout);

  function handle({ id, event, data }) {
    if (id !== target) return;
    if (event === 'DOM.setChildNodes') {
      const parent = nodes.get(data.parentId);
      if (parent && !parent.list.childElementCount) addNodes(parent.list, data.nodes || []);
    } else if (event === 'Page.frameNavigated') {
      if (!data.parent && data.frame) {
        mainFrame = data.frame;
        attachedFrame = data.frame;
      }
    } else if (event.startsWith('Network.')) {
      if (typeof data.id !== 'string') return;
      if (event === 'Network.requestWillBeSent') {
        if (data.kind === 'Document' && mainFrame && data.frame === mainFrame && data.document && data.document !== networkDocument) {
          if (!keepNetwork.checked && network.size > 0) {
            network.clear();
            selectedRequest = undefined;
          }
          networkDocument = data.document;
        }
        network.set(data.id, data);
      }
      else if (network.has(data.id)) {
        const request = network.get(data.id);
        const { timestamp, ...fields } = data;
        Object.assign(request, fields);
        if (Number.isFinite(timestamp) && Number.isFinite(request.timestamp)) {
          request.duration = Math.max(0, (timestamp - request.timestamp) * 1000);
        }
      }
      else return;
      if (network.size > MAX_ENTRIES) network.delete(network.keys().next().value);
      schedulePaint();
    } else if (typeof data.text === 'string') appendLog(data);
  }

  function navigated(id) {
    if (id !== target) return;
    if (ready) refreshDocument();
    else updateTarget(true);
  }

  return { setPage, toggle: toggleDock, handle, navigated };
}

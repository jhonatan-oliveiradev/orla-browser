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
  const styleFilter = byId('devtools-style-filter');
  const consoleList = byId('devtools-console-list');
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
  let domRequest = 0;
  let paint = 0;

  function command(id, action, params = {}) {
    return invoke('devtools_action', { id, action, ...params });
  }

  function setStatus(text = '') {
    status.textContent = text;
  }

  function updateControls() {
    for (const control of dock.querySelectorAll('[data-requires-devtools]')) control.disabled = !ready;
  }

  function nodeLabel(node) {
    const name = node.localName || node.nodeName || '#nó';
    if (node.nodeType === 3 || node.nodeType === 8) return name + ' ' + (node.nodeValue || '').trim().slice(0, 90);
    if (node.nodeType !== 1) return name;
    const attributes = node.attributes || [];
    const suffix = attributes.slice(0, 8).flatMap((value, index) =>
      index % 2 ? [] : [' ' + value + '="' + String(attributes[index + 1] || '').slice(0, 45) + '"']
    ).join('');
    return '<' + name + suffix + '>';
  }

  function renderStyles() {
    const term = styleFilter.value.toLowerCase().trim();
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
    byId('devtools-style-empty').hidden = Boolean(computedStyles.length);
  }

  async function selectNode(record) {
    selectedNode?.label.removeAttribute('aria-current');
    selectedNode = record;
    record.label.setAttribute('aria-current', 'true');
    computedStyles = [];
    renderStyles();
    if (record.node.nodeType !== 1 || !ready) return;
    const id = target;
    try {
      const result = await command(id, 'styles', { nodeId: record.node.nodeId });
      if (target !== id || selectedNode !== record) return;
      computedStyles = result.computedStyle || [];
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
      label.textContent = nodeLabel(node);
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
      nodes.clear();
      selectedNode = null;
      computedStyles = [];
      tree.replaceChildren();
      renderStyles();
      if (root) addNodes(tree, root.children || [root]);
    } catch (error) {
      if (target === id && request === domRequest) setStatus(String(error.message ?? error));
    }
  }

  function renderConsole() {
    const content = document.createDocumentFragment();
    for (const { level, text } of logs) {
      const row = document.createElement('li');
      row.dataset.level = level;
      const kind = document.createElement('small');
      const message = document.createElement('code');
      kind.textContent = level;
      message.textContent = text;
      row.append(kind, message);
      content.append(row);
    }
    const scroller = consoleList.parentElement;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 30;
    consoleList.replaceChildren(content);
    if (nearBottom) scroller.scrollTop = scroller.scrollHeight;
    byId('devtools-console-empty').hidden = Boolean(logs.length);
  }

  function renderNetwork() {
    const filter = networkFilter.value.trim().toLowerCase();
    const content = document.createDocumentFragment();
    for (const request of network.values()) {
      if (filter && ![request.url, request.method, request.status, request.kind, request.error]
        .some((part) => String(part || '').toLowerCase().includes(filter))) continue;
      const row = document.createElement('tr');
      const state = request.error ? 'Falhou' : request.status || '—';
      const cells = [request.method || '—', state, request.kind || '—', request.url || '—'];
      for (const value of cells) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      if (request.error) row.title = request.error;
      content.append(row);
    }
    byId('devtools-network-empty').hidden = Boolean(content.childElementCount);
    requests.replaceChildren(content);
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
    tree.replaceChildren();
    logs.length = 0;
    network.clear();
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
          await command(id, 'start');
          connected = true;
        }
        if (target !== id) return;
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
  networkFilter.addEventListener('input', renderNetwork);
  byId('devtools-clear-console').addEventListener('click', () => { logs.length = 0; renderConsole(); });
  byId('devtools-clear-network').addEventListener('click', () => { network.clear(); renderNetwork(); });
  byId('devtools-console-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = expression.value.trim();
    if (!ready || !code) return;
    const id = target;
    expression.value = '';
    appendLog({ level: 'entrada', text: code });
    try {
      const { text } = await command(id, 'evaluate', { expression: code });
      if (target === id) appendLog({ level: 'resultado', text });
    } catch (error) {
      if (target === id) appendLog({ level: 'error', text: String(error.message ?? error) });
    }
  });

  const divider = byId('devtools-divider');
  let drag;
  function resize(pixels) {
    const max = Math.round(innerHeight * .58);
    const height = Math.min(max, Math.max(150, Math.round(pixels)));
    dock.style.setProperty('--devtools-height', height + 'px');
    divider.setAttribute('aria-valuemax', String(max));
    divider.setAttribute('aria-valuenow', String(height));
    onLayout();
  }
  new ResizeObserver(() => {
    if (dock.hidden) return;
    divider.setAttribute('aria-valuemax', String(Math.round(innerHeight * .58)));
    divider.setAttribute('aria-valuenow', String(dock.offsetHeight));
  }).observe(dock);
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    divider.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, height: dock.offsetHeight };
  });
  divider.addEventListener('pointermove', (event) => {
    if (drag) resize(drag.height + drag.y - event.clientY);
  });
  divider.addEventListener('lostpointercapture', () => { drag = undefined; });
  divider.addEventListener('keydown', (event) => {
    const step = { ArrowUp: 24, ArrowDown: -24 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    resize(dock.offsetHeight + step);
  });

  function handle({ id, event, data }) {
    if (id !== target) return;
    if (event === 'DOM.setChildNodes') {
      const parent = nodes.get(data.parentId);
      if (parent && !parent.list.childElementCount) addNodes(parent.list, data.nodes || []);
    } else if (event.startsWith('Network.')) {
      if (typeof data.id !== 'string') return;
      if (event === 'Network.requestWillBeSent') network.set(data.id, data);
      else if (network.has(data.id)) Object.assign(network.get(data.id), data);
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

export const SIDEBAR_MIN = 184;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 240;

export function sidebarWidth(value) {
  if (!Number.isFinite(value)) return SIDEBAR_DEFAULT;
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, value)));
}

export function initSidebar({ width, collapsed, onChange, onResize }) {
  const sidebar = document.getElementById('tab-sidebar');
  const divider = document.getElementById('sidebar-divider');
  const toggle = document.getElementById('tabs-toggle');
  let drag;

  function render() {
    sidebar.style.setProperty('--sidebar-width', width + 'px');
    sidebar.dataset.collapsed = String(collapsed);
    const label = collapsed ? 'Expandir barra de abas' : 'Recolher barra de abas';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    divider.hidden = collapsed;
    divider.setAttribute('aria-valuemin', String(SIDEBAR_MIN));
    divider.setAttribute('aria-valuemax', String(SIDEBAR_MAX));
    divider.setAttribute('aria-valuenow', String(width));
  }

  function changeWidth(value) {
    width = sidebarWidth(value);
    render();
    onResize();
  }

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    render();
    onChange({ width, collapsed });
    onResize();
  });
  divider.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 32 : 8;
    const next = {
      ArrowLeft: width - step,
      ArrowRight: width + step,
      Home: SIDEBAR_MIN,
      End: SIDEBAR_MAX,
    }[event.key];
    if (!Number.isFinite(next)) return;
    event.preventDefault();
    changeWidth(next);
    onChange({ width, collapsed });
  });
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    divider.focus();
    divider.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, width };
  });
  divider.addEventListener('pointermove', (event) => {
    if (drag?.id === event.pointerId) changeWidth(drag.width + event.clientX - drag.x);
  });
  divider.addEventListener('lostpointercapture', (event) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    onChange({ width, collapsed });
  });

  render();
}

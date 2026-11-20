const STORAGE_KEY = 'orla.devtools.dock.v1';
const POSITIONS = ['bottom', 'left', 'right'];

export function initDevToolsDock(panel, onLayout) {
  const stage = panel.parentElement;
  const select = panel.querySelector('#devtools-position');
  const divider = panel.querySelector('#devtools-divider');
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* Use defaults. */ }
  let preferred = POSITIONS.includes(saved?.position) ? saved.position : 'bottom';
  let height = Number.isInteger(saved?.height) ? saved.height : 310;
  let width = Number.isInteger(saved?.width) ? saved.width : 405;
  let position;
  let drag;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ position: preferred, height, width })); } catch { /* Keep settings in memory. */ }
  }

  function limits() {
    return position === 'bottom'
      ? [138, Math.max(138, Math.floor(stage.clientHeight * .66))]
      : [255, Math.max(255, stage.clientWidth - 230)];
  }

  function apply() {
    const next = stage.clientWidth < 530 ? 'bottom' : preferred;
    if (position !== next && drag) {
      if (divider.hasPointerCapture(drag.id)) divider.releasePointerCapture(drag.id);
      drag = undefined;
    }
    position = next;
    const bottom = position === 'bottom';
    const [min, max] = limits();
    const size = Math.min(max, Math.max(min, bottom ? height : width));
    stage.dataset.devtoolsDock = position;
    stage.style.setProperty('--devtools-size', size + 'px');
    select.value = preferred;
    select.title = position !== preferred ? 'O encaixe lateral volta quando a janela tiver espaço.' : 'Posição do painel';
    divider.setAttribute('aria-label', bottom ? 'Altura da DevTools' : 'Largura da DevTools');
    divider.setAttribute('aria-orientation', bottom ? 'horizontal' : 'vertical');
    divider.setAttribute('aria-valuemin', min);
    divider.setAttribute('aria-valuemax', max);
    divider.setAttribute('aria-valuenow', size);
    if (!panel.hidden) onLayout();
  }

  function resize(size) {
    const [min, max] = limits();
    const value = Math.min(max, Math.max(min, size));
    if (position === 'bottom') height = value;
    else width = value;
    apply();
  }

  select.addEventListener('change', () => {
    preferred = select.value;
    apply();
    persist();
  });
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const bottom = position === 'bottom';
    divider.setPointerCapture(event.pointerId);
    drag = {
      id: event.pointerId,
      start: bottom ? event.clientY : event.clientX,
      size: bottom ? panel.offsetHeight : panel.offsetWidth,
    };
  });
  divider.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const pointer = position === 'bottom' ? event.clientY : event.clientX;
    resize(drag.size + (pointer - drag.start) * (position === 'left' ? 1 : -1));
  });
  divider.addEventListener('lostpointercapture', () => {
    drag = undefined;
    persist();
  });
  divider.addEventListener('keydown', (event) => {
    const bottom = position === 'bottom';
    const deltas = bottom ? { ArrowUp: 24, ArrowDown: -24 } : { ArrowLeft: -24, ArrowRight: 24 };
    const delta = deltas[event.key];
    const [min, max] = limits();
    if (event.key === 'Home') resize(min);
    else if (event.key === 'End') resize(max);
    else if (delta !== undefined) resize((bottom ? panel.offsetHeight : panel.offsetWidth) + delta * (position === 'right' ? -1 : 1));
    else return;
    event.preventDefault();
    persist();
  });
  new ResizeObserver(apply).observe(stage);
  apply();
}

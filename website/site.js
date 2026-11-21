const tabs = [...document.querySelectorAll('.demo-tabs [role="tab"]')];
const spaceButtons = [...document.querySelectorAll('[data-space]')];
const sides = {
  research: { name: 'Pesquisa', tabs: ['Referências', 'Notas do projeto'], favorites: ['Referências', 'Documentação', 'Notas'] },
  studio: { name: 'Estúdio', tabs: ['Briefing', 'Painel do cliente'], favorites: ['Briefing', 'Protótipo', 'Painel do cliente'] },
};
const panelNames = ['Nova aba', 'Guia do projeto e Referências', 'Capturas do espaço'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function activate(index, focus = false) {
  tabs.forEach((tab, i) => {
    const active = i === index;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (!active && panel.contains(document.activeElement)) tabs[index].focus();
    panel.hidden = !active;
    panel.classList.toggle('is-entering', active);
  });
  document.getElementById('demo-address').textContent = panelNames[index];
  if (focus) tabs[index].focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(index));
  tab.addEventListener('keydown', (event) => {
    const counts = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in counts)) return;
    event.preventDefault();
    activate((counts[event.key] + tabs.length) % tabs.length, true);
  });
});

for (const button of spaceButtons) {
  button.addEventListener('click', () => {
    const space = sides[button.dataset.space];
    for (const item of spaceButtons) item.setAttribute('aria-pressed', String(item === button));
    document.getElementById('space-title').textContent = space.name;
    document.getElementById('space-initial').textContent = space.name[0];
    const sidebarRows = [...document.querySelectorAll('#demo-tabs li')].slice(1);
    for (const [index, row] of sidebarRows.entries()) row.lastChild.textContent = ' ' + space.tabs[index];
    const favorites = [...document.querySelectorAll('#demo-favorites span')];
    for (const [index, item] of favorites.entries()) item.textContent = space.favorites[index];
    activate(0);
  });
}

const split = document.getElementById('demo-split');
const handle = split.querySelector('[role="separator"]');
let splitPosition = 50;

function resizeSplit(next) {
  splitPosition = Math.round(Math.min(70, Math.max(30, next)));
  split.style.setProperty('--split', splitPosition + '%');
  handle.setAttribute('aria-valuenow', String(splitPosition));
}

handle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  handle.setPointerCapture(event.pointerId);
});
handle.addEventListener('pointermove', (event) => {
  if (!handle.hasPointerCapture(event.pointerId)) return;
  const rect = split.getBoundingClientRect();
  resizeSplit(100 * (event.clientX - rect.left) / rect.width);
});
handle.addEventListener('keydown', (event) => {
  const positions = { ArrowLeft: splitPosition - 4, ArrowRight: splitPosition + 4, Home: 30, End: 70 };
  if (!(event.key in positions)) return;
  event.preventDefault();
  resizeSplit(positions[event.key]);
});

const query = document.getElementById('demo-query');
const clips = [...document.querySelectorAll('#demo-items li')];
const normalize = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
query.addEventListener('input', () => {
  const words = normalize(query.value).trim().split(/\s+/);
  for (const item of clips) item.hidden = !words.every((word) => normalize(item.textContent).includes(word));
  document.getElementById('demo-empty').hidden = clips.some((item) => !item.hidden);
});

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (!motion.matches) {
        entry.target.animate([{ opacity: .78, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 740, easing: 'cubic-bezier(.16,1,.3,1)',
        });
      }
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((section) => reveal.observe(section));
}

const scene = document.getElementById('terrain-canvas');
const loadScene = () => {
  if (!motion.matches && matchMedia('(pointer: fine) and (min-width: 720px)').matches) {
    import('./terrain.js').then(({ mountTerrain }) => mountTerrain(scene, motion)).catch(() => {});
  }
};
if ('requestIdleCallback' in window) requestIdleCallback(loadScene, { timeout: 650 });
else setTimeout(loadScene, 0);

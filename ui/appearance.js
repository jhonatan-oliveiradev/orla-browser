const THEMES = ['lima', 'lavanda', 'areia', 'oceano', 'grafite'];
const PALETTES = {
  lima: { accent: '#d9ff74', surface: '#2c2821', toward: 255 },
  lavanda: { accent: '#c8b7ff', surface: '#2d2939', toward: 255 },
  areia: { accent: '#42521a', surface: '#dbcfbb', toward: 0 },
  oceano: { accent: '#80e6dc', surface: '#203442', toward: 255 },
  grafite: { accent: '#e2e4eb', surface: '#303038', toward: 255 },
};

export function readAppearance(saved) {
  const settings = {
    theme: THEMES.includes(saved?.theme) ? saved.theme : 'lima',
    motion: saved?.motion !== false,
  };
  if (typeof saved?.accent === 'string' && /^#[a-f\d]{6}$/i.test(saved.accent)) settings.accent = saved.accent.toLowerCase();
  if (saved?.density === 'compact') settings.density = 'compact';
  if (saved?.surface === 'solid') settings.surface = 'solid';
  return settings;
}

function channels(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(rgb) {
  return rgb.reduce((total, byte, index) => {
    const value = byte / 255;
    const linear = value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    return total + linear * [.2126, .7152, .0722][index];
  }, 0);
}

export function visibleAccent(color, theme) {
  const { surface, toward } = PALETTES[theme];
  const base = luminance(channels(surface));
  const original = channels(color);
  for (let step = 0; step <= 20; step++) {
    const rgb = original.map((value) => Math.round(value + (toward - value) * step / 20));
    const ink = luminance(rgb);
    if ((Math.max(ink, base) + .05) / (Math.min(ink, base) + .05) >= 4.8) {
      return '#' + rgb.map((value) => value.toString(16).padStart(2, '0')).join('');
    }
  }
  return PALETTES[theme].accent;
}

export function initAppearance(settings, onChange) {
  const dialog = document.getElementById('appearance-dialog');
  const radios = dialog.querySelectorAll('input[name="theme"]');
  const root = document.documentElement;
  const motion = document.getElementById('appearance-motion');
  const accent = document.getElementById('appearance-accent');
  const accentHint = document.getElementById('appearance-accent-hint');
  const resetAccent = document.getElementById('appearance-reset-accent');
  const compact = document.getElementById('appearance-compact');
  const solid = document.getElementById('appearance-solid');

  function apply(next) {
    root.dataset.theme = next.theme;
    root.dataset.motion = next.motion ? 'on' : 'off';
    root.dataset.density = next.density || 'comfortable';
    root.dataset.surface = next.surface || 'glass';
    const display = next.accent ? visibleAccent(next.accent, next.theme) : '';
    if (display) root.style.setProperty('--accent-user', display);
    else root.style.removeProperty('--accent-user');
    for (const radio of radios) radio.checked = radio.value === next.theme;
    accent.value = next.accent || PALETTES[next.theme].accent;
    accentHint.textContent = display && display !== next.accent ? 'Tonalidade ajustada para melhorar o contraste.' : '';
    resetAccent.disabled = !next.accent;
    compact.checked = next.density === 'compact';
    solid.checked = next.surface === 'solid';
    motion.checked = next.motion;
  }

  function commit(next) {
    settings = readAppearance(next);
    apply(settings);
    onChange(settings);
  }

  apply(settings);
  dialog.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.matches('input')) return;
    commit({
      theme: target.name === 'theme' ? target.value : settings.theme,
      accent: target === accent ? accent.value : settings.accent,
      motion: motion.checked,
      density: compact.checked ? 'compact' : '',
      surface: solid.checked ? 'solid' : '',
    });
  });
  resetAccent.addEventListener('click', () => commit({ ...settings, accent: '' }));
}

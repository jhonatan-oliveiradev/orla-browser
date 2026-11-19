const THEMES = ['lima', 'lavanda', 'areia'];

export function readAppearance(saved) {
  return {
    theme: THEMES.includes(saved?.theme) ? saved.theme : 'lima',
    motion: saved?.motion !== false,
  };
}

export function initAppearance(settings, onChange) {
  const dialog = document.getElementById('appearance-dialog');
  const radios = dialog.querySelectorAll('input[name="theme"]');
  const motion = document.getElementById('appearance-motion');

  function apply(next) {
    document.documentElement.dataset.theme = next.theme;
    document.documentElement.dataset.motion = next.motion ? 'on' : 'off';
    for (const radio of radios) radio.checked = radio.value === next.theme;
    motion.checked = next.motion;
  }

  apply(settings);
  dialog.addEventListener('change', (event) => {
    settings = readAppearance({
      theme: event.target.name === 'theme' ? event.target.value : settings.theme,
      motion: motion.checked,
    });
    apply(settings);
    onChange(settings);
  });
}

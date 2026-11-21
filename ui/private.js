import { resolveAddress } from './address.js';

const field = document.getElementById('private-address');
const stage = document.getElementById('private-stage');
const status = document.getElementById('private-status');
const { core, event } = window.__TAURI__;

async function page(action, address) {
  const { x, y, width, height } = stage.getBoundingClientRect();
  try {
    await core.invoke('private_page', { action, address, viewport: { x, y, width, height } });
    status.hidden = true;
    if (action === 'navigate') stage.classList.add('private-loaded');
  } catch (error) {
    status.textContent = String(error.message ?? error);
    status.hidden = false;
  }
}

document.getElementById('private-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try { page('navigate', resolveAddress(field.value)); }
  catch (error) { status.textContent = error.message; status.hidden = false; }
});
for (const button of document.querySelectorAll('[data-private-action]')) {
  button.addEventListener('click', () => page(button.dataset.privateAction));
}
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    field.focus();
    field.select();
  }
});
await event.listen('orla-private-location', ({ payload }) => { if (document.activeElement !== field) field.value = payload; });
new ResizeObserver(() => page('resize')).observe(stage);

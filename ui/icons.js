import { createMorph } from './vendor/morphicons/dom.js';

const paths = {
  sidebar: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M10 4v16 M7 8h.01 M7 12h.01',
  sidebarClosed: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M7 4v16 M13 9l3 3-3 3',
  pin: 'M16 3H8 M9 3v6l-3 4v2h12v-2l-3-4V3 M12 15v6',
  pinned: 'M20 8l-4-4 M17 5l-4 4-5 1-2 2 6 6 2-2 1-5 4-4 M9 15l-5 5',
  star: 'M12 3l2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 17.05l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z',
  starred: 'M12 2l3.1 6.2 6.9 1-5 4.9 1.18 6.9L12 17.75 5.82 21 7 14.1l-5-4.9 6.9-1L12 2Z',
  close: 'M6 6l12 12 M18 6 6 18',
  maximize: 'M5 5h14v14H5V5Z',
  restore: 'M8 4h12v12 M4 8h12v12H4V8Z',
  devtools: 'M8 6l-5 6 5 6 M16 6l5 6-5 6 M14 4l-4 16',
  download: 'M12 3v12 M8 11l4 4 4-4 M4 16v4h16v-4',
  appearance: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.6-3.2 1.5 1.5 0 0 1 1.2-2.4h2.5c2 0 2.7-1.5 2.7-3.4a9 9 0 0 0-9-9Z M7.5 10h.1 M10 6.6h.1 M14.2 6.7h.1 M17.4 9.6h.1',
  agent: 'M12 2l1.9 5.9L20 10l-6.1 2.1L12 18l-1.9-5.9L4 10l6.1-2.1L12 2Z M19 15v6 M16 18h6',
  chevron: 'M6 9l6 6 6-6',
  reopen: 'M3 5v6h6 M3.5 10.5A8.5 8.5 0 1 1 5 18',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M3 12h18 M12 3c4 4 4 14 0 18-4-4-4-14 0-18Z',
  page: 'M6 3h8l4 4v14H6V3Z M14 3v5h4 M9 12h6 M9 16h6',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0Z M14.5 14.5 20 20',
  forward: 'M5 12h14 M13 6l6 6-6 6',
  play: 'M8 4l12 8-12 8V4Z',
  pause: 'M8 4v16 M16 4v16',
};

const namespace = 'http://www.w3.org/2000/svg';
const mounted = new WeakMap();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function setIcon(target, name, animate = false) {
  let icon = mounted.get(target);
  if (!icon) {
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(namespace, 'path');
    svg.append(path);
    target.prepend(svg);
    icon = { path };
    mounted.set(target, icon);
  }
  if (icon.name === name) return;
  if (animate && icon.name && !reduceMotion.matches) {
    icon.morph ??= createMorph(icon.path, paths[icon.name], { reducedMotion: 'user' });
    icon.morph.morphTo(paths[name], 'snappy');
  } else if (icon.morph) {
    icon.morph.set(paths[name]);
  } else {
    icon.path.setAttribute('d', paths[name]);
  }
  icon.name = name;
  target.dataset.iconState = name;
}

export function releaseIcon(target) {
  mounted.get(target)?.morph?.destroy();
  mounted.delete(target);
}

export function readSplit(value, urls) {
  const { left, right, ratio } = value ?? {};
  if (!Number.isInteger(left) || !Number.isInteger(right) || left === right || !urls[left] || !urls[right]) return null;
  return { left, right, ratio: splitRatio(ratio) };
}

export function splitRatio(value) {
  return Number.isFinite(value) ? Math.min(.72, Math.max(.28, value)) : .5;
}

export function bindSplit(view, change, finish) {
  const divider = document.getElementById('split-divider');
  let pointer;
  divider.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointer = event.pointerId;
    divider.setPointerCapture(pointer);
  });
  divider.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    const rect = view.getBoundingClientRect();
    change(splitRatio((event.clientX - rect.left) / rect.width));
  });
  divider.addEventListener('lostpointercapture', () => { pointer = undefined; finish(); });
  divider.addEventListener('keydown', (event) => {
    const current = Number(divider.getAttribute('aria-valuenow')) / 100;
    const next = { ArrowLeft: current - .04, ArrowRight: current + .04, Home: .28, End: .72 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    change(splitRatio(next));
    finish();
  });
}

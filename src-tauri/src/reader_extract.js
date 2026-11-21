(() => {
  const choices = [...document.querySelectorAll('article, [role="main"], main')].slice(0, 20);
  const root = choices.reduce((best, node) => node.textContent.length > best.textContent.length ? node : best, choices[0]) || document.body;
  if (!root) return null;
  const blocks = [];
  let length = 0;
  for (const node of root.querySelectorAll('p, h2, h3, h4, blockquote, li')) {
    if (node.closest('nav, footer, aside, form, dialog, [aria-hidden="true"], [hidden]')) continue;
    if (node.getClientRects().length === 0 || getComputedStyle(node).visibility !== 'visible') continue;
    if (node.matches('li, blockquote') && node.querySelector('p,li,blockquote')) continue;
    const text = node.innerText?.trim().slice(0, 3500);
    if (!text || text.length < 4) continue;
    blocks.push({ text, heading: /^H[234]$/.test(node.tagName) });
    length += text.length;
    if (blocks.length >= 160 || length > 42000) break;
  }
  if (length < 100) return null;
  return { title: (root.querySelector('h1')?.innerText || document.title || location.hostname).trim().slice(0, 200), blocks };
})()

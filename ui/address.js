export function resolveAddress(value) {
  const input = value.trim();
  if (!input) throw new Error('Digite um endereço ou uma pesquisa.');

  const scheme = input.match(/^([a-z][a-z\d+.-]*):/i);
  const hostWithPort = /^(?:localhost|[\w-]+(?:\.[\w-]+)+):\d+(?:[/?#]|$)/i.test(input);
  const explicit = scheme && !hostWithPort;
  if (explicit && !/^https?:\/\//i.test(input)) {
    throw new Error('Use um endereço HTTP ou HTTPS.');
  }

  const looksLikeHost = /^(?:localhost|[\w-]+(?:\.[\w-]+)+|\[[a-f\d:]+\])(?::\d+)?(?:[/?#]|$)/i.test(input);
  if (explicit || (!/\s/.test(input) && looksLikeHost)) {
    const url = new URL(explicit ? input : 'https://' + input);
    if (url.username || url.password) throw new Error('Use um endereço sem credenciais.');
    return url.href;
  }

  const search = new URL('https://duckduckgo.com/');
  search.searchParams.set('q', input);
  return search.href;
}

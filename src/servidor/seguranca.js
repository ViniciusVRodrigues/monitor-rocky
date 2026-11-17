/** Segurança do servidor local: Host, cabeçalhos, CSRF e Sec-Fetch-Site. */

export const CSP = "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; " +
  "connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

/** Cabeçalhos de toda resposta. */
export function cabecalhosBase(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/** Hosts aceitos (sem diferenciar caixa): 127.0.0.1:<porta>, localhost:<porta> e hostsPermitidos. */
export function hostPermitido(host, porta, extras = []) {
  if (typeof host !== 'string' || !host) return false;
  const h = host.toLowerCase();
  if (h === `127.0.0.1:${porta}` || h === `localhost:${porta}`) return true;
  return extras.some((x) => String(x).toLowerCase() === h);
}

/** Leituras: recusa pedidos marcados como de outro site. */
export function leituraPermitida(req) {
  return req.headers['sec-fetch-site'] !== 'cross-site';
}

/** CSRF do POST de controle. Devolve true se o pedido pode seguir. */
export function controlePermitido(req) {
  const h = req.headers;
  const tipo = String(h['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/json') return false;
  if (h['x-rocky'] !== '1') return false;
  const site = h['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  if (h.origin !== undefined) {
    const host = String(h.host ?? '');
    if (!host || (h.origin !== `http://${host}` && h.origin !== `https://${host}`)) return false;
  }
  return true;
}

/** Responde JSON (sem cache). */
export function json(res, status, corpo, extra = {}) {
  const txt = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(txt),
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(txt);
}

export function naoEncontrado(res) {
  json(res, 404, { ok: false, erro: 'Não encontrado.' });
}
